/**
 * Branch Service
 * Business logic for Branch operations (alternate timeline management)
 * Implements CRUD with hierarchy traversal and validation
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Branch as PrismaBranch } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type {
  CreateBranchInput,
  UpdateBranchInput,
  BranchWhereInput,
} from '../inputs/branch.input';

import { AuditService } from './audit.service';
import { VersionService } from './version.service';

/**
 * Branch node for hierarchy tree structure
 */
export interface BranchNode {
  branch: PrismaBranch;
  children: BranchNode[];
}

/**
 * Result of fork operation with statistics
 */
export interface ForkResult {
  branch: PrismaBranch;
  versionsCopied: number;
}

@Injectable()
export class BranchService {
  private static readonly MAX_ANCESTRY_DEPTH = 100;
  // All entity types that support versioning
  private static readonly ENTITY_TYPES = [
    'campaign',
    'world',
    'location',
    'character',
    'party',
    'kingdom',
    'settlement',
    'structure',
    'encounter',
    'event',
  ] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService
  ) {}

  /**
   * Find branch by ID
   * Includes parent and children relations
   */
  async findById(id: string): Promise<PrismaBranch | null> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
        },
        campaign: true,
      },
    });

    return branch;
  }

  /**
   * Find all branches for a campaign
   * Returns flat list ordered by name
   */
  async findByCampaign(campaignId: string): Promise<PrismaBranch[]> {
    return this.prisma.branch.findMany({
      where: {
        campaignId,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find branches matching filter criteria
   */
  async find(where: BranchWhereInput): Promise<PrismaBranch[]> {
    return this.prisma.branch.findMany({
      where: {
        ...where,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Create a new branch
   * Validates campaign exists, user has access, and parentId if provided
   */
  async create(input: CreateBranchInput, user: AuthenticatedUser): Promise<PrismaBranch> {
    // Verify campaign exists
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: input.campaignId, deletedAt: null },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${input.campaignId} not found`);
    }

    // Verify user has access to the campaign
    await this.checkCampaignAccess(input.campaignId, user);

    // Check for duplicate branch name within campaign
    const existingBranch = await this.prisma.branch.findFirst({
      where: {
        campaignId: input.campaignId,
        name: input.name,
        deletedAt: null,
      },
    });

    if (existingBranch) {
      throw new BadRequestException(
        `A branch named "${input.name}" already exists in this campaign`
      );
    }

    // If parentId provided, verify it exists and belongs to same campaign
    if (input.parentId) {
      const parent = await this.prisma.branch.findFirst({
        where: {
          id: input.parentId,
          campaignId: input.campaignId,
          deletedAt: null,
        },
      });

      if (!parent) {
        throw new BadRequestException(
          `Parent branch with ID ${input.parentId} not found or does not belong to this campaign`
        );
      }

      // Check for circular reference: parent cannot be a descendant of this branch
      // Since this is a new branch, we only need to check if parent exists
      // The circular check is more important during updates
    }

    // Create branch
    const branch = await this.prisma.branch.create({
      data: {
        campaignId: input.campaignId,
        name: input.name,
        description: input.description,
        parentId: input.parentId,
        divergedAt: input.divergedAt,
        isPinned: input.isPinned ?? false,
        color: input.color,
        tags: input.tags ?? [],
      },
      include: {
        parent: true,
        children: true,
      },
    });

    // Create audit entry
    await this.audit.log('branch', branch.id, 'CREATE', user.id, {
      name: branch.name,
      description: branch.description,
      parentId: branch.parentId,
      divergedAt: branch.divergedAt,
    });

    return branch;
  }

  /**
   * Update a branch (name and description only)
   * Cannot change parent or campaign after creation
   */
  async update(
    id: string,
    input: UpdateBranchInput,
    user: AuthenticatedUser
  ): Promise<PrismaBranch> {
    // Verify branch exists
    const branch = await this.findById(id);
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    // Verify user has access to the campaign
    await this.checkCampaignAccess(branch.campaignId, user);

    // Check for duplicate branch name within campaign (if name is being changed)
    if (input.name) {
      const existingBranch = await this.prisma.branch.findFirst({
        where: {
          campaignId: branch.campaignId,
          name: input.name,
          deletedAt: null,
        },
      });

      // Allow update if the found branch is the current branch (no name change)
      // or if no branch with that name exists
      if (existingBranch && existingBranch.id !== id) {
        throw new BadRequestException(
          `A branch named "${input.name}" already exists in this campaign`
        );
      }
    }

    // Update branch (name, description, and metadata allowed)
    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        isPinned: input.isPinned,
        color: input.color,
        tags: input.tags,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
        },
      },
    });

    // Create audit entry
    await this.audit.log('branch', id, 'UPDATE', user.id, input as Record<string, unknown>);

    return updated;
  }

  /**
   * Soft delete a branch
   * Validates branch is not a root branch and has no children before deletion
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaBranch> {
    // Verify branch exists
    const branch = await this.findById(id);
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    // Verify user has access to the campaign
    await this.checkCampaignAccess(branch.campaignId, user);

    // Prevent deletion of root branches (branches without a parent)
    if (!branch.parentId) {
      throw new BadRequestException(
        'Cannot delete root branch. Root branches serve as the foundation of the campaign timeline.'
      );
    }

    // Validate branch has no children
    const childCount = await this.prisma.branch.count({
      where: {
        parentId: id,
        deletedAt: null,
      },
    });

    if (childCount > 0) {
      throw new BadRequestException(
        `Cannot delete branch with ${childCount} child branch(es). Delete children first.`
      );
    }

    const deletedAt = new Date();

    // Soft delete branch
    const deleted = await this.prisma.branch.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('branch', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Get branch hierarchy for a campaign as a tree structure
   * Returns array of root branches with nested children
   */
  async getHierarchy(campaignId: string): Promise<BranchNode[]> {
    // Get all branches for the campaign
    const branches = await this.prisma.branch.findMany({
      where: {
        campaignId,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Build tree structure
    const branchMap = new Map<string, BranchNode>();
    const rootNodes: BranchNode[] = [];

    // First pass: create nodes
    for (const branch of branches) {
      branchMap.set(branch.id, {
        branch,
        children: [],
      });
    }

    // Second pass: build tree
    for (const branch of branches) {
      const node = branchMap.get(branch.id)!;

      if (branch.parentId) {
        const parent = branchMap.get(branch.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found (deleted or doesn't exist), treat as root
          rootNodes.push(node);
        }
      } else {
        // No parent, this is a root branch
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  /**
   * Get ancestry chain for a branch
   * Returns array of branches from root to the specified branch
   * [root, parent, grandparent, ..., branch]
   */
  async getAncestry(branchId: string): Promise<PrismaBranch[]> {
    const ancestry: PrismaBranch[] = [];
    let currentId: string | null = branchId;

    // Walk up the parent chain
    while (currentId) {
      const branch: PrismaBranch | null = await this.prisma.branch.findFirst({
        where: {
          id: currentId,
          deletedAt: null,
        },
        include: {
          parent: true,
        },
      });

      if (!branch) {
        break;
      }

      ancestry.unshift(branch); // Add to beginning of array
      currentId = branch.parentId;

      // Safety check: prevent infinite loops from circular references
      if (ancestry.length > BranchService.MAX_ANCESTRY_DEPTH) {
        throw new Error(
          `Branch ancestry chain exceeds maximum depth (${BranchService.MAX_ANCESTRY_DEPTH}). Possible circular reference detected.`
        );
      }
    }

    return ancestry;
  }

  /**
   * Fork a branch to create an alternate timeline
   * Creates child branch and copies all entity versions at the divergence point
   * Uses transaction to ensure atomic operation
   *
   * @param sourceBranchId - Branch to fork from
   * @param name - Name for the new branch
   * @param description - Optional description for the new branch
   * @param worldTime - World time when branch diverges (fork point)
   * @param user - User creating the fork
   * @returns ForkResult with new branch and count of copied versions
   */
  async fork(
    sourceBranchId: string,
    name: string,
    description: string | undefined,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<ForkResult> {
    // Validate source branch exists
    const sourceBranch = await this.findById(sourceBranchId);
    if (!sourceBranch) {
      throw new NotFoundException(`Source branch with ID ${sourceBranchId} not found`);
    }

    // Verify user has access to the campaign
    await this.checkCampaignAccess(sourceBranch.campaignId, user);

    // Execute fork operation in transaction for atomicity
    return this.prisma.$transaction(async (tx) => {
      // Create child branch with divergedAt timestamp
      const childBranch = await tx.branch.create({
        data: {
          campaignId: sourceBranch.campaignId,
          name,
          description,
          parentId: sourceBranchId,
          divergedAt: worldTime,
        },
        include: {
          parent: true,
          children: true,
        },
      });

      // Create audit entry for branch creation
      await this.audit.log('branch', childBranch.id, 'FORK', user.id, {
        name: childBranch.name,
        sourceBranchId,
        divergedAt: worldTime,
      });

      let totalVersionsCopied = 0;

      // Copy versions for each entity type
      for (const entityType of BranchService.ENTITY_TYPES) {
        const versionsCopied = await this.copyVersionsForEntityType(
          sourceBranchId,
          childBranch.id,
          entityType,
          worldTime,
          user,
          tx
        );
        totalVersionsCopied += versionsCopied;
      }

      return {
        branch: childBranch,
        versionsCopied: totalVersionsCopied,
      };
    });
  }

  /**
   * Copy all versions for a specific entity type at fork point
   * Queries resolved versions in source branch ancestry and creates new versions in target branch
   *
   * @param sourceBranchId - Source branch to copy from
   * @param targetBranchId - Target branch to copy to
   * @param entityType - Type of entity to copy
   * @param worldTime - Fork point timestamp
   * @param user - User performing the operation
   * @param tx - Prisma transaction client
   * @returns Count of versions copied
   */
  private async copyVersionsForEntityType(
    sourceBranchId: string,
    targetBranchId: string,
    entityType: string,
    worldTime: Date,
    user: AuthenticatedUser,
    tx: any
  ): Promise<number> {
    // Get the source branch to find its campaign
    const sourceBranch = await tx.branch.findUnique({
      where: { id: sourceBranchId },
      select: { campaignId: true },
    });

    if (!sourceBranch) {
      return 0;
    }

    // Get all branches in the campaign to build ancestry
    const allBranches = await tx.branch.findMany({
      where: { campaignId: sourceBranch.campaignId, deletedAt: null },
      select: { id: true, parentId: true },
    });

    // Build branch ancestry chain for source branch
    type BranchNode = { id: string; parentId: string | null };
    const branchMap = new Map<string, BranchNode>(allBranches.map((b: BranchNode) => [b.id, b]));
    const ancestryBranchIds: string[] = [];
    let currentBranchId: string | null = sourceBranchId;

    while (currentBranchId) {
      ancestryBranchIds.push(currentBranchId);
      const currentBranch = branchMap.get(currentBranchId);
      currentBranchId = currentBranch?.parentId || null;
    }

    // Find all versions in the ancestry chain that are valid at fork point
    // This correctly filters to only versions accessible from source branch
    const versions = await tx.version.findMany({
      where: {
        entityType,
        branchId: { in: ancestryBranchIds },
        validFrom: { lte: worldTime },
        OR: [{ validTo: { gt: worldTime } }, { validTo: null }],
      },
      select: {
        entityId: true,
        branchId: true,
      },
    });

    // Get unique entity IDs
    const entityIds: string[] = [
      ...new Set<string>(versions.map((v: { entityId: string }) => v.entityId)),
    ];

    let versionsCopied = 0;

    // Batch resolve all versions at once to avoid N+1 queries
    const resolvedVersions = await Promise.all(
      entityIds.map(async (entityId: string) => {
        const version = await this.versionService.resolveVersion(
          entityType,
          entityId,
          sourceBranchId,
          worldTime
        );
        return { entityId, version };
      })
    );

    // Create all new versions in a batch
    for (const { entityId, version: resolvedVersion } of resolvedVersions) {
      if (resolvedVersion) {
        // Create new version in target branch with same payload
        // Reuse compressed payload directly without cloning
        await tx.version.create({
          data: {
            entityType,
            entityId,
            branchId: targetBranchId,
            validFrom: worldTime,
            validTo: null,
            payloadGz: resolvedVersion.payloadGz,
            createdBy: user.id,
            comment: `Forked from branch ${sourceBranchId} at ${worldTime.toISOString()}`,
            version: 1, // First version in new branch
          },
        });

        versionsCopied++;
      }
    }

    return versionsCopied;
  }

  /**
   * Check if user has access to a campaign
   * Used by create, update, and delete operations
   */
  private async checkCampaignAccess(campaignId: string, user: AuthenticatedUser): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        deletedAt: null,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: {
                userId: user.id,
              },
            },
          },
        ],
      },
    });

    if (!campaign) {
      throw new ForbiddenException('You do not have access to this campaign');
    }
  }
}
