# Test Fixes Implementation Plan

## Current Status

**Progress Summary:**

- **Initial State**: 189 failed tests, 1079 passed (10 test suites failed)
- **After Stage 2**: 59 failed tests, 1231 passed (5 test suites failed)
- **Tests Fixed**: 130 tests (69% reduction in failures)
- **Improvement**: +152 passing tests

**Completed Fixes:**

1. ✅ Updated Jest configuration from deprecated globals syntax to transform syntax
2. ✅ Added missing DependencyGraphService providers to 5 service tests
3. ✅ Added missing EffectExecutionService + EffectPatchService providers to 2 service tests
4. ✅ Added REDIS_PUBSUB provider to state-variable service test
5. ✅ Fixed CycleInfo structure in dependency-graph resolver tests
6. ✅ Fixed transaction mock in effect-system E2E tests
7. ✅ Added missing findUnique methods to entity mocks in condition service test
8. ✅ Fixed rules-engine performance test timeouts
9. ✅ Fixed dependency-graph resolver test enum types
10. ✅ Added missing REDIS_PUBSUB provider to dependency-graph cache invalidation tests (Stage 2)

**Commits:**

- `df95f3b` - fix(api): add missing REDIS_PUBSUB mock to dependency-graph cache invalidation tests (Stage 2)
- `6d72b9f` - test(rules-engine): increase performance test timeouts for CI environments
- `a067e17` - fix(api): use proper enum types in dependency-graph resolver tests
- `2deba25` - fix(api): add missing test providers and update Jest configuration

---

## Remaining Test Failures

**5 Test Suites Still Failing (59 tests total):**

1. `src/common/services/spatial-indexes.integration.test.ts` - Spatial index integration tests
2. `src/graphql/services/settlement.service.test.ts` - Settlement service unit tests
3. `src/graphql/services/structure.service.test.ts` - Structure service unit tests
4. `src/__tests__/e2e/effect-system.e2e.test.ts` - Effect system E2E tests
5. `src/graphql/services/state-variable-versioning.integration.test.ts` - State variable versioning integration tests

---

## Stage 1: Settlement & Structure Service Tests (High Priority)

**Files:**

- `packages/api/src/graphql/services/settlement.service.test.ts`
- `packages/api/src/graphql/services/structure.service.test.ts`

**Estimated Failures**: ~30 tests

**Root Cause Analysis:**
These tests likely fail due to:

1. Missing REDIS_PUBSUB provider (similar to state-variable service)
2. Missing mock implementations for methods added during recent refactoring
3. Incorrect mock return values for async methods

**Implementation Steps:**

### 1.1 Add Missing Providers

```typescript
// Add to both settlement.service.test.ts and structure.service.test.ts
{
  provide: 'REDIS_PUBSUB',
  useValue: {
    publish: jest.fn(),
    subscribe: jest.fn(),
    asyncIterator: jest.fn(),
  },
},
```

### 1.2 Verify Mock Methods

- Run tests with `--verbose` to identify which methods are called but not mocked
- Add missing mock methods to PrismaService mocks
- Ensure all mock methods return Promises where appropriate

### 1.3 Fix Async/Await Issues

- Check that test assertions use `await` for async service methods
- Verify that mock implementations resolve with correct data structures

**Verification:**

```bash
pnpm --filter @campaign/api test settlement.service.test.ts
pnpm --filter @campaign/api test structure.service.test.ts
```

**Success Criteria:**

- All settlement service tests pass
- All structure service tests pass
- No new warnings or errors introduced

---

## Stage 2: Integration Tests - Cache Invalidation (High Priority) ✅ COMPLETED

**Status**: ✅ All 10 tests passing (commit: `df95f3b`)

**File:**

- `packages/api/src/graphql/services/dependency-graph-cache-invalidation.integration.test.ts`

**Actual Failures**: 10 tests (all now fixed)

**Root Cause:**
Both `ConditionService` and `StateVariableService` require `REDIS_PUBSUB` as a constructor dependency for cache invalidation notifications, but the test setup did not provide a mock for this service.

**Implementation Summary:**

Added the missing `REDIS_PUBSUB` provider to the test module configuration at line 80-85:

```typescript
{
  provide: 'REDIS_PUBSUB',
  useValue: {
    publish: jest.fn().mockResolvedValue(undefined),
  },
},
```

This follows the same pattern used in other integration tests (encounter.service.integration.test.ts, event.service.integration.test.ts).

**Test Results:**

✅ All 10 tests now pass (3.542s execution time):

- ConditionService cache invalidation (create/update/delete) - 4 tests
- StateVariableService cache invalidation (create/update/delete) - 4 tests
- Cache rebuilds after invalidation - 1 test
- Multiple campaigns maintain separate caches - 1 test

**Quality Checks:**

✅ Type-check: Passed
✅ Lint: Passed (warnings only, no errors)
✅ Code Review: Approved

---

## Stage 3: Integration Tests - State Variable Versioning (Medium Priority)

**File:**

- `packages/api/src/graphql/services/state-variable-versioning.integration.test.ts`

**Estimated Failures**: ~10 tests

**Root Cause Analysis:**
Similar to Stage 2, likely issues with:

1. Missing providers (REDIS_PUBSUB)
2. Test database setup
3. Optimistic locking version conflicts

**Implementation Steps:**

### 3.1 Add Missing Providers

Same as Stage 2 - add REDIS_PUBSUB provider

### 3.2 Fix Version Conflict Handling

- Verify that optimistic locking tests properly simulate version conflicts
- Ensure version increments are correctly tracked
- Check that rollback behavior is tested correctly

### 3.3 Database State Management

- Ensure tests properly clean up state variables between tests
- Verify that version history is correctly maintained

**Verification:**

```bash
pnpm --filter @campaign/api test state-variable-versioning.integration.test.ts -- --verbose
```

**Success Criteria:**

- All versioning tests pass
- Optimistic locking correctly prevents concurrent updates
- Version history is properly maintained

---

## Stage 4: E2E Tests - Effect System (Medium Priority)

**File:**

- `packages/api/src/__tests__/e2e/effect-system.e2e.test.ts`

**Estimated Failures**: ~10 tests

**Root Cause Analysis:**
E2E tests likely fail due to:

1. Missing providers in test module setup
2. GraphQL schema not properly initialized
3. Database state not properly managed between tests

**Implementation Steps:**

### 4.1 Review Test Module Setup

- Ensure all required providers are included
- Verify GraphQL schema is properly compiled
- Check that all resolvers are registered

### 4.2 Fix Database State Management

- Ensure test database is reset between tests
- Verify that foreign key constraints are satisfied
- Check that cascading deletes work correctly

### 4.3 Verify GraphQL Queries/Mutations

- Check that all GraphQL operations use correct syntax
- Verify that variables are properly typed
- Ensure that error responses are correctly handled

**Verification:**

```bash
pnpm --filter @campaign/api test effect-system.e2e.test.ts -- --verbose
```

**Success Criteria:**

- All E2E tests pass
- Database state properly isolated between tests
- GraphQL operations execute correctly

---

## Stage 5: Integration Tests - Spatial Indexes (Low Priority)

**File:**

- `packages/api/src/common/services/spatial-indexes.integration.test.ts`

**Estimated Failures**: ~4 tests

**Root Cause Analysis:**
Spatial index tests likely fail due to:

1. PostGIS extension not enabled in test database
2. Spatial index creation not working in test environment
3. Geometry data not properly formatted

**Implementation Steps:**

### 5.1 Verify PostGIS Setup

- Ensure PostGIS extension is enabled in test database
- Verify that spatial columns are properly created
- Check that SRID is correctly configured

### 5.2 Fix Spatial Index Creation

- Verify that spatial indexes are created with correct parameters
- Check that index creation SQL is compatible with test database
- Ensure that geometry types are correctly specified

### 5.3 Test Spatial Queries

- Verify that ST_DWithin queries work correctly
- Check that distance calculations are accurate
- Ensure that spatial indexes are actually used (check query plans)

**Verification:**

```bash
# First verify PostGIS is available
docker exec -it campaign_manager-postgres-1 psql -U campaign_user -d campaign_db -c "SELECT PostGIS_Version();"

# Then run tests
pnpm --filter @campaign/api test spatial-indexes.integration.test.ts -- --verbose
```

**Success Criteria:**

- PostGIS extension properly configured
- Spatial indexes created successfully
- All spatial queries return correct results

---

## General Debugging Workflow

For each failing test suite, follow this systematic approach:

### 1. Identify Specific Failures

```bash
pnpm --filter @campaign/api test <test-file> -- --verbose
```

### 2. Analyze Error Messages

- Look for missing providers ("Cannot find module", "is not a function")
- Check for type mismatches
- Identify null/undefined reference errors

### 3. Fix Common Issues

**Missing Providers:**

```typescript
// Add to test module providers array
{
  provide: ServiceName,
  useValue: {
    methodName: jest.fn().mockResolvedValue(expectedValue),
  },
},
```

**Missing Mock Methods:**

```typescript
// Add to existing mock object
mockService.newMethod = jest.fn().mockResolvedValue(value);
```

**Async/Await Issues:**

```typescript
// Ensure all async operations are awaited
await expect(service.asyncMethod()).resolves.toBe(expected);
// OR
const result = await service.asyncMethod();
expect(result).toBe(expected);
```

### 4. Use Subagents

**For TypeScript/ESLint Errors:**

```bash
Use TypeScript Fixer subagent
```

**For Test Failures:**

```bash
Use TypeScript Tester subagent to:
1. Run tests with verbose output
2. Analyze failures
3. Fix implementation code (not test logic)
4. Verify fixes
```

**Before Committing:**

```bash
MANDATORY: Use Code Reviewer subagent to review all changes
```

### 5. Commit Incrementally

After fixing each test suite, commit with detailed message:

```bash
git add <files>
git commit -m "$(cat <<'EOF'
fix(api): fix <test-suite-name> test failures

Fixed <N> test failures in <test-suite-name> by:
1. <specific fix 1>
2. <specific fix 2>
3. <specific fix 3>

Root cause: <explanation>

Tests now pass: <test count>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Common Patterns & Solutions

### Pattern 1: Missing REDIS_PUBSUB Provider

**Symptom**: `Cannot inject REDIS_PUBSUB`

**Solution:**

```typescript
{
  provide: 'REDIS_PUBSUB',
  useValue: {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    asyncIterator: jest.fn(),
  },
},
```

### Pattern 2: Missing Service Method Mocks

**Symptom**: `<method> is not a function`

**Solution:**

```typescript
// Find the service mock and add the missing method
mockService.<method> = jest.fn().mockResolvedValue(<appropriate-value>);
```

### Pattern 3: Type Mismatches in Mocks

**Symptom**: `Type 'X' is not assignable to type 'Y'`

**Solution:**

```typescript
// Ensure mock data matches the actual type definition
const mockData: TypeName = {
  // All required fields from the actual type
};
```

### Pattern 4: Transaction/Database Issues

**Symptom**: Foreign key constraint violations, stale data

**Solution:**

```typescript
// In beforeEach
await prismaService.$transaction(async (tx) => {
  await tx.tableA.deleteMany({});
  await tx.tableB.deleteMany({});
  // Clear in correct order
});
```

### Pattern 5: Async Timing Issues

**Symptom**: Tests pass individually but fail when run together

**Solution:**

```typescript
// Ensure all mocks are reset between tests
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

---

## Success Metrics

**Stage Completion Criteria:**

- ✅ All tests in stage pass
- ✅ No new warnings introduced
- ✅ Code reviewed by subagent
- ✅ Changes committed with detailed message
- ✅ Type-check passes
- ✅ Lint passes (warnings OK, no errors)

**Overall Completion Criteria:**

- ✅ All 1443 tests pass (currently 1221/1443)
- ✅ All 70 test suites pass (currently 57/70)
- ✅ Pre-push hook succeeds
- ✅ GitHub Actions CI passes
- ✅ No skipped tests (except intentionally disabled Redis Pub/Sub tests)

---

## Estimated Timeline

- **Stage 1** (Settlement & Structure): 1-2 hours
- **Stage 2** (Cache Invalidation): 1 hour
- **Stage 3** (State Variable Versioning): 45 minutes
- **Stage 4** (Effect System E2E): 1 hour
- **Stage 5** (Spatial Indexes): 30 minutes

**Total Estimated Time**: 4-5 hours

---

## Notes for Future Sessions

1. **Build Before Testing**: The rules-engine package requires `pnpm --filter @campaign/rules-engine build` before running tests

2. **Test Isolation**: Integration tests may fail if run in parallel. Use `--runInBand` flag if needed:

   ```bash
   pnpm --filter @campaign/api test -- --runInBand
   ```

3. **Database State**: If tests fail due to database state issues, reset the test database:

   ```bash
   docker compose down -v
   docker compose up -d
   pnpm --filter @campaign/api prisma migrate dev
   ```

4. **Redis Dependency**: Some integration tests are intentionally skipped because they require a real Redis instance. This is expected and OK for CI.

5. **Incremental Progress**: Fix one stage at a time, commit after each stage. Don't try to fix everything at once.

6. **Use Subagents**: Always delegate to specialized subagents:
   - TypeScript Fixer for type/lint errors
   - TypeScript Tester for running and debugging tests
   - Code Reviewer before every commit

7. **Don't Change Test Logic**: Fix implementation code or test setup to make tests pass. Only modify test assertions if the test itself is incorrect (very rare).

---

## Quick Reference Commands

```bash
# Run specific test file
pnpm --filter @campaign/api test <test-file>

# Run with verbose output
pnpm --filter @campaign/api test <test-file> -- --verbose

# Run in serial (no parallel)
pnpm --filter @campaign/api test -- --runInBand

# Type-check
pnpm --filter @campaign/api type-check

# Lint
pnpm --filter @campaign/api lint

# Build rules-engine (required before tests)
pnpm --filter @campaign/rules-engine build

# Full test suite
pnpm run test

# Pre-push hook simulation
pnpm run type-check && pnpm run test
```

---

## Contact & Questions

If you encounter issues not covered in this plan:

1. Review similar test files that are passing
2. Check service constructors for new dependencies
3. Review recent commits for changes that might affect tests
4. Use `git log --oneline --grep="test"` to find test-related commits
5. Ask for clarification on specific error messages

**Last Updated**: 2025-10-18 (after commit df95f3b - Stage 2 complete)
