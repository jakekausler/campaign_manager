/**
 * Expression Cache Tests
 * Unit tests for LRU expression caching
 */

import type { Expression } from '../types/expression.types';

import { ExpressionCache } from './expression-cache';

describe('ExpressionCache', () => {
  let cache: ExpressionCache;

  beforeEach(() => {
    cache = ExpressionCache.create({ maxSize: 3 });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same expression', () => {
      const expr: Expression = { '==': [{ var: 'x' }, 10] };

      const key1 = cache.generateKey(expr);
      const key2 = cache.generateKey(expr);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different expressions', () => {
      const expr1: Expression = { '==': [{ var: 'x' }, 10] };
      const expr2: Expression = { '==': [{ var: 'y' }, 20] };

      const key1 = cache.generateKey(expr1);
      const key2 = cache.generateKey(expr2);

      expect(key1).not.toBe(key2);
    });

    it('should handle complex nested expressions', () => {
      const expr: Expression = {
        and: [{ '==': [{ var: 'x' }, 10] }, { '>': [{ var: 'y' }, 5] }],
      };

      const key = cache.generateKey(expr);

      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should handle expressions with arrays and nested objects', () => {
      const expr: Expression = {
        in: [{ var: 'status' }, ['active', 'pending', 'completed']],
      };

      const key = cache.generateKey(expr);

      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe('get and set', () => {
    it('should return undefined for non-existent key', () => {
      const expr: Expression = { '==': [{ var: 'x' }, 10] };
      const key = cache.generateKey(expr);

      const result = cache.get(key);

      expect(result).toBeUndefined();
    });

    it('should cache and retrieve expression', () => {
      const expr: Expression = { '==': [{ var: 'x' }, 10] };
      const key = cache.generateKey(expr);

      cache.set(key, expr);
      const cached = cache.get(key);

      expect(cached).toEqual(expr);
    });

    it('should overwrite existing cache entry', () => {
      const key = 'test-key';
      const expr1: Expression = { '==': [{ var: 'x' }, 10] };
      const expr2: Expression = { '==': [{ var: 'x' }, 20] };

      cache.set(key, expr1);
      cache.set(key, expr2);

      const cached = cache.get(key);
      expect(cached).toEqual(expr2);
    });

    it('should move accessed item to front (LRU behavior)', () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const key3 = 'key3';
      const expr1: Expression = { '==': [{ var: 'a' }, 1] };
      const expr2: Expression = { '==': [{ var: 'b' }, 2] };
      const expr3: Expression = { '==': [{ var: 'c' }, 3] };

      cache.set(key1, expr1);
      cache.set(key2, expr2);
      cache.set(key3, expr3);

      // Access key1 to move it to front
      cache.get(key1);

      const stats = cache.getStats();
      // Key1 should still be in cache after LRU eviction
      expect(stats.size).toBe(3);
      expect(cache.get(key1)).toEqual(expr1);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used item when cache is full', () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const key3 = 'key3';
      const key4 = 'key4';
      const expr1: Expression = { '==': [{ var: 'a' }, 1] };
      const expr2: Expression = { '==': [{ var: 'b' }, 2] };
      const expr3: Expression = { '==': [{ var: 'c' }, 3] };
      const expr4: Expression = { '==': [{ var: 'd' }, 4] };

      // Fill cache to capacity (maxSize = 3)
      cache.set(key1, expr1);
      cache.set(key2, expr2);
      cache.set(key3, expr3);

      // Add 4th item - should evict key1 (oldest)
      cache.set(key4, expr4);

      expect(cache.get(key1)).toBeUndefined();
      expect(cache.get(key2)).toEqual(expr2);
      expect(cache.get(key3)).toEqual(expr3);
      expect(cache.get(key4)).toEqual(expr4);
      expect(cache.getStats().size).toBe(3);
    });

    it('should evict correct item when items are accessed', () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const key3 = 'key3';
      const key4 = 'key4';
      const expr1: Expression = { '==': [{ var: 'a' }, 1] };
      const expr2: Expression = { '==': [{ var: 'b' }, 2] };
      const expr3: Expression = { '==': [{ var: 'c' }, 3] };
      const expr4: Expression = { '==': [{ var: 'd' }, 4] };

      // Fill cache
      cache.set(key1, expr1);
      cache.set(key2, expr2);
      cache.set(key3, expr3);

      // Access key1 (makes key2 the least recently used)
      cache.get(key1);

      // Add key4 - should evict key2
      cache.set(key4, expr4);

      expect(cache.get(key1)).toEqual(expr1);
      expect(cache.get(key2)).toBeUndefined();
      expect(cache.get(key3)).toEqual(expr3);
      expect(cache.get(key4)).toEqual(expr4);
    });

    it('should handle cache size of 1', () => {
      const smallCache = ExpressionCache.create({ maxSize: 1 });
      const key1 = 'key1';
      const key2 = 'key2';
      const expr1: Expression = { '==': [{ var: 'a' }, 1] };
      const expr2: Expression = { '==': [{ var: 'b' }, 2] };

      smallCache.set(key1, expr1);
      expect(smallCache.get(key1)).toEqual(expr1);

      smallCache.set(key2, expr2);
      expect(smallCache.get(key1)).toBeUndefined();
      expect(smallCache.get(key2)).toEqual(expr2);
    });
  });

  describe('invalidate', () => {
    it('should remove specific cache entry by key', () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const expr1: Expression = { '==': [{ var: 'a' }, 1] };
      const expr2: Expression = { '==': [{ var: 'b' }, 2] };

      cache.set(key1, expr1);
      cache.set(key2, expr2);

      cache.invalidate(key1);

      expect(cache.get(key1)).toBeUndefined();
      expect(cache.get(key2)).toEqual(expr2);
      expect(cache.getStats().size).toBe(1);
    });

    it('should handle invalidating non-existent key', () => {
      expect(() => cache.invalidate('non-existent')).not.toThrow();
    });

    it('should allow re-adding invalidated key', () => {
      const key = 'key1';
      const expr1: Expression = { '==': [{ var: 'a' }, 1] };
      const expr2: Expression = { '==': [{ var: 'a' }, 2] };

      cache.set(key, expr1);
      cache.invalidate(key);
      cache.set(key, expr2);

      expect(cache.get(key)).toEqual(expr2);
    });
  });

  describe('clear', () => {
    it('should clear entire cache', () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const expr1: Expression = { '==': [{ var: 'a' }, 1] };
      const expr2: Expression = { '==': [{ var: 'b' }, 2] };

      cache.set(key1, expr1);
      cache.set(key2, expr2);

      cache.clear();

      expect(cache.get(key1)).toBeUndefined();
      expect(cache.get(key2)).toBeUndefined();
      expect(cache.getStats().size).toBe(0);
    });

    it('should handle clearing empty cache', () => {
      expect(() => cache.clear()).not.toThrow();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const expr1: Expression = { '==': [{ var: 'a' }, 1] };
      const expr2: Expression = { '==': [{ var: 'b' }, 2] };

      cache.set(key1, expr1);
      cache.set(key2, expr2);

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.keys).toEqual([key1, key2]);
      expect(stats.hitRate).toBe(0);
    });

    it('should return zero size for empty cache', () => {
      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(3);
      expect(stats.keys).toEqual([]);
    });

    it('should track cache hits and misses', () => {
      const key = 'key1';
      const expr: Expression = { '==': [{ var: 'a' }, 1] };

      cache.set(key, expr);

      // Hit
      cache.get(key);
      // Miss
      cache.get('non-existent');
      // Hit
      cache.get(key);

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.6667, 4); // 2/3
    });

    it('should handle hitRate when no accesses', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('options validation', () => {
    it('should use default maxSize if not provided', () => {
      const defaultCache = ExpressionCache.create();
      const stats = defaultCache.getStats();

      expect(stats.maxSize).toBe(100); // Default value
    });

    it('should reject negative maxSize', () => {
      expect(() => ExpressionCache.create({ maxSize: -1 })).toThrow('maxSize must be positive');
    });

    it('should reject zero maxSize', () => {
      expect(() => ExpressionCache.create({ maxSize: 0 })).toThrow('maxSize must be positive');
    });

    it('should accept custom maxSize', () => {
      const customCache = ExpressionCache.create({ maxSize: 50 });
      expect(customCache.getStats().maxSize).toBe(50);
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      const key = 'key1';
      const expr: Expression = { '==': [{ var: 'a' }, 1] };

      cache.set(key, expr);

      expect(cache.has(key)).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should not count as cache hit or miss', () => {
      const key = 'key1';
      const expr: Expression = { '==': [{ var: 'a' }, 1] };

      cache.set(key, expr);
      cache.has(key);
      cache.has('non-existent');

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
