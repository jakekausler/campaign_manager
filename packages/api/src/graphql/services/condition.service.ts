/**
 * @fileoverview Condition Service
 *
 * Manages field condition CRUD operations, JSONLogic expression validation, and computed field evaluation.
 * Handles both type-level conditions (applying to all entities of a type) and instance-level conditions
 * (applying to specific entity instances). Integrates with cache invalidation, dependency tracking, and
 * real-time updates via Redis pub/sub.
 *
 * Key responsibilities:
 * - Field condition lifecycle (create, read, update, delete)
 * - JSONLogic expression validation and evaluation
 * - Entity access authorization and campaign membership verification
 * - Cache invalidation for dependency graphs and computed fields
 * - Real-time event publishing for Rules Engine worker synchronization
 *
 * @module graphql/services
 */

import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import type { FieldCondition as PrismaFieldCondition, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type {
  CreateFieldConditionInput,
  UpdateFieldConditionInput,
  FieldConditionWhereInput,
  FieldConditionOrderByInput,
  FieldConditionSortField,
} from '../inputs/field-condition.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import type { EvaluationResult } from '../types/field-condition.type';

import { AuditService } from './audit.service';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { DependencyGraphService } from './dependency-graph.service';

/**
 * Service for managing field conditions and computed field evaluation.
 *
 * Handles CRUD operations for field conditions with JSONLogic expressions. Supports both type-level
 * conditions (entityId = null, applies to all entities) and instance-level conditions (specific entityId).
 *
 * Features:
 * - JSONLogic expression validation using ConditionEvaluationService
 * - Entity access authorization (campaign membership checks)
 * - Optimistic locking for concurrent update protection (version field)
 * - Audit logging for all CRUD operations
 * - Cache invalidation for dependency graphs and computed fields
 * - Redis pub/sub events for Rules Engine worker synchronization
 *
 * @example
 * // Create type-level condition for all Kingdoms
 * const condition = await conditionService.create({
 *   entityType: 'KINGDOM',
 *   entityId: null,
 *   field: 'isProsperous',
 *   expression: { 'and': [{ '>': [{ 'var': 'treasury' }, 10000] }, { '==': [{ 'var': 'stability' }, 'HIGH'] }] },
 *   priority: 10
 * }, user);
 *
 * @example
 * // Create instance-level condition for specific Kingdom
 * const condition = await conditionService.create({
 *   entityType: 'KINGDOM',
 *   entityId: 'kingdom-123',
 *   field: 'hasSpecialEvent',
 *   expression: { '==': [{ 'var': 'location' }, 'Waterdeep'] },
 *   priority: 5
 * }, user);
 */
@Injectable()
export class ConditionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly evaluationService: ConditionEvaluationService,
    private readonly dependencyGraphService: DependencyGraphService,
    private readonly cacheService: CacheService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Creates a new field condition with JSONLogic expression.
   *
   * Validates the JSONLogic expression structure before creation. For instance-level conditions
   * (when entityId is provided), verifies the user has access to the entity through campaign
   * membership. After creation, invalidates dependency graph cache and publishes Redis event
   * for Rules Engine worker synchronization.
   *
   * Type-level conditions (entityId = null) apply to all entities of the specified type.
   * Instance-level conditions (entityId provided) apply only to that specific entity.
   *
   * @param input - Condition creation parameters including entity type, optional entity ID, field name,
   *                JSONLogic expression, optional description, and optional priority (defaults to 0)
   * @param user - Authenticated user creating the condition (must have campaign access for instance-level)
   * @param branchId - Branch ID for cache invalidation (defaults to 'main')
   * @returns Promise resolving to the created field condition
   * @throws {BadRequestException} If JSONLogic expression validation fails
   * @throws {NotFoundException} If entity does not exist or user lacks access (for instance-level conditions)
   *
   * @example
   * // Type-level condition: Kingdoms are prosperous if treasury > 10000
   * const condition = await create({
   *   entityType: 'KINGDOM',
   *   entityId: null,
   *   field: 'isProsperous',
   *   expression: { '>': [{ 'var': 'treasury' }, 10000] },
   *   description: 'Kingdom has sufficient treasury',
   *   priority: 10
   * }, user, 'main');
   */
  async create(
    input: CreateFieldConditionInput,
    user: AuthenticatedUser,
    branchId: string = 'main'
  ): Promise<PrismaFieldCondition> {
    // Validate expression before creating
    const validationResult = this.evaluationService.validateExpression(
      input.expression as Prisma.JsonValue
    );
    if (!validationResult.isValid) {
      throw new BadRequestException(`Invalid expression: ${validationResult.errors.join(', ')}`);
    }

    // For instance-level conditions, verify entity exists and user has access
    if (input.entityId) {
      await this.verifyEntityAccess(input.entityType, input.entityId, user);
    }

    // Create the condition
    const condition = await this.prisma.fieldCondition.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        field: input.field,
        expression: input.expression as Prisma.InputJsonValue,
        description: input.description,
        priority: input.priority ?? 0,
        createdBy: user.id,
      },
    });

    // Create audit entry
    await this.audit.log('field_condition', condition.id, 'CREATE', user.id, {
      entityType: condition.entityType,
      entityId: condition.entityId,
      field: condition.field,
      priority: condition.priority,
    });

    // Invalidate dependency graph cache for this condition's campaign
    const campaignId = await this.getCampaignIdForCondition(condition);
    if (campaignId) {
      this.dependencyGraphService.invalidateGraph(campaignId);

      // Invalidate all computed fields in campaign (FieldCondition changes affect all entities)
      await this.cacheService.invalidateCampaignComputedFields(campaignId, branchId);

      // Publish Redis event for Rules Engine worker
      await this.pubSub.publish('condition.created', {
        conditionId: condition.id,
        campaignId,
        branchId,
      });
    }

    return condition;
  }

  /**
   * Finds a field condition by ID with access control.
   *
   * Retrieves a single field condition, excluding soft-deleted records. For instance-level conditions,
   * verifies the user has campaign access to the entity. Returns null if the condition doesn't exist,
   * is deleted, or user lacks access.
   *
   * @param id - Unique identifier of the field condition
   * @param user - Authenticated user requesting the condition
   * @returns Promise resolving to the condition if found and accessible, null otherwise
   *
   * @example
   * const condition = await findById('cond-123', user);
   * if (condition) {
   *   console.log(`Found condition for ${condition.entityType}.${condition.field}`);
   * }
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaFieldCondition | null> {
    const condition = await this.prisma.fieldCondition.findUnique({
      where: {
        id,
      },
    });

    if (!condition || condition.deletedAt) {
      return null;
    }

    // Verify user has access to the entity
    if (condition.entityId) {
      try {
        await this.verifyEntityAccess(condition.entityType, condition.entityId, user);
      } catch {
        return null; // User doesn't have access
      }
    }

    return condition;
  }

  /**
   * Finds multiple field conditions with filtering, sorting, and pagination.
   *
   * Supports flexible querying with optional filters for entity type, entity ID, field name,
   * active status, creator, and date ranges. Results are sorted by priority (descending) by default.
   * When a user is provided, filters results to only conditions the user can access through
   * campaign membership. Type-level conditions are accessible to all authenticated users.
   *
   * @param where - Optional filter criteria (entityType, entityId, field, isActive, createdBy, date ranges, includeDeleted)
   * @param orderBy - Optional sort configuration (field and order direction, defaults to priority DESC)
   * @param skip - Optional number of records to skip for pagination
   * @param take - Optional maximum number of records to return
   * @param user - Optional authenticated user for access filtering (omit for admin queries)
   * @returns Promise resolving to array of matching field conditions
   *
   * @example
   * // Find active conditions for Kingdom entity type
   * const conditions = await findMany({
   *   entityType: 'KINGDOM',
   *   isActive: true
   * }, { field: 'PRIORITY', order: 'DESC' }, 0, 10, user);
   */
  async findMany(
    where?: FieldConditionWhereInput,
    orderBy?: FieldConditionOrderByInput,
    skip?: number,
    take?: number,
    user?: AuthenticatedUser
  ): Promise<PrismaFieldCondition[]> {
    // Build Prisma where clause
    const prismaWhere: Prisma.FieldConditionWhereInput = where
      ? {
          entityType: where.entityType,
          entityId: where.entityId,
          field: where.field,
          isActive: where.isActive,
          createdBy: where.createdBy,
          deletedAt: where.includeDeleted ? undefined : null,
        }
      : {
          deletedAt: null,
        };

    // Add date range filters
    if (where?.createdAfter || where?.createdBefore) {
      prismaWhere.createdAt = {};
      if (where.createdAfter) {
        prismaWhere.createdAt.gte = where.createdAfter;
      }
      if (where.createdBefore) {
        prismaWhere.createdAt.lte = where.createdBefore;
      }
    }

    // Build order by clause
    const prismaOrderBy = orderBy ? this.buildOrderBy(orderBy) : { priority: 'desc' as const };

    // Query conditions
    const conditions = await this.prisma.fieldCondition.findMany({
      where: prismaWhere,
      orderBy: prismaOrderBy,
      skip,
      take,
    });

    // Filter by entity access if user provided
    if (user) {
      const accessibleConditions: PrismaFieldCondition[] = [];
      for (const condition of conditions) {
        if (condition.entityId) {
          try {
            await this.verifyEntityAccess(condition.entityType, condition.entityId, user);
            accessibleConditions.push(condition);
          } catch {
            // Skip conditions user doesn't have access to
          }
        } else {
          // Type-level conditions are accessible to all authenticated users
          accessibleConditions.push(condition);
        }
      }
      return accessibleConditions;
    }

    return conditions;
  }

  /**
   * Finds active conditions for a specific entity type and optional field.
   *
   * Retrieves all active, non-deleted conditions matching the entity type and optional entity ID.
   * If field is specified, filters to conditions for that field only. Results are sorted by
   * priority in descending order (higher priority first). For instance-level queries, verifies
   * user has campaign access to the entity.
   *
   * Used by the Rules Engine to fetch applicable conditions when evaluating computed fields.
   *
   * @param entityType - Entity type (e.g., 'KINGDOM', 'SETTLEMENT', 'CHARACTER')
   * @param entityId - Optional entity ID for instance-level conditions, null for type-level
   * @param field - Optional field name to filter conditions (null/undefined returns all fields)
   * @param user - Authenticated user (access verified for instance-level conditions)
   * @returns Promise resolving to array of conditions sorted by priority descending
   * @throws {NotFoundException} If entity does not exist or user lacks access (when entityId provided)
   *
   * @example
   * // Get all conditions for a specific Kingdom's 'isProsperous' field
   * const conditions = await findForEntity('KINGDOM', 'kingdom-123', 'isProsperous', user);
   *
   * @example
   * // Get all type-level conditions for Kingdoms
   * const typeConditions = await findForEntity('KINGDOM', null, null, user);
   */
  async findForEntity(
    entityType: string,
    entityId: string | null,
    field: string | null | undefined,
    user: AuthenticatedUser
  ): Promise<PrismaFieldCondition[]> {
    // Verify entity access if instance-level
    if (entityId) {
      await this.verifyEntityAccess(entityType, entityId, user);
    }

    // Build where clause
    const where: Prisma.FieldConditionWhereInput = {
      entityType,
      entityId: entityId ?? null,
      isActive: true,
      deletedAt: null,
    };

    if (field) {
      where.field = field;
    }

    return this.prisma.fieldCondition.findMany({
      where,
      orderBy: {
        priority: 'desc',
      },
    });
  }

  /**
   * Updates an existing field condition with optimistic locking.
   *
   * Supports partial updates to expression, description, isActive status, and priority.
   * Uses version-based optimistic locking to prevent concurrent update conflicts. Validates
   * JSONLogic expression if changed. After update, invalidates caches and publishes Redis
   * event for Rules Engine synchronization.
   *
   * The version field is automatically incremented on each update. Clients must provide the
   * expected version in the input to ensure they're updating the latest version.
   *
   * @param id - Unique identifier of the condition to update
   * @param input - Update data with expectedVersion for optimistic locking and optional fields to update
   * @param user - Authenticated user performing the update (must have campaign access)
   * @param branchId - Branch ID for cache invalidation (defaults to 'main')
   * @returns Promise resolving to the updated field condition with incremented version
   * @throws {NotFoundException} If condition does not exist or user lacks access
   * @throws {OptimisticLockException} If expectedVersion doesn't match current version (concurrent modification)
   * @throws {BadRequestException} If updated expression fails JSONLogic validation
   *
   * @example
   * // Update condition priority and status
   * const updated = await update('cond-123', {
   *   expectedVersion: 5,
   *   priority: 20,
   *   isActive: false
   * }, user, 'main');
   * console.log(`Version incremented to ${updated.version}`);
   */
  async update(
    id: string,
    input: UpdateFieldConditionInput,
    user: AuthenticatedUser,
    branchId: string = 'main'
  ): Promise<PrismaFieldCondition> {
    // Fetch existing condition
    const condition = await this.findById(id, user);
    if (!condition) {
      throw new NotFoundException(`FieldCondition with ID ${id} not found`);
    }

    // Optimistic locking check
    if (condition.version !== input.expectedVersion) {
      throw new OptimisticLockException(
        `FieldCondition was modified by another user. Expected version ${input.expectedVersion}, but found ${condition.version}. Please refresh and try again.`,
        input.expectedVersion,
        condition.version
      );
    }

    // Validate expression if changed
    if (input.expression) {
      const validationResult = this.evaluationService.validateExpression(
        input.expression as Prisma.JsonValue
      );
      if (!validationResult.isValid) {
        throw new BadRequestException(`Invalid expression: ${validationResult.errors.join(', ')}`);
      }
    }

    // Build update data
    const updateData: Prisma.FieldConditionUpdateInput = {
      version: condition.version + 1,
      updater: {
        connect: { id: user.id },
      },
    };

    if (input.expression !== undefined) {
      updateData.expression = input.expression as Prisma.InputJsonValue;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }
    if (input.priority !== undefined) {
      updateData.priority = input.priority;
    }

    // Update condition
    const updated = await this.prisma.fieldCondition.update({
      where: { id },
      data: updateData,
    });

    // Create audit entry
    await this.audit.log('field_condition', id, 'UPDATE', user.id, updateData);

    // Invalidate dependency graph cache for this condition's campaign
    const campaignId = await this.getCampaignIdForCondition(updated);
    if (campaignId) {
      this.dependencyGraphService.invalidateGraph(campaignId);

      // Invalidate all computed fields in campaign (FieldCondition changes affect all entities)
      await this.cacheService.invalidateCampaignComputedFields(campaignId, branchId);

      // Publish Redis event for Rules Engine worker
      await this.pubSub.publish('condition.updated', {
        conditionId: updated.id,
        campaignId,
        branchId,
      });
    }

    return updated;
  }

  /**
   * Soft deletes a field condition by setting deletedAt timestamp.
   *
   * Marks the condition as deleted without removing it from the database, preserving audit history.
   * Deleted conditions are excluded from queries by default. After deletion, invalidates caches
   * and publishes Redis event for Rules Engine synchronization.
   *
   * @param id - Unique identifier of the condition to delete
   * @param user - Authenticated user performing the deletion (must have campaign access)
   * @param branchId - Branch ID for cache invalidation (defaults to 'main')
   * @returns Promise resolving to the soft-deleted field condition with deletedAt timestamp
   * @throws {NotFoundException} If condition does not exist or user lacks access
   *
   * @example
   * const deleted = await delete('cond-123', user, 'main');
   * console.log(`Condition deleted at ${deleted.deletedAt}`);
   */
  async delete(
    id: string,
    user: AuthenticatedUser,
    branchId: string = 'main'
  ): Promise<PrismaFieldCondition> {
    // Verify condition exists and user has access
    const condition = await this.findById(id, user);
    if (!condition) {
      throw new NotFoundException(`FieldCondition with ID ${id} not found`);
    }

    const deletedAt = new Date();

    // Soft delete
    const deleted = await this.prisma.fieldCondition.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('field_condition', id, 'DELETE', user.id, { deletedAt });

    // Invalidate dependency graph cache for this condition's campaign
    const campaignId = await this.getCampaignIdForCondition(deleted);
    if (campaignId) {
      this.dependencyGraphService.invalidateGraph(campaignId);

      // Invalidate all computed fields in campaign (FieldCondition changes affect all entities)
      await this.cacheService.invalidateCampaignComputedFields(campaignId, branchId);

      // Publish Redis event for Rules Engine worker
      await this.pubSub.publish('condition.deleted', {
        conditionId: deleted.id,
        campaignId,
        branchId,
      });
    }

    return deleted;
  }

  /**
   * Toggles the active status of a field condition.
   *
   * Enables or disables a condition without deleting it. Inactive conditions (isActive = false)
   * are excluded from evaluation by the Rules Engine but remain in the database for potential
   * re-activation. Creates an audit log entry for the status change.
   *
   * @param id - Unique identifier of the condition to toggle
   * @param isActive - New active status (true to activate, false to deactivate)
   * @param user - Authenticated user performing the toggle (must have campaign access)
   * @returns Promise resolving to the updated field condition with new isActive status
   * @throws {NotFoundException} If condition does not exist or user lacks access
   *
   * @example
   * // Temporarily disable a condition
   * const deactivated = await toggleActive('cond-123', false, user);
   *
   * @example
   * // Re-enable a previously disabled condition
   * const activated = await toggleActive('cond-123', true, user);
   */
  async toggleActive(
    id: string,
    isActive: boolean,
    user: AuthenticatedUser
  ): Promise<PrismaFieldCondition> {
    // Verify condition exists and user has access
    const condition = await this.findById(id, user);
    if (!condition) {
      throw new NotFoundException(`FieldCondition with ID ${id} not found`);
    }

    // Update active status
    const updated = await this.prisma.fieldCondition.update({
      where: { id },
      data: { isActive },
    });

    // Create audit entry
    await this.audit.log('field_condition', id, 'UPDATE', user.id, { isActive });

    return updated;
  }

  /**
   * Evaluates a field condition with provided context data.
   *
   * Executes the condition's JSONLogic expression against the provided context object.
   * Returns both the evaluation result and a detailed execution trace for debugging.
   * Useful for testing conditions or understanding why a computed field has a particular value.
   *
   * @param id - Unique identifier of the condition to evaluate
   * @param context - Context object containing variables referenced in the JSONLogic expression
   * @param user - Authenticated user performing the evaluation (must have campaign access)
   * @returns Promise resolving to evaluation result with value and execution trace
   * @throws {NotFoundException} If condition does not exist or user lacks access
   *
   * @example
   * // Evaluate a Kingdom prosperity condition
   * const result = await evaluateCondition('cond-123', {
   *   treasury: 15000,
   *   stability: 'HIGH',
   *   population: 50000
   * }, user);
   * console.log(`Result: ${result.value}, Trace: ${JSON.stringify(result.trace)}`);
   */
  async evaluateCondition(
    id: string,
    context: Record<string, unknown>,
    user: AuthenticatedUser
  ): Promise<EvaluationResult> {
    // Fetch condition
    const condition = await this.findById(id, user);
    if (!condition) {
      throw new NotFoundException(`FieldCondition with ID ${id} not found`);
    }

    // Evaluate with trace
    return this.evaluationService.evaluateWithTrace(
      condition.expression as Prisma.JsonValue,
      context
    );
  }

  /**
   * Gets the campaign ID for a field condition to enable cache invalidation.
   *
   * Determines which campaign a condition belongs to by traversing entity relationships.
   * Type-level conditions (entityId = null) don't belong to a specific campaign and return null.
   * Instance-level conditions are traced through their entity hierarchy to find the campaign.
   *
   * Supported entity types: SETTLEMENT, STRUCTURE, KINGDOM, PARTY, CHARACTER
   *
   * @param condition - Field condition to determine campaign ID for
   * @returns Promise resolving to campaign ID if found, null for type-level conditions or unsupported types
   *
   * @private
   */
  private async getCampaignIdForCondition(condition: PrismaFieldCondition): Promise<string | null> {
    // Type-level conditions (no entityId) don't belong to a specific campaign
    if (!condition.entityId) {
      return null;
    }

    const entityTypeLower = condition.entityType.toLowerCase();
    const entityId = condition.entityId;

    switch (entityTypeLower) {
      case 'settlement': {
        const settlement = await this.prisma.settlement.findUnique({
          where: { id: entityId },
          select: { kingdom: { select: { campaignId: true } } },
        });
        return settlement?.kingdom.campaignId ?? null;
      }

      case 'structure': {
        const structure = await this.prisma.structure.findUnique({
          where: { id: entityId },
          select: { settlement: { select: { kingdom: { select: { campaignId: true } } } } },
        });
        return structure?.settlement.kingdom.campaignId ?? null;
      }

      case 'kingdom': {
        const kingdom = await this.prisma.kingdom.findUnique({
          where: { id: entityId },
          select: { campaignId: true },
        });
        return kingdom?.campaignId ?? null;
      }

      case 'party': {
        const party = await this.prisma.party.findUnique({
          where: { id: entityId },
          select: { campaignId: true },
        });
        return party?.campaignId ?? null;
      }

      case 'character': {
        const character = await this.prisma.character.findUnique({
          where: { id: entityId },
          select: { campaignId: true },
        });
        return character?.campaignId ?? null;
      }

      default:
        return null;
    }
  }

  /**
   * Verifies user has access to an entity through campaign membership.
   *
   * Checks that the entity exists, is not soft-deleted, and the user is either the campaign owner
   * or a campaign member. Access is determined by traversing the entity hierarchy to find the
   * related campaign and checking user membership.
   *
   * Supported entity types: SETTLEMENT, STRUCTURE, KINGDOM, PARTY, CHARACTER
   *
   * @param entityType - Type of entity to verify access for (case-insensitive)
   * @param entityId - Unique identifier of the entity
   * @param user - Authenticated user to verify access for
   * @returns Promise resolving when access is verified (void)
   * @throws {NotFoundException} If entity doesn't exist, is deleted, or user lacks campaign access
   * @throws {BadRequestException} If entity type is not supported
   *
   * @private
   */
  private async verifyEntityAccess(
    entityType: string,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<void> {
    const entityTypeLower = entityType.toLowerCase();

    switch (entityTypeLower) {
      case 'settlement': {
        const settlement = await this.prisma.settlement.findFirst({
          where: {
            id: entityId,
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

        if (!settlement) {
          throw new NotFoundException(`Settlement with ID ${entityId} not found or access denied`);
        }
        break;
      }

      case 'structure': {
        const structure = await this.prisma.structure.findFirst({
          where: {
            id: entityId,
            deletedAt: null,
            settlement: {
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
          },
        });

        if (!structure) {
          throw new NotFoundException(`Structure with ID ${entityId} not found or access denied`);
        }
        break;
      }

      case 'kingdom': {
        const kingdom = await this.prisma.kingdom.findFirst({
          where: {
            id: entityId,
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
          throw new NotFoundException(`Kingdom with ID ${entityId} not found or access denied`);
        }
        break;
      }

      case 'party': {
        const party = await this.prisma.party.findFirst({
          where: {
            id: entityId,
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

        if (!party) {
          throw new NotFoundException(`Party with ID ${entityId} not found or access denied`);
        }
        break;
      }

      case 'character': {
        const character = await this.prisma.character.findFirst({
          where: {
            id: entityId,
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

        if (!character) {
          throw new NotFoundException(`Character with ID ${entityId} not found or access denied`);
        }
        break;
      }

      default:
        throw new BadRequestException(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Builds a Prisma order by clause from GraphQL input.
   *
   * Converts GraphQL enum-based sort field and order direction into Prisma's order by format.
   * Defaults to priority descending if no order is specified.
   *
   * Supported sort fields: ENTITY_TYPE, FIELD, PRIORITY, CREATED_AT, UPDATED_AT
   *
   * @param orderBy - GraphQL order by input with field and order direction
   * @returns Prisma order by configuration object
   *
   * @private
   */
  private buildOrderBy(
    orderBy: FieldConditionOrderByInput
  ): Prisma.FieldConditionOrderByWithRelationInput {
    const sortField = orderBy.field ?? 'PRIORITY';
    const sortOrder = (orderBy.order ?? 'DESC').toLowerCase() as 'asc' | 'desc';

    const fieldMap: Record<FieldConditionSortField, string> = {
      ENTITY_TYPE: 'entityType',
      FIELD: 'field',
      PRIORITY: 'priority',
      CREATED_AT: 'createdAt',
      UPDATED_AT: 'updatedAt',
    };

    const prismaField = fieldMap[sortField];

    return {
      [prismaField]: sortOrder,
    };
  }
}
