/**
 * Kingdom Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { AuditService } from './audit.service';
import { KingdomService } from './kingdom.service';

describe('KingdomService', () => {
  let service: KingdomService;
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

  const mockKingdom = {
    id: 'kingdom-1',
    campaignId: 'campaign-1',
    name: 'Gondor',
    level: 5,
    variables: { treasury: 10000 },
    variableSchemas: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KingdomService,
        {
          provide: PrismaService,
          useValue: {
            kingdom: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            campaign: {
              findFirst: jest.fn(),
            },
            settlement: {
              findMany: jest.fn(),
              update: jest.fn(),
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

    service = module.get<KingdomService>(KingdomService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a kingdom by ID when user has access', async () => {
      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue(mockKingdom);

      const result = await service.findById('kingdom-1', mockUser);

      expect(result).toEqual(mockKingdom);
    });

    it('should return null if kingdom not found', async () => {
      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent', mockUser);

      expect(result).toBeNull();
    });
  });

  describe('findByCampaign', () => {
    it('should return kingdoms for a campaign', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.kingdom.findMany as jest.Mock).mockResolvedValue([mockKingdom]);

      const result = await service.findByCampaign('campaign-1', mockUser);

      expect(result).toEqual([mockKingdom]);
    });

    it('should throw NotFoundException if campaign not found', async () => {
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findByCampaign('nonexistent', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    it('should create a kingdom with valid data', async () => {
      const input = {
        name: 'Gondor',
        campaignId: 'campaign-1',
        level: 5,
        variables: { treasury: 10000 },
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.kingdom.create as jest.Mock).mockResolvedValue(mockKingdom);

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockKingdom);
      expect(prisma.kingdom.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          campaignId: input.campaignId,
          level: input.level,
          variables: input.variables,
          variableSchemas: [],
        },
      });
      expect(audit.log).toHaveBeenCalledWith('kingdom', mockKingdom.id, 'CREATE', mockUser.id, {
        name: mockKingdom.name,
        campaignId: mockKingdom.campaignId,
        level: mockKingdom.level,
      });
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      const input = {
        name: 'Test Kingdom',
        campaignId: 'campaign-1',
      };

      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update a kingdom with valid data', async () => {
      const input = {
        name: 'Updated Gondor',
        level: 10,
      };

      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValueOnce(mockKingdom);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.kingdom.update as jest.Mock).mockResolvedValue({
        ...mockKingdom,
        ...input,
      });

      const result = await service.update('kingdom-1', input, mockUser);

      expect(result.name).toBe(input.name);
      expect(audit.log).toHaveBeenCalledWith('kingdom', 'kingdom-1', 'UPDATE', mockUser.id, {
        name: input.name,
        level: input.level,
      });
    });

    it('should throw NotFoundException if kingdom not found', async () => {
      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' }, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('delete', () => {
    it('should soft delete a kingdom', async () => {
      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValueOnce(mockKingdom);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.kingdom.update as jest.Mock).mockResolvedValue({
        ...mockKingdom,
        deletedAt: new Date(),
      });

      const result = await service.delete('kingdom-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith('kingdom', 'kingdom-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
    });

    it('should cascade delete to settlements and structures', async () => {
      const mockSettlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        name: 'Minas Tirith',
      };

      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValueOnce(mockKingdom);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.settlement.findMany as jest.Mock).mockResolvedValue([mockSettlement]);
      (prisma.settlement.update as jest.Mock).mockResolvedValue({
        ...mockSettlement,
        deletedAt: new Date(),
      });
      (prisma.kingdom.update as jest.Mock).mockResolvedValue({
        ...mockKingdom,
        deletedAt: new Date(),
      });

      await service.delete('kingdom-1', mockUser);

      expect(prisma.settlement.findMany).toHaveBeenCalledWith({
        where: { kingdomId: 'kingdom-1', deletedAt: null },
        select: { id: true },
      });
      expect(prisma.settlement.update).toHaveBeenCalledWith({
        where: { id: 'settlement-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.structure.updateMany).toHaveBeenCalledWith({
        where: { settlementId: 'settlement-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if kingdom not found', async () => {
      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('should archive a kingdom without cascading', async () => {
      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValueOnce(mockKingdom);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.kingdom.update as jest.Mock).mockResolvedValue({
        ...mockKingdom,
        archivedAt: new Date(),
      });

      const result = await service.archive('kingdom-1', mockUser);

      expect(result.archivedAt).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith('kingdom', 'kingdom-1', 'ARCHIVE', mockUser.id, {
        archivedAt: expect.any(Date),
      });
      // Should NOT cascade
      expect(prisma.settlement.findMany).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should restore an archived kingdom', async () => {
      const archivedKingdom = {
        ...mockKingdom,
        archivedAt: new Date(),
      };

      (prisma.kingdom.findFirst as jest.Mock)
        .mockResolvedValueOnce(archivedKingdom)
        .mockResolvedValueOnce(archivedKingdom);
      (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.kingdom.update as jest.Mock).mockResolvedValue({
        ...archivedKingdom,
        archivedAt: null,
      });

      const result = await service.restore('kingdom-1', mockUser);

      expect(result.archivedAt).toBeNull();
      expect(audit.log).toHaveBeenCalledWith('kingdom', 'kingdom-1', 'RESTORE', mockUser.id, {
        archivedAt: null,
      });
    });
  });
});
