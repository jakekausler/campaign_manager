import { Test, TestingModule } from '@nestjs/testing';

import {
  EvaluateConditionRequest,
  EvaluateConditionsRequest,
  EvaluationResult,
  GetCacheStatsRequest,
  GetEvaluationOrderRequest,
  InvalidateCacheRequest,
  ValidateDependenciesRequest,
} from '../generated/rules-engine.types';
import { CacheService } from '../services/cache.service';
import { DependencyGraphService } from '../services/dependency-graph.service';
import { EvaluationEngineService } from '../services/evaluation-engine.service';
import { MetricsService } from '../services/metrics.service';

import { RulesEngineController } from './rules-engine.controller';

describe('RulesEngineController', () => {
  let controller: RulesEngineController;
  let evaluationEngineService: jest.Mocked<EvaluationEngineService>;

  beforeEach(async () => {
    // Create mock evaluation engine service
    const mockEvaluationEngineService = {
      evaluateCondition: jest.fn(),
      evaluateConditions: jest.fn(),
    };

    // Create mock dependency graph service
    const mockGraphService = {
      getGraph: jest.fn(),
      invalidateGraph: jest.fn(),
      getDependenciesOf: jest.fn(),
      getDependentsOf: jest.fn(),
      validateNoCycles: jest.fn().mockResolvedValue({
        hasCycles: false,
        cycles: [],
        cycleCount: 0,
      }),
      getEvaluationOrder: jest.fn().mockResolvedValue({
        success: true,
        order: [],
        remainingNodes: [],
      }),
    };

    // Create mock cache service
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn().mockReturnValue(0),
      invalidateByPrefix: jest.fn().mockReturnValue(0),
      clear: jest.fn(),
      getStats: jest.fn(),
      getConfig: jest.fn(),
      has: jest.fn(),
      keys: jest.fn(),
      keysByPrefix: jest.fn(),
      onModuleDestroy: jest.fn(),
    };

    // Create mock metrics service
    const mockMetricsService = {
      recordEvaluationSuccess: jest.fn(),
      recordEvaluationFailure: jest.fn(),
      recordCacheHit: jest.fn(),
      recordCacheMiss: jest.fn(),
      getMetrics: jest.fn(),
      resetMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RulesEngineController],
      providers: [
        {
          provide: EvaluationEngineService,
          useValue: mockEvaluationEngineService,
        },
        {
          provide: DependencyGraphService,
          useValue: mockGraphService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    controller = module.get<RulesEngineController>(RulesEngineController);
    evaluationEngineService = module.get(EvaluationEngineService);
  });

  describe('evaluateCondition', () => {
    it('should call evaluation engine and return result', async () => {
      const request: EvaluateConditionRequest = {
        conditionId: 'condition-123',
        campaignId: 'campaign-456',
        branchId: 'main',
        contextJson: '{"population": 5000}',
        includeTrace: false,
      };

      const mockResult: EvaluationResult = {
        success: true,
        valueJson: JSON.stringify(true),
        error: null,
        trace: [],
        evaluationTimeMs: 5,
      };

      evaluationEngineService.evaluateCondition.mockResolvedValue(mockResult);

      const result = await controller.evaluateCondition(request);

      expect(result).toEqual(mockResult);
      expect(evaluationEngineService.evaluateCondition).toHaveBeenCalledWith(
        'condition-123',
        { population: 5000 },
        'campaign-456',
        'main',
        false
      );
    });

    it('should handle invalid JSON context', async () => {
      const request: EvaluateConditionRequest = {
        conditionId: 'condition-123',
        campaignId: 'campaign-456',
        branchId: 'main',
        contextJson: 'invalid json',
        includeTrace: false,
      };

      const result = await controller.evaluateCondition(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(evaluationEngineService.evaluateCondition).not.toHaveBeenCalled();
    });

    it('should include trace when requested', async () => {
      const request: EvaluateConditionRequest = {
        conditionId: 'condition-123',
        campaignId: 'campaign-456',
        branchId: 'main',
        contextJson: '{"population": 5000}',
        includeTrace: true,
      };

      const mockResult: EvaluationResult = {
        success: true,
        valueJson: JSON.stringify(true),
        error: null,
        trace: [
          {
            step: 1,
            description: 'Test step',
            inputJson: null,
            outputJson: null,
            passed: true,
          },
        ],
        evaluationTimeMs: 5,
      };

      evaluationEngineService.evaluateCondition.mockResolvedValue(mockResult);

      const result = await controller.evaluateCondition(request);

      expect(result.trace).toHaveLength(1);
      expect(evaluationEngineService.evaluateCondition).toHaveBeenCalledWith(
        'condition-123',
        { population: 5000 },
        'campaign-456',
        'main',
        true
      );
    });
  });

  describe('evaluateConditions', () => {
    it('should call evaluation engine for multiple conditions', async () => {
      const request: EvaluateConditionsRequest = {
        conditionIds: ['condition-1', 'condition-2', 'condition-3'],
        campaignId: 'campaign-456',
        branchId: 'main',
        contextJson: '{"population": 5000}',
        includeTrace: false,
        useDependencyOrder: false,
      };

      const mockResults: Record<string, EvaluationResult> = {
        'condition-1': {
          success: true,
          valueJson: JSON.stringify(true),
          error: null,
          trace: [],
          evaluationTimeMs: 3,
        },
        'condition-2': {
          success: true,
          valueJson: JSON.stringify(false),
          error: null,
          trace: [],
          evaluationTimeMs: 4,
        },
        'condition-3': {
          success: true,
          valueJson: JSON.stringify(true),
          error: null,
          trace: [],
          evaluationTimeMs: 2,
        },
      };

      evaluationEngineService.evaluateConditions.mockResolvedValue(mockResults);

      const result = await controller.evaluateConditions(request);

      expect(result).toBeDefined();
      expect(Object.keys(result.results)).toHaveLength(3);
      expect(result.results['condition-1'].success).toBe(true);
      expect(result.evaluationOrder).toEqual(request.conditionIds);
      expect(result.totalEvaluationTimeMs).toBeGreaterThanOrEqual(0);
      expect(evaluationEngineService.evaluateConditions).toHaveBeenCalledWith(
        ['condition-1', 'condition-2', 'condition-3'],
        { population: 5000 },
        'campaign-456',
        'main',
        false
      );
    });

    it('should handle empty condition list', async () => {
      const request: EvaluateConditionsRequest = {
        conditionIds: [],
        campaignId: 'campaign-456',
        branchId: 'main',
        contextJson: '{}',
        includeTrace: false,
        useDependencyOrder: false,
      };

      evaluationEngineService.evaluateConditions.mockResolvedValue({});

      const result = await controller.evaluateConditions(request);

      expect(result).toBeDefined();
      expect(Object.keys(result.results)).toHaveLength(0);
      expect(result.evaluationOrder).toEqual([]);
      expect(evaluationEngineService.evaluateConditions).toHaveBeenCalledWith(
        [],
        {},
        'campaign-456',
        'main',
        false
      );
    });

    it('should handle invalid JSON context', async () => {
      const request: EvaluateConditionsRequest = {
        conditionIds: ['condition-1'],
        campaignId: 'campaign-456',
        branchId: 'main',
        contextJson: 'invalid json',
        includeTrace: false,
        useDependencyOrder: false,
      };

      const result = await controller.evaluateConditions(request);

      expect(result).toBeDefined();
      expect(Object.keys(result.results)).toHaveLength(0);
      expect(evaluationEngineService.evaluateConditions).not.toHaveBeenCalled();
    });
  });

  describe('getEvaluationOrder', () => {
    let graphService: jest.Mocked<DependencyGraphService>;

    beforeEach(() => {
      graphService = controller['graphService'] as jest.Mocked<DependencyGraphService>;
    });

    it('should return evaluation order from graph service', async () => {
      const request: GetEvaluationOrderRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
        conditionIds: ['condition-1', 'condition-2'],
      };

      // Mock graph service to return ordered nodes
      graphService.getEvaluationOrder.mockResolvedValue({
        success: true,
        order: ['CONDITION:condition-2', 'CONDITION:condition-1', 'VARIABLE:var-1'],
        remainingNodes: [],
      });

      const result = await controller.getEvaluationOrder(request);

      expect(result).toBeDefined();
      expect(result.nodeIds).toEqual(['CONDITION:condition-2', 'CONDITION:condition-1']);
      expect(result.totalNodes).toBe(2);
      expect(graphService.getEvaluationOrder).toHaveBeenCalledWith('campaign-456', 'main');
    });

    it('should handle empty condition list', async () => {
      const request: GetEvaluationOrderRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
        conditionIds: [],
      };

      const result = await controller.getEvaluationOrder(request);

      expect(result).toBeDefined();
      expect(result.nodeIds).toEqual([]);
      expect(result.totalNodes).toBe(0);
    });
  });

  describe('validateDependencies', () => {
    let graphService: jest.Mocked<DependencyGraphService>;

    beforeEach(() => {
      graphService = controller['graphService'] as jest.Mocked<DependencyGraphService>;
    });

    it('should return validation result with no cycles', async () => {
      const request: ValidateDependenciesRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
      };

      graphService.validateNoCycles.mockResolvedValue({
        hasCycles: false,
        cycles: [],
        cycleCount: 0,
      });

      const result = await controller.validateDependencies(request);

      expect(result).toBeDefined();
      expect(result.hasCycle).toBe(false);
      expect(result.cycles).toEqual([]);
      expect(result.message).toBe('No cycles detected in dependency graph');
      expect(graphService.validateNoCycles).toHaveBeenCalledWith('campaign-456', 'main');
    });

    it('should return validation result with cycles detected', async () => {
      const request: ValidateDependenciesRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
      };

      graphService.validateNoCycles.mockResolvedValue({
        hasCycles: true,
        cycles: [
          { path: ['CONDITION:cond-1', 'VARIABLE:var-1', 'CONDITION:cond-1'] },
          { path: ['CONDITION:cond-2', 'CONDITION:cond-3', 'CONDITION:cond-2'] },
        ],
        cycleCount: 2,
      });

      const result = await controller.validateDependencies(request);

      expect(result).toBeDefined();
      expect(result.hasCycle).toBe(true);
      expect(result.cycles).toEqual([
        'CONDITION:cond-1 -> VARIABLE:var-1 -> CONDITION:cond-1',
        'CONDITION:cond-2 -> CONDITION:cond-3 -> CONDITION:cond-2',
      ]);
      expect(result.message).toBe('Detected 2 cycle(s) in dependency graph');
    });
  });

  describe('invalidateCache', () => {
    let cacheService: jest.Mocked<CacheService>;
    let graphService: jest.Mocked<DependencyGraphService>;

    beforeEach(() => {
      cacheService = controller['cacheService'] as jest.Mocked<CacheService>;
      graphService = controller['graphService'] as jest.Mocked<DependencyGraphService>;
    });

    it('should invalidate specific node IDs when provided', async () => {
      const request: InvalidateCacheRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
        nodeIds: ['node-1', 'node-2'],
      };

      cacheService.invalidate.mockReturnValue(1); // Each call deletes 1 entry

      const result = await controller.invalidateCache(request);

      expect(result).toBeDefined();
      expect(result.invalidatedCount).toBe(3); // 1 (graph) + 1 (node-1) + 1 (node-2)
      expect(result.message).toContain('Successfully invalidated 3 cache entries');
      expect(graphService.invalidateGraph).toHaveBeenCalledWith('campaign-456', 'main');
      expect(cacheService.invalidate).toHaveBeenCalledTimes(2);
    });

    it('should invalidate all entries for campaign/branch when no node IDs provided', async () => {
      const request: InvalidateCacheRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
        nodeIds: [],
      };

      cacheService.invalidateByPrefix.mockReturnValue(5); // 5 cache entries deleted

      const result = await controller.invalidateCache(request);

      expect(result).toBeDefined();
      expect(result.invalidatedCount).toBe(6); // 1 (graph) + 5 (cache entries)
      expect(result.message).toContain('Successfully invalidated 6 cache entries');
      expect(graphService.invalidateGraph).toHaveBeenCalledWith('campaign-456', 'main');
      expect(cacheService.invalidateByPrefix).toHaveBeenCalledWith('campaign-456', 'main');
    });
  });

  describe('getCacheStats', () => {
    let cacheService: jest.Mocked<CacheService>;

    beforeEach(() => {
      cacheService = controller['cacheService'] as jest.Mocked<CacheService>;
    });

    it('should return cache statistics with sample keys when campaignId provided', async () => {
      const request: GetCacheStatsRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
      };

      const mockStats = {
        hits: 100,
        misses: 20,
        keys: 50,
        ksize: 1000,
        vsize: 5000,
        hitRate: 0.83,
      };

      const mockSampleKeys = [
        'campaign:campaign-456:branch:main:node:CONDITION:cond-1',
        'campaign:campaign-456:branch:main:node:CONDITION:cond-2',
      ];

      cacheService.getStats.mockReturnValue(mockStats);
      cacheService.keysByPrefix.mockReturnValue(mockSampleKeys);

      const result = await controller.getCacheStats(request);

      expect(result).toBeDefined();
      expect(result.hits).toBe(100);
      expect(result.misses).toBe(20);
      expect(result.keys).toBe(50);
      expect(result.hitRate).toBe(0.83);
      expect(result.sampleKeys).toEqual(mockSampleKeys);
      expect(cacheService.keysByPrefix).toHaveBeenCalledWith('campaign-456', 'main');
    });

    it('should return stats without sample keys when campaignId not provided (security)', async () => {
      const request: GetCacheStatsRequest = {
        campaignId: '',
        branchId: '',
      };

      const mockStats = {
        hits: 100,
        misses: 20,
        keys: 50,
        ksize: 1000,
        vsize: 5000,
        hitRate: 0.83,
      };

      cacheService.getStats.mockReturnValue(mockStats);

      const result = await controller.getCacheStats(request);

      expect(result).toBeDefined();
      expect(result.hits).toBe(100);
      expect(result.misses).toBe(20);
      expect(result.sampleKeys).toEqual([]); // Security: no sample keys without campaign scope
      expect(cacheService.keysByPrefix).not.toHaveBeenCalled();
      expect(cacheService.keys).not.toHaveBeenCalled();
    });

    it('should limit sample keys to 10 entries', async () => {
      const request: GetCacheStatsRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
      };

      const mockStats = {
        hits: 100,
        misses: 20,
        keys: 50,
        ksize: 1000,
        vsize: 5000,
        hitRate: 0.83,
      };

      // Create 20 sample keys
      const mockSampleKeys = Array.from({ length: 20 }, (_, i) => `key-${i}`);

      cacheService.getStats.mockReturnValue(mockStats);
      cacheService.keysByPrefix.mockReturnValue(mockSampleKeys);

      const result = await controller.getCacheStats(request);

      expect(result).toBeDefined();
      expect(result.sampleKeys).toHaveLength(10); // Limited to MAX_SAMPLE_KEYS
      expect(result.sampleKeys).toEqual(mockSampleKeys.slice(0, 10));
    });

    it('should handle errors gracefully', async () => {
      const request: GetCacheStatsRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
      };

      cacheService.getStats.mockImplementation(() => {
        throw new Error('Cache service error');
      });

      const result = await controller.getCacheStats(request);

      expect(result).toBeDefined();
      expect(result.hits).toBe(0);
      expect(result.misses).toBe(0);
      expect(result.keys).toBe(0);
      expect(result.hitRate).toBe(0);
      expect(result.sampleKeys).toEqual([]);
    });
  });
});
