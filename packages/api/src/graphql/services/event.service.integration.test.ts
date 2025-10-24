/**
 * EventService Integration Tests for Completion Workflow
 *
 * Tests the complete event completion workflow with 3-phase effect execution:
 * - PRE effects (before completion)
 * - ON_RESOLVE effects (during completion)
 * - POST effects (after completion)
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Event, Effect } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { AuditService } from './audit.service';
import { EffectExecutionService } from './effect-execution.service';
import { EffectPatchService } from './effect-patch.service';
import { EventService } from './event.service';
import { VersionService } from './version.service';
import { WorldTimeService } from './world-time.service';

// Mock data
const mockEvent: Event = {
  id: 'event-1',
  campaignId: 'campaign-1',
  locationId: null,
  name: 'Royal Wedding',
  description: 'The prince gets married',
  eventType: 'story',
  scheduledAt: new Date('2025-02-01'),
  occurredAt: null,
  isCompleted: false,
  variables: { guestCount: 500, mood: 'celebratory' },
  version: 1,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
  archivedAt: null,
};

const mockEffectPre: Effect = {
  id: 'effect-pre',
  name: 'Pre-event preparation',
  description: 'Set up decorations',
  effectType: 'patch',
  payload: [{ op: 'replace', path: '/variables/decorationLevel', value: 10 }] as any,
  entityType: 'EVENT',
  entityId: 'event-1',
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
  name: 'Event execution',
  description: 'Run the ceremony',
  effectType: 'patch',
  payload: [{ op: 'replace', path: '/variables/ceremonyComplete', value: true }] as any,
  entityType: 'EVENT',
  entityId: 'event-1',
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
  name: 'Post-event cleanup',
  description: 'Clean up decorations',
  effectType: 'patch',
  payload: [{ op: 'remove', path: '/variables/decorationLevel' }] as any,
  entityType: 'EVENT',
  entityId: 'event-1',
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

describe('EventService - Completion Integration', () => {
  let service: EventService;
  let prismaService: PrismaService;
  let pubSub: any;
  let module: TestingModule;

  beforeEach(async () => {
    // Create mocks
    const mockPrisma = {
      event: {
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
          event: mockPrisma.event,
          effectExecution: mockPrisma.effectExecution,
        };
        return await callback(txClient);
      }
      return undefined;
    });

    module = await Test.createTestingModule({
      providers: [
        EventService,
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
        {
          provide: WorldTimeService,
          useValue: {
            getCurrentWorldTime: jest.fn(),
            advanceWorldTime: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
    prismaService = module.get<PrismaService>(PrismaService);
    pubSub = module.get('REDIS_PUBSUB');

    // Setup default mocks
    (prismaService.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('complete', () => {
    it('should complete event with no effects', async () => {
      // Arrange
      (prismaService.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prismaService.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        isCompleted: true,
        occurredAt: expect.any(Date),
        version: 2,
      });
      (prismaService.effect.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await service.complete('event-1', mockUser as any);

      // Assert
      expect(result).toBeDefined();
      expect(result.event.isCompleted).toBe(true);
      expect(result.effectSummary.pre.total).toBe(0);
      expect(result.effectSummary.onResolve.total).toBe(0);
      expect(result.effectSummary.post.total).toBe(0);
      expect(prismaService.event.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: {
          isCompleted: true,
          occurredAt: expect.any(Date),
          version: 2,
        },
      });
    });

    it('should complete event with all 3 phases of effects', async () => {
      // Arrange
      (prismaService.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prismaService.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);
      (prismaService.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        isCompleted: true,
        occurredAt: new Date(),
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
        patchedEntity: mockEvent,
        errors: [],
      });

      (prismaService.effectExecution.create as jest.Mock).mockResolvedValue({
        id: 'execution-1',
        effectId: 'effect-1',
        entityType: 'EVENT',
        entityId: 'event-1',
        executedAt: new Date(),
        executedBy: 'user-1',
        context: mockEvent,
        result: { success: true },
        error: null,
      });

      // Act
      const result = await service.complete('event-1', mockUser as any);

      // Assert
      expect(result).toBeDefined();
      expect(result.event.isCompleted).toBe(true);
      expect(result.effectSummary.pre.total).toBe(1);
      expect(result.effectSummary.onResolve.total).toBe(1);
      expect(result.effectSummary.post.total).toBe(1);
      expect(prismaService.effect.findMany).toHaveBeenCalledTimes(3);
    });

    it('should reject if event does not exist', async () => {
      // Arrange
      (prismaService.event.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.complete('nonexistent', mockUser as any)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should reject if event is already completed', async () => {
      // Arrange
      const completedEvent = { ...mockEvent, isCompleted: true };
      (prismaService.event.findFirst as jest.Mock).mockResolvedValue(completedEvent);

      // Act & Assert
      await expect(service.complete('event-1', mockUser as any)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should continue completion even if some effects fail', async () => {
      // Arrange
      (prismaService.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prismaService.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);
      (prismaService.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        isCompleted: true,
        occurredAt: new Date(),
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
          patchedEntity: mockEvent,
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
        entityType: 'EVENT',
        entityId: 'event-1',
        executedAt: new Date(),
        executedBy: 'user-1',
        context: mockEvent,
        result: { success: false },
        error: 'Patch failed',
      });

      // Act
      const result = await service.complete('event-1', mockUser as any);

      // Assert
      expect(result.event.isCompleted).toBe(true);
      expect(result.effectSummary.pre.total).toBe(2);
      expect(result.effectSummary.pre.succeeded).toBe(1);
      expect(result.effectSummary.pre.failed).toBe(1);
    });

    it('should execute effects in correct timing order (PRE -> ON_RESOLVE -> POST)', async () => {
      // Arrange
      const executionOrder: string[] = [];

      (prismaService.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prismaService.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);
      (prismaService.event.update as jest.Mock).mockImplementation(() => {
        executionOrder.push('COMPLETION');
        return Promise.resolve({
          ...mockEvent,
          isCompleted: true,
          occurredAt: new Date(),
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
        patchedEntity: mockEvent,
        errors: [],
      });

      (prismaService.effectExecution.create as jest.Mock).mockImplementation(({ data }: any) => {
        executionOrder.push(data.effectId);
        return Promise.resolve({
          id: 'execution-1',
          effectId: data.effectId,
          entityType: 'EVENT',
          entityId: 'event-1',
          executedAt: new Date(),
          executedBy: 'user-1',
          context: mockEvent,
          result: { success: true },
          error: null,
        });
      });

      // Act
      await service.complete('event-1', mockUser as any);

      // Assert
      expect(executionOrder).toEqual([
        'effect-pre',
        'COMPLETION',
        'effect-on-resolve',
        'effect-post',
      ]);
    });

    it('should publish entityModified event after completion', async () => {
      // Arrange
      (prismaService.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prismaService.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        isCompleted: true,
        occurredAt: new Date(),
        version: 2,
        updatedAt: new Date(),
      });
      (prismaService.effect.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      await service.complete('event-1', mockUser as any);

      // Assert
      expect(pubSub.publish).toHaveBeenCalledWith(
        'entity.modified.event-1',
        expect.objectContaining({
          entityModified: expect.objectContaining({
            entityId: 'event-1',
            entityType: 'event',
            version: 2,
            modifiedBy: 'user-1',
          }),
        })
      );
    });
  });
});
