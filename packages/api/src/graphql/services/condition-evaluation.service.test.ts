/**
 * ConditionEvaluationService Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ExpressionParserService } from '../../rules/expression-parser.service';
import type { EvaluationResult as ExpressionResult } from '../../rules/types/expression.types';

import { ConditionEvaluationService } from './condition-evaluation.service';
import { VariableEvaluationService } from './variable-evaluation.service';

describe('ConditionEvaluationService', () => {
  let service: ConditionEvaluationService;
  let expressionParser: ExpressionParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionEvaluationService,
        {
          provide: ExpressionParserService,
          useValue: {
            evaluate: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            stateVariable: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: VariableEvaluationService,
          useValue: {
            evaluateVariable: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConditionEvaluationService>(ConditionEvaluationService);
    expressionParser = module.get<ExpressionParserService>(ExpressionParserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateExpression', () => {
    it('should evaluate a simple expression successfully', () => {
      const expression: Prisma.JsonValue = { '==': [1, 1] };
      const context = {};
      const mockResult: ExpressionResult<boolean> = {
        success: true,
        value: true,
      };

      (expressionParser.evaluate as jest.Mock).mockReturnValue(mockResult);

      const result = service.evaluateExpression(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
      expect(result.error).toBeUndefined();
      expect(expressionParser.evaluate).toHaveBeenCalledWith(expression, context);
    });

    it('should evaluate expression with context variables', () => {
      const expression: Prisma.JsonValue = { '>=': [{ var: 'settlement.population' }, 5000] };
      const context = { settlement: { population: 10000 } };
      const mockResult: ExpressionResult<boolean> = {
        success: true,
        value: true,
      };

      (expressionParser.evaluate as jest.Mock).mockReturnValue(mockResult);

      const result = service.evaluateExpression(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should handle complex nested expressions', () => {
      const expression: Prisma.JsonValue = {
        and: [
          { '>=': [{ var: 'settlement.population' }, 5000] },
          { '>=': [{ var: 'settlement.merchant_count' }, 10] },
          { in: ['trade_route', { var: 'settlement.tags' }] },
        ],
      };
      const context = {
        settlement: {
          population: 10000,
          merchant_count: 15,
          tags: ['trade_route', 'coastal'],
        },
      };
      const mockResult: ExpressionResult<boolean> = {
        success: true,
        value: true,
      };

      (expressionParser.evaluate as jest.Mock).mockReturnValue(mockResult);

      const result = service.evaluateExpression(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return false when expression evaluates to false', () => {
      const expression: Prisma.JsonValue = { '>': [{ var: 'value' }, 100] };
      const context = { value: 50 };
      const mockResult: ExpressionResult<boolean> = {
        success: true,
        value: false,
      };

      (expressionParser.evaluate as jest.Mock).mockReturnValue(mockResult);

      const result = service.evaluateExpression(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should handle null expression', () => {
      const expression: Prisma.JsonValue = null;
      const context = {};

      const result = service.evaluateExpression(expression, context);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.error).toBe('Expression cannot be null or undefined');
    });

    it('should handle undefined expression', () => {
      const expression = undefined as unknown as Prisma.JsonValue;
      const context = {};

      const result = service.evaluateExpression(expression, context);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.error).toBe('Expression cannot be null or undefined');
    });

    it('should handle invalid context (null)', () => {
      const expression: Prisma.JsonValue = { '==': [1, 1] };
      const context = null as unknown as Record<string, unknown>;

      const result = service.evaluateExpression(expression, context);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.error).toBe('Context must be a valid object');
    });

    it('should handle invalid context (non-object)', () => {
      const expression: Prisma.JsonValue = { '==': [1, 1] };
      const context = 'invalid' as unknown as Record<string, unknown>;

      const result = service.evaluateExpression(expression, context);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.error).toBe('Context must be a valid object');
    });

    it('should handle evaluation errors from expression parser', () => {
      const expression: Prisma.JsonValue = { unknown_op: [] };
      const context = {};
      const mockResult: ExpressionResult<unknown> = {
        success: false,
        value: null,
        error: 'Unknown operator: unknown_op',
      };

      (expressionParser.evaluate as jest.Mock).mockReturnValue(mockResult);

      const result = service.evaluateExpression(expression, context);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.error).toBe('Unknown operator: unknown_op');
    });

    it('should handle exceptions during evaluation', () => {
      const expression: Prisma.JsonValue = { '==': [1, 1] };
      const context = {};

      (expressionParser.evaluate as jest.Mock).mockImplementation(() => {
        throw new Error('Parser crashed');
      });

      const result = service.evaluateExpression(expression, context);

      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.error).toBe('Parser crashed');
    });
  });

  describe('evaluateWithTrace', () => {
    it('should evaluate with trace successfully', () => {
      const expression: Prisma.JsonValue = { '>=': [{ var: 'value' }, 100] };
      const context = { value: 150 };

      // Mock evaluate to return success
      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: true,
        error: undefined,
      });

      const result = service.evaluateWithTrace(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
      expect(result.trace).toBeDefined();
      expect(result.trace.length).toBeGreaterThan(0);

      // Check trace contains expected steps
      const steps = result.trace.map((t) => t.step);
      expect(steps).toContain('Start evaluation');
      expect(steps).toContain('Validate expression structure');
      expect(steps).toContain('Build evaluation context');
      expect(steps).toContain('Evaluate expression');
    });

    it('should include variable resolution in trace', () => {
      const expression: Prisma.JsonValue = { '>=': [{ var: 'settlement.population' }, 5000] };
      const context = { settlement: { population: 10000 } };

      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: true,
      });

      const result = service.evaluateWithTrace(expression, context);

      expect(result.success).toBe(true);
      expect(result.trace).toBeDefined();

      // Check for variable resolution step
      const steps = result.trace.map((t) => t.step);
      expect(steps).toContain('Resolve variables');

      // Find variable resolution step
      const varStep = result.trace.find((t) => t.step === 'Resolve variables');
      expect(varStep).toBeDefined();
      expect(varStep!.input).toEqual(['settlement.population']);
      expect(varStep!.output).toEqual({ 'settlement.population': 10000 });
    });

    it('should trace validation failure', () => {
      const expression: Prisma.JsonValue = null;
      const context = {};

      const result = service.evaluateWithTrace(expression, context);

      expect(result.success).toBe(false);
      expect(result.trace).toBeDefined();
      expect(result.error).toContain('Expression cannot be null or undefined');

      // Check validation step failed
      const validationStep = result.trace.find((t) => t.step === 'Validate expression structure');
      expect(validationStep).toBeDefined();
      expect(validationStep!.passed).toBe(false);
    });

    it('should trace evaluation failure', () => {
      const expression: Prisma.JsonValue = { '==': [1, 1] };
      const context = {};

      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: false,
        value: null,
        error: 'Evaluation error',
      });

      const result = service.evaluateWithTrace(expression, context);

      expect(result.success).toBe(false);
      expect(result.trace).toBeDefined();

      // Check evaluation step failed
      const evalStep = result.trace.find((t) => t.step === 'Evaluate expression');
      expect(evalStep).toBeDefined();
      expect(evalStep!.passed).toBe(false);
    });

    it('should handle exceptions during trace evaluation', () => {
      const expression: Prisma.JsonValue = { '==': [1, 1] };
      const context = {};

      jest.spyOn(service, 'evaluateExpression').mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = service.evaluateWithTrace(expression, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
      expect(result.trace).toBeDefined();

      // Check error step exists
      const errorStep = result.trace.find((t) => t.step === 'Error occurred');
      expect(errorStep).toBeDefined();
      expect(errorStep!.passed).toBe(false);
    });

    it('should handle expressions with multiple variables', () => {
      const expression: Prisma.JsonValue = {
        and: [
          { '>=': [{ var: 'settlement.population' }, 5000] },
          { '>=': [{ var: 'settlement.merchant_count' }, 10] },
        ],
      };
      const context = {
        settlement: {
          population: 10000,
          merchant_count: 15,
        },
      };

      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: true,
      });

      const result = service.evaluateWithTrace(expression, context);

      expect(result.success).toBe(true);

      // Check variable resolution includes both variables
      const varStep = result.trace.find((t) => t.step === 'Resolve variables');
      expect(varStep).toBeDefined();
      expect((varStep!.input as string[]).length).toBe(2);
      expect(varStep!.input).toContain('settlement.population');
      expect(varStep!.input).toContain('settlement.merchant_count');
    });
  });

  describe('buildContext', () => {
    it('should return entity data as-is for valid object', () => {
      const entity = { settlement: { population: 5000, name: 'Test City' } };

      const context = service.buildContext(entity);

      expect(context).toEqual(entity);
    });

    it('should handle nested objects', () => {
      const entity = {
        settlement: {
          population: 5000,
          location: {
            x: 100,
            y: 200,
          },
          tags: ['coastal', 'trade'],
        },
      };

      const context = service.buildContext(entity);

      expect(context).toEqual(entity);
    });

    it('should return empty object for null entity', () => {
      const entity = null as unknown as Record<string, unknown>;

      const context = service.buildContext(entity);

      expect(context).toEqual({});
    });

    it('should return empty object for undefined entity', () => {
      const entity = undefined as unknown as Record<string, unknown>;

      const context = service.buildContext(entity);

      expect(context).toEqual({});
    });

    it('should return empty object for non-object entity', () => {
      const entity = 'not an object' as unknown as Record<string, unknown>;

      const context = service.buildContext(entity);

      expect(context).toEqual({});
    });

    it('should handle empty object', () => {
      const entity = {};

      const context = service.buildContext(entity);

      expect(context).toEqual({});
    });
  });

  describe('validateExpression', () => {
    it('should validate simple expression', () => {
      const expression: Prisma.JsonValue = { '==': [1, 1] };

      const result = service.validateExpression(expression);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate complex nested expression', () => {
      const expression: Prisma.JsonValue = {
        and: [{ '>=': [{ var: 'value' }, 10] }, { '<=': [{ var: 'value' }, 100] }],
      };

      const result = service.validateExpression(expression);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject null expression', () => {
      const expression: Prisma.JsonValue = null;

      const result = service.validateExpression(expression);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expression cannot be null or undefined');
    });

    it('should reject undefined expression', () => {
      const expression = undefined as unknown as Prisma.JsonValue;

      const result = service.validateExpression(expression);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expression cannot be null or undefined');
    });

    it('should reject array as expression', () => {
      const expression: Prisma.JsonValue = [1, 2, 3];

      const result = service.validateExpression(expression);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expression must be a valid object');
    });

    it('should reject empty object', () => {
      const expression: Prisma.JsonValue = {};

      const result = service.validateExpression(expression);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expression must contain at least one operator');
    });

    it('should handle deeply nested expressions', () => {
      const expression: Prisma.JsonValue = {
        and: [
          { or: [{ '==': [1, 1] }, { '==': [2, 2] }] },
          { or: [{ '==': [3, 3] }, { '==': [4, 4] }] },
        ],
      };

      const result = service.validateExpression(expression);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject expressions exceeding max depth', () => {
      // Create a very deeply nested expression (depth > 10)
      let expression: Prisma.JsonValue = { '==': [1, 1] };
      for (let i = 0; i < 12; i++) {
        expression = { and: [expression] };
      }

      const result = service.validateExpression(expression);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('maximum depth'))).toBe(true);
    });
  });

  describe('extractVariables (private method)', () => {
    it('should extract variables from simple expression', () => {
      const expression: Prisma.JsonValue = { '>=': [{ var: 'settlement.population' }, 5000] };

      // Call evaluateWithTrace which uses extractVariables internally
      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: true,
      });

      const result = service.evaluateWithTrace(expression, {});

      const varStep = result.trace.find((t) => t.step === 'Resolve variables');
      expect(varStep).toBeDefined();
      expect(varStep!.input).toEqual(['settlement.population']);
    });

    it('should extract multiple variables', () => {
      const expression: Prisma.JsonValue = {
        and: [
          { '>=': [{ var: 'a' }, 1] },
          { '>=': [{ var: 'b' }, 2] },
          { '>=': [{ var: 'c' }, 3] },
        ],
      };

      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: true,
      });

      const result = service.evaluateWithTrace(expression, {});

      const varStep = result.trace.find((t) => t.step === 'Resolve variables');
      expect(varStep).toBeDefined();
      expect((varStep!.input as string[]).length).toBe(3);
    });

    it('should extract duplicate variables only once', () => {
      const expression: Prisma.JsonValue = {
        and: [{ '>=': [{ var: 'value' }, 1] }, { '<=': [{ var: 'value' }, 10] }],
      };

      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: true,
      });

      const result = service.evaluateWithTrace(expression, {});

      const varStep = result.trace.find((t) => t.step === 'Resolve variables');
      expect(varStep).toBeDefined();
      expect((varStep!.input as string[]).length).toBe(1);
      expect(varStep!.input).toEqual(['value']);
    });
  });

  describe('resolveVariable (private method)', () => {
    it('should resolve simple variable', () => {
      const expression: Prisma.JsonValue = { '>=': [{ var: 'value' }, 100] };
      const context = { value: 150 };

      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: true,
      });

      const result = service.evaluateWithTrace(expression, context);

      const varStep = result.trace.find((t) => t.step === 'Resolve variables');
      expect(varStep).toBeDefined();
      expect(varStep!.output).toEqual({ value: 150 });
    });

    it('should resolve nested variable path', () => {
      const expression: Prisma.JsonValue = { '>=': [{ var: 'settlement.population' }, 5000] };
      const context = { settlement: { population: 10000 } };

      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: true,
      });

      const result = service.evaluateWithTrace(expression, context);

      const varStep = result.trace.find((t) => t.step === 'Resolve variables');
      expect(varStep).toBeDefined();
      expect(varStep!.output).toEqual({ 'settlement.population': 10000 });
    });

    it('should resolve deeply nested variable path', () => {
      const expression: Prisma.JsonValue = { '>=': [{ var: 'a.b.c.d' }, 1] };
      const context = { a: { b: { c: { d: 42 } } } };

      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: true,
      });

      const result = service.evaluateWithTrace(expression, context);

      const varStep = result.trace.find((t) => t.step === 'Resolve variables');
      expect(varStep).toBeDefined();
      expect(varStep!.output).toEqual({ 'a.b.c.d': 42 });
    });

    it('should return undefined for missing variable', () => {
      const expression: Prisma.JsonValue = { '>=': [{ var: 'missing' }, 1] };
      const context = { value: 100 };

      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: false,
      });

      const result = service.evaluateWithTrace(expression, context);

      const varStep = result.trace.find((t) => t.step === 'Resolve variables');
      expect(varStep).toBeDefined();
      expect(varStep!.output).toEqual({ missing: undefined });
    });

    it('should return undefined for missing nested path', () => {
      const expression: Prisma.JsonValue = { '>=': [{ var: 'a.b.c' }, 1] };
      const context = { a: { x: 10 } };

      jest.spyOn(service, 'evaluateExpression').mockReturnValue({
        success: true,
        value: false,
      });

      const result = service.evaluateWithTrace(expression, context);

      const varStep = result.trace.find((t) => t.step === 'Resolve variables');
      expect(varStep).toBeDefined();
      expect(varStep!.output).toEqual({ 'a.b.c': undefined });
    });
  });
});
