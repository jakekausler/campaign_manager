/**
 * Event Service
 * Handles CRUD operations for Events (no cascade delete per requirements)
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import type { Event as PrismaEvent, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateEventInput, UpdateEventData } from '../inputs/event.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import {
  EffectExecutionService,
  type EffectExecutionSummary,
  type UserContext,
} from './effect-execution.service';
import { VersionService, type CreateVersionInput } from './version.service';
import { WorldTimeService } from './world-time.service';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService,
    private readonly effectExecution: EffectExecutionService,
    private readonly worldTimeService: WorldTimeService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Find event by ID
   * Requires campaign access
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaEvent | null> {
    const event = await this.prisma.event.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (event) {
      await this.checkCampaignAccess(event.campaignId, user);
    }

    return event;
  }

  /**
   * Find all events in a campaign (non-deleted, non-archived)
   */
  async findByCampaignId(campaignId: string, user: AuthenticatedUser): Promise<PrismaEvent[]> {
    await this.checkCampaignAccess(campaignId, user);

    return this.prisma.event.findMany({
      where: {
        campaignId,
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });
  }

  /**
   * Find all events at a location (non-deleted, non-archived)
   */
  async findByLocationId(locationId: string, user: AuthenticatedUser): Promise<PrismaEvent[]> {
    // Find events at this location
    const events = await this.prisma.event.findMany({
      where: {
        locationId,
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    // Check campaign access for the first event (all should have same campaign through location's world)
    if (events.length > 0) {
      await this.checkCampaignAccess(events[0].campaignId, user);
    }

    return events;
  }

  /**
   * Create a new event
   */
  async create(input: CreateEventInput, user: AuthenticatedUser): Promise<PrismaEvent> {
    // Verify campaign exists and user has access
    await this.checkCampaignAccess(input.campaignId, user);

    // Verify location exists and belongs to same world as campaign (if provided)
    if (input.locationId) {
      await this.validateLocation(input.campaignId, input.locationId);
    }

    const event = await this.prisma.event.create({
      data: {
        campaignId: input.campaignId,
        locationId: input.locationId ?? null,
        name: input.name,
        description: input.description ?? null,
        eventType: input.eventType,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('event', event.id, 'CREATE', user.id, {
      campaignId: event.campaignId,
      locationId: event.locationId,
      name: event.name,
      description: event.description,
      eventType: event.eventType,
      scheduledAt: event.scheduledAt,
      variables: event.variables,
    });

    return event;
  }

  /**
   * Update an event with optimistic locking and versioning
   */
  async update(
    id: string,
    input: UpdateEventData,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    worldTime: Date = new Date()
  ): Promise<PrismaEvent> {
    // Verify event exists and user has access
    const event = await this.findById(id, user);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Verify branchId belongs to this entity's campaign
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, campaignId: event.campaignId, deletedAt: null },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to this entity's campaign`
      );
    }

    // Optimistic locking check: verify version matches
    if (event.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Event was modified by another user. Expected version ${expectedVersion}, but found ${event.version}. Please refresh and try again.`,
        expectedVersion,
        event.version
      );
    }

    // Verify location exists and belongs to same world as campaign (if changing location)
    if (input.locationId !== undefined && input.locationId !== null) {
      await this.validateLocation(event.campaignId, input.locationId);
    }

    // Build update data with incremented version
    const updateData: Prisma.EventUpdateInput = {
      version: event.version + 1,
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.eventType !== undefined) updateData.eventType = input.eventType;
    if (input.scheduledAt !== undefined) {
      updateData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }
    if (input.occurredAt !== undefined) {
      updateData.occurredAt = input.occurredAt ? new Date(input.occurredAt) : null;
    }
    if (input.isCompleted !== undefined) {
      updateData.isCompleted = input.isCompleted;
      // If marking as completed and no occurredAt provided, set it to now
      if (input.isCompleted && !event.occurredAt && input.occurredAt === undefined) {
        updateData.occurredAt = new Date();
      }
    }
    if (input.variables !== undefined) {
      updateData.variables = input.variables as Prisma.InputJsonValue;
    }
    if (input.locationId !== undefined) {
      if (input.locationId === null) {
        updateData.location = { disconnect: true };
      } else {
        updateData.location = { connect: { id: input.locationId } };
      }
    }

    // Create new version payload (all fields)
    const newPayload: Record<string, unknown> = {
      ...event,
      ...updateData,
      version: event.version + 1,
    };

    // Use transaction to atomically update entity and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update event with new version
      const updatedEvent = await tx.event.update({
        where: { id },
        data: updateData,
      });

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'event',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedEvent;
    });

    // Create audit entry
    await this.audit.log('event', id, 'UPDATE', user.id, updateData);

    // Publish entityModified event for concurrent edit detection
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'event',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    return updated;
  }

  /**
   * Soft delete an event
   * Does NOT cascade (per requirements - keep audit trail)
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaEvent> {
    // Verify event exists and user has access
    const event = await this.findById(id, user);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    const deletedAt = new Date();

    // Soft delete event
    const deleted = await this.prisma.event.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('event', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archive an event
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaEvent> {
    // Verify event exists and user has access
    const event = await this.findById(id, user);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    const archivedAt = new Date();

    const archived = await this.prisma.event.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('event', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restore an archived event
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaEvent> {
    const event = await this.prisma.event.findFirst({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    await this.checkCampaignAccess(event.campaignId, user);

    const restored = await this.prisma.event.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('event', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Check if user has access to campaign
   * Private helper method
   */
  private async checkCampaignAccess(campaignId: string, user: AuthenticatedUser): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, deletedAt: null },
      include: {
        memberships: {
          where: { userId: user.id },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    // Check if user is owner or has membership
    if (campaign.ownerId !== user.id && campaign.memberships.length === 0) {
      throw new ForbiddenException('You do not have access to this campaign');
    }
  }

  /**
   * Validate that location exists and belongs to same world as campaign
   * Private helper method
   */
  private async validateLocation(campaignId: string, locationId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { worldId: true },
    });

    const location = await this.prisma.location.findFirst({
      where: { id: locationId, deletedAt: null },
      select: { worldId: true },
    });

    if (!location) {
      throw new NotFoundException(`Location with ID ${locationId} not found`);
    }

    if (location.worldId !== campaign?.worldId) {
      throw new Error('Location must belong to the same world as the campaign');
    }
  }

  /**
   * Complete an event with 3-phase effect execution
   *
   * This method executes the complete event completion workflow:
   * 1. Execute PRE effects (before completion)
   * 2. Mark event as completed (isCompleted = true, occurredAt = now)
   * 3. Execute ON_RESOLVE effects (during completion)
   * 4. Execute POST effects (after completion)
   *
   * Failed effects are logged but don't prevent completion.
   *
   * @param id - Event ID
   * @param user - User context for authorization and audit
   * @returns Summary of all effect executions across all phases
   */
  async complete(
    id: string,
    user: AuthenticatedUser
  ): Promise<{
    event: PrismaEvent;
    effectSummary: {
      pre: EffectExecutionSummary;
      onResolve: EffectExecutionSummary;
      post: EffectExecutionSummary;
    };
  }> {
    // Verify event exists and user has access
    const event = await this.findById(id, user);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Check if already completed
    if (event.isCompleted) {
      throw new BadRequestException(`Event with ID ${id} is already completed`);
    }

    // Convert AuthenticatedUser to UserContext for effect execution
    const userContext: UserContext = {
      id: user.id,
      email: user.email,
    };

    // Phase 1: Execute PRE effects (skip entity update - event not completed yet)
    const preResults = await this.effectExecution.executeEffectsForEntity(
      'EVENT',
      id,
      'PRE',
      userContext,
      true // skipEntityUpdate
    );

    // Phase 2: Mark event as completed
    const occurredAt = new Date();
    const completed = await this.prisma.event.update({
      where: { id },
      data: {
        isCompleted: true,
        occurredAt,
        version: event.version + 1,
      },
    });

    // Create audit entry for completion
    await this.audit.log('event', id, 'UPDATE', user.id, {
      isCompleted: true,
      occurredAt,
    });

    // Publish entityModified event
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'event',
        version: completed.version,
        modifiedBy: user.id,
        modifiedAt: completed.updatedAt,
      },
    });

    // Phase 3: Execute ON_RESOLVE effects (skip entity update - only create execution records)
    const onResolveResults = await this.effectExecution.executeEffectsForEntity(
      'EVENT',
      id,
      'ON_RESOLVE',
      userContext,
      true // skipEntityUpdate
    );

    // Phase 4: Execute POST effects (skip entity update - only create execution records)
    const postResults = await this.effectExecution.executeEffectsForEntity(
      'EVENT',
      id,
      'POST',
      userContext,
      true // skipEntityUpdate
    );

    return {
      event: completed,
      effectSummary: {
        pre: preResults,
        onResolve: onResolveResults,
        post: postResults,
      },
    };
  }

  /**
   * Find overdue events for a campaign
   * Events are overdue if scheduledAt < (currentWorldTime - gracePeriod) AND not completed
   *
   * @param campaignId - Campaign ID to check for overdue events
   * @param user - User context for authorization
   * @param gracePeriodMs - Grace period in milliseconds to allow before marking events as overdue (default: 300000ms = 5 minutes)
   * @returns Array of overdue events ordered by scheduledAt (ascending)
   */
  async findOverdueEvents(
    campaignId: string,
    user: AuthenticatedUser,
    gracePeriodMs = 5 * 60 * 1000 // 300000ms = 5 minutes
  ): Promise<PrismaEvent[]> {
    // Verify campaign access
    await this.checkCampaignAccess(campaignId, user);

    // Get current world time for the campaign
    const currentWorldTime = await this.worldTimeService.getCurrentWorldTime(campaignId, user);

    // If no world time set, no events can be overdue
    if (!currentWorldTime) {
      return [];
    }

    // Calculate cutoff time (currentWorldTime - gracePeriod)
    const cutoffTime = new Date(currentWorldTime.getTime() - gracePeriodMs);

    // Query overdue events
    return this.prisma.event.findMany({
      where: {
        campaignId,
        scheduledAt: {
          lt: cutoffTime,
        },
        isCompleted: false,
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });
  }

  /**
   * Expire an event by marking it as completed
   * Simpler than complete() - only marks as completed without executing effects
   * Used by scheduler service for automatic expiration
   *
   * @param id - Event ID
   * @param user - User context for authorization and audit
   * @returns Expired event
   */
  async expire(id: string, user: AuthenticatedUser): Promise<PrismaEvent> {
    // Verify event exists and user has access
    const event = await this.findById(id, user);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Check if already completed
    if (event.isCompleted) {
      throw new BadRequestException(`Event with ID ${id} is already completed`);
    }

    // Get current world time for occurredAt timestamp
    const currentWorldTime = await this.worldTimeService.getCurrentWorldTime(
      event.campaignId,
      user
    );
    const occurredAt = currentWorldTime || new Date();

    // Mark event as completed (expired) with optimistic locking
    let expired: PrismaEvent;
    try {
      expired = await this.prisma.event.update({
        where: {
          id,
          version: event.version, // Optimistic lock: only update if version matches
        },
        data: {
          isCompleted: true,
          occurredAt,
          version: event.version + 1,
        },
      });
    } catch (error) {
      // Handle optimistic lock failure (version mismatch or concurrent update)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        throw new OptimisticLockException(
          `Event was modified by another process. Please retry.`,
          event.version,
          event.version + 1
        );
      }
      throw error;
    }

    // Create audit entry for expiration
    await this.audit.log('event', id, 'UPDATE', user.id, {
      isCompleted: true,
      occurredAt,
      expiredBy: 'scheduler',
    });

    // Publish entityModified event
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'event',
        version: expired.version,
        modifiedBy: user.id,
        modifiedAt: expired.updatedAt,
      },
    });

    return expired;
  }

  /**
   * Get event state as it existed at a specific point in world-time
   * Supports time-travel queries for version history
   */
  async getEventAsOf(
    id: string,
    branchId: string,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<PrismaEvent | null> {
    // Verify user has access to the event
    const event = await this.findById(id, user);
    if (!event) {
      return null;
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion('event', id, branchId, worldTime);

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as an Event object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaEvent;
  }
}
