/**
 * Party Resolver Integration Tests
 * Tests for Party GraphQL queries and mutations
 */

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Campaign, Character, Party as PrismaParty, User } from '@prisma/client';

import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { AuditService } from '../services/audit.service';
import { CampaignContextService } from '../services/campaign-context.service';
import { CharacterService } from '../services/character.service';
import { KingdomService } from '../services/kingdom.service';
import { PartyService } from '../services/party.service';
import { SettlementService } from '../services/settlement.service';
import { StructureService } from '../services/structure.service';
import { VariableSchemaService } from '../services/variable-schema.service';
import { VersionService } from '../services/version.service';
import { VariableTypeEnum } from '../types/variable-schema.types';

import { PartyResolver } from './party.resolver';

// TODO: Fix circular dependency issue causing Jest worker crashes
// These tests work individually but cause stack overflow when run with all other tests
// See: https://github.com/nestjs/nest/issues/1165
describe.skip('PartyResolver Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolver: PartyResolver;

  let testUser: AuthenticatedUser;
  let dbUser: User;
  let testCampaign: Campaign;
  let testWorld: { id: string; name: string };
  let testBranch: { id: string; name: string };
  let testParty: PrismaParty;
  let testCharacter1: Character;
  let testCharacter2: Character;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PartyResolver,
        PartyService,
        CharacterService,
        VariableSchemaService,
        VersionService,
        AuditService,
        CampaignContextService,
        // Add all services that CampaignContextService depends on to resolve circular dependencies
        KingdomService,
        SettlementService,
        StructureService,
        PrismaService,
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn(),
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

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    resolver = moduleRef.get<PartyResolver>(PartyResolver);

    // Create test user
    dbUser = await prisma.user.create({
      data: {
        email: 'party-test@example.com',
        name: 'Party Test User',
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
        name: 'Party Test Campaign',
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

    // Create test characters
    testCharacter1 = await prisma.character.create({
      data: {
        campaignId: testCampaign.id,
        name: 'Test Character 1',
        level: 5,
      },
    });

    testCharacter2 = await prisma.character.create({
      data: {
        campaignId: testCampaign.id,
        name: 'Test Character 2',
        level: 7,
      },
    });

    // Create test party
    testParty = await prisma.party.create({
      data: {
        campaignId: testCampaign.id,
        name: 'Test Party',
        averageLevel: 6,
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

    // 3. Delete characters
    await prisma.character.deleteMany({ where: { campaignId: testCampaign.id } });

    // 4. Delete parties
    await prisma.party.deleteMany({ where: { campaignId: testCampaign.id } });

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

  describe('party Query', () => {
    it('should return party by ID', async () => {
      const result = await resolver.party(testParty.id, testUser);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(testParty.id);
      expect(result?.name).toBe('Test Party');
      expect(result?.campaignId).toBe(testCampaign.id);
    });

    it('should return null for non-existent party', async () => {
      const result = await resolver.party('non-existent-id', testUser);

      expect(result).toBeNull();
    });
  });

  describe('partiesByCampaign Query', () => {
    it('should return all parties for a campaign', async () => {
      const result = await resolver.partiesByCampaign(testCampaign.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((p) => p.id === testParty.id)).toBe(true);
    });
  });

  describe('createParty Mutation', () => {
    it('should create a new party', async () => {
      const input = {
        campaignId: testCampaign.id,
        name: 'New Party',
        averageLevel: 3,
      };

      const result = await resolver.createParty(input, testUser);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('New Party');
      expect(result.averageLevel).toBe(3);
      expect(result.campaignId).toBe(testCampaign.id);

      // Clean up
      await prisma.party.delete({ where: { id: result.id } });
    });
  });

  describe('updateParty Mutation', () => {
    it('should update a party', async () => {
      const input = {
        name: 'Updated Party Name',
        branchId: testBranch.id,
        expectedVersion: 1,
      };

      const result = await resolver.updateParty(testParty.id, input, testUser);

      expect(result.id).toBe(testParty.id);
      expect(result.name).toBe('Updated Party Name');
    });
  });

  describe('setPartyLevel Mutation', () => {
    it('should set party level (manual override)', async () => {
      const result = await resolver.setPartyLevel(testParty.id, 10, testUser);

      expect(result.id).toBe(testParty.id);
      expect(result.manualLevelOverride).toBe(10);
    });
  });

  describe('addPartyMember Mutation', () => {
    it('should add a character to the party', async () => {
      const input = {
        partyId: testParty.id,
        characterId: testCharacter1.id,
      };

      const result = await resolver.addPartyMember(input, testUser);

      expect(result.id).toBe(testParty.id);

      // Verify character was added
      const updatedParty = await prisma.party.findUnique({
        where: { id: testParty.id },
        include: { members: true },
      });

      expect(updatedParty?.members.some((m) => m.id === testCharacter1.id)).toBe(true);
    });

    it('should add a second character to the party', async () => {
      const input = {
        partyId: testParty.id,
        characterId: testCharacter2.id,
      };

      const result = await resolver.addPartyMember(input, testUser);

      expect(result.id).toBe(testParty.id);

      // Verify character was added
      const updatedParty = await prisma.party.findUnique({
        where: { id: testParty.id },
        include: { members: true },
      });

      expect(updatedParty?.members.some((m) => m.id === testCharacter2.id)).toBe(true);
      expect(updatedParty?.members.length).toBe(2);
    });
  });

  describe('removePartyMember Mutation', () => {
    it('should remove a character from the party', async () => {
      const input = {
        partyId: testParty.id,
        characterId: testCharacter1.id,
      };

      const result = await resolver.removePartyMember(input, testUser);

      expect(result.id).toBe(testParty.id);

      // Verify character was removed
      const updatedParty = await prisma.party.findUnique({
        where: { id: testParty.id },
        include: { members: true },
      });

      expect(updatedParty?.members.some((m) => m.id === testCharacter1.id)).toBe(false);
    });
  });

  describe('definePartyVariableSchema Mutation', () => {
    it('should define a string variable schema', async () => {
      const input = {
        name: 'partyMotto',
        type: VariableTypeEnum.STRING,
        description: "The party's motto",
      };

      const result = await resolver.definePartyVariableSchema(testParty.id, input, testUser);

      expect(result.name).toBe('partyMotto');
      expect(result.type).toBe(VariableTypeEnum.STRING);
      expect(result.description).toBe("The party's motto");
    });

    it('should define a number variable schema', async () => {
      const input = {
        name: 'goldCoins',
        type: VariableTypeEnum.NUMBER,
        defaultValue: 0,
        description: "Party's gold coins",
      };

      const result = await resolver.definePartyVariableSchema(testParty.id, input, testUser);

      expect(result.name).toBe('goldCoins');
      expect(result.type).toBe(VariableTypeEnum.NUMBER);
      expect(result.defaultValue).toBe(0);
    });

    it('should define an enum variable schema', async () => {
      const input = {
        name: 'alignment',
        type: VariableTypeEnum.ENUM,
        enumValues: ['Lawful Good', 'Chaotic Good', 'Neutral'],
        defaultValue: 'Neutral',
        description: 'Party alignment',
      };

      const result = await resolver.definePartyVariableSchema(testParty.id, input, testUser);

      expect(result.name).toBe('alignment');
      expect(result.type).toBe(VariableTypeEnum.ENUM);
      expect(result.enumValues).toEqual(['Lawful Good', 'Chaotic Good', 'Neutral']);
      expect(result.defaultValue).toBe('Neutral');
    });
  });

  describe('setPartyVariable Mutation', () => {
    it('should set a string variable', async () => {
      const input = {
        name: 'partyMotto',
        value: 'For honor and glory!',
      };

      const result = await resolver.setPartyVariable(testParty.id, input, testUser);

      expect(result.name).toBe('partyMotto');
      expect(result.value).toBe('For honor and glory!');
    });

    it('should set a number variable', async () => {
      const input = {
        name: 'goldCoins',
        value: 500,
      };

      const result = await resolver.setPartyVariable(testParty.id, input, testUser);

      expect(result.name).toBe('goldCoins');
      expect(result.value).toBe(500);
    });

    it('should set an enum variable', async () => {
      const input = {
        name: 'alignment',
        value: 'Lawful Good',
      };

      const result = await resolver.setPartyVariable(testParty.id, input, testUser);

      expect(result.name).toBe('alignment');
      expect(result.value).toBe('Lawful Good');
    });

    it('should reject invalid enum value', async () => {
      const input = {
        name: 'alignment',
        value: 'Invalid Alignment',
      };

      await expect(resolver.setPartyVariable(testParty.id, input, testUser)).rejects.toThrow();
    });
  });

  describe('partyVariable Query', () => {
    it('should return a variable value', async () => {
      const result = await resolver.partyVariable(testParty.id, 'partyMotto', testUser);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('partyMotto');
      expect(result?.value).toBe('For honor and glory!');
    });

    it('should return null for non-existent variable', async () => {
      const result = await resolver.partyVariable(testParty.id, 'nonExistent', testUser);

      expect(result).toBeNull();
    });
  });

  describe('partyVariables Query', () => {
    it('should return all variables', async () => {
      const result = await resolver.partyVariables(testParty.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some((v) => v.name === 'partyMotto')).toBe(true);
      expect(result.some((v) => v.name === 'goldCoins')).toBe(true);
      expect(result.some((v) => v.name === 'alignment')).toBe(true);
    });
  });

  describe('partyVariableSchemas Query', () => {
    it('should return all variable schemas', async () => {
      const result = await resolver.partyVariableSchemas(testParty.id, testUser);

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some((s) => s.name === 'partyMotto')).toBe(true);
      expect(result.some((s) => s.name === 'goldCoins')).toBe(true);
      expect(result.some((s) => s.name === 'alignment')).toBe(true);
    });
  });

  describe('deletePartyVariableSchema Mutation', () => {
    it('should delete a variable schema and its value', async () => {
      const result = await resolver.deletePartyVariableSchema(testParty.id, 'partyMotto', testUser);

      expect(result).toBe(true);

      // Verify schema was deleted
      const schemas = await resolver.partyVariableSchemas(testParty.id, testUser);
      expect(schemas.some((s) => s.name === 'partyMotto')).toBe(false);

      // Verify variable was deleted
      const variable = await resolver.partyVariable(testParty.id, 'partyMotto', testUser);
      expect(variable).toBeNull();
    });
  });

  describe('deleteParty Mutation', () => {
    it('should soft delete a party', async () => {
      const result = await resolver.deleteParty(testParty.id, testUser);

      expect(result.id).toBe(testParty.id);
      expect(result.deletedAt).not.toBeNull();
    });
  });

  describe('archiveParty Mutation', () => {
    it('should archive a party', async () => {
      // First restore the deleted party
      await prisma.party.update({
        where: { id: testParty.id },
        data: { deletedAt: null },
      });

      const result = await resolver.archiveParty(testParty.id, testUser);

      expect(result.id).toBe(testParty.id);
      expect(result.archivedAt).not.toBeNull();
    });
  });

  describe('restoreParty Mutation', () => {
    it('should restore an archived party', async () => {
      const result = await resolver.restoreParty(testParty.id, testUser);

      expect(result.id).toBe(testParty.id);
      expect(result.archivedAt).toBeNull();
    });
  });
});
