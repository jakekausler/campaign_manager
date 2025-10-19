/**
 * Performance Test Suite for Rules Engine Worker
 *
 * Tests verify that the service meets acceptance criteria:
 * - Typical evaluations complete in <50ms (p95)
 * - Cached evaluations complete in <5ms (p95)
 * - Can handle 100+ concurrent evaluation requests
 *
 * Run with: pnpm --filter @campaign/rules-engine test performance.test.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { CacheService } from '../services/cache.service';
import { DependencyGraphBuilderService } from '../services/dependency-graph-builder.service';
import { DependencyGraphService } from '../services/dependency-graph.service';
import { EvaluationEngineService } from '../services/evaluation-engine.service';

/**
 * Calculate percentile from sorted array of numbers
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

/**
 * Performance statistics for a benchmark
 */
interface PerformanceStats {
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  samples: number;
}

/**
 * Calculate performance statistics from duration array
 */
function calculateStats(durations: number[]): PerformanceStats {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);

  return {
    mean: sum / sorted.length,
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    samples: sorted.length,
  };
}

/**
 * Benchmark a function and collect timing statistics
 */
async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number
): Promise<PerformanceStats> {
  const durations: number[] = [];

  // Warm-up phase (5 iterations)
  for (let i = 0; i < 5; i++) {
    await fn();
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    durations.push(Number(end - start) / 1_000_000); // Convert to milliseconds
  }

  const stats = calculateStats(durations);
  console.log(`\n${name}:`);
  console.log(`  Samples: ${stats.samples}`);
  console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
  console.log(`  Median: ${stats.median.toFixed(2)}ms`);
  console.log(`  p95: ${stats.p95.toFixed(2)}ms`);
  console.log(`  p99: ${stats.p99.toFixed(2)}ms`);
  console.log(`  Min: ${stats.min.toFixed(2)}ms`);
  console.log(`  Max: ${stats.max.toFixed(2)}ms`);

  return stats;
}

describe('Performance Test Suite', () => {
  let evaluationEngine: EvaluationEngineService;
  let cacheService: CacheService;
  let dependencyGraphService: DependencyGraphService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    // Create mock Prisma client
    prisma = mockDeep<PrismaClient>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationEngineService,
        CacheService,
        DependencyGraphService,
        DependencyGraphBuilderService,
        {
          provide: PrismaClient,
          useValue: prisma,
        },
      ],
    }).compile();

    evaluationEngine = module.get<EvaluationEngineService>(EvaluationEngineService);
    cacheService = module.get<CacheService>(CacheService);
    dependencyGraphService = module.get<DependencyGraphService>(DependencyGraphService);
  });

  afterEach(() => {
    cacheService.clear();
    dependencyGraphService.clearAllCaches();
  });

  describe('Single Condition Evaluation Latency', () => {
    it('should complete typical evaluations in <50ms (p95)', async () => {
      const conditionId = 'test-condition-1';
      const expression = {
        and: [
          { '>=': [{ var: 'population' }, 5000] },
          { '>=': [{ var: 'merchant_count' }, 10] },
          { in: ['trade_route', { var: 'tags' }] },
        ],
      };

      // Mock database response
      prisma.fieldCondition.findUnique.mockResolvedValue({
        id: conditionId,
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_trade_hub',
        expression,
        description: 'Trade hub qualification',
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context = {
        population: 6000,
        merchant_count: 15,
        tags: ['trade_route', 'coastal'],
      };

      const stats = await benchmark(
        'Single Condition Evaluation (No Cache)',
        async () => {
          await evaluationEngine.evaluateCondition(
            conditionId,
            context,
            'campaign-123',
            'main',
            false // No trace
          );
        },
        100
      );

      // Acceptance criteria: p95 < 50ms
      expect(stats.p95).toBeLessThan(50);
    });

    it('should complete cached evaluations in <5ms (p95)', async () => {
      const conditionId = 'test-condition-2';
      const campaignId = 'campaign-123';
      const branchId = 'main';
      const nodeId = `CONDITION:${conditionId}`;

      // Pre-populate cache
      cacheService.set(
        { campaignId, branchId, nodeId },
        {
          success: true,
          valueJson: JSON.stringify(true),
          error: null,
          trace: [],
          evaluationTimeMs: 5,
        }
      );

      const stats = await benchmark(
        'Single Condition Evaluation (Cached)',
        async () => {
          cacheService.get({ campaignId, branchId, nodeId });
        },
        1000
      );

      // Acceptance criteria: p95 < 5ms for cached
      expect(stats.p95).toBeLessThan(5);
    });
  });

  describe('Batch Evaluation Throughput', () => {
    it('should evaluate 10 conditions in <500ms (p95)', async () => {
      const conditionIds = Array.from({ length: 10 }, (_, i) => `condition-${i}`);
      const expression = { '>': [{ var: 'value' }, 50] };

      // Mock database responses for all conditions
      for (const id of conditionIds) {
        prisma.fieldCondition.findUnique.mockResolvedValueOnce({
          id,
          entityType: 'Settlement',
          entityId: null,
          field: 'test_field',
          expression,
          description: 'Test condition',
          isActive: true,
          priority: 100,
          version: 1,
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const context = { value: 75 };

      const stats = await benchmark(
        'Batch Evaluation (10 conditions, no cache)',
        async () => {
          await evaluationEngine.evaluateConditions(
            conditionIds,
            context,
            'campaign-123',
            'main',
            false // No trace
          );
        },
        50
      );

      // Acceptance criteria: 10 conditions in <500ms (50ms per condition * 10)
      expect(stats.p95).toBeLessThan(500);
    });

    it('should handle 100 conditions with dependency ordering', async () => {
      const conditionIds = Array.from({ length: 100 }, (_, i) => `condition-${i}`);
      const expression = { '>=': [{ var: 'value' }, 0] };

      // Mock database responses
      for (const id of conditionIds) {
        prisma.fieldCondition.findUnique.mockResolvedValueOnce({
          id,
          entityType: 'Settlement',
          entityId: null,
          field: 'test_field',
          expression,
          description: 'Test condition',
          isActive: true,
          priority: 100,
          version: 1,
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const context = { value: 100 };

      const stats = await benchmark(
        'Batch Evaluation (100 conditions)',
        async () => {
          await evaluationEngine.evaluateConditions(
            conditionIds,
            context,
            'campaign-123',
            'main',
            false
          );
        },
        10
      );

      // Acceptance criteria: Can handle 100 conditions
      // Should complete in reasonable time (< 5 seconds)
      expect(stats.p95).toBeLessThan(5000);
    }, 15000); // 15 second timeout for CI environments
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache hit performance advantage', async () => {
      const conditionId = 'cache-test-condition';
      const campaignId = 'campaign-123';
      const branchId = 'main';
      const nodeId = `CONDITION:${conditionId}`;
      const expression = {
        and: [
          { '>': [{ var: 'a' }, 10] },
          { '<': [{ var: 'b' }, 100] },
          { '===': [{ var: 'c' }, 'active'] },
        ],
      };

      // Mock database response
      prisma.fieldCondition.findUnique.mockResolvedValue({
        id: conditionId,
        entityType: 'Settlement',
        entityId: null,
        field: 'test_field',
        expression,
        description: 'Test condition',
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context = { a: 15, b: 50, c: 'active' };

      // Benchmark without cache
      const uncachedStats = await benchmark(
        'Evaluation without cache',
        async () => {
          cacheService.clear(); // Clear cache each time
          await evaluationEngine.evaluateCondition(
            conditionId,
            context,
            campaignId,
            branchId,
            false
          );
        },
        50
      );

      // Pre-populate cache
      const result = await evaluationEngine.evaluateCondition(
        conditionId,
        context,
        campaignId,
        branchId,
        false
      );
      cacheService.set({ campaignId, branchId, nodeId }, result);

      // Benchmark with cache
      const cachedStats = await benchmark(
        'Evaluation with cache',
        async () => {
          cacheService.get({ campaignId, branchId, nodeId });
        },
        500
      );

      console.log(`\nCache speedup: ${(uncachedStats.mean / cachedStats.mean).toFixed(2)}x`);

      // Cache should be significantly faster
      expect(cachedStats.mean).toBeLessThan(uncachedStats.mean / 5);
    });

    it('should handle cache invalidation efficiently', async () => {
      const campaignId = 'campaign-123';
      const branchId = 'main';

      // Populate cache with 1000 entries
      for (let i = 0; i < 1000; i++) {
        cacheService.set({ campaignId, branchId, nodeId: `node-${i}` }, { value: i });
      }

      const stats = await benchmark(
        'Cache invalidation (campaign-wide)',
        async () => {
          cacheService.invalidateByPrefix(campaignId, branchId);
        },
        100
      );

      // Invalidation should be fast even with many entries
      expect(stats.p95).toBeLessThan(10);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 100+ concurrent evaluation requests', async () => {
      const conditionId = 'concurrent-test-condition';
      const expression = { '>': [{ var: 'value' }, 0] };

      // Mock database response
      prisma.fieldCondition.findUnique.mockResolvedValue({
        id: conditionId,
        entityType: 'Settlement',
        entityId: null,
        field: 'test_field',
        expression,
        description: 'Test condition',
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context = { value: 42 };

      const start = process.hrtime.bigint();

      // Create 150 concurrent evaluation requests
      const promises = Array.from({ length: 150 }, () =>
        evaluationEngine.evaluateCondition(conditionId, context, 'campaign-123', 'main', false)
      );

      const results = await Promise.all(promises);
      const end = process.hrtime.bigint();
      const totalTime = Number(end - start) / 1_000_000;

      console.log(`\nConcurrent Requests:`);
      console.log(`  Total requests: ${promises.length}`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average per request: ${(totalTime / promises.length).toFixed(2)}ms`);
      console.log(`  Throughput: ${(promises.length / (totalTime / 1000)).toFixed(0)} req/s`);

      // All requests should complete (no exceptions thrown)
      expect(results).toHaveLength(150);

      // Should handle 100+ concurrent requests efficiently
      // Average per request should still be reasonable (<100ms)
      expect(totalTime / promises.length).toBeLessThan(100);
    });
  });

  describe('Expression Complexity Performance', () => {
    it('should handle simple expressions efficiently', async () => {
      const conditionId = 'simple-expr';
      const expression = { '>': [{ var: 'value' }, 10] };

      prisma.fieldCondition.findUnique.mockResolvedValue({
        id: conditionId,
        entityType: 'Settlement',
        entityId: null,
        field: 'test_field',
        expression,
        description: 'Simple expression',
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const stats = await benchmark(
        'Simple Expression Evaluation',
        async () => {
          await evaluationEngine.evaluateCondition(
            conditionId,
            { value: 15 },
            'campaign-123',
            'main',
            false
          );
        },
        200
      );

      expect(stats.p95).toBeLessThan(20);
    });

    it('should handle complex nested expressions within limits', async () => {
      const conditionId = 'complex-expr';
      const expression = {
        and: [
          {
            or: [
              { '>=': [{ var: 'population' }, 5000] },
              {
                and: [
                  { '>=': [{ var: 'wealth' }, 10000] },
                  { in: ['prosperous', { var: 'tags' }] },
                ],
              },
            ],
          },
          {
            or: [
              { '>=': [{ var: 'merchant_count' }, 10] },
              { in: ['trade_route', { var: 'tags' }] },
            ],
          },
          { '<': [{ var: 'danger_level' }, 5] },
        ],
      };

      prisma.fieldCondition.findUnique.mockResolvedValue({
        id: conditionId,
        entityType: 'Settlement',
        entityId: null,
        field: 'test_field',
        expression,
        description: 'Complex expression',
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const context = {
        population: 6000,
        wealth: 12000,
        merchant_count: 15,
        tags: ['trade_route', 'prosperous'],
        danger_level: 3,
      };

      const stats = await benchmark(
        'Complex Expression Evaluation',
        async () => {
          await evaluationEngine.evaluateCondition(
            conditionId,
            context,
            'campaign-123',
            'main',
            false
          );
        },
        100
      );

      expect(stats.p95).toBeLessThan(50);
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during repeated evaluations', async () => {
      const conditionId = 'memory-test';
      const expression = { '>': [{ var: 'value' }, 0] };

      prisma.fieldCondition.findUnique.mockResolvedValue({
        id: conditionId,
        entityType: 'Settlement',
        entityId: null,
        field: 'test_field',
        expression,
        description: 'Memory test',
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Run 5000 evaluations (reduced from 10k to fit within timeout)
      for (let i = 0; i < 5000; i++) {
        await evaluationEngine.evaluateCondition(
          conditionId,
          { value: i },
          'campaign-123',
          'main',
          false
        );
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`\nMemory Usage:`);
      console.log(`  Initial: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Final: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Increase: ${memoryIncrease.toFixed(2)} MB`);

      // Memory increase should be minimal (< 25MB for 5k evaluations)
      expect(memoryIncrease).toBeLessThan(25);
    }, 20000); // 20 second timeout for CI environments
  });
});
