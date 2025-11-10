/**
 * @fileoverview Kingdom Service - Business logic for Kingdom CRUD operations
 *
 * Provides comprehensive management of kingdom entities including:
 * - CRUD operations with optimistic locking and versioning
 * - Soft delete with cascade to settlements and structures
 * - Archive/restore operations for non-destructive state management
 * - Level progression with validation and cache invalidation
 * - Variable management for dynamic kingdom state
 * - Settlement hierarchy management
 * - Geographic entity relationships
 * - Time-travel queries for historical kingdom state
 * - Permission validation for campaign owner/GM roles
 * - Real-time update notifications via Redis pub/sub
 * - Campaign context cache integration
 *
 * @module services/kingdom
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
import { LevelValidator } from './level-validator';
import { VersionService, type CreateVersionInput } from './version.service';

/**
 * Service for managing kingdom entities and their hierarchical relationships.
 *
 * Kingdoms represent the top-level geographic/political entities in a campaign,
 * containing settlements which in turn contain structures. This service manages
 * the full lifecycle of kingdoms including creation, updates with optimistic locking,
 * soft deletion with cascading, archival, level progression, and historical queries.
 *
 * Key features:
 * - **Settlement Hierarchy**: Kingdoms own settlements which own structures
 * - **Cascade Operations**: Delete operations cascade to child settlements/structures
 * - **Level System**: 1-20 level progression with validation
 * - **Variables**: Dynamic JSON state storage with schema definitions
 * - **Versioning**: Snapshot creation on updates for time-travel queries
 * - **Optimistic Locking**: Version-based concurrency control
 * - **Permission Model**: Campaign owner and GM role access control
 * - **Real-time Updates**: Redis pub/sub for concurrent edit detection
 * - **Cache Integration**: Campaign context cache invalidation on changes
 *
 * @class
 * @injectable
 */
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
   * Retrieves a kingdom by ID with permission validation.
   *
   * Only returns kingdoms from campaigns where the user is the owner or a member.
   * Automatically filters out soft-deleted kingdoms and campaigns.
   *
   * @param id - UUID of the kingdom to retrieve
   * @param user - The authenticated user making the request
   * @returns The kingdom if found and user has access, null otherwise
   *
   * @example
   * ```typescript
   * const kingdom = await kingdomService.findById('kingdom-uuid', user);
   * if (!kingdom) {
   *   throw new NotFoundException('Kingdom not found');
   * }
   * ```
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
   * Retrieves all kingdoms for a specific campaign.
   *
   * Returns non-deleted, non-archived kingdoms ordered by name. First validates
   * that the user has access to the campaign.
   *
   * @param campaignId - UUID of the campaign to query
   * @param user - The authenticated user making the request
   * @returns Array of kingdoms in the campaign, ordered alphabetically by name
   * @throws {NotFoundException} If campaign not found or user lacks access
   *
   * @example
   * ```typescript
   * const kingdoms = await kingdomService.findByCampaign('campaign-uuid', user);
   * console.log(`Found ${kingdoms.length} kingdoms`);
   * ```
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
   * Creates a new kingdom in a campaign.
   *
   * Initializes a kingdom with default level 1 unless specified. Variables and
   * variableSchemas can be provided for dynamic state management. Creates an
   * audit log entry for the creation event.
   *
   * @param input - Kingdom creation data including name, campaignId, optional level/variables
   * @param user - The authenticated user creating the kingdom
   * @returns The newly created kingdom
   * @throws {ForbiddenException} If user lacks permission (not owner/GM)
   *
   * @example
   * ```typescript
   * const kingdom = await kingdomService.create({
   *   name: 'Kingdom of Eldoria',
   *   campaignId: 'campaign-uuid',
   *   level: 5,
   *   variables: { population: 50000, treasury: 10000 },
   *   variableSchemas: [{ name: 'population', type: 'number' }]
   * }, user);
   * ```
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
   * Updates a kingdom with optimistic locking and automatic versioning.
   *
   * Validates version number to prevent concurrent modification conflicts. Creates
   * a version snapshot in the specified branch at the given world time. Publishes
   * real-time update events for concurrent edit detection. All updates are atomic
   * via database transaction.
   *
   * @param id - UUID of the kingdom to update
   * @param input - Partial update data (name, level, variables, variableSchemas)
   * @param user - The authenticated user performing the update
   * @param expectedVersion - Version number for optimistic locking
   * @param branchId - UUID of the branch for version snapshot
   * @param worldTime - World time timestamp for version validity (defaults to current time)
   * @returns The updated kingdom with incremented version
   * @throws {NotFoundException} If kingdom not found
   * @throws {ForbiddenException} If user lacks permission
   * @throws {BadRequestException} If branchId invalid or doesn't belong to campaign
   * @throws {OptimisticLockException} If version mismatch detected
   *
   * @example
   * ```typescript
   * const updated = await kingdomService.update(
   *   'kingdom-uuid',
   *   { name: 'Renamed Kingdom', level: 10 },
   *   user,
   *   5, // expected current version
   *   'branch-uuid',
   *   new Date('2024-01-01')
   * );
   * ```
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
   * Soft deletes a kingdom and cascades to child entities.
   *
   * Sets deletedAt timestamp on the kingdom and all child settlements and structures.
   * This is a soft delete - data remains in database but is filtered from queries.
   * Cascade deletion is optimized using batch operations to avoid N+1 queries.
   *
   * @param id - UUID of the kingdom to delete
   * @param user - The authenticated user performing the deletion
   * @returns The soft-deleted kingdom with deletedAt timestamp
   * @throws {NotFoundException} If kingdom not found
   * @throws {ForbiddenException} If user lacks permission
   *
   * @example
   * ```typescript
   * const deleted = await kingdomService.delete('kingdom-uuid', user);
   * console.log('Deleted at:', deleted.deletedAt);
   * ```
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
   * Archives a kingdom without affecting child entities.
   *
   * Sets archivedAt timestamp on the kingdom to hide it from standard queries
   * without deleting it. Unlike delete, this does NOT cascade to settlements.
   * Archived kingdoms can be restored using the restore() method.
   *
   * @param id - UUID of the kingdom to archive
   * @param user - The authenticated user performing the archival
   * @returns The archived kingdom with archivedAt timestamp
   * @throws {NotFoundException} If kingdom not found
   * @throws {ForbiddenException} If user lacks permission
   *
   * @example
   * ```typescript
   * const archived = await kingdomService.archive('kingdom-uuid', user);
   * console.log('Archived at:', archived.archivedAt);
   * ```
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
   * Restores an archived kingdom by clearing its archivedAt timestamp.
   *
   * Allows archived kingdoms to be returned to active use. This method can find
   * kingdoms even if they are currently archived (unlike findById which filters
   * archived entities).
   *
   * @param id - UUID of the kingdom to restore
   * @param user - The authenticated user performing the restoration
   * @returns The restored kingdom with archivedAt set to null
   * @throws {NotFoundException} If kingdom not found
   * @throws {ForbiddenException} If user lacks permission
   *
   * @example
   * ```typescript
   * const restored = await kingdomService.restore('kingdom-uuid', user);
   * console.log('Restored kingdom:', restored.name);
   * ```
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
   * Cascades soft delete to all settlements and structures in a kingdom.
   *
   * Uses optimized batch operations to avoid N+1 query problems. First queries
   * all settlement IDs, then performs batch updates on structures and settlements
   * in two operations.
   *
   * @param kingdomId - UUID of the kingdom whose children should be deleted
   * @param deletedAt - Timestamp to set on all child entities
   * @private
   *
   * @example
   * ```typescript
   * // Called internally by delete() method
   * await this.cascadeDelete('kingdom-uuid', new Date());
   * ```
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
   * Validates if a user has edit permissions for a campaign.
   *
   * Returns true if the user is the campaign owner or has OWNER/GM role via
   * campaign membership. Used internally for permission checks before write
   * operations.
   *
   * @param campaignId - UUID of the campaign to check
   * @param user - The authenticated user to validate
   * @returns True if user has edit permission, false otherwise
   * @private
   *
   * @example
   * ```typescript
   * const canEdit = await this.hasEditPermission('campaign-uuid', user);
   * if (!canEdit) {
   *   throw new ForbiddenException('Insufficient permissions');
   * }
   * ```
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
   * Sets the level of a kingdom with validation and cache invalidation.
   *
   * Validates level is within 1-20 range before applying. Updates the kingdom,
   * publishes real-time update events, and invalidates campaign context cache
   * to reflect the level change. Future integration will trigger rules engine
   * recalculation for dependent conditions.
   *
   * @param id - UUID of the kingdom to update
   * @param level - New level value (must be 1-20)
   * @param user - The authenticated user performing the update
   * @returns The updated kingdom with new level
   * @throws {NotFoundException} If kingdom not found
   * @throws {ForbiddenException} If user lacks permission
   * @throws {BadRequestException} If level is outside valid range (1-20)
   *
   * @example
   * ```typescript
   * const kingdom = await kingdomService.setLevel('kingdom-uuid', 15, user);
   * console.log('New level:', kingdom.level);
   * ```
   */
  async setLevel(id: string, level: number, user: AuthenticatedUser): Promise<PrismaKingdom> {
    // Validate level range before processing
    LevelValidator.validateLevel(level, 'kingdom');

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
   * Retrieves kingdom state as it existed at a specific world time.
   *
   * Time-travel query that returns a historical snapshot of the kingdom from
   * the version history. Resolves the appropriate version for the given branch
   * and timestamp, then decompresses and returns the historical payload.
   *
   * @param id - UUID of the kingdom to query
   * @param branchId - UUID of the branch to query from
   * @param worldTime - World time timestamp to query at
   * @param user - The authenticated user making the request
   * @returns The historical kingdom state if found, null otherwise
   *
   * @example
   * ```typescript
   * // Get kingdom state as it was on January 1, 2024
   * const historical = await kingdomService.getKingdomAsOf(
   *   'kingdom-uuid',
   *   'branch-uuid',
   *   new Date('2024-01-01'),
   *   user
   * );
   * if (historical) {
   *   console.log('Kingdom at that time:', historical.name, historical.level);
   * }
   * ```
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
