/**
 * Kingdom Service
 * Business logic for Kingdom operations
 * Implements CRUD with soft delete, archive, and cascade delete to Settlements
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { Kingdom as PrismaKingdom, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateKingdomInput, UpdateKingdomData } from '../inputs/kingdom.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { VersionService, type CreateVersionInput } from './version.service';

@Injectable()
export class KingdomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService,
    @Inject(forwardRef(() => CampaignContextService))
    private readonly campaignContext: CampaignContextService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Find kingdom by ID
   * Ensures user has access to the campaign
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaKingdom | null> {
    const kingdom = await this.prisma.kingdom.findFirst({
      where: {
        id,
        deletedAt: null,
        campaign: {
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
      },
    });

    return kingdom;
  }

  /**
   * Find kingdoms by campaign
   */
  async findByCampaign(campaignId: string, user: AuthenticatedUser): Promise<PrismaKingdom[]> {
    // First verify user has access to this campaign
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
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

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    return this.prisma.kingdom.findMany({
      where: {
        campaignId,
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Create a new kingdom
   * Only owner or GM can create kingdoms
   */
  async create(input: CreateKingdomInput, user: AuthenticatedUser): Promise<PrismaKingdom> {
    // Verify campaign exists and user has permission
    const hasPermission = await this.hasEditPermission(input.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to create kingdoms in this campaign'
      );
    }

    // Create kingdom
    const kingdom = await this.prisma.kingdom.create({
      data: {
        name: input.name,
        campaignId: input.campaignId,
        level: input.level ?? 1,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        variableSchemas: (input.variableSchemas ?? []) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('kingdom', kingdom.id, 'CREATE', user.id, {
      name: kingdom.name,
      campaignId: kingdom.campaignId,
      level: kingdom.level,
    });

    return kingdom;
  }

  /**
   * Update a kingdom with optimistic locking and versioning
   * Only owner or GM can update
   */
  async update(
    id: string,
    input: UpdateKingdomData,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    worldTime: Date = new Date()
  ): Promise<PrismaKingdom> {
    // Verify kingdom exists and user has access
    const kingdom = await this.findById(id, user);
    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${id} not found`);
    }

    // Verify branchId belongs to this entity's campaign
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, campaignId: kingdom.campaignId, deletedAt: null },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to this entity's campaign`
      );
    }

    // Optimistic locking check: verify version matches
    if (kingdom.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Kingdom was modified by another user. Expected version ${expectedVersion}, but found ${kingdom.version}. Please refresh and try again.`,
        expectedVersion,
        kingdom.version
      );
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(kingdom.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this kingdom');
    }

    // Build update data with incremented version
    const updateData: Prisma.KingdomUpdateInput = {
      version: kingdom.version + 1,
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.level !== undefined) updateData.level = input.level;
    if (input.variables !== undefined)
      updateData.variables = input.variables as Prisma.InputJsonValue;
    if (input.variableSchemas !== undefined)
      updateData.variableSchemas = input.variableSchemas as Prisma.InputJsonValue;

    // Create new version payload (all fields)
    const newPayload: Record<string, unknown> = {
      ...kingdom,
      ...updateData,
      version: kingdom.version + 1,
    };

    // Use transaction to atomically update entity and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update kingdom with new version
      const updatedKingdom = await tx.kingdom.update({
        where: { id },
        data: updateData,
      });

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'kingdom',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedKingdom;
    });

    // Create audit entry
    await this.audit.log('kingdom', id, 'UPDATE', user.id, updateData);

    // Publish entityModified event for concurrent edit detection
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'kingdom',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    return updated;
  }

  /**
   * Soft delete a kingdom
   * Cascades to Settlements (which will cascade to Structures)
   * Only owner or GM can delete
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaKingdom> {
    // Verify kingdom exists and user has access
    const kingdom = await this.findById(id, user);
    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${id} not found`);
    }

    // Verify user has delete permissions
    const hasPermission = await this.hasEditPermission(kingdom.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this kingdom');
    }

    const deletedAt = new Date();

    // Soft delete kingdom
    const deleted = await this.prisma.kingdom.update({
      where: { id },
      data: { deletedAt },
    });

    // Cascade delete to settlements (which will cascade to structures)
    await this.cascadeDelete(id, deletedAt);

    // Create audit entry
    await this.audit.log('kingdom', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archive a kingdom
   * Does not cascade to settlements
   * Only owner or GM can archive
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaKingdom> {
    // Verify kingdom exists and user has access
    const kingdom = await this.findById(id, user);
    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(kingdom.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this kingdom');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.kingdom.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('kingdom', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restore an archived kingdom
   * Only owner or GM can restore
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaKingdom> {
    // Find kingdom even if archived
    const kingdom = await this.prisma.kingdom.findFirst({
      where: {
        id,
        campaign: {
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
      },
    });

    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(kingdom.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this kingdom');
    }

    const restored = await this.prisma.kingdom.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('kingdom', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Cascade soft delete to all settlements and their structures
   * Optimized to use batch operations to avoid N+1 queries
   */
  private async cascadeDelete(kingdomId: string, deletedAt: Date): Promise<void> {
    // Get all settlement IDs in this kingdom
    const settlements = await this.prisma.settlement.findMany({
      where: { kingdomId, deletedAt: null },
      select: { id: true },
    });
    const settlementIds = settlements.map((s) => s.id);

    if (settlementIds.length > 0) {
      // Batch update all structures for these settlements
      await this.prisma.structure.updateMany({
        where: { settlementId: { in: settlementIds }, deletedAt: null },
        data: { deletedAt },
      });

      // Batch update all settlements
      await this.prisma.settlement.updateMany({
        where: { id: { in: settlementIds }, deletedAt: null },
        data: { deletedAt },
      });
    }
  }

  /**
   * Check if user has edit permissions for a campaign
   * Owner or GM role can edit
   */
  private async hasEditPermission(campaignId: string, user: AuthenticatedUser): Promise<boolean> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        deletedAt: null,
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
   * Set kingdom level
   * Only owner or GM can set level
   */
  async setLevel(id: string, level: number, user: AuthenticatedUser): Promise<PrismaKingdom> {
    const kingdom = await this.findById(id, user);
    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${id} not found`);
    }

    const hasPermission = await this.hasEditPermission(kingdom.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to set level for this kingdom');
    }

    const updated = await this.prisma.kingdom.update({
      where: { id },
      data: { level },
    });

    // Create audit entry
    await this.audit.log('kingdom', id, 'UPDATE', user.id, { level });

    // Publish entityModified event for level change
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'kingdom',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    // Invalidate campaign context cache to reflect level change
    // Cache invalidation failures should not block the operation - cache will expire via TTL
    try {
      await this.campaignContext.invalidateContextForEntity('kingdom', id, kingdom.campaignId);
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      console.error(`Failed to invalidate campaign context for kingdom ${id}:`, error);
    }

    // TODO (TICKET-013): Trigger rules engine recalculation when rules engine is implemented
    // await this.rulesEngine.invalidate({
    //   campaignId: kingdom.campaignId,
    //   changeType: 'kingdom_level',
    //   affectedVariables: ['kingdom.level'],
    // });

    return updated;
  }

  /**
   * Get kingdom state as it existed at a specific point in world-time
   * Supports time-travel queries for version history
   */
  async getKingdomAsOf(
    id: string,
    branchId: string,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<PrismaKingdom | null> {
    // Verify user has access to the kingdom
    const kingdom = await this.findById(id, user);
    if (!kingdom) {
      return null;
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion('kingdom', id, branchId, worldTime);

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as a Kingdom object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaKingdom;
  }
}
