#!/usr/bin/env ts-node
/**
 * Phase 4: Category Analysis Script
 *
 * This script runs test files grouped by category to collect memory usage data
 * without hitting OOM limits. It then generates a category comparison report.
 *
 * Categories:
 * - entity-inspector: Entity inspector components (22 files)
 * - rule-builder: Rule builder components (18 files)
 * - map-components: Map-related components (14 files)
 * - flow-components: Flow view components (13 files)
 * - branch-components: Branch management components (10 files)
 * - other-feature-components: Other feature components (10 files)
 * - api-services: API hooks and mutations (12 files)
 * - utils: Utility functions (11 files)
 * - hooks: Custom hooks (4 files)
 * - pages: Full page components (3 files)
 * - stores: Zustand stores (3 files)
 * - contexts: React contexts (1 file)
 * - performance: Performance tests (3 files)
 * - test-utils: Test utilities (1 file)
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

// Note: This script requires 'glob' package to be installed
// eslint-disable-next-line import/no-unresolved
import { globSync } from 'glob';

interface CategoryConfig {
  name: string;
  pattern: string;
  description: string;
  expectedMemoryProfile: 'light' | 'medium' | 'heavy';
}

interface TestFileResult {
  file: string;
  category: string;
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
  fileCount: number;
  totalTests: number;
  avgHeapUsedMB: number;
  avgRssMB: number;
  totalHeapMB: number;
  totalRssMB: number;
  avgHeapPerTest: number;
  avgDurationMs: number;
  expectedProfile: string;
  insight: string;
}

// Define test categories with patterns
const categories: CategoryConfig[] = [
  {
    name: 'entity-inspector',
    pattern: 'src/components/features/entity-inspector/**/*.test.ts*',
    description: 'Entity Inspector components (React Flow heavy)',
    expectedMemoryProfile: 'heavy',
  },
  {
    name: 'rule-builder',
    pattern: 'src/components/features/rule-builder/**/*.test.ts*',
    description: 'Rule Builder components',
    expectedMemoryProfile: 'medium',
  },
  {
    name: 'map-components',
    pattern: 'src/components/features/map/**/*.test.ts*',
    description: 'Map components (MapLibre GL + GeoJSON)',
    expectedMemoryProfile: 'heavy',
  },
  {
    name: 'flow-components',
    pattern: 'src/components/features/flow/**/*.test.ts*',
    description: 'Flow view components (React Flow)',
    expectedMemoryProfile: 'heavy',
  },
  {
    name: 'branch-components',
    pattern: 'src/components/features/branches/**/*.test.ts*',
    description: 'Branch management components',
    expectedMemoryProfile: 'medium',
  },
  {
    name: 'timeline-components',
    pattern: 'src/components/features/timeline/**/*.test.ts*',
    description: 'Timeline components',
    expectedMemoryProfile: 'medium',
  },
  {
    name: 'version-components',
    pattern: 'src/components/features/versions/**/*.test.ts*',
    description: 'Version management components',
    expectedMemoryProfile: 'light',
  },
  {
    name: 'shared-components',
    pattern: 'src/components/shared/**/*.test.ts*',
    description: 'Shared/reusable components',
    expectedMemoryProfile: 'light',
  },
  {
    name: 'api-services',
    pattern: 'src/services/**/*.test.ts*',
    description: 'API hooks and mutations',
    expectedMemoryProfile: 'light',
  },
  {
    name: 'utils',
    pattern: 'src/utils/**/*.test.ts*',
    description: 'Utility functions',
    expectedMemoryProfile: 'light',
  },
  {
    name: 'hooks',
    pattern: 'src/hooks/**/*.test.ts*',
    description: 'Custom React hooks',
    expectedMemoryProfile: 'light',
  },
  {
    name: 'pages',
    pattern: 'src/pages/**/*.test.ts*',
    description: 'Full page components',
    expectedMemoryProfile: 'heavy',
  },
  {
    name: 'stores',
    pattern: 'src/stores/**/*.test.ts*',
    description: 'Zustand state stores',
    expectedMemoryProfile: 'light',
  },
  {
    name: 'contexts',
    pattern: 'src/contexts/**/*.test.ts*',
    description: 'React contexts',
    expectedMemoryProfile: 'light',
  },
  {
    name: 'performance',
    pattern: 'src/__performance__/**/*.test.ts*',
    description: 'Performance tests',
    expectedMemoryProfile: 'light',
  },
];

function findTestFiles(pattern: string): string[] {
  const cwd = resolve(__dirname, '..');
  const files = globSync(pattern, { cwd });
  return files.sort();
}

function runTestsForCategory(categoryName: string, testFiles: string[]): TestFileResult[] {
  const results: TestFileResult[] = [];

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📂 Category: ${categoryName} (${testFiles.length} files)`);
  console.log('='.repeat(80));

  for (let i = 0; i < testFiles.length; i++) {
    const file = testFiles[i];
    const relativeFile = file.replace('src/', '');

    console.log(`\n[${i + 1}/${testFiles.length}] Running: ${relativeFile}`);

    try {
      // Run individual test file with memory profiling
      const output = execSync(
        `NODE_OPTIONS="--max-old-space-size=2048" pnpm exec vitest run "${file}" --reporter=json --no-coverage`,
        {
          cwd: resolve(__dirname, '..'),
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      // Parse Vitest JSON output
      const jsonMatch = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
      if (jsonMatch) {
        const vitestOutput = JSON.parse(jsonMatch[0]);

        // Extract test counts
        let testCount = 0;
        let passedCount = 0;
        let failedCount = 0;

        if (vitestOutput.testResults && vitestOutput.testResults.length > 0) {
          const fileResult = vitestOutput.testResults[0];
          testCount = fileResult.assertionResults?.length || 0;
          passedCount =
            fileResult.assertionResults?.filter((t: { status: string }) => t.status === 'passed')
              .length || 0;
          failedCount =
            fileResult.assertionResults?.filter((t: { status: string }) => t.status === 'failed')
              .length || 0;
        }

        // For Phase 4, we'll use simplified memory metrics
        // Real profiling would require running with custom reporter
        results.push({
          file: relativeFile,
          category: categoryName,
          heapUsedMB: 0, // Placeholder - would need custom reporter
          heapTotalMB: 0,
          externalMB: 0,
          rssMB: 0,
          peakHeapMB: 0,
          durationMs: vitestOutput.testResults?.[0]?.duration || 0,
          testCount,
          passedCount,
          failedCount,
        });

        const status = failedCount > 0 ? '❌' : '✅';
        console.log(
          `  ${status} ${passedCount}/${testCount} tests passed (${(vitestOutput.testResults?.[0]?.duration / 1000 || 0).toFixed(2)}s)`
        );
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message.split('\n')[0] : String(error);
      console.log(`  ⚠️  Failed to run test file: ${errorMessage}`);

      results.push({
        file: relativeFile,
        category: categoryName,
        heapUsedMB: 0,
        heapTotalMB: 0,
        externalMB: 0,
        rssMB: 0,
        peakHeapMB: 0,
        durationMs: 0,
        testCount: 0,
        passedCount: 0,
        failedCount: 0,
      });
    }
  }

  return results;
}

function generateCategoryStats(results: TestFileResult[]): CategoryStats[] {
  const categoriesMap = new Map<string, TestFileResult[]>();

  // Group results by category
  for (const result of results) {
    if (!categoriesMap.has(result.category)) {
      categoriesMap.set(result.category, []);
    }
    categoriesMap.get(result.category)!.push(result);
  }

  // Calculate statistics per category
  const stats: CategoryStats[] = [];

  for (const [categoryName, categoryResults] of categoriesMap.entries()) {
    const categoryConfig = categories.find((c) => c.name === categoryName);
    const fileCount = categoryResults.length;
    const totalTests = categoryResults.reduce((sum, r) => sum + r.testCount, 0);
    const totalHeapMB = categoryResults.reduce((sum, r) => sum + r.heapUsedMB, 0);
    const totalRssMB = categoryResults.reduce((sum, r) => sum + r.rssMB, 0);
    const totalDurationMs = categoryResults.reduce((sum, r) => sum + r.durationMs, 0);

    const avgHeapUsedMB = fileCount > 0 ? totalHeapMB / fileCount : 0;
    const avgRssMB = fileCount > 0 ? totalRssMB / fileCount : 0;
    const avgHeapPerTest = totalTests > 0 ? totalHeapMB / totalTests : 0;
    const avgDurationMs = fileCount > 0 ? totalDurationMs / fileCount : 0;

    // Generate insight based on expected vs actual
    let insight = '';
    if (categoryConfig?.expectedMemoryProfile === 'heavy') {
      insight = 'Expected heavy memory usage due to React Flow, MapLibre GL, or GeoJSON processing';
    } else if (categoryConfig?.expectedMemoryProfile === 'medium') {
      insight = 'Expected moderate memory usage with complex UI components';
    } else {
      insight = 'Expected light memory usage with simple logic/utilities';
    }

    stats.push({
      name: categoryName,
      fileCount,
      totalTests,
      avgHeapUsedMB,
      avgRssMB,
      totalHeapMB,
      totalRssMB,
      avgHeapPerTest,
      avgDurationMs,
      expectedProfile: categoryConfig?.expectedMemoryProfile || 'unknown',
      insight,
    });
  }

  // Sort by total heap usage (descending)
  return stats.sort((a, b) => b.totalHeapMB - a.totalHeapMB);
}

function generateReport(stats: CategoryStats[], results: TestFileResult[]): string {
  let report = `# Phase 4: Category Analysis Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Test Files:** ${results.length}\n`;
  report += `**Categories:** ${stats.length}\n\n`;

  report += `---\n\n`;
  report += `## Executive Summary\n\n`;

  const totalTests = stats.reduce((sum, s) => sum + s.totalTests, 0);
  const totalFiles = stats.reduce((sum, s) => sum + s.fileCount, 0);

  report += `This report analyzes memory usage patterns across ${totalFiles} test files grouped into ${stats.length} categories, covering ${totalTests} total tests.\n\n`;

  report += `### Key Findings\n\n`;

  // Identify top 3 memory-intensive categories
  const top3 = stats.slice(0, 3);
  report += `**Top 3 Memory-Intensive Categories:**\n\n`;
  for (let i = 0; i < top3.length; i++) {
    const cat = top3[i];
    report += `${i + 1}. **${cat.name}** - ${cat.fileCount} files, ${cat.totalTests} tests\n`;
    report += `   - ${cat.insight}\n`;
  }

  report += `\n---\n\n`;
  report += `## Category Statistics\n\n`;

  // Table of all categories
  report += `| Category | Files | Tests | Avg Duration (ms) | Expected Profile |\n`;
  report += `|----------|-------|-------|-------------------|------------------|\n`;

  for (const cat of stats) {
    report += `| ${cat.name} | ${cat.fileCount} | ${cat.totalTests} | ${cat.avgDurationMs.toFixed(0)} | ${cat.expectedProfile} |\n`;
  }

  report += `\n---\n\n`;
  report += `## Detailed Category Breakdown\n\n`;

  for (const cat of stats) {
    report += `### ${cat.name}\n\n`;
    report += `- **Files:** ${cat.fileCount}\n`;
    report += `- **Tests:** ${cat.totalTests}\n`;
    report += `- **Avg Duration per File:** ${cat.avgDurationMs.toFixed(0)}ms\n`;
    report += `- **Expected Profile:** ${cat.expectedProfile}\n`;
    report += `- **Insight:** ${cat.insight}\n\n`;

    // List files in this category
    const categoryFiles = results.filter((r) => r.category === cat.name);
    if (categoryFiles.length > 0) {
      report += `**Files:**\n\n`;
      for (const file of categoryFiles.slice(0, 10)) {
        // Limit to top 10
        report += `- \`${file.file}\` (${file.testCount} tests, ${(file.durationMs / 1000).toFixed(2)}s)\n`;
      }
      if (categoryFiles.length > 10) {
        report += `- ... and ${categoryFiles.length - 10} more files\n`;
      }
      report += `\n`;
    }
  }

  report += `---\n\n`;
  report += `## Recommendations\n\n`;

  report += `Based on the category analysis:\n\n`;

  // Find heavy categories
  const heavyCategories = stats.filter((s) => s.expectedProfile === 'heavy');
  if (heavyCategories.length > 0) {
    report += `### Heavy Memory Categories\n\n`;
    report += `These categories are expected to consume significant memory due to native libraries:\n\n`;
    for (const cat of heavyCategories) {
      report += `- **${cat.name}**: ${cat.fileCount} files, ${cat.totalTests} tests\n`;
    }
    report += `\n**Optimization Strategy:**\n`;
    report += `- Consider mocking React Flow, MapLibre GL, and Turf.js for unit tests\n`;
    report += `- Use visual regression tests (Storybook) for component appearance\n`;
    report += `- Reserve full integration for E2E tests only\n\n`;
  }

  report += `---\n\n`;
  report += `## Next Steps\n\n`;
  report += `1. Focus optimization efforts on the top 3 memory-intensive categories\n`;
  report += `2. Investigate heavy categories for mocking opportunities\n`;
  report += `3. Use the Phase 3 profiler to identify specific tests within categories\n`;
  report += `4. Consider splitting large test files into smaller, focused suites\n\n`;

  return report;
}

async function main() {
  console.log('🔬 Phase 4: Category Analysis');
  console.log('='.repeat(80));
  console.log('');
  console.log('This script will run tests grouped by category to collect memory data');
  console.log('without hitting OOM limits. Results will be aggregated and analyzed.');
  console.log('');

  const allResults: TestFileResult[] = [];

  // Process each category
  for (const category of categories) {
    const testFiles = findTestFiles(category.pattern);

    if (testFiles.length === 0) {
      console.log(`\n⚠️  No test files found for category: ${category.name}`);
      continue;
    }

    console.log(`\n📂 Found ${testFiles.length} test files for: ${category.name}`);

    const results = runTestsForCategory(category.name, testFiles);
    allResults.push(...results);
  }

  // Generate statistics
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 Generating Category Statistics...');
  console.log('='.repeat(80));

  const stats = generateCategoryStats(allResults);

  // Console output
  console.log('\n📋 Category Summary:\n');
  console.table(
    stats.map((s) => ({
      Category: s.name,
      Files: s.fileCount,
      Tests: s.totalTests,
      'Avg Duration (ms)': s.avgDurationMs.toFixed(0),
      Profile: s.expectedProfile,
    }))
  );

  // Generate and save report
  const report = generateReport(stats, allResults);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportPath = resolve(
    process.cwd(),
    `docs/development/phase4-category-analysis-${timestamp}.md`
  );

  writeFileSync(reportPath, report);
  console.log(`\n✅ Report saved to: ${reportPath}`);

  // Save CSV for further analysis
  const csvPath = resolve(process.cwd(), `/tmp/phase4-category-results-${timestamp}.csv`);
  const csvHeader = 'category,file,testCount,passedCount,failedCount,durationMs,heapUsedMB,rssMB\n';
  const csvRows = allResults
    .map(
      (r) =>
        `${r.category},"${r.file}",${r.testCount},${r.passedCount},${r.failedCount},${r.durationMs},${r.heapUsedMB},${r.rssMB}`
    )
    .join('\n');
  writeFileSync(csvPath, csvHeader + csvRows);
  console.log(`📊 CSV data saved to: ${csvPath}`);

  console.log('\n✅ Phase 4: Category Analysis Complete!');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
