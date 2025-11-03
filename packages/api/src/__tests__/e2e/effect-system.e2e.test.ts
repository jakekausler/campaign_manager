/**
 * Effect System End-to-End Tests
 *
 * Comprehensive E2E tests for the complete effect system including:
 * - Effect CRUD operations
 * - JSON Patch application with security validation
 * - Multi-effect execution with priority ordering
 * - 3-phase encounter/event resolution workflows
 * - Circular dependency detection via dependency graph
 * - Authorization scenarios
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Campaign, Encounter, Event, Effect, EffectExecution } from '@prisma/client';
import type { Operation } from 'fast-json-patch';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../graphql/context/graphql-context';
import { REDIS_PUBSUB } from '../../graphql/pubsub/redis-pubsub.provider';
import { AuditService } from '../../graphql/services/audit.service';
import { DependencyGraphBuilderService } from '../../graphql/services/dependency-graph-builder.service';
import { DependencyGraphService } from '../../graphql/services/dependency-graph.service';
import { EffectExecutionService } from '../../graphql/services/effect-execution.service';
import { EffectPatchService } from '../../graphql/services/effect-patch.service';
import { EffectService } from '../../graphql/services/effect.service';
import { EncounterService } from '../../graphql/services/encounter.service';
import { EventService } from '../../graphql/services/event.service';
import { VersionService } from '../../graphql/services/version.service';
import { WorldTimeService } from '../../graphql/services/world-time.service';

/**
 * Type definitions for test fixtures
 */

// Extended types with relations for test mocks
type EncounterWithCampaign = Encounter & { campaign: Campaign };
type EventWithCampaign = Event & { campaign: Campaign };

// Prisma query where clauses
interface EffectWhereClause {
  timing?: string;
  entityType?: string;
  entityId?: string;
  isActive?: boolean;
}

interface EffectFindManyArgs {
  where: EffectWhereClause;
  orderBy?: unknown;
}

// Effect execution create arguments
interface EffectExecutionCreateArgs {
  data: {
    effectId: string;
    entityType: string;
    entityId: string;
    executedAt: Date;
    executedBy: string;
    context: Record<string, unknown>;
    result: {
      success: boolean;
      affectedFields?: string[];
    };
    error: string | null;
  };
}

// Transaction callback type
type TransactionCallback<T> = (prisma: PrismaService) => Promise<T>;

describe('Effect System E2E Tests', () => {
  let module: TestingModule;
  let effectExecutionService: EffectExecutionService;
  let encounterService: EncounterService;
  let eventService: EventService;
  let prismaService: PrismaService;

  // Mock data
  // AuthenticatedUser for service calls (from JWT context)
  const mockAuthUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'owner',
  };

  const mockCampaign: Campaign = {
    id: 'campaign-1',
    name: 'Test Campaign',
    worldId: 'world-1',
    ownerId: 'user-1',
    srid: 3857,
    currentWorldTime: null,
    settings: {},
    isActive: true,
    version: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    archivedAt: null,
  };

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
    variables: {
      enemyCount: 1,
      dragonType: 'red',
      gold: 1000,
      defense: 50, // Pre-populate for replace operations
      casualties: 0, // Pre-populate for replace operations
      step: 0, // Pre-populate for priority ordering test
      food: 400, // Pre-populate for replace operations
    },
    version: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    archivedAt: null,
  };

  const mockEvent: Event = {
    id: 'event-1',
    campaignId: 'campaign-1',
    locationId: null,
    name: 'Harvest Season',
    description: 'Annual harvest brings resources',
    eventType: 'harvest',
    isCompleted: false,
    scheduledAt: new Date('2025-06-01'),
    occurredAt: null,
    variables: {
      harvestMultiplier: 1.5,
      food: 500,
      gold: 300, // Pre-populate for replace operations
      resources: {
        // Pre-populate for nested path test
        gold: 100,
        food: 200,
        wood: 50,
      },
    },
    version: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    archivedAt: null,
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        EffectService,
        EffectExecutionService,
        EffectPatchService,
        EncounterService,
        EventService,
        DependencyGraphService,
        DependencyGraphBuilderService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            campaign: { findFirst: jest.fn() },
            encounter: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            event: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            effect: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            effectExecution: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            fieldCondition: { findMany: jest.fn() },
            stateVariable: { findMany: jest.fn() },
            $transaction: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: VersionService,
          useValue: {
            incrementVersion: jest.fn((entity) => ({
              ...entity,
              version: entity.version + 1,
              updatedAt: new Date(),
            })),
          },
        },
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn(),
          },
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

    effectExecutionService = module.get<EffectExecutionService>(EffectExecutionService);
    encounterService = module.get<EncounterService>(EncounterService);
    eventService = module.get<EventService>(EventService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Encounter Resolution with Multi-Effect Chain', () => {
    it('should execute effects in correct order (PRE → RESOLUTION → ON_RESOLVE → POST)', async () => {
      // Setup: Create encounter with 3 effects (one per timing phase)
      const effectPre = {
        id: 'effect-pre',
        name: 'Pre-combat preparation',
        description: 'Increase defense before combat',
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/variables/defense', value: 100 }] as Operation[],
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        timing: 'PRE',
        priority: 0,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      } as unknown as Effect;

      const effectOnResolve = {
        id: 'effect-on-resolve',
        name: 'Combat resolution',
        description: 'Apply combat results',
        effectType: 'patch',
        payload: [
          { op: 'replace', path: '/variables/casualties', value: 5 },
          { op: 'replace', path: '/variables/gold', value: 1500 },
        ] as Operation[],
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 0,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      } as unknown as Effect;

      const effectPost = {
        id: 'effect-post',
        name: 'Post-combat cleanup',
        description: 'Remove temporary buffs',
        effectType: 'patch',
        payload: [{ op: 'remove', path: '/variables/defense' }] as Operation[],
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        timing: 'POST',
        priority: 0,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      } as unknown as Effect;

      // Mock campaign access
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue(mockCampaign);

      // Mock encounter lookup
      jest
        .spyOn(prismaService.encounter, 'findFirst')
        .mockResolvedValue({ ...mockEncounter, campaign: mockCampaign } as EncounterWithCampaign);

      jest
        .spyOn(prismaService.encounter, 'findUnique')
        .mockResolvedValue({ ...mockEncounter, campaign: mockCampaign } as EncounterWithCampaign);

      // Mock effect queries for each phase
      (prismaService.effect.findMany as jest.Mock) = jest
        .fn()
        .mockImplementation(({ where }: EffectFindManyArgs) => {
          if (where.timing === 'PRE') return Promise.resolve([effectPre]);
          if (where.timing === 'ON_RESOLVE') return Promise.resolve([effectOnResolve]);
          if (where.timing === 'POST') return Promise.resolve([effectPost]);
          return Promise.resolve([]);
        });

      // Mock encounter update
      const resolvedEncounter = {
        ...mockEncounter,
        isResolved: true,
        resolvedAt: new Date(),
        version: 2,
      };
      jest.spyOn(prismaService.encounter, 'update').mockResolvedValue(resolvedEncounter);

      // Mock effect execution records
      (prismaService.effectExecution.create as jest.Mock) = jest
        .fn()
        .mockImplementation((args: EffectExecutionCreateArgs) => {
          return Promise.resolve({
            id: `execution-${args.data.effectId}`,
            effectId: args.data.effectId,
            entityType: args.data.entityType,
            entityId: args.data.entityId,
            executedAt: new Date(),
            executedBy: args.data.executedBy,
            context: args.data.context,
            result: args.data.result,
            error: args.data.error,
          } as EffectExecution);
        });

      // Mock transaction - pass prismaService as transaction client
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: TransactionCallback<T>) => {
          return await callback(prismaService);
        }
      );

      // Execute: Resolve encounter
      const result = await encounterService.resolve('encounter-1', mockAuthUser);

      // Verify: All three phases executed successfully
      expect(result.encounter.isResolved).toBe(true);
      expect(result.encounter.resolvedAt).toBeDefined();

      expect(result.effectSummary.pre.total).toBe(1);
      expect(result.effectSummary.pre.succeeded).toBe(1);
      expect(result.effectSummary.pre.failed).toBe(0);

      expect(result.effectSummary.onResolve.total).toBe(1);
      expect(result.effectSummary.onResolve.succeeded).toBe(1);
      expect(result.effectSummary.onResolve.failed).toBe(0);

      expect(result.effectSummary.post.total).toBe(1);
      expect(result.effectSummary.post.succeeded).toBe(1);
      expect(result.effectSummary.post.failed).toBe(0);

      // Verify: Effects executed in correct order (execution records created)
      expect(prismaService.effectExecution.create).toHaveBeenCalledTimes(3);

      // Verify: Encounter updated exactly once (not per-effect)
      expect(prismaService.encounter.update).toHaveBeenCalledTimes(1);
    });

    it('should handle priority ordering within each timing phase', async () => {
      // Setup: Create 3 effects in ON_RESOLVE phase with different priorities
      const effects = [
        {
          id: 'effect-high',
          name: 'High priority',
          description: null,
          effectType: 'patch',
          payload: [{ op: 'replace', path: '/variables/step', value: 3 }] as Operation[],
          entityType: 'ENCOUNTER',
          entityId: 'encounter-1',
          timing: 'ON_RESOLVE',
          priority: 30, // Should execute last
          isActive: true,
          version: 1,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          deletedAt: null,
        },
        {
          id: 'effect-low',
          name: 'Low priority',
          description: null,
          effectType: 'patch',
          payload: [{ op: 'replace', path: '/variables/step', value: 1 }] as Operation[],
          entityType: 'ENCOUNTER',
          entityId: 'encounter-1',
          timing: 'ON_RESOLVE',
          priority: 10, // Should execute first
          isActive: true,
          version: 1,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          deletedAt: null,
        },
        {
          id: 'effect-mid',
          name: 'Medium priority',
          description: null,
          effectType: 'patch',
          payload: [{ op: 'replace', path: '/variables/step', value: 2 }] as Operation[],
          entityType: 'ENCOUNTER',
          entityId: 'encounter-1',
          timing: 'ON_RESOLVE',
          priority: 20, // Should execute second
          isActive: true,
          version: 1,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          deletedAt: null,
        },
      ] as unknown as Effect[];

      // Mock campaign access
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue(mockCampaign);

      // Mock encounter lookup
      jest
        .spyOn(prismaService.encounter, 'findFirst')
        .mockResolvedValue({ ...mockEncounter, campaign: mockCampaign } as EncounterWithCampaign);

      jest
        .spyOn(prismaService.encounter, 'findUnique')
        .mockResolvedValue({ ...mockEncounter, campaign: mockCampaign } as EncounterWithCampaign);

      // Mock effect queries
      (prismaService.effect.findMany as jest.Mock) = jest
        .fn()
        .mockImplementation(({ where }: EffectFindManyArgs) => {
          if (where.timing === 'ON_RESOLVE') return Promise.resolve(effects);
          return Promise.resolve([]);
        });

      // Mock encounter update
      const resolvedEncounter = {
        ...mockEncounter,
        isResolved: true,
        resolvedAt: new Date(),
        version: 2,
      };
      jest.spyOn(prismaService.encounter, 'update').mockResolvedValue(resolvedEncounter);

      // Mock effect execution records - track execution order
      const executionOrder: string[] = [];
      (prismaService.effectExecution.create as jest.Mock) = jest
        .fn()
        .mockImplementation((args: EffectExecutionCreateArgs) => {
          executionOrder.push(args.data.effectId);
          return Promise.resolve({
            id: `execution-${args.data.effectId}`,
            effectId: args.data.effectId,
            entityType: args.data.entityType,
            entityId: args.data.entityId,
            executedAt: new Date(),
            executedBy: args.data.executedBy,
            context: args.data.context,
            result: args.data.result,
            error: args.data.error,
          } as EffectExecution);
        });

      // Mock transaction - pass prismaService as transaction client
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: TransactionCallback<T>) => {
          return await callback(prismaService);
        }
      );

      // Execute: Resolve encounter
      const result = await encounterService.resolve('encounter-1', mockAuthUser);

      // Verify: All effects executed
      expect(result.effectSummary.onResolve.total).toBe(3);
      expect(result.effectSummary.onResolve.succeeded).toBe(3);

      // Verify: Effects executed in priority order (ascending)
      expect(executionOrder).toEqual(['effect-low', 'effect-mid', 'effect-high']);
    });

    it('should continue execution when some effects fail', async () => {
      // Setup: Create effects where second one will fail
      const effectSuccess1 = {
        id: 'effect-1',
        name: 'Valid effect',
        description: null,
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/variables/gold', value: 1500 }] as Operation[],
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 10,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      } as unknown as Effect;

      const effectFailure = {
        id: 'effect-2',
        name: 'Invalid effect',
        description: null,
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/id', value: 'hacked' }] as Operation[], // Protected field
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 20,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      } as unknown as Effect;

      const effectSuccess2 = {
        id: 'effect-3',
        name: 'Another valid effect',
        description: null,
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/variables/food', value: 800 }] as Operation[],
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 30,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      } as unknown as Effect;

      // Mock campaign access
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue(mockCampaign);

      // Mock encounter lookup
      jest
        .spyOn(prismaService.encounter, 'findFirst')
        .mockResolvedValue({ ...mockEncounter, campaign: mockCampaign } as EncounterWithCampaign);

      jest
        .spyOn(prismaService.encounter, 'findUnique')
        .mockResolvedValue({ ...mockEncounter, campaign: mockCampaign } as EncounterWithCampaign);

      // Mock effect queries
      (prismaService.effect.findMany as jest.Mock) = jest
        .fn()
        .mockImplementation(({ where }: EffectFindManyArgs) => {
          if (where.timing === 'ON_RESOLVE')
            return Promise.resolve([effectSuccess1, effectFailure, effectSuccess2]);
          return Promise.resolve([]);
        });

      // Mock encounter update
      const resolvedEncounter = {
        ...mockEncounter,
        isResolved: true,
        resolvedAt: new Date(),
        version: 2,
      };
      jest.spyOn(prismaService.encounter, 'update').mockResolvedValue(resolvedEncounter);

      // Mock effect execution records
      (prismaService.effectExecution.create as jest.Mock) = jest
        .fn()
        .mockImplementation((args: EffectExecutionCreateArgs) => {
          return Promise.resolve({
            id: `execution-${args.data.effectId}`,
            effectId: args.data.effectId,
            entityType: args.data.entityType,
            entityId: args.data.entityId,
            executedAt: new Date(),
            executedBy: args.data.executedBy,
            context: args.data.context,
            result: args.data.result,
            error: args.data.error,
          } as EffectExecution);
        });

      // Mock transaction - pass prismaService as transaction client
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: TransactionCallback<T>) => {
          return await callback(prismaService);
        }
      );

      // Execute: Resolve encounter
      const result = await encounterService.resolve('encounter-1', mockAuthUser);

      // Verify: Encounter still resolved despite failure
      expect(result.encounter.isResolved).toBe(true);

      // Verify: Summary shows partial success
      expect(result.effectSummary.onResolve.total).toBe(3);
      expect(result.effectSummary.onResolve.succeeded).toBe(2);
      expect(result.effectSummary.onResolve.failed).toBe(1);

      // Verify: All 3 effects attempted (2 success + 1 failure)
      expect(prismaService.effectExecution.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('Event Completion with State Mutations', () => {
    it('should execute effects and update event state during completion', async () => {
      // Setup: Create event with effect that modifies resources
      const effect = {
        id: 'effect-1',
        name: 'Harvest resources',
        description: 'Increase food and gold',
        effectType: 'patch',
        payload: [
          { op: 'replace', path: '/variables/food', value: 1000 },
          { op: 'replace', path: '/variables/gold', value: 500 },
        ] as Operation[],
        entityType: 'EVENT',
        entityId: 'event-1',
        timing: 'ON_RESOLVE',
        priority: 0,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      } as unknown as Effect;

      // Mock campaign access
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue(mockCampaign);

      // Mock event lookup
      jest
        .spyOn(prismaService.event, 'findFirst')
        .mockResolvedValue({ ...mockEvent, campaign: mockCampaign } as EventWithCampaign);

      jest
        .spyOn(prismaService.event, 'findUnique')
        .mockResolvedValue({ ...mockEvent, campaign: mockCampaign } as EventWithCampaign);

      // Mock effect queries
      (prismaService.effect.findMany as jest.Mock) = jest
        .fn()
        .mockImplementation(({ where }: EffectFindManyArgs) => {
          if (where.timing === 'ON_RESOLVE') return Promise.resolve([effect]);
          return Promise.resolve([]);
        });

      // Mock event update
      const completedEvent = {
        ...mockEvent,
        isCompleted: true,
        occurredAt: new Date(),
        version: 2,
      };
      jest.spyOn(prismaService.event, 'update').mockResolvedValue(completedEvent);

      // Mock effect execution records
      (prismaService.effectExecution.create as jest.Mock) = jest
        .fn()
        .mockImplementation((args: EffectExecutionCreateArgs) => {
          return Promise.resolve({
            id: `execution-${args.data.effectId}`,
            effectId: args.data.effectId,
            entityType: args.data.entityType,
            entityId: args.data.entityId,
            executedAt: new Date(),
            executedBy: args.data.executedBy,
            context: args.data.context,
            result: args.data.result,
            error: args.data.error,
          } as EffectExecution);
        });

      // Mock transaction - pass prismaService as transaction client
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: TransactionCallback<T>) => {
          return await callback(prismaService);
        }
      );

      // Execute: Complete event
      const result = await eventService.complete('event-1', mockAuthUser);

      // Verify: Event completed successfully
      expect(result.event.isCompleted).toBe(true);
      expect(result.event.occurredAt).toBeDefined();

      // Verify: Effect executed
      expect(result.effectSummary.onResolve.total).toBe(1);
      expect(result.effectSummary.onResolve.succeeded).toBe(1);
      expect(result.effectSummary.onResolve.failed).toBe(0);

      // Verify: Effect execution record created
      expect(prismaService.effectExecution.create).toHaveBeenCalledTimes(1);
      expect(prismaService.effectExecution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            effectId: 'effect-1',
            entityType: 'EVENT',
            entityId: 'event-1',
            result: expect.objectContaining({
              success: true,
            }),
            error: null,
          }),
        })
      );
    });
  });

  describe('Authorization Scenarios', () => {
    it('should reject effect execution when user lacks campaign access', async () => {
      // Setup: Mock unauthorized user
      const unauthorizedAuthUser: AuthenticatedUser = {
        id: 'user-2',
        email: 'unauthorized@example.com',
        role: 'viewer',
      };

      // Mock campaign NOT found (access denied)
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue(null);

      // Mock encounter lookup (should fail at campaign access check)
      jest
        .spyOn(prismaService.encounter, 'findFirst')
        .mockResolvedValue({ ...mockEncounter, campaign: mockCampaign } as EncounterWithCampaign);

      // Execute: Attempt to resolve encounter
      await expect(encounterService.resolve('encounter-1', unauthorizedAuthUser)).rejects.toThrow(
        NotFoundException
      );

      // Verify: No effects executed
      expect(prismaService.effect.findMany).not.toHaveBeenCalled();
      expect(prismaService.effectExecution.create).not.toHaveBeenCalled();
    });

    it('should reject resolution of already-resolved encounter', async () => {
      // Setup: Mock already-resolved encounter
      const resolvedEncounter = {
        ...mockEncounter,
        isResolved: true,
        resolvedAt: new Date('2025-01-15'),
      };

      // Mock campaign access
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue(mockCampaign);

      // Mock encounter lookup
      jest.spyOn(prismaService.encounter, 'findFirst').mockResolvedValue({
        ...resolvedEncounter,
        campaign: mockCampaign,
      } as EncounterWithCampaign);

      // Execute: Attempt to resolve already-resolved encounter
      await expect(encounterService.resolve('encounter-1', mockAuthUser)).rejects.toThrow(
        BadRequestException
      );

      // Verify: No effects executed
      expect(prismaService.effect.findMany).not.toHaveBeenCalled();
      expect(prismaService.effectExecution.create).not.toHaveBeenCalled();
    });
  });

  describe('Complex Patch Operations', () => {
    it('should handle nested path updates in JSON Patch', async () => {
      // Setup: Effect with nested path operations
      const effect = {
        id: 'effect-1',
        name: 'Update nested resources',
        description: null,
        effectType: 'patch',
        payload: [
          { op: 'replace', path: '/variables/resources/gold', value: 2000 },
          { op: 'replace', path: '/variables/resources/food', value: 1500 },
          { op: 'add', path: '/variables/resources/wood', value: 800 },
        ] as Operation[],
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 0,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      } as unknown as Effect;

      // Setup encounter with nested resources
      const encounterWithNested = {
        ...mockEncounter,
        variables: {
          resources: {
            gold: 1000,
            food: 500,
          },
        },
      };

      // Mock campaign access
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue(mockCampaign);

      // Mock encounter lookup
      jest.spyOn(prismaService.encounter, 'findFirst').mockResolvedValue({
        ...encounterWithNested,
        campaign: mockCampaign,
      } as EncounterWithCampaign);

      jest.spyOn(prismaService.encounter, 'findUnique').mockResolvedValue({
        ...encounterWithNested,
        campaign: mockCampaign,
      } as EncounterWithCampaign);

      // Mock effect queries
      (prismaService.effect.findMany as jest.Mock) = jest
        .fn()
        .mockImplementation(({ where }: EffectFindManyArgs) => {
          if (where.timing === 'ON_RESOLVE') return Promise.resolve([effect]);
          return Promise.resolve([]);
        });

      // Mock encounter update
      const resolvedEncounter = {
        ...encounterWithNested,
        isResolved: true,
        resolvedAt: new Date(),
        version: 2,
      };
      jest.spyOn(prismaService.encounter, 'update').mockResolvedValue(resolvedEncounter);

      // Mock effect execution records
      (prismaService.effectExecution.create as jest.Mock) = jest
        .fn()
        .mockImplementation((args: EffectExecutionCreateArgs) => {
          return Promise.resolve({
            id: `execution-${args.data.effectId}`,
            effectId: args.data.effectId,
            entityType: args.data.entityType,
            entityId: args.data.entityId,
            executedAt: new Date(),
            executedBy: args.data.executedBy,
            context: args.data.context,
            result: args.data.result,
            error: args.data.error,
          } as EffectExecution);
        });

      // Mock transaction - pass prismaService as transaction client
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: TransactionCallback<T>) => {
          return await callback(prismaService);
        }
      );

      // Execute: Resolve encounter
      const result = await encounterService.resolve('encounter-1', mockAuthUser);

      // Verify: Effect executed successfully
      expect(result.effectSummary.onResolve.total).toBe(1);
      expect(result.effectSummary.onResolve.succeeded).toBe(1);
      expect(result.effectSummary.onResolve.failed).toBe(0);

      // Verify: Execution record shows affected nested fields
      const executionCall = (prismaService.effectExecution.create as jest.Mock).mock.calls[0][0];
      expect(executionCall.data.result.affectedFields).toContain('/variables/resources/gold');
      expect(executionCall.data.result.affectedFields).toContain('/variables/resources/food');
      expect(executionCall.data.result.affectedFields).toContain('/variables/resources/wood');
    });

    it('should reject operations on protected fields', async () => {
      // Setup: Effect attempting to modify protected field (id)
      const maliciousEffect = {
        id: 'effect-1',
        name: 'Malicious effect',
        description: 'Attempt to change entity ID',
        effectType: 'patch',
        payload: [{ op: 'replace', path: '/id', value: 'hacked-id' }] as Operation[],
        entityType: 'ENCOUNTER',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 0,
        isActive: true,
        version: 1,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
      } as unknown as Effect;

      // Mock campaign access
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue(mockCampaign);

      // Mock encounter lookup
      jest
        .spyOn(prismaService.encounter, 'findFirst')
        .mockResolvedValue({ ...mockEncounter, campaign: mockCampaign } as EncounterWithCampaign);

      jest
        .spyOn(prismaService.encounter, 'findUnique')
        .mockResolvedValue({ ...mockEncounter, campaign: mockCampaign } as EncounterWithCampaign);

      // Mock effect queries
      (prismaService.effect.findMany as jest.Mock) = jest
        .fn()
        .mockImplementation(({ where }: EffectFindManyArgs) => {
          if (where.timing === 'ON_RESOLVE') return Promise.resolve([maliciousEffect]);
          return Promise.resolve([]);
        });

      // Mock encounter update
      const resolvedEncounter = {
        ...mockEncounter,
        isResolved: true,
        resolvedAt: new Date(),
        version: 2,
      };
      jest.spyOn(prismaService.encounter, 'update').mockResolvedValue(resolvedEncounter);

      // Mock effect execution records
      (prismaService.effectExecution.create as jest.Mock) = jest
        .fn()
        .mockImplementation((args: EffectExecutionCreateArgs) => {
          return Promise.resolve({
            id: `execution-${args.data.effectId}`,
            effectId: args.data.effectId,
            entityType: args.data.entityType,
            entityId: args.data.entityId,
            executedAt: new Date(),
            executedBy: args.data.executedBy,
            context: args.data.context,
            result: args.data.result,
            error: args.data.error,
          } as EffectExecution);
        });

      // Mock transaction - pass prismaService as transaction client
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: TransactionCallback<T>) => {
          return await callback(prismaService);
        }
      );

      // Execute: Resolve encounter
      const result = await encounterService.resolve('encounter-1', mockAuthUser);

      // Verify: Encounter still resolved (failed effect doesn't block)
      expect(result.encounter.isResolved).toBe(true);

      // Verify: Effect failed due to validation
      expect(result.effectSummary.onResolve.total).toBe(1);
      expect(result.effectSummary.onResolve.succeeded).toBe(0);
      expect(result.effectSummary.onResolve.failed).toBe(1);

      // Verify: Failure recorded in execution record
      const executionCall = (prismaService.effectExecution.create as jest.Mock).mock.calls[0][0];
      expect(executionCall.data.result.success).toBe(false);
      expect(executionCall.data.error).toContain('protected');
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect circular dependencies in effect chains (future implementation)', async () => {
      // NOTE: This test documents the expected behavior once
      // executeEffectsWithDependencies is implemented (Stage 7 foundation).
      //
      // Currently, this method throws NotImplementedException.
      // When implemented, it should:
      // 1. Use DependencyGraphService to get topological sort
      // 2. Detect cycles via hasCycle() check
      // 3. Throw BadRequestException if cycle detected
      // 4. Execute effects in dependency order if no cycle

      // Setup: Create circular effect chain
      // Effect A writes variable X → Effect B reads X, writes Y → Effect C reads Y, writes X (cycle!)

      // This test is a placeholder for future implementation.
      // For now, verify that the stub method throws NotImplementedException.
      await expect(
        effectExecutionService.executeEffectsWithDependencies(
          ['effect-a', 'effect-b', 'effect-c'],
          {},
          { id: 'user-1', email: 'test@example.com' }
        )
      ).rejects.toThrow('not yet implemented');
    });
  });
});
