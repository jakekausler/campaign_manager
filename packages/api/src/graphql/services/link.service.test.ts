/**
 * Link Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { AuditService } from './audit.service';
import { LinkService } from './link.service';

describe('LinkService', () => {
  let service: LinkService;
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

  const mockEncounter = {
    id: 'encounter-1',
    campaignId: 'campaign-1',
    name: 'Goblin Ambush',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockEvent = {
    id: 'event-1',
    campaignId: 'campaign-1',
    name: 'Festival',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockLink = {
    id: 'link-1',
    sourceType: 'encounter',
    sourceId: 'encounter-1',
    targetType: 'event',
    targetId: 'event-1',
    linkType: 'triggers',
    description: 'Completing encounter triggers event',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkService,
        {
          provide: PrismaService,
          useValue: {
            campaign: {
              findFirst: jest.fn(),
            },
            encounter: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            event: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            link: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
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

    service = module.get<LinkService>(LinkService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a link by ID when user has access', async () => {
      (prisma.link.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const result = await service.findById('link-1', mockUser);

      expect(result).toEqual(mockLink);
      expect(prisma.link.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'link-1',
          deletedAt: null,
        },
      });
    });

    it('should return null if link not found', async () => {
      (prisma.link.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent', mockUser);

      expect(result).toBeNull();
    });

    it('should throw ForbiddenException if user does not have campaign access', async () => {
      const otherUserCampaign = { ...mockCampaign, ownerId: 'other-user', memberships: [] };

      (prisma.link.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(otherUserCampaign);

      await expect(service.findById('link-1', mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByEntity', () => {
    it('should return all links for an encounter (as source or target)', async () => {
      const links = [
        mockLink,
        {
          ...mockLink,
          id: 'link-2',
          sourceType: 'event',
          sourceId: 'event-2',
          targetType: 'encounter',
          targetId: 'encounter-1',
        },
      ];

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.link.findMany as jest.Mock).mockResolvedValue(links);

      const result = await service.findByEntity('encounter', 'encounter-1', mockUser);

      expect(result).toEqual(links);
      expect(prisma.link.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { sourceType: 'encounter', sourceId: 'encounter-1' },
            { targetType: 'encounter', targetId: 'encounter-1' },
          ],
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return all links for an event (as source or target)', async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.link.findMany as jest.Mock).mockResolvedValue([mockLink]);

      await service.findByEntity('event', 'event-1', mockUser);

      expect(prisma.link.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { sourceType: 'event', sourceId: 'event-1' },
            { targetType: 'event', targetId: 'event-1' },
          ],
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should throw NotFoundException if entity not found', async () => {
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findByEntity('encounter', 'nonexistent', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    it('should create a link between encounter and event', async () => {
      const input = {
        sourceType: 'encounter',
        sourceId: 'encounter-1',
        targetType: 'event',
        targetId: 'event-1',
        linkType: 'triggers',
        description: 'Completing encounter triggers event',
      };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.link.findFirst as jest.Mock).mockResolvedValue(null); // No existing link
      (prisma.link.create as jest.Mock).mockResolvedValue(mockLink);

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockLink);
      expect(prisma.link.create).toHaveBeenCalledWith({
        data: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          targetType: input.targetType,
          targetId: input.targetId,
          linkType: input.linkType,
          description: input.description,
        },
      });
      expect(audit.log).toHaveBeenCalledWith('link', mockLink.id, 'CREATE', mockUser.id, {
        sourceType: mockLink.sourceType,
        sourceId: mockLink.sourceId,
        targetType: mockLink.targetType,
        targetId: mockLink.targetId,
        linkType: mockLink.linkType,
        description: mockLink.description,
      });
    });

    it('should create a link without description', async () => {
      const input = {
        sourceType: 'event',
        sourceId: 'event-1',
        targetType: 'event',
        targetId: 'event-2',
        linkType: 'prerequisite',
      };

      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.link.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.link.create as jest.Mock).mockResolvedValue({
        ...mockLink,
        description: null,
      });

      await service.create(input, mockUser);

      expect(prisma.link.create).toHaveBeenCalledWith({
        data: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          targetType: input.targetType,
          targetId: input.targetId,
          linkType: input.linkType,
          description: null,
        },
      });
    });

    it('should throw NotFoundException if source entity not found', async () => {
      const input = {
        sourceType: 'encounter',
        sourceId: 'nonexistent',
        targetType: 'event',
        targetId: 'event-1',
        linkType: 'triggers',
      };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.link.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if target entity not found', async () => {
      const input = {
        sourceType: 'encounter',
        sourceId: 'encounter-1',
        targetType: 'event',
        targetId: 'nonexistent',
        linkType: 'triggers',
      };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.link.create).not.toHaveBeenCalled();
    });

    it('should throw error if entities belong to different campaigns', async () => {
      const input = {
        sourceType: 'encounter',
        sourceId: 'encounter-1',
        targetType: 'event',
        targetId: 'event-1',
        linkType: 'triggers',
      };

      const differentCampaignEvent = { ...mockEvent, campaignId: 'campaign-2' };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(differentCampaignEvent);
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(differentCampaignEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      await expect(service.create(input, mockUser)).rejects.toThrow(
        'Cannot link entities from different campaigns'
      );
      expect(prisma.link.create).not.toHaveBeenCalled();
    });

    it('should throw error if duplicate link exists', async () => {
      const input = {
        sourceType: 'encounter',
        sourceId: 'encounter-1',
        targetType: 'event',
        targetId: 'event-1',
        linkType: 'triggers',
      };

      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.encounter.findUnique as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.link.findFirst as jest.Mock).mockResolvedValue(mockLink); // Existing link

      await expect(service.create(input, mockUser)).rejects.toThrow(
        'A link with this type already exists between these entities'
      );
      expect(prisma.link.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a link with valid data', async () => {
      const input = {
        linkType: 'blocks',
        description: 'Updated description',
      };

      (prisma.link.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.link.update as jest.Mock).mockResolvedValue({
        ...mockLink,
        ...input,
      });

      const result = await service.update('link-1', input, mockUser);

      expect(result.linkType).toBe(input.linkType);
      expect(prisma.link.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: input,
      });
      expect(audit.log).toHaveBeenCalledWith('link', 'link-1', 'UPDATE', mockUser.id, input);
    });

    it('should throw NotFoundException if link not found', async () => {
      (prisma.link.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { linkType: 'related' }, mockUser)
      ).rejects.toThrow(NotFoundException);
      expect(prisma.link.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete a link', async () => {
      (prisma.link.findFirst as jest.Mock).mockResolvedValue(mockLink);
      (prisma.encounter.findFirst as jest.Mock).mockResolvedValue(mockEncounter);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.link.update as jest.Mock).mockResolvedValue({
        ...mockLink,
        deletedAt: expect.any(Date),
      });

      const result = await service.delete('link-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(prisma.link.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.log).toHaveBeenCalledWith('link', 'link-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if link not found', async () => {
      (prisma.link.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
      expect(prisma.link.update).not.toHaveBeenCalled();
    });
  });
});
