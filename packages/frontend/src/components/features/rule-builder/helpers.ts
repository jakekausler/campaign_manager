/**
 * Helper functions for building and parsing JSONLogic expressions
 */

import {
  isLiteral,
  isVarExpression,
  isAndExpression,
  isOrExpression,
  isNotExpression,
  isIfExpression,
  isComparisonExpression,
  isArithmeticExpression,
  isEqualExpression,
  isNotEqualExpression,
  isStrictEqualExpression,
  isStrictNotEqualExpression,
  isGreaterThanExpression,
  isGreaterThanOrEqualExpression,
  isLessThanExpression,
  isLessThanOrEqualExpression,
  isAddExpression,
  isSubtractExpression,
  isMultiplyExpression,
  isDivideExpression,
  isModuloExpression,
} from './typeGuards';
import type {
  JSONLogicExpression,
  VarExpression,
  AndExpression,
  OrExpression,
  IfExpression,
  LiteralValue,
  Block,
  ComparisonExpression,
  ArithmeticExpression,
} from './types';

/**
 * Generate a unique ID for blocks
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Create a variable reference expression
 * Example: createVarReference('settlement.level') → { "var": "settlement.level" }
 */
export function createVarReference(variablePath: string): VarExpression {
  return { var: variablePath };
}

/**
 * Create a literal value expression
 * Example: createLiteralBlock(42) → 42
 */
export function createLiteralBlock(value: LiteralValue): LiteralValue {
  return value;
}

/**
 * Create a logical AND expression
 * Example: createAndBlock([condition1, condition2]) → { "and": [condition1, condition2] }
 */
export function createAndBlock(conditions: JSONLogicExpression[]): AndExpression {
  return { and: conditions };
}

/**
 * Create a logical OR expression
 * Example: createOrBlock([condition1, condition2]) → { "or": [condition1, condition2] }
 */
export function createOrBlock(conditions: JSONLogicExpression[]): OrExpression {
  return { or: conditions };
}

/**
 * Create a comparison expression
 * Example: createComparisonBlock('==', {var: 'status'}, 'active') → { "==": [{var: 'status'}, 'active'] }
 */
export function createComparisonBlock(
  operator: '==' | '!=' | '===' | '!==' | '>' | '>=' | '<' | '<=',
  left: JSONLogicExpression,
  right: JSONLogicExpression
): ComparisonExpression {
  return { [operator]: [left, right] } as ComparisonExpression;
}

/**
 * Create an arithmetic expression
 * Example: createArithmeticBlock('+', [{var: 'a'}, {var: 'b'}]) → { "+": [{var: 'a'}, {var: 'b'}] }
 */
export function createArithmeticBlock(
  operator: '+' | '-' | '*' | '/' | '%',
  operands: JSONLogicExpression[]
): ArithmeticExpression {
  return { [operator]: operands } as ArithmeticExpression;
}

/**
 * Create an if-then-else expression
 * Example: createIfBlock(condition, thenValue, elseValue) → { "if": [condition, thenValue, elseValue] }
 */
export function createIfBlock(
  condition: JSONLogicExpression,
  thenValue: JSONLogicExpression,
  elseValue: JSONLogicExpression
): IfExpression {
  return { if: [condition, thenValue, elseValue] };
}

/**
 * Parse a JSONLogic expression into Block structures for the visual editor
 */
export function parseExpression(expr: JSONLogicExpression): Block[] {
  const block = parseExpressionToBlock(expr);
  return [block];
}

/**
 * Internal function to recursively parse JSONLogic expressions to Block
 */
function parseExpressionToBlock(expr: JSONLogicExpression): Block {
  // Handle literals
  if (isLiteral(expr)) {
    return {
      id: generateId(),
      type: 'literal',
      operator: 'literal',
      value: expr,
    };
  }

  // Handle variable references
  if (isVarExpression(expr)) {
    return {
      id: generateId(),
      type: 'variable',
      operator: 'var',
      value: expr.var,
    };
  }

  // Handle AND expression
  if (isAndExpression(expr)) {
    return {
      id: generateId(),
      type: 'logical',
      operator: 'and',
      children: expr.and.map(parseExpressionToBlock),
    };
  }

  // Handle OR expression
  if (isOrExpression(expr)) {
    return {
      id: generateId(),
      type: 'logical',
      operator: 'or',
      children: expr.or.map(parseExpressionToBlock),
    };
  }

  // Handle NOT expression
  if (isNotExpression(expr)) {
    return {
      id: generateId(),
      type: 'logical',
      operator: '!',
      children: [parseExpressionToBlock(expr['!'])],
    };
  }

  // Handle IF expression
  if (isIfExpression(expr)) {
    return {
      id: generateId(),
      type: 'conditional',
      operator: 'if',
      children: expr.if.map(parseExpressionToBlock),
    };
  }

  // Handle comparison expressions
  if (isComparisonExpression(expr)) {
    let operator: '==' | '!=' | '===' | '!==' | '>' | '>=' | '<' | '<=' = '==';
    let operands: [JSONLogicExpression, JSONLogicExpression];

    if (isEqualExpression(expr)) {
      operator = '==';
      operands = expr['=='];
    } else if (isNotEqualExpression(expr)) {
      operator = '!=';
      operands = expr['!='];
    } else if (isStrictEqualExpression(expr)) {
      operator = '===';
      operands = expr['==='];
    } else if (isStrictNotEqualExpression(expr)) {
      operator = '!==';
      operands = expr['!=='];
    } else if (isGreaterThanExpression(expr)) {
      operator = '>';
      operands = expr['>'];
    } else if (isGreaterThanOrEqualExpression(expr)) {
      operator = '>=';
      operands = expr['>='];
    } else if (isLessThanExpression(expr)) {
      operator = '<';
      operands = expr['<'];
    } else if (isLessThanOrEqualExpression(expr)) {
      operator = '<=';
      operands = expr['<='];
    } else {
      throw new Error('Unknown comparison operator');
    }

    return {
      id: generateId(),
      type: 'comparison',
      operator,
      children: operands.map(parseExpressionToBlock),
    };
  }

  // Handle arithmetic expressions
  if (isArithmeticExpression(expr)) {
    let operator: '+' | '-' | '*' | '/' | '%' = '+';
    let operands: JSONLogicExpression[];

    if (isAddExpression(expr)) {
      operator = '+';
      operands = expr['+'];
    } else if (isSubtractExpression(expr)) {
      operator = '-';
      operands = expr['-'];
    } else if (isMultiplyExpression(expr)) {
      operator = '*';
      operands = expr['*'];
    } else if (isDivideExpression(expr)) {
      operator = '/';
      operands = expr['/'];
    } else if (isModuloExpression(expr)) {
      operator = '%';
      operands = expr['%'];
    } else {
      throw new Error('Unknown arithmetic operator');
    }

    return {
      id: generateId(),
      type: 'arithmetic',
      operator,
      children: operands.map(parseExpressionToBlock),
    };
  }

  throw new Error(`Unknown expression type: ${JSON.stringify(expr)}`);
}

/**
 * Serialize Block structures back into JSONLogic expressions
 */
export function serializeBlocks(blocks: Block[]): JSONLogicExpression {
  if (blocks.length === 0) {
    return null;
  }
  return serializeBlock(blocks[0]);
}

/**
 * Internal function to recursively serialize a single Block to JSONLogic
 */
function serializeBlock(block: Block): JSONLogicExpression {
  // Handle literals
  if (block.operator === 'literal') {
    return block.value as LiteralValue;
  }

  // Handle variable references
  if (block.operator === 'var') {
    return { var: block.value as string };
  }

  // Handle logical operators
  if (block.operator === 'and') {
    return {
      and: (block.children || []).map(serializeBlock),
    };
  }

  if (block.operator === 'or') {
    return {
      or: (block.children || []).map(serializeBlock),
    };
  }

  if (block.operator === '!') {
    const child = block.children?.[0];
    if (!child) {
      throw new Error('NOT operator requires a child');
    }
    return {
      '!': serializeBlock(child),
    };
  }

  // Handle if-then-else
  if (block.operator === 'if') {
    const children = block.children || [];
    if (children.length !== 3) {
      throw new Error('IF operator requires exactly 3 children');
    }
    return {
      if: [serializeBlock(children[0]), serializeBlock(children[1]), serializeBlock(children[2])],
    };
  }

  // Handle comparison operators
  if (
    block.operator === '==' ||
    block.operator === '!=' ||
    block.operator === '===' ||
    block.operator === '!==' ||
    block.operator === '>' ||
    block.operator === '>=' ||
    block.operator === '<' ||
    block.operator === '<='
  ) {
    const children = block.children || [];
    if (children.length !== 2) {
      throw new Error(`${block.operator} operator requires exactly 2 children`);
    }
    return {
      [block.operator]: [serializeBlock(children[0]), serializeBlock(children[1])],
    } as ComparisonExpression;
  }

  // Handle arithmetic operators
  if (
    block.operator === '+' ||
    block.operator === '-' ||
    block.operator === '*' ||
    block.operator === '/' ||
    block.operator === '%'
  ) {
    const children = block.children || [];
    return {
      [block.operator]: children.map(serializeBlock),
    } as ArithmeticExpression;
  }

  throw new Error(`Unknown block operator: ${block.operator}`);
}
