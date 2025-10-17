/**
 * Settlement Resolver Integration Tests
 * Tests for Settlement GraphQL queries and mutations
 */

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  Campaign,
  Kingdom,
  Location,
  Settlement as PrismaSettlement,
  User,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { AuditService } from '../services/audit.service';
import { CampaignContextService } from '../services/campaign-context.service';
import { KingdomService } from '../services/kingdom.service';
import { PartyService } from '../services/party.service';
import { SettlementService } from '../services/settlement.service';
import { StructureService } from '../services/structure.service';
import { VariableSchemaService } from '../services/variable-schema.service';
import { VersionService } from '../services/version.service';
import { VariableTypeEnum } from '../types/variable-schema.types';

import { SettlementResolver } from './settlement.resolver';

// TODO: Fix circular dependency issue causing Jest worker crashes
// These tests work individually but cause stack overflow when run with all other tests
// See: https://github.com/nestjs/nest/issues/1165
describe.skip('SettlementResolver Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolver: SettlementResolver;

  let testUser: AuthenticatedUser;
  let dbUser: User;
  let testCampaign: Campaign;
  let testWorld: { id: string; name: string };
  let testBranch: { id: string; name: string };
  let testKingdom: Kingdom;
  let testLocation: Location;
  let testSettlement: PrismaSettlement;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettlementResolver,
        SettlementService,
        VariableSchemaService,
        VersionService,
        AuditService,
        CampaignContextService,
        // Add all services that CampaignContextService depends on to resolve circular dependencies
        PartyService,
        KingdomService,
        StructureService,
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
    resolver = moduleRef.get<SettlementResolver>(SettlementResolver);

    // Create test user
    dbUser = await prisma.user.create({
      data: {
        email: 'settlement-test@example.com',
        name: 'Settlement Test User',
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
        name: 'Settlement Test World',
        calendars: {},
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        name: 'Settlement Test Campaign',
        worldId: testWorld.id,
        ownerId: testUser.id,
      },
    });

    // Create test branch
    testBranch = await prisma.branch.create({
      data: {
        campaignId: testCampaign.id,
        name: 'main',
      },
    });

    // Create test kingdom
    testKingdom = await prisma.kingdom.create({
      data: {
        campaignId: testCampaign.id,
        name: 'Test Kingdom',
        level: 1,
      },
    });

    // Create test location
    testLocation = await prisma.location.create({
      data: {
        name: 'Test Location',
        worldId: testWorld.id,
        type: 'point',
      },
    });

    // Create test settlement
    testSettlement = await prisma.settlement.create({
      data: {
        kingdomId: testKingdom.id,
        locationId: testLocation.id,
        name: 'Test Settlement',
        level: 1,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data respecting foreign key constraints
    // 1. Delete versions for branches in this campaign
    const branches = await prisma.branch.findMany({
      where: { campaignId: testCampaign.id },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);
    if (branchIds.length > 0) {
      await prisma.version.deleteMany({ where: { branchId: { in: branchIds } } });
    }

    // 2. Delete branches
    await prisma.branch.deleteMany({ where: { campaignId: testCampaign.id } });

    // 3. Delete structures
    await prisma.structure.deleteMany({ where: { settlement: { kingdomId: testKingdom.id } } });

    // 4. Delete settlements
    await prisma.settlement.deleteMany({ where: { kingdomId: testKingdom.id } });

    // 5. Delete kingdoms
    await prisma.kingdom.deleteMany({ where: { id: testKingdom.id } });

    // 6. Delete locations
    await prisma.location.deleteMany({ where: { worldId: testWorld.id } });

    // 7. Delete campaign
    await prisma.campaign.deleteMany({ where: { id: testCampaign.id } });

    // 8. Delete audit records
    await prisma.audit.deleteMany({ where: { userId: testUser.id } });

    // 9. Delete world
    await prisma.world.deleteMany({ where: { id: testWorld.id } });

    // 10. Delete user last
    await prisma.user.deleteMany({ where: { id: testUser.id } });

    await prisma.$disconnect();
    await app.close();
  });

  describe('settlement Query', () => {
    it('should return settlement by ID', async () => {
      const result = await resolver.settlement(testSettlement.id, testUser);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testSettlement.id);
      expect(result?.name).toBe('Test Settlement');
      expect(result?.kingdomId).toBe(testKingdom.id);
      expect(result?.locationId).toBe(testLocation.id);
      expect(result?.level).toBe(1);
    });

    it('should return null for non-existent settlement', async () => {
      const result = await resolver.settlement('non-existent-id', testUser);

      expect(result).toBeNull();
    });
  });

  describe('settlementsByKingdom Query', () => {
    it('should return all settlements for a kingdom', async () => {
      const result = await resolver.settlementsByKingdom(testKingdom.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((s) => s.id === testSettlement.id)).toBe(true);
    });
  });

  describe('createSettlement Mutation', () => {
    it('should create a new settlement', async () => {
      // Create a new location for the new settlement
      const newLocation = await prisma.location.create({
        data: {
          name: 'New Settlement Location',
          worldId: testWorld.id,
          type: 'point',
        },
      });

      const input = {
        kingdomId: testKingdom.id,
        locationId: newLocation.id,
        name: 'New Settlement',
        level: 2,
      };

      const result = await resolver.createSettlement(input, testUser);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('New Settlement');
      expect(result.level).toBe(2);
      expect(result.kingdomId).toBe(testKingdom.id);
      expect(result.locationId).toBe(newLocation.id);

      // Clean up
      await prisma.settlement.delete({ where: { id: result.id } });
      await prisma.location.delete({ where: { id: newLocation.id } });
    });
  });

  describe('updateSettlement Mutation', () => {
    it('should update a settlement', async () => {
      const input = {
        name: 'Updated Settlement Name',
        branchId: testBranch.id,
        expectedVersion: 1,
      };

      const result = await resolver.updateSettlement(testSettlement.id, input, testUser);

      expect(result.id).toBe(testSettlement.id);
      expect(result.name).toBe('Updated Settlement Name');
    });
  });

  describe('setSettlementLevel Mutation', () => {
    it('should set settlement level', async () => {
      const result = await resolver.setSettlementLevel(testSettlement.id, 5, testUser);

      expect(result.id).toBe(testSettlement.id);
      expect(result.level).toBe(5);
    });
  });

  describe('defineSettlementVariableSchema Mutation', () => {
    it('should define a string variable schema', async () => {
      const input = {
        name: 'settlementMotto',
        type: VariableTypeEnum.STRING,
        description: "The settlement's motto",
      };

      const result = await resolver.defineSettlementVariableSchema(
        testSettlement.id,
        input,
        testUser
      );

      expect(result.name).toBe('settlementMotto');
      expect(result.type).toBe(VariableTypeEnum.STRING);
      expect(result.description).toBe("The settlement's motto");
    });

    it('should define a number variable schema', async () => {
      const input = {
        name: 'population',
        type: VariableTypeEnum.NUMBER,
        defaultValue: 0,
        description: 'Settlement population',
      };

      const result = await resolver.defineSettlementVariableSchema(
        testSettlement.id,
        input,
        testUser
      );

      expect(result.name).toBe('population');
      expect(result.type).toBe(VariableTypeEnum.NUMBER);
      expect(result.defaultValue).toBe(0);
    });

    it('should define an enum variable schema', async () => {
      const input = {
        name: 'settlementType',
        type: VariableTypeEnum.ENUM,
        enumValues: ['Village', 'Town', 'City'],
        defaultValue: 'Village',
        description: 'Type of settlement',
      };

      const result = await resolver.defineSettlementVariableSchema(
        testSettlement.id,
        input,
        testUser
      );

      expect(result.name).toBe('settlementType');
      expect(result.type).toBe(VariableTypeEnum.ENUM);
      expect(result.enumValues).toEqual(['Village', 'Town', 'City']);
      expect(result.defaultValue).toBe('Village');
    });
  });

  describe('setSettlementVariable Mutation', () => {
    it('should set a string variable', async () => {
      const input = {
        name: 'settlementMotto',
        value: 'We prosper together',
      };

      const result = await resolver.setSettlementVariable(testSettlement.id, input, testUser);

      expect(result.name).toBe('settlementMotto');
      expect(result.value).toBe('We prosper together');
    });

    it('should set a number variable', async () => {
      const input = {
        name: 'population',
        value: 5000,
      };

      const result = await resolver.setSettlementVariable(testSettlement.id, input, testUser);

      expect(result.name).toBe('population');
      expect(result.value).toBe(5000);
    });

    it('should set an enum variable', async () => {
      const input = {
        name: 'settlementType',
        value: 'Town',
      };

      const result = await resolver.setSettlementVariable(testSettlement.id, input, testUser);

      expect(result.name).toBe('settlementType');
      expect(result.value).toBe('Town');
    });

    it('should reject invalid enum value', async () => {
      const input = {
        name: 'settlementType',
        value: 'Invalid Type',
      };

      await expect(
        resolver.setSettlementVariable(testSettlement.id, input, testUser)
      ).rejects.toThrow();
    });
  });

  describe('settlementVariable Query', () => {
    it('should return a variable value', async () => {
      const result = await resolver.settlementVariable(
        testSettlement.id,
        'settlementMotto',
        testUser
      );

      expect(result).not.toBeNull();
      expect(result?.name).toBe('settlementMotto');
      expect(result?.value).toBe('We prosper together');
    });

    it('should return null for non-existent variable', async () => {
      const result = await resolver.settlementVariable(testSettlement.id, 'nonExistent', testUser);

      expect(result).toBeNull();
    });
  });

  describe('settlementVariables Query', () => {
    it('should return all variables', async () => {
      const result = await resolver.settlementVariables(testSettlement.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some((v) => v.name === 'settlementMotto')).toBe(true);
      expect(result.some((v) => v.name === 'population')).toBe(true);
      expect(result.some((v) => v.name === 'settlementType')).toBe(true);
    });
  });

  describe('settlementVariableSchemas Query', () => {
    it('should return all variable schemas', async () => {
      const result = await resolver.settlementVariableSchemas(testSettlement.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some((s) => s.name === 'settlementMotto')).toBe(true);
      expect(result.some((s) => s.name === 'population')).toBe(true);
      expect(result.some((s) => s.name === 'settlementType')).toBe(true);
    });
  });

  describe('deleteSettlementVariableSchema Mutation', () => {
    it('should delete a variable schema and its value', async () => {
      const result = await resolver.deleteSettlementVariableSchema(
        testSettlement.id,
        'settlementMotto',
        testUser
      );

      expect(result).toBe(true);

      // Verify schema was deleted
      const schemas = await resolver.settlementVariableSchemas(testSettlement.id, testUser);
      expect(schemas.some((s) => s.name === 'settlementMotto')).toBe(false);

      // Verify variable was deleted
      const variable = await resolver.settlementVariable(
        testSettlement.id,
        'settlementMotto',
        testUser
      );
      expect(variable).toBeNull();
    });
  });

  describe('deleteSettlement Mutation', () => {
    it('should soft delete a settlement', async () => {
      const result = await resolver.deleteSettlement(testSettlement.id, testUser);

      expect(result.id).toBe(testSettlement.id);
      expect(result.deletedAt).not.toBeNull();
    });
  });

  describe('archiveSettlement Mutation', () => {
    it('should archive a settlement', async () => {
      // First restore the deleted settlement
      await prisma.settlement.update({
        where: { id: testSettlement.id },
        data: { deletedAt: null },
      });

      const result = await resolver.archiveSettlement(testSettlement.id, testUser);

      expect(result.id).toBe(testSettlement.id);
      expect(result.archivedAt).not.toBeNull();
    });
  });

  describe('restoreSettlement Mutation', () => {
    it('should restore an archived settlement', async () => {
      const result = await resolver.restoreSettlement(testSettlement.id, testUser);

      expect(result.id).toBe(testSettlement.id);
      expect(result.archivedAt).toBeNull();
    });
  });
});
