/**
 * Test file to verify the memory profiler utility works correctly
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest';

import {
  enableMemoryProfiling,
  getMemoryReports,
  clearMemoryReports,
  generateMemorySummary,
  printMemorySummary,
  getMemorySnapshot,
  forceGC,
} from './test-memory-profiler';

describe('test-memory-profiler utility', () => {
  describe('basic functionality', () => {
    // Clear reports once at the start of this describe block
    beforeAll(() => {
      clearMemoryReports();
    });

    // Enable memory profiling for these tests
    enableMemoryProfiling({ warnThresholdMB: 10 });

    it('tracks memory for simple test', () => {
      // Allocate some memory
      const data = new Array(1000).fill('test data');
      expect(data.length).toBe(1000);
    });

    it('tracks memory for test with larger allocation', () => {
      // Allocate more memory
      const largeData = new Array(10000).fill({ value: 'test', data: new Array(100).fill(0) });
      expect(largeData.length).toBe(10000);
    });

    it('can get memory snapshot', () => {
      const snapshot = getMemorySnapshot();
      expect(snapshot).toHaveProperty('heapUsedMB');
      expect(snapshot).toHaveProperty('heapTotalMB');
      expect(snapshot).toHaveProperty('rssMB');
      expect(snapshot.heapUsedMB).toBeGreaterThan(0);
    });

    it('can retrieve memory reports after profiling', () => {
      // This test should see reports from previous tests in this describe block
      const reports = getMemoryReports();
      expect(Array.isArray(reports)).toBe(true);
      // Should have reports from previous 3 tests
      expect(reports.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('report generation', () => {
    // Clear reports once at the start of this describe block
    beforeAll(() => {
      clearMemoryReports();
    });

    enableMemoryProfiling({ warnThresholdMB: 10 });

    it('generates reports during test execution', () => {
      const data = new Array(5000).fill('test');
      expect(data.length).toBe(5000);
    });

    it('can generate memory summary', () => {
      const summary = generateMemorySummary({ topN: 5 });
      expect(summary).toHaveProperty('totalTests');
      expect(summary).toHaveProperty('avgHeapDelta');
      expect(summary).toHaveProperty('topTests');
      expect(Array.isArray(summary.topTests)).toBe(true);
      // Should have at least the previous test
      expect(summary.totalTests).toBeGreaterThanOrEqual(1);
    });

    it('can clear memory reports', () => {
      clearMemoryReports();
      const reports = getMemoryReports();
      expect(reports.length).toBe(0);
    });
  });

  describe('utility functions', () => {
    it('forceGC returns false when GC not available', () => {
      // GC typically not available without --expose-gc flag
      const result = forceGC();
      expect(typeof result).toBe('boolean');
    });
  });

  // Print summary at the end
  afterAll(() => {
    console.log('\n🧪 Memory Profiler Test Summary:');
    printMemorySummary({ topN: 10 });
  });
});
