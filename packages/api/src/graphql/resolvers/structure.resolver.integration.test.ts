/**
 * Structure Resolver Integration Tests
 * Tests for Structure GraphQL queries and mutations
 */

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  Campaign,
  Kingdom,
  Location,
  Settlement,
  Structure as PrismaStructure,
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

import { StructureResolver } from './structure.resolver';

// TODO: Fix circular dependency issue causing Jest worker crashes
// These tests work individually but cause stack overflow when run with all other tests
// See: https://github.com/nestjs/nest/issues/1165
describe.skip('StructureResolver Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolver: StructureResolver;

  let testUser: AuthenticatedUser;
  let dbUser: User;
  let testCampaign: Campaign;
  let testWorld: { id: string; name: string };
  let testBranch: { id: string; name: string };
  let testKingdom: Kingdom;
  let testLocation: Location;
  let testSettlement: Settlement;
  let testStructure: PrismaStructure;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StructureResolver,
        StructureService,
        VariableSchemaService,
        VersionService,
        AuditService,
        CampaignContextService,
        // Add all services that CampaignContextService depends on to resolve circular dependencies
        PartyService,
        KingdomService,
        SettlementService,
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
    resolver = moduleRef.get<StructureResolver>(StructureResolver);

    // Create test user
    dbUser = await prisma.user.create({
      data: {
        email: 'structure-test@example.com',
        name: 'Structure Test User',
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
        name: 'Structure Test World',
        calendars: {},
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        name: 'Structure Test Campaign',
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

    // Create test structure
    testStructure = await prisma.structure.create({
      data: {
        settlementId: testSettlement.id,
        type: 'temple',
        name: 'Test Temple',
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
    await prisma.structure.deleteMany({ where: { settlementId: testSettlement.id } });

    // 4. Delete settlements
    await prisma.settlement.deleteMany({ where: { id: testSettlement.id } });

    // 5. Delete kingdoms
    await prisma.kingdom.deleteMany({ where: { id: testKingdom.id } });

    // 6. Delete locations
    await prisma.location.deleteMany({ where: { id: testLocation.id } });

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

  describe('structure Query', () => {
    it('should return structure by ID', async () => {
      const result = await resolver.structure(testStructure.id, testUser);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testStructure.id);
      expect(result?.name).toBe('Test Temple');
      expect(result?.type).toBe('temple');
      expect(result?.settlementId).toBe(testSettlement.id);
      expect(result?.level).toBe(1);
    });

    it('should return null for non-existent structure', async () => {
      const result = await resolver.structure('non-existent-id', testUser);

      expect(result).toBeNull();
    });
  });

  describe('structuresBySettlement Query', () => {
    it('should return all structures for a settlement', async () => {
      const result = await resolver.structuresBySettlement(testSettlement.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((s) => s.id === testStructure.id)).toBe(true);
    });
  });

  describe('createStructure Mutation', () => {
    it('should create a new structure', async () => {
      const input = {
        settlementId: testSettlement.id,
        type: 'barracks',
        name: 'New Barracks',
        level: 2,
      };

      const result = await resolver.createStructure(input, testUser);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('New Barracks');
      expect(result.type).toBe('barracks');
      expect(result.level).toBe(2);
      expect(result.settlementId).toBe(testSettlement.id);

      // Clean up
      await prisma.structure.delete({ where: { id: result.id } });
    });
  });

  describe('updateStructure Mutation', () => {
    it('should update a structure', async () => {
      const input = {
        name: 'Updated Temple Name',
        branchId: testBranch.id,
        expectedVersion: 1,
      };

      const result = await resolver.updateStructure(testStructure.id, input, testUser);

      expect(result.id).toBe(testStructure.id);
      expect(result.name).toBe('Updated Temple Name');
    });
  });

  describe('setStructureLevel Mutation', () => {
    it('should set structure level', async () => {
      const result = await resolver.setStructureLevel(testStructure.id, 5, testUser);

      expect(result.id).toBe(testStructure.id);
      expect(result.level).toBe(5);
    });
  });

  describe('defineStructureVariableSchema Mutation', () => {
    it('should define a string variable schema', async () => {
      const input = {
        name: 'deity',
        type: VariableTypeEnum.STRING,
        description: 'The deity worshipped at this temple',
      };

      const result = await resolver.defineStructureVariableSchema(
        testStructure.id,
        input,
        testUser
      );

      expect(result.name).toBe('deity');
      expect(result.type).toBe(VariableTypeEnum.STRING);
      expect(result.description).toBe('The deity worshipped at this temple');
    });

    it('should define a number variable schema', async () => {
      const input = {
        name: 'worshippers',
        type: VariableTypeEnum.NUMBER,
        defaultValue: 0,
        description: 'Number of regular worshippers',
      };

      const result = await resolver.defineStructureVariableSchema(
        testStructure.id,
        input,
        testUser
      );

      expect(result.name).toBe('worshippers');
      expect(result.type).toBe(VariableTypeEnum.NUMBER);
      expect(result.defaultValue).toBe(0);
    });

    it('should define an enum variable schema', async () => {
      const input = {
        name: 'status',
        type: VariableTypeEnum.ENUM,
        enumValues: ['Active', 'Maintenance', 'Abandoned'],
        defaultValue: 'Active',
        description: 'Operating status of the structure',
      };

      const result = await resolver.defineStructureVariableSchema(
        testStructure.id,
        input,
        testUser
      );

      expect(result.name).toBe('status');
      expect(result.type).toBe(VariableTypeEnum.ENUM);
      expect(result.enumValues).toEqual(['Active', 'Maintenance', 'Abandoned']);
      expect(result.defaultValue).toBe('Active');
    });
  });

  describe('setStructureVariable Mutation', () => {
    it('should set a string variable', async () => {
      const input = {
        name: 'deity',
        value: 'Bahamut',
      };

      const result = await resolver.setStructureVariable(testStructure.id, input, testUser);

      expect(result.name).toBe('deity');
      expect(result.value).toBe('Bahamut');
    });

    it('should set a number variable', async () => {
      const input = {
        name: 'worshippers',
        value: 150,
      };

      const result = await resolver.setStructureVariable(testStructure.id, input, testUser);

      expect(result.name).toBe('worshippers');
      expect(result.value).toBe(150);
    });

    it('should set an enum variable', async () => {
      const input = {
        name: 'status',
        value: 'Active',
      };

      const result = await resolver.setStructureVariable(testStructure.id, input, testUser);

      expect(result.name).toBe('status');
      expect(result.value).toBe('Active');
    });

    it('should reject invalid enum value', async () => {
      const input = {
        name: 'status',
        value: 'Invalid Status',
      };

      await expect(
        resolver.setStructureVariable(testStructure.id, input, testUser)
      ).rejects.toThrow();
    });
  });

  describe('structureVariable Query', () => {
    it('should return a variable value', async () => {
      const result = await resolver.structureVariable(testStructure.id, 'deity', testUser);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('deity');
      expect(result?.value).toBe('Bahamut');
    });

    it('should return null for non-existent variable', async () => {
      const result = await resolver.structureVariable(testStructure.id, 'nonExistent', testUser);

      expect(result).toBeNull();
    });
  });

  describe('structureVariables Query', () => {
    it('should return all variables', async () => {
      const result = await resolver.structureVariables(testStructure.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some((v) => v.name === 'deity')).toBe(true);
      expect(result.some((v) => v.name === 'worshippers')).toBe(true);
      expect(result.some((v) => v.name === 'status')).toBe(true);
    });
  });

  describe('structureVariableSchemas Query', () => {
    it('should return all variable schemas', async () => {
      const result = await resolver.structureVariableSchemas(testStructure.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some((s) => s.name === 'deity')).toBe(true);
      expect(result.some((s) => s.name === 'worshippers')).toBe(true);
      expect(result.some((s) => s.name === 'status')).toBe(true);
    });
  });

  describe('deleteStructureVariableSchema Mutation', () => {
    it('should delete a variable schema and its value', async () => {
      const result = await resolver.deleteStructureVariableSchema(
        testStructure.id,
        'deity',
        testUser
      );

      expect(result).toBe(true);

      // Verify schema was deleted
      const schemas = await resolver.structureVariableSchemas(testStructure.id, testUser);
      expect(schemas.some((s) => s.name === 'deity')).toBe(false);

      // Verify variable was deleted
      const variable = await resolver.structureVariable(testStructure.id, 'deity', testUser);
      expect(variable).toBeNull();
    });
  });

  describe('deleteStructure Mutation', () => {
    it('should soft delete a structure', async () => {
      const result = await resolver.deleteStructure(testStructure.id, testUser);

      expect(result.id).toBe(testStructure.id);
      expect(result.deletedAt).not.toBeNull();
    });
  });

  describe('archiveStructure Mutation', () => {
    it('should archive a structure', async () => {
      // First restore the deleted structure
      await prisma.structure.update({
        where: { id: testStructure.id },
        data: { deletedAt: null },
      });

      const result = await resolver.archiveStructure(testStructure.id, testUser);

      expect(result.id).toBe(testStructure.id);
      expect(result.archivedAt).not.toBeNull();
    });
  });

  describe('restoreStructure Mutation', () => {
    it('should restore an archived structure', async () => {
      const result = await resolver.restoreStructure(testStructure.id, testUser);

      expect(result.id).toBe(testStructure.id);
      expect(result.archivedAt).toBeNull();
    });
  });
});
