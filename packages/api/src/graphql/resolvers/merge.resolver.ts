/**
 * Merge Resolver
 *
 * GraphQL resolvers for branch merge operations including 3-way merge,
 * conflict detection and resolution, cherry-picking, and merge history tracking.
 *
 * Provides operations for:
 * - Previewing merge conflicts before execution
 * - Executing 3-way merges with manual conflict resolution
 * - Cherry-picking specific versions across branches
 * - Tracking merge history and audit trails
 */

import {
  UseGuards,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CampaignMembershipService } from '../../auth/services/campaign-membership.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import {
  PreviewMergeInput,
  ExecuteMergeInput,
  CherryPickVersionInput,
} from '../inputs/branch.input';
import { BranchService } from '../services/branch.service';
import { MergeService } from '../services/merge.service';
import { VersionService } from '../services/version.service';
import {
  MergePreview,
  MergeResult,
  CherryPickResult,
  EntityMergePreview,
  MergeConflict,
  AutoResolvedChange,
  MergeHistoryEntry,
} from '../types/branch.type';
@Resolver()
export class MergeResolver {
  constructor(
    private readonly mergeService: MergeService,
    private readonly branchService: BranchService,
    private readonly versionService: VersionService,
    private readonly campaignMembershipService: CampaignMembershipService,
    private readonly prisma: PrismaService
  ) {}
  // Note: Entity-specific handlers (SettlementMergeHandler, StructureMergeHandler)
  // will be integrated in Stage 5 for merge execution with custom domain logic

  /**
   * Previews a merge operation between two branches without executing it.
   *
   * Performs a 3-way merge analysis using the common ancestor to detect:
   * - Merge conflicts requiring manual resolution
   * - Auto-resolvable changes (non-conflicting modifications)
   * - Entity-level impact across settlements, structures, etc.
   *
   * **Authorization:** Any authenticated campaign member
   *
   * @param input - Merge preview parameters (source, target, worldTime)
   * @param user - Authenticated user requesting the preview
   * @returns Preview showing conflicts, auto-resolved changes, and totals
   *
   * @throws {NotFoundException} If source or target branch not found
   * @throws {BadRequestException} If branches are from different campaigns or have no common ancestor
   * @throws {ForbiddenException} If user lacks campaign access
   *
   * @see {@link MergeService.findCommonAncestor} for ancestor detection
   * @see {@link MergeService.compareVersions} for 3-way merge conflict detection
   */
  @Query(() => MergePreview, {
    description: 'Preview merge operation showing conflicts and auto-resolved changes',
  })
  @UseGuards(JwtAuthGuard)
  async previewMerge(
    @Args('input', { type: () => PreviewMergeInput }) input: PreviewMergeInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MergePreview> {
    const { sourceBranchId, targetBranchId, worldTime } = input;

    // Validate branches exist
    const [sourceBranch, targetBranch] = await Promise.all([
      this.branchService.findById(sourceBranchId),
      this.branchService.findById(targetBranchId),
    ]);

    if (!sourceBranch) {
      throw new NotFoundException(`Source branch ${sourceBranchId} not found`);
    }

    if (!targetBranch) {
      throw new NotFoundException(`Target branch ${targetBranchId} not found`);
    }

    // Verify both branches are in the same campaign
    if (sourceBranch.campaignId !== targetBranch.campaignId) {
      throw new BadRequestException('Cannot merge branches from different campaigns');
    }

    // Verify user has access to the campaign
    await this.checkCampaignAccess(sourceBranch.campaignId, user);

    // Find common ancestor
    const commonAncestor = await this.mergeService.findCommonAncestor(
      sourceBranchId,
      targetBranchId
    );

    if (!commonAncestor) {
      throw new BadRequestException(
        'Cannot merge branches with no common ancestor. Branches must be in the same hierarchy tree.'
      );
    }

    // Get all entity types that have versions in either branch
    const entityTypes = ['settlement', 'structure']; // Extend this list as we add support for more entities

    // Build preview for each entity that exists in source or target
    const entityPreviews: EntityMergePreview[] = [];
    let totalConflicts = 0;
    let totalAutoResolved = 0;

    for (const entityType of entityTypes) {
      const entityIds = await this.getEntityIdsForMerge(
        sourceBranchId,
        targetBranchId,
        commonAncestor.id,
        entityType,
        worldTime
      );

      for (const entityId of entityIds) {
        const preview = await this.getEntityMergePreview(
          entityType,
          entityId,
          sourceBranchId,
          targetBranchId,
          commonAncestor.id,
          worldTime
        );

        if (preview) {
          entityPreviews.push(preview);
          totalConflicts += preview.conflicts.length;
          totalAutoResolved += preview.autoResolvedChanges.length;
        }
      }
    }

    return {
      sourceBranchId,
      targetBranchId,
      commonAncestorId: commonAncestor.id,
      entities: entityPreviews,
      totalConflicts,
      totalAutoResolved,
      requiresManualResolution: totalConflicts > 0,
    };
  }

  /**
   * Executes a merge operation, applying changes from source to target branch.
   *
   * Performs a 3-way merge using the common ancestor, creating new versions
   * in the target branch for all modified entities. Conflicts must be resolved
   * via the resolutions parameter.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates new versions in target branch for merged entities
   * - Records merge history entry with metadata
   * - Generates audit logs for all version creations
   * - May invalidate caches for affected entities
   *
   * @param input - Merge execution parameters (source, target, worldTime, resolutions)
   * @param user - Authenticated user performing the merge
   * @returns Merge result with success status, created versions, and any remaining conflicts
   *
   * @throws {NotFoundException} If source or target branch not found
   * @throws {BadRequestException} If branches are from different campaigns, have no common ancestor, or conflicts remain unresolved
   * @throws {ForbiddenException} If user lacks GM/OWNER role
   *
   * @see {@link MergeService.executeMerge} for merge execution logic
   * @see {@link MergeService.findCommonAncestor} for ancestor detection
   */
  @Mutation(() => MergeResult, {
    description: 'Execute merge operation, creating new versions in target branch',
  })
  @UseGuards(JwtAuthGuard)
  async executeMerge(
    @Args('input', { type: () => ExecuteMergeInput }) input: ExecuteMergeInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MergeResult> {
    const { sourceBranchId, targetBranchId, worldTime, resolutions = [] } = input;

    // Validate branches exist
    const [sourceBranch, targetBranch] = await Promise.all([
      this.branchService.findById(sourceBranchId),
      this.branchService.findById(targetBranchId),
    ]);

    if (!sourceBranch) {
      throw new NotFoundException(`Source branch ${sourceBranchId} not found`);
    }

    if (!targetBranch) {
      throw new NotFoundException(`Target branch ${targetBranchId} not found`);
    }

    // Verify both branches are in the same campaign
    if (sourceBranch.campaignId !== targetBranch.campaignId) {
      throw new BadRequestException('Cannot merge branches from different campaigns');
    }

    // Verify user can edit (GM or OWNER role required)
    await this.checkCanMerge(sourceBranch.campaignId, user);

    // Find common ancestor
    const commonAncestor = await this.mergeService.findCommonAncestor(
      sourceBranchId,
      targetBranchId
    );

    if (!commonAncestor) {
      throw new BadRequestException(
        'Cannot merge branches with no common ancestor. Branches must be in the same hierarchy tree.'
      );
    }

    // Execute merge
    const result = await this.mergeService.executeMerge({
      sourceBranchId,
      targetBranchId,
      commonAncestorId: commonAncestor.id,
      worldTime,
      resolutions,
      user,
    });

    return result;
  }

  /**
   * Cherry-picks a specific version from one branch to another.
   *
   * Applies a single entity version change to a different branch, useful for
   * selectively porting changes without performing a full merge. Uses 2-way
   * merge between the source version and current target state.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates new version in target branch if successful
   * - May create merge history entry for the cherry-pick
   * - Generates audit log for version creation
   * - May invalidate caches for the affected entity
   *
   * @param input - Cherry-pick parameters (sourceVersionId, targetBranchId, resolutions)
   * @param user - Authenticated user performing the cherry-pick
   * @returns Result with success status, created version ID, and any conflicts
   *
   * @throws {NotFoundException} If source version or target branch not found
   * @throws {BadRequestException} If version and branch are from different campaigns
   * @throws {ForbiddenException} If user lacks GM/OWNER role
   *
   * @see {@link MergeService.cherryPickVersion} for cherry-pick execution logic
   */
  @Mutation(() => CherryPickResult, {
    description: 'Cherry-pick a specific version from one branch to another',
  })
  @UseGuards(JwtAuthGuard)
  async cherryPickVersion(
    @Args('input', { type: () => CherryPickVersionInput }) input: CherryPickVersionInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<CherryPickResult> {
    const { sourceVersionId, targetBranchId, resolutions = [] } = input;

    // Validate source version exists
    const sourceVersion = await this.prisma.version.findUnique({
      where: { id: sourceVersionId },
      include: { branch: true },
    });

    if (!sourceVersion) {
      throw new NotFoundException(`Source version ${sourceVersionId} not found`);
    }

    // Validate target branch exists
    const targetBranch = await this.branchService.findById(targetBranchId);
    if (!targetBranch) {
      throw new NotFoundException(`Target branch ${targetBranchId} not found`);
    }

    // Verify both branches are in the same campaign
    if (sourceVersion.branch.campaignId !== targetBranch.campaignId) {
      throw new BadRequestException('Cannot cherry-pick between branches from different campaigns');
    }

    // Verify user can edit (GM or OWNER role required)
    await this.checkCanMerge(targetBranch.campaignId, user);

    // Execute cherry-pick
    const result = await this.mergeService.cherryPickVersion(
      sourceVersionId,
      targetBranchId,
      user,
      resolutions
    );

    // Convert service result to GraphQL type
    const graphqlResult: CherryPickResult = {
      success: result.success,
      hasConflict: result.hasConflict,
      conflicts: result.conflicts
        ? result.conflicts.map((conflict) => ({
            path: conflict.path,
            type: conflict.type,
            description: `Conflict at ${conflict.path}`,
            suggestion: undefined,
            baseValue:
              conflict.baseValue !== undefined ? JSON.stringify(conflict.baseValue) : undefined,
            sourceValue:
              conflict.sourceValue !== undefined ? JSON.stringify(conflict.sourceValue) : undefined,
            targetValue:
              conflict.targetValue !== undefined ? JSON.stringify(conflict.targetValue) : undefined,
          }))
        : undefined,
      versionId: result.versionCreated?.id,
      error: result.error,
    };

    return graphqlResult;
  }

  /**
   * Retrieves merge history for a specific branch.
   *
   * Returns all completed merge operations where the branch was either
   * the source or target, ordered by most recent first. Includes metadata
   * about conflict resolutions and merge participants.
   *
   * **Authorization:** Any authenticated campaign member
   *
   * @param branchId - Branch identifier to get history for
   * @param user - Authenticated user requesting the history
   * @returns Array of merge history entries with source/target branch details
   *
   * @throws {NotFoundException} If branch not found
   * @throws {ForbiddenException} If user lacks campaign access
   *
   * @see {@link MergeHistory} Prisma model for stored merge records
   */
  @Query(() => [MergeHistoryEntry], {
    description: 'Get merge history for a specific branch showing completed merge operations',
  })
  @UseGuards(JwtAuthGuard)
  async getMergeHistory(
    @Args('branchId', { type: () => ID }) branchId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MergeHistoryEntry[]> {
    // Validate branch exists
    const branch = await this.branchService.findById(branchId);
    if (!branch) {
      throw new NotFoundException(`Branch ${branchId} not found`);
    }

    // Verify user has access to the campaign
    await this.checkCampaignAccess(branch.campaignId, user);

    // Query merge history where this branch was source or target
    const mergeHistory = await this.prisma.mergeHistory.findMany({
      where: {
        OR: [{ sourceBranchId: branchId }, { targetBranchId: branchId }],
      },
      include: {
        sourceBranch: true,
        targetBranch: true,
      },
      orderBy: {
        mergedAt: 'desc', // Most recent merges first
      },
    });

    // Map Prisma result to GraphQL type (convert null to undefined, handle JsonValue)
    return mergeHistory.map((entry) => ({
      ...entry,
      sourceBranch: {
        ...entry.sourceBranch,
        description: entry.sourceBranch.description ?? undefined,
        parentId: entry.sourceBranch.parentId ?? undefined,
        divergedAt: entry.sourceBranch.divergedAt ?? undefined,
        color: entry.sourceBranch.color ?? undefined,
        deletedAt: entry.sourceBranch.deletedAt ?? undefined,
      },
      targetBranch: {
        ...entry.targetBranch,
        description: entry.targetBranch.description ?? undefined,
        parentId: entry.targetBranch.parentId ?? undefined,
        divergedAt: entry.targetBranch.divergedAt ?? undefined,
        color: entry.targetBranch.color ?? undefined,
        deletedAt: entry.targetBranch.deletedAt ?? undefined,
      },
      resolutionsData:
        entry.resolutionsData && typeof entry.resolutionsData === 'object'
          ? (entry.resolutionsData as Record<string, unknown>)
          : {},
      metadata:
        entry.metadata && typeof entry.metadata === 'object'
          ? (entry.metadata as Record<string, unknown>)
          : {},
    }));
  }

  /**
   * Gets all entity IDs that need to be merged across branches.
   *
   * Queries versions in all three branches (source, target, base) to find
   * the complete set of entities that have been modified in any branch.
   * This ensures the merge considers all entities, including those added,
   * modified, or deleted in either branch.
   *
   * @param sourceBranchId - Source branch identifier
   * @param targetBranchId - Target branch identifier
   * @param baseBranchId - Common ancestor branch identifier
   * @param entityType - Entity type to query (e.g., 'settlement', 'structure')
   * @param worldTime - World time for version queries
   * @returns Array of unique entity IDs across all three branches
   *
   * @see {@link VersionService.getVersionsForBranchAndType} for version queries
   */
  private async getEntityIdsForMerge(
    sourceBranchId: string,
    targetBranchId: string,
    baseBranchId: string,
    entityType: string,
    worldTime: Date
  ): Promise<string[]> {
    // Get all versions for this entity type in all three branches
    const [sourceVersions, targetVersions, baseVersions] = await Promise.all([
      this.versionService.getVersionsForBranchAndType(sourceBranchId, entityType, worldTime),
      this.versionService.getVersionsForBranchAndType(targetBranchId, entityType, worldTime),
      this.versionService.getVersionsForBranchAndType(baseBranchId, entityType, worldTime),
    ]);

    // Collect all unique entity IDs across all three branches
    const entityIds = new Set<string>();
    for (const version of [...sourceVersions, ...targetVersions, ...baseVersions]) {
      entityIds.add(version.entityId);
    }

    return Array.from(entityIds);
  }

  /**
   * Generates a merge preview for a single entity.
   *
   * Performs 3-way merge conflict detection for one entity by comparing
   * versions from source, target, and base branches. Decompresses version
   * payloads and uses the merge service to identify conflicts and
   * auto-resolvable changes.
   *
   * Returns null if the entity doesn't need merging (no changes in either branch).
   *
   * @param entityType - Entity type (e.g., 'settlement', 'structure')
   * @param entityId - Unique entity identifier
   * @param sourceBranchId - Source branch identifier
   * @param targetBranchId - Target branch identifier
   * @param baseBranchId - Common ancestor branch identifier
   * @param worldTime - World time for version queries
   * @returns Entity merge preview with conflicts and auto-resolved changes, or null
   *
   * @see {@link MergeService.getEntityVersionsForMerge} for version retrieval
   * @see {@link MergeService.compareVersions} for conflict detection
   * @see {@link VersionService.decompressVersion} for payload decompression
   */
  private async getEntityMergePreview(
    entityType: string,
    entityId: string,
    sourceBranchId: string,
    targetBranchId: string,
    baseBranchId: string,
    worldTime: Date
  ): Promise<EntityMergePreview | null> {
    // Get the three versions for 3-way merge
    const versions = await this.mergeService.getEntityVersionsForMerge(
      entityType,
      entityId,
      sourceBranchId,
      targetBranchId,
      baseBranchId,
      worldTime
    );

    // Decompress payloads from versions
    const basePayload = versions.base
      ? await this.versionService.decompressVersion(versions.base)
      : null;
    const sourcePayload = versions.source
      ? await this.versionService.decompressVersion(versions.source)
      : null;
    const targetPayload = versions.target
      ? await this.versionService.decompressVersion(versions.target)
      : null;

    // Use MergeService for conflict detection which provides full MergeResult with conflictDetails
    // Entity-specific handlers can be integrated in Stage 5 when we add custom merge logic
    const result = this.mergeService.compareVersions(basePayload, sourcePayload, targetPayload);

    // Convert to GraphQL types
    const conflicts: MergeConflict[] = result.conflicts.map((conflict) => ({
      path: conflict.path,
      type: conflict.type,
      description:
        result.conflictDetails?.find((detail) => detail.path === conflict.path)?.description ||
        `Conflict at ${conflict.path}`,
      suggestion: result.conflictDetails?.find((detail) => detail.path === conflict.path)
        ?.suggestion,
      baseValue: conflict.baseValue !== undefined ? JSON.stringify(conflict.baseValue) : undefined,
      sourceValue:
        conflict.sourceValue !== undefined ? JSON.stringify(conflict.sourceValue) : undefined,
      targetValue:
        conflict.targetValue !== undefined ? JSON.stringify(conflict.targetValue) : undefined,
    }));

    // Extract auto-resolved changes from merged payload
    const autoResolvedChanges: AutoResolvedChange[] = [];
    if (result.success && result.mergedPayload) {
      // If merge succeeded, all paths in merged payload are auto-resolved
      // For now, we'll just note that changes were auto-resolved
      // A more detailed implementation would track which paths changed
      autoResolvedChanges.push({
        path: '__root__',
        resolvedTo: 'merged',
        baseValue: basePayload ? JSON.stringify(basePayload) : undefined,
        sourceValue: sourcePayload ? JSON.stringify(sourcePayload) : undefined,
        targetValue: targetPayload ? JSON.stringify(targetPayload) : undefined,
        resolvedValue: JSON.stringify(result.mergedPayload),
      });
    }

    return {
      entityId,
      entityType,
      conflicts,
      autoResolvedChanges,
    };
  }

  /**
   * Validates user has access to a campaign.
   *
   * Checks if user is either a campaign member or the campaign owner.
   * Used for read-only operations like previewing merges or viewing history.
   *
   * @param campaignId - Campaign identifier to check access for
   * @param user - Authenticated user to validate
   *
   * @throws {ForbiddenException} If user is neither member nor owner
   */
  private async checkCampaignAccess(campaignId: string, user: AuthenticatedUser): Promise<void> {
    const membership = await this.prisma.campaignMembership.findFirst({
      where: {
        campaignId,
        userId: user.id,
      },
    });

    const isOwner = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        ownerId: user.id,
        deletedAt: null,
      },
    });

    if (!membership && !isOwner) {
      throw new ForbiddenException(`User does not have access to campaign ${campaignId}`);
    }
  }

  /**
   * Validates user has permission to execute merge operations.
   *
   * Checks if user has GM or OWNER role in the campaign. Used for
   * write operations like executing merges or cherry-picking versions.
   * First verifies basic campaign access, then checks edit permissions.
   *
   * @param campaignId - Campaign identifier to check permissions for
   * @param user - Authenticated user to validate
   *
   * @throws {ForbiddenException} If user lacks campaign access or GM/OWNER role
   *
   * @see {@link CampaignMembershipService.canEdit} for role checking logic
   */
  private async checkCanMerge(campaignId: string, user: AuthenticatedUser): Promise<void> {
    await this.checkCampaignAccess(campaignId, user);

    const canEdit = await this.campaignMembershipService.canEdit(campaignId, user.id);
    if (!canEdit) {
      throw new ForbiddenException('Only campaign OWNER and GM roles can execute merges');
    }
  }
}
