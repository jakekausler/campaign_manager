import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

import {
  CacheStatsResponse,
  EvaluateConditionRequest,
  EvaluateConditionsRequest,
  EvaluateConditionsResponse,
  EvaluationOrderResponse,
  EvaluationResult,
  GetCacheStatsRequest,
  GetEvaluationOrderRequest,
  InvalidateCacheRequest,
  InvalidateCacheResponse,
  ValidateDependenciesRequest,
  ValidationResult,
} from '../generated/rules-engine.types';
import { CacheService } from '../services/cache.service';
import { DependencyGraphService } from '../services/dependency-graph.service';
import { EvaluationEngineService } from '../services/evaluation-engine.service';
import { MetricsService } from '../services/metrics.service';

/**
 * gRPC Controller for Rules Engine Service
 *
 * Handles all gRPC method calls defined in proto/rules-engine.proto
 * Stage 3: Implemented evaluation methods using EvaluationEngineService
 * Stage 4: Integrated DependencyGraphService for ordering and validation
 * Stage 5: Integrated CacheService for evaluation result caching
 * Stage 8: Added MetricsService for performance monitoring
 */
@Controller()
export class RulesEngineController {
  private readonly logger = new Logger(RulesEngineController.name);

  constructor(
    private readonly evaluationEngine: EvaluationEngineService,
    private readonly graphService: DependencyGraphService,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService
  ) {}

  /**
   * Evaluate a single condition with provided context
   * Stage 5: Now passes campaignId/branchId for caching support
   * Stage 8: Added metrics tracking for monitoring
   */
  @GrpcMethod('RulesEngine', 'EvaluateCondition')
  async evaluateCondition(request: EvaluateConditionRequest): Promise<EvaluationResult> {
    this.logger.debug(`EvaluateCondition called for condition ${request.conditionId}`);

    const startTime = Date.now();

    try {
      // Parse context from JSON string
      const context = JSON.parse(request.contextJson);

      // Use evaluation engine to evaluate the condition
      const result = await this.evaluationEngine.evaluateCondition(
        request.conditionId,
        context,
        request.campaignId,
        request.branchId || 'main',
        request.includeTrace
      );

      // Record metrics
      if (result.success) {
        this.metricsService.recordEvaluationSuccess(result.evaluationTimeMs);
      } else {
        this.metricsService.recordEvaluationFailure(result.evaluationTimeMs);
      }

      // Record cache hit/miss based on evaluation time
      // (cached results typically take <5ms)
      if (result.evaluationTimeMs < 5) {
        this.metricsService.recordCacheHit();
      } else {
        this.metricsService.recordCacheMiss();
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordEvaluationFailure(duration);
      this.metricsService.recordCacheMiss();

      this.logger.error('EvaluateCondition failed', {
        conditionId: request.conditionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        valueJson: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        trace: [],
        evaluationTimeMs: duration,
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
   * Stage 4: Implemented dependency graph cache invalidation
   * Stage 5: Added evaluation result cache invalidation
   */
  @GrpcMethod('RulesEngine', 'InvalidateCache')
  async invalidateCache(request: InvalidateCacheRequest): Promise<InvalidateCacheResponse> {
    this.logger.debug(`InvalidateCache called for campaign ${request.campaignId}`);

    try {
      let totalInvalidated = 0;

      // Invalidate dependency graph cache
      this.graphService.invalidateGraph(request.campaignId, request.branchId || 'main');
      totalInvalidated++;

      // Invalidate evaluation result cache
      // If specific nodeIds provided, invalidate only those
      if (request.nodeIds && request.nodeIds.length > 0) {
        for (const nodeId of request.nodeIds) {
          const deleted = this.cacheService.invalidate({
            campaignId: request.campaignId,
            branchId: request.branchId || 'main',
            nodeId,
          });
          totalInvalidated += deleted;
        }
      } else {
        // Otherwise, invalidate all evaluation results for campaign/branch
        const deleted = this.cacheService.invalidateByPrefix(
          request.campaignId,
          request.branchId || 'main'
        );
        totalInvalidated += deleted;
      }

      return {
        invalidatedCount: totalInvalidated,
        message: `Successfully invalidated ${totalInvalidated} cache entries for campaign ${request.campaignId}, branch ${request.branchId || 'main'}`,
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

  /**
   * Get cache statistics for monitoring
   * Stage 5: Implemented to expose cache performance metrics
   *
   * Security: Requires campaignId to prevent information disclosure.
   * Without campaign scoping, a user could see cache keys from all campaigns.
   */
  @GrpcMethod('RulesEngine', 'GetCacheStats')
  async getCacheStats(request: GetCacheStatsRequest): Promise<CacheStatsResponse> {
    this.logger.debug('GetCacheStats called', { campaignId: request.campaignId });

    try {
      const stats = this.cacheService.getStats();

      let sampleKeys: string[] = [];

      // Security: Require campaignId to prevent information disclosure
      // Without this, users could see cache keys from campaigns they don't have access to
      if (!request.campaignId) {
        this.logger.warn('GetCacheStats called without campaignId - returning global stats only');
        return {
          hits: stats.hits,
          misses: stats.misses,
          keys: stats.keys,
          ksize: stats.ksize,
          vsize: stats.vsize,
          hitRate: stats.hitRate,
          sampleKeys: [], // No sample keys without campaign scope for security
        };
      }

      // TODO: Add campaign access verification here when auth is implemented in Stage 7
      // await this.verifyUserHasCampaignAccess(userId, request.campaignId);

      // Get sample keys filtered by campaign/branch
      sampleKeys = this.cacheService.keysByPrefix(request.campaignId, request.branchId);

      // Limit sample to first 10 keys to avoid large responses
      const MAX_SAMPLE_KEYS = 10;
      sampleKeys = sampleKeys.slice(0, MAX_SAMPLE_KEYS);

      return {
        hits: stats.hits,
        misses: stats.misses,
        keys: stats.keys,
        ksize: stats.ksize,
        vsize: stats.vsize,
        hitRate: stats.hitRate,
        sampleKeys,
      };
    } catch (error) {
      this.logger.error('GetCacheStats failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return zero stats on error
      return {
        hits: 0,
        misses: 0,
        keys: 0,
        ksize: 0,
        vsize: 0,
        hitRate: 0,
        sampleKeys: [],
      };
    }
  }
}
