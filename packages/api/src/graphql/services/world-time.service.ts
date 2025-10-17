/**
 * World Time Service
 * Manages world time advancement and queries for campaigns
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions/optimistic-lock.exception';
import type { WorldTimeResult } from '../types/world-time.type';

import { CampaignContextService } from './campaign-context.service';

@Injectable()
export class WorldTimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignContext: CampaignContextService
  ) {}

  /**
   * Get current world time for a campaign
   *
   * @param campaignId - The ID of the campaign
   * @param user - The authenticated user
   * @returns Current world time or null if not set
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
   * @param campaignId - The ID of the campaign
   * @param to - The new world time to advance to
   * @param userId - The ID of the user performing the action
   * @param expectedVersion - Expected version for optimistic locking
   * @param branchId - Optional branch ID (for future use)
   * @param invalidateCache - Whether to invalidate campaign context cache (default: true)
   * @returns WorldTimeResult with details of the advancement
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
   * Ensures new time is after current time (if current time exists)
   *
   * @param currentTime - Current world time (null if not set)
   * @param newTime - New time to advance to
   * @throws BadRequestException if validation fails
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
   * @param campaignId - The ID of the campaign
   * @param userId - The ID of the user
   * @param select - Fields to select (optional, defaults to all fields)
   * @returns Campaign object with selected fields
   * @throws NotFoundException if campaign not found or access denied
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
