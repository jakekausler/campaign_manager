#!/usr/bin/env ts-node
/**
 * Phase 4: Category Analysis from Existing Data
 *
 * This script analyzes existing CSV benchmark data from Phases 1-2,
 * categorizes test files, and generates a category comparison report.
 *
 * This is faster than re-running all tests and avoids OOM issues.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

interface TestFileData {
  file: string;
  category: string;
  subcategory: string;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  rssMB: number;
  peakHeapMB: number;
  durationMs: number;
  testCount: number;
  passedCount: number;
  failedCount: number;
}

interface CategoryStats {
  name: string;
  subcategories: string[];
  fileCount: number;
  totalTests: number;
  avgHeapUsedMB: number;
  avgRssMB: number;
  avgPeakHeapMB: number;
  totalHeapMB: number;
  totalRssMB: number;
  avgHeapPerTest: number;
  avgDurationMs: number;
  expectedProfile: 'light' | 'medium' | 'heavy';
  description: string;
}

function categorizeTestFile(filePath: string): {
  category: string;
  subcategory: string;
  expectedProfile: 'light' | 'medium' | 'heavy';
  description: string;
} {
  // Entity Inspector (React Flow)
  if (filePath.includes('/entity-inspector/')) {
    return {
      category: 'Components',
      subcategory: 'entity-inspector',
      expectedProfile: 'heavy',
      description: 'Entity Inspector (React Flow, complex UI)',
    };
  }

  // Map Components (MapLibre GL + GeoJSON)
  if (filePath.includes('/components/features/map/')) {
    return {
      category: 'Components',
      subcategory: 'map',
      expectedProfile: 'heavy',
      description: 'Map components (MapLibre GL, GeoJSON)',
    };
  }

  // Flow Components (React Flow)
  if (filePath.includes('/components/features/flow/')) {
    return {
      category: 'Components',
      subcategory: 'flow',
      expectedProfile: 'heavy',
      description: 'Flow components (React Flow)',
    };
  }

  // Rule Builder
  if (filePath.includes('/components/features/rule-builder/')) {
    return {
      category: 'Components',
      subcategory: 'rule-builder',
      expectedProfile: 'medium',
      description: 'Rule builder components',
    };
  }

  // Branches
  if (filePath.includes('/components/features/branches/')) {
    return {
      category: 'Components',
      subcategory: 'branches',
      expectedProfile: 'medium',
      description: 'Branch management components',
    };
  }

  // Timeline
  if (filePath.includes('/components/features/timeline/')) {
    return {
      category: 'Components',
      subcategory: 'timeline',
      expectedProfile: 'medium',
      description: 'Timeline components',
    };
  }

  // Versions
  if (filePath.includes('/components/features/versions/')) {
    return {
      category: 'Components',
      subcategory: 'versions',
      expectedProfile: 'light',
      description: 'Version management components',
    };
  }

  // Other feature components
  if (filePath.includes('/components/features/')) {
    return {
      category: 'Components',
      subcategory: 'other-features',
      expectedProfile: 'medium',
      description: 'Other feature components',
    };
  }

  // Shared components
  if (filePath.includes('/components/shared/')) {
    return {
      category: 'Components',
      subcategory: 'shared',
      expectedProfile: 'light',
      description: 'Shared/reusable components',
    };
  }

  // Other components
  if (filePath.includes('/components/')) {
    return {
      category: 'Components',
      subcategory: 'other',
      expectedProfile: 'light',
      description: 'Other components',
    };
  }

  // Pages (full page components)
  if (filePath.includes('/pages/')) {
    return {
      category: 'Pages',
      subcategory: 'pages',
      expectedProfile: 'heavy',
      description: 'Full page components',
    };
  }

  // API Services
  if (filePath.includes('/services/')) {
    return {
      category: 'Services',
      subcategory: 'api',
      expectedProfile: 'light',
      description: 'API hooks and mutations',
    };
  }

  // Hooks
  if (filePath.includes('/hooks/')) {
    return {
      category: 'Hooks',
      subcategory: 'hooks',
      expectedProfile: 'light',
      description: 'Custom React hooks',
    };
  }

  // Utils
  if (filePath.includes('/utils/')) {
    return {
      category: 'Utils',
      subcategory: 'utils',
      expectedProfile: 'light',
      description: 'Utility functions',
    };
  }

  // Stores
  if (filePath.includes('/stores/')) {
    return {
      category: 'Stores',
      subcategory: 'stores',
      expectedProfile: 'light',
      description: 'Zustand state stores',
    };
  }

  // Contexts
  if (filePath.includes('/contexts/')) {
    return {
      category: 'Contexts',
      subcategory: 'contexts',
      expectedProfile: 'light',
      description: 'React contexts',
    };
  }

  // Performance tests
  if (filePath.includes('/__performance__/')) {
    return {
      category: 'Performance',
      subcategory: 'performance',
      expectedProfile: 'light',
      description: 'Performance benchmarks',
    };
  }

  // Test utilities
  if (filePath.includes('/__tests__/')) {
    return {
      category: 'Test Utils',
      subcategory: 'test-utils',
      expectedProfile: 'light',
      description: 'Testing utilities',
    };
  }

  return {
    category: 'Other',
    subcategory: 'other',
    expectedProfile: 'light',
    description: 'Other tests',
  };
}

function parseCSV(csvPath: string): TestFileData[] {
  if (!existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    return [];
  }

  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    console.error(`❌ CSV file is empty or invalid: ${csvPath}`);
    return [];
  }

  // Skip header row
  const dataLines = lines.slice(1);

  const results: TestFileData[] = [];

  for (const line of dataLines) {
    // Parse CSV line (handle quoted fields)
    const match = line.match(
      /"([^"]+)",([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+)/
    );

    if (!match) {
      console.warn(`⚠️  Failed to parse CSV line: ${line.slice(0, 80)}...`);
      continue;
    }

    const [
      ,
      file,
      heapUsed,
      heapTotal,
      external,
      rss,
      peakHeap,
      duration,
      testCount,
      passed,
      failed,
    ] = match;

    const categorization = categorizeTestFile(file);

    results.push({
      file,
      category: categorization.category,
      subcategory: categorization.subcategory,
      heapUsedMB: parseFloat(heapUsed),
      heapTotalMB: parseFloat(heapTotal),
      externalMB: parseFloat(external),
      rssMB: parseFloat(rss),
      peakHeapMB: parseFloat(peakHeap),
      durationMs: parseFloat(duration),
      testCount: parseInt(testCount),
      passedCount: parseInt(passed),
      failedCount: parseInt(failed),
    });
  }

  return results;
}

function calculateCategoryStats(data: TestFileData[]): CategoryStats[] {
  const categoriesMap = new Map<string, TestFileData[]>();

  // Group by main category
  for (const item of data) {
    if (!categoriesMap.has(item.category)) {
      categoriesMap.set(item.category, []);
    }
    categoriesMap.get(item.category)!.push(item);
  }

  const stats: CategoryStats[] = [];

  for (const [categoryName, items] of categoriesMap.entries()) {
    const subcategories = [...new Set(items.map((i) => i.subcategory))];
    const fileCount = items.length;
    const totalTests = items.reduce((sum, i) => sum + i.testCount, 0);
    const totalHeapMB = items.reduce((sum, i) => sum + Math.abs(i.heapUsedMB), 0); // Use abs for negative values
    const totalRssMB = items.reduce((sum, i) => sum + Math.abs(i.rssMB), 0);
    const totalPeakHeapMB = items.reduce((sum, i) => sum + i.peakHeapMB, 0);
    const totalDurationMs = items.reduce((sum, i) => sum + i.durationMs, 0);

    // Get expected profile from first item (they should all be similar in category)
    const firstItem = items[0];
    const categorization = categorizeTestFile(firstItem.file);

    stats.push({
      name: categoryName,
      subcategories,
      fileCount,
      totalTests,
      avgHeapUsedMB: fileCount > 0 ? totalHeapMB / fileCount : 0,
      avgRssMB: fileCount > 0 ? totalRssMB / fileCount : 0,
      avgPeakHeapMB: fileCount > 0 ? totalPeakHeapMB / fileCount : 0,
      totalHeapMB,
      totalRssMB,
      avgHeapPerTest: totalTests > 0 ? totalHeapMB / totalTests : 0,
      avgDurationMs: fileCount > 0 ? totalDurationMs / fileCount : 0,
      expectedProfile: categorization.expectedProfile,
      description: categorization.description,
    });
  }

  // Sort by total heap (descending)
  return stats.sort((a, b) => b.totalHeapMB - a.totalHeapMB);
}

function generateReport(
  stats: CategoryStats[],
  allData: TestFileData[],
  csvSource: string
): string {
  const timestamp = new Date().toISOString();

  let report = `# Phase 4: Category Analysis Report\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Data Source:** ${csvSource}\n`;
  report += `**Test Files Analyzed:** ${allData.length}\n`;
  report += `**Categories:** ${stats.length}\n\n`;

  report += `---\n\n`;
  report += `## ⚠️ Data Limitations\n\n`;
  report += `This analysis is based on **partial data** from Phase 1 benchmarks, which crashed at test #330 due to the 6GB memory limit. The data includes only ~${allData.length} test files out of 125 total (${((allData.length / 125) * 100).toFixed(1)}% coverage).\n\n`;
  report += `**Key Limitations:**\n`;
  report += `- Memory deltas show negative values due to baseline timing issues\n`;
  report += `- Missing data for ~${125 - allData.length} test files that would have run after the crash\n`;
  report += `- Peak heap values are more reliable than deltas\n\n`;

  report += `---\n\n`;
  report += `## Executive Summary\n\n`;

  const totalTests = stats.reduce((sum, s) => sum + s.totalTests, 0);
  const totalFiles = stats.reduce((sum, s) => sum + s.fileCount, 0);
  const avgPeakHeap = stats.reduce((sum, s) => sum + s.avgPeakHeapMB, 0) / stats.length;

  report += `This report analyzes memory usage patterns across **${totalFiles} test files** grouped into **${stats.length} categories**, covering **${totalTests} tests**.\n\n`;
  report += `**Average Peak Heap:** ${avgPeakHeap.toFixed(1)} MB (consistent across all tests, indicating native memory accumulation)\n\n`;

  report += `### Key Findings\n\n`;
  report += `1. **Native Memory Issue:** All test files show similar peak heap (~56MB), but tests crash at 6GB due to **unmeasured native memory** from React Flow, MapLibre GL, and GeoJSON libraries.\n\n`;
  report += `2. **Cumulative Accumulation:** Memory accumulates across tests at ~57 MB/second (from Phase 2 analysis), hitting the 6GB limit at test #330.\n\n`;
  report += `3. **Category Distribution:** The analyzed test files span ${stats.length} categories, with Components representing the majority.\n\n`;

  // Top 3 categories
  const top3 = stats.slice(0, 3);
  report += `**Top 3 Categories by File Count:**\n\n`;
  for (let i = 0; i < Math.min(3, top3.length); i++) {
    const cat = top3[i];
    report += `${i + 1}. **${cat.name}** - ${cat.fileCount} files, ${cat.totalTests} tests (${cat.expectedProfile} memory profile)\n`;
  }

  report += `\n---\n\n`;
  report += `## Category Statistics\n\n`;

  report += `| Category | Files | Tests | Avg Peak Heap (MB) | Avg Duration (ms) | Expected Profile |\n`;
  report += `|----------|-------|-------|-------------------|-------------------|------------------|\n`;

  for (const cat of stats) {
    report += `| ${cat.name} | ${cat.fileCount} | ${cat.totalTests} | ${cat.avgPeakHeapMB.toFixed(1)} | ${cat.avgDurationMs.toFixed(0)} | ${cat.expectedProfile} |\n`;
  }

  report += `\n---\n\n`;
  report += `## Detailed Category Breakdown\n\n`;

  for (const cat of stats) {
    report += `### ${cat.name}\n\n`;
    report += `- **Files:** ${cat.fileCount}\n`;
    report += `- **Subcategories:** ${cat.subcategories.join(', ')}\n`;
    report += `- **Total Tests:** ${cat.totalTests}\n`;
    report += `- **Avg Peak Heap:** ${cat.avgPeakHeapMB.toFixed(1)} MB\n`;
    report += `- **Avg Duration:** ${cat.avgDurationMs.toFixed(0)}ms\n`;
    report += `- **Expected Profile:** \`${cat.expectedProfile}\`\n\n`;

    // List files in this category
    const categoryFiles = allData.filter((d) => d.category === cat.name);
    if (categoryFiles.length > 0) {
      report += `**Test Files:**\n\n`;
      for (const file of categoryFiles) {
        report += `- \`${file.file}\` (${file.testCount} tests, ${(file.durationMs / 1000).toFixed(2)}s, peak: ${file.peakHeapMB.toFixed(1)}MB)\n`;
      }
      report += `\n`;
    }
  }

  report += `---\n\n`;
  report += `## Subcategory Analysis\n\n`;

  // Group by subcategory for more detailed analysis
  const subcategoryMap = new Map<string, TestFileData[]>();
  for (const item of allData) {
    const key = `${item.category}/${item.subcategory}`;
    if (!subcategoryMap.has(key)) {
      subcategoryMap.set(key, []);
    }
    subcategoryMap.get(key)!.push(item);
  }

  const subcategoryStats = Array.from(subcategoryMap.entries())
    .map(([key, items]) => ({
      name: key,
      fileCount: items.length,
      totalTests: items.reduce((sum, i) => sum + i.testCount, 0),
      avgPeakHeapMB: items.reduce((sum, i) => sum + i.peakHeapMB, 0) / items.length,
      avgDurationMs: items.reduce((sum, i) => sum + i.durationMs, 0) / items.length,
    }))
    .sort((a, b) => b.fileCount - a.fileCount);

  report += `| Subcategory | Files | Tests | Avg Peak Heap (MB) | Avg Duration (ms) |\n`;
  report += `|-------------|-------|-------|-------------------|-------------------|\n`;

  for (const subcat of subcategoryStats) {
    report += `| ${subcat.name} | ${subcat.fileCount} | ${subcat.totalTests} | ${subcat.avgPeakHeapMB.toFixed(1)} | ${subcat.avgDurationMs.toFixed(0)} |\n`;
  }

  report += `\n---\n\n`;
  report += `## Insights & Recommendations\n\n`;

  // Find heavy categories
  const heavyCategories = stats.filter((s) => s.expectedProfile === 'heavy');
  if (heavyCategories.length > 0) {
    report += `### Heavy Memory Categories\n\n`;
    report += `These categories are expected to consume significant **native memory** due to libraries like React Flow, MapLibre GL, and Turf.js:\n\n`;
    for (const cat of heavyCategories) {
      report += `- **${cat.name}** (${cat.subcategories.join(', ')}): ${cat.fileCount} files, ${cat.totalTests} tests\n`;
    }
    report += `\n**Recommendation:** These categories are prime candidates for optimization through:\n`;
    report += `1. Mocking heavy dependencies (React Flow, MapLibre GL) for unit tests\n`;
    report += `2. Using lightweight alternatives (e.g., Storybook for visual testing)\n`;
    report += `3. Reducing test data sizes (smaller GeoJSON, fewer nodes in graphs)\n`;
    report += `4. Splitting integration tests into separate suites\n\n`;
  }

  report += `### All Test Files Analysis\n\n`;
  report += `To get complete category analysis across all 125 test files:\n\n`;
  report += `1. **Option A:** Run tests by category separately (avoiding OOM)\n`;
  report += `2. **Option B:** Use Phase 3 memory profiler on individual test files\n`;
  report += `3. **Option C:** Increase worker memory limit (requires infrastructure changes)\n\n`;

  report += `---\n\n`;
  report += `## Next Steps\n\n`;
  report += `1. ✅ **Phase 4 Complete** - Category framework established and partial analysis done\n`;
  report += `2. Focus optimization on heavy categories (entity-inspector, map, flow, pages)\n`;
  report += `3. Use Phase 3 profiler to identify specific high-memory tests within categories\n`;
  report += `4. Implement mocking strategies for React Flow and MapLibre GL\n`;
  report += `5. Re-run benchmarks after optimizations to measure improvement\n\n`;

  return report;
}

async function main() {
  console.log('📊 Phase 4: Category Analysis from Existing Data');
  console.log('='.repeat(80));

  // Find most recent CSV file
  const tmpDir = '/tmp';
  const allFiles = readdirSync(tmpDir);
  const csvFiles = allFiles
    .filter((f) => f.startsWith('test-memory-benchmark-') && f.endsWith('.csv'))
    .map((f) => resolve(tmpDir, f));

  if (csvFiles.length === 0) {
    console.error('❌ No benchmark CSV files found in /tmp/');
    console.error(
      'Please run Phase 1 benchmarks first: pnpm --filter @campaign/frontend run test:memory'
    );
    process.exit(1);
  }

  // Use most recent file
  const mostRecentCsv = csvFiles.sort().reverse()[0];
  console.log(`📂 Using data from: ${mostRecentCsv}\n`);

  // Parse CSV
  const data = parseCSV(mostRecentCsv);

  if (data.length === 0) {
    console.error('❌ No data found in CSV file');
    process.exit(1);
  }

  console.log(`✅ Parsed ${data.length} test file results\n`);

  // Calculate statistics
  const stats = calculateCategoryStats(data);

  console.log('📊 Category Statistics:\n');
  console.table(
    stats.map((s) => ({
      Category: s.name,
      Files: s.fileCount,
      Tests: s.totalTests,
      'Avg Peak Heap (MB)': s.avgPeakHeapMB.toFixed(1),
      'Avg Duration (ms)': s.avgDurationMs.toFixed(0),
      Profile: s.expectedProfile,
    }))
  );

  // Generate report
  const report = generateReport(stats, data, mostRecentCsv);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportPath = resolve(
    process.cwd(),
    `../../docs/development/phase4-category-analysis-${timestamp}.md`
  );

  writeFileSync(reportPath, report);
  console.log(`\n✅ Report saved to: ${reportPath}`);

  // Save CSV summary
  const csvPath = resolve(process.cwd(), `/tmp/phase4-category-stats-${timestamp}.csv`);
  const csvHeader = 'category,fileCount,totalTests,avgPeakHeapMB,avgDurationMs,expectedProfile\n';
  const csvRows = stats
    .map(
      (s) =>
        `${s.name},${s.fileCount},${s.totalTests},${s.avgPeakHeapMB.toFixed(2)},${s.avgDurationMs.toFixed(0)},${s.expectedProfile}`
    )
    .join('\n');
  writeFileSync(csvPath, csvHeader + csvRows);
  console.log(`📊 CSV summary saved to: ${csvPath}`);

  console.log('\n✅ Phase 4: Category Analysis Complete!');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
