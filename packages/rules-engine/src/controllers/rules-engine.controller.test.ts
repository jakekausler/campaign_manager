import { Test, TestingModule } from '@nestjs/testing';

import {
  EvaluateConditionRequest,
  EvaluateConditionsRequest,
  EvaluationResult,
  GetEvaluationOrderRequest,
  InvalidateCacheRequest,
  ValidateDependenciesRequest,
} from '../generated/rules-engine.types';
import { EvaluationEngineService } from '../services/evaluation-engine.service';

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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RulesEngineController],
      providers: [
        {
          provide: EvaluationEngineService,
          useValue: mockEvaluationEngineService,
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
      expect(evaluationEngineService.evaluateConditions).toHaveBeenCalledWith([], {}, false);
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
    it('should return stub evaluation order', async () => {
      const request: GetEvaluationOrderRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
        conditionIds: ['condition-1', 'condition-2'],
      };

      const result = await controller.getEvaluationOrder(request);

      expect(result).toBeDefined();
      expect(result.nodeIds).toEqual(request.conditionIds);
      expect(result.totalNodes).toBe(2);
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
    it('should return stub validation result with no cycles', async () => {
      const request: ValidateDependenciesRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
      };

      const result = await controller.validateDependencies(request);

      expect(result).toBeDefined();
      expect(result.hasCycle).toBe(false);
      expect(result.cycles).toEqual([]);
      expect(result.message).toContain('stub');
    });
  });

  describe('invalidateCache', () => {
    it('should return stub invalidation response', async () => {
      const request: InvalidateCacheRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
        nodeIds: ['node-1', 'node-2'],
      };

      const result = await controller.invalidateCache(request);

      expect(result).toBeDefined();
      expect(result.invalidatedCount).toBe(0);
      expect(result.message).toContain('stub');
    });

    it('should handle empty node list', async () => {
      const request: InvalidateCacheRequest = {
        campaignId: 'campaign-456',
        branchId: 'main',
        nodeIds: [],
      };

      const result = await controller.invalidateCache(request);

      expect(result).toBeDefined();
      expect(result.invalidatedCount).toBe(0);
    });
  });
});
