/**
 * Settlement Service
 * Business logic for Settlement operations
 * Implements CRUD with soft delete, archive, and cascade delete to Structures
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { Settlement as PrismaSettlement, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateSettlementInput, UpdateSettlementData } from '../inputs/settlement.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { VersionService, type CreateVersionInput } from './version.service';

@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService,
    @Inject(forwardRef(() => CampaignContextService))
    private readonly campaignContext: CampaignContextService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Find settlement by ID
   * Ensures user has access to the kingdom
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaSettlement | null> {
    const settlement = await this.prisma.settlement.findFirst({
      where: {
        id,
        deletedAt: null,
        kingdom: {
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
      },
    });

    return settlement;
  }

  /**
   * Find settlements by kingdom
   */
  async findByKingdom(kingdomId: string, user: AuthenticatedUser): Promise<PrismaSettlement[]> {
    // First verify user has access to this kingdom
    const kingdom = await this.prisma.kingdom.findFirst({
      where: {
        id: kingdomId,
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

    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${kingdomId} not found`);
    }

    return this.prisma.settlement.findMany({
      where: {
        kingdomId,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find settlement by location ID
   * Returns the settlement at a specific location (if any)
   */
  async findByLocationId(locationId: string): Promise<PrismaSettlement | null> {
    return this.prisma.settlement.findFirst({
      where: {
        locationId,
        deletedAt: null,
      },
    });
  }

  /**
   * Create a new settlement
   * Only owner or GM can create settlements
   */
  async create(input: CreateSettlementInput, user: AuthenticatedUser): Promise<PrismaSettlement> {
    // Verify user has access to create settlements in this kingdom
    const kingdom = await this.prisma.kingdom.findFirst({
      where: {
        id: input.kingdomId,
        deletedAt: null,
        campaign: {
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
      },
      include: {
        campaign: true,
      },
    });

    if (!kingdom) {
      throw new ForbiddenException(
        'You do not have permission to create settlements in this kingdom'
      );
    }

    // Verify location exists and belongs to the same world
    const location = await this.prisma.location.findFirst({
      where: {
        id: input.locationId,
        worldId: kingdom.campaign.worldId,
        deletedAt: null,
      },
    });

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${input.locationId} not found in the same world`
      );
    }

    // Check if location is already used by another settlement
    const existingSettlement = await this.prisma.settlement.findFirst({
      where: {
        locationId: input.locationId,
        deletedAt: null,
      },
    });

    if (existingSettlement) {
      throw new ForbiddenException('This location is already occupied by another settlement');
    }

    const settlement = await this.prisma.settlement.create({
      data: {
        kingdomId: input.kingdomId,
        locationId: input.locationId,
        name: input.name,
        level: input.level ?? 1,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        variableSchemas: (input.variableSchemas ?? []) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('settlement', settlement.id, 'CREATE', user.id, {
      name: settlement.name,
      kingdomId: settlement.kingdomId,
      locationId: settlement.locationId,
      level: settlement.level,
    });

    return settlement;
  }

  /**
   * Update a settlement with optimistic locking and versioning
   * Only owner or GM can update
   */
  async update(
    id: string,
    input: UpdateSettlementData,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    worldTime: Date = new Date()
  ): Promise<PrismaSettlement> {
    // Verify settlement exists and user has access
    const settlement = await this.findById(id, user);
    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${id} not found`);
    }

    // Get settlement with kingdom to access campaignId
    const settlementWithKingdom = await this.prisma.settlement.findUnique({
      where: { id },
      include: { kingdom: true },
    });

    // Verify branchId belongs to this entity's campaign
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        campaignId: settlementWithKingdom!.kingdom.campaignId,
        deletedAt: null,
      },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to this entity's campaign`
      );
    }

    // Optimistic locking check: verify version matches
    if (settlement.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Settlement was modified by another user. Expected version ${expectedVersion}, but found ${settlement.version}. Please refresh and try again.`,
        expectedVersion,
        settlement.version
      );
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
          campaign: {
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
        },
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this settlement');
    }

    // Build update data with incremented version
    const updateData: Prisma.SettlementUpdateInput = {
      version: settlement.version + 1,
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.level !== undefined) updateData.level = input.level;
    if (input.variables !== undefined)
      updateData.variables = input.variables as Prisma.InputJsonValue;
    if (input.variableSchemas !== undefined)
      updateData.variableSchemas = input.variableSchemas as Prisma.InputJsonValue;

    // Create new version payload (all fields)
    const newPayload: Record<string, unknown> = {
      ...settlement,
      ...updateData,
      version: settlement.version + 1,
    };

    // Use transaction to atomically update entity and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update settlement with new version
      const updatedSettlement = await tx.settlement.update({
        where: { id },
        data: updateData,
      });

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'settlement',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedSettlement;
    });

    // Create audit entry
    await this.audit.log('settlement', id, 'UPDATE', user.id, updateData);

    // Publish entityModified event for concurrent edit detection
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'settlement',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    return updated;
  }

  /**
   * Soft delete a settlement
   * Cascades to Structures
   * Only owner or GM can delete
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaSettlement> {
    // Verify settlement exists and user has access
    const settlement = await this.findById(id, user);
    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${id} not found`);
    }

    // Verify user has delete permissions
    const hasPermission = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
          campaign: {
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
        },
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this settlement');
    }

    const deletedAt = new Date();

    // Soft delete settlement
    const deleted = await this.prisma.settlement.update({
      where: { id },
      data: { deletedAt },
    });

    // Cascade delete to structures
    await this.prisma.structure.updateMany({
      where: { settlementId: id, deletedAt: null },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('settlement', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archive a settlement
   * Does not cascade to structures
   * Only owner or GM can archive
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaSettlement> {
    // Verify settlement exists and user has access
    const settlement = await this.findById(id, user);
    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
          campaign: {
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
        },
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this settlement');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.settlement.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('settlement', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restore an archived settlement
   * Only owner or GM can restore
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaSettlement> {
    // Find settlement even if archived
    const settlement = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
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
      },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
          campaign: {
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
        },
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this settlement');
    }

    const restored = await this.prisma.settlement.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('settlement', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Set settlement level
   * Only owner or GM can set level
   */
  async setLevel(id: string, level: number, user: AuthenticatedUser): Promise<PrismaSettlement> {
    const settlement = await this.findById(id, user);
    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
          campaign: {
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
        },
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to set level for this settlement');
    }

    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { level },
    });

    // Create audit entry
    await this.audit.log('settlement', id, 'UPDATE', user.id, { level });

    // Publish entityModified event for level change
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'settlement',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    // Get campaign ID for context invalidation
    const settlementWithKingdom = await this.prisma.settlement.findUnique({
      where: { id },
      include: { kingdom: true },
    });

    // Invalidate campaign context cache to reflect level change
    // Cache invalidation failures should not block the operation - cache will expire via TTL
    try {
      await this.campaignContext.invalidateContextForEntity(
        'settlement',
        id,
        settlementWithKingdom!.kingdom.campaignId
      );
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      console.error(`Failed to invalidate campaign context for settlement ${id}:`, error);
    }

    // TODO (TICKET-013): Trigger rules engine recalculation when rules engine is implemented
    // await this.rulesEngine.invalidate({
    //   campaignId: settlementWithKingdom!.kingdom.campaignId,
    //   changeType: 'settlement_level',
    //   affectedVariables: ['settlement.level'],
    // });

    return updated;
  }

  /**
   * Get settlement state as it existed at a specific point in world-time
   * Supports time-travel queries for version history
   */
  async getSettlementAsOf(
    id: string,
    branchId: string,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<PrismaSettlement | null> {
    // Verify user has access to the settlement
    const settlement = await this.findById(id, user);
    if (!settlement) {
      return null;
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion('settlement', id, branchId, worldTime);

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as a Settlement object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaSettlement;
  }
}
