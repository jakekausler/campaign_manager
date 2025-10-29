/**
 * Branch Resolver
 * GraphQL resolvers for Branch queries and mutations (alternate timeline management)
 */

import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateBranchInput, UpdateBranchInput, ForkBranchInput } from '../inputs/branch.input';
import { BranchService } from '../services/branch.service';
import { Branch, BranchNode, ForkResult } from '../types/branch.type';

@Resolver(() => Branch)
export class BranchResolver {
  constructor(
    private readonly branchService: BranchService,
    private readonly prisma: PrismaService
  ) {}

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

  @Mutation(() => Branch, { description: 'Create a new branch' })
  @UseGuards(JwtAuthGuard)
  async createBranch(
    @Args('input', { type: () => CreateBranchInput }) input: CreateBranchInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Branch> {
    // Service handles all validation and authorization
    return this.branchService.create(input, user) as Promise<Branch>;
  }

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
