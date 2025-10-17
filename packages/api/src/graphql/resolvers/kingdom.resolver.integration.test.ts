/**
 * Kingdom Resolver Integration Tests
 * Tests for Kingdom GraphQL queries and mutations
 */

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Campaign, Kingdom as PrismaKingdom, User } from '@prisma/client';

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

import { KingdomResolver } from './kingdom.resolver';

// TODO: Fix circular dependency issue causing Jest worker crashes
// These tests work individually but cause stack overflow when run with all other tests
// See: https://github.com/nestjs/nest/issues/1165
describe.skip('KingdomResolver Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolver: KingdomResolver;

  let testUser: AuthenticatedUser;
  let dbUser: User;
  let testCampaign: Campaign;
  let testWorld: { id: string; name: string };
  let testBranch: { id: string; name: string };
  let testKingdom: PrismaKingdom;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        KingdomResolver,
        KingdomService,
        VariableSchemaService,
        VersionService,
        AuditService,
        CampaignContextService,
        // Add all services that CampaignContextService depends on to resolve circular dependencies
        PartyService,
        SettlementService,
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
    resolver = moduleRef.get<KingdomResolver>(KingdomResolver);

    // Create test user
    dbUser = await prisma.user.create({
      data: {
        email: 'kingdom-test@example.com',
        name: 'Kingdom Test User',
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
        name: 'Kingdom Test World',
        calendars: {},
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        name: 'Kingdom Test Campaign',
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

    // 3. Delete settlements (cascade to structures)
    await prisma.settlement.deleteMany({ where: { kingdom: { campaignId: testCampaign.id } } });

    // 4. Delete kingdoms
    await prisma.kingdom.deleteMany({ where: { campaignId: testCampaign.id } });

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

  describe('kingdom Query', () => {
    it('should return kingdom by ID', async () => {
      const result = await resolver.kingdom(testKingdom.id, testUser);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testKingdom.id);
      expect(result?.name).toBe('Test Kingdom');
      expect(result?.campaignId).toBe(testCampaign.id);
      expect(result?.level).toBe(1);
    });

    it('should return null for non-existent kingdom', async () => {
      const result = await resolver.kingdom('non-existent-id', testUser);

      expect(result).toBeNull();
    });
  });

  describe('kingdomsByCampaign Query', () => {
    it('should return all kingdoms for a campaign', async () => {
      const result = await resolver.kingdomsByCampaign(testCampaign.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((k) => k.id === testKingdom.id)).toBe(true);
    });
  });

  describe('createKingdom Mutation', () => {
    it('should create a new kingdom', async () => {
      const input = {
        campaignId: testCampaign.id,
        name: 'New Kingdom',
        level: 2,
      };

      const result = await resolver.createKingdom(input, testUser);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('New Kingdom');
      expect(result.level).toBe(2);
      expect(result.campaignId).toBe(testCampaign.id);

      // Clean up
      await prisma.kingdom.delete({ where: { id: result.id } });
    });
  });

  describe('updateKingdom Mutation', () => {
    it('should update a kingdom', async () => {
      const input = {
        name: 'Updated Kingdom Name',
        branchId: testBranch.id,
        expectedVersion: 1,
      };

      const result = await resolver.updateKingdom(testKingdom.id, input, testUser);

      expect(result.id).toBe(testKingdom.id);
      expect(result.name).toBe('Updated Kingdom Name');
    });
  });

  describe('setKingdomLevel Mutation', () => {
    it('should set kingdom level', async () => {
      const result = await resolver.setKingdomLevel(testKingdom.id, 5, testUser);

      expect(result.id).toBe(testKingdom.id);
      expect(result.level).toBe(5);
    });
  });

  describe('defineKingdomVariableSchema Mutation', () => {
    it('should define a string variable schema', async () => {
      const input = {
        name: 'kingdomMotto',
        type: VariableTypeEnum.STRING,
        description: "The kingdom's motto",
      };

      const result = await resolver.defineKingdomVariableSchema(testKingdom.id, input, testUser);

      expect(result.name).toBe('kingdomMotto');
      expect(result.type).toBe(VariableTypeEnum.STRING);
      expect(result.description).toBe("The kingdom's motto");
    });

    it('should define a number variable schema', async () => {
      const input = {
        name: 'treasury',
        type: VariableTypeEnum.NUMBER,
        defaultValue: 0,
        description: "Kingdom's treasury in gold",
      };

      const result = await resolver.defineKingdomVariableSchema(testKingdom.id, input, testUser);

      expect(result.name).toBe('treasury');
      expect(result.type).toBe(VariableTypeEnum.NUMBER);
      expect(result.defaultValue).toBe(0);
    });

    it('should define an enum variable schema', async () => {
      const input = {
        name: 'governmentType',
        type: VariableTypeEnum.ENUM,
        enumValues: ['Monarchy', 'Republic', 'Theocracy'],
        defaultValue: 'Monarchy',
        description: 'Type of government',
      };

      const result = await resolver.defineKingdomVariableSchema(testKingdom.id, input, testUser);

      expect(result.name).toBe('governmentType');
      expect(result.type).toBe(VariableTypeEnum.ENUM);
      expect(result.enumValues).toEqual(['Monarchy', 'Republic', 'Theocracy']);
      expect(result.defaultValue).toBe('Monarchy');
    });
  });

  describe('setKingdomVariable Mutation', () => {
    it('should set a string variable', async () => {
      const input = {
        name: 'kingdomMotto',
        value: 'United we stand',
      };

      const result = await resolver.setKingdomVariable(testKingdom.id, input, testUser);

      expect(result.name).toBe('kingdomMotto');
      expect(result.value).toBe('United we stand');
    });

    it('should set a number variable', async () => {
      const input = {
        name: 'treasury',
        value: 10000,
      };

      const result = await resolver.setKingdomVariable(testKingdom.id, input, testUser);

      expect(result.name).toBe('treasury');
      expect(result.value).toBe(10000);
    });

    it('should set an enum variable', async () => {
      const input = {
        name: 'governmentType',
        value: 'Republic',
      };

      const result = await resolver.setKingdomVariable(testKingdom.id, input, testUser);

      expect(result.name).toBe('governmentType');
      expect(result.value).toBe('Republic');
    });

    it('should reject invalid enum value', async () => {
      const input = {
        name: 'governmentType',
        value: 'Invalid Government',
      };

      await expect(resolver.setKingdomVariable(testKingdom.id, input, testUser)).rejects.toThrow();
    });
  });

  describe('kingdomVariable Query', () => {
    it('should return a variable value', async () => {
      const result = await resolver.kingdomVariable(testKingdom.id, 'kingdomMotto', testUser);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('kingdomMotto');
      expect(result?.value).toBe('United we stand');
    });

    it('should return null for non-existent variable', async () => {
      const result = await resolver.kingdomVariable(testKingdom.id, 'nonExistent', testUser);

      expect(result).toBeNull();
    });
  });

  describe('kingdomVariables Query', () => {
    it('should return all variables', async () => {
      const result = await resolver.kingdomVariables(testKingdom.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some((v) => v.name === 'kingdomMotto')).toBe(true);
      expect(result.some((v) => v.name === 'treasury')).toBe(true);
      expect(result.some((v) => v.name === 'governmentType')).toBe(true);
    });
  });

  describe('kingdomVariableSchemas Query', () => {
    it('should return all variable schemas', async () => {
      const result = await resolver.kingdomVariableSchemas(testKingdom.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some((s) => s.name === 'kingdomMotto')).toBe(true);
      expect(result.some((s) => s.name === 'treasury')).toBe(true);
      expect(result.some((s) => s.name === 'governmentType')).toBe(true);
    });
  });

  describe('deleteKingdomVariableSchema Mutation', () => {
    it('should delete a variable schema and its value', async () => {
      const result = await resolver.deleteKingdomVariableSchema(
        testKingdom.id,
        'kingdomMotto',
        testUser
      );

      expect(result).toBe(true);

      // Verify schema was deleted
      const schemas = await resolver.kingdomVariableSchemas(testKingdom.id, testUser);
      expect(schemas.some((s) => s.name === 'kingdomMotto')).toBe(false);

      // Verify variable was deleted
      const variable = await resolver.kingdomVariable(testKingdom.id, 'kingdomMotto', testUser);
      expect(variable).toBeNull();
    });
  });

  describe('deleteKingdom Mutation', () => {
    it('should soft delete a kingdom', async () => {
      const result = await resolver.deleteKingdom(testKingdom.id, testUser);

      expect(result.id).toBe(testKingdom.id);
      expect(result.deletedAt).not.toBeNull();
    });
  });

  describe('archiveKingdom Mutation', () => {
    it('should archive a kingdom', async () => {
      // First restore the deleted kingdom
      await prisma.kingdom.update({
        where: { id: testKingdom.id },
        data: { deletedAt: null },
      });

      const result = await resolver.archiveKingdom(testKingdom.id, testUser);

      expect(result.id).toBe(testKingdom.id);
      expect(result.archivedAt).not.toBeNull();
    });
  });

  describe('restoreKingdom Mutation', () => {
    it('should restore an archived kingdom', async () => {
      const result = await resolver.restoreKingdom(testKingdom.id, testUser);

      expect(result.id).toBe(testKingdom.id);
      expect(result.archivedAt).toBeNull();
    });
  });
});
