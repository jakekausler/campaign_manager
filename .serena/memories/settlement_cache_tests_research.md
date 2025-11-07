# Settlement Service Cache Tests - Research Summary

## Overview

Research findings for writing unit tests for cache functionality in SettlementService, specifically for the computed fields caching feature recently added.

## Key Test Files Located

### 1. Cache Service Tests

**File**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.test.ts`

**Purpose**: Tests for the core CacheService that wraps Redis operations

**Key Patterns**:

- **Mock Setup**:
  ```typescript
  redis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
  };
  ```
- **Provider**: Uses `REDIS_CACHE` token for injection
- **Environment Config**: Sets `CACHE_DEFAULT_TTL`, `CACHE_METRICS_ENABLED`, `CACHE_LOGGING_ENABLED` in tests

**Test Coverage**:

- Cache hit/miss scenarios
- Complex nested object serialization/deserialization
- TTL handling (default and custom)
- Pattern-based deletion via SCAN
- Stats tracking (hits, misses, sets, deletes, hit rate)
- Graceful degradation on Redis failures
- Integration scenarios (miss → set → hit flows)

### 2. Settlement Service Tests

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/settlement.service.test.ts`

**Key Patterns for Mocking Dependencies**:

```typescript
providers: [
  SettlementService,
  {
    provide: PrismaService,
    useValue: {
      settlement: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      // ... other tables
    },
  },
  {
    provide: AuditService,
    useValue: { log: jest.fn() },
  },
  {
    provide: CacheService, // <-- How cache is mocked!
    useValue: {
      /* mock methods */
    },
  },
  // ... other services
];
```

**Mock Users Pattern**:

```typescript
const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'user',
};
```

### 3. Structure Cache Invalidation Integration Tests

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/settlement-structure-cache-invalidation.integration.test.ts`

**Pattern**: Tests that updating Settlement/Structure properly invalidates dependency graph cache

**Mock Setup** (lines 65-150):

- Uses `Test.createTestingModule()` from NestJS testing
- Mocks all service dependencies
- `$transaction` mock: `jest.fn((callback) => callback(prismaService))`

## Cache Implementation in SettlementService

### Method: `getComputedFields(settlement, user)`

**Location**: Lines 883-1000+ in settlement.service.ts

**Cache Strategy**:

1. **Cache Key Format**: `computed-fields:settlement:${id}:${branchId}`
2. **Read Pattern**:
   ```typescript
   const cached = await this.cache.get<Record<string, unknown>>(cacheKey);
   if (cached) {
     this.logger.debug(`Cache hit for computed fields: ${cacheKey}`);
     return cached;
   }
   ```
3. **Write Pattern**: After computing fields, stores via `this.cache.set()`
4. **Error Handling**: Graceful degradation - logs cache errors but continues computing

### Cache Invalidation Points

**File**: settlement.service.ts

1. **In `update()` method** (lines 475-491):

   ```typescript
   const cacheKey = `computed-fields:settlement:${id}:${branchId}`;
   await this.cache.del(cacheKey);
   ```

2. **In `setLevel()` method** (lines 794-808):
   ```typescript
   const cacheKey = `computed-fields:settlement:${id}:${branchId}`;
   await this.cache.del(cacheKey);
   ```

**Invalidation Pattern**:

- Try/catch block for cache errors
- Log errors but don't throw (graceful degradation)
- No-op failures shouldn't block operations

## CacheService API (from tests)

### Core Methods

- **`get<T>(key: string): Promise<T | null>`** - Get cached value
- **`set<T>(key: string, value: T, options?: {ttl?: number}): Promise<void>`** - Set value with optional TTL
- **`del(key: string): Promise<number>`** - Delete key, returns count deleted
- **`delPattern(pattern: string): Promise<{success: boolean, keysDeleted: number, error?: string}>`** - Delete matching pattern
- **`getStats()`** - Get cache statistics
- **`resetStats()`** - Reset all counters

## Testing Utilities & Patterns

### Test Module Setup

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [ServiceToTest, ...mockedDependencies],
}).compile();

service = module.get<ServiceToTest>(ServiceToTest);
```

### Mock Patterns for Dependent Services

1. **Simple methods**: `jest.fn()`
2. **Async methods returning data**: `jest.fn().mockResolvedValue(data)`
3. **Async methods returning undefined**: `jest.fn().mockResolvedValue(undefined)`
4. **Error scenarios**: `jest.fn().mockRejectedValue(new Error('...'))`

### Test Structure

- **beforeEach**: Set up module and mocks
- **afterEach**: `jest.clearAllMocks()`
- **Tests**: One assertion per test when possible
- **Setup within tests**: Additional mocks can be set up for specific test scenarios

### Common Mock Variables

```typescript
mockUser: { id, email, role }
mockCampaign: { id, worldId, ownerId }
mockKingdom: { id, campaignId, name, campaign }
mockSettlement: { id, kingdomId, locationId, name, level, version, ... }
mockStructure: { id, settlementId, type, name, level, ... }
```

## Key Considerations for SettlementService Cache Tests

1. **Cache Dependency Injection**:
   - CacheService must be injected as a dependency
   - Mock it in the TestingModule setup
   - Use `REDIS_CACHE` provider token if using Redis directly

2. **Test Scenarios** (based on patterns found):
   - **Cache Hit**: getComputedFields returns cached value without recomputation
   - **Cache Miss**: getComputedFields computes value when not cached
   - **Cache Invalidation**: update/setLevel methods invalidate the cache key
   - **Error Handling**: Cache errors don't break the service
   - **Key Format**: Verify correct cache key is used: `computed-fields:settlement:${id}:main`

3. **Integration with Other Services**:
   - Rules engine client (for condition evaluation)
   - Prisma service (for database queries)
   - Dependency graph service (for cache invalidation)
   - Condition evaluation service (for building context)

4. **Graceful Degradation Pattern**:
   - Cache failures should be caught and logged
   - Service should continue operating without cache
   - No cache failures should propagate to caller

## Files for Reference

1. **Unit Test Template**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/settlement.service.test.ts` (lines 1-166)
2. **Cache Service Tests**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.test.ts`
3. **Implementation Reference**:
   - Settlement.service.ts (lines 883-1010 for getComputedFields)
   - Settlement.service.ts (lines 475-491 for update invalidation)
   - Settlement.service.ts (lines 794-808 for setLevel invalidation)
4. **Structure Service for comparison**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/structure.service.ts` (similar patterns)
