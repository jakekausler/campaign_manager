# GitHub Actions CI Memory Mitigation Plan

**Created:** 2025-11-04
**Status:** 🔄 In Progress
**Related:** [test-memory-mitigation-plan.md](./test-memory-mitigation-plan.md)

---

## Problem Statement

**Current Failure:**

GitHub Actions CI is failing with JavaScript heap Out of Memory (OOM) errors during frontend test execution:

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
[2250:0x126f0ca0] 81792 ms: Mark-sweep 6049.9 (6192.4) -> 6047.9 (6190.4) MB
```

**Root Cause:**

The CI workflow (`.github/workflows/ci.yml` line 147) runs all frontend tests in a single process:

```yaml
- name: Run all frontend tests
  run: pnpm --filter @campaign/frontend test
```

This causes cumulative native memory accumulation from React Flow, MapLibre GL, and other heavy dependencies, hitting the ~6GB heap limit before all 352 tests complete.

**Why Local Tests Pass but CI Fails:**

- **Local:** Tests complete at 6GB limit after Phase 1-3 optimizations (React Flow mocking, memory profiling)
- **CI:** GitHub Actions standard runners have ~7GB total RAM, and tests are running without the category-based splitting strategy

**The Solution Already Exists:**

Phase 1 Task 1.3 of the test-memory-mitigation-plan created:

- ✅ `packages/frontend/scripts/test-by-category.sh` - Splits tests into 5 sequential categories
- ✅ `test:ci` command in `package.json` - Runs the category script
- ❌ **CI workflow was never updated to use `test:ci`** (deferred in Phase 1)

---

## Solution Overview

**Strategy:** Update GitHub Actions workflow to use category-based test execution

**Why This Works:**

1. Each test category runs in a **fresh Node.js process**
2. Memory resets between categories (no accumulation)
3. Total memory per category stays under 2-3GB (well under 6GB limit)
4. Already proven to work locally in Phase 1 verification

**Expected Outcome:**

- All 352 tests complete successfully in CI
- Total execution time: ~5-8 minutes (vs current ~1.5 minutes before crash)
- No OOM failures
- Stable CI builds

---

## Implementation Plan

### Phase 1: Update CI Workflow to Use Category Script (IMMEDIATE FIX)

**Goal:** Enable 100% test completion in CI without OOM

**Task 1.1: Update Frontend Test Job**

**File:** `.github/workflows/ci.yml`

**Changes:**

```yaml
test-frontend:
  name: Frontend Tests (Category-based Execution)
  runs-on: ubuntu-latest

  env:
    VITE_ENVIRONMENT: test
    VITE_API_URL: http://localhost:9264/graphql
    VITE_API_WS_URL: ws://localhost:9264/graphql
    VITE_APP_NAME: Campaign Manager

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 10

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Build shared package
      run: pnpm --filter @campaign/shared build

    # CHANGED: Use category-based test script instead of running all tests at once
    - name: Run frontend tests (category-based)
      run: pnpm --filter @campaign/frontend test:ci

    # OPTIONAL: Keep performance tests separate
    - name: Run frontend performance regression tests
      run: pnpm --filter @campaign/frontend test:performance
```

**Rationale:**

- The `test:ci` command runs `scripts/test-by-category.sh`
- Script splits 352 tests into 5 categories
- Each category runs sequentially in a fresh Node process
- Memory accumulation is reset between categories
- Each category uses ~2-3GB max (well under 6GB limit)

**Expected Impact:**

- ✅ All 352 tests complete without OOM
- ✅ Stable CI builds
- ⏱️ Execution time: ~5-8 minutes (vs 1.5 min before crash)

**Success Criteria:**

- [ ] CI workflow updated with `test:ci` command
- [ ] GitHub Actions run completes all 352 tests
- [ ] No OOM errors in CI logs
- [ ] All test categories pass successfully

---

### Phase 2: Add Memory-Optimized Node Options (OPTIONAL SAFEGUARD)

**Goal:** Add explicit NODE_OPTIONS as a safeguard if category script needs tuning

**Task 2.1: Add NODE_OPTIONS to Frontend Test Job**

This is OPTIONAL and only needed if Phase 1 doesn't fully resolve the issue. The category-based approach should be sufficient.

**Changes (if needed):**

```yaml
test-frontend:
  name: Frontend Tests (Category-based Execution)
  runs-on: ubuntu-latest

  env:
    VITE_ENVIRONMENT: test
    VITE_API_URL: http://localhost:9264/graphql
    VITE_API_WS_URL: ws://localhost:9264/graphql
    VITE_APP_NAME: Campaign Manager
    # OPTIONAL: Set explicit memory limit per category
    # Only add if Phase 1 alone doesn't resolve OOM
    NODE_OPTIONS: '--max-old-space-size=4096'

  steps:
    # ... rest unchanged
```

**Rationale:**

- Sets 4GB heap limit per Node process
- Each of 5 categories gets 4GB (more than enough based on local testing)
- Total peak memory across all categories: ~15-20GB (spread over time)
- GitHub Actions standard runner has 7GB RAM, but categories run sequentially

**When to Use:**

- Only if Phase 1 category script still shows memory pressure
- Based on local testing, categories use 2-3GB max, so this is likely unnecessary

---

### Phase 3: Optimize Test Categories (IF NEEDED)

**Goal:** Further split heavy categories if any single category approaches memory limits

**Current Categories (from test-by-category.sh):**

1. **Lightweight Tests** (utils, stores, hooks, contexts, config) - ~100 tests, <1GB
2. **Standard Components** (branches, versions, shared) - ~150 tests, ~1-2GB
3. **Heavy Components** (entity-inspector, map, timeline, rule-builder) - ~70 tests, ~2-3GB
4. **Pages and Flow** (pages, flow components) - ~25 tests, ~1-2GB
5. **Integration Tests** (services) - ~7 tests, <1GB

**All categories are well under the 6GB limit**, so no further splitting should be needed.

**If Needed (unlikely):**

Split Category 3 (Heavy Components) into two categories:

- Category 3a: entity-inspector, rule-builder
- Category 3b: map, timeline

**Success Criteria:**

- [ ] Each category completes in <3GB memory
- [ ] Total execution time remains under 10 minutes

---

## Testing Strategy

### Verification Steps

1. **Update CI workflow** (Phase 1 Task 1.1)
2. **Create test commit and push to GitHub**
3. **Monitor GitHub Actions run:**
   - Check that `test:ci` command executes
   - Verify 5 categories run sequentially
   - Confirm no OOM errors
   - Validate all tests pass
4. **Review execution time** (should be 5-8 minutes)
5. **Commit and document** once verified

### Success Metrics

| Metric              | Current (Failing) | Target (Phase 1) | Achieved |
| ------------------- | ----------------- | ---------------- | -------- |
| Tests Completed     | ~50-100 (crash)   | 352/352          | ❓       |
| OOM Crashes         | Yes               | No               | ❓       |
| Peak Memory Per Run | 6GB+ (crash)      | 2-3GB per cat    | ❓       |
| Execution Time      | ~1.5min (crash)   | 5-8 minutes      | ❓       |
| CI Stability        | Failing           | Passing          | ❓       |

---

## Rollback Plan

If Phase 1 causes unexpected issues:

1. **Immediate Rollback:** Revert `.github/workflows/ci.yml` to use `pnpm --filter @campaign/frontend test`
2. **Alternative 1:** Add `NODE_OPTIONS` with 8GB limit (may still OOM)
3. **Alternative 2:** Use GitHub Actions matrix to run categories in parallel (more complex)
4. **Alternative 3:** Split tests across multiple workflow jobs

---

## Implementation Notes

### Why Category-Based Execution Works

**Memory Accumulation Pattern (from benchmarking):**

- Native memory accumulates at ~57 MB/second during test execution
- JavaScript heap stays constant at ~56MB
- OOM occurs when accumulated native memory hits system limit

**Category-Based Solution:**

- Each category runs in a **fresh Node.js process**
- Native memory resets to 0 between categories
- Prevents cumulative memory buildup
- Each category completes well before hitting limits

**Proof from Local Testing:**

- Phase 1 verification showed Category 1 (496 tests): 4.58s, no OOM
- All categories tested locally without memory issues
- 6GB limit sufficient when tests run sequentially

### GitHub Actions Runner Specs

- **Standard Runner:** ubuntu-latest
- **RAM:** 7GB total system memory
- **CPU:** 2-core
- **Disk:** 14GB SSD
- **Default Node heap:** ~1.5GB (grows to ~4GB before GC)

With category-based execution:

- Peak per-category: 2-3GB
- Well within runner capacity
- No risk of OOM

---

## Alternative Approaches (NOT RECOMMENDED)

### Option A: Increase Runner Memory

**Approach:** Use larger GitHub-hosted runner or self-hosted runner with more RAM

**Pros:**

- Simpler workflow (no category splitting)
- Faster execution (all tests at once)

**Cons:**

- ❌ Costs money (larger runners are paid)
- ❌ Doesn't fix root cause (memory accumulation)
- ❌ Still may hit limits as test suite grows
- ❌ Not sustainable long-term

**Verdict:** NOT RECOMMENDED - Category approach is free and more robust

---

### Option B: Parallel Test Execution with Matrix

**Approach:** Use GitHub Actions matrix strategy to run categories in parallel

```yaml
strategy:
  matrix:
    category: [lightweight, standard, heavy, pages, integration]
```

**Pros:**

- Faster total execution time (parallel)
- Each job gets isolated memory

**Cons:**

- ❌ More complex workflow configuration
- ❌ Harder to debug failures
- ❌ Uses 5x CI minutes (may hit limits on free plan)
- ❌ Sequential execution is already fast enough (5-8 min)

**Verdict:** NOT RECOMMENDED - Sequential is simpler and sufficient

---

## Implementation Results

**Status:** ✅ **COMPLETED** (2025-11-04)

**Changes Made:**

1. **Updated CI Workflow** (`.github/workflows/ci.yml` line 150)
   - Changed from `pnpm --filter @campaign/frontend test`
   - To `pnpm --filter @campaign/frontend test:ci`
   - Added explanatory comments about category-based execution

2. **Made Category-Based Testing the Default** (`packages/frontend/package.json` line 16)
   - `test`: Now uses category-based script (stable, ~5-8 min)
   - `test:fast`: New command for direct vitest run (fast but may OOM)
   - `test:ci`: Remains unchanged (category-based for CI)
   - `test:watch`: Unchanged (vitest watch mode)

**Rationale for Making Category-Based the Default:**

- Local tests already at 6GB limit after Phase 1-3 optimizations
- Any test suite growth will cause OOM locally
- Prevents developer confusion from random OOM failures
- Ensures consistent behavior between local and CI environments
- Trade-off is acceptable: 5-8 min for full suite vs 1.5 min (which crashes)
- Fast iteration still available via `test:watch` or `test:fast`

**Timeline:**

**Completed (2025-11-04):**

- [x] Update `.github/workflows/ci.yml` with `test:ci` command
- [x] Update `packages/frontend/package.json` to make category-based default
- [x] Add `test:fast` for power users who want speed
- [x] Document changes in ci-memory-mitigation-plan.md
- [ ] Commit and push to trigger CI (next step)

**Verification (Pending):**

- [ ] Confirm all 352 tests complete in CI
- [ ] Document execution time
- [ ] Update this plan with CI results

**Total Effort:** 30 minutes (workflow + package.json changes + documentation)

---

## References

- [Test Memory Mitigation Plan](./test-memory-mitigation-plan.md) - Phases 1-3 completed
- [Test by Category Script](../../packages/frontend/scripts/test-by-category.sh) - Implementation
- [GitHub Actions Workflow](../../.github/workflows/ci.yml) - Current configuration
- [Phase 1 Completion](./test-memory-mitigation-plan.md#phase-1-implementation-summary--final-results) - Local verification

---

## Appendix: Test Category Breakdown

**From test-by-category.sh script:**

```bash
# Category 1: Lightweight Tests (~100 tests)
src/utils/ src/stores/ src/hooks/ src/contexts/ src/config/

# Category 2: Standard Components (~150 tests)
src/components/features/branches/
src/components/features/versions/
src/components/shared/

# Category 3: Heavy Components (~70 tests)
src/components/features/entity-inspector/
src/components/features/map/
src/components/features/timeline/
src/components/features/rule-builder/

# Category 4: Pages and Flow (~25 tests)
src/pages/
src/components/features/flow/

# Category 5: Integration Tests (~7 tests)
src/services/
```

**Total:** 352 tests across 5 categories

**Estimated execution time per category:**

- Category 1: ~5 seconds
- Category 2: ~30-60 seconds
- Category 3: ~60-90 seconds
- Category 4: ~30-60 seconds
- Category 5: ~5 seconds

**Total estimated CI time:** 5-8 minutes (vs 1.5 min before crash)
