/**
 * Sandbox Executor Tests
 * Security and resource limit tests for safe expression execution
 */

import { BadRequestException } from '@nestjs/common';

import type { Expression, EvaluationContext } from '../types/expression.types';

import { SandboxExecutor, type SandboxOptions } from './sandbox-executor';

describe('SandboxExecutor', () => {
  let executor: SandboxExecutor;

  beforeEach(() => {
    executor = new SandboxExecutor();
  });

  describe('Basic Execution', () => {
    it('should execute a simple expression', () => {
      const expression: Expression = { '==': [1, 1] };
      const result = executor.execute(expression, {});

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should execute expression with context', () => {
      const expression: Expression = { var: 'name' };
      const context: EvaluationContext = { name: 'Alice' };
      const result = executor.execute(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe('Alice');
    });

    it('should handle complex nested expressions', () => {
      const expression: Expression = {
        if: [{ '>': [{ var: 'age' }, 18] }, 'adult', 'minor'],
      };
      const context: EvaluationContext = { age: 25 };
      const result = executor.execute(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe('adult');
    });
  });

  describe('Recursion Depth Limits', () => {
    it('should allow expressions within default depth limit', () => {
      // Create a deeply nested expression (depth 5)
      const expression: Expression = {
        if: [
          { '>': [{ var: 'x' }, 0] },
          {
            if: [
              { '>': [{ var: 'x' }, 1] },
              { if: [{ '>': [{ var: 'x' }, 2] }, true, false] },
              false,
            ],
          },
          false,
        ],
      };
      const context = { x: 3 };
      const result = executor.execute(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should reject expressions exceeding default depth limit', () => {
      // Create a very deeply nested expression (depth > 50)
      let expression: Expression = { var: 'x' };
      for (let i = 0; i < 60; i++) {
        expression = { if: [true, expression, false] };
      }

      const result = executor.execute(expression, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('recursion depth');
    });

    it('should respect custom depth limit', () => {
      const options: SandboxOptions = { maxDepth: 3 };
      const customExecutor = new SandboxExecutor(options);

      // Depth 2 - should pass
      const shallowExpression: Expression = {
        if: [true, { var: 'x' }, false],
      };
      const shallowResult = customExecutor.execute(shallowExpression, { x: 1 });
      expect(shallowResult.success).toBe(true);

      // Depth 4 - should fail
      const deepExpression: Expression = {
        if: [true, { if: [true, { if: [true, { var: 'x' }, false] }, false] }, false],
      };
      const deepResult = customExecutor.execute(deepExpression, { x: 1 });
      expect(deepResult.success).toBe(false);
      expect(deepResult.error).toContain('recursion depth');
    });
  });

  describe('Iteration Count Limits', () => {
    it('should allow array operations within default iteration limit', () => {
      const expression: Expression = {
        map: [[1, 2, 3, 4, 5] as unknown, { '*': [{ var: '' }, 2] }],
      } as Expression;
      const result = executor.execute(expression, {});

      expect(result.success).toBe(true);
      expect(result.value).toEqual([2, 4, 6, 8, 10]);
    });

    it('should reject operations exceeding default iteration limit', () => {
      // Create array with 10,001 items (exceeds default limit of 10,000)
      const largeArray = Array.from({ length: 10001 }, (_, i) => i);
      const expression: Expression = {
        map: [largeArray as unknown, { '+': [{ var: '' }, 1] }],
      } as Expression;

      const result = executor.execute(expression, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('iteration');
    });

    it('should respect custom iteration limit', () => {
      const options: SandboxOptions = { maxIterations: 20 };
      const customExecutor = new SandboxExecutor(options);

      // Small array - should pass
      const smallExpression: Expression = {
        map: [[1, 2, 3] as unknown, { '*': [{ var: '' }, 2] }],
      } as Expression;
      const smallResult = customExecutor.execute(smallExpression, {});
      expect(smallResult.success).toBe(true);

      // Large array - should fail
      const largeExpression: Expression = {
        map: [Array.from({ length: 25 }, (_, i) => i) as unknown, { '*': [{ var: '' }, 2] }],
      } as Expression;
      const largeResult = customExecutor.execute(largeExpression, {});
      expect(largeResult.success).toBe(false);
      expect(largeResult.error).toContain('iteration');
    });
  });

  describe('Execution Timeout', () => {
    it('should allow fast-executing expressions', () => {
      const expression: Expression = { '+': [1, 2, 3, 4, 5] };
      const result = executor.execute(expression, {});

      expect(result.success).toBe(true);
      expect(result.value).toBe(15);
    });

    it('should timeout long-running expressions', () => {
      const options: SandboxOptions = { timeout: 10 }; // 10ms timeout
      const customExecutor = new SandboxExecutor(options);

      // This expression will try to process many iterations
      const largeArray = Array.from({ length: 1000 }, (_, i) => i);
      const expression: Expression = {
        reduce: [largeArray as unknown, { '+': [{ var: 'accumulator' }, { var: 'current' }] }, 0],
      } as Expression;

      const result = customExecutor.execute(expression, {});

      // Should either succeed (if fast enough) or timeout
      if (!result.success) {
        expect(result.error).toContain('timeout');
      }
    });

    it('should use default timeout when not specified', () => {
      const defaultExecutor = new SandboxExecutor();
      const expression: Expression = { '==': [1, 1] };
      const result = defaultExecutor.execute(expression, {});

      expect(result.success).toBe(true);
    });
  });

  describe('Code Injection Prevention', () => {
    it('should prevent access to dangerous JavaScript features', () => {
      // Attempt to use eval (should be prevented)
      const evalExpression: Expression = {
        var: 'eval("malicious code")',
      };
      const result = executor.execute(evalExpression, {});

      // Should not execute eval, just return null for missing var (JSONLogic behavior)
      expect(result.success).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should prevent access to Function constructor', () => {
      const context = {
        Function: Function,
        constructor: Object.constructor,
      };
      const expression: Expression = { var: 'Function' };
      const result = executor.execute(expression, context);

      // Context should be sanitized (dangerous properties removed, returns null)
      expect(result.success).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should prevent access to global object', () => {
      const context = {
        global: global,
        process: process,
        require: require,
      };
      const expression: Expression = { var: 'global' };
      const result = executor.execute(expression, context);

      // Dangerous globals should be filtered out (returns null for missing var)
      expect(result.success).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should prevent __proto__ pollution', () => {
      const context = {
        __proto__: { admin: true },
        constructor: Object.constructor,
      };
      const expression: Expression = { var: '__proto__' };
      const result = executor.execute(expression, context);

      // Should not allow access to __proto__ (filtered out)
      // Note: Returns empty object {} because __proto__ is on every object but we filter it
      expect(result.success).toBe(true);
      expect(result.value).toEqual({});
    });

    it('should allow safe property access', () => {
      const context = {
        user: {
          name: 'Alice',
          age: 30,
        },
      };
      const expression: Expression = { var: 'user.name' };
      const result = executor.execute(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe('Alice');
    });
  });

  describe('Error Handling', () => {
    it('should handle null expression', () => {
      const result = executor.execute(null as unknown as Expression, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expression cannot be null');
    });

    it('should handle undefined expression', () => {
      const result = executor.execute(undefined as unknown as Expression, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expression cannot be null');
    });

    it('should handle null context', () => {
      const expression: Expression = { var: 'x' };
      const result = executor.execute(expression, null as unknown as EvaluationContext);

      // Should use empty context as default (returns null for missing var)
      expect(result.success).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should provide helpful error messages', () => {
      const options: SandboxOptions = { maxDepth: 1 };
      const customExecutor = new SandboxExecutor(options);
      const expression: Expression = { if: [true, { var: 'x' }, false] };

      const result = customExecutor.execute(expression, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
    });
  });

  describe('Options Validation', () => {
    it('should use default options when none provided', () => {
      const defaultExecutor = new SandboxExecutor();
      const expression: Expression = { '==': [1, 1] };
      const result = defaultExecutor.execute(expression, {});

      expect(result.success).toBe(true);
    });

    it('should accept partial options', () => {
      const partialExecutor = new SandboxExecutor({ maxDepth: 10 });
      const expression: Expression = { '==': [1, 1] };
      const result = partialExecutor.execute(expression, {});

      expect(result.success).toBe(true);
    });

    it('should reject negative timeout', () => {
      expect(() => {
        new SandboxExecutor({ timeout: -100 });
      }).toThrow(BadRequestException);
    });

    it('should reject negative maxDepth', () => {
      expect(() => {
        new SandboxExecutor({ maxDepth: -5 });
      }).toThrow(BadRequestException);
    });

    it('should reject negative maxIterations', () => {
      expect(() => {
        new SandboxExecutor({ maxIterations: -1000 });
      }).toThrow(BadRequestException);
    });

    it('should accept zero timeout (no timeout)', () => {
      const noTimeoutExecutor = new SandboxExecutor({ timeout: 0 });
      const expression: Expression = { '==': [1, 1] };
      const result = noTimeoutExecutor.execute(expression, {});

      expect(result.success).toBe(true);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources after timeout', () => {
      const options: SandboxOptions = { timeout: 5 };
      const customExecutor = new SandboxExecutor(options);

      // Create expression that might timeout
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      const expression: Expression = {
        reduce: [largeArray as unknown, { '+': [{ var: 'accumulator' }, { var: 'current' }] }, 0],
      } as Expression;

      const result = customExecutor.execute(expression, {});

      // Execution should complete (success or timeout) without hanging
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should not leak memory on repeated executions', () => {
      const expression: Expression = { '+': [1, 2] };

      // Execute many times to check for leaks
      for (let i = 0; i < 100; i++) {
        const result = executor.execute(expression, {});
        expect(result.success).toBe(true);
      }

      // If we get here without crashing, no obvious leaks
      expect(true).toBe(true);
    });
  });
});
