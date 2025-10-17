/**
 * Integration tests for Condition-Variable system integration
 * Tests that FieldConditions can reference StateVariables in their expressions
 */

import { Test, TestingModule } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { PrismaService } from '../../database/prisma.service';
import { ExpressionParserService } from '../../rules/expression-parser.service';

import { ConditionEvaluationService } from './condition-evaluation.service';
import { VariableEvaluationService } from './variable-evaluation.service';

describe('Condition-Variable Integration', () => {
  let conditionEvaluation: ConditionEvaluationService;
  let prisma: DeepMockProxy<PrismaClient>;
  let variableEvaluation: jest.Mocked<VariableEvaluationService>;
  let expressionParser: jest.Mocked<ExpressionParserService>;

  beforeEach(async () => {
    // Create mock for PrismaService
    const prismaMock = mockDeep<PrismaClient>();

    // Create mock for ExpressionParserService
    const expressionParserMock = {
      evaluate: jest.fn(),
    } as unknown as jest.Mocked<ExpressionParserService>;

    // Create mock for VariableEvaluationService
    const variableEvaluationMock = {
      evaluateVariable: jest.fn(),
    } as unknown as jest.Mocked<VariableEvaluationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionEvaluationService,
        {
          provide: ExpressionParserService,
          useValue: expressionParserMock,
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: VariableEvaluationService,
          useValue: variableEvaluationMock,
        },
      ],
    }).compile();

    conditionEvaluation = module.get<ConditionEvaluationService>(ConditionEvaluationService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaClient>;
    variableEvaluation = module.get(
      VariableEvaluationService
    ) as jest.Mocked<VariableEvaluationService>;
    expressionParser = module.get(ExpressionParserService) as jest.Mocked<ExpressionParserService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildContextWithVariables', () => {
    it('should build context without variables when includeVariables is false', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
          population: 5000,
        },
      };

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: false,
      });

      expect(context).toEqual(entityData);
      expect(context).not.toHaveProperty('var');
      expect(prisma.stateVariable.findMany).not.toHaveBeenCalled();
    });

    it('should build context without variables when includeVariables is not specified', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
        },
      };

      const context = await conditionEvaluation.buildContextWithVariables(entityData);

      expect(context).toEqual(entityData);
      expect(context).not.toHaveProperty('var');
      expect(prisma.stateVariable.findMany).not.toHaveBeenCalled();
    });

    it('should log warning and return basic context when scope is missing', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
        },
      };

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scopeId: 'settlement-1',
        // scope is missing
      });

      expect(context).toEqual(entityData);
      expect(context).not.toHaveProperty('var');
      expect(prisma.stateVariable.findMany).not.toHaveBeenCalled();
    });

    it('should log warning and return basic context when scopeId is missing', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
        },
      };

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'settlement',
        // scopeId is missing
      });

      expect(context).toEqual(entityData);
      expect(context).not.toHaveProperty('var');
      expect(prisma.stateVariable.findMany).not.toHaveBeenCalled();
    });

    it('should fetch and include settlement variables when includeVariables is true', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
          population: 5000,
        },
      };

      const var1 = {
        id: 'var-1',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'merchant_count',
        value: 15,
        type: 'integer',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      const var2 = {
        id: 'var-2',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'has_trade_route',
        value: true,
        type: 'boolean',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Mock variable query
      prisma.stateVariable.findMany.mockResolvedValue([var1, var2]);

      // Mock variable evaluation for each variable
      variableEvaluation.evaluateVariable
        .mockResolvedValueOnce({ success: true, value: 15 })
        .mockResolvedValueOnce({ success: true, value: true });

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'settlement',
        scopeId: 'settlement-1',
      });

      expect(context).toEqual({
        ...entityData,
        var: {
          merchant_count: 15,
          has_trade_route: true,
        },
      });

      expect(prisma.stateVariable.findMany).toHaveBeenCalledWith({
        where: {
          scope: 'settlement',
          scopeId: 'settlement-1',
          isActive: true,
          deletedAt: null,
        },
      });

      expect(variableEvaluation.evaluateVariable).toHaveBeenCalledWith(var1, {});
      expect(variableEvaluation.evaluateVariable).toHaveBeenCalledWith(var2, {});
    });

    it('should fetch and include structure variables when includeVariables is true', async () => {
      const entityData = {
        structure: {
          id: 'structure-1',
          name: 'Test Structure',
          type: 'Market',
          level: 2,
        },
      };

      const variable = {
        id: 'var-1',
        scope: 'structure',
        scopeId: 'structure-1',
        key: 'upgrade_progress',
        value: 65,
        type: 'integer',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Mock variable query
      prisma.stateVariable.findMany.mockResolvedValue([variable]);

      // Mock variable evaluation
      variableEvaluation.evaluateVariable.mockResolvedValue({ success: true, value: 65 });

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'structure',
        scopeId: 'structure-1',
      });

      expect(context).toEqual({
        ...entityData,
        var: {
          upgrade_progress: 65,
        },
      });

      expect(variableEvaluation.evaluateVariable).toHaveBeenCalledWith(variable, {});
    });

    it('should handle derived variables by evaluating formulas', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
          population: 8500,
        },
      };

      const derivedVariable = {
        id: 'var-1',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'prosperity_level',
        value: null,
        type: 'derived',
        formula: {
          if: [
            { '>': [{ var: 'settlement.population' }, 10000] },
            'thriving',
            { '>': [{ var: 'settlement.population' }, 5000] },
            'prosperous',
            'stable',
          ],
        },
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Mock variable query with derived variable
      prisma.stateVariable.findMany.mockResolvedValue([derivedVariable]);

      // Mock variable evaluation to return the computed value
      variableEvaluation.evaluateVariable.mockResolvedValue({
        success: true,
        value: 'prosperous',
      });

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'settlement',
        scopeId: 'settlement-1',
      });

      expect(context).toEqual({
        ...entityData,
        var: {
          prosperity_level: 'prosperous',
        },
      });

      // Verify variable evaluation was called with the derived variable
      expect(variableEvaluation.evaluateVariable).toHaveBeenCalledWith(derivedVariable, {});
    });

    it('should return empty var object when no variables exist', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
        },
      };

      // Mock empty variable query
      prisma.stateVariable.findMany.mockResolvedValue([]);

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'settlement',
        scopeId: 'settlement-1',
      });

      // Should return basic context without var namespace when no variables
      expect(context).toEqual(entityData);
      expect(context).not.toHaveProperty('var');
    });

    it('should skip failed variable evaluations and continue processing others', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
        },
      };

      const goodVar = {
        id: 'var-1',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'good_var',
        value: 'value1',
        type: 'string',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      const badVar = {
        id: 'var-2',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'bad_var',
        value: null,
        type: 'derived',
        formula: { invalid: 'formula that will fail' },
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Mock variable query with one good and one bad variable
      prisma.stateVariable.findMany.mockResolvedValue([goodVar, badVar]);

      // Mock variable evaluation: success for first, failure for second
      variableEvaluation.evaluateVariable
        .mockResolvedValueOnce({ success: true, value: 'value1' })
        .mockResolvedValueOnce({ success: false, value: undefined });

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'settlement',
        scopeId: 'settlement-1',
      });

      // Should include only the successful variable
      expect(context).toEqual({
        ...entityData,
        var: {
          good_var: 'value1',
        },
      });
    });

    it('should return basic context when database query fails', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
        },
      };

      // Mock database error
      prisma.stateVariable.findMany.mockRejectedValue(new Error('Database error'));

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'settlement',
        scopeId: 'settlement-1',
      });

      // Should return basic context without failing
      expect(context).toEqual(entityData);
      expect(context).not.toHaveProperty('var');
    });
  });

  describe('Condition evaluation with variables', () => {
    it('should evaluate condition referencing variables successfully', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
          population: 6000,
        },
      };

      const var1 = {
        id: 'var-1',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'merchant_count',
        value: 15,
        type: 'integer',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      const var2 = {
        id: 'var-2',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'has_trade_route',
        value: true,
        type: 'boolean',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Mock variables
      prisma.stateVariable.findMany.mockResolvedValue([var1, var2]);

      // Mock variable evaluation
      variableEvaluation.evaluateVariable
        .mockResolvedValueOnce({ success: true, value: 15 })
        .mockResolvedValueOnce({ success: true, value: true });

      // Mock expression parser to evaluate the condition
      expressionParser.evaluate.mockReturnValue({ success: true, value: true });

      // Build context with variables
      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'settlement',
        scopeId: 'settlement-1',
      });

      // Condition expression: is_trade_hub = population >= 5000 AND merchant_count >= 10 AND has_trade_route
      const expression = {
        and: [
          { '>=': [{ var: 'settlement.population' }, 5000] },
          { '>=': [{ var: 'var.merchant_count' }, 10] },
          { '==': [{ var: 'var.has_trade_route' }, true] },
        ],
      };

      const result = conditionEvaluation.evaluateExpression(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should evaluate condition with mixed entity and variable references', async () => {
      const entityData = {
        structure: {
          id: 'structure-1',
          name: 'Market',
          type: 'Market',
          level: 2,
        },
      };

      const variable = {
        id: 'var-1',
        scope: 'structure',
        scopeId: 'structure-1',
        key: 'daily_revenue',
        value: 150,
        type: 'integer',
        formula: null,
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Mock variables
      prisma.stateVariable.findMany.mockResolvedValue([variable]);

      // Mock variable evaluation
      variableEvaluation.evaluateVariable.mockResolvedValue({ success: true, value: 150 });

      // Mock expression parser
      expressionParser.evaluate.mockReturnValue({ success: true, value: true });

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'structure',
        scopeId: 'structure-1',
      });

      // Condition: is_profitable = level >= 2 AND daily_revenue > 100
      const expression = {
        and: [
          { '>=': [{ var: 'structure.level' }, 2] },
          { '>': [{ var: 'var.daily_revenue' }, 100] },
        ],
      };

      const result = conditionEvaluation.evaluateExpression(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should handle derived variables in condition evaluation', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
          population: 12000,
        },
      };

      const derivedVariable = {
        id: 'var-1',
        scope: 'settlement',
        scopeId: 'settlement-1',
        key: 'prosperity_level',
        value: null,
        type: 'derived',
        formula: {
          if: [
            { '>': [{ var: 'settlement.population' }, 10000] },
            'thriving',
            { '>': [{ var: 'settlement.population' }, 5000] },
            'prosperous',
            'stable',
          ],
        },
        description: null,
        isActive: true,
        deletedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Mock variables with derived variable
      prisma.stateVariable.findMany.mockResolvedValue([derivedVariable]);

      // Mock variable evaluation to return 'thriving'
      variableEvaluation.evaluateVariable.mockResolvedValue({
        success: true,
        value: 'thriving',
      });

      // Mock expression parser
      expressionParser.evaluate.mockReturnValue({ success: true, value: true });

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'settlement',
        scopeId: 'settlement-1',
      });

      // Condition: is_major_city = prosperity_level == 'thriving'
      const expression = {
        '==': [{ var: 'var.prosperity_level' }, 'thriving'],
      };

      const result = conditionEvaluation.evaluateExpression(expression, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should handle missing variable references gracefully', async () => {
      const entityData = {
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
        },
      };

      // Mock empty variables
      prisma.stateVariable.findMany.mockResolvedValue([]);

      // Mock expression parser to return false for undefined >= 10
      expressionParser.evaluate.mockReturnValue({ success: true, value: false });

      const context = await conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'settlement',
        scopeId: 'settlement-1',
      });

      // Condition references non-existent variable
      const expression = {
        '>=': [{ var: 'var.merchant_count' }, 10],
      };

      const result = conditionEvaluation.evaluateExpression(expression, context);

      // JSONLogic treats undefined as null/0 depending on operator
      expect(result.success).toBe(true);
      expect(result.value).toBe(false); // undefined >= 10 is false
    });
  });
});
