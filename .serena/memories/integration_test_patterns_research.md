# Integration Test Patterns Research

## Overview

Research on integration test patterns in campaign_manager codebase, specifically for Redis connection setup and testing.

## Key Findings

### 1. Integration Test Files Location

All integration tests follow naming convention: `*.integration.test.ts`

**API Package Tests** (`packages/api/src`):

- `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.integration.test.ts` - MAIN REFERENCE
- `packages/api/src/graphql/services/settlement-structure-cache-invalidation.integration.test.ts`
- `packages/api/src/graphql/services/dependency-graph-cache-invalidation.integration.test.ts`
- `packages/api/src/graphql/services/encounter.service.integration.test.ts`
- `packages/api/src/graphql/services/event.service.integration.test.ts`
- `packages/api/src/graphql/resolvers/*integration.test.ts` (multiple resolver tests)
- `packages/api/src/common/services/spatial-*.integration.test.ts`

**Rules Engine Tests** (`packages/rules-engine/src`):

- `packages/rules-engine/src/services/redis-pub-sub.integration.test.ts`
- `packages/rules-engine/src/services/cache-invalidation.integration.test.ts`

### 2. Redis Integration Test Setup Pattern (Cache Service)

#### Key Features:

- **Skipped by default** - Use `describe.skip()` to prevent requiring Redis in CI
- **Direct Redis clients** - Creates real ioredis connections for testing
- **Separate clients** - One for service under test, one for assertions
- **Environment-based config** - Reads `REDIS_HOST` and `REDIS_PORT` from env
- **Graceful cleanup** - Proper teardown in afterAll hooks

#### Code Pattern:

```typescript
describe.skip('CacheService - Redis Integration', () => {
  let cacheService: CacheService;
  let redisClient: Redis;
  let testRedis: Redis;

  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

  beforeAll(async () => {
    // Set environment variables
    process.env.CACHE_DEFAULT_TTL = '300';
    process.env.CACHE_METRICS_ENABLED = 'true';
    process.env.CACHE_LOGGING_ENABLED = 'false';

    // Create REAL Redis connections
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: 1, // Use DB 1 for cache (DB 0 for pub/sub)
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop after 3 attempts
        return Math.min(times * 50, 2000);
      },
    });

    // Separate client for test assertions
    testRedis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: 1,
    });

    // Create NestJS test module with real Redis
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: REDIS_CACHE,
          useValue: redisClient,
        },
        CacheService,
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);

    // Wait for Redis to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Clean up test data
    await testRedis.flushdb();
    // Disconnect both clients
    await redisClient.quit();
    await testRedis.quit();
  });

  beforeEach(async () => {
    // Clear database before each test
    await testRedis.flushdb();
    // Reset stats
    cacheService.resetStats();
  });
});
```

### 3. Redis Provider Configuration

**File**: `packages/api/src/graphql/cache/redis-cache.provider.ts`

```typescript
export function createRedisCache(): Redis {
  const options: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_CACHE_DB || '1', 10), // DB 1 for cache (DB 0 for pubsub)
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 3000);
      return delay;
    },
    connectTimeout: 10000,
    enableOfflineQueue: true,
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
    keyPrefix: 'cache:',
  };

  const redis = new Redis(options);

  redis.on('error', (err) => {
    console.error('Redis Cache Error:', err.message);
  });
  redis.on('connect', () => {
    console.log('Redis Cache connected');
  });
  redis.on('ready', () => {
    console.log('Redis Cache ready');
  });

  return redis;
}

export const REDIS_CACHE = 'REDIS_CACHE';
```

### 4. Key Test Patterns

#### Pattern 1: Test Setup & Cleanup

```typescript
beforeAll(async () => {
  // Environment configuration
  // Create Redis clients
  // Create NestJS test module
  // Wait for readiness
});

afterAll(async () => {
  // Flush database
  // Quit clients
});

beforeEach(async () => {
  // Clear database for isolation
  // Reset stats
});
```

#### Pattern 2: Testing Cache Operations

```typescript
it('should set and get a value', async () => {
  const testData = { id: 123, name: 'Test Settlement' };

  await cacheService.set('test-key', testData);
  const result = await cacheService.get<typeof testData>('test-key');

  expect(result).toEqual(testData);
});
```

#### Pattern 3: Testing TTL Expiration

```typescript
it('should expire key after TTL seconds', async () => {
  await cacheService.set('expiring-key', { data: 'will expire' }, { ttl: 1 });

  let result = await cacheService.get('expiring-key');
  expect(result).toEqual({ data: 'will expire' });

  await new Promise((resolve) => setTimeout(resolve, 1200));

  result = await cacheService.get('expiring-key');
  expect(result).toBeNull();
});
```

#### Pattern 4: Testing Pattern Deletion

```typescript
it('should delete all keys matching a pattern', async () => {
  // Set multiple keys with same prefix
  await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
  await cacheService.set('computed-fields:settlement:2:main', { id: 2 });
  await cacheService.set('other:settlement:3:main', { id: 3 });

  // Delete by pattern
  const result = await cacheService.delPattern('computed-fields:*');

  expect(result.success).toBe(true);
  expect(result.keysDeleted).toBe(2);

  // Verify deletions
  expect(await cacheService.get('computed-fields:settlement:1:main')).toBeNull();
  expect(await cacheService.get('other:settlement:3:main')).toEqual({ id: 3 });
});
```

#### Pattern 5: Testing Stats/Metrics

```typescript
it('should track cache hits and misses', async () => {
  await cacheService.set('key1', { data: 'value1' });

  await cacheService.get('key1'); // Hit
  await cacheService.get('non-existent'); // Miss

  const stats = cacheService.getStats();
  expect(stats.hits).toBe(1);
  expect(stats.misses).toBe(1);
  expect(stats.hitRate).toBeCloseTo(0.5, 1);
});
```

### 5. Docker Setup for Tests

**docker-compose.yml** Redis Service:

```yaml
redis:
  image: redis:7-alpine
  container_name: campaign_redis
  command: redis-server --appendonly yes
  volumes:
    - redis-data:/data
  ports:
    - '6379:6379'
  networks:
    - backend-network
  restart: unless-stopped
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 10s
    timeout: 3s
    retries: 5
    start_period: 10s
```

**Running integration tests locally:**

1. Start Redis: `docker-compose up -d redis`
2. Remove `.skip` from describe.skip()
3. Run tests: `pnpm --filter @campaign/api test`
4. Cleanup: `docker-compose down`

### 6. Jest Configuration

**packages/api/jest.config.js**:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  testTimeout: 30000, // 30 second timeout for integration tests
  maxWorkers: 1, // Run tests serially to avoid database conflicts
  // ... other config
};
```

### 7. CacheService Implementation Details

**File**: `packages/api/src/common/cache/cache.service.ts`

Key methods:

- `async get<T>(key: string): Promise<T | null>` - Get with JSON parsing
- `async set<T>(key: string, value: T, options?: CacheOptions): Promise<void>` - Set with TTL
- `async del(key: string): Promise<number>` - Delete single key
- `async delPattern(pattern: string): Promise<CacheDeleteResult>` - Delete by pattern using SCAN
- `getStats(): CacheStats` - Get hit/miss metrics
- `resetStats(): void` - Reset metrics

Features:

- JSON serialization/deserialization
- Graceful degradation (cache failures don't break app)
- Metrics tracking (hits, misses, operations)
- Pattern-based cascading invalidation using SCAN (non-blocking)
- Configurable TTL via environment variables

### 8. Environment Variables for Cache

**CacheService Configuration**:

```
CACHE_DEFAULT_TTL=300        # Default 5 minutes
CACHE_METRICS_ENABLED=true   # Enable stats tracking
CACHE_LOGGING_ENABLED=false  # Disable debug logging
REDIS_HOST=localhost         # Redis server hostname
REDIS_PORT=6379             # Redis server port
REDIS_PASSWORD=              # Optional password
REDIS_CACHE_DB=1            # Redis DB for cache (0 for pub/sub)
```

### 9. Test Utilities & Helpers

**CacheService Types** (`packages/api/src/common/cache/cache.types.ts`):

- `CacheOptions` - Configuration for set operations
- `CacheKeyParams` - Hierarchical key parameters
- `CacheStats` - Metrics tracking
- `CacheDeleteResult` - Pattern deletion results

**Common Test Patterns**:

- Use `testRedis.flushdb()` for isolation
- Use `testRedis.ttl(key)` to verify TTL
- Use `testRedis.get(key)` to directly verify Redis state
- Use separate clients for operations vs assertions
- Use `describe.skip()` for tests requiring external services

### 10. Real-World Test Scenarios Covered

From cache.service.integration.test.ts:

1. Basic operations (set, get, delete)
2. Complex nested objects
3. TTL expiration timing
4. Pattern-based deletion with various patterns
5. Large pattern deletion (pagination with SCAN)
6. Stats tracking accuracy
7. Cache miss/fetch/set/hit workflow
8. Bulk invalidation workflow
9. Concurrent operations
10. Redis persistence verification

## Summary

**Best Practices for Integration Tests with Redis:**

1. Skip by default with `describe.skip()`
2. Use real ioredis connections in integration tests
3. Separate clients for service and assertions
4. Environment-based configuration
5. Proper cleanup in afterAll/afterEach hooks
6. Use database numbers to separate cache (DB 1) from pub/sub (DB 0)
7. Add retryStrategy for connection resilience
8. Use flushdb() for test isolation
9. Test both success and error paths
10. Verify stats/metrics are tracked correctly
