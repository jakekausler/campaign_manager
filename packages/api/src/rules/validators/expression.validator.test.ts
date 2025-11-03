/**
 * Expression Validator Tests
 */

import type { RulesLogic } from 'json-logic-js';

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
        const expression: RulesLogic = { '==': [{ var: 'age' }, 18] };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept valid logical expression', () => {
        const expression: RulesLogic = {
          and: [{ '>': [{ var: 'age' }, 18] }, { '==': [{ var: 'active' }, true] }],
        };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept valid nested expression', () => {
        const expression: RulesLogic = {
          if: [{ '>': [{ var: 'age' }, 18] }, 'adult', 'minor'],
        };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject null expression', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = validator.validate(null as any);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Expression cannot be null or undefined');
      });

      it('should reject undefined expression', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // Array literals are not directly assignable to RulesLogic, but validator accepts unknown
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expression = [1, 2, 3] as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });
    });

    describe('operator validation', () => {
      it('should accept standard JSONLogic operators', () => {
        const operators: RulesLogic[] = [
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
        ];

        operators.forEach((expr) => {
          const result = validator.validate(expr);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual([]);
        });
      });

      it('should reject unknown operators when not registered', () => {
        // Testing invalid operator - type assertion needed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        // Testing custom operator - type assertion needed since it's not in standard RulesLogic
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expression = { customOp: [1, 2] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject custom operators that are not registered', () => {
        // Testing unregistered operator - type assertion needed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expression = { notRegistered: [1, 2] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Unknown operator: notRegistered');
      });

      it('should validate nested operators', () => {
        // Testing nested invalid operator - type assertion needed
        const expression = {
          and: [{ '==': [{ var: 'a' }, 1] }, { unknownOp: [2, 3] }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Unknown operator: unknownOp');
      });

      it('should accumulate multiple errors', () => {
        // Testing multiple invalid operators - type assertion needed
        const expression = {
          and: [{ unknownOp1: [1, 2] }, { unknownOp2: [3, 4] }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        const expression: RulesLogic = {
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
        };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should handle expressions with arrays', () => {
        const expression: RulesLogic = {
          in: [{ var: 'status' }, ['active', 'pending', 'completed']],
        };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });

      it('should handle map operations', () => {
        const expression: RulesLogic = {
          map: [{ var: 'numbers' }, { '*': [{ var: '' }, 2] }],
        };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });

      it('should handle reduce operations', () => {
        const expression: RulesLogic = {
          reduce: [{ var: 'numbers' }, { '+': [{ var: 'current' }, { var: 'accumulator' }] }, 0],
        };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });

      it('should handle filter operations', () => {
        const expression: RulesLogic = {
          filter: [{ var: 'items' }, { '>': [{ var: 'price' }, 10] }],
        };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle empty objects', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = validator.validate({} as any);

        expect(result.valid).toBe(true);
      });

      it('should handle empty arrays', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = validator.validate([] as any);

        expect(result.valid).toBe(true);
      });

      it('should handle expressions with null values', () => {
        const expression: RulesLogic = { '==': [{ var: 'value' }, null] };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });

      it('should validate expressions with special characters in var names', () => {
        const expression: RulesLogic = { '==': [{ var: 'user.name' }, 'John'] };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });

      it('should handle expressions with numeric keys', () => {
        const expression: RulesLogic = { '==': [{ var: '0' }, 'first'] };

        const result = validator.validate(expression);

        expect(result.valid).toBe(true);
      });
    });

    describe('error reporting', () => {
      it('should provide clear error messages', () => {
        // Testing error message format - type assertion needed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expression = { badOperator: [1, 2] } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/Unknown operator/);
        expect(result.errors[0]).toMatch(/badOperator/);
      });

      it('should not duplicate errors for repeated invalid operators', () => {
        // Testing error deduplication - type assertion needed
        const expression = {
          and: [{ badOp: [1, 2] }, { badOp: [3, 4] }, { badOp: [5, 6] }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        // Testing registered custom operators - type assertion needed
        const expression = {
          and: [{ inside: ['loc1', 'region1'] }, { '<': [{ distanceFrom: ['loc1', 'loc2'] }, 10] }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        // Testing mixed registered and unregistered operators - type assertion needed
        const expression = {
          and: [{ inside: ['loc1', 'region1'] }, { notRegistered: ['arg'] }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        const result = validator.validate(expression);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Unknown operator: notRegistered');
      });
    });
  });
});
