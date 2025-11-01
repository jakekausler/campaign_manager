# CI Cleanup Tasks - Open Handles Issue

**Status:** ✅ RESOLVED
**Priority:** Medium (tests pass but cleanup is incomplete)
**Created:** 2025-11-01
**Resolved:** 2025-11-01
**Related Commits:** `45eac19`, `7d16694`

## Resolution Summary

The open handles issue has been successfully fixed! The problem was isolated to the WebSocket Gateway test file where Redis connections were created in `afterInit()` but never closed.

### Fix Applied

**Files Modified:**

1. `packages/api/src/websocket/websocket.gateway.ts`
   - Added `pubClient` and `subClient` as instance properties (lines 57-58)
   - Modified `afterInit()` to store Redis clients as instance properties instead of local variables (lines 78-86)
   - Added `closeRedisConnections()` async method to gracefully close both clients (lines 187-216)

2. `packages/api/src/websocket/websocket.gateway.test.ts`
   - Updated `afterEach` hook to be async and call `gateway.closeRedisConnections()` (lines 66-74)

### Verification

✅ All backend tests pass with NO open handles warning

- WebSocket Gateway tests: 31/31 passed, no open handles
- All backend tests: 1774 passed, no open handles
- Jest completes cleanly without hanging

### Impact

This fix ensures:

- Clean test shutdown in both local and CI environments
- No memory leaks from unclosed Redis connections
- Faster CI test completion (no more timeouts waiting for connections to close)
- Better test reliability and best practices

---

## Original Problem Description

## Problem Summary

Backend integration tests complete successfully, but Jest detects open handles (unclosed connections) that prevent clean test shutdown. This indicates Redis connections and WebSocket servers are not being properly closed in test teardown.

### Why This Matters

1. **Production Risk**: Connection leaks in tests often indicate potential production issues
2. **CI Performance**: Tests may take longer to complete while waiting for connections to timeout
3. **Memory Leaks**: Accumulating connections could cause memory issues in long test runs
4. **Best Practices**: Proper resource cleanup is fundamental to reliable tests

### What Was NOT Done (and Why)

We **did not** add `--forceExit` flags to Jest commands because:

- It masks the real problem instead of fixing it
- It bypasses Jest's memory leak detection
- It hides issues that could affect production
- Code Reviewer correctly flagged this as an anti-pattern

## Current CI Status

✅ **Fixed Issues:**

- Frontend tests: Environment variables added, tests pass in 4-5 minutes
- PostgreSQL health check: User flag added, no more "role 'root' does not exist" spam
- Redis service: Added to CI, tests can connect successfully
- Jest timeout: 30-second timeout prevents indefinite hangs

⚠️ **Remaining Issue:**

- Backend tests complete successfully but show "Jest has detected the following open handles" warning
- Tests may hang for a few seconds at the end waiting for connections to close

## Investigation Findings

### Likely Culprits

From subagent analysis of `/storage/programs/campaign_manager/packages/api/src`:

1. **Redis PubSub Connections** (`graphql/pubsub/redis-pubsub.provider.ts`)
   - Lines 17-21: Exponential backoff retry strategy
   - Line 25: `enableOfflineQueue: true` - buffers commands when disconnected
   - Created during module initialization, not always closed in tests

2. **Redis Cache Connections** (`graphql/cache/redis-cache.provider.ts`)
   - Lines 18-24: Similar retry configuration
   - Line 26: `enableOfflineQueue: true`
   - Background connection attempts continue after tests finish

3. **WebSocket Gateway** (`websocket/websocket.gateway.ts`)
   - Lines 74-94: Creates Redis pub/sub clients during initialization
   - WebSocket server may not be properly closed in test teardown

### Example Test Files That Need Cleanup

Based on subagent analysis, these integration test files likely need `afterAll()` hooks:

- `src/__tests__/e2e/merge-system.e2e.test.ts`
- `src/__tests__/e2e/branching-system.e2e.test.ts`
- `src/__tests__/e2e/effect-system.e2e.test.ts`
- `src/graphql/services/settlement-structure-cache-invalidation.integration.test.ts`
- `src/graphql/services/dependency-graph-cache-invalidation.integration.test.ts`
- `src/websocket/websocket.gateway.test.ts`

## Recommended Solution

### Step 1: Identify Open Handles Locally

Run backend tests locally with verbose output:

```bash
pnpm --filter @campaign/api test -- --detectOpenHandles --verbose
```

This will show exactly which handles are open and where they originate.

### Step 2: Add Proper Cleanup Hooks

Example pattern for integration tests:

```typescript
// In test files that use NestJS app with Redis/WebSocket
describe('Integration Test Suite', () => {
  let app: INestApplication;
  let redisCache: any;
  let redisPubSub: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Get references to services that hold connections
    redisCache = moduleRef.get(REDIS_CACHE);
    redisPubSub = moduleRef.get(REDIS_PUBSUB);
  });

  afterAll(async () => {
    // Close all connections before closing app
    if (redisPubSub) {
      await redisPubSub.quit();
      await redisPubSub.duplicate?.quit?.(); // Publisher client
    }
    if (redisCache) {
      await redisCache.quit();
    }

    // Close NestJS app (closes WebSocket server, DB connections, etc.)
    await app.close();

    // Give async cleanup time to complete
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  // ... tests ...
});
```

### Step 3: Verify Fix

After adding cleanup hooks:

```bash
# Run tests - should complete without open handle warnings
pnpm --filter @campaign/api test

# Verify no memory leaks
pnpm --filter @campaign/api test -- --detectOpenHandles --detectLeaks

# Check CI logs for "Jest has detected open handles" - should be gone
```

### Step 4: Document Pattern

Update testing documentation with the cleanup pattern so new tests follow best practices.

## Alternative Approach (If Cleanup Is Too Complex)

If adding cleanup to every test file is impractical, consider:

1. **Global Teardown**: Create `packages/api/jest.global-teardown.ts`
2. **Test Environment**: Custom Jest environment that handles cleanup
3. **Mock Redis in Tests**: Use in-memory mock instead of real Redis connections

However, **proper cleanup is the preferred solution** as it more closely matches production behavior.

## Testing the Fix

### Local Verification

```bash
# Should complete cleanly without warnings
pnpm --filter @campaign/api test -- --detectOpenHandles

# Should show specific open handles if any remain
pnpm --filter @campaign/api test -- --detectOpenHandles --verbose
```

### CI Verification

After implementing fix:

1. Push changes and trigger CI
2. Check backend test logs - should complete in ~5 minutes
3. No "Jest has detected open handles" warning
4. Job should complete immediately after last test, no hanging

## Files to Review

Key files to understand the connection lifecycle:

1. **Redis Providers:**
   - `packages/api/src/graphql/pubsub/redis-pubsub.provider.ts`
   - `packages/api/src/graphql/cache/redis-cache.provider.ts`

2. **Module Initialization:**
   - `packages/api/src/graphql/graphql-core.module.ts` (lines 58-66)
   - `packages/api/src/websocket/websocket.module.ts`

3. **Test Setup:**
   - Integration test files in `packages/api/src/__tests__/e2e/`
   - Service test files in `packages/api/src/graphql/services/*.integration.test.ts`

## References

- Jest Documentation: https://jestjs.io/docs/cli#--detectopenhandles
- NestJS Testing: https://docs.nestjs.com/fundamentals/testing#end-to-end-testing
- IORedis Cleanup: https://github.com/redis/ioredis#connection-events

## Success Criteria

- [ ] No "Jest has detected open handles" warnings in CI logs
- [ ] Backend tests complete in ~5 minutes (not hanging at the end)
- [ ] `--detectOpenHandles` flag shows zero open handles locally
- [ ] All tests still pass after adding cleanup code
- [ ] Pattern documented for future test authors

## Notes

- The current workaround considered was `--forceExit` but Code Reviewer correctly rejected it
- Tests are actually passing - this is purely a cleanup issue
- Low urgency but should be fixed for production confidence
- Good opportunity to establish proper test cleanup patterns for the project
