/**
 * Test Memory Profiler - Phase 3: Individual Test Profiling
 *
 * Tracks memory usage per test case to identify:
 * - Tests with high memory consumption (>50MB)
 * - Tests with poor cleanup (memory not released after test)
 * - Specific problematic test cases within files
 *
 * NOTE: Based on Phase 2 findings, the 6GB crash is caused by NATIVE memory
 * (React Flow, MapLibre GL, GeoJSON, Happy-DOM), not JavaScript heap.
 * This profiler tracks JS heap via process.memoryUsage(), which may show
 * stable values while native memory accumulates. Use this to:
 * - Identify which tests use native libraries most heavily
 * - Find opportunities to mock/stub heavy native dependencies
 * - Understand test distribution patterns
 */

import { beforeEach, afterEach } from 'vitest';

interface MemoryDelta {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

interface TestMemoryReport {
  testName: string;
  baseline: NodeJS.MemoryUsage;
  final: NodeJS.MemoryUsage;
  delta: MemoryDelta;
  timestamp: number;
}

let testMemoryBaseline: NodeJS.MemoryUsage | null = null;
const memoryReports: TestMemoryReport[] = [];

/**
 * Enables memory profiling for all tests in the current describe block.
 * Call this once at the top level of your test file.
 *
 * @param options Configuration options
 * @param options.warnThresholdMB - Warn if test consumes more than this many MB (default: 50)
 * @param options.enableGC - Attempt to run GC before each test (requires --expose-gc flag)
 *
 * @example
 * ```typescript
 * import { enableMemoryProfiling } from '@/__tests__/utils/test-memory-profiler';
 *
 * describe('EntityInspector', () => {
 *   enableMemoryProfiling({ warnThresholdMB: 50 });
 *
 *   it('renders correctly', () => {
 *     // Test code...
 *   });
 * });
 * ```
 */
export function enableMemoryProfiling(
  options: {
    warnThresholdMB?: number;
    enableGC?: boolean;
  } = {}
) {
  const { warnThresholdMB = 50, enableGC = false } = options;

  beforeEach((_context) => {
    // Optionally force GC if available (requires --expose-gc)
    if (enableGC && global.gc) {
      try {
        global.gc();
      } catch (e) {
        // GC not available, continue without it
      }
    }

    testMemoryBaseline = process.memoryUsage();
  });

  afterEach((context) => {
    if (!testMemoryBaseline) return;

    const current = process.memoryUsage();
    const delta: MemoryDelta = {
      heapUsed: (current.heapUsed - testMemoryBaseline.heapUsed) / 1024 / 1024,
      heapTotal: (current.heapTotal - testMemoryBaseline.heapTotal) / 1024 / 1024,
      external: (current.external - testMemoryBaseline.external) / 1024 / 1024,
      rss: (current.rss - testMemoryBaseline.rss) / 1024 / 1024,
    };

    const testName = context.task?.name || 'unknown test';

    // Store report for later analysis
    const report: TestMemoryReport = {
      testName,
      baseline: testMemoryBaseline,
      final: current,
      delta,
      timestamp: Date.now(),
    };
    memoryReports.push(report);

    // Warn if test consumed significant memory
    if (Math.abs(delta.heapUsed) > warnThresholdMB) {
      console.warn(
        `⚠️  High memory usage in test "${testName}": ${delta.heapUsed.toFixed(2)}MB heap delta`
      );
      console.warn(`   Baseline: ${(testMemoryBaseline.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.warn(`   Final: ${(current.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.warn(`   RSS delta: ${delta.rss.toFixed(2)}MB`);
    }

    // Warn if RSS increased significantly (potential native memory leak)
    if (delta.rss > warnThresholdMB * 2) {
      console.warn(
        `🔴 POTENTIAL NATIVE MEMORY LEAK in test "${testName}": RSS increased by ${delta.rss.toFixed(2)}MB`
      );
      console.warn(`   This may indicate React Flow, MapLibre GL, or GeoJSON memory accumulation`);
    }
  });
}

/**
 * Gets all memory reports collected during test execution.
 * Call this in an afterAll hook to generate a summary report.
 *
 * @returns Array of memory reports for all tests
 *
 * @example
 * ```typescript
 * afterAll(() => {
 *   const reports = getMemoryReports();
 *   console.table(reports.map(r => ({
 *     test: r.testName,
 *     heapDelta: r.delta.heapUsed.toFixed(2) + 'MB',
 *     rssDelta: r.delta.rss.toFixed(2) + 'MB',
 *   })));
 * });
 * ```
 */
export function getMemoryReports(): TestMemoryReport[] {
  return [...memoryReports];
}

/**
 * Clears all collected memory reports.
 * Useful if you want to reset between test suites.
 */
export function clearMemoryReports(): void {
  memoryReports.length = 0;
}

/**
 * Generates a summary report of all memory usage.
 *
 * @param options Report options
 * @param options.sortBy - Sort by 'heapUsed' or 'rss' (default: 'heapUsed')
 * @param options.topN - Only show top N results (default: all)
 *
 * @returns Summary report object
 */
export function generateMemorySummary(
  options: {
    sortBy?: 'heapUsed' | 'rss';
    topN?: number;
  } = {}
) {
  const { sortBy = 'heapUsed', topN } = options;

  const sorted = [...memoryReports].sort((a, b) => {
    return Math.abs(b.delta[sortBy]) - Math.abs(a.delta[sortBy]);
  });

  const results = topN ? sorted.slice(0, topN) : sorted;

  const summary = {
    totalTests: memoryReports.length,
    avgHeapDelta:
      memoryReports.reduce((sum, r) => sum + r.delta.heapUsed, 0) / memoryReports.length,
    avgRssDelta: memoryReports.reduce((sum, r) => sum + r.delta.rss, 0) / memoryReports.length,
    maxHeapDelta: Math.max(...memoryReports.map((r) => r.delta.heapUsed)),
    maxRssDelta: Math.max(...memoryReports.map((r) => r.delta.rss)),
    topTests: results.map((r) => ({
      test: r.testName,
      heapUsedMB: r.delta.heapUsed.toFixed(2),
      rssMB: r.delta.rss.toFixed(2),
      externalMB: r.delta.external.toFixed(2),
    })),
  };

  return summary;
}

/**
 * Prints a formatted memory summary to the console.
 * Call this in afterAll() to see results after all tests complete.
 *
 * @example
 * ```typescript
 * afterAll(() => {
 *   printMemorySummary({ topN: 10 });
 * });
 * ```
 */
export function printMemorySummary(
  options: {
    sortBy?: 'heapUsed' | 'rss';
    topN?: number;
  } = {}
): void {
  const summary = generateMemorySummary(options);

  console.log('\n' + '='.repeat(80));
  console.log('📊 MEMORY USAGE SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tests: ${summary.totalTests}`);
  console.log(`Avg heap delta: ${summary.avgHeapDelta.toFixed(2)}MB`);
  console.log(`Avg RSS delta: ${summary.avgRssDelta.toFixed(2)}MB`);
  console.log(`Max heap delta: ${summary.maxHeapDelta.toFixed(2)}MB`);
  console.log(`Max RSS delta: ${summary.maxRssDelta.toFixed(2)}MB`);
  console.log('\nTop memory-consuming tests:');
  console.table(summary.topTests);
  console.log('='.repeat(80) + '\n');
}

/**
 * Forces garbage collection if available.
 * Requires Node to be run with --expose-gc flag.
 *
 * @returns true if GC was run, false if not available
 */
export function forceGC(): boolean {
  if (global.gc) {
    try {
      global.gc();
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

/**
 * Gets current memory usage snapshot.
 *
 * @returns Memory usage in MB for each category
 */
export function getMemorySnapshot() {
  const mem = process.memoryUsage();
  return {
    heapUsedMB: mem.heapUsed / 1024 / 1024,
    heapTotalMB: mem.heapTotal / 1024 / 1024,
    externalMB: mem.external / 1024 / 1024,
    rssMB: mem.rss / 1024 / 1024,
  };
}
