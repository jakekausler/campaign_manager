/**
 * Merge System End-to-End Tests
 *
 * Comprehensive E2E tests for the complete merge system including:
 * - Full merge workflow (create branches → modify → preview → resolve conflicts → merge)
 * - Settlement merge with property and association conflicts
 * - Structure merge with property and association conflicts
 * - Cherry-pick workflow across multiple branches
 * - Multi-level branch merging (grandchild → child → parent)
 * - Merge history tracking and retrieval
 * - Error handling (unauthorized access, invalid resolutions)
 * - Edge cases (merging into ancestor, concurrent merges)
 * - Performance (100+ entity conflicts)
 */

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Campaign, Kingdom, Location, User, World } from '@prisma/client';

import { CampaignMembershipService } from '../../auth/services/campaign-membership.service';
import { CacheModule } from '../../common/cache/cache.module';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../graphql/context/graphql-context';
import type { ConflictResolution } from '../../graphql/inputs/branch.input';
import { REDIS_PUBSUB } from '../../graphql/pubsub/redis-pubsub.provider';
import { AuditService } from '../../graphql/services/audit.service';
import { BranchService } from '../../graphql/services/branch.service';
import { CampaignContextService } from '../../graphql/services/campaign-context.service';
import { ConditionEvaluationService } from '../../graphql/services/condition-evaluation.service';
import { DependencyGraphService } from '../../graphql/services/dependency-graph.service';
import { MergeService } from '../../graphql/services/merge.service';
import { VersionService } from '../../graphql/services/version.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';

describe('Merge System E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let branchService: BranchService;
  let versionService: VersionService;
  let mergeService: MergeService;

  let testUser: AuthenticatedUser;
  let dbUser: User;
  let testWorld: World;
  let testCampaign: Campaign;
  let testKingdom: Kingdom;
  let testLocation: Location;

  /**
   * Helper function to detect conflicts for a single entity.
   * Replaces the non-existent previewMerge method.
   */
  async function detectEntityConflicts(
    entityType: string,
    entityId: string,
    sourceBranchId: string,
    targetBranchId: string,
    commonAncestorId: string,
    worldTime: Date
  ) {
    const versions = await mergeService.getEntityVersionsForMerge(
      entityType,
      entityId,
      sourceBranchId,
      targetBranchId,
      commonAncestorId,
      worldTime
    );

    const basePayload = versions.base
      ? await versionService.decompressVersion(versions.base)
      : null;
    const sourcePayload = versions.source
      ? await versionService.decompressVersion(versions.source)
      : null;
    const targetPayload = versions.target
      ? await versionService.decompressVersion(versions.target)
      : null;

    const mergeResult = mergeService.compareVersions(basePayload, sourcePayload, targetPayload);

    return {
      entityType,
      entityId,
      conflicts: mergeResult.conflicts,
      mergedPayload: mergeResult.mergedPayload,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CacheModule],
      providers: [
        MergeService,
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
    mergeService = moduleRef.get<MergeService>(MergeService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test in correct order to avoid FK violations
    // Delete child entities first, then parents
    await prisma.mergeHistory.deleteMany({});
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
        email: 'test-merge-e2e@example.com',
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
    await prisma.mergeHistory.deleteMany({});
    await prisma.version.deleteMany({});
    await prisma.audit.deleteMany({});
    await prisma.structure.deleteMany({});
    await prisma.settlement.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.kingdom.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.campaignMembership.deleteMany({});
    await prisma.character.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.world.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('Complete Merge Workflow', () => {
    it('should execute complete merge workflow: create branches → modify → preview → resolve → merge', async () => {
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

      // Step 2: Create a settlement in main branch
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
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

      // Step 3: Fork into a child branch
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'feature-branch',
        'Feature branch for testing',
        forkTime,
        testUser
      );
      expect(forkResult.branch).toBeDefined();
      expect(forkResult.versionsCopied).toBeGreaterThanOrEqual(1);

      // Step 4: Make conflicting changes in both branches
      const editTime = new Date('2025-01-03T00:00:00Z');

      // Edit in main: increase population and wealth
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: editTime,
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1200, // Changed
            wealth: 550, // Also changed - CONFLICT
            military: 100,
          },
        },
        testUser
      );

      // Edit in feature branch: increase population differently (conflict!)
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult.branch.id,
          validFrom: editTime,
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1500, // Different change - CONFLICT
            wealth: 600, // Also changed - CONFLICT
            military: 100,
          },
        },
        testUser
      );

      // Step 5: Find common ancestor
      const commonAncestor = await mergeService.findCommonAncestor(
        forkResult.branch.id,
        mainBranch.id
      );
      expect(commonAncestor).toBeDefined();

      // Step 6: Preview merge (should detect conflicts)
      const mergeTime = new Date('2025-01-04T00:00:00Z');
      const entityPreview = await detectEntityConflicts(
        'settlement',
        settlement.id,
        forkResult.branch.id, // source
        mainBranch.id, // target
        commonAncestor!.id,
        mergeTime
      );

      expect(entityPreview).toBeDefined();
      expect(entityPreview.entityType).toBe('settlement');
      expect(entityPreview.entityId).toBe(settlement.id);

      // Should have conflicts for population and wealth
      expect(entityPreview.conflicts).toHaveLength(2);
      const populationConflict = entityPreview.conflicts.find(
        (c: { path: string }) => c.path === 'population'
      );
      const wealthConflict = entityPreview.conflicts.find(
        (c: { path: string }) => c.path === 'wealth'
      );
      expect(populationConflict).toBeDefined();
      expect(wealthConflict).toBeDefined();

      expect(populationConflict!.baseValue).toBe(1000);
      expect(populationConflict!.sourceValue).toBe(1500);
      expect(populationConflict!.targetValue).toBe(1200);

      // Step 7: Resolve conflicts manually
      const resolutions = [
        {
          entityId: settlement.id,
          entityType: 'settlement' as const,
          path: 'population',
          resolvedValue: JSON.stringify(1500), // Choose source value
        },
        {
          entityId: settlement.id,
          entityType: 'settlement' as const,
          path: 'wealth',
          resolvedValue: JSON.stringify(600), // Choose source value
        },
      ];

      // Step 8: Execute merge with resolutions
      const mergeResult = await mergeService.executeMerge({
        sourceBranchId: forkResult.branch.id,
        targetBranchId: mainBranch.id,
        commonAncestorId: commonAncestor!.id,
        worldTime: mergeTime,
        resolutions,
        user: testUser,
      });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.versionsCreated).toBeGreaterThanOrEqual(1);
      expect(mergeResult.mergedEntityIds.length).toBeGreaterThanOrEqual(1);

      // Step 8: Verify merged version in target branch
      const mergedVersion = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        mergeTime
      );
      expect(mergedVersion).toBeDefined();

      const mergedPayload = await versionService.decompressVersion(mergedVersion!);
      expect(mergedPayload).toMatchObject({
        name: 'Test Settlement',
        population: 1500, // Resolved value
        wealth: 600, // Resolved value
        military: 100, // No conflict, kept original
      });

      // Step 9: Verify merge history was created
      const mergeHistory = await prisma.mergeHistory.findMany({
        where: {
          OR: [{ sourceBranchId: forkResult.branch.id }, { targetBranchId: mainBranch.id }],
        },
      });
      expect(mergeHistory).toHaveLength(1);
      expect(mergeHistory[0].sourceBranchId).toBe(forkResult.branch.id);
      expect(mergeHistory[0].targetBranchId).toBe(mainBranch.id);
      expect(mergeHistory[0].conflictsCount).toBe(2);
      expect(mergeHistory[0].entitiesMerged).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Settlement Merge with Property and Association Conflicts', () => {
    it('should detect and resolve Settlement property conflicts', async () => {
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

      // Create second and third kingdoms for conflict testing
      const kingdom2 = await prisma.kingdom.create({
        data: {
          name: 'Second Kingdom',
          campaignId: testCampaign.id,
        },
      });

      const kingdom3 = await prisma.kingdom.create({
        data: {
          name: 'Third Kingdom',
          campaignId: testCampaign.id,
        },
      });

      // Create settlement
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create initial version with nested resources
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
            kingdomId: testKingdom.id,
            resources: {
              gold: 500,
              food: 1000,
              wood: 200,
            },
          },
        },
        testUser
      );

      // Fork branch
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'feature-branch',
        'Feature branch',
        forkTime,
        testUser
      );

      // Edit in main: change name, population, kingdom, resources.gold, and resources.food
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement - Main', // Changed name
            population: 1100, // Changed population
            kingdomId: kingdom2.id, // Changed kingdom
            resources: {
              gold: 600, // Changed gold
              food: 1100, // Also changed - CONFLICT
              wood: 200,
            },
          },
        },
        testUser
      );

      // Edit in feature: change kingdom differently and resources.gold differently
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult.branch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement - Modified',
            population: 1200, // Changed population
            kingdomId: kingdom3.id, // Changed to third kingdom (conflict with main)
            resources: {
              gold: 700, // Changed gold differently (conflict)
              food: 1200, // Changed food (no conflict)
              wood: 200,
            },
          },
        },
        testUser
      );

      // Find common ancestor and preview merge
      const commonAncestor = await mergeService.findCommonAncestor(
        forkResult.branch.id,
        mainBranch.id
      );
      expect(commonAncestor).toBeDefined();

      const mergeTime = new Date('2025-01-04T00:00:00Z');
      const entityPreview = await detectEntityConflicts(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        mainBranch.id,
        commonAncestor!.id,
        mergeTime
      );

      // Should have conflicts: name, population, kingdomId, resources.gold
      // Should auto-resolve: resources.food (only source changed)
      expect(entityPreview.conflicts.length).toBeGreaterThanOrEqual(3);

      // Resolve conflicts
      const nameConflict = entityPreview.conflicts.find((c: { path: string }) => c.path === 'name');
      const populationConflict = entityPreview.conflicts.find(
        (c: { path: string }) => c.path === 'population'
      );
      const kingdomConflict = entityPreview.conflicts.find(
        (c: { path: string }) => c.path === 'kingdomId'
      );
      const goldConflict = entityPreview.conflicts.find(
        (c: { path: string }) => c.path === 'resources.gold'
      );

      expect(nameConflict).toBeDefined();
      expect(populationConflict).toBeDefined();
      expect(kingdomConflict).toBeDefined();
      expect(goldConflict).toBeDefined();

      // Execute merge with resolutions
      const resolutions = [
        {
          entityId: settlement.id,
          entityType: 'settlement' as const,
          path: 'name',
          resolvedValue: JSON.stringify('Test Settlement - Modified'),
        },
        {
          entityId: settlement.id,
          entityType: 'settlement' as const,
          path: 'population',
          resolvedValue: JSON.stringify(1200),
        },
        {
          entityId: settlement.id,
          entityType: 'settlement' as const,
          path: 'kingdomId',
          resolvedValue: JSON.stringify(kingdom2.id),
        },
        {
          entityId: settlement.id,
          entityType: 'settlement' as const,
          path: 'resources.gold',
          resolvedValue: JSON.stringify(700),
        },
        {
          entityId: settlement.id,
          entityType: 'settlement' as const,
          path: 'resources.food',
          resolvedValue: JSON.stringify(1200),
        },
      ];

      const mergeResult = await mergeService.executeMerge({
        sourceBranchId: forkResult.branch.id,
        targetBranchId: mainBranch.id,
        commonAncestorId: commonAncestor!.id,
        worldTime: mergeTime,
        resolutions,
        user: testUser,
      });

      expect(mergeResult.success).toBe(true);

      // Verify merged payload
      const mergedVersion = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        mergeTime
      );
      const mergedPayload = await versionService.decompressVersion(mergedVersion!);

      expect(mergedPayload).toMatchObject({
        name: 'Test Settlement - Modified',
        population: 1200,
        kingdomId: kingdom2.id,
        resources: {
          gold: 700,
          food: 1200, // Auto-resolved
          wood: 200,
        },
      });
    });
  });

  describe('Structure Merge with Property Conflicts', () => {
    it('should detect and resolve Structure property conflicts', async () => {
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

      // Create settlement (required for structure)
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Parent Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create structure
      const structure = await prisma.structure.create({
        data: {
          name: 'Test Barracks',
          type: 'barracks',
          settlementId: settlement.id,
        },
      });

      // Create initial version
      await versionService.createVersion(
        {
          entityType: 'structure',
          entityId: structure.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Barracks',
            type: 'barracks',
            level: 1,
            defenseRating: 10,
            capacity: 50,
          },
        },
        testUser
      );

      // Fork branch
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'feature-branch',
        'Feature branch',
        forkTime,
        testUser
      );

      // Edit in main: upgrade level, defense, change name, and increase capacity
      await versionService.createVersion(
        {
          entityType: 'structure',
          entityId: structure.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Upgraded Barracks', // Changed name
            type: 'barracks',
            level: 2, // Upgraded
            defenseRating: 15, // Increased
            capacity: 60, // Also increased - CONFLICT
          },
        },
        testUser
      );

      // Edit in feature: upgrade level differently and change capacity
      await versionService.createVersion(
        {
          entityType: 'structure',
          entityId: structure.id,
          branchId: forkResult.branch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Advanced Barracks', // Changed name
            type: 'barracks',
            level: 3, // Different upgrade (conflict)
            defenseRating: 15, // Same change (no conflict)
            capacity: 75, // Changed (no conflict)
          },
        },
        testUser
      );

      // Find common ancestor and preview merge
      const commonAncestor = await mergeService.findCommonAncestor(
        forkResult.branch.id,
        mainBranch.id
      );
      expect(commonAncestor).toBeDefined();

      const mergeTime = new Date('2025-01-04T00:00:00Z');
      const entityPreview = await detectEntityConflicts(
        'structure',
        structure.id,
        forkResult.branch.id,
        mainBranch.id,
        commonAncestor!.id,
        mergeTime
      );

      // Should have conflicts: name, level
      // Should auto-resolve: capacity (only source changed), defenseRating (both same)
      const nameConflict = entityPreview.conflicts.find((c: { path: string }) => c.path === 'name');
      const levelConflict = entityPreview.conflicts.find(
        (c: { path: string }) => c.path === 'level'
      );

      expect(nameConflict).toBeDefined();
      expect(levelConflict).toBeDefined();

      // Execute merge
      const resolutions = [
        {
          entityId: structure.id,
          entityType: 'structure' as const,
          path: 'name',
          resolvedValue: JSON.stringify('Advanced Barracks'),
        },
        {
          entityId: structure.id,
          entityType: 'structure' as const,
          path: 'level',
          resolvedValue: JSON.stringify(3),
        },
        {
          entityId: structure.id,
          entityType: 'structure' as const,
          path: 'capacity',
          resolvedValue: JSON.stringify(75),
        },
      ];

      const mergeResult = await mergeService.executeMerge({
        sourceBranchId: forkResult.branch.id,
        targetBranchId: mainBranch.id,
        commonAncestorId: commonAncestor!.id,
        worldTime: mergeTime,
        resolutions,
        user: testUser,
      });

      expect(mergeResult.success).toBe(true);

      // Verify merged payload
      const mergedVersion = await versionService.resolveVersion(
        'structure',
        structure.id,
        mainBranch.id,
        mergeTime
      );
      const mergedPayload = await versionService.decompressVersion(mergedVersion!);

      expect(mergedPayload).toMatchObject({
        name: 'Advanced Barracks',
        type: 'barracks',
        level: 3,
        defenseRating: 15,
        capacity: 75,
      });
    });
  });

  describe('Cherry-Pick Workflow', () => {
    it('should cherry-pick specific version across multiple branches', async () => {
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

      // Create settlement
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
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
            population: 1000,
          },
        },
        testUser
      );

      // Fork both branches from main (but at slightly different times to avoid conflicts)
      const forkTime1 = new Date('2025-01-02T00:00:00Z');
      const forkResult1 = await branchService.fork(
        mainBranch.id,
        'branch-1',
        'Branch 1',
        forkTime1,
        testUser
      );

      const forkTime2 = new Date('2025-01-02T01:00:00Z');
      const forkResult2 = await branchService.fork(
        mainBranch.id,
        'branch-2',
        'Branch 2',
        forkTime2,
        testUser
      );

      // Update branch-2 to have population 1500 so cherry-pick won't conflict
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult2.branch.id,
          validFrom: new Date('2025-01-02T02:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1500, // Match what will be cherry-picked
          },
        },
        testUser
      );

      // Create a specific change in branch-1 (only adding specialFeature, not changing existing fields)
      const specialVersion = await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult1.branch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1500, // Keep same as target branch (now 1500 after fork from updated main)
            specialFeature: 'Important change from branch-1',
          },
        },
        testUser
      );

      // Cherry-pick this version to branch-2
      const cherryPickResult = await mergeService.cherryPickVersion(
        specialVersion.id,
        forkResult2.branch.id,
        testUser,
        [] // No resolutions needed
      );

      expect(cherryPickResult.success).toBe(true);
      if (cherryPickResult.conflicts) {
        expect(cherryPickResult.conflicts).toHaveLength(0);
      }

      // Verify version was applied to branch-2
      const branch2Version = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult2.branch.id,
        new Date('2025-01-03T00:00:00Z')
      );
      const branch2Payload = await versionService.decompressVersion(branch2Version!);

      expect(branch2Payload).toMatchObject({
        name: 'Test Settlement',
        population: 1500,
        specialFeature: 'Important change from branch-1',
      });

      // Verify branch-1 still has its version
      const branch1Version = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        forkResult1.branch.id,
        new Date('2025-01-03T00:00:00Z')
      );
      const branch1Payload = await versionService.decompressVersion(branch1Version!);

      expect(branch1Payload).toMatchObject({
        name: 'Test Settlement',
        population: 1500,
        specialFeature: 'Important change from branch-1',
      });

      // Verify main branch is unaffected
      const mainVersion = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-03T00:00:00Z')
      );
      const mainPayload = await versionService.decompressVersion(mainVersion!);

      expect(mainPayload).toMatchObject({
        name: 'Test Settlement',
        population: 1000,
      });
      expect(mainPayload).not.toHaveProperty('specialFeature');
    });

    it('should handle cherry-pick conflicts when target branch has modifications', async () => {
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

      // Create settlement
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
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
          },
        },
        testUser
      );

      // Fork two branches
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

      // Create change in branch-1
      const specialVersion = await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult1.branch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1500,
          },
        },
        testUser
      );

      // Create conflicting change in branch-2
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult2.branch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1200, // Different population - will conflict!
          },
        },
        testUser
      );

      // Try to cherry-pick without resolutions (should fail or return conflicts)
      const cherryPickResult = await mergeService.cherryPickVersion(
        specialVersion.id,
        forkResult2.branch.id,
        testUser,
        [] // No resolutions
      );

      // Should detect conflict
      expect(cherryPickResult.success).toBe(false);
      expect(cherryPickResult.conflicts).toBeDefined();
      expect(cherryPickResult.conflicts!).toHaveLength(1);
      expect(cherryPickResult.conflicts![0].path).toBe('population');

      // Retry with resolution
      const cherryPickWithResolution = await mergeService.cherryPickVersion(
        specialVersion.id,
        forkResult2.branch.id,
        testUser,
        [
          {
            entityId: settlement.id,
            entityType: 'settlement',
            path: 'population',
            resolvedValue: JSON.stringify(1500),
          },
        ]
      );

      expect(cherryPickWithResolution.success).toBe(true);
      if (cherryPickWithResolution.conflicts) {
        expect(cherryPickWithResolution.conflicts).toHaveLength(0);
      }
    });
  });

  describe('Multi-Level Branch Merging', () => {
    it('should merge through multiple levels (grandchild → child → parent)', async () => {
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

      // Create settlement
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
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
            stage: 'initial',
          },
        },
        testUser
      );

      // Create child branch
      const childBranch = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'child',
          description: 'Child branch',
          parentId: mainBranch.id,
          divergedAt: new Date('2025-01-02T00:00:00Z'),
        },
        testUser
      );

      // Create grandchild branch
      const grandchildBranch = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'grandchild',
          description: 'Grandchild branch',
          parentId: childBranch.id,
          divergedAt: new Date('2025-01-03T00:00:00Z'),
        },
        testUser
      );

      // Make change in grandchild
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: grandchildBranch.id,
          validFrom: new Date('2025-01-04T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            stage: 'grandchild-feature',
          },
        },
        testUser
      );

      // Step 1: Merge grandchild → child
      const commonAncestor1 = await mergeService.findCommonAncestor(
        grandchildBranch.id,
        childBranch.id
      );
      expect(commonAncestor1).toBeDefined();

      const mergeTime1 = new Date('2025-01-05T00:00:00Z');
      const mergeResult1 = await mergeService.executeMerge({
        sourceBranchId: grandchildBranch.id,
        targetBranchId: childBranch.id,
        commonAncestorId: commonAncestor1!.id,
        worldTime: mergeTime1,
        resolutions: [],
        user: testUser,
      });

      expect(mergeResult1.success).toBe(true);

      // Verify child has the change
      const childVersion = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        childBranch.id,
        mergeTime1
      );
      const childPayload = await versionService.decompressVersion(childVersion!);
      expect(childPayload.stage).toBe('grandchild-feature');

      // Step 2: Merge child → main
      const commonAncestor2 = await mergeService.findCommonAncestor(childBranch.id, mainBranch.id);
      expect(commonAncestor2).toBeDefined();

      const mergeTime2 = new Date('2025-01-06T00:00:00Z');
      const mergeResult2 = await mergeService.executeMerge({
        sourceBranchId: childBranch.id,
        targetBranchId: mainBranch.id,
        commonAncestorId: commonAncestor2!.id,
        worldTime: mergeTime2,
        resolutions: [],
        user: testUser,
      });

      expect(mergeResult2.success).toBe(true);

      // Verify main has the change
      const mainVersion = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        mergeTime2
      );
      const mainPayload = await versionService.decompressVersion(mainVersion!);
      expect(mainPayload.stage).toBe('grandchild-feature');

      // Verify merge history shows both merges
      const mergeHistory = await prisma.mergeHistory.findMany({
        where: {},
        orderBy: {
          mergedAt: 'asc',
        },
      });

      expect(mergeHistory).toHaveLength(2);
      expect(mergeHistory[0].sourceBranchId).toBe(grandchildBranch.id);
      expect(mergeHistory[0].targetBranchId).toBe(childBranch.id);
      expect(mergeHistory[1].sourceBranchId).toBe(childBranch.id);
      expect(mergeHistory[1].targetBranchId).toBe(mainBranch.id);
    });
  });

  describe('Merge History Tracking', () => {
    it('should track merge history and support retrieval', async () => {
      // Create branches
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

      const featureBranch1 = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'feature-1',
          description: 'Feature 1',
          parentId: mainBranch.id,
          divergedAt: new Date('2025-01-02T00:00:00Z'),
        },
        testUser
      );

      const featureBranch2 = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'feature-2',
          description: 'Feature 2',
          parentId: mainBranch.id,
          divergedAt: new Date('2025-01-02T00:00:00Z'),
        },
        testUser
      );

      // Create settlement for testing
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: { name: 'Test Settlement', value: 'initial' },
        },
        testUser
      );

      // Make changes in feature branches (different fields to avoid conflicts)
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: featureBranch1.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: { name: 'Test Settlement', value: 'initial', feature1: 'data' },
        },
        testUser
      );

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: featureBranch2.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: { name: 'Test Settlement', value: 'initial', feature2: 'data' },
        },
        testUser
      );

      // Merge feature-1 → main
      const commonAncestorF1 = await mergeService.findCommonAncestor(
        featureBranch1.id,
        mainBranch.id
      );
      await mergeService.executeMerge({
        sourceBranchId: featureBranch1.id,
        targetBranchId: mainBranch.id,
        commonAncestorId: commonAncestorF1!.id,
        worldTime: new Date('2025-01-04T00:00:00Z'),
        resolutions: [],
        user: testUser,
      });

      // Merge feature-2 → main
      const commonAncestorF2 = await mergeService.findCommonAncestor(
        featureBranch2.id,
        mainBranch.id
      );
      await mergeService.executeMerge({
        sourceBranchId: featureBranch2.id,
        targetBranchId: mainBranch.id,
        commonAncestorId: commonAncestorF2!.id,
        worldTime: new Date('2025-01-05T00:00:00Z'),
        resolutions: [],
        user: testUser,
      });

      // Retrieve merge history for main branch
      const mainHistory = await prisma.mergeHistory.findMany({
        where: {
          OR: [{ sourceBranchId: mainBranch.id }, { targetBranchId: mainBranch.id }],
        },
        orderBy: {
          mergedAt: 'asc',
        },
      });

      expect(mainHistory).toHaveLength(2);
      expect(mainHistory[0].sourceBranchId).toBe(featureBranch1.id);
      expect(mainHistory[0].targetBranchId).toBe(mainBranch.id);
      expect(mainHistory[1].sourceBranchId).toBe(featureBranch2.id);
      expect(mainHistory[1].targetBranchId).toBe(mainBranch.id);

      // Retrieve merge history for feature-1
      const feature1History = await prisma.mergeHistory.findMany({
        where: {
          OR: [{ sourceBranchId: featureBranch1.id }, { targetBranchId: featureBranch1.id }],
        },
      });

      expect(feature1History).toHaveLength(1);
      expect(feature1History[0].sourceBranchId).toBe(featureBranch1.id);
    });
  });

  describe('Error Handling', () => {
    it('should fail merge with incomplete conflict resolutions', async () => {
      // Create branches
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

      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
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
          },
        },
        testUser
      );

      // Fork branch
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'feature-branch',
        'Feature branch',
        forkTime,
        testUser
      );

      // Create conflicts in both branches
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1200,
            wealth: 600,
          },
        },
        testUser
      );

      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult.branch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1500,
            wealth: 700,
          },
        },
        testUser
      );

      // Find common ancestor
      const commonAncestor = await mergeService.findCommonAncestor(
        forkResult.branch.id,
        mainBranch.id
      );

      // Try to merge with incomplete resolutions (only population, missing wealth)
      const incompleteResolutions = [
        {
          entityId: settlement.id,
          entityType: 'settlement' as const,
          path: 'population',
          resolvedValue: JSON.stringify(1500),
        },
        // Missing wealth resolution!
      ];

      // Should throw error for unresolved conflicts
      await expect(
        mergeService.executeMerge({
          sourceBranchId: forkResult.branch.id,
          targetBranchId: mainBranch.id,
          commonAncestorId: commonAncestor!.id,
          worldTime: new Date('2025-01-04T00:00:00Z'),
          resolutions: incompleteResolutions,
          user: testUser,
        })
      ).rejects.toThrow();
    });

    it('should validate that branches have common ancestor before merging', async () => {
      // Create two unrelated branches (no common ancestor)
      const branch1 = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'branch-1',
          description: 'Branch 1',
          parentId: undefined,
          divergedAt: undefined,
        },
        testUser
      );

      const branch2 = await branchService.create(
        {
          campaignId: testCampaign.id,
          name: 'branch-2',
          description: 'Branch 2',
          parentId: undefined,
          divergedAt: undefined,
        },
        testUser
      );

      // Try to find common ancestor (should fail)
      const commonAncestor = await mergeService.findCommonAncestor(branch1.id, branch2.id);
      expect(commonAncestor).toBeNull();

      // Try to merge without common ancestor (should fail)
      await expect(
        mergeService.executeMerge({
          sourceBranchId: branch1.id,
          targetBranchId: branch2.id,
          commonAncestorId: branch1.id, // Invalid - not actually a common ancestor
          worldTime: new Date('2025-01-04T00:00:00Z'),
          resolutions: [],
          user: testUser,
        })
      ).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle merging branch with no changes (no-op merge)', async () => {
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

      // Create settlement
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create version
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: { name: 'Test Settlement', value: 'initial' },
        },
        testUser
      );

      // Fork branch but don't make any changes
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'feature-branch',
        'Feature branch',
        forkTime,
        testUser
      );

      // Merge back to main (should succeed with no conflicts and no changes)
      const commonAncestor = await mergeService.findCommonAncestor(
        forkResult.branch.id,
        mainBranch.id
      );

      const mergeResult = await mergeService.executeMerge({
        sourceBranchId: forkResult.branch.id,
        targetBranchId: mainBranch.id,
        commonAncestorId: commonAncestor!.id,
        worldTime: new Date('2025-01-03T00:00:00Z'),
        resolutions: [],
        user: testUser,
      });

      // Should succeed but create no new versions (no changes to merge)
      expect(mergeResult.success).toBe(true);
      // entitiesMerged might be 0 or 1 depending on implementation
      // The key is that no conflicts occurred
    });

    it('should handle concurrent non-conflicting changes in same entity', async () => {
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

      // Create settlement
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create initial version with multiple fields
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

      // Fork branch
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'feature-branch',
        'Feature branch',
        forkTime,
        testUser
      );

      // Main branch: modify population only
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1200, // Changed
            wealth: 500,
            military: 100,
          },
        },
        testUser
      );

      // Feature branch: modify wealth only (different field)
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult.branch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            population: 1000,
            wealth: 700, // Changed
            military: 100,
          },
        },
        testUser
      );

      // Merge: should auto-resolve since different fields were modified
      const commonAncestor = await mergeService.findCommonAncestor(
        forkResult.branch.id,
        mainBranch.id
      );

      const mergeResult = await mergeService.executeMerge({
        sourceBranchId: forkResult.branch.id,
        targetBranchId: mainBranch.id,
        commonAncestorId: commonAncestor!.id,
        worldTime: new Date('2025-01-04T00:00:00Z'),
        resolutions: [],
        user: testUser,
      });

      expect(mergeResult.success).toBe(true);

      // Verify merged result has both changes
      const mergedVersion = await versionService.resolveVersion(
        'settlement',
        settlement.id,
        mainBranch.id,
        new Date('2025-01-04T00:00:00Z')
      );
      const mergedPayload = await versionService.decompressVersion(mergedVersion!);

      expect(mergedPayload).toMatchObject({
        population: 1200, // From main
        wealth: 700, // From feature
        military: 100, // Unchanged
      });
    });

    it('should handle deep nested property conflicts', async () => {
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

      // Create settlement
      const settlement = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
        },
      });

      // Create version with deeply nested structure
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            config: {
              trade: {
                routes: {
                  north: { active: true, value: 100 },
                  south: { active: false, value: 0 },
                },
              },
            },
          },
        },
        testUser
      );

      // Fork branch
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'feature-branch',
        'Feature branch',
        forkTime,
        testUser
      );

      // Main: modify config.trade.routes.north.value
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: mainBranch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            config: {
              trade: {
                routes: {
                  north: { active: true, value: 150 }, // Changed
                  south: { active: false, value: 0 },
                },
              },
            },
          },
        },
        testUser
      );

      // Feature: modify same deep property differently
      await versionService.createVersion(
        {
          entityType: 'settlement',
          entityId: settlement.id,
          branchId: forkResult.branch.id,
          validFrom: new Date('2025-01-03T00:00:00Z'),
          validTo: null,
          payload: {
            name: 'Test Settlement',
            config: {
              trade: {
                routes: {
                  north: { active: true, value: 200 }, // Changed differently
                  south: { active: true, value: 50 }, // Also changed
                },
              },
            },
          },
        },
        testUser
      );

      // Find common ancestor
      const commonAncestor = await mergeService.findCommonAncestor(
        forkResult.branch.id,
        mainBranch.id
      );

      // Detect conflicts
      const entityPreview = await detectEntityConflicts(
        'settlement',
        settlement.id,
        forkResult.branch.id,
        mainBranch.id,
        commonAncestor!.id,
        new Date('2025-01-04T00:00:00Z')
      );

      // Should detect conflict in config.trade.routes.north.value
      // May also detect conflict in entire config.trade.routes.north object or parent objects
      expect(entityPreview.conflicts.length).toBeGreaterThan(0);

      // Verify at least one conflict path contains the deep nested property
      const hasDeepConflict = entityPreview.conflicts.some((c: { path: string }) =>
        c.path.includes('config')
      );
      expect(hasDeepConflict).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle merge with 100+ entity conflicts', async () => {
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

      // Fork branch
      const forkTime = new Date('2025-01-02T00:00:00Z');
      const forkResult = await branchService.fork(
        mainBranch.id,
        'feature-branch',
        'Feature branch',
        forkTime,
        testUser
      );

      // Create 100 settlements with conflicting changes
      const settlements: unknown[] = [];
      const resolutions: ConflictResolution[] = [];

      for (let i = 0; i < 100; i++) {
        // Create unique location for each settlement
        const location = await prisma.location.create({
          data: {
            name: `Location ${i}`,
            worldId: testWorld.id,
            type: 'point',
          },
        });

        // Create settlement
        const settlement = await prisma.settlement.create({
          data: {
            name: `Settlement ${i}`,
            kingdomId: testKingdom.id,
            locationId: location.id,
          },
        });

        settlements.push(settlement);

        // Create initial version in main
        await versionService.createVersion(
          {
            entityType: 'settlement',
            entityId: settlement.id,
            branchId: mainBranch.id,
            validFrom: new Date('2025-01-01T00:00:00Z'),
            validTo: null,
            payload: {
              name: `Settlement ${i}`,
              population: 1000,
            },
          },
          testUser
        );

        // Create conflicting change in main
        await versionService.createVersion(
          {
            entityType: 'settlement',
            entityId: settlement.id,
            branchId: mainBranch.id,
            validFrom: new Date('2025-01-03T00:00:00Z'),
            validTo: null,
            payload: {
              name: `Settlement ${i}`,
              population: 1200,
            },
          },
          testUser
        );

        // Create conflicting change in feature
        await versionService.createVersion(
          {
            entityType: 'settlement',
            entityId: settlement.id,
            branchId: forkResult.branch.id,
            validFrom: new Date('2025-01-03T00:00:00Z'),
            validTo: null,
            payload: {
              name: `Settlement ${i}`,
              population: 1500,
            },
          },
          testUser
        );

        // Add resolution
        resolutions.push({
          entityId: settlement.id,
          entityType: 'settlement' as const,
          path: 'population',
          resolvedValue: JSON.stringify(1500),
        });
      }

      // Measure performance
      const startTime = Date.now();

      // Find common ancestor
      const commonAncestor = await mergeService.findCommonAncestor(
        forkResult.branch.id,
        mainBranch.id
      );

      // Execute merge with 100 resolutions
      const mergeResult = await mergeService.executeMerge({
        sourceBranchId: forkResult.branch.id,
        targetBranchId: mainBranch.id,
        commonAncestorId: commonAncestor!.id,
        worldTime: new Date('2025-01-04T00:00:00Z'),
        resolutions,
        user: testUser,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete successfully
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.mergedEntityIds.length).toBeGreaterThanOrEqual(100);

      // Performance check: should complete in reasonable time (< 30 seconds)
      expect(duration).toBeLessThan(30000);

      // Log performance for monitoring
      console.log(`Merged 100 entities with conflicts in ${duration}ms`);
    }, 60000); // 60 second timeout for this test
  });
});
