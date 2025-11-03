/**
 * Field Condition Resolver Tests
 * Integration tests for FieldCondition GraphQL queries and mutations
 */

import type { FieldCondition as PrismaFieldCondition } from '@prisma/client';

import type { AuthenticatedUser } from '../context/graphql-context';
import type {
  CreateFieldConditionInput,
  EvaluateConditionInput,
  FieldConditionOrderByInput,
  FieldConditionWhereInput,
  UpdateFieldConditionInput,
} from '../inputs/field-condition.input';
import type { ConditionService } from '../services/condition.service';
import type { EvaluationResult } from '../types/field-condition.type';

import { FieldConditionResolver } from './field-condition.resolver';

describe('FieldConditionResolver', () => {
  let resolver: FieldConditionResolver;
  let mockConditionService: jest.Mocked<ConditionService>;
  let mockUser: AuthenticatedUser;

  beforeEach(() => {
    // Create mock ConditionService
    mockConditionService = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      findForEntity: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      toggleActive: jest.fn(),
      evaluateCondition: jest.fn(),
    } as unknown as jest.Mocked<ConditionService>;

    // Create resolver with mock
    resolver = new FieldConditionResolver(mockConditionService);

    // Create mock user
    mockUser = {
      id: 'user-123',
      email: 'gm@example.com',
      role: 'gm',
    } as AuthenticatedUser;
  });

  // ============= Query Resolvers Tests =============

  describe('getFieldCondition', () => {
    it('should return field condition when found', async () => {
      const mockCondition: PrismaFieldCondition = {
        id: 'condition-123',
        entityType: 'Settlement',
        entityId: 'settlement-456',
        field: 'is_trade_hub',
        expression: { '>=': [{ var: 'settlement.population' }, 5000] },
        description: 'Check if settlement is trade hub',
        isActive: true,
        priority: 0,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: null,
      };

      mockConditionService.findById.mockResolvedValue(mockCondition);

      const result = await resolver.getFieldCondition('condition-123', mockUser);

      expect(mockConditionService.findById).toHaveBeenCalledWith('condition-123', mockUser);
      expect(result).toEqual(mockCondition);
    });

    it('should return null when condition not found', async () => {
      mockConditionService.findById.mockResolvedValue(null);

      const result = await resolver.getFieldCondition('nonexistent-id', mockUser);

      expect(mockConditionService.findById).toHaveBeenCalledWith('nonexistent-id', mockUser);
      expect(result).toBeNull();
    });

    it('should pass user for authorization', async () => {
      mockConditionService.findById.mockResolvedValue(null);

      await resolver.getFieldCondition('condition-123', mockUser);

      expect(mockConditionService.findById).toHaveBeenCalledWith('condition-123', mockUser);
    });
  });

  describe('listFieldConditions', () => {
    it('should list conditions without filters', async () => {
      const mockConditions: PrismaFieldCondition[] = [
        {
          id: 'condition-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_trade_hub',
          expression: { '>=': [{ var: 'settlement.population' }, 5000] },
          description: null,
          isActive: true,
          priority: 0,
          version: 1,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          deletedAt: null,
          createdBy: 'user-123',
          updatedBy: null,
        },
        {
          id: 'condition-2',
          entityType: 'Structure',
          entityId: 'structure-1',
          field: 'is_operational',
          expression: { '>': [{ var: 'structure.integrity' }, 50] },
          description: null,
          isActive: true,
          priority: 0,
          version: 1,
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
          deletedAt: null,
          createdBy: 'user-123',
          updatedBy: null,
        },
      ];

      mockConditionService.findMany.mockResolvedValue(mockConditions);

      const result = await resolver.listFieldConditions(
        undefined,
        undefined,
        undefined,
        undefined,
        mockUser
      );

      expect(mockConditionService.findMany).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
        mockUser
      );
      expect(result).toEqual(mockConditions);
      expect(result).toHaveLength(2);
    });

    it('should list conditions with filters', async () => {
      const where: FieldConditionWhereInput = {
        entityType: 'Settlement',
        isActive: true,
      };

      mockConditionService.findMany.mockResolvedValue([]);

      await resolver.listFieldConditions(where, undefined, undefined, undefined, mockUser);

      expect(mockConditionService.findMany).toHaveBeenCalledWith(
        where,
        undefined,
        undefined,
        undefined,
        mockUser
      );
    });

    it('should list conditions with sorting', async () => {
      const orderBy: FieldConditionOrderByInput = {
        field: 'PRIORITY',
        order: 'DESC',
      };

      mockConditionService.findMany.mockResolvedValue([]);

      await resolver.listFieldConditions(undefined, orderBy, undefined, undefined, mockUser);

      expect(mockConditionService.findMany).toHaveBeenCalledWith(
        undefined,
        orderBy,
        undefined,
        undefined,
        mockUser
      );
    });

    it('should list conditions with pagination', async () => {
      mockConditionService.findMany.mockResolvedValue([]);

      await resolver.listFieldConditions(undefined, undefined, 10, 20, mockUser);

      expect(mockConditionService.findMany).toHaveBeenCalledWith(
        undefined,
        undefined,
        10,
        20,
        mockUser
      );
    });

    it('should list conditions with all parameters', async () => {
      const where: FieldConditionWhereInput = { entityType: 'Settlement' };
      const orderBy: FieldConditionOrderByInput = {
        field: 'CREATED_AT',
        order: 'ASC',
      };

      mockConditionService.findMany.mockResolvedValue([]);

      await resolver.listFieldConditions(where, orderBy, 5, 10, mockUser);

      expect(mockConditionService.findMany).toHaveBeenCalledWith(where, orderBy, 5, 10, mockUser);
    });
  });

  describe('getConditionsForEntity', () => {
    it('should get conditions for entity with specific field', async () => {
      const mockConditions: PrismaFieldCondition[] = [
        {
          id: 'condition-1',
          entityType: 'Settlement',
          entityId: 'settlement-123',
          field: 'is_trade_hub',
          expression: { '>=': [{ var: 'settlement.population' }, 5000] },
          description: null,
          isActive: true,
          priority: 10,
          version: 1,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          deletedAt: null,
          createdBy: 'user-123',
          updatedBy: null,
        },
      ];

      mockConditionService.findForEntity.mockResolvedValue(mockConditions);

      const result = await resolver.getConditionsForEntity(
        'Settlement',
        'settlement-123',
        'is_trade_hub',
        mockUser
      );

      expect(mockConditionService.findForEntity).toHaveBeenCalledWith(
        'Settlement',
        'settlement-123',
        'is_trade_hub',
        mockUser
      );
      expect(result).toEqual(mockConditions);
    });

    it('should get all conditions for entity when field not specified', async () => {
      mockConditionService.findForEntity.mockResolvedValue([]);

      await resolver.getConditionsForEntity('Settlement', 'settlement-123', undefined, mockUser);

      expect(mockConditionService.findForEntity).toHaveBeenCalledWith(
        'Settlement',
        'settlement-123',
        undefined,
        mockUser
      );
    });

    it('should return empty array when no conditions found', async () => {
      mockConditionService.findForEntity.mockResolvedValue([]);

      const result = await resolver.getConditionsForEntity(
        'Structure',
        'structure-456',
        'is_operational',
        mockUser
      );

      expect(result).toEqual([]);
    });
  });

  describe('evaluateFieldCondition', () => {
    it('should evaluate condition with provided context', async () => {
      const input: EvaluateConditionInput = {
        conditionId: 'condition-123',
        context: { settlement: { population: 10000, merchant_count: 15 } },
      };

      const mockResult: EvaluationResult = {
        value: true,
        success: true,
        trace: [
          {
            step: 'Evaluation started',
            input: { '>=': [{ var: 'settlement.population' }, 5000] },
            output: true,
            passed: true,
          },
        ],
        error: null,
      };

      mockConditionService.evaluateCondition.mockResolvedValue(mockResult);

      const result = await resolver.evaluateFieldCondition(input, mockUser);

      expect(mockConditionService.evaluateCondition).toHaveBeenCalledWith(
        'condition-123',
        input.context,
        mockUser
      );
      expect(result).toEqual(mockResult);
      expect(result.value).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should handle evaluation failure', async () => {
      const input: EvaluateConditionInput = {
        conditionId: 'condition-456',
        context: { invalid: 'data' },
      };

      const mockResult: EvaluationResult = {
        value: null,
        success: false,
        trace: [],
        error: 'Invalid context: missing required fields',
      };

      mockConditionService.evaluateCondition.mockResolvedValue(mockResult);

      const result = await resolver.evaluateFieldCondition(input, mockUser);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid context: missing required fields');
    });
  });

  // ============= Mutation Resolvers Tests =============

  describe('createFieldCondition', () => {
    it('should create condition with valid input', async () => {
      const input: CreateFieldConditionInput = {
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_trade_hub',
        expression: { '>=': [{ var: 'settlement.population' }, 5000] },
        description: 'Check if settlement is trade hub',
        priority: 10,
      };

      const mockCondition: PrismaFieldCondition = {
        id: 'new-condition-123',
        entityType: input.entityType,
        entityId: input.entityId!,
        field: input.field,
        expression: input.expression as Prisma.JsonValue,
        description: input.description!,
        isActive: true,
        priority: input.priority!,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: null,
      };

      mockConditionService.create.mockResolvedValue(mockCondition);

      const result = await resolver.createFieldCondition(input, mockUser);

      expect(mockConditionService.create).toHaveBeenCalledWith(input, mockUser);
      expect(result).toEqual(mockCondition);
      expect(result.id).toBe('new-condition-123');
    });

    it('should create type-level condition with null entityId', async () => {
      const input: CreateFieldConditionInput = {
        entityType: 'Settlement',
        entityId: null,
        field: 'default_visibility',
        expression: { '==': [1, 1] },
        description: 'Default visibility for all settlements',
        priority: 0,
      };

      const mockCondition: PrismaFieldCondition = {
        id: 'type-level-condition',
        entityType: input.entityType,
        entityId: null,
        field: input.field,
        expression: input.expression as Prisma.JsonValue,
        description: input.description!,
        isActive: true,
        priority: 0,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: null,
      };

      mockConditionService.create.mockResolvedValue(mockCondition);

      const result = await resolver.createFieldCondition(input, mockUser);

      expect(mockConditionService.create).toHaveBeenCalledWith(input, mockUser);
      expect(result.entityId).toBeNull();
    });

    it('should pass user to service for authorization', async () => {
      const input: CreateFieldConditionInput = {
        entityType: 'Structure',
        entityId: 'structure-789',
        field: 'is_operational',
        expression: { '>': [{ var: 'structure.integrity' }, 50] },
      };

      mockConditionService.create.mockResolvedValue({} as PrismaFieldCondition);

      await resolver.createFieldCondition(input, mockUser);

      expect(mockConditionService.create).toHaveBeenCalledWith(input, mockUser);
    });
  });

  describe('updateFieldCondition', () => {
    it('should update condition with valid input', async () => {
      const input: UpdateFieldConditionInput = {
        expression: { '>=': [{ var: 'settlement.population' }, 10000] },
        description: 'Updated description',
        isActive: true,
        priority: 20,
        expectedVersion: 1,
      };

      const mockCondition: PrismaFieldCondition = {
        id: 'condition-123',
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_trade_hub',
        expression: input.expression! as Prisma.JsonValue,
        description: input.description!,
        isActive: input.isActive!,
        priority: input.priority!,
        version: 2,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
      };

      mockConditionService.update.mockResolvedValue(mockCondition);

      const result = await resolver.updateFieldCondition('condition-123', input, mockUser);

      expect(mockConditionService.update).toHaveBeenCalledWith('condition-123', input, mockUser);
      expect(result).toEqual(mockCondition);
      expect(result.version).toBe(2);
      expect(result.updatedBy).toBe('user-123');
    });

    it('should update only specific fields', async () => {
      const input: UpdateFieldConditionInput = {
        isActive: false,
        expectedVersion: 1,
      };

      mockConditionService.update.mockResolvedValue({} as PrismaFieldCondition);

      await resolver.updateFieldCondition('condition-456', input, mockUser);

      expect(mockConditionService.update).toHaveBeenCalledWith('condition-456', input, mockUser);
    });

    it('should pass user to service for authorization', async () => {
      const input: UpdateFieldConditionInput = {
        priority: 5,
        expectedVersion: 1,
      };

      mockConditionService.update.mockResolvedValue({} as PrismaFieldCondition);

      await resolver.updateFieldCondition('condition-789', input, mockUser);

      expect(mockConditionService.update).toHaveBeenCalledWith('condition-789', input, mockUser);
    });
  });

  describe('deleteFieldCondition', () => {
    it('should delete condition and return true', async () => {
      const mockDeleted: PrismaFieldCondition = {
        id: 'condition-123',
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_trade_hub',
        expression: {} as Prisma.JsonValue,
        description: null,
        isActive: true,
        priority: 0,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: new Date('2025-01-02'),
        createdBy: 'user-123',
        updatedBy: null,
      };

      mockConditionService.delete.mockResolvedValue(mockDeleted);

      const result = await resolver.deleteFieldCondition('condition-123', mockUser);

      expect(mockConditionService.delete).toHaveBeenCalledWith('condition-123', mockUser);
      expect(result).toBe(true);
    });

    it('should pass user to service for authorization', async () => {
      mockConditionService.delete.mockResolvedValue({} as PrismaFieldCondition);

      await resolver.deleteFieldCondition('condition-456', mockUser);

      expect(mockConditionService.delete).toHaveBeenCalledWith('condition-456', mockUser);
    });
  });

  describe('toggleFieldConditionActive', () => {
    it('should toggle condition to active', async () => {
      const mockCondition: PrismaFieldCondition = {
        id: 'condition-123',
        entityType: 'Settlement',
        entityId: 'settlement-123',
        field: 'is_trade_hub',
        expression: {},
        description: null,
        isActive: true,
        priority: 0,
        version: 2,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
      };

      mockConditionService.toggleActive.mockResolvedValue(mockCondition);

      const result = await resolver.toggleFieldConditionActive('condition-123', true, mockUser);

      expect(mockConditionService.toggleActive).toHaveBeenCalledWith(
        'condition-123',
        true,
        mockUser
      );
      expect(result).toEqual(mockCondition);
      expect(result.isActive).toBe(true);
    });

    it('should toggle condition to inactive', async () => {
      const mockCondition: PrismaFieldCondition = {
        id: 'condition-456',
        entityType: 'Structure',
        entityId: 'structure-456',
        field: 'is_operational',
        expression: {},
        description: null,
        isActive: false,
        priority: 0,
        version: 2,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        deletedAt: null,
        createdBy: 'user-123',
        updatedBy: 'user-123',
      };

      mockConditionService.toggleActive.mockResolvedValue(mockCondition);

      const result = await resolver.toggleFieldConditionActive('condition-456', false, mockUser);

      expect(mockConditionService.toggleActive).toHaveBeenCalledWith(
        'condition-456',
        false,
        mockUser
      );
      expect(result.isActive).toBe(false);
    });

    it('should pass user to service for authorization', async () => {
      mockConditionService.toggleActive.mockResolvedValue({} as PrismaFieldCondition);

      await resolver.toggleFieldConditionActive('condition-789', true, mockUser);

      expect(mockConditionService.toggleActive).toHaveBeenCalledWith(
        'condition-789',
        true,
        mockUser
      );
    });
  });

  // ============= Field Resolvers Tests =============

  describe('Field Resolvers', () => {
    const mockCondition: PrismaFieldCondition = {
      id: 'condition-123',
      entityType: 'Settlement',
      entityId: 'settlement-123',
      field: 'is_trade_hub',
      expression: {} as Prisma.JsonValue,
      description: null,
      isActive: true,
      priority: 0,
      version: 3,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
      deletedAt: null,
      createdBy: 'user-456',
      updatedBy: 'user-789',
    };

    it('should resolve createdBy field', () => {
      const result = resolver.resolveCreatedBy(mockCondition);

      expect(result).toBe('user-456');
    });

    it('should resolve updatedBy field', () => {
      const result = resolver.resolveUpdatedBy(mockCondition);

      expect(result).toBe('user-789');
    });

    it('should resolve updatedBy as null when not set', () => {
      const conditionWithoutUpdate = { ...mockCondition, updatedBy: null };

      const result = resolver.resolveUpdatedBy(conditionWithoutUpdate);

      expect(result).toBeNull();
    });

    it('should resolve version field', () => {
      const result = resolver.resolveVersion(mockCondition);

      expect(result).toBe(3);
    });
  });
});
