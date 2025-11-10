/**
 * Structure Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CacheStatsService } from '../../common/cache/cache-stats.service';
import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import { REDIS_CACHE } from '../cache/redis-cache.provider';
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
  let cache: CacheService;

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

  const mockSettlement = {
    id: 'settlement-1',
    kingdomId: 'kingdom-1',
    name: 'Minas Tirith',
    kingdom: mockKingdom,
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
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            settlement: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            fieldCondition: {
              findMany: jest.fn(),
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
            invalidateGraph: jest.fn(),
          },
        },
        {
          provide: RulesEngineClientService,
          useValue: {
            isAvailable: jest.fn().mockResolvedValue(false),
            evaluateCondition: jest.fn(),
            evaluateConditions: jest.fn(),
            getEvaluationOrder: jest.fn(),
            validateDependencies: jest.fn(),
            invalidateCache: jest.fn(),
            getCacheStats: jest.fn(),
            getCircuitState: jest.fn(),
          },
        },
        {
          provide: REDIS_CACHE,
          useValue: {
            get: jest.fn(),
            setex: jest.fn(),
            del: jest.fn(),
            scan: jest.fn(),
            options: { keyPrefix: 'cache:' },
          },
        },
        CacheService,
        {
          provide: CacheStatsService,
          useValue: {
            recordHit: jest.fn(),
            recordMiss: jest.fn(),
            recordSet: jest.fn(),
            recordInvalidation: jest.fn(),
            recordCascadeInvalidation: jest.fn(),
            getStats: jest.fn(),
            resetStats: jest.fn(),
            getHitRateForType: jest.fn(),
            estimateTimeSaved: jest.fn(),
            getRedisMemoryInfo: jest.fn(),
            getKeyCountByType: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StructureService>(StructureService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
    cache = module.get<CacheService>(CacheService);

    // Spy on CacheService methods used by tests
    jest.spyOn(cache, 'get').mockResolvedValue(null);
    jest.spyOn(cache, 'set').mockResolvedValue(undefined);
    jest.spyOn(cache, 'del').mockResolvedValue(0);
    jest.spyOn(cache, 'delPattern').mockResolvedValue({ success: true, keysDeleted: 0 });
    jest
      .spyOn(cache, 'invalidateStructureCascade')
      .mockResolvedValue({ success: true, keysDeleted: 0 });
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
      (cache.get as jest.Mock).mockResolvedValue(null); // Cache miss
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);
      (prisma.structure.findMany as jest.Mock).mockResolvedValue([mockStructure]);

      const result = await service.findBySettlement('settlement-1', mockUser);

      expect(result).toEqual([mockStructure]);
    });

    it('should throw NotFoundException if settlement not found', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null); // Cache miss
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySettlement('nonexistent', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    describe('cache behavior', () => {
      it('should return cached data without querying database when cache hit occurs', async () => {
        (cache.get as jest.Mock).mockResolvedValue([mockStructure]);

        const result = await service.findBySettlement('settlement-1', mockUser);

        expect(result).toEqual([mockStructure]);
        expect(cache.get).toHaveBeenCalledWith('structures:settlement:settlement-1:main');
        expect(prisma.settlement.findFirst).not.toHaveBeenCalled();
        expect(prisma.structure.findMany).not.toHaveBeenCalled();
        expect(cache.set).not.toHaveBeenCalled();
      });

      it('should query database and store in cache when cache miss occurs', async () => {
        (cache.get as jest.Mock).mockResolvedValue(null);
        (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);
        (prisma.structure.findMany as jest.Mock).mockResolvedValue([mockStructure]);

        const result = await service.findBySettlement('settlement-1', mockUser);

        expect(result).toEqual([mockStructure]);
        expect(cache.get).toHaveBeenCalledWith('structures:settlement:settlement-1:main');
        expect(prisma.settlement.findFirst).toHaveBeenCalled();
        expect(prisma.structure.findMany).toHaveBeenCalledWith({
          where: { settlementId: 'settlement-1', deletedAt: null },
          orderBy: { name: 'asc' },
        });
        expect(cache.set).toHaveBeenCalledWith(
          'structures:settlement:settlement-1:main',
          [mockStructure],
          { ttl: 600 }
        );
      });
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

    it('should invalidate settlement structure list cache when creating a structure', async () => {
      const input = {
        name: 'Temple of Gondor',
        settlementId: 'settlement-1',
        type: 'temple',
        level: 2,
      };

      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);
      (prisma.structure.create as jest.Mock).mockResolvedValue(mockStructure);

      await service.create(input, mockUser);

      // Verify invalidateStructureCascade was called (which internally calls del for the structures list)
      expect(cache.invalidateStructureCascade).toHaveBeenCalledWith(
        mockStructure.id,
        'settlement-1',
        'main'
      );
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
      const prismaMock = prisma as unknown as Record<string, unknown>;
      prismaMock.branch = {
        findFirst: jest.fn(),
      };
      (prismaMock.structure as Record<string, unknown>).findUnique = jest.fn();
      prismaMock.$transaction = jest.fn((callback: (p: unknown) => unknown) => callback(prisma));
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
      const prismaMock = prisma as unknown as Record<string, unknown>;
      ((prismaMock.branch as Record<string, unknown>).findFirst as jest.Mock).mockResolvedValue(
        mockBranch
      );
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
      (prisma.structure.findUnique as jest.Mock).mockResolvedValue({
        ...mockStructure,
        settlement: mockSettlement,
      });
      (prisma.structure.update as jest.Mock).mockResolvedValue({
        ...mockStructure,
        deletedAt: new Date(),
      });

      const result = await service.delete('structure-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith(
        'structure',
        'structure-1',
        'DELETE',
        mockUser.id,
        { deletedAt: expect.any(Date) },
        {}, // metadata
        expect.any(Object), // previousState
        expect.any(Object) // newState
      );
    });

    it('should throw NotFoundException if structure not found', async () => {
      (prisma.structure.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should invalidate settlement structure list cache when deleting a structure', async () => {
      (prisma.structure.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockStructure)
        .mockResolvedValueOnce(mockStructure);
      (prisma.structure.findUnique as jest.Mock).mockResolvedValue({
        ...mockStructure,
        settlement: mockSettlement,
      });
      (prisma.structure.update as jest.Mock).mockResolvedValue({
        ...mockStructure,
        deletedAt: new Date(),
      });

      await service.delete('structure-1', mockUser);

      // Verify invalidateStructureCascade was called (which internally calls del for the structures list)
      expect(cache.invalidateStructureCascade).toHaveBeenCalledWith(
        'structure-1',
        'settlement-1',
        'main'
      );
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
      const prismaMock = prisma as unknown as Record<string, unknown>;
      (prismaMock.structure as Record<string, unknown>).findUnique = jest.fn();
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

  describe('Enhanced Audit Logging', () => {
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
      // Add additional mocks needed for update/delete
      const prismaMock = prisma as unknown as Record<string, unknown>;
      prismaMock.branch = {
        findFirst: jest.fn(),
      };
      (prismaMock.structure as Record<string, unknown>).findUnique = jest.fn();
      prismaMock.$transaction = jest.fn((callback: (p: unknown) => unknown) => callback(prisma));
    });

    it('should create audit with previousState and newState on UPDATE', async () => {
      const input = {
        name: 'Updated Temple',
        level: 5,
      };
      const expectedVersion = 1;
      const branchId = 'branch-1';

      const updatedStructure = {
        ...mockStructure,
        ...input,
        version: 2,
      };

      (prisma.structure.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockStructure) // findById
        .mockResolvedValueOnce(mockStructure); // hasPermission check
      (prisma.structure.findUnique as jest.Mock).mockResolvedValue(mockStructureWithSettlement);
      const prismaMock = prisma as unknown as Record<string, unknown>;
      ((prismaMock.branch as Record<string, unknown>).findFirst as jest.Mock).mockResolvedValue(
        mockBranch
      );
      (prisma.structure.update as jest.Mock).mockResolvedValue(updatedStructure);

      await service.update('structure-1', input, mockUser, expectedVersion, branchId);

      // Verify audit.log was called with 8 parameters
      expect(audit.log).toHaveBeenCalledTimes(1);
      const auditCall = (audit.log as jest.Mock).mock.calls[0];
      expect(auditCall).toHaveLength(8);

      // Verify basic parameters
      expect(auditCall[0]).toBe('structure'); // entityType
      expect(auditCall[1]).toBe('structure-1'); // entityId
      expect(auditCall[2]).toBe('UPDATE'); // action
      expect(auditCall[3]).toBe(mockUser.id); // userId
      // Note: changes includes version increment from the service
      expect(auditCall[4]).toMatchObject(input); // changes should include at least the input fields
      expect(auditCall[5]).toEqual({}); // metadata

      // Verify previousState contains original structure data
      const previousState = auditCall[6];
      expect(previousState).toBeDefined();
      expect(previousState).toBeInstanceOf(Object);
      expect(previousState.id).toBe(mockStructure.id);
      expect(previousState.name).toBe(mockStructure.name);
      expect(previousState.level).toBe(mockStructure.level);

      // Verify newState contains updated structure data
      const newState = auditCall[7];
      expect(newState).toBeDefined();
      expect(newState).toBeInstanceOf(Object);
      expect(newState.id).toBe(updatedStructure.id);
      expect(newState.name).toBe(input.name);
      expect(newState.level).toBe(input.level);
      expect(newState.version).toBe(2);
    });

    it('should create audit with previousState and newState on DELETE', async () => {
      const deletedAt = new Date('2024-01-01');
      const deletedStructure = {
        ...mockStructure,
        deletedAt,
      };

      (prisma.structure.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockStructure) // findById
        .mockResolvedValueOnce(mockStructure); // hasPermission check
      (prisma.structure.findUnique as jest.Mock).mockResolvedValue(mockStructureWithSettlement);
      (prisma.structure.update as jest.Mock).mockResolvedValue(deletedStructure);

      await service.delete('structure-1', mockUser);

      // Verify audit.log was called with 8 parameters
      expect(audit.log).toHaveBeenCalledTimes(1);
      const auditCall = (audit.log as jest.Mock).mock.calls[0];
      expect(auditCall).toHaveLength(8);

      // Verify basic parameters
      expect(auditCall[0]).toBe('structure'); // entityType
      expect(auditCall[1]).toBe('structure-1'); // entityId
      expect(auditCall[2]).toBe('DELETE'); // action
      expect(auditCall[3]).toBe(mockUser.id); // userId
      expect(auditCall[4]).toEqual({ deletedAt: expect.any(Date) }); // changes
      expect(auditCall[5]).toEqual({}); // metadata

      // Verify previousState contains original structure (deletedAt = null)
      const previousState = auditCall[6];
      expect(previousState).toBeDefined();
      expect(previousState).toBeInstanceOf(Object);
      expect(previousState.id).toBe(mockStructure.id);
      expect(previousState.deletedAt).toBeNull();

      // Verify newState contains deleted structure (deletedAt set)
      // Note: JSON.parse(JSON.stringify(Date)) converts Date to ISO string
      const newState = auditCall[7];
      expect(newState).toBeDefined();
      expect(newState).toBeInstanceOf(Object);
      expect(newState.id).toBe(deletedStructure.id);
      // Date gets serialized to ISO string by JSON.parse(JSON.stringify())
      expect(newState.deletedAt).toBe(deletedAt.toISOString());
    });
  });

  describe('getComputedFields', () => {
    describe('cache hit', () => {
      it('should return cached data without recomputing when cache hit occurs', async () => {
        // Arrange: Mock cached computed fields data
        const cachedComputedFields = {
          defensiveValue: 20,
          goldProduction: 100,
          maintenanceCost: 15,
        };

        // Mock cache.get to return cached data (cache hit)
        (cache.get as jest.Mock).mockResolvedValue(cachedComputedFields);

        // Act: Call getComputedFields
        const result = await service.getComputedFields(mockStructure, mockUser);

        // Assert: Should return cached data
        expect(result).toEqual(cachedComputedFields);

        // Assert: cache.get should be called with correct cache key
        const expectedCacheKey = `computed-fields:structure:${mockStructure.id}:main`;
        expect(cache.get).toHaveBeenCalledWith(expectedCacheKey);
        expect(cache.get).toHaveBeenCalledTimes(1);

        // Assert: Should NOT query database for field conditions (cache hit)
        expect(prisma.fieldCondition.findMany).not.toHaveBeenCalled();

        // Assert: Should NOT store to cache (already cached)
        expect(cache.set).not.toHaveBeenCalled();
      });
    });

    describe('cache miss', () => {
      it('should compute fields and store in cache when cache miss occurs', async () => {
        // Arrange: Mock cache miss (cache.get returns null)
        (cache.get as jest.Mock).mockResolvedValue(null);

        // Mock no field conditions (simplest case - empty computed fields)
        (prisma.fieldCondition.findMany as jest.Mock).mockResolvedValue([]);

        // Mock cache.set to resolve successfully
        (cache.set as jest.Mock).mockResolvedValue(undefined);

        // Act: Call getComputedFields
        const result = await service.getComputedFields(mockStructure, mockUser);

        // Assert: Should return empty object (no conditions)
        expect(result).toEqual({});

        // Assert: cache.get should be called with correct cache key
        const expectedCacheKey = `computed-fields:structure:${mockStructure.id}:main`;
        expect(cache.get).toHaveBeenCalledWith(expectedCacheKey);
        expect(cache.get).toHaveBeenCalledTimes(1);

        // Assert: Should query database for field conditions (cache miss)
        expect(prisma.fieldCondition.findMany).toHaveBeenCalledWith({
          where: {
            entityType: 'structure',
            entityId: mockStructure.id,
            isActive: true,
            deletedAt: null,
          },
          orderBy: {
            priority: 'desc',
          },
        });
        expect(prisma.fieldCondition.findMany).toHaveBeenCalledTimes(1);

        // Assert: Should store computed result to cache with correct TTL
        expect(cache.set).toHaveBeenCalledWith(expectedCacheKey, {}, { ttl: 300 });
        expect(cache.set).toHaveBeenCalledTimes(1);
      });
    });

    describe('cache invalidation', () => {
      it('should invalidate computed fields cache when structure is updated', async () => {
        // Arrange: Setup mocks for update operation
        const updateInput = {
          name: 'Updated Temple',
          level: 3,
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

        const updatedStructure = {
          ...mockStructure,
          ...updateInput,
          version: 2,
        };

        const branchId = 'branch-1';

        // Mock findById (permission check)
        (prisma.structure.findFirst as jest.Mock)
          .mockResolvedValueOnce(mockStructure)
          .mockResolvedValueOnce(mockStructure);

        // Mock findUnique (fetch with settlement for audit)
        (prisma.structure.findUnique as jest.Mock).mockResolvedValue(mockStructureWithSettlement);

        // Mock branch.findFirst
        const prismaMock = prisma as unknown as Record<string, unknown>;
        prismaMock.branch = {
          findFirst: jest.fn().mockResolvedValue(mockBranch),
        };

        // Mock $transaction
        prismaMock.$transaction = jest.fn((callback: (p: unknown) => unknown) => callback(prisma));

        // Mock update operation
        (prisma.structure.update as jest.Mock).mockResolvedValue(updatedStructure);

        // Mock cache.del to resolve successfully
        (cache.del as jest.Mock).mockResolvedValue(1);

        // Act: Call update method
        await service.update('structure-1', updateInput, mockUser, 1, branchId);

        // Assert: invalidateStructureCascade should be called (which invalidates computed fields, settlement, and list)
        expect(cache.invalidateStructureCascade).toHaveBeenCalledWith(
          'structure-1',
          'settlement-1',
          branchId
        );

        // Assert: Update operation should complete successfully
        expect(prisma.structure.update).toHaveBeenCalled();
      });
    });
  });

  describe('Cache Invalidation - Cascade', () => {
    describe('Structure update invalidates structure + parent settlement', () => {
      const updateInput = {
        name: 'Updated Structure Name',
      };

      const mockStructure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'temple',
        name: 'Old Structure',
        level: 2,
        version: 1,
        variables: {},
        variableSchemas: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        archivedAt: null,
      };

      const mockStructureWithSettlement = {
        ...mockStructure,
        settlement: {
          id: 'settlement-1',
          name: 'Test Settlement',
          kingdomId: 'kingdom-1',
          kingdom: {
            id: 'kingdom-1',
            name: 'Test Kingdom',
            campaignId: 'campaign-1',
          },
        },
      };

      const updatedStructure = {
        ...mockStructure,
        name: 'Updated Structure Name',
        version: 2,
      };

      const branchId = 'main';

      beforeEach(() => {
        // Setup Prisma mocks for update operation
        (prisma.structure.findFirst as jest.Mock)
          .mockResolvedValueOnce(mockStructure)
          .mockResolvedValueOnce(mockStructure);
        (prisma.structure.findUnique as jest.Mock).mockResolvedValue(mockStructureWithSettlement);
        (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 'main', name: 'main' });

        // Mock transaction
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const tx = {
            structure: {
              update: jest.fn().mockResolvedValue(updatedStructure),
            },
            version: {
              create: jest.fn().mockResolvedValue({ id: 'version-2', version: 2 }),
            },
          };
          return callback(tx);
        });
      });

      it('should call invalidateStructureCascade when structure is updated', async () => {
        // Mock cascade invalidation success
        (cache.invalidateStructureCascade as jest.Mock).mockResolvedValue({
          success: true,
          keysDeleted: 42,
        });

        // Act: Call update method
        const result = await service.update('structure-1', updateInput, mockUser, 1, branchId);

        // Assert: invalidateStructureCascade should be called with correct parameters
        expect(cache.invalidateStructureCascade).toHaveBeenCalledWith(
          'structure-1',
          'settlement-1',
          branchId
        );
        expect(cache.invalidateStructureCascade).toHaveBeenCalledTimes(1);

        // Assert: Update operation should complete successfully (returns updated structure)
        expect(result).toBeDefined();
        expect(result.name).toBe('Updated Structure Name');
      });

      it('should handle cascade invalidation failures gracefully on update', async () => {
        // Mock cascade invalidation failure (Redis connection error)
        (cache.invalidateStructureCascade as jest.Mock).mockResolvedValue({
          success: false,
          keysDeleted: 0,
          error: 'Redis connection error',
        });

        // Act: Call update method - should NOT throw despite cache failure
        const result = await service.update('structure-1', updateInput, mockUser, 1, branchId);

        // Assert: invalidateStructureCascade was called
        expect(cache.invalidateStructureCascade).toHaveBeenCalledWith(
          'structure-1',
          'settlement-1',
          branchId
        );

        // Assert: Update operation should complete successfully despite cache failure
        expect(result).toBeDefined();
        expect(result.name).toBe('Updated Structure Name');
      });

      it('should call invalidateStructureCascade when structure level is changed', async () => {
        const newLevel = 3;

        const structureAtNewLevel = {
          ...mockStructure,
          level: newLevel,
          version: 2,
        };

        // Setup Prisma mocks for setLevel operation
        (prisma.structure.findFirst as jest.Mock)
          .mockResolvedValueOnce(mockStructure)
          .mockResolvedValueOnce(mockStructure);
        (prisma.structure.update as jest.Mock).mockResolvedValue(structureAtNewLevel);
        (prisma.structure.findUnique as jest.Mock).mockResolvedValue(mockStructureWithSettlement);

        // Mock cascade invalidation success
        (cache.invalidateStructureCascade as jest.Mock).mockResolvedValue({
          success: true,
          keysDeleted: 42,
        });

        // Act: Call setLevel method
        await service.setLevel('structure-1', newLevel, mockUser);

        // Assert: invalidateStructureCascade should be called with correct parameters
        // Note: setLevel currently hardcodes branchId to 'main'
        expect(cache.invalidateStructureCascade).toHaveBeenCalledWith(
          'structure-1',
          'settlement-1',
          'main'
        );
        expect(cache.invalidateStructureCascade).toHaveBeenCalledTimes(1);

        // Assert: SetLevel operation should complete successfully
        expect(prisma.structure.update).toHaveBeenCalledWith({
          where: { id: 'structure-1' },
          data: { level: newLevel },
        });
      });

      it('should handle cascade invalidation failures gracefully on setLevel', async () => {
        const newLevel = 3;

        const structureAtNewLevel = {
          ...mockStructure,
          level: newLevel,
          version: 2,
        };

        // Setup Prisma mocks for setLevel operation
        (prisma.structure.findFirst as jest.Mock)
          .mockResolvedValueOnce(mockStructure)
          .mockResolvedValueOnce(mockStructure);
        (prisma.structure.update as jest.Mock).mockResolvedValue(structureAtNewLevel);
        (prisma.structure.findUnique as jest.Mock).mockResolvedValue(mockStructureWithSettlement);

        // Mock cascade invalidation failure (Redis connection error)
        (cache.invalidateStructureCascade as jest.Mock).mockResolvedValue({
          success: false,
          keysDeleted: 0,
          error: 'Redis connection error',
        });

        // Act: Call setLevel method - should NOT throw despite cache failure
        await service.setLevel('structure-1', newLevel, mockUser);

        // Assert: invalidateStructureCascade was called
        expect(cache.invalidateStructureCascade).toHaveBeenCalledWith(
          'structure-1',
          'settlement-1',
          'main'
        );

        // Assert: SetLevel operation should complete successfully despite cache failure
        expect(prisma.structure.update).toHaveBeenCalledWith({
          where: { id: 'structure-1' },
          data: { level: newLevel },
        });
      });
    });
  });
});
