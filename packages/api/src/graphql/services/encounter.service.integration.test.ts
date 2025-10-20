/**
 * EncounterService Integration Tests for Resolution Workflow
 *
 * Tests the complete encounter resolution workflow with 3-phase effect execution:
 * - PRE effects (before resolution)
 * - ON_RESOLVE effects (during resolution)
 * - POST effects (after resolution)
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Encounter, Effect } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { AuditService } from './audit.service';
import { EffectExecutionService } from './effect-execution.service';
import { EffectPatchService } from './effect-patch.service';
import { EncounterService } from './encounter.service';
import { VersionService } from './version.service';

// Mock data
const mockEncounter: Encounter = {
  id: 'encounter-1',
  campaignId: 'campaign-1',
  locationId: null,
  name: 'Dragon Attack',
  description: 'A fierce dragon attacks the settlement',
  difficulty: 10,
  isResolved: false,
  resolvedAt: null,
  scheduledAt: null,
  variables: { enemyCount: 1, dragonType: 'red' },
  version: 1,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
  archivedAt: null,
};

const mockEffectPre: Effect = {
  id: 'effect-pre',
  name: 'Pre-combat buff',
  description: 'Increase settlement defense',
  effectType: 'patch',
  payload: [{ op: 'replace', path: '/variables/defense', value: 100 }] as any,
  entityType: 'ENCOUNTER',
  entityId: 'encounter-1',
  timing: 'PRE',
  priority: 0,
  isActive: true,
  version: 1,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

const mockEffectOnResolve: Effect = {
  id: 'effect-on-resolve',
  name: 'Combat resolution',
  description: 'Apply combat results',
  effectType: 'patch',
  payload: [{ op: 'replace', path: '/variables/casualties', value: 5 }] as any,
  entityType: 'ENCOUNTER',
  entityId: 'encounter-1',
  timing: 'ON_RESOLVE',
  priority: 0,
  isActive: true,
  version: 1,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

const mockEffectPost: Effect = {
  id: 'effect-post',
  name: 'Post-combat cleanup',
  description: 'Remove temporary buffs',
  effectType: 'patch',
  payload: [{ op: 'remove', path: '/variables/defense' }] as any,
  entityType: 'ENCOUNTER',
  entityId: 'encounter-1',
  timing: 'POST',
  priority: 0,
  isActive: true,
  version: 1,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
};

const mockCampaign = {
  id: 'campaign-1',
  ownerId: 'user-1',
  memberships: [],
  deletedAt: null,
};

describe('EncounterService - Resolution Integration', () => {
  let service: EncounterService;
  let prismaService: PrismaService;
  let pubSub: any;
  let module: TestingModule;

  beforeEach(async () => {
    // Create mocks
    const mockPrisma = {
      encounter: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      campaign: {
        findFirst: jest.fn(),
      },
      effect: {
        findMany: jest.fn(),
      },
      effectExecution: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockAudit = {
      log: jest.fn(),
    };

    const mockVersion = {
      createVersion: jest.fn(),
    };

    const mockPubSub = {
      publish: jest.fn(),
    };

    const mockEffectPatch = {
      applyPatch: jest.fn(),
    };

    // Configure $transaction mock
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        const txClient = {
          encounter: mockPrisma.encounter,
          effectExecution: mockPrisma.effectExecution,
        };
        return await callback(txClient);
      }
      return undefined;
    });

    module = await Test.createTestingModule({
      providers: [
        EncounterService,
        EffectExecutionService,
        EffectPatchService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AuditService,
          useValue: mockAudit,
        },
        {
          provide: VersionService,
          useValue: mockVersion,
        },
        {
          provide: 'REDIS_PUBSUB',
          useValue: mockPubSub,
        },
        {
          provide: EffectPatchService,
          useValue: mockEffectPatch,
        },
      ],
    }).compile();

    service = module.get<EncounterService>(EncounterService);
    prismaService = module.get<PrismaService>(PrismaService);
    pubSub = module.get('REDIS_PUBSUB');

    // Setup default mocks
    (prismaService.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolve', () => {
    it('should resolve encounter with no effects', async () => {
      // Arrange
      (prismaService.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prismaService.encounter.update as jest.Mock).mockResolvedValue({
        ...mockEncounter,
        isResolved: true,
        resolvedAt: expect.any(Date),
        version: 2,
      });
      (prismaService.effect.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await service.resolve('encounter-1', mockUser as any);

      // Assert
      expect(result).toBeDefined();
      expect(result.encounter.isResolved).toBe(true);
      expect(result.effectSummary.pre.total).toBe(0);
      expect(result.effectSummary.onResolve.total).toBe(0);
      expect(result.effectSummary.post.total).toBe(0);
      expect(prismaService.encounter.update).toHaveBeenCalledWith({
        where: { id: 'encounter-1' },
        data: {
          isResolved: true,
          resolvedAt: expect.any(Date),
          version: 2,
        },
      });
    });

    it('should resolve encounter with all 3 phases of effects', async () => {
      // Arrange
      (prismaService.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (prismaService.encounter.update as jest.Mock).mockResolvedValue({
        ...mockEncounter,
        isResolved: true,
        resolvedAt: new Date(),
        version: 2,
      });

      // Mock effects for each phase
      (prismaService.effect.findMany as jest.Mock)
        .mockResolvedValueOnce([mockEffectPre]) // PRE phase
        .mockResolvedValueOnce([mockEffectOnResolve]) // ON_RESOLVE phase
        .mockResolvedValueOnce([mockEffectPost]); // POST phase

      const mockEffectPatch = module.get<EffectPatchService>(EffectPatchService);
      (mockEffectPatch.applyPatch as jest.Mock).mockReturnValue({
        success: true,
        patchedEntity: mockEncounter,
        errors: [],
      });

      (prismaService.effectExecution.create as jest.Mock).mockResolvedValue({
        id: 'execution-1',
        effectId: 'effect-1',
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        executedAt: new Date(),
        executedBy: 'user-1',
        context: mockEncounter,
        result: { success: true },
        error: null,
      });

      // Act
      const result = await service.resolve('encounter-1', mockUser as any);

      // Assert
      expect(result).toBeDefined();
      expect(result.encounter.isResolved).toBe(true);
      expect(result.effectSummary.pre.total).toBe(1);
      expect(result.effectSummary.onResolve.total).toBe(1);
      expect(result.effectSummary.post.total).toBe(1);
      expect(prismaService.effect.findMany).toHaveBeenCalledTimes(3);
    });

    it('should reject if encounter does not exist', async () => {
      // Arrange
      (prismaService.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.resolve('nonexistent', mockUser as any)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should reject if encounter is already resolved', async () => {
      // Arrange
      const resolvedEncounter = { ...mockEncounter, isResolved: true };
      (prismaService.encounter.findFirst as jest.Mock).mockResolvedValue(resolvedEncounter);

      // Act & Assert
      await expect(service.resolve('encounter-1', mockUser as any)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should continue resolution even if some effects fail', async () => {
      // Arrange
      (prismaService.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (prismaService.encounter.update as jest.Mock).mockResolvedValue({
        ...mockEncounter,
        isResolved: true,
        resolvedAt: new Date(),
        version: 2,
      });

      // Mock one effect failing in PRE phase
      (prismaService.effect.findMany as jest.Mock)
        .mockResolvedValueOnce([mockEffectPre, { ...mockEffectPre, id: 'effect-pre-2' }]) // PRE: 2 effects
        .mockResolvedValueOnce([]) // ON_RESOLVE: no effects
        .mockResolvedValueOnce([]); // POST: no effects

      const mockEffectPatch = module.get<EffectPatchService>(EffectPatchService);
      (mockEffectPatch.applyPatch as jest.Mock)
        .mockReturnValueOnce({
          success: true,
          patchedEntity: mockEncounter,
          errors: [],
        })
        .mockReturnValueOnce({
          success: false,
          patchedEntity: null,
          errors: ['Patch failed'],
        });

      (prismaService.effectExecution.create as jest.Mock).mockResolvedValue({
        id: 'execution-1',
        effectId: 'effect-1',
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        executedAt: new Date(),
        executedBy: 'user-1',
        context: mockEncounter,
        result: { success: false },
        error: 'Patch failed',
      });

      // Act
      const result = await service.resolve('encounter-1', mockUser as any);

      // Assert
      expect(result.encounter.isResolved).toBe(true);
      expect(result.effectSummary.pre.total).toBe(2);
      expect(result.effectSummary.pre.succeeded).toBe(1);
      expect(result.effectSummary.pre.failed).toBe(1);
    });

    it('should execute effects in correct timing order (PRE -> ON_RESOLVE -> POST)', async () => {
      // Arrange
      const executionOrder: string[] = [];

      (prismaService.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prismaService.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (prismaService.encounter.update as jest.Mock).mockImplementation(() => {
        executionOrder.push('RESOLUTION');
        return Promise.resolve({
          ...mockEncounter,
          isResolved: true,
          resolvedAt: new Date(),
          version: 2,
        });
      });

      (prismaService.effect.findMany as jest.Mock).mockImplementation(({ where }: any) => {
        if (where.timing === 'PRE') return Promise.resolve([mockEffectPre]);
        if (where.timing === 'ON_RESOLVE') return Promise.resolve([mockEffectOnResolve]);
        if (where.timing === 'POST') return Promise.resolve([mockEffectPost]);
        return Promise.resolve([]);
      });

      const mockEffectPatch = module.get<EffectPatchService>(EffectPatchService);
      (mockEffectPatch.applyPatch as jest.Mock).mockReturnValue({
        success: true,
        patchedEntity: mockEncounter,
        errors: [],
      });

      (prismaService.effectExecution.create as jest.Mock).mockImplementation(({ data }: any) => {
        executionOrder.push(data.effectId);
        return Promise.resolve({
          id: 'execution-1',
          effectId: data.effectId,
          entityType: 'ENCOUNTER',
          entityId: 'encounter-1',
          executedAt: new Date(),
          executedBy: 'user-1',
          context: mockEncounter,
          result: { success: true },
          error: null,
        });
      });

      // Act
      await service.resolve('encounter-1', mockUser as any);

      // Assert
      expect(executionOrder).toEqual([
        'effect-pre',
        'RESOLUTION',
        'effect-on-resolve',
        'effect-post',
      ]);
    });

    it('should publish entityModified event after resolution', async () => {
      // Arrange
      (prismaService.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prismaService.encounter.update as jest.Mock).mockResolvedValue({
        ...mockEncounter,
        isResolved: true,
        resolvedAt: new Date(),
        version: 2,
        updatedAt: new Date(),
      });
      (prismaService.effect.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      await service.resolve('encounter-1', mockUser as any);

      // Assert
      expect(pubSub.publish).toHaveBeenCalledWith(
        'entity.modified.encounter-1',
        expect.objectContaining({
          entityModified: expect.objectContaining({
            entityId: 'encounter-1',
            entityType: 'encounter',
            version: 2,
            modifiedBy: 'user-1',
          }),
        })
      );
    });
  });
});
