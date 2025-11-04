import { writeFileSync } from 'fs';
import { resolve } from 'path';

import type { Reporter, File, Task } from 'vitest';

import { MemoryTracker } from './memory-tracker';

interface MemoryStats {
  file: string;
  baseline: NodeJS.MemoryUsage;
  final: NodeJS.MemoryUsage;
  delta: {
    heapUsedMB: number;
    heapTotalMB: number;
    externalMB: number;
    rssMB: number;
  };
  peakHeapMB: number;
  durationMs: number;
  testCount: number;
  passedCount: number;
  failedCount: number;
}

class MemoryReporter implements Reporter {
  private fileBaselines: Map<string, NodeJS.MemoryUsage> = new Map();
  private fileResults: Map<string, MemoryStats> = new Map();
  private startTime: number = 0;
  private memoryTracker: MemoryTracker = new MemoryTracker();

  onInit() {
    console.log('\n🔬 Memory Reporter initialized (Phase 2: Accumulation Pattern Analysis)');
    console.log('📊 Tracking memory usage per test file with interval snapshots...\n');
    this.startTime = Date.now();

    // Start memory tracking with 2-second intervals for Phase 2 analysis
    this.memoryTracker.start(2000);
  }

  onCollected(files?: File[]) {
    if (files) {
      console.log(`🧪 Collected ${files.length} test suites\n`);

      // Initialize baseline for each file
      for (const file of files) {
        // Force GC if available
        if (global.gc) {
          global.gc();
        }

        this.fileBaselines.set(file.filepath, process.memoryUsage());
      }
    }
  }

  async onFinished(files?: File[], errors?: unknown[]) {
    // Stop memory tracker and get Phase 2 analysis
    this.memoryTracker.stop();
    const memoryReport = this.memoryTracker.getReport();

    const totalDuration = Date.now() - this.startTime;

    // Process each file's results
    if (files) {
      for (const file of files) {
        const baseline = this.fileBaselines.get(file.filepath);
        if (!baseline) continue;

        const final = process.memoryUsage();

        // Count tests recursively
        const testCounts = this.countTests(file);

        const stats: MemoryStats = {
          file: file.filepath,
          baseline,
          final,
          delta: {
            heapUsedMB: (final.heapUsed - baseline.heapUsed) / 1024 / 1024,
            heapTotalMB: (final.heapTotal - baseline.heapTotal) / 1024 / 1024,
            externalMB: (final.external - baseline.external) / 1024 / 1024,
            rssMB: (final.rss - baseline.rss) / 1024 / 1024,
          },
          peakHeapMB: final.heapUsed / 1024 / 1024,
          durationMs: file.result?.duration ?? 0,
          testCount: testCounts.total,
          passedCount: testCounts.passed,
          failedCount: testCounts.failed,
        };

        this.fileResults.set(file.filepath, stats);

        // Log progress
        const heapDelta = stats.delta.heapUsedMB;
        const emoji = heapDelta > 50 ? '🔴' : heapDelta > 25 ? '🟡' : '🟢';
        console.log(
          `${emoji} ${file.name.padEnd(60)} ${heapDelta.toFixed(1).padStart(6)}MB (${stats.testCount} tests)`
        );
      }
    }

    // Generate report
    const report = Array.from(this.fileResults.values())
      .map((stats) => ({
        file: stats.file.replace(process.cwd(), '').replace(/^\//, ''),
        heapUsedMB: stats.delta.heapUsedMB,
        heapTotalMB: stats.delta.heapTotalMB,
        externalMB: stats.delta.externalMB,
        rssMB: stats.delta.rssMB,
        peakHeapMB: stats.peakHeapMB,
        durationMs: stats.durationMs,
        testCount: stats.testCount,
        passedCount: stats.passedCount,
        failedCount: stats.failedCount,
      }))
      .sort((a, b) => b.heapUsedMB - a.heapUsedMB);

    // Calculate statistics
    const totalHeapUsed = report.reduce((sum, r) => sum + r.heapUsedMB, 0);
    const avgHeapUsed = report.length > 0 ? totalHeapUsed / report.length : 0;
    const totalTests = report.reduce((sum, r) => sum + r.testCount, 0);
    const avgHeapPerTest = totalTests > 0 ? totalHeapUsed / totalTests : 0;

    // Console output
    console.log('\n\n=== 📊 Memory Usage Report ===\n');
    console.log(`Total test files: ${report.length}`);
    console.log(`Total tests: ${totalTests}`);
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Total heap delta: ${totalHeapUsed.toFixed(1)}MB`);
    console.log(`Average heap per file: ${avgHeapUsed.toFixed(1)}MB`);
    console.log(`Average heap per test: ${avgHeapPerTest.toFixed(2)}MB`);
    console.log('\n📈 Top 20 Memory Consumers:\n');

    const top20 = report.slice(0, 20).map((r) => ({
      File: r.file.length > 60 ? '...' + r.file.slice(-57) : r.file,
      'Heap (MB)': r.heapUsedMB.toFixed(1),
      'Peak (MB)': r.peakHeapMB.toFixed(1),
      'RSS (MB)': r.rssMB.toFixed(1),
      Tests: r.testCount,
      'Duration (s)': (r.durationMs / 1000).toFixed(2),
    }));

    if (top20.length > 0) {
      console.table(top20);
    }

    // Save detailed CSV report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const csvPath = resolve(process.cwd(), `/tmp/test-memory-benchmark-${timestamp}.csv`);
    const csvHeader =
      'file,heapUsedMB,heapTotalMB,externalMB,rssMB,peakHeapMB,durationMs,testCount,passedCount,failedCount\n';
    const csvRows = report
      .map(
        (r) =>
          `"${r.file}",${r.heapUsedMB.toFixed(2)},${r.heapTotalMB.toFixed(2)},${r.externalMB.toFixed(2)},${r.rssMB.toFixed(2)},${r.peakHeapMB.toFixed(2)},${r.durationMs},${r.testCount},${r.passedCount},${r.failedCount}`
      )
      .join('\n');

    writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`\n💾 Detailed report saved to: ${csvPath}\n`);

    // === PHASE 2: Accumulation Pattern Analysis ===
    console.log('\n\n=== 📈 Phase 2: Accumulation Pattern Analysis ===\n');

    // Display trend analysis
    const { trend, peaks, summary } = memoryReport;

    console.log('📊 Trend Analysis (Linear Regression on RSS Memory):');
    console.log(`   Slope: ${trend.slope > 0 ? '+' : ''}${trend.slope.toFixed(3)} MB/second`);
    console.log(`   Baseline: ${trend.baseline.toFixed(2)} MB`);
    console.log(
      `   R² (fit quality): ${trend.r2.toFixed(4)} ${trend.r2 > 0.9 ? '(excellent linear fit)' : trend.r2 > 0.7 ? '(good fit)' : '(moderate fit)'}`
    );
    console.log(
      `   Total increase: ${trend.totalIncrease.toFixed(2)} MB over ${trend.duration.toFixed(1)}s`
    );
    console.log(
      `   Accumulation rate: ${((trend.totalIncrease / trend.duration) * 60).toFixed(2)} MB/minute`
    );

    // Pattern characterization
    let pattern = 'unknown';
    if (trend.r2 > 0.8) {
      pattern = trend.slope > 0.5 ? 'steep linear accumulation' : 'gradual linear accumulation';
    } else if (peaks.length > 5) {
      pattern = 'spike-based (multiple peaks)';
    } else if (peaks.length > 0) {
      pattern = 'mixed (linear + spikes)';
    }

    console.log(`   ⚡ Pattern: ${pattern.toUpperCase()}\n`);

    // Display memory summary
    console.log('📊 Memory Summary:');
    console.log(`   Snapshots: ${summary.snapshotCount} (every 2 seconds)`);
    console.log(`   Duration: ${summary.duration.toFixed(1)}s`);
    console.log(`   Min Memory: ${summary.minMemory.toFixed(2)} MB`);
    console.log(`   Max Memory: ${summary.maxMemory.toFixed(2)} MB`);
    console.log(`   Avg Memory: ${summary.avgMemory.toFixed(2)} MB\n`);

    // Display peaks
    if (peaks.length > 0) {
      console.log(`🔺 Memory Spikes Detected (>${100}MB increase):`);
      console.table(
        peaks.slice(0, 10).map((peak) => ({
          Time: `${(peak.snapshot.timestampRelative / 1000).toFixed(1)}s`,
          'Delta (MB)': peak.deltaFromPrevious.toFixed(1),
          'RSS (MB)': peak.snapshot.rss_MB.toFixed(1),
          'Heap (MB)': peak.snapshot.heapUsed_MB.toFixed(1),
          'Test File': peak.snapshot.testFileContext || 'unknown',
        }))
      );
    } else {
      console.log('✅ No significant memory spikes detected (no increases >100MB)\n');
    }

    // Save Phase 2 analysis report
    const phase2ReportPath = resolve(
      process.cwd(),
      `/tmp/phase2-accumulation-analysis-${timestamp}.json`
    );
    writeFileSync(phase2ReportPath, JSON.stringify(memoryReport, null, 2));
    console.log(`\n💾 Phase 2 analysis saved to: ${phase2ReportPath}`);

    // Save CSV of snapshots
    const snapshotsCsvPath = resolve(process.cwd(), `/tmp/memory-snapshots-${timestamp}.csv`);
    writeFileSync(snapshotsCsvPath, this.memoryTracker.exportToCSV());
    console.log(`📊 Memory snapshots CSV saved to: ${snapshotsCsvPath}\n`);

    // Category analysis
    if (report.length > 0) {
      const categories = this.categorizeTests(report);
      console.log('📂 Category Analysis:\n');
      console.table(
        Object.entries(categories).map(([category, stats]) => ({
          Category: category,
          Files: stats.count,
          'Total Heap (MB)': stats.totalHeap.toFixed(1),
          'Avg Heap (MB)': stats.avgHeap.toFixed(1),
          Tests: stats.totalTests,
          'Avg per Test (MB)': stats.avgPerTest.toFixed(2),
        }))
      );
    }

    if (errors && errors.length > 0) {
      console.log(`\n⚠️  ${errors.length} errors encountered during test execution\n`);
    }
  }

  private countTests(task: Task): { total: number; passed: number; failed: number } {
    let total = 0;
    let passed = 0;
    let failed = 0;

    const countRecursive = (t: Task) => {
      if (t.type === 'test') {
        total += 1;
        if (t.result?.state === 'pass') passed += 1;
        if (t.result?.state === 'fail') failed += 1;
      }

      if ('tasks' in t && Array.isArray(t.tasks)) {
        for (const child of t.tasks) {
          countRecursive(child);
        }
      }
    };

    countRecursive(task);
    return { total, passed, failed };
  }

  private categorizeTests(report: Array<{ file: string; heapUsedMB: number; testCount: number }>) {
    const categories: Record<
      string,
      {
        count: number;
        totalHeap: number;
        avgHeap: number;
        totalTests: number;
        avgPerTest: number;
      }
    > = {};

    for (const item of report) {
      const category = this.getCategory(item.file);

      if (!categories[category]) {
        categories[category] = {
          count: 0,
          totalHeap: 0,
          avgHeap: 0,
          totalTests: 0,
          avgPerTest: 0,
        };
      }

      categories[category].count += 1;
      categories[category].totalHeap += item.heapUsedMB;
      categories[category].totalTests += item.testCount;
    }

    // Calculate averages
    for (const category of Object.keys(categories)) {
      const stats = categories[category];
      stats.avgHeap = stats.totalHeap / stats.count;
      stats.avgPerTest = stats.totalTests > 0 ? stats.totalHeap / stats.totalTests : 0;
    }

    return categories;
  }

  private getCategory(filePath: string): string {
    if (filePath.includes('/components/features/entity-inspector/')) return 'entity-inspector';
    if (filePath.includes('/components/features/')) return 'feature-components';
    if (filePath.includes('/components/shared/')) return 'shared-components';
    if (filePath.includes('/components/')) return 'components';
    if (filePath.includes('/hooks/')) return 'hooks';
    if (filePath.includes('/utils/')) return 'utils';
    if (filePath.includes('/pages/')) return 'pages';
    if (filePath.includes('/stores/')) return 'stores';
    if (filePath.includes('/contexts/')) return 'contexts';
    return 'other';
  }
}

export default MemoryReporter;
