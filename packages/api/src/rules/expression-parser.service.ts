/**
 * @fileoverview Expression Parser Service for JSONLogic expression parsing and evaluation
 *
 * This service provides the core functionality for parsing, validating, and evaluating
 * JSONLogic expressions used throughout the campaign management system. It handles:
 * - Expression validation and caching
 * - Custom operator registration and application
 * - Safe evaluation with error handling and logging
 * - Context-based variable resolution
 *
 * JSONLogic expressions are used for:
 * - Dynamic computed fields on entities
 * - Conditional logic for rules and triggers
 * - Formula-based calculations for stats and attributes
 * - Event and encounter availability conditions
 *
 * The service integrates with the OperatorRegistry to support custom operators
 * and uses ExpressionCache for performance optimization.
 *
 * @module rules/expression-parser.service
 * @see {@link https://jsonlogic.com/} JSONLogic specification
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as jsonLogic from 'json-logic-js';

import { ExpressionCache } from './cache/expression-cache';
import { OperatorRegistry } from './operator-registry';
import type {
  EvaluateOptions,
  Expression,
  EvaluationContext,
  EvaluationResult,
} from './types/expression.types';

/**
 * Service for parsing and evaluating JSONLogic expressions with custom operator support
 *
 * This service acts as the primary interface for working with JSONLogic expressions
 * in the campaign management system. It provides:
 * - Expression validation to prevent null/undefined values
 * - Optional caching for frequently used expressions
 * - Custom operator integration via OperatorRegistry
 * - Safe evaluation with comprehensive error handling
 * - Structured result format with success/error states
 *
 * **Usage Example:**
 * ```typescript
 * const expression = { ">=": [{ "var": "character.level" }, 5] };
 * const context = { character: { level: 7 } };
 * const result = parserService.evaluate(expression, context);
 * // result: { success: true, value: true }
 * ```
 *
 * **Custom Operators:**
 * The service automatically loads custom operators from OperatorRegistry
 * before evaluation, enabling domain-specific logic like:
 * - `hasItem`: Check character inventory
 * - `inRadius`: Spatial distance calculations
 * - `questComplete`: Campaign progression checks
 *
 * **Caching Strategy:**
 * Expressions are cached by default to avoid redundant parsing and key generation.
 * Disable caching for dynamic or one-time expressions using `{ useCache: false }`.
 *
 * @injectable
 */
@Injectable()
export class ExpressionParserService {
  private readonly logger = new Logger(ExpressionParserService.name);

  /**
   * Creates an instance of ExpressionParserService
   *
   * @param operatorRegistry - Registry of custom JSONLogic operators
   * @param expressionCache - Cache for parsed expressions to improve performance
   */
  constructor(
    private readonly operatorRegistry: OperatorRegistry,
    private readonly expressionCache: ExpressionCache
  ) {}

  /**
   * Parses and validates a JSONLogic expression with optional caching
   *
   * This method performs validation and caching of JSONLogic expressions.
   * Currently, JSONLogic expressions are already in the correct format (plain objects),
   * so parsing is primarily a validation and caching step. Future enhancements may
   * include syntax validation, optimization, or transformation.
   *
   * **Caching Behavior:**
   * - By default, expressions are cached using a generated key
   * - Subsequent calls with the same expression return the cached value
   * - Caching can be disabled via `options.useCache = false`
   * - Cache keys are generated from the expression structure
   *
   * **Validation:**
   * - Throws if expression is null or undefined
   * - Future: Could validate JSONLogic syntax, check for unsupported operators
   *
   * **Usage Example:**
   * ```typescript
   * const expr = { "==": [{ "var": "status" }, "active"] };
   * const parsed = parserService.parse(expr); // Validates and caches
   * const parsed2 = parserService.parse(expr); // Returns cached version
   * ```
   *
   * @param expression - The JSONLogic expression to parse (plain object or primitive)
   * @param options - Parse options for controlling cache behavior
   * @param options.useCache - Whether to use caching (default: true)
   * @returns The parsed expression (currently identical to input after validation)
   * @throws {BadRequestException} If expression is null or undefined
   */
  parse(expression: Expression, options: EvaluateOptions = {}): Expression {
    // Basic validation to prevent null/undefined expressions
    if (expression === null || expression === undefined) {
      throw new BadRequestException('Expression cannot be null or undefined');
    }

    // Use cache if enabled (default: true for backward compatibility)
    const useCache = options.useCache !== false;

    if (useCache) {
      const cacheKey = this.expressionCache.generateKey(expression);
      const cached = this.expressionCache.get(cacheKey);

      if (cached !== undefined) {
        return cached;
      }

      // Not in cache - cache it for next time
      this.expressionCache.set(cacheKey, expression);
    }

    // Return the expression as-is
    return expression;
  }

  /**
   * Evaluates a JSONLogic expression with the given context and custom operators
   *
   * This method is the core evaluation engine for all JSONLogic expressions in the system.
   * It safely evaluates expressions using the json-logic-js library with support for
   * custom operators registered via OperatorRegistry.
   *
   * **Evaluation Process:**
   * 1. Retrieves all custom operators from the registry
   * 2. Registers custom operators with the JSONLogic engine
   * 3. Evaluates the expression with the provided context
   * 4. Returns a structured result with success/failure status
   *
   * **Context Variables:**
   * The context object contains all data accessible to the expression via `var` operations.
   * Common context properties include:
   * - `character`: Character stats, inventory, position
   * - `world`: World state, time, flags
   * - `event`: Event-specific data (in event conditions)
   * - `encounter`: Encounter-specific data (in encounter conditions)
   *
   * **Error Handling:**
   * - All errors are caught and returned in the result object
   * - Errors are logged with expression type and context keys (not values)
   * - Sensitive data in context is never logged
   * - Returns `{ success: false, value: null, error: string }`
   *
   * **Custom Operators:**
   * Custom operators are automatically loaded and can be used like built-in operators:
   * ```typescript
   * const expr = { "hasItem": ["character.inventory", "magic_sword"] };
   * const result = evaluate(expr, { character: { inventory: [...] } });
   * ```
   *
   * **Type Safety:**
   * The generic type parameter `T` indicates the expected return type:
   * ```typescript
   * const result = evaluate<boolean>(conditionExpr, context);
   * // result.value is typed as boolean
   * ```
   *
   * **Usage Examples:**
   * ```typescript
   * // Simple comparison
   * const expr = { ">": [{ "var": "level" }, 5] };
   * const result = evaluate<boolean>(expr, { level: 7 });
   * // result: { success: true, value: true }
   *
   * // Complex nested logic
   * const expr = {
   *   "and": [
   *     { ">=": [{ "var": "character.level" }, 10] },
   *     { "hasItem": ["character.inventory", "quest_item"] }
   *   ]
   * };
   * const result = evaluate<boolean>(expr, {
   *   character: { level: 12, inventory: ["quest_item", "sword"] }
   * });
   * // result: { success: true, value: true }
   * ```
   *
   * @template T - The expected type of the evaluation result value
   * @param expression - The JSONLogic expression to evaluate (object or primitive)
   * @param context - The data context for variable resolution (default: empty object)
   * @returns Evaluation result containing success status, value, and optional error message
   * @returns Returns `{ success: true, value: T }` on successful evaluation
   * @returns Returns `{ success: false, value: null, error: string }` on error
   */
  evaluate<T = unknown>(
    expression: Expression,
    context: EvaluationContext = {}
  ): EvaluationResult<T> {
    try {
      // Get custom operators from the registry
      const customOperators = this.operatorRegistry.getOperatorMap();

      // Add custom operators to JSONLogic before evaluation
      for (const [name, implementation] of Object.entries(customOperators)) {
        jsonLogic.add_operation(name, implementation);
      }

      // Use json-logic-js to evaluate the expression
      const value = jsonLogic.apply(expression, context) as T;

      return {
        success: true,
        value,
      };
    } catch (error) {
      // Log the error for debugging (without sensitive context values)
      this.logger.error('Expression evaluation failed', {
        expressionType: typeof expression,
        contextKeys: Object.keys(context), // Log keys only, not values
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        value: null as T,
        error: error instanceof Error ? error.message : 'Unknown evaluation error',
      };
    }
  }
}
