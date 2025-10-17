/**
 * Expression Cache Performance Tests
 * Tests to verify cache provides measurable performance improvement
 */

import type { Expression } from '../types/expression.types';

import { ExpressionCache } from './expression-cache';

describe('ExpressionCache Performance', () => {
  describe('cache hit speedup', () => {
    it('should demonstrate significant speedup with cache hits vs key generation', () => {
      const cache = ExpressionCache.create({ maxSize: 100 });

      // Create a moderately complex expression
      const expression: Expression = {
        and: [
          { '==': [{ var: 'status' }, 'active'] },
          { '>': [{ var: 'level' }, 5] },
          {
            or: [
              { in: [{ var: 'type' }, ['warrior', 'mage', 'rogue']] },
              { '<': [{ var: 'age' }, 30] },
            ],
          },
        ],
      };

      // Warm-up: generate key once and store
      const key = cache.generateKey(expression);
      cache.set(key, expression);

      // Measure key generation (cold - not cached)
      const iterations = 10000;

      const startKeyGen = performance.now();
      for (let i = 0; i < iterations; i++) {
        cache.generateKey(expression);
      }
      const keyGenTime = performance.now() - startKeyGen;

      // Measure cache retrieval (hot - cached)
      const startCacheHit = performance.now();
      for (let i = 0; i < iterations; i++) {
        cache.get(key);
      }
      const cacheHitTime = performance.now() - startCacheHit;

      // Cache hits should be faster than key generation
      // We expect at least 2x speedup for cache hits
      const speedup = keyGenTime / cacheHitTime;

      console.log(`Key generation: ${keyGenTime.toFixed(2)}ms`);
      console.log(`Cache hits: ${cacheHitTime.toFixed(2)}ms`);
      console.log(`Speedup: ${speedup.toFixed(2)}x`);

      expect(speedup).toBeGreaterThan(1.5);
    });

    it('should show cache benefit for complex expressions', () => {
      const cache = ExpressionCache.create({ maxSize: 100 });

      // Create a very complex nested expression
      const complexExpression: Expression = {
        and: [
          {
            or: [
              { '==': [{ var: 'kingdom.level' }, 10] },
              { '>=': [{ var: 'kingdom.stability' }, 80] },
            ],
          },
          {
            and: [
              { in: [{ var: 'settlement.type' }, ['city', 'metropolis']] },
              { '>': [{ var: 'settlement.population' }, 10000] },
            ],
          },
          {
            or: [
              {
                and: [
                  { '==': [{ var: 'party.status' }, 'active'] },
                  { '>=': [{ var: 'party.averageLevel' }, 8] },
                ],
              },
              { '==': [{ var: 'campaign.phase' }, 'endgame'] },
            ],
          },
        ],
      };

      const key = cache.generateKey(complexExpression);
      cache.set(key, complexExpression);

      const iterations = 1000;

      // Measure without cache (regenerating key each time)
      const startUncached = performance.now();
      for (let i = 0; i < iterations; i++) {
        cache.generateKey(complexExpression);
      }
      const uncachedTime = performance.now() - startUncached;

      // Measure with cache
      const startCached = performance.now();
      for (let i = 0; i < iterations; i++) {
        cache.get(key);
      }
      const cachedTime = performance.now() - startCached;

      const speedup = uncachedTime / cachedTime;

      console.log(`Complex expression - Uncached: ${uncachedTime.toFixed(2)}ms`);
      console.log(`Complex expression - Cached: ${cachedTime.toFixed(2)}ms`);
      console.log(`Complex expression - Speedup: ${speedup.toFixed(2)}x`);

      expect(speedup).toBeGreaterThan(1);
    });
  });

  describe('LRU eviction performance', () => {
    it('should handle frequent evictions efficiently', () => {
      const cacheSize = 100;
      const cache = ExpressionCache.create({ maxSize: cacheSize });

      // Pre-generate expressions
      const expressions: Expression[] = [];
      for (let i = 0; i < cacheSize * 2; i++) {
        expressions.push({ '==': [{ var: `x${i}` }, i] });
      }

      // Measure time to fill and overflow cache
      const start = performance.now();

      for (let i = 0; i < expressions.length; i++) {
        const key = cache.generateKey(expressions[i]);
        cache.set(key, expressions[i]);
      }

      const duration = performance.now() - start;

      // Should complete in reasonable time (< 100ms for 200 operations)
      console.log(
        `LRU eviction time for ${expressions.length} operations: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(100);

      // Verify cache size is maintained
      expect(cache.getStats().size).toBe(cacheSize);
    });

    it('should maintain O(1) performance with increasing cache usage', () => {
      const cache = ExpressionCache.create({ maxSize: 1000 });

      // Measure set() performance at different fill levels
      const measurements: { fillLevel: number; avgTime: number }[] = [];

      for (const fillLevel of [10, 100, 500, 1000]) {
        const expressions: Expression[] = [];
        for (let i = 0; i < fillLevel; i++) {
          expressions.push({ '==': [{ var: `x${i}` }, i] });
          const key = cache.generateKey(expressions[i]);
          cache.set(key, expressions[i]);
        }

        // Measure time for 100 additional insertions
        const iterations = 100;
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          const expr: Expression = { '==': [{ var: `new${i}` }, i] };
          const key = cache.generateKey(expr);
          cache.set(key, expr);
        }
        const duration = performance.now() - start;
        const avgTime = duration / iterations;

        measurements.push({ fillLevel, avgTime });
      }

      // Performance should remain relatively constant (O(1))
      // Allow for some variance due to JS engine optimization
      const firstAvg = measurements[0].avgTime;
      const lastAvg = measurements[measurements.length - 1].avgTime;

      console.log('Performance at different fill levels:');
      measurements.forEach((m) => {
        console.log(`  ${m.fillLevel} items: ${m.avgTime.toFixed(4)}ms avg`);
      });

      // Last measurement should not be significantly slower (< 5x)
      // This accounts for JS engine warmup and other factors
      expect(lastAvg).toBeLessThan(firstAvg * 5);
    });
  });

  describe('memory efficiency', () => {
    it('should maintain bounded memory usage with LRU eviction', () => {
      const maxSize = 50;
      const cache = ExpressionCache.create({ maxSize });

      // Add many more expressions than cache capacity
      for (let i = 0; i < maxSize * 10; i++) {
        const expr: Expression = { '==': [{ var: `x${i}` }, i] };
        const key = cache.generateKey(expr);
        cache.set(key, expr);
      }

      // Cache size should never exceed maxSize
      const stats = cache.getStats();
      expect(stats.size).toBe(maxSize);
      expect(stats.size).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('real-world usage patterns', () => {
    it('should perform well with repeated access to hot expressions', () => {
      const cache = ExpressionCache.create({ maxSize: 100 });

      // Simulate hot expressions (frequently used)
      const hotExpressions: Expression[] = [
        { '==': [{ var: 'status' }, 'active'] },
        { '>': [{ var: 'level' }, 5] },
        { in: [{ var: 'type' }, ['warrior', 'mage']] },
      ];

      // Simulate cold expressions (rarely used)
      const coldExpressions: Expression[] = [];
      for (let i = 0; i < 50; i++) {
        coldExpressions.push({ '==': [{ var: `field${i}` }, i] });
      }

      // Cache hot expressions
      const hotKeys = hotExpressions.map((expr) => {
        const key = cache.generateKey(expr);
        cache.set(key, expr);
        return key;
      });

      // Simulate workload: 80% hot, 20% cold (Pareto principle)
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        if (Math.random() < 0.8) {
          // 80% hot expressions
          const hotKey = hotKeys[Math.floor(Math.random() * hotKeys.length)];
          cache.get(hotKey);
        } else {
          // 20% cold expressions
          const coldExpr = coldExpressions[Math.floor(Math.random() * coldExpressions.length)];
          const key = cache.generateKey(coldExpr);
          cache.get(key);
        }
      }

      const duration = performance.now() - start;

      console.log(`Real-world pattern (${iterations} ops): ${duration.toFixed(2)}ms`);
      console.log(`Average per operation: ${(duration / iterations).toFixed(4)}ms`);

      // Should achieve high hit rate (> 60% since hot expressions stay cached)
      const stats = cache.getStats();
      console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);

      expect(stats.hitRate).toBeGreaterThan(0.6);
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });
  });
});
