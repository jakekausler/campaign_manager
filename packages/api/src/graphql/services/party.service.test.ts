/**
 * Party Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { AuditService } from './audit.service';
import { PartyService } from './party.service';

describe('PartyService', () => {
  let service: PartyService;
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
  };

  const mockParty = {
    id: 'party-1',
    campaignId: 'campaign-1',
    name: 'The Fellowship',
    averageLevel: 5,
    manualLevelOverride: null,
    variables: {},
    variableSchemas: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartyService,
        {
          provide: PrismaService,
          useValue: {
            party: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            campaign: {
              findFirst: jest.fn(),
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

    service = module.get<PartyService>(PartyService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a party by ID when user has access', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(mockParty);

      const result = await service.findById('party-1', mockUser);

      expect(result).toEqual(mockParty);
      expect(prisma.party.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'party-1',
          deletedAt: null,
          campaign: {
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
        },
      });
    });

    it('should return null if party not found', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent', mockUser);

      expect(result).toBeNull();
    });
  });

  describe('findByCampaign', () => {
    it('should return parties for a campaign', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.party.findMany as jest.Mock).mockResolvedValue([mockParty]);

      const result = await service.findByCampaign('campaign-1', mockUser);

      expect(result).toEqual([mockParty]);
      expect(prisma.party.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'campaign-1',
          deletedAt: null,
          archivedAt: null,
        },
        orderBy: {
          name: 'asc',
        },
      });
    });

    it('should throw NotFoundException if campaign not found', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findByCampaign('nonexistent', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    it('should create a party with valid data', async () => {
      const input = {
        name: 'The Fellowship',
        campaignId: 'campaign-1',
        averageLevel: 5,
        variables: { gold: 1000 },
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.party.create as jest.Mock).mockResolvedValue(mockParty);

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockParty);
      expect(prisma.party.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          campaignId: input.campaignId,
          averageLevel: input.averageLevel,
          manualLevelOverride: null,
          variables: input.variables,
          variableSchemas: [],
        },
      });
      expect(audit.log).toHaveBeenCalledWith('party', mockParty.id, 'CREATE', mockUser.id, {
        name: mockParty.name,
        campaignId: mockParty.campaignId,
        averageLevel: mockParty.averageLevel,
        manualLevelOverride: null,
      });
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      const input = {
        name: 'Test Party',
        campaignId: 'campaign-1',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(ForbiddenException);
      expect(prisma.party.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a party with valid data', async () => {
      const input = {
        name: 'Updated Fellowship',
        averageLevel: 10,
      };

      (prisma.party.findFirst as jest.Mock).mockResolvedValueOnce(mockParty); // findById
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign); // hasEditPermission
      (prisma.party.update as jest.Mock).mockResolvedValue({
        ...mockParty,
        ...input,
      });

      const result = await service.update('party-1', input, mockUser);

      expect(result.name).toBe(input.name);
      expect(prisma.party.update).toHaveBeenCalledWith({
        where: { id: 'party-1' },
        data: {
          name: input.name,
          averageLevel: input.averageLevel,
        },
      });
      expect(audit.log).toHaveBeenCalledWith('party', 'party-1', 'UPDATE', mockUser.id, {
        name: input.name,
        averageLevel: input.averageLevel,
      });
    });

    it('should throw NotFoundException if party not found', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' }, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValueOnce(mockParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('party-1', { name: 'Test' }, mockUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('delete', () => {
    it('should soft delete a party', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValueOnce(mockParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.party.update as jest.Mock).mockResolvedValue({
        ...mockParty,
        deletedAt: new Date(),
      });

      const result = await service.delete('party-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(prisma.party.update).toHaveBeenCalledWith({
        where: { id: 'party-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('party', 'party-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if party not found', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValueOnce(mockParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('party-1', mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('archive', () => {
    it('should archive a party', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValueOnce(mockParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.party.update as jest.Mock).mockResolvedValue({
        ...mockParty,
        archivedAt: new Date(),
      });

      const result = await service.archive('party-1', mockUser);

      expect(result.archivedAt).toBeDefined();
      expect(prisma.party.update).toHaveBeenCalledWith({
        where: { id: 'party-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('party', 'party-1', 'ARCHIVE', mockUser.id, {
        archivedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if party not found', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.archive('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('restore', () => {
    it('should restore an archived party', async () => {
      const archivedParty = {
        ...mockParty,
        archivedAt: new Date(),
      };

      (prisma.party.findFirst as jest.Mock)
        .mockResolvedValueOnce(archivedParty)
        .mockResolvedValueOnce(archivedParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.party.update as jest.Mock).mockResolvedValue({
        ...archivedParty,
        archivedAt: null,
      });

      const result = await service.restore('party-1', mockUser);

      expect(result.archivedAt).toBeNull();
      expect(prisma.party.update).toHaveBeenCalledWith({
        where: { id: 'party-1' },
        data: { archivedAt: null },
      });
      expect(audit.log).toHaveBeenCalledWith('party', 'party-1', 'RESTORE', mockUser.id, {
        archivedAt: null,
      });
    });

    it('should throw NotFoundException if party not found', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.restore('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });
});
