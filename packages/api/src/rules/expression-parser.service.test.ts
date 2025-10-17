/**
 * Expression Parser Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';

import { ExpressionCache } from './cache/expression-cache';
import { ExpressionParserService } from './expression-parser.service';
import { OperatorRegistry } from './operator-registry';
import type { Expression, EvaluationContext } from './types/expression.types';

describe('ExpressionParserService', () => {
  let service: ExpressionParserService;
  let registry: OperatorRegistry;
  let cache: ExpressionCache;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpressionParserService, OperatorRegistry, ExpressionCache],
    }).compile();

    service = module.get<ExpressionParserService>(ExpressionParserService);
    registry = module.get<OperatorRegistry>(OperatorRegistry);
    cache = module.get<ExpressionCache>(ExpressionCache);
  });

  afterEach(() => {
    jest.clearAllMocks();
    registry.clear(); // Clean up registered operators between tests
    cache.clear(); // Clean up cache between tests
  });

  describe('parse', () => {
    it('should parse a simple JSONLogic expression', () => {
      const expr = { '==': [{ var: 'name' }, 'Alice'] } as Expression;
      const result = service.parse(expr);

      expect(result).toEqual(expr);
    });

    it('should parse a complex nested expression', () => {
      const expr = {
        and: [{ '>': [{ var: 'age' }, 18] }, { '==': [{ var: 'status' }, 'active'] }],
      } as Expression;
      const result = service.parse(expr);

      expect(result).toEqual(expr);
    });

    it('should handle expressions with arrays', () => {
      const expr = { in: [{ var: 'role' }, ['admin', 'moderator']] } as Expression;
      const result = service.parse(expr);

      expect(result).toEqual(expr);
    });

    it('should throw BadRequestException for null expression', () => {
      expect(() => service.parse(null as unknown as Expression)).toThrow(
        'Expression cannot be null or undefined'
      );
    });

    it('should throw BadRequestException for undefined expression', () => {
      expect(() => service.parse(undefined as unknown as Expression)).toThrow(
        'Expression cannot be null or undefined'
      );
    });
  });

  describe('evaluate', () => {
    describe('comparison operators', () => {
      it('should evaluate equality operator', () => {
        const expr: Expression = { '==': [{ var: 'name' }, 'Alice'] };
        const context: EvaluationContext = { name: 'Alice' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate inequality operator', () => {
        const expr: Expression = { '!=': [{ var: 'name' }, 'Bob'] };
        const context: EvaluationContext = { name: 'Alice' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate greater than operator', () => {
        const expr: Expression = { '>': [{ var: 'age' }, 18] };
        const context: EvaluationContext = { age: 25 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate greater than or equal operator', () => {
        const expr: Expression = { '>=': [{ var: 'score' }, 100] };
        const context: EvaluationContext = { score: 100 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate less than operator', () => {
        const expr: Expression = { '<': [{ var: 'count' }, 10] };
        const context: EvaluationContext = { count: 5 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate less than or equal operator', () => {
        const expr: Expression = { '<=': [{ var: 'limit' }, 50] };
        const context: EvaluationContext = { limit: 50 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });
    });

    describe('logical operators', () => {
      it('should evaluate AND operator with true result', () => {
        const expr: Expression = {
          and: [{ '>': [{ var: 'age' }, 18] }, { '==': [{ var: 'status' }, 'active'] }],
        };
        const context: EvaluationContext = { age: 25, status: 'active' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate AND operator with false result', () => {
        const expr: Expression = {
          and: [{ '>': [{ var: 'age' }, 18] }, { '==': [{ var: 'status' }, 'active'] }],
        };
        const context: EvaluationContext = { age: 25, status: 'inactive' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(false);
      });

      it('should evaluate OR operator with true result', () => {
        const expr: Expression = {
          or: [{ '==': [{ var: 'role' }, 'admin'] }, { '==': [{ var: 'role' }, 'moderator'] }],
        };
        const context: EvaluationContext = { role: 'moderator' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate OR operator with false result', () => {
        const expr: Expression = {
          or: [{ '==': [{ var: 'role' }, 'admin'] }, { '==': [{ var: 'role' }, 'moderator'] }],
        };
        const context: EvaluationContext = { role: 'user' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(false);
      });

      it('should evaluate NOT operator', () => {
        const expr: Expression = { '!': [{ '==': [{ var: 'status' }, 'inactive'] }] };
        const context: EvaluationContext = { status: 'active' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });
    });

    describe('array operators', () => {
      it('should evaluate IN operator with value present', () => {
        const expr: Expression = { in: [{ var: 'role' }, ['admin', 'moderator', 'editor']] };
        const context: EvaluationContext = { role: 'admin' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate IN operator with value absent', () => {
        const expr: Expression = { in: [{ var: 'role' }, ['admin', 'moderator']] };
        const context: EvaluationContext = { role: 'user' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(false);
      });
    });

    describe('conditional operators', () => {
      it('should evaluate IF-THEN-ELSE with true condition', () => {
        const expr: Expression = {
          if: [{ '>': [{ var: 'age' }, 18] }, 'adult', 'minor'],
        };
        const context: EvaluationContext = { age: 25 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe('adult');
      });

      it('should evaluate IF-THEN-ELSE with false condition', () => {
        const expr: Expression = {
          if: [{ '>': [{ var: 'age' }, 18] }, 'adult', 'minor'],
        };
        const context: EvaluationContext = { age: 15 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe('minor');
      });
    });

    describe('variable access', () => {
      it('should access top-level variables', () => {
        const expr: Expression = { var: 'name' };
        const context: EvaluationContext = { name: 'Alice' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe('Alice');
      });

      it('should access nested variables with dot notation', () => {
        const expr: Expression = { var: 'user.name' };
        const context: EvaluationContext = { user: { name: 'Alice', age: 25 } };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe('Alice');
      });

      it('should return null for missing variables', () => {
        const expr: Expression = { var: 'missing' };
        const context: EvaluationContext = { name: 'Alice' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBeNull();
      });

      it('should use default value for missing variables', () => {
        const expr: Expression = { var: ['missing', 'default'] };
        const context: EvaluationContext = { name: 'Alice' };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe('default');
      });
    });

    describe('arithmetic operators', () => {
      it('should evaluate addition', () => {
        const expr: Expression = { '+': [{ var: 'a' }, { var: 'b' }] };
        const context: EvaluationContext = { a: 5, b: 3 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(8);
      });

      it('should evaluate subtraction', () => {
        const expr: Expression = { '-': [{ var: 'a' }, { var: 'b' }] };
        const context: EvaluationContext = { a: 10, b: 3 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(7);
      });

      it('should evaluate multiplication', () => {
        const expr: Expression = { '*': [{ var: 'a' }, { var: 'b' }] };
        const context: EvaluationContext = { a: 4, b: 5 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(20);
      });

      it('should evaluate division', () => {
        const expr: Expression = { '/': [{ var: 'a' }, { var: 'b' }] };
        const context: EvaluationContext = { a: 20, b: 4 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(5);
      });

      it('should evaluate modulo', () => {
        const expr: Expression = { '%': [{ var: 'a' }, { var: 'b' }] };
        const context: EvaluationContext = { a: 10, b: 3 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(1);
      });
    });

    describe('complex expressions', () => {
      it('should evaluate complex nested expression', () => {
        const expr: Expression = {
          and: [
            { '>': [{ var: 'age' }, 18] },
            {
              or: [
                { in: [{ var: 'role' }, ['admin', 'moderator']] },
                { '==': [{ var: 'verified' }, true] },
              ],
            },
          ],
        };
        const context: EvaluationContext = {
          age: 25,
          role: 'user',
          verified: true,
        };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should handle evaluation errors gracefully', () => {
        // Test with an expression that might cause an error
        const expr: Expression = { '/': [{ var: 'a' }, 0] }; // Division by zero
        const context: EvaluationContext = { a: 10 };

        const result = service.evaluate(expr, context);

        // JSONLogic returns Infinity for division by zero, which is technically successful
        expect(result.success).toBe(true);
        expect(result.value).toBe(Infinity);
      });
    });

    describe('custom operators', () => {
      it('should evaluate expression with custom operator', () => {
        // Register a custom operator
        registry.register({
          name: 'double',
          implementation: (...args: unknown[]) => (args[0] as number) * 2,
        });

        const expr = { double: [{ var: 'value' }] } as unknown as Expression;
        const context: EvaluationContext = { value: 5 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(10);
      });

      it('should evaluate expression with multiple custom operators', () => {
        // Register custom operators
        registry.register({
          name: 'triple',
          implementation: (...args: unknown[]) => (args[0] as number) * 3,
        });
        registry.register({
          name: 'add10',
          implementation: (...args: unknown[]) => (args[0] as number) + 10,
        });

        const expr = { triple: [{ add10: [{ var: 'value' }] }] } as unknown as Expression;
        const context: EvaluationContext = { value: 5 };

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(45); // (5 + 10) * 3
      });

      it('should combine custom and standard operators', () => {
        // Register a custom operator
        registry.register({
          name: 'square',
          implementation: (...args: unknown[]) => {
            const x = args[0] as number;
            return x * x;
          },
        });

        const expr = {
          '+': [{ square: [3] } as unknown as Expression, { square: [4] } as unknown as Expression],
        } as Expression;
        const context: EvaluationContext = {};

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(25); // 3^2 + 4^2 = 9 + 16 = 25
      });

      it('should work when no custom operators are registered', () => {
        // Don't register any custom operators
        const expr: Expression = { '+': [1, 2] };
        const context: EvaluationContext = {};

        const result = service.evaluate(expr, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe(3);
      });
    });
  });

  describe('expression caching', () => {
    describe('parse with cache', () => {
      it('should cache expression on first parse', () => {
        const expr: Expression = { '==': [{ var: 'x' }, 10] };

        // First parse - should cache
        service.parse(expr);

        const cacheKey = cache.generateKey(expr);
        const cached = cache.get(cacheKey);

        expect(cached).toEqual(expr);
      });

      it('should return cached expression on subsequent parses', () => {
        const expr: Expression = { '==': [{ var: 'x' }, 10] };

        // First parse
        const result1 = service.parse(expr);
        // Second parse - should hit cache
        const result2 = service.parse(expr);

        expect(result1).toEqual(expr);
        expect(result2).toEqual(expr);

        // Verify cache hit rate
        const stats = cache.getStats();
        expect(stats.hits).toBeGreaterThan(0);
      });

      it('should not cache when useCache is false', () => {
        const expr: Expression = { '==': [{ var: 'x' }, 10] };

        service.parse(expr, { useCache: false });

        const cacheKey = cache.generateKey(expr);
        const cached = cache.get(cacheKey);

        expect(cached).toBeUndefined();
      });

      it('should cache by default', () => {
        const expr: Expression = { '==': [{ var: 'x' }, 10] };

        // Parse without options - should cache by default
        service.parse(expr);

        const cacheKey = cache.generateKey(expr);
        const cached = cache.get(cacheKey);

        expect(cached).toEqual(expr);
      });

      it('should handle complex expressions in cache', () => {
        const expr: Expression = {
          and: [
            { '==': [{ var: 'status' }, 'active'] },
            { '>': [{ var: 'level' }, 5] },
            {
              or: [{ in: [{ var: 'type' }, ['warrior', 'mage']] }, { '<': [{ var: 'age' }, 30] }],
            },
          ],
        };

        service.parse(expr);

        const cacheKey = cache.generateKey(expr);
        const cached = cache.get(cacheKey);

        expect(cached).toEqual(expr);
      });
    });

    describe('cache statistics', () => {
      it('should track cache hits and misses', () => {
        const expr1: Expression = { '==': [{ var: 'x' }, 10] };
        const expr2: Expression = { '==': [{ var: 'y' }, 20] };

        // Parse expr1 twice (1 miss, 1 hit)
        service.parse(expr1);
        service.parse(expr1);

        // Parse expr2 once (1 miss)
        service.parse(expr2);

        const stats = cache.getStats();
        expect(stats.size).toBe(2);
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(2);
        expect(stats.hitRate).toBeCloseTo(0.333, 3);
      });

      it('should provide cache statistics via getStats', () => {
        const expr: Expression = { '==': [{ var: 'x' }, 10] };

        service.parse(expr);

        const stats = cache.getStats();
        expect(stats.size).toBe(1);
        expect(stats.maxSize).toBe(100); // Default max size
        expect(stats.keys.length).toBe(1);
      });
    });

    describe('cache LRU behavior', () => {
      it('should respect LRU eviction in small cache', () => {
        // Create service with small cache
        const smallCache = ExpressionCache.create({ maxSize: 2 });
        const smallService = new ExpressionParserService(registry, smallCache);

        const expr1: Expression = { '==': [{ var: 'a' }, 1] };
        const expr2: Expression = { '==': [{ var: 'b' }, 2] };
        const expr3: Expression = { '==': [{ var: 'c' }, 3] };

        // Fill cache to capacity
        smallService.parse(expr1);
        smallService.parse(expr2);

        // Add third expression - should evict expr1
        smallService.parse(expr3);

        const key1 = smallCache.generateKey(expr1);
        const key2 = smallCache.generateKey(expr2);
        const key3 = smallCache.generateKey(expr3);

        expect(smallCache.get(key1)).toBeUndefined();
        expect(smallCache.get(key2)).toEqual(expr2);
        expect(smallCache.get(key3)).toEqual(expr3);
      });
    });

    describe('cache integration with evaluation', () => {
      it('should evaluate cached expressions correctly', () => {
        const expr: Expression = { '==': [{ var: 'name' }, 'Alice'] };

        // Parse and cache
        service.parse(expr);

        // Evaluate using cached expression
        const result = service.evaluate(expr, { name: 'Alice' });

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should handle repeated parse-evaluate cycles', () => {
        const expr: Expression = { '>': [{ var: 'age' }, 18] };

        for (let i = 0; i < 5; i++) {
          // Parse (cached after first)
          const parsed = service.parse(expr);

          // Evaluate
          const result = service.evaluate(parsed, { age: 20 + i });

          expect(result.success).toBe(true);
          expect(result.value).toBe(true);
        }

        // Verify cache hit rate
        const stats = cache.getStats();
        expect(stats.hits).toBe(4); // 4 cache hits (first is miss)
        expect(stats.misses).toBe(1); // 1 cache miss (first parse)
      });
    });
  });
});
