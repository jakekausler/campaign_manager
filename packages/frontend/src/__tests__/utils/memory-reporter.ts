import { writeFileSync } from 'fs';
import { resolve } from 'path';

import type { Reporter, File, Task } from 'vitest';

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
  private intervalId: NodeJS.Timeout | null = null;
  private memorySnapshots: Array<{
    timestamp: number;
    memory: NodeJS.MemoryUsage;
  }> = [];

  onInit() {
    console.log('\n🔬 Memory Reporter initialized');
    console.log('📊 Tracking memory usage per test file...\n');
    this.startTime = Date.now();

    // Take memory snapshots every 2 seconds during test execution
    this.intervalId = setInterval(() => {
      this.memorySnapshots.push({
        timestamp: Date.now(),
        memory: process.memoryUsage(),
      });
    }, 2000);
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
    // Stop snapshot collection
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

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

    // Save memory snapshots for accumulation analysis
    const snapshotsPath = resolve(process.cwd(), `/tmp/memory-snapshots-${timestamp}.json`);
    writeFileSync(
      snapshotsPath,
      JSON.stringify(
        {
          startTime: this.startTime,
          endTime: Date.now(),
          snapshots: this.memorySnapshots.map((s) => ({
            timestamp: s.timestamp,
            heapUsedMB: s.memory.heapUsed / 1024 / 1024,
            heapTotalMB: s.memory.heapTotal / 1024 / 1024,
            externalMB: s.memory.external / 1024 / 1024,
            rssMB: s.memory.rss / 1024 / 1024,
          })),
        },
        null,
        2
      )
    );
    console.log(`📸 Memory snapshots saved to: ${snapshotsPath}\n`);

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
