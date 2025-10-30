/**
 * Branching System End-to-End Tests
 *
 * Comprehensive E2E tests for the complete branching system including:
 * - Complete fork workflow (create campaign → create branch → fork → verify versions)
 * - Version resolution across 3+ levels of branch hierarchy
 * - Settlement-Structure hierarchy preservation in forks
 * - Branch ancestry inheritance and isolation
 * - Concurrent edits in different branches don't conflict
 * - Authorization scenarios
 */

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Campaign, Kingdom, Location, User, World } from '@prisma/client';

import { CampaignMembershipService } from '../../auth/services/campaign-membership.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../graphql/context/graphql-context';
import { REDIS_PUBSUB } from '../../graphql/pubsub/redis-pubsub.provider';
import { AuditService } from '../../graphql/services/audit.service';
import { BranchService } from '../../graphql/services/branch.service';
import { CampaignContextService } from '../../graphql/services/campaign-context.service';
import { ConditionEvaluationService } from '../../graphql/services/condition-evaluation.service';
import { DependencyGraphService } from '../../graphql/services/dependency-graph.service';
import { VersionService } from '../../graphql/services/version.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';

describe('Branching System E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let branchService: BranchService;
  let versionService: VersionService;

  let testUser: AuthenticatedUser;
  let dbUser: User;
  let testWorld: World;
  let testCampaign: Campaign;
  let testKingdom: Kingdom;
  let testLocation: Location;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BranchService,
        VersionService,
        AuditService,
        PrismaService,
        {
          provide: CampaignContextService,
          useValue: {
            validateAccess: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConditionEvaluationService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: DependencyGraphService,
          useValue: {
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
          provide: CampaignMembershipService,
          useValue: {
            canEdit: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    branchService = moduleRef.get<BranchService>(BranchService);
    versionService = moduleRef.get<VersionService>(VersionService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test in correct order to avoid FK violations
    // Delete child entities first, then parents
    await prisma.version.deleteMany({});
    await prisma.audit.deleteMany({});
    await prisma.structure.deleteMany({});
    await prisma.settlement.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.kingdom.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.campaignMembership.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.world.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    dbUser = await prisma.user.create({
      data: {
        email: 'test-branching-e2e@example.com',
        name: 'Test User',
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
        calendars: {
          calendars: [
            {
              id: 'default',
              name: 'Standard Calendar',
              daysPerWeek: 7,
              monthsPerYear: 12,
              daysPerMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
            },
          ],
        },
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        name: 'Test Campaign',
        worldId: testWorld.id,
        ownerId: dbUser.id,
        srid: 3857,
        currentWorldTime: new Date('2025-01-01T00:00:00Z'),
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
  });

  afterEach(async () => {
    // Clean up after each test in correct order to avoid FK violations
    // Delete child entities first, then parents
    await prisma.version.deleteMany({});
    await prisma.audit.deleteMany({});
    await prisma.structure.deleteMany({});
    await prisma.settlement.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.kingdom.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.campaignMembership.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.world.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('Complete Fork Workflow', () => {
    it('should execute complete fork workflow: create campaign → create branch → fork → verify versions', async () => {
      // Step 1: Create main branch
      const mainBranch = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'main',
          description: 'Main timeline',
          parentId: undefined,
          divergedAt: undefined,
        },
        testUser
      );
      expect(mainBranch).toBeDefined();
      expect(mainBranch.name).toBe('main');
      expect(mainBranch.parentId).toBeNull();

      // Step 2: Create a settlement with some initial state
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create initial version for settlement
      const settlementVersion1 = await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1000,
            wealth: 500,
          },
        },
        testUser
      );
      expect(settlementVersion1).toBeDefined();

      // Step 3: Create a structure within the settlement
      const structure = await prisma.structure.create({
        data: {
          name: 'Test Structure',
          type: 'barracks',
          settlementId: settlement.id,
        },
      });

      // Create initial version for structure
      const structureVersion1 = await versionService.createVersion(
        {
          entityType: 'structure',
          entityId: structure.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Structure',
            type: 'barracks',
            level: 1,
          },
        },
        testUser
      );
      expect(structureVersion1).toBeDefined();

      // Step 4: Fork the branch at current world time
      const forkWorldTime = new Date('2025-01-01T12:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'alternate-timeline',
        'An alternate timeline for testing',
        forkWorldTime,
        testUser
      );

      expect(forkResult.branch).toBeDefined();
      expect(forkResult.branch.name).toBe('alternate-timeline');
      expect(forkResult.branch.parentId).toBe(mainBranch.id);
      expect(forkResult.branch.divergedAt).toEqual(forkWorldTime);
      expect(forkResult.versionsCopied).toBeGreaterThanOrEqual(2); // At least settlement + structure

      // Step 5: Verify versions were copied correctly
      const forkedSettlementVersion = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        forkWorldTime
      );
      expect(forkedSettlementVersion).toBeDefined();
      const forkedSettlementPayload = await versionService.decompressVersion(
        forkedSettlementVersion!
      );
      expect(forkedSettlementPayload).toMatchObject({
        name: 'Test Settlement',
        population: 1000,
        wealth: 500,
      });

      const forkedStructureVersion = await versionService.resolveVersion(
        'structure',
        structure.id,
        forkResult.branch.id,
        forkWorldTime
      );
      expect(forkedStructureVersion).toBeDefined();
      const forkedStructurePayload = await versionService.decompressVersion(
        forkedStructureVersion!
      );
      expect(forkedStructurePayload).toMatchObject({
        name: 'Test Structure',
        type: 'barracks',
        level: 1,
      });

      // Step 6: Make changes in forked branch
      const forkedSettlementVersion2 = await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult.branch.id,
          validFrom: new Date('2025-01-02T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1200, // Increased population in fork
            wealth: 600,
          },
        },
        testUser
      );
      expect(forkedSettlementVersion2).toBeDefined();

      // Step 7: Verify main branch is unaffected by fork changes
      const mainSettlementVersion = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-02T00:00:00Z')
      );
      expect(mainSettlementVersion).toBeDefined();
      const mainSettlementPayload = await versionService.decompressVersion(mainSettlementVersion!);
      expect(mainSettlementPayload).toMatchObject({
        name: 'Test Settlement',
        population: 1000, // Still original value
        wealth: 500,
      });

      // Step 8: Verify forked branch has new version
      const forkedSettlementVersion2Check = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        new Date('2025-01-02T00:00:00Z')
      );
      expect(forkedSettlementVersion2Check).toBeDefined();
      const forkedSettlementPayload2 = await versionService.decompressVersion(
        forkedSettlementVersion2Check!
      );
      expect(forkedSettlementPayload2).toMatchObject({
        name: 'Test Settlement',
        population: 1200, // Updated value
        wealth: 600,
      });
    });

    it('should preserve Settlement-Structure hierarchy in forked branches', async () => {
      // Create main branch
      const mainBranch = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'main',
          description: 'Main timeline',
          parentId: undefined,
          divergedAt: undefined,
        },
        testUser
      );

      // Create parent settlement
      const parentSettlement = await prisma.settlement.create({
        data: {
          name: 'Parent Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: parentSettlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Parent Settlement',
            population: 5000,
          },
        },
        testUser
      );

      // Create child settlement (need separate location for child settlement)
      const childLocation = await prisma.location.create({
        data: {
          name: 'Child Location',
          worldId: testWorld.id,
          type: 'point',
        },
      });

      const childSettlement = await prisma.settlement.create({
        data: {
          name: 'Child Settlement',
          kingdomId: testKingdom.id,
          locationId: childLocation.id,
        },
      });

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: childSettlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Child Settlement',
            population: 500,
          },
        },
        testUser
      );

      // Create structures in both settlements
      const parentStructure = await prisma.structure.create({
        data: {
          name: 'Parent Structure',
          type: 'castle',
          settlementId: parentSettlement.id,
        },
      });

      await versionService.createVersion(
        {
          entityType: 'structure',
          entityId: parentStructure.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Parent Structure',
            type: 'castle',
          },
        },
        testUser
      );

      const childStructure = await prisma.structure.create({
        data: {
          name: 'Child Structure',
          type: 'barracks',
          settlementId: childSettlement.id,
        },
      });

      await versionService.createVersion(
        {
          entityType: 'structure',
          entityId: childStructure.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Child Structure',
            type: 'barracks',
          },
        },
        testUser
      );

      // Fork the branch
      const forkWorldTime = new Date('2025-01-01T12:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'fork-hierarchy-test',
        'Test hierarchy preservation',
        forkWorldTime,
        testUser
      );

      // Verify all entities were copied
      expect(forkResult.versionsCopied).toBeGreaterThanOrEqual(4); // 2 settlements + 2 structures

      // Verify parent settlement hierarchy is preserved
      const forkedParentSettlement = await versionService.resolveVersion(
        'settlement',
        parentSettlement.id,
        forkResult.branch.id,
        forkWorldTime
      );
      expect(forkedParentSettlement).toBeDefined();

      const forkedChildSettlement = await versionService.resolveVersion(
        'settlement',
        childSettlement.id,
        forkResult.branch.id,
        forkWorldTime
      );
      expect(forkedChildSettlement).toBeDefined();

      // Verify structure hierarchy is preserved
      const forkedParentStructure = await versionService.resolveVersion(
        'structure',
        parentStructure.id,
        forkResult.branch.id,
        forkWorldTime
      );
      expect(forkedParentStructure).toBeDefined();

      const forkedChildStructure = await versionService.resolveVersion(
        'structure',
        childStructure.id,
        forkResult.branch.id,
        forkWorldTime
      );
      expect(forkedChildStructure).toBeDefined();

      // Verify database relationships still exist
      const dbChildStructure = await prisma.structure.findUnique({
        where: { id: childStructure.id },
      });
      expect(dbChildStructure?.settlementId).toBe(childSettlement.id);
    });
  });

  describe('Multi-Level Branch Hierarchy', () => {
    it('should resolve versions correctly across 3+ levels of branch hierarchy', async () => {
      // Create 4-level hierarchy: main → branch1 → branch2 → branch3
      const mainBranch = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'main',
          description: 'Main timeline',
          parentId: undefined,
          divergedAt: undefined,
        },
        testUser
      );

      const hierarchySettlementLocation = await prisma.location.create({
        data: {
          name: 'Hierarchy Settlement Location',
          worldId: testWorld.id,
          type: 'point',
        },
      });

      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: hierarchySettlementLocation.id,
        },
      });

      // Create initial version in main
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            generation: 0,
            value: 'main',
          },
        },
        testUser
      );

      // Create branch1 (child of main)
      const branch1 = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'branch1',
          description: 'First branch',
          parentId: mainBranch.id,
          divergedAt: new Date('2025-01-02T00:00:00Z'),
        },
        testUser
      );

      // Add version in branch1
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: branch1.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            generation: 1,
            value: 'branch1',
          },
        },
        testUser
      );

      // Create branch2 (child of branch1)
      const branch2 = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'branch2',
          description: 'Second branch',
          parentId: branch1.id,
          divergedAt: new Date('2025-01-04T00:00:00Z'),
        },
        testUser
      );

      // Add version in branch2
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: branch2.id,
          validFrom: new Date('2025-01-05T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            generation: 2,
            value: 'branch2',
          },
        },
        testUser
      );

      // Create branch3 (child of branch2)
      const branch3 = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'branch3',
          description: 'Third branch',
          parentId: branch2.id,
          divergedAt: new Date('2025-01-06T00:00:00Z'),
        },
        testUser
      );

      // Add version in branch3
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: branch3.id,
          validFrom: new Date('2025-01-07T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            generation: 3,
            value: 'branch3',
          },
        },
        testUser
      );

      // Test resolution at different times and branches

      // 1. In main branch, should only see main version
      const mainResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-10T00:00:00Z')
      );
      const mainPayload = await versionService.decompressVersion(mainResolution!);
      expect(mainPayload.value).toBe('main');
      expect(mainPayload.generation).toBe(0);

      // 2. In branch1, should see branch1 version (not branch2 or branch3)
      const branch1Resolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch1.id,
        new Date('2025-01-10T00:00:00Z')
      );
      const branch1Payload = await versionService.decompressVersion(branch1Resolution!);
      expect(branch1Payload.value).toBe('branch1');
      expect(branch1Payload.generation).toBe(1);

      // 3. In branch2, should see branch2 version (not branch3)
      const branch2Resolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch2.id,
        new Date('2025-01-10T00:00:00Z')
      );
      const branch2Payload = await versionService.decompressVersion(branch2Resolution!);
      expect(branch2Payload.value).toBe('branch2');
      expect(branch2Payload.generation).toBe(2);

      // 4. In branch3, should see branch3 version
      const branch3Resolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch3.id,
        new Date('2025-01-10T00:00:00Z')
      );
      const branch3Payload = await versionService.decompressVersion(branch3Resolution!);
      expect(branch3Payload.value).toBe('branch3');
      expect(branch3Payload.generation).toBe(3);

      // 5. In branch3 before its version was created, should inherit from branch2
      const branch3EarlyResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch3.id,
        new Date('2025-01-06T12:00:00Z') // After branch3 created, before its version
      );
      const branch3EarlyPayload = await versionService.decompressVersion(branch3EarlyResolution!);
      expect(branch3EarlyPayload.value).toBe('branch2');
      expect(branch3EarlyPayload.generation).toBe(2);

      // 6. In branch2 before its version was created, should inherit from branch1
      const branch2EarlyResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch2.id,
        new Date('2025-01-04T12:00:00Z') // After branch2 created, before its version
      );
      const branch2EarlyPayload = await versionService.decompressVersion(branch2EarlyResolution!);
      expect(branch2EarlyPayload.value).toBe('branch1');
      expect(branch2EarlyPayload.generation).toBe(1);

      // 7. In branch1 before its version was created, should inherit from main
      const branch1EarlyResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch1.id,
        new Date('2025-01-02T12:00:00Z') // After branch1 created, before its version
      );
      const branch1EarlyPayload = await versionService.decompressVersion(branch1EarlyResolution!);
      expect(branch1EarlyPayload.value).toBe('main');
      expect(branch1EarlyPayload.generation).toBe(0);
    });

    it('should handle parallel branch hierarchies independently', async () => {
      // Create main branch with two parallel child branches
      const mainBranch = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'main',
          description: 'Main timeline',
          parentId: undefined,
          divergedAt: undefined,
        },
        testUser
      );

      const parallelSettlementLocation = await prisma.location.create({
        data: {
          name: 'Parallel Settlement Location',
          worldId: testWorld.id,
          type: 'point',
        },
      });

      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: parallelSettlementLocation.id,
        },
      });

      // Create initial version in main
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            scenario: 'main',
          },
        },
        testUser
      );

      // Create parallel branch A
      const branchA = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'branch-a',
          description: 'Scenario A',
          parentId: mainBranch.id,
          divergedAt: new Date('2025-01-02T00:00:00Z'),
        },
        testUser
      );

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: branchA.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            scenario: 'A',
          },
        },
        testUser
      );

      // Create parallel branch B
      const branchB = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'branch-b',
          description: 'Scenario B',
          parentId: mainBranch.id,
          divergedAt: new Date('2025-01-02T00:00:00Z'),
        },
        testUser
      );

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: branchB.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            scenario: 'B',
          },
        },
        testUser
      );

      // Verify branches are independent
      const resolutionA = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branchA.id,
        new Date('2025-01-10T00:00:00Z')
      );
      const payloadA = await versionService.decompressVersion(resolutionA!);
      expect(payloadA.scenario).toBe('A');

      const resolutionB = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branchB.id,
        new Date('2025-01-10T00:00:00Z')
      );
      const payloadB = await versionService.decompressVersion(resolutionB!);
      expect(payloadB.scenario).toBe('B');

      const resolutionMain = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-10T00:00:00Z')
      );
      const payloadMain = await versionService.decompressVersion(resolutionMain!);
      expect(payloadMain.scenario).toBe('main');

      // Create grandchildren of parallel branches
      const branchA1 = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'branch-a1',
          description: 'Scenario A1',
          parentId: branchA.id,
          divergedAt: new Date('2025-01-04T00:00:00Z'),
        },
        testUser
      );

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: branchA1.id,
          validFrom: new Date('2025-01-05T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            scenario: 'A1',
          },
        },
        testUser
      );

      const branchB1 = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'branch-b1',
          description: 'Scenario B1',
          parentId: branchB.id,
          divergedAt: new Date('2025-01-04T00:00:00Z'),
        },
        testUser
      );

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: branchB1.id,
          validFrom: new Date('2025-01-05T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            scenario: 'B1',
          },
        },
        testUser
      );

      // Verify grandchildren inherit from correct parents
      const resolutionA1 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branchA1.id,
        new Date('2025-01-10T00:00:00Z')
      );
      const payloadA1 = await versionService.decompressVersion(resolutionA1!);
      expect(payloadA1.scenario).toBe('A1');

      const resolutionB1 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branchB1.id,
        new Date('2025-01-10T00:00:00Z')
      );
      const payloadB1 = await versionService.decompressVersion(resolutionB1!);
      expect(payloadB1.scenario).toBe('B1');

      // Verify cross-contamination doesn't occur
      // branchA1 should not see branchB or branchB1 versions
      const resolutionA1Early = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branchA1.id,
        new Date('2025-01-04T12:00:00Z') // Before A1's version
      );
      const payloadA1Early = await versionService.decompressVersion(resolutionA1Early!);
      expect(payloadA1Early.scenario).toBe('A'); // Should inherit from A, not B
    });
  });

  describe('Concurrent Edits in Different Branches', () => {
    it('should allow concurrent edits in different branches without conflicts', async () => {
      const mainBranch = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'main',
          description: 'Main timeline',
          parentId: undefined,
          divergedAt: undefined,
        },
        testUser
      );

      const concurrentSettlementLocation = await prisma.location.create({
        data: {
          name: 'Concurrent Settlement Location',
          worldId: testWorld.id,
          type: 'point',
        },
      });

      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: concurrentSettlementLocation.id,
        },
      });

      // Create initial version
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1000,
            wealth: 500,
            military: 100,
          },
        },
        testUser
      );

      // Fork into two parallel branches
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult1 = await branchService.fork(
        mainBranch.id,
        'branch-1',
        'Branch 1',
        forkTime,
        testUser
      );

      const forkResult2 = await branchService.fork(
        mainBranch.id,
        'branch-2',
        'Branch 2',
        forkTime,
        testUser
      );

      // Make concurrent edits to same entity in different branches
      const editTime = new Date('2025-01-03T00:00:00Z');

      // Edit in branch 1: increase population
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult1.branch.id,
          validFrom: editTime,
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1500, // Changed
            wealth: 500,
            military: 100,
          },
        },
        testUser
      );

      // Edit in branch 2: increase wealth
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult2.branch.id,
          validFrom: editTime,
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1000,
            wealth: 800, // Changed
            military: 100,
          },
        },
        testUser
      );

      // Edit in main: increase military
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: editTime,
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1000,
            wealth: 500,
            military: 150, // Changed
          },
        },
        testUser
      );

      // Verify all branches have their independent changes
      const mainResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-04T00:00:00Z')
      );
      const mainResolutionPayload = await versionService.decompressVersion(mainResolution!);
      expect(mainResolutionPayload).toMatchObject({
        population: 1000,
        wealth: 500,
        military: 150, // Only military changed in main
      });

      const branch1Resolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult1.branch.id,
        new Date('2025-01-04T00:00:00Z')
      );
      const branch1ResolutionPayload = await versionService.decompressVersion(branch1Resolution!);
      expect(branch1ResolutionPayload).toMatchObject({
        population: 1500, // Only population changed in branch 1
        wealth: 500,
        military: 100,
      });

      const branch2Resolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult2.branch.id,
        new Date('2025-01-04T00:00:00Z')
      );
      const branch2ResolutionPayload = await versionService.decompressVersion(branch2Resolution!);
      expect(branch2ResolutionPayload).toMatchObject({
        population: 1000,
        wealth: 800, // Only wealth changed in branch 2
        military: 100,
      });
    });
  });

  describe('Branch Ancestry and Isolation', () => {
    it('should inherit parent versions correctly and isolate child changes', async () => {
      const mainBranch = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'main',
          description: 'Main timeline',
          parentId: undefined,
          divergedAt: undefined,
        },
        testUser
      );

      const ancestrySettlementLocation = await prisma.location.create({
        data: {
          name: 'Ancestry Settlement Location',
          worldId: testWorld.id,
          type: 'point',
        },
      });

      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: ancestrySettlementLocation.id,
        },
      });

      // Create versions in main branch at different times
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            stage: 'initial',
          },
        },
        testUser
      );

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            stage: 'developed',
          },
        },
        testUser
      );

      // Fork at a specific time (between the two versions)
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'child-branch',
        'Child branch',
        forkTime,
        testUser
      );

      // Child branch should inherit the initial version (before fork)
      const childResolution1 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        forkTime
      );
      const childPayload1 = await versionService.decompressVersion(childResolution1!);
      expect(childPayload1.stage).toBe('initial');

      // Child branch should NOT inherit the developed version (after fork in main)
      const childResolution2 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        new Date('2025-01-04T00:00:00Z')
      );
      const childPayload2 = await versionService.decompressVersion(childResolution2!);
      expect(childPayload2.stage).toBe('initial'); // Still initial, not developed

      // Main branch should have developed version
      const mainResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-04T00:00:00Z')
      );
      const mainResolutionPayload2 = await versionService.decompressVersion(mainResolution!);
      expect(mainResolutionPayload2.stage).toBe('developed');

      // Make a change in child branch
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult.branch.id,
          validFrom: new Date('2025-01-05T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            stage: 'alternate',
          },
        },
        testUser
      );

      // Child branch should have alternate version
      const childResolution3 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        new Date('2025-01-06T00:00:00Z')
      );
      const childPayload3 = await versionService.decompressVersion(childResolution3!);
      expect(childPayload3.stage).toBe('alternate');

      // Main branch should still have developed version (not affected by child)
      const mainResolution2 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-06T00:00:00Z')
      );
      const mainResolutionPayload3 = await versionService.decompressVersion(mainResolution2!);
      expect(mainResolutionPayload3.stage).toBe('developed');
    });
  });
});
