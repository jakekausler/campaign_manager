/**
 * Memory Tracker for Phase 2: Accumulation Pattern Analysis
 *
 * Tracks memory usage over time with interval-based snapshots to identify:
 * - Linear accumulation patterns
 * - Memory spikes
 * - Accumulation rate (MB per test/second)
 */

export interface MemorySnapshot {
  timestamp: number;
  timestampRelative: number; // milliseconds since tracking started
  memory: NodeJS.MemoryUsage;
  rss_MB: number;
  heapUsed_MB: number;
  heapTotal_MB: number;
  external_MB: number;
  testFileContext?: string; // which test file was running at this time
}

export interface TrendAnalysis {
  slope: number; // MB per second
  baseline: number; // Initial memory in MB
  r2: number; // Coefficient of determination (0-1, 1 is perfect linear fit)
  totalIncrease: number; // Total memory increase in MB
  duration: number; // Total tracking duration in seconds
}

export interface MemoryPeak {
  snapshot: MemorySnapshot;
  deltaFromPrevious: number; // MB increase from previous snapshot
  index: number;
}

export interface MemoryReport {
  snapshots: MemorySnapshot[];
  trend: TrendAnalysis;
  peaks: MemoryPeak[];
  summary: {
    startTime: number;
    endTime: number;
    duration: number;
    snapshotCount: number;
    avgMemory: number;
    maxMemory: number;
    minMemory: number;
  };
}

export class MemoryTracker {
  private snapshots: MemorySnapshot[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private currentTestFile: string | null = null;

  /**
   * Start tracking memory at regular intervals
   * @param intervalMs Interval in milliseconds (default: 1000ms)
   */
  start(intervalMs: number = 1000): void {
    this.startTime = Date.now();

    // Take initial snapshot
    this.takeSnapshot();

    // Set up interval for periodic snapshots
    this.intervalId = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);
  }

  /**
   * Stop tracking memory
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Take final snapshot
    this.takeSnapshot();
  }

  /**
   * Set context for which test file is currently running
   */
  setCurrentTestFile(filePath: string): void {
    this.currentTestFile = filePath;
  }

  /**
   * Clear current test file context
   */
  clearCurrentTestFile(): void {
    this.currentTestFile = null;
  }

  /**
   * Take a memory snapshot
   */
  private takeSnapshot(): void {
    const memory = process.memoryUsage();
    const timestamp = Date.now();

    this.snapshots.push({
      timestamp,
      timestampRelative: timestamp - this.startTime,
      memory,
      rss_MB: memory.rss / 1024 / 1024,
      heapUsed_MB: memory.heapUsed / 1024 / 1024,
      heapTotal_MB: memory.heapTotal / 1024 / 1024,
      external_MB: memory.external / 1024 / 1024,
      testFileContext: this.currentTestFile || undefined,
    });
  }

  /**
   * Get complete memory report with trend analysis and peak detection
   */
  getReport(): MemoryReport {
    return {
      snapshots: this.snapshots,
      trend: this.calculateTrend(),
      peaks: this.findPeaks(),
      summary: this.calculateSummary(),
    };
  }

  /**
   * Calculate trend using linear regression on RSS memory
   */
  private calculateTrend(): TrendAnalysis {
    if (this.snapshots.length < 2) {
      return {
        slope: 0,
        baseline: 0,
        r2: 0,
        totalIncrease: 0,
        duration: 0,
      };
    }

    // Use time in seconds as x, RSS memory in MB as y
    const x = this.snapshots.map((s) => s.timestampRelative / 1000); // seconds
    const y = this.snapshots.map((s) => s.rss_MB);

    // Calculate linear regression: y = slope * x + baseline
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const baseline = (sumY - slope * sumX) / n;

    // Calculate R² (coefficient of determination)
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssResidual = y.reduce(
      (sum, val, i) => sum + Math.pow(val - (slope * x[i] + baseline), 2),
      0
    );
    const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    const duration = (this.snapshots[n - 1].timestamp - this.snapshots[0].timestamp) / 1000;
    const totalIncrease = y[n - 1] - y[0];

    return {
      slope, // MB per second
      baseline,
      r2,
      totalIncrease,
      duration,
    };
  }

  /**
   * Find significant memory spikes (>100MB increase from previous snapshot)
   */
  private findPeaks(thresholdMB: number = 100): MemoryPeak[] {
    if (this.snapshots.length < 2) {
      return [];
    }

    const peaks: MemoryPeak[] = [];

    for (let i = 1; i < this.snapshots.length; i++) {
      const delta = this.snapshots[i].rss_MB - this.snapshots[i - 1].rss_MB;

      if (delta > thresholdMB) {
        peaks.push({
          snapshot: this.snapshots[i],
          deltaFromPrevious: delta,
          index: i,
        });
      }
    }

    return peaks;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary() {
    if (this.snapshots.length === 0) {
      return {
        startTime: 0,
        endTime: 0,
        duration: 0,
        snapshotCount: 0,
        avgMemory: 0,
        maxMemory: 0,
        minMemory: 0,
      };
    }

    const rssValues = this.snapshots.map((s) => s.rss_MB);
    const startTime = this.snapshots[0].timestamp;
    const endTime = this.snapshots[this.snapshots.length - 1].timestamp;

    return {
      startTime,
      endTime,
      duration: (endTime - startTime) / 1000, // seconds
      snapshotCount: this.snapshots.length,
      avgMemory: rssValues.reduce((sum, val) => sum + val, 0) / rssValues.length,
      maxMemory: Math.max(...rssValues),
      minMemory: Math.min(...rssValues),
    };
  }

  /**
   * Export snapshots to CSV format
   */
  exportToCSV(): string {
    const header =
      'timestamp,timestampRelative_s,rss_MB,heapUsed_MB,heapTotal_MB,external_MB,testFile\n';
    const rows = this.snapshots
      .map(
        (s) =>
          `${s.timestamp},${(s.timestampRelative / 1000).toFixed(2)},${s.rss_MB.toFixed(2)},${s.heapUsed_MB.toFixed(2)},${s.heapTotal_MB.toFixed(2)},${s.external_MB.toFixed(2)},${s.testFileContext || ''}`
      )
      .join('\n');

    return header + rows;
  }

  /**
   * Export report to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.getReport(), null, 2);
  }
}
