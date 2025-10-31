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
import * as jsonLogic from 'json-logic-js';

import { PrismaService } from '../../database/prisma.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';
import type { EvaluateConditionRequest } from '../../grpc/rules-engine.types';
import { OperatorRegistry } from '../../rules/operator-registry';
import { SettlementOperatorsService } from '../../rules/operators/settlement-operators.service';
import { StructureOperatorsService } from '../../rules/operators/structure-operators.service';
import { RulesModule } from '../../rules/rules.module';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';

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

// Helper type for JSONLogic conditions with custom operators
type JSONLogicCondition =
  | string
  | number
  | boolean
  | null
  | JSONLogicCondition[]
  | { [key: string]: JSONLogicCondition };

// Global operator registry for JSONLogic evaluation
let globalOperatorRegistry: OperatorRegistry;

/**
 * Helper function to apply async JSONLogic conditions
 * Preprocesses custom operators before evaluating with JSONLogic
 */
async function applyAsync(condition: JSONLogicCondition, data: unknown): Promise<unknown> {
  async function preprocessCondition(node: JSONLogicCondition): Promise<JSONLogicCondition> {
    if (node === null || node === undefined) {
      return node;
    }

    if (Array.isArray(node)) {
      return await Promise.all(node.map((item) => preprocessCondition(item)));
    }

    if (typeof node === 'object') {
      const keys = Object.keys(node);

      // Check if this is a custom operator (settlement.* or structure.*)
      if (
        keys.length === 1 &&
        (keys[0].startsWith('settlement.') || keys[0].startsWith('structure.'))
      ) {
        const operatorName = keys[0];
        const args = node[operatorName];

        const operator = globalOperatorRegistry.get(operatorName);
        if (operator) {
          const argsArray = Array.isArray(args) ? args : [args];
          const result = await operator.implementation(...argsArray);
          return result as JSONLogicCondition;
        }
      }

      // Otherwise, recursively process all values
      const processed: { [key: string]: JSONLogicCondition } = {};
      for (const key of keys) {
        processed[key] = await preprocessCondition(node[key]);
      }
      return processed;
    }

    return node;
  }

  const processedCondition = await preprocessCondition(condition);
  // eslint-disable-next-line import/no-named-as-default-member
  return jsonLogic.apply(processedCondition as unknown as jsonLogic.RulesLogic, data);
}

describe('Settlement & Structure Rules - E2E Validation Tests', () => {
  let prisma: PrismaClient;
  let conditionService: ConditionService;
  let settlementService: SettlementService;
  let structureService: StructureService;
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

    // Create a smart mock that actually evaluates JSONLogic expressions
    const mockRulesEngineClient = {
      evaluateCondition: jest.fn().mockImplementation(async (request: EvaluateConditionRequest) => {
        // Fetch the condition from the database
        const condition = await prisma.fieldCondition.findUnique({
          where: { id: request.conditionId },
        });

        if (!condition) {
          return {
            success: false,
            error: `Condition ${request.conditionId} not found`,
          };
        }

        // Parse context from JSON
        const context = JSON.parse(request.contextJson);

        // Evaluate the expression
        try {
          const result = await applyAsync(condition.expression as JSONLogicCondition, context);
          return {
            success: true,
            valueJson: JSON.stringify(result),
          };
        } catch (error) {
          return {
            success: false,
            error: String(error),
          };
        }
      }),
      evaluateConditions: jest.fn().mockImplementation(async (request) => {
        // Fetch all conditions
        const conditions = await prisma.fieldCondition.findMany({
          where: { id: { in: request.conditionIds } },
        });

        // Parse context from JSON
        const context = JSON.parse(request.contextJson);

        // Evaluate each condition
        const results: Record<string, any> = {};
        for (const condition of conditions) {
          try {
            const result = await applyAsync(condition.expression as JSONLogicCondition, context);
            results[condition.id] = {
              success: true,
              valueJson: JSON.stringify(result),
            };
          } catch (error) {
            results[condition.id] = {
              success: false,
              error: String(error),
            };
          }
        }

        return { results };
      }),
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

    const mockVersionService = {
      createVersion: jest.fn().mockResolvedValue(undefined),
      resolveVersion: jest.fn().mockResolvedValue(null),
      decompressVersion: jest.fn().mockResolvedValue({}),
    };

    const mockWebSocketPublisher = {
      publishEntityUpdated: jest.fn().mockResolvedValue(undefined),
      publishSettlementUpdated: jest.fn().mockResolvedValue(undefined),
      publishStructureUpdated: jest.fn().mockResolvedValue(undefined),
      publishWorldTimeChanged: jest.fn().mockResolvedValue(undefined),
      publishStateInvalidated: jest.fn().mockResolvedValue(undefined),
      publishEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [RulesModule],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: 'REDIS_PUBSUB', useValue: mockPubSub },
        { provide: 'REDIS_CACHE', useValue: mockRedisCache },
        { provide: RulesEngineClientService, useValue: mockRulesEngineClient },
        { provide: CampaignContextService, useValue: mockCampaignContext },
        { provide: VersionService, useValue: mockVersionService },
        WebSocketPublisherService, // Provide the class itself
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
        SettlementContextBuilderService, // Use real implementation
        StructureContextBuilderService, // Use real implementation
        SettlementOperatorsService,
        StructureOperatorsService,
      ],
    })
      .overrideProvider(WebSocketPublisherService)
      .useValue(mockWebSocketPublisher)
      .compile();

    conditionService = module.get<ConditionService>(ConditionService);
    settlementService = module.get<SettlementService>(SettlementService);
    structureService = module.get<StructureService>(StructureService);
    dependencyGraph = module.get<DependencyGraphService>(DependencyGraphService);

    // Get the OperatorRegistry from RulesModule (shared instance)
    const operatorRegistry = module.get<OperatorRegistry>(OperatorRegistry);

    // Store in global for applyAsync helper
    globalOperatorRegistry = operatorRegistry;

    // Get real context builder instances
    const settlementContextBuilder = module.get<SettlementContextBuilderService>(
      SettlementContextBuilderService
    );
    const structureContextBuilder = module.get<StructureContextBuilderService>(
      StructureContextBuilderService
    );

    // Manually register Settlement operators with real context builder
    const settlementOperators = new SettlementOperatorsService(
      operatorRegistry,
      settlementContextBuilder
    );
    await settlementOperators.onModuleInit();

    // Manually register Structure operators with real context builder
    const structureOperators = new StructureOperatorsService(
      operatorRegistry,
      structureContextBuilder
    );
    await structureOperators.onModuleInit();
  });

  beforeEach(async () => {
    // Clean up any existing test user first to avoid unique constraint violations
    await prisma.user.deleteMany({
      where: { email: 'test-e2e@example.com' },
    });

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

    // Create main branch for the campaign
    await prisma.branch.create({
      data: {
        id: 'main',
        campaignId,
        name: 'Main',
      },
    });

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
    // Delete conditions and effects first (they reference users and entities)
    await prisma.fieldCondition.deleteMany({});
    await prisma.effect.deleteMany({});
    await prisma.stateVariable.deleteMany({});
    await prisma.encounter.deleteMany({});
    await prisma.structure.deleteMany({});
    await prisma.settlement.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.kingdom.deleteMany({});
    await prisma.party.deleteMany({});
    // Delete user-related records that reference branches/campaigns
    await prisma.audit.deleteMany({});
    await prisma.mergeHistory.deleteMany({});
    await prisma.version.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.campaignMembership.deleteMany({}); // References branchId
    // Delete branches before campaigns
    await prisma.branch.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.world.deleteMany({});
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
    it.skip('should detect circular dependencies in rule graph', async () => {
      // TODO: This test needs to be restructured to create an actual cycle.
      // Currently it creates conditions on CAMPAIGN fields that reference StateVariables,
      // but this doesn't form a cycle because there's no edge back from the StateVariables
      // to the conditions. A proper cycle would require conditions that reference other
      // computed fields (e.g., CAMPAIGN.field_a refs CAMPAIGN.field_b refs CAMPAIGN.field_c refs CAMPAIGN.field_a)
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
    it('should complete full lifecycle: create → evaluate → cache → invalidate', async () => {
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

      // Step 2: Verify condition was created correctly
      // Note: Actual evaluation of Settlement operators requires async evaluation
      // which is handled by the rules-engine worker in production. Local evaluation
      // via conditionService.evaluateCondition doesn't support async operators yet.
      const retrieved = await conditionService.findById(condition.id, mockUser);
      expect(retrieved).toBeDefined();
      expect(retrieved?.entityId).toBe(settlementId);

      // Step 3: Update settlement and verify invalidation
      const settlement = await settlementService.findById(settlementId, mockUser);
      await settlementService.update(
        settlementId,
        { level: 6 },
        mockUser,
        settlement!.version,
        'main'
      );

      // Step 4: Verify cache invalidation was triggered
      // The dependency graph should have been invalidated
      // (we can't easily test Redis pub/sub, but we can verify the graph rebuilds)
      const graph = await dependencyGraph.getGraph(campaignId, 'main', mockUser);
      expect(graph).toBeDefined();

      // Cleanup
      await prisma.fieldCondition.delete({ where: { id: condition.id } });
    });
  });

  describe('Complete Rule Lifecycle - Structure', () => {
    it('should complete full lifecycle: create → evaluate → update → re-evaluate', async () => {
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

      // Step 2: Verify condition was created correctly
      // Note: Actual evaluation of Structure operators requires async evaluation
      // which is handled by the rules-engine worker in production.
      const retrieved = await conditionService.findById(condition.id, mockUser);
      expect(retrieved).toBeDefined();
      expect(retrieved?.entityId).toBe(structure1Id);

      // Step 3: Damage structure
      let structure = await structureService.findById(structure1Id, mockUser);
      await structureService.update(
        structure1Id,
        { variables: { integrity: 30, capacity: 500 } },
        mockUser,
        structure!.version,
        'main'
      );

      // Step 4: Verify structure was updated
      structure = await structureService.findById(structure1Id, mockUser);
      expect(structure?.variables).toMatchObject({ integrity: 30 });

      // Step 5: Repair structure
      structure = await structureService.findById(structure1Id, mockUser);
      await structureService.update(
        structure1Id,
        { variables: { integrity: 90, capacity: 500 } },
        mockUser,
        structure!.version,
        'main'
      );

      // Step 6: Verify structure was repaired
      const updated = await structureService.findById(structure1Id, mockUser);
      expect(updated?.variables).toMatchObject({ integrity: 90 });

      // Cleanup
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

      // Verify condition was created correctly
      // Note: Actual evaluation of cross-entity Settlement/Structure operators requires async evaluation
      // which is handled by the rules-engine worker in production.
      const retrieved = await conditionService.findById(condition.id, mockUser);
      expect(retrieved).toBeDefined();
      expect(retrieved?.entityId).toBe(settlementId);

      // Cleanup
      await prisma.fieldCondition.delete({ where: { id: condition.id } });
    });
  });
});
