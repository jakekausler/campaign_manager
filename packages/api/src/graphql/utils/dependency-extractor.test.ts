/**
 * DependencyExtractor Unit Tests
 * Tests for extracting variable dependencies from JSONLogic expressions
 */

import type { Expression } from '../../rules/types/expression.types';

import { DependencyExtractor } from './dependency-extractor';

describe('DependencyExtractor', () => {
  let extractor: DependencyExtractor;

  beforeEach(() => {
    extractor = new DependencyExtractor();
  });

  describe('extractReads', () => {
    it('should extract simple variable read', () => {
      const expression = { var: 'foo' } as Expression;
      const reads = extractor.extractReads(expression);

      expect(reads).toEqual(new Set(['foo']));
    });

    it('should extract nested variable read (only base variable)', () => {
      const expression = { var: 'foo.bar.baz' } as Expression;
      const reads = extractor.extractReads(expression);

      // Should only return the base variable "foo"
      expect(reads).toEqual(new Set(['foo']));
    });

    it('should extract array accessor (only base variable)', () => {
      const expression = { var: 'items.0.name' } as Expression;
      const reads = extractor.extractReads(expression);

      // Should only return the base variable "items"
      expect(reads).toEqual(new Set(['items']));
    });

    it('should extract multiple variables from compound expression', () => {
      const expression = {
        and: [{ '>': [{ var: 'x' }, 5] }, { var: 'y' }],
      } as Expression;
      const reads = extractor.extractReads(expression);

      expect(reads).toEqual(new Set(['x', 'y']));
    });

    it('should extract variables from nested operators', () => {
      const expression = {
        if: [
          { '>': [{ var: 'population' }, 1000] },
          { '+': [{ var: 'base_income' }, { '*': [{ var: 'population' }, 0.1] }] },
          { var: 'base_income' },
        ],
      } as Expression;
      const reads = extractor.extractReads(expression);

      expect(reads).toEqual(new Set(['population', 'base_income']));
    });

    it('should not include duplicate variables', () => {
      const expression = {
        and: [{ var: 'x' }, { var: 'x' }, { var: 'x' }],
      } as Expression;
      const reads = extractor.extractReads(expression);

      expect(reads).toEqual(new Set(['x']));
      expect(reads.size).toBe(1);
    });

    it('should handle var with default value (array form)', () => {
      const expression = { var: ['name', 'default_name'] } as Expression;
      const reads = extractor.extractReads(expression);

      expect(reads).toEqual(new Set(['name']));
    });

    it('should handle empty expression', () => {
      const reads = extractor.extractReads({} as Expression);

      expect(reads).toEqual(new Set());
      expect(reads.size).toBe(0);
    });

    it('should handle null expression', () => {
      const reads = extractor.extractReads(null as any);

      expect(reads).toEqual(new Set());
    });

    it('should handle undefined expression', () => {
      const reads = extractor.extractReads(undefined as any);

      expect(reads).toEqual(new Set());
    });

    it('should handle expression with no variables', () => {
      const expression = { '+': [1, 2, 3] } as Expression;
      const reads = extractor.extractReads(expression);

      expect(reads).toEqual(new Set());
    });

    it('should handle complex nested structure', () => {
      const expression = {
        and: [
          { '>=': [{ var: 'settlement.population' }, 5000] },
          { '>=': [{ var: 'settlement.merchant_count' }, 10] },
          { in: ['trade_route', { var: 'settlement.tags' }] },
        ],
      } as Expression;
      const reads = extractor.extractReads(expression);

      // Should extract only base variables
      expect(reads).toEqual(new Set(['settlement']));
    });

    it('should handle array of arguments', () => {
      const expression = {
        '+': [{ var: 'a' }, { var: 'b' }, { var: 'c' }],
      } as Expression;
      const reads = extractor.extractReads(expression);

      expect(reads).toEqual(new Set(['a', 'b', 'c']));
    });

    it('should handle deeply nested var operations', () => {
      const expression = {
        if: [
          { and: [{ var: 'condition1' }, { var: 'condition2' }] },
          { or: [{ var: 'result1' }, { var: 'result2' }] },
          { var: 'default_result' },
        ],
      } as Expression;
      const reads = extractor.extractReads(expression);

      expect(reads).toEqual(
        new Set(['condition1', 'condition2', 'result1', 'result2', 'default_result'])
      );
    });

    it('should handle var with empty string', () => {
      const expression = { var: '' } as Expression;
      const reads = extractor.extractReads(expression);

      // Empty string should be ignored
      expect(reads).toEqual(new Set());
    });
  });

  describe('extractWrites', () => {
    it('should return empty set for now (placeholder)', () => {
      const effect = { target: 'kingdom.treasury', operation: 'add', value: 100 };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set());
      expect(writes.size).toBe(0);
    });

    it('should handle null effect', () => {
      const writes = extractor.extractWrites(null);

      expect(writes).toEqual(new Set());
    });

    it('should handle undefined effect', () => {
      const writes = extractor.extractWrites(undefined);

      expect(writes).toEqual(new Set());
    });
  });

  describe('readsVariable', () => {
    it('should return true if expression reads variable', () => {
      const expression = { var: 'foo' } as Expression;

      expect(extractor.readsVariable(expression, 'foo')).toBe(true);
    });

    it('should return false if expression does not read variable', () => {
      const expression = { var: 'foo' } as Expression;

      expect(extractor.readsVariable(expression, 'bar')).toBe(false);
    });

    it('should return true for base variable when nested accessor used', () => {
      const expression = { var: 'foo.bar.baz' } as Expression;

      expect(extractor.readsVariable(expression, 'foo')).toBe(true);
    });

    it('should return false for nested property when checking base variable', () => {
      const expression = { var: 'foo.bar' } as Expression;

      // "bar" is not the base variable, "foo" is
      expect(extractor.readsVariable(expression, 'bar')).toBe(false);
    });

    it('should handle complex expressions', () => {
      const expression = {
        and: [{ var: 'x' }, { var: 'y' }, { var: 'z' }],
      } as Expression;

      expect(extractor.readsVariable(expression, 'x')).toBe(true);
      expect(extractor.readsVariable(expression, 'y')).toBe(true);
      expect(extractor.readsVariable(expression, 'z')).toBe(true);
      expect(extractor.readsVariable(expression, 'w')).toBe(false);
    });
  });

  describe('extractReadsFromMultiple', () => {
    it('should extract reads from multiple expressions', () => {
      const expressions = [
        { var: 'a' } as Expression,
        { var: 'b' } as Expression,
        { var: 'c' } as Expression,
      ];

      const reads = extractor.extractReadsFromMultiple(expressions);

      expect(reads).toEqual(new Set(['a', 'b', 'c']));
    });

    it('should deduplicate variables across expressions', () => {
      const expressions = [
        { var: 'x' } as Expression,
        { var: 'y' } as Expression,
        { var: 'x' } as Expression,
      ];

      const reads = extractor.extractReadsFromMultiple(expressions);

      expect(reads).toEqual(new Set(['x', 'y']));
      expect(reads.size).toBe(2);
    });

    it('should handle empty array', () => {
      const reads = extractor.extractReadsFromMultiple([]);

      expect(reads).toEqual(new Set());
    });

    it('should handle expressions with no variables', () => {
      const expressions = [{ '+': [1, 2] } as Expression, { '-': [5, 3] } as Expression];

      const reads = extractor.extractReadsFromMultiple(expressions);

      expect(reads).toEqual(new Set());
    });

    it('should handle mix of complex expressions', () => {
      const expressions = [
        { and: [{ var: 'a' }, { var: 'b' }] } as Expression,
        { or: [{ var: 'c' }, { var: 'd' }] } as Expression,
        { var: 'e' } as Expression,
      ];

      const reads = extractor.extractReadsFromMultiple(expressions);

      expect(reads).toEqual(new Set(['a', 'b', 'c', 'd', 'e']));
    });
  });
});
