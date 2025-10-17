/**
 * Expression Parser Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';

import { ExpressionParserService } from './expression-parser.service';
import { OperatorRegistry } from './operator-registry';
import type { Expression, EvaluationContext } from './types/expression.types';

describe('ExpressionParserService', () => {
  let service: ExpressionParserService;
  let registry: OperatorRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpressionParserService, OperatorRegistry],
    }).compile();

    service = module.get<ExpressionParserService>(ExpressionParserService);
    registry = module.get<OperatorRegistry>(OperatorRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
    registry.clear(); // Clean up registered operators between tests
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
});
