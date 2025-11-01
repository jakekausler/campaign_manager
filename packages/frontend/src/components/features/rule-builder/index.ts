/**
 * Rule Builder Components
 *
 * Visual interface for constructing JSONLogic expressions without writing JSON.
 * Provides drag-and-drop blocks, variable pickers, and live preview.
 */

export { RuleBuilder } from './RuleBuilder';
export type { RuleBuilderProps } from './RuleBuilder';

export { BlockEditor } from './BlockEditor';
export type { BlockEditorProps } from './BlockEditor';

export { JSONEditor } from './JSONEditor';
export type { JSONEditorProps } from './JSONEditor';

// Types
export type {
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
  OperatorType,
  Block,
} from './types';

// Type Guards
export {
  isLiteral,
  isVarExpression,
  isAndExpression,
  isOrExpression,
  isNotExpression,
  isLogicalExpression,
  isIfExpression,
  isEqualExpression,
  isNotEqualExpression,
  isStrictEqualExpression,
  isStrictNotEqualExpression,
  isGreaterThanExpression,
  isGreaterThanOrEqualExpression,
  isLessThanExpression,
  isLessThanOrEqualExpression,
  isComparisonExpression,
  isAddExpression,
  isSubtractExpression,
  isMultiplyExpression,
  isDivideExpression,
  isModuloExpression,
  isArithmeticExpression,
} from './typeGuards';

// Helper Functions
export {
  createVarReference,
  createLiteralBlock,
  createAndBlock,
  createOrBlock,
  createComparisonBlock,
  createArithmeticBlock,
  createIfBlock,
  parseExpression,
  serializeBlocks,
} from './helpers';
