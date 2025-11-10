/**
 * Branch Service
 *
 * Business logic for Branch operations and alternate timeline management in the
 * campaign branching system. Implements CRUD operations, hierarchy traversal,
 * and fork/merge workflows for creating parallel timelines.
 *
 * Key Responsibilities:
 * - CRUD operations for Branch entities with authorization checks
 * - Branch hierarchy management and ancestry traversal
 * - Fork operations to create alternate timelines with version copying
 * - Orphan prevention through cascading deletion enforcement
 * - Version copying across entity types at divergence points
 *
 * Authorization:
 * - View branches: All roles (OWNER, GM, PLAYER, VIEWER)
 * - Create/fork branches: OWNER and GM roles only
 * - Update branches: OWNER and GM roles only
 * - Delete branches: OWNER role only
 *
 * Design Patterns:
 * - Tree structure with parent/child relationships
 * - Cascading deletion (children before parents)
 * - Transaction-based fork operations for atomicity
 * - Batch version resolution to avoid N+1 queries
 *
 * @see Branch entity in Prisma schema
 * @see BranchResolver for GraphQL API
 * @see VersionService for version management
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Branch as PrismaBranch, Prisma } from '@prisma/client';

import { CampaignMembershipService } from '../../auth/services/campaign-membership.service';
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
 * Branch node for hierarchy tree structure.
 *
 * Represents a single node in the branch hierarchy tree with references
 * to its children. Used by getHierarchy() to return nested tree structure.
 *
 * @property branch - The Branch entity data
 * @property children - Array of child BranchNode objects
 */
export interface BranchNode {
  branch: PrismaBranch;
  children: BranchNode[];
}

/**
 * Result of fork operation with statistics.
 *
 * Contains the newly created branch and count of versions copied during
 * the fork operation. Used to report fork operation success to clients.
 *
 * @property branch - The newly created child branch
 * @property versionsCopied - Total number of entity versions copied to new branch
 */
export interface ForkResult {
  branch: PrismaBranch;
  versionsCopied: number;
}

/**
 * Branch Service
 *
 * Manages branch lifecycle, hierarchy traversal, and fork operations for the
 * campaign branching system. Provides CRUD operations with authorization checks
 * and implements the fork workflow for creating alternate timelines.
 *
 * @class
 * @injectable
 */
@Injectable()
export class BranchService {
  /**
   * Maximum depth for ancestry chain traversal.
   * Prevents infinite loops from circular references in branch hierarchy.
   */
  private static readonly MAX_ANCESTRY_DEPTH = 100;

  /**
   * All entity types that support versioning and branching.
   * Used by fork operation to copy versions across all entity types.
   */
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

  /**
   * Creates an instance of BranchService.
   *
   * @param prisma - Database service for Prisma queries
   * @param audit - Audit service for logging operations
   * @param versionService - Version service for entity version management
   * @param campaignMembershipService - Campaign membership service for authorization
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService,
    private readonly campaignMembershipService: CampaignMembershipService
  ) {}

  /**
   * Find branch by ID.
   *
   * Retrieves a single branch with its parent, children, and campaign relations.
   * Only returns non-deleted branches and excludes deleted children.
   *
   * @param id - The branch ID to find
   * @returns The branch with relations, or null if not found or deleted
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
   * Find all branches for a campaign.
   *
   * Retrieves all non-deleted branches for a specific campaign with their
   * parent and children relations. Returns a flat list ordered alphabetically by name.
   *
   * @param campaignId - The campaign ID to find branches for
   * @returns Array of branches for the campaign, ordered by name
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
   * Find branches matching filter criteria.
   *
   * Retrieves branches that match the provided filter conditions with parent
   * and children relations. Only returns non-deleted branches and excludes deleted children.
   *
   * @param where - Filter criteria for branch query
   * @returns Array of matching branches, ordered by name
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
   * Create a new branch.
   *
   * Creates a new branch entity with validation and authorization checks:
   * - Verifies campaign exists and user has GM/OWNER access
   * - Validates branch name uniqueness within campaign
   * - Validates parent branch exists and belongs to same campaign (if provided)
   * - Creates audit log entry for branch creation
   *
   * @param input - Branch creation data (name, description, parentId, etc.)
   * @param user - Authenticated user creating the branch
   * @returns The newly created branch with parent and children relations
   * @throws NotFoundException - If campaign or parent branch not found
   * @throws ForbiddenException - If user lacks GM/OWNER role
   * @throws BadRequestException - If branch name already exists or parent invalid
   */
  async create(input: CreateBranchInput, user: AuthenticatedUser): Promise<PrismaBranch> {
    // Verify campaign exists
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: input.campaignId, deletedAt: null },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${input.campaignId} not found`);
    }

    // Verify user can create branches (OWNER or GM only)
    await this.checkCanCreateBranch(input.campaignId, user);

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
   * Update a branch.
   *
   * Updates branch metadata (name, description, isPinned, color, tags).
   * Parent and campaign cannot be changed after creation.
   * Validates branch name uniqueness within campaign if name is being changed.
   *
   * @param id - The branch ID to update
   * @param input - Update data (name, description, metadata)
   * @param user - Authenticated user performing the update
   * @returns The updated branch with parent and children relations
   * @throws NotFoundException - If branch not found
   * @throws ForbiddenException - If user lacks GM/OWNER role
   * @throws BadRequestException - If new branch name already exists
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

    // Verify user can update branches (OWNER or GM only)
    await this.checkCanUpdateBranch(branch.campaignId, user);

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
   * Soft delete a branch.
   *
   * Performs soft deletion by setting deletedAt timestamp. Implements strict
   * validation to prevent orphaned branches and maintain data integrity:
   * - Cannot delete root branches (branches without a parent)
   * - Cannot delete branches with children (enforces cascading deletion)
   * - Requires OWNER role (stricter than create/update)
   *
   * Orphaned Branch Prevention:
   * This method enforces cascading deletion requirements that make orphaned
   * branches structurally impossible. Children must be deleted before parents,
   * ensuring all branches always have a valid parent chain to the root.
   *
   * @param id - The branch ID to delete
   * @param user - Authenticated user performing the deletion
   * @returns The deleted branch with deletedAt timestamp set
   * @throws NotFoundException - If branch not found
   * @throws ForbiddenException - If user lacks OWNER role
   * @throws BadRequestException - If branch is root or has children
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaBranch> {
    // Verify branch exists
    const branch = await this.findById(id);
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    // Verify user can delete branches (OWNER only)
    await this.checkCanDeleteBranch(branch.campaignId, user);

    // Prevent deletion of root branches (branches without a parent)
    if (!branch.parentId) {
      throw new BadRequestException(
        'Cannot delete root branch. Root branches serve as the foundation of the campaign timeline.'
      );
    }

    // ORPHAN PREVENTION: Validate branch has no children
    // This enforces cascading deletion (delete children before parents)
    // ensuring branches can NEVER become orphaned (parent deleted but child remains)
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
   * Get branch hierarchy for a campaign as a tree structure.
   *
   * Builds and returns a nested tree structure of all branches in a campaign.
   * Root branches (those without parents) are returned at the top level, with
   * children nested recursively. Uses a two-pass algorithm to build the tree
   * efficiently.
   *
   * Defensive Handling:
   * If a branch's parent is not found (soft-deleted or corrupted data), it is
   * treated as a root node to prevent UI breakage. This should never occur
   * through normal operations due to cascading deletion enforcement.
   *
   * @param campaignId - The campaign ID to get hierarchy for
   * @returns Array of root BranchNode objects with nested children
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
          // DEFENSIVE: Parent not found (soft-deleted or corrupted data)
          // Treat as root to prevent UI breakage. This should never occur through
          // normal operations due to cascading deletion enforcement in delete() method.
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
   * Get ancestry chain for a branch.
   *
   * Walks up the parent chain from the specified branch to the root, returning
   * all ancestors in order from root to the specified branch.
   * Example: [root, grandparent, parent, branch]
   *
   * Includes circular reference detection to prevent infinite loops if data
   * is corrupted. Throws error if ancestry chain exceeds MAX_ANCESTRY_DEPTH.
   *
   * @param branchId - The branch ID to get ancestry for
   * @returns Array of branches from root to specified branch (inclusive)
   * @throws Error - If ancestry chain exceeds maximum depth (circular reference detected)
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
   * Fork a branch to create an alternate timeline.
   *
   * Creates a child branch from a source branch and copies all entity versions
   * that are valid at the divergence point. This operation creates a complete
   * snapshot of the world state at the specified time, allowing parallel timeline
   * development.
   *
   * Process:
   * 1. Validates source branch exists and user has GM/OWNER permission
   * 2. Creates child branch with divergedAt timestamp
   * 3. For each entity type, copies all versions valid at fork point
   * 4. Uses transaction to ensure atomic operation (all-or-nothing)
   * 5. Creates audit log entry for fork operation
   *
   * Version Copying:
   * Copies versions for all entity types (campaign, world, location, character,
   * party, kingdom, settlement, structure, encounter, event) that are valid at
   * the fork point in the source branch's ancestry chain.
   *
   * @param sourceBranchId - Branch to fork from
   * @param name - Name for the new branch
   * @param description - Optional description for the new branch
   * @param worldTime - World time when branch diverges (fork point)
   * @param user - User creating the fork
   * @returns ForkResult with new branch and count of copied versions
   * @throws NotFoundException - If source branch not found
   * @throws ForbiddenException - If user lacks GM/OWNER role
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

    // Verify user can create/fork branches (OWNER or GM only)
    await this.checkCanCreateBranch(sourceBranch.campaignId, user);

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
   * Copy all versions for a specific entity type at fork point.
   *
   * Queries all entity versions that are valid at the fork point within the
   * source branch's ancestry chain and creates corresponding versions in the
   * target branch. Uses batch resolution to avoid N+1 query problems.
   *
   * Algorithm:
   * 1. Build source branch ancestry chain (source -> parent -> root)
   * 2. Find all versions in ancestry valid at fork point (validFrom <= worldTime, validTo > worldTime or null)
   * 3. Get unique entity IDs from those versions
   * 4. Batch resolve each entity's version at fork point
   * 5. Create new versions in target branch with same payload
   *
   * Performance Optimization:
   * Uses batch resolution (Promise.all) to resolve all entity versions in parallel
   * rather than sequential queries. Reuses compressed payload (payloadGz) directly
   * without decompressing/recompressing.
   *
   * @param sourceBranchId - Source branch to copy from
   * @param targetBranchId - Target branch to copy to
   * @param entityType - Type of entity to copy (e.g., 'campaign', 'location')
   * @param worldTime - Fork point timestamp
   * @param user - User performing the operation
   * @param tx - Prisma transaction client for atomic operation
   * @returns Count of versions copied for this entity type
   */
  private async copyVersionsForEntityType(
    sourceBranchId: string,
    targetBranchId: string,
    entityType: string,
    worldTime: Date,
    user: AuthenticatedUser,
    tx: Prisma.TransactionClient
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
   * Check if user has access to view branches in a campaign.
   *
   * Verifies the user is either the campaign owner or has a membership in the
   * campaign. All roles (OWNER, GM, PLAYER, VIEWER) can view branches.
   * Used as a base check by other authorization methods.
   *
   * @param campaignId - The campaign ID to check access for
   * @param user - Authenticated user to check
   * @throws ForbiddenException - If user lacks access to the campaign
   * @private
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

  /**
   * Check if user can create/fork branches in a campaign.
   *
   * Verifies the user has campaign access and has GM or OWNER role.
   * Only OWNER and GM roles can create or fork branches.
   * Used by create() and fork() methods.
   *
   * @param campaignId - The campaign ID to check permission for
   * @param user - Authenticated user to check
   * @throws ForbiddenException - If user lacks GM/OWNER role
   * @private
   */
  private async checkCanCreateBranch(campaignId: string, user: AuthenticatedUser): Promise<void> {
    await this.checkCampaignAccess(campaignId, user);

    const canEdit = await this.campaignMembershipService.canEdit(campaignId, user.id);
    if (!canEdit) {
      throw new ForbiddenException('Only campaign OWNER and GM roles can create or fork branches');
    }
  }

  /**
   * Check if user can update branches in a campaign.
   *
   * Verifies the user has campaign access and has GM or OWNER role.
   * Only OWNER and GM roles can rename or update branch metadata.
   * Used by update() method.
   *
   * @param campaignId - The campaign ID to check permission for
   * @param user - Authenticated user to check
   * @throws ForbiddenException - If user lacks GM/OWNER role
   * @private
   */
  private async checkCanUpdateBranch(campaignId: string, user: AuthenticatedUser): Promise<void> {
    await this.checkCampaignAccess(campaignId, user);

    const canEdit = await this.campaignMembershipService.canEdit(campaignId, user.id);
    if (!canEdit) {
      throw new ForbiddenException(
        'Only campaign OWNER and GM roles can rename or update branches'
      );
    }
  }

  /**
   * Check if user can delete branches in a campaign.
   *
   * Verifies the user is the campaign owner. Only OWNER role can delete branches,
   * which is stricter than create/update operations (OWNER + GM).
   * Used by delete() method.
   *
   * @param campaignId - The campaign ID to check permission for
   * @param user - Authenticated user to check
   * @throws ForbiddenException - If user is not campaign OWNER
   * @private
   */
  private async checkCanDeleteBranch(campaignId: string, user: AuthenticatedUser): Promise<void> {
    await this.checkCampaignAccess(campaignId, user);

    // Check if user is campaign owner
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        ownerId: user.id,
        deletedAt: null,
      },
    });

    if (!campaign) {
      throw new ForbiddenException('Only campaign OWNER can delete branches');
    }
  }
}
