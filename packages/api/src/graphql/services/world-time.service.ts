/**
 * @fileoverview World Time Service - Campaign-specific time tracking and management
 *
 * This service provides comprehensive time management for campaigns, enabling:
 * - Campaign-specific world time tracking independent of real-world time
 * - Time progression with validation and optimistic locking
 * - Real-time updates via WebSocket for synchronized time changes
 * - Audit logging of all time advancement operations
 * - Cache invalidation to maintain consistency across services
 *
 * World time is stored as a Date in the campaign entity and can be advanced
 * forward in time. The service enforces strict validation rules:
 * - Time can only move forward (no time travel to the past)
 * - First time setting can be any date (establishes initial timeline)
 * - Concurrent modifications are prevented via optimistic locking
 *
 * Integration points:
 * - Campaign context cache is invalidated on time changes
 * - WebSocket events notify connected clients of time updates
 * - Audit logs track all time advancement operations
 * - Future integration with rules engine for time-based triggers (TICKET-020+)
 *
 * @module graphql/services/world-time
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { createWorldTimeChangedEvent } from '@campaign/shared';

import { PrismaService } from '../../database/prisma.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions/optimistic-lock.exception';
import type { WorldTimeResult } from '../types/world-time.type';

import { CampaignContextService } from './campaign-context.service';

/**
 * World Time Service
 *
 * Manages campaign-specific world time tracking and advancement. This service handles
 * all operations related to a campaign's internal timeline, independent of real-world time.
 *
 * Key responsibilities:
 * - Query current world time for campaigns
 * - Advance world time with validation and concurrency control
 * - Maintain audit trail of time changes
 * - Publish real-time updates to connected clients
 * - Coordinate cache invalidation across services
 *
 * Time advancement process:
 * 1. Verify campaign access and optimistic lock version
 * 2. Validate time progression (forward-only, no duplicates)
 * 3. Update campaign time and version in atomic transaction
 * 4. Create audit log entry for traceability
 * 5. Invalidate campaign context cache
 * 6. Publish WebSocket event for real-time sync
 * 7. Return detailed result with elapsed time
 *
 * Concurrency handling:
 * Uses optimistic locking with version numbers to prevent lost updates when
 * multiple users attempt to advance time simultaneously. Throws OptimisticLockException
 * if version mismatch is detected.
 *
 * Future enhancements (TICKET-020+):
 * - Integration with rules engine for time-based condition evaluation
 * - Automatic trigger activation for scheduled events
 * - Recalculation of time-dependent computed properties
 * - Support for custom calendar systems and time units
 *
 * @see {@link docs/features/world-time-system.md} for complete feature documentation
 */
@Injectable()
export class WorldTimeService {
  /**
   * Creates an instance of WorldTimeService
   *
   * @param prisma - Database service for data access
   * @param campaignContext - Campaign context service for cache management
   * @param websocketPublisher - WebSocket service for real-time event publishing
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignContext: CampaignContextService,
    private readonly websocketPublisher: WebSocketPublisherService
  ) {}

  /**
   * Get current world time for a campaign
   *
   * Retrieves the current world time for a campaign. Returns null if no world time
   * has been set yet (campaign timeline not initialized).
   *
   * Access control:
   * - User must be campaign owner or member
   * - Soft-deleted campaigns are excluded
   *
   * @param campaignId - The UUID of the campaign to query
   * @param user - The authenticated user making the request
   * @returns The current world time as a Date, or null if not yet set
   * @throws {NotFoundException} If campaign not found or user lacks access
   *
   * @example
   * ```typescript
   * const worldTime = await worldTimeService.getCurrentWorldTime(
   *   'campaign-uuid',
   *   authenticatedUser
   * );
   * if (worldTime) {
   *   console.log(`Current campaign time: ${worldTime.toISOString()}`);
   * } else {
   *   console.log('Campaign timeline not initialized');
   * }
   * ```
   */
  async getCurrentWorldTime(campaignId: string, user: AuthenticatedUser): Promise<Date | null> {
    const campaign = await this.verifyCampaignAccess(campaignId, user.id, {
      currentWorldTime: true,
    });

    return campaign.currentWorldTime;
  }

  /**
   * Advance world time for a campaign
   *
   * Advances the campaign's world time to a new point in the timeline. This operation
   * is atomic and includes optimistic locking to prevent concurrent modification conflicts.
   *
   * Process flow:
   * 1. Verifies campaign access and retrieves current state
   * 2. Checks optimistic lock version to detect concurrent modifications
   * 3. Validates time advancement (must be forward in time)
   * 4. Updates campaign time and version in atomic transaction
   * 5. Creates audit log entry for traceability
   * 6. Invalidates campaign context cache for consistency
   * 7. Publishes WebSocket event for real-time synchronization
   * 8. Returns detailed result with elapsed time calculation
   *
   * Validation rules:
   * - New time must be strictly after current time (if set)
   * - First time setting can be any date
   * - Version must match expected version (optimistic lock)
   *
   * Side effects:
   * - Campaign version is incremented
   * - Campaign context cache is invalidated (unless disabled)
   * - Audit log entry is created
   * - WebSocket event is published to all connected clients
   *
   * Future enhancements (TICKET-020+):
   * When rules engine is implemented, this will trigger:
   * - Recalculation of time-dependent computed properties
   * - Activation of time-based triggers and scheduled events
   * - Evaluation of conditional effects based on new time
   *
   * @param campaignId - The UUID of the campaign to update
   * @param to - The new world time to advance to (must be after current time)
   * @param userId - The UUID of the user performing the advancement
   * @param expectedVersion - Expected campaign version for optimistic locking
   * @param _branchId - Optional branch ID (reserved for future branching support, currently unused)
   * @param invalidateCache - Whether to invalidate campaign context cache (default: true, disable for batch operations)
   * @returns Result object containing previous/current time, elapsed duration, and affected entity count
   * @throws {NotFoundException} If campaign not found or user lacks access
   * @throws {OptimisticLockException} If campaign version doesn't match expectedVersion (concurrent modification detected)
   * @throws {BadRequestException} If new time is not after current time (attempting to go backward)
   *
   * @example
   * ```typescript
   * // Advance time by 1 day
   * const currentTime = new Date('2024-01-01T00:00:00Z');
   * const newTime = new Date('2024-01-02T00:00:00Z');
   *
   * try {
   *   const result = await worldTimeService.advanceWorldTime(
   *     'campaign-uuid',
   *     newTime,
   *     'user-uuid',
   *     42 // expected version
   *   );
   *   console.log(result.message); // "World time advanced from 2024-01-01... to 2024-01-02..."
   *   console.log(`Elapsed: ${result.currentWorldTime.getTime() - result.previousWorldTime!.getTime()}ms`);
   * } catch (error) {
   *   if (error instanceof OptimisticLockException) {
   *     // Handle concurrent modification - refresh and retry
   *   }
   * }
   * ```
   */
  async advanceWorldTime(
    campaignId: string,
    to: Date,
    userId: string,
    expectedVersion: number,
    _branchId?: string,
    invalidateCache = true
  ): Promise<WorldTimeResult> {
    // Verify campaign exists and user has access
    const campaign = await this.verifyCampaignAccess(campaignId, userId, {
      id: true,
      currentWorldTime: true,
      version: true,
    });

    // Optimistic locking check: verify version matches
    if (campaign.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Campaign was modified by another user. Expected version ${expectedVersion}, but found ${campaign.version}. Please refresh and try again.`,
        expectedVersion,
        campaign.version
      );
    }

    // Validate time advancement
    this.validateTimeAdvancement(campaign.currentWorldTime, to);

    const previousWorldTime = campaign.currentWorldTime;

    // Use transaction for atomic update and audit
    await this.prisma.$transaction(async (tx) => {
      // Update campaign with new world time and increment version
      await tx.campaign.update({
        where: {
          id: campaignId,
          version: expectedVersion, // Database-level protection
        },
        data: {
          currentWorldTime: to,
          version: campaign.version + 1,
        },
      });

      // Create audit log entry within transaction
      await tx.audit.create({
        data: {
          entityType: 'campaign',
          entityId: campaignId,
          operation: 'UPDATE',
          userId,
          changes: {
            previousWorldTime,
            currentWorldTime: to,
          } as Prisma.InputJsonValue,
          metadata: {} as Prisma.InputJsonValue,
        },
      });
    });

    // Invalidate campaign context cache if requested
    if (invalidateCache) {
      await this.campaignContext.invalidateContext(campaignId);
    }

    // TODO: When rules engine is implemented (TICKET-020+):
    // Trigger rules recalculation on time advancement to ensure all computed
    // properties and derived state are updated for the new world time:
    // await this.rulesEngine.invalidate({ campaignId, worldTime: to, branchId });
    // This will recalculate:
    // - Conditional effects based on time
    // - Time-based triggers
    // - Scheduled events that should activate
    // - Any derived properties that depend on world time

    // Build result message
    const message = previousWorldTime
      ? `World time advanced from ${previousWorldTime.toISOString()} to ${to.toISOString()}`
      : `World time set to ${to.toISOString()}`;

    // Calculate elapsed time
    const elapsedMs = previousWorldTime ? to.getTime() - previousWorldTime.getTime() : 0;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishWorldTimeChanged(
      createWorldTimeChangedEvent(
        campaignId,
        previousWorldTime?.toISOString() ?? to.toISOString(),
        to.toISOString(),
        {
          elapsed: elapsedSeconds > 0 ? { value: elapsedSeconds, unit: 'seconds' } : undefined,
          userId,
          source: 'api',
        }
      )
    );

    return {
      campaignId,
      previousWorldTime: previousWorldTime ?? undefined,
      currentWorldTime: to,
      affectedEntities: 0, // TODO: Count entities with versions at this time when versioning integration is added
      message,
    };
  }

  /**
   * Validate time advancement
   *
   * Ensures that time advancement follows campaign timeline rules:
   * - If current time exists, new time must be strictly after it (no time travel)
   * - If current time is null, any time is valid (first time initialization)
   *
   * This prevents logical inconsistencies in the campaign timeline and ensures
   * that events, encounters, and other time-based entities remain valid.
   *
   * Validation logic:
   * - Current time = null: Allow any new time (initializing timeline)
   * - Current time exists: Require newTime > currentTime (forward progression only)
   *
   * @param currentTime - Current world time, or null if timeline not yet initialized
   * @param newTime - Proposed new world time to validate
   * @throws {BadRequestException} If newTime is not after currentTime (attempting backward time travel)
   *
   * @example
   * ```typescript
   * // Valid: First time set
   * validateTimeAdvancement(null, new Date('2024-01-01'));
   *
   * // Valid: Time moves forward
   * validateTimeAdvancement(
   *   new Date('2024-01-01'),
   *   new Date('2024-01-02')
   * );
   *
   * // Invalid: Time goes backward
   * validateTimeAdvancement(
   *   new Date('2024-01-02'),
   *   new Date('2024-01-01')
   * ); // throws BadRequestException
   * ```
   */
  private validateTimeAdvancement(currentTime: Date | null, newTime: Date): void {
    // If no current time is set, any time is valid (first time setting)
    if (!currentTime) {
      return;
    }

    // Ensure new time is strictly after current time
    if (newTime <= currentTime) {
      throw new BadRequestException(
        'Cannot advance time to the past. New time must be after current world time'
      );
    }
  }

  /**
   * Verify campaign exists and user has access
   *
   * Internal utility method that validates campaign access and retrieves campaign data
   * with flexible field selection. Enforces access control and soft-delete rules.
   *
   * Access control rules:
   * - User must be campaign owner (ownerId = userId), OR
   * - User must be campaign member (has active membership)
   * - Soft-deleted campaigns (deletedAt != null) are excluded
   *
   * The method uses Prisma's type-safe select functionality to return only the
   * requested fields, optimizing query performance and reducing data transfer.
   *
   * Generic type parameter T:
   * - Extends Prisma.CampaignSelect to ensure type safety
   * - Return type is automatically inferred based on selected fields
   * - Enables compile-time checking of field access
   *
   * @template T - Prisma select type defining which fields to retrieve
   * @param campaignId - The UUID of the campaign to verify
   * @param userId - The UUID of the user requesting access
   * @param select - Optional Prisma select object specifying fields to retrieve (defaults to all fields if omitted)
   * @returns Campaign object containing only the selected fields, with proper TypeScript typing
   * @throws {NotFoundException} If campaign not found, soft-deleted, or user lacks access (returns same error for security)
   *
   * @example
   * ```typescript
   * // Select specific fields
   * const campaign = await this.verifyCampaignAccess(
   *   'campaign-uuid',
   *   'user-uuid',
   *   { id: true, currentWorldTime: true, version: true }
   * );
   * // campaign type: { id: string, currentWorldTime: Date | null, version: number }
   *
   * // Select all fields (omit select parameter)
   * const fullCampaign = await this.verifyCampaignAccess(
   *   'campaign-uuid',
   *   'user-uuid'
   * );
   * // fullCampaign type: Full Campaign object with all fields
   * ```
   */
  private async verifyCampaignAccess<T extends Prisma.CampaignSelect>(
    campaignId: string,
    userId: string,
    select?: T
  ): Promise<Prisma.CampaignGetPayload<{ select: T }>> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          {
            memberships: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      select: select as T,
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found or access denied`);
    }

    return campaign as Prisma.CampaignGetPayload<{ select: T }>;
  }
}
