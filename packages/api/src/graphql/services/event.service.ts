/**
 * @fileoverview Event Service - Event CRUD operations and completion workflow
 *
 * Provides comprehensive event management including CRUD operations, completion workflow,
 * expiration handling, timeline management, and historical state queries.
 *
 * Key Features:
 * - Event CRUD with campaign access control
 * - 3-phase completion workflow (PRE/ON_RESOLVE/POST effects)
 * - Automatic expiration for overdue events (used by scheduler)
 * - Timeline queries with filtering by campaign/location
 * - Historical state queries (time-travel via version history)
 * - Optimistic locking for concurrent updates
 * - Real-time entity modification notifications
 * - Soft delete (preserves audit trail)
 * - Archive/restore functionality
 *
 * Completion vs Expiration:
 * - complete(): Full 3-phase workflow with effect execution (user-initiated)
 * - expire(): Simple completion without effects (scheduler-initiated)
 *
 * Variables:
 * - Events support custom JSON variables (input.variables)
 * - Variables tracked in event.variables field
 * - Can be referenced in conditions and effects
 *
 * @module services/event
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

/**
 * Service for managing events in campaigns.
 *
 * Events represent time-based occurrences in the campaign world that can trigger
 * effects and state changes. They support scheduling, completion workflows,
 * automatic expiration, and historical state queries.
 *
 * Architecture:
 * - Uses optimistic locking (version field) for concurrent updates
 * - Integrates with EffectExecutionService for 3-phase completion
 * - Integrates with WorldTimeService for timeline management
 * - Integrates with VersionService for historical state tracking
 * - Publishes real-time notifications via Redis PubSub
 * - Creates audit entries for all modifications
 *
 * Authorization:
 * - All operations require campaign access (owner or member)
 * - Campaign access verified via checkCampaignAccess helper
 *
 * @class EventService
 */
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
   * Find an event by ID.
   *
   * Retrieves a single non-deleted event by ID. Verifies the authenticated user
   * has access to the event's campaign (owner or member).
   *
   * @param id - The event ID to find
   * @param user - Authenticated user for campaign access verification
   * @returns Event object if found and user has access, null if not found
   * @throws NotFoundException - If event's campaign doesn't exist
   * @throws ForbiddenException - If user lacks access to the event's campaign
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
   * Find all events in a campaign.
   *
   * Retrieves all non-deleted, non-archived events for the specified campaign,
   * ordered by scheduledAt timestamp (ascending). Verifies user has campaign access.
   *
   * @param campaignId - Campaign ID to query events for
   * @param user - Authenticated user for campaign access verification
   * @returns Array of events ordered by scheduledAt (earliest first)
   * @throws NotFoundException - If campaign doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
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
   * Find all events at a specific location.
   *
   * Retrieves all non-deleted, non-archived events for the specified location,
   * ordered by scheduledAt timestamp (ascending). Verifies user has campaign access
   * via the first event's campaign.
   *
   * @param locationId - Location ID to query events for
   * @param user - Authenticated user for campaign access verification
   * @returns Array of events at the location ordered by scheduledAt (earliest first)
   * @throws NotFoundException - If campaign doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
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
   * Create a new event.
   *
   * Creates an event with the provided input data. Validates campaign access and
   * location belongs to same world as campaign (if provided). Creates audit entry
   * for the creation operation.
   *
   * Variables:
   * - Input can include custom variables (input.variables) as JSON object
   * - Defaults to empty object {} if not provided
   *
   * @param input - Event creation data including campaignId, name, description, eventType, scheduledAt, locationId, variables
   * @param user - Authenticated user for campaign access verification and audit
   * @returns Newly created event
   * @throws NotFoundException - If campaign or location doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
   * @throws BadRequestException - If location doesn't belong to same world as campaign
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
   * Update an event with optimistic locking and versioning.
   *
   * Updates event fields specified in input. Uses optimistic locking to detect
   * concurrent modifications. Creates version snapshot in specified branch for
   * historical state tracking. Publishes real-time notification for concurrent
   * edit detection.
   *
   * Optimistic Locking:
   * - Verifies expectedVersion matches current version
   * - Throws OptimisticLockException if mismatch (concurrent update detected)
   * - Increments version on successful update
   *
   * Automatic Timestamps:
   * - If marking as completed (isCompleted: true) and no occurredAt provided,
   *   automatically sets occurredAt to current time
   *
   * Variables:
   * - Can update event variables via input.variables
   * - Variables are replaced entirely (not merged)
   *
   * @param id - Event ID to update
   * @param input - Partial update data (only specified fields are updated)
   * @param user - Authenticated user for campaign access verification and audit
   * @param expectedVersion - Expected current version for optimistic locking
   * @param branchId - Branch ID for version snapshot
   * @param worldTime - World time for version snapshot (defaults to current real time)
   * @returns Updated event with incremented version
   * @throws NotFoundException - If event, campaign, or branch doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
   * @throws OptimisticLockException - If expectedVersion doesn't match current version
   * @throws BadRequestException - If branchId doesn't belong to event's campaign or location invalid
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
   * Soft delete an event.
   *
   * Marks event as deleted by setting deletedAt timestamp. Does NOT cascade delete
   * to related entities (preserves audit trail per requirements). Creates audit entry
   * for the deletion operation.
   *
   * @param id - Event ID to delete
   * @param user - Authenticated user for campaign access verification and audit
   * @returns Soft-deleted event with deletedAt timestamp set
   * @throws NotFoundException - If event or campaign doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
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
   * Archive an event.
   *
   * Marks event as archived by setting archivedAt timestamp. Archived events are
   * excluded from normal queries but can be restored. Creates audit entry for the
   * archive operation.
   *
   * @param id - Event ID to archive
   * @param user - Authenticated user for campaign access verification and audit
   * @returns Archived event with archivedAt timestamp set
   * @throws NotFoundException - If event or campaign doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
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
   * Restore an archived event.
   *
   * Clears the archivedAt timestamp to restore event to normal query results.
   * Can restore events regardless of current archivedAt state. Creates audit entry
   * for the restore operation.
   *
   * @param id - Event ID to restore
   * @param user - Authenticated user for campaign access verification and audit
   * @returns Restored event with archivedAt cleared (null)
   * @throws NotFoundException - If event or campaign doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
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
   * Check if user has access to campaign.
   *
   * Private helper method to verify campaign exists and user has access as either
   * owner or member. Used by all public methods for authorization.
   *
   * @param campaignId - Campaign ID to check access for
   * @param user - Authenticated user to verify access
   * @returns Promise that resolves if access granted
   * @throws NotFoundException - If campaign doesn't exist or is deleted
   * @throws ForbiddenException - If user is neither owner nor member
   * @private
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
   * Validate that location exists and belongs to same world as campaign.
   *
   * Private helper method to ensure location-campaign consistency. Events can only
   * be associated with locations that exist in the same world as the campaign.
   *
   * @param campaignId - Campaign ID to validate against
   * @param locationId - Location ID to validate
   * @returns Promise that resolves if location is valid
   * @throws NotFoundException - If location doesn't exist or is deleted
   * @throws Error - If location belongs to different world than campaign
   * @private
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
   * Complete an event with 3-phase effect execution.
   *
   * Executes the complete event completion workflow with effect execution across
   * three distinct phases. This is the primary method for user-initiated event
   * completion (vs expire() which is used by the scheduler).
   *
   * Workflow:
   * 1. Verify event exists and user has access
   * 2. Check event is not already completed
   * 3. Execute PRE effects (before completion)
   * 4. Mark event as completed (isCompleted = true, occurredAt = now)
   * 5. Create audit entry and publish real-time notification
   * 6. Execute ON_RESOLVE effects (during completion)
   * 7. Execute POST effects (after completion)
   *
   * Effect Execution:
   * - PRE: Effects executed before event completion
   * - ON_RESOLVE: Effects executed during event completion
   * - POST: Effects executed after event completion
   * - All phases use skipEntityUpdate=true (only create execution records)
   * - Failed effects are logged but don't prevent completion
   *
   * Completion vs Expiration:
   * - complete(): Full 3-phase workflow with effect execution (this method)
   * - expire(): Simple completion without effects (scheduler-initiated)
   *
   * Variables:
   * - Event variables available to effects via entity context
   * - Can be used in effect conditions and operations
   *
   * @param id - Event ID to complete
   * @param user - Authenticated user for campaign access verification and audit
   * @returns Object containing completed event and effect summaries for all three phases
   * @throws NotFoundException - If event or campaign doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
   * @throws BadRequestException - If event is already completed
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
   * Find overdue events for a campaign.
   *
   * Identifies events that are past their scheduled time but not yet completed.
   * Uses campaign's world time to determine overdue status. Typically used by the
   * scheduler service to identify events that need automatic expiration.
   *
   * Overdue Criteria:
   * - scheduledAt < (currentWorldTime - gracePeriod)
   * - isCompleted = false
   * - deletedAt = null (not deleted)
   * - archivedAt = null (not archived)
   *
   * Grace Period:
   * - Default: 5 minutes (300000ms)
   * - Allows slight delays before marking as overdue
   * - Prevents premature expiration
   *
   * World Time Integration:
   * - Uses WorldTimeService to get current campaign world time
   * - Returns empty array if no world time is set
   * - Cutoff time = currentWorldTime - gracePeriod
   *
   * @param campaignId - Campaign ID to check for overdue events
   * @param user - Authenticated user for campaign access verification
   * @param gracePeriodMs - Grace period in milliseconds before marking as overdue (default: 300000ms = 5 minutes)
   * @returns Array of overdue events ordered by scheduledAt (earliest first)
   * @throws NotFoundException - If campaign doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
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
   * Expire an event by marking it as completed without executing effects.
   *
   * Simpler alternative to complete() that only marks the event as completed without
   * executing any effects. Designed for automatic expiration by the scheduler service
   * when events become overdue.
   *
   * Workflow:
   * 1. Verify event exists and user has access
   * 2. Check event is not already completed
   * 3. Get current world time for occurredAt timestamp
   * 4. Mark event as completed with optimistic locking
   * 5. Create audit entry (with expiredBy: 'scheduler' metadata)
   * 6. Publish real-time notification
   *
   * Completion vs Expiration:
   * - complete(): Full 3-phase workflow with effect execution (user-initiated)
   * - expire(): Simple completion without effects (this method, scheduler-initiated)
   *
   * Optimistic Locking:
   * - Uses version field to prevent concurrent updates
   * - Throws OptimisticLockException if version mismatch (Prisma P2025 error)
   * - Ensures atomic completion
   *
   * Audit Metadata:
   * - Includes expiredBy: 'scheduler' to distinguish from user completion
   * - Records occurredAt timestamp from world time
   *
   * @param id - Event ID to expire
   * @param user - Authenticated user for campaign access verification and audit
   * @returns Expired event with isCompleted=true and occurredAt set
   * @throws NotFoundException - If event or campaign doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
   * @throws BadRequestException - If event is already completed
   * @throws OptimisticLockException - If concurrent update detected (version mismatch)
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
   * Get event state as it existed at a specific point in world-time.
   *
   * Enables time-travel queries by retrieving historical event state from version
   * history. Useful for viewing past states, debugging, and analyzing state changes
   * over time.
   *
   * Version History:
   * - Uses VersionService to resolve historical snapshots
   * - Looks up version valid at the specified world-time
   * - Returns decompressed payload as Event object
   *
   * Workflow:
   * 1. Verify user has access to the event
   * 2. Resolve version at specified world-time in specified branch
   * 3. Decompress version payload
   * 4. Return historical state as Event object
   *
   * @param id - Event ID to query historical state for
   * @param branchId - Branch ID to query version history from
   * @param worldTime - World-time timestamp to retrieve state at
   * @param user - Authenticated user for campaign access verification
   * @returns Historical event state at the specified world-time, or null if not found or no version exists
   * @throws NotFoundException - If event or campaign doesn't exist
   * @throws ForbiddenException - If user lacks access to the campaign
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
