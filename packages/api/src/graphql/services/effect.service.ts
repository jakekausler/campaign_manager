/**
 * Effect Service
 * Business logic for Effect CRUD operations
 * Handles payload validation, entity authorization, and dependency graph integration
 */

import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import type { Effect as PrismaEffect, Prisma } from '@prisma/client';
import type { Operation } from 'fast-json-patch';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type {
  CreateEffectInput,
  UpdateEffectInput,
  EffectWhereInput,
  EffectOrderByInput,
  EffectSortField,
} from '../inputs/effect.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { EffectTiming } from '../types/effect.type';

import { AuditService } from './audit.service';
import { DependencyGraphService } from './dependency-graph.service';
import { EffectPatchService, type PatchableEntityType } from './effect-patch.service';

@Injectable()
export class EffectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly patchService: EffectPatchService,
    private readonly dependencyGraphService: DependencyGraphService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Create a new effect
   * Validates payload and verifies user has access to the entity
   */
  async create(input: CreateEffectInput, user: AuthenticatedUser): Promise<PrismaEffect> {
    // Verify entity exists and user has access
    await this.verifyEntityAccess(input.entityType, input.entityId, user);

    // Validate patch payload format
    // Note: payload is Record<string, unknown> from GraphQL but validatePatch expects Operation[]
    // entityType is string but validatePatch expects PatchableEntityType union
    // These casts are safe because validation will catch any type mismatches
    const validationResult = this.patchService.validatePatch(
      input.payload as unknown as Operation[],
      input.entityType.toLowerCase() as PatchableEntityType
    );
    if (!validationResult.valid) {
      throw new BadRequestException(`Invalid payload: ${validationResult.errors.join(', ')}`);
    }

    // Create the effect
    const effect = await this.prisma.effect.create({
      data: {
        name: input.name,
        description: input.description,
        effectType: input.effectType,
        payload: input.payload as Prisma.InputJsonValue,
        entityType: input.entityType,
        entityId: input.entityId,
        timing: input.timing ?? EffectTiming.ON_RESOLVE,
        priority: input.priority ?? 0,
      },
    });

    // Create audit entry
    await this.audit.log('effect', effect.id, 'CREATE', user.id, {
      entityType: effect.entityType,
      entityId: effect.entityId,
      effectType: effect.effectType,
      timing: effect.timing,
      priority: effect.priority,
    });

    // Invalidate dependency graph cache for this effect's campaign
    const campaignId = await this.getCampaignIdForEffect(effect);
    if (campaignId) {
      this.dependencyGraphService.invalidateGraph(campaignId);

      // Publish Redis event for Rules Engine worker
      await this.pubSub.publish('effect.created', {
        effectId: effect.id,
        campaignId,
        branchId: 'main',
      });
    }

    return effect;
  }

  /**
   * Find effect by ID
   * Ensures user has access to the related entity
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaEffect | null> {
    const effect = await this.prisma.effect.findUnique({
      where: { id },
    });

    if (!effect || effect.deletedAt) {
      return null;
    }

    // Verify user has access to the entity
    try {
      await this.verifyEntityAccess(effect.entityType, effect.entityId, user);
    } catch {
      return null; // User doesn't have access
    }

    return effect;
  }

  /**
   * Find many effects with filtering, sorting, and pagination
   */
  async findMany(
    where?: EffectWhereInput,
    orderBy?: EffectOrderByInput,
    skip?: number,
    take?: number,
    user?: AuthenticatedUser
  ): Promise<PrismaEffect[]> {
    // Build Prisma where clause
    const prismaWhere: Prisma.EffectWhereInput = where
      ? {
          name: where.name ? { contains: where.name, mode: 'insensitive' } : undefined,
          effectType: where.effectType,
          entityType: where.entityType,
          entityId: where.entityId,
          timing: where.timing,
          isActive: where.isActive,
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

    // Add campaign access filter if user provided (prevents N+1 query problem)
    if (user) {
      const campaignAccessFilter = {
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
      };

      // Build OR clause for each entity type to include campaign access filtering
      prismaWhere.OR = [
        {
          entityType: 'encounter',
          encounter: {
            deletedAt: null,
            campaign: campaignAccessFilter,
          },
        },
        {
          entityType: 'event',
          event: {
            deletedAt: null,
            campaign: campaignAccessFilter,
          },
        },
      ];
    }

    // Build order by clause
    const prismaOrderBy = orderBy ? this.buildOrderBy(orderBy) : { priority: 'asc' as const };

    // Query effects with campaign access filtering built into the query
    const effects = await this.prisma.effect.findMany({
      where: prismaWhere,
      orderBy: prismaOrderBy,
      skip,
      take,
    });

    return effects;
  }

  /**
   * Find effects for a specific entity and timing phase
   * Returns effects in priority order (ASC)
   */
  async findForEntity(
    entityType: string,
    entityId: string,
    timing: EffectTiming,
    user: AuthenticatedUser
  ): Promise<PrismaEffect[]> {
    // Verify entity access
    await this.verifyEntityAccess(entityType, entityId, user);

    // Query active effects for entity + timing
    return this.prisma.effect.findMany({
      where: {
        entityType,
        entityId,
        timing,
        isActive: true,
        deletedAt: null,
      },
      orderBy: {
        priority: 'asc',
      },
    });
  }

  /**
   * Update an existing effect
   * Uses optimistic locking to prevent race conditions
   */
  async update(
    id: string,
    input: UpdateEffectInput,
    user: AuthenticatedUser
  ): Promise<PrismaEffect> {
    // Fetch existing effect
    const effect = await this.findById(id, user);
    if (!effect) {
      throw new NotFoundException(`Effect with ID ${id} not found`);
    }

    // Optimistic locking check
    if (effect.version !== input.expectedVersion) {
      throw new OptimisticLockException(
        `Effect was modified by another user. Expected version ${input.expectedVersion}, but found ${effect.version}. Please refresh and try again.`,
        input.expectedVersion,
        effect.version
      );
    }

    // Validate payload if changed
    if (input.payload) {
      // Note: payload is Record<string, unknown> from GraphQL but validatePatch expects Operation[]
      // entityType is string but validatePatch expects PatchableEntityType union
      // These casts are safe because validation will catch any type mismatches
      const validationResult = this.patchService.validatePatch(
        input.payload as unknown as Operation[],
        effect.entityType.toLowerCase() as PatchableEntityType
      );
      if (!validationResult.valid) {
        throw new BadRequestException(`Invalid payload: ${validationResult.errors.join(', ')}`);
      }
    }

    // Build update data
    const updateData: Prisma.EffectUpdateInput = {
      version: effect.version + 1,
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.effectType !== undefined) {
      updateData.effectType = input.effectType;
    }
    if (input.payload !== undefined) {
      updateData.payload = input.payload as Prisma.InputJsonValue;
    }
    if (input.timing !== undefined) {
      updateData.timing = input.timing;
    }
    if (input.priority !== undefined) {
      updateData.priority = input.priority;
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    // Update effect
    const updated = await this.prisma.effect.update({
      where: { id },
      data: updateData,
    });

    // Create audit entry
    await this.audit.log('effect', id, 'UPDATE', user.id, updateData);

    // Invalidate dependency graph cache for this effect's campaign
    const campaignId = await this.getCampaignIdForEffect(updated);
    if (campaignId) {
      this.dependencyGraphService.invalidateGraph(campaignId);

      // Publish Redis event for Rules Engine worker
      await this.pubSub.publish('effect.updated', {
        effectId: updated.id,
        campaignId,
        branchId: 'main',
      });
    }

    return updated;
  }

  /**
   * Soft delete an effect
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaEffect> {
    // Verify effect exists and user has access
    const effect = await this.findById(id, user);
    if (!effect) {
      throw new NotFoundException(`Effect with ID ${id} not found`);
    }

    const deletedAt = new Date();

    // Soft delete
    const deleted = await this.prisma.effect.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('effect', id, 'DELETE', user.id, { deletedAt });

    // Invalidate dependency graph cache for this effect's campaign
    const campaignId = await this.getCampaignIdForEffect(deleted);
    if (campaignId) {
      this.dependencyGraphService.invalidateGraph(campaignId);

      // Publish Redis event for Rules Engine worker
      await this.pubSub.publish('effect.deleted', {
        effectId: deleted.id,
        campaignId,
        branchId: 'main',
      });
    }

    return deleted;
  }

  /**
   * Toggle active status of an effect
   */
  async toggleActive(
    id: string,
    isActive: boolean,
    user: AuthenticatedUser
  ): Promise<PrismaEffect> {
    // Verify effect exists and user has access
    const effect = await this.findById(id, user);
    if (!effect) {
      throw new NotFoundException(`Effect with ID ${id} not found`);
    }

    // Update active status
    const updated = await this.prisma.effect.update({
      where: { id },
      data: { isActive },
    });

    // Create audit entry
    await this.audit.log('effect', id, 'UPDATE', user.id, { isActive });

    return updated;
  }

  /**
   * Get campaign ID for an effect (for dependency graph cache invalidation)
   * Resolves via entity relation chain
   */
  private async getCampaignIdForEffect(effect: PrismaEffect): Promise<string | null> {
    const entityTypeLower = effect.entityType.toLowerCase();
    const entityId = effect.entityId;

    switch (entityTypeLower) {
      case 'encounter': {
        const encounter = await this.prisma.encounter.findUnique({
          where: { id: entityId },
          select: { campaignId: true },
        });
        return encounter?.campaignId ?? null;
      }

      case 'event': {
        const event = await this.prisma.event.findUnique({
          where: { id: entityId },
          select: { campaignId: true },
        });
        return event?.campaignId ?? null;
      }

      default:
        return null;
    }
  }

  /**
   * Verify user has access to an entity
   * Checks entity exists and user has campaign access
   */
  private async verifyEntityAccess(
    entityType: string,
    entityId: string,
    user: AuthenticatedUser
  ): Promise<void> {
    const entityTypeLower = entityType.toLowerCase();

    switch (entityTypeLower) {
      case 'encounter': {
        const encounter = await this.prisma.encounter.findFirst({
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
          select: { campaignId: true },
        });

        if (!encounter) {
          throw new NotFoundException(`Encounter with ID ${entityId} not found or access denied`);
        }
        break;
      }

      case 'event': {
        const event = await this.prisma.event.findFirst({
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
          select: { campaignId: true },
        });

        if (!event) {
          throw new NotFoundException(`Event with ID ${entityId} not found or access denied`);
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
  private buildOrderBy(orderBy: EffectOrderByInput): Prisma.EffectOrderByWithRelationInput {
    const sortField = orderBy.field ?? 'PRIORITY';
    const sortOrder = (orderBy.order ?? 'ASC').toLowerCase() as 'asc' | 'desc';

    const fieldMap: Record<EffectSortField, string> = {
      NAME: 'name',
      EFFECT_TYPE: 'effectType',
      ENTITY_TYPE: 'entityType',
      TIMING: 'timing',
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
