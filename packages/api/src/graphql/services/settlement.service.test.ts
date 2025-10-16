/**
 * Settlement Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';

import { AuditService } from './audit.service';
import { SettlementService } from './settlement.service';

describe('SettlementService', () => {
  let service: SettlementService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'user',
  };

  const mockCampaign = {
    id: 'campaign-1',
    worldId: 'world-1',
    ownerId: 'user-1',
  };

  const mockKingdom = {
    id: 'kingdom-1',
    campaignId: 'campaign-1',
    name: 'Gondor',
    campaign: mockCampaign,
  };

  const mockLocation = {
    id: 'location-1',
    worldId: 'world-1',
    name: 'Minas Tirith',
    deletedAt: null,
  };

  const mockSettlement = {
    id: 'settlement-1',
    kingdomId: 'kingdom-1',
    locationId: 'location-1',
    name: 'Minas Tirith',
    level: 3,
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
        SettlementService,
        {
          provide: PrismaService,
          useValue: {
            settlement: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            kingdom: {
              findFirst: jest.fn(),
            },
            location: {
              findFirst: jest.fn(),
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

    service = module.get<SettlementService>(SettlementService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a settlement by ID when user has access', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

      const result = await service.findById('settlement-1', mockUser);

      expect(result).toEqual(mockSettlement);
    });

    it('should return null if settlement not found', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent', mockUser);

      expect(result).toBeNull();
    });
  });

  describe('findByKingdom', () => {
    it('should return settlements for a kingdom', async () => {
      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue(mockKingdom);
      (prisma.settlement.findMany as jest.Mock).mockResolvedValue([mockSettlement]);

      const result = await service.findByKingdom('kingdom-1', mockUser);

      expect(result).toEqual([mockSettlement]);
    });

    it('should throw NotFoundException if kingdom not found', async () => {
      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findByKingdom('nonexistent', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('create', () => {
    it('should create a settlement with valid data', async () => {
      const input = {
        name: 'Minas Tirith',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        level: 3,
      };

      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue(mockKingdom);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(mockLocation);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null); // no existing settlement
      (prisma.settlement.create as jest.Mock).mockResolvedValue(mockSettlement);

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockSettlement);
      expect(prisma.settlement.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          kingdomId: input.kingdomId,
          locationId: input.locationId,
          level: input.level,
          variables: {},
          variableSchemas: [],
        },
      });
      expect(audit.log).toHaveBeenCalledWith(
        'settlement',
        mockSettlement.id,
        'CREATE',
        mockUser.id,
        {
          name: mockSettlement.name,
          kingdomId: mockSettlement.kingdomId,
          locationId: mockSettlement.locationId,
          level: mockSettlement.level,
        }
      );
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      const input = {
        name: 'Test Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
      };

      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if location not found', async () => {
      const input = {
        name: 'Test Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'nonexistent',
      };

      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue(mockKingdom);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if location is already occupied', async () => {
      const input = {
        name: 'Test Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
      };

      (prisma.kingdom.findFirst as jest.Mock).mockResolvedValue(mockKingdom);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(mockLocation);
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement); // existing settlement

      await expect(service.create(input, mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update a settlement with valid data', async () => {
      const input = {
        name: 'Updated Minas Tirith',
        level: 5,
      };

      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlement) // findById
        .mockResolvedValueOnce(mockSettlement); // hasPermission check
      (prisma.settlement.update as jest.Mock).mockResolvedValue({
        ...mockSettlement,
        ...input,
      });

      const result = await service.update('settlement-1', input, mockUser);

      expect(result.name).toBe(input.name);
      expect(audit.log).toHaveBeenCalledWith('settlement', 'settlement-1', 'UPDATE', mockUser.id, {
        name: input.name,
        level: input.level,
      });
    });

    it('should throw NotFoundException if settlement not found', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' }, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('delete', () => {
    it('should soft delete a settlement', async () => {
      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlement) // findById
        .mockResolvedValueOnce(mockSettlement); // hasPermission check
      (prisma.settlement.update as jest.Mock).mockResolvedValue({
        ...mockSettlement,
        deletedAt: new Date(),
      });

      const result = await service.delete('settlement-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith('settlement', 'settlement-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
    });

    it('should cascade delete to structures', async () => {
      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlement)
        .mockResolvedValueOnce(mockSettlement);
      (prisma.settlement.update as jest.Mock).mockResolvedValue({
        ...mockSettlement,
        deletedAt: new Date(),
      });

      await service.delete('settlement-1', mockUser);

      expect(prisma.structure.updateMany).toHaveBeenCalledWith({
        where: { settlementId: 'settlement-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if settlement not found', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('should archive a settlement without cascading', async () => {
      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlement)
        .mockResolvedValueOnce(mockSettlement);
      (prisma.settlement.update as jest.Mock).mockResolvedValue({
        ...mockSettlement,
        archivedAt: new Date(),
      });

      const result = await service.archive('settlement-1', mockUser);

      expect(result.archivedAt).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith('settlement', 'settlement-1', 'ARCHIVE', mockUser.id, {
        archivedAt: expect.any(Date),
      });
      // Should NOT cascade
      expect(prisma.structure.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should restore an archived settlement', async () => {
      const archivedSettlement = {
        ...mockSettlement,
        archivedAt: new Date(),
      };

      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(archivedSettlement)
        .mockResolvedValueOnce(archivedSettlement);
      (prisma.settlement.update as jest.Mock).mockResolvedValue({
        ...archivedSettlement,
        archivedAt: null,
      });

      const result = await service.restore('settlement-1', mockUser);

      expect(result.archivedAt).toBeNull();
      expect(audit.log).toHaveBeenCalledWith('settlement', 'settlement-1', 'RESTORE', mockUser.id, {
        archivedAt: null,
      });
    });
  });
});
