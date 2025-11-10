/**
 * ConditionService Tests
 * Comprehensive unit tests for all CRUD operations, authorization, and validation
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { FieldCondition as PrismaFieldCondition, Prisma } from '@prisma/client';

import { CacheStatsService } from '../../common/cache/cache-stats.service';
import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CACHE } from '../cache/redis-cache.provider';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type {
  CreateFieldConditionInput,
  UpdateFieldConditionInput,
  FieldConditionWhereInput,
  FieldConditionOrderByInput,
} from '../inputs/field-condition.input';
import { FieldConditionSortField } from '../inputs/field-condition.input';
import { SortOrder } from '../inputs/filter.input';

import { AuditService } from './audit.service';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { ConditionService } from './condition.service';
import { DependencyGraphService } from './dependency-graph.service';

describe('ConditionService', () => {
  let service: ConditionService;
  let prisma: PrismaService;
  let audit: AuditService;
  let evaluationService: ConditionEvaluationService;
  let cacheService: CacheService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'gm',
  };

  const mockCondition: PrismaFieldCondition = {
    id: 'condition-1',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    field: 'is_trade_hub',
    expression: { '>=': [{ var: 'settlement.population' }, 5000] } as unknown as Prisma.JsonValue,
    description: 'Check if settlement is a trade hub',
    isActive: true,
    priority: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: 'user-1',
    updatedBy: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionService,
        {
          provide: PrismaService,
          useValue: {
            fieldCondition: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            settlement: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            structure: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            kingdom: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            party: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            character: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: ConditionEvaluationService,
          useValue: {
            validateExpression: jest.fn(),
            evaluateWithTrace: jest.fn(),
          },
        },
        {
          provide: DependencyGraphService,
          useValue: {
            invalidateGraph: jest.fn(),
          },
        },
        {
          provide: REDIS_CACHE,
          useValue: {
            get: jest.fn(),
            setex: jest.fn(),
            del: jest.fn(),
            scan: jest.fn(),
            options: { keyPrefix: 'cache:' },
          },
        },
        CacheService,
        {
          provide: CacheStatsService,
          useValue: {
            recordHit: jest.fn(),
            recordMiss: jest.fn(),
            recordSet: jest.fn(),
            recordInvalidation: jest.fn(),
            recordCascadeInvalidation: jest.fn(),
            getStats: jest.fn(),
            resetStats: jest.fn(),
            getHitRateForType: jest.fn(),
            estimateTimeSaved: jest.fn(),
            getRedisMemoryInfo: jest.fn(),
            getKeyCountByType: jest.fn(),
          },
        },
        {
          provide: 'REDIS_PUBSUB',
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConditionService>(ConditionService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
    evaluationService = module.get<ConditionEvaluationService>(ConditionEvaluationService);
    cacheService = module.get<CacheService>(CacheService);

    // Spy on CacheService methods used by tests
    jest.spyOn(cacheService, 'get').mockResolvedValue(null);
    jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);
    jest.spyOn(cacheService, 'del').mockResolvedValue(0);
    jest.spyOn(cacheService, 'delPattern').mockResolvedValue({ success: true, keysDeleted: 0 });
    jest
      .spyOn(cacheService, 'invalidateCampaignComputedFields')
      .mockResolvedValue({ success: true, keysDeleted: 0 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput: CreateFieldConditionInput = {
      entityType: 'Settlement',
      entityId: 'settlement-1',
      field: 'is_trade_hub',
      expression: { '>=': [{ var: 'settlement.population' }, 5000] },
      description: 'Check if settlement is a trade hub',
      priority: 0,
    };

    it('should create a condition successfully', async () => {
      (evaluationService.validateExpression as jest.Mock).mockReturnValue({
        valid: true,
        isValid: true,
        errors: [],
      });
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (prisma.fieldCondition.create as jest.Mock).mockResolvedValue(mockCondition);

      const result = await service.create(createInput, mockUser);

      expect(result).toEqual(mockCondition);
      expect(evaluationService.validateExpression).toHaveBeenCalledWith(createInput.expression);
      expect(prisma.settlement.findFirst).toHaveBeenCalled();
      expect(prisma.fieldCondition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'Settlement',
            entityId: 'settlement-1',
            field: 'is_trade_hub',
            createdBy: mockUser.id,
          }),
        })
      );
      expect(audit.log).toHaveBeenCalledWith(
        'field_condition',
        mockCondition.id,
        'CREATE',
        mockUser.id,
        expect.any(Object)
      );
    });

    it('should reject invalid expression', async () => {
      (evaluationService.validateExpression as jest.Mock).mockReturnValue({
        valid: false,
        isValid: false,
        errors: ['Invalid expression'],
        error: 'Invalid expression',
      });

      await expect(service.create(createInput, mockUser)).rejects.toThrow(BadRequestException);
      expect(prisma.fieldCondition.create).not.toHaveBeenCalled();
    });

    it('should verify entity access for instance-level conditions', async () => {
      (evaluationService.validateExpression as jest.Mock).mockReturnValue({
        valid: true,
        isValid: true,
        errors: [],
      });
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(createInput, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should allow type-level conditions without entity verification', async () => {
      const typeLevelInput = { ...createInput, entityId: null };
      (evaluationService.validateExpression as jest.Mock).mockReturnValue({
        valid: true,
        isValid: true,
        errors: [],
      });
      (prisma.fieldCondition.create as jest.Mock).mockResolvedValue({
        ...mockCondition,
        entityId: null,
      });

      const result = await service.create(typeLevelInput, mockUser);

      expect(result.entityId).toBeNull();
      expect(prisma.settlement.findFirst).not.toHaveBeenCalled();
    });

    it('should use default priority of 0 if not provided', async () => {
      const inputWithoutPriority = { ...createInput };
      delete inputWithoutPriority.priority;

      (evaluationService.validateExpression as jest.Mock).mockReturnValue({
        valid: true,
        isValid: true,
        errors: [],
      });
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (prisma.fieldCondition.create as jest.Mock).mockResolvedValue(mockCondition);

      await service.create(inputWithoutPriority, mockUser);

      expect(prisma.fieldCondition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 0,
          }),
        })
      );
    });
  });

  describe('findById', () => {
    it('should return condition when user has access', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });

      const result = await service.findById('condition-1', mockUser);

      expect(result).toEqual(mockCondition);
      expect(prisma.fieldCondition.findUnique).toHaveBeenCalledWith({
        where: { id: 'condition-1' },
      });
    });

    it('should return null if condition not found', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent', mockUser);

      expect(result).toBeNull();
    });

    it('should return null if condition is deleted', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue({
        ...mockCondition,
        deletedAt: new Date(),
      });

      const result = await service.findById('condition-1', mockUser);

      expect(result).toBeNull();
    });

    it('should return null if user does not have access', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('condition-1', mockUser);

      expect(result).toBeNull();
    });

    it('should return type-level conditions without access check', async () => {
      const typeLevelCondition = { ...mockCondition, entityId: null };
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(typeLevelCondition);

      const result = await service.findById('condition-1', mockUser);

      expect(result).toEqual(typeLevelCondition);
      expect(prisma.settlement.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('findMany', () => {
    const whereInput: FieldConditionWhereInput = {
      entityType: 'Settlement',
      isActive: true,
    };

    const orderByInput: FieldConditionOrderByInput = {
      field: FieldConditionSortField.PRIORITY,
      order: SortOrder.DESC,
    };

    it('should return filtered conditions', async () => {
      (prisma.fieldCondition.findMany as jest.Mock).mockResolvedValue([mockCondition]);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });

      const result = await service.findMany(whereInput, orderByInput, 0, 10, mockUser);

      expect(result).toEqual([mockCondition]);
      expect(prisma.fieldCondition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'Settlement',
            isActive: true,
            deletedAt: null,
          }),
          skip: 0,
          take: 10,
        })
      );
    });

    it('should filter conditions by user access when user provided', async () => {
      const conditions = [
        mockCondition,
        { ...mockCondition, id: 'condition-2', entityId: 'settlement-2' },
      ];

      (prisma.fieldCondition.findMany as jest.Mock).mockResolvedValue(conditions);
      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'settlement-1' })
        .mockResolvedValueOnce(null);

      const result = await service.findMany(
        whereInput,
        orderByInput,
        undefined,
        undefined,
        mockUser
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('condition-1');
    });

    it('should include deleted conditions when includeDeleted is true', async () => {
      const whereWithDeleted = { ...whereInput, includeDeleted: true };
      (prisma.fieldCondition.findMany as jest.Mock).mockResolvedValue([mockCondition]);

      await service.findMany(whereWithDeleted, orderByInput);

      expect(prisma.fieldCondition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            deletedAt: expect.anything(),
          }),
        })
      );
    });

    it('should apply date range filters', async () => {
      const createdAfter = new Date('2024-01-01');
      const createdBefore = new Date('2024-12-31');
      const whereWithDates = { ...whereInput, createdAfter, createdBefore };

      (prisma.fieldCondition.findMany as jest.Mock).mockResolvedValue([mockCondition]);

      await service.findMany(whereWithDates, orderByInput);

      expect(prisma.fieldCondition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: createdAfter,
              lte: createdBefore,
            },
          }),
        })
      );
    });

    it('should return all conditions when no user provided', async () => {
      (prisma.fieldCondition.findMany as jest.Mock).mockResolvedValue([mockCondition]);

      const result = await service.findMany(whereInput, orderByInput);

      expect(result).toEqual([mockCondition]);
      expect(prisma.settlement.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('findForEntity', () => {
    it('should return conditions for specific entity and field', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (prisma.fieldCondition.findMany as jest.Mock).mockResolvedValue([mockCondition]);

      const result = await service.findForEntity(
        'Settlement',
        'settlement-1',
        'is_trade_hub',
        mockUser
      );

      expect(result).toEqual([mockCondition]);
      expect(prisma.fieldCondition.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_trade_hub',
          isActive: true,
          deletedAt: null,
        },
        orderBy: {
          priority: 'desc',
        },
      });
    });

    it('should return conditions for all fields when field is null', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (prisma.fieldCondition.findMany as jest.Mock).mockResolvedValue([mockCondition]);

      const result = await service.findForEntity('Settlement', 'settlement-1', null, mockUser);

      expect(result).toEqual([mockCondition]);
      expect(prisma.fieldCondition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            field: expect.anything(),
          }),
        })
      );
    });

    it('should verify entity access', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findForEntity('Settlement', 'settlement-1', 'is_trade_hub', mockUser)
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip access check for type-level conditions', async () => {
      (prisma.fieldCondition.findMany as jest.Mock).mockResolvedValue([
        { ...mockCondition, entityId: null },
      ]);

      const result = await service.findForEntity('Settlement', null, 'is_trade_hub', mockUser);

      expect(result).toHaveLength(1);
      expect(prisma.settlement.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateInput: UpdateFieldConditionInput = {
      description: 'Updated description',
      priority: 10,
      expectedVersion: 1,
    };

    it('should update condition successfully', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (prisma.fieldCondition.update as jest.Mock).mockResolvedValue({
        ...mockCondition,
        ...updateInput,
        version: 2,
      });

      const result = await service.update('condition-1', updateInput, mockUser);

      expect(result.version).toBe(2);
      expect(result.description).toBe('Updated description');
      expect(prisma.fieldCondition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'condition-1' },
          data: expect.objectContaining({
            description: 'Updated description',
            priority: 10,
            version: 2,
            updater: {
              connect: { id: mockUser.id },
            },
          }),
        })
      );
      expect(audit.log).toHaveBeenCalled();
    });

    it('should validate expression if changed', async () => {
      const inputWithExpression = { ...updateInput, expression: { '==': [1, 1] } };
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (evaluationService.validateExpression as jest.Mock).mockReturnValue({
        valid: true,
        isValid: true,
        errors: [],
      });
      (prisma.fieldCondition.update as jest.Mock).mockResolvedValue({
        ...mockCondition,
        version: 2,
      });

      await service.update('condition-1', inputWithExpression, mockUser);

      expect(evaluationService.validateExpression).toHaveBeenCalledWith(
        inputWithExpression.expression
      );
    });

    it('should reject invalid expression', async () => {
      const inputWithExpression = { ...updateInput, expression: { invalid: [] } };
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (evaluationService.validateExpression as jest.Mock).mockReturnValue({
        valid: false,
        isValid: false,
        errors: ['Invalid'],
        error: 'Invalid',
      });

      await expect(service.update('condition-1', inputWithExpression, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw OptimisticLockException on version mismatch', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });

      const wrongVersionInput = { ...updateInput, expectedVersion: 999 };

      await expect(service.update('condition-1', wrongVersionInput, mockUser)).rejects.toThrow(
        OptimisticLockException
      );
    });

    it('should throw NotFoundException if condition not found', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('nonexistent', updateInput, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('delete', () => {
    it('should soft delete condition', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (prisma.fieldCondition.update as jest.Mock).mockResolvedValue({
        ...mockCondition,
        deletedAt: new Date(),
      });

      const result = await service.delete('condition-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(prisma.fieldCondition.update).toHaveBeenCalledWith({
        where: { id: 'condition-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith(
        'field_condition',
        'condition-1',
        'DELETE',
        mockUser.id,
        expect.objectContaining({
          deletedAt: expect.any(Date),
        })
      );
    });

    it('should throw NotFoundException if condition not found', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleActive', () => {
    it('should toggle active status to false', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (prisma.fieldCondition.update as jest.Mock).mockResolvedValue({
        ...mockCondition,
        isActive: false,
      });

      const result = await service.toggleActive('condition-1', false, mockUser);

      expect(result.isActive).toBe(false);
      expect(prisma.fieldCondition.update).toHaveBeenCalledWith({
        where: { id: 'condition-1' },
        data: { isActive: false },
      });
    });

    it('should toggle active status to true', async () => {
      const inactiveCondition = { ...mockCondition, isActive: false };
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(inactiveCondition);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (prisma.fieldCondition.update as jest.Mock).mockResolvedValue({
        ...inactiveCondition,
        isActive: true,
      });

      const result = await service.toggleActive('condition-1', true, mockUser);

      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if condition not found', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.toggleActive('nonexistent', true, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('evaluateCondition', () => {
    const context = { settlement: { population: 10000 } };

    it('should evaluate condition and return result', async () => {
      const evaluationResult = {
        success: true,
        value: true,
        trace: [],
        error: undefined,
      };

      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });
      (evaluationService.evaluateWithTrace as jest.Mock).mockReturnValue(evaluationResult);

      const result = await service.evaluateCondition('condition-1', context, mockUser);

      expect(result).toEqual(evaluationResult);
      expect(evaluationService.evaluateWithTrace).toHaveBeenCalledWith(
        mockCondition.expression,
        context
      );
    });

    it('should throw NotFoundException if condition not found', async () => {
      (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.evaluateCondition('nonexistent', context, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('verifyEntityAccess', () => {
    it('should verify Settlement access successfully', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });

      await expect(
        service['verifyEntityAccess']('Settlement', 'settlement-1', mockUser)
      ).resolves.toBeUndefined();
    });

    it('should verify Structure access successfully', async () => {
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue({ id: 'structure-1' });

      await expect(
        service['verifyEntityAccess']('Structure', 'structure-1', mockUser)
      ).resolves.toBeUndefined();
    });

    it('should verify Kingdom access successfully', async () => {
      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue({ id: 'kingdom-1' });

      await expect(
        service['verifyEntityAccess']('Kingdom', 'kingdom-1', mockUser)
      ).resolves.toBeUndefined();
    });

    it('should verify Party access successfully', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue({ id: 'party-1' });

      await expect(
        service['verifyEntityAccess']('Party', 'party-1', mockUser)
      ).resolves.toBeUndefined();
    });

    it('should verify Character access successfully', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue({ id: 'character-1' });

      await expect(
        service['verifyEntityAccess']('Character', 'character-1', mockUser)
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when entity not found', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service['verifyEntityAccess']('Settlement', 'nonexistent', mockUser)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for unsupported entity type', async () => {
      await expect(
        service['verifyEntityAccess']('UnsupportedType', 'some-id', mockUser)
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle case-insensitive entity types', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({ id: 'settlement-1' });

      await expect(
        service['verifyEntityAccess']('settlement', 'settlement-1', mockUser)
      ).resolves.toBeUndefined();
    });
  });

  describe('buildOrderBy', () => {
    it('should build order by for PRIORITY field', () => {
      const orderBy: FieldConditionOrderByInput = {
        field: FieldConditionSortField.PRIORITY,
        order: SortOrder.DESC,
      };
      const result = service['buildOrderBy'](orderBy);
      expect(result).toEqual({ priority: 'desc' });
    });

    it('should build order by for ENTITY_TYPE field', () => {
      const orderBy: FieldConditionOrderByInput = {
        field: FieldConditionSortField.ENTITY_TYPE,
        order: SortOrder.ASC,
      };
      const result = service['buildOrderBy'](orderBy);
      expect(result).toEqual({ entityType: 'asc' });
    });

    it('should build order by for FIELD field', () => {
      const orderBy: FieldConditionOrderByInput = {
        field: FieldConditionSortField.FIELD,
        order: SortOrder.ASC,
      };
      const result = service['buildOrderBy'](orderBy);
      expect(result).toEqual({ field: 'asc' });
    });

    it('should build order by for CREATED_AT field', () => {
      const orderBy: FieldConditionOrderByInput = {
        field: FieldConditionSortField.CREATED_AT,
        order: SortOrder.DESC,
      };
      const result = service['buildOrderBy'](orderBy);
      expect(result).toEqual({ createdAt: 'desc' });
    });

    it('should build order by for UPDATED_AT field', () => {
      const orderBy: FieldConditionOrderByInput = {
        field: FieldConditionSortField.UPDATED_AT,
        order: SortOrder.DESC,
      };
      const result = service['buildOrderBy'](orderBy);
      expect(result).toEqual({ updatedAt: 'desc' });
    });

    it('should use defaults when field and order not provided', () => {
      const orderBy: FieldConditionOrderByInput = {};
      const result = service['buildOrderBy'](orderBy);
      expect(result).toEqual({ priority: 'desc' });
    });
  });

  describe('Cache Invalidation', () => {
    describe('FieldCondition changes invalidate all computed fields', () => {
      const createInput: CreateFieldConditionInput = {
        entityType: 'Settlement',
        entityId: 'settlement-1',
        field: 'is_trade_hub',
        expression: { '>=': [{ var: 'settlement.population' }, 5000] },
        description: 'Check if settlement is a trade hub',
        priority: 0,
      };

      beforeEach(() => {
        // Mock successful validation and entity lookup
        (evaluationService.validateExpression as jest.Mock).mockReturnValue({
          valid: true,
          isValid: true,
          errors: [],
        });
        // Mock for verifyEntityAccess (uses findFirst)
        (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({
          id: 'settlement-1',
          campaignId: 'campaign-1',
        });
        // Mock for getCampaignIdForCondition (uses findUnique with select)
        (prisma.settlement.findUnique as jest.Mock).mockResolvedValue({
          id: 'settlement-1',
          kingdom: {
            campaignId: 'campaign-1',
          },
        });
      });

      it('should invalidate all computed fields when FieldCondition is created', async () => {
        // Mock condition creation
        (prisma.fieldCondition.create as jest.Mock).mockResolvedValue(mockCondition);

        // Mock cache invalidation success
        (cacheService.invalidateCampaignComputedFields as jest.Mock).mockResolvedValue({
          success: true,
          keysDeleted: 42,
        });

        await service.create(createInput, mockUser);

        // Verify cache invalidation was called with correct parameters
        expect(cacheService.invalidateCampaignComputedFields).toHaveBeenCalledWith(
          'campaign-1',
          'main'
        );
        expect(cacheService.invalidateCampaignComputedFields).toHaveBeenCalledTimes(1);
      });

      it('should invalidate all computed fields when FieldCondition is updated', async () => {
        // Mock condition lookup
        (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);

        // Mock settlement lookup for campaignId (findUnique with select for getCampaignIdForCondition)
        (prisma.settlement.findUnique as jest.Mock).mockResolvedValue({
          id: 'settlement-1',
          kingdom: {
            campaignId: 'campaign-1',
          },
        });
        // Mock for verifyEntityAccess (uses findFirst)
        (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({
          id: 'settlement-1',
          campaignId: 'campaign-1',
        });

        // Mock condition update
        const updatedCondition = { ...mockCondition, version: 2 };
        (prisma.fieldCondition.update as jest.Mock).mockResolvedValue(updatedCondition);

        // Mock cache invalidation success
        (cacheService.invalidateCampaignComputedFields as jest.Mock).mockResolvedValue({
          success: true,
          keysDeleted: 42,
        });

        const updateInput: UpdateFieldConditionInput = {
          expression: { '>=': [{ var: 'settlement.population' }, 10000] },
          expectedVersion: 1,
        };

        await service.update('condition-1', updateInput, mockUser);

        // Verify cache invalidation was called with correct parameters
        expect(cacheService.invalidateCampaignComputedFields).toHaveBeenCalledWith(
          'campaign-1',
          'main'
        );
        expect(cacheService.invalidateCampaignComputedFields).toHaveBeenCalledTimes(1);
      });

      it('should invalidate all computed fields when FieldCondition is deleted', async () => {
        // Mock condition lookup
        (prisma.fieldCondition.findUnique as jest.Mock).mockResolvedValue(mockCondition);

        // Mock settlement lookup for campaignId (findUnique with select for getCampaignIdForCondition)
        (prisma.settlement.findUnique as jest.Mock).mockResolvedValue({
          id: 'settlement-1',
          kingdom: {
            campaignId: 'campaign-1',
          },
        });
        // Mock for verifyEntityAccess (uses findFirst)
        (prisma.settlement.findFirst as jest.Mock).mockResolvedValue({
          id: 'settlement-1',
          campaignId: 'campaign-1',
        });

        // Mock soft delete
        const deletedCondition = { ...mockCondition, deletedAt: new Date() };
        (prisma.fieldCondition.update as jest.Mock).mockResolvedValue(deletedCondition);

        // Mock cache invalidation success
        (cacheService.invalidateCampaignComputedFields as jest.Mock).mockResolvedValue({
          success: true,
          keysDeleted: 42,
        });

        await service.delete('condition-1', mockUser);

        // Verify cache invalidation was called with correct parameters
        expect(cacheService.invalidateCampaignComputedFields).toHaveBeenCalledWith(
          'campaign-1',
          'main'
        );
        expect(cacheService.invalidateCampaignComputedFields).toHaveBeenCalledTimes(1);
      });

      it('should handle graceful degradation when cache invalidation fails', async () => {
        // Mock condition creation
        (prisma.fieldCondition.create as jest.Mock).mockResolvedValue(mockCondition);

        // Mock cache invalidation failure
        (cacheService.invalidateCampaignComputedFields as jest.Mock).mockResolvedValue({
          success: false,
          keysDeleted: 0,
          error: 'Redis connection error',
        });

        // Create should still succeed even if cache invalidation fails
        const result = await service.create(createInput, mockUser);

        expect(result).toEqual(mockCondition);
        expect(cacheService.invalidateCampaignComputedFields).toHaveBeenCalled();
      });
    });
  });
});
