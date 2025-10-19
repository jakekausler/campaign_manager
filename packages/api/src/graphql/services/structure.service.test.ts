/**
 * Structure Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { DependencyGraphService } from './dependency-graph.service';
import { StructureService } from './structure.service';
import { VersionService } from './version.service';

describe('StructureService', () => {
  let service: StructureService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'user',
  };

  const mockSettlement = {
    id: 'settlement-1',
    kingdomId: 'kingdom-1',
    name: 'Minas Tirith',
  };

  const mockStructure = {
    id: 'structure-1',
    settlementId: 'settlement-1',
    type: 'temple',
    name: 'Temple of Gondor',
    level: 2,
    version: 1,
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
        StructureService,
        {
          provide: PrismaService,
          useValue: {
            structure: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            settlement: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
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
        {
          provide: ConditionEvaluationService,
          useValue: {
            buildContextWithVariables: jest.fn(),
            evaluateExpression: jest.fn(),
          },
        },
        {
          provide: DependencyGraphService,
          useValue: {
            invalidateCache: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StructureService>(StructureService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a structure by ID when user has access', async () => {
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(mockStructure);

      const result = await service.findById('structure-1', mockUser);

      expect(result).toEqual(mockStructure);
    });

    it('should return null if structure not found', async () => {
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent', mockUser);

      expect(result).toBeNull();
    });
  });

  describe('findBySettlement', () => {
    it('should return structures for a settlement', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);
      (prisma.structure.findMany as jest.Mock).mockResolvedValue([mockStructure]);

      const result = await service.findBySettlement('settlement-1', mockUser);

      expect(result).toEqual([mockStructure]);
    });

    it('should throw NotFoundException if settlement not found', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySettlement('nonexistent', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findBySettlementIds', () => {
    it('should return structures grouped by settlement IDs', async () => {
      const settlementIds = ['settlement-1', 'settlement-2'];

      (prisma.settlement.findMany as jest.Mock).mockResolvedValue([
        { id: 'settlement-1' },
        { id: 'settlement-2' },
      ]);
      (prisma.structure.findMany as jest.Mock).mockResolvedValue([
        { ...mockStructure, settlementId: 'settlement-1' },
        { ...mockStructure, id: 'structure-2', settlementId: 'settlement-2' },
      ]);

      const result = await service.findBySettlementIds(settlementIds, mockUser);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(1); // 1 structure for settlement-1
      expect(result[1]).toHaveLength(1); // 1 structure for settlement-2
    });

    it('should return empty arrays for inaccessible settlements', async () => {
      const settlementIds = ['settlement-1', 'settlement-2'];

      (prisma.settlement.findMany as jest.Mock).mockResolvedValue([{ id: 'settlement-1' }]); // Only settlement-1 accessible
      (prisma.structure.findMany as jest.Mock).mockResolvedValue([
        { ...mockStructure, settlementId: 'settlement-1' },
      ]);

      const result = await service.findBySettlementIds(settlementIds, mockUser);

      expect(result[0]).toHaveLength(1); // settlement-1 has structures
      expect(result[1]).toHaveLength(0); // settlement-2 inaccessible
    });
  });

  describe('create', () => {
    it('should create a structure with valid data', async () => {
      const input = {
        name: 'Temple of Gondor',
        settlementId: 'settlement-1',
        type: 'temple',
        level: 2,
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);
      (prisma.structure.create as jest.Mock).mockResolvedValue(mockStructure);

      const result = await service.create(input, mockUser);

      expect(result).toEqual(mockStructure);
      expect(prisma.structure.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          settlementId: input.settlementId,
          type: input.type,
          level: input.level,
          variables: {},
          variableSchemas: [],
        },
      });
      expect(audit.log).toHaveBeenCalledWith('structure', mockStructure.id, 'CREATE', mockUser.id, {
        name: mockStructure.name,
        settlementId: mockStructure.settlementId,
        type: mockStructure.type,
        level: mockStructure.level,
      });
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      const input = {
        name: 'Test Structure',
        settlementId: 'settlement-1',
        type: 'temple',
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input, mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
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

    const mockSettlementWithKingdom = {
      ...mockSettlement,
      kingdom: mockKingdom,
    };

    const mockStructureWithSettlement = {
      ...mockStructure,
      settlement: mockSettlementWithKingdom,
    };

    const mockBranch = {
      id: 'branch-1',
      campaignId: 'campaign-1',
      deletedAt: null,
    };

    beforeEach(() => {
      // Add additional mocks needed for update
      (prisma as any).branch = {
        findFirst: jest.fn(),
      };
      (prisma as any).structure.findUnique = jest.fn();
      (prisma as any).$transaction = jest.fn((callback) => callback(prisma));
    });

    it('should update a structure with valid data', async () => {
      const input = {
        name: 'Updated Temple',
        level: 3,
      };
      const expectedVersion = 1;
      const branchId = 'branch-1';

      (prisma.structure.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockStructure) // findById
        .mockResolvedValueOnce(mockStructure); // hasPermission check
      (prisma.structure.findUnique as jest.Mock).mockResolvedValue(mockStructureWithSettlement);
      ((prisma as any).branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.structure.update as jest.Mock).mockResolvedValue({
        ...mockStructure,
        ...input,
        version: 2,
      });

      const result = await service.update(
        'structure-1',
        input,
        mockUser,
        expectedVersion,
        branchId
      );

      expect(result.name).toBe(input.name);
      expect(result.version).toBe(2);
    });

    it('should throw NotFoundException if structure not found', async () => {
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }, mockUser, 1, 'branch-1')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft delete a structure', async () => {
      (prisma.structure.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockStructure) // findById
        .mockResolvedValueOnce(mockStructure); // hasPermission check
      (prisma.structure.update as jest.Mock).mockResolvedValue({
        ...mockStructure,
        deletedAt: new Date(),
      });

      const result = await service.delete('structure-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith('structure', 'structure-1', 'DELETE', mockUser.id, {
        deletedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if structure not found', async () => {
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('should archive a structure', async () => {
      (prisma.structure.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockStructure)
        .mockResolvedValueOnce(mockStructure);
      (prisma.structure.update as jest.Mock).mockResolvedValue({
        ...mockStructure,
        archivedAt: new Date(),
      });

      const result = await service.archive('structure-1', mockUser);

      expect(result.archivedAt).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith('structure', 'structure-1', 'ARCHIVE', mockUser.id, {
        archivedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException if structure not found', async () => {
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.archive('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('restore', () => {
    it('should restore an archived structure', async () => {
      const archivedStructure = {
        ...mockStructure,
        archivedAt: new Date(),
      };

      (prisma.structure.findFirst as jest.Mock)
        .mockResolvedValueOnce(archivedStructure)
        .mockResolvedValueOnce(archivedStructure);
      (prisma.structure.update as jest.Mock).mockResolvedValue({
        ...archivedStructure,
        archivedAt: null,
      });

      const result = await service.restore('structure-1', mockUser);

      expect(result.archivedAt).toBeNull();
      expect(audit.log).toHaveBeenCalledWith('structure', 'structure-1', 'RESTORE', mockUser.id, {
        archivedAt: null,
      });
    });

    it('should throw NotFoundException if structure not found', async () => {
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.restore('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('setLevel', () => {
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

    const mockSettlementWithKingdom = {
      ...mockSettlement,
      kingdom: mockKingdom,
    };

    const mockStructureWithRelations = {
      ...mockStructure,
      settlement: mockSettlementWithKingdom,
    };

    beforeEach(() => {
      // Add findUnique mock needed by setLevel for context invalidation
      (prisma as any).structure.findUnique = jest.fn();
    });

    it('should set structure level', async () => {
      const newLevel = 4;
      (prisma.structure.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockStructure) // findById
        .mockResolvedValueOnce(mockStructure); // hasPermission check
      (prisma.structure.findUnique as jest.Mock).mockResolvedValue(mockStructureWithRelations);
      (prisma.structure.update as jest.Mock).mockResolvedValue({
        ...mockStructure,
        level: newLevel,
      });

      const result = await service.setLevel('structure-1', newLevel, mockUser);

      expect(result.level).toBe(newLevel);
      expect(prisma.structure.update).toHaveBeenCalledWith({
        where: { id: 'structure-1' },
        data: { level: newLevel },
      });
      expect(audit.log).toHaveBeenCalledWith('structure', 'structure-1', 'UPDATE', mockUser.id, {
        level: newLevel,
      });
    });

    it('should throw NotFoundException if structure not found', async () => {
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.setLevel('nonexistent', 4, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      (prisma.structure.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockStructure) // findById
        .mockResolvedValueOnce(null); // hasPermission check fails

      await expect(service.setLevel('structure-1', 4, mockUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });
});
