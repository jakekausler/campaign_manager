# Frontend Test Memory Benchmarking Plan

**Created:** 2025-11-04
**Status:** 🔄 In Progress
**Owner:** Development Team

---

## Background

This plan follows the [Frontend Test Performance Optimization Plan](./test-performance-optimization-plan.md), which completed 7 phases of optimization:

1. **Phase 1-2**: Split and reduced performance test datasets
2. **Phase 3**: Standardized cleanup patterns across 102 test files (added `cleanup()` + `vi.clearAllMocks()` to all tests)
3. **Phase 4**: Optimized Vitest configuration (removed `--expose-gc`, enabled `singleFork`, improved test isolation)
4. **Phase 5**: Enhanced React Flow cleanup patterns
5. **Phase 6**: Reduced mock data sizes by 50% and enhanced Apollo/MSW cleanup
6. **Phase 7**: **Removed error-masking wrapper script** - exposed that tests were crashing at 6GB (wrapper was hiding failures)

**Key Finding:** Tests require ~6GB memory (not the projected 2GB). The optimization plan's 70% reduction target was optimistic - actual reduction was ~14% (7GB total → 6GB worker).

📖 **See [test-performance-optimization-plan.md](./test-performance-optimization-plan.md) for complete details on what was attempted and actual results.**

---

## Executive Summary

After completing Phases 1-7 of the test performance optimization plan, we discovered that tests require ~6GB memory (not the projected 2GB). Phase 7 removed error masking, exposing that tests were always crashing at the 6GB limit. This plan establishes a systematic approach to:

1. **Benchmark memory usage per test file** to identify memory-hungry tests
2. **Identify accumulation patterns** to detect memory leaks across test execution
3. **Profile individual tests** to find single tests with excessive memory usage
4. **Create actionable optimization targets** based on data

---

## Problem Statement

**Current State:**

- Tests require 6GB worker memory to complete
- Tests crash with heap exhaustion (OOM) when memory is insufficient
- 330/352 tests pass before crash occurs (~94%)
- Unknown which test files consume most memory
- Unknown whether memory accumulates over time or spikes in specific tests

**Goals:**

- Identify the top 10-20 most memory-intensive test files
- Determine if memory accumulates linearly or has specific spike points
- Quantify memory usage per test category (component vs utility vs hook tests)
- Create data-driven targets for further optimization

---

## Benchmarking Strategy

### Phase 1: Per-File Memory Profiling

**Goal:** Measure memory usage for each test file individually

**Approach:**

1. Create a benchmark script that runs each test file separately
2. Measure heap usage before and after each file
3. Record peak memory during file execution
4. Calculate memory delta per file

**Tools:**

- Node.js `process.memoryUsage()` API
- Vitest reporter plugin
- Custom benchmark runner script

**Implementation:**

```bash
# packages/frontend/scripts/benchmark-tests.sh
#!/bin/bash

# Find all test files
TEST_FILES=$(find src -name "*.test.tsx" -o -name "*.test.ts")

# Create results file
RESULTS_FILE="test-memory-benchmark-$(date +%Y%m%d-%H%M%S).csv"
echo "file,heapUsed_MB,heapTotal_MB,external_MB,rss_MB,duration_ms" > "$RESULTS_FILE"

# Run each test file individually
for file in $TEST_FILES; do
  echo "Benchmarking: $file"

  # Run test with memory reporting
  pnpm exec vitest run "$file" --reporter=json > temp-result.json 2>&1

  # Extract memory stats (would need custom reporter)
  # Parse and append to results file

  # Clean up
  rm temp-result.json
done

echo "Results saved to: $RESULTS_FILE"
```

**Custom Vitest Reporter:**

```typescript
// packages/frontend/src/__tests__/utils/memory-reporter.ts
import type { Reporter } from 'vitest';

export class MemoryReporter implements Reporter {
  private results: Map<string, MemoryStats> = new Map();

  onTestFileStart(file: string) {
    const baseline = process.memoryUsage();
    this.results.set(file, {
      baseline,
      peak: baseline,
      file,
    });
  }

  onTestFileEnd(file: string) {
    const current = process.memoryUsage();
    const stats = this.results.get(file);

    if (stats) {
      stats.final = current;
      stats.delta = {
        heapUsed: (current.heapUsed - stats.baseline.heapUsed) / 1024 / 1024,
        heapTotal: (current.heapTotal - stats.baseline.heapTotal) / 1024 / 1024,
        external: (current.external - stats.baseline.external) / 1024 / 1024,
        rss: (current.rss - stats.baseline.rss) / 1024 / 1024,
      };
    }
  }

  onFinished() {
    // Output results as JSON or CSV
    const report = Array.from(this.results.entries())
      .map(([file, stats]) => ({
        file,
        ...stats.delta,
        peak: stats.peak.heapUsed / 1024 / 1024,
      }))
      .sort((a, b) => b.heapUsed - a.heapUsed);

    console.log('\n=== Memory Usage Report ===\n');
    console.table(report.slice(0, 20));
  }
}

interface MemoryStats {
  file: string;
  baseline: NodeJS.MemoryUsage;
  peak: NodeJS.MemoryUsage;
  final?: NodeJS.MemoryUsage;
  delta?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}
```

**Expected Output:**

- CSV file with per-file memory usage
- Sorted list of top memory consumers
- Category breakdown (component vs utility tests)

**Success Criteria:**

- [ ] Benchmark script runs successfully on all test files
- [ ] Results show memory delta for each file
- [ ] Top 10 memory-intensive files identified
- [ ] Results saved to timestamped CSV file

---

### Phase 2: Accumulation Pattern Analysis

**Goal:** Determine if memory accumulates over test execution or spikes in specific tests

**Approach:**

1. Run full test suite with memory snapshots at intervals
2. Plot memory usage over time
3. Identify linear accumulation vs spike patterns
4. Correlate spikes with specific test files

**Implementation:**

```typescript
// packages/frontend/src/__tests__/utils/memory-tracker.ts
export class MemoryTracker {
  private snapshots: MemorySnapshot[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  start(intervalMs: number = 1000) {
    this.intervalId = setInterval(() => {
      this.snapshots.push({
        timestamp: Date.now(),
        memory: process.memoryUsage(),
      });
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  getReport() {
    return {
      snapshots: this.snapshots,
      trend: this.calculateTrend(),
      peaks: this.findPeaks(),
    };
  }

  private calculateTrend() {
    // Linear regression to detect accumulation rate
    const x = this.snapshots.map((_, i) => i);
    const y = this.snapshots.map((s) => s.memory.heapUsed);

    // Calculate slope (MB per snapshot)
    // Returns: { slope, baseline, r2 }
  }

  private findPeaks() {
    // Identify significant memory spikes (>100MB increase)
    const threshold = 100 * 1024 * 1024; // 100MB
    return this.snapshots.filter((snapshot, i) => {
      if (i === 0) return false;
      const delta = snapshot.memory.heapUsed - this.snapshots[i - 1].memory.heapUsed;
      return delta > threshold;
    });
  }
}

interface MemorySnapshot {
  timestamp: number;
  memory: NodeJS.MemoryUsage;
}
```

**Visualization:**

```bash
# Generate memory usage graph
node scripts/visualize-memory.js benchmark-results.csv
```

**Expected Output:**

- Graph showing memory usage over test execution time
- Identification of accumulation pattern (linear, stepped, or spike-based)
- List of files where major spikes occur

**Success Criteria:**

- [ ] Memory tracking captures snapshots during full test run
- [ ] Trend analysis shows accumulation rate (MB/test)
- [ ] Peak detection identifies major memory spikes
- [ ] Visual graph generated for analysis

---

### Phase 3: Individual Test Profiling

**Goal:** Profile memory usage within individual test files to find specific problematic tests

**Approach:**

1. Add memory measurements to `beforeEach` and `afterEach` hooks
2. Track memory per test case (not just per file)
3. Identify tests with poor cleanup (memory not released)

**Implementation:**

```typescript
// packages/frontend/src/__tests__/utils/test-memory-profiler.ts
let testMemoryBaseline: NodeJS.MemoryUsage | null = null;

export function enableMemoryProfiling() {
  beforeEach(() => {
    // Force GC if available (requires --expose-gc)
    if (global.gc) {
      global.gc();
    }
    testMemoryBaseline = process.memoryUsage();
  });

  afterEach(function () {
    if (!testMemoryBaseline) return;

    const current = process.memoryUsage();
    const delta = {
      heapUsed: (current.heapUsed - testMemoryBaseline.heapUsed) / 1024 / 1024,
      heapTotal: (current.heapTotal - testMemoryBaseline.heapTotal) / 1024 / 1024,
    };

    // Warn if test consumed >50MB
    if (delta.heapUsed > 50) {
      console.warn(
        `⚠️  High memory usage in test "${this.test?.name}": ${delta.heapUsed.toFixed(2)}MB`
      );
    }
  });
}
```

**Usage:**

```typescript
// In a test file
import { enableMemoryProfiling } from '@/__tests__/utils/test-memory-profiler';

describe('EntityInspector', () => {
  enableMemoryProfiling();

  it('renders correctly', () => {
    // Test code...
  });
});
```

**Expected Output:**

- Warnings for tests consuming >50MB
- List of tests with poor cleanup (memory not released after test)
- Identification of specific test cases to optimize

**Success Criteria:**

- [ ] Memory profiling hook works in test files
- [ ] High-memory tests are automatically flagged
- [ ] Reports show memory delta per individual test
- [ ] Identifies tests that don't clean up properly

---

### Phase 4: Category Analysis

**Goal:** Compare memory usage across test categories to identify patterns

**Approach:**

1. Categorize tests by type (component, utility, hook, page, etc.)
2. Calculate average memory per category
3. Identify which categories consume most memory

**Categories:**

- Component tests (`src/components/**/*.test.tsx`)
- Hook tests (`src/hooks/**/*.test.tsx`)
- Utility tests (`src/utils/**/*.test.ts`)
- Page tests (`src/pages/**/*.test.tsx`)
- Store tests (`src/stores/**/*.test.ts`)
- Integration tests (Entity Inspector, etc.)

**Implementation:**

```typescript
// Automated categorization based on file path
function categorizeTest(filePath: string): string {
  if (filePath.includes('/components/')) return 'component';
  if (filePath.includes('/hooks/')) return 'hook';
  if (filePath.includes('/utils/')) return 'utility';
  if (filePath.includes('/pages/')) return 'page';
  if (filePath.includes('/stores/')) return 'store';
  if (filePath.includes('/entity-inspector/')) return 'entity-inspector';
  return 'other';
}
```

**Expected Output:**

- Table showing average memory per category
- Identification of most memory-intensive category
- Breakdown of total memory by category

**Success Criteria:**

- [ ] All test files categorized correctly
- [ ] Average memory calculated per category
- [ ] Category comparison report generated
- [ ] Actionable insights identified per category

---

## Expected Deliverables

1. **Memory Benchmark Report** (`test-memory-benchmark-YYYYMMDD.csv`)
   - Per-file memory usage
   - Sorted by memory consumption
   - Top 20 most memory-intensive files highlighted

2. **Accumulation Analysis Report** (`memory-accumulation-analysis.md`)
   - Memory usage graph over time
   - Trend analysis (linear vs spike patterns)
   - Identification of accumulation rate

3. **Test Profile Report** (`test-profile-report.md`)
   - Individual tests consuming >50MB
   - Tests with poor cleanup
   - Specific optimization targets

4. **Category Analysis Report** (`category-analysis.md`)
   - Average memory per test category
   - Total memory by category
   - Category-specific recommendations

5. **Optimization Roadmap** (`memory-optimization-roadmap.md`)
   - Top 10-20 files to optimize
   - Specific techniques per file type
   - Estimated impact per optimization

---

## Implementation Timeline

### Week 1: Setup and Phase 1

- [ ] Create benchmark script
- [ ] Implement custom Vitest reporter
- [ ] Run initial benchmarks
- [ ] Generate per-file memory report

### Week 2: Phase 2-3

- [ ] Implement memory tracker
- [ ] Run full suite with memory snapshots
- [ ] Analyze accumulation patterns
- [ ] Add individual test profiling hooks

### Week 3: Phase 4 and Analysis

- [ ] Categorize all test files
- [ ] Generate category analysis report
- [ ] Create visualization graphs
- [ ] Document findings

### Week 4: Optimization Roadmap

- [ ] Prioritize optimization targets
- [ ] Create detailed optimization plan
- [ ] Estimate impact per optimization
- [ ] Plan implementation stages

**Total Effort:** 4 weeks (~20-30 hours)

---

## Success Metrics

- [ ] All test files benchmarked successfully
- [ ] Top 10 memory-intensive files identified
- [ ] Accumulation pattern characterized (linear/spike/mixed)
- [ ] Individual high-memory tests identified (>50MB)
- [ ] Category breakdown complete
- [ ] Optimization roadmap created with data-driven targets

---

## Tools and Technologies

- **Node.js APIs:** `process.memoryUsage()`, `v8.getHeapStatistics()`
- **Vitest:** Custom reporters and hooks
- **Bash scripting:** Automated benchmarking runner
- **Data visualization:** CSV export, optional graph generation
- **TypeScript:** Type-safe profiling utilities

---

## Next Steps

1. Review and approve this plan
2. Begin with Phase 1: Per-File Memory Profiling
3. Create benchmark script and custom reporter
4. Run initial benchmarks on current test suite
5. Analyze results and proceed to Phase 2

---

## Notes

- This plan focuses on **measurement and analysis**, not optimization
- Optimization will be planned based on benchmark data
- May reveal that memory usage is evenly distributed (no single culprit)
- Could identify opportunities for test splitting or parallelization
- Results will inform whether further optimization is needed or if 6GB is acceptable
