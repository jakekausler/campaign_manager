/**
 * Merge Resolver Integration Tests
 * E2E tests for Merge GraphQL queries and mutations
 */

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Branch as PrismaBranch, Campaign, User } from '@prisma/client';

import { CampaignMembershipService } from '../../auth/services/campaign-membership.service';
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
    await prisma.campaign.deleteMany({ where: { name: 'Merge Test Campaign' } });
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
    // Clean up test data
    await prisma.mergeHistory.deleteMany({ where: { user: { email: 'merge-test@example.com' } } });
    await prisma.audit.deleteMany({ where: { user: { email: 'merge-test@example.com' } } });
    await prisma.version.deleteMany({ where: { user: { email: 'merge-test@example.com' } } });
    await prisma.branch.deleteMany({ where: { campaign: { name: 'Merge Test Campaign' } } });
    await prisma.campaign.deleteMany({ where: { name: 'Merge Test Campaign' } });
    await prisma.world.deleteMany({ where: { name: 'Merge Test World' } });
    await prisma.user.deleteMany({ where: { email: 'merge-test@example.com' } });

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
});
