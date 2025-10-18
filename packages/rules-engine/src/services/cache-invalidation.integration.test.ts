/**
 * Cache Invalidation Integration Tests
 *
 * Tests the integration between CacheService and the evaluation pipeline,
 * verifying that cache invalidation works correctly in real scenarios.
 */

import { CacheService } from './cache.service';
import { DependencyGraphBuilderService } from './dependency-graph-builder.service';
import { DependencyGraphService } from './dependency-graph.service';
import { EvaluationEngineService } from './evaluation-engine.service';

// Create mock Prisma client instance
const mockPrismaClient = {
  fieldCondition: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  stateVariable: {
    findMany: jest.fn(),
  },
  $disconnect: jest.fn(),
};

// Mock Prisma Client module
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

describe('Cache Invalidation Integration', () => {
  let cacheService: CacheService;
  let evaluationEngine: EvaluationEngineService;
  let graphService: DependencyGraphService;
  let graphBuilder: DependencyGraphBuilderService;

  beforeEach(() => {
    // Reset environment variables for consistent test behavior
    delete process.env.CACHE_TTL_SECONDS;
    delete process.env.CACHE_CHECK_PERIOD_SECONDS;
    delete process.env.CACHE_MAX_KEYS;

    // Create service instances
    cacheService = new CacheService();
    graphBuilder = new DependencyGraphBuilderService();
    graphService = new DependencyGraphService(graphBuilder);
    evaluationEngine = new EvaluationEngineService(graphService, cacheService);
  });

  afterEach(async () => {
    // Clean up services
    cacheService.clear();
    cacheService.onModuleDestroy();
    graphService.clearAllCaches();
    await graphBuilder.onModuleDestroy();
    await evaluationEngine.onModuleDestroy();
  });

  describe('Evaluation Result Caching', () => {
    it('should cache successful evaluation results', async () => {
      // Mock database response
      const mockCondition = {
        id: 'cond-123',
        entityType: 'Settlement',
        entityId: 'settlement-1',
        field: 'is_trade_hub',
        expression: { '>=': [{ var: 'population' }, 5000] },
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      mockPrismaClient.fieldCondition.findUnique.mockResolvedValue(mockCondition);

      const context = { population: 6000 };
      const campaignId = 'campaign-123';
      const branchId = 'main';

      // First evaluation - should cache the result
      const result1 = await evaluationEngine.evaluateCondition(
        'cond-123',
        context,
        campaignId,
        branchId,
        false // Don't include trace to allow caching
      );

      expect(result1.success).toBe(true);
      expect(JSON.parse(result1.valueJson!)).toBe(true);

      // Verify cache was populated
      const cached = cacheService.get<typeof result1>({
        campaignId,
        branchId,
        nodeId: 'CONDITION:cond-123',
      });
      expect(cached).toBeDefined();
      expect(cached!.success).toBe(true);

      // Second evaluation - should hit cache (no database call)
      mockPrismaClient.fieldCondition.findUnique.mockClear();
      const result2 = await evaluationEngine.evaluateCondition(
        'cond-123',
        context,
        campaignId,
        branchId,
        false
      );

      // Result should match
      expect(result2.success).toBe(true);
      expect(JSON.parse(result2.valueJson!)).toBe(true);

      // Database should NOT have been called (cache hit)
      expect(mockPrismaClient.fieldCondition.findUnique).not.toHaveBeenCalled();

      // Cache hit should be very fast (typically 0-1ms)
      expect(result2.evaluationTimeMs).toBeLessThanOrEqual(1);
    });

    it('should NOT cache results when trace is requested', async () => {
      const mockCondition = {
        id: 'cond-123',
        entityType: 'Settlement',
        entityId: 'settlement-1',
        field: 'is_trade_hub',
        expression: { '>=': [{ var: 'population' }, 5000] },
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      mockPrismaClient.fieldCondition.findUnique.mockResolvedValue(mockCondition);

      const context = { population: 6000 };
      const campaignId = 'campaign-123';
      const branchId = 'main';

      // Evaluation with trace - should NOT cache
      await evaluationEngine.evaluateCondition(
        'cond-123',
        context,
        campaignId,
        branchId,
        true // Include trace - should bypass cache
      );

      // Verify cache was NOT populated
      const cached = cacheService.get({
        campaignId,
        branchId,
        nodeId: 'CONDITION:cond-123',
      });
      expect(cached).toBeUndefined();
    });

    it('should NOT cache failed evaluations', async () => {
      mockPrismaClient.fieldCondition.findUnique.mockResolvedValue(null);

      const campaignId = 'campaign-123';
      const branchId = 'main';

      // Failed evaluation (condition not found)
      await evaluationEngine.evaluateCondition('nonexistent', {}, campaignId, branchId, false);

      // Verify cache was NOT populated
      const cached = cacheService.get({
        campaignId,
        branchId,
        nodeId: 'CONDITION:nonexistent',
      });
      expect(cached).toBeUndefined();
    });
  });

  describe('Cache Invalidation Scenarios', () => {
    it('should invalidate specific condition cache entry', async () => {
      // Populate cache manually
      const cacheKey = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-123',
      };
      cacheService.set(cacheKey, { success: true, value: true });

      // Verify cached
      expect(cacheService.has(cacheKey)).toBe(true);

      // Invalidate specific entry
      const deleted = cacheService.invalidate(cacheKey);
      expect(deleted).toBe(1);

      // Verify invalidated
      expect(cacheService.has(cacheKey)).toBe(false);
    });

    it('should invalidate all cache entries for a campaign/branch', async () => {
      const campaignId = 'campaign-123';
      const branchId = 'main';

      // Populate cache with multiple entries
      cacheService.set(
        { campaignId, branchId, nodeId: 'CONDITION:cond-1' },
        { success: true, value: 'result1' }
      );
      cacheService.set(
        { campaignId, branchId, nodeId: 'CONDITION:cond-2' },
        { success: true, value: 'result2' }
      );
      cacheService.set(
        { campaignId, branchId, nodeId: 'VARIABLE:var-1' },
        { success: true, value: 123 }
      );

      // Entry for different campaign (should not be invalidated)
      cacheService.set(
        { campaignId: 'campaign-456', branchId, nodeId: 'CONDITION:cond-3' },
        { success: true, value: 'result3' }
      );

      // Invalidate all entries for campaign-123:main
      const deleted = cacheService.invalidateByPrefix(campaignId, branchId);
      expect(deleted).toBe(3);

      // Verify only campaign-123:main entries invalidated
      expect(cacheService.has({ campaignId, branchId, nodeId: 'CONDITION:cond-1' })).toBe(false);
      expect(cacheService.has({ campaignId, branchId, nodeId: 'CONDITION:cond-2' })).toBe(false);
      expect(cacheService.has({ campaignId, branchId, nodeId: 'VARIABLE:var-1' })).toBe(false);

      // Other campaign entry should remain
      expect(
        cacheService.has({ campaignId: 'campaign-456', branchId, nodeId: 'CONDITION:cond-3' })
      ).toBe(true);
    });

    it('should invalidate all entries for a campaign (all branches)', async () => {
      const campaignId = 'campaign-123';

      // Populate cache with entries across multiple branches
      cacheService.set(
        { campaignId, branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { success: true }
      );
      cacheService.set(
        { campaignId, branchId: 'feature', nodeId: 'CONDITION:cond-2' },
        { success: true }
      );
      cacheService.set(
        { campaignId, branchId: 'staging', nodeId: 'VARIABLE:var-1' },
        { success: true }
      );

      // Entry for different campaign
      cacheService.set(
        { campaignId: 'campaign-456', branchId: 'main', nodeId: 'CONDITION:cond-3' },
        { success: true }
      );

      // Invalidate all entries for campaign-123 (all branches)
      const deleted = cacheService.invalidateByPrefix(campaignId);
      expect(deleted).toBe(3);

      // Verify all campaign-123 entries invalidated
      expect(cacheService.has({ campaignId, branchId: 'main', nodeId: 'CONDITION:cond-1' })).toBe(
        false
      );
      expect(
        cacheService.has({ campaignId, branchId: 'feature', nodeId: 'CONDITION:cond-2' })
      ).toBe(false);
      expect(cacheService.has({ campaignId, branchId: 'staging', nodeId: 'VARIABLE:var-1' })).toBe(
        false
      );

      // Other campaign entry should remain
      expect(
        cacheService.has({
          campaignId: 'campaign-456',
          branchId: 'main',
          nodeId: 'CONDITION:cond-3',
        })
      ).toBe(true);
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', async () => {
      const cacheKey = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-1',
      };

      // Initial stats
      let stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);

      // Set a value
      cacheService.set(cacheKey, { success: true, value: 'cached' });

      // Hit the cache
      cacheService.get(cacheKey);
      cacheService.get(cacheKey);

      // Miss the cache
      cacheService.get({
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:nonexistent',
      });

      // Check stats
      stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(2 / 3); // 66.7%
    });

    it('should report cache size metrics', async () => {
      const campaignId = 'campaign-123';
      const branchId = 'main';

      // Populate cache with several entries
      for (let i = 1; i <= 5; i++) {
        cacheService.set(
          { campaignId, branchId, nodeId: `CONDITION:cond-${i}` },
          { success: true, value: `result${i}` }
        );
      }

      const stats = cacheService.getStats();
      expect(stats.keys).toBe(5);
      expect(stats.ksize).toBeGreaterThan(0); // Approximate memory for keys
      expect(stats.vsize).toBeGreaterThan(0); // Approximate memory for values
    });
  });

  describe('Cache Key Strategy', () => {
    it('should generate unique keys for different campaign/branch/node combinations', () => {
      const combinations = [
        { campaignId: 'c1', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { campaignId: 'c1', branchId: 'feature', nodeId: 'CONDITION:cond-1' },
        { campaignId: 'c2', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { campaignId: 'c1', branchId: 'main', nodeId: 'CONDITION:cond-2' },
        { campaignId: 'c1', branchId: 'main', nodeId: 'VARIABLE:var-1' },
      ];

      // Set unique values for each combination
      combinations.forEach((combo, index) => {
        cacheService.set(combo, { index });
      });

      // Verify all combinations are stored separately
      combinations.forEach((combo, index) => {
        const cached = cacheService.get<{ index: number }>(combo);
        expect(cached).toBeDefined();
        expect(cached!.index).toBe(index);
      });

      // Verify total keys
      expect(cacheService.keys().length).toBe(5);
    });

    it('should handle special characters in cache key components', () => {
      const specialCases = [
        { campaignId: 'campaign:with:colons', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { campaignId: 'campaign-123', branchId: 'feature:branch', nodeId: 'CONDITION:cond-1' },
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:test:cond:1' },
      ];

      // Set and retrieve with special characters
      specialCases.forEach((combo, index) => {
        cacheService.set(combo, { index });
        const cached = cacheService.get<{ index: number }>(combo);
        expect(cached).toBeDefined();
        expect(cached!.index).toBe(index);
      });

      // Verify no collisions (all 3 entries stored)
      expect(cacheService.keys().length).toBe(3);
    });
  });

  describe('Integration with Evaluation Engine', () => {
    it('should cache results during batch evaluation', async () => {
      const mockConditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_trade_hub',
          expression: { '>=': [{ var: 'population' }, 5000] },
          isActive: true,
          priority: 100,
          version: 1,
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          description: null,
        },
        {
          id: 'cond-2',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'has_market',
          expression: { in: ['market', { var: 'buildings' }] },
          isActive: true,
          priority: 90,
          version: 1,
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          description: null,
        },
      ];

      // Mock database to return different conditions
      mockPrismaClient.fieldCondition.findUnique.mockImplementation(
        async (args: { where: { id: string } }) => {
          return mockConditions.find((c) => c.id === args.where.id) || null;
        }
      );

      // Mock graph service to return empty graph (no dependencies)
      mockPrismaClient.fieldCondition.findMany.mockResolvedValue([]);
      mockPrismaClient.stateVariable.findMany.mockResolvedValue([]);

      const context = { population: 6000, buildings: ['market', 'tavern'] };
      const campaignId = 'campaign-123';
      const branchId = 'main';

      // Batch evaluation
      const results = await evaluationEngine.evaluateConditions(
        ['cond-1', 'cond-2'],
        context,
        campaignId,
        branchId,
        false
      );

      // Verify both evaluations succeeded
      expect(results['cond-1'].success).toBe(true);
      expect(results['cond-2'].success).toBe(true);

      // Verify both results were cached
      expect(cacheService.has({ campaignId, branchId, nodeId: 'CONDITION:cond-1' })).toBe(true);
      expect(cacheService.has({ campaignId, branchId, nodeId: 'CONDITION:cond-2' })).toBe(true);

      // Second batch evaluation should hit cache
      mockPrismaClient.fieldCondition.findUnique.mockClear();
      const results2 = await evaluationEngine.evaluateConditions(
        ['cond-1', 'cond-2'],
        context,
        campaignId,
        branchId,
        false
      );

      // Results should match
      expect(results2['cond-1'].success).toBe(true);
      expect(results2['cond-2'].success).toBe(true);

      // Database should NOT have been called (cache hits)
      expect(mockPrismaClient.fieldCondition.findUnique).not.toHaveBeenCalled();
    });
  });
});
