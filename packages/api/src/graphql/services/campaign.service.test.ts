/**
 * Campaign Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';

import { AuditService } from './audit.service';
import { CampaignService } from './campaign.service';
import { VersionService } from './version.service';

describe('CampaignService', () => {
  let service: CampaignService;
  let prisma: PrismaService;
  let audit: AuditService;
  let versionService: VersionService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'user',
  };

  const mockWorld = {
    id: 'world-1',
    name: 'Middle Earth',
    calendars: {},
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
    version: 1,
  };

  const mockCampaign = {
    id: 'campaign-1',
    name: 'Test Campaign',
    worldId: 'world-1',
    ownerId: 'user-1',
    settings: {},
    isActive: true,
    currentWorldTime: new Date('4707-03-15T12:00:00Z'),
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
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      world: {
        findFirst: jest.fn(),
      },
      branch: {
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      event: {
        updateMany: jest.fn(),
      },
      encounter: {
        updateMany: jest.fn(),
      },
      character: {
        updateMany: jest.fn(),
      },
      party: {
        updateMany: jest.fn(),
      },
      kingdom: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      settlement: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      structure: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    // Configure $transaction mock to execute callback with mock transaction client
    (mockPrismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        // Create a mock transaction prisma client that delegates to the main mock
        const txPrisma = {
          campaign: mockPrismaService.campaign,
        };
        return callback(txPrisma);
      }
      // Fallback for array form (not used in current implementation)
      return Promise.all(callback);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
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
        {
          provide: WebSocketPublisherService,
          useValue: {
            publishEntityUpdated: jest.fn().mockResolvedValue(undefined),
            publishSettlementUpdated: jest.fn().mockResolvedValue(undefined),
            publishStructureUpdated: jest.fn().mockResolvedValue(undefined),
            publishWorldTimeChanged: jest.fn().mockResolvedValue(undefined),
            publishStateInvalidated: jest.fn().mockResolvedValue(undefined),
            publishEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<CampaignService>(CampaignService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
    versionService = module.get<VersionService>(VersionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a campaign by ID if user is owner', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const result = await service.findById('campaign-1', mockUser);

      expect(result).toEqual(mockCampaign);
      expect(prisma.campaign.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'campaign-1',
          deletedAt: null,
          OR: [
            { ownerId: mockUser.id },
            {
              memberships: {
                some: {
                  userId: mockUser.id,
                },
              },
            },
          ],
        },
      });
    });

    it('should return null if campaign not found', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent', mockUser);

      expect(result).toBeNull();
    });

    it('should return campaign with currentWorldTime field', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const result = await service.findById('campaign-1', mockUser);

      expect(result).toHaveProperty('currentWorldTime');
      expect(result?.currentWorldTime).toEqual(new Date('4707-03-15T12:00:00Z'));
    });
  });

  describe('findAll', () => {
    it('should return all accessible campaigns for user', async () => {
      const campaigns = [
        mockCampaign,
        { ...mockCampaign, id: 'campaign-2', name: 'Another Campaign' },
      ];
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(campaigns);

      const result = await service.findAll(mockUser);

      expect(result).toEqual(campaigns);
      expect(prisma.campaign.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          archivedAt: null,
          OR: [
            { ownerId: mockUser.id },
            {
              memberships: {
                some: {
                  userId: mockUser.id,
                },
              },
            },
          ],
        },
        orderBy: {
          name: 'asc',
        },
      });
    });

    it('should return campaigns with currentWorldTime field', async () => {
      const campaigns = [
        mockCampaign,
        { ...mockCampaign, id: 'campaign-2', name: 'Another Campaign', currentWorldTime: null },
      ];
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(campaigns);

      const result = await service.findAll(mockUser);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('currentWorldTime');
      expect(result[0].currentWorldTime).toEqual(new Date('4707-03-15T12:00:00Z'));
      expect(result[1]).toHaveProperty('currentWorldTime');
      expect(result[1].currentWorldTime).toBeNull();
    });
  });

  describe('findByWorldId', () => {
    it('should return campaigns for a specific world', async () => {
      const campaigns = [
        mockCampaign,
        { ...mockCampaign, id: 'campaign-2', name: 'Another Campaign' },
      ];
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(campaigns);

      const result = await service.findByWorldId('world-1', mockUser);

      expect(result).toEqual(campaigns);
      expect(prisma.campaign.findMany).toHaveBeenCalledWith({
        where: {
          worldId: 'world-1',
          deletedAt: null,
          archivedAt: null,
          OR: [
            { ownerId: mockUser.id },
            {
              memberships: {
                some: {
                  userId: mockUser.id,
                },
              },
            },
          ],
        },
        orderBy: {
          name: 'asc',
        },
      });
    });

    it('should return campaigns with currentWorldTime field', async () => {
      const campaigns = [
        mockCampaign,
        { ...mockCampaign, id: 'campaign-2', currentWorldTime: null },
      ];
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(campaigns);

      const result = await service.findByWorldId('world-1', mockUser);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('currentWorldTime');
      expect(result[0].currentWorldTime).toEqual(new Date('4707-03-15T12:00:00Z'));
      expect(result[1]).toHaveProperty('currentWorldTime');
      expect(result[1].currentWorldTime).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new campaign with valid data', async () => {
      const input = {
        name: 'Test Campaign',
        worldId: 'world-1',
        settings: { theme: 'dark' },
      };

      (prisma.world.findFirst as jest.Mock).mockResolvedValue(mockWorld);
      (prisma.campaign.create as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.create as jest.Mock).mockResolvedValue({
        id: 'branch-1',
        campaignId: mockCampaign.id,
        name: 'Main',
        description: 'Primary campaign timeline',
      });

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockCampaign);
      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          worldId: input.worldId,
          ownerId: mockUser.id,
          settings: input.settings,
          isActive: true,
        },
      });
      expect(prisma.branch.create).toHaveBeenCalledWith({
        data: {
          campaignId: mockCampaign.id,
          name: 'Main',
          description: 'Primary campaign timeline',
        },
      });
      expect(audit.log).toHaveBeenCalledWith('campaign', mockCampaign.id, 'CREATE', mockUser.id, {
        name: mockCampaign.name,
        worldId: mockCampaign.worldId,
        settings: mockCampaign.settings,
        isActive: mockCampaign.isActive,
      });
    });

    it('should throw NotFoundException if world not found', async () => {
      const input = {
        name: 'Test Campaign',
        worldId: 'nonexistent',
      };

      (prisma.world.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.campaign.create).not.toHaveBeenCalled();
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
    const mockWorldTime = new Date('2024-01-01T00:00:00Z');
    const mockVersion = {
      id: 'version-1',
      entityType: 'campaign',
      entityId: 'campaign-1',
      branchId: mockBranchId,
      validFrom: mockWorldTime,
      validTo: null,
      payloadGz: Buffer.from('compressed'),
      createdAt: new Date(),
      createdBy: 'user-1',
      comment: null,
      version: 2,
    };

    it('should update a campaign with valid data and create version', async () => {
      const input = {
        name: 'Updated Campaign',
      };

      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign) // findById
        .mockResolvedValueOnce(mockCampaign); // hasEditPermission
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);

      const updatedCampaign = {
        ...mockCampaign,
        name: input.name,
        version: 2,
      };

      (prisma.campaign.update as jest.Mock).mockResolvedValue(updatedCampaign);
      (versionService.createVersion as jest.Mock).mockResolvedValue(mockVersion);

      const result = await service.update(
        'campaign-1',
        input,
        mockUser,
        1, // expectedVersion
        mockBranchId,
        mockWorldTime
      );

      expect(result.name).toBe(input.name);
      expect(result.version).toBe(2);
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: {
          version: 2,
          name: input.name,
        },
      });
      expect(versionService.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'campaign',
          entityId: 'campaign-1',
          branchId: mockBranchId,
          validFrom: mockWorldTime,
          validTo: null,
        }),
        mockUser
      );
      expect(audit.log).toHaveBeenCalled();
    });

    it('should throw OptimisticLockException if version mismatch', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign) // findById
        .mockResolvedValueOnce(mockCampaign); // hasEditPermission
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);

      await expect(
        service.update(
          'campaign-1',
          { name: 'Test' },
          mockUser,
          999, // wrong expectedVersion
          mockBranchId
        )
      ).rejects.toThrow(OptimisticLockException);
      expect(prisma.campaign.update).not.toHaveBeenCalled();
      expect(versionService.createVersion).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if campaign not found', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }, mockUser, 1, mockBranchId)
      ).rejects.toThrow(NotFoundException);
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user lacks permissions', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign) // findById
        .mockResolvedValueOnce(null); // hasEditPermission
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);

      await expect(
        service.update('campaign-1', { name: 'Test' }, mockUser, 1, mockBranchId)
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it('should update all fields in version payload', async () => {
      const input = {
        name: 'Updated Campaign',
        settings: { theme: 'dark' },
        isActive: false,
      };

      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);

      const updatedCampaign = {
        ...mockCampaign,
        ...input,
        version: 2,
      };

      (prisma.campaign.update as jest.Mock).mockResolvedValue(updatedCampaign);
      (versionService.createVersion as jest.Mock).mockResolvedValue(mockVersion);

      await service.update('campaign-1', input, mockUser, 1, mockBranchId, mockWorldTime);

      expect(versionService.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            name: 'Updated Campaign',
            settings: { theme: 'dark' },
            isActive: false,
            version: 2,
          }),
        }),
        mockUser
      );
    });

    it('should use transaction for atomic update', async () => {
      const input = { name: 'Updated Campaign' };

      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);

      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        ...input,
        version: 2,
      });
      (versionService.createVersion as jest.Mock).mockResolvedValue(mockVersion);

      await service.update('campaign-1', input, mockUser, 1, mockBranchId, mockWorldTime);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete a campaign', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign) // findById
        .mockResolvedValueOnce(mockCampaign); // hasEditPermission

      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        deletedAt: expect.any(Date),
      });

      (prisma.kingdom.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.delete('campaign-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('campaign', 'campaign-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
    });

    it('should cascade delete to events', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(mockCampaign);

      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        deletedAt: new Date(),
      });

      (prisma.kingdom.findMany as jest.Mock).mockResolvedValue([]);

      await service.delete('campaign-1', mockUser);

      expect(prisma.event.updateMany).toHaveBeenCalledWith({
        where: { campaignId: 'campaign-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should cascade delete to encounters', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(mockCampaign);

      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        deletedAt: new Date(),
      });

      (prisma.kingdom.findMany as jest.Mock).mockResolvedValue([]);

      await service.delete('campaign-1', mockUser);

      expect(prisma.encounter.updateMany).toHaveBeenCalledWith({
        where: { campaignId: 'campaign-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should cascade delete to characters, parties, and kingdoms', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(mockCampaign);

      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        deletedAt: new Date(),
      });

      (prisma.kingdom.findMany as jest.Mock).mockResolvedValue([]);

      await service.delete('campaign-1', mockUser);

      expect(prisma.character.updateMany).toHaveBeenCalled();
      expect(prisma.party.updateMany).toHaveBeenCalled();
    });

    it('should cascade delete through kingdoms to settlements and structures', async () => {
      const mockKingdom = { id: 'kingdom-1' };
      const mockSettlement = { id: 'settlement-1' };

      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(mockCampaign);

      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        deletedAt: new Date(),
      });

      (prisma.kingdom.findMany as jest.Mock).mockResolvedValue([mockKingdom]);
      (prisma.settlement.findMany as jest.Mock).mockResolvedValue([mockSettlement]);

      await service.delete('campaign-1', mockUser);

      expect(prisma.kingdom.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['kingdom-1'] }, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.settlement.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['settlement-1'] }, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.structure.updateMany).toHaveBeenCalledWith({
        where: { settlementId: { in: ['settlement-1'] }, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException if user lacks permissions', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(null);

      await expect(service.delete('campaign-1', mockUser)).rejects.toThrow(ForbiddenException);
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive a campaign', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(mockCampaign);

      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        archivedAt: expect.any(Date),
      });

      const result = await service.archive('campaign-1', mockUser);

      expect(result.archivedAt).toBeDefined();
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('campaign', 'campaign-1', 'ARCHIVE', mockUser.id, {
        archivedAt: expect.any(Date),
      });
    });

    it('should throw ForbiddenException if user lacks permissions', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(null);

      await expect(service.archive('campaign-1', mockUser)).rejects.toThrow(ForbiddenException);
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should restore an archived campaign', async () => {
      const archivedCampaign = {
        ...mockCampaign,
        archivedAt: new Date(),
      };

      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(archivedCampaign) // initial find
        .mockResolvedValueOnce(archivedCampaign); // hasEditPermission

      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...archivedCampaign,
        archivedAt: null,
      });

      const result = await service.restore('campaign-1', mockUser);

      expect(result.archivedAt).toBeNull();
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: { archivedAt: null },
      });
      expect(audit.log).toHaveBeenCalledWith('campaign', 'campaign-1', 'RESTORE', mockUser.id, {
        archivedAt: null,
      });
    });

    it('should throw ForbiddenException if user lacks permissions', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce(null);

      await expect(service.restore('campaign-1', mockUser)).rejects.toThrow(ForbiddenException);
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('getCampaignAsOf', () => {
    const mockBranchId = 'branch-1';
    const mockWorldTime = new Date('2024-01-01T00:00:00Z');
    const mockVersion = {
      id: 'version-1',
      entityType: 'campaign',
      entityId: 'campaign-1',
      branchId: mockBranchId,
      validFrom: mockWorldTime,
      validTo: null,
      payloadGz: Buffer.from('compressed'),
      createdAt: new Date(),
      createdBy: 'user-1',
      comment: null,
      version: 1,
    };

    it('should return campaign state at specific world-time', async () => {
      const historicalCampaign = {
        ...mockCampaign,
        name: 'Historical Campaign Name',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (versionService.resolveVersion as jest.Mock).mockResolvedValue(mockVersion);
      (versionService.decompressVersion as jest.Mock).mockResolvedValue(historicalCampaign);

      const result = await service.getCampaignAsOf(
        'campaign-1',
        mockBranchId,
        mockWorldTime,
        mockUser
      );

      expect(result).toEqual(historicalCampaign);
      expect(versionService.resolveVersion).toHaveBeenCalledWith(
        'campaign',
        'campaign-1',
        mockBranchId,
        mockWorldTime
      );
      expect(versionService.decompressVersion).toHaveBeenCalledWith(mockVersion);
    });

    it('should return null if campaign not found', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getCampaignAsOf(
        'nonexistent',
        mockBranchId,
        mockWorldTime,
        mockUser
      );

      expect(result).toBeNull();
      expect(versionService.resolveVersion).not.toHaveBeenCalled();
    });

    it('should return null if no version found at specified time', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (versionService.resolveVersion as jest.Mock).mockResolvedValue(null);

      const result = await service.getCampaignAsOf(
        'campaign-1',
        mockBranchId,
        mockWorldTime,
        mockUser
      );

      expect(result).toBeNull();
      expect(versionService.decompressVersion).not.toHaveBeenCalled();
    });

    it('should verify user has access before querying version', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await service.getCampaignAsOf('campaign-1', mockBranchId, mockWorldTime, mockUser);

      expect(prisma.campaign.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'campaign-1',
          deletedAt: null,
          OR: [
            { ownerId: mockUser.id },
            {
              memberships: {
                some: {
                  userId: mockUser.id,
                },
              },
            },
          ],
        },
      });
    });
  });
});
