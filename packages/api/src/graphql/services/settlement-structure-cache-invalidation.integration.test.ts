/**
 * Settlement & Structure Cache Invalidation Integration Tests
 * Tests that updating Settlement/Structure entities properly invalidates the dependency graph cache
 */

import { Test, TestingModule } from '@nestjs/testing';
import type { Settlement, Structure, Branch, Kingdom, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { DependencyGraphBuilderService } from './dependency-graph-builder.service';
import { DependencyGraphService } from './dependency-graph.service';
import { SettlementService } from './settlement.service';
import { StructureService } from './structure.service';
import { VersionService } from './version.service';

// Type definitions for test mocks
type SettlementWithKingdom = Settlement & {
  kingdom: Pick<Kingdom, 'id' | 'campaignId'>;
};

type StructureWithRelations = Structure & {
  settlement: {
    id: string;
    kingdomId: string;
    kingdom: Pick<Kingdom, 'id' | 'campaignId'>;
  };
};

type MockBranch = Pick<
  Branch,
  | 'id'
  | 'campaignId'
  | 'name'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'
  | 'parentId'
  | 'description'
  | 'divergedAt'
  | 'isPinned'
  | 'color'
  | 'tags'
>;

describe('Settlement & Structure Cache Invalidation Integration Tests', () => {
  let settlementService: SettlementService;
  let structureService: StructureService;
  let dependencyGraphService: DependencyGraphService;
  let prismaService: PrismaService;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'owner',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        StructureService,
        DependencyGraphService,
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
          },
        },
        {
          provide: CampaignContextService,
          useValue: {
            invalidateContextForEntity: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConditionEvaluationService,
          useValue: {
            validateExpression: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
          },
        },
        {
          provide: RulesEngineClientService,
          useValue: {
            evaluateConditions: jest.fn(),
          },
        },
        {
          provide: DependencyGraphBuilderService,
          useValue: {
            buildGraphForCampaign: jest.fn(),
          },
        },
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
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
          provide: PrismaService,
          useValue: {
            settlement: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            structure: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            kingdom: {
              findUnique: jest.fn(),
            },
            campaign: {
              findFirst: jest.fn(),
            },
            branch: {
              findFirst: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prismaService)),
          },
        },
      ],
    }).compile();

    settlementService = module.get<SettlementService>(SettlementService);
    structureService = module.get<StructureService>(StructureService);
    dependencyGraphService = module.get<DependencyGraphService>(DependencyGraphService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Settlement Cache Invalidation', () => {
    it('should invalidate dependency graph cache when updating a settlement', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const kingdomId = 'kingdom-456';
      const settlementId = 'settlement-789';
      const branchId = 'main';

      const existingSettlement: Settlement = {
        id: settlementId,
        name: 'Riverside',
        level: 3,
        kingdomId,
        locationId: 'location-123',
        variables: { population: 5000 } as Prisma.JsonValue,
        variableSchemas: [] as Prisma.JsonValue,
        version: 0,
        deletedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedSettlement: Settlement = {
        ...existingSettlement,
        level: 4,
        version: 1,
      };

      const settlementWithKingdom: SettlementWithKingdom = {
        ...existingSettlement,
        kingdom: {
          id: kingdomId,
          campaignId,
        },
      };

      // Mock settlement lookup
      jest.spyOn(prismaService.settlement, 'findFirst').mockResolvedValue(existingSettlement);
      jest.spyOn(prismaService.settlement, 'findUnique').mockResolvedValue(settlementWithKingdom);
      jest.spyOn(prismaService.settlement, 'update').mockResolvedValue(updatedSettlement);

      // Mock branch lookup
      jest.spyOn(prismaService.branch, 'findFirst').mockResolvedValue({
        id: branchId,
        campaignId,
        name: 'main',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
      } satisfies MockBranch);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await settlementService.update(
        settlementId,
        { level: 4 },
        mockUser,
        0, // expectedVersion
        branchId
      );

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId, branchId);
    });

    it('should invalidate dependency graph cache when updating settlement variables', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const kingdomId = 'kingdom-456';
      const settlementId = 'settlement-789';
      const branchId = 'main';

      const existingSettlement: Settlement = {
        id: settlementId,
        name: 'Riverside',
        level: 3,
        kingdomId,
        locationId: 'location-123',
        variables: { population: 5000 } as Prisma.JsonValue,
        variableSchemas: [] as Prisma.JsonValue,
        version: 0,
        deletedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedSettlement: Settlement = {
        ...existingSettlement,
        variables: { population: 6000 } as Prisma.JsonValue,
        version: 1,
      };

      const settlementWithKingdom: SettlementWithKingdom = {
        ...existingSettlement,
        kingdom: {
          id: kingdomId,
          campaignId,
        },
      };

      // Mock settlement lookup
      jest.spyOn(prismaService.settlement, 'findFirst').mockResolvedValue(existingSettlement);
      jest.spyOn(prismaService.settlement, 'findUnique').mockResolvedValue(settlementWithKingdom);
      jest.spyOn(prismaService.settlement, 'update').mockResolvedValue(updatedSettlement);

      // Mock branch lookup
      jest.spyOn(prismaService.branch, 'findFirst').mockResolvedValue({
        id: branchId,
        campaignId,
        name: 'main',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
      } satisfies MockBranch);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await settlementService.update(
        settlementId,
        { variables: { population: 6000 } },
        mockUser,
        0, // expectedVersion
        branchId
      );

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId, branchId);
    });

    it('should invalidate dependency graph cache when setting settlement level', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const kingdomId = 'kingdom-456';
      const settlementId = 'settlement-789';

      const existingSettlement: Settlement = {
        id: settlementId,
        name: 'Riverside',
        level: 3,
        kingdomId,
        locationId: 'location-123',
        variables: {} as Prisma.JsonValue,
        variableSchemas: [] as Prisma.JsonValue,
        version: 0,
        deletedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedSettlement: Settlement = {
        ...existingSettlement,
        level: 5,
        version: 1,
      };

      const settlementWithKingdom: SettlementWithKingdom = {
        ...existingSettlement,
        kingdom: {
          id: kingdomId,
          campaignId,
        },
      };

      // Mock settlement lookup
      jest.spyOn(prismaService.settlement, 'findFirst').mockResolvedValue(existingSettlement);
      jest.spyOn(prismaService.settlement, 'findUnique').mockResolvedValue(settlementWithKingdom);
      jest.spyOn(prismaService.settlement, 'update').mockResolvedValue(updatedSettlement);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await settlementService.setLevel(settlementId, 5, mockUser);

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId);
    });
  });

  describe('Structure Cache Invalidation', () => {
    it('should invalidate dependency graph cache when updating a structure', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const kingdomId = 'kingdom-456';
      const settlementId = 'settlement-789';
      const structureId = 'structure-abc';
      const branchId = 'main';

      const existingStructure: Structure = {
        id: structureId,
        name: 'Temple of Light',
        type: 'temple',
        level: 2,
        settlementId,
        variables: { integrity: 100 } as Prisma.JsonValue,
        variableSchemas: [] as Prisma.JsonValue,
        version: 0,
        deletedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedStructure: Structure = {
        ...existingStructure,
        level: 3,
        version: 1,
      };

      const structureWithRelations: StructureWithRelations = {
        ...existingStructure,
        settlement: {
          id: settlementId,
          kingdomId,
          kingdom: {
            id: kingdomId,
            campaignId,
          },
        },
      };

      // Mock structure lookup
      jest.spyOn(prismaService.structure, 'findFirst').mockResolvedValue(existingStructure);
      jest.spyOn(prismaService.structure, 'findUnique').mockResolvedValue(structureWithRelations);
      jest.spyOn(prismaService.structure, 'update').mockResolvedValue(updatedStructure);

      // Mock branch lookup
      jest.spyOn(prismaService.branch, 'findFirst').mockResolvedValue({
        id: branchId,
        campaignId,
        name: 'main',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
      } satisfies MockBranch);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await structureService.update(
        structureId,
        { level: 3 },
        mockUser,
        0, // expectedVersion
        branchId
      );

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId, branchId);
    });

    it('should invalidate dependency graph cache when updating structure variables', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const kingdomId = 'kingdom-456';
      const settlementId = 'settlement-789';
      const structureId = 'structure-abc';
      const branchId = 'main';

      const existingStructure: Structure = {
        id: structureId,
        name: 'Temple of Light',
        type: 'temple',
        level: 2,
        settlementId,
        variables: { integrity: 100, operational: true } as Prisma.JsonValue,
        variableSchemas: [] as Prisma.JsonValue,
        version: 0,
        deletedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedStructure: Structure = {
        ...existingStructure,
        variables: { integrity: 80, operational: false } as Prisma.JsonValue,
        version: 1,
      };

      const structureWithRelations: StructureWithRelations = {
        ...existingStructure,
        settlement: {
          id: settlementId,
          kingdomId,
          kingdom: {
            id: kingdomId,
            campaignId,
          },
        },
      };

      // Mock structure lookup
      jest.spyOn(prismaService.structure, 'findFirst').mockResolvedValue(existingStructure);
      jest.spyOn(prismaService.structure, 'findUnique').mockResolvedValue(structureWithRelations);
      jest.spyOn(prismaService.structure, 'update').mockResolvedValue(updatedStructure);

      // Mock branch lookup
      jest.spyOn(prismaService.branch, 'findFirst').mockResolvedValue({
        id: branchId,
        campaignId,
        name: 'main',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
      } satisfies MockBranch);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await structureService.update(
        structureId,
        { variables: { integrity: 80, operational: false } },
        mockUser,
        0, // expectedVersion
        branchId
      );

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId, branchId);
    });

    it('should invalidate dependency graph cache when setting structure level', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const kingdomId = 'kingdom-456';
      const settlementId = 'settlement-789';
      const structureId = 'structure-abc';

      const existingStructure: Structure = {
        id: structureId,
        name: 'Temple of Light',
        type: 'temple',
        level: 2,
        settlementId,
        variables: {} as Prisma.JsonValue,
        variableSchemas: [] as Prisma.JsonValue,
        version: 0,
        deletedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedStructure: Structure = {
        ...existingStructure,
        level: 4,
        version: 1,
      };

      const structureWithRelations: StructureWithRelations = {
        ...existingStructure,
        settlement: {
          id: settlementId,
          kingdomId,
          kingdom: {
            id: kingdomId,
            campaignId,
          },
        },
      };

      // Mock structure lookup
      jest.spyOn(prismaService.structure, 'findFirst').mockResolvedValue(existingStructure);
      jest.spyOn(prismaService.structure, 'findUnique').mockResolvedValue(structureWithRelations);
      jest.spyOn(prismaService.structure, 'update').mockResolvedValue(updatedStructure);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await structureService.setLevel(structureId, 4, mockUser);

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId);
    });

    it('should invalidate dependency graph cache when changing structure type', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const kingdomId = 'kingdom-456';
      const settlementId = 'settlement-789';
      const structureId = 'structure-abc';
      const branchId = 'main';

      const existingStructure: Structure = {
        id: structureId,
        name: 'Old Barracks',
        type: 'barracks',
        level: 2,
        settlementId,
        variables: {} as Prisma.JsonValue,
        variableSchemas: [] as Prisma.JsonValue,
        version: 0,
        deletedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedStructure: Structure = {
        ...existingStructure,
        type: 'fortress',
        version: 1,
      };

      const structureWithRelations: StructureWithRelations = {
        ...existingStructure,
        settlement: {
          id: settlementId,
          kingdomId,
          kingdom: {
            id: kingdomId,
            campaignId,
          },
        },
      };

      // Mock structure lookup
      jest.spyOn(prismaService.structure, 'findFirst').mockResolvedValue(existingStructure);
      jest.spyOn(prismaService.structure, 'findUnique').mockResolvedValue(structureWithRelations);
      jest.spyOn(prismaService.structure, 'update').mockResolvedValue(updatedStructure);

      // Mock branch lookup
      jest.spyOn(prismaService.branch, 'findFirst').mockResolvedValue({
        id: branchId,
        campaignId,
        name: 'main',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
      } satisfies MockBranch);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await structureService.update(
        structureId,
        { type: 'fortress' },
        mockUser,
        0, // expectedVersion
        branchId
      );

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId, branchId);
    });
  });

  describe('Cache Invalidation Error Handling', () => {
    it('should not throw if dependency graph invalidation fails for settlement', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const kingdomId = 'kingdom-456';
      const settlementId = 'settlement-789';
      const branchId = 'main';

      const existingSettlement: Settlement = {
        id: settlementId,
        name: 'Riverside',
        level: 3,
        kingdomId,
        locationId: 'location-123',
        variables: {} as Prisma.JsonValue,
        variableSchemas: [] as Prisma.JsonValue,
        version: 0,
        deletedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedSettlement: Settlement = {
        ...existingSettlement,
        level: 4,
        version: 1,
      };

      const settlementWithKingdom: SettlementWithKingdom = {
        ...existingSettlement,
        kingdom: {
          id: kingdomId,
          campaignId,
        },
      };

      // Mock settlement lookup
      jest.spyOn(prismaService.settlement, 'findFirst').mockResolvedValue(existingSettlement);
      jest.spyOn(prismaService.settlement, 'findUnique').mockResolvedValue(settlementWithKingdom);
      jest.spyOn(prismaService.settlement, 'update').mockResolvedValue(updatedSettlement);

      // Mock branch lookup
      jest.spyOn(prismaService.branch, 'findFirst').mockResolvedValue({
        id: branchId,
        campaignId,
        name: 'main',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
      } satisfies MockBranch);

      // Make invalidateGraph throw an error
      jest.spyOn(dependencyGraphService, 'invalidateGraph').mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      // Act & Assert - should not throw
      await expect(
        settlementService.update(settlementId, { level: 4 }, mockUser, 0, branchId)
      ).resolves.toEqual(updatedSettlement);
    });

    it('should not throw if dependency graph invalidation fails for structure', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const kingdomId = 'kingdom-456';
      const settlementId = 'settlement-789';
      const structureId = 'structure-abc';
      const branchId = 'main';

      const existingStructure: Structure = {
        id: structureId,
        name: 'Temple of Light',
        type: 'temple',
        level: 2,
        settlementId,
        variables: {} as Prisma.JsonValue,
        variableSchemas: [] as Prisma.JsonValue,
        version: 0,
        deletedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedStructure: Structure = {
        ...existingStructure,
        level: 3,
        version: 1,
      };

      const structureWithRelations: StructureWithRelations = {
        ...existingStructure,
        settlement: {
          id: settlementId,
          kingdomId,
          kingdom: {
            id: kingdomId,
            campaignId,
          },
        },
      };

      // Mock structure lookup
      jest.spyOn(prismaService.structure, 'findFirst').mockResolvedValue(existingStructure);
      jest.spyOn(prismaService.structure, 'findUnique').mockResolvedValue(structureWithRelations);
      jest.spyOn(prismaService.structure, 'update').mockResolvedValue(updatedStructure);

      // Mock branch lookup
      jest.spyOn(prismaService.branch, 'findFirst').mockResolvedValue({
        id: branchId,
        campaignId,
        name: 'main',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        description: null,
        divergedAt: null,
        isPinned: false,
        color: null,
        tags: [],
      } satisfies MockBranch);

      // Make invalidateGraph throw an error
      jest.spyOn(dependencyGraphService, 'invalidateGraph').mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      // Act & Assert - should not throw
      await expect(
        structureService.update(structureId, { level: 3 }, mockUser, 0, branchId)
      ).resolves.toEqual(updatedStructure);
    });
  });
});
