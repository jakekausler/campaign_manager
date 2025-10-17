/**
 * Operator Registry
 * Manages registration and retrieval of custom operators for JSONLogic expressions
 */

import { Injectable } from '@nestjs/common';

import type { CustomOperator, CustomOperatorFunction } from './types/expression.types';

@Injectable()
export class OperatorRegistry {
  private readonly operators: Map<string, CustomOperator> = new Map();

  /**
   * Register a custom operator
   *
   * @param operator - The custom operator to register
   * @throws Error if operator name is empty or already registered
   */
  register(operator: CustomOperator): void {
    if (!operator.name || operator.name.trim() === '') {
      throw new Error('Operator name cannot be empty');
    }

    if (this.operators.has(operator.name)) {
      throw new Error(`Operator "${operator.name}" is already registered`);
    }

    this.operators.set(operator.name, operator);
  }

  /**
   * Check if an operator is registered
   *
   * @param name - The operator name to check
   * @returns True if the operator is registered, false otherwise
   */
  has(name: string): boolean {
    return this.operators.has(name);
  }

  /**
   * Get a registered operator by name
   *
   * @param name - The operator name
   * @returns The operator if registered, undefined otherwise
   */
  get(name: string): CustomOperator | undefined {
    return this.operators.get(name);
  }

  /**
   * Get all registered operators
   *
   * @returns Array of all registered operators
   */
  getAll(): CustomOperator[] {
    return Array.from(this.operators.values());
  }

  /**
   * Unregister an operator
   *
   * @param name - The operator name to remove
   */
  unregister(name: string): void {
    this.operators.delete(name);
  }

  /**
   * Clear all registered operators
   */
  clear(): void {
    this.operators.clear();
  }

  /**
   * Get a map of operator names to their implementation functions
   * This is the format expected by json-logic-js for custom operators
   *
   * @returns Object mapping operator names to functions
   */
  getOperatorMap(): Record<string, CustomOperatorFunction> {
    const map: Record<string, CustomOperatorFunction> = {};

    for (const [name, operator] of this.operators.entries()) {
      map[name] = operator.implementation;
    }

    return map;
  }
}
