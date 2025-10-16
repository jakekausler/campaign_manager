/**
 * Event Service
 * Handles CRUD operations for Events (no cascade delete per requirements)
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Event as PrismaEvent, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateEventInput, UpdateEventData } from '../inputs/event.input';

import { AuditService } from './audit.service';
import { VersionService, type CreateVersionInput } from './version.service';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService
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
