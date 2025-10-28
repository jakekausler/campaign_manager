/**
 * Settlement & Structure Rules Integration - End-to-End Validation Tests
 *
 * This test suite validates the complete lifecycle of Settlement and Structure rules:
 * 1. Rule creation with validation
 * 2. Condition evaluation with context
 * 3. Effect execution
 * 4. Dependency tracking
 * 5. Cache invalidation
 * 6. Circular dependency detection
 *
 * Tests cover both success paths and validation failures.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';
import { OperatorRegistry } from '../../rules/operator-registry';
import { SettlementOperatorsService } from '../../rules/operators/settlement-operators.service';
import { StructureOperatorsService } from '../../rules/operators/structure-operators.service';
import { RulesModule } from '../../rules/rules.module';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { ConditionService } from './condition.service';
import { DependencyGraphBuilderService } from './dependency-graph-builder.service';
import { DependencyGraphService } from './dependency-graph.service';
import { EffectExecutionService } from './effect-execution.service';
import { EffectPatchService } from './effect-patch.service';
import { SettlementContextBuilderService } from './settlement-context-builder.service';
import { SettlementService } from './settlement.service';
import { StructureContextBuilderService } from './structure-context-builder.service';
import { StructureService } from './structure.service';
import { VariableEvaluationService } from './variable-evaluation.service';
import { VersionService } from './version.service';

describe('Settlement & Structure Rules - E2E Validation Tests', () => {
  let prisma: PrismaClient;
  let conditionService: ConditionService;
  let settlementService: SettlementService;
  let structureService: StructureService;
  let effectExecution: EffectExecutionService;
  let dependencyGraph: DependencyGraphService;

  // mockUser will use testUserId after it's created in beforeEach
  let mockUser: { id: string; email: string; role: string };

  // Test data IDs
  let testUserId: string;
  let worldId: string;
  let campaignId: string;
  let kingdomId: string;
  let settlementId: string;
  let structure1Id: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const mockPubSub = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const mockRulesEngineClient = {
      evaluateCondition: jest.fn().mockResolvedValue({ result: true }),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    };

    const mockRedisCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const mockCampaignContext = {
      buildContext: jest.fn().mockResolvedValue({}),
      invalidateContextForEntity: jest.fn().mockResolvedValue(undefined),
    };

    const mockSettlementContext = {
      buildContext: jest.fn().mockResolvedValue({
        id: 'settlement-1',
        name: 'Test Settlement',
        level: 5,
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        variables: { population: 8500, prosperity: 'thriving', defenseRating: 7 },
        structures: { count: 2, byType: { temple: 1, market: 1 }, averageLevel: 4 },
      }),
    };

    const mockStructureContext = {
      buildContext: jest.fn().mockResolvedValue({
        id: 'structure-1',
        name: 'Test Structure',
        type: 'temple',
        level: 5,
        settlementId: 'settlement-1',
        variables: { integrity: 95, capacity: 500 },
        operational: true,
      }),
    };

    const mockVersionService = {
      createVersion: jest.fn().mockResolvedValue(undefined),
      resolveVersion: jest.fn().mockResolvedValue(null),
      decompressVersion: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [RulesModule],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: 'REDIS_PUBSUB', useValue: mockPubSub },
        { provide: 'REDIS_CACHE', useValue: mockRedisCache },
        { provide: RulesEngineClientService, useValue: mockRulesEngineClient },
        { provide: CampaignContextService, useValue: mockCampaignContext },
        { provide: SettlementContextBuilderService, useValue: mockSettlementContext },
        { provide: StructureContextBuilderService, useValue: mockStructureContext },
        { provide: VersionService, useValue: mockVersionService },
        AuditService,
        ConditionService,
        ConditionEvaluationService,
        VariableEvaluationService,
        SettlementService,
        StructureService,
        EffectExecutionService,
        EffectPatchService,
        DependencyGraphService,
        DependencyGraphBuilderService,
        SettlementOperatorsService,
        StructureOperatorsService,
      ],
    }).compile();

    conditionService = module.get<ConditionService>(ConditionService);
    settlementService = module.get<SettlementService>(SettlementService);
    structureService = module.get<StructureService>(StructureService);
    effectExecution = module.get<EffectExecutionService>(EffectExecutionService);
    dependencyGraph = module.get<DependencyGraphService>(DependencyGraphService);

    // Get the OperatorRegistry from RulesModule (shared instance)
    const operatorRegistry = module.get<OperatorRegistry>(OperatorRegistry);

    // Manually register Settlement operators
    const settlementOperators = new SettlementOperatorsService(
      operatorRegistry,
      mockSettlementContext as Partial<SettlementContextBuilderService> as SettlementContextBuilderService
    );
    await settlementOperators.onModuleInit();

    // Manually register Structure operators
    const structureOperators = new StructureOperatorsService(
      operatorRegistry,
      mockStructureContext as Partial<StructureContextBuilderService> as StructureContextBuilderService
    );
    await structureOperators.onModuleInit();
  });

  beforeEach(async () => {
    // Create test user first (required for foreign key constraints)
    const user = await prisma.user.create({
      data: {
        name: 'Test User E2E',
        email: 'test-e2e@example.com',
        password: 'test-hash',
      },
    });
    testUserId = user.id;

    // Set mockUser with the created user ID
    mockUser = { id: testUserId, email: 'test-e2e@example.com', role: 'gm' };

    // Create test world
    const world = await prisma.world.create({
      data: {
        name: 'Test World - E2E Validation',
        calendars: [] as Prisma.InputJsonValue,
      },
    });
    worldId = world.id;

    // Create test campaign with settlement and structures
    const campaign = await prisma.campaign.create({
      data: {
        name: 'Test Campaign - E2E Validation',
        worldId: worldId,
        ownerId: testUserId,
      },
    });
    campaignId = campaign.id;

    const kingdom = await prisma.kingdom.create({
      data: {
        name: 'Test Kingdom',
        campaignId,
        level: 5,
      },
    });
    kingdomId = kingdom.id;

    // Create location for settlement
    const settlementLocation = await prisma.location.create({
      data: {
        name: 'Riverside Location',
        worldId,
        type: 'point',
      },
    });

    const settlement = await prisma.settlement.create({
      data: {
        name: 'Riverside',
        kingdomId,
        locationId: settlementLocation.id,
        level: 5,
        variables: {
          population: 8500,
          prosperity: 'thriving',
          defenseRating: 7,
        } as Prisma.InputJsonValue,
      },
    });
    settlementId = settlement.id;

    const structure1 = await prisma.structure.create({
      data: {
        name: 'Grand Temple',
        type: 'temple',
        level: 5,
        settlementId,
        variables: {
          integrity: 95,
          capacity: 500,
        } as Prisma.InputJsonValue,
      },
    });
    structure1Id = structure1.id;

    await prisma.structure.create({
      data: {
        name: 'Market Square',
        type: 'market',
        level: 3,
        settlementId,
        variables: {
          integrity: 85,
          dailyRevenue: 150,
        } as Prisma.InputJsonValue,
      },
    });
  });

  afterEach(async () => {
    // Clean up in reverse dependency order
    // Delete conditions and effects first (they reference users)
    await prisma.fieldCondition.deleteMany({});
    await prisma.effect.deleteMany({});
    await prisma.stateVariable.deleteMany({});
    await prisma.encounter.deleteMany({});
    await prisma.structure.deleteMany({});
    await prisma.settlement.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.kingdom.deleteMany({});
    await prisma.party.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.world.deleteMany({});
    // Delete user-related records before deleting users
    await prisma.audit.deleteMany({});
    await prisma.version.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.campaignMembership.deleteMany({});
    // Now safe to delete users
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Validation - Settlement References', () => {
    it('should accept valid settlement ID when creating condition', async () => {
      const condition = await conditionService.create(
        {
          entityType: 'SETTLEMENT',
          entityId: settlementId,
          field: 'is_trade_hub',
          expression: {
            '>=': [{ 'settlement.level': [] }, 5],
          },
          description: 'Settlement is a trade hub',
        },
        mockUser
      );

      expect(condition).toBeDefined();
      expect(condition.entityId).toBe(settlementId);
    });

    it('should reject non-existent settlement ID', async () => {
      await expect(
        conditionService.create(
          {
            entityType: 'SETTLEMENT',
            entityId: 'nonexistent-settlement-id',
            field: 'is_trade_hub',
            expression: {
              '>=': [{ 'settlement.level': [] }, 5],
            },
            description: 'Invalid settlement reference',
          },
          mockUser
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject settlement ID that user does not have access to', async () => {
      // Create campaign owned by different user
      const otherUser = await prisma.user.create({
        data: {
          name: 'Other User',
          email: 'other@example.com',
          password: 'test-hash',
        },
      });

      const otherWorld = await prisma.world.create({
        data: {
          name: 'Other User World',
          calendars: [] as Prisma.InputJsonValue,
        },
      });

      const otherCampaign = await prisma.campaign.create({
        data: {
          name: 'Other User Campaign',
          worldId: otherWorld.id,
          ownerId: otherUser.id,
        },
      });

      const otherKingdom = await prisma.kingdom.create({
        data: {
          name: 'Other Kingdom',
          campaignId: otherCampaign.id,
          level: 1,
        },
      });

      const otherLocation = await prisma.location.create({
        data: {
          name: 'Other Settlement Location',
          worldId: otherWorld.id,
          type: 'point',
        },
      });

      const otherSettlement = await prisma.settlement.create({
        data: {
          name: 'Other Settlement',
          kingdomId: otherKingdom.id,
          locationId: otherLocation.id,
          level: 1,
        },
      });

      await expect(
        conditionService.create(
          {
            entityType: 'SETTLEMENT',
            entityId: otherSettlement.id,
            field: 'test_field',
            expression: { '==': [1, 1] },
          },
          mockUser
        )
      ).rejects.toThrow(NotFoundException);

      // Cleanup
      await prisma.settlement.delete({ where: { id: otherSettlement.id } });
      await prisma.location.delete({ where: { id: otherLocation.id } });
      await prisma.kingdom.delete({ where: { id: otherKingdom.id } });
      await prisma.campaign.delete({ where: { id: otherCampaign.id } });
      await prisma.world.delete({ where: { id: otherWorld.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('Validation - Structure References', () => {
    it('should accept valid structure ID when creating condition', async () => {
      const condition = await conditionService.create(
        {
          entityType: 'STRUCTURE',
          entityId: structure1Id,
          field: 'is_operational',
          expression: {
            '>': [{ 'structure.var': ['integrity'] }, 80],
          },
          description: 'Structure has good integrity',
        },
        mockUser
      );

      expect(condition).toBeDefined();
      expect(condition.entityId).toBe(structure1Id);
    });

    it('should reject non-existent structure ID', async () => {
      await expect(
        conditionService.create(
          {
            entityType: 'STRUCTURE',
            entityId: 'nonexistent-structure-id',
            field: 'is_operational',
            expression: {
              '>': [{ 'structure.var': ['integrity'] }, 80],
            },
            description: 'Invalid structure reference',
          },
          mockUser
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject structure ID that user does not have access to', async () => {
      // Create campaign owned by different user
      const otherUser2 = await prisma.user.create({
        data: {
          name: 'Other User 2',
          email: 'other2@example.com',
          password: 'test-hash',
        },
      });

      const otherWorld = await prisma.world.create({
        data: {
          name: 'Other User World',
          calendars: [] as Prisma.InputJsonValue,
        },
      });

      const otherCampaign = await prisma.campaign.create({
        data: {
          name: 'Other User Campaign',
          worldId: otherWorld.id,
          ownerId: otherUser2.id,
        },
      });

      const otherKingdom = await prisma.kingdom.create({
        data: {
          name: 'Other Kingdom',
          campaignId: otherCampaign.id,
          level: 1,
        },
      });

      const otherLocation2 = await prisma.location.create({
        data: {
          name: 'Other Structure Settlement Location',
          worldId: otherWorld.id,
          type: 'point',
        },
      });

      const otherSettlement = await prisma.settlement.create({
        data: {
          name: 'Other Settlement',
          kingdomId: otherKingdom.id,
          locationId: otherLocation2.id,
          level: 1,
        },
      });

      const otherStructure = await prisma.structure.create({
        data: {
          name: 'Other Structure',
          type: 'temple',
          level: 1,
          settlementId: otherSettlement.id,
        },
      });

      await expect(
        conditionService.create(
          {
            entityType: 'STRUCTURE',
            entityId: otherStructure.id,
            field: 'test_field',
            expression: { '==': [1, 1] },
          },
          mockUser
        )
      ).rejects.toThrow(NotFoundException);

      // Cleanup
      await prisma.structure.delete({ where: { id: otherStructure.id } });
      await prisma.settlement.delete({ where: { id: otherSettlement.id } });
      await prisma.location.delete({ where: { id: otherLocation2.id } });
      await prisma.kingdom.delete({ where: { id: otherKingdom.id } });
      await prisma.campaign.delete({ where: { id: otherCampaign.id } });
      await prisma.world.delete({ where: { id: otherWorld.id } });
      await prisma.user.delete({ where: { id: otherUser2.id } });
    });
  });

  describe('Validation - Expression Structure', () => {
    it('should reject null expression', async () => {
      await expect(
        conditionService.create(
          {
            entityType: 'SETTLEMENT',
            entityId: settlementId,
            field: 'test_field',
            expression: null as unknown as Record<string, unknown>,
          },
          mockUser
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty expression object', async () => {
      await expect(
        conditionService.create(
          {
            entityType: 'SETTLEMENT',
            entityId: settlementId,
            field: 'test_field',
            expression: {},
          },
          mockUser
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject array as expression (must be object)', async () => {
      await expect(
        conditionService.create(
          {
            entityType: 'SETTLEMENT',
            entityId: settlementId,
            field: 'test_field',
            expression: [] as unknown as Record<string, unknown>,
          },
          mockUser
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid JSONLogic expression', async () => {
      const condition = await conditionService.create(
        {
          entityType: 'SETTLEMENT',
          entityId: settlementId,
          field: 'test_field',
          expression: {
            and: [
              { '>=': [{ 'settlement.level': [] }, 5] },
              { '>': [{ 'settlement.var': ['population'] }, 5000] },
            ],
          },
        },
        mockUser
      );

      expect(condition).toBeDefined();
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect circular dependencies in rule graph', async () => {
      // Create three state variables that form a cycle:
      // var1 depends on var2, var2 depends on var3, var3 depends on var1

      // Create party first (required for StateVariable foreign key)
      const party = await prisma.party.create({
        data: {
          name: 'Test Party for Circular Dependencies',
          campaignId,
        },
      });

      const var1 = await prisma.stateVariable.create({
        data: {
          scope: 'world',
          scopeId: null,
          key: 'circular_var1',
          value: 0 as Prisma.InputJsonValue,
          type: 'integer',
          createdBy: mockUser.id,
        },
      });

      const var2 = await prisma.stateVariable.create({
        data: {
          scope: 'world',
          scopeId: null,
          key: 'circular_var2',
          value: 0 as Prisma.InputJsonValue,
          type: 'integer',
          createdBy: mockUser.id,
        },
      });

      const var3 = await prisma.stateVariable.create({
        data: {
          scope: 'world',
          scopeId: null,
          key: 'circular_var3',
          value: 0 as Prisma.InputJsonValue,
          type: 'integer',
          createdBy: mockUser.id,
        },
      });

      // Create conditions that reference the variables in a circular pattern
      await prisma.fieldCondition.create({
        data: {
          entityType: 'CAMPAIGN',
          entityId: campaignId,
          field: 'circular_var1',
          expression: {
            var: 'circular_var2',
          },
          createdBy: mockUser.id,
        },
      });

      await prisma.fieldCondition.create({
        data: {
          entityType: 'CAMPAIGN',
          entityId: campaignId,
          field: 'circular_var2',
          expression: {
            var: 'circular_var3',
          },
          createdBy: mockUser.id,
        },
      });

      await prisma.fieldCondition.create({
        data: {
          entityType: 'CAMPAIGN',
          entityId: campaignId,
          field: 'circular_var3',
          expression: {
            var: 'circular_var1',
          },
          createdBy: mockUser.id,
        },
      });

      // Validate cycles
      const result = await dependencyGraph.validateNoCycles(campaignId, 'main', mockUser);

      expect(result.hasCycles).toBe(true);
      expect(result.cycles.length).toBeGreaterThan(0);

      // Cleanup
      await prisma.fieldCondition.deleteMany({ where: { entityId: campaignId } });
      await prisma.stateVariable.deleteMany({ where: { id: { in: [var1.id, var2.id, var3.id] } } });
      await prisma.party.delete({ where: { id: party.id } });
    });

    it('should pass validation for acyclic rule graph', async () => {
      // Create simple linear dependency: var1 -> var2 -> var3

      // Create party first (required for StateVariable foreign key)
      const party2 = await prisma.party.create({
        data: {
          name: 'Test Party for Acyclic Dependencies',
          campaignId,
        },
      });

      const var1 = await prisma.stateVariable.create({
        data: {
          scope: 'world',
          scopeId: null,
          key: 'linear_var1',
          value: 10 as Prisma.InputJsonValue,
          type: 'integer',
          createdBy: mockUser.id,
        },
      });

      const var2 = await prisma.stateVariable.create({
        data: {
          scope: 'world',
          scopeId: null,
          key: 'linear_var2',
          value: 0 as Prisma.InputJsonValue,
          type: 'integer',
          createdBy: mockUser.id,
        },
      });

      const var3 = await prisma.stateVariable.create({
        data: {
          scope: 'world',
          scopeId: null,
          key: 'linear_var3',
          value: 0 as Prisma.InputJsonValue,
          type: 'integer',
          createdBy: mockUser.id,
        },
      });

      // var2 depends on var1
      await prisma.fieldCondition.create({
        data: {
          entityType: 'CAMPAIGN',
          entityId: campaignId,
          field: 'linear_var2',
          expression: {
            '+': [{ var: 'linear_var1' }, 5],
          },
          createdBy: mockUser.id,
        },
      });

      // var3 depends on var2
      await prisma.fieldCondition.create({
        data: {
          entityType: 'CAMPAIGN',
          entityId: campaignId,
          field: 'linear_var3',
          expression: {
            '*': [{ var: 'linear_var2' }, 2],
          },
          createdBy: mockUser.id,
        },
      });

      // Validate cycles
      const result = await dependencyGraph.validateNoCycles(campaignId, 'main', mockUser);

      expect(result.hasCycles).toBe(false);
      expect(result.cycles).toHaveLength(0);

      // Cleanup
      await prisma.fieldCondition.deleteMany({ where: { entityId: campaignId } });
      await prisma.stateVariable.deleteMany({ where: { id: { in: [var1.id, var2.id, var3.id] } } });
      await prisma.party.delete({ where: { id: party2.id } });
    });
  });

  describe('Complete Rule Lifecycle - Settlement', () => {
    it('should complete full lifecycle: create → evaluate → execute effects → invalidate', async () => {
      // Step 1: Create condition
      const condition = await conditionService.create(
        {
          entityType: 'SETTLEMENT',
          entityId: settlementId,
          field: 'is_major_settlement',
          expression: {
            and: [
              { '>=': [{ 'settlement.level': [] }, 5] },
              { '>': [{ 'settlement.var': ['population'] }, 5000] },
              { 'settlement.hasStructureType': ['temple'] },
            ],
          },
          description: 'Settlement qualifies as major settlement',
        },
        mockUser
      );

      expect(condition).toBeDefined();

      // Step 2: Evaluate condition
      const evalResult = await conditionService.evaluateCondition(condition.id, {}, mockUser);

      expect(evalResult.value).toBe(true);

      // Step 3: Create and execute effect
      const effect = await prisma.effect.create({
        data: {
          name: 'Upgrade Settlement Level',
          effectType: 'modify_variable',
          entityType: 'SETTLEMENT',
          entityId: settlementId,
          payload: [
            {
              op: 'replace',
              path: '/level',
              value: 6,
            },
          ] as Prisma.InputJsonValue,
        },
      });

      const execution = await effectExecution.executeEffect(effect.id, undefined, mockUser, false);

      expect(execution).toBeDefined();
      expect(execution.success).toBe(true);

      // Verify settlement level was updated
      const updated = await settlementService.findById(settlementId, mockUser);
      expect(updated?.level).toBe(6);

      // Step 4: Verify cache invalidation was triggered
      // The dependency graph should have been invalidated
      // (we can't easily test Redis pub/sub, but we can verify the graph rebuilds)
      const graph = await dependencyGraph.getGraph(campaignId, 'main', mockUser);
      expect(graph).toBeDefined();

      // Cleanup
      await prisma.effectExecution.deleteMany({ where: { effectId: effect.id } });
      await prisma.effect.delete({ where: { id: effect.id } });
      await prisma.fieldCondition.delete({ where: { id: condition.id } });
    });
  });

  describe('Complete Rule Lifecycle - Structure', () => {
    it('should complete full lifecycle: create → evaluate → execute effects → invalidate', async () => {
      // Step 1: Create condition
      const condition = await conditionService.create(
        {
          entityType: 'STRUCTURE',
          entityId: structure1Id,
          field: 'needs_repair',
          expression: {
            '<': [{ 'structure.var': ['integrity'] }, 50],
          },
          description: 'Structure needs repair',
        },
        mockUser
      );

      expect(condition).toBeDefined();

      // Step 2: Evaluate condition (should be false initially)
      let evalResult = await conditionService.evaluateCondition(condition.id, {}, mockUser);
      expect(evalResult.value).toBe(false); // integrity is 95

      // Step 3: Create and execute effect to damage structure
      const damageEffect = await prisma.effect.create({
        data: {
          name: 'Damage Structure',
          effectType: 'modify_variable',
          entityType: 'STRUCTURE',
          entityId: structure1Id,
          payload: [
            {
              op: 'replace',
              path: '/variables/integrity',
              value: 30,
            },
          ] as Prisma.InputJsonValue,
        },
      });

      await effectExecution.executeEffect(damageEffect.id, undefined, mockUser, false);

      // Step 4: Re-evaluate condition (should be true now)
      evalResult = await conditionService.evaluateCondition(condition.id, {}, mockUser);
      expect(evalResult.value).toBe(true);

      // Step 5: Create and execute repair effect
      const repairEffect = await prisma.effect.create({
        data: {
          name: 'Repair Structure',
          effectType: 'modify_variable',
          entityType: 'STRUCTURE',
          entityId: structure1Id,
          payload: [
            {
              op: 'replace',
              path: '/variables/integrity',
              value: 90,
            },
          ] as Prisma.InputJsonValue,
        },
      });

      const repairExecution = await effectExecution.executeEffect(
        repairEffect.id,
        undefined,
        mockUser,
        false
      );

      expect(repairExecution.success).toBe(true);

      // Step 6: Verify structure was repaired
      const updated = await structureService.findById(structure1Id, mockUser);
      expect(updated?.variables).toMatchObject({ integrity: 90 });

      // Step 7: Re-evaluate condition (should be false again)
      evalResult = await conditionService.evaluateCondition(condition.id, {}, mockUser);
      expect(evalResult.value).toBe(false);

      // Cleanup
      await prisma.effectExecution.deleteMany({});
      await prisma.effect.deleteMany({ where: { entityType: 'STRUCTURE' } });
      await prisma.fieldCondition.delete({ where: { id: condition.id } });
    });
  });

  describe('Cross-Entity Rules', () => {
    it('should evaluate rules that combine Settlement and Structure conditions', async () => {
      // Create condition: thriving settlement with operational temple
      const condition = await conditionService.create(
        {
          entityType: 'SETTLEMENT',
          entityId: settlementId,
          field: 'has_thriving_temple',
          expression: {
            and: [
              { '==': [{ 'settlement.var': ['prosperity'] }, 'thriving'] },
              { 'settlement.hasStructureType': ['temple'] },
              { '>=': [{ 'settlement.structureCount': ['temple'] }, 1] },
            ],
          },
          description: 'Settlement has thriving economy and temple',
        },
        mockUser
      );

      const result = await conditionService.evaluateCondition(condition.id, {}, mockUser);

      expect(result.value).toBe(true);

      // Cleanup
      await prisma.fieldCondition.delete({ where: { id: condition.id } });
    });
  });
});
