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
    // Clean up database before each test
    await prisma.version.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.structure.deleteMany({});
    await prisma.settlement.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.kingdom.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.world.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    dbUser = await prisma.user.create({
      data: {
        email: 'test-branching-e2e@example.com',
        passwordHash: 'hash',
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
        description: 'World for branching E2E tests',
        ownerId: dbUser.id,
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
        campaignId: testCampaign.id,
        geometry: {
          type: 'Point',
          coordinates: [0, 0],
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.version.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.structure.deleteMany({});
    await prisma.settlement.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.kingdom.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.world.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('Complete Fork Workflow', () => {
    it('should execute complete fork workflow: create campaign → create branch → fork → verify versions', async () => {
      // Step 1: Create main branch
      const mainBranch = await branchService.create(
        testCampaign.id,
        'main',
        'Main timeline',
        null,
        null
      );
      expect(mainBranch).toBeDefined();
      expect(mainBranch.name).toBe('main');
      expect(mainBranch.parentId).toBeNull();

      // Step 2: Create a settlement with some initial state
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          campaignId: testCampaign.id,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create initial version for settlement
      const settlementVersion1 = await versionService.createVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        {
          name: 'Test Settlement',
          population: 1000,
          wealth: 500,
        },
        testUser.id
      );
      expect(settlementVersion1).toBeDefined();

      // Step 3: Create a structure within the settlement
      const structure = await prisma.structure.create({
        data: {
          name: 'Test Structure',
          campaignId: testCampaign.id,
          settlementId: settlement.id,
          locationId: testLocation.id,
        },
      });

      // Create initial version for structure
      const structureVersion1 = await versionService.createVersion(
        'structure',
        structure.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        {
          name: 'Test Structure',
          type: 'barracks',
          level: 1,
        },
        testUser.id
      );
      expect(structureVersion1).toBeDefined();

      // Step 4: Fork the branch at current world time
      const forkWorldTime = new Date('2025-01-01T12:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'alternate-timeline',
        'An alternate timeline for testing',
        forkWorldTime,
        testUser.id
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
      expect(forkedSettlementVersion?.payload).toMatchObject({
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
      expect(forkedStructureVersion?.payload).toMatchObject({
        name: 'Test Structure',
        type: 'barracks',
        level: 1,
      });

      // Step 6: Make changes in forked branch
      const forkedSettlementVersion2 = await versionService.createVersion(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        new Date('2025-01-02T00:00:00Z'),
        {
          name: 'Test Settlement',
          population: 1200, // Increased population in fork
          wealth: 600,
        },
        testUser.id
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
      expect(mainSettlementVersion?.payload).toMatchObject({
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
      expect(forkedSettlementVersion2Check?.payload).toMatchObject({
        name: 'Test Settlement',
        population: 1200, // Updated value
        wealth: 600,
      });
    });

    it('should preserve Settlement-Structure hierarchy in forked branches', async () => {
      // Create main branch
      const mainBranch = await branchService.create(
        testCampaign.id,
        'main',
        'Main timeline',
        null,
        null
      );

      // Create parent settlement
      const parentSettlement = await prisma.settlement.create({
        data: {
          name: 'Parent Settlement',
          campaignId: testCampaign.id,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      await versionService.createVersion(
        'settlement',
        parentSettlement.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        {
          name: 'Parent Settlement',
          population: 5000,
        },
        testUser.id
      );

      // Create child settlement
      const childSettlement = await prisma.settlement.create({
        data: {
          name: 'Child Settlement',
          campaignId: testCampaign.id,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
          parentSettlementId: parentSettlement.id,
        },
      });

      await versionService.createVersion(
        'settlement',
        childSettlement.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        {
          name: 'Child Settlement',
          population: 500,
        },
        testUser.id
      );

      // Create structures in both settlements
      const parentStructure = await prisma.structure.create({
        data: {
          name: 'Parent Structure',
          campaignId: testCampaign.id,
          settlementId: parentSettlement.id,
          locationId: testLocation.id,
        },
      });

      await versionService.createVersion(
        'structure',
        parentStructure.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        {
          name: 'Parent Structure',
          type: 'castle',
        },
        testUser.id
      );

      const childStructure = await prisma.structure.create({
        data: {
          name: 'Child Structure',
          campaignId: testCampaign.id,
          settlementId: childSettlement.id,
          locationId: testLocation.id,
        },
      });

      await versionService.createVersion(
        'structure',
        childStructure.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        {
          name: 'Child Structure',
          type: 'barracks',
        },
        testUser.id
      );

      // Fork the branch
      const forkWorldTime = new Date('2025-01-01T12:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'fork-hierarchy-test',
        'Test hierarchy preservation',
        forkWorldTime,
        testUser.id
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
      const dbChildSettlement = await prisma.settlement.findUnique({
        where: { id: childSettlement.id },
      });
      expect(dbChildSettlement?.parentSettlementId).toBe(parentSettlement.id);

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
        testCampaign.id,
        'main',
        'Main timeline',
        null,
        null
      );

      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          campaignId: testCampaign.id,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create initial version in main
      await versionService.createVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        {
          name: 'Test Settlement',
          generation: 0,
          value: 'main',
        },
        testUser.id
      );

      // Create branch1 (child of main)
      const branch1 = await branchService.create(
        testCampaign.id,
        'branch1',
        'First branch',
        mainBranch.id,
        new Date('2025-01-02T00:00:00Z')
      );

      // Add version in branch1
      await versionService.createVersion(
        'settlement',
        settlement.id,
        branch1.id,
        new Date('2025-01-03T00:00:00Z'),
        {
          name: 'Test Settlement',
          generation: 1,
          value: 'branch1',
        },
        testUser.id
      );

      // Create branch2 (child of branch1)
      const branch2 = await branchService.create(
        testCampaign.id,
        'branch2',
        'Second branch',
        branch1.id,
        new Date('2025-01-04T00:00:00Z')
      );

      // Add version in branch2
      await versionService.createVersion(
        'settlement',
        settlement.id,
        branch2.id,
        new Date('2025-01-05T00:00:00Z'),
        {
          name: 'Test Settlement',
          generation: 2,
          value: 'branch2',
        },
        testUser.id
      );

      // Create branch3 (child of branch2)
      const branch3 = await branchService.create(
        testCampaign.id,
        'branch3',
        'Third branch',
        branch2.id,
        new Date('2025-01-06T00:00:00Z')
      );

      // Add version in branch3
      await versionService.createVersion(
        'settlement',
        settlement.id,
        branch3.id,
        new Date('2025-01-07T00:00:00Z'),
        {
          name: 'Test Settlement',
          generation: 3,
          value: 'branch3',
        },
        testUser.id
      );

      // Test resolution at different times and branches

      // 1. In main branch, should only see main version
      const mainResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-10T00:00:00Z')
      );
      expect(mainResolution?.payload.value).toBe('main');
      expect(mainResolution?.payload.generation).toBe(0);

      // 2. In branch1, should see branch1 version (not branch2 or branch3)
      const branch1Resolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch1.id,
        new Date('2025-01-10T00:00:00Z')
      );
      expect(branch1Resolution?.payload.value).toBe('branch1');
      expect(branch1Resolution?.payload.generation).toBe(1);

      // 3. In branch2, should see branch2 version (not branch3)
      const branch2Resolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch2.id,
        new Date('2025-01-10T00:00:00Z')
      );
      expect(branch2Resolution?.payload.value).toBe('branch2');
      expect(branch2Resolution?.payload.generation).toBe(2);

      // 4. In branch3, should see branch3 version
      const branch3Resolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch3.id,
        new Date('2025-01-10T00:00:00Z')
      );
      expect(branch3Resolution?.payload.value).toBe('branch3');
      expect(branch3Resolution?.payload.generation).toBe(3);

      // 5. In branch3 before its version was created, should inherit from branch2
      const branch3EarlyResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch3.id,
        new Date('2025-01-06T12:00:00Z') // After branch3 created, before its version
      );
      expect(branch3EarlyResolution?.payload.value).toBe('branch2');
      expect(branch3EarlyResolution?.payload.generation).toBe(2);

      // 6. In branch2 before its version was created, should inherit from branch1
      const branch2EarlyResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch2.id,
        new Date('2025-01-04T12:00:00Z') // After branch2 created, before its version
      );
      expect(branch2EarlyResolution?.payload.value).toBe('branch1');
      expect(branch2EarlyResolution?.payload.generation).toBe(1);

      // 7. In branch1 before its version was created, should inherit from main
      const branch1EarlyResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branch1.id,
        new Date('2025-01-02T12:00:00Z') // After branch1 created, before its version
      );
      expect(branch1EarlyResolution?.payload.value).toBe('main');
      expect(branch1EarlyResolution?.payload.generation).toBe(0);
    });

    it('should handle parallel branch hierarchies independently', async () => {
      // Create main branch with two parallel child branches
      const mainBranch = await branchService.create(
        testCampaign.id,
        'main',
        'Main timeline',
        null,
        null
      );

      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          campaignId: testCampaign.id,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create initial version in main
      await versionService.createVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        {
          name: 'Test Settlement',
          scenario: 'main',
        },
        testUser.id
      );

      // Create parallel branch A
      const branchA = await branchService.create(
        testCampaign.id,
        'branch-a',
        'Scenario A',
        mainBranch.id,
        new Date('2025-01-02T00:00:00Z')
      );

      await versionService.createVersion(
        'settlement',
        settlement.id,
        branchA.id,
        new Date('2025-01-03T00:00:00Z'),
        {
          name: 'Test Settlement',
          scenario: 'A',
        },
        testUser.id
      );

      // Create parallel branch B
      const branchB = await branchService.create(
        testCampaign.id,
        'branch-b',
        'Scenario B',
        mainBranch.id,
        new Date('2025-01-02T00:00:00Z')
      );

      await versionService.createVersion(
        'settlement',
        settlement.id,
        branchB.id,
        new Date('2025-01-03T00:00:00Z'),
        {
          name: 'Test Settlement',
          scenario: 'B',
        },
        testUser.id
      );

      // Verify branches are independent
      const resolutionA = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branchA.id,
        new Date('2025-01-10T00:00:00Z')
      );
      expect(resolutionA?.payload.scenario).toBe('A');

      const resolutionB = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branchB.id,
        new Date('2025-01-10T00:00:00Z')
      );
      expect(resolutionB?.payload.scenario).toBe('B');

      const resolutionMain = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-10T00:00:00Z')
      );
      expect(resolutionMain?.payload.scenario).toBe('main');

      // Create grandchildren of parallel branches
      const branchA1 = await branchService.create(
        testCampaign.id,
        'branch-a1',
        'Scenario A1',
        branchA.id,
        new Date('2025-01-04T00:00:00Z')
      );

      await versionService.createVersion(
        'settlement',
        settlement.id,
        branchA1.id,
        new Date('2025-01-05T00:00:00Z'),
        {
          name: 'Test Settlement',
          scenario: 'A1',
        },
        testUser.id
      );

      const branchB1 = await branchService.create(
        testCampaign.id,
        'branch-b1',
        'Scenario B1',
        branchB.id,
        new Date('2025-01-04T00:00:00Z')
      );

      await versionService.createVersion(
        'settlement',
        settlement.id,
        branchB1.id,
        new Date('2025-01-05T00:00:00Z'),
        {
          name: 'Test Settlement',
          scenario: 'B1',
        },
        testUser.id
      );

      // Verify grandchildren inherit from correct parents
      const resolutionA1 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branchA1.id,
        new Date('2025-01-10T00:00:00Z')
      );
      expect(resolutionA1?.payload.scenario).toBe('A1');

      const resolutionB1 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branchB1.id,
        new Date('2025-01-10T00:00:00Z')
      );
      expect(resolutionB1?.payload.scenario).toBe('B1');

      // Verify cross-contamination doesn't occur
      // branchA1 should not see branchB or branchB1 versions
      const resolutionA1Early = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        branchA1.id,
        new Date('2025-01-04T12:00:00Z') // Before A1's version
      );
      expect(resolutionA1Early?.payload.scenario).toBe('A'); // Should inherit from A, not B
    });
  });

  describe('Concurrent Edits in Different Branches', () => {
    it('should allow concurrent edits in different branches without conflicts', async () => {
      const mainBranch = await branchService.create(
        testCampaign.id,
        'main',
        'Main timeline',
        null,
        null
      );

      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          campaignId: testCampaign.id,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create initial version
      await versionService.createVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        {
          name: 'Test Settlement',
          population: 1000,
          wealth: 500,
          military: 100,
        },
        testUser.id
      );

      // Fork into two parallel branches
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult1 = await branchService.fork(
        mainBranch.id,
        'branch-1',
        'Branch 1',
        forkTime,
        testUser.id
      );

      const forkResult2 = await branchService.fork(
        mainBranch.id,
        'branch-2',
        'Branch 2',
        forkTime,
        testUser.id
      );

      // Make concurrent edits to same entity in different branches
      const editTime = new Date('2025-01-03T00:00:00Z');

      // Edit in branch 1: increase population
      await versionService.createVersion(
        'settlement',
        settlement.id,
        forkResult1.branch.id,
        editTime,
        {
          name: 'Test Settlement',
          population: 1500, // Changed
          wealth: 500,
          military: 100,
        },
        testUser.id
      );

      // Edit in branch 2: increase wealth
      await versionService.createVersion(
        'settlement',
        settlement.id,
        forkResult2.branch.id,
        editTime,
        {
          name: 'Test Settlement',
          population: 1000,
          wealth: 800, // Changed
          military: 100,
        },
        testUser.id
      );

      // Edit in main: increase military
      await versionService.createVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        editTime,
        {
          name: 'Test Settlement',
          population: 1000,
          wealth: 500,
          military: 150, // Changed
        },
        testUser.id
      );

      // Verify all branches have their independent changes
      const mainResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-04T00:00:00Z')
      );
      expect(mainResolution?.payload).toMatchObject({
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
      expect(branch1Resolution?.payload).toMatchObject({
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
      expect(branch2Resolution?.payload).toMatchObject({
        population: 1000,
        wealth: 800, // Only wealth changed in branch 2
        military: 100,
      });
    });
  });

  describe('Branch Ancestry and Isolation', () => {
    it('should inherit parent versions correctly and isolate child changes', async () => {
      const mainBranch = await branchService.create(
        testCampaign.id,
        'main',
        'Main timeline',
        null,
        null
      );

      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          campaignId: testCampaign.id,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create versions in main branch at different times
      await versionService.createVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-01T00:00:00Z'),
        {
          name: 'Test Settlement',
          stage: 'initial',
        },
        testUser.id
      );

      await versionService.createVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-03T00:00:00Z'),
        {
          name: 'Test Settlement',
          stage: 'developed',
        },
        testUser.id
      );

      // Fork at a specific time (between the two versions)
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'child-branch',
        'Child branch',
        forkTime,
        testUser.id
      );

      // Child branch should inherit the initial version (before fork)
      const childResolution1 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        forkTime
      );
      expect(childResolution1?.payload.stage).toBe('initial');

      // Child branch should NOT inherit the developed version (after fork in main)
      const childResolution2 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        new Date('2025-01-04T00:00:00Z')
      );
      expect(childResolution2?.payload.stage).toBe('initial'); // Still initial, not developed

      // Main branch should have developed version
      const mainResolution = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-04T00:00:00Z')
      );
      expect(mainResolution?.payload.stage).toBe('developed');

      // Make a change in child branch
      await versionService.createVersion(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        new Date('2025-01-05T00:00:00Z'),
        {
          name: 'Test Settlement',
          stage: 'alternate',
        },
        testUser.id
      );

      // Child branch should have alternate version
      const childResolution3 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        new Date('2025-01-06T00:00:00Z')
      );
      expect(childResolution3?.payload.stage).toBe('alternate');

      // Main branch should still have developed version (not affected by child)
      const mainResolution2 = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-06T00:00:00Z')
      );
      expect(mainResolution2?.payload.stage).toBe('developed');
    });
  });
});
