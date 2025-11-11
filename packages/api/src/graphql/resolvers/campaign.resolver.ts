/**
 * Campaign Resolver
 * GraphQL resolvers for Campaign queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtOrApiKeyAuthGuard } from '../../auth/guards/jwt-or-api-key-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  CreateCampaignInput,
  UpdateCampaignInput,
  UpdateCampaignData,
} from '../inputs/campaign.input';
import { CampaignService } from '../services/campaign.service';
import { Campaign } from '../types/campaign.type';

@SkipThrottle()
@Resolver(() => Campaign)
export class CampaignResolver {
  constructor(private readonly campaignService: CampaignService) {}

  /**
   * Retrieves a single campaign by ID.
   *
   * User must be the campaign owner or have an active membership to access the campaign.
   *
   * @param id - Campaign identifier
   * @param user - Authenticated user (required for access control)
   * @returns Campaign if found and user has access, null otherwise
   *
   * @see {@link CampaignService.findById} for access control logic
   */
  @Query(() => Campaign, { nullable: true, description: 'Get campaign by ID' })
  @UseGuards(JwtOrApiKeyAuthGuard)
  async campaign(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign | null> {
    return this.campaignService.findById(id, user) as Promise<Campaign | null>;
  }

  /**
   * Retrieves all campaigns accessible to the authenticated user.
   *
   * Returns campaigns where the user is either:
   * - The campaign owner
   * - Has an active campaign membership (not deleted)
   *
   * @param user - Authenticated user
   * @returns Array of accessible campaigns
   *
   * @see {@link CampaignService.findAll} for membership filtering logic
   */
  @Query(() => [Campaign], {
    description:
      'Get all campaigns accessible to the user (campaigns where user is owner or has membership)',
  })
  @UseGuards(JwtOrApiKeyAuthGuard)
  async campaigns(@CurrentUser() user: AuthenticatedUser): Promise<Campaign[]> {
    return this.campaignService.findAll(user) as Promise<Campaign[]>;
  }

  /**
   * Retrieves all campaigns associated with a specific world.
   *
   * Filters campaigns by world ID while respecting user access control.
   * Only returns campaigns where the user is owner or has membership.
   *
   * @param worldId - World identifier to filter campaigns by
   * @param user - Authenticated user (required for access control)
   * @returns Array of campaigns associated with the world
   *
   * @see {@link CampaignService.findByWorldId} for world filtering logic
   */
  @Query(() => [Campaign], { description: 'Get all campaigns for a world' })
  @UseGuards(JwtOrApiKeyAuthGuard)
  async campaignsByWorld(
    @Args('worldId', { type: () => ID }) worldId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign[]> {
    return this.campaignService.findByWorldId(worldId, user) as Promise<Campaign[]>;
  }

  /**
   * Creates a new campaign.
   *
   * Establishes a new campaign associated with a world. The authenticated user
   * becomes the campaign owner with full permissions.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - User becomes campaign owner automatically
   * - Campaign starts in active (non-archived) state
   * - Associated with specified world
   *
   * @param input - Campaign creation data (name, description, worldId, settings)
   * @param user - Authenticated user creating the campaign
   * @returns Newly created campaign
   *
   * @see {@link CampaignService.create} for validation and creation logic
   */
  @Mutation(() => Campaign, { description: 'Create a new campaign' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createCampaign(
    @Args('input', { type: () => CreateCampaignInput }) input: CreateCampaignInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign> {
    return this.campaignService.create(input, user) as Promise<Campaign>;
  }

  /**
   * Updates an existing campaign's properties.
   *
   * Supports partial updates with optimistic concurrency control via version checking.
   * Can optionally specify branch context and world time for branched operations.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp
   * - Increments version number for optimistic locking
   * - May invalidate related caches
   *
   * @param id - Campaign identifier
   * @param input - Fields to update (partial update supported, includes version control)
   * @param user - Authenticated user performing the update
   * @returns Updated campaign
   *
   * @see {@link CampaignService.update} for update logic and version validation
   */
  @Mutation(() => Campaign, { description: 'Update a campaign' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateCampaign(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCampaignInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign> {
    const { branchId, expectedVersion, worldTime, ...updateData } = input;
    const campaignData: UpdateCampaignData = updateData;
    return this.campaignService.update(
      id,
      campaignData,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as Promise<Campaign>;
  }

  /**
   * Soft deletes a campaign by setting deletedAt timestamp.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Campaign excluded from normal queries but data preserved
   * - Can be restored with restoreCampaign mutation (if supported)
   * - Creates audit log entry
   * - Campaign memberships remain intact
   *
   * @param id - Campaign identifier
   * @param user - Authenticated user performing the deletion
   * @returns Deleted campaign with deletedAt set
   *
   * @see {@link CampaignService.delete} for soft delete implementation
   */
  @Mutation(() => Campaign, { description: 'Delete a campaign (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteCampaign(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign> {
    return this.campaignService.delete(id, user) as Promise<Campaign>;
  }

  /**
   * Archives a campaign by setting archivedAt timestamp.
   *
   * Archiving is distinct from deletion - archived campaigns are intentionally
   * preserved for historical reference but hidden from active use. This is useful
   * for completed campaigns that should not be deleted but also shouldn't clutter
   * the active campaign list.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets archivedAt to current timestamp
   * - Campaign excluded from normal queries
   * - Can be restored with restoreCampaign mutation
   * - Creates audit log entry
   * - Campaign memberships remain intact
   *
   * @param id - Campaign identifier
   * @param user - Authenticated user performing the archive
   * @returns Archived campaign with archivedAt set
   *
   * @see {@link CampaignService.archive} for archive implementation
   */
  @Mutation(() => Campaign, { description: 'Archive a campaign' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveCampaign(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Campaign> {
    return this.campaignService.archive(id, user) as Promise<Campaign>;
  }

  /**
   * Restores an archived campaign to active status.
   *
   * Clears the archivedAt timestamp, making the campaign visible in normal queries again.
   * This allows previously archived campaigns to be brought back into active use.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Clears archivedAt timestamp
   * - Campaign becomes visible in normal queries
   * - Creates audit log entry
   * - Campaign memberships remain intact
   *
   * @param id - Campaign identifier
   * @param user - Authenticated user performing the restore
   * @returns Restored campaign with archivedAt cleared
   *
   * @see {@link CampaignService.restore} for restore implementation
   */
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
