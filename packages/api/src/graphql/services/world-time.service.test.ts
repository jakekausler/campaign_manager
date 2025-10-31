/**
 * WorldTimeService Tests
 */

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Campaign } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';

import { CampaignContextService } from './campaign-context.service';
import { WorldTimeService } from './world-time.service';

describe('WorldTimeService', () => {
  let service: WorldTimeService;
  let prisma: PrismaService;
  let campaignContextService: CampaignContextService;

  const mockUser = { id: 'user-1', email: 'test@example.com', role: 'GM' };
  const mockCampaign: Campaign = {
    id: 'campaign-1',
    name: 'Test Campaign',
    worldId: 'world-1',
    ownerId: 'user-1',
    settings: {},
    isActive: true,
    currentWorldTime: new Date('2024-01-01T12:00:00Z'),
    srid: 3857,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorldTimeService,
        {
          provide: PrismaService,
          useValue: {
            campaign: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
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
        {
          provide: CampaignContextService,
          useValue: {
            invalidateContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorldTimeService>(WorldTimeService);
    prisma = module.get<PrismaService>(PrismaService);
    campaignContextService = module.get<CampaignContextService>(CampaignContextService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentWorldTime', () => {
    it('should return current world time for a campaign', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      const result = await service.getCurrentWorldTime('campaign-1', mockUser);

      expect(result).toEqual(mockCampaign.currentWorldTime);
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
        select: {
          currentWorldTime: true,
        },
      });
    });

    it('should return null if campaign has no current world time', async () => {
      const campaignWithoutTime = { ...mockCampaign, currentWorldTime: null };
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(campaignWithoutTime);

      const result = await service.getCurrentWorldTime('campaign-1', mockUser);

      expect(result).toBeNull();
    });

    it('should throw NotFoundException if campaign does not exist', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getCurrentWorldTime('campaign-1', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException if user does not have access', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getCurrentWorldTime('campaign-1', mockUser)).rejects.toThrow(
        new NotFoundException('Campaign with ID campaign-1 not found or access denied')
      );
    });
  });

  describe('advanceWorldTime', () => {
    it('should advance world time successfully', async () => {
      const newTime = new Date('2024-01-02T12:00:00Z');
      const updatedCampaign = { ...mockCampaign, currentWorldTime: newTime, version: 2 };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          campaign: {
            update: jest.fn().mockResolvedValue(updatedCampaign),
          },
          audit: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.advanceWorldTime('campaign-1', newTime, mockUser.id, 1);

      expect(result.campaignId).toBe('campaign-1');
      expect(result.previousWorldTime).toEqual(mockCampaign.currentWorldTime);
      expect(result.currentWorldTime).toEqual(newTime);
      expect(result.affectedEntities).toBe(0);
      expect(result.message).toContain('advanced');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(campaignContextService.invalidateContext).toHaveBeenCalledWith('campaign-1');
    });

    it('should advance world time for first time (null current time)', async () => {
      const newTime = new Date('2024-01-01T12:00:00Z');
      const campaignWithoutTime = { ...mockCampaign, currentWorldTime: null };
      const updatedCampaign = { ...campaignWithoutTime, currentWorldTime: newTime, version: 2 };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(campaignWithoutTime);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          campaign: {
            update: jest.fn().mockResolvedValue(updatedCampaign),
          },
          audit: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.advanceWorldTime('campaign-1', newTime, mockUser.id, 1);

      expect(result.previousWorldTime).toBeUndefined();
      expect(result.currentWorldTime).toEqual(newTime);
      expect(result.message).toContain('set');
    });

    it('should throw NotFoundException if campaign does not exist', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.advanceWorldTime('campaign-1', new Date(), mockUser.id, 1)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not have access', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.advanceWorldTime('campaign-1', new Date(), mockUser.id, 1)
      ).rejects.toThrow(
        new NotFoundException('Campaign with ID campaign-1 not found or access denied')
      );
    });

    it('should throw BadRequestException if new time is before current time', async () => {
      const pastTime = new Date('2023-12-31T12:00:00Z');

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      await expect(
        service.advanceWorldTime('campaign-1', pastTime, mockUser.id, 1)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.advanceWorldTime('campaign-1', pastTime, mockUser.id, 1)
      ).rejects.toThrow(
        'Cannot advance time to the past. New time must be after current world time'
      );
    });

    it('should throw BadRequestException if new time equals current time', async () => {
      const sameTime = new Date('2024-01-01T12:00:00Z');

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

      await expect(
        service.advanceWorldTime('campaign-1', sameTime, mockUser.id, 1)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.advanceWorldTime('campaign-1', sameTime, mockUser.id, 1)
      ).rejects.toThrow(
        'Cannot advance time to the past. New time must be after current world time'
      );
    });

    it('should not invalidate cache if invalidateCache is false', async () => {
      const newTime = new Date('2024-01-02T12:00:00Z');
      const updatedCampaign = { ...mockCampaign, currentWorldTime: newTime, version: 2 };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          campaign: {
            update: jest.fn().mockResolvedValue(updatedCampaign),
          },
          audit: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      await service.advanceWorldTime('campaign-1', newTime, mockUser.id, 1, undefined, false);

      expect(campaignContextService.invalidateContext).not.toHaveBeenCalled();
    });

    it('should invalidate cache by default', async () => {
      const newTime = new Date('2024-01-02T12:00:00Z');
      const updatedCampaign = { ...mockCampaign, currentWorldTime: newTime, version: 2 };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          campaign: {
            update: jest.fn().mockResolvedValue(updatedCampaign),
          },
          audit: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.advanceWorldTime('campaign-1', newTime, mockUser.id, 1);

      expect(campaignContextService.invalidateContext).toHaveBeenCalledWith('campaign-1');
      expect(result).toBeDefined();
    });

    it('should throw OptimisticLockException if version mismatch', async () => {
      const newTime = new Date('2024-01-02T12:00:00Z');
      const campaignWithDifferentVersion = { ...mockCampaign, version: 2 };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(campaignWithDifferentVersion);

      await expect(service.advanceWorldTime('campaign-1', newTime, mockUser.id, 1)).rejects.toThrow(
        'Campaign was modified by another user. Expected version 1, but found 2. Please refresh and try again.'
      );
    });
  });

  describe('validateTimeAdvancement', () => {
    it('should validate when current time is null (first time set)', () => {
      const newTime = new Date('2024-01-01T12:00:00Z');

      expect(() => service['validateTimeAdvancement'](null, newTime)).not.toThrow();
    });

    it('should validate when new time is after current time', () => {
      const currentTime = new Date('2024-01-01T12:00:00Z');
      const newTime = new Date('2024-01-02T12:00:00Z');

      expect(() => service['validateTimeAdvancement'](currentTime, newTime)).not.toThrow();
    });

    it('should throw BadRequestException when new time is before current time', () => {
      const currentTime = new Date('2024-01-02T12:00:00Z');
      const newTime = new Date('2024-01-01T12:00:00Z');

      expect(() => service['validateTimeAdvancement'](currentTime, newTime)).toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when new time equals current time', () => {
      const currentTime = new Date('2024-01-01T12:00:00Z');
      const newTime = new Date('2024-01-01T12:00:00Z');

      expect(() => service['validateTimeAdvancement'](currentTime, newTime)).toThrow(
        BadRequestException
      );
    });
  });
});
