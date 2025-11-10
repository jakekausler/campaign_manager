/**
 * @file Condition Evaluation Service
 *
 * Evaluates JSONLogic expressions for computed fields and conditional logic throughout the system.
 * Provides both simple evaluation and traced evaluation with debugging information.
 *
 * Core responsibilities:
 * - Execute JSONLogic expressions with entity context
 * - Resolve variables from entity data and StateVariables
 * - Validate expression structure before evaluation
 * - Generate detailed trace information for debugging
 * - Support priority-based evaluation ordering
 *
 * Used by:
 * - FieldCondition resolver for computed field calculation
 * - Rules engine worker for high-performance batch evaluation
 * - Variable evaluation service for derived variables
 * - Effect system for conditional state mutations
 *
 * @module ConditionEvaluationService
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ExpressionParserService } from '../../rules/expression-parser.service';
import type { Expression, EvaluationContext } from '../../rules/types/expression.types';
import type { EvaluationResult, EvaluationTrace } from '../types/field-condition.type';

import { VariableEvaluationService } from './variable-evaluation.service';

/**
 * Interface for traced evaluation steps.
 * Each step captures input, output, and success status for debugging.
 */
interface TraceStep {
  /** Human-readable description of the evaluation step */
  step: string;
  /** Input data provided to this step */
  input: unknown;
  /** Output data produced by this step */
  output: unknown;
  /** Whether this step succeeded */
  passed: boolean;
}

/**
 * Service responsible for evaluating FieldCondition expressions.
 *
 * Executes JSONLogic expressions with entity context to compute dynamic field values.
 * Supports variable resolution from both entity data and StateVariables, with
 * comprehensive validation and trace generation for debugging.
 *
 * Expression evaluation flow:
 * 1. Validate expression structure
 * 2. Build evaluation context from entity data
 * 3. Optionally fetch and merge StateVariables
 * 4. Execute JSONLogic expression via ExpressionParserService
 * 5. Return result with optional trace for debugging
 *
 * Variable resolution:
 * - Entity fields accessed directly: `{"var": "settlement.population"}`
 * - StateVariables accessed via namespace: `{"var": "var.treasury"}`
 * - Nested property access via dot notation: `{"var": "settlement.ruler.name"}`
 *
 * @example
 * ```typescript
 * // Simple evaluation
 * const result = service.evaluateExpression(
 *   { ">": [{ "var": "settlement.population" }, 1000] },
 *   { settlement: { population: 1500 } }
 * );
 * // result: { success: true, value: true }
 *
 * // Evaluation with StateVariables
 * const context = await service.buildContextWithVariables(
 *   { settlement: { population: 1500 } },
 *   { includeVariables: true, scope: 'settlement', scopeId: 'abc-123' }
 * );
 * const result = service.evaluateExpression(
 *   { "+": [{ "var": "var.treasury" }, { "var": "settlement.population" }] },
 *   context
 * );
 *
 * // Traced evaluation for debugging
 * const traced = service.evaluateWithTrace(expression, context);
 * // traced.trace contains step-by-step execution log
 * ```
 */
@Injectable()
export class ConditionEvaluationService {
  private readonly logger = new Logger(ConditionEvaluationService.name);

  /**
   * Creates a new ConditionEvaluationService.
   *
   * @param expressionParser - Service for parsing and executing JSONLogic expressions
   * @param prisma - Database service for fetching StateVariables
   * @param variableEvaluation - Service for evaluating derived StateVariables
   */
  constructor(
    private readonly expressionParser: ExpressionParserService,
    private readonly prisma: PrismaService,
    private readonly variableEvaluation: VariableEvaluationService
  ) {}

  /**
   * Evaluate a JSONLogic expression with the given context.
   *
   * Executes the expression using the ExpressionParserService and returns a typed result.
   * Validates inputs and provides detailed error information on failure.
   *
   * This is the primary evaluation method for computed fields. Use `evaluateWithTrace()`
   * when debugging is needed.
   *
   * @template T - The expected return type of the expression
   * @param expression - The JSONLogic expression to evaluate (Prisma JsonValue format)
   * @param context - The data context for variable resolution (entity data + StateVariables)
   * @returns Evaluation result with success status, typed value, and optional error message
   *
   * @example
   * ```typescript
   * // Boolean expression
   * const result = service.evaluateExpression<boolean>(
   *   { ">": [{ "var": "population" }, 1000] },
   *   { population: 1500 }
   * );
   * // result: { success: true, value: true }
   *
   * // Arithmetic expression
   * const result = service.evaluateExpression<number>(
   *   { "+": [{ "var": "base" }, { "var": "bonus" }] },
   *   { base: 100, bonus: 50 }
   * );
   * // result: { success: true, value: 150 }
   *
   * // Failed evaluation
   * const result = service.evaluateExpression(null, {});
   * // result: { success: false, value: null, error: 'Expression cannot be null or undefined' }
   * ```
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
   * Evaluate a JSONLogic expression with trace generation for debugging.
   *
   * Executes the expression while capturing detailed trace information at each step,
   * including validation, context building, variable resolution, and final evaluation.
   * Useful for debugging complex expressions or understanding evaluation failures.
   *
   * Each trace step includes:
   * - Description of the operation
   * - Input data for the step
   * - Output/result of the step
   * - Success/failure status
   *
   * @param expression - The JSONLogic expression to evaluate (Prisma JsonValue format)
   * @param context - The data context for variable resolution (entity data + StateVariables)
   * @returns Evaluation result with full trace of execution steps and optional error message
   *
   * @example
   * ```typescript
   * const result = service.evaluateWithTrace(
   *   { "and": [
   *     { ">": [{ "var": "population" }, 1000] },
   *     { "===": [{ "var": "status" }, "active"] }
   *   ]},
   *   { population: 1500, status: "active" }
   * );
   *
   * // result.trace will contain steps like:
   * // 1. Start evaluation
   * // 2. Validate expression structure
   * // 3. Build evaluation context
   * // 4. Evaluate expression
   * // 5. Resolve variables (population, status)
   * ```
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
   * Build evaluation context from entity data.
   *
   * Formats entity data into an EvaluationContext suitable for JSONLogic variable access.
   * The entity data is passed through as-is, as JSONLogic already supports nested
   * property access via dot notation.
   *
   * This is a basic context builder that only includes entity data. Use
   * `buildContextWithVariables()` to include StateVariables in the context.
   *
   * @param entity - The entity data to format (any record with string keys)
   * @returns Formatted context for evaluation, or empty object if invalid input
   *
   * @example
   * ```typescript
   * const context = service.buildContext({
   *   settlement: {
   *     name: "Rivertown",
   *     population: 1500,
   *     ruler: { name: "King Arthur" }
   *   }
   * });
   * // Access in expression: {"var": "settlement.population"}
   * // Access nested: {"var": "settlement.ruler.name"}
   * ```
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
   * Build evaluation context with StateVariable integration.
   *
   * Extends basic context building by fetching and merging StateVariables for the entity scope.
   * StateVariables are added under the 'var' namespace, allowing expressions to reference them
   * separately from entity fields.
   *
   * StateVariables are evaluated (including derived variables) before being merged into the context.
   * Failed variable evaluations are logged but do not fail the entire context build.
   *
   * Variable namespacing:
   * - Entity fields: `{"var": "settlement.population"}` (direct access)
   * - StateVariables: `{"var": "var.treasury"}` (under 'var' namespace)
   *
   * @param entity - The entity data to format (base context)
   * @param options - Options for context building
   * @param options.includeVariables - Whether to fetch and include StateVariables (default: false)
   * @param options.scope - Entity scope type (e.g., 'settlement', 'structure') - required if includeVariables is true
   * @param options.scopeId - Entity ID (UUID) - required if includeVariables is true
   * @returns Promise resolving to formatted context with variables merged under 'var' namespace
   *
   * @example
   * ```typescript
   * // Without variables (basic context)
   * const context = await service.buildContextWithVariables(
   *   { settlement: { population: 1500 } }
   * );
   * // context: { settlement: { population: 1500 } }
   *
   * // With variables (full context)
   * const context = await service.buildContextWithVariables(
   *   { settlement: { population: 1500 } },
   *   { includeVariables: true, scope: 'settlement', scopeId: 'abc-123' }
   * );
   * // context: {
   * //   settlement: { population: 1500 },
   * //   var: { treasury: 5000, militia: 200 }
   * // }
   *
   * // Expression can now reference both:
   * // { "+": [{ "var": "settlement.population" }, { "var": "var.militia" }] }
   * ```
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
   * Validate a JSONLogic expression structure.
   *
   * Performs comprehensive validation of expression structure including:
   * - Null/undefined checks
   * - Object type verification (JSONLogic expressions must be objects)
   * - Operator presence check (must have at least one operator)
   * - Recursive validation of nested expressions
   * - Maximum depth check to prevent infinite recursion
   *
   * Does not validate operator semantics or variable references, only structure.
   *
   * @param expression - The expression to validate (Prisma JsonValue format)
   * @returns Validation result with isValid flag and array of error messages
   *
   * @example
   * ```typescript
   * // Valid expression
   * const result = service.validateExpression({ ">": [{ "var": "x" }, 10] });
   * // result: { isValid: true, errors: [] }
   *
   * // Invalid: null expression
   * const result = service.validateExpression(null);
   * // result: { isValid: false, errors: ['Expression cannot be null or undefined'] }
   *
   * // Invalid: not an object
   * const result = service.validateExpression("string");
   * // result: { isValid: false, errors: ['Expression must be a valid object'] }
   *
   * // Invalid: empty object
   * const result = service.validateExpression({});
   * // result: { isValid: false, errors: ['Expression must contain at least one operator'] }
   * ```
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
   * Recursively validate nested expression structure.
   *
   * Traverses the expression tree to validate all nested expressions and values.
   * Checks for excessive nesting depth to prevent stack overflow attacks.
   *
   * Handles three cases:
   * - Primitive values: Valid leaf nodes (numbers, strings, booleans, null)
   * - Arrays: Validates each element recursively
   * - Objects: Validates each property value recursively
   *
   * @param expr - Expression or value to validate (any type, checked recursively)
   * @param errors - Array to collect error messages (mutated in place)
   * @param depth - Current recursion depth (starts at 0)
   * @param maxDepth - Maximum allowed recursion depth (default: 10)
   *
   * @example
   * ```typescript
   * // Called internally by validateExpression()
   * const errors: string[] = [];
   * this.validateNestedExpression(
   *   { "and": [{ ">": [{ "var": "x" }, 10] }, { "<": [{ "var": "y" }, 20] }] },
   *   errors,
   *   0,
   *   10
   * );
   * // errors will contain messages if structure is invalid
   * ```
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
   * Extract variable paths from a JSONLogic expression.
   *
   * Recursively traverses the expression tree to find all `{"var": "path"}` operators
   * and collects the variable paths. Used for trace generation to show which variables
   * were accessed during evaluation.
   *
   * Only extracts string variable paths, ignoring numeric array indices or complex
   * variable references.
   *
   * @param expression - The expression to analyze (Prisma JsonValue format)
   * @returns Array of unique variable paths found in the expression (deduplicated)
   *
   * @example
   * ```typescript
   * const vars = this.extractVariables({
   *   "and": [
   *     { ">": [{ "var": "settlement.population" }, 1000] },
   *     { "===": [{ "var": "settlement.status" }, "active"] },
   *     { ">=": [{ "var": "var.treasury" }, 500] }
   *   ]
   * });
   * // vars: ["settlement.population", "settlement.status", "var.treasury"]
   * ```
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
   * Resolve a variable path in the given context.
   *
   * Traverses the context object using dot notation to find the value at the specified path.
   * Returns undefined if any part of the path does not exist.
   *
   * Used internally for trace generation to show resolved variable values during debugging.
   *
   * @param varPath - Dot-notation path to resolve (e.g., "settlement.population", "var.treasury")
   * @param context - The context object to resolve from (entity data + StateVariables)
   * @returns The resolved value at the path, or undefined if path does not exist
   *
   * @example
   * ```typescript
   * const context = {
   *   settlement: { population: 1500, ruler: { name: "King Arthur" } },
   *   var: { treasury: 5000 }
   * };
   *
   * this.resolveVariable("settlement.population", context); // 1500
   * this.resolveVariable("settlement.ruler.name", context); // "King Arthur"
   * this.resolveVariable("var.treasury", context);          // 5000
   * this.resolveVariable("nonexistent.path", context);      // undefined
   * ```
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
   * Fetch StateVariables for a specific scope and scopeId.
   *
   * Queries the database for all active StateVariables matching the scope and scopeId,
   * then evaluates each variable (including derived variables with expressions) to
   * produce a key-value map suitable for merging into evaluation context.
   *
   * Error handling:
   * - Individual variable evaluation failures are logged but do not fail the entire fetch
   * - Database query failures return empty object and log error
   * - This ensures partial variable availability doesn't break expression evaluation
   *
   * @param scope - The entity scope type (e.g., 'settlement', 'structure', 'character')
   * @param scopeId - The specific entity ID (UUID)
   * @returns Promise resolving to key-value map of variable keys to evaluated values
   *
   * @example
   * ```typescript
   * // Fetch variables for a settlement
   * const vars = await this.fetchScopeVariables('settlement', 'abc-123');
   * // vars: { treasury: 5000, militia: 200, tax_rate: 0.15 }
   *
   * // Variables with failed evaluations are omitted from result
   * // Errors are logged but don't throw exceptions
   * ```
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
