/**
 * Expression Validator
 * Validates JSONLogic expressions before execution
 */

import type { OperatorRegistry } from '../operator-registry';
import type { Expression } from '../types/expression.types';

/**
 * Result of expression validation
 */
export interface ValidationResult {
  /**
   * Whether the expression is valid
   */
  valid: boolean;

  /**
   * List of validation errors (empty if valid)
   */
  errors: string[];
}

/**
 * Standard JSONLogic operators
 * These are always available regardless of custom operator registration
 */
const STANDARD_OPERATORS = new Set([
  // Comparison
  '==',
  '===',
  '!=',
  '!==',
  '<',
  '>',
  '<=',
  '>=',
  // Logical
  'and',
  'or',
  '!',
  '!!',
  // Conditional
  'if',
  '?:',
  // Array/Object access
  'var',
  'missing',
  'missing_some',
  // Array operations
  'map',
  'reduce',
  'filter',
  'all',
  'none',
  'some',
  'merge',
  'in',
  // Arithmetic
  '+',
  '-',
  '*',
  '/',
  '%',
  'max',
  'min',
  // String operations
  'cat',
  'substr',
  // Type operations
  'log',
]);

/**
 * Validates JSONLogic expressions
 */
export class ExpressionValidator {
  private readonly seenErrors: Set<string> = new Set();

  constructor(private readonly operatorRegistry: OperatorRegistry) {}

  /**
   * Validate an expression structure and operators
   * @param expression - The expression to validate
   * @returns ValidationResult with any errors found
   */
  validate(expression: Expression): ValidationResult {
    // Reset seen errors for this validation
    this.seenErrors.clear();

    const errors: string[] = [];

    // Check for null/undefined
    if (expression === null || expression === undefined) {
      return {
        valid: false,
        errors: ['Expression cannot be null or undefined'],
      };
    }

    // Recursively validate the expression
    this.validateNode(expression, errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Recursively validate a node in the expression tree
   */
  private validateNode(node: unknown, errors: string[]): void {
    // Primitives are always valid
    if (typeof node !== 'object' || node === null) {
      return;
    }

    // Arrays: validate each element
    if (Array.isArray(node)) {
      node.forEach((item) => this.validateNode(item, errors));
      return;
    }

    // Objects: validate each operator
    const obj = node as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      // Check if the key is a valid operator
      if (!this.isValidOperator(key)) {
        const errorMsg = `Unknown operator: ${key}`;
        // Only add error once per operator
        if (!this.seenErrors.has(errorMsg)) {
          this.seenErrors.add(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Recursively validate the value
      this.validateNode(value, errors);
    }
  }

  /**
   * Check if an operator is valid (standard or custom)
   */
  private isValidOperator(operator: string): boolean {
    // Check standard operators
    if (STANDARD_OPERATORS.has(operator)) {
      return true;
    }

    // Check custom registered operators
    return this.operatorRegistry.has(operator);
  }
}
