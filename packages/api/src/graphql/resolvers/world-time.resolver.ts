/**
 * World Time Resolver
 * GraphQL resolvers for world time queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AdvanceWorldTimeInput } from '../inputs/world-time.input';
import { WorldTimeService } from '../services/world-time.service';
import { WorldTimeResult } from '../types/world-time.type';

@SkipThrottle()
@Resolver()
export class WorldTimeResolver {
  constructor(private readonly worldTimeService: WorldTimeService) {}

  /**
   * Retrieves the current world time for a campaign.
   *
   * Returns the in-game timestamp for the campaign's current timeline state.
   * This is independent of real-world time and advances only through explicit
   * mutations (advanceWorldTime). Different branches may have different world times.
   *
   * **Authorization:** Requires campaign membership (any role)
   *
   * @param campaignId - ID of the campaign to query
   * @param user - The authenticated user
   * @returns Current world time as Date, or null if campaign not found
   *
   * @see {@link WorldTimeService.getCurrentWorldTime} for service implementation
   * @see docs/features/world-time-system.md for world time concepts
   *
   * @example
   * ```graphql
   * query {
   *   getCurrentWorldTime(campaignId: "campaign-123")
   * }
   * ```
   */
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

  /**
   * Advances the campaign's world time to a specified timestamp.
   *
   * Moves the in-game clock forward (or backward for time-travel scenarios),
   * triggering all time-based game logic including event resolution, encounter
   * activation, and scheduled effects. This is the primary mechanism for progressing
   * the campaign timeline.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Updates campaign.currentWorldTime in database
   * - May trigger scheduled events/encounters that fall within the new time range
   * - Publishes world time change to WebSocket subscribers
   * - Optionally invalidates computed field cache if invalidateCache=true
   * - Records audit log entry for the time advancement
   *
   * **Branch Support:** Can advance time on specific branches independently
   *
   * @param input - Time advancement parameters
   * @param input.campaignId - ID of the campaign to update
   * @param input.to - Target world time to advance to
   * @param input.branchId - Optional: Advance time on specific branch
   * @param input.invalidateCache - Optional: Force cache invalidation (default: false)
   * @param user - The authenticated user performing the operation
   *
   * @returns WorldTimeResult with updated timestamp and affected events/encounters
   *
   * @see {@link WorldTimeService.advanceWorldTime} for core implementation
   * @see docs/features/world-time-system.md for time advancement mechanics
   * @see docs/features/scheduler-service.md for scheduled event triggering
   *
   * @example
   * ```graphql
   * mutation {
   *   advanceWorldTime(input: {
   *     campaignId: "campaign-123"
   *     to: "4707-10-01T12:00:00Z"
   *     branchId: "branch-456"
   *     invalidateCache: true
   *   }) {
   *     newTime
   *     triggeredEvents
   *     activatedEncounters
   *   }
   * }
   * ```
   */
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
