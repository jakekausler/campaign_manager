/**
 * Type guard functions for JSONLogic expressions
 *
 * These functions help distinguish between different operator types at runtime
 */

import type {
  JSONLogicExpression,
  VarExpression,
  AndExpression,
  OrExpression,
  NotExpression,
  IfExpression,
  EqualExpression,
  NotEqualExpression,
  StrictEqualExpression,
  StrictNotEqualExpression,
  GreaterThanExpression,
  GreaterThanOrEqualExpression,
  LessThanExpression,
  LessThanOrEqualExpression,
  AddExpression,
  SubtractExpression,
  MultiplyExpression,
  DivideExpression,
  ModuloExpression,
  LogicalExpression,
  ComparisonExpression,
  ArithmeticExpression,
  LiteralValue,
} from './types';

/**
 * Check if a value is a literal (primitive value)
 */
export function isLiteral(expr: JSONLogicExpression): expr is LiteralValue {
  return (
    typeof expr === 'string' ||
    typeof expr === 'number' ||
    typeof expr === 'boolean' ||
    expr === null
  );
}

/**
 * Check if a value is an object (not null or primitive)
 */
function isObject(expr: JSONLogicExpression): expr is Exclude<JSONLogicExpression, LiteralValue> {
  return typeof expr === 'object' && expr !== null;
}

/**
 * Check if expression is a variable reference
 */
export function isVarExpression(expr: JSONLogicExpression): expr is VarExpression {
  return isObject(expr) && 'var' in expr;
}

/**
 * Check if expression is a logical AND
 */
export function isAndExpression(expr: JSONLogicExpression): expr is AndExpression {
  return isObject(expr) && 'and' in expr;
}

/**
 * Check if expression is a logical OR
 */
export function isOrExpression(expr: JSONLogicExpression): expr is OrExpression {
  return isObject(expr) && 'or' in expr;
}

/**
 * Check if expression is a logical NOT
 */
export function isNotExpression(expr: JSONLogicExpression): expr is NotExpression {
  return isObject(expr) && '!' in expr;
}

/**
 * Check if expression is any logical operator
 */
export function isLogicalExpression(expr: JSONLogicExpression): expr is LogicalExpression {
  return isAndExpression(expr) || isOrExpression(expr) || isNotExpression(expr);
}

/**
 * Check if expression is an if-then-else conditional
 */
export function isIfExpression(expr: JSONLogicExpression): expr is IfExpression {
  return isObject(expr) && 'if' in expr;
}

/**
 * Check if expression is equality comparison
 */
export function isEqualExpression(expr: JSONLogicExpression): expr is EqualExpression {
  return isObject(expr) && '==' in expr;
}

/**
 * Check if expression is inequality comparison
 */
export function isNotEqualExpression(expr: JSONLogicExpression): expr is NotEqualExpression {
  return isObject(expr) && '!=' in expr;
}

/**
 * Check if expression is strict equality comparison
 */
export function isStrictEqualExpression(expr: JSONLogicExpression): expr is StrictEqualExpression {
  return isObject(expr) && '===' in expr;
}

/**
 * Check if expression is strict inequality comparison
 */
export function isStrictNotEqualExpression(
  expr: JSONLogicExpression
): expr is StrictNotEqualExpression {
  return isObject(expr) && '!==' in expr;
}

/**
 * Check if expression is greater than comparison
 */
export function isGreaterThanExpression(expr: JSONLogicExpression): expr is GreaterThanExpression {
  return isObject(expr) && '>' in expr;
}

/**
 * Check if expression is greater than or equal comparison
 */
export function isGreaterThanOrEqualExpression(
  expr: JSONLogicExpression
): expr is GreaterThanOrEqualExpression {
  return isObject(expr) && '>=' in expr;
}

/**
 * Check if expression is less than comparison
 */
export function isLessThanExpression(expr: JSONLogicExpression): expr is LessThanExpression {
  return isObject(expr) && '<' in expr;
}

/**
 * Check if expression is less than or equal comparison
 */
export function isLessThanOrEqualExpression(
  expr: JSONLogicExpression
): expr is LessThanOrEqualExpression {
  return isObject(expr) && '<=' in expr;
}

/**
 * Check if expression is any comparison operator
 */
export function isComparisonExpression(expr: JSONLogicExpression): expr is ComparisonExpression {
  return (
    isEqualExpression(expr) ||
    isNotEqualExpression(expr) ||
    isStrictEqualExpression(expr) ||
    isStrictNotEqualExpression(expr) ||
    isGreaterThanExpression(expr) ||
    isGreaterThanOrEqualExpression(expr) ||
    isLessThanExpression(expr) ||
    isLessThanOrEqualExpression(expr)
  );
}

/**
 * Check if expression is addition
 */
export function isAddExpression(expr: JSONLogicExpression): expr is AddExpression {
  return isObject(expr) && '+' in expr;
}

/**
 * Check if expression is subtraction
 */
export function isSubtractExpression(expr: JSONLogicExpression): expr is SubtractExpression {
  return isObject(expr) && '-' in expr;
}

/**
 * Check if expression is multiplication
 */
export function isMultiplyExpression(expr: JSONLogicExpression): expr is MultiplyExpression {
  return isObject(expr) && '*' in expr;
}

/**
 * Check if expression is division
 */
export function isDivideExpression(expr: JSONLogicExpression): expr is DivideExpression {
  return isObject(expr) && '/' in expr;
}

/**
 * Check if expression is modulo
 */
export function isModuloExpression(expr: JSONLogicExpression): expr is ModuloExpression {
  return isObject(expr) && '%' in expr;
}

/**
 * Check if expression is any arithmetic operator
 */
export function isArithmeticExpression(expr: JSONLogicExpression): expr is ArithmeticExpression {
  return (
    isAddExpression(expr) ||
    isSubtractExpression(expr) ||
    isMultiplyExpression(expr) ||
    isDivideExpression(expr) ||
    isModuloExpression(expr)
  );
}
