# Cache Cascade Invalidation Research for `invalidateSettlementCascade()`

## 1. Settlement-Structure Relationship

### Query Pattern

**Location**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/structure.service.ts`

```typescript
// Lines 92-99: findBySettlement method
async findBySettlement(
  settlementId: string,
  user: AuthenticatedUser
): Promise<PrismaStructure[]> {
  const branchId = 'main';
  const cacheKey = `structures:settlement:${settlementId}:${branchId}`;
  // ... cache check ...

  // Query all structures in settlement
  const structures = await this.prisma.structure.findMany({
    where: {
      settlementId,
      deletedAt: null,
    },
    orderBy: {
      name: 'asc',
    },
  });
}
```

**Key Points**:

- Query by `settlementId` with `deletedAt: null` filter
- Results ordered by name
- Both branchId and settlement-specific queries are used

### Cascade Delete Pattern

**Location**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/settlement.service.ts` (lines 629-633)

When settlement is deleted, structures are automatically soft-deleted:

```typescript
// Cascade delete to structures
await this.prisma.structure.updateMany({
  where: { settlementId: id, deletedAt: null },
  data: { deletedAt },
});
```

---

## 2. Cache Key Patterns (with Line Numbers)

### Settlement Computed Fields

**Pattern**: `computed-fields:settlement:{id}:{branchId}`

- **Example**: `computed-fields:settlement:123:main`
- **Location**: settlement.service.ts, line 534 and 978
- **Usage**: Caches computed field evaluations for settlements
- **TTL**: 300 seconds (line 1096)

### Settlement Structures List

**Pattern**: `structures:settlement:{settlementId}:{branchId}`

- **Example**: `structures:settlement:123:main`
- **Location**: structure.service.ts, lines 99, 380, 693, 763
- **Usage**: Caches list of structures in a settlement
- **TTL**: 600 seconds (line 156)

### Structure Computed Fields

**Pattern**: `computed-fields:structure:{id}:{branchId}`

- **Example**: `computed-fields:structure:456:main`
- **Location**: structure.service.ts, line 557
- **Usage**: Caches computed field evaluations for structures
- **TTL**: 300 seconds (similar pattern to settlements)

### Spatial Query Cache

**Pattern**: `spatial:{queryType}:{params...}:{branchId}`

- **Examples**:
  - `spatial:settlements-in-region:789:main` (line 735 in spatial.service.ts)
  - `spatial:locations-near:normalizedParams:main` (line 531)
  - `spatial:locations-in-region:queryParams:main` (line 629)
- **Location**: spatial.service.ts, buildSpatialQueryKey usage
- **Key insight**: Settlement locations affect spatial queries (settlement.service.ts line 560 comment)

---

## 3. Cache Key Builder Utilities

**Location**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache-key.builder.ts`

### Key Functions Available

1. **buildCacheKey()** (lines 54-74)
   - Generic builder: `{prefix}:{entityType}:{entityId}:...:{branchId}`
   - branchId always comes last

2. **buildEntityListKey()** (lines 191-203)
   - Purpose: List caches like `structures:settlement:123:main`
   - Signature: `buildEntityListKey(childType, parentType, parentId, branchId)`
   - Example: `buildEntityListKey('structures', 'settlement', '123', 'main')`

3. **buildComputedFieldsKey()** (lines 156-167)
   - Purpose: Computed field caches
   - Signature: `buildComputedFieldsKey(entityType, entityId, branchId)`
   - Example: `buildComputedFieldsKey('settlement', '123', 'main')`

4. **buildSpatialQueryKey()** (lines 225-235)
   - Purpose: Spatial query caches
   - Signature: `buildSpatialQueryKey(queryType, queryParams, branchId)`
   - Example: `buildSpatialQueryKey('settlements-in-region', ['789'], 'main')`

### Pattern Functions for Invalidation

1. **buildPrefixPattern()** (lines 94-96)
   - Returns: `{prefix}:*`
   - Example: `buildPrefixPattern('computed-fields')` → `computed-fields:*`

2. **buildEntityPattern()** (lines 115-117)
   - Returns: `*:{entityType}:{entityId}:{branchId}`
   - Example: `buildEntityPattern('settlement', '123', 'main')` → `*:settlement:123:main`
   - **This matches ALL prefixes for an entity**

3. **buildBranchPattern()** (lines 134-136)
   - Returns: `*:{branchId}`
   - Useful for branch-level invalidation

---

## 4. Existing Invalidation Patterns

### Settlement Service Examples

**Location**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/settlement.service.ts`

#### 1. Settlement Creation (lines 358-372)

```typescript
// Invalidate kingdom's settlement list cache
const branchId = 'main';
const cacheKey = `settlements:kingdom:${input.kingdomId}:${branchId}`;
await this.cache.del(cacheKey);
```

#### 2. Settlement Update (lines 531-543)

```typescript
// Invalidate computed fields cache
const cacheKey = `computed-fields:settlement:${id}:${branchId}`;
await this.cache.del(cacheKey);

// Also invalidates dependency graph
this.dependencyGraph.invalidateGraph(settlementWithKingdom!.kingdom.campaignId, branchId);
```

#### 3. Settlement Deletion (lines 660-674)

```typescript
// Invalidate kingdom's settlement list cache
const branchId = 'main';
const cacheKey = `settlements:kingdom:${settlement.kingdomId}:${branchId}`;
await this.cache.del(cacheKey);
```

#### 4. Settlement Level Change (lines 883-897)

```typescript
// Invalidate computed fields cache
const branchId = 'main';
const cacheKey = `computed-fields:settlement:${id}:${branchId}`;
await this.cache.del(cacheKey);

// Also invalidates campaign context
await this.campaignContext.invalidateContextForEntity(
  'settlement',
  id,
  settlementWithKingdom!.kingdom.campaignId
);

// Also invalidates dependency graph
this.dependencyGraph.invalidateGraph(settlementWithKingdom!.kingdom.campaignId);
```

### Structure Service Examples

**Location**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/structure.service.ts`

#### 1. Structure Creation (lines 375-389)

```typescript
const branchId = 'main';
const cacheKey = `structures:settlement:${input.settlementId}:${branchId}`;
await this.cache.del(cacheKey);
```

#### 2. Structure Update (lines 554-566)

```typescript
const cacheKey = `computed-fields:structure:${id}:${branchId}`;
await this.cache.del(cacheKey);

// Also invalidates dependency graph
this.dependencyGraph.invalidateGraph(
  structureWithRelations!.settlement.kingdom.campaignId,
  branchId
);
```

#### 3. Structure Deletion (lines 688-702)

```typescript
const branchId = 'main';
const cacheKey = `structures:settlement:${structure.settlementId}:${branchId}`;
await this.cache.del(cacheKey);
```

---

## 5. Error Handling Pattern

All existing invalidation follows this try-catch pattern:

```typescript
try {
  const cacheKey = `...`;
  await this.cache.del(cacheKey);
  this.logger.debug(`Invalidated ... cache: ${cacheKey}`);
} catch (error) {
  // Log but don't throw - cache invalidation is optional
  this.logger.warn(
    `Failed to invalidate ... cache for settlement ${id}`,
    error instanceof Error ? error.message : undefined
  );
}
```

**Key Principle**: Cache invalidation failures should NOT block the main operation. They are logged for monitoring but gracefully degraded.

---

## 6. Spatial Query Cache Comment

**Location**: settlement.service.ts, lines 558-561

```typescript
// NOTE: If locationId update support is added in the future, spatial cache invalidation required here:
// Settlement location changes affect spatial queries (settlements-in-region)
// Invalidate pattern: `spatial:settlements-in-region:*:${branchId}`
// Currently, settlement locations are immutable after creation (no locationId in UpdateSettlementInput)
```

This confirms that settlements affect spatial caches with pattern: `spatial:settlements-in-region:*:${branchId}`

---

## 7. CacheService Interface

**Location**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.ts`

### Key Methods for Cascade

1. **delPattern()** (lines 208-245)
   - Deletes all keys matching a pattern
   - Returns: `{ success: boolean, keysDeleted: number, error?: string }`
   - Uses SCAN for safe iteration (doesn't block Redis)

2. **invalidatePattern()** (lines 280-292)
   - Semantic alias for delPattern() with enhanced logging
   - Logs at INFO level for production monitoring
   - Best for cascade operations

3. **del()** (lines 164-182)
   - Deletes single key
   - Returns: number of keys deleted (0 or 1)

### Example from Test

**Location**: cache.service.integration.test.ts, lines 211-232

```typescript
it('should handle entity-specific pattern deletion', async () => {
  await cacheService.set('computed-fields:settlement:123:main', { type: 'computed' });
  await cacheService.set('settlements:kingdom:456:main', { type: 'list' });
  await cacheService.set('spatial:settlement:123:main', { type: 'spatial' });

  // Delete all caches for settlement:123
  const result = await cacheService.delPattern('*:settlement:123:main');
  expect(result.success).toBe(true);
  expect(result.keysDeleted).toBe(2);
});
```

---

## 8. Cascade Invalidation Requirements Summary

For `invalidateSettlementCascade(settlementId, branchId)`:

1. **Settlement computed fields** → `computed-fields:settlement:{settlementId}:{branchId}`
   - Single delete operation

2. **Settlement structures list** → `structures:settlement:{settlementId}:{branchId}`
   - Single delete operation

3. **All structure computed fields in settlement**
   - Must query all structures first: `await this.prisma.structure.findMany({ where: { settlementId, deletedAt: null } })`
   - Then invalidate each: `computed-fields:structure:{structureId}:{branchId}`
   - OR use pattern: `computed-fields:structure:*:{branchId}` + somehow filter by settlement (not possible with patterns alone)
   - **Solution**: Query structures, then loop through invalidations OR use two-step pattern deletion

4. **Spatial caches** (settlement location-based)
   - Pattern: `spatial:settlements-in-region:*:{branchId}`
   - This is safe because it only affects settlement spatial queries, not structure ones

5. **Dependency graph** (optional but recommended)
   - Call: `this.dependencyGraph.invalidateGraph(campaignId, branchId)`
