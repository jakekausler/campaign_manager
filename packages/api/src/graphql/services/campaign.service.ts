/**
 * Campaign Service
 * Business logic for Campaign operations
 * Implements CRUD with soft delete, archive, and cascade delete to child entities
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import type { Campaign as PrismaCampaign, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { createEntityUpdatedEvent } from '@campaign/shared';

import { PrismaService } from '../../database/prisma.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateCampaignInput, UpdateCampaignData } from '../inputs/campaign.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { VersionService, type CreateVersionInput } from './version.service';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub,
    private readonly websocketPublisher: WebSocketPublisherService
  ) {}

  /**
   * Find campaign by ID
   * Ensures user has access to the campaign
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaCampaign | null> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: {
                userId: user.id,
              },
            },
          },
        ],
      },
    });

    return campaign;
  }

  /**
   * Find all campaigns accessible to the user
   */
  async findAll(user: AuthenticatedUser): Promise<PrismaCampaign[]> {
    return this.prisma.campaign.findMany({
      where: {
        deletedAt: null,
        archivedAt: null,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: {
                userId: user.id,
              },
            },
          },
        ],
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find campaigns by world ID
   */
  async findByWorldId(worldId: string, user: AuthenticatedUser): Promise<PrismaCampaign[]> {
    return this.prisma.campaign.findMany({
      where: {
        worldId,
        deletedAt: null,
        archivedAt: null,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: {
                userId: user.id,
              },
            },
          },
        ],
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Create a new campaign
   * User becomes the owner and a default branch is created
   */
  async create(input: CreateCampaignInput, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Verify world exists
    const world = await this.prisma.world.findFirst({
      where: { id: input.worldId, deletedAt: null },
    });

    if (!world) {
      throw new NotFoundException(`World with ID ${input.worldId} not found`);
    }

    // Create campaign
    const campaign = await this.prisma.campaign.create({
      data: {
        name: input.name,
        worldId: input.worldId,
        ownerId: user.id,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
      },
    });

    // Create default branch
    await this.prisma.branch.create({
      data: {
        campaignId: campaign.id,
        name: 'Main',
        description: 'Primary campaign timeline',
      },
    });

    // Create audit entry
    await this.audit.log('campaign', campaign.id, 'CREATE', user.id, {
      name: campaign.name,
      worldId: campaign.worldId,
      settings: campaign.settings,
      isActive: campaign.isActive,
    });

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishEntityUpdated(
      createEntityUpdatedEvent('campaign', campaign.id, campaign.id, {
        changedFields: ['name', 'worldId', 'settings', 'isActive'],
        userId: user.id,
        source: 'api',
      })
    );

    return campaign;
  }

  /**
   * Update a campaign with optimistic locking and versioning
   * Only owner or GM can update
   */
  async update(
    id: string,
    input: UpdateCampaignData,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    worldTime: Date = new Date()
  ): Promise<PrismaCampaign> {
    // Verify campaign exists and user has access
    const campaign = await this.findById(id, user);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify branchId belongs to this campaign
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, campaignId: id, deletedAt: null },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to this campaign`
      );
    }

    // Verify user has edit permissions (owner or GM)
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this campaign');
    }

    // Optimistic locking check: verify version matches
    if (campaign.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Campaign was modified by another user. Expected version ${expectedVersion}, but found ${campaign.version}. Please refresh and try again.`,
        expectedVersion,
        campaign.version
      );
    }

    // Build update data with incremented version
    const updateData: Prisma.CampaignUpdateInput = {
      version: campaign.version + 1,
    };
    const changedFields: string[] = [];
    if (input.name !== undefined) {
      updateData.name = input.name;
      changedFields.push('name');
    }
    if (input.settings !== undefined) {
      updateData.settings = input.settings as Prisma.InputJsonValue;
      changedFields.push('settings');
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
      changedFields.push('isActive');
    }

    // Create new version payload (all fields)
    const newPayload: Record<string, unknown> = {
      ...campaign,
      ...updateData,
      version: campaign.version + 1,
    };

    // Use transaction to atomically update entity and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update campaign with new version
      const updatedCampaign = await tx.campaign.update({
        where: { id },
        data: updateData,
      });

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'campaign',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedCampaign;
    });

    // Create audit entry
    await this.audit.log('campaign', id, 'UPDATE', user.id, updateData);

    // Publish entityModified event for concurrent edit detection
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'campaign',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishEntityUpdated(
      createEntityUpdatedEvent('campaign', id, id, {
        changedFields,
        userId: user.id,
        source: 'api',
      })
    );

    return updated;
  }

  /**
   * Soft delete a campaign
   * Cascades to Events, Encounters, Characters, Parties, Kingdoms, and Branches
   * Only owner or GM can delete
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Verify campaign exists and user has access
    const campaign = await this.findById(id, user);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify user has delete permissions (owner or GM)
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this campaign');
    }

    const deletedAt = new Date();

    // Soft delete campaign
    const deleted = await this.prisma.campaign.update({
      where: { id },
      data: { deletedAt },
    });

    // Cascade delete to child entities
    await this.cascadeDelete(id, deletedAt);

    // Create audit entry
    await this.audit.log('campaign', id, 'DELETE', user.id, { deletedAt });

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishEntityUpdated(
      createEntityUpdatedEvent('campaign', id, id, {
        changedFields: ['deletedAt'],
        userId: user.id,
        source: 'api',
      })
    );

    return deleted;
  }

  /**
   * Archive a campaign
   * Does not cascade to child entities
   * Only owner or GM can archive
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Verify campaign exists and user has access
    const campaign = await this.findById(id, user);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this campaign');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.campaign.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('campaign', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restore an archived campaign
   * Only owner or GM can restore
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Find campaign even if archived
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: {
                userId: user.id,
              },
            },
          },
        ],
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this campaign');
    }

    const restored = await this.prisma.campaign.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('campaign', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Cascade soft delete to all child entities
   * According to ticket requirements, cascade to:
   * - Events
   * - Encounters
   * - Characters
   * - Parties
   * - Kingdoms → Settlements → Structures
   * - Branches
   *
   * Optimized to use batch operations to avoid N+1 queries
   */
  private async cascadeDelete(campaignId: string, deletedAt: Date): Promise<void> {
    // Soft delete all events
    await this.prisma.event.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Soft delete all encounters
    await this.prisma.encounter.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Soft delete all characters
    await this.prisma.character.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Soft delete all parties
    await this.prisma.party.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Cascade delete kingdoms → settlements → structures (optimized batch operations)
    // Get all kingdom IDs for this campaign
    const kingdoms = await this.prisma.kingdom.findMany({
      where: { campaignId, deletedAt: null },
      select: { id: true },
    });
    const kingdomIds = kingdoms.map((k) => k.id);

    if (kingdomIds.length > 0) {
      // Get all settlement IDs for these kingdoms
      const settlements = await this.prisma.settlement.findMany({
        where: { kingdomId: { in: kingdomIds }, deletedAt: null },
        select: { id: true },
      });
      const settlementIds = settlements.map((s) => s.id);

      // Batch update all structures for these settlements
      if (settlementIds.length > 0) {
        await this.prisma.structure.updateMany({
          where: { settlementId: { in: settlementIds }, deletedAt: null },
          data: { deletedAt },
        });
      }

      // Batch update all settlements
      await this.prisma.settlement.updateMany({
        where: { id: { in: settlementIds }, deletedAt: null },
        data: { deletedAt },
      });

      // Batch update all kingdoms
      await this.prisma.kingdom.updateMany({
        where: { id: { in: kingdomIds }, deletedAt: null },
        data: { deletedAt },
      });
    }

    // Soft delete all branches
    await this.prisma.branch.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });
  }

  /**
   * Check if user has edit permissions for a campaign
   * Owner or GM role can edit
   */
  private async hasEditPermission(campaignId: string, user: AuthenticatedUser): Promise<boolean> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        OR: [
          { ownerId: user.id },
          {
            memberships: {
              some: {
                userId: user.id,
                role: {
                  in: ['OWNER', 'GM'],
                },
              },
            },
          },
        ],
      },
    });

    return campaign !== null;
  }

  /**
   * Get campaign state as it existed at a specific point in world-time
   * Supports time-travel queries for version history
   */
  async getCampaignAsOf(
    id: string,
    branchId: string,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<PrismaCampaign | null> {
    // Verify user has access to the campaign
    const campaign = await this.findById(id, user);
    if (!campaign) {
      return null;
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion('campaign', id, branchId, worldTime);

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as a Campaign object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaCampaign;
  }
}
