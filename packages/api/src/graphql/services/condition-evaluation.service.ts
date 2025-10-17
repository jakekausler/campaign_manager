/**
 * Condition Evaluation Service
 * Service for evaluating JSONLogic expressions for FieldCondition entities
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ExpressionParserService } from '../../rules/expression-parser.service';
import type { Expression, EvaluationContext } from '../../rules/types/expression.types';
import type { EvaluationResult, EvaluationTrace } from '../types/field-condition.type';

import { VariableEvaluationService } from './variable-evaluation.service';

/**
 * Interface for traced evaluation steps
 */
interface TraceStep {
  step: string;
  input: unknown;
  output: unknown;
  passed: boolean;
}

/**
 * Service responsible for evaluating FieldCondition expressions
 */
@Injectable()
export class ConditionEvaluationService {
  private readonly logger = new Logger(ConditionEvaluationService.name);

  constructor(
    private readonly expressionParser: ExpressionParserService,
    private readonly prisma: PrismaService,
    private readonly variableEvaluation: VariableEvaluationService
  ) {}

  /**
   * Evaluate a JSONLogic expression with the given context
   *
   * @param expression - The JSONLogic expression to evaluate
   * @param context - The data context for variable resolution
   * @returns The evaluation result with success status and value
   */
  evaluateExpression<T = unknown>(
    expression: Prisma.JsonValue,
    context: Record<string, unknown>
  ): { success: boolean; value: T | null; error?: string } {
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

      // Convert Prisma JsonValue to Expression type
      const expr = expression as Expression;

      // Build evaluation context
      const evalContext: EvaluationContext = this.buildContext(context);

      // Use expression parser to evaluate
      const result = this.expressionParser.evaluate<T>(expr, evalContext);

      return {
        success: result.success,
        value: result.value,
        error: result.error,
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
   * Evaluate a JSONLogic expression with trace generation for debugging
   *
   * @param expression - The JSONLogic expression to evaluate
   * @param context - The data context for variable resolution
   * @returns Evaluation result with full trace of steps
   */
  evaluateWithTrace(
    expression: Prisma.JsonValue,
    context: Record<string, unknown>
  ): EvaluationResult {
    const trace: TraceStep[] = [];

    try {
      // Add initial trace step
      trace.push({
        step: 'Start evaluation',
        input: expression,
        output: null,
        passed: true,
      });

      // Validate expression
      const validationResult = this.validateExpression(expression);
      trace.push({
        step: 'Validate expression structure',
        input: expression,
        output: validationResult,
        passed: validationResult.isValid,
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          value: null,
          trace: trace as EvaluationTrace[],
          error: validationResult.errors.join(', '),
        };
      }

      // Build context
      const evalContext = this.buildContext(context);
      trace.push({
        step: 'Build evaluation context',
        input: context,
        output: evalContext,
        passed: true,
      });

      // Evaluate expression
      const result = this.evaluateExpression(expression, context);
      trace.push({
        step: 'Evaluate expression',
        input: { expression, context: evalContext },
        output: result.value,
        passed: result.success,
      });

      // Add variable resolution trace
      const variables = this.extractVariables(expression);
      if (variables.length > 0) {
        const resolvedVars: Record<string, unknown> = {};
        for (const varPath of variables) {
          resolvedVars[varPath] = this.resolveVariable(varPath, evalContext);
        }
        trace.push({
          step: 'Resolve variables',
          input: variables,
          output: resolvedVars,
          passed: true,
        });
      }

      return {
        success: result.success,
        value: result.value,
        trace: trace as EvaluationTrace[],
        error: result.error,
      };
    } catch (error) {
      trace.push({
        step: 'Error occurred',
        input: expression,
        output: error instanceof Error ? error.message : 'Unknown error',
        passed: false,
      });

      return {
        success: false,
        value: null,
        trace: trace as EvaluationTrace[],
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
  buildContext(entity: Record<string, unknown>): EvaluationContext {
    // Entity data is already in the correct format for JSONLogic
    // Just ensure it's a proper object
    if (!entity || typeof entity !== 'object') {
      return {};
    }

    // Return as-is, JSONLogic will handle nested property access
    return entity as EvaluationContext;
  }

  /**
   * Build evaluation context with StateVariable integration
   * Fetches and merges StateVariables for the entity scope
   *
   * @param entity - The entity data to format
   * @param options - Options for context building
   * @param options.includeVariables - Whether to fetch and include StateVariables (default: false)
   * @param options.scope - Entity scope type (required if includeVariables is true)
   * @param options.scopeId - Entity ID (required if includeVariables is true)
   * @returns Formatted context with variables merged in
   */
  async buildContextWithVariables(
    entity: Record<string, unknown>,
    options: {
      includeVariables?: boolean;
      scope?: string;
      scopeId?: string;
    } = {}
  ): Promise<EvaluationContext> {
    // Start with basic context
    const context = this.buildContext(entity);

    // If includeVariables is false or not specified, return basic context
    if (!options.includeVariables) {
      return context;
    }

    // Validate scope and scopeId are provided
    if (!options.scope || !options.scopeId) {
      this.logger.warn(
        'includeVariables is true but scope or scopeId not provided, skipping variable fetch'
      );
      return context;
    }

    // Fetch variables for this scope
    const variables = await this.fetchScopeVariables(options.scope, options.scopeId);

    // If no variables found, return context as-is
    if (Object.keys(variables).length === 0) {
      return context;
    }

    // Merge variables into context under 'var' namespace
    // This allows conditions to reference variables via var.{key}
    return {
      ...context,
      var: variables,
    };
  }

  /**
   * Validate a JSONLogic expression structure
   *
   * @param expression - The expression to validate
   * @returns Validation result with errors if any
   */
  validateExpression(expression: Prisma.JsonValue): {
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
  private resolveVariable(varPath: string, context: EvaluationContext): unknown {
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

  /**
   * Fetch StateVariables for a specific scope and scopeId
   * Evaluates derived variables and returns key-value map
   *
   * @param scope - The entity scope type (settlement, structure, etc.)
   * @param scopeId - The specific entity ID
   * @returns Key-value map of variable names to evaluated values
   */
  private async fetchScopeVariables(
    scope: string,
    scopeId: string
  ): Promise<Record<string, unknown>> {
    try {
      // Fetch all active variables for this scope
      const variables = await this.prisma.stateVariable.findMany({
        where: {
          scope: scope.toLowerCase(),
          scopeId,
          isActive: true,
          deletedAt: null,
        },
      });

      if (variables.length === 0) {
        return {};
      }

      // Build key-value map
      const variableMap: Record<string, unknown> = {};

      for (const variable of variables) {
        try {
          // Evaluate the variable (handles both stored and derived)
          const result = await this.variableEvaluation.evaluateVariable(
            variable,
            {} // Empty additional context - variable should have all needed data
          );

          if (result.success && result.value !== undefined) {
            variableMap[variable.key] = result.value;
          }
        } catch (error) {
          // Log error but continue processing other variables
          this.logger.error(
            `Failed to evaluate variable ${variable.key} for scope ${scope}:${scopeId}`,
            error instanceof Error ? error.stack : undefined
          );
        }
      }

      return variableMap;
    } catch (error) {
      // Log error but return empty object - don't fail the whole evaluation
      this.logger.error(
        `Failed to fetch scope variables for ${scope}:${scopeId}`,
        error instanceof Error ? error.stack : undefined
      );
      return {};
    }
  }
}
