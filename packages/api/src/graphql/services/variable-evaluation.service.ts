/**
 * Variable Evaluation Service
 * Handles evaluation of StateVariable values, especially derived variables with JSONLogic formulas
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma, StateVariable } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ExpressionParserService } from '../../rules/expression-parser.service';
import { EvaluationStep, VariableScope } from '../types/state-variable.type';

/**
 * Evaluation context for JSONLogic evaluation
 */
type EvaluationContext = Record<string, unknown>;

/**
 * Evaluation result with optional trace
 */
interface EvaluationResult<T = unknown> {
  success: boolean;
  value: T | null;
  error?: string;
  trace?: EvaluationStep[];
}

@Injectable()
export class VariableEvaluationService {
  private readonly logger = new Logger(VariableEvaluationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expressionParser: ExpressionParserService
  ) {}

  /**
   * Evaluate a state variable
   * - Non-derived variables: return stored value directly
   * - Derived variables: evaluate formula with context
   *
   * @param variable - The state variable to evaluate
   * @param context - Additional context for formula evaluation
   * @returns The evaluation result with success status and value
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
   * Evaluate a state variable with detailed trace for debugging
   *
   * @param variable - The state variable to evaluate
   * @param context - Additional context for formula evaluation
   * @returns Evaluation result with full trace of steps
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
   * Build evaluation context from scope entity data
   * Fetches the scope entity and merges with additional context
   *
   * @param scope - The variable scope type
   * @param scopeId - The scope entity ID (null for world scope)
   * @param additionalContext - Additional context to merge
   * @returns Formatted context for JSONLogic evaluation
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
   * Validate a JSONLogic formula structure
   * Checks for valid structure and enforces depth limit
   *
   * @param formula - The formula to validate
   * @returns Validation result with errors if any
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
   * Recursively validate nested formula structure
   * Enforces maximum depth limit to prevent recursion attacks
   *
   * @param formula - Formula to validate
   * @param errors - Array to collect errors
   * @param depth - Current recursion depth
   * @param maxDepth - Maximum allowed recursion depth
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
   * Extract variable paths from a JSONLogic formula
   *
   * @param formula - The formula to analyze
   * @returns Array of variable paths used in the formula
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
}
