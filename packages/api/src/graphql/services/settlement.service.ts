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
  Logger,
} from '@nestjs/common';
import type { Settlement as PrismaSettlement, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { createSettlementUpdatedEvent } from '@campaign/shared';

import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateSettlementInput, UpdateSettlementData } from '../inputs/settlement.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { DependencyGraphService } from './dependency-graph.service';
import { LevelValidator } from './level-validator';
import { VersionService, type CreateVersionInput } from './version.service';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly versionService: VersionService,
    @Inject(forwardRef(() => CampaignContextService))
    private readonly campaignContext: CampaignContextService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub,
    private readonly conditionEvaluation: ConditionEvaluationService,
    private readonly rulesEngineClient: RulesEngineClientService,
    private readonly dependencyGraph: DependencyGraphService,
    private readonly websocketPublisher: WebSocketPublisherService
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
    // TODO: Support branch parameter - currently hardcoded to 'main'
    const branchId = 'main';
    const cacheKey = `settlements:kingdom:${kingdomId}:${branchId}`;

    // Check cache first
    try {
      const cached = await this.cache.get<PrismaSettlement[]>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for settlement list: ${cacheKey}`);
        return cached;
      }

      this.logger.debug(`Cache miss for settlement list: ${cacheKey}`);
    } catch (error) {
      // Log cache error but continue - graceful degradation
      this.logger.warn(
        `Failed to read cache for settlement list ${cacheKey}`,
        error instanceof Error ? error.message : undefined
      );
    }

    // Cache miss - query database
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

    const settlements = await this.prisma.settlement.findMany({
      where: {
        kingdomId,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Store in cache for future requests (TTL: 600 seconds)
    try {
      await this.cache.set(cacheKey, settlements, { ttl: 600 });
      this.logger.debug(`Cached settlement list: ${cacheKey}`);
    } catch (error) {
      // Log cache error but don't throw - graceful degradation
      this.logger.warn(
        `Failed to cache settlement list ${cacheKey}`,
        error instanceof Error ? error.message : undefined
      );
    }

    return settlements;
  }

  /**
   * Find settlements by multiple kingdom IDs (batch operation to avoid N+1 queries)
   * @param kingdomIds Array of kingdom IDs to fetch settlements for
   * @param user Authenticated user (must have access to the campaign)
   * @returns Array of settlements across all specified kingdoms
   */
  async findByKingdoms(kingdomIds: string[], user: AuthenticatedUser): Promise<PrismaSettlement[]> {
    if (kingdomIds.length === 0) {
      return [];
    }

    // Verify user has access to at least one of these kingdoms
    // (they all belong to the same campaign in our use case from CampaignContextService)
    const accessibleKingdoms = await this.prisma.kingdom.findMany({
      where: {
        id: { in: kingdomIds },
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
      select: { id: true },
    });

    const accessibleKingdomIds = accessibleKingdoms.map((k) => k.id);

    if (accessibleKingdomIds.length === 0) {
      return [];
    }

    // Fetch all settlements for accessible kingdoms in a single query
    return this.prisma.settlement.findMany({
      where: {
        kingdomId: { in: accessibleKingdomIds },
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
   * Find settlements by IDs (batch operation for DataLoader)
   * Returns settlements in the same order as input IDs, with null for missing settlements
   *
   * No authorization - settlements are world-scoped data accessible to all users with access
   * to the world's campaign. Authorization is enforced at the GraphQL resolver level
   * (e.g., SettlementResolver.settlement) where user context is available.
   */
  async findByIds(
    settlementIds: readonly string[]
  ): Promise<Array<Prisma.SettlementGetPayload<{ include: { location: true } }> | null>> {
    if (settlementIds.length === 0) {
      return [];
    }

    // Query all settlements in one query, including location relation
    const settlements = await this.prisma.settlement.findMany({
      where: {
        id: { in: [...settlementIds] },
        deletedAt: null,
      },
      include: {
        location: true,
      },
    });

    // Create a map for quick lookup
    const settlementMap = new Map<
      string,
      Prisma.SettlementGetPayload<{ include: { location: true } }>
    >();
    settlements.forEach((settlement) => {
      settlementMap.set(settlement.id, settlement);
    });

    // Return in same order as input IDs, with null for missing settlements
    return settlementIds.map((id) => settlementMap.get(id) || null);
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

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishSettlementUpdated(
      createSettlementUpdatedEvent(settlement.id, kingdom.campaign.id, 'create', {
        changedFields: ['name', 'kingdomId', 'locationId', 'level'],
        userId: user.id,
        source: 'api',
      })
    );

    // Invalidate kingdom's settlement list cache since a new settlement was created
    // Cache invalidation failures should not block the operation
    try {
      // TODO: Support branch parameter - currently hardcoded to 'main'
      const branchId = 'main';
      const cacheKey = `settlements:kingdom:${input.kingdomId}:${branchId}`;
      await this.cache.del(cacheKey);
      this.logger.debug(`Invalidated settlement list cache: ${cacheKey}`);
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.warn(
        `Failed to invalidate settlement list cache for kingdom ${input.kingdomId}`,
        error instanceof Error ? error.message : undefined
      );
    }

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
      include: { kingdom: { include: { campaign: true } } },
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
    const changedFields: string[] = [];
    if (input.name !== undefined) {
      updateData.name = input.name;
      changedFields.push('name');
    }
    if (input.level !== undefined) {
      updateData.level = input.level;
      changedFields.push('level');
    }
    if (input.variables !== undefined) {
      updateData.variables = input.variables as Prisma.InputJsonValue;
      changedFields.push('variables');
    }
    if (input.variableSchemas !== undefined) {
      updateData.variableSchemas = input.variableSchemas as Prisma.InputJsonValue;
      changedFields.push('variableSchemas');
    }

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

    // Create audit entry with full state tracking
    // Convert Prisma objects to plain objects for audit
    const previousState = JSON.parse(JSON.stringify(settlement)) as Record<string, unknown>;
    const newState = JSON.parse(JSON.stringify(updated)) as Record<string, unknown>;

    await this.audit.log(
      'settlement',
      id,
      'UPDATE',
      user.id,
      updateData,
      {}, // metadata
      previousState,
      newState
    );

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

    // Invalidate computed fields cache since settlement data changed
    // Cache invalidation failures should not block the operation
    try {
      const cacheKey = `computed-fields:settlement:${id}:${branchId}`;
      await this.cache.del(cacheKey);
      this.logger.debug(`Invalidated computed fields cache: ${cacheKey}`);
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.warn(
        `Failed to invalidate computed fields cache for settlement ${id}`,
        error instanceof Error ? error.message : undefined
      );
    }

    // Invalidate dependency graph cache to trigger rule re-evaluation
    // Cache invalidation failures should not block the operation
    try {
      this.dependencyGraph.invalidateGraph(settlementWithKingdom!.kingdom.campaignId, branchId);
      this.logger.log(
        `Invalidated dependency graph for campaign ${settlementWithKingdom!.kingdom.campaignId} ` +
          `due to settlement ${id} update`
      );
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.error(`Failed to invalidate dependency graph for settlement ${id}:`, error);
    }

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishSettlementUpdated(
      createSettlementUpdatedEvent(id, settlementWithKingdom!.kingdom.campaignId, 'update', {
        changedFields,
        userId: user.id,
        source: 'api',
      })
    );

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

    // Get settlement with kingdom to access campaignId
    const settlementWithKingdom = await this.prisma.settlement.findUnique({
      where: { id },
      include: { kingdom: { include: { campaign: true } } },
    });

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

    // Create audit entry with full state tracking
    // Convert Prisma objects to plain objects for audit
    const previousState = JSON.parse(JSON.stringify(settlement)) as Record<string, unknown>;
    const newState = JSON.parse(JSON.stringify(deleted)) as Record<string, unknown>;

    await this.audit.log(
      'settlement',
      id,
      'DELETE',
      user.id,
      { deletedAt },
      {}, // metadata
      previousState,
      newState
    );

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishSettlementUpdated(
      createSettlementUpdatedEvent(id, settlementWithKingdom!.kingdom.campaignId, 'delete', {
        changedFields: ['deletedAt'],
        userId: user.id,
        source: 'api',
      })
    );

    // Invalidate kingdom's settlement list cache since a settlement was deleted
    // Cache invalidation failures should not block the operation
    try {
      // TODO: Support branch parameter - currently hardcoded to 'main'
      const branchId = 'main';
      const cacheKey = `settlements:kingdom:${settlement.kingdomId}:${branchId}`;
      await this.cache.del(cacheKey);
      this.logger.debug(`Invalidated settlement list cache: ${cacheKey}`);
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.warn(
        `Failed to invalidate settlement list cache for kingdom ${settlement.kingdomId}`,
        error instanceof Error ? error.message : undefined
      );
    }

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

    // Invalidate kingdom's settlement list cache since a settlement was archived
    // Cache invalidation failures should not block the operation
    try {
      // TODO: Support branch parameter - currently hardcoded to 'main'
      const branchId = 'main';
      const cacheKey = `settlements:kingdom:${settlement.kingdomId}:${branchId}`;
      await this.cache.del(cacheKey);
      this.logger.debug(`Invalidated settlement list cache: ${cacheKey}`);
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.warn(
        `Failed to invalidate settlement list cache for kingdom ${settlement.kingdomId}`,
        error instanceof Error ? error.message : undefined
      );
    }

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
    // Validate level range before processing
    LevelValidator.validateLevel(level, 'settlement');

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

    // Invalidate computed fields cache since level changed
    // Cache invalidation failures should not block the operation
    try {
      // TODO: Support branch parameter - currently hardcoded to 'main'
      const branchId = 'main';
      const cacheKey = `computed-fields:settlement:${id}:${branchId}`;
      await this.cache.del(cacheKey);
      this.logger.debug(`Invalidated computed fields cache: ${cacheKey}`);
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.warn(
        `Failed to invalidate computed fields cache for settlement ${id}`,
        error instanceof Error ? error.message : undefined
      );
    }

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

    // Invalidate dependency graph cache to trigger rule re-evaluation
    // Cache invalidation failures should not block the operation
    try {
      this.dependencyGraph.invalidateGraph(settlementWithKingdom!.kingdom.campaignId);
      this.logger.log(
        `Invalidated dependency graph for campaign ${settlementWithKingdom!.kingdom.campaignId} ` +
          `due to settlement ${id} level change`
      );
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.error(`Failed to invalidate dependency graph for settlement ${id}:`, error);
    }

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

  /**
   * Get computed fields for a settlement by evaluating all active conditions
   * Returns a map of field names to their computed values
   *
   * NOTE: Authorization is assumed to be performed by the caller (GraphQL resolver)
   *
   * TODO (Performance): Implement DataLoader pattern to avoid N+1 queries when
   * resolving computed fields for multiple settlements in a batch.
   *
   * TODO (Performance): Evaluate conditions in parallel using Promise.all
   * instead of sequential await in loop.
   *
   * TODO (Feature): Consider supporting type-level conditions (entityId: null)
   * that apply to all settlements of this type.
   */
  async getComputedFields(
    settlement: PrismaSettlement,
    _user: AuthenticatedUser
  ): Promise<Record<string, unknown>> {
    // TODO: Support branch parameter - currently hardcoded to 'main'
    const branchId = 'main';
    const cacheKey = `computed-fields:settlement:${settlement.id}:${branchId}`;

    try {
      // Check cache first
      const cached = await this.cache.get<Record<string, unknown>>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for computed fields: ${cacheKey}`);
        return cached;
      }

      this.logger.debug(`Cache miss for computed fields: ${cacheKey}`);
    } catch (error) {
      // Log cache error but continue - graceful degradation
      this.logger.warn(
        `Failed to read cache for computed fields ${cacheKey}`,
        error instanceof Error ? error.message : undefined
      );
    }

    // Cache miss - compute fields normally
    try {
      // Fetch all active conditions for this settlement
      // NOTE: This creates an N+1 query problem when called for multiple settlements
      // Should be optimized with DataLoader in future iteration
      const conditions = await this.prisma.fieldCondition.findMany({
        where: {
          entityType: 'settlement',
          entityId: settlement.id,
          isActive: true,
          deletedAt: null,
        },
        orderBy: {
          priority: 'desc',
        },
      });

      // If no conditions, cache and return empty object
      if (conditions.length === 0) {
        const emptyResult = {};
        try {
          await this.cache.set(cacheKey, emptyResult, { ttl: 300 });
          this.logger.debug(`Cached empty computed fields for settlement ${settlement.id}`);
        } catch (error) {
          // Log cache write error but don't prevent returning results
          this.logger.warn(
            `Cache write error for settlement ${settlement.id}`,
            error instanceof Error ? error.message : undefined
          );
        }
        return emptyResult;
      }

      // Get campaign ID for Rules Engine worker request
      const settlementWithKingdom = await this.prisma.settlement.findUnique({
        where: { id: settlement.id },
        include: { kingdom: true },
      });

      const campaignId = settlementWithKingdom?.kingdom.campaignId;

      // Try to use Rules Engine worker if available
      if (campaignId) {
        try {
          const isAvailable = await this.rulesEngineClient.isAvailable();

          if (isAvailable) {
            // Build context from settlement data with StateVariable integration
            const entityData = {
              settlement: {
                id: settlement.id,
                name: settlement.name,
                level: settlement.level,
                kingdomId: settlement.kingdomId,
                locationId: settlement.locationId,
                variables: settlement.variables,
                version: settlement.version,
                createdAt: settlement.createdAt,
                updatedAt: settlement.updatedAt,
              },
            };

            const context = await this.conditionEvaluation.buildContextWithVariables(entityData, {
              includeVariables: true,
              scope: 'settlement',
              scopeId: settlement.id,
            });

            // Evaluate conditions via worker
            const conditionIds = conditions.map((c) => c.id);
            const response = await this.rulesEngineClient.evaluateConditions({
              conditionIds,
              campaignId,
              branchId: 'main', // TODO: Support branch parameter
              contextJson: JSON.stringify(context),
              includeTrace: false,
              useDependencyOrder: true,
            });

            // Build computed fields map from worker results
            const computedFields: Record<string, unknown> = {};
            for (const condition of conditions) {
              if (condition.field in computedFields) {
                continue; // Higher priority already processed
              }

              const result = response.results[condition.id];
              if (result && result.success && result.valueJson) {
                const value = JSON.parse(result.valueJson);
                computedFields[condition.field] = value;
              }
            }

            this.logger.debug(
              `Evaluated ${conditions.length} conditions for settlement ${settlement.id} via Rules Engine worker`
            );

            // Store in cache for future requests (TTL: 300 seconds)
            try {
              await this.cache.set(cacheKey, computedFields, { ttl: 300 });
              this.logger.debug(`Cached computed fields: ${cacheKey}`);
            } catch (error) {
              // Log cache error but don't throw - graceful degradation
              this.logger.warn(
                `Failed to cache computed fields ${cacheKey}`,
                error instanceof Error ? error.message : undefined
              );
            }

            return computedFields;
          }
        } catch (error) {
          // Log worker error and fall through to local evaluation
          this.logger.warn(
            `Rules Engine worker unavailable for settlement ${settlement.id}, falling back to local evaluation`,
            error instanceof Error ? error.message : undefined
          );
        }
      }

      // Fallback: Local evaluation
      this.logger.debug(`Using local evaluation for settlement ${settlement.id} computed fields`);

      // Build context from settlement data with StateVariable integration
      const entityData = {
        settlement: {
          id: settlement.id,
          name: settlement.name,
          level: settlement.level,
          kingdomId: settlement.kingdomId,
          locationId: settlement.locationId,
          variables: settlement.variables,
          version: settlement.version,
          createdAt: settlement.createdAt,
          updatedAt: settlement.updatedAt,
        },
      };

      // Build context with variables included
      const context = await this.conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'settlement',
        scopeId: settlement.id,
      });

      // Evaluate each condition and build computed fields map
      const computedFields: Record<string, unknown> = {};

      /**
       * Process conditions in priority order (DESC - highest first).
       * For each field, only the first (highest priority) condition is evaluated.
       * If multiple conditions have the same priority for a field, the first one
       * encountered wins (database ordering is not guaranteed for equal priorities).
       */
      for (const condition of conditions) {
        // Skip if we already have a value for this field (higher priority already processed)
        if (condition.field in computedFields) {
          continue;
        }

        // Evaluate the condition expression
        // NOTE: Sequential evaluation - could be parallelized for better performance
        const result = await this.conditionEvaluation.evaluateExpression(
          condition.expression as Prisma.JsonValue,
          context
        );

        // Only include successfully evaluated conditions
        if (result.success) {
          computedFields[condition.field] = result.value;
        }
      }

      // Store in cache for future requests (TTL: 300 seconds)
      try {
        await this.cache.set(cacheKey, computedFields, { ttl: 300 });
        this.logger.debug(`Cached computed fields: ${cacheKey}`);
      } catch (error) {
        // Log cache error but don't throw - graceful degradation
        this.logger.warn(
          `Failed to cache computed fields ${cacheKey}`,
          error instanceof Error ? error.message : undefined
        );
      }

      return computedFields;
    } catch (error) {
      // Log error but don't throw - gracefully return empty object
      this.logger.error(
        `Failed to compute fields for settlement ${settlement.id}`,
        error instanceof Error ? error.stack : undefined
      );
      return {};
    }
  }
}
