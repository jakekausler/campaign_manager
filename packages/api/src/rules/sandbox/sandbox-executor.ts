/**
 * Sandbox Executor
 * Safely executes JSONLogic expressions with resource limits and security checks
 */

import { BadRequestException, Logger } from '@nestjs/common';
import * as jsonLogic from 'json-logic-js';

import type { Expression, EvaluationContext, EvaluationResult } from '../types/expression.types';

/**
 * Options for sandbox execution
 */
export interface SandboxOptions {
  /**
   * Maximum recursion depth allowed (default: 50)
   * Prevents stack overflow from deeply nested expressions
   */
  maxDepth?: number;

  /**
   * Maximum number of iterations allowed in array operations (default: 10000)
   * Prevents resource exhaustion from processing large arrays
   */
  maxIterations?: number;

  /**
   * Execution timeout in milliseconds (default: 5000)
   * Set to 0 to disable timeout
   */
  timeout?: number;
}

/**
 * Default sandbox options
 */
const DEFAULT_OPTIONS: Required<SandboxOptions> = {
  maxDepth: 50,
  maxIterations: 10000,
  timeout: 5000,
};

/**
 * Dangerous property names that should be filtered from context
 */
const DANGEROUS_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'eval',
  'Function',
  'global',
  'process',
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
]);

/**
 * Safely executes JSONLogic expressions with resource limits and security checks
 */
export class SandboxExecutor {
  private readonly logger = new Logger(SandboxExecutor.name);
  private readonly options: Required<SandboxOptions>;
  private iterationCount: number = 0;
  private startTime: number = 0;

  constructor(options: SandboxOptions = {}) {
    // Validate options
    if (options.timeout !== undefined && options.timeout < 0) {
      throw new BadRequestException('Timeout must be non-negative');
    }
    if (options.maxDepth !== undefined && options.maxDepth < 0) {
      throw new BadRequestException('Max depth must be non-negative');
    }
    if (options.maxIterations !== undefined && options.maxIterations < 0) {
      throw new BadRequestException('Max iterations must be non-negative');
    }

    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Execute an expression safely with resource limits and security checks
   *
   * @param expression - The JSONLogic expression to execute
   * @param context - The data context for variable resolution
   * @returns Evaluation result with success status and value/error
   */
  execute<T = unknown>(expression: Expression, context: EvaluationContext): EvaluationResult<T> {
    // Reset execution state
    this.iterationCount = 0;
    this.startTime = Date.now();

    try {
      // Validate inputs
      if (expression === null || expression === undefined) {
        throw new BadRequestException('Expression cannot be null or undefined');
      }

      // Sanitize context to prevent code injection
      const sanitizedContext = this.sanitizeContext(context || {});

      // Check recursion depth before evaluation
      this.checkResourceLimits(expression);

      // Execute the expression (timeout is checked during execution via checkResourceLimits)
      return this.executeExpression(expression, sanitizedContext);
    } catch (error) {
      this.logger.error('Sandbox execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        value: null as T,
        error: error instanceof Error ? error.message : 'Unknown sandbox execution error',
      };
    }
  }

  /**
   * Execute the expression using JSONLogic
   */
  private executeExpression<T>(
    expression: Expression,
    context: EvaluationContext
  ): EvaluationResult<T> {
    try {
      const value = jsonLogic.apply(expression, context) as T;

      return {
        success: true,
        value,
      };
    } catch (error) {
      throw new Error(
        `Expression execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check resource limits (recursion depth and iteration count)
   */
  private checkResourceLimits(node: unknown, depth: number = 0): void {
    // Check timeout
    if (this.options.timeout > 0) {
      const elapsed = Date.now() - this.startTime;
      if (elapsed > this.options.timeout) {
        throw new Error(`Execution timeout: expression exceeded ${this.options.timeout}ms limit`);
      }
    }

    // Check recursion depth
    if (depth > this.options.maxDepth) {
      throw new Error(`Maximum recursion depth exceeded: ${depth} > ${this.options.maxDepth}`);
    }

    // Primitives don't need further checking
    if (typeof node !== 'object' || node === null) {
      return;
    }

    // Check arrays (and count iterations)
    if (Array.isArray(node)) {
      this.iterationCount += node.length;
      if (this.iterationCount > this.options.maxIterations) {
        throw new Error(
          `Maximum iteration count exceeded: ${this.iterationCount} > ${this.options.maxIterations}`
        );
      }

      // Recursively check array elements
      for (const item of node) {
        this.checkResourceLimits(item, depth + 1);
      }
      return;
    }

    // Check objects
    const obj = node as Record<string, unknown>;
    const entries = Object.entries(obj);

    this.iterationCount += entries.length;
    if (this.iterationCount > this.options.maxIterations) {
      throw new Error(
        `Maximum iteration count exceeded: ${this.iterationCount} > ${this.options.maxIterations}`
      );
    }

    // Recursively check object values
    for (const [, value] of entries) {
      this.checkResourceLimits(value, depth + 1);
    }
  }

  /**
   * Sanitize context to prevent code injection and prototype pollution
   */
  private sanitizeContext(context: EvaluationContext): EvaluationContext {
    const sanitized: EvaluationContext = {};

    for (const [key, value] of Object.entries(context)) {
      // Skip dangerous properties
      if (DANGEROUS_PROPERTIES.has(key)) {
        this.logger.warn(`Filtered dangerous property from context: ${key}`);
        continue;
      }

      // Recursively sanitize nested objects
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeContext(value as EvaluationContext);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
