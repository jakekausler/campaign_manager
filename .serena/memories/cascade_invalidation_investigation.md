# Cascade Invalidation Investigation - Root Cause Analysis

## Test Failure Summary

### Failing Tests (Cache not being invalidated):

1. **FieldCondition cascade invalidation** (3/3 tests failing):
   - Create test - cache entries remain after `conditionService.create()`
   - Update test - cache entries remain after `conditionService.update()`
   - Delete test - cache entries remain after `conditionService.delete()`

2. **Settlement level changes** (1/2 tests failing):
   - `setLevel()` test - cache entries remain (but `update()` test passes)

3. **StateVariable updates** (1/4 tests failing):
   - `stateVariableService.update()` test - cache entries remain

4. **FieldCondition concurrent changes** (1/3 concurrent tests failing)

5. **StateVariable concurrent updates** (1/4 concurrent tests failing)

### Passing Tests (Cache IS being invalidated):

- Settlement update - PASSES
- Settlement level changes with specific test - PASSES
- Structure update - PASSES
- Structure level changes - PASSES
- StateVariable create - PASSES
- StateVariable delete - PASSES
- All over-invalidation tests - PASS

## Code Analysis - Call Chains

### FieldCondition Service (Condition.service.ts)

**Create method (lines 115-170)**:

```typescript
await this.cacheService.invalidateCampaignComputedFields(campaignId, 'main');
```

Dependencies:

1. `getCampaignIdForCondition()` to find campaignId (lines 613-666)
2. Service is injected with CacheService

**Assumption**: The `invalidateCampaignComputedFields()` method exists and is being called.

### Cache Service (cache.service.ts)

**invalidateCampaignComputedFields method (lines 569-605)**:

```typescript
const settlementPattern = `computed-fields:settlement:*:${branchId}`;
const settlementResult = await this.delPattern(settlementPattern);
// ...
const structurePattern = `computed-fields:structure:*:${branchId}`;
const structureResult = await this.delPattern(structurePattern);
```

Dependencies:

1. Uses `delPattern()` method which should exist
2. Hardcoded branchId to 'main' in condition.service.ts

### Settlement Service (settlement.service.ts)

**Update method (lines 644)**:

```typescript
await this.cache.invalidateSettlementCascade(id, branchId);
```

**setLevel method (line 1044)**:

```typescript
await this.cache.invalidateSettlementCascade(id, branchId);
```

Dependencies:

1. Calls `invalidateSettlementCascade()` which exists (cache.service.ts lines 425-475)
2. Update test PASSES, setLevel test FAILS (but branchId issue)

### State Variable Service (state-variable.service.ts)

**Update method (lines 545-547)**:

```typescript
await this.cacheService.del(`computed-fields:settlement:${updated.scopeId}:main`);
// or
await this.cacheService.del(`computed-fields:structure:${updated.scopeId}:main`);
```

Hardcoded to 'main' - test might be using different branchId!

## Key Finding: Hardcoded 'main' BranchId

Test setup creates a branch with an ID:

```typescript
const branch = await prisma.branch.create({
  data: {
    name: 'main',
    campaignId,
  },
});
branchId = branch.id; // This is a UUID, not 'main'
```

But services hardcode branchId to 'main':

1. `condition.service.ts` line 159: `await this.cacheService.invalidateCampaignComputedFields(campaignId, 'main')`
2. `settlement.service.ts` line 1043: `const branchId = 'main'`
3. `state-variable.service.ts` lines 545, 547: hardcoded `'main'` in cache keys

Test caches are using the actual branch ID (UUID):

```typescript
const settlementCacheKey = `computed-fields:settlement:${settlementId}:${branchId}`;
```

This creates a KEY MISMATCH!

- Test sets cache with key: `computed-fields:settlement:abc123:uuid-id`
- Service tries to delete: `computed-fields:settlement:abc123:main`
- Result: Keys don't match, cache is NOT deleted

## Root Cause

**The services are using hardcoded 'main' as branchId, but tests are using the actual UUID of the created branch.**

This is a mismatch between:

- **Expected**: Cache keys use actual branch ID (UUID)
- **Actual**: Services use hardcoded string 'main'

## Why Some Tests Pass

Tests that work around this:

1. **Settlement update** - Uses `branchId` parameter correctly in `update()` method signature
2. **Structure update** - Uses `branchId` parameter correctly in `update()` method signature

Tests that fail:

1. **FieldCondition** - No branchId parameter, hardcoded to 'main'
2. **Settlement.setLevel()** - No branchId parameter, hardcoded to 'main'
3. **StateVariable.update()** - Hardcoded to 'main'

## Solution Options

1. **Add branchId parameter** to methods that lack it (setLevel, toggleActive for conditions, etc.)
2. **Determine branchId dynamically** from the entity's campaign's default branch
3. **Accept branchId as a parameter** throughout the codebase
4. **Update tests** to use 'main' as branch name instead of UUID

## Next Steps to Verify

1. Confirm that changing hardcoded 'main' to use actual branch ID fixes the tests
2. Check if there's a pattern for how other services determine branchId
3. Identify all services with hardcoded branchId
