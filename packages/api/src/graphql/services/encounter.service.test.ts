/**
 * Encounter Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { AuditService } from './audit.service';
import { EncounterService } from './encounter.service';
import { VersionService } from './version.service';

describe('EncounterService', () => {
  let service: EncounterService;
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

  const mockEncounter = {
    id: 'encounter-1',
    campaignId: 'campaign-1',
    locationId: 'location-1',
    name: 'Goblin Ambush',
    description: 'A group of goblins attacks the party',
    difficulty: 5,
    isResolved: false,
    resolvedAt: null,
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
      encounter: {
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
          encounter: mockPrismaService.encounter,
        };
        return callback(txPrisma);
      }
      // Fallback for array form (not used in current implementation)
      return Promise.all(callback);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncounterService,
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
          provide: 'REDIS_PUBSUB',
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EncounterService>(EncounterService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return an encounter by ID when user has access', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const result = await service.findById('encounter-1', mockUser);

      expect(result).toEqual(mockEncounter);
      expect(prisma.encounter.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'encounter-1',
          deletedAt: null,
        },
      });
    });

    it('should return null if encounter not found', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent', mockUser);

      expect(result).toBeNull();
    });

    it('should throw ForbiddenException if user does not have campaign access', async () => {
      const otherUserCampaign = { ...mockCampaign, ownerId: 'other-user', memberships: [] };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(otherUserCampaign);

      await expect(service.findById('encounter-1', mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByCampaignId', () => {
    it('should return all non-deleted, non-archived encounters for a campaign', async () => {
      const encounters = [
        mockEncounter,
        { ...mockEncounter, id: 'encounter-2', name: 'Dragon Fight' },
      ];

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.encounter.findMany as jest.Mock).mockResolvedValue(encounters);

      const result = await service.findByCampaignId('campaign-1', mockUser);

      expect(result).toEqual(encounters);
      expect(prisma.encounter.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'campaign-1',
          deletedAt: null,
          archivedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
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
    it('should create a new encounter with valid data', async () => {
      const input = {
        campaignId: 'campaign-1',
        locationId: 'location-1',
        name: 'Goblin Ambush',
        description: 'A group of goblins attacks the party',
        difficulty: 5,
        variables: { enemy: 'goblins' },
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(mockLocation);
      (prisma.encounter.create as jest.Mock).mockResolvedValue(mockEncounter);

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockEncounter);
      expect(prisma.encounter.create).toHaveBeenCalledWith({
        data: {
          campaignId: input.campaignId,
          locationId: input.locationId,
          name: input.name,
          description: input.description,
          difficulty: input.difficulty,
          variables: input.variables,
        },
      });
      expect(audit.log).toHaveBeenCalledWith('encounter', mockEncounter.id, 'CREATE', mockUser.id, {
        campaignId: mockEncounter.campaignId,
        locationId: mockEncounter.locationId,
        name: mockEncounter.name,
        description: mockEncounter.description,
        difficulty: mockEncounter.difficulty,
        variables: mockEncounter.variables,
      });
    });

    it('should create encounter without location', async () => {
      const input = {
        campaignId: 'campaign-1',
        name: 'Random Encounter',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.encounter.create as jest.Mock).mockResolvedValue({
        ...mockEncounter,
        locationId: null,
      });

      await service.create(input, mockUser);

      expect(prisma.encounter.create).toHaveBeenCalledWith({
        data: {
          campaignId: input.campaignId,
          locationId: null,
          name: input.name,
          description: null,
          difficulty: null,
          variables: {},
        },
      });
    });

    it('should throw NotFoundException if campaign not found', async () => {
      const input = {
        campaignId: 'nonexistent',
        name: 'Test',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.encounter.create).not.toHaveBeenCalled();
    });

    it('should throw error if location belongs to different world', async () => {
      const input = {
        campaignId: 'campaign-1',
        locationId: 'location-1',
        name: 'Test',
      };

      const differentWorldLocation = { ...mockLocation, worldId: 'world-2' };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(differentWorldLocation);

      await expect(service.create(input, mockUser)).rejects.toThrow(
        'Location must belong to the same world as the campaign'
      );
      expect(prisma.encounter.create).not.toHaveBeenCalled();
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

    it('should update an encounter with valid data', async () => {
      const input = {
        name: 'Updated Ambush',
        description: 'Updated description',
        difficulty: 7,
      };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.encounter.update as jest.Mock).mockResolvedValue({
        ...mockEncounter,
        ...input,
      });

      const result = await service.update('encounter-1', input, mockUser, 1, mockBranchId);

      expect(result.name).toBe(input.name);
      expect(audit.log).toHaveBeenCalledWith(
        'encounter',
        'encounter-1',
        'UPDATE',
        mockUser.id,
        expect.any(Object)
      );
    });

    it('should mark encounter as resolved and set resolvedAt', async () => {
      const input = {
        isResolved: true,
      };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.encounter.update as jest.Mock).mockResolvedValue({
        ...mockEncounter,
        isResolved: true,
        resolvedAt: expect.any(Date),
      });

      await service.update('encounter-1', input, mockUser, 1, mockBranchId);

      expect(prisma.encounter.update).toHaveBeenCalled();
    });

    it('should clear resolvedAt when marking as unresolved', async () => {
      const input = {
        isResolved: false,
      };

      const resolvedEncounter = {
        ...mockEncounter,
        isResolved: true,
        resolvedAt: new Date(),
      };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(resolvedEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.encounter.update as jest.Mock).mockResolvedValue({
        ...resolvedEncounter,
        isResolved: false,
        resolvedAt: null,
      });

      await service.update('encounter-1', input, mockUser, 1, mockBranchId);

      expect(prisma.encounter.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if encounter not found', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }, mockUser, 1, mockBranchId)
      ).rejects.toThrow(NotFoundException);
      expect(prisma.encounter.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete an encounter without cascading', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.encounter.update as jest.Mock).mockResolvedValue({
        ...mockEncounter,
        deletedAt: expect.any(Date),
      });

      const result = await service.delete('encounter-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(prisma.encounter.update).toHaveBeenCalledWith({
        where: { id: 'encounter-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('encounter', 'encounter-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if encounter not found', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.encounter.update).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive an encounter', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.encounter.update as jest.Mock).mockResolvedValue({
        ...mockEncounter,
        archivedAt: expect.any(Date),
      });

      const result = await service.archive('encounter-1', mockUser);

      expect(result.archivedAt).toBeDefined();
      expect(prisma.encounter.update).toHaveBeenCalledWith({
        where: { id: 'encounter-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('encounter', 'encounter-1', 'ARCHIVE', mockUser.id, {
        archivedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if encounter not found', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.archive('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.encounter.update).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should restore an archived encounter', async () => {
      const archivedEncounter = {
        ...mockEncounter,
        archivedAt: new Date(),
      };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(archivedEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.encounter.update as jest.Mock).mockResolvedValue({
        ...archivedEncounter,
        archivedAt: null,
      });

      const result = await service.restore('encounter-1', mockUser);

      expect(result.archivedAt).toBeNull();
      expect(prisma.encounter.update).toHaveBeenCalledWith({
        where: { id: 'encounter-1' },
        data: { archivedAt: null },
      });
      expect(audit.log).toHaveBeenCalledWith('encounter', 'encounter-1', 'RESTORE', mockUser.id, {
        archivedAt: null,
      });
    });

    it('should throw NotFoundException if encounter not found', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.restore('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.encounter.update).not.toHaveBeenCalled();
    });
  });
});
