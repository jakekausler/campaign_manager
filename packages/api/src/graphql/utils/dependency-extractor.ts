/**
 * Dependency Extractor
 * Utility class for extracting variable dependencies from JSONLogic expressions
 * and effect definitions. This enables the dependency graph to understand what
 * variables each condition or effect depends on.
 */

import type { Expression } from '../../rules/types/expression.types';

/**
 * DependencyExtractor - Extracts variable reads and writes from expressions
 */
export class DependencyExtractor {
  /**
   * Extract all variable names that are READ by a JSONLogic expression
   * Recursively walks the expression tree to find all `{ "var": "..." }` operations
   *
   * @param expression - The JSONLogic expression to analyze
   * @returns Set of variable names that are read by this expression
   *
   * @example
   * extractReads({ "and": [{ ">": [{ "var": "x" }, 5] }, { "var": "y" }] })
   * // Returns: Set(["x", "y"])
   */
  extractReads(expression: Expression): Set<string> {
    const reads = new Set<string>();

    // Validate input
    if (!expression || typeof expression !== 'object') {
      return reads;
    }

    // Recursively walk the expression tree
    this.walkExpression(expression, reads);

    return reads;
  }

  /**
   * Extract all variable names that are WRITTEN by an effect definition
   * Effects typically have a target variable and optional conditions
   *
   * For now, this is a placeholder that returns empty set since we don't have
   * the Effect model yet (TICKET-016). This method will be implemented when
   * effects are added.
   *
   * @param effect - The effect definition to analyze
   * @returns Set of variable names that are written by this effect
   */
  extractWrites(effect: unknown): Set<string> {
    const writes = new Set<string>();

    // Placeholder implementation for future Effect system
    // When TICKET-016 is implemented, this will parse effect definitions
    // to extract target variables

    if (!effect || typeof effect !== 'object') {
      return writes;
    }

    // Future implementation will extract writes from effect structure
    // For example, if effect has { target: "kingdom.treasury", operation: "add", ... }
    // This would return Set(["kingdom.treasury"])

    return writes;
  }

  /**
   * Recursively walk a JSONLogic expression tree and collect variable reads
   *
   * @param node - Current node in the expression tree
   * @param reads - Accumulator set for variable names
   * @private
   */
  private walkExpression(node: unknown, reads: Set<string>): void {
    // Base case: null/undefined
    if (node === null || node === undefined) {
      return;
    }

    // Base case: primitive values
    if (typeof node !== 'object') {
      return;
    }

    // Handle arrays (e.g., arguments to operators)
    if (Array.isArray(node)) {
      for (const item of node) {
        this.walkExpression(item, reads);
      }
      return;
    }

    // Handle objects (the interesting case)
    const obj = node as Record<string, unknown>;

    // Check if this is a "var" operation
    if ('var' in obj) {
      const varName = obj.var;

      // Extract the base variable name
      // For "var": "foo.bar.baz", we want "foo"
      // For "var": "items.0.name", we want "items"
      if (typeof varName === 'string') {
        const baseVar = this.extractBaseVariable(varName);
        if (baseVar) {
          reads.add(baseVar);
        }
      }

      // "var" can also have a second argument as default value
      // This is an array: { "var": ["name", "default"] }
      if (Array.isArray(varName)) {
        const firstArg = varName[0];
        if (typeof firstArg === 'string') {
          const baseVar = this.extractBaseVariable(firstArg);
          if (baseVar) {
            reads.add(baseVar);
          }
        }
      }
    }

    // Recursively walk all properties of the object
    for (const value of Object.values(obj)) {
      this.walkExpression(value, reads);
    }
  }

  /**
   * Extract the base variable name from a possibly nested accessor string
   *
   * Examples:
   * - "foo" → "foo"
   * - "foo.bar" → "foo"
   * - "foo.bar.baz" → "foo"
   * - "items.0.name" → "items"
   *
   * @param accessor - The variable accessor string
   * @returns The base variable name
   * @private
   */
  private extractBaseVariable(accessor: string): string {
    if (!accessor) {
      return '';
    }

    // Split on dot and take the first segment
    const parts = accessor.split('.');
    return parts[0] || '';
  }

  /**
   * Check if an expression references a specific variable
   *
   * @param expression - The JSONLogic expression to check
   * @param variableName - The variable name to look for
   * @returns True if the expression reads this variable
   */
  readsVariable(expression: Expression, variableName: string): boolean {
    const reads = this.extractReads(expression);
    return reads.has(variableName);
  }

  /**
   * Get all unique variables read by multiple expressions
   *
   * @param expressions - Array of expressions to analyze
   * @returns Set of all unique variable names read by any expression
   */
  extractReadsFromMultiple(expressions: Expression[]): Set<string> {
    const allReads = new Set<string>();

    for (const expression of expressions) {
      const reads = this.extractReads(expression);
      for (const varName of reads) {
        allReads.add(varName);
      }
    }

    return allReads;
  }
}
