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
    it('should extract write from replace operation', () => {
      const effect = {
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/treasury', value: 1000 }],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['treasury']));
    });

    it('should extract write from add operation', () => {
      const effect = {
        effectType: 'patch',
        payload: [{ op: 'add', path: '/resources/gold', value: 500 }],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['resources']));
    });

    it('should extract write from remove operation', () => {
      const effect = {
        effectType: 'patch',
        payload: [{ op: 'remove', path: '/obsolete_field' }],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['obsolete_field']));
    });

    it('should extract write from copy operation', () => {
      const effect = {
        effectType: 'patch',
        payload: [{ op: 'copy', from: '/source', path: '/destination' }],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['destination']));
    });

    it('should extract write from move operation', () => {
      const effect = {
        effectType: 'patch',
        payload: [{ op: 'move', from: '/old_location', path: '/new_location' }],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['new_location']));
    });

    it('should not extract writes from test operation', () => {
      const effect = {
        effectType: 'patch',
        payload: [{ op: 'test', path: '/value', value: 100 }],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set());
    });

    it('should extract multiple writes from multiple operations', () => {
      const effect = {
        effectType: 'patch',
        payload: [
          { op: 'replace', path: '/treasury', value: 1000 },
          { op: 'add', path: '/resources/gold', value: 500 },
          { op: 'remove', path: '/obsolete_field' },
        ],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['treasury', 'resources', 'obsolete_field']));
    });

    it('should deduplicate writes to the same base variable', () => {
      const effect = {
        effectType: 'patch',
        payload: [
          { op: 'replace', path: '/resources/gold', value: 100 },
          { op: 'replace', path: '/resources/silver', value: 200 },
          { op: 'add', path: '/resources/copper', value: 300 },
        ],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['resources']));
      expect(writes.size).toBe(1);
    });

    it('should extract only base variable from nested path', () => {
      const effect = {
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/kingdom/resources/treasury/gold', value: 1000 }],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['kingdom']));
    });

    it('should handle array index in path', () => {
      const effect = {
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/items/0/quantity', value: 10 }],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['items']));
    });

    it('should return empty set for non-patch effect type', () => {
      const effect = {
        effectType: 'trigger_event',
        payload: { eventId: '123' },
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set());
    });

    it('should return empty set for effect with no payload', () => {
      const effect = {
        effectType: 'patch',
        payload: null,
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set());
    });

    it('should return empty set for effect with non-array payload', () => {
      const effect = {
        effectType: 'patch',
        payload: { op: 'replace', path: '/value', value: 100 },
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set());
    });

    it('should handle null effect', () => {
      const writes = extractor.extractWrites(null);

      expect(writes).toEqual(new Set());
    });

    it('should handle undefined effect', () => {
      const writes = extractor.extractWrites(undefined);

      expect(writes).toEqual(new Set());
    });

    it('should handle empty payload array', () => {
      const effect = {
        effectType: 'patch',
        payload: [],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set());
    });

    it('should skip invalid operations in payload', () => {
      const effect = {
        effectType: 'patch',
        payload: [
          null,
          { op: 'replace', path: '/valid', value: 100 },
          undefined,
          'invalid',
          { op: 'add', path: '/another_valid', value: 200 },
        ],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['valid', 'another_valid']));
    });

    it('should handle operations with missing or invalid paths', () => {
      const effect = {
        effectType: 'patch',
        payload: [
          { op: 'replace', path: null, value: 100 },
          { op: 'add', path: '', value: 200 },
          { op: 'remove', path: '/valid' },
        ],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['valid']));
    });

    it('should handle complex mixed operations', () => {
      const effect = {
        effectType: 'patch',
        payload: [
          { op: 'test', path: '/value', value: 100 }, // Should not be extracted
          { op: 'replace', path: '/treasury', value: 1000 },
          { op: 'add', path: '/resources/gold', value: 500 },
          { op: 'copy', from: '/backup', path: '/current' },
          { op: 'move', from: '/old', path: '/new' },
          { op: 'remove', path: '/deprecated' },
        ],
      };
      const writes = extractor.extractWrites(effect);

      expect(writes).toEqual(new Set(['treasury', 'resources', 'current', 'new', 'deprecated']));
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
