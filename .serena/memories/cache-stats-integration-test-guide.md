# Cache Statistics Integration Test Research Guide

## Project Structure & Locations

### Key Files

- **CacheService**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.ts`
  - Main cache implementation with hit/miss/set/delete tracking
  - Has both internal stats (CacheStats) and delegates to CacheStatsService
  - Methods: get(), set(), del(), delPattern(), invalidatePattern(), resetStats()

- **CacheStatsService**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache-stats.service.ts`
  - Extended stats tracking with per-type categorization
  - Tracks: hits, misses, sets, invalidations, cascadeInvalidations per cache type
  - Methods: recordHit(), recordMiss(), recordSet(), recordInvalidation(), recordCascadeInvalidation(), getStats()

- **Type Definitions**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.types.ts`
  - CacheOptions, CacheKeyParams, CacheStats, CacheDeleteResult interfaces

- **Existing Integration Test**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.integration.test.ts`
  - Currently skipped with `describe.skip()` - requires real Redis
  - Comprehensive examples of Redis setup, TTL testing, pattern deletion, stats tracking

- **Unit Tests**:
  - `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.test.ts` (mocked Redis)
  - `/storage/programs/campaign_manager/packages/api/src/common/cache/cache-stats.service.test.ts` (mocked Redis)

## Integration Test Setup Patterns

### Real Redis Connection Setup (From cache.service.integration.test.ts)

```typescript
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

beforeAll(async () => {
  // Set environment variables for CacheService
  process.env.CACHE_DEFAULT_TTL = '300';
  process.env.CACHE_METRICS_ENABLED = 'true';
  process.env.CACHE_LOGGING_ENABLED = 'false';

  // Create REAL Redis connection (used by CacheService)
  redisClient = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: 1, // Use DB 1 for cache (DB 0 for pub/sub)
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 50, 2000);
    },
  });

  // Create separate Redis client for test assertions
  testRedis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: 1,
  });

  // Create test module with real Redis client
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      {
        provide: REDIS_CACHE,
        useValue: redisClient,
      },
      CacheService,
      CacheStatsService, // Include stats service
    ],
  }).compile();

  cacheService = module.get<CacheService>(CacheService);
  cacheStatsService = module.get<CacheStatsService>(CacheStatsService);

  // Wait for Redis to be ready
  await new Promise((resolve) => setTimeout(resolve, 100));
});

afterAll(async () => {
  // Clean up all test data
  await testRedis.flushdb();

  // Disconnect both clients
  await redisClient.quit();
  await testRedis.quit();
});

beforeEach(async () => {
  // Clear database before each test for isolation
  await testRedis.flushdb();

  // Reset stats
  cacheService.resetStats();
  cacheStatsService.resetStats();
});
```

### Key Configuration Points

- Use `db: 1` for cache tests (db 0 used for pub/sub in other tests)
- Environment variables must be set BEFORE module creation: CACHE_METRICS_ENABLED, CACHE_LOGGING_ENABLED, CACHE_DEFAULT_TTL
- Must set CACHE_STATS_TRACKING_ENABLED = 'true' to enable CacheStatsService tracking
- Use two Redis clients: one for service operations, one for test assertions
- Always flushdb() in beforeEach() for test isolation

## How Stats Accumulate Across Operations

### CacheService Stats (Basic)

```typescript
// In CacheService class
private stats: CacheStats = {
  hits: 0,
  misses: 0,
  hitRate: 0, // Calculated on getStats()
  sets: 0,
  deletes: 0,
  patternDeletes: 0,
  startTime: Date.now(),
  enabled: false,
};

// get() operation:
// - Hit: incrementHits() → stats.hits++, calls cacheStatsService.recordHit()
// - Miss: incrementMisses() → stats.misses++, calls cacheStatsService.recordMiss()

// set() operation:
// - stats.sets++, calls cacheStatsService.recordSet()

// del() operation:
// - stats.deletes++, calls cacheStatsService.recordInvalidation()

// delPattern() operation:
// - stats.patternDeletes++, calls cacheStatsService.recordCascadeInvalidation(type, keysDeleted)
```

### CacheStatsService Stats (Extended)

```typescript
// Per-type tracking in CacheStatsService
private stats: Map<string, CacheTypeStats> = new Map();

// CacheTypeStats for each type (e.g., 'computed-fields', 'settlements')
{
  hits: 0,
  misses: 0,
  sets: 0,
  invalidations: 0,           // Single-key deletes
  cascadeInvalidations: 0,    // Pattern delete counts
}

// getStats() returns AggregatedCacheStats:
{
  byType: {
    'computed-fields': { hits: N, misses: M, sets: O, invalidations: P, cascadeInvalidations: Q, hitRate: R },
    'settlements': { ... }
  },
  totalHits: X,
  totalMisses: Y,
  hitRate: Z,
  totalSets: A,
  totalInvalidations: B,
  totalCascadeInvalidations: C,
  startTime: timestamp,
  enabled: true,
}
```

### Cache Type Extraction

Cache type is extracted from the cache key prefix:

```typescript
private extractCacheType(key: string): string {
  const firstColonIndex = key.indexOf(':');
  if (firstColonIndex === -1) return 'unknown';
  return key.substring(0, firstColonIndex);
}
// 'computed-fields:settlement:123:main' → 'computed-fields'
// 'settlements:kingdom:456:main' → 'settlements'
```

## Critical Test Patterns

### Basic Get/Set/Del Sequence

```typescript
// Miss → Set → Hit pattern
await cacheService.set('test-key', { data: 'value' }); // stats.sets++
const result = await cacheService.get('test-key'); // stats.hits++
expect(result).toEqual({ data: 'value' });

const stats = cacheService.getStats();
expect(stats.sets).toBe(1);
expect(stats.hits).toBe(1);
expect(stats.misses).toBe(0);
```

### Pattern Deletion with Stats

```typescript
await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
await cacheService.set('computed-fields:settlement:2:main', { id: 2 });
await cacheService.set('other:data', { id: 3 });

const result = await cacheService.delPattern('computed-fields:*');
expect(result.keysDeleted).toBe(2);

const stats = cacheService.getStats();
expect(stats.patternDeletes).toBe(1); // One delPattern call
```

### Multi-Type Stats Accumulation

```typescript
// Different cache types accumulate separately in CacheStatsService
await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
await cacheService.set('settlements:kingdom:2:main', { name: 'K1' });
await cacheService.set('spatial:query:3:main', { regions: [] });

const result = await cacheService.delPattern('computed-fields:*');
// Only affects computed-fields type stats

const stats = cacheService.getStats();
expect(stats.totalSets).toBe(3);
expect(stats.totalCascadeInvalidations).toBe(1); // Only computed-fields
```

## What CacheStatsService Does Differently

CacheStatsService is injected into CacheService and tracks extended metrics:

1. **Per-Type Tracking**: Same operations tracked separately for each cache type prefix
2. **Cascade Invalidations**: Pattern-based deletes track the NUMBER of keys deleted (not just the operation count)
3. **No Hit Rate in Intermediate**: CacheStatsService stores raw counts; hit rate calculated on getStats()
4. **Auto-Reset Capability**: Can be configured to reset stats automatically via CACHE_STATS_RESET_PERIOD_MS

## Test Requirements for CacheStatsService Integration

The integration test needs to verify:

1. **Basic Recording**: recordHit(), recordMiss(), recordSet(), recordInvalidation(), recordCascadeInvalidation() work with real operations
2. **Per-Type Separation**: Different cache type prefixes accumulate stats separately
3. **Cascade Invalidation Counting**: recordCascadeInvalidation(type, keysDeleted) correctly accumulates the count of deleted keys
4. **Hit Rate Calculation**: Hit rates calculated correctly per-type and overall
5. **Stats Persistence**: Stats accumulate across multiple operations without reset
6. **Integration with CacheService**: CacheService correctly calls CacheStatsService methods on each operation

## Example Multi-Operation Test Scenario

```typescript
it('should verify stats persist across cache operations', async () => {
  // Setup: Create multiple cache entries
  await cacheService.set('computed-fields:settlement:1:main', { pop: 100 });
  await cacheService.set('computed-fields:settlement:2:main', { pop: 200 });
  await cacheService.set('settlements:kingdom:1:main', { name: 'K1' });
  await cacheService.set('spatial:query:1:main', { count: 5 });

  // Initial stats: 4 sets, 0 hits
  let stats = cacheService.getStats();
  expect(stats.sets).toBe(4);
  expect(stats.hits).toBe(0);
  expect(stats.totalSets).toBe(4);

  // Cache hits accumulate
  await cacheService.get('computed-fields:settlement:1:main');
  await cacheService.get('settlements:kingdom:1:main');
  await cacheService.get('spatial:query:1:main');

  stats = cacheService.getStats();
  expect(stats.hits).toBe(3);
  expect(stats.hitRate).toBe(0.75); // 3 hits / 4 total

  // Pattern delete creates cascade invalidation entry
  const delResult = await cacheService.delPattern('computed-fields:*');
  expect(delResult.keysDeleted).toBe(2);

  stats = cacheService.getStats();
  expect(stats.patternDeletes).toBe(1);
  expect(stats.totalCascadeInvalidations).toBe(2); // 2 keys deleted in cascade

  // Stats remain after reset
  cacheService.resetStats();
  stats = cacheService.getStats();
  expect(stats.hits).toBe(0);
  expect(stats.sets).toBe(0);
});
```

## Important Notes

1. **Integration Test is Skipped**: The existing cache.service.integration.test.ts is marked with `describe.skip()`. To run it locally, you must:
   - Remove `.skip` from describe
   - Have Docker and Redis running
   - Run `docker-compose up -d redis` first
2. **CacheStatsService Must Be Included**: When testing stats persistence, must create test module with both CacheService AND CacheStatsService

3. **Environment Variables Matter**: Must set CACHE_STATS_TRACKING_ENABLED before module creation for CacheStatsService to track

4. **Two Redis Clients**: Use one for service, one for assertions (allows verifying actual Redis state)

5. **TTL Not Required for Stats Tests**: Stats tests don't need to verify TTL expiration; that's already tested extensively
