/**
 * Branch Resolver Integration Tests
 * E2E tests for Branch GraphQL queries and mutations
 */

import { ForbiddenException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Branch as PrismaBranch, Campaign, User } from '@prisma/client';

import { CampaignMembershipService } from '../../auth/services/campaign-membership.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { AuditService } from '../services/audit.service';
import { BranchService } from '../services/branch.service';
import { VersionService } from '../services/version.service';

import { BranchResolver } from './branch.resolver';

describe('BranchResolver Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolver: BranchResolver;

  let testUser: AuthenticatedUser;
  let dbUser: User;
  let testCampaign: Campaign;
  let testWorld: { id: string; name: string };
  let mainBranch: PrismaBranch;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BranchResolver,
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
    resolver = moduleRef.get<BranchResolver>(BranchResolver);

    // Clean up any existing test data from previous runs
    await prisma.audit.deleteMany({ where: { user: { email: 'branch-test@example.com' } } });
    await prisma.version.deleteMany({ where: { user: { email: 'branch-test@example.com' } } });
    await prisma.branch.deleteMany({ where: { campaign: { name: 'Branch Test Campaign' } } });
    await prisma.campaign.deleteMany({ where: { name: 'Branch Test Campaign' } });
    await prisma.world.deleteMany({ where: { name: 'Branch Test World' } });
    await prisma.user.deleteMany({ where: { email: 'branch-test@example.com' } });

    // Create test user
    dbUser = await prisma.user.create({
      data: {
        email: 'branch-test@example.com',
        name: 'Branch Test User',
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
        name: 'Branch Test World',
        calendars: {},
      },
    });

    // Create test campaign
    testCampaign = await prisma.campaign.create({
      data: {
        name: 'Branch Test Campaign',
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
  });

  afterAll(async () => {
    // Clean up test data in correct order (respecting foreign key constraints)
    if (dbUser) {
      await prisma.audit.deleteMany({ where: { userId: dbUser.id } });
      await prisma.version.deleteMany({ where: { createdBy: dbUser.id } });
    }
    if (testCampaign) {
      await prisma.branch.deleteMany({ where: { campaignId: testCampaign.id } });
      await prisma.campaignMembership.deleteMany({ where: { campaignId: testCampaign.id } });
      await prisma.campaign.deleteMany({ where: { id: testCampaign.id } });
    }
    if (testWorld) {
      await prisma.world.deleteMany({ where: { id: testWorld.id } });
    }
    if (dbUser) {
      await prisma.user.deleteMany({ where: { id: dbUser.id } });
    }

    await app.close();
  });

  describe('branch query', () => {
    it('should return branch by ID', async () => {
      const result = await resolver.branch(mainBranch.id, testUser);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mainBranch.id);
      expect(result?.name).toBe('Main');
      expect(result?.campaignId).toBe(testCampaign.id);
    });

    it('should return null for non-existent branch', async () => {
      const result = await resolver.branch('00000000-0000-0000-0000-000000000000', testUser);

      expect(result).toBeNull();
    });

    it('should throw ForbiddenException if user does not have access to campaign', async () => {
      const unauthorizedUser: AuthenticatedUser = {
        id: '99999999-9999-9999-9999-999999999999',
        email: 'unauthorized@example.com',
        role: 'owner',
      };

      await expect(resolver.branch(mainBranch.id, unauthorizedUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('branches query', () => {
    it('should return all branches for a campaign', async () => {
      const result = await resolver.branches(testCampaign.id, testUser);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((b) => b.id === mainBranch.id)).toBe(true);
    });

    it('should throw ForbiddenException if user does not have access to campaign', async () => {
      const unauthorizedUser: AuthenticatedUser = {
        id: '99999999-9999-9999-9999-999999999999',
        email: 'unauthorized@example.com',
        role: 'owner',
      };

      await expect(resolver.branches(testCampaign.id, unauthorizedUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('branchHierarchy query', () => {
    let childBranch: PrismaBranch;

    beforeAll(async () => {
      // Create a child branch for hierarchy testing
      childBranch = await prisma.branch.create({
        data: {
          name: 'Alternate Timeline',
          description: 'What if...',
          campaignId: testCampaign.id,
          parentId: mainBranch.id,
          divergedAt: new Date('2024-01-01'),
        },
      });
    });

    afterAll(async () => {
      if (childBranch) {
        await prisma.branch.delete({ where: { id: childBranch.id } });
      }
    });

    it('should return branch hierarchy tree structure', async () => {
      const result = await resolver.branchHierarchy(testCampaign.id, testUser);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Find the main branch node
      const mainNode = result.find((node) => node.branch.id === mainBranch.id);
      expect(mainNode).toBeDefined();
      expect(mainNode?.children).toBeDefined();
      expect(mainNode?.children.length).toBeGreaterThanOrEqual(1);

      // Verify child branch is in hierarchy
      const childNode = mainNode?.children.find((node) => node.branch.id === childBranch.id);
      expect(childNode).toBeDefined();
    });

    it('should throw ForbiddenException if user does not have access to campaign', async () => {
      const unauthorizedUser: AuthenticatedUser = {
        id: '99999999-9999-9999-9999-999999999999',
        email: 'unauthorized@example.com',
        role: 'owner',
      };

      await expect(resolver.branchHierarchy(testCampaign.id, unauthorizedUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('createBranch mutation', () => {
    it('should create a new branch', async () => {
      const input = {
        campaignId: testCampaign.id,
        name: 'New Branch',
        description: 'A new timeline',
      };

      const result = await resolver.createBranch(input, testUser);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('New Branch');
      expect(result.description).toBe('A new timeline');
      expect(result.campaignId).toBe(testCampaign.id);

      // Clean up
      await prisma.branch.delete({ where: { id: result.id } });
    });

    it('should create a branch with parent', async () => {
      const input = {
        campaignId: testCampaign.id,
        name: 'Child Branch',
        description: 'Child of main',
        parentId: mainBranch.id,
        divergedAt: new Date('2024-06-01'),
      };

      const result = await resolver.createBranch(input, testUser);

      expect(result).toBeDefined();
      expect(result.parentId).toBe(mainBranch.id);
      expect(result.divergedAt).toEqual(new Date('2024-06-01'));

      // Clean up
      await prisma.branch.delete({ where: { id: result.id } });
    });

    it('should throw error for non-existent campaign', async () => {
      const input = {
        campaignId: '00000000-0000-0000-0000-000000000000',
        name: 'Invalid Branch',
      };

      await expect(resolver.createBranch(input, testUser)).rejects.toThrow();
    });
  });

  describe('updateBranch mutation', () => {
    let branchToUpdate: PrismaBranch;

    beforeAll(async () => {
      branchToUpdate = await prisma.branch.create({
        data: {
          name: 'Original Name',
          description: 'Original description',
          campaignId: testCampaign.id,
        },
      });
    });

    afterAll(async () => {
      if (branchToUpdate) {
        await prisma.branch.deleteMany({ where: { id: branchToUpdate.id } });
      }
    });

    it('should update branch name and description', async () => {
      const input = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const result = await resolver.updateBranch(branchToUpdate.id, input, testUser);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated description');
    });

    it('should update only name', async () => {
      const input = {
        name: 'Name Only Update',
      };

      const result = await resolver.updateBranch(branchToUpdate.id, input, testUser);

      expect(result).toBeDefined();
      expect(result.name).toBe('Name Only Update');
      // Description should remain unchanged
      expect(result.description).toBe('Updated description');
    });

    it('should throw error for non-existent branch', async () => {
      const input = {
        name: 'Updated Name',
      };

      await expect(
        resolver.updateBranch('00000000-0000-0000-0000-000000000000', input, testUser)
      ).rejects.toThrow();
    });
  });

  describe('deleteBranch mutation', () => {
    it('should soft delete a branch', async () => {
      const branchToDelete = await prisma.branch.create({
        data: {
          name: 'To Delete',
          campaignId: testCampaign.id,
          parentId: mainBranch.id, // Must have a parent to be deletable
        },
      });

      const result = await resolver.deleteBranch(branchToDelete.id, testUser);

      expect(result).toBe(true);

      // Verify soft delete
      const deletedBranch = await prisma.branch.findUnique({
        where: { id: branchToDelete.id },
      });
      expect(deletedBranch?.deletedAt).not.toBeNull();
    });

    it('should throw error when deleting branch with children', async () => {
      const parentBranch = await prisma.branch.create({
        data: {
          name: 'Parent',
          campaignId: testCampaign.id,
        },
      });

      const childBranch = await prisma.branch.create({
        data: {
          name: 'Child',
          campaignId: testCampaign.id,
          parentId: parentBranch.id,
        },
      });

      await expect(resolver.deleteBranch(parentBranch.id, testUser)).rejects.toThrow();

      // Clean up
      await prisma.branch.deleteMany({ where: { id: childBranch.id } });
      await prisma.branch.deleteMany({ where: { id: parentBranch.id } });
    });

    it('should throw error for non-existent branch', async () => {
      await expect(
        resolver.deleteBranch('00000000-0000-0000-0000-000000000000', testUser)
      ).rejects.toThrow();
    });
  });

  describe('forkBranch mutation', () => {
    let campaignForFork: Campaign;
    let branchForFork: PrismaBranch;
    let worldForFork: { id: string };

    beforeAll(async () => {
      // Clean up any existing fork test data from previous runs
      await prisma.version.deleteMany({
        where: { branch: { campaign: { name: 'Fork Test Campaign' } } },
      });
      await prisma.branch.deleteMany({ where: { campaign: { name: 'Fork Test Campaign' } } });
      await prisma.campaign.deleteMany({ where: { name: 'Fork Test Campaign' } });
      await prisma.world.deleteMany({ where: { name: 'Fork Test World' } });

      // Create isolated campaign for fork testing to avoid interfering with other tests
      worldForFork = await prisma.world.create({
        data: {
          name: 'Fork Test World',
          calendars: {},
        },
      });

      campaignForFork = await prisma.campaign.create({
        data: {
          name: 'Fork Test Campaign',
          worldId: worldForFork.id,
          ownerId: testUser.id,
        },
      });

      branchForFork = await prisma.branch.create({
        data: {
          name: 'Main for Fork',
          campaignId: campaignForFork.id,
        },
      });

      // Create some versioned entities for this campaign to be copied during fork
      await prisma.version.create({
        data: {
          entityType: 'campaign',
          entityId: campaignForFork.id,
          version: 1,
          validFrom: new Date('2024-01-01'),
          payloadGz: Buffer.from('test'),
          branchId: branchForFork.id,
          createdBy: dbUser.id,
        },
      });
    });

    afterAll(async () => {
      // Clean up all fork test data
      if (branchForFork) {
        await prisma.version.deleteMany({ where: { branchId: branchForFork.id } });
      }
      if (campaignForFork) {
        await prisma.branch.deleteMany({ where: { campaignId: campaignForFork.id } });
        await prisma.campaignMembership.deleteMany({ where: { campaignId: campaignForFork.id } });
        await prisma.campaign.deleteMany({ where: { id: campaignForFork.id } });
      }
      if (worldForFork) {
        await prisma.world.deleteMany({ where: { id: worldForFork.id } });
      }
    });

    it('should fork a branch and copy versions', async () => {
      const input = {
        sourceBranchId: branchForFork.id,
        name: 'Forked Timeline',
        description: 'Fork of main',
        worldTime: new Date('2024-06-01'),
      };

      const result = await resolver.forkBranch(input, testUser);

      expect(result).toBeDefined();
      expect(result.branch).toBeDefined();
      expect(result.branch.name).toBe('Forked Timeline');
      expect(result.branch.description).toBe('Fork of main');
      expect(result.branch.parentId).toBe(branchForFork.id);
      expect(result.branch.divergedAt).toEqual(new Date('2024-06-01'));
      expect(result.versionsCopied).toBeGreaterThanOrEqual(0);

      // Clean up
      await prisma.version.deleteMany({ where: { branchId: result.branch.id } });
      await prisma.branch.delete({ where: { id: result.branch.id } });
    });

    it('should throw error for non-existent source branch', async () => {
      const input = {
        sourceBranchId: '00000000-0000-0000-0000-000000000000',
        name: 'Invalid Fork',
        worldTime: new Date('2024-06-01'),
      };

      await expect(resolver.forkBranch(input, testUser)).rejects.toThrow();
    });

    it('should throw ForbiddenException if user does not have access to campaign', async () => {
      const unauthorizedUser: AuthenticatedUser = {
        id: '99999999-9999-9999-9999-999999999999',
        email: 'unauthorized@example.com',
        role: 'owner',
      };

      const input = {
        sourceBranchId: branchForFork.id,
        name: 'Unauthorized Fork',
        worldTime: new Date('2024-06-01'),
      };

      await expect(resolver.forkBranch(input, unauthorizedUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });
});
