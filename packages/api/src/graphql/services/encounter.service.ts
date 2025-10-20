/**
 * Encounter Service
 * Handles CRUD operations for Encounters (no cascade delete per requirements)
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
   * Find encounter by ID
   * Requires campaign access
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
   * Find all encounters in a campaign (non-deleted, non-archived)
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
   * Find all encounters at a location (non-deleted, non-archived)
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
   * Create a new encounter
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
   * Update an encounter with optimistic locking and versioning
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
   * Soft delete an encounter
   * Does NOT cascade (per requirements - keep audit trail)
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
   * Archive an encounter
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
   * Restore an archived encounter
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
   * Check if user has access to campaign
   * Private helper method
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
   * Validate that location exists and belongs to same world as campaign
   * Private helper method
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
   * Resolve an encounter with 3-phase effect execution
   *
   * This method executes the complete encounter resolution workflow:
   * 1. Execute PRE effects (before resolution)
   * 2. Mark encounter as resolved (isResolved = true, resolvedAt = now)
   * 3. Execute ON_RESOLVE effects (during resolution)
   * 4. Execute POST effects (after resolution)
   *
   * Failed effects are logged but don't prevent resolution.
   *
   * @param id - Encounter ID
   * @param user - User context for authorization and audit
   * @returns Summary of all effect executions across all phases
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
   * Get encounter state as it existed at a specific point in world-time
   * Supports time-travel queries for version history
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
