/**
 * Character Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { AuditService } from './audit.service';
import { CharacterService } from './character.service';
import { VersionService } from './version.service';

describe('CharacterService', () => {
  let service: CharacterService;
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
    name: 'Adventurers',
    averageLevel: 5,
    manualLevelOverride: null,
    variables: {},
    variableSchemas: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  const mockCharacter = {
    id: 'character-1',
    name: 'Gandalf',
    campaignId: 'campaign-1',
    partyId: 'party-1',
    level: 10,
    race: 'Wizard',
    class: 'Mage',
    isNPC: false,
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
      character: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      campaign: {
        findFirst: jest.fn(),
      },
      party: {
        findFirst: jest.fn(),
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
          character: mockPrismaService.character,
        };
        return callback(txPrisma);
      }
      // Fallback for array form (not used in current implementation)
      return Promise.all(callback);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterService,
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

    service = module.get<CharacterService>(CharacterService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a character by ID if user has access', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);

      const result = await service.findById('character-1', mockUser);

      expect(result).toEqual(mockCharacter);
      expect(prisma.character.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'character-1',
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

    it('should return null if character not found', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent', mockUser);

      expect(result).toBeNull();
    });
  });

  describe('findByCampaign', () => {
    it('should return all characters in a campaign', async () => {
      const characters = [mockCharacter, { ...mockCharacter, id: 'character-2', name: 'Frodo' }];

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.character.findMany as jest.Mock).mockResolvedValue(characters);

      const result = await service.findByCampaign('campaign-1', mockUser);

      expect(result).toEqual(characters);
      expect(prisma.character.findMany).toHaveBeenCalledWith({
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
      expect(prisma.character.findMany).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a new character with valid data', async () => {
      const input = {
        name: 'Gandalf',
        campaignId: 'campaign-1',
        partyId: 'party-1',
        level: 10,
        race: 'Wizard',
        class: 'Mage',
        isNPC: false,
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(mockParty);
      (prisma.character.create as jest.Mock).mockResolvedValue(mockCharacter);

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockCharacter);
      expect(prisma.character.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          campaignId: input.campaignId,
          partyId: input.partyId,
          level: input.level,
          race: input.race,
          class: input.class,
          isNPC: input.isNPC,
          variables: {},
        },
      });
      expect(audit.log).toHaveBeenCalledWith('character', mockCharacter.id, 'CREATE', mockUser.id, {
        name: mockCharacter.name,
        campaignId: mockCharacter.campaignId,
        partyId: mockCharacter.partyId,
        level: mockCharacter.level,
        race: mockCharacter.race,
        class: mockCharacter.class,
        isNPC: mockCharacter.isNPC,
      });
    });

    it('should create a character without a party', async () => {
      const input = {
        name: 'Gandalf',
        campaignId: 'campaign-1',
        level: 10,
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.character.create as jest.Mock).mockResolvedValue({
        ...mockCharacter,
        partyId: null,
      });

      const result = await service.create(input, mockUser);

      expect(result.partyId).toBeNull();
      expect(prisma.party.findFirst).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user lacks permissions', async () => {
      const input = {
        name: 'Gandalf',
        campaignId: 'campaign-1',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(ForbiddenException);
      expect(prisma.character.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if party not found', async () => {
      const input = {
        name: 'Gandalf',
        campaignId: 'campaign-1',
        partyId: 'nonexistent',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.character.create).not.toHaveBeenCalled();
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

    it('should update a character with valid data', async () => {
      const input = {
        name: 'Gandalf the Grey',
        level: 11,
      };

      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.character.update as jest.Mock).mockResolvedValue({
        ...mockCharacter,
        name: input.name,
        level: input.level,
      });

      const result = await service.update('character-1', input, mockUser, 1, mockBranchId);

      expect(result.name).toBe(input.name);
      expect(result.level).toBe(input.level);
      expect(audit.log).toHaveBeenCalledWith(
        'character',
        'character-1',
        'UPDATE',
        mockUser.id,
        expect.any(Object)
      );
    });

    it('should throw NotFoundException if character not found', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }, mockUser, 1, mockBranchId)
      ).rejects.toThrow(NotFoundException);
      expect(prisma.character.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user lacks permissions', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('character-1', { name: 'Test' }, mockUser, 1, mockBranchId)
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.character.update).not.toHaveBeenCalled();
    });

    it('should validate party exists when updating partyId', async () => {
      const input = {
        partyId: 'new-party',
      };

      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.party.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('character-1', input, mockUser, 1, mockBranchId)).rejects.toThrow(
        NotFoundException
      );
      expect(prisma.character.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete a character without cascading', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.character.update as jest.Mock).mockResolvedValue({
        ...mockCharacter,
        deletedAt: expect.any(Date),
      });

      const result = await service.delete('character-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(prisma.character.update).toHaveBeenCalledWith({
        where: { id: 'character-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('character', 'character-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if character not found', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.character.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user lacks permissions', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('character-1', mockUser)).rejects.toThrow(ForbiddenException);
      expect(prisma.character.update).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('should archive a character', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.character.update as jest.Mock).mockResolvedValue({
        ...mockCharacter,
        archivedAt: expect.any(Date),
      });

      const result = await service.archive('character-1', mockUser);

      expect(result.archivedAt).toBeDefined();
      expect(prisma.character.update).toHaveBeenCalledWith({
        where: { id: 'character-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('character', 'character-1', 'ARCHIVE', mockUser.id, {
        archivedAt: expect.any(Date),
      });
    });

    it('should throw ForbiddenException if user lacks permissions', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.archive('character-1', mockUser)).rejects.toThrow(ForbiddenException);
      expect(prisma.character.update).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should restore an archived character', async () => {
      const archivedCharacter = {
        ...mockCharacter,
        archivedAt: new Date(),
      };

      (prisma.character.findFirst as jest.Mock).mockResolvedValue(archivedCharacter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.character.update as jest.Mock).mockResolvedValue({
        ...archivedCharacter,
        archivedAt: null,
      });

      const result = await service.restore('character-1', mockUser);

      expect(result.archivedAt).toBeNull();
      expect(prisma.character.update).toHaveBeenCalledWith({
        where: { id: 'character-1' },
        data: { archivedAt: null },
      });
      expect(audit.log).toHaveBeenCalledWith('character', 'character-1', 'RESTORE', mockUser.id, {
        archivedAt: null,
      });
    });

    it('should throw ForbiddenException if user lacks permissions', async () => {
      (prisma.character.findFirst as jest.Mock).mockResolvedValue(mockCharacter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.restore('character-1', mockUser)).rejects.toThrow(ForbiddenException);
      expect(prisma.character.update).not.toHaveBeenCalled();
    });
  });
});
