/**
 * Settlement Service Tests
 */

import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { DependencyGraphService } from './dependency-graph.service';
import { SettlementService } from './settlement.service';
import { VersionService } from './version.service';

describe('SettlementService', () => {
  let service: SettlementService;
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
        SettlementService,
        {
          provide: PrismaService,
          useValue: {
            settlement: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
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
            fieldCondition: {
              findMany: jest.fn(),
            },
            branch: {
              findFirst: jest.fn(),
            },
            $transaction: jest.fn((callback) =>
              callback({
                settlement: { update: jest.fn() },
                version: { create: jest.fn() },
              })
            ),
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
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delPattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
    cache = module.get<CacheService>(CacheService);
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
    const mockBranch = {
      id: 'branch-1',
      campaignId: 'campaign-1',
      deletedAt: null,
    };

    const mockSettlementWithVersion = {
      ...mockSettlement,
      version: 1,
    };

    const mockSettlementWithKingdom = {
      ...mockSettlementWithVersion,
      kingdom: mockKingdom,
    };

    beforeEach(() => {
      // Add branch mock to the prisma mock object
      const prismaMock = prisma as unknown as Record<string, unknown>;
      prismaMock.branch = {
        findFirst: jest.fn(),
      };
      (prismaMock.settlement as Record<string, unknown>).findUnique = jest.fn();
      prismaMock.$transaction = jest.fn((callback: (p: unknown) => unknown) => callback(prisma));
    });

    it('should update a settlement with valid data', async () => {
      const input = {
        name: 'Updated Minas Tirith',
        level: 5,
      };
      const expectedVersion = 1;
      const branchId = 'branch-1';

      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlementWithVersion) // findById
        .mockResolvedValueOnce(mockSettlementWithVersion); // hasPermission check
      (prisma.settlement.findUnique as jest.Mock).mockResolvedValue(mockSettlementWithKingdom);
      const prismaMock = prisma as unknown as Record<string, unknown>;
      ((prismaMock.branch as Record<string, unknown>).findFirst as jest.Mock).mockResolvedValue(
        mockBranch
      );
      (prisma.settlement.update as jest.Mock).mockResolvedValue({
        ...mockSettlementWithVersion,
        ...input,
        version: 2,
      });

      const result = await service.update(
        'settlement-1',
        input,
        mockUser,
        expectedVersion,
        branchId
      );

      expect(result.name).toBe(input.name);
      expect(result.version).toBe(2);
    });

    it('should throw NotFoundException if settlement not found', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }, mockUser, 1, 'branch-1')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft delete a settlement', async () => {
      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlement) // findById
        .mockResolvedValueOnce(mockSettlement); // hasPermission check
      (prisma.settlement.findUnique as jest.Mock).mockResolvedValue({
        ...mockSettlement,
        kingdom: mockKingdom,
      });
      (prisma.settlement.update as jest.Mock).mockResolvedValue({
        ...mockSettlement,
        deletedAt: new Date(),
      });

      const result = await service.delete('settlement-1', mockUser);

      expect(result.deletedAt).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith(
        'settlement',
        'settlement-1',
        'DELETE',
        mockUser.id,
        { deletedAt: expect.any(Date) },
        {}, // metadata
        expect.any(Object), // previousState
        expect.any(Object) // newState
      );
    });

    it('should cascade delete to structures', async () => {
      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlement)
        .mockResolvedValueOnce(mockSettlement);
      (prisma.settlement.findUnique as jest.Mock).mockResolvedValue({
        ...mockSettlement,
        kingdom: mockKingdom,
      });
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

  describe('setLevel', () => {
    const mockSettlementWithKingdom = {
      ...mockSettlement,
      kingdom: mockKingdom,
    };

    beforeEach(() => {
      // Add findUnique mock needed by setLevel for context invalidation
      const prismaMock = prisma as unknown as Record<string, unknown>;
      (prismaMock.settlement as Record<string, unknown>).findUnique = jest.fn();
    });

    it('should set settlement level', async () => {
      const newLevel = 5;
      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlement) // findById
        .mockResolvedValueOnce(mockSettlement); // hasPermission check
      (prisma.settlement.findUnique as jest.Mock).mockResolvedValue(mockSettlementWithKingdom);
      (prisma.settlement.update as jest.Mock).mockResolvedValue({
        ...mockSettlement,
        level: newLevel,
      });

      const result = await service.setLevel('settlement-1', newLevel, mockUser);

      expect(result.level).toBe(newLevel);
      expect(prisma.settlement.update).toHaveBeenCalledWith({
        where: { id: 'settlement-1' },
        data: { level: newLevel },
      });
      expect(audit.log).toHaveBeenCalledWith('settlement', 'settlement-1', 'UPDATE', mockUser.id, {
        level: newLevel,
      });
    });

    it('should throw NotFoundException if settlement not found', async () => {
      (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.setLevel('nonexistent', 5, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlement) // findById
        .mockResolvedValueOnce(null); // hasPermission check fails

      await expect(service.setLevel('settlement-1', 5, mockUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('Enhanced Audit Logging', () => {
    const mockSettlementWithKingdom = {
      ...mockSettlement,
      kingdom: mockKingdom,
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
      (prismaMock.settlement as Record<string, unknown>).findUnique = jest.fn();
      prismaMock.$transaction = jest.fn((callback: (p: unknown) => unknown) => callback(prisma));
    });

    it('should create audit with previousState and newState on UPDATE', async () => {
      const input = {
        name: 'Updated Settlement',
        level: 4,
      };
      const expectedVersion = 1;
      const branchId = 'branch-1';

      const updatedSettlement = {
        ...mockSettlement,
        ...input,
        version: 2,
      };

      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlement) // findById
        .mockResolvedValueOnce(mockSettlement); // hasPermission check
      (prisma.settlement.findUnique as jest.Mock).mockResolvedValue(mockSettlementWithKingdom);
      const prismaMock = prisma as unknown as Record<string, unknown>;
      ((prismaMock.branch as Record<string, unknown>).findFirst as jest.Mock).mockResolvedValue(
        mockBranch
      );
      (prisma.settlement.update as jest.Mock).mockResolvedValue(updatedSettlement);

      await service.update('settlement-1', input, mockUser, expectedVersion, branchId);

      // Verify audit.log was called with 8 parameters
      expect(audit.log).toHaveBeenCalledTimes(1);
      const auditCall = (audit.log as jest.Mock).mock.calls[0];
      expect(auditCall).toHaveLength(8);

      // Verify basic parameters
      expect(auditCall[0]).toBe('settlement'); // entityType
      expect(auditCall[1]).toBe('settlement-1'); // entityId
      expect(auditCall[2]).toBe('UPDATE'); // action
      expect(auditCall[3]).toBe(mockUser.id); // userId
      // Note: changes includes version increment from the service
      expect(auditCall[4]).toMatchObject(input); // changes should include at least the input fields
      expect(auditCall[5]).toEqual({}); // metadata

      // Verify previousState contains original settlement data
      const previousState = auditCall[6];
      expect(previousState).toBeDefined();
      expect(previousState).toBeInstanceOf(Object);
      expect(previousState.id).toBe(mockSettlement.id);
      expect(previousState.name).toBe(mockSettlement.name);
      expect(previousState.level).toBe(mockSettlement.level);

      // Verify newState contains updated settlement data
      const newState = auditCall[7];
      expect(newState).toBeDefined();
      expect(newState).toBeInstanceOf(Object);
      expect(newState.id).toBe(updatedSettlement.id);
      expect(newState.name).toBe(input.name);
      expect(newState.level).toBe(input.level);
      expect(newState.version).toBe(2);
    });

    it('should create audit with previousState and newState on DELETE', async () => {
      const deletedAt = new Date('2024-01-01');
      const deletedSettlement = {
        ...mockSettlement,
        deletedAt,
      };

      (prisma.settlement.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockSettlement) // findById
        .mockResolvedValueOnce(mockSettlement); // hasPermission check
      (prisma.settlement.findUnique as jest.Mock).mockResolvedValue(mockSettlementWithKingdom);
      (prisma.settlement.update as jest.Mock).mockResolvedValue(deletedSettlement);

      await service.delete('settlement-1', mockUser);

      // Verify audit.log was called with 8 parameters
      expect(audit.log).toHaveBeenCalledTimes(1);
      const auditCall = (audit.log as jest.Mock).mock.calls[0];
      expect(auditCall).toHaveLength(8);

      // Verify basic parameters
      expect(auditCall[0]).toBe('settlement'); // entityType
      expect(auditCall[1]).toBe('settlement-1'); // entityId
      expect(auditCall[2]).toBe('DELETE'); // action
      expect(auditCall[3]).toBe(mockUser.id); // userId
      expect(auditCall[4]).toEqual({ deletedAt: expect.any(Date) }); // changes
      expect(auditCall[5]).toEqual({}); // metadata

      // Verify previousState contains original settlement (deletedAt = null)
      const previousState = auditCall[6];
      expect(previousState).toBeDefined();
      expect(previousState).toBeInstanceOf(Object);
      expect(previousState.id).toBe(mockSettlement.id);
      expect(previousState.deletedAt).toBeNull();

      // Verify newState contains deleted settlement (deletedAt set)
      // Note: JSON.parse(JSON.stringify(Date)) converts Date to ISO string
      const newState = auditCall[7];
      expect(newState).toBeDefined();
      expect(newState).toBeInstanceOf(Object);
      expect(newState.id).toBe(deletedSettlement.id);
      // Date gets serialized to ISO string by JSON.parse(JSON.stringify())
      expect(newState.deletedAt).toBe(deletedAt.toISOString());
    });
  });

  describe('getComputedFields', () => {
    describe('cache hit', () => {
      it('should return cached data without recomputing when cache hit occurs', async () => {
        // Arrange: Mock cached computed fields data
        const cachedComputedFields = {
          population: 15000,
          defensiveBonus: 5,
          taxRate: 0.15,
        };

        // Mock cache.get to return cached data (cache hit)
        (cache.get as jest.Mock).mockResolvedValue(cachedComputedFields);

        // Act: Call getComputedFields
        const result = await service.getComputedFields(mockSettlement, mockUser);

        // Assert: Should return cached data
        expect(result).toEqual(cachedComputedFields);

        // Assert: cache.get should be called with correct cache key
        const expectedCacheKey = `computed-fields:settlement:${mockSettlement.id}:main`;
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
        const result = await service.getComputedFields(mockSettlement, mockUser);

        // Assert: Should return empty object (no conditions)
        expect(result).toEqual({});

        // Assert: cache.get should be called with correct cache key
        const expectedCacheKey = `computed-fields:settlement:${mockSettlement.id}:main`;
        expect(cache.get).toHaveBeenCalledWith(expectedCacheKey);
        expect(cache.get).toHaveBeenCalledTimes(1);

        // Assert: Should query database for field conditions (cache miss)
        expect(prisma.fieldCondition.findMany).toHaveBeenCalledWith({
          where: {
            entityType: 'settlement',
            entityId: mockSettlement.id,
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
      it('should invalidate computed fields cache when settlement is updated', async () => {
        // Arrange: Setup mocks for update operation
        const updateInput = {
          name: 'Updated Minas Tirith',
          level: 4,
        };

        const mockSettlementWithKingdom = {
          ...mockSettlement,
          kingdom: mockKingdom,
        };

        const updatedSettlement = {
          ...mockSettlement,
          ...updateInput,
          version: 2,
        };

        // Mock findById (permission check)
        (prisma.settlement.findFirst as jest.Mock).mockResolvedValue(mockSettlement);

        // Mock findUnique (fetch with kingdom for audit)
        (prisma.settlement.findUnique as jest.Mock).mockResolvedValue(mockSettlementWithKingdom);

        // Mock branch.findFirst (branch validation)
        (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 'main', name: 'main' });

        // Mock $transaction to execute callback and return updated settlement
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
          const tx = {
            settlement: {
              update: jest.fn().mockResolvedValue(updatedSettlement),
            },
            version: {
              create: jest.fn().mockResolvedValue({ id: 'version-2', version: 2 }),
            },
          };
          return callback(tx);
        });

        // Mock cache.del to resolve successfully
        (cache.del as jest.Mock).mockResolvedValue(1);

        // Act: Call update method
        await service.update('settlement-1', updateInput, mockUser, 1, 'main');

        // Assert: cache.del should be called with correct cache key
        const expectedCacheKey = `computed-fields:settlement:${mockSettlement.id}:main`;
        expect(cache.del).toHaveBeenCalledWith(expectedCacheKey);
        expect(cache.del).toHaveBeenCalledTimes(1);

        // Assert: Transaction should be called
        expect(prisma.$transaction).toHaveBeenCalled();
      });
    });
  });
});
