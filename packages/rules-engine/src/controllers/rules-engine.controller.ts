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
import { DependencyGraphService } from '../services/dependency-graph.service';
import { EvaluationEngineService } from '../services/evaluation-engine.service';

/**
 * gRPC Controller for Rules Engine Service
 *
 * Handles all gRPC method calls defined in proto/rules-engine.proto
 * Stage 3: Implemented evaluation methods using EvaluationEngineService
 * Stage 4: Integrated DependencyGraphService for ordering and validation
 */
@Controller()
export class RulesEngineController {
  private readonly logger = new Logger(RulesEngineController.name);

  constructor(
    private readonly evaluationEngine: EvaluationEngineService,
    private readonly graphService: DependencyGraphService
  ) {}

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
   * Stage 4: Now uses dependency graph for proper evaluation ordering
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

      // Use evaluation engine with dependency ordering
      const results = await this.evaluationEngine.evaluateConditions(
        request.conditionIds,
        context,
        request.campaignId,
        request.branchId || 'main',
        request.includeTrace
      );

      // Get actual evaluation order from dependency graph if requested
      let evaluationOrder = request.conditionIds;
      if (request.useDependencyOrder) {
        try {
          const graph = await this.graphService.getGraph(
            request.campaignId,
            request.branchId || 'main'
          );
          const sortResult = graph.topologicalSort();
          const conditionNodeIds = new Set(request.conditionIds.map((id) => `CONDITION:${id}`));
          evaluationOrder = sortResult.order
            .filter((nodeId) => conditionNodeIds.has(nodeId))
            .map((nodeId) => nodeId.replace('CONDITION:', ''));
        } catch (error) {
          this.logger.warn('Failed to get evaluation order from graph, using request order', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        results,
        totalEvaluationTimeMs: Date.now() - startTime,
        evaluationOrder,
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
   * Stage 4: Implemented using DependencyGraphService
   */
  @GrpcMethod('RulesEngine', 'GetEvaluationOrder')
  async getEvaluationOrder(request: GetEvaluationOrderRequest): Promise<EvaluationOrderResponse> {
    this.logger.debug(`GetEvaluationOrder called for campaign ${request.campaignId}`);

    try {
      const sortResult = await this.graphService.getEvaluationOrder(
        request.campaignId,
        request.branchId || 'main'
      );

      // Filter to only requested conditions if provided
      let nodeIds = sortResult.order;
      if (request.conditionIds && request.conditionIds.length > 0) {
        const conditionNodeIds = new Set(request.conditionIds.map((id) => `CONDITION:${id}`));
        nodeIds = sortResult.order.filter((nodeId) => conditionNodeIds.has(nodeId));
      }

      return {
        nodeIds,
        totalNodes: nodeIds.length,
      };
    } catch (error) {
      this.logger.error('GetEvaluationOrder failed', {
        campaignId: request.campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        nodeIds: [],
        totalNodes: 0,
      };
    }
  }

  /**
   * Validate dependency graph for cycles
   * Stage 4: Implemented using DependencyGraphService
   */
  @GrpcMethod('RulesEngine', 'ValidateDependencies')
  async validateDependencies(request: ValidateDependenciesRequest): Promise<ValidationResult> {
    this.logger.debug(`ValidateDependencies called for campaign ${request.campaignId}`);

    try {
      const cycleDetection = await this.graphService.validateNoCycles(
        request.campaignId,
        request.branchId || 'main'
      );

      return {
        hasCycle: cycleDetection.hasCycles,
        cycles: cycleDetection.cycles.map((cycle) => cycle.path.join(' -> ')),
        message: cycleDetection.hasCycles
          ? `Detected ${cycleDetection.cycleCount} cycle(s) in dependency graph`
          : 'No cycles detected in dependency graph',
      };
    } catch (error) {
      this.logger.error('ValidateDependencies failed', {
        campaignId: request.campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        hasCycle: false,
        cycles: [],
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Invalidate cache for specific campaign/branch
   * Stage 4: Implemented using DependencyGraphService
   */
  @GrpcMethod('RulesEngine', 'InvalidateCache')
  async invalidateCache(request: InvalidateCacheRequest): Promise<InvalidateCacheResponse> {
    this.logger.debug(`InvalidateCache called for campaign ${request.campaignId}`);

    try {
      this.graphService.invalidateGraph(request.campaignId, request.branchId || 'main');

      return {
        invalidatedCount: 1,
        message: `Successfully invalidated cache for campaign ${request.campaignId}, branch ${request.branchId || 'main'}`,
      };
    } catch (error) {
      this.logger.error('InvalidateCache failed', {
        campaignId: request.campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        invalidatedCount: 0,
        message: `Cache invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
