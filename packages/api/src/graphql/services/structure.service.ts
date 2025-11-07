/**
 * Structure Service
 * Business logic for Structure operations
 * Implements CRUD with soft delete and archive (no cascade delete)
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
   * Find structure by ID
   * Ensures user has access to the settlement's campaign
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
   * Find structures by settlement
   */
  async findBySettlement(
    settlementId: string,
    user: AuthenticatedUser
  ): Promise<PrismaStructure[]> {
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

    return this.prisma.structure.findMany({
      where: {
        settlementId,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find structures by settlement IDs (for DataLoader)
   * IMPORTANT: This method performs authorization checks to prevent
   * unauthorized access through the DataLoader cache
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
   * Find structures by multiple settlement IDs (batch operation to avoid N+1 queries)
   * Returns a flat array of all structures across all settlements
   * @param settlementIds Array of settlement IDs to fetch structures for
   * @param user Authenticated user (must have access to the campaign)
   * @returns Flat array of all structures across all specified settlements
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
   * Create a new structure
   * Only owner or GM can create structures
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

    return structure;
  }

  /**
   * Update a structure with optimistic locking and versioning
   * Only owner or GM can update
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
   * Soft delete a structure
   * Does NOT cascade - structures are kept for audit trail
   * Only owner or GM can delete
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

    return deleted;
  }

  /**
   * Archive a structure
   * Only owner or GM can archive
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

    return archived;
  }

  /**
   * Restore an archived structure
   * Only owner or GM can restore
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
   * Set structure level
   * Only owner or GM can set level
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
   * Get structure state as it existed at a specific point in world-time
   * Supports time-travel queries for version history
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
   * Get computed fields for a structure by evaluating all active conditions
   * Returns a map of field names to their computed values
   *
   * NOTE: Authorization is assumed to be performed by the caller (GraphQL resolver)
   *
   * TODO (Performance): Implement DataLoader pattern to avoid N+1 queries when
   * resolving computed fields for multiple structures in a batch.
   *
   * TODO (Performance): Evaluate conditions in parallel using Promise.all
   * instead of sequential await in loop.
   *
   * TODO (Feature): Consider supporting type-level conditions (entityId: null)
   * that apply to all structures of this type.
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

      // If no conditions, return empty object
      if (conditions.length === 0) {
        return {};
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
              await this.cache.set(cacheKey, computedFields, 300);
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
        await this.cache.set(cacheKey, computedFields, 300);
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
