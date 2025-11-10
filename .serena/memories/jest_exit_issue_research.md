# Jest Exit Issue Investigation - Complete Research

## Problem Statement

Jest is not exiting after tests complete in GitHub Actions CI with error:
"Jest did not exit one second after the test run has completed."

This suggests open handles or connections preventing Jest from exiting cleanly.

## Repository Structure

- **Project**: Campaign Management Tool (pnpm monorepo)
- **Test Location**: packages/api
- **Jest Config**: `/storage/programs/campaign_manager/packages/api/jest.config.js`
- **Test Files**: 31 integration test files using real Prisma + Redis connections

## Jest Configuration Analysis

**File**: `packages/api/jest.config.js`

Key settings:

- `testTimeout: 30000` (30 seconds per test - standard)
- `maxWorkers: 1` (serial execution - prevents DB conflicts)
- **MISSING**: `forceExit`, `bail`, or `detectOpenHandles` settings

**Critical Finding**: Jest is NOT configured with `forceExit: true`, which means Jest will wait indefinitely for open handles instead of force-exiting after all tests complete.

## Resource Connections Identified

### 1. **Prisma Database Connection** (ACTIVE)

- **Location**: `src/database/prisma.service.ts`
- **Lifecycle**:
  - `onModuleInit()`: Connects with `await this.$connect()`
  - `onModuleDestroy()`: Disconnects with `await this.$disconnect()`
- **Integration Tests**: All 31 integration test files use Prisma
- **Pattern**: Tests call `await prisma.$disconnect()` in `afterAll()` hooks
- **Problem**: Only application module teardown calls `onModuleDestroy()` - direct test module creation may not trigger this properly

### 2. **Redis Cache Connection** (ACTIVE)

- **Location**: `src/graphql/cache/redis-cache.provider.ts`
- **Creation**: `createRedisCache()` returns `new Redis(options)` with:
  - DB: 1 (for cache)
  - Key prefix: 'cache:'
  - enableOfflineQueue: true
  - reconnectOnError enabled
- **Lifecycle**: NO onModuleDestroy - Redis client never explicitly closes in many tests
- **Issue**: `redis.quit()` is NOT being called in many test's afterAll hooks
- **Example**: `cache-stats.resolver.integration.test.ts` properly calls `await redisClient.quit()` but others don't

### 3. **Redis PubSub Connection** (ACTIVE)

- **Location**: `src/graphql/pubsub/redis-pubsub.provider.ts`
- **Creation**: `createRedisPubSub()` returns `new RedisPubSub()` with two internal ioredis clients
- **Lifecycle**: NO explicit cleanup mechanism
- **Issue**: RedisPubSub instances created in tests are NEVER explicitly closed
- **Pattern**: Tests import REDIS_PUBSUB token but don't have cleanup for it

### 4. **WebSocket Gateway Redis Clients** (ACTIVE)

- **Location**: `src/websocket/websocket.gateway.ts`
- **Creation**: Creates TWO separate `redis` clients (pub/sub) using `createClient()` from 'redis' package
- **Lifecycle**:
  - `afterInit()`: Connects with `await Promise.all([this.pubClient.connect(), this.subClient.connect()])`
  - `closeRedisConnections()`: Manual cleanup method (NOT part of NestJS lifecycle)
- **Issue**: Tests manually call `await gateway.closeRedisConnections()` in afterEach, but if tests DON'T instantiate gateway or miss afterEach, connections leak
- **Secondary Issue**: WebSocket module is always initialized in app, so these connections are open during tests

### 5. **Rules Engine gRPC Client** (ACTIVE)

- **Location**: `src/grpc/rules-engine-client.service.ts`
- **Lifecycle**:
  - `onModuleInit()`: Connects to gRPC server
  - `onModuleDestroy()`: Calls `this.client.close()`
- **Integration Tests**: `rules-engine-client.integration.test.ts` properly calls `await service.onModuleDestroy()`
- **Pattern**: Better than Prisma - explicit cleanup in tests

### 6. **Cache Stats Service Timer** (POTENTIAL LEAK)

- **Location**: `src/common/cache/cache-stats.service.ts`
- **Lifecycle**:
  - Constructor: May set `this.resetTimer = setInterval(...)`
  - `onModuleDestroy()`: Clears the interval
- **Issue**: If module not properly destroyed, interval continues running forever

## Test Cleanup Patterns Found

### Tests WITH Proper Cleanup:

```typescript
// cache-stats.resolver.integration.test.ts (GOOD PATTERN)
afterAll(async () => {
  await redisClient.flushdb();
  await redisClient.quit(); // ✓ Redis explicitly closed
  await app.close(); // ✓ NestJS app closed
});
```

```typescript
// cascade-invalidation.integration.test.ts (GOOD PATTERN)
afterAll(async () => {
  await redis.quit(); // ✓ Redis explicitly closed
  await prisma.$disconnect(); // ✓ Prisma explicitly closed
  await module.close(); // ✓ NestJS module closed
});
```

```typescript
// websocket.gateway.test.ts (GOOD PATTERN)
afterEach(async () => {
  if (gateway) {
    await gateway.closeRedisConnections(); // ✓ Manual WebSocket Redis cleanup
  }
});
```

### Tests WITH Incomplete Cleanup:

```typescript
// location-geometry.integration.test.ts (PARTIAL)
afterAll(async () => {
  // ... data cleanup ...
  await prisma.$disconnect(); // ✓ Prisma closed
  // ✗ NO Redis cleanup
  // ✗ NO module.close()
});
```

Many other test files have `afterAll(async () => { await prisma.$disconnect(); })` but:

- NO Redis client cleanup
- NO module cleanup
- NO WebSocket gateway cleanup

## Root Causes Identified

### Primary Issue: Multiple Unclosed Redis Connections

1. **RedisPubSub never closed**: Created in `createRedisPubSub()` factory, no mechanism to cleanup the two internal ioredis clients
2. **WebSocket Redis clients**: Created in `afterInit()`, only have manual `closeRedisConnections()` which isn't always called
3. **Cache Redis client**: Created in `createRedisCache()`, some tests don't call `quit()`
4. **Prisma not always disconnecting**: When module not properly closed via `app.close()` or `module.close()`

### Secondary Issue: Module Lifecycle Not Properly Triggered

- NestJS `onModuleDestroy()` only called when using `app.close()` or `module.close()`
- Many test files create `TestingModule` but don't call `close()` in afterAll
- This prevents Prisma, RulesEngineClient, and CacheStatsService from cleaning up

### Tertiary Issue: No Jest Configuration for Unresolved Handles

- Missing `forceExit: true` in jest.config.js
- Missing `detectOpenHandles: true` for debugging which handles are open
- These would help identify which resources are keeping Jest running

## Specific Files with Issues

### High Priority (Missing Redis Cleanup):

1. `branch.resolver.integration.test.ts` - afterAll doesn't close Redis
2. `kingdom.resolver.integration.test.ts` - afterAll doesn't close Redis
3. `spatial.resolver.integration.test.ts` - afterAll doesn't close Redis
4. `structure.resolver.integration.test.ts` - afterAll doesn't close Redis
5. `settlement.resolver.integration.test.ts` - afterAll doesn't close Redis
6. `party.resolver.integration.test.ts` - afterAll doesn't close Redis
7. `tile-caching.integration.test.ts` - afterAll doesn't close Redis
8. `merge.resolver.integration.test.ts` - afterAll doesn't close module
9. `cache-stats.resolver.integration.test.ts` - GOOD (has cleanup)
10. And many more...

### High Priority (Missing Module Close):

1. `settlement-structure-branch-versioning.integration.test.ts`
2. `entity-list-cache.integration.test.ts` (has describe.skip)
3. `settlement-structure-cache-invalidation.integration.test.ts`
4. `settlement-effects.integration.test.ts`
5. `structure-effects.integration.test.ts`
6. And many more...

## Recommended Fixes

### Fix 1: Update Jest Configuration (IMMEDIATE)

```javascript
// jest.config.js
module.exports = {
  // ... existing config ...
  forceExit: true, // Force Jest to exit after tests complete
  detectOpenHandles: true, // Show which handles are preventing exit
  testTimeout: 30000,
  maxWorkers: 1,
};
```

### Fix 2: Create Global Test Setup File

```typescript
// jest.setup.ts (referenced in jest.config.js)
import { Test } from '@nestjs/testing';

// Track all created modules for cleanup
const modules: any[] = [];

// Override Test.createTestingModule to track modules
const originalCreate = Test.createTestingModule;
Test.createTestingModule = function (...args) {
  const builder = originalCreate.apply(this, args);
  return {
    ...builder,
    async compile() {
      const module = await builder.compile();
      modules.push(module);
      return module;
    },
  };
};

// Global afterAll hook for final cleanup
afterAll(async () => {
  for (const module of modules) {
    try {
      await module.close();
    } catch (err) {
      console.error('Error closing module:', err);
    }
  }
  modules.length = 0;
});
```

### Fix 3: Add NestJS Lifecycle Hook to Clean Up Singletons

```typescript
// graphql-core.module.ts or app.module.ts
export class GraphQLCoreModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub,
    @Inject(REDIS_CACHE) private readonly redisCache: Redis
  ) {}

  async onModuleDestroy() {
    // Close RedisPubSub connections
    await this.pubSub.getPublisher().quit();
    await this.pubSub.getSubscriber().quit();

    // Close Redis cache
    await this.redisCache.quit();
  }
}
```

### Fix 4: Standardize Test Cleanup Pattern

Create a test helper file:

```typescript
// test-helpers.ts
export async function cleanupTestModule(
  module: TestingModule,
  options?: {
    redis?: Redis;
    prisma?: PrismaService;
    gateway?: WebSocketGatewayClass;
  }
) {
  if (options?.redis) {
    await options.redis.flushdb();
    await options.redis.quit();
  }
  if (options?.prisma) {
    await options.prisma.$disconnect();
  }
  if (options?.gateway) {
    await options.gateway.closeRedisConnections();
  }
  await module.close();
}
```

Then in tests:

```typescript
afterAll(async () => {
  await cleanupTestModule(module, { redis: redisClient, prisma });
});
```

## Summary

**The issue is caused by a combination of:**

1. **Unclosed Redis connections** (3 different clients: cache, pubsub, websocket)
2. **Unproperly destroyed NestJS modules** (missing `app.close()` or `module.close()` in afterAll)
3. **Missing Jest configuration** for handling unresolved handles
4. **Inconsistent test cleanup patterns** across 31+ integration test files

**The solution requires:**

1. Adding `forceExit: true` and `detectOpenHandles: true` to jest.config.js
2. Systematically closing Redis connections in all test afterAll hooks
3. Always calling `module.close()` after tests complete
4. Creating shared test utilities to enforce consistent cleanup
5. Implementing proper NestJS lifecycle hooks in modules that create singletons

**Immediate (5-min fix):** Add `forceExit: true` to jest.config.js to unblock CI
**Proper (1-2 hour fix):** Implement all cleanup patterns consistently across all integration tests
