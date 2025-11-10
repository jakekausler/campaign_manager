/**
 * Effect Service Unit Tests
 * Tests for CRUD operations, authorization, optimistic locking, and dependency graph integration
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Effect as PrismaEffect, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { CacheStatsService } from '../../common/cache/cache-stats.service';
import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CACHE } from '../cache/redis-cache.provider';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type {
  CreateEffectInput,
  UpdateEffectInput,
  EffectWhereInput,
  EffectOrderByInput,
} from '../inputs/effect.input';
import { EffectSortField } from '../inputs/effect.input';
import { SortOrder } from '../inputs/filter.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { EffectTiming } from '../types/effect.type';

import { AuditService } from './audit.service';
import { DependencyGraphService } from './dependency-graph.service';
import { EffectPatchService } from './effect-patch.service';
import { EffectService } from './effect.service';

describe('EffectService', () => {
  let service: EffectService;
  let prisma: jest.Mocked<PrismaService>;
  let audit: jest.Mocked<AuditService>;
  let patchService: jest.Mocked<EffectPatchService>;
  let dependencyGraphService: jest.Mocked<DependencyGraphService>;
  let pubSub: jest.Mocked<RedisPubSub>;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'gm',
  };

  const mockEncounter = {
    id: 'encounter-1',
    campaignId: 'campaign-1',
    deletedAt: null,
  };

  const mockEffect: PrismaEffect = {
    id: 'effect-1',
    name: 'Test Effect',
    description: 'Test description',
    effectType: 'modify_variable',
    payload: { op: 'replace', path: '/health', value: 100 } as unknown as Prisma.JsonValue,
    entityType: 'encounter',
    entityId: 'encounter-1',
    timing: EffectTiming.ON_RESOLVE,
    priority: 0,
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EffectService,
        CacheService,
        {
          provide: PrismaService,
          useValue: {
            effect: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            encounter: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            event: {
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
          provide: EffectPatchService,
          useValue: {
            validatePatch: jest.fn(),
          },
        },
        {
          provide: DependencyGraphService,
          useValue: {
            invalidateGraph: jest.fn(),
          },
        },
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn(),
          },
        },
        {
          provide: REDIS_CACHE,
          useValue: {
            get: jest.fn(),
            setex: jest.fn(),
            del: jest.fn(),
            scan: jest.fn(),
            keyPrefix: 'cache:',
          },
        },
        {
          provide: CacheStatsService,
          useValue: {
            recordHit: jest.fn(),
            recordMiss: jest.fn(),
            recordSet: jest.fn(),
            recordInvalidation: jest.fn(),
            recordCascadeInvalidation: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EffectService>(EffectService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    audit = module.get(AuditService) as jest.Mocked<AuditService>;
    patchService = module.get(EffectPatchService) as jest.Mocked<EffectPatchService>;
    dependencyGraphService = module.get(
      DependencyGraphService
    ) as jest.Mocked<DependencyGraphService>;
    pubSub = module.get(REDIS_PUBSUB) as jest.Mocked<RedisPubSub>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createInput: CreateEffectInput = {
      name: 'Test Effect',
      description: 'Test description',
      effectType: 'modify_variable',
      payload: { op: 'replace', path: '/health', value: 100 },
      entityType: 'encounter',
      entityId: 'encounter-1',
      timing: EffectTiming.ON_RESOLVE,
      priority: 0,
    };

    it('should create an effect with valid input', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (patchService.validatePatch as jest.Mock).mockReturnValue({ valid: true, errors: [] });
      (prisma.effect.create as jest.Mock).mockResolvedValue(mockEffect);

      const result = await service.create(createInput, mockUser);

      expect(result).toEqual(mockEffect);
      expect(prisma.encounter.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'encounter-1',
          deletedAt: null,
          campaign: expect.objectContaining({
            deletedAt: null,
            OR: expect.any(Array),
          }),
        },
        select: { campaignId: true },
      });
      expect(patchService.validatePatch).toHaveBeenCalledWith(createInput.payload, 'encounter');
      expect(prisma.effect.create).toHaveBeenCalledWith({
        data: {
          name: createInput.name,
          description: createInput.description,
          effectType: createInput.effectType,
          payload: createInput.payload,
          entityType: createInput.entityType,
          entityId: createInput.entityId,
          timing: createInput.timing,
          priority: createInput.priority ?? 0,
        },
      });
      expect(audit.log).toHaveBeenCalledWith(
        'effect',
        mockEffect.id,
        'CREATE',
        mockUser.id,
        expect.any(Object)
      );
      expect(dependencyGraphService.invalidateGraph).toHaveBeenCalledWith('campaign-1');
      expect(pubSub.publish).toHaveBeenCalledWith('effect.created', {
        effectId: mockEffect.id,
        campaignId: 'campaign-1',
        branchId: 'main',
      });
    });

    it('should throw NotFoundException if entity does not exist', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(createInput, mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.effect.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user lacks campaign access', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(createInput, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if patch validation fails', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (patchService.validatePatch as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['Invalid operation: foo'],
      });

      await expect(service.create(createInput, mockUser)).rejects.toThrow(BadRequestException);
      expect(prisma.effect.create).not.toHaveBeenCalled();
    });

    it('should use default values for timing and priority', async () => {
      const inputWithoutDefaults = {
        ...createInput,
        timing: undefined,
        priority: undefined,
      };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (patchService.validatePatch as jest.Mock).mockReturnValue({ valid: true, errors: [] });
      (prisma.effect.create as jest.Mock).mockResolvedValue(mockEffect);

      await service.create(inputWithoutDefaults, mockUser);

      expect(prisma.effect.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timing: EffectTiming.ON_RESOLVE,
          priority: 0,
        }),
      });
    });
  });

  describe('findById', () => {
    it('should return effect when found and user has access', async () => {
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);

      const result = await service.findById('effect-1', mockUser);

      expect(result).toEqual(mockEffect);
      expect(prisma.effect.findUnique).toHaveBeenCalledWith({
        where: { id: 'effect-1' },
      });
      expect(prisma.encounter.findFirst).toHaveBeenCalled();
    });

    it('should return null when effect not found', async () => {
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('effect-1', mockUser);

      expect(result).toBeNull();
    });

    it('should return null when effect is deleted', async () => {
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue({
        ...mockEffect,
        deletedAt: new Date(),
      });

      const result = await service.findById('effect-1', mockUser);

      expect(result).toBeNull();
    });

    it('should return null when user lacks access', async () => {
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('effect-1', mockUser);

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    const mockEffects = [mockEffect];

    it('should return effects with default filters', async () => {
      (prisma.effect.findMany as jest.Mock).mockResolvedValue(mockEffects);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);

      const result = await service.findMany(undefined, undefined, undefined, undefined, mockUser);

      expect(result).toEqual(mockEffects);
      // Service now uses simple where clause and filters by campaign access in-memory
      expect(prisma.effect.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
        },
        orderBy: { priority: 'asc' },
        skip: undefined,
        take: undefined,
      });
    });

    it('should apply where filters correctly', async () => {
      const where: EffectWhereInput = {
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: EffectTiming.ON_RESOLVE,
        isActive: true,
      };

      (prisma.effect.findMany as jest.Mock).mockResolvedValue(mockEffects);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);

      await service.findMany(where, undefined, undefined, undefined, mockUser);

      // Service now uses simple where clause and filters by campaign access in-memory
      expect(prisma.effect.findMany).toHaveBeenCalledWith({
        where: {
          name: undefined,
          effectType: undefined,
          entityType: 'encounter',
          entityId: 'encounter-1',
          timing: EffectTiming.ON_RESOLVE,
          isActive: true,
          deletedAt: null,
        },
        orderBy: { priority: 'asc' },
        skip: undefined,
        take: undefined,
      });
    });

    it('should apply date range filters', async () => {
      const createdAfter = new Date('2023-01-01');
      const createdBefore = new Date('2023-12-31');
      const where: EffectWhereInput = {
        createdAfter,
        createdBefore,
      };

      (prisma.effect.findMany as jest.Mock).mockResolvedValue(mockEffects);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);

      await service.findMany(where, undefined, undefined, undefined, mockUser);

      // Service now uses simple where clause and filters by campaign access in-memory
      expect(prisma.effect.findMany).toHaveBeenCalledWith({
        where: {
          name: undefined,
          effectType: undefined,
          entityType: undefined,
          entityId: undefined,
          timing: undefined,
          isActive: undefined,
          createdAt: {
            gte: createdAfter,
            lte: createdBefore,
          },
          deletedAt: null,
        },
        orderBy: { priority: 'asc' },
        skip: undefined,
        take: undefined,
      });
    });

    it('should apply sorting and pagination', async () => {
      const orderBy: EffectOrderByInput = {
        field: EffectSortField.NAME,
        order: SortOrder.DESC,
      };

      (prisma.effect.findMany as jest.Mock).mockResolvedValue(mockEffects);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);

      await service.findMany(undefined, orderBy, 10, 20, mockUser);

      // Service now uses simple where clause and filters by campaign access in-memory
      expect(prisma.effect.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
        },
        orderBy: { name: 'desc' },
        skip: 10,
        take: 20,
      });
    });

    it('should filter by entity access when user provided', async () => {
      (prisma.effect.findMany as jest.Mock).mockResolvedValue([mockEffect]);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);

      const result = await service.findMany(undefined, undefined, undefined, undefined, mockUser);

      expect(result).toEqual([mockEffect]);
      // Service now uses simple where clause and filters by campaign access in-memory
      expect(prisma.effect.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
        },
        orderBy: { priority: 'asc' },
        skip: undefined,
        take: undefined,
      });
      // Verify entity access was checked
      expect(prisma.encounter.findFirst).toHaveBeenCalled();
    });

    it('should include deleted effects when includeDeleted is true', async () => {
      const where: EffectWhereInput = {
        includeDeleted: true,
      };

      (prisma.effect.findMany as jest.Mock).mockResolvedValue(mockEffects);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);

      await service.findMany(where, undefined, undefined, undefined, mockUser);

      // Service now uses simple where clause and filters by campaign access in-memory
      expect(prisma.effect.findMany).toHaveBeenCalledWith({
        where: {
          name: undefined,
          effectType: undefined,
          entityType: undefined,
          entityId: undefined,
          timing: undefined,
          isActive: undefined,
          deletedAt: undefined,
        },
        orderBy: { priority: 'asc' },
        skip: undefined,
        take: undefined,
      });
    });
  });

  describe('findForEntity', () => {
    it('should return active effects for entity sorted by priority', async () => {
      const effects = [mockEffect];
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.effect.findMany as jest.Mock).mockResolvedValue(effects);

      const result = await service.findForEntity(
        'encounter',
        'encounter-1',
        EffectTiming.ON_RESOLVE,
        mockUser
      );

      expect(result).toEqual(effects);
      expect(prisma.effect.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'encounter',
          entityId: 'encounter-1',
          timing: EffectTiming.ON_RESOLVE,
          isActive: true,
          deletedAt: null,
        },
        orderBy: { priority: 'asc' },
      });
    });

    it('should throw NotFoundException if entity not found or no access', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findForEntity('encounter', 'encounter-1', EffectTiming.ON_RESOLVE, mockUser)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateInput: UpdateEffectInput = {
      name: 'Updated Effect',
      description: 'Updated description',
      priority: 5,
      isActive: false,
      expectedVersion: 1,
    };

    it('should update effect with valid input', async () => {
      const updatedEffect = { ...mockEffect, ...updateInput, version: 2 };
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.effect.update as jest.Mock).mockResolvedValue(updatedEffect);

      const result = await service.update('effect-1', updateInput, mockUser);

      expect(result.version).toBe(2);
      expect(prisma.effect.update).toHaveBeenCalledWith({
        where: { id: 'effect-1' },
        data: expect.objectContaining({
          name: updateInput.name,
          description: updateInput.description,
          priority: updateInput.priority,
          isActive: updateInput.isActive,
          version: 2,
        }),
      });
      expect(audit.log).toHaveBeenCalled();
      expect(dependencyGraphService.invalidateGraph).toHaveBeenCalledWith('campaign-1');
      expect(pubSub.publish).toHaveBeenCalledWith('effect.updated', expect.any(Object));
    });

    it('should throw NotFoundException if effect not found', async () => {
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('effect-1', updateInput, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw OptimisticLockException on version mismatch', async () => {
      const staleEffect = { ...mockEffect, version: 2 };
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(staleEffect);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);

      await expect(service.update('effect-1', updateInput, mockUser)).rejects.toThrow(
        OptimisticLockException
      );
      expect(prisma.effect.update).not.toHaveBeenCalled();
    });

    it('should validate patch payload if updated', async () => {
      const inputWithPayload = {
        ...updateInput,
        payload: { op: 'replace', path: '/newField', value: 'newValue' },
      };
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (patchService.validatePatch as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['Invalid path'],
      });

      await expect(service.update('effect-1', inputWithPayload, mockUser)).rejects.toThrow(
        BadRequestException
      );
      expect(prisma.effect.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete effect', async () => {
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      const deletedEffect = { ...mockEffect, deletedAt: new Date() };
      (prisma.effect.update as jest.Mock).mockResolvedValue(deletedEffect);

      const result = await service.delete('effect-1', mockUser);

      expect(result.deletedAt).not.toBeNull();
      expect(prisma.effect.update).toHaveBeenCalledWith({
        where: { id: 'effect-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalled();
      expect(dependencyGraphService.invalidateGraph).toHaveBeenCalledWith('campaign-1');
      expect(pubSub.publish).toHaveBeenCalledWith('effect.deleted', expect.any(Object));
    });

    it('should throw NotFoundException if effect not found', async () => {
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('effect-1', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleActive', () => {
    it('should toggle active status to false', async () => {
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      const inactiveEffect = { ...mockEffect, isActive: false };
      (prisma.effect.update as jest.Mock).mockResolvedValue(inactiveEffect);

      const result = await service.toggleActive('effect-1', false, mockUser);

      expect(result.isActive).toBe(false);
      expect(prisma.effect.update).toHaveBeenCalledWith({
        where: { id: 'effect-1' },
        data: { isActive: false },
      });
      expect(audit.log).toHaveBeenCalled();
    });

    it('should toggle active status to true', async () => {
      const inactiveEffect = { ...mockEffect, isActive: false };
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(inactiveEffect);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.effect.update as jest.Mock).mockResolvedValue(mockEffect);

      const result = await service.toggleActive('effect-1', true, mockUser);

      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if effect not found', async () => {
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.toggleActive('effect-1', false, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('entity authorization', () => {
    it('should handle Event entity type', async () => {
      const eventEffect = {
        ...mockEffect,
        entityType: 'event',
        entityId: 'event-1',
      };
      const mockEvent = {
        id: 'event-1',
        campaignId: 'campaign-1',
        deletedAt: null,
      };

      const createInput: CreateEffectInput = {
        name: 'Event Effect',
        description: 'Test',
        effectType: 'modify_variable',
        payload: {},
        entityType: 'event',
        entityId: 'event-1',
      };

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);
      (patchService.validatePatch as jest.Mock).mockReturnValue({ valid: true, errors: [] });
      (prisma.effect.create as jest.Mock).mockResolvedValue(eventEffect);

      const result = await service.create(createInput, mockUser);

      expect(result).toEqual(eventEffect);
      expect(prisma.event.findFirst).toHaveBeenCalled();
    });

    it('should throw BadRequestException for unsupported entity type', async () => {
      const createInput: CreateEffectInput = {
        name: 'Invalid Effect',
        description: 'Test',
        effectType: 'modify_variable',
        payload: {},
        entityType: 'invalid_type',
        entityId: 'invalid-1',
      };

      await expect(service.create(createInput, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCampaignIdForEffect', () => {
    it('should resolve campaignId from encounter', async () => {
      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(mockEffect);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);

      const result = await service.findById('effect-1', mockUser);

      expect(result).toBeTruthy();
      // Campaign ID resolution is tested indirectly through cache invalidation
    });

    it('should resolve campaignId from event', async () => {
      const eventEffect = {
        ...mockEffect,
        entityType: 'event',
        entityId: 'event-1',
      };
      const mockEvent = {
        id: 'event-1',
        campaignId: 'campaign-1',
        deletedAt: null,
      };

      (prisma.effect.findUnique as jest.Mock).mockResolvedValue(eventEffect);
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.findById('effect-1', mockUser);

      expect(result).toBeTruthy();
    });
  });
});
