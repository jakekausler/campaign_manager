/**
 * @fileoverview Encounter Service
 *
 * Manages encounter lifecycle including CRUD operations, resolution workflow,
 * and 3-phase effect execution (PRE/ON_RESOLVE/POST). Encounters represent
 * combat or exploration scenarios at specific locations within a campaign.
 *
 * Key features:
 * - Soft delete (no cascade) to preserve audit trail and dependency references
 * - Optimistic locking with version control for concurrent edit protection
 * - 3-phase resolution workflow with effect execution
 * - Party interaction tracking for combat and exploration
 * - Location-based encounter placement with world validation
 * - Time-travel queries for historical encounter state
 *
 * Related features:
 * - {@link EffectExecutionService} - Executes encounter effects during resolution
 * - {@link VersionService} - Tracks encounter state over world-time
 * - {@link AuditService} - Records encounter operations for audit trail
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import type { Encounter as PrismaEncounter, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateEncounterInput, UpdateEncounterData } from '../inputs/encounter.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import {
  EffectExecutionService,
  type EffectExecutionSummary,
  type UserContext,
} from './effect-execution.service';
import { VersionService, type CreateVersionInput } from './version.service';

/**
 * Service for managing encounter operations and resolution workflow.
 *
 * Handles the complete lifecycle of encounters from creation through resolution,
 * including location placement, party interactions, difficulty tracking, and
 * 3-phase effect execution during resolution.
 *
 * Resolution workflow phases:
 * 1. PRE - Effects executed before resolution (preparation, warnings)
 * 2. ON_RESOLVE - Effects executed during resolution (combat outcomes, loot)
 * 3. POST - Effects executed after resolution (cleanup, consequences)
 *
 * Uses optimistic locking to prevent concurrent modification conflicts,
 * version control for time-travel queries, and soft delete to preserve
 * audit trail and dependency references.
 *
 * @example
 * ```typescript
 * // Create a combat encounter at a dungeon location
 * const encounter = await encounterService.create({
 *   campaignId: 'campaign-123',
 *   locationId: 'dungeon-456',
 *   name: 'Goblin Ambush',
 *   difficulty: 'HARD',
 *   scheduledAt: new Date('2024-03-15T18:00:00Z'),
 *   variables: { goblinCount: 5, treasureValue: 500 }
 * }, user);
 *
 * // Resolve encounter with 3-phase effect execution
 * const { encounter: resolved, effectSummary } = await encounterService.resolve(
 *   encounter.id,
 *   user
 * );
 * console.log(`Executed ${effectSummary.onResolve.totalExecuted} resolution effects`);
 * ```
 */
@Injectable()
export class EncounterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService,
    private readonly effectExecution: EffectExecutionService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Retrieves a single encounter by ID with campaign access validation.
   *
   * Returns null if the encounter doesn't exist or is soft-deleted.
   * Verifies that the authenticated user has access to the encounter's
   * campaign (either as owner or member).
   *
   * @param id - Unique identifier of the encounter
   * @param user - Authenticated user making the request
   * @returns The encounter if found and accessible, null otherwise
   * @throws {NotFoundException} If the campaign doesn't exist
   * @throws {ForbiddenException} If the user lacks campaign access
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaEncounter | null> {
    const encounter = await this.prisma.encounter.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (encounter) {
      await this.checkCampaignAccess(encounter.campaignId, user);
    }

    return encounter;
  }

  /**
   * Retrieves all active encounters in a campaign.
   *
   * Returns only non-deleted and non-archived encounters, ordered by creation date
   * (most recent first). Validates that the authenticated user has access to the
   * specified campaign.
   *
   * @param campaignId - Unique identifier of the campaign
   * @param user - Authenticated user making the request
   * @returns Array of active encounters in the campaign
   * @throws {NotFoundException} If the campaign doesn't exist
   * @throws {ForbiddenException} If the user lacks campaign access
   */
  async findByCampaignId(campaignId: string, user: AuthenticatedUser): Promise<PrismaEncounter[]> {
    await this.checkCampaignAccess(campaignId, user);

    return this.prisma.encounter.findMany({
      where: {
        campaignId,
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Retrieves all active encounters at a specific location.
   *
   * Returns only non-deleted and non-archived encounters at the specified location,
   * ordered by creation date (most recent first). Validates campaign access based
   * on the first encounter found (all encounters at a location share the same
   * campaign through the location's world).
   *
   * @param locationId - Unique identifier of the location
   * @param user - Authenticated user making the request
   * @returns Array of active encounters at the location
   * @throws {NotFoundException} If the campaign doesn't exist
   * @throws {ForbiddenException} If the user lacks campaign access
   */
  async findByLocationId(locationId: string, user: AuthenticatedUser): Promise<PrismaEncounter[]> {
    // Find encounters at this location
    const encounters = await this.prisma.encounter.findMany({
      where: {
        locationId,
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Check campaign access for the first encounter (all should have same campaign through location's world)
    if (encounters.length > 0) {
      await this.checkCampaignAccess(encounters[0].campaignId, user);
    }

    return encounters;
  }

  /**
   * Creates a new encounter with optional location placement.
   *
   * Validates that:
   * - The campaign exists and the user has access
   * - The location (if provided) exists and belongs to the same world as the campaign
   *
   * Creates an audit entry recording the creation operation.
   *
   * @param input - Encounter creation data including name, campaign, location, difficulty, and variables
   * @param user - Authenticated user creating the encounter
   * @returns The newly created encounter
   * @throws {NotFoundException} If campaign or location doesn't exist
   * @throws {ForbiddenException} If user lacks campaign access
   * @throws {Error} If location doesn't belong to campaign's world
   *
   * @example
   * ```typescript
   * const encounter = await encounterService.create({
   *   campaignId: 'campaign-123',
   *   locationId: 'dungeon-456',
   *   name: 'Dragon Lair',
   *   description: 'Ancient red dragon guards treasure hoard',
   *   difficulty: 'DEADLY',
   *   scheduledAt: new Date('2024-03-20T14:00:00Z'),
   *   variables: { dragonAge: 'ancient', treasureValue: 50000 }
   * }, user);
   * ```
   */
  async create(input: CreateEncounterInput, user: AuthenticatedUser): Promise<PrismaEncounter> {
    // Verify campaign exists and user has access
    await this.checkCampaignAccess(input.campaignId, user);

    // Verify location exists and belongs to same world as campaign (if provided)
    if (input.locationId) {
      await this.validateLocation(input.campaignId, input.locationId);
    }

    const encounter = await this.prisma.encounter.create({
      data: {
        campaignId: input.campaignId,
        locationId: input.locationId ?? null,
        name: input.name,
        description: input.description ?? null,
        difficulty: input.difficulty ?? null,
        scheduledAt: input.scheduledAt ?? null,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('encounter', encounter.id, 'CREATE', user.id, {
      campaignId: encounter.campaignId,
      locationId: encounter.locationId,
      name: encounter.name,
      description: encounter.description,
      difficulty: encounter.difficulty,
      scheduledAt: encounter.scheduledAt,
      variables: encounter.variables,
    });

    return encounter;
  }

  /**
   * Updates an encounter with optimistic locking and version control.
   *
   * Implements concurrent edit protection using version-based optimistic locking.
   * Creates a version snapshot in the specified branch for time-travel queries.
   * Publishes entity modification event for real-time concurrent edit detection.
   *
   * Validates that:
   * - The encounter exists and user has access
   * - The expected version matches the current version (prevents conflicts)
   * - The branch belongs to the encounter's campaign
   * - The location (if changing) belongs to the campaign's world
   *
   * All updates increment the version number and create an audit entry.
   *
   * @param id - Unique identifier of the encounter to update
   * @param input - Partial update data (only provided fields will be updated)
   * @param user - Authenticated user performing the update
   * @param expectedVersion - Version number expected by the client for optimistic locking
   * @param branchId - Branch identifier for version snapshot
   * @param worldTime - World-time timestamp for the version snapshot (defaults to current time)
   * @returns The updated encounter with incremented version
   * @throws {NotFoundException} If encounter, campaign, branch, or location doesn't exist
   * @throws {ForbiddenException} If user lacks campaign access
   * @throws {OptimisticLockException} If version mismatch indicates concurrent modification
   * @throws {BadRequestException} If branch doesn't belong to encounter's campaign
   * @throws {Error} If new location doesn't belong to campaign's world
   *
   * @example
   * ```typescript
   * const updated = await encounterService.update(
   *   'encounter-123',
   *   { difficulty: 'DEADLY', isResolved: false },
   *   user,
   *   5, // Expected version
   *   'main-branch',
   *   new Date('2024-03-15T12:00:00Z')
   * );
   * // Returns encounter with version 6
   * ```
   */
  async update(
    id: string,
    input: UpdateEncounterData,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    worldTime: Date = new Date()
  ): Promise<PrismaEncounter> {
    // Verify encounter exists and user has access
    const encounter = await this.findById(id, user);
    if (!encounter) {
      throw new NotFoundException(`Encounter with ID ${id} not found`);
    }

    // Verify branchId belongs to this entity's campaign
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, campaignId: encounter.campaignId, deletedAt: null },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to this entity's campaign`
      );
    }

    // Optimistic locking check: verify version matches
    if (encounter.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Encounter was modified by another user. Expected version ${expectedVersion}, but found ${encounter.version}. Please refresh and try again.`,
        expectedVersion,
        encounter.version
      );
    }

    // Verify location exists and belongs to same world as campaign (if changing location)
    if (input.locationId !== undefined && input.locationId !== null) {
      await this.validateLocation(encounter.campaignId, input.locationId);
    }

    // Build update data with incremented version
    const updateData: Prisma.EncounterUpdateInput = {
      version: encounter.version + 1,
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.difficulty !== undefined) updateData.difficulty = input.difficulty;
    if (input.scheduledAt !== undefined) updateData.scheduledAt = input.scheduledAt;
    if (input.isResolved !== undefined) {
      updateData.isResolved = input.isResolved;
      if (input.isResolved) {
        updateData.resolvedAt = new Date();
      } else {
        updateData.resolvedAt = null;
      }
    }
    if (input.variables !== undefined) {
      updateData.variables = input.variables as Prisma.InputJsonValue;
    }
    if (input.locationId !== undefined) {
      if (input.locationId === null) {
        updateData.location = { disconnect: true };
      } else {
        updateData.location = { connect: { id: input.locationId } };
      }
    }

    // Create new version payload (all fields)
    const newPayload: Record<string, unknown> = {
      ...encounter,
      ...updateData,
      version: encounter.version + 1,
    };

    // Use transaction to atomically update entity and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update encounter with new version
      const updatedEncounter = await tx.encounter.update({
        where: { id },
        data: updateData,
      });

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'encounter',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedEncounter;
    });

    // Create audit entry
    await this.audit.log('encounter', id, 'UPDATE', user.id, updateData);

    // Publish entityModified event for concurrent edit detection
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'encounter',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    return updated;
  }

  /**
   * Soft deletes an encounter without cascading to related entities.
   *
   * Sets the deletedAt timestamp but preserves the encounter record for
   * audit trail and to maintain dependency references. Does NOT cascade
   * delete to related effects, encounters, or dependency edges.
   *
   * Soft-deleted encounters are excluded from standard queries but remain
   * accessible for audit purposes and historical version queries.
   *
   * @param id - Unique identifier of the encounter to delete
   * @param user - Authenticated user performing the deletion
   * @returns The soft-deleted encounter with deletedAt timestamp set
   * @throws {NotFoundException} If encounter doesn't exist or campaign doesn't exist
   * @throws {ForbiddenException} If user lacks campaign access
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaEncounter> {
    // Verify encounter exists and user has access
    const encounter = await this.findById(id, user);
    if (!encounter) {
      throw new NotFoundException(`Encounter with ID ${id} not found`);
    }

    const deletedAt = new Date();

    // Soft delete encounter
    const deleted = await this.prisma.encounter.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('encounter', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archives an encounter to hide it from active lists.
   *
   * Sets the archivedAt timestamp to exclude the encounter from standard
   * active encounter queries while preserving all data. Archived encounters
   * can be restored later. Useful for completed or inactive encounters that
   * should be hidden but not deleted.
   *
   * @param id - Unique identifier of the encounter to archive
   * @param user - Authenticated user performing the archive operation
   * @returns The archived encounter with archivedAt timestamp set
   * @throws {NotFoundException} If encounter doesn't exist or campaign doesn't exist
   * @throws {ForbiddenException} If user lacks campaign access
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaEncounter> {
    // Verify encounter exists and user has access
    const encounter = await this.findById(id, user);
    if (!encounter) {
      throw new NotFoundException(`Encounter with ID ${id} not found`);
    }

    const archivedAt = new Date();

    const archived = await this.prisma.encounter.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('encounter', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restores an archived encounter to active status.
   *
   * Clears the archivedAt timestamp to make the encounter visible in
   * standard active encounter queries again. Can be used to un-archive
   * encounters that were previously archived.
   *
   * @param id - Unique identifier of the encounter to restore
   * @param user - Authenticated user performing the restore operation
   * @returns The restored encounter with archivedAt cleared
   * @throws {NotFoundException} If encounter doesn't exist or campaign doesn't exist
   * @throws {ForbiddenException} If user lacks campaign access
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaEncounter> {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id },
    });

    if (!encounter) {
      throw new NotFoundException(`Encounter with ID ${id} not found`);
    }

    await this.checkCampaignAccess(encounter.campaignId, user);

    const restored = await this.prisma.encounter.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('encounter', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Validates that the user has access to the specified campaign.
   *
   * Checks if the user is either the campaign owner or has an active
   * membership in the campaign. This is a private helper method used
   * throughout the service to enforce campaign-level access control.
   *
   * @param campaignId - Unique identifier of the campaign to check
   * @param user - Authenticated user to validate access for
   * @throws {NotFoundException} If campaign doesn't exist or is deleted
   * @throws {ForbiddenException} If user is neither owner nor member
   * @private
   */
  private async checkCampaignAccess(campaignId: string, user: AuthenticatedUser): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, deletedAt: null },
      include: {
        memberships: {
          where: { userId: user.id },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    // Check if user is owner or has membership
    if (campaign.ownerId !== user.id && campaign.memberships.length === 0) {
      throw new ForbiddenException('You do not have access to this campaign');
    }
  }

  /**
   * Validates that a location exists and belongs to the campaign's world.
   *
   * Ensures data integrity by verifying that encounters can only be placed
   * at locations within the same world as their campaign. This prevents
   * invalid cross-world location assignments.
   *
   * @param campaignId - Unique identifier of the campaign
   * @param locationId - Unique identifier of the location to validate
   * @throws {NotFoundException} If location doesn't exist or is deleted
   * @throws {Error} If location's world doesn't match campaign's world
   * @private
   */
  private async validateLocation(campaignId: string, locationId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { worldId: true },
    });

    const location = await this.prisma.location.findFirst({
      where: { id: locationId, deletedAt: null },
      select: { worldId: true },
    });

    if (!location) {
      throw new NotFoundException(`Location with ID ${locationId} not found`);
    }

    if (location.worldId !== campaign?.worldId) {
      throw new Error('Location must belong to the same world as the campaign');
    }
  }

  /**
   * Resolves an encounter with comprehensive 3-phase effect execution.
   *
   * Executes the complete encounter resolution workflow in the following phases:
   *
   * Phase 1 - PRE: Execute preparation effects before marking as resolved.
   * - Useful for warnings, setup, or conditional checks
   * - Entity updates are skipped (encounter not yet resolved)
   *
   * Phase 2 - RESOLUTION: Mark encounter as resolved in database.
   * - Sets isResolved = true
   * - Sets resolvedAt timestamp
   * - Increments version number
   * - Creates audit entry
   * - Publishes entity modification event
   *
   * Phase 3 - ON_RESOLVE: Execute resolution effects (combat outcomes, loot).
   * - Primary effect phase for encounter resolution
   * - Entity updates are skipped (only execution records created)
   *
   * Phase 4 - POST: Execute cleanup and consequence effects.
   * - Useful for follow-up events, state cleanup, or cascading changes
   * - Entity updates are skipped (only execution records created)
   *
   * Effect execution uses skipEntityUpdate=true for all phases, meaning
   * effects create execution records but don't modify the encounter entity
   * itself (only the explicit resolution update modifies the encounter).
   *
   * Failed effects are logged but don't prevent resolution from completing.
   *
   * @param id - Unique identifier of the encounter to resolve
   * @param user - Authenticated user performing the resolution
   * @returns Object containing the resolved encounter and effect execution summaries for all phases
   * @throws {NotFoundException} If encounter doesn't exist or campaign doesn't exist
   * @throws {ForbiddenException} If user lacks campaign access
   * @throws {BadRequestException} If encounter is already resolved
   *
   * @example
   * ```typescript
   * const { encounter, effectSummary } = await encounterService.resolve(
   *   'encounter-123',
   *   user
   * );
   *
   * console.log(`Resolved: ${encounter.name}`);
   * console.log(`PRE effects: ${effectSummary.pre.totalExecuted}`);
   * console.log(`ON_RESOLVE effects: ${effectSummary.onResolve.totalExecuted}`);
   * console.log(`POST effects: ${effectSummary.post.totalExecuted}`);
   * console.log(`Total failed: ${
   *   effectSummary.pre.totalFailed +
   *   effectSummary.onResolve.totalFailed +
   *   effectSummary.post.totalFailed
   * }`);
   * ```
   */
  async resolve(
    id: string,
    user: AuthenticatedUser
  ): Promise<{
    encounter: PrismaEncounter;
    effectSummary: {
      pre: EffectExecutionSummary;
      onResolve: EffectExecutionSummary;
      post: EffectExecutionSummary;
    };
  }> {
    // Verify encounter exists and user has access
    const encounter = await this.findById(id, user);
    if (!encounter) {
      throw new NotFoundException(`Encounter with ID ${id} not found`);
    }

    // Check if already resolved
    if (encounter.isResolved) {
      throw new BadRequestException(`Encounter with ID ${id} is already resolved`);
    }

    // Convert AuthenticatedUser to UserContext for effect execution
    const userContext: UserContext = {
      id: user.id,
      email: user.email,
    };

    // Phase 1: Execute PRE effects (skip entity update - encounter not resolved yet)
    const preResults = await this.effectExecution.executeEffectsForEntity(
      'ENCOUNTER',
      id,
      'PRE',
      userContext,
      true // skipEntityUpdate
    );

    // Phase 2: Mark encounter as resolved
    const resolvedAt = new Date();
    const resolved = await this.prisma.encounter.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt,
        version: encounter.version + 1,
      },
    });

    // Create audit entry for resolution
    await this.audit.log('encounter', id, 'UPDATE', user.id, {
      isResolved: true,
      resolvedAt,
    });

    // Publish entityModified event
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'encounter',
        version: resolved.version,
        modifiedBy: user.id,
        modifiedAt: resolved.updatedAt,
      },
    });

    // Phase 3: Execute ON_RESOLVE effects (skip entity update - only create execution records)
    const onResolveResults = await this.effectExecution.executeEffectsForEntity(
      'ENCOUNTER',
      id,
      'ON_RESOLVE',
      userContext,
      true // skipEntityUpdate
    );

    // Phase 4: Execute POST effects (skip entity update - only create execution records)
    const postResults = await this.effectExecution.executeEffectsForEntity(
      'ENCOUNTER',
      id,
      'POST',
      userContext,
      true // skipEntityUpdate
    );

    return {
      encounter: resolved,
      effectSummary: {
        pre: preResults,
        onResolve: onResolveResults,
        post: postResults,
      },
    };
  }

  /**
   * Retrieves encounter state as it existed at a specific point in world-time.
   *
   * Enables time-travel queries by resolving the encounter's state from the
   * version history at the specified world-time timestamp within a branch.
   * Useful for viewing historical encounter states, analyzing changes over
   * time, or comparing different timeline branches.
   *
   * The returned encounter reflects all fields as they existed at the
   * specified world-time, decompressed from the version snapshot.
   *
   * @param id - Unique identifier of the encounter
   * @param branchId - Branch identifier for version resolution
   * @param worldTime - World-time timestamp to query the encounter state at
   * @param user - Authenticated user making the request
   * @returns The encounter as it existed at the specified world-time, or null if not found
   * @throws {NotFoundException} If campaign doesn't exist
   * @throws {ForbiddenException} If user lacks campaign access
   *
   * @example
   * ```typescript
   * // Get encounter state as it was at a specific point in campaign timeline
   * const historicalEncounter = await encounterService.getEncounterAsOf(
   *   'encounter-123',
   *   'main-branch',
   *   new Date('2024-03-10T12:00:00Z'),
   *   user
   * );
   *
   * if (historicalEncounter) {
   *   console.log(`Difficulty at that time: ${historicalEncounter.difficulty}`);
   *   console.log(`Was resolved: ${historicalEncounter.isResolved}`);
   * }
   * ```
   */
  async getEncounterAsOf(
    id: string,
    branchId: string,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<PrismaEncounter | null> {
    // Verify user has access to the encounter
    const encounter = await this.findById(id, user);
    if (!encounter) {
      return null;
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion('encounter', id, branchId, worldTime);

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as an Encounter object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaEncounter;
  }
}
