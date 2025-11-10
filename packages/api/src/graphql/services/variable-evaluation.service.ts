/**
 * @file Variable Evaluation Service
 * @module graphql/services/variable-evaluation
 * @description
 * Service for evaluating StateVariable values, with specialized handling for derived
 * variables that use JSONLogic formulas. Provides runtime computation of dynamic state
 * based on scope entity data and formula evaluation.
 *
 * Key responsibilities:
 * - Evaluate stored and derived state variables
 * - Build evaluation contexts from scope entities (campaign, party, character, etc.)
 * - Execute JSONLogic formulas with proper context resolution
 * - Validate formula structure and enforce safety limits
 * - Provide detailed evaluation traces for debugging
 * - Extract and resolve variable dependencies in formulas
 *
 * Architecture:
 * - Integrates with ExpressionParserService for JSONLogic execution
 * - Fetches scope entities via PrismaService for context building
 * - Supports all entity scope types defined in VariableScope enum
 * - Returns type-safe evaluation results with error handling
 *
 * @see {@link ExpressionParserService} for JSONLogic formula execution
 * @see {@link StateVariableResolver} for GraphQL API exposure
 * @see {@link VariableScope} for supported scope types
 *
 * @example
 * ```typescript
 * // Evaluate a derived variable
 * const variable = await prisma.stateVariable.findUnique({
 *   where: { id: 'var-123' }
 * });
 * const result = await service.evaluateVariable<number>(variable);
 * if (result.success) {
 *   console.log('Value:', result.value); // e.g., 1500 (computed population)
 * }
 *
 * // Evaluate with additional context
 * const result = await service.evaluateVariable(variable, {
 *   currentSeason: 'winter',
 *   modifiers: { growth_rate: 0.8 }
 * });
 *
 * // Get detailed evaluation trace for debugging
 * const traced = await service.evaluateWithTrace(variable);
 * console.log('Steps:', traced.trace);
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma, StateVariable } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ExpressionParserService } from '../../rules/expression-parser.service';
import { EvaluationStep, VariableScope } from '../types/state-variable.type';

/**
 * Evaluation context for JSONLogic evaluation.
 * Contains scope entity data and additional runtime context merged together.
 * Variables in formulas reference keys in this object using dot notation.
 *
 * @example
 * ```typescript
 * {
 *   settlement: { id: '123', population: 1000, name: 'Greyhaven' },
 *   currentSeason: 'winter',
 *   modifiers: { growth_rate: 0.8 }
 * }
 * ```
 */
type EvaluationContext = Record<string, unknown>;

/**
 * Evaluation result with optional trace for debugging.
 * Generic type parameter T represents the expected value type.
 *
 * @template T The expected type of the evaluated value
 */
interface EvaluationResult<T = unknown> {
  /** Whether evaluation succeeded without errors */
  success: boolean;
  /** The computed value, or null if evaluation failed */
  value: T | null;
  /** Error message if evaluation failed */
  error?: string;
  /** Step-by-step trace of the evaluation process for debugging */
  trace?: EvaluationStep[];
}

/**
 * Service for evaluating StateVariable values with JSONLogic formula support.
 *
 * Handles two types of variables:
 * 1. **Stored variables** - Return their stored value directly without computation
 * 2. **Derived variables** - Evaluate JSONLogic formulas with scope entity context
 *
 * For derived variables, builds evaluation context by:
 * - Fetching the scope entity (campaign, settlement, character, etc.)
 * - Merging with additional runtime context
 * - Executing the JSONLogic formula with the merged context
 * - Returning the computed result
 *
 * Formula validation ensures:
 * - Valid JSONLogic structure (object with operators)
 * - Maximum nesting depth to prevent recursion attacks
 * - Type safety for variable references
 *
 * @example
 * ```typescript
 * // In a resolver
 * const service = moduleRef.get(VariableEvaluationService);
 *
 * // Evaluate stored variable
 * const stored = await prisma.stateVariable.findUnique({
 *   where: { key: 'settlement_founding_year' }
 * });
 * const result = await service.evaluateVariable<number>(stored);
 * // result: { success: true, value: 1024 }
 *
 * // Evaluate derived variable with formula
 * const derived = await prisma.stateVariable.findUnique({
 *   where: { key: 'settlement_population_growth' }
 * });
 * // Formula: { "*": [{ "var": "settlement.population" }, { "var": "growth_rate" }] }
 * const result = await service.evaluateVariable<number>(derived, {
 *   growth_rate: 1.05
 * });
 * // result: { success: true, value: 1050 } (if settlement.population = 1000)
 * ```
 */
@Injectable()
export class VariableEvaluationService {
  private readonly logger = new Logger(VariableEvaluationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expressionParser: ExpressionParserService
  ) {}

  /**
   * Evaluate a state variable and return its computed value.
   *
   * Handles two evaluation paths:
   * 1. **Stored variables** (type !== 'derived') - Returns the stored value directly
   * 2. **Derived variables** (type === 'derived') - Evaluates the JSONLogic formula
   *
   * For derived variables:
   * - Validates formula exists
   * - Builds evaluation context from scope entity
   * - Merges with additional runtime context
   * - Executes JSONLogic formula
   * - Returns computed result
   *
   * @template T The expected type of the variable value (e.g., number, string, boolean)
   * @param variable The state variable to evaluate
   * @param context Additional context to merge with scope entity data (optional).
   *                Keys in this object take precedence over scope entity keys.
   * @returns Promise resolving to evaluation result with success flag, value, and optional error
   *
   * @example
   * ```typescript
   * // Evaluate stored variable
   * const stored = await prisma.stateVariable.findUnique({
   *   where: { key: 'kingdom_founding_year' }
   * });
   * const result = await service.evaluateVariable<number>(stored);
   * // { success: true, value: 1024 }
   *
   * // Evaluate derived variable with formula
   * const derived = await prisma.stateVariable.findUnique({
   *   where: { key: 'settlement_tax_revenue' }
   * });
   * // Formula: { "*": [{ "var": "settlement.population" }, 0.1] }
   * const result = await service.evaluateVariable<number>(derived);
   * // { success: true, value: 150 } (if population = 1500)
   *
   * // Evaluate with additional context
   * const result = await service.evaluateVariable<number>(derived, {
   *   tax_rate: 0.15
   * });
   * // Formula can now use { "var": "tax_rate" } in addition to settlement data
   * ```
   *
   * @throws Never throws - errors are caught and returned in result.error
   */
  async evaluateVariable<T = unknown>(
    variable: StateVariable,
    context?: Record<string, unknown>
  ): Promise<{ success: boolean; value: T | null; error?: string }> {
    try {
      // Non-derived variables return stored value directly
      if (variable.type !== 'derived') {
        return {
          success: true,
          value: variable.value as T,
        };
      }

      // Derived variables require a formula
      if (!variable.formula) {
        return {
          success: false,
          value: null,
          error: 'Derived variable missing formula',
        };
      }

      // Build evaluation context
      const evalContext = await this.buildEvaluationContext(
        variable.scope,
        variable.scopeId,
        context
      );

      // Evaluate formula using expression parser
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = this.expressionParser.evaluate<T>(variable.formula as any, evalContext);

      return {
        success: result.success,
        value: result.value,
        error: result.error,
      };
    } catch (error) {
      this.logger.error('Variable evaluation failed', {
        variableId: variable.id,
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
   * Evaluate a state variable with detailed step-by-step trace for debugging.
   *
   * Similar to evaluateVariable() but captures detailed trace of every step:
   * - Initial evaluation start
   * - Formula validation checks
   * - Context building process
   * - Variable resolution
   * - Formula execution
   * - Error details if any
   *
   * Use this method when debugging formula issues or understanding evaluation flow.
   * The trace provides visibility into:
   * - What data was available in context
   * - Which variables were resolved from the formula
   * - Where evaluation succeeded or failed
   * - Step-by-step execution details
   *
   * @template T The expected type of the variable value
   * @param variable The state variable to evaluate
   * @param context Additional context to merge with scope entity data (optional)
   * @returns Promise resolving to evaluation result with full trace array
   *
   * @example
   * ```typescript
   * const variable = await prisma.stateVariable.findUnique({
   *   where: { key: 'settlement_prosperity_score' }
   * });
   *
   * const result = await service.evaluateWithTrace<number>(variable);
   *
   * console.log('Success:', result.success);
   * console.log('Value:', result.value);
   * console.log('Steps:');
   * result.trace?.forEach(step => {
   *   console.log(`- ${step.step}: ${step.description}`);
   *   console.log(`  Passed: ${step.passed}`);
   *   if (step.output) {
   *     console.log(`  Output:`, step.output);
   *   }
   * });
   *
   * // Example output:
   * // - Start evaluation: Evaluating variable settlement_prosperity_score (derived)
   * //   Passed: true
   * // - Validate formula structure: Check formula is valid JSONLogic
   * //   Passed: true
   * // - Build evaluation context: Fetch scope entity and merge with additional context
   * //   Passed: true
   * //   Output: { contextKeys: ['settlement', 'currentSeason'] }
   * // - Evaluate formula: Execute JSONLogic formula with context
   * //   Passed: true
   * //   Output: 85
   * // - Resolve variables: Extract and resolve variables used in formula
   * //   Passed: true
   * //   Output: { 'settlement.population': 1500, 'settlement.wealth': 8500 }
   * ```
   *
   * @throws Never throws - errors are caught and added to trace
   */
  async evaluateWithTrace<T = unknown>(
    variable: StateVariable,
    context?: Record<string, unknown>
  ): Promise<EvaluationResult<T>> {
    const trace: EvaluationStep[] = [];

    try {
      // Add initial trace step
      trace.push({
        step: 'Start evaluation',
        description: `Evaluating variable ${variable.key} (${variable.type})`,
        input: { variableId: variable.id, key: variable.key, type: variable.type },
        output: null,
        passed: true,
      });

      // Non-derived variables return stored value
      if (variable.type !== 'derived') {
        trace.push({
          step: 'Return stored value',
          description: 'Non-derived variable returns value directly',
          input: null,
          output: variable.value,
          passed: true,
        });

        return {
          success: true,
          value: variable.value as T,
          trace,
        };
      }

      // Validate formula exists for derived variables
      if (!variable.formula) {
        trace.push({
          step: 'Validate formula',
          description: 'Check formula exists for derived variable',
          input: variable.formula,
          output: 'Formula is missing',
          passed: false,
        });

        return {
          success: false,
          value: null,
          error: 'Derived variable missing formula',
          trace,
        };
      }

      // Validate formula structure
      const validationResult = this.validateFormula(variable.formula);
      trace.push({
        step: 'Validate formula structure',
        description: 'Check formula is valid JSONLogic',
        input: variable.formula,
        output: validationResult,
        passed: validationResult.isValid,
      });

      if (!validationResult.isValid) {
        return {
          success: false,
          value: null,
          error: validationResult.errors.join(', '),
          trace,
        };
      }

      // Build evaluation context
      const evalContext = await this.buildEvaluationContext(
        variable.scope,
        variable.scopeId,
        context
      );
      trace.push({
        step: 'Build evaluation context',
        description: `Fetch scope entity and merge with additional context`,
        input: { scope: variable.scope, scopeId: variable.scopeId, additionalContext: context },
        output: { contextKeys: Object.keys(evalContext) },
        passed: true,
      });

      // Evaluate formula
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = this.expressionParser.evaluate<T>(variable.formula as any, evalContext);
      trace.push({
        step: 'Evaluate formula',
        description: 'Execute JSONLogic formula with context',
        input: { formula: variable.formula, context: evalContext },
        output: result.value,
        passed: result.success,
      });

      // Add variable resolution trace
      const variables = this.extractVariables(variable.formula);
      if (variables.length > 0) {
        const resolvedVars: Record<string, unknown> = {};
        for (const varPath of variables) {
          resolvedVars[varPath] = this.resolveVariable(varPath, evalContext);
        }
        trace.push({
          step: 'Resolve variables',
          description: 'Extract and resolve variables used in formula',
          input: variables,
          output: resolvedVars,
          passed: true,
        });
      }

      return {
        success: result.success,
        value: result.value,
        error: result.error,
        trace,
      };
    } catch (error) {
      trace.push({
        step: 'Error occurred',
        description: error instanceof Error ? error.message : 'Unknown error',
        input: null,
        output: error instanceof Error ? error.stack : undefined,
        passed: false,
      });

      return {
        success: false,
        value: null,
        error: error instanceof Error ? error.message : 'Unknown evaluation error',
        trace,
      };
    }
  }

  /**
   * Build evaluation context from scope entity data and additional runtime context.
   *
   * Creates the data context used when evaluating JSONLogic formulas in derived variables.
   * The context is built by:
   * 1. Fetching the scope entity from database (campaign, settlement, character, etc.)
   * 2. Adding it to context under the scope name key (e.g., context.settlement = {...})
   * 3. Merging additional context provided by caller (takes precedence)
   *
   * Scope handling:
   * - **WORLD scope** or **null scopeId** - Returns only additional context (no entity fetch)
   * - **Other scopes** - Fetches entity via Prisma and adds to context
   *
   * Supported entity scopes:
   * - CAMPAIGN, PARTY, KINGDOM, SETTLEMENT, STRUCTURE
   * - CHARACTER, LOCATION, EVENT, ENCOUNTER
   *
   * Formula variables can then reference context using dot notation:
   * - `{ "var": "settlement.population" }` - Access scope entity field
   * - `{ "var": "currentSeason" }` - Access additional context field
   *
   * @param scope The variable scope type (e.g., 'settlement', 'campaign', 'world')
   * @param scopeId The scope entity ID (null for world-level variables)
   * @param additionalContext Additional context to merge (takes precedence over scope entity)
   * @returns Promise resolving to merged evaluation context object
   *
   * @example
   * ```typescript
   * // Build context for settlement-scoped variable
   * const context = await service.buildEvaluationContext(
   *   'settlement',
   *   'settlement-123',
   *   { currentSeason: 'winter', tax_rate: 0.15 }
   * );
   * // Result:
   * // {
   * //   settlement: {
   * //     id: 'settlement-123',
   * //     name: 'Greyhaven',
   * //     population: 1500,
   * //     wealth: 8500,
   * //     ...
   * //   },
   * //   currentSeason: 'winter',
   * //   tax_rate: 0.15
   * // }
   *
   * // Build context for world-level variable (no entity)
   * const worldContext = await service.buildEvaluationContext(
   *   'world',
   *   null,
   *   { global_event_count: 42 }
   * );
   * // Result: { global_event_count: 42 }
   * ```
   *
   * @throws Never throws - errors are logged and additional context is returned
   */
  async buildEvaluationContext(
    scope: string,
    scopeId: string | null,
    additionalContext?: Record<string, unknown>
  ): Promise<EvaluationContext> {
    const context: EvaluationContext = {};

    // World-level variables have no scope entity
    if (scope === VariableScope.WORLD || !scopeId) {
      return additionalContext || {};
    }

    try {
      // Fetch scope entity based on scope type
      let scopeEntity: Record<string, unknown> | null = null;

      switch (scope) {
        case VariableScope.CAMPAIGN:
          scopeEntity = await this.prisma.campaign.findUnique({
            where: { id: scopeId },
          });
          break;

        case VariableScope.PARTY:
          scopeEntity = await this.prisma.party.findUnique({
            where: { id: scopeId },
          });
          break;

        case VariableScope.KINGDOM:
          scopeEntity = await this.prisma.kingdom.findUnique({
            where: { id: scopeId },
          });
          break;

        case VariableScope.SETTLEMENT:
          scopeEntity = await this.prisma.settlement.findUnique({
            where: { id: scopeId },
          });
          break;

        case VariableScope.STRUCTURE:
          scopeEntity = await this.prisma.structure.findUnique({
            where: { id: scopeId },
          });
          break;

        case VariableScope.CHARACTER:
          scopeEntity = await this.prisma.character.findUnique({
            where: { id: scopeId },
          });
          break;

        case VariableScope.LOCATION:
          scopeEntity = await this.prisma.location.findUnique({
            where: { id: scopeId },
          });
          break;

        case VariableScope.EVENT:
          scopeEntity = await this.prisma.event.findUnique({
            where: { id: scopeId },
          });
          break;

        case VariableScope.ENCOUNTER:
          scopeEntity = await this.prisma.encounter.findUnique({
            where: { id: scopeId },
          });
          break;

        default:
          this.logger.warn(`Unknown scope type: ${scope}`);
      }

      // Add scope entity to context if found
      if (scopeEntity) {
        // Use scope name as key for consistency (e.g., settlement.population)
        context[scope] = scopeEntity;
      }

      // Merge additional context (takes precedence)
      if (additionalContext) {
        Object.assign(context, additionalContext);
      }

      return context;
    } catch (error) {
      this.logger.error('Failed to build evaluation context', {
        scope,
        scopeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return at least the additional context on error
      return additionalContext || {};
    }
  }

  /**
   * Validate a JSONLogic formula structure for safety and correctness.
   *
   * Performs structural validation to ensure formula is:
   * - Not null or undefined
   * - A valid object (not array or primitive)
   * - Contains at least one operator (non-empty object)
   * - Does not exceed maximum nesting depth (protection against recursion attacks)
   *
   * Validation rules:
   * - Formula must be object type: `{ "operator": [...] }`
   * - Formula cannot be array or primitive value
   * - Formula must have at least one key (operator)
   * - Maximum nesting depth: 10 levels (prevents infinite recursion)
   *
   * This validation is performed before formula evaluation to prevent:
   * - Invalid JSONLogic syntax errors
   * - Recursion attacks via deeply nested formulas
   * - Type confusion attacks
   *
   * @param formula The JSONLogic formula to validate
   * @returns Validation result with isValid flag and error messages array
   *
   * @example
   * ```typescript
   * // Valid formula
   * const result = service.validateFormula({
   *   "*": [{ "var": "settlement.population" }, 0.1]
   * });
   * // { isValid: true, errors: [] }
   *
   * // Invalid - not an object
   * const result = service.validateFormula("invalid");
   * // { isValid: false, errors: ['Formula must be a valid object'] }
   *
   * // Invalid - empty object
   * const result = service.validateFormula({});
   * // { isValid: false, errors: ['Formula must contain at least one operator'] }
   *
   * // Invalid - too deeply nested
   * const deepFormula = { "if": [true, { "if": [true, { "if": [...] }] }] }; // 11+ levels
   * const result = service.validateFormula(deepFormula);
   * // { isValid: false, errors: ['Formula exceeds maximum depth of 10'] }
   * ```
   */
  validateFormula(formula: Prisma.JsonValue): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      // Check for null/undefined
      if (formula === null || formula === undefined) {
        errors.push('Formula cannot be null or undefined');
        return { isValid: false, errors };
      }

      // Check if it's an object (JSONLogic formulas are objects)
      if (typeof formula !== 'object' || Array.isArray(formula)) {
        errors.push('Formula must be a valid object');
        return { isValid: false, errors };
      }

      // Check if formula has any operators (at least one key)
      const keys = Object.keys(formula);
      if (keys.length === 0) {
        errors.push('Formula must contain at least one operator');
        return { isValid: false, errors };
      }

      // Recursively validate nested formula with depth limit
      this.validateNestedFormula(formula, errors, 0, 10);

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
   * Recursively validate nested formula structure with depth limit enforcement.
   *
   * Internal helper method that traverses the formula tree to check:
   * - Current depth does not exceed maximum allowed depth
   * - All nested objects and arrays are structurally valid
   *
   * Traversal rules:
   * - Primitives (string, number, boolean, null) are valid leaf nodes - no recursion
   * - Arrays are validated element-by-element without incrementing depth
   * - Objects increment depth and validate each value recursively
   *
   * Depth counting:
   * - Initial call: depth = 0
   * - Each nested object: depth + 1
   * - Arrays: depth unchanged (container, not logical nesting)
   * - Maximum depth: 10 (prevents recursion attacks)
   *
   * Example depth calculation:
   * ```typescript
   * { "if": [condition, thenValue, elseValue] }  // depth 0
   * { "if": [true, { "+" : [1, 2] }, 3] }        // depth 1 (nested object)
   * { "if": [true, { "if": [true, {...}, 3] }] } // depth 2 (doubly nested)
   * ```
   *
   * @param formula The formula value to validate (can be object, array, or primitive)
   * @param errors Array to collect error messages (mutated in place)
   * @param depth Current recursion depth level
   * @param maxDepth Maximum allowed recursion depth (typically 10)
   * @returns void - errors are accumulated in the errors array parameter
   *
   * @private
   */
  private validateNestedFormula(
    formula: unknown,
    errors: string[],
    depth: number,
    maxDepth: number
  ): void {
    // Check max depth to prevent infinite recursion
    if (depth > maxDepth) {
      errors.push(`Formula exceeds maximum depth of ${maxDepth}`);
      return;
    }

    // If it's not an object, it's a value (valid)
    if (typeof formula !== 'object' || formula === null) {
      return;
    }

    // If it's an array, validate each element (don't increment depth for arrays themselves)
    if (Array.isArray(formula)) {
      for (const item of formula) {
        this.validateNestedFormula(item, errors, depth, maxDepth);
      }
      return;
    }

    // If it's an object, validate each value (increment depth for nested objects)
    for (const value of Object.values(formula)) {
      this.validateNestedFormula(value, errors, depth + 1, maxDepth);
    }
  }

  /**
   * Extract all variable paths referenced in a JSONLogic formula.
   *
   * Recursively traverses the formula tree to find all `{ "var": "path" }` operators
   * and collects the variable paths. Used for debugging and dependency analysis.
   *
   * Variable operator format in JSONLogic:
   * ```typescript
   * { "var": "settlement.population" }  // Single variable
   * { "var": ["settlement.wealth", 0] } // Variable with default value
   * ```
   *
   * Traversal behavior:
   * - Searches through all objects and arrays recursively
   * - Identifies "var" operator keys
   * - Extracts string paths (ignores default values)
   * - Returns unique set of paths
   *
   * @param formula The JSONLogic formula to analyze
   * @returns Array of unique variable paths found in the formula (dot notation)
   *
   * @example
   * ```typescript
   * const formula = {
   *   "*": [
   *     { "var": "settlement.population" },
   *     { "+": [{ "var": "base_tax_rate" }, { "var": "seasonal_modifier" }] }
   *   ]
   * };
   *
   * const vars = service.extractVariables(formula);
   * // ['settlement.population', 'base_tax_rate', 'seasonal_modifier']
   *
   * // Complex nested formula
   * const complexFormula = {
   *   "if": [
   *     { ">": [{ "var": "settlement.wealth" }, 10000] },
   *     { "*": [{ "var": "settlement.population" }, 0.15] },
   *     { "*": [{ "var": "settlement.population" }, 0.10] }
   *   ]
   * };
   * const vars = service.extractVariables(complexFormula);
   * // ['settlement.wealth', 'settlement.population']
   * ```
   *
   * @private
   */
  private extractVariables(formula: Prisma.JsonValue): string[] {
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

    extract(formula);
    return Array.from(variables);
  }

  /**
   * Resolve a dot-notation variable path to its value in the evaluation context.
   *
   * Traverses the context object following the dot-separated path segments
   * to retrieve the final value. Used for variable resolution during formula
   * evaluation and debugging trace generation.
   *
   * Path traversal:
   * - Splits path by '.' delimiter: "settlement.population" → ["settlement", "population"]
   * - Walks through each segment sequentially
   * - Returns undefined if any segment is missing
   * - Returns the final resolved value if path exists
   *
   * Safety:
   * - Returns undefined for invalid paths (null, non-string)
   * - Returns undefined for missing intermediate keys
   * - Does not throw errors on resolution failure
   *
   * @param varPath The dot-notation path to resolve (e.g., "settlement.population")
   * @param context The evaluation context object to resolve from
   * @returns The resolved value at the path, or undefined if not found
   *
   * @example
   * ```typescript
   * const context = {
   *   settlement: {
   *     id: 'settlement-123',
   *     name: 'Greyhaven',
   *     population: 1500,
   *     stats: {
   *       wealth: 8500,
   *       prosperity: 85
   *     }
   *   },
   *   currentSeason: 'winter'
   * };
   *
   * // Simple path
   * const value = service.resolveVariable('currentSeason', context);
   * // 'winter'
   *
   * // Nested path
   * const value = service.resolveVariable('settlement.population', context);
   * // 1500
   *
   * // Deep nested path
   * const value = service.resolveVariable('settlement.stats.wealth', context);
   * // 8500
   *
   * // Missing path
   * const value = service.resolveVariable('settlement.missing', context);
   * // undefined
   *
   * // Invalid path
   * const value = service.resolveVariable('', context);
   * // undefined
   * ```
   *
   * @private
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
}
