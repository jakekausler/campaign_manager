import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

import {
  EvaluateConditionRequest,
  EvaluateConditionsRequest,
  EvaluateConditionsResponse,
  EvaluationOrderResponse,
  EvaluationResult,
  GetEvaluationOrderRequest,
  InvalidateCacheRequest,
  InvalidateCacheResponse,
  ValidateDependenciesRequest,
  ValidationResult,
} from '../generated/rules-engine.types';
import { EvaluationEngineService } from '../services/evaluation-engine.service';

/**
 * gRPC Controller for Rules Engine Service
 *
 * Handles all gRPC method calls defined in proto/rules-engine.proto
 * Stage 3: Implemented evaluation methods using EvaluationEngineService
 */
@Controller()
export class RulesEngineController {
  private readonly logger = new Logger(RulesEngineController.name);

  constructor(private readonly evaluationEngine: EvaluationEngineService) {}

  /**
   * Evaluate a single condition with provided context
   */
  @GrpcMethod('RulesEngine', 'EvaluateCondition')
  async evaluateCondition(request: EvaluateConditionRequest): Promise<EvaluationResult> {
    this.logger.debug(`EvaluateCondition called for condition ${request.conditionId}`);

    try {
      // Parse context from JSON string
      const context = JSON.parse(request.contextJson);

      // Use evaluation engine to evaluate the condition
      const result = await this.evaluationEngine.evaluateCondition(
        request.conditionId,
        context,
        request.includeTrace
      );

      return result;
    } catch (error) {
      this.logger.error('EvaluateCondition failed', {
        conditionId: request.conditionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        valueJson: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        trace: [],
        evaluationTimeMs: 0,
      };
    }
  }

  /**
   * Evaluate multiple conditions in batch
   */
  @GrpcMethod('RulesEngine', 'EvaluateConditions')
  async evaluateConditions(
    request: EvaluateConditionsRequest
  ): Promise<EvaluateConditionsResponse> {
    this.logger.debug(`EvaluateConditions called for ${request.conditionIds.length} conditions`);

    const startTime = Date.now();

    try {
      // Parse context from JSON string
      const context = JSON.parse(request.contextJson);

      // Use evaluation engine to evaluate all conditions
      const results = await this.evaluationEngine.evaluateConditions(
        request.conditionIds,
        context,
        request.includeTrace
      );

      // Note: useDependencyOrder will be implemented in Stage 4 with DependencyGraphService
      // For now, evaluations are sequential in the order provided

      return {
        results,
        totalEvaluationTimeMs: Date.now() - startTime,
        evaluationOrder: request.conditionIds,
      };
    } catch (error) {
      this.logger.error('EvaluateConditions failed', {
        conditionCount: request.conditionIds.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return empty results on error
      return {
        results: {},
        totalEvaluationTimeMs: Date.now() - startTime,
        evaluationOrder: [],
      };
    }
  }

  /**
   * Get topological evaluation order for conditions
   */
  @GrpcMethod('RulesEngine', 'GetEvaluationOrder')
  async getEvaluationOrder(request: GetEvaluationOrderRequest): Promise<EvaluationOrderResponse> {
    this.logger.debug(`GetEvaluationOrder called for campaign ${request.campaignId}`);

    // Stub implementation - will be implemented in Stage 4
    return {
      nodeIds: request.conditionIds || [],
      totalNodes: request.conditionIds?.length || 0,
    };
  }

  /**
   * Validate dependency graph for cycles
   */
  @GrpcMethod('RulesEngine', 'ValidateDependencies')
  async validateDependencies(request: ValidateDependenciesRequest): Promise<ValidationResult> {
    this.logger.debug(`ValidateDependencies called for campaign ${request.campaignId}`);

    // Stub implementation - will be implemented in Stage 4
    return {
      hasCycle: false,
      cycles: [],
      message: 'No cycles detected (stub implementation)',
    };
  }

  /**
   * Invalidate cache for specific campaign/branch
   */
  @GrpcMethod('RulesEngine', 'InvalidateCache')
  async invalidateCache(request: InvalidateCacheRequest): Promise<InvalidateCacheResponse> {
    this.logger.debug(`InvalidateCache called for campaign ${request.campaignId}`);

    // Stub implementation - will be implemented in Stage 5
    return {
      invalidatedCount: 0,
      message: 'Cache invalidation not yet implemented (stub)',
    };
  }
}
