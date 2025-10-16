/**
 * Campaign Resolver
 * GraphQL resolvers for Campaign queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { CreateCampaignInput, UpdateCampaignInput } from '../inputs/campaign.input';
import { CampaignService } from '../services/campaign.service';
import { Campaign } from '../types/campaign.type';

@Resolver(() => Campaign)
export class CampaignResolver {
  constructor(private readonly campaignService: CampaignService) {}

  @Query(() => Campaign, { nullable: true, description: 'Get campaign by ID' })
  @UseGuards(JwtAuthGuard)
  async campaign(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign | null> {
    return this.campaignService.findById(id, user) as Promise<Campaign | null>;
  }

  @Query(() => [Campaign], { description: 'Get all campaigns for a world' })
  @UseGuards(JwtAuthGuard)
  async campaignsByWorld(
    @Args('worldId', { type: () => ID }) worldId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign[]> {
    return this.campaignService.findByWorldId(worldId, user) as Promise<Campaign[]>;
  }

  @Mutation(() => Campaign, { description: 'Create a new campaign' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createCampaign(
    @Args('input') input: CreateCampaignInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign> {
    return this.campaignService.create(input, user) as Promise<Campaign>;
  }

  @Mutation(() => Campaign, { description: 'Update a campaign' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateCampaign(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCampaignInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign> {
    return this.campaignService.update(id, input, user) as Promise<Campaign>;
  }

  @Mutation(() => Campaign, { description: 'Delete a campaign (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteCampaign(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign> {
    return this.campaignService.delete(id, user) as Promise<Campaign>;
  }

  @Mutation(() => Campaign, { description: 'Archive a campaign' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveCampaign(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign> {
    return this.campaignService.archive(id, user) as Promise<Campaign>;
  }

  @Mutation(() => Campaign, { description: 'Restore an archived campaign' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreCampaign(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign> {
    return this.campaignService.restore(id, user) as Promise<Campaign>;
  }
}
