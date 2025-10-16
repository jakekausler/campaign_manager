/**
 * Party Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { PartyService } from './party.service';
import { VersionService } from './version.service';

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
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  const mockBranch = {
    id: 'branch-1',
    campaignId: 'campaign-1',
    name: 'main',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
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
            character: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            branch: {
              findFirst: jest.fn(),
            },
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
            createVersion: jest.fn(),
            resolveVersion: jest.fn(),
            decompressVersion: jest.fn(),
          },
        },
        {
          provide: CampaignContextService,
          useValue: {
            invalidateContextForEntity: jest.fn(),
          },
        },
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn(),
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

      const updatedParty = {
        ...mockParty,
        ...input,
        version: 2,
      };

      (prisma.party.findFirst as jest.Mock).mockResolvedValueOnce(mockParty); // findById
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign); // hasEditPermission
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          party: {
            update: jest.fn().mockResolvedValue(updatedParty),
          },
        });
      });

      const result = await service.update('party-1', input, mockUser, 1, 'branch-1');

      expect(result.name).toBe(input.name);
      expect(result.version).toBe(2);
      expect(audit.log).toHaveBeenCalledWith(
        'party',
        'party-1',
        'UPDATE',
        mockUser.id,
        expect.objectContaining({
          name: input.name,
          averageLevel: input.averageLevel,
          version: 2,
        })
      );
    });

    it('should throw NotFoundException if party not found', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }, mockUser, 1, 'branch-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValueOnce(mockParty);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('party-1', { name: 'Test' }, mockUser, 1, 'branch-1')
      ).rejects.toThrow(ForbiddenException);
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

  describe('calculateAverageLevel', () => {
    it('should calculate average level from party members', async () => {
      const partyWithMembers = {
        ...mockParty,
        members: [
          { id: 'char-1', level: 3 },
          { id: 'char-2', level: 5 },
          { id: 'char-3', level: 7 },
        ],
      };

      (prisma.party.findFirst as jest.Mock).mockResolvedValue(partyWithMembers);

      const result = await service.calculateAverageLevel('party-1', mockUser);

      expect(result).toBe(5); // (3 + 5 + 7) / 3 = 5
    });

    it('should return null if party has no members', async () => {
      const partyWithoutMembers = {
        ...mockParty,
        members: [],
      };

      (prisma.party.findFirst as jest.Mock).mockResolvedValue(partyWithoutMembers);

      const result = await service.calculateAverageLevel('party-1', mockUser);

      expect(result).toBeNull();
    });

    it('should throw NotFoundException if party not found', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.calculateAverageLevel('nonexistent', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('setLevel', () => {
    it('should set party level using manual override', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(mockParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.party.update as jest.Mock).mockResolvedValue({
        ...mockParty,
        manualLevelOverride: 10,
      });

      const result = await service.setLevel('party-1', 10, mockUser);

      expect(result.manualLevelOverride).toBe(10);
      expect(prisma.party.update).toHaveBeenCalledWith({
        where: { id: 'party-1' },
        data: { manualLevelOverride: 10 },
      });
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(mockParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.setLevel('party-1', 10, mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addMember', () => {
    it('should add a character to the party', async () => {
      const mockCharacter = {
        id: 'char-1',
        campaignId: 'campaign-1',
        partyId: null,
        name: 'Aragorn',
        level: 5,
      };

      (prisma.party.findFirst as jest.Mock).mockResolvedValue(mockParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);
      (prisma.character.update as jest.Mock).mockResolvedValue({
        ...mockCharacter,
        partyId: 'party-1',
      });

      await service.addMember('party-1', 'char-1', mockUser);

      expect(prisma.character.update).toHaveBeenCalledWith({
        where: { id: 'char-1' },
        data: { partyId: 'party-1' },
      });
    });

    it('should throw NotFoundException if character not found', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(mockParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.addMember('party-1', 'nonexistent', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('removeMember', () => {
    it('should remove a character from the party', async () => {
      const mockCharacter = {
        id: 'char-1',
        campaignId: 'campaign-1',
        partyId: 'party-1',
        name: 'Aragorn',
        level: 5,
      };

      (prisma.party.findFirst as jest.Mock).mockResolvedValue(mockParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);
      (prisma.character.update as jest.Mock).mockResolvedValue({
        ...mockCharacter,
        partyId: null,
      });

      await service.removeMember('party-1', 'char-1', mockUser);

      expect(prisma.character.update).toHaveBeenCalledWith({
        where: { id: 'char-1' },
        data: { partyId: null },
      });
    });

    it('should throw NotFoundException if character not found', async () => {
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(mockParty);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.removeMember('party-1', 'nonexistent', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
