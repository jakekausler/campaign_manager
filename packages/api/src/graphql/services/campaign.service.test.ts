/**
 * Campaign Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { AuditService } from './audit.service';
import { CampaignService } from './campaign.service';

describe('CampaignService', () => {
  let service: CampaignService;
  let prisma: PrismaService;
  let audit: AuditService;

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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        {
          provide: PrismaService,
          useValue: {
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
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CampaignService>(CampaignService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
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
    it('should update a campaign with valid data', async () => {
      const input = {
        name: 'Updated Campaign',
      };

      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign) // findById
        .mockResolvedValueOnce(mockCampaign); // hasEditPermission

      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        name: input.name,
      });

      const result = await service.update('campaign-1', input, mockUser);

      expect(result.name).toBe(input.name);
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: { name: input.name },
      });
      expect(audit.log).toHaveBeenCalledWith('campaign', 'campaign-1', 'UPDATE', mockUser.id, {
        name: input.name,
      });
    });

    it('should throw NotFoundException if campaign not found', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' }, mockUser)).rejects.toThrow(
        NotFoundException
      );
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user lacks permissions', async () => {
      (prisma.campaign.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockCampaign) // findById
        .mockResolvedValueOnce(null); // hasEditPermission

      await expect(service.update('campaign-1', { name: 'Test' }, mockUser)).rejects.toThrow(
        ForbiddenException
      );
      expect(prisma.campaign.update).not.toHaveBeenCalled();
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
});
