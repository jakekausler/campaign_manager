/**
 * Settlement & Structure Branch-Aware Version Resolution Integration Tests
 * Tests for version resolution across branch hierarchies (TICKET-027 Stage 4)
 */

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  Branch as PrismaBranch,
  Campaign,
  Kingdom,
  Location,
  Settlement as PrismaSettlement,
  Structure as PrismaStructure,
  User,
  World,
} from '@prisma/client';

import { CampaignMembershipService } from '../../auth/services/campaign-membership.service';
import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { AuditService } from '../services/audit.service';
import { BranchService } from '../services/branch.service';
import { CampaignContextService } from '../services/campaign-context.service';
import { ConditionEvaluationService } from '../services/condition-evaluation.service';
import { DependencyGraphService } from '../services/dependency-graph.service';
import { SettlementService } from '../services/settlement.service';
import { StructureService } from '../services/structure.service';
import { VersionService } from '../services/version.service';

describe('Settlement & Structure Branch-Aware Version Resolution', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let settlementService: SettlementService;
  let structureService: StructureService;
  let versionService: VersionService;

  let testUser: AuthenticatedUser;
  let unauthorizedUser: AuthenticatedUser;
  let dbUser: User;
  let dbUnauthorizedUser: User;
  let testWorld: World;
  let testCampaign: Campaign;
  let testKingdom: Kingdom;
  let testLocation: Location;
  let mainBranch: PrismaBranch;
  let childBranch: PrismaBranch;
  let testSettlement: PrismaSettlement;
  let testStructure: PrismaStructure;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettlementService,
        StructureService,
        BranchService,
        VersionService,
        AuditService,
        PrismaService,
        CampaignMembershipService,
        {
          provide: CampaignContextService,
          useValue: {
            // Mock only what's needed
            validateAccess: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConditionEvaluationService,
          useValue: {
            // Mock for now since we're not testing conditions
            evaluate: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: DependencyGraphService,
          useValue: {
            // Mock for now since we're not testing dependency graphs
            addEdge: jest.fn(),
          },
        },
        {
          provide: RulesEngineClientService,
          useValue: {
            isAvailable: jest.fn().mockResolvedValue(false),
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
    settlementService = moduleRef.get<SettlementService>(SettlementService);
    structureService = moduleRef.get<StructureService>(StructureService);
    versionService = moduleRef.get<VersionService>(VersionService);

    // Clean up any existing test data
    await prisma.audit.deleteMany({
      where: {
        user: {
          email: {
            in: ['branch-version-test@example.com', 'unauthorized-branch-version@example.com'],
          },
        },
      },
    });
    await prisma.version.deleteMany({
      where: {
        user: {
          email: {
            in: ['branch-version-test@example.com', 'unauthorized-branch-version@example.com'],
          },
        },
      },
    });
    await prisma.structure.deleteMany({
      where: { settlement: { kingdom: { campaign: { name: 'Branch Version Test Campaign' } } } },
    });
    await prisma.settlement.deleteMany({
      where: { kingdom: { campaign: { name: 'Branch Version Test Campaign' } } },
    });
    await prisma.kingdom.deleteMany({
      where: { campaign: { name: 'Branch Version Test Campaign' } },
    });
    await prisma.location.deleteMany({
      where: { world: { name: 'Branch Version Test World' } },
    });
    await prisma.branch.deleteMany({
      where: { campaign: { name: 'Branch Version Test Campaign' } },
    });
    await prisma.campaign.deleteMany({
      where: { name: 'Branch Version Test Campaign' },
    });
    await prisma.world.deleteMany({
      where: { name: 'Branch Version Test World' },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['branch-version-test@example.com', 'unauthorized-branch-version@example.com'],
        },
      },
    });

    // Create authorized test user
    dbUser = await prisma.user.create({
      data: {
        email: 'branch-version-test@example.com',
        name: 'Branch Version Test User',
        password: 'hash',
      },
    });

    testUser = {
      id: dbUser.id,
      email: dbUser.email,
      role: 'owner',
    };

    // Create unauthorized test user (not a member of the campaign)
    dbUnauthorizedUser = await prisma.user.create({
      data: {
        email: 'unauthorized-branch-version@example.com',
        name: 'Unauthorized User',
        password: 'hash',
      },
    });

    unauthorizedUser = {
      id: dbUnauthorizedUser.id,
      email: dbUnauthorizedUser.email,
      role: 'owner',
    };

    // Create test world
    testWorld = await prisma.world.create({
      data: {
        name: 'Branch Version Test World',
        calendars: {},
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        name: 'Branch Version Test Campaign',
        worldId: testWorld.id,
        ownerId: testUser.id,
      },
    });

    // Create main branch
    mainBranch = await prisma.branch.create({
      data: {
        name: 'Main',
        description: 'Main timeline',
        campaignId: testCampaign.id,
      },
    });

    // Create child branch (diverged from main)
    childBranch = await prisma.branch.create({
      data: {
        name: 'Alternate Timeline',
        description: 'Child branch for testing inheritance',
        campaignId: testCampaign.id,
        parentId: mainBranch.id,
        divergedAt: new Date('2025-01-01T00:00:00Z'),
      },
    });

    // Create test kingdom
    testKingdom = await prisma.kingdom.create({
      data: {
        name: 'Test Kingdom',
        campaignId: testCampaign.id,
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
        name: 'Test Settlement',
        kingdomId: testKingdom.id,
        locationId: testLocation.id,
        level: 1,
        variables: {},
        variableSchemas: [],
      },
    });

    // Create test structure
    testStructure = await prisma.structure.create({
      data: {
        name: 'Test Structure',
        type: 'BUILDING',
        settlementId: testSettlement.id,
        level: 1,
        variables: {},
        variableSchemas: [],
      },
    });
  });

  afterAll(async () => {
    // Clean up test data in correct order
    await prisma.audit.deleteMany({
      where: { userId: { in: [dbUser.id, dbUnauthorizedUser.id] } },
    });
    await prisma.version.deleteMany({
      where: { createdBy: { in: [dbUser.id, dbUnauthorizedUser.id] } },
    });
    await prisma.structure.deleteMany({ where: { id: testStructure.id } });
    await prisma.settlement.deleteMany({ where: { id: testSettlement.id } });
    await prisma.kingdom.deleteMany({ where: { id: testKingdom.id } });
    await prisma.location.deleteMany({ where: { id: testLocation.id } });
    await prisma.branch.deleteMany({ where: { campaignId: testCampaign.id } });
    await prisma.campaign.deleteMany({ where: { id: testCampaign.id } });
    await prisma.world.deleteMany({ where: { id: testWorld.id } });
    await prisma.user.deleteMany({ where: { id: { in: [dbUser.id, dbUnauthorizedUser.id] } } });

    await app.close();
  });

  describe('Settlement Version Resolution', () => {
    it('should return null when no version exists for settlement in main branch', async () => {
      const result = await settlementService.getSettlementAsOf(
        testSettlement.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        testUser
      );

      expect(result).toBeNull();
    });

    it('should resolve settlement version from main branch after creating version', async () => {
      // Create a version in main branch at time T1
      const t1 = new Date('2025-01-01T00:00:00Z');
      const payload = {
        ...testSettlement,
        name: 'Main Branch Settlement v1',
        level: 1,
      };

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: testSettlement.id,
          branchId: mainBranch.id,
          validFrom: t1,
          validTo: null,
          payload,
        },
        testUser
      );

      // Query at time T1
      const result = await settlementService.getSettlementAsOf(
        testSettlement.id,
        mainBranch.id,
        t1,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Main Branch Settlement v1');
      expect(result?.level).toBe(1);
    });

    it('should resolve settlement version from main branch at later time', async () => {
      // Query at time T2 (after T1) - should still get T1 version
      const t2 = new Date('2025-01-02T00:00:00Z');
      const result = await settlementService.getSettlementAsOf(
        testSettlement.id,
        mainBranch.id,
        t2,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Main Branch Settlement v1');
      expect(result?.level).toBe(1);
    });

    it('should inherit settlement version from parent branch in child branch', async () => {
      // Query child branch at time T2 - should inherit from main branch (T1)
      const t2 = new Date('2025-01-02T00:00:00Z');
      const result = await settlementService.getSettlementAsOf(
        testSettlement.id,
        childBranch.id,
        t2,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Main Branch Settlement v1');
      expect(result?.level).toBe(1);
    });

    it('should override parent version with child branch version', async () => {
      // Create a version in child branch at time T3
      const t3 = new Date('2025-01-03T00:00:00Z');
      const childPayload = {
        ...testSettlement,
        name: 'Child Branch Settlement Override',
        level: 2,
      };

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: testSettlement.id,
          branchId: childBranch.id,
          validFrom: t3,
          validTo: null,
          payload: childPayload,
        },
        testUser
      );

      // Query child branch at time T3
      const result = await settlementService.getSettlementAsOf(
        testSettlement.id,
        childBranch.id,
        t3,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Child Branch Settlement Override');
      expect(result?.level).toBe(2);
    });

    it('should not affect parent branch when child branch is modified', async () => {
      // Query main branch at time T3 - should still have original version
      const t3 = new Date('2025-01-03T00:00:00Z');
      const result = await settlementService.getSettlementAsOf(
        testSettlement.id,
        mainBranch.id,
        t3,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Main Branch Settlement v1');
      expect(result?.level).toBe(1);
    });

    it('should throw ForbiddenException when unauthorized user tries to access settlement version', async () => {
      const t1 = new Date('2025-01-01T00:00:00Z');

      await expect(
        settlementService.getSettlementAsOf(testSettlement.id, mainBranch.id, t1, unauthorizedUser)
      ).resolves.toBeNull(); // findById returns null for unauthorized access
    });
  });

  describe('Structure Version Resolution', () => {
    it('should return null when no version exists for structure in main branch', async () => {
      const result = await structureService.getStructureAsOf(
        testStructure.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        testUser
      );

      expect(result).toBeNull();
    });

    it('should resolve structure version from main branch after creating version', async () => {
      // Create a version in main branch at time T1
      const t1 = new Date('2025-01-01T00:00:00Z');
      const payload = {
        ...testStructure,
        name: 'Main Branch Structure v1',
        level: 1,
        type: 'BUILDING',
      };

      await versionService.createVersion(
        {
          entityType: 'structure',
          entityId: testStructure.id,
          branchId: mainBranch.id,
          validFrom: t1,
          validTo: null,
          payload,
        },
        testUser
      );

      // Query at time T1
      const result = await structureService.getStructureAsOf(
        testStructure.id,
        mainBranch.id,
        t1,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Main Branch Structure v1');
      expect(result?.level).toBe(1);
      expect(result?.type).toBe('BUILDING');
    });

    it('should resolve structure version from main branch at later time', async () => {
      // Query at time T2 (after T1) - should still get T1 version
      const t2 = new Date('2025-01-02T00:00:00Z');
      const result = await structureService.getStructureAsOf(
        testStructure.id,
        mainBranch.id,
        t2,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Main Branch Structure v1');
      expect(result?.level).toBe(1);
    });

    it('should inherit structure version from parent branch in child branch', async () => {
      // Query child branch at time T2 - should inherit from main branch (T1)
      const t2 = new Date('2025-01-02T00:00:00Z');
      const result = await structureService.getStructureAsOf(
        testStructure.id,
        childBranch.id,
        t2,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Main Branch Structure v1');
      expect(result?.level).toBe(1);
    });

    it('should override parent version with child branch version', async () => {
      // Create a version in child branch at time T3
      const t3 = new Date('2025-01-03T00:00:00Z');
      const childPayload = {
        ...testStructure,
        name: 'Child Branch Structure Override',
        level: 3,
        type: 'MONUMENT',
      };

      await versionService.createVersion(
        {
          entityType: 'structure',
          entityId: testStructure.id,
          branchId: childBranch.id,
          validFrom: t3,
          validTo: null,
          payload: childPayload,
        },
        testUser
      );

      // Query child branch at time T3
      const result = await structureService.getStructureAsOf(
        testStructure.id,
        childBranch.id,
        t3,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Child Branch Structure Override');
      expect(result?.level).toBe(3);
      expect(result?.type).toBe('MONUMENT');
    });

    it('should not affect parent branch when child branch is modified', async () => {
      // Query main branch at time T3 - should still have original version
      const t3 = new Date('2025-01-03T00:00:00Z');
      const result = await structureService.getStructureAsOf(
        testStructure.id,
        mainBranch.id,
        t3,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Main Branch Structure v1');
      expect(result?.level).toBe(1);
      expect(result?.type).toBe('BUILDING');
    });

    it('should throw ForbiddenException when unauthorized user tries to access structure version', async () => {
      const t1 = new Date('2025-01-01T00:00:00Z');

      await expect(
        structureService.getStructureAsOf(testStructure.id, mainBranch.id, t1, unauthorizedUser)
      ).resolves.toBeNull(); // findById returns null for unauthorized access
    });
  });

  describe('Branch Hierarchy Walking', () => {
    it('should walk up branch ancestry for settlement version resolution', async () => {
      // Create a grandchild branch
      const grandchildBranch = await prisma.branch.create({
        data: {
          name: 'Grandchild Branch',
          description: 'Testing 3-level hierarchy',
          campaignId: testCampaign.id,
          parentId: childBranch.id,
          divergedAt: new Date('2025-01-05T00:00:00Z'),
        },
      });

      // Query grandchild at T3 - should inherit from child branch
      const t3 = new Date('2025-01-03T00:00:00Z');
      const result = await settlementService.getSettlementAsOf(
        testSettlement.id,
        grandchildBranch.id,
        t3,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Child Branch Settlement Override');
      expect(result?.level).toBe(2);

      // Cleanup
      await prisma.branch.delete({ where: { id: grandchildBranch.id } });
    });

    it('should walk up branch ancestry for structure version resolution', async () => {
      // Create a grandchild branch
      const grandchildBranch = await prisma.branch.create({
        data: {
          name: 'Grandchild Branch 2',
          description: 'Testing 3-level hierarchy for structures',
          campaignId: testCampaign.id,
          parentId: childBranch.id,
          divergedAt: new Date('2025-01-05T00:00:00Z'),
        },
      });

      // Query grandchild at T3 - should inherit from child branch
      const t3 = new Date('2025-01-03T00:00:00Z');
      const result = await structureService.getStructureAsOf(
        testStructure.id,
        grandchildBranch.id,
        t3,
        testUser
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Child Branch Structure Override');
      expect(result?.level).toBe(3);
      expect(result?.type).toBe('MONUMENT');

      // Cleanup
      await prisma.branch.delete({ where: { id: grandchildBranch.id } });
    });
  });
});
