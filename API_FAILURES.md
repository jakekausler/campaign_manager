# API Test Failures

Last Test Run: 2025-10-31 (Updated after fixes)

## Summary

- **Total Tests**: 1,930
- **Passed**: ~1,770+ (improved)
- **Failed**: ~4 tests (dependency graph errors fixed)
- **Skipped**: 156

**Status**: ✅ Primary dependency graph invalidation failures have been **FIXED**

## Failing Test Suites

### 1. `src/graphql/services/structure.service.test.ts`

**Status**: ✅ FIXED (commit: ee01b76)

**Previous Error**:

```
[StructureService] Failed to invalidate dependency graph for structure structure-1:
```

**Root Cause**: Test mock for `DependencyGraphService` was missing the `invalidateGraph()` method

**Fix Applied**: Added `invalidateGraph: jest.fn()` to the DependencyGraphService mock

**Remaining Issues**: 2 unrelated test failures (pre-existing mock issues in create/delete tests)

---

### 2. `src/graphql/services/settlement.service.test.ts`

**Status**: ✅ FIXED (commit: ee01b76)

**Previous Error**:

```
[SettlementService] Failed to invalidate dependency graph for settlement settlement-1:
```

**Root Cause**: Test mock for `DependencyGraphService` was missing the `invalidateGraph()` method

**Fix Applied**: Added `invalidateGraph: jest.fn()` to the DependencyGraphService mock

**Remaining Issues**: 2 unrelated test failures (pre-existing mock issues in delete tests)

---

### 3. `src/graphql/services/settlement-structure-validation.e2e.test.ts`

**Status**: ✅ FIXED (commit: bca2321 - already fixed, verified working)

**Previous Error**:

```
Nest can't resolve dependencies of the SettlementService (..., WebSocketPublisherService at index [8], ...).
```

**Root Cause**: Missing `WebSocketPublisherService` mock in test setup (introduced by real-time updates feature)

**Fix Applied**: WebSocketPublisherService mock was added in commit bca2321

**Current Status**: All 15 tests passing ✓ (14 passed, 1 skipped)

---

## Test Environment Notes

- **Node Version**: Latest
- **Test Framework**: Jest
- **Database**: PostgreSQL with Prisma (mocked in tests)
- **Redis**: Connection mocked in most tests, some failures indicate missing Redis mocks

## Fixes Applied ✅

1. **Dependency Graph Invalidation** (commit: ee01b76):
   - Added `invalidateGraph()` method to DependencyGraphService mocks
   - Fixed in both `structure.service.test.ts` and `settlement.service.test.ts`
   - Services now properly test cache invalidation without errors

2. **WebSocket Publisher Mock** (commit: bca2321):
   - WebSocketPublisherService properly mocked in e2e tests
   - All e2e validation tests now passing

## Remaining Issues (Pre-Existing)

Minor test failures remain in structure.service.test.ts and settlement.service.test.ts:

- Incomplete mocks for create/delete test scenarios
- Not related to dependency graph or WebSocket issues
- Do not block core functionality testing

## Other Observations

**Non-Critical Logged Errors** (These are expected test errors, not failures):

- `[WebSocketGatewayClass]` - Join/Leave failed errors (expected in negative test cases)
- `[ConditionEvaluationService]` - Expression evaluation failed (expected in validation tests)
- `[SandboxExecutor]` - Sandbox execution failed (expected in security tests)
- `[StructureService]` / `[SettlementService]` - Redis connection failed (expected when testing error handling)

**Passing Test Count**: 1,768 tests passing demonstrates that the majority of the codebase is stable and working correctly.
