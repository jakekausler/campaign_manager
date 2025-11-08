# StateVariableService Cache Invalidation Test Patterns

## File Locations

- **Test file**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/state-variable.service.test.ts`
- **Source file**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/state-variable.service.ts`
- **Cache service**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.ts`

## Current Test Structure (state-variable.service.test.ts)

### Test Module Setup

```typescript
// Lines 78-148 in state-variable.service.test.ts
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StateVariableService,
      {
        provide: PrismaService,
        useValue: {
          stateVariable: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
          },
          // ... other entity mocks
        },
      },
      // ... other services mocked
    ],
  }).compile();
  // ...
});
```

### Describe Block Structure

1. `describe('create', {...})` - Lines 154-323
2. `describe('findById', {...})` - Lines 325-383
3. `describe('findMany', {...})` - Lines 385-561
4. `describe('findByScope', {...})` - Lines 563-651
5. `describe('update', {...})` - Lines 653-804
6. `describe('delete', {...})` - Lines 806-855
7. `describe('toggleActive', {...})` - Lines 857-897
8. `describe('evaluateVariable', {...})` - Lines 899-949
9. `describe('verifyScopeAccess', {...})` - Lines 951-1021
10. `describe('buildOrderBy', {...})` - Lines 1023-1050

## CacheService Status

### Current State in Test File

**NOT YET MOCKED** in the StateVariableService test!

The service has `CacheService` as a dependency (lines 25, 39 in source file), but it's NOT included in the test module providers.

### CacheService Mocking Pattern (from condition.service.test.ts)

```typescript
// Lines 113-118 in condition.service.test.ts
{
  provide: CacheService,
  useValue: {
    invalidateCampaignComputedFields: jest.fn(),
  },
},

// In setup: cacheService = module.get<CacheService>(CacheService);
```

### CacheService Methods Available (from settlement.service.test.ts)

```typescript
// Lines 171-177 in settlement.service.test.ts
{
  provide: CacheService,
  useValue: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
  },
},
```

## StateVariableService Cache Invalidation Implementation

### What Happens in Source Code (state-variable.service.ts)

#### On CREATE (lines 97-122):

```typescript
// Invalidate entity's computed fields cache (settlements and structures)
if (variable.scope === VariableScope.SETTLEMENT) {
  await this.cacheService.del(`computed-fields:settlement:${variable.scopeId}:main`);
} else if (variable.scope === VariableScope.STRUCTURE) {
  await this.cacheService.del(`computed-fields:structure:${variable.scopeId}:main`);
}
```

#### On UPDATE (lines 391-416):

```typescript
// Same pattern as CREATE - invalidates computed fields cache
if (updated.scope === VariableScope.SETTLEMENT) {
  await this.cacheService.del(`computed-fields:settlement:${updated.scopeId}:main`);
} else if (updated.scope === VariableScope.STRUCTURE) {
  await this.cacheService.del(`computed-fields:structure:${updated.scopeId}:main`);
}
```

#### On DELETE (lines 442-467):

```typescript
// Same pattern as CREATE and UPDATE
if (deleted.scope === VariableScope.SETTLEMENT) {
  await this.cacheService.del(`computed-fields:settlement:${deleted.scopeId}:main`);
} else if (deleted.scope === VariableScope.STRUCTURE) {
  await this.cacheService.del(`computed-fields:structure:${deleted.scopeId}:main`);
}
```

## Key Findings

### 1. CacheService Needs to be Added to Test Module

The StateVariableService test module does NOT currently include CacheService mocking.

### 2. Cache Invalidation Pattern

- Uses `cacheService.del()` method with specific key format
- Key format: `computed-fields:{entityType}:{entityId}:main`
- Only for SETTLEMENT and STRUCTURE scopes
- Called in create(), update(), and delete() operations

### 3. Test Pattern Pattern

Should follow the settlement.service.test.ts pattern:

```typescript
{
  provide: CacheService,
  useValue: {
    del: jest.fn(),
    delPattern: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
},
```

### 4. Dependencies Injected into Service

1. PrismaService ✓ (already mocked)
2. AuditService ✓ (already mocked)
3. VariableEvaluationService ✓ (already mocked)
4. VersionService ✓ (already mocked)
5. DependencyGraphService ✓ (already mocked)
6. CacheService ✗ (NOT mocked - needs to be added)
7. RedisPubSub ✓ (already mocked as 'REDIS_PUBSUB')

## Test Writing Strategy

### Test Case: State Variable Create Should Invalidate Settlement Computed Fields Cache

**Key Assertions:**

1. When creating a SETTLEMENT-scoped StateVariable
2. `cacheService.del()` should be called with key `computed-fields:settlement:{settlementId}:main`
3. When creating a STRUCTURE-scoped StateVariable
4. `cacheService.del()` should be called with key `computed-fields:structure:{structureId}:main`
5. When creating other scope variables (WORLD, CAMPAIGN, etc.)
6. `cacheService.del()` should NOT be called

### Similar Tests Needed For:

- update() operation
- delete() operation

### Also Verify:

- DependencyGraphService.invalidateGraph() is called for all scopes
- RedisPublish event is published for all non-WORLD scopes
- All three cache invalidation aspects work together

## Mock Setup Code for StateVariable Tests

```typescript
// Add to beforeEach providers array:
{
  provide: CacheService,
  useValue: {
    del: jest.fn(),
    delPattern: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
},

// Add to variable declarations:
let cacheService: CacheService;

// Add to module.get calls:
cacheService = module.get<CacheService>(CacheService);
```
