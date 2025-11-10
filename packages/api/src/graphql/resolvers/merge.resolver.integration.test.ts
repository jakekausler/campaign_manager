/**
 * Merge Resolver Integration Tests
 * E2E tests for Merge GraphQL queries and mutations
 */

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Branch as PrismaBranch, Campaign, User } from '@prisma/client';

import { CampaignMembershipService } from '../../auth/services/campaign-membership.service';
import { CacheModule } from '../../common/cache/cache.module';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { AuditService } from '../services/audit.service';
import { BranchService } from '../services/branch.service';
import { MergeService } from '../services/merge.service';
import { VersionService } from '../services/version.service';
import type { MergePreview, MergeResult } from '../types/branch.type';
import { compressPayload } from '../utils/version.utils';

import { MergeResolver } from './merge.resolver';

describe('MergeResolver Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolver: MergeResolver;

  let testUser: AuthenticatedUser;
  let dbUser: User;
  let testCampaign: Campaign;
  let testWorld: { id: string; name: string };
  let mainBranch: PrismaBranch;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CacheModule],
      providers: [
        MergeResolver,
        MergeService,
        BranchService,
        VersionService,
        AuditService,
        PrismaService,
        {
          provide: CampaignMembershipService,
          useValue: {
            canEdit: jest.fn().mockResolvedValue(true),
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
    resolver = moduleRef.get<MergeResolver>(MergeResolver);

    // Clean up any existing test data
    await prisma.mergeHistory.deleteMany({ where: { user: { email: 'merge-test@example.com' } } });
    await prisma.audit.deleteMany({ where: { user: { email: 'merge-test@example.com' } } });
    await prisma.version.deleteMany({ where: { user: { email: 'merge-test@example.com' } } });
    await prisma.branch.deleteMany({ where: { campaign: { name: 'Merge Test Campaign' } } });
    await prisma.structure.deleteMany({
      where: { settlement: { kingdom: { campaign: { name: 'Merge Test Campaign' } } } },
    });
    await prisma.settlement.deleteMany({
      where: { kingdom: { campaign: { name: 'Merge Test Campaign' } } },
    });
    await prisma.kingdom.deleteMany({ where: { campaign: { name: 'Merge Test Campaign' } } });
    await prisma.campaign.deleteMany({ where: { name: 'Merge Test Campaign' } });
    await prisma.location.deleteMany({ where: { world: { name: 'Merge Test World' } } });
    await prisma.world.deleteMany({ where: { name: 'Merge Test World' } });
    await prisma.user.deleteMany({ where: { email: 'merge-test@example.com' } });

    // Create test user
    dbUser = await prisma.user.create({
      data: {
        email: 'merge-test@example.com',
        name: 'Merge Test User',
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
        name: 'Merge Test World',
        calendars: {},
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        name: 'Merge Test Campaign',
        worldId: testWorld.id,
        ownerId: testUser.id,
      },
    });

    // Create main branch
    mainBranch = await prisma.branch.create({
      data: {
        name: 'Main',
        campaignId: testCampaign.id,
        parentId: null,
        divergedAt: null,
        isPinned: true,
        tags: [],
      },
    });
  });

  afterAll(async () => {
    // Clean up test data in correct dependency order
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

    await app.close();
  });

  describe('previewMerge', () => {
    describe('validation', () => {
      it('should throw NotFoundException for non-existent source branch', async () => {
        await expect(
          resolver.previewMerge(
            {
              sourceBranchId: '00000000-0000-0000-0000-000000000000',
              targetBranchId: mainBranch.id,
              worldTime: new Date(),
            },
            testUser
          )
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw NotFoundException for non-existent target branch', async () => {
        await expect(
          resolver.previewMerge(
            {
              sourceBranchId: mainBranch.id,
              targetBranchId: '00000000-0000-0000-0000-000000000000',
              worldTime: new Date(),
            },
            testUser
          )
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException for branches from different campaigns', async () => {
        // Create another campaign
        const otherCampaign = await prisma.campaign.create({
          data: {
            name: 'Other Campaign',
            worldId: testWorld.id,
            ownerId: testUser.id,
          },
        });

        const otherBranch = await prisma.branch.create({
          data: {
            name: 'Other Branch',
            campaignId: otherCampaign.id,
            isPinned: false,
            tags: [],
          },
        });

        await expect(
          resolver.previewMerge(
            {
              sourceBranchId: mainBranch.id,
              targetBranchId: otherBranch.id,
              worldTime: new Date(),
            },
            testUser
          )
        ).rejects.toThrow(BadRequestException);

        // Cleanup
        await prisma.branch.deleteMany({ where: { campaignId: otherCampaign.id } });
        await prisma.campaign.delete({ where: { id: otherCampaign.id } });
      });

      it('should throw BadRequestException for branches with no common ancestor', async () => {
        // Create two root branches (no parent)
        const root1 = await prisma.branch.create({
          data: {
            name: 'Root 1',
            campaignId: testCampaign.id,
            parentId: null,
            isPinned: false,
            tags: [],
          },
        });

        const root2 = await prisma.branch.create({
          data: {
            name: 'Root 2',
            campaignId: testCampaign.id,
            parentId: null,
            isPinned: false,
            tags: [],
          },
        });

        await expect(
          resolver.previewMerge(
            {
              sourceBranchId: root1.id,
              targetBranchId: root2.id,
              worldTime: new Date(),
            },
            testUser
          )
        ).rejects.toThrow(BadRequestException);

        // Cleanup
        await prisma.branch.deleteMany({ where: { id: { in: [root1.id, root2.id] } } });
      });
    });

    describe('authorization', () => {
      it('should throw ForbiddenException for user without campaign access', async () => {
        // Create another user without campaign access
        const otherUser = await prisma.user.create({
          data: {
            email: 'other-merge-test@example.com',
            name: 'Other User',
            password: 'hash',
          },
        });

        const otherAuthUser: AuthenticatedUser = {
          id: otherUser.id,
          email: otherUser.email,
          role: 'user',
        };

        // Create child branch for testing
        const childBranch = await prisma.branch.create({
          data: {
            name: 'Child',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date(),
            isPinned: false,
            tags: [],
          },
        });

        await expect(
          resolver.previewMerge(
            {
              sourceBranchId: childBranch.id,
              targetBranchId: mainBranch.id,
              worldTime: new Date(),
            },
            otherAuthUser
          )
        ).rejects.toThrow(ForbiddenException);

        // Cleanup
        await prisma.branch.delete({ where: { id: childBranch.id } });
        await prisma.user.delete({ where: { id: otherUser.id } });
      });
    });

    describe('merge preview with no conflicts', () => {
      it('should return empty preview when no entities exist', async () => {
        const childBranch = await prisma.branch.create({
          data: {
            name: 'Child',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date(),
            isPinned: false,
            tags: [],
          },
        });

        const preview: MergePreview = await resolver.previewMerge(
          {
            sourceBranchId: childBranch.id,
            targetBranchId: mainBranch.id,
            worldTime: new Date(),
          },
          testUser
        );

        expect(preview).toBeDefined();
        expect(preview.sourceBranchId).toBe(childBranch.id);
        expect(preview.targetBranchId).toBe(mainBranch.id);
        expect(preview.commonAncestorId).toBe(mainBranch.id);
        expect(preview.entities).toEqual([]);
        expect(preview.totalConflicts).toBe(0);
        expect(preview.totalAutoResolved).toBe(0);
        expect(preview.requiresManualResolution).toBe(false);

        // Cleanup
        await prisma.branch.delete({ where: { id: childBranch.id } });
      });

      it('should preview auto-resolved changes when only source branch modified entity', async () => {
        // Create child branch
        const childBranch = await prisma.branch.create({
          data: {
            name: 'Child',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date('2024-01-01'),
            isPinned: false,
            tags: [],
          },
        });

        // Create settlement version in child branch
        const settlementId = '10000000-0000-0000-0000-000000000001';
        await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: settlementId,
            branchId: childBranch.id,
            payloadGz: await compressPayload({ name: 'Test Settlement', population: 1000 }),
            validFrom: new Date('2024-01-02'),
            validTo: null,
            createdBy: testUser.id,
            version: 1,
          },
        });

        const preview: MergePreview = await resolver.previewMerge(
          {
            sourceBranchId: childBranch.id,
            targetBranchId: mainBranch.id,
            worldTime: new Date('2024-01-03'),
          },
          testUser
        );

        expect(preview.entities.length).toBe(1);
        expect(preview.entities[0].entityType).toBe('settlement');
        expect(preview.entities[0].conflicts).toHaveLength(0);
        expect(preview.totalConflicts).toBe(0);
        expect(preview.requiresManualResolution).toBe(false);

        // Cleanup
        await prisma.version.deleteMany({ where: { entityId: settlementId } });
        await prisma.branch.delete({ where: { id: childBranch.id } });
      });
    });

    describe('merge preview with conflicts', () => {
      it('should detect conflicts when both branches modify same entity property', async () => {
        // Create child branch
        const childBranch = await prisma.branch.create({
          data: {
            name: 'Child',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date('2024-01-01'),
            isPinned: false,
            tags: [],
          },
        });

        const settlementId = '20000000-0000-0000-0000-000000000001';

        // Create base version (in main branch, before fork)
        await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: settlementId,
            branchId: mainBranch.id,
            payloadGz: await compressPayload({ name: 'Base Settlement', population: 1000 }),
            validFrom: new Date('2023-12-01'),
            validTo: null,
            createdBy: testUser.id,
            version: 1,
          },
        });

        // Modify in child branch
        await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: settlementId,
            branchId: childBranch.id,
            payloadGz: await compressPayload({ name: 'Base Settlement', population: 1500 }), // Changed population
            validFrom: new Date('2024-01-02'),
            validTo: null,
            createdBy: testUser.id,
            version: 2,
          },
        });

        // Modify in main branch (target)
        await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: settlementId,
            branchId: mainBranch.id,
            payloadGz: await compressPayload({ name: 'Base Settlement', population: 2000 }), // Different change
            validFrom: new Date('2024-01-02'),
            validTo: null,
            createdBy: testUser.id,
            version: 2,
          },
        });

        const preview: MergePreview = await resolver.previewMerge(
          {
            sourceBranchId: childBranch.id,
            targetBranchId: mainBranch.id,
            worldTime: new Date('2024-01-03'),
          },
          testUser
        );

        expect(preview.entities.length).toBe(1);
        expect(preview.entities[0].conflicts.length).toBeGreaterThan(0);
        expect(preview.totalConflicts).toBeGreaterThan(0);
        expect(preview.requiresManualResolution).toBe(true);

        // Check conflict details
        const conflict = preview.entities[0].conflicts[0];
        expect(conflict.path).toBeDefined();
        expect(conflict.description).toBeDefined();
        expect(conflict.baseValue).toBeDefined();
        expect(conflict.sourceValue).toBeDefined();
        expect(conflict.targetValue).toBeDefined();

        // Cleanup
        await prisma.version.deleteMany({ where: { entityId: settlementId } });
        await prisma.branch.delete({ where: { id: childBranch.id } });
      });

      it('should detect conflicts for nested property changes', async () => {
        // Create child branch
        const childBranch = await prisma.branch.create({
          data: {
            name: 'Child',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date('2024-01-01'),
            isPinned: false,
            tags: [],
          },
        });

        const settlementId = '30000000-0000-0000-0000-000000000001';

        // Create base version with nested resources
        await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: settlementId,
            branchId: mainBranch.id,
            payloadGz: await compressPayload({
              name: 'Resource Settlement',
              variables: { resources: { gold: 100, food: 200 } },
            }),
            validFrom: new Date('2023-12-01'),
            validTo: null,
            createdBy: testUser.id,
            version: 1,
          },
        });

        // Modify gold in child branch
        await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: settlementId,
            branchId: childBranch.id,
            payloadGz: await compressPayload({
              name: 'Resource Settlement',
              variables: { resources: { gold: 150, food: 200 } },
            }),
            validFrom: new Date('2024-01-02'),
            validTo: null,
            createdBy: testUser.id,
            version: 2,
          },
        });

        // Modify gold differently in main branch
        await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: settlementId,
            branchId: mainBranch.id,
            payloadGz: await compressPayload({
              name: 'Resource Settlement',
              variables: { resources: { gold: 200, food: 200 } },
            }),
            validFrom: new Date('2024-01-02'),
            validTo: null,
            createdBy: testUser.id,
            version: 2,
          },
        });

        const preview: MergePreview = await resolver.previewMerge(
          {
            sourceBranchId: childBranch.id,
            targetBranchId: mainBranch.id,
            worldTime: new Date('2024-01-03'),
          },
          testUser
        );

        expect(preview.entities.length).toBe(1);
        expect(preview.totalConflicts).toBeGreaterThan(0);
        expect(preview.requiresManualResolution).toBe(true);

        // Cleanup
        await prisma.version.deleteMany({ where: { entityId: settlementId } });
        await prisma.branch.delete({ where: { id: childBranch.id } });
      });
    });
  });

  describe('executeMerge', () => {
    describe('validation', () => {
      it('should throw NotFoundException for non-existent source branch', async () => {
        await expect(
          resolver.executeMerge(
            {
              sourceBranchId: '00000000-0000-0000-0000-000000000000',
              targetBranchId: mainBranch.id,
              worldTime: new Date(),
              resolutions: [],
            },
            testUser
          )
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw NotFoundException for non-existent target branch', async () => {
        await expect(
          resolver.executeMerge(
            {
              sourceBranchId: mainBranch.id,
              targetBranchId: '00000000-0000-0000-0000-000000000000',
              worldTime: new Date(),
              resolutions: [],
            },
            testUser
          )
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException for branches from different campaigns', async () => {
        // Create another campaign
        const otherCampaign = await prisma.campaign.create({
          data: {
            name: 'Other Campaign 2',
            worldId: testWorld.id,
            ownerId: testUser.id,
          },
        });

        const otherBranch = await prisma.branch.create({
          data: {
            name: 'Other Branch 2',
            campaignId: otherCampaign.id,
            isPinned: false,
            tags: [],
          },
        });

        await expect(
          resolver.executeMerge(
            {
              sourceBranchId: mainBranch.id,
              targetBranchId: otherBranch.id,
              worldTime: new Date(),
              resolutions: [],
            },
            testUser
          )
        ).rejects.toThrow(BadRequestException);

        // Cleanup
        await prisma.branch.deleteMany({ where: { campaignId: otherCampaign.id } });
        await prisma.campaign.delete({ where: { id: otherCampaign.id } });
      });
    });

    describe('authorization', () => {
      it('should allow GM or OWNER to execute merge', async () => {
        // Create child branch
        const childBranch = await prisma.branch.create({
          data: {
            name: 'Child for GM',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date(),
            isPinned: false,
            tags: [],
          },
        });

        // This should not throw since testUser is owner and canEdit is mocked to true
        const result = await resolver.executeMerge(
          {
            sourceBranchId: childBranch.id,
            targetBranchId: mainBranch.id,
            worldTime: new Date(),
            resolutions: [],
          },
          testUser
        );

        expect(result).toBeDefined();
        // Should not throw authorization error since testUser is owner and canEdit is mocked to true

        // Cleanup - delete MergeHistory first to avoid foreign key constraint violation
        await prisma.mergeHistory.deleteMany({
          where: {
            OR: [{ sourceBranchId: childBranch.id }, { targetBranchId: childBranch.id }],
          },
        });
        await prisma.branch.delete({ where: { id: childBranch.id } });
      });
    });

    describe('merge execution', () => {
      it('should successfully execute merge when no entities exist', async () => {
        // Create child branch
        const childBranch = await prisma.branch.create({
          data: {
            name: 'Child for Execution',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date(),
            isPinned: false,
            tags: [],
          },
        });

        const result: MergeResult = await resolver.executeMerge(
          {
            sourceBranchId: childBranch.id,
            targetBranchId: mainBranch.id,
            worldTime: new Date(),
            resolutions: [],
          },
          testUser
        );

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.versionsCreated).toBe(0);
        expect(result.mergedEntityIds).toEqual([]);

        // Cleanup - delete MergeHistory first to avoid foreign key constraint violation
        await prisma.mergeHistory.deleteMany({
          where: {
            OR: [{ sourceBranchId: childBranch.id }, { targetBranchId: childBranch.id }],
          },
        });
        await prisma.branch.delete({ where: { id: childBranch.id } });
      });
    });
  });

  describe('cherryPickVersion', () => {
    describe('validation', () => {
      it('should throw NotFoundException for non-existent source version', async () => {
        await expect(
          resolver.cherryPickVersion(
            {
              sourceVersionId: '00000000-0000-0000-0000-000000000000',
              targetBranchId: mainBranch.id,
              resolutions: [],
            },
            testUser
          )
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw NotFoundException for non-existent target branch', async () => {
        // Create a test version first
        // First create Kingdom and Location since Settlement requires them
        const testKingdom = await prisma.kingdom.create({
          data: {
            campaignId: testCampaign.id,
            name: 'Test Kingdom',
            level: 1,
            variables: {},
          },
        });

        const testLocation = await prisma.location.create({
          data: {
            worldId: testWorld.id,
            type: 'point',
            name: 'Test Location',
          },
        });

        const testEntity = await prisma.settlement.create({
          data: {
            kingdomId: testKingdom.id,
            locationId: testLocation.id,
            name: 'Test Settlement',
            level: 1,
            variables: {},
          },
        });

        const compressed = await compressPayload({
          id: testEntity.id,
          name: 'Test Settlement',
          level: 1,
        });

        const testVersion = await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: testEntity.id,
            branchId: mainBranch.id,
            validFrom: new Date(),
            validTo: null,
            payloadGz: compressed,
            createdBy: testUser.id,
            version: 1,
          },
        });

        await expect(
          resolver.cherryPickVersion(
            {
              sourceVersionId: testVersion.id,
              targetBranchId: '00000000-0000-0000-0000-000000000000',
              resolutions: [],
            },
            testUser
          )
        ).rejects.toThrow(NotFoundException);

        // Cleanup
        await prisma.version.delete({ where: { id: testVersion.id } });
        await prisma.settlement.delete({ where: { id: testEntity.id } });
        await prisma.location.delete({ where: { id: testLocation.id } });
        await prisma.kingdom.delete({ where: { id: testKingdom.id } });
      });

      it('should throw BadRequestException for cherry-pick between different campaigns', async () => {
        // Create another campaign
        const otherCampaign = await prisma.campaign.create({
          data: {
            name: 'Other Cherry-Pick Campaign',
            worldId: testWorld.id,
            ownerId: testUser.id,
          },
        });

        const otherBranch = await prisma.branch.create({
          data: {
            name: 'Other Branch',
            campaignId: otherCampaign.id,
            isPinned: false,
            tags: [],
          },
        });

        // Create entity in first campaign
        const testKingdom = await prisma.kingdom.create({
          data: {
            campaignId: testCampaign.id,
            name: 'Test Kingdom',
            level: 1,
            variables: {},
          },
        });

        const testLocation = await prisma.location.create({
          data: {
            worldId: testWorld.id,
            type: 'point',
            name: 'Test Location',
          },
        });

        const testEntity = await prisma.settlement.create({
          data: {
            kingdomId: testKingdom.id,
            locationId: testLocation.id,
            name: 'Test Settlement',
            level: 1,
            variables: {},
          },
        });

        const compressed = await compressPayload({
          id: testEntity.id,
          name: 'Test Settlement',
          level: 1,
        });

        const testVersion = await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: testEntity.id,
            branchId: mainBranch.id,
            validFrom: new Date(),
            validTo: null,
            payloadGz: compressed,
            createdBy: testUser.id,
            version: 1,
          },
        });

        await expect(
          resolver.cherryPickVersion(
            {
              sourceVersionId: testVersion.id,
              targetBranchId: otherBranch.id,
              resolutions: [],
            },
            testUser
          )
        ).rejects.toThrow(BadRequestException);

        // Cleanup
        await prisma.version.delete({ where: { id: testVersion.id } });
        await prisma.settlement.delete({ where: { id: testEntity.id } });
        await prisma.location.delete({ where: { id: testLocation.id } });
        await prisma.kingdom.delete({ where: { id: testKingdom.id } });
        await prisma.branch.deleteMany({ where: { campaignId: otherCampaign.id } });
        await prisma.campaign.delete({ where: { id: otherCampaign.id } });
      });
    });

    describe('authorization', () => {
      it('should throw ForbiddenException for user without campaign access', async () => {
        // Create another user without campaign access
        const otherUser = await prisma.user.create({
          data: {
            email: 'other-cherrypick-test@example.com',
            name: 'Other User',
            password: 'hash',
          },
        });

        const otherAuthUser: AuthenticatedUser = {
          id: otherUser.id,
          email: otherUser.email,
          role: 'user',
        };

        // Create a test entity and version
        const testKingdom = await prisma.kingdom.create({
          data: {
            campaignId: testCampaign.id,
            name: 'Test Kingdom',
            level: 1,
            variables: {},
          },
        });

        const testLocation = await prisma.location.create({
          data: {
            worldId: testWorld.id,
            type: 'point',
            name: 'Test Location',
          },
        });

        const testEntity = await prisma.settlement.create({
          data: {
            kingdomId: testKingdom.id,
            locationId: testLocation.id,
            name: 'Test Settlement',
            level: 1,
            variables: {},
          },
        });

        const compressed = await compressPayload({
          id: testEntity.id,
          name: 'Test Settlement',
          level: 1,
        });

        const testVersion = await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: testEntity.id,
            branchId: mainBranch.id,
            validFrom: new Date(),
            validTo: null,
            payloadGz: compressed,
            createdBy: testUser.id,
            version: 1,
          },
        });

        await expect(
          resolver.cherryPickVersion(
            {
              sourceVersionId: testVersion.id,
              targetBranchId: mainBranch.id,
              resolutions: [],
            },
            otherAuthUser
          )
        ).rejects.toThrow(ForbiddenException);

        // Cleanup
        await prisma.version.delete({ where: { id: testVersion.id } });
        await prisma.settlement.delete({ where: { id: testEntity.id } });
        await prisma.location.delete({ where: { id: testLocation.id } });
        await prisma.kingdom.delete({ where: { id: testKingdom.id } });
        await prisma.user.delete({ where: { id: otherUser.id } });
      });
    });

    describe('successful cherry-pick', () => {
      it('should cherry-pick version without conflicts', async () => {
        // Create source branch
        const sourceBranch = await prisma.branch.create({
          data: {
            name: 'Source Branch',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date(),
            isPinned: false,
            tags: [],
          },
        });

        // Create target branch
        const targetBranch = await prisma.branch.create({
          data: {
            name: 'Target Branch',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date(),
            isPinned: false,
            tags: [],
          },
        });

        // Create entity in source branch
        const testKingdom = await prisma.kingdom.create({
          data: {
            campaignId: testCampaign.id,
            name: 'Test Kingdom',
            level: 1,
            variables: {},
          },
        });

        const testLocation = await prisma.location.create({
          data: {
            worldId: testWorld.id,
            type: 'point',
            name: 'Test Location',
          },
        });

        const testEntity = await prisma.settlement.create({
          data: {
            kingdomId: testKingdom.id,
            locationId: testLocation.id,
            name: 'Cherry-Pick Settlement',
            level: 1,
            variables: { population: 1000 },
          },
        });

        const compressed = await compressPayload({
          id: testEntity.id,
          name: 'Cherry-Pick Settlement',
          level: 1,
          population: 1000,
        });

        const sourceVersion = await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: testEntity.id,
            branchId: sourceBranch.id,
            validFrom: new Date(),
            validTo: null,
            payloadGz: compressed,
            createdBy: testUser.id,
            version: 1,
          },
        });

        const result = await resolver.cherryPickVersion(
          {
            sourceVersionId: sourceVersion.id,
            targetBranchId: targetBranch.id,
            resolutions: [],
          },
          testUser
        );

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.hasConflict).toBe(false);
        expect(result.versionId).toBeDefined();
        expect(result.conflicts).toBeUndefined();

        // Verify version was created in target branch
        const createdVersion = await prisma.version.findUnique({
          where: { id: result.versionId! },
        });
        expect(createdVersion).toBeDefined();
        expect(createdVersion?.branchId).toBe(targetBranch.id);

        // Cleanup
        await prisma.audit.deleteMany({ where: { userId: testUser.id } });
        await prisma.version.deleteMany({ where: { entityId: testEntity.id } });
        await prisma.settlement.delete({ where: { id: testEntity.id } });
        await prisma.location.delete({ where: { id: testLocation.id } });
        await prisma.kingdom.delete({ where: { id: testKingdom.id } });
        await prisma.branch.deleteMany({
          where: { id: { in: [sourceBranch.id, targetBranch.id] } },
        });
      });

      it('should detect conflicts during cherry-pick', async () => {
        // Create source branch
        const sourceBranch = await prisma.branch.create({
          data: {
            name: 'Source Branch',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date(),
            isPinned: false,
            tags: [],
          },
        });

        // Create target branch
        const targetBranch = await prisma.branch.create({
          data: {
            name: 'Target Branch',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date(),
            isPinned: false,
            tags: [],
          },
        });

        // Create entity
        const testKingdom = await prisma.kingdom.create({
          data: {
            campaignId: testCampaign.id,
            name: 'Test Kingdom',
            level: 1,
            variables: {},
          },
        });

        const testLocation = await prisma.location.create({
          data: {
            worldId: testWorld.id,
            type: 'point',
            name: 'Test Location',
          },
        });

        const testEntity = await prisma.settlement.create({
          data: {
            kingdomId: testKingdom.id,
            locationId: testLocation.id,
            name: 'Conflict Settlement',
            level: 1,
            variables: {},
          },
        });

        // Create version in source branch with population: 1000
        const sourceCompressed = await compressPayload({
          id: testEntity.id,
          name: 'Conflict Settlement',
          level: 1,
          population: 1000,
        });

        const conflictWorldTime = new Date('2025-01-15T12:00:00Z');

        const sourceVersion = await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: testEntity.id,
            branchId: sourceBranch.id,
            validFrom: conflictWorldTime,
            validTo: null,
            payloadGz: sourceCompressed,
            createdBy: testUser.id,
            version: 1,
          },
        });

        // Create conflicting version in target branch with population: 2000
        const targetCompressed = await compressPayload({
          id: testEntity.id,
          name: 'Conflict Settlement',
          level: 1,
          population: 2000,
        });

        await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: testEntity.id,
            branchId: targetBranch.id,
            validFrom: conflictWorldTime,
            validTo: null,
            payloadGz: targetCompressed,
            createdBy: testUser.id,
            version: 1,
          },
        });

        const result = await resolver.cherryPickVersion(
          {
            sourceVersionId: sourceVersion.id,
            targetBranchId: targetBranch.id,
            resolutions: [],
          },
          testUser
        );

        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.hasConflict).toBe(true);
        expect(result.conflicts).toBeDefined();
        expect(result.conflicts!.length).toBeGreaterThan(0);
        expect(result.versionId).toBeUndefined();

        // Cleanup
        await prisma.version.deleteMany({ where: { entityId: testEntity.id } });
        await prisma.settlement.delete({ where: { id: testEntity.id } });
        await prisma.location.delete({ where: { id: testLocation.id } });
        await prisma.kingdom.delete({ where: { id: testKingdom.id } });
        await prisma.branch.deleteMany({
          where: { id: { in: [sourceBranch.id, targetBranch.id] } },
        });
      });

      it('should resolve conflicts with manual resolutions', async () => {
        // Create source branch
        const sourceBranch = await prisma.branch.create({
          data: {
            name: 'Source Branch',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date(),
            isPinned: false,
            tags: [],
          },
        });

        // Create target branch
        const targetBranch = await prisma.branch.create({
          data: {
            name: 'Target Branch',
            campaignId: testCampaign.id,
            parentId: mainBranch.id,
            divergedAt: new Date(),
            isPinned: false,
            tags: [],
          },
        });

        // Create entity
        const testKingdom = await prisma.kingdom.create({
          data: {
            campaignId: testCampaign.id,
            name: 'Test Kingdom',
            level: 1,
            variables: {},
          },
        });

        const testLocation = await prisma.location.create({
          data: {
            worldId: testWorld.id,
            type: 'point',
            name: 'Test Location',
          },
        });

        const testEntity = await prisma.settlement.create({
          data: {
            kingdomId: testKingdom.id,
            locationId: testLocation.id,
            name: 'Resolution Settlement',
            level: 1,
            variables: {},
          },
        });

        // Create version in source branch with population: 1000
        const sourceCompressed = await compressPayload({
          id: testEntity.id,
          name: 'Resolution Settlement',
          level: 1,
          population: 1000,
        });

        const sourceVersion = await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: testEntity.id,
            branchId: sourceBranch.id,
            validFrom: new Date(),
            validTo: null,
            payloadGz: sourceCompressed,
            createdBy: testUser.id,
            version: 1,
          },
        });

        // Create conflicting version in target branch with population: 2000
        const targetCompressed = await compressPayload({
          id: testEntity.id,
          name: 'Resolution Settlement',
          level: 1,
          population: 2000,
        });

        await prisma.version.create({
          data: {
            entityType: 'settlement',
            entityId: testEntity.id,
            branchId: targetBranch.id,
            validFrom: new Date(),
            validTo: null,
            payloadGz: targetCompressed,
            createdBy: testUser.id,
            version: 1,
          },
        });

        const result = await resolver.cherryPickVersion(
          {
            sourceVersionId: sourceVersion.id,
            targetBranchId: targetBranch.id,
            resolutions: [
              {
                entityId: testEntity.id,
                entityType: 'settlement',
                path: 'population',
                resolvedValue: '1500',
              },
            ],
          },
          testUser
        );

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.hasConflict).toBe(false);
        expect(result.versionId).toBeDefined();

        // Cleanup
        await prisma.audit.deleteMany({ where: { userId: testUser.id } });
        await prisma.version.deleteMany({ where: { entityId: testEntity.id } });
        await prisma.settlement.delete({ where: { id: testEntity.id } });
        await prisma.location.delete({ where: { id: testLocation.id } });
        await prisma.kingdom.delete({ where: { id: testKingdom.id } });
        await prisma.branch.deleteMany({
          where: { id: { in: [sourceBranch.id, targetBranch.id] } },
        });
      });
    });
  });

  describe('getMergeHistory', () => {
    it('should return empty array when branch has no merge history', async () => {
      // Create test entities
      const testKingdom = await prisma.kingdom.create({
        data: {
          name: 'Test Kingdom',
          level: 1,
          campaignId: testCampaign.id,
        },
      });

      const testLocation = await prisma.location.create({
        data: {
          name: 'Test Location',
          worldId: testWorld.id,
          type: 'point',
        },
      });

      const testEntity = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          level: 1,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
          variables: { population: 1000 },
        },
      });

      // Create a feature branch with no merges
      const branch = await prisma.branch.create({
        data: {
          name: 'feature/no-merges',
          campaignId: testCampaign.id,
          parentId: mainBranch.id,
          divergedAt: new Date(),
        },
      });

      const history = await resolver.getMergeHistory(branch.id, testUser);

      expect(history).toBeDefined();
      expect(history).toEqual([]);

      // Cleanup
      await prisma.branch.delete({ where: { id: branch.id } });
      await prisma.settlement.delete({ where: { id: testEntity.id } });
      await prisma.location.delete({ where: { id: testLocation.id } });
      await prisma.kingdom.delete({ where: { id: testKingdom.id } });
    });

    it('should return merge history for branch as source', async () => {
      // Create test entities
      const testKingdom = await prisma.kingdom.create({
        data: {
          name: 'Test Kingdom',
          level: 1,
          campaignId: testCampaign.id,
        },
      });

      const testLocation = await prisma.location.create({
        data: {
          name: 'Test Location',
          worldId: testWorld.id,
          type: 'point',
        },
      });

      const testEntity = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          level: 1,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
          variables: { population: 1000 },
        },
      });

      // Create source and target branches
      const sourceBranch = await prisma.branch.create({
        data: {
          name: 'feature/source',
          campaignId: testCampaign.id,
          parentId: mainBranch.id,
          divergedAt: new Date(),
        },
      });

      const targetBranch = await prisma.branch.create({
        data: {
          name: 'feature/target',
          campaignId: testCampaign.id,
          parentId: mainBranch.id,
          divergedAt: new Date(),
        },
      });

      // Create a merge history entry manually
      const mergeEntry = await prisma.mergeHistory.create({
        data: {
          sourceBranchId: sourceBranch.id,
          targetBranchId: targetBranch.id,
          commonAncestorId: mainBranch.id,
          worldTime: new Date(),
          mergedBy: testUser.id,
          conflictsCount: 0,
          entitiesMerged: 1,
          resolutionsData: {},
          metadata: {},
        },
      });

      const history = await resolver.getMergeHistory(sourceBranch.id, testUser);

      expect(history).toBeDefined();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(mergeEntry.id);
      expect(history[0].sourceBranchId).toBe(sourceBranch.id);
      expect(history[0].targetBranchId).toBe(targetBranch.id);
      expect(history[0].commonAncestorId).toBe(mainBranch.id);
      expect(history[0].conflictsCount).toBe(0);
      expect(history[0].entitiesMerged).toBe(1);

      // Cleanup
      await prisma.mergeHistory.delete({ where: { id: mergeEntry.id } });
      await prisma.branch.deleteMany({
        where: { id: { in: [sourceBranch.id, targetBranch.id] } },
      });
      await prisma.settlement.delete({ where: { id: testEntity.id } });
      await prisma.location.delete({ where: { id: testLocation.id } });
      await prisma.kingdom.delete({ where: { id: testKingdom.id } });
    });

    it('should return merge history for branch as target', async () => {
      // Create test entities
      const testKingdom = await prisma.kingdom.create({
        data: {
          name: 'Test Kingdom',
          level: 1,
          campaignId: testCampaign.id,
        },
      });

      const testLocation = await prisma.location.create({
        data: {
          name: 'Test Location',
          worldId: testWorld.id,
          type: 'point',
        },
      });

      const testEntity = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          level: 1,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
          variables: { population: 1000 },
        },
      });

      // Create source and target branches
      const sourceBranch = await prisma.branch.create({
        data: {
          name: 'feature/source',
          campaignId: testCampaign.id,
          parentId: mainBranch.id,
          divergedAt: new Date(),
        },
      });

      const targetBranch = await prisma.branch.create({
        data: {
          name: 'feature/target',
          campaignId: testCampaign.id,
          parentId: mainBranch.id,
          divergedAt: new Date(),
        },
      });

      // Create a merge history entry manually
      const mergeEntry = await prisma.mergeHistory.create({
        data: {
          sourceBranchId: sourceBranch.id,
          targetBranchId: targetBranch.id,
          commonAncestorId: mainBranch.id,
          worldTime: new Date(),
          mergedBy: testUser.id,
          conflictsCount: 2,
          entitiesMerged: 3,
          resolutionsData: { 'entity1:population': 1500 },
          metadata: { note: 'test merge' },
        },
      });

      const history = await resolver.getMergeHistory(targetBranch.id, testUser);

      expect(history).toBeDefined();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(mergeEntry.id);
      expect(history[0].sourceBranchId).toBe(sourceBranch.id);
      expect(history[0].targetBranchId).toBe(targetBranch.id);
      expect(history[0].conflictsCount).toBe(2);
      expect(history[0].entitiesMerged).toBe(3);
      expect(history[0].resolutionsData).toEqual({ 'entity1:population': 1500 });
      expect(history[0].metadata).toEqual({ note: 'test merge' });

      // Cleanup
      await prisma.mergeHistory.delete({ where: { id: mergeEntry.id } });
      await prisma.branch.deleteMany({
        where: { id: { in: [sourceBranch.id, targetBranch.id] } },
      });
      await prisma.settlement.delete({ where: { id: testEntity.id } });
      await prisma.location.delete({ where: { id: testLocation.id } });
      await prisma.kingdom.delete({ where: { id: testKingdom.id } });
    });

    it('should return multiple merge history entries sorted by most recent first', async () => {
      // Create test entities
      const testKingdom = await prisma.kingdom.create({
        data: {
          name: 'Test Kingdom',
          level: 1,
          campaignId: testCampaign.id,
        },
      });

      const testLocation = await prisma.location.create({
        data: {
          name: 'Test Location',
          worldId: testWorld.id,
          type: 'point',
        },
      });

      const testEntity = await prisma.settlement.create({
        data: {
          name: 'Test Settlement',
          level: 1,
          kingdomId: testKingdom.id,
          locationId: testLocation.id,
          variables: { population: 1000 },
        },
      });

      // Create branches
      const branch = await prisma.branch.create({
        data: {
          name: 'feature/multi-merge',
          campaignId: testCampaign.id,
          parentId: mainBranch.id,
          divergedAt: new Date(),
        },
      });

      const otherBranch = await prisma.branch.create({
        data: {
          name: 'feature/other',
          campaignId: testCampaign.id,
          parentId: mainBranch.id,
          divergedAt: new Date(),
        },
      });

      // Create multiple merge entries with different timestamps
      const now = new Date();
      const merge1 = await prisma.mergeHistory.create({
        data: {
          sourceBranchId: branch.id,
          targetBranchId: mainBranch.id,
          commonAncestorId: mainBranch.id,
          worldTime: now,
          mergedBy: testUser.id,
          mergedAt: new Date(now.getTime() - 2000), // 2 seconds ago
          conflictsCount: 0,
          entitiesMerged: 1,
          resolutionsData: {},
          metadata: {},
        },
      });

      const merge2 = await prisma.mergeHistory.create({
        data: {
          sourceBranchId: otherBranch.id,
          targetBranchId: branch.id,
          commonAncestorId: mainBranch.id,
          worldTime: now,
          mergedBy: testUser.id,
          mergedAt: new Date(now.getTime() - 1000), // 1 second ago (more recent)
          conflictsCount: 1,
          entitiesMerged: 2,
          resolutionsData: {},
          metadata: {},
        },
      });

      const history = await resolver.getMergeHistory(branch.id, testUser);

      expect(history).toBeDefined();
      expect(history).toHaveLength(2);
      // Most recent first
      expect(history[0].id).toBe(merge2.id);
      expect(history[1].id).toBe(merge1.id);

      // Cleanup
      await prisma.mergeHistory.deleteMany({
        where: { id: { in: [merge1.id, merge2.id] } },
      });
      await prisma.branch.deleteMany({
        where: { id: { in: [branch.id, otherBranch.id] } },
      });
      await prisma.settlement.delete({ where: { id: testEntity.id } });
      await prisma.location.delete({ where: { id: testLocation.id } });
      await prisma.kingdom.delete({ where: { id: testKingdom.id } });
    });

    it('should throw NotFoundException when branch does not exist', async () => {
      await expect(resolver.getMergeHistory('nonexistent-id', testUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException when user has no campaign access', async () => {
      // Create a user without campaign access
      const otherUser = await prisma.user.create({
        data: {
          email: 'no-access@example.com',
          name: 'No Access User',
          password: 'hash',
        },
      });

      const otherAuthUser: AuthenticatedUser = {
        id: otherUser.id,
        email: otherUser.email,
        role: 'player',
      };

      // Create a branch
      const branch = await prisma.branch.create({
        data: {
          name: 'feature/private',
          campaignId: testCampaign.id,
          parentId: mainBranch.id,
          divergedAt: new Date(),
        },
      });

      await expect(resolver.getMergeHistory(branch.id, otherAuthUser)).rejects.toThrow(
        ForbiddenException
      );

      // Cleanup
      await prisma.branch.delete({ where: { id: branch.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });
});
