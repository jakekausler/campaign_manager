/**
 * Integration tests for Rules Engine gRPC Client
 * Tests communication with the Rules Engine worker service
 *
 * NOTE: These tests require the Rules Engine worker to be running on localhost:50051
 * They are skipped by default and can be enabled by setting INTEGRATION_TESTS=true
 */

import { Test, TestingModule } from '@nestjs/testing';

import { RulesEngineClientService } from './rules-engine-client.service';

// Skip these tests by default unless INTEGRATION_TESTS=true
const describeIf = process.env.INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIf('RulesEngineClientService Integration Tests', () => {
  let service: RulesEngineClientService;

  beforeAll(async () => {
    // Set environment variables for test
    process.env.RULES_ENGINE_ENABLED = 'true';
    process.env.RULES_ENGINE_GRPC_HOST = 'localhost';
    process.env.RULES_ENGINE_GRPC_PORT = '50051';
    process.env.RULES_ENGINE_TIMEOUT_MS = '5000';

    const module: TestingModule = await Test.createTestingModule({
      providers: [RulesEngineClientService],
    }).compile();

    service = module.get<RulesEngineClientService>(RulesEngineClientService);

    // Initialize connection
    await service.onModuleInit();
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  describe('Connection and Health', () => {
    it('should be available after startup', async () => {
      const isAvailable = await service.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should report circuit breaker state', () => {
      const state = service.getCircuitState();
      expect(state.state).toBe('CLOSED');
      expect(state.isConnected).toBe(true);
      expect(state.failureCount).toBe(0);
    });
  });

  describe('Evaluate Condition', () => {
    it('should evaluate a simple condition successfully', async () => {
      const result = await service.evaluateCondition({
        conditionId: 'test-condition-1',
        campaignId: 'test-campaign-1',
        branchId: 'main',
        contextJson: JSON.stringify({ value: 10 }),
        includeTrace: false,
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      // Note: Actual result depends on condition existing in test database
    });

    it('should include trace when requested', async () => {
      const result = await service.evaluateCondition({
        conditionId: 'test-condition-1',
        campaignId: 'test-campaign-1',
        branchId: 'main',
        contextJson: JSON.stringify({ value: 10 }),
        includeTrace: true,
      });

      expect(result).toBeDefined();
      // Trace may or may not be present depending on worker implementation
      if (result.trace) {
        expect(Array.isArray(result.trace)).toBe(true);
      }
    });

    it('should handle missing condition gracefully', async () => {
      const result = await service.evaluateCondition({
        conditionId: 'non-existent-condition',
        campaignId: 'test-campaign-1',
        branchId: 'main',
        contextJson: JSON.stringify({ value: 10 }),
        includeTrace: false,
      });

      expect(result).toBeDefined();
      // Worker should return success: false for missing conditions
      expect(result.success).toBe(false);
    });
  });

  describe('Evaluate Conditions (Batch)', () => {
    it('should evaluate multiple conditions', async () => {
      const result = await service.evaluateConditions({
        conditionIds: ['test-condition-1', 'test-condition-2'],
        campaignId: 'test-campaign-1',
        branchId: 'main',
        contextJson: JSON.stringify({ value: 10 }),
        includeTrace: false,
        useDependencyOrder: false,
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(typeof result.results).toBe('object');
    });

    it('should use dependency order when requested', async () => {
      const result = await service.evaluateConditions({
        conditionIds: ['test-condition-1', 'test-condition-2'],
        campaignId: 'test-campaign-1',
        branchId: 'main',
        contextJson: JSON.stringify({ value: 10 }),
        includeTrace: false,
        useDependencyOrder: true,
      });

      expect(result).toBeDefined();
      if (result.evaluationOrder) {
        expect(Array.isArray(result.evaluationOrder)).toBe(true);
      }
    });

    it('should handle empty condition list', async () => {
      const result = await service.evaluateConditions({
        conditionIds: [],
        campaignId: 'test-campaign-1',
        branchId: 'main',
        contextJson: JSON.stringify({ value: 10 }),
        includeTrace: false,
        useDependencyOrder: false,
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
    });
  });

  describe('Get Evaluation Order', () => {
    it('should return evaluation order for campaign', async () => {
      const result = await service.getEvaluationOrder({
        campaignId: 'test-campaign-1',
        branchId: 'main',
      });

      expect(result).toBeDefined();
      expect(result.nodeIds).toBeDefined();
      expect(Array.isArray(result.nodeIds)).toBe(true);
    });

    it('should filter to specific conditions when requested', async () => {
      const result = await service.getEvaluationOrder({
        campaignId: 'test-campaign-1',
        branchId: 'main',
        conditionIds: ['test-condition-1'],
      });

      expect(result).toBeDefined();
      expect(result.nodeIds).toBeDefined();
      expect(Array.isArray(result.nodeIds)).toBe(true);
    });
  });

  describe('Validate Dependencies', () => {
    it('should validate dependency graph', async () => {
      const result = await service.validateDependencies({
        campaignId: 'test-campaign-1',
        branchId: 'main',
      });

      expect(result).toBeDefined();
      expect(result.hasCycle).toBeDefined();
      expect(typeof result.hasCycle).toBe('boolean');
      expect(result.message).toBeDefined();
    });

    it('should detect cycles if present', async () => {
      // This test depends on test data with cycles
      const result = await service.validateDependencies({
        campaignId: 'test-campaign-with-cycles',
        branchId: 'main',
      });

      expect(result).toBeDefined();
      if (result.hasCycle) {
        expect(result.cycles).toBeDefined();
        expect(Array.isArray(result.cycles)).toBe(true);
        expect(result.cycles!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Cache Operations', () => {
    it('should invalidate cache successfully', async () => {
      const result = await service.invalidateCache({
        campaignId: 'test-campaign-1',
        branchId: 'main',
      });

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should invalidate specific nodes', async () => {
      const result = await service.invalidateCache({
        campaignId: 'test-campaign-1',
        branchId: 'main',
        nodeIds: ['condition:test-condition-1'],
      });

      expect(result).toBeDefined();
      expect(result.invalidatedCount).toBeDefined();
    });

    it('should get cache statistics', async () => {
      const result = await service.getCacheStats({
        campaignId: 'test-campaign-1',
        branchId: 'main',
      });

      expect(result).toBeDefined();
      expect(result.hits).toBeDefined();
      expect(result.misses).toBeDefined();
      expect(result.keys).toBeDefined();
    });

    it('should include hit rate in statistics', async () => {
      const result = await service.getCacheStats({
        campaignId: 'test-campaign-1',
        branchId: 'main',
      });

      expect(result).toBeDefined();
      if (result.hitRate !== undefined) {
        expect(result.hitRate).toBeGreaterThanOrEqual(0);
        expect(result.hitRate).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout gracefully', async () => {
      // Create service with very short timeout
      const module: TestingModule = await Test.createTestingModule({
        providers: [RulesEngineClientService],
      }).compile();

      const shortTimeoutService = module.get<RulesEngineClientService>(RulesEngineClientService);

      // Override timeout (TypeScript workaround - access private property)
      (shortTimeoutService as unknown as { timeout: number }).timeout = 1; // 1ms timeout

      await expect(
        shortTimeoutService.evaluateCondition({
          conditionId: 'test-condition-1',
          campaignId: 'test-campaign-1',
          branchId: 'main',
          contextJson: JSON.stringify({ value: 10 }),
          includeTrace: false,
        })
      ).rejects.toThrow();
    });

    it('should handle invalid JSON in context', async () => {
      // The gRPC layer should handle this, but we test the behavior
      await expect(
        service.evaluateCondition({
          conditionId: 'test-condition-1',
          campaignId: 'test-campaign-1',
          branchId: 'main',
          contextJson: 'invalid-json',
          includeTrace: false,
        })
      ).rejects.toThrow();
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      // Create service with low failure threshold
      const module: TestingModule = await Test.createTestingModule({
        providers: [RulesEngineClientService],
      }).compile();

      const testService = module.get<RulesEngineClientService>(RulesEngineClientService);

      // Override failure threshold (TypeScript workaround)
      (testService as unknown as { failureThreshold: number }).failureThreshold = 2;

      // Force failures by disconnecting
      await testService.onModuleDestroy();

      // Try to make requests (should fail and open circuit)
      for (let i = 0; i < 3; i++) {
        try {
          await testService.evaluateCondition({
            conditionId: 'test',
            campaignId: 'test',
            branchId: 'main',
            contextJson: '{}',
            includeTrace: false,
          });
        } catch {
          // Expected to fail
        }
      }

      const state = testService.getCircuitState();
      expect(state.state).toBe('OPEN');
      expect(state.failureCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Disabled Worker', () => {
    it('should reject requests when disabled', async () => {
      // Create service with disabled flag
      process.env.RULES_ENGINE_ENABLED = 'false';

      const module: TestingModule = await Test.createTestingModule({
        providers: [RulesEngineClientService],
      }).compile();

      const disabledService = module.get<RulesEngineClientService>(RulesEngineClientService);

      await expect(
        disabledService.evaluateCondition({
          conditionId: 'test',
          campaignId: 'test',
          branchId: 'main',
          contextJson: '{}',
          includeTrace: false,
        })
      ).rejects.toThrow('Rules Engine worker integration is disabled');

      // Reset for other tests
      process.env.RULES_ENGINE_ENABLED = 'true';
    });

    it('should report unavailable when disabled', async () => {
      process.env.RULES_ENGINE_ENABLED = 'false';

      const module: TestingModule = await Test.createTestingModule({
        providers: [RulesEngineClientService],
      }).compile();

      const disabledService = module.get<RulesEngineClientService>(RulesEngineClientService);

      const isAvailable = await disabledService.isAvailable();
      expect(isAvailable).toBe(false);

      // Reset for other tests
      process.env.RULES_ENGINE_ENABLED = 'true';
    });
  });
});
