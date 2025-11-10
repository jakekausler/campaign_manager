/**
 * @file Structure Service
 *
 * @description
 * Provides business logic for managing structures (buildings and facilities) within settlements.
 * Handles CRUD operations, level progression, variable management, and computed field evaluation.
 * Structures are permanent installations that provide benefits to settlements such as economic bonuses,
 * military capabilities, cultural advantages, or magical enhancements.
 *
 * @module services/structure
 *
 * @remarks
 * Key features:
 * - CRUD operations with soft delete (no cascade) for audit trail preservation
 * - Archive/restore functionality for inactive structures
 * - Level progression system (1-20) with validation
 * - Custom variable management with JSON schemas for type validation
 * - Computed fields via JSONLogic conditions with Rules Engine worker integration
 * - Optimistic locking with version control for concurrent edit detection
 * - Settlement relationship management with access control
 * - Cache invalidation cascade for structure, settlement, and computed fields
 * - Real-time updates via WebSocket events
 * - Time-travel queries for historical state reconstruction
 * - Batch operations with DataLoader pattern for N+1 query prevention
 *
 * Structure hierarchy:
 * - Campaign → Kingdom → Settlement → Structure (buildings/facilities)
 * - Structures inherit campaign membership and access control from their parent settlement
 * - Settlement provides context for structure evaluation and bonuses
 *
 * Authorization:
 * - All operations verify user has access to the campaign via settlement's kingdom
 * - Create/update/delete/archive operations require OWNER or GM role
 * - Read operations require campaign membership (any role)
 * - DataLoader batch methods include authorization checks to prevent cache bypass
 *
 * @see {@link docs/features/condition-system.md} for computed field evaluation
 * @see {@link docs/features/rules-engine-worker.md} for high-performance condition evaluation
 * @see {@link docs/features/world-time-system.md} for time-travel query details
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
import type { Structure as PrismaStructure, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { createStructureUpdatedEvent } from '@campaign/shared';

import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateStructureInput, UpdateStructureData } from '../inputs/structure.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { DependencyGraphService } from './dependency-graph.service';
import { LevelValidator } from './level-validator';
import { VersionService, type CreateVersionInput } from './version.service';

/**
 * Service for managing structures (buildings and facilities) within settlements.
 *
 * @remarks
 * Handles complete structure lifecycle including:
 * - Creation and deletion with settlement relationship management
 * - Level progression (1-20) with validation
 * - Custom variable storage with JSON schemas
 * - Computed field evaluation via conditions
 * - Optimistic locking for concurrent edit detection
 * - Version history for time-travel queries
 * - Cache management with invalidation cascades
 * - Real-time updates via WebSocket events
 * - Batch operations for efficient data loading
 *
 * All operations include authorization checks and audit logging.
 */
@Injectable()
export class StructureService {
  private readonly logger = new Logger(StructureService.name);

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
   * Finds a structure by ID with authorization check.
   *
   * @param id - Structure UUID to find
   * @param user - Authenticated user making the request
   * @returns Structure if found and accessible, null if not found or no access
   *
   * @remarks
   * Verifies user has access to the campaign via settlement's kingdom.
   * Only returns non-deleted structures from non-deleted campaigns.
   * Uses Prisma nested where clauses to enforce authorization in a single query.
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaStructure | null> {
    const structure = await this.prisma.structure.findFirst({
      where: {
        id,
        deletedAt: null,
        settlement: {
          deletedAt: null,
          kingdom: {
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
        },
      },
    });

    return structure;
  }

  /**
   * Finds all structures belonging to a settlement with caching.
   *
   * @param settlementId - Settlement UUID to find structures for
   * @param user - Authenticated user making the request
   * @returns Array of structures in the settlement, ordered by name
   *
   * @throws {NotFoundException} If settlement not found or user lacks access
   *
   * @remarks
   * Uses Redis cache with 10-minute TTL to reduce database load.
   * Cache key includes branch ID (currently hardcoded to 'main').
   * Verifies user access to settlement's campaign before returning structures.
   * Gracefully handles cache errors without failing the operation.
   */
  async findBySettlement(
    settlementId: string,
    user: AuthenticatedUser
  ): Promise<PrismaStructure[]> {
    // Check cache first
    // TODO: Support branch parameter - currently hardcoded to 'main'
    const branchId = 'main';
    const cacheKey = `structures:settlement:${settlementId}:${branchId}`;

    try {
      const cached = await this.cache.get<PrismaStructure[]>(cacheKey);
      if (cached !== null) {
        this.logger.debug(`Cache hit for settlement ${settlementId} structure list`);
        return cached;
      }
      this.logger.debug(`Cache miss for settlement ${settlementId} structure list`);
    } catch (error) {
      // Log cache read error but continue with database query
      this.logger.warn(
        `Cache read error for settlement ${settlementId} structure list`,
        error instanceof Error ? error.message : undefined
      );
    }

    // First verify user has access to this settlement
    const settlement = await this.prisma.settlement.findFirst({
      where: {
        id: settlementId,
        deletedAt: null,
        kingdom: {
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
      },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${settlementId} not found`);
    }

    const structures = await this.prisma.structure.findMany({
      where: {
        settlementId,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Store in cache for future requests
    try {
      await this.cache.set(cacheKey, structures, { ttl: 600 });
      this.logger.debug(`Cached structure list for settlement ${settlementId}`);
    } catch (error) {
      // Log cache write error but don't prevent returning results
      this.logger.warn(
        `Cache write error for settlement ${settlementId} structure list`,
        error instanceof Error ? error.message : undefined
      );
    }

    return structures;
  }

  /**
   * Batch loads structures for multiple settlements (DataLoader pattern).
   *
   * @param settlementIds - Array of settlement UUIDs to fetch structures for
   * @param user - Authenticated user making the request
   * @returns Array of structure arrays, one per settlement ID in same order as input
   *
   * @remarks
   * **IMPORTANT:** Performs authorization checks to prevent unauthorized access via DataLoader cache.
   * Returns empty array for settlements the user doesn't have access to.
   * Maintains input order for DataLoader cache key mapping.
   * Used by GraphQL DataLoader to efficiently resolve structures for multiple settlements
   * in a single database query, preventing N+1 query problems.
   *
   * @example
   * ```ts
   * // DataLoader batches these calls:
   * const [structures1, structures2] = await findBySettlementIds(['id1', 'id2'], user);
   * // Instead of two separate queries
   * ```
   */
  async findBySettlementIds(
    settlementIds: readonly string[],
    user: AuthenticatedUser
  ): Promise<PrismaStructure[][]> {
    // First, verify user has access to all requested settlements
    const accessibleSettlements = await this.prisma.settlement.findMany({
      where: {
        id: {
          in: [...settlementIds],
        },
        deletedAt: null,
        kingdom: {
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
      },
      select: { id: true },
    });

    const accessibleIds = new Set(accessibleSettlements.map((s) => s.id));

    // Only fetch structures for settlements user has access to
    const structures = await this.prisma.structure.findMany({
      where: {
        settlementId: {
          in: [...accessibleIds],
        },
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Group structures by settlementId
    const structuresBySettlement = new Map<string, PrismaStructure[]>();
    structures.forEach((structure) => {
      const existing = structuresBySettlement.get(structure.settlementId) || [];
      existing.push(structure);
      structuresBySettlement.set(structure.settlementId, existing);
    });

    // Return in same order as input IDs
    // Return empty array for settlements user doesn't have access to
    return settlementIds.map((id) => {
      if (!accessibleIds.has(id)) {
        return []; // User doesn't have access to this settlement
      }
      return structuresBySettlement.get(id) || [];
    });
  }

  /**
   * Finds structures across multiple settlements in a single query (flat array).
   *
   * @param settlementIds - Array of settlement UUIDs to fetch structures for
   * @param user - Authenticated user making the request
   * @returns Flat array of all structures across all specified settlements, ordered by name
   *
   * @remarks
   * Unlike `findBySettlementIds`, this returns a flat array instead of grouped arrays.
   * Filters to only settlements the user has access to before fetching structures.
   * Efficient batch operation to avoid N+1 queries when structures from multiple settlements
   * are needed but don't need to be grouped by settlement.
   * Returns empty array if no settlement IDs provided or user has no access to any.
   */
  async findBySettlements(
    settlementIds: string[],
    user: AuthenticatedUser
  ): Promise<PrismaStructure[]> {
    if (settlementIds.length === 0) {
      return [];
    }

    // Verify user has access to the settlements
    const accessibleSettlements = await this.prisma.settlement.findMany({
      where: {
        id: { in: settlementIds },
        deletedAt: null,
        kingdom: {
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
      },
      select: { id: true },
    });

    const accessibleSettlementIds = accessibleSettlements.map((s) => s.id);

    if (accessibleSettlementIds.length === 0) {
      return [];
    }

    // Fetch all structures for accessible settlements in a single query
    return this.prisma.structure.findMany({
      where: {
        settlementId: { in: accessibleSettlementIds },
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Creates a new structure in a settlement.
   *
   * @param input - Structure creation data including settlement, type, name, level, and variables
   * @param user - Authenticated user making the request
   * @returns Newly created structure
   *
   * @throws {ForbiddenException} If user lacks OWNER or GM role in campaign
   * @throws {NotFoundException} If settlement not found
   *
   * @remarks
   * Authorization: Only campaign OWNER or GM can create structures.
   * Default level is 1 if not specified.
   * Creates audit log entry for the creation.
   * Publishes WebSocket event for real-time updates.
   * Invalidates structure cache cascade (structure list, computed fields, parent settlement).
   * Cache invalidation errors are logged but don't fail the operation.
   */
  async create(input: CreateStructureInput, user: AuthenticatedUser): Promise<PrismaStructure> {
    // Verify user has access to create structures in this settlement
    const settlement = await this.prisma.settlement.findFirst({
      where: {
        id: input.settlementId,
        deletedAt: null,
        kingdom: {
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
      },
      include: {
        kingdom: {
          include: {
            campaign: true,
          },
        },
      },
    });

    if (!settlement) {
      throw new ForbiddenException(
        'You do not have permission to create structures in this settlement'
      );
    }

    const structure = await this.prisma.structure.create({
      data: {
        settlementId: input.settlementId,
        type: input.type,
        name: input.name,
        level: input.level ?? 1,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        variableSchemas: (input.variableSchemas ?? []) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('structure', structure.id, 'CREATE', user.id, {
      name: structure.name,
      settlementId: structure.settlementId,
      type: structure.type,
      level: structure.level,
    });

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishStructureUpdated(
      createStructureUpdatedEvent(
        structure.id,
        input.settlementId,
        settlement.kingdom.campaign.id,
        'create',
        {
          changedFields: ['name', 'settlementId', 'type', 'level'],
          userId: user.id,
          source: 'api',
        }
      )
    );

    // Invalidate structure cache cascade (structure computed fields, parent settlement, structure list)
    // Cache invalidation failures should not block the operation
    try {
      // TODO: Support branch parameter - currently hardcoded to 'main'
      const branchId = 'main';
      await this.cache.invalidateStructureCascade(structure.id, input.settlementId, branchId);
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.warn(
        `Failed to invalidate structure cascade cache for structure ${structure.id}`,
        error instanceof Error ? error.message : undefined
      );
    }

    return structure;
  }

  /**
   * Updates an existing structure with optimistic locking and version history.
   *
   * @param id - Structure UUID to update
   * @param input - Partial structure data to update (name, type, level, variables, variableSchemas)
   * @param user - Authenticated user making the request
   * @param expectedVersion - Expected version number for optimistic locking
   * @param branchId - Branch ID for version history (must belong to structure's campaign)
   * @param worldTime - World timestamp for version snapshot (defaults to current real time)
   * @returns Updated structure with incremented version
   *
   * @throws {NotFoundException} If structure not found
   * @throws {ForbiddenException} If user lacks OWNER or GM role
   * @throws {OptimisticLockException} If version mismatch detected (concurrent edit)
   * @throws {BadRequestException} If branch doesn't belong to campaign
   *
   * @remarks
   * Uses optimistic locking to prevent lost updates from concurrent edits.
   * Creates version snapshot in transaction for time-travel queries.
   * Increments version number atomically in transaction.
   * Creates audit log with full before/after state tracking.
   * Publishes Redis pubsub event for concurrent edit detection.
   * Publishes WebSocket event for real-time UI updates.
   * Invalidates structure cache cascade and dependency graph.
   * All cache invalidation errors are logged but don't fail the operation.
   */
  async update(
    id: string,
    input: UpdateStructureData,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    worldTime: Date = new Date()
  ): Promise<PrismaStructure> {
    // Verify structure exists and user has access
    const structure = await this.findById(id, user);
    if (!structure) {
      throw new NotFoundException(`Structure with ID ${id} not found`);
    }

    // Get structure with settlement and kingdom to access campaignId
    const structureWithRelations = await this.prisma.structure.findUnique({
      where: { id },
      include: { settlement: { include: { kingdom: { include: { campaign: true } } } } },
    });

    // Verify branchId belongs to this entity's campaign
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        campaignId: structureWithRelations!.settlement.kingdom.campaignId,
        deletedAt: null,
      },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to this entity's campaign`
      );
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this structure');
    }

    // Optimistic locking check: verify version matches
    if (structure.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Structure was modified by another user. Expected version ${expectedVersion}, but found ${structure.version}. Please refresh and try again.`,
        expectedVersion,
        structure.version
      );
    }

    // Build update data with incremented version
    const updateData: Prisma.StructureUpdateInput = {
      version: structure.version + 1,
    };
    const changedFields: string[] = [];
    if (input.name !== undefined) {
      updateData.name = input.name;
      changedFields.push('name');
    }
    if (input.type !== undefined) {
      updateData.type = input.type;
      changedFields.push('type');
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
      ...structure,
      ...updateData,
      version: structure.version + 1,
    };

    // Use transaction to atomically update entity and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update structure with new version
      const updatedStructure = await tx.structure.update({
        where: { id },
        data: updateData,
      });

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'structure',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedStructure;
    });

    // Create audit entry with full state tracking
    // Convert Prisma objects to plain objects for audit
    const previousState = JSON.parse(JSON.stringify(structure)) as Record<string, unknown>;
    const newState = JSON.parse(JSON.stringify(updated)) as Record<string, unknown>;

    await this.audit.log(
      'structure',
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
        entityType: 'structure',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    // Invalidate structure cache cascade (structure computed fields, parent settlement, structure list)
    // Cache invalidation failures should not block the operation
    try {
      await this.cache.invalidateStructureCascade(
        id,
        structureWithRelations!.settlementId,
        branchId
      );
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.warn(
        `Failed to invalidate structure cascade cache for structure ${id}`,
        error instanceof Error ? error.message : undefined
      );
    }

    // Invalidate dependency graph cache to trigger rule re-evaluation
    // Cache invalidation failures should not block the operation
    try {
      this.dependencyGraph.invalidateGraph(
        structureWithRelations!.settlement.kingdom.campaignId,
        branchId
      );
      this.logger.log(
        `Invalidated dependency graph for campaign ${structureWithRelations!.settlement.kingdom.campaignId} ` +
          `due to structure ${id} update`
      );
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.error(`Failed to invalidate dependency graph for structure ${id}:`, error);
    }

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishStructureUpdated(
      createStructureUpdatedEvent(
        id,
        structureWithRelations!.settlementId,
        structureWithRelations!.settlement.kingdom.campaignId,
        'update',
        {
          changedFields,
          userId: user.id,
          source: 'api',
        }
      )
    );

    return updated;
  }

  /**
   * Soft deletes a structure (sets deletedAt timestamp).
   *
   * @param id - Structure UUID to delete
   * @param user - Authenticated user making the request
   * @returns Deleted structure with deletedAt timestamp
   *
   * @throws {NotFoundException} If structure not found
   * @throws {ForbiddenException} If user lacks OWNER or GM role
   *
   * @remarks
   * Performs soft delete only - does NOT cascade to related entities.
   * Structure data is preserved for audit trail and historical queries.
   * Authorization: Only campaign OWNER or GM can delete structures.
   * Creates audit log with full before/after state tracking.
   * Publishes WebSocket event for real-time updates.
   * Invalidates structure cache cascade.
   * Cache invalidation errors are logged but don't fail the operation.
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaStructure> {
    // Verify structure exists and user has access
    const structure = await this.findById(id, user);
    if (!structure) {
      throw new NotFoundException(`Structure with ID ${id} not found`);
    }

    // Get structure with settlement and kingdom to access campaignId
    const structureWithRelations = await this.prisma.structure.findUnique({
      where: { id },
      include: { settlement: { include: { kingdom: { include: { campaign: true } } } } },
    });

    // Verify user has delete permissions
    const hasPermission = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this structure');
    }

    const deletedAt = new Date();

    const deleted = await this.prisma.structure.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry with full state tracking
    // Convert Prisma objects to plain objects for audit
    const previousState = JSON.parse(JSON.stringify(structure)) as Record<string, unknown>;
    const newState = JSON.parse(JSON.stringify(deleted)) as Record<string, unknown>;

    await this.audit.log(
      'structure',
      id,
      'DELETE',
      user.id,
      { deletedAt },
      {}, // metadata
      previousState,
      newState
    );

    // Publish WebSocket event for real-time updates
    this.websocketPublisher.publishStructureUpdated(
      createStructureUpdatedEvent(
        id,
        structureWithRelations!.settlementId,
        structureWithRelations!.settlement.kingdom.campaignId,
        'delete',
        {
          changedFields: ['deletedAt'],
          userId: user.id,
          source: 'api',
        }
      )
    );

    // Invalidate structure cache cascade (structure computed fields, parent settlement, structure list)
    // Cache invalidation failures should not block the operation
    try {
      // TODO: Support branch parameter - currently hardcoded to 'main'
      const branchId = 'main';
      await this.cache.invalidateStructureCascade(id, structure.settlementId, branchId);
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.warn(
        `Failed to invalidate structure cascade cache for structure ${id}`,
        error instanceof Error ? error.message : undefined
      );
    }

    return deleted;
  }

  /**
   * Archives a structure (sets archivedAt timestamp).
   *
   * @param id - Structure UUID to archive
   * @param user - Authenticated user making the request
   * @returns Archived structure with archivedAt timestamp
   *
   * @throws {NotFoundException} If structure not found
   * @throws {ForbiddenException} If user lacks OWNER or GM role
   *
   * @remarks
   * Archives inactive structures without deleting them.
   * Archived structures can be restored via `restore()` method.
   * Authorization: Only campaign OWNER or GM can archive structures.
   * Creates audit log entry for the archive operation.
   * Invalidates structure cache cascade.
   * Cache invalidation errors are logged but don't fail the operation.
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaStructure> {
    // Verify structure exists and user has access
    const structure = await this.findById(id, user);
    if (!structure) {
      throw new NotFoundException(`Structure with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this structure');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.structure.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('structure', id, 'ARCHIVE', user.id, { archivedAt });

    // Invalidate structure cache cascade (structure computed fields, parent settlement, structure list)
    // Cache invalidation failures should not block the operation
    try {
      // TODO: Support branch parameter - currently hardcoded to 'main'
      const branchId = 'main';
      await this.cache.invalidateStructureCascade(id, structure.settlementId, branchId);
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.warn(
        `Failed to invalidate structure cascade cache for structure ${id}`,
        error instanceof Error ? error.message : undefined
      );
    }

    return archived;
  }

  /**
   * Restores an archived structure (clears archivedAt timestamp).
   *
   * @param id - Structure UUID to restore
   * @param user - Authenticated user making the request
   * @returns Restored structure with archivedAt set to null
   *
   * @throws {NotFoundException} If structure not found
   * @throws {ForbiddenException} If user lacks OWNER or GM role
   *
   * @remarks
   * Restores previously archived structures to active status.
   * Authorization: Only campaign OWNER or GM can restore structures.
   * Creates audit log entry for the restore operation.
   * Does NOT invalidate cache (structure remains queryable).
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaStructure> {
    // Find structure even if archived
    const structure = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!structure) {
      throw new NotFoundException(`Structure with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this structure');
    }

    const restored = await this.prisma.structure.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('structure', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Sets the level of a structure with validation and cache invalidation.
   *
   * @param id - Structure UUID to update
   * @param level - New level value (1-20)
   * @param user - Authenticated user making the request
   * @returns Updated structure with new level
   *
   * @throws {NotFoundException} If structure not found
   * @throws {ForbiddenException} If user lacks OWNER or GM role
   * @throws {BadRequestException} If level outside valid range (1-20)
   *
   * @remarks
   * Validates level is within 1-20 range before processing.
   * Authorization: Only campaign OWNER or GM can set level.
   * Creates audit log entry for level change.
   * Publishes Redis pubsub event for concurrent edit detection.
   * Invalidates structure cache cascade, campaign context, and dependency graph.
   * Dependency graph invalidation triggers rule re-evaluation for computed fields.
   * All cache invalidation errors are logged but don't fail the operation.
   */
  async setLevel(id: string, level: number, user: AuthenticatedUser): Promise<PrismaStructure> {
    // Validate level range before processing
    LevelValidator.validateLevel(level, 'structure');

    const structure = await this.findById(id, user);
    if (!structure) {
      throw new NotFoundException(`Structure with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to set level for this structure');
    }

    const updated = await this.prisma.structure.update({
      where: { id },
      data: { level },
    });

    // Create audit entry
    await this.audit.log('structure', id, 'UPDATE', user.id, { level });

    // Publish entityModified event for level change
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'structure',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    // Get campaign ID for context invalidation
    const structureWithRelations = await this.prisma.structure.findUnique({
      where: { id },
      include: { settlement: { include: { kingdom: true } } },
    });

    // Invalidate structure cache cascade (structure computed fields, parent settlement, structure list)
    // Cache invalidation failures should not block the operation
    try {
      // TODO: Support branch parameter - currently hardcoded to 'main'
      const branchId = 'main';
      await this.cache.invalidateStructureCascade(
        id,
        structureWithRelations!.settlementId,
        branchId
      );
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.warn(
        `Failed to invalidate structure cascade cache for structure ${id}`,
        error instanceof Error ? error.message : undefined
      );
    }

    // Invalidate campaign context cache to reflect level change
    // Cache invalidation failures should not block the operation - cache will expire via TTL
    try {
      await this.campaignContext.invalidateContextForEntity(
        'structure',
        id,
        structureWithRelations!.settlement.kingdom.campaignId
      );
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      console.error(`Failed to invalidate campaign context for structure ${id}:`, error);
    }

    // Invalidate dependency graph cache to trigger rule re-evaluation
    // Cache invalidation failures should not block the operation
    try {
      this.dependencyGraph.invalidateGraph(structureWithRelations!.settlement.kingdom.campaignId);
      this.logger.log(
        `Invalidated dependency graph for campaign ${structureWithRelations!.settlement.kingdom.campaignId} ` +
          `due to structure ${id} level change`
      );
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      this.logger.error(`Failed to invalidate dependency graph for structure ${id}:`, error);
    }

    return updated;
  }

  /**
   * Retrieves historical structure state at a specific point in world-time.
   *
   * @param id - Structure UUID to query
   * @param branchId - Branch ID for version history
   * @param worldTime - World timestamp to query state at
   * @param user - Authenticated user making the request
   * @returns Structure state as of the specified time, or null if not found
   *
   * @remarks
   * Supports time-travel queries by resolving version history.
   * Verifies user has access to the structure before querying versions.
   * Decompresses version payload to reconstruct historical state.
   * Useful for viewing how structures changed over campaign time.
   * Returns null if no version exists at the specified time.
   *
   * @see {@link docs/features/world-time-system.md} for time-travel query details
   */
  async getStructureAsOf(
    id: string,
    branchId: string,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<PrismaStructure | null> {
    // Verify user has access to the structure
    const structure = await this.findById(id, user);
    if (!structure) {
      return null;
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion('structure', id, branchId, worldTime);

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as a Structure object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaStructure;
  }

  /**
   * Evaluates computed fields for a structure using active conditions.
   *
   * @param structure - Structure to evaluate computed fields for
   * @param _user - Authenticated user (authorization assumed by caller)
   * @returns Map of field names to computed values
   *
   * @remarks
   * **Authorization:** Assumes caller (GraphQL resolver) has already verified access.
   *
   * **Performance Strategy:**
   * 1. Checks Redis cache first (5-minute TTL)
   * 2. Attempts evaluation via Rules Engine worker (high-performance gRPC)
   * 3. Falls back to local evaluation if worker unavailable
   *
   * **Evaluation Process:**
   * - Fetches all active conditions for the structure
   * - Builds context with structure data and state variables
   * - Evaluates conditions in priority order (DESC - highest first)
   * - For each field, only the highest priority condition is used
   * - Returns successfully evaluated conditions only
   *
   * **Cache Strategy:**
   * - Cache key: `computed-fields:structure:{id}:{branchId}`
   * - TTL: 300 seconds (5 minutes)
   * - Empty results cached to avoid repeated condition queries
   * - Invalidated on structure updates, level changes, or variable changes
   *
   * **Error Handling:**
   * - Cache errors logged but don't block computation
   * - Worker errors trigger fallback to local evaluation
   * - Evaluation errors return empty object gracefully
   *
   * **Performance TODOs:**
   * - Implement DataLoader pattern to batch multiple structure evaluations
   * - Parallelize condition evaluation with Promise.all
   * - Consider type-level conditions (entityId: null) for all structures of a type
   *
   * @see {@link docs/features/condition-system.md} for condition evaluation details
   * @see {@link docs/features/rules-engine-worker.md} for worker architecture
   */
  async getComputedFields(
    structure: PrismaStructure,
    _user: AuthenticatedUser
  ): Promise<Record<string, unknown>> {
    try {
      // Check cache first
      const branchId = 'main'; // TODO: Support branch parameter
      const cacheKey = `computed-fields:structure:${structure.id}:${branchId}`;

      try {
        const cached = await this.cache.get<Record<string, unknown>>(cacheKey);
        if (cached !== null) {
          this.logger.debug(`Cache hit for structure ${structure.id} computed fields`);
          return cached;
        }
        this.logger.debug(`Cache miss for structure ${structure.id} computed fields`);
      } catch (error) {
        // Log cache read error but continue with computation
        this.logger.warn(
          `Cache read error for structure ${structure.id}`,
          error instanceof Error ? error.message : undefined
        );
      }

      // Fetch all active conditions for this structure
      // NOTE: This creates an N+1 query problem when called for multiple structures
      // Should be optimized with DataLoader in future iteration
      const conditions = await this.prisma.fieldCondition.findMany({
        where: {
          entityType: 'structure',
          entityId: structure.id,
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
          this.logger.debug(`Cached empty computed fields for structure ${structure.id}`);
        } catch (error) {
          // Log cache write error but don't prevent returning results
          this.logger.warn(
            `Cache write error for structure ${structure.id}`,
            error instanceof Error ? error.message : undefined
          );
        }
        return emptyResult;
      }

      // Get campaign ID for Rules Engine worker request
      const structureWithRelations = await this.prisma.structure.findUnique({
        where: { id: structure.id },
        include: { settlement: { include: { kingdom: true } } },
      });

      const campaignId = structureWithRelations?.settlement.kingdom.campaignId;

      // Try to use Rules Engine worker if available
      if (campaignId) {
        try {
          const isAvailable = await this.rulesEngineClient.isAvailable();

          if (isAvailable) {
            // Build context from structure data with StateVariable integration
            const entityData = {
              structure: {
                id: structure.id,
                name: structure.name,
                type: structure.type,
                level: structure.level,
                settlementId: structure.settlementId,
                variables: structure.variables,
                version: structure.version,
                createdAt: structure.createdAt,
                updatedAt: structure.updatedAt,
              },
            };

            const context = await this.conditionEvaluation.buildContextWithVariables(entityData, {
              includeVariables: true,
              scope: 'structure',
              scopeId: structure.id,
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
              `Evaluated ${conditions.length} conditions for structure ${structure.id} via Rules Engine worker`
            );

            // Store in cache for future requests
            try {
              await this.cache.set(cacheKey, computedFields, { ttl: 300 });
              this.logger.debug(`Cached computed fields for structure ${structure.id}`);
            } catch (error) {
              // Log cache write error but don't prevent returning results
              this.logger.warn(
                `Cache write error for structure ${structure.id}`,
                error instanceof Error ? error.message : undefined
              );
            }

            return computedFields;
          }
        } catch (error) {
          // Log worker error and fall through to local evaluation
          this.logger.warn(
            `Rules Engine worker unavailable for structure ${structure.id}, falling back to local evaluation`,
            error instanceof Error ? error.message : undefined
          );
        }
      }

      // Fallback: Local evaluation
      this.logger.debug(`Using local evaluation for structure ${structure.id} computed fields`);

      // Build context from structure data with StateVariable integration
      const entityData = {
        structure: {
          id: structure.id,
          name: structure.name,
          type: structure.type,
          level: structure.level,
          settlementId: structure.settlementId,
          variables: structure.variables,
          version: structure.version,
          createdAt: structure.createdAt,
          updatedAt: structure.updatedAt,
        },
      };

      // Build context with variables included
      const context = await this.conditionEvaluation.buildContextWithVariables(entityData, {
        includeVariables: true,
        scope: 'structure',
        scopeId: structure.id,
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

      // Store in cache for future requests
      try {
        await this.cache.set(cacheKey, computedFields, { ttl: 300 });
        this.logger.debug(`Cached computed fields for structure ${structure.id}`);
      } catch (error) {
        // Log cache write error but don't prevent returning results
        this.logger.warn(
          `Cache write error for structure ${structure.id}`,
          error instanceof Error ? error.message : undefined
        );
      }

      return computedFields;
    } catch (error) {
      // Log error but don't throw - gracefully return empty object
      this.logger.error(
        `Failed to compute fields for structure ${structure.id}`,
        error instanceof Error ? error.stack : undefined
      );
      return {};
    }
  }
}
