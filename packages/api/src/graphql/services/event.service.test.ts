/**
 * Event Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { AuditService } from './audit.service';
import { DependencyGraphService } from './dependency-graph.service';
import { EffectExecutionService } from './effect-execution.service';
import { EffectPatchService } from './effect-patch.service';
import { EventService } from './event.service';
import { VersionService } from './version.service';

describe('EventService', () => {
  let service: EventService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'user',
  };

  const mockCampaign = {
    id: 'campaign-1',
    name: 'Test Campaign',
    worldId: 'world-1',
    ownerId: 'user-1',
    settings: {},
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
    memberships: [],
  };

  const mockLocation = {
    id: 'location-1',
    worldId: 'world-1',
    type: 'region',
    name: 'The Shire',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  const mockEvent = {
    id: 'event-1',
    campaignId: 'campaign-1',
    locationId: 'location-1',
    name: 'Festival of Greengrass',
    description: 'Annual spring festival',
    eventType: 'story',
    scheduledAt: new Date('2024-03-20'),
    occurredAt: null,
    isCompleted: false,
    variables: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
    version: 1,
  };

  beforeEach(async () => {
    // Create mock prisma service with mocked methods
    const mockPrismaService = {
      campaign: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
      event: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      branch: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    // Configure $transaction mock to execute callback with mock transaction client
    (mockPrismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        // Create a mock transaction prisma client that delegates to the main mock
        const txPrisma = {
          event: mockPrismaService.event,
        };
        return callback(txPrisma);
      }
      // Fallback for array form (not used in current implementation)
      return Promise.all(callback);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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
            createVersion: jest.fn(),
            resolveVersion: jest.fn(),
            decompressVersion: jest.fn(),
          },
        },
        {
          provide: DependencyGraphService,
          useValue: {
            invalidateCache: jest.fn(),
          },
        },
        {
          provide: EffectExecutionService,
          useValue: {
            executeEffects: jest.fn(),
          },
        },
        {
          provide: EffectPatchService,
          useValue: {
            applyPatch: jest.fn(),
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

    service = module.get<EventService>(EventService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return an event by ID when user has access', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const result = await service.findById('event-1', mockUser);

      expect(result).toEqual(mockEvent);
      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'event-1',
          deletedAt: null,
        },
      });
    });

    it('should return null if event not found', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent', mockUser);

      expect(result).toBeNull();
    });

    it('should throw ForbiddenException if user does not have campaign access', async () => {
      const otherUserCampaign = { ...mockCampaign, ownerId: 'other-user', memberships: [] };

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(otherUserCampaign);

      await expect(service.findById('event-1', mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByCampaignId', () => {
    it('should return all non-deleted, non-archived events for a campaign', async () => {
      const events = [mockEvent, { ...mockEvent, id: 'event-2', name: 'Winter Solstice' }];

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.event.findMany as jest.Mock).mockResolvedValue(events);

      const result = await service.findByCampaignId('campaign-1', mockUser);

      expect(result).toEqual(events);
      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'campaign-1',
          deletedAt: null,
          archivedAt: null,
        },
        orderBy: {
          scheduledAt: 'asc',
        },
      });
    });

    it('should throw NotFoundException if campaign not found', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findByCampaignId('nonexistent', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    it('should create a new event with valid data', async () => {
      const input = {
        campaignId: 'campaign-1',
        locationId: 'location-1',
        name: 'Festival of Greengrass',
        description: 'Annual spring festival',
        eventType: 'story',
        scheduledAt: '2024-03-20T00:00:00.000Z',
        variables: { mood: 'festive' },
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(mockLocation);
      (prisma.event.create as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockEvent);
      expect(prisma.event.create).toHaveBeenCalledWith({
        data: {
          campaignId: input.campaignId,
          locationId: input.locationId,
          name: input.name,
          description: input.description,
          eventType: input.eventType,
          scheduledAt: new Date(input.scheduledAt),
          variables: input.variables,
        },
      });
      expect(audit.log).toHaveBeenCalledWith('event', mockEvent.id, 'CREATE', mockUser.id, {
        campaignId: mockEvent.campaignId,
        locationId: mockEvent.locationId,
        name: mockEvent.name,
        description: mockEvent.description,
        eventType: mockEvent.eventType,
        scheduledAt: mockEvent.scheduledAt,
        variables: mockEvent.variables,
      });
    });

    it('should create event without location or schedule', async () => {
      const input = {
        campaignId: 'campaign-1',
        name: 'Unscheduled Event',
        eventType: 'party',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.event.create as jest.Mock).mockResolvedValue({
        ...mockEvent,
        locationId: null,
        scheduledAt: null,
      });

      await service.create(input, mockUser);

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: {
          campaignId: input.campaignId,
          locationId: null,
          name: input.name,
          description: null,
          eventType: input.eventType,
          scheduledAt: null,
          variables: {},
        },
      });
    });

    it('should throw NotFoundException if campaign not found', async () => {
      const input = {
        campaignId: 'nonexistent',
        name: 'Test',
        eventType: 'story',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('should throw error if location belongs to different world', async () => {
      const input = {
        campaignId: 'campaign-1',
        locationId: 'location-1',
        name: 'Test',
        eventType: 'story',
      };

      const differentWorldLocation = { ...mockLocation, worldId: 'world-2' };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(differentWorldLocation);

      await expect(service.create(input, mockUser)).rejects.toThrow(
        'Location must belong to the same world as the campaign'
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const mockBranchId = 'branch-1';
    const mockBranch = {
      id: mockBranchId,
      campaignId: 'campaign-1',
      name: 'Main',
      deletedAt: null,
    };

    it('should update an event with valid data', async () => {
      const input = {
        name: 'Updated Festival',
        description: 'Updated description',
      };

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        ...input,
      });

      const result = await service.update('event-1', input, mockUser, 1, mockBranchId);

      expect(result.name).toBe(input.name);
      expect(audit.log).toHaveBeenCalledWith(
        'event',
        'event-1',
        'UPDATE',
        mockUser.id,
        expect.any(Object)
      );
    });

    it('should mark event as completed and set occurredAt if not already set', async () => {
      const input = {
        isCompleted: true,
      };

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        isCompleted: true,
        occurredAt: expect.any(Date),
      });

      await service.update('event-1', input, mockUser, 1, mockBranchId);

      expect(prisma.event.update).toHaveBeenCalled();
    });

    it('should not override occurredAt if already set when completing', async () => {
      const existingOccurredAt = new Date('2024-03-20');
      const eventWithOccurredAt = {
        ...mockEvent,
        occurredAt: existingOccurredAt,
      };

      const input = {
        isCompleted: true,
      };

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(eventWithOccurredAt);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.event.update as jest.Mock).mockResolvedValue({
        ...eventWithOccurredAt,
        isCompleted: true,
      });

      await service.update('event-1', input, mockUser, 1, mockBranchId);

      expect(prisma.event.update).toHaveBeenCalled();
    });

    it('should allow explicit occurredAt to be set', async () => {
      const input = {
        occurredAt: '2024-03-21T12:00:00.000Z',
      };

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        occurredAt: new Date(input.occurredAt),
      });

      await service.update('event-1', input, mockUser, 1, mockBranchId);

      expect(prisma.event.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if event not found', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }, mockUser, 1, mockBranchId)
      ).rejects.toThrow(NotFoundException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete an event without cascading', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        deletedAt: expect.any(Date),
      });

      const result = await service.delete('event-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('event', 'event-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if event not found', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive an event', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        archivedAt: expect.any(Date),
      });

      const result = await service.archive('event-1', mockUser);

      expect(result.archivedAt).toBeDefined();
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('event', 'event-1', 'ARCHIVE', mockUser.id, {
        archivedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if event not found', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.archive('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should restore an archived event', async () => {
      const archivedEvent = {
        ...mockEvent,
        archivedAt: new Date(),
      };

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(archivedEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.event.update as jest.Mock).mockResolvedValue({
        ...archivedEvent,
        archivedAt: null,
      });

      const result = await service.restore('event-1', mockUser);

      expect(result.archivedAt).toBeNull();
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { archivedAt: null },
      });
      expect(audit.log).toHaveBeenCalledWith('event', 'event-1', 'RESTORE', mockUser.id, {
        archivedAt: null,
      });
    });

    it('should throw NotFoundException if event not found', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.restore('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });
});
