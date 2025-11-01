/**
 * Tests for JSONLogic helper functions
 */

import { describe, it, expect } from 'vitest';

import {
  createIfBlock,
  createAndBlock,
  createOrBlock,
  createComparisonBlock,
  createVarReference,
  createLiteralBlock,
  createArithmeticBlock,
  parseExpression,
  serializeBlocks,
} from './helpers';
import type { Block, JSONLogicExpression } from './types';

describe('JSONLogic Helper Functions', () => {
  describe('createVarReference', () => {
    it('should create a variable reference expression', () => {
      const result = createVarReference('settlement.level');
      expect(result).toEqual({ var: 'settlement.level' });
    });

    it('should handle nested paths', () => {
      const result = createVarReference('user.profile.name');
      expect(result).toEqual({ var: 'user.profile.name' });
    });
  });

  describe('createLiteralBlock', () => {
    it('should create a literal string expression', () => {
      const result = createLiteralBlock('hello');
      expect(result).toBe('hello');
    });

    it('should create a literal number expression', () => {
      const result = createLiteralBlock(42);
      expect(result).toBe(42);
    });

    it('should create a literal boolean expression', () => {
      const result = createLiteralBlock(true);
      expect(result).toBe(true);
    });

    it('should create a literal null expression', () => {
      const result = createLiteralBlock(null);
      expect(result).toBe(null);
    });
  });

  describe('createAndBlock', () => {
    it('should create an AND expression with multiple conditions', () => {
      const result = createAndBlock([{ var: 'isActive' }, { '>': [{ var: 'level' }, 5] }]);
      expect(result).toEqual({
        and: [{ var: 'isActive' }, { '>': [{ var: 'level' }, 5] }],
      });
    });

    it('should handle single condition', () => {
      const result = createAndBlock([{ var: 'isActive' }]);
      expect(result).toEqual({ and: [{ var: 'isActive' }] });
    });

    it('should handle empty array', () => {
      const result = createAndBlock([]);
      expect(result).toEqual({ and: [] });
    });
  });

  describe('createOrBlock', () => {
    it('should create an OR expression with multiple conditions', () => {
      const result = createOrBlock([{ var: 'isAdmin' }, { var: 'isModerator' }]);
      expect(result).toEqual({
        or: [{ var: 'isAdmin' }, { var: 'isModerator' }],
      });
    });

    it('should handle single condition', () => {
      const result = createOrBlock([{ var: 'isActive' }]);
      expect(result).toEqual({ or: [{ var: 'isActive' }] });
    });
  });

  describe('createComparisonBlock', () => {
    it('should create equality comparison', () => {
      const result = createComparisonBlock('==', { var: 'status' }, 'active');
      expect(result).toEqual({ '==': [{ var: 'status' }, 'active'] });
    });

    it('should create inequality comparison', () => {
      const result = createComparisonBlock('!=', { var: 'type' }, 'admin');
      expect(result).toEqual({ '!=': [{ var: 'type' }, 'admin'] });
    });

    it('should create greater than comparison', () => {
      const result = createComparisonBlock('>', { var: 'level' }, 10);
      expect(result).toEqual({ '>': [{ var: 'level' }, 10] });
    });

    it('should create less than or equal comparison', () => {
      const result = createComparisonBlock('<=', { var: 'count' }, 100);
      expect(result).toEqual({ '<=': [{ var: 'count' }, 100] });
    });

    it('should create strict equality comparison', () => {
      const result = createComparisonBlock('===', { var: 'flag' }, true);
      expect(result).toEqual({ '===': [{ var: 'flag' }, true] });
    });
  });

  describe('createArithmeticBlock', () => {
    it('should create addition expression', () => {
      const result = createArithmeticBlock('+', [{ var: 'a' }, { var: 'b' }, 10]);
      expect(result).toEqual({ '+': [{ var: 'a' }, { var: 'b' }, 10] });
    });

    it('should create subtraction expression', () => {
      const result = createArithmeticBlock('-', [{ var: 'total' }, 5]);
      expect(result).toEqual({ '-': [{ var: 'total' }, 5] });
    });

    it('should create multiplication expression', () => {
      const result = createArithmeticBlock('*', [{ var: 'price' }, 2]);
      expect(result).toEqual({ '*': [{ var: 'price' }, 2] });
    });

    it('should create division expression', () => {
      const result = createArithmeticBlock('/', [{ var: 'total' }, 3]);
      expect(result).toEqual({ '/': [{ var: 'total' }, 3] });
    });

    it('should create modulo expression', () => {
      const result = createArithmeticBlock('%', [{ var: 'value' }, 10]);
      expect(result).toEqual({ '%': [{ var: 'value' }, 10] });
    });
  });

  describe('createIfBlock', () => {
    it('should create if-then-else expression', () => {
      const result = createIfBlock({ '>': [{ var: 'level' }, 5] }, 'advanced', 'beginner');
      expect(result).toEqual({
        if: [{ '>': [{ var: 'level' }, 5] }, 'advanced', 'beginner'],
      });
    });

    it('should handle nested conditions', () => {
      const result = createIfBlock(
        { and: [{ var: 'isActive' }, { '>': [{ var: 'level' }, 3] }] },
        true,
        false
      );
      expect(result).toEqual({
        if: [{ and: [{ var: 'isActive' }, { '>': [{ var: 'level' }, 3] }] }, true, false],
      });
    });
  });

  describe('parseExpression', () => {
    it('should parse literal values', () => {
      const blocks = parseExpression('hello');
      expect(blocks).toEqual([
        {
          id: expect.any(String),
          type: 'literal',
          operator: 'literal',
          value: 'hello',
        },
      ]);
    });

    it('should parse variable reference', () => {
      const blocks = parseExpression({ var: 'settlement.level' });
      expect(blocks).toEqual([
        {
          id: expect.any(String),
          type: 'variable',
          operator: 'var',
          value: 'settlement.level',
        },
      ]);
    });

    it('should parse AND expression', () => {
      const blocks = parseExpression({
        and: [{ var: 'isActive' }, { '>': [{ var: 'level' }, 5] }],
      });
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        type: 'logical',
        operator: 'and',
      });
      expect(blocks[0].children).toHaveLength(2);
    });

    it('should parse OR expression', () => {
      const blocks = parseExpression({
        or: [{ var: 'isAdmin' }, { var: 'isModerator' }],
      });
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        type: 'logical',
        operator: 'or',
      });
    });

    it('should parse comparison expression', () => {
      const blocks = parseExpression({ '==': [{ var: 'status' }, 'active'] });
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        type: 'comparison',
        operator: '==',
      });
      expect(blocks[0].children).toHaveLength(2);
    });

    it('should parse if-then-else expression', () => {
      const blocks = parseExpression({
        if: [{ '>': [{ var: 'level' }, 5] }, 'advanced', 'beginner'],
      });
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        type: 'conditional',
        operator: 'if',
      });
      expect(blocks[0].children).toHaveLength(3);
    });

    it('should parse arithmetic expression', () => {
      const blocks = parseExpression({ '+': [{ var: 'a' }, { var: 'b' }] });
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        type: 'arithmetic',
        operator: '+',
      });
    });

    it('should handle nested expressions', () => {
      const expr: JSONLogicExpression = {
        and: [{ '==': [{ var: 'type' }, 'settlement'] }, { '>': [{ var: 'level' }, 3] }],
      };
      const blocks = parseExpression(expr);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('logical');
      expect(blocks[0].children).toHaveLength(2);
      expect(blocks[0].children?.[0].type).toBe('comparison');
      expect(blocks[0].children?.[1].type).toBe('comparison');
    });
  });

  describe('serializeBlocks', () => {
    it('should serialize literal block', () => {
      const blocks: Block[] = [
        {
          id: '1',
          type: 'literal',
          operator: 'literal',
          value: 42,
        },
      ];
      const result = serializeBlocks(blocks);
      expect(result).toBe(42);
    });

    it('should serialize variable block', () => {
      const blocks: Block[] = [
        {
          id: '1',
          type: 'variable',
          operator: 'var',
          value: 'settlement.level',
        },
      ];
      const result = serializeBlocks(blocks);
      expect(result).toEqual({ var: 'settlement.level' });
    });

    it('should serialize AND block', () => {
      const blocks: Block[] = [
        {
          id: '1',
          type: 'logical',
          operator: 'and',
          children: [
            {
              id: '2',
              type: 'variable',
              operator: 'var',
              value: 'isActive',
            },
            {
              id: '3',
              type: 'comparison',
              operator: '>',
              children: [
                {
                  id: '4',
                  type: 'variable',
                  operator: 'var',
                  value: 'level',
                },
                {
                  id: '5',
                  type: 'literal',
                  operator: 'literal',
                  value: 5,
                },
              ],
            },
          ],
        },
      ];
      const result = serializeBlocks(blocks);
      expect(result).toEqual({
        and: [{ var: 'isActive' }, { '>': [{ var: 'level' }, 5] }],
      });
    });

    it('should serialize comparison block', () => {
      const blocks: Block[] = [
        {
          id: '1',
          type: 'comparison',
          operator: '==',
          children: [
            {
              id: '2',
              type: 'variable',
              operator: 'var',
              value: 'status',
            },
            {
              id: '3',
              type: 'literal',
              operator: 'literal',
              value: 'active',
            },
          ],
        },
      ];
      const result = serializeBlocks(blocks);
      expect(result).toEqual({ '==': [{ var: 'status' }, 'active'] });
    });

    it('should serialize if-then-else block', () => {
      const blocks: Block[] = [
        {
          id: '1',
          type: 'conditional',
          operator: 'if',
          children: [
            {
              id: '2',
              type: 'comparison',
              operator: '>',
              children: [
                {
                  id: '3',
                  type: 'variable',
                  operator: 'var',
                  value: 'level',
                },
                {
                  id: '4',
                  type: 'literal',
                  operator: 'literal',
                  value: 5,
                },
              ],
            },
            {
              id: '5',
              type: 'literal',
              operator: 'literal',
              value: 'advanced',
            },
            {
              id: '6',
              type: 'literal',
              operator: 'literal',
              value: 'beginner',
            },
          ],
        },
      ];
      const result = serializeBlocks(blocks);
      expect(result).toEqual({
        if: [{ '>': [{ var: 'level' }, 5] }, 'advanced', 'beginner'],
      });
    });

    it('should serialize multiple blocks into first block only', () => {
      const blocks: Block[] = [
        {
          id: '1',
          type: 'literal',
          operator: 'literal',
          value: 42,
        },
        {
          id: '2',
          type: 'literal',
          operator: 'literal',
          value: 'ignored',
        },
      ];
      const result = serializeBlocks(blocks);
      expect(result).toBe(42);
    });
  });

  describe('roundtrip (parse then serialize)', () => {
    it('should preserve simple expressions', () => {
      const original: JSONLogicExpression = { var: 'test' };
      const blocks = parseExpression(original);
      const result = serializeBlocks(blocks);
      expect(result).toEqual(original);
    });

    it('should preserve complex nested expressions', () => {
      const original: JSONLogicExpression = {
        and: [
          { '==': [{ var: 'type' }, 'settlement'] },
          {
            or: [{ '>': [{ var: 'level' }, 3] }, { '==': [{ var: 'status' }, 'active'] }],
          },
        ],
      };
      const blocks = parseExpression(original);
      const result = serializeBlocks(blocks);
      expect(result).toEqual(original);
    });

    it('should preserve if-then-else with nested conditions', () => {
      const original: JSONLogicExpression = {
        if: [{ and: [{ var: 'isActive' }, { '>': [{ var: 'level' }, 5] }] }, true, false],
      };
      const blocks = parseExpression(original);
      const result = serializeBlocks(blocks);
      expect(result).toEqual(original);
    });
  });
});
