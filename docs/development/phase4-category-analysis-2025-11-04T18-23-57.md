# Phase 4: Category Analysis Report

**Generated:** 2025-11-04T18:23:57.078Z
**Data Source:** /tmp/test-memory-benchmark-2025-11-04T16-52-48.csv
**Test Files Analyzed:** 10
**Categories:** 2

---

## ⚠️ Data Limitations

This analysis is based on **partial data** from Phase 1 benchmarks, which crashed at test #330 due to the 6GB memory limit. The data includes only ~10 test files out of 125 total (8.0% coverage).

**Key Limitations:**

- Memory deltas show negative values due to baseline timing issues
- Missing data for ~115 test files that would have run after the crash
- Peak heap values are more reliable than deltas

---

## Executive Summary

This report analyzes memory usage patterns across **10 test files** grouped into **2 categories**, covering **352 tests**.

**Average Peak Heap:** 56.2 MB (consistent across all tests, indicating native memory accumulation)

### Key Findings

1. **Native Memory Issue:** All test files show similar peak heap (~56MB), but tests crash at 6GB due to **unmeasured native memory** from React Flow, MapLibre GL, and GeoJSON libraries.

2. **Cumulative Accumulation:** Memory accumulates across tests at ~57 MB/second (from Phase 2 analysis), hitting the 6GB limit at test #330.

3. **Category Distribution:** The analyzed test files span 2 categories, with Components representing the majority.

**Top 3 Categories by File Count:**

1. **Components** - 8 files, 292 tests (light memory profile)
2. **Pages** - 2 files, 60 tests (heavy memory profile)

---

## Category Statistics

| Category   | Files | Tests | Avg Peak Heap (MB) | Avg Duration (ms) | Expected Profile |
| ---------- | ----- | ----- | ------------------ | ----------------- | ---------------- |
| Components | 8     | 292   | 56.2               | 1597              | light            |
| Pages      | 2     | 60    | 56.1               | 160               | heavy            |

---

## Detailed Category Breakdown

### Components

- **Files:** 8
- **Subcategories:** versions, branches, entity-inspector
- **Total Tests:** 292
- **Avg Peak Heap:** 56.2 MB
- **Avg Duration:** 1597ms
- **Expected Profile:** `light`

**Test Files:**

- `src/components/features/versions/DiffViewer.test.tsx` (57 tests, 0.30s, peak: 56.2MB)
- `src/components/features/branches/RenameBranchDialog.test.tsx` (25 tests, 2.31s, peak: 56.2MB)
- `src/components/features/versions/VersionList.test.tsx` (54 tests, 2.26s, peak: 56.2MB)
- `src/components/features/branches/MergePreviewDialog.test.tsx` (45 tests, 0.92s, peak: 56.2MB)
- `src/components/features/branches/BranchComparisonView.test.tsx` (18 tests, 2.53s, peak: 56.1MB)
- `src/components/features/branches/CherryPickDialog.test.tsx` (28 tests, 0.79s, peak: 56.1MB)
- `src/components/features/entity-inspector/EntityInspector.test.tsx` (31 tests, 1.60s, peak: 56.2MB)
- `src/components/features/branches/ConflictResolutionDialog.test.tsx` (34 tests, 2.07s, peak: 56.2MB)

### Pages

- **Files:** 2
- **Subcategories:** pages
- **Total Tests:** 60
- **Avg Peak Heap:** 56.1 MB
- **Avg Duration:** 160ms
- **Expected Profile:** `heavy`

**Test Files:**

- `src/pages/TimelinePage.test.tsx` (31 tests, 0.32s, peak: 56.1MB)
- `src/pages/FlowViewPage.test.tsx` (29 tests, 0.00s, peak: 56.1MB)

---

## Subcategory Analysis

| Subcategory                 | Files | Tests | Avg Peak Heap (MB) | Avg Duration (ms) |
| --------------------------- | ----- | ----- | ------------------ | ----------------- |
| Components/branches         | 5     | 150   | 56.2               | 1723              |
| Components/versions         | 2     | 111   | 56.2               | 1281              |
| Pages/pages                 | 2     | 60    | 56.1               | 160               |
| Components/entity-inspector | 1     | 31    | 56.2               | 1599              |

---

## Insights & Recommendations

### Heavy Memory Categories

These categories are expected to consume significant **native memory** due to libraries like React Flow, MapLibre GL, and Turf.js:

- **Pages** (pages): 2 files, 60 tests

**Recommendation:** These categories are prime candidates for optimization through:

1. Mocking heavy dependencies (React Flow, MapLibre GL) for unit tests
2. Using lightweight alternatives (e.g., Storybook for visual testing)
3. Reducing test data sizes (smaller GeoJSON, fewer nodes in graphs)
4. Splitting integration tests into separate suites

### All Test Files Analysis

To get complete category analysis across all 125 test files:

1. **Option A:** Run tests by category separately (avoiding OOM)
2. **Option B:** Use Phase 3 memory profiler on individual test files
3. **Option C:** Increase worker memory limit (requires infrastructure changes)

---

## Next Steps

1. ✅ **Phase 4 Complete** - Category framework established and partial analysis done
2. Focus optimization on heavy categories (entity-inspector, map, flow, pages)
3. Use Phase 3 profiler to identify specific high-memory tests within categories
4. Implement mocking strategies for React Flow and MapLibre GL
5. Re-run benchmarks after optimizations to measure improvement
