/**
 * World Time Resolver
 * GraphQL resolvers for world time queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AdvanceWorldTimeInput } from '../inputs/world-time.input';
import { WorldTimeService } from '../services/world-time.service';
import { WorldTimeResult } from '../types/world-time.type';

@Resolver()
export class WorldTimeResolver {
  constructor(private readonly worldTimeService: WorldTimeService) {}

  @Query(() => Date, {
    nullable: true,
    description: 'Get current world time for a campaign',
  })
  @UseGuards(JwtAuthGuard)
  async getCurrentWorldTime(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Date | null> {
    return this.worldTimeService.getCurrentWorldTime(campaignId, user);
  }

  @Mutation(() => WorldTimeResult, {
    description: 'Advance world time for a campaign',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async advanceWorldTime(
    @Args('input') input: AdvanceWorldTimeInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<WorldTimeResult> {
    const { campaignId, to, branchId, invalidateCache } = input;
    return this.worldTimeService.advanceWorldTime(
      campaignId,
      to,
      user.id,
      0, // expectedVersion - default to 0 at GraphQL layer
      branchId,
      invalidateCache
    );
  }
}
