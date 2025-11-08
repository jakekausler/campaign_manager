/**
 * Condition Service
 * Business logic for FieldCondition CRUD operations
 * Handles JSONLogic expression validation, entity authorization, and condition evaluation
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
   * Create a new field condition
   * Validates expression and verifies user has access to the entity
   */
  async create(
    input: CreateFieldConditionInput,
    user: AuthenticatedUser
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
      await this.cacheService.invalidateCampaignComputedFields(campaignId, 'main');

      // Publish Redis event for Rules Engine worker
      await this.pubSub.publish('condition.created', {
        conditionId: condition.id,
        campaignId,
        branchId: 'main',
      });
    }

    return condition;
  }

  /**
   * Find condition by ID
   * Ensures user has access to the related entity
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
   * Find many conditions with filtering, sorting, and pagination
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
   * Find conditions for a specific entity and field
   * Returns conditions in priority order (DESC)
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
   * Update an existing field condition
   * Uses optimistic locking to prevent race conditions
   */
  async update(
    id: string,
    input: UpdateFieldConditionInput,
    user: AuthenticatedUser
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
      await this.cacheService.invalidateCampaignComputedFields(campaignId, 'main');

      // Publish Redis event for Rules Engine worker
      await this.pubSub.publish('condition.updated', {
        conditionId: updated.id,
        campaignId,
        branchId: 'main',
      });
    }

    return updated;
  }

  /**
   * Soft delete a field condition
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaFieldCondition> {
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
      await this.cacheService.invalidateCampaignComputedFields(campaignId, 'main');

      // Publish Redis event for Rules Engine worker
      await this.pubSub.publish('condition.deleted', {
        conditionId: deleted.id,
        campaignId,
        branchId: 'main',
      });
    }

    return deleted;
  }

  /**
   * Toggle active status of a condition
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
   * Evaluate a condition with provided context
   * Returns evaluation result with trace for debugging
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
   * Verify user has access to an entity
   * Checks entity exists and user has campaign access
   */
  /**
   * Get campaign ID for a condition (for dependency graph cache invalidation)
   * Returns null for type-level conditions (entityId is null)
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
   * Build Prisma order by clause from GraphQL input
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
