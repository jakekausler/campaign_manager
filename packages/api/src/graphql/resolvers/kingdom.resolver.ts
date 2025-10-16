/**
 * Kingdom Resolver
 * GraphQL resolvers for Kingdom queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import type {
  CreateKingdomInput,
  UpdateKingdomInput,
  UpdateKingdomData,
} from '../inputs/kingdom.input';
import { KingdomService } from '../services/kingdom.service';
import { Kingdom } from '../types/kingdom.type';

@Resolver(() => Kingdom)
export class KingdomResolver {
  constructor(private readonly kingdomService: KingdomService) {}

  @Query(() => Kingdom, { nullable: true, description: 'Get kingdom by ID' })
  @UseGuards(JwtAuthGuard)
  async kingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom | null> {
    return this.kingdomService.findById(id, user) as Promise<Kingdom | null>;
  }

  @Query(() => [Kingdom], { description: 'Get all kingdoms for a campaign' })
  @UseGuards(JwtAuthGuard)
  async kingdomsByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom[]> {
    return this.kingdomService.findByCampaign(campaignId, user) as Promise<Kingdom[]>;
  }

  @Mutation(() => Kingdom, { description: 'Create a new kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createKingdom(
    @Args('input') input: CreateKingdomInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.create(input, user) as Promise<Kingdom>;
  }

  @Mutation(() => Kingdom, { description: 'Update a kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateKingdom(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateKingdomInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    const { branchId, expectedVersion, worldTime, ...updateData } = input;
    const kingdomData: UpdateKingdomData = updateData;
    return this.kingdomService.update(
      id,
      kingdomData,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as Promise<Kingdom>;
  }

  @Mutation(() => Kingdom, { description: 'Delete a kingdom (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteKingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.delete(id, user) as Promise<Kingdom>;
  }

  @Mutation(() => Kingdom, { description: 'Archive a kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveKingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.archive(id, user) as Promise<Kingdom>;
  }

  @Mutation(() => Kingdom, { description: 'Restore an archived kingdom' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreKingdom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Kingdom> {
    return this.kingdomService.restore(id, user) as Promise<Kingdom>;
  }
}
