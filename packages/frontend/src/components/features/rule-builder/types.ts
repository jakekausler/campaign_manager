/**
 * TypeScript type definitions for JSONLogic expressions
 *
 * JSONLogic is a format for expressing logic rules in JSON.
 * See: http://jsonlogic.com/
 */

/**
 * A variable reference in JSONLogic
 * Example: { "var": "settlement.level" }
 */
export interface VarExpression {
  var: string;
}

/**
 * Logical AND operator
 * Example: { "and": [condition1, condition2] }
 */
export interface AndExpression {
  and: JSONLogicExpression[];
}

/**
 * Logical OR operator
 * Example: { "or": [condition1, condition2] }
 */
export interface OrExpression {
  or: JSONLogicExpression[];
}

/**
 * Logical NOT operator
 * Example: { "!": condition }
 */
export interface NotExpression {
  '!': JSONLogicExpression;
}

/**
 * Equality comparison
 * Example: { "==": [left, right] }
 */
export interface EqualExpression {
  '==': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * Inequality comparison
 * Example: { "!=": [left, right] }
 */
export interface NotEqualExpression {
  '!=': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * Strict equality comparison
 * Example: { "===": [left, right] }
 */
export interface StrictEqualExpression {
  '===': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * Strict inequality comparison
 * Example: { "!==": [left, right] }
 */
export interface StrictNotEqualExpression {
  '!==': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * Greater than comparison
 * Example: { ">": [left, right] }
 */
export interface GreaterThanExpression {
  '>': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * Greater than or equal comparison
 * Example: { ">=": [left, right] }
 */
export interface GreaterThanOrEqualExpression {
  '>=': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * Less than comparison
 * Example: { "<": [left, right] }
 */
export interface LessThanExpression {
  '<': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * Less than or equal comparison
 * Example: { "<=": [left, right] }
 */
export interface LessThanOrEqualExpression {
  '<=': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * If-then-else conditional
 * Example: { "if": [condition, thenValue, elseValue] }
 */
export interface IfExpression {
  if: [JSONLogicExpression, JSONLogicExpression, JSONLogicExpression];
}

/**
 * Addition operator
 * Example: { "+": [a, b, c] }
 */
export interface AddExpression {
  '+': JSONLogicExpression[];
}

/**
 * Subtraction operator
 * Example: { "-": [a, b] }
 */
export interface SubtractExpression {
  '-': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * Multiplication operator
 * Example: { "*": [a, b, c] }
 */
export interface MultiplyExpression {
  '*': JSONLogicExpression[];
}

/**
 * Division operator
 * Example: { "/": [a, b] }
 */
export interface DivideExpression {
  '/': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * Modulo operator
 * Example: { "%": [a, b] }
 */
export interface ModuloExpression {
  '%': [JSONLogicExpression, JSONLogicExpression];
}

/**
 * Union type for all comparison operators
 */
export type ComparisonExpression =
  | EqualExpression
  | NotEqualExpression
  | StrictEqualExpression
  | StrictNotEqualExpression
  | GreaterThanExpression
  | GreaterThanOrEqualExpression
  | LessThanExpression
  | LessThanOrEqualExpression;

/**
 * Union type for all logical operators
 */
export type LogicalExpression = AndExpression | OrExpression | NotExpression;

/**
 * Union type for all arithmetic operators
 */
export type ArithmeticExpression =
  | AddExpression
  | SubtractExpression
  | MultiplyExpression
  | DivideExpression
  | ModuloExpression;

/**
 * Literal value (string, number, boolean, null, or array of strings)
 */
export type LiteralValue = string | number | boolean | null | string[];

/**
 * Complete JSONLogic expression type
 */
export type JSONLogicExpression =
  | LiteralValue
  | VarExpression
  | LogicalExpression
  | ComparisonExpression
  | ArithmeticExpression
  | IfExpression;

/**
 * Operator type names for UI categorization
 */
export type OperatorType =
  | 'logical'
  | 'comparison'
  | 'arithmetic'
  | 'conditional'
  | 'variable'
  | 'literal';

/**
 * Block representation for visual editor
 */
export interface Block {
  id: string;
  type: OperatorType;
  operator:
    | 'and'
    | 'or'
    | '!'
    | '=='
    | '!='
    | '==='
    | '!=='
    | '>'
    | '>='
    | '<'
    | '<='
    | '+'
    | '-'
    | '*'
    | '/'
    | '%'
    | 'if'
    | 'var'
    | 'literal';
  value?: LiteralValue | string; // For var (variable path) and literal (constant value)
  children?: Block[]; // For operators with multiple operands
}
