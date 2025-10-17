/**
 * Evaluation Engine Service
 * Core service for evaluating FieldCondition expressions using JSONLogic
 *
 * Stage 4: Integrated with DependencyGraphService for:
 * - Dependency-based evaluation ordering (topological sort)
 * - Cycle detection before evaluation
 * - Incremental recomputation tracking
 *
 * Stage 5: Integrated with CacheService for:
 * - Result caching with TTL-based expiration
 * - Cache lookup before evaluation
 * - Cache population after successful evaluation
 * - Trace requests bypass cache (for debugging)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import * as jsonLogic from 'json-logic-js';

import type { EvaluationResult, TraceStep } from '../generated/rules-engine.types';

import { CacheService } from './cache.service';
import { DependencyGraphService } from './dependency-graph.service';

/**
 * Service responsible for evaluating FieldCondition expressions
 */
@Injectable()
export class EvaluationEngineService {
  private readonly logger = new Logger(EvaluationEngineService.name);
  private readonly prisma: PrismaClient;

  constructor(
    private readonly graphService: DependencyGraphService,
    private readonly cacheService: CacheService
  ) {
    this.prisma = new PrismaClient();
  }

  /**
   * Lifecycle hook for cleanup
   */
  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  /**
   * Evaluate a single condition by ID
   *
   * Stage 5: Now includes caching support
   * - Checks cache before evaluation (unless includeTrace is true)
   * - Stores results in cache after successful evaluation
   * - Trace requests bypass cache for debugging purposes
   *
   * @param conditionId - ID of the FieldCondition to evaluate
   * @param context - Evaluation context (entity data)
   * @param campaignId - Campaign ID for cache key generation
   * @param branchId - Branch ID for cache key generation (defaults to 'main')
   * @param includeTrace - Whether to generate detailed trace (bypasses cache)
   * @returns Evaluation result with success status, value, and optional trace
   */
  async evaluateCondition(
    conditionId: string,
    context: Record<string, unknown>,
    campaignId: string,
    branchId: string = 'main',
    includeTrace: boolean = false
  ): Promise<EvaluationResult> {
    const startTime = Date.now();
    const trace: TraceStep[] = [];

    // Cache lookup (skip if trace requested)
    if (!includeTrace) {
      const cacheKey = {
        campaignId,
        branchId,
        nodeId: `CONDITION:${conditionId}`,
      };

      const cached = this.cacheService.get<EvaluationResult>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for condition ${conditionId}`);
        // Update evaluation time to reflect cache lookup time
        return {
          ...cached,
          evaluationTimeMs: Date.now() - startTime,
        };
      }
    }

    try {
      // Fetch the condition from database
      if (includeTrace) {
        trace.push({
          step: 1,
          description: 'Fetch condition from database',
          inputJson: JSON.stringify({ conditionId }),
          outputJson: null,
          passed: false, // Will update if successful
        });
      }

      const condition = await this.prisma.fieldCondition.findUnique({
        where: { id: conditionId, deletedAt: null },
      });

      if (!condition) {
        const error = `Condition not found: ${conditionId}`;
        this.logger.warn(error);

        if (includeTrace && trace.length > 0) {
          trace[trace.length - 1].outputJson = JSON.stringify({ error });
        }

        return {
          success: false,
          valueJson: null,
          error,
          trace,
          evaluationTimeMs: Date.now() - startTime,
        };
      }

      if (includeTrace && trace.length > 0) {
        trace[trace.length - 1].passed = true;
        trace[trace.length - 1].outputJson = JSON.stringify({
          conditionId: condition.id,
          field: condition.field,
          isActive: condition.isActive,
        });
      }

      // Check if condition is active
      if (!condition.isActive) {
        const error = `Condition is not active: ${conditionId}`;

        if (includeTrace) {
          trace.push({
            step: trace.length + 1,
            description: 'Check condition is active',
            inputJson: JSON.stringify({ isActive: condition.isActive }),
            outputJson: JSON.stringify({ error }),
            passed: false,
          });
        }

        return {
          success: false,
          valueJson: null,
          error,
          trace,
          evaluationTimeMs: Date.now() - startTime,
        };
      }

      if (includeTrace) {
        trace.push({
          step: trace.length + 1,
          description: 'Check condition is active',
          inputJson: JSON.stringify({ isActive: condition.isActive }),
          outputJson: JSON.stringify({ passed: true }),
          passed: true,
        });
      }

      // Validate expression
      if (includeTrace) {
        trace.push({
          step: trace.length + 1,
          description: 'Validate expression structure',
          inputJson: JSON.stringify(condition.expression),
          outputJson: null,
          passed: false,
        });
      }

      const validation = this.validateExpression(condition.expression);

      if (!validation.isValid) {
        const error = `Invalid expression: ${validation.errors.join(', ')}`;

        if (includeTrace && trace.length > 0) {
          trace[trace.length - 1].outputJson = JSON.stringify({
            isValid: false,
            errors: validation.errors,
          });
        }

        return {
          success: false,
          valueJson: null,
          error,
          trace,
          evaluationTimeMs: Date.now() - startTime,
        };
      }

      if (includeTrace && trace.length > 0) {
        trace[trace.length - 1].passed = true;
        trace[trace.length - 1].outputJson = JSON.stringify({ isValid: true });
      }

      // Build evaluation context
      if (includeTrace) {
        trace.push({
          step: trace.length + 1,
          description: 'Build evaluation context',
          inputJson: JSON.stringify({ contextKeys: Object.keys(context) }),
          outputJson: null,
          passed: false,
        });
      }

      const evalContext = this.buildContext(context);

      if (includeTrace && trace.length > 0) {
        trace[trace.length - 1].passed = true;
        trace[trace.length - 1].outputJson = JSON.stringify({
          contextKeys: Object.keys(evalContext),
        });
      }

      // Evaluate expression
      if (includeTrace) {
        trace.push({
          step: trace.length + 1,
          description: 'Evaluate JSONLogic expression',
          inputJson: JSON.stringify({ expression: condition.expression }),
          outputJson: null,
          passed: false,
        });
      }

      const result = this.evaluateExpression(condition.expression, evalContext);

      if (includeTrace && trace.length > 0) {
        trace[trace.length - 1].passed = result.success;
        trace[trace.length - 1].outputJson = JSON.stringify({
          success: result.success,
          value: result.value,
          error: result.error,
        });
      }

      // Extract and resolve variables for trace
      if (includeTrace && result.success) {
        const variables = this.extractVariables(condition.expression);
        if (variables.length > 0) {
          const resolvedVars: Record<string, unknown> = {};
          for (const varPath of variables) {
            resolvedVars[varPath] = this.resolveVariable(varPath, evalContext);
          }
          trace.push({
            step: trace.length + 1,
            description: 'Resolve variables',
            inputJson: JSON.stringify(variables),
            outputJson: JSON.stringify(resolvedVars),
            passed: true,
          });
        }
      }

      const evaluationResult: EvaluationResult = {
        success: result.success,
        valueJson: result.success ? JSON.stringify(result.value) : null,
        error: result.error || null,
        trace,
        evaluationTimeMs: Date.now() - startTime,
      };

      // Cache successful results (skip if trace requested)
      if (!includeTrace && result.success) {
        const cacheKey = {
          campaignId,
          branchId,
          nodeId: `CONDITION:${conditionId}`,
        };
        this.cacheService.set(cacheKey, evaluationResult);
        this.logger.debug(`Cached result for condition ${conditionId}`);
      }

      return evaluationResult;
    } catch (error) {
      this.logger.error('Condition evaluation failed', {
        conditionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (includeTrace) {
        trace.push({
          step: trace.length + 1,
          description: 'Error occurred',
          inputJson: null,
          outputJson: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
          passed: false,
        });
      }

      return {
        success: false,
        valueJson: null,
        error: error instanceof Error ? error.message : 'Unknown evaluation error',
        trace,
        evaluationTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Evaluate multiple conditions with dependency-based ordering
   *
   * Stage 4: Now uses dependency graph for topological ordering and cycle detection
   *
   * @param conditionIds - Array of FieldCondition IDs to evaluate
   * @param context - Evaluation context (entity data)
   * @param campaignId - Campaign ID for dependency graph lookup
   * @param branchId - Branch ID (defaults to 'main')
   * @param includeTrace - Whether to generate detailed traces
   * @returns Map of condition IDs to evaluation results
   */
  async evaluateConditions(
    conditionIds: string[],
    context: Record<string, unknown>,
    campaignId: string,
    branchId: string = 'main',
    includeTrace: boolean = false
  ): Promise<Record<string, EvaluationResult>> {
    const results: Record<string, EvaluationResult> = {};

    // If no conditions, return empty results
    if (conditionIds.length === 0) {
      return results;
    }

    try {
      // Get dependency graph for ordering
      const graph = await this.graphService.getGraph(campaignId, branchId);

      // Detect cycles before evaluation
      const cycleDetection = graph.detectCycles();
      if (cycleDetection.hasCycles) {
        this.logger.warn(
          `Dependency graph has ${cycleDetection.cycleCount} cycles. Evaluation may be incorrect.`,
          { cycles: cycleDetection.cycles }
        );
        // Continue with evaluation but log warning
      }

      // Get topological sort order
      const sortResult = graph.topologicalSort();

      // Convert condition IDs to node IDs (CONDITION:<id>)
      const conditionNodeIds = new Set(conditionIds.map((id) => `CONDITION:${id}`));

      // Filter evaluation order to only include requested conditions
      const orderedNodeIds = sortResult.order.filter((nodeId) => conditionNodeIds.has(nodeId));

      // Extract condition IDs from node IDs
      const orderedConditionIds = orderedNodeIds.map((nodeId) => nodeId.replace('CONDITION:', ''));

      this.logger.debug(`Evaluating ${orderedConditionIds.length} conditions in dependency order`, {
        requested: conditionIds.length,
        ordered: orderedConditionIds.length,
        hasCycles: cycleDetection.hasCycles,
      });

      // Evaluate conditions in topological order
      for (const conditionId of orderedConditionIds) {
        results[conditionId] = await this.evaluateCondition(
          conditionId,
          context,
          campaignId,
          branchId,
          includeTrace
        );
      }

      // Evaluate any remaining conditions that weren't in the graph
      // (This can happen if conditions haven't been added to the graph yet)
      for (const conditionId of conditionIds) {
        if (!results[conditionId]) {
          this.logger.debug(
            `Condition ${conditionId} not found in dependency graph, evaluating directly`
          );
          results[conditionId] = await this.evaluateCondition(
            conditionId,
            context,
            campaignId,
            branchId,
            includeTrace
          );
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Batch evaluation failed, falling back to sequential evaluation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        conditionCount: conditionIds.length,
      });

      // Fallback: evaluate sequentially without ordering
      for (const conditionId of conditionIds) {
        results[conditionId] = await this.evaluateCondition(
          conditionId,
          context,
          campaignId,
          branchId,
          includeTrace
        );
      }

      return results;
    }
  }

  /**
   * Evaluate a JSONLogic expression with the given context
   *
   * @param expression - The JSONLogic expression to evaluate
   * @param context - The data context for variable resolution
   * @returns The evaluation result with success status and value
   */
  private evaluateExpression(
    expression: Prisma.JsonValue,
    context: Record<string, unknown>
  ): { success: boolean; value: unknown; error?: string } {
    try {
      // Validate expression is not null/undefined
      if (expression === null || expression === undefined) {
        return {
          success: false,
          value: null,
          error: 'Expression cannot be null or undefined',
        };
      }

      // Validate context
      if (!context || typeof context !== 'object') {
        return {
          success: false,
          value: null,
          error: 'Context must be a valid object',
        };
      }

      // Use json-logic-js to evaluate the expression
      // Cast to unknown first, then to the expected type for json-logic-js
      const value = jsonLogic.apply(expression as unknown as jsonLogic.RulesLogic, context);

      return {
        success: true,
        value,
      };
    } catch (error) {
      this.logger.error('Expression evaluation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        value: null,
        error: error instanceof Error ? error.message : 'Unknown evaluation error',
      };
    }
  }

  /**
   * Build evaluation context from entity data
   * Formats data for JSONLogic variable access
   *
   * @param entity - The entity data to format
   * @returns Formatted context for evaluation
   */
  private buildContext(entity: Record<string, unknown>): Record<string, unknown> {
    // Entity data is already in the correct format for JSONLogic
    // Just ensure it's a proper object
    if (!entity || typeof entity !== 'object') {
      return {};
    }

    // Return as-is, JSONLogic will handle nested property access
    return entity;
  }

  /**
   * Validate a JSONLogic expression structure
   *
   * @param expression - The expression to validate
   * @returns Validation result with errors if any
   */
  private validateExpression(expression: Prisma.JsonValue): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      // Check for null/undefined
      if (expression === null || expression === undefined) {
        errors.push('Expression cannot be null or undefined');
        return { isValid: false, errors };
      }

      // Check if it's an object (JSONLogic expressions are objects)
      if (typeof expression !== 'object' || Array.isArray(expression)) {
        errors.push('Expression must be a valid object');
        return { isValid: false, errors };
      }

      // Check if expression has any operators (at least one key)
      const keys = Object.keys(expression);
      if (keys.length === 0) {
        errors.push('Expression must contain at least one operator');
        return { isValid: false, errors };
      }

      // Recursively validate nested expressions
      this.validateNestedExpression(expression, errors, 0, 10);

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown validation error');
      return { isValid: false, errors };
    }
  }

  /**
   * Recursively validate nested expression structure
   *
   * @param expr - Expression to validate
   * @param errors - Array to collect errors
   * @param depth - Current recursion depth
   * @param maxDepth - Maximum allowed recursion depth
   */
  private validateNestedExpression(
    expr: unknown,
    errors: string[],
    depth: number,
    maxDepth: number
  ): void {
    // Check max depth to prevent infinite recursion
    if (depth > maxDepth) {
      errors.push(`Expression exceeds maximum depth of ${maxDepth}`);
      return;
    }

    // If it's not an object, it's a value (valid)
    if (typeof expr !== 'object' || expr === null) {
      return;
    }

    // If it's an array, validate each element
    if (Array.isArray(expr)) {
      for (const item of expr) {
        this.validateNestedExpression(item, errors, depth + 1, maxDepth);
      }
      return;
    }

    // If it's an object, validate each value
    for (const value of Object.values(expr)) {
      this.validateNestedExpression(value, errors, depth + 1, maxDepth);
    }
  }

  /**
   * Extract variable paths from a JSONLogic expression
   *
   * @param expression - The expression to analyze
   * @returns Array of variable paths used in the expression
   */
  private extractVariables(expression: Prisma.JsonValue): string[] {
    const variables = new Set<string>();

    const extract = (expr: unknown): void => {
      if (!expr || typeof expr !== 'object') {
        return;
      }

      if (Array.isArray(expr)) {
        for (const item of expr) {
          extract(item);
        }
        return;
      }

      // Check for 'var' operator
      const obj = expr as Record<string, unknown>;
      if ('var' in obj) {
        const varPath = obj.var;
        if (typeof varPath === 'string') {
          variables.add(varPath);
        }
      }

      // Recursively check all values
      for (const value of Object.values(obj)) {
        extract(value);
      }
    };

    extract(expression);
    return Array.from(variables);
  }

  /**
   * Resolve a variable path in the given context
   *
   * @param varPath - Dot-notation path to resolve (e.g., "settlement.population")
   * @param context - The context to resolve from
   * @returns The resolved value or undefined
   */
  private resolveVariable(varPath: string, context: Record<string, unknown>): unknown {
    if (!varPath || typeof varPath !== 'string') {
      return undefined;
    }

    const parts = varPath.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
