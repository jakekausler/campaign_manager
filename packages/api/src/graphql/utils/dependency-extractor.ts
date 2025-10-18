/**
 * Dependency Extractor
 * Utility class for extracting variable dependencies from JSONLogic expressions
 * and effect definitions. This enables the dependency graph to understand what
 * variables each condition or effect depends on.
 */

import type { Operation } from 'fast-json-patch';

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
   * Effects use JSON Patch (RFC 6902) format stored in the payload field
   *
   * This method parses the JSON Patch operations to identify which variables
   * (or entity fields) are being written to. It extracts the base variable name
   * from the patch path.
   *
   * @param effect - The effect definition with payload containing JSON Patch operations
   * @returns Set of variable names that are written by this effect
   *
   * @example
   * Effect with patch-type payload:
   * {
   *   effectType: "patch",
   *   payload: [
   *     { op: "replace", path: "/treasury", value: 1000 },
   *     { op: "add", path: "/resources/gold", value: 500 }
   *   ]
   * }
   * Returns: Set(["treasury", "resources"])
   */
  extractWrites(effect: unknown): Set<string> {
    const writes = new Set<string>();

    // Validate input
    if (!effect || typeof effect !== 'object') {
      return writes;
    }

    const effectObj = effect as Record<string, unknown>;

    // Check if this is a patch-type effect
    // For patch-type effects, the payload contains JSON Patch operations
    if (effectObj.effectType !== 'patch') {
      // Non-patch effects don't write to variables (or we don't support them yet)
      return writes;
    }

    const payload = effectObj.payload;
    if (!payload || !Array.isArray(payload)) {
      // Invalid or missing payload
      return writes;
    }

    // Parse each patch operation
    for (const operation of payload) {
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const op = operation as Operation;

      // Extract the target path from operations that write data
      // add, replace, copy, and move operations write to the target path
      // remove also modifies the target (by removing it)
      // test doesn't write, so we skip it
      if (op.op === 'add' || op.op === 'replace' || op.op === 'remove') {
        const targetPath = op.path;
        if (typeof targetPath === 'string') {
          const varName = this.extractBaseVariableFromPath(targetPath);
          if (varName) {
            writes.add(varName);
          }
        }
      }

      // For copy and move operations, the target path is written to
      if (op.op === 'copy' || op.op === 'move') {
        const targetPath = (op as any).path; // All operations have a path
        if (typeof targetPath === 'string') {
          const varName = this.extractBaseVariableFromPath(targetPath);
          if (varName) {
            writes.add(varName);
          }
        }
      }
    }

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
   * Extract the base variable name from a JSON Pointer path (RFC 6901)
   * JSON Pointer paths use / as separator and start with /
   *
   * Examples:
   * - "/treasury" → "treasury"
   * - "/resources/gold" → "resources"
   * - "/items/0/name" → "items"
   * - "" → ""
   *
   * @param path - The JSON Pointer path string
   * @returns The base variable name
   * @private
   */
  private extractBaseVariableFromPath(path: string): string {
    if (!path) {
      return '';
    }

    // Remove leading slash
    const trimmed = path.startsWith('/') ? path.substring(1) : path;

    if (!trimmed) {
      return '';
    }

    // Split on slash and take the first segment
    const parts = trimmed.split('/');
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
