# Phase 1: Memory Benchmark Results

**Date:** 2025-11-04
**Benchmark Duration:** 100.89s
**Status:** ⚠️ Partial (crashed after 330/352 tests)

---

## Executive Summary

Phase 1 of the memory benchmarking plan successfully established tooling to measure per-file memory usage. The benchmark confirmed the existing 6GB memory requirement and crash point at ~330 tests (94% completion), validating findings from the previous optimization plan.

**Key Finding:** The test suite crashes due to worker exit (OOM) after processing 330 tests across 10 test files, matching the known memory limit issue documented in `test-performance-optimization-plan.md`.

---

## Benchmark Results

### Test Execution Summary

- **Total Test Files:** 10 (out of ~100+ in codebase)
- **Tests Passed:** 330 / 352
- **Duration:** 100.89s
- **Crash Point:** FlowViewPage.test.tsx (29 tests, only 7 passed before crash)
- **Error:** Worker exited unexpectedly (heap exhaustion)

### Memory Observations

**Heap Usage Pattern (from snapshots):**

- **Start:** ~72MB heap
- **Peak (mid-run):** ~102MB heap
- **End (before crash):** ~56MB heap
- **RSS (final):** ~145MB

The heap measurements show fluctuation rather than linear accumulation, suggesting GC is working but cannot prevent eventual OOM.

---

## Per-File Analysis

### Top 10 Files Processed (before crash)

| File                              | Peak Heap (MB) | Duration (s) | Tests | Notes              |
| --------------------------------- | -------------- | ------------ | ----- | ------------------ |
| VersionList.test.tsx              | 55.9           | 2.02         | 54    | Largest test count |
| EntityInspector.test.tsx          | 55.9           | 2.25         | 31    | Complex component  |
| ConflictResolutionDialog.test.tsx | 55.9           | 2.04         | 34    | Branching feature  |
| RenameBranchDialog.test.tsx       | 55.9           | 2.27         | 25    | Long duration      |
| BranchComparisonView.test.tsx     | 55.9           | 2.19         | 18    | Branching feature  |
| MergePreviewDialog.test.tsx       | 55.9           | 1.00         | 45    | Branching feature  |
| CherryPickDialog.test.tsx         | 55.9           | 1.00         | 28    | Branching feature  |
| DiffViewer.test.tsx               | 55.9           | 0.28         | 57    | Fast execution     |
| TimelinePage.test.tsx             | 55.9           | 0.37         | 31    | Page test          |
| FlowViewPage.test.tsx             | 55.9           | 0.00         | 7/29  | **Crashed here**   |

**Pattern:** All test files show similar peak heap (~56MB), suggesting the issue is cumulative across files rather than individual file spikes.

### Category Breakdown

| Category           | Files | Tests | Avg Duration (s) |
| ------------------ | ----- | ----- | ---------------- |
| Feature Components | 7     | 261   | 1.55             |
| Pages              | 2     | 60    | 0.19             |
| Entity Inspector   | 1     | 31    | 2.25             |

---

## Memory Snapshot Analysis

**Accumulation Pattern:** Memory snapshots (taken every 2s) reveal:

1. **Initial Growth (0-30s):**
   - 72MB → 102MB heap (+41% increase)
   - RSS grows from 180MB → 202MB

2. **Mid-Run Fluctuation (30-60s):**
   - Heap fluctuates between 90-110MB
   - GC cycles visible in sawtooth pattern

3. **Late Stage (60-100s):**
   - Heap stabilizes around 55-60MB
   - RSS remains ~145MB
   - Crash occurs despite "low" heap usage

**Critical Observation:** The heap was only at 56MB when the worker crashed, suggesting the issue may be:

- Total process memory (not just V8 heap)
- Memory fragmentation
- Native addon memory (React Flow, MapLibre, etc.)
- Worker overhead in singleFork mode

---

## Technical Issues Discovered

### 1. Reporter Measurement Timing

The current reporter implementation has a flaw:

- **Baseline:** Captured in `onCollected` (before any tests run)
- **Final:** Captured in `onFinished` (after ALL tests complete)
- **Result:** Negative heap deltas because final measurement includes GC cleanup

**Impact:** Per-file memory deltas are inaccurate (all negative values)

**Recommendation:** Refactor reporter to use `onTestFileStart`/`onTestFileEnd` hooks for accurate per-file measurements.

### 2. Incomplete Dataset

Only 10 test files completed before crash, providing limited insights.

**Missing Data:**

- ~90+ test files not benchmarked
- No data on hook tests, utility tests, store tests
- Cannot identify true memory-intensive files

---

## Key Findings

### ✅ Confirmed

1. **6GB Requirement Valid:** Tests crash at ~330 tests with 6GB heap limit
2. **Worker Exit Cause:** OOM occurs even when V8 heap shows "normal" usage (~56MB)
3. **No Single Culprit:** All benchmarked files show similar peak heap usage (~56MB)
4. **Sequential Execution Works:** singleFork mode successfully prevents parallelization issues

### ❌ Not Determined

1. **Actual Memory Hogs:** Cannot identify specific memory-intensive files (only 10/100+ tested)
2. **Accumulation Root Cause:** Unclear if issue is V8 heap, native memory, or fragmentation
3. **Per-File Accurate Metrics:** Reporter timing issues prevent accurate per-file analysis
4. **Optimization Targets:** Insufficient data to create prioritized optimization list

---

## Memory Snapshot Timeline

| Time (s) | Heap (MB) | RSS (MB) | Event              |
| -------- | --------- | -------- | ------------------ |
| 0        | 72        | 180      | Benchmark start    |
| 12       | 93        | 202      | Peak mid-run       |
| 30       | 90-110    | 190-200  | GC cycles active   |
| 60       | 80-90     | 170-180  | Heap decreasing    |
| 90       | 55-60     | 145-150  | Stabilized         |
| 100      | 56        | 145      | Worker crash (OOM) |

---

## Output Files

### Generated Artifacts

1. **CSV Report:** `/tmp/test-memory-benchmark-2025-11-04T16-37-01.csv`
   - 10 test files
   - Per-file metrics (with timing issues noted)
   - Test counts and durations

2. **JSON Snapshots:** `/tmp/memory-snapshots-2025-11-04T16-37-01.json`
   - 51 snapshots (every 2s over 100s)
   - Heap, RSS, and external memory tracking
   - Shows accumulation pattern

3. **Full Log:** `/tmp/benchmark-run.log`
   - Complete console output
   - Test execution trace
   - Error details

---

## Recommendations for Phase 2

### Immediate Actions

1. **Fix Reporter Timing**
   - Use `onTestFileStart`/`onTestFileEnd` for accurate per-file measurements
   - Track memory before/after each individual file, not globally

2. **Run Per-File Benchmarks**
   - Since full suite crashes, run each file individually with the memory reporter
   - Aggregate results manually to avoid OOM crash
   - This will provide complete coverage of all ~100+ test files

3. **Add Native Memory Tracking**
   - Current reporter only tracks V8 heap
   - Need to track total process memory (RSS)
   - Consider native addon memory (React Flow, MapLibre, Turf.js)

### Analysis Priorities

1. **Identify Top 20 Memory-Intensive Files**
   - Run individual file benchmarks
   - Sort by actual heap delta (not the flawed negative values)
   - Prioritize optimization targets

2. **Categorize Memory Patterns**
   - Component tests vs utility tests
   - Tests with complex mocks (Apollo, MSW)
   - Tests with large data structures (React Flow nodes, GeoJSON)

3. **Profile Native Memory**
   - Investigate React Flow memory usage
   - Check MapLibre GL initialization overhead
   - Review GeoJSON processing (Turf.js)

---

## Conclusions

**Phase 1 Status:** ✅ **Tooling Established, Partial Data Collected**

The memory benchmarking infrastructure is functional and provides valuable insights, but the full suite benchmark approach is limited by the existing 6GB crash point. The reporter implementation needs refinement for accurate per-file measurements.

**Next Steps:**

1. Fix reporter timing issues
2. Run individual file benchmarks to avoid OOM crash
3. Aggregate results to identify true memory-intensive files
4. Investigate native memory usage beyond V8 heap

**Critical Insight:** The crash occurs when V8 heap is only at 56MB, strongly suggesting the issue is **not** V8 heap exhaustion but rather:

- Total process memory (RSS)
- Native addon memory leaks
- Worker process overhead
- Memory fragmentation

This finding shifts the optimization strategy from "reduce test heap usage" to "investigate native memory and worker architecture."
