/**
 * Merge Resolver
 * GraphQL resolver for branch merge operations
 */

import {
  UseGuards,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CampaignMembershipService } from '../../auth/services/campaign-membership.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { PreviewMergeInput, ExecuteMergeInput } from '../inputs/branch.input';
import { BranchService } from '../services/branch.service';
import { MergeService } from '../services/merge.service';
import { VersionService } from '../services/version.service';
import {
  MergePreview,
  MergeResult,
  EntityMergePreview,
  MergeConflict,
  AutoResolvedChange,
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

  @Mutation(() => MergeResult, {
    description: 'Execute merge operation, creating new versions in target branch',
  })
  @UseGuards(JwtAuthGuard)
  async executeMerge(
    @Args('input', { type: () => ExecuteMergeInput }) input: ExecuteMergeInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MergeResult> {
    const { sourceBranchId, targetBranchId } = input;
    // worldTime and resolutions will be used in Stage 5

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

    // For now, return placeholder - Stage 5 will implement actual merge execution
    return {
      success: false,
      versionsCreated: 0,
      mergedEntityIds: [],
      error: 'Merge execution not yet implemented. This will be completed in Stage 5.',
    };
  }

  /**
   * Get all entity IDs that need to be merged (exist in source or target)
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
   * Generate merge preview for a single entity
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
   * Check if user has access to the campaign
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
   * Check if user can perform merge operations (GM or OWNER role required)
   */
  private async checkCanMerge(campaignId: string, user: AuthenticatedUser): Promise<void> {
    await this.checkCampaignAccess(campaignId, user);

    const canEdit = await this.campaignMembershipService.canEdit(campaignId, user.id);
    if (!canEdit) {
      throw new ForbiddenException('Only campaign OWNER and GM roles can execute merges');
    }
  }
}
