/**
 * Expression Validator Tests
 */

import { OperatorRegistry } from '../operator-registry';

import { ExpressionValidator } from './expression.validator';

describe('ExpressionValidator', () => {
  let validator: ExpressionValidator;
  let registry: OperatorRegistry;

  beforeEach(() => {
    registry = new OperatorRegistry();
    validator = new ExpressionValidator(registry);
  });

  describe('validate', () => {
    describe('basic validation', () => {
      it('should accept valid simple comparison expression', () => {
        const expression = { '==': [{ var: 'age' }, 18] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept valid logical expression', () => {
        const expression = {
          and: [{ '>': [{ var: 'age' }, 18] }, { '==': [{ var: 'active' }, true] }],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept valid nested expression', () => {
        const expression = {
          if: [{ '>': [{ var: 'age' }, 18] }, 'adult', 'minor'],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject null expression', () => {
        const result = validator.validate(null as any);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Expression cannot be null or undefined');
      });

      it('should reject undefined expression', () => {
        const result = validator.validate(undefined as any);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Expression cannot be null or undefined');
      });

      it('should accept literal values (primitives)', () => {
        expect(validator.validate(42).valid).toBe(true);
        expect(validator.validate('string').valid).toBe(true);
        expect(validator.validate(true).valid).toBe(true);
        expect(validator.validate(false).valid).toBe(true);
      });

      it('should accept array literals', () => {
        const expression = [1, 2, 3] as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });
    });

    describe('operator validation', () => {
      it('should accept standard JSONLogic operators', () => {
        const operators = [
          { '==': [1, 1] },
          { '!=': [1, 2] },
          { '<': [1, 2] },
          { '>': [2, 1] },
          { '<=': [1, 1] },
          { '>=': [2, 2] },
          { and: [true, true] },
          { or: [false, true] },
          { '!': [false] },
          { if: [true, 'yes', 'no'] },
          { '+': [1, 2] },
          { '-': [3, 1] },
          { '*': [2, 3] },
          { '/': [6, 2] },
          { '%': [5, 2] },
          { max: [1, 2, 3] },
          { min: [1, 2, 3] },
          { var: 'foo' },
          { missing: ['a', 'b'] },
          { missing_some: [1, ['a', 'b']] },
        ] as any[];

        operators.forEach((expr) => {
          const result = validator.validate(expr);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual([]);
        });
      });

      it('should reject unknown operators when not registered', () => {
        const expression = { unknownOp: [1, 2] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Unknown operator: unknownOp');
      });

      it('should accept custom operators that are registered', () => {
        // Register a custom operator
        registry.register({
          name: 'customOp',
          implementation: () => true,
        });

        const expression = { customOp: [1, 2] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject custom operators that are not registered', () => {
        const expression = { notRegistered: [1, 2] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Unknown operator: notRegistered');
      });

      it('should validate nested operators', () => {
        const expression = {
          and: [{ '==': [{ var: 'a' }, 1] }, { unknownOp: [2, 3] }],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Unknown operator: unknownOp');
      });

      it('should accumulate multiple errors', () => {
        const expression = {
          and: [{ unknownOp1: [1, 2] }, { unknownOp2: [3, 4] }],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.errors).toContain('Unknown operator: unknownOp1');
        expect(result.errors).toContain('Unknown operator: unknownOp2');
      });
    });

    describe('structure validation', () => {
      it('should validate deeply nested expressions', () => {
        const expression = {
          if: [
            {
              and: [
                { '>': [{ var: 'level' }, 5] },
                {
                  or: [
                    { '==': [{ var: 'class' }, 'warrior'] },
                    { '==': [{ var: 'class' }, 'mage'] },
                  ],
                },
              ],
            },
            { '+': [{ var: 'baseHealth' }, 10] },
            { var: 'baseHealth' },
          ],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should handle expressions with arrays', () => {
        const expression = {
          in: [{ var: 'status' }, ['active', 'pending', 'completed']],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });

      it('should handle map operations', () => {
        const expression = {
          map: [{ var: 'numbers' }, { '*': [{ var: '' }, 2] }],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });

      it('should handle reduce operations', () => {
        const expression = {
          reduce: [{ var: 'numbers' }, { '+': [{ var: 'current' }, { var: 'accumulator' }] }, 0],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });

      it('should handle filter operations', () => {
        const expression = {
          filter: [{ var: 'items' }, { '>': [{ var: 'price' }, 10] }],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle empty objects', () => {
        const result = validator.validate({} as any);

        expect(result.valid).toBe(true);
      });

      it('should handle empty arrays', () => {
        const result = validator.validate([] as any);

        expect(result.valid).toBe(true);
      });

      it('should handle expressions with null values', () => {
        const expression = { '==': [{ var: 'value' }, null] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });

      it('should validate expressions with special characters in var names', () => {
        const expression = { '==': [{ var: 'user.name' }, 'John'] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });

      it('should handle expressions with numeric keys', () => {
        const expression = { '==': [{ var: '0' }, 'first'] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });
    });

    describe('error reporting', () => {
      it('should provide clear error messages', () => {
        const expression = { badOperator: [1, 2] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/Unknown operator/);
        expect(result.errors[0]).toMatch(/badOperator/);
      });

      it('should not duplicate errors for repeated invalid operators', () => {
        const expression = {
          and: [{ badOp: [1, 2] }, { badOp: [3, 4] }, { badOp: [5, 6] }],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        // Should only report "badOp" once
        const badOpErrors = result.errors.filter((e) => e.includes('badOp'));
        expect(badOpErrors).toHaveLength(1);
      });
    });

    describe('integration with OperatorRegistry', () => {
      it('should use OperatorRegistry to check custom operators', () => {
        registry.register({
          name: 'inside',
          implementation: () => true,
        });

        registry.register({
          name: 'distanceFrom',
          implementation: () => 5,
        });

        const expression = {
          and: [{ inside: ['loc1', 'region1'] }, { '<': [{ distanceFrom: ['loc1', 'loc2'] }, 10] }],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject unregistered custom operators', () => {
        registry.register({
          name: 'inside',
          implementation: () => true,
        });

        const expression = {
          and: [{ inside: ['loc1', 'region1'] }, { notRegistered: ['arg'] }],
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Unknown operator: notRegistered');
      });
    });
  });
});
