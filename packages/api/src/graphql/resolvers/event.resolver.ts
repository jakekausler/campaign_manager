/**
 * Event Resolver
 * GraphQL resolvers for Event queries and mutations
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

  @Query(() => Event, { nullable: true, description: 'Get event by ID' })
  @UseGuards(JwtAuthGuard)
  async event(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event | null> {
    return this.eventService.findById(id, user) as Promise<Event | null>;
  }

  @Query(() => [Event], { description: 'Get all events for a campaign' })
  @UseGuards(JwtAuthGuard)
  async eventsByCampaign(
    @Args('campaignId', { type: () => ID }) campaignId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event[]> {
    return this.eventService.findByCampaignId(campaignId, user) as Promise<Event[]>;
  }

  @Query(() => [Event], { description: 'Get all events at a location' })
  @UseGuards(JwtAuthGuard)
  async eventsByLocation(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event[]> {
    return this.eventService.findByLocationId(locationId, user) as Promise<Event[]>;
  }

  @Mutation(() => Event, { description: 'Create a new event' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createEvent(
    @Args('input') input: CreateEventInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event> {
    return this.eventService.create(input, user) as Promise<Event>;
  }

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

  @Mutation(() => Event, { description: 'Delete an event (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteEvent(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event> {
    return this.eventService.delete(id, user) as Promise<Event>;
  }

  @Mutation(() => Event, { description: 'Archive an event' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveEvent(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event> {
    return this.eventService.archive(id, user) as Promise<Event>;
  }

  @Mutation(() => Event, { description: 'Restore an archived event' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreEvent(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Event> {
    return this.eventService.restore(id, user) as Promise<Event>;
  }

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
