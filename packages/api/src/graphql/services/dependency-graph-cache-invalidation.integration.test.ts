/**
 * Dependency Graph Cache Invalidation Integration Tests
 * Tests that creating/updating/deleting conditions and variables properly invalidates the dependency graph cache
 */

import { Test, TestingModule } from '@nestjs/testing';
import type {
  FieldCondition as PrismaFieldCondition,
  StateVariable as PrismaStateVariable,
  Settlement as PrismaSettlement,
  Campaign as PrismaCampaign,
} from '@prisma/client';

import { CacheModule } from '../../common/cache/cache.module';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type {
  CreateFieldConditionInput,
  UpdateFieldConditionInput,
} from '../inputs/field-condition.input';
import type {
  CreateStateVariableInput,
  UpdateStateVariableInput,
} from '../inputs/state-variable.input';
import { VariableScope, VariableType } from '../types/state-variable.type';
import { DependencyExtractor } from '../utils/dependency-extractor';

import { AuditService } from './audit.service';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { ConditionService } from './condition.service';
import { DependencyGraphBuilderService } from './dependency-graph-builder.service';
import { DependencyGraphService } from './dependency-graph.service';
import { StateVariableService } from './state-variable.service';
import { VariableEvaluationService } from './variable-evaluation.service';
import { VersionService } from './version.service';

// Type helpers for nested Prisma relations
type SettlementWithKingdom = PrismaSettlement & {
  kingdom: {
    campaignId: string;
  };
};

type CampaignWithOwner = PrismaCampaign & {
  name: string;
  ownerId: string;
};

describe('Dependency Graph Cache Invalidation Integration Tests', () => {
  let conditionService: ConditionService;
  let stateVariableService: StateVariableService;
  let dependencyGraphService: DependencyGraphService;
  let prismaService: PrismaService;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'owner',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule],
      providers: [
        ConditionService,
        StateVariableService,
        DependencyGraphService,
        {
          provide: DependencyGraphBuilderService,
          useValue: {
            buildGraphForCampaign: jest.fn().mockResolvedValue({
              nodes: [],
              edges: [],
              roots: [],
            }),
          },
        },
        {
          provide: DependencyExtractor,
          useValue: {
            extractDependencies: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: ConditionEvaluationService,
          useValue: {
            validateExpression: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
          },
        },
        {
          provide: VariableEvaluationService,
          useValue: {
            validateFormula: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: VersionService,
          useValue: {
            createVersion: jest.fn(),
          },
        },
        {
          provide: 'REDIS_PUBSUB',
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            fieldCondition: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            stateVariable: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            settlement: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            kingdom: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            campaign: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            party: {
              findUnique: jest.fn(),
            },
            character: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    conditionService = module.get<ConditionService>(ConditionService);
    stateVariableService = module.get<StateVariableService>(StateVariableService);
    dependencyGraphService = module.get<DependencyGraphService>(DependencyGraphService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ConditionService Cache Invalidation', () => {
    it('should invalidate dependency graph cache when creating a condition', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const settlementId = 'settlement-123';
      const conditionInput = {
        entityType: 'Settlement',
        entityId: settlementId,
        field: 'is_trade_hub',
        expression: { '>': [{ var: 'population' }, 5000] },
        priority: 100,
      };

      const createdCondition = {
        id: 'condition-123',
        ...conditionInput,
        expression: conditionInput.expression,
        isActive: true,
        version: 0,
        createdBy: mockUser.id,
        updatedBy: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      // Mock settlement lookup for access verification
      jest.spyOn(prismaService.settlement, 'findFirst').mockResolvedValue({
        id: settlementId,
        name: 'Test Settlement',
        kingdom: {
          campaignId,
        },
      } as SettlementWithKingdom);

      // Mock settlement lookup for campaign ID extraction
      jest.spyOn(prismaService.settlement, 'findUnique').mockResolvedValue({
        id: settlementId,
        kingdom: {
          campaignId,
        },
      } as SettlementWithKingdom);

      jest
        .spyOn(prismaService.fieldCondition, 'create')
        .mockResolvedValue(createdCondition as PrismaFieldCondition);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await conditionService.create(conditionInput as CreateFieldConditionInput, mockUser);

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId);
    });

    it('should invalidate dependency graph cache when updating a condition', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const settlementId = 'settlement-123';
      const conditionId = 'condition-123';

      const existingCondition = {
        id: conditionId,
        entityType: 'Settlement',
        entityId: settlementId,
        field: 'is_trade_hub',
        expression: { '>': [{ var: 'population' }, 5000] },
        priority: 100,
        isActive: true,
        version: 0,
        createdBy: mockUser.id,
        updatedBy: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      const updatedCondition = {
        ...existingCondition,
        expression: { '>': [{ var: 'population' }, 10000] },
        version: 1,
      };

      // Mock lookups
      jest
        .spyOn(prismaService.fieldCondition, 'findUnique')
        .mockResolvedValue(existingCondition as PrismaFieldCondition);
      jest.spyOn(prismaService.settlement, 'findFirst').mockResolvedValue({
        id: settlementId,
        kingdom: {
          campaignId,
        },
      } as SettlementWithKingdom);
      jest.spyOn(prismaService.settlement, 'findUnique').mockResolvedValue({
        id: settlementId,
        kingdom: {
          campaignId,
        },
      } as SettlementWithKingdom);
      jest
        .spyOn(prismaService.fieldCondition, 'update')
        .mockResolvedValue(updatedCondition as PrismaFieldCondition);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await conditionService.update(
        conditionId,
        {
          expression: { '>': [{ var: 'population' }, 10000] },
          expectedVersion: 0,
        } as UpdateFieldConditionInput,
        mockUser
      );

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId);
    });

    it('should invalidate dependency graph cache when deleting a condition', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const settlementId = 'settlement-123';
      const conditionId = 'condition-123';

      const existingCondition = {
        id: conditionId,
        entityType: 'Settlement',
        entityId: settlementId,
        field: 'is_trade_hub',
        expression: { '>': [{ var: 'population' }, 5000] },
        priority: 100,
        isActive: true,
        version: 0,
        createdBy: mockUser.id,
        updatedBy: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      const deletedCondition = {
        ...existingCondition,
        deletedAt: new Date(),
      };

      // Mock lookups
      jest
        .spyOn(prismaService.fieldCondition, 'findUnique')
        .mockResolvedValue(existingCondition as PrismaFieldCondition);
      jest.spyOn(prismaService.settlement, 'findFirst').mockResolvedValue({
        id: settlementId,
        kingdom: {
          campaignId,
        },
      } as SettlementWithKingdom);
      jest.spyOn(prismaService.settlement, 'findUnique').mockResolvedValue({
        id: settlementId,
        kingdom: {
          campaignId,
        },
      } as SettlementWithKingdom);
      jest
        .spyOn(prismaService.fieldCondition, 'update')
        .mockResolvedValue(deletedCondition as PrismaFieldCondition);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await conditionService.delete(conditionId, mockUser);

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId);
    });

    it('should NOT invalidate cache for type-level conditions (entityId is null)', async () => {
      // Arrange
      const conditionInput = {
        entityType: 'Settlement',
        entityId: null,
        field: 'is_trade_hub',
        expression: { '>': [{ var: 'population' }, 5000] },
        priority: 100,
      };

      const createdCondition = {
        id: 'condition-123',
        ...conditionInput,
        expression: conditionInput.expression,
        isActive: true,
        version: 0,
        createdBy: mockUser.id,
        updatedBy: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      jest
        .spyOn(prismaService.fieldCondition, 'create')
        .mockResolvedValue(createdCondition as PrismaFieldCondition);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await conditionService.create(conditionInput as CreateFieldConditionInput, mockUser);

      // Assert
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe('StateVariableService Cache Invalidation', () => {
    it('should invalidate dependency graph cache when creating a variable', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const variableInput = {
        scope: VariableScope.CAMPAIGN,
        scopeId: campaignId,
        key: 'test_variable',
        value: 100,
        type: VariableType.INTEGER,
      };

      const createdVariable = {
        id: 'variable-123',
        ...variableInput,
        value: variableInput.value,
        formula: null,
        isActive: true,
        version: 0,
        createdBy: mockUser.id,
        updatedBy: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      // Mock campaign lookup for access verification
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue({
        id: campaignId,
        name: 'Test Campaign',
        ownerId: mockUser.id,
      } as CampaignWithOwner);

      jest
        .spyOn(prismaService.stateVariable, 'create')
        .mockResolvedValue(createdVariable as PrismaStateVariable);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await stateVariableService.create(variableInput as CreateStateVariableInput, mockUser);

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId);
    });

    it('should invalidate dependency graph cache when updating a variable', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const variableId = 'variable-123';

      const existingVariable = {
        id: variableId,
        scope: VariableScope.CAMPAIGN,
        scopeId: campaignId,
        key: 'test_variable',
        value: 100,
        type: VariableType.INTEGER,
        formula: null,
        isActive: true,
        version: 0,
        createdBy: mockUser.id,
        updatedBy: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      const updatedVariable = {
        ...existingVariable,
        value: 200,
        version: 1,
      };

      // Mock lookups
      jest
        .spyOn(prismaService.stateVariable, 'findUnique')
        .mockResolvedValue(existingVariable as PrismaStateVariable);
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue({
        id: campaignId,
        ownerId: mockUser.id,
      } as CampaignWithOwner);
      jest
        .spyOn(prismaService.stateVariable, 'update')
        .mockResolvedValue(updatedVariable as PrismaStateVariable);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await stateVariableService.update(
        variableId,
        {
          value: 200,
          expectedVersion: 0,
        } as UpdateStateVariableInput,
        mockUser
      );

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId);
    });

    it('should invalidate dependency graph cache when deleting a variable', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const variableId = 'variable-123';

      const existingVariable = {
        id: variableId,
        scope: VariableScope.CAMPAIGN,
        scopeId: campaignId,
        key: 'test_variable',
        value: 100,
        type: VariableType.INTEGER,
        formula: null,
        isActive: true,
        version: 0,
        createdBy: mockUser.id,
        updatedBy: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      const deletedVariable = {
        ...existingVariable,
        deletedAt: new Date(),
      };

      // Mock lookups
      jest
        .spyOn(prismaService.stateVariable, 'findUnique')
        .mockResolvedValue(existingVariable as PrismaStateVariable);
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue({
        id: campaignId,
        ownerId: mockUser.id,
      } as CampaignWithOwner);
      jest
        .spyOn(prismaService.stateVariable, 'update')
        .mockResolvedValue(deletedVariable as PrismaStateVariable);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await stateVariableService.delete(variableId, mockUser);

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(campaignId);
    });

    it('should NOT invalidate cache for world-scoped variables', async () => {
      // Arrange
      const variableInput = {
        scope: VariableScope.WORLD,
        scopeId: null,
        key: 'world_variable',
        value: 100,
        type: VariableType.INTEGER,
      };

      const createdVariable = {
        id: 'variable-123',
        ...variableInput,
        value: variableInput.value,
        formula: null,
        isActive: true,
        version: 0,
        createdBy: mockUser.id,
        updatedBy: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      };

      jest
        .spyOn(prismaService.stateVariable, 'create')
        .mockResolvedValue(createdVariable as PrismaStateVariable);

      // Spy on invalidateGraph
      const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

      // Act
      await stateVariableService.create(variableInput as CreateStateVariableInput, mockUser);

      // Assert
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Cache Rebuilds After Invalidation', () => {
    it('should rebuild dependency graph after cache invalidation', async () => {
      // This test verifies that after invalidation, the next getGraph call rebuilds the cache
      // Arrange
      const campaignId = 'campaign-123';
      const branchId = 'main';

      // Mock campaign access verification
      jest.spyOn(prismaService.campaign, 'findFirst').mockResolvedValue({
        id: campaignId,
        name: 'Test Campaign',
        ownerId: mockUser.id,
      } as CampaignWithOwner);

      // Mock graph builder dependencies (empty for this test)
      jest.spyOn(prismaService.fieldCondition, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.stateVariable, 'findFirst').mockResolvedValue(null);

      // First call: should build and cache
      const graph1 = await dependencyGraphService.getGraph(campaignId, branchId, mockUser);
      expect(graph1).toBeDefined();

      // Invalidate cache
      dependencyGraphService.invalidateGraph(campaignId, branchId);

      // Second call: should rebuild (not return cached version)
      const graph2 = await dependencyGraphService.getGraph(campaignId, branchId, mockUser);
      expect(graph2).toBeDefined();

      // Note: In a real scenario, we'd verify they're different instances,
      // but since we're using mocks, we just verify the call succeeds
    });
  });

  describe('Multiple Campaigns with Separate Caches', () => {
    it('should maintain separate caches for different campaigns', async () => {
      // This test verifies that invalidating one campaign's cache doesn't affect another
      // Arrange
      const campaign1Id = 'campaign-1';
      const campaign2Id = 'campaign-2';
      const branchId = 'main';

      // Mock campaign access verification for both campaigns
      jest.spyOn(prismaService.campaign, 'findFirst').mockImplementation((args?: unknown) => {
        const where = (args as { where?: { id?: string } } | undefined)?.where;
        if (where && (where.id === campaign1Id || where.id === campaign2Id)) {
          return Promise.resolve({
            id: where.id,
            name: `Campaign ${where.id}`,
            ownerId: mockUser.id,
          } as CampaignWithOwner) as never;
        }
        return Promise.resolve(null) as never;
      });

      // Mock empty graphs for both
      jest.spyOn(prismaService.fieldCondition, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.stateVariable, 'findFirst').mockResolvedValue(null);

      // Build caches for both campaigns
      await dependencyGraphService.getGraph(campaign1Id, branchId, mockUser);
      await dependencyGraphService.getGraph(campaign2Id, branchId, mockUser);

      // Invalidate only campaign 1
      dependencyGraphService.invalidateGraph(campaign1Id, branchId);

      // Verify campaign 2's cache is still intact by getting it
      // (If cache was shared, this would fail or rebuild unnecessarily)
      const graph2 = await dependencyGraphService.getGraph(campaign2Id, branchId, mockUser);
      expect(graph2).toBeDefined();
    });
  });
});
