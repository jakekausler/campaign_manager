/**
 * Expression Types
 * Type definitions for JSONLogic expressions and evaluation
 */

import type { RulesLogic } from 'json-logic-js';

/**
 * JSONLogic expression AST
 * This is the parsed representation of a JSONLogic expression
 */
export type Expression = RulesLogic;

/**
 * Data context for expression evaluation
 * Contains all variables and values available to the expression
 */
export interface EvaluationContext {
  [key: string]: unknown;
}

/**
 * Result of expression evaluation
 */
export interface EvaluationResult<T = unknown> {
  /**
   * The computed value from the expression
   */
  value: T;

  /**
   * Whether the evaluation was successful
   */
  success: boolean;

  /**
   * Error message if evaluation failed
   */
  error?: string;
}

/**
 * Options for expression parsing
 * @internal Planned for Stage 3 (validation)
 */
export interface ParseOptions {
  /**
   * Whether to validate the expression structure
   */
  validate?: boolean;

  /**
   * Maximum recursion depth allowed
   */
  maxDepth?: number;
}

/**
 * Options for expression evaluation
 * @internal Planned for Stages 4-5 (sandbox/caching)
 */
export interface EvaluateOptions {
  /**
   * Maximum execution time in milliseconds
   */
  timeout?: number;

  /**
   * Whether to use sandboxed execution
   */
  sandbox?: boolean;

  /**
   * Whether to use cached parsed expressions
   */
  useCache?: boolean;
}
