/**
 * Expression Parser Service
 * Service for parsing and evaluating JSONLogic expressions
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as jsonLogic from 'json-logic-js';

import { OperatorRegistry } from './operator-registry';
import type { Expression, EvaluationContext, EvaluationResult } from './types/expression.types';

@Injectable()
export class ExpressionParserService {
  private readonly logger = new Logger(ExpressionParserService.name);

  constructor(private readonly operatorRegistry: OperatorRegistry) {}

  /**
   * Parse a JSONLogic expression
   *
   * For now, this is a simple pass-through since JSONLogic expressions
   * are already in the correct format. In future stages, we'll add
   * validation and optimization here.
   *
   * @param expression - The JSONLogic expression to parse
   * @returns The parsed expression
   * @throws BadRequestException if expression is null or undefined
   */
  parse(expression: Expression): Expression {
    // Basic validation to prevent null/undefined expressions
    if (expression === null || expression === undefined) {
      throw new BadRequestException('Expression cannot be null or undefined');
    }

    // For now, just return the expression as-is
    // Future enhancements in Stage 3 will add comprehensive validation
    return expression;
  }

  /**
   * Evaluate a JSONLogic expression with the given context
   *
   * @param expression - The JSONLogic expression to evaluate
   * @param context - The data context for variable resolution
   * @returns The evaluation result with success status and value/error
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
