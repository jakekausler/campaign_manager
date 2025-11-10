/**
 * @file Effect Service
 * @description Service layer for effect management operations
 *
 * Provides business logic for effect CRUD operations with:
 * - JSON Patch operation management for entity state mutation
 * - Effect timing phases (ON_CREATE, ON_RESOLVE, ON_DELETE, ON_UPDATE)
 * - Priority-based execution ordering
 * - Effect activation/deactivation (isActive flag)
 * - Polymorphic entity attachment (Encounter, Event)
 * - Payload validation against entity schemas
 * - Entity lifecycle integration (create, resolve, delete phases)
 * - Optimistic locking for concurrent edit detection
 * - Real-time updates via Redis pub/sub
 * - Dependency graph cache invalidation
 * - Campaign-based access control
 * - Comprehensive audit logging for all operations
 *
 * @module services/effect
 */

import { Injectable, NotFoundException, BadRequestException, Inject, Logger } from '@nestjs/common';
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

/**
 * Service for managing effects that mutate entity state via JSON Patch operations
 *
 * Handles effect CRUD operations with support for:
 * - JSON Patch payload creation and validation
 * - Effect timing phases for entity lifecycle integration
 * - Priority-based execution ordering within timing phases
 * - Effect activation/deactivation for conditional logic
 * - Polymorphic entity attachment (supports Encounter, Event entities)
 * - Soft delete (maintains audit trail and dependency graph history)
 * - Optimistic locking with version numbers
 * - Real-time concurrent edit notifications
 * - Dependency graph cache invalidation on state changes
 *
 * Effect Timing Phases:
 * - ON_CREATE: Applied when entity is created
 * - ON_RESOLVE: Applied when event/encounter is resolved
 * - ON_DELETE: Applied when entity is deleted
 * - ON_UPDATE: Applied when entity is updated
 *
 * Permission model:
 * - Campaign owner can create, update, delete, toggle effects
 * - GM role can create, update, delete, toggle effects
 * - Member role can only view effects (read operations)
 * - Access controlled via parent entity (Encounter/Event) campaign membership
 *
 * @class EffectService
 */
@Injectable()
export class EffectService {
  private readonly logger = new Logger(EffectService.name);

  /**
   * Creates an instance of EffectService
   *
   * @param prisma - Database service for Prisma ORM operations
   * @param audit - Service for logging all operations to audit trail
   * @param patchService - Service for validating JSON Patch operations against entity schemas
   * @param dependencyGraphService - Service for managing and invalidating dependency graph cache
   * @param pubSub - Redis pub/sub for real-time notifications to Rules Engine worker
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly patchService: EffectPatchService,
    private readonly dependencyGraphService: DependencyGraphService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Creates a new effect with JSON Patch payload
   *
   * Validates the JSON Patch payload against the entity schema and ensures
   * the user has access to the parent entity (Encounter/Event) via campaign membership.
   * Creates audit log entry and invalidates dependency graph cache.
   * Publishes Redis event for Rules Engine worker processing.
   *
   * @param input - Effect creation data including payload, entity type, timing, and priority
   * @param user - Authenticated user making the request
   * @returns The newly created effect with metadata
   * @throws NotFoundException - If parent entity (Encounter/Event) not found or access denied
   * @throws BadRequestException - If JSON Patch payload validation fails against entity schema
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
   * Retrieves a single effect by ID
   *
   * Ensures user has access to the parent entity (Encounter/Event) via campaign membership.
   * Only returns non-deleted effects from accessible campaigns.
   * Returns null if effect not found, deleted, or user lacks access.
   *
   * @param id - UUID of the effect to find
   * @param user - Authenticated user making the request
   * @returns The effect if found and accessible, null otherwise
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
   * Retrieves multiple effects with filtering, sorting, and pagination
   *
   * Supports filtering by name, effectType, entityType, entityId, timing, isActive,
   * and date ranges (createdAfter/createdBefore). Filters out deleted effects by default
   * unless includeDeleted is true. If user is provided, filters results by campaign
   * access (owner or member). Defaults to priority ASC ordering if no orderBy specified.
   *
   * Note: Campaign access filtering is performed in-memory due to polymorphic
   * entity relations without FK constraints. For large result sets, consider
   * adding campaign filtering at query time.
   *
   * @param where - Optional filter criteria for effects
   * @param orderBy - Optional sort order (field and direction)
   * @param skip - Optional number of records to skip for pagination
   * @param take - Optional maximum number of records to return
   * @param user - Optional authenticated user for campaign access filtering
   * @returns Array of effects matching the criteria
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

    // Note: Campaign access filtering removed since polymorphic relations have no FK constraints
    // Effects are now filtered by manual campaign lookup in application code
    // For large result sets, consider adding campaign filtering at query time via manual joins

    // Build order by clause
    const prismaOrderBy = orderBy ? this.buildOrderBy(orderBy) : { priority: 'asc' as const };

    // Query effects
    const effects = await this.prisma.effect.findMany({
      where: prismaWhere,
      orderBy: prismaOrderBy,
      skip,
      take,
    });

    // Filter by campaign access if user provided
    if (user) {
      const accessibleEffects = [];
      for (const effect of effects) {
        try {
          await this.verifyEntityAccess(effect.entityType, effect.entityId, user);
          accessibleEffects.push(effect);
        } catch {
          // User doesn't have access to this effect's entity, skip it
        }
      }
      return accessibleEffects;
    }

    return effects;
  }

  /**
   * Retrieves all active effects for a specific entity and timing phase
   *
   * Returns only active (isActive=true) and non-deleted effects attached to
   * the specified entity (Encounter/Event) for the given timing phase.
   * Results are ordered by priority ascending for sequential execution.
   * Verifies user has access to the entity via campaign membership.
   *
   * @param entityType - Type of entity (e.g., 'Encounter', 'Event')
   * @param entityId - UUID of the entity
   * @param timing - Effect timing phase (ON_CREATE, ON_RESOLVE, ON_DELETE, ON_UPDATE)
   * @param user - Authenticated user making the request
   * @returns Array of effects ordered by priority (lowest to highest)
   * @throws NotFoundException - If entity not found or user lacks access
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
   * Updates an existing effect with optimistic locking
   *
   * Updates effect properties including name, description, effectType, payload,
   * timing, priority, and isActive. Uses optimistic locking via version numbers
   * to detect concurrent modifications. If payload is updated, validates the
   * JSON Patch operations against the entity schema. Creates audit log entry,
   * invalidates dependency graph cache, and publishes Redis event.
   *
   * @param id - UUID of the effect to update
   * @param input - Update data with expectedVersion for optimistic locking
   * @param user - Authenticated user making the request
   * @returns The updated effect with incremented version number
   * @throws NotFoundException - If effect not found or user lacks access
   * @throws OptimisticLockException - If expectedVersion doesn't match current version
   * @throws BadRequestException - If new payload validation fails against entity schema
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
   * Soft deletes an effect
   *
   * Sets the deletedAt timestamp without removing the record from the database.
   * Maintains audit trail and dependency graph history. Effect will no longer
   * be returned by default queries or applied during entity lifecycle events.
   * Creates audit log entry, invalidates dependency graph cache, and publishes
   * Redis event for Rules Engine worker cleanup.
   *
   * @param id - UUID of the effect to delete
   * @param user - Authenticated user making the request
   * @returns The deleted effect with deletedAt timestamp
   * @throws NotFoundException - If effect not found or user lacks access
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
   * Toggles the active status of an effect
   *
   * Enables or disables an effect without deleting it. Inactive effects
   * (isActive=false) are not applied during entity lifecycle events but
   * remain in the database for re-activation. Useful for conditional logic
   * and temporary effect suspension. Creates audit log entry.
   *
   * @param id - UUID of the effect to toggle
   * @param isActive - New active status (true to activate, false to deactivate)
   * @param user - Authenticated user making the request
   * @returns The updated effect with new isActive value
   * @throws NotFoundException - If effect not found or user lacks access
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
   * Resolves the campaign ID for an effect via entity relation chain
   *
   * Traverses the polymorphic entity relationship to find the associated
   * campaign ID. Required for dependency graph cache invalidation and
   * Redis pub/sub event publishing. Supports Encounter and Event entity types.
   *
   * @param effect - The effect instance to resolve campaign ID for
   * @returns Campaign UUID if found, null if entity type unsupported or entity not found
   * @private
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
        this.logger.warn(`Unknown entity type for campaign lookup: ${effect.entityType}`);
        return null;
    }
  }

  /**
   * Verifies user has access to an entity via campaign membership
   *
   * Checks that the entity exists, is not deleted, and the user is either
   * the campaign owner or a campaign member. Supports Encounter and Event
   * entity types. Used for authorization checks before effect operations.
   *
   * @param entityType - Type of entity to verify (e.g., 'Encounter', 'Event')
   * @param entityId - UUID of the entity to verify
   * @param user - Authenticated user making the request
   * @returns Promise that resolves if access granted
   * @throws NotFoundException - If entity not found, deleted, or user lacks campaign access
   * @throws BadRequestException - If entity type is unsupported
   * @private
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
   * Builds Prisma orderBy clause from GraphQL input
   *
   * Translates GraphQL sort field enum values to Prisma field names
   * and constructs the orderBy object for database queries. Defaults
   * to PRIORITY field and ASC order if not specified.
   *
   * @param orderBy - GraphQL order by input with field and order direction
   * @returns Prisma orderBy clause for database query
   * @private
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
