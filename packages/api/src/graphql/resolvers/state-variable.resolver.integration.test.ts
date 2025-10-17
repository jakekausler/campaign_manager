/**
 * State Variable Resolver Integration Tests
 * Tests for StateVariable GraphQL queries and mutations
 */

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  Campaign,
  Settlement,
  StateVariable as PrismaStateVariable,
  User,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { ExpressionParserService } from '../../rules/expression-parser.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { AuditService } from '../services/audit.service';
import { CampaignContextService } from '../services/campaign-context.service';
import { CharacterService } from '../services/character.service';
import { KingdomService } from '../services/kingdom.service';
import { PartyService } from '../services/party.service';
import { SettlementService } from '../services/settlement.service';
import { StateVariableService } from '../services/state-variable.service';
import { StructureService } from '../services/structure.service';
import { VariableEvaluationService } from '../services/variable-evaluation.service';
import { VariableSchemaService } from '../services/variable-schema.service';
import { VersionService } from '../services/version.service';
import { VariableScope, VariableType } from '../types/state-variable.type';

import { StateVariableResolver } from './state-variable.resolver';

// TODO: Fix circular dependency issue causing Jest worker crashes
// These tests work individually but cause stack overflow when run with all other tests
// See: https://github.com/nestjs/nest/issues/1165
describe.skip('StateVariableResolver Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolver: StateVariableResolver;

  let testUser: AuthenticatedUser;
  let dbUser: User;
  let testCampaign: Campaign;
  let testWorld: { id: string; name: string };
  let testSettlement: Settlement;
  let testVariable: PrismaStateVariable;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StateVariableResolver,
        StateVariableService,
        VariableEvaluationService,
        ExpressionParserService,
        VariableSchemaService,
        VersionService,
        AuditService,
        CampaignContextService,
        // Add all services that CampaignContextService depends on to resolve circular dependencies
        KingdomService,
        SettlementService,
        StructureService,
        PartyService,
        CharacterService,
        PrismaService,
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    resolver = moduleRef.get<StateVariableResolver>(StateVariableResolver);

    // Create test user
    dbUser = await prisma.user.create({
      data: {
        email: 'state-variable-test@example.com',
        name: 'State Variable Test User',
        password: 'hash',
      },
    });

    testUser = {
      id: dbUser.id,
      email: dbUser.email,
      role: 'owner',
    };

    // Create test world
    testWorld = await prisma.world.create({
      data: {
        name: 'Test World',
        calendars: {},
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        name: 'State Variable Test Campaign',
        worldId: testWorld.id,
        ownerId: testUser.id,
      },
    });

    // Create test settlement for settlement-scoped variables
    testSettlement = await prisma.settlement.create({
      data: {
        campaignId: testCampaign.id,
        name: 'Test Settlement',
        population: 5000,
      },
    });

    // Create test variable
    testVariable = await prisma.stateVariable.create({
      data: {
        scope: 'settlement',
        scopeId: testSettlement.id,
        key: 'population',
        value: 5000,
        type: 'integer',
        description: 'Current population of the settlement',
        isActive: true,
        createdBy: testUser.id,
        version: 1,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data respecting foreign key constraints
    // 1. Delete state variables
    await prisma.stateVariable.deleteMany({ where: { createdBy: testUser.id } });

    // 2. Delete settlements
    await prisma.settlement.deleteMany({ where: { campaignId: testCampaign.id } });

    // 3. Delete versions for branches in this campaign
    const branches = await prisma.branch.findMany({
      where: { campaignId: testCampaign.id },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);
    if (branchIds.length > 0) {
      await prisma.version.deleteMany({ where: { branchId: { in: branchIds } } });
    }

    // 4. Delete branches
    await prisma.branch.deleteMany({ where: { campaignId: testCampaign.id } });

    // 5. Delete campaign
    await prisma.campaign.deleteMany({ where: { id: testCampaign.id } });

    // 6. Delete audit records
    await prisma.audit.deleteMany({ where: { userId: testUser.id } });

    // 7. Delete world
    await prisma.world.deleteMany({ where: { id: testWorld.id } });

    // 8. Delete user last
    await prisma.user.deleteMany({ where: { id: testUser.id } });

    await prisma.$disconnect();
    await app.close();
  });

  describe('getStateVariable Query', () => {
    it('should return variable by ID', async () => {
      const result = await resolver.getStateVariable(testVariable.id, testUser);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testVariable.id);
      expect(result?.key).toBe('population');
      expect(result?.scope).toBe(VariableScope.SETTLEMENT);
      expect(result?.scopeId).toBe(testSettlement.id);
      expect(result?.value).toBe(5000);
      expect(result?.type).toBe(VariableType.INTEGER);
    });

    it('should return null for non-existent variable', async () => {
      const result = await resolver.getStateVariable('non-existent-id', testUser);

      expect(result).toBeNull();
    });

    it('should return null for unauthorized access', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-user@example.com',
          name: 'Other User',
          password: 'hash',
        },
      });

      const otherTestUser: AuthenticatedUser = {
        id: otherUser.id,
        email: otherUser.email,
        role: 'gm',
      };

      const result = await resolver.getStateVariable(testVariable.id, otherTestUser);

      expect(result).toBeNull();

      // Clean up
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('listStateVariables Query', () => {
    it('should return all variables for authorized user', async () => {
      const result = await resolver.listStateVariables(
        undefined,
        undefined,
        undefined,
        undefined,
        testUser
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((v) => v.id === testVariable.id)).toBe(true);
    });

    it('should filter by scope', async () => {
      const result = await resolver.listStateVariables(
        { scope: VariableScope.SETTLEMENT },
        undefined,
        undefined,
        undefined,
        testUser
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((v) => v.scope === VariableScope.SETTLEMENT)).toBe(true);
    });

    it('should filter by scopeId', async () => {
      const result = await resolver.listStateVariables(
        { scopeId: testSettlement.id },
        undefined,
        undefined,
        undefined,
        testUser
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((v) => v.scopeId === testSettlement.id)).toBe(true);
    });

    it('should filter by key', async () => {
      const result = await resolver.listStateVariables(
        { key: 'population' },
        undefined,
        undefined,
        undefined,
        testUser
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((v) => v.key === 'population')).toBe(true);
    });

    it('should filter by type', async () => {
      const result = await resolver.listStateVariables(
        { type: VariableType.INTEGER },
        undefined,
        undefined,
        undefined,
        testUser
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((v) => v.type === VariableType.INTEGER)).toBe(true);
    });

    it('should filter by isActive', async () => {
      const result = await resolver.listStateVariables(
        { isActive: true },
        undefined,
        undefined,
        undefined,
        testUser
      );

      expect(result.every((v) => v.isActive)).toBe(true);
    });

    it('should support pagination with skip and take', async () => {
      const result = await resolver.listStateVariables(undefined, undefined, 0, 1, testUser);

      expect(result.length).toBe(1);
    });
  });

  describe('getVariablesForScope Query', () => {
    it('should return variables for specific scope and scopeId', async () => {
      const result = await resolver.getVariablesForScope(
        VariableScope.SETTLEMENT,
        testSettlement.id,
        undefined,
        testUser
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((v) => v.id === testVariable.id)).toBe(true);
      expect(result.every((v) => v.scope === VariableScope.SETTLEMENT)).toBe(true);
      expect(result.every((v) => v.scopeId === testSettlement.id)).toBe(true);
    });

    it('should filter by key when provided', async () => {
      const result = await resolver.getVariablesForScope(
        VariableScope.SETTLEMENT,
        testSettlement.id,
        'population',
        testUser
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((v) => v.key === 'population')).toBe(true);
    });

    it('should return empty array for scope with no variables', async () => {
      const result = await resolver.getVariablesForScope(
        VariableScope.WORLD,
        null,
        undefined,
        testUser
      );

      expect(result).toEqual([]);
    });
  });

  describe('evaluateStateVariable Query', () => {
    it('should evaluate non-derived variable', async () => {
      const input = {
        variableId: testVariable.id,
        context: null,
      };

      const result = await resolver.evaluateStateVariable(input, testUser);

      expect(result.variableId).toBe(testVariable.id);
      expect(result.key).toBe('population');
      expect(result.value).toBe(5000);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should evaluate derived variable with formula', async () => {
      // Create derived variable
      const derivedVariable = await prisma.stateVariable.create({
        data: {
          scope: 'settlement',
          scopeId: testSettlement.id,
          key: 'prosperity_level',
          value: null,
          type: 'derived',
          formula: {
            if: [
              { '>': [{ var: 'population' }, 10000] },
              'thriving',
              { '>': [{ var: 'population' }, 5000] },
              'prosperous',
              'struggling',
            ],
          },
          description: 'Prosperity level based on population',
          isActive: true,
          createdBy: testUser.id,
          version: 1,
        },
      });

      const input = {
        variableId: derivedVariable.id,
        context: { population: 6000 },
      };

      const result = await resolver.evaluateStateVariable(input, testUser);

      expect(result.variableId).toBe(derivedVariable.id);
      expect(result.key).toBe('prosperity_level');
      expect(result.value).toBe('prosperous');
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.trace).toBeDefined();

      // Clean up
      await prisma.stateVariable.delete({ where: { id: derivedVariable.id } });
    });
  });

  describe('createStateVariable Mutation', () => {
    it('should create a new non-derived variable', async () => {
      const input = {
        scope: VariableScope.SETTLEMENT,
        scopeId: testSettlement.id,
        key: 'merchant_count',
        value: 15,
        type: VariableType.INTEGER,
        description: 'Number of merchants in settlement',
      };

      const result = await resolver.createStateVariable(input, testUser);

      expect(result.id).toBeDefined();
      expect(result.key).toBe('merchant_count');
      expect(result.value).toBe(15);
      expect(result.type).toBe(VariableType.INTEGER);
      expect(result.scope).toBe(VariableScope.SETTLEMENT);
      expect(result.scopeId).toBe(testSettlement.id);
      expect(result.isActive).toBe(true);

      // Clean up
      await prisma.stateVariable.delete({ where: { id: result.id } });
    });

    it('should create a derived variable with formula', async () => {
      const input = {
        scope: VariableScope.SETTLEMENT,
        scopeId: testSettlement.id,
        key: 'is_trade_hub',
        value: null,
        type: VariableType.DERIVED,
        formula: {
          and: [{ '>=': [{ var: 'population' }, 5000] }, { '>=': [{ var: 'merchant_count' }, 10] }],
        },
        description: 'Whether settlement qualifies as trade hub',
      };

      const result = await resolver.createStateVariable(input, testUser);

      expect(result.id).toBeDefined();
      expect(result.key).toBe('is_trade_hub');
      expect(result.type).toBe(VariableType.DERIVED);
      expect(result.formula).toEqual(input.formula);
      expect(result.value).toBeNull();

      // Clean up
      await prisma.stateVariable.delete({ where: { id: result.id } });
    });
  });

  describe('updateStateVariable Mutation', () => {
    it('should update variable value', async () => {
      const input = {
        value: 5500,
        expectedVersion: testVariable.version,
      };

      const result = await resolver.updateStateVariable(testVariable.id, input, testUser);

      expect(result.id).toBe(testVariable.id);
      expect(result.value).toBe(5500);
      expect(result.version).toBe(testVariable.version + 1);

      // Update testVariable reference for other tests
      testVariable.version = result.version;
    });

    it('should update variable description', async () => {
      const input = {
        description: 'Updated population description',
        expectedVersion: testVariable.version,
      };

      const result = await resolver.updateStateVariable(testVariable.id, input, testUser);

      expect(result.id).toBe(testVariable.id);
      expect(result.description).toBe('Updated population description');
      expect(result.version).toBe(testVariable.version + 1);

      // Update testVariable reference
      testVariable.version = result.version;
    });
  });

  describe('toggleStateVariableActive Mutation', () => {
    it('should toggle variable active status to false', async () => {
      const result = await resolver.toggleStateVariableActive(testVariable.id, false, testUser);

      expect(result.id).toBe(testVariable.id);
      expect(result.isActive).toBe(false);
    });

    it('should toggle variable active status back to true', async () => {
      const result = await resolver.toggleStateVariableActive(testVariable.id, true, testUser);

      expect(result.id).toBe(testVariable.id);
      expect(result.isActive).toBe(true);
    });
  });

  describe('deleteStateVariable Mutation', () => {
    it('should soft delete a variable', async () => {
      // Create a temporary variable to delete
      const tempVariable = await prisma.stateVariable.create({
        data: {
          scope: 'settlement',
          scopeId: testSettlement.id,
          key: 'temp_variable',
          value: 'temp',
          type: 'string',
          isActive: true,
          createdBy: testUser.id,
          version: 1,
        },
      });

      const result = await resolver.deleteStateVariable(tempVariable.id, testUser);

      expect(result).toBe(true);

      // Verify variable is soft deleted
      const deletedVariable = await prisma.stateVariable.findUnique({
        where: { id: tempVariable.id },
      });

      expect(deletedVariable?.deletedAt).not.toBeNull();
    });
  });

  describe('Field Resolvers', () => {
    it('should resolve createdBy field', async () => {
      const result = await resolver.getStateVariable(testVariable.id, testUser);

      expect(result).not.toBeNull();
      const createdBy = resolver.resolveCreatedBy(result!);
      expect(createdBy).toBe(testUser.id);
    });

    it('should resolve updatedBy field', async () => {
      const result = await resolver.getStateVariable(testVariable.id, testUser);

      expect(result).not.toBeNull();
      const updatedBy = resolver.resolveUpdatedBy(result!);
      // updatedBy may be null if never updated
      expect(updatedBy === null || typeof updatedBy === 'string').toBe(true);
    });

    it('should resolve version field', async () => {
      const result = await resolver.getStateVariable(testVariable.id, testUser);

      expect(result).not.toBeNull();
      const version = resolver.resolveVersion(result!);
      expect(typeof version).toBe('number');
      expect(version).toBeGreaterThan(0);
    });
  });
});
