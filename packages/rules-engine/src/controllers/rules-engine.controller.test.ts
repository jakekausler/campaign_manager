import { Test, TestingModule } from '@nestjs/testing';

import {
  EvaluateConditionRequest,
  EvaluateConditionsRequest,
  GetEvaluationOrderRequest,
  InvalidateCacheRequest,
  ValidateDependenciesRequest,
} from '../generated/rules-engine.types';

import { RulesEngineController } from './rules-engine.controller';

describe('RulesEngineController', () => {
  let controller: RulesEngineController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RulesEngineController],
    }).compile();

    controller = module.get<RulesEngineController>(RulesEngineController);
  });

  describe('evaluateCondition', () => {
    it('should return a stub evaluation result', async () => {
      const request: EvaluateConditionRequest = {
        conditionId: 'condition-123',
        campaignId: 'campaign-456',
        branchId: 'main',
        contextJson: '{"population": 5000}',
        includeTrace: false,
      };

      const result = await controller.evaluateCondition(request);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.valueJson).toBe(JSON.stringify(true));
      expect(result.error).toBeNull();
      expect(result.trace).toEqual([]);
      expect(result.evaluationTimeMs).toBe(0);
    });
  });

  describe('evaluateConditions', () => {
    it('should return stub evaluation results for multiple conditions', async () => {
      const request: EvaluateConditionsRequest = {
        conditionIds: ['condition-1', 'condition-2', 'condition-3'],
        campaignId: 'campaign-456',
        branchId: 'main',
        contextJson: '{"population": 5000}',
        includeTrace: false,
        useDependencyOrder: false,
      };

      const result = await controller.evaluateConditions(request);

      expect(result).toBeDefined();
      expect(Object.keys(result.results)).toHaveLength(3);
      expect(result.results['condition-1']).toBeDefined();
      expect(result.results['condition-1'].success).toBe(true);
      expect(result.totalEvaluationTimeMs).toBe(0);
      expect(result.evaluationOrder).toEqual(request.conditionIds);
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

      const result = await controller.evaluateConditions(request);

      expect(result).toBeDefined();
      expect(Object.keys(result.results)).toHaveLength(0);
      expect(result.evaluationOrder).toEqual([]);
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
