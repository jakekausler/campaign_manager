/**
 * Event Resolver
 * GraphQL resolvers for Event queries and mutations.
 *
 * Events represent scheduled occurrences in the campaign timeline that can trigger
 * encounters, apply effects, and track completion status. Events support scheduling,
 * completion workflow with 3-phase effect execution, and variable tracking.
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateEventInput, UpdateEventInput } from '../inputs/event.input';
import { EventService } from '../services/event.service';
import { Event, EventCompletionResult } from '../types/event.type';

@Resolver(() => Event)
export class EventResolver {
  constructor(private readonly eventService: EventService) {}

  /**
   * Retrieves a single event by ID.
   *
   * @param id - Event identifier
   * @param user - Authenticated user (required for access control)
   * @returns Event if found and accessible, null otherwise
   */
  @Query(() => Event, { nullable: true, description: 'Get event by ID' })
  @UseGuards(JwtAuthGuard)
  async event(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event | null> {
    return this.eventService.findById(id, user) as Promise<Event | null>;
  }

  /**
   * Retrieves all events for a specific campaign.
   *
   * Returns all events (completed and pending) associated with the campaign,
   * including those linked to locations within the campaign.
   *
   * @param campaignId - Campaign identifier
   * @param user - Authenticated user
   * @returns Array of events belonging to the campaign
   */
  @Query(() => [Event], { description: 'Get all events for a campaign' })
  @UseGuards(JwtAuthGuard)
  async eventsByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event[]> {
    return this.eventService.findByCampaignId(campaignId, user) as Promise<Event[]>;
  }

  /**
   * Retrieves all events occurring at a specific location.
   *
   * Filters events by location reference, useful for displaying timeline
   * or scheduled events for a particular place in the campaign world.
   *
   * @param locationId - Location identifier
   * @param user - Authenticated user
   * @returns Array of events at the specified location
   */
  @Query(() => [Event], { description: 'Get all events at a location' })
  @UseGuards(JwtAuthGuard)
  async eventsByLocation(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event[]> {
    return this.eventService.findByLocationId(locationId, user) as Promise<Event[]>;
  }

  /**
   * Creates a new event in the campaign timeline.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Event starts in pending (not completed) state
   * - Variables initialized from input
   * - Scheduled time set if provided
   *
   * @param input - Event creation data (name, description, scheduling, effects, variables)
   * @param user - Authenticated user creating the event
   * @returns Newly created event
   *
   * @see {@link EventService.create} for validation and creation logic
   */
  @Mutation(() => Event, { description: 'Create a new event' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createEvent(
    @Args('input') input: CreateEventInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event> {
    return this.eventService.create(input, user) as Promise<Event>;
  }

  /**
   * Updates an existing event's properties.
   *
   * Supports optimistic locking via expectedVersion and branch-aware updates
   * for timeline branching scenarios.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp
   * - Increments version number
   * - May update scheduled time, variables, effects, or metadata
   *
   * @param id - Event identifier
   * @param input - Fields to update including optional branchId, expectedVersion, worldTime
   * @param user - Authenticated user performing the update
   * @returns Updated event
   *
   * @see {@link EventService.update} for update logic and version checking
   */
  @Mutation(() => Event, { description: 'Update an event' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateEvent(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateEventInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event> {
    const { branchId, expectedVersion, worldTime, ...data } = input;
    return this.eventService.update(
      id,
      data,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as Promise<Event>;
  }

  /**
   * Soft deletes an event by setting deletedAt timestamp.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Event excluded from normal queries but data preserved
   * - Does not delete related encounters or effects
   * - Creates audit log entry
   *
   * @param id - Event identifier
   * @param user - Authenticated user performing the deletion
   * @returns Deleted event with deletedAt set
   *
   * @see {@link EventService.delete} for soft delete implementation
   */
  @Mutation(() => Event, { description: 'Delete an event (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteEvent(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event> {
    return this.eventService.delete(id, user) as Promise<Event>;
  }

  /**
   * Archives an event by setting archivedAt timestamp.
   *
   * Archiving is distinct from deletion - archived events are intentionally
   * preserved for historical reference but hidden from active timeline views.
   * Useful for past events that should remain accessible but not clutter
   * current campaign planning.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets archivedAt to current timestamp
   * - Event excluded from normal queries
   * - Can be restored with restoreEvent mutation
   * - Creates audit log entry
   *
   * @param id - Event identifier
   * @param user - Authenticated user performing the archive
   * @returns Archived event with archivedAt set
   *
   * @see {@link EventService.archive} for archive implementation
   */
  @Mutation(() => Event, { description: 'Archive an event' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveEvent(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event> {
    return this.eventService.archive(id, user) as Promise<Event>;
  }

  /**
   * Restores an archived event to active status.
   *
   * Clears the archivedAt timestamp, making the event visible in normal
   * timeline queries and campaign planning views again.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Clears archivedAt timestamp
   * - Event becomes visible in normal queries
   * - Creates audit log entry
   *
   * @param id - Event identifier
   * @param user - Authenticated user performing the restore
   * @returns Restored event with archivedAt cleared
   *
   * @see {@link EventService.restore} for restore implementation
   */
  @Mutation(() => Event, { description: 'Restore an archived event' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreEvent(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event> {
    return this.eventService.restore(id, user) as Promise<Event>;
  }

  /**
   * Completes an event with 3-phase effect execution.
   *
   * Marks the event as completed and executes effects in three phases:
   * 1. PRE: Preparation effects before main resolution
   * 2. ON_RESOLVE: Core resolution effects (encounter creation, state changes)
   * 3. POST: Cleanup and follow-up effects after resolution
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets completedAt timestamp
   * - Executes effects across three phases (PRE, ON_RESOLVE, POST)
   * - May create encounters from triggered encounters list
   * - May apply JSON Patch operations to world state
   * - Updates dependency graph if effects create new entities
   * - Creates audit log entry with effect summary
   * - Invalidates relevant caches
   *
   * @param id - Event identifier
   * @param user - Authenticated user completing the event
   * @returns Completion result with updated event and effect summaries for each phase
   *
   * @see {@link EventService.complete} for completion workflow and effect execution
   */
  @Mutation(() => EventCompletionResult, {
    description: 'Complete an event with 3-phase effect execution (PRE, ON_RESOLVE, POST)',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async completeEvent(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<EventCompletionResult> {
    const result = await this.eventService.complete(id, user);
    return {
      event: result.event as Event,
      pre: result.effectSummary.pre,
      onResolve: result.effectSummary.onResolve,
      post: result.effectSummary.post,
    };
  }

  /**
   * Retrieves overdue events for a campaign.
   *
   * Finds events where scheduledAt time has passed relative to the campaign's
   * current world time, accounting for grace period, and the event has not
   * been completed. Used by scheduler service for automatic event expiration.
   *
   * @param campaignId - Campaign identifier
   * @param user - Authenticated user
   * @returns Array of overdue pending events
   *
   * @see {@link EventService.findOverdueEvents} for overdue calculation logic
   */
  @Query(() => [Event], {
    description:
      'Get overdue events for a campaign (scheduledAt < currentWorldTime - gracePeriod AND not completed)',
  })
  @UseGuards(JwtAuthGuard)
  async getOverdueEvents(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event[]> {
    return this.eventService.findOverdueEvents(campaignId, user) as Promise<Event[]>;
  }

  /**
   * Expires an event by marking it as completed without effect execution.
   *
   * Used by the scheduler service for automatic expiration of overdue events
   * that have passed their grace period. Unlike completeEvent, this does not
   * execute effects or trigger encounters - it simply marks the event as done.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets completedAt timestamp
   * - Does NOT execute effects
   * - Does NOT trigger encounters
   * - Creates audit log entry
   *
   * @param eventId - Event identifier
   * @param user - Authenticated user performing the expiration
   * @returns Expired event with completedAt set
   *
   * @see {@link EventService.expire} for expiration logic
   * @see {@link completeEvent} for completion with effect execution
   */
  @Mutation(() => Event, {
    description:
      'Expire an event by marking it as completed (used by scheduler for automatic expiration)',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async expireEvent(
    @Args('eventId', { type: () => ID }) eventId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event> {
    return this.eventService.expire(eventId, user) as Promise<Event>;
  }
}
