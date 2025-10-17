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

/**
 * gRPC Controller for Rules Engine Service
 *
 * Handles all gRPC method calls defined in proto/rules-engine.proto
 * Implements stubs for Stage 2, full implementation in Stage 3+
 */
@Controller()
export class RulesEngineController {
  private readonly logger = new Logger(RulesEngineController.name);

  /**
   * Evaluate a single condition with provided context
   */
  @GrpcMethod('RulesEngine', 'EvaluateCondition')
  async evaluateCondition(request: EvaluateConditionRequest): Promise<EvaluationResult> {
    this.logger.debug(`EvaluateCondition called for condition ${request.conditionId}`);

    // Stub implementation - will be implemented in Stage 3
    return {
      success: true,
      valueJson: JSON.stringify(true),
      error: null,
      trace: [],
      evaluationTimeMs: 0,
    };
  }

  /**
   * Evaluate multiple conditions in batch
   */
  @GrpcMethod('RulesEngine', 'EvaluateConditions')
  async evaluateConditions(
    request: EvaluateConditionsRequest
  ): Promise<EvaluateConditionsResponse> {
    this.logger.debug(`EvaluateConditions called for ${request.conditionIds.length} conditions`);

    // Stub implementation - will be implemented in Stage 3
    const results: Record<string, EvaluationResult> = {};
    for (const conditionId of request.conditionIds) {
      results[conditionId] = {
        success: true,
        valueJson: JSON.stringify(true),
        error: null,
        trace: [],
        evaluationTimeMs: 0,
      };
    }

    return {
      results,
      totalEvaluationTimeMs: 0,
      evaluationOrder: request.conditionIds,
    };
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
