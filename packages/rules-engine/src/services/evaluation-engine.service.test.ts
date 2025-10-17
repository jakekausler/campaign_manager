/**
 * Unit tests for EvaluationEngineService
 */

import { Logger } from '@nestjs/common';
import { type Prisma, type PrismaClient } from '@prisma/client';
import { type DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { EvaluationEngineService } from './evaluation-engine.service';

// Type helper to access private methods in tests
// Using a more flexible approach to avoid type intersection conflicts
interface EvaluationEngineServiceTestAccess {
  prisma: PrismaClient;
  validateExpression: (expression: unknown) => { isValid: boolean; errors: string[] };
  buildContext: (entity: unknown) => Record<string, unknown>;
  extractVariables: (expression: unknown) => string[];
  resolveVariable: (varPath: string, context: Record<string, unknown>) => unknown;
}

describe('EvaluationEngineService', () => {
  let service: EvaluationEngineService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    // Create a new instance for each test
    service = new EvaluationEngineService();

    // Mock Prisma Client
    prismaMock = mockDeep<PrismaClient>();
    (service as unknown as EvaluationEngineServiceTestAccess).prisma = prismaMock;

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('evaluateCondition', () => {
    it('should evaluate a simple condition successfully', async () => {
      // Arrange
      const conditionId = 'condition-123';
      const context = { population: 5000 };
      const mockCondition = {
        id: conditionId,
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_large',
        expression: { '>=': [{ var: 'population' }, 5000] } as Prisma.JsonValue,
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      prismaMock.fieldCondition.findUnique.mockResolvedValue(mockCondition);

      // Act
      const result = await service.evaluateCondition(conditionId, context, false);

      // Assert
      expect(result.success).toBe(true);
      expect(JSON.parse(result.valueJson!)).toBe(true);
      expect(result.error).toBeNull();
      expect(prismaMock.fieldCondition.findUnique).toHaveBeenCalledWith({
        where: { id: conditionId, deletedAt: null },
      });
    });

    it('should return error when condition not found', async () => {
      // Arrange
      const conditionId = 'nonexistent-condition';
      const context = { population: 5000 };

      prismaMock.fieldCondition.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.evaluateCondition(conditionId, context, false);

      // Assert
      expect(result.success).toBe(false);
      expect(result.valueJson).toBeNull();
      expect(result.error).toContain('Condition not found');
    });

    it('should return error when condition is not active', async () => {
      // Arrange
      const conditionId = 'condition-123';
      const context = { population: 5000 };
      const mockCondition = {
        id: conditionId,
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_large',
        expression: { '>=': [{ var: 'population' }, 5000] } as Prisma.JsonValue,
        isActive: false, // Inactive
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      prismaMock.fieldCondition.findUnique.mockResolvedValue(mockCondition);

      // Act
      const result = await service.evaluateCondition(conditionId, context, false);

      // Assert
      expect(result.success).toBe(false);
      expect(result.valueJson).toBeNull();
      expect(result.error).toContain('Condition is not active');
    });

    it('should include trace when requested', async () => {
      // Arrange
      const conditionId = 'condition-123';
      const context = { population: 5000 };
      const mockCondition = {
        id: conditionId,
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_large',
        expression: { '>=': [{ var: 'population' }, 5000] } as Prisma.JsonValue,
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      prismaMock.fieldCondition.findUnique.mockResolvedValue(mockCondition);

      // Act
      const result = await service.evaluateCondition(conditionId, context, true);

      // Assert
      expect(result.success).toBe(true);
      expect(result.trace).toHaveLength(6); // Fetch, active check, validate, build context, evaluate, resolve vars
      expect(result.trace[0].description).toContain('Fetch condition');
      expect(result.trace[1].description).toContain('active');
      expect(result.trace[2].description).toContain('Validate');
      expect(result.trace[3].description).toContain('Build evaluation context');
      expect(result.trace[4].description).toContain('Evaluate');
      expect(result.trace[5].description).toContain('Resolve variables');
    });

    it('should handle complex nested expressions', async () => {
      // Arrange
      const conditionId = 'condition-123';
      const context = {
        population: 6000,
        merchant_count: 15,
        tags: ['trade_route', 'coastal'],
      };
      const mockCondition = {
        id: conditionId,
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_trade_hub',
        expression: {
          and: [
            { '>=': [{ var: 'population' }, 5000] },
            { '>=': [{ var: 'merchant_count' }, 10] },
            { in: ['trade_route', { var: 'tags' }] },
          ],
        } as Prisma.JsonValue,
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      prismaMock.fieldCondition.findUnique.mockResolvedValue(mockCondition);

      // Act
      const result = await service.evaluateCondition(conditionId, context, false);

      // Assert
      expect(result.success).toBe(true);
      expect(JSON.parse(result.valueJson!)).toBe(true);
    });

    it('should handle missing variables gracefully', async () => {
      // Arrange
      const conditionId = 'condition-123';
      const context = {}; // Missing population variable
      const mockCondition = {
        id: conditionId,
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_large',
        expression: { '>=': [{ var: 'population' }, 5000] } as Prisma.JsonValue,
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      prismaMock.fieldCondition.findUnique.mockResolvedValue(mockCondition);

      // Act
      const result = await service.evaluateCondition(conditionId, context, false);

      // Assert
      // JSONLogic treats missing variables as null, so this should still succeed
      expect(result.success).toBe(true);
      expect(JSON.parse(result.valueJson!)).toBe(false); // null >= 5000 is false
    });

    it('should reject expression with excessive nesting depth', async () => {
      // Arrange
      const conditionId = 'condition-123';
      const context = { value: 1 };

      // Create deeply nested expression (more than 10 levels)
      let deepExpression: Record<string, unknown> = { var: 'value' };
      for (let i = 0; i < 12; i++) {
        deepExpression = { '+': [deepExpression, 1] };
      }

      const mockCondition = {
        id: conditionId,
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'computed_value',
        expression: deepExpression as Prisma.JsonValue,
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      prismaMock.fieldCondition.findUnique.mockResolvedValue(mockCondition);

      // Act
      const result = await service.evaluateCondition(conditionId, context, false);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum depth');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const conditionId = 'condition-123';
      const context = { population: 5000 };

      prismaMock.fieldCondition.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const result = await service.evaluateCondition(conditionId, context, false);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    it('should measure evaluation time', async () => {
      // Arrange
      const conditionId = 'condition-123';
      const context = { population: 5000 };
      const mockCondition = {
        id: conditionId,
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_large',
        expression: { '>=': [{ var: 'population' }, 5000] } as Prisma.JsonValue,
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      prismaMock.fieldCondition.findUnique.mockResolvedValue(mockCondition);

      // Act
      const result = await service.evaluateCondition(conditionId, context, false);

      // Assert
      expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('evaluateConditions', () => {
    it('should evaluate multiple conditions successfully', async () => {
      // Arrange
      const conditionIds = ['condition-1', 'condition-2'];
      const context = { population: 5000, merchant_count: 15 };

      const mockCondition1 = {
        id: 'condition-1',
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_large',
        expression: { '>=': [{ var: 'population' }, 5000] } as Prisma.JsonValue,
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      const mockCondition2 = {
        id: 'condition-2',
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'has_merchants',
        expression: { '>': [{ var: 'merchant_count' }, 10] } as Prisma.JsonValue,
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      prismaMock.fieldCondition.findUnique
        .mockResolvedValueOnce(mockCondition1)
        .mockResolvedValueOnce(mockCondition2);

      // Act
      const results = await service.evaluateConditions(conditionIds, context, false);

      // Assert
      expect(Object.keys(results)).toHaveLength(2);
      expect(results['condition-1'].success).toBe(true);
      expect(results['condition-2'].success).toBe(true);
      expect(JSON.parse(results['condition-1'].valueJson!)).toBe(true);
      expect(JSON.parse(results['condition-2'].valueJson!)).toBe(true);
    });

    it('should handle empty condition list', async () => {
      // Arrange
      const conditionIds: string[] = [];
      const context = { population: 5000 };

      // Act
      const results = await service.evaluateConditions(conditionIds, context, false);

      // Assert
      expect(Object.keys(results)).toHaveLength(0);
    });

    it('should continue evaluating after one condition fails', async () => {
      // Arrange
      const conditionIds = ['condition-1', 'condition-2'];
      const context = { population: 5000 };

      const mockCondition2 = {
        id: 'condition-2',
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'has_merchants',
        expression: { '>': [{ var: 'merchant_count' }, 10] } as Prisma.JsonValue,
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      prismaMock.fieldCondition.findUnique
        .mockResolvedValueOnce(null) // First condition not found
        .mockResolvedValueOnce(mockCondition2);

      // Act
      const results = await service.evaluateConditions(conditionIds, context, false);

      // Assert
      expect(Object.keys(results)).toHaveLength(2);
      expect(results['condition-1'].success).toBe(false);
      expect(results['condition-2'].success).toBe(true);
    });

    it('should include traces when requested', async () => {
      // Arrange
      const conditionIds = ['condition-1'];
      const context = { population: 5000 };

      const mockCondition1 = {
        id: 'condition-1',
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_large',
        expression: { '>=': [{ var: 'population' }, 5000] } as Prisma.JsonValue,
        isActive: true,
        priority: 100,
        version: 1,
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      prismaMock.fieldCondition.findUnique.mockResolvedValue(mockCondition1);

      // Act
      const results = await service.evaluateConditions(conditionIds, context, true);

      // Assert
      expect(results['condition-1'].trace.length).toBeGreaterThan(0);
    });
  });

  describe('private methods validation', () => {
    it('should validate null expression', () => {
      // Act
      const result = (service as unknown as EvaluationEngineServiceTestAccess).validateExpression(
        null
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expression cannot be null or undefined');
    });

    it('should validate array expression', () => {
      // Act
      const result = (service as unknown as EvaluationEngineServiceTestAccess).validateExpression([
        1, 2, 3,
      ]);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expression must be a valid object');
    });

    it('should validate empty expression', () => {
      // Act
      const result = (service as unknown as EvaluationEngineServiceTestAccess).validateExpression(
        {}
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expression must contain at least one operator');
    });

    it('should validate valid expression', () => {
      // Act
      const result = (service as unknown as EvaluationEngineServiceTestAccess).validateExpression({
        '>=': [{ var: 'x' }, 5],
      });

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('context building', () => {
    it('should build context from entity data', () => {
      // Arrange
      const entity = {
        id: 'settlement-123',
        population: 5000,
        tags: ['trade_route'],
      };

      // Act
      const context = (service as unknown as EvaluationEngineServiceTestAccess).buildContext(
        entity
      );

      // Assert
      expect(context).toEqual(entity);
    });

    it('should handle null entity', () => {
      // Act
      const context = (service as unknown as EvaluationEngineServiceTestAccess).buildContext(null);

      // Assert
      expect(context).toEqual({});
    });

    it('should handle non-object entity', () => {
      // Act
      const context = (service as unknown as EvaluationEngineServiceTestAccess).buildContext(
        'not an object'
      );

      // Assert
      expect(context).toEqual({});
    });
  });

  describe('variable extraction', () => {
    it('should extract simple variable', () => {
      // Arrange
      const expression = { '>=': [{ var: 'population' }, 5000] };

      // Act
      const variables = (service as unknown as EvaluationEngineServiceTestAccess).extractVariables(
        expression
      );

      // Assert
      expect(variables).toEqual(['population']);
    });

    it('should extract multiple variables', () => {
      // Arrange
      const expression = {
        and: [{ '>=': [{ var: 'population' }, 5000] }, { '>': [{ var: 'merchant_count' }, 10] }],
      };

      // Act
      const variables = (service as unknown as EvaluationEngineServiceTestAccess).extractVariables(
        expression
      );

      // Assert
      expect(variables).toEqual(['population', 'merchant_count']);
    });

    it('should extract nested property paths', () => {
      // Arrange
      const expression = { '>=': [{ var: 'kingdom.population' }, 10000] };

      // Act
      const variables = (service as unknown as EvaluationEngineServiceTestAccess).extractVariables(
        expression
      );

      // Assert
      expect(variables).toEqual(['kingdom.population']);
    });

    it('should handle expression with no variables', () => {
      // Arrange
      const expression = { '+': [1, 2] };

      // Act
      const variables = (service as unknown as EvaluationEngineServiceTestAccess).extractVariables(
        expression
      );

      // Assert
      expect(variables).toEqual([]);
    });
  });

  describe('variable resolution', () => {
    it('should resolve simple variable', () => {
      // Arrange
      const context = { population: 5000 };

      // Act
      const value = (service as unknown as EvaluationEngineServiceTestAccess).resolveVariable(
        'population',
        context
      );

      // Assert
      expect(value).toBe(5000);
    });

    it('should resolve nested variable', () => {
      // Arrange
      const context = {
        kingdom: {
          name: 'Northern Realm',
          population: 100000,
        },
      };

      // Act
      const value = (service as unknown as EvaluationEngineServiceTestAccess).resolveVariable(
        'kingdom.name',
        context
      );

      // Assert
      expect(value).toBe('Northern Realm');
    });

    it('should return undefined for missing variable', () => {
      // Arrange
      const context = { population: 5000 };

      // Act
      const value = (service as unknown as EvaluationEngineServiceTestAccess).resolveVariable(
        'merchant_count',
        context
      );

      // Assert
      expect(value).toBeUndefined();
    });

    it('should return undefined for missing nested property', () => {
      // Arrange
      const context = { kingdom: { name: 'Test' } };

      // Act
      const value = (service as unknown as EvaluationEngineServiceTestAccess).resolveVariable(
        'kingdom.population',
        context
      );

      // Assert
      expect(value).toBeUndefined();
    });
  });
});
