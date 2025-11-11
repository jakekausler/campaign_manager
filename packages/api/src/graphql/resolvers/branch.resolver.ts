/**
 * Branch Resolver
 * GraphQL resolvers for Branch queries and mutations (alternate timeline management)
 */

import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateBranchInput, UpdateBranchInput, ForkBranchInput } from '../inputs/branch.input';
import { BranchService } from '../services/branch.service';
import { Branch, BranchNode, ForkResult } from '../types/branch.type';

@SkipThrottle()
@Resolver(() => Branch)
export class BranchResolver {
  constructor(
    private readonly branchService: BranchService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Retrieves a single branch by ID.
   *
   * Verifies that the authenticated user has access to the campaign
   * that owns the branch (via membership or ownership).
   *
   * @param id - Branch identifier
   * @param user - Authenticated user requesting the branch
   * @returns Branch if found and user has access, null if not found
   * @throws {ForbiddenException} If user lacks access to the branch's campaign
   *
   * @see {@link BranchService.findById} for branch retrieval logic
   */
  @Query(() => Branch, { nullable: true, description: 'Get branch by ID' })
  @UseGuards(JwtAuthGuard)
  async branch(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Branch | null> {
    const branch = await this.branchService.findById(id);

    if (!branch) {
      return null;
    }

    // Verify user has access to the campaign (service doesn't enforce this in findById)
    const campaignMembership = await this.prisma.campaignMembership.findFirst({
      where: {
        campaignId: branch.campaignId,
        userId: user.id,
      },
    });

    const isOwner = await this.prisma.campaign.findFirst({
      where: {
        id: branch.campaignId,
        ownerId: user.id,
        deletedAt: null,
      },
    });

    if (!campaignMembership && !isOwner) {
      throw new ForbiddenException(`User does not have access to campaign ${branch.campaignId}`);
    }

    return branch as Branch;
  }

  /**
   * Retrieves all branches for a campaign as a flat list.
   *
   * Verifies that the authenticated user has access to the campaign
   * before returning branches. Returns branches in no particular order.
   * For hierarchical structure, use branchHierarchy query instead.
   *
   * @param campaignId - Campaign identifier
   * @param user - Authenticated user requesting the branches
   * @returns Array of all non-deleted branches in the campaign
   * @throws {ForbiddenException} If user lacks access to the campaign
   *
   * @see {@link BranchService.findByCampaign} for branch retrieval logic
   * @see {@link branchHierarchy} for tree-structured branch view
   */
  @Query(() => [Branch], {
    description: 'Get all branches for a campaign (flat list)',
  })
  @UseGuards(JwtAuthGuard)
  async branches(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Branch[]> {
    // Check access before fetching branches
    const campaignMembership = await this.prisma.campaignMembership.findFirst({
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

    if (!campaignMembership && !isOwner) {
      throw new ForbiddenException(`User does not have access to campaign ${campaignId}`);
    }

    return this.branchService.findByCampaign(campaignId) as Promise<Branch[]>;
  }

  /**
   * Retrieves branch hierarchy as a tree structure for a campaign.
   *
   * Returns branches organized in parent-child relationships, showing
   * the full fork history and timeline divergence points. Each BranchNode
   * includes its children recursively, making it easy to visualize the
   * branch tree in a UI.
   *
   * @param campaignId - Campaign identifier
   * @param user - Authenticated user requesting the hierarchy
   * @returns Array of root BranchNode objects (branches with no parent)
   * @throws {ForbiddenException} If user lacks access to the campaign
   *
   * @see {@link BranchService.getHierarchy} for tree construction logic
   * @see {@link branches} for flat list view of branches
   */
  @Query(() => [BranchNode], {
    description: 'Get branch hierarchy tree structure for a campaign',
  })
  @UseGuards(JwtAuthGuard)
  async branchHierarchy(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<BranchNode[]> {
    // Check access before fetching hierarchy
    const campaignMembership = await this.prisma.campaignMembership.findFirst({
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

    if (!campaignMembership && !isOwner) {
      throw new ForbiddenException(`User does not have access to campaign ${campaignId}`);
    }

    return this.branchService.getHierarchy(campaignId) as Promise<BranchNode[]>;
  }

  /**
   * Creates a new branch for a campaign.
   *
   * Creates an empty branch without copying any entity versions. To create
   * a branch with copied state from an existing branch, use forkBranch instead.
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Branch starts with no entity versions (empty timeline)
   * - Can optionally set as default branch for the campaign
   *
   * @param input - Branch creation data (name, description, campaign, etc.)
   * @param user - Authenticated user creating the branch
   * @returns Newly created branch
   *
   * @see {@link BranchService.create} for creation and authorization logic
   * @see {@link forkBranch} to create branch with copied entity state
   */
  @Mutation(() => Branch, { description: 'Create a new branch' })
  @UseGuards(JwtAuthGuard)
  async createBranch(
    @Args('input', { type: () => CreateBranchInput }) input: CreateBranchInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Branch> {
    // Service handles all validation and authorization
    return this.branchService.create(input, user) as Promise<Branch>;
  }

  /**
   * Updates an existing branch's metadata.
   *
   * Only allows updating name and description. Other branch properties
   * like parent branch, fork point, and divergence metadata cannot be
   * changed after creation.
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp
   *
   * @param id - Branch identifier
   * @param input - Fields to update (name and/or description)
   * @param user - Authenticated user performing the update
   * @returns Updated branch
   *
   * @see {@link BranchService.update} for update logic and authorization
   */
  @Mutation(() => Branch, { description: 'Update a branch (name and description only)' })
  @UseGuards(JwtAuthGuard)
  async updateBranch(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateBranchInput }) input: UpdateBranchInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Branch> {
    // Service handles existence check, authorization, and update
    return this.branchService.update(id, input, user) as Promise<Branch>;
  }

  /**
   * Soft deletes a branch by setting deletedAt timestamp.
   *
   * The branch and all its entity versions are preserved but excluded
   * from normal queries. Child branches (if any) are not affected and
   * can continue to exist independently.
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp on branch
   * - Branch excluded from normal queries but data preserved
   * - Entity versions in this branch remain but are inaccessible
   * - Creates audit log entry
   *
   * @param id - Branch identifier
   * @param user - Authenticated user performing the deletion
   * @returns True if deletion successful
   *
   * @see {@link BranchService.delete} for soft delete implementation
   */
  @Mutation(() => Boolean, { description: 'Delete a branch (soft delete)' })
  @UseGuards(JwtAuthGuard)
  async deleteBranch(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<boolean> {
    // Service handles existence check, authorization, and deletion
    await this.branchService.delete(id, user);
    return true;
  }

  /**
   * Forks a branch to create an alternate timeline with copied entity state.
   *
   * Creates a new branch that copies all entity versions from the source branch
   * at the specified fork point (world time). This enables "what-if" scenarios
   * where you can explore alternate outcomes without affecting the original timeline.
   *
   * The fork captures:
   * - All entity versions at or before the fork point world time
   * - Entity relationships and dependencies
   * - Complete state snapshot for independent evolution
   *
   * **Side Effects:**
   * - Creates new branch with parent reference to source branch
   * - Copies all relevant EntityVersion records to new branch
   * - Records fork metadata (divergencePoint, divergedFromVersionId)
   * - Creates audit log entries for branch creation and version copying
   * - May take significant time for campaigns with many entities
   *
   * @param input - Fork configuration (source branch, name, description, fork point time)
   * @param user - Authenticated user performing the fork
   * @returns ForkResult containing new branch and statistics (entities copied, version count)
   *
   * @see {@link BranchService.fork} for fork implementation and version copying logic
   * @see {@link createBranch} to create empty branch without copying state
   */
  @Mutation(() => ForkResult, {
    description: 'Fork a branch to create alternate timeline with copied versions',
  })
  @UseGuards(JwtAuthGuard)
  async forkBranch(
    @Args('input', { type: () => ForkBranchInput }) input: ForkBranchInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ForkResult> {
    // Service handles source branch validation, authorization, and fork operation
    const result = await this.branchService.fork(
      input.sourceBranchId,
      input.name,
      input.description,
      input.worldTime,
      user
    );

    return result as ForkResult;
  }
}
