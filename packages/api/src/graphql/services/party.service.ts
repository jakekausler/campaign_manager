/**
 * @fileoverview Party Service - Business logic for party operations
 *
 * This service manages party entities, which represent groups of characters in a campaign.
 * Parties can have a collective level that is either computed from member character levels
 * or manually overridden by GMs for balancing purposes. The service handles CRUD operations,
 * character membership management, level progression tracking, and custom variable storage.
 *
 * Key responsibilities:
 * - Party CRUD operations with soft delete and archive (no cascade)
 * - Character membership management (add/remove members from parties)
 * - Level progression (computed average vs manual override)
 * - Custom variables with schema validation for party-specific data
 * - Optimistic locking for concurrent edit safety
 * - Version history with time-travel queries
 * - Real-time change notifications via Redis pub/sub
 * - Campaign context cache invalidation on level changes
 *
 * Level System:
 * - averageLevel: Computed as the mean of all member character levels (rounded)
 * - manualLevelOverride: GM-set level that takes precedence over computed average
 * - When manualLevelOverride is set, it is used instead of averageLevel for encounter scaling
 *
 * Permissions:
 * - Party creation: Campaign owner or GM role
 * - Party updates: Campaign owner or GM role
 * - Party deletion: Campaign owner or GM role
 * - Party reads: Any campaign member
 *
 * @module services/party
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { Party as PrismaParty, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreatePartyInput, UpdatePartyData } from '../inputs/party.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { LevelValidator } from './level-validator';
import { VersionService, type CreateVersionInput } from './version.service';

/**
 * Service handling party operations.
 *
 * Manages party lifecycle including CRUD operations, character membership, level progression,
 * and custom variables. Parties are groups of characters that can have a collective level
 * either calculated from member averages or manually overridden. All operations enforce
 * campaign ownership/GM permissions and maintain audit trails.
 *
 * Key features:
 * - CRUD operations with soft delete and archive
 * - Character membership management (add/remove members)
 * - Level progression (manual override vs computed from members)
 * - Custom variables with schema validation
 * - Optimistic locking for concurrent edit safety
 * - Version history with time-travel queries
 * - Real-time change notifications via Redis pub/sub
 *
 * Level Calculation:
 * - averageLevel: Computed mean of all member character levels
 * - manualLevelOverride: User-set level that overrides the computed average
 * - When override is set, it takes precedence over the calculated average
 *
 * @see {@link CreatePartyInput} for party creation parameters
 * @see {@link UpdatePartyData} for party update parameters
 */
@Injectable()
export class PartyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService,
    @Inject(forwardRef(() => CampaignContextService))
    private readonly campaignContext: CampaignContextService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Find party by ID with campaign access verification.
   *
   * Retrieves a non-deleted party if the user has access to its campaign
   * (either as owner or member). Does not include archived parties.
   *
   * @param id - The party ID to search for
   * @param user - The authenticated user making the request
   * @returns The party if found and accessible, null otherwise
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaParty | null> {
    const party = await this.prisma.party.findFirst({
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

    return party;
  }

  /**
   * Find all non-archived parties in a campaign.
   *
   * Retrieves all active parties for a campaign, ordered by name.
   * Verifies user has access to the campaign before returning results.
   *
   * @param campaignId - The campaign ID to search within
   * @param user - The authenticated user making the request
   * @returns Array of parties in the campaign, sorted by name
   * @throws {NotFoundException} If campaign not found or user lacks access
   */
  async findByCampaign(campaignId: string, user: AuthenticatedUser): Promise<PrismaParty[]> {
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

    return this.prisma.party.findMany({
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
   * Create a new party.
   *
   * Creates a party with optional level settings (averageLevel or manualLevelOverride)
   * and custom variables. Only campaign owners or GMs can create parties.
   * Creates an audit log entry for the creation.
   *
   * @param input - Party creation data including name, campaign, levels, and variables
   * @param user - The authenticated user creating the party
   * @returns The newly created party
   * @throws {ForbiddenException} If user lacks permission to create parties
   */
  async create(input: CreatePartyInput, user: AuthenticatedUser): Promise<PrismaParty> {
    // Verify campaign exists and user has permission
    const hasPermission = await this.hasEditPermission(input.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to create parties in this campaign');
    }

    // Create party
    const party = await this.prisma.party.create({
      data: {
        name: input.name,
        campaignId: input.campaignId,
        averageLevel: input.averageLevel ?? null,
        manualLevelOverride: input.manualLevelOverride ?? null,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        variableSchemas: (input.variableSchemas ?? []) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('party', party.id, 'CREATE', user.id, {
      name: party.name,
      campaignId: party.campaignId,
      averageLevel: party.averageLevel,
      manualLevelOverride: party.manualLevelOverride,
    });

    return party;
  }

  /**
   * Update a party with optimistic locking and versioning.
   *
   * Updates party properties with atomic version increment and snapshot creation.
   * Uses optimistic locking to prevent concurrent edit conflicts. Creates a version
   * snapshot in the specified branch at the given world-time. Publishes real-time
   * change notification for concurrent edit detection. Only campaign owners or GMs
   * can update parties.
   *
   * @param id - The party ID to update
   * @param input - Partial party data to update (only provided fields are changed)
   * @param user - The authenticated user making the update
   * @param expectedVersion - The version number the client expects (for optimistic locking)
   * @param branchId - The branch ID where the version snapshot will be created
   * @param worldTime - The world-time timestamp for the version snapshot (defaults to current time)
   * @returns The updated party with incremented version
   * @throws {NotFoundException} If party not found or user lacks access
   * @throws {BadRequestException} If branchId doesn't belong to the party's campaign
   * @throws {OptimisticLockException} If expectedVersion doesn't match current version
   * @throws {ForbiddenException} If user lacks permission to update
   */
  async update(
    id: string,
    input: UpdatePartyData,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    worldTime: Date = new Date()
  ): Promise<PrismaParty> {
    // Verify party exists and user has access
    const party = await this.findById(id, user);
    if (!party) {
      throw new NotFoundException(`Party with ID ${id} not found`);
    }

    // Verify branchId belongs to this entity's campaign
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, campaignId: party.campaignId, deletedAt: null },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to this entity's campaign`
      );
    }

    // Optimistic locking check: verify version matches
    if (party.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Party was modified by another user. Expected version ${expectedVersion}, but found ${party.version}. Please refresh and try again.`,
        expectedVersion,
        party.version
      );
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(party.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this party');
    }

    // Build update data with incremented version
    const updateData: Prisma.PartyUpdateInput = {
      version: party.version + 1,
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.averageLevel !== undefined) updateData.averageLevel = input.averageLevel;
    if (input.manualLevelOverride !== undefined)
      updateData.manualLevelOverride = input.manualLevelOverride;
    if (input.variables !== undefined)
      updateData.variables = input.variables as Prisma.InputJsonValue;
    if (input.variableSchemas !== undefined)
      updateData.variableSchemas = input.variableSchemas as Prisma.InputJsonValue;

    // Create new version payload (all fields)
    const newPayload: Record<string, unknown> = {
      ...party,
      ...updateData,
      version: party.version + 1,
    };

    // Use transaction to atomically update entity and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update party with new version
      const updatedParty = await tx.party.update({
        where: { id },
        data: updateData,
      });

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'party',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedParty;
    });

    // Create audit entry
    await this.audit.log('party', id, 'UPDATE', user.id, updateData);

    // Publish entityModified event for concurrent edit detection
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'party',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    return updated;
  }

  /**
   * Soft delete a party.
   *
   * Marks the party as deleted without cascading to related entities.
   * Parties are kept for audit trail purposes. Only campaign owners or GMs
   * can delete parties. Creates an audit log entry for the deletion.
   *
   * @param id - The party ID to delete
   * @param user - The authenticated user performing the deletion
   * @returns The deleted party with deletedAt timestamp
   * @throws {NotFoundException} If party not found or user lacks access
   * @throws {ForbiddenException} If user lacks permission to delete
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaParty> {
    // Verify party exists and user has access
    const party = await this.findById(id, user);
    if (!party) {
      throw new NotFoundException(`Party with ID ${id} not found`);
    }

    // Verify user has delete permissions
    const hasPermission = await this.hasEditPermission(party.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this party');
    }

    const deletedAt = new Date();

    // Soft delete party (no cascade)
    const deleted = await this.prisma.party.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('party', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archive a party.
   *
   * Marks the party as archived, hiding it from normal queries while preserving
   * all data. Archived parties can be restored later. Only campaign owners or GMs
   * can archive parties. Creates an audit log entry for the archival.
   *
   * @param id - The party ID to archive
   * @param user - The authenticated user performing the archival
   * @returns The archived party with archivedAt timestamp
   * @throws {NotFoundException} If party not found or user lacks access
   * @throws {ForbiddenException} If user lacks permission to archive
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaParty> {
    // Verify party exists and user has access
    const party = await this.findById(id, user);
    if (!party) {
      throw new NotFoundException(`Party with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(party.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this party');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.party.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('party', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restore an archived party.
   *
   * Clears the archivedAt timestamp, making the party visible in normal queries again.
   * Only campaign owners or GMs can restore parties. Creates an audit log entry for
   * the restoration.
   *
   * @param id - The party ID to restore
   * @param user - The authenticated user performing the restoration
   * @returns The restored party with archivedAt cleared
   * @throws {NotFoundException} If party not found or user lacks access
   * @throws {ForbiddenException} If user lacks permission to restore
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaParty> {
    // Find party even if archived
    const party = await this.prisma.party.findFirst({
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

    if (!party) {
      throw new NotFoundException(`Party with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(party.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this party');
    }

    const restored = await this.prisma.party.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('party', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Check if user has edit permissions for a campaign.
   *
   * Verifies that the user is either the campaign owner or has GM role.
   * Used internally to enforce permission checks before mutations.
   *
   * @param campaignId - The campaign ID to check permissions for
   * @param user - The authenticated user to check permissions for
   * @returns true if user can edit, false otherwise
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
   * Get party state as it existed at a specific point in world-time.
   *
   * Retrieves a historical snapshot of the party from the version history.
   * Supports time-travel queries for viewing past states. Resolves the version
   * valid at the specified world-time in the given branch.
   *
   * @param id - The party ID to retrieve historical state for
   * @param branchId - The branch ID to query within
   * @param worldTime - The world-time point to retrieve state at
   * @param user - The authenticated user making the request
   * @returns The party state at the specified time, or null if not found
   */
  async getPartyAsOf(
    id: string,
    branchId: string,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<PrismaParty | null> {
    // Verify user has access to the party
    const party = await this.findById(id, user);
    if (!party) {
      return null;
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion('party', id, branchId, worldTime);

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as a Party object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaParty;
  }

  /**
   * Calculate average level from party members.
   *
   * Computes the mean level of all non-deleted character members in the party,
   * rounded to the nearest integer. Returns null if the party has no members.
   * This computed value is stored in averageLevel but can be overridden by
   * manualLevelOverride.
   *
   * @param id - The party ID to calculate average level for
   * @param user - The authenticated user making the request
   * @returns The average level (rounded), or null if party has no members
   * @throws {NotFoundException} If party not found or user lacks access
   */
  async calculateAverageLevel(id: string, user: AuthenticatedUser): Promise<number | null> {
    const party = await this.prisma.party.findFirst({
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
      include: {
        members: {
          where: {
            deletedAt: null,
          },
          select: {
            level: true,
          },
        },
      },
    });

    if (!party) {
      throw new NotFoundException(`Party with ID ${id} not found`);
    }

    if (party.members.length === 0) {
      return null;
    }

    const totalLevel = party.members.reduce((sum, member) => sum + member.level, 0);
    return Math.round(totalLevel / party.members.length);
  }

  /**
   * Set party level using manual override.
   *
   * Sets the manualLevelOverride field, which takes precedence over the calculated
   * average level from members. This allows GMs to manually adjust party level for
   * balancing purposes. Validates the level is within acceptable range (1-20).
   * Publishes real-time change notification and invalidates campaign context cache.
   * Only campaign owners or GMs can set party level.
   *
   * @param id - The party ID to set level for
   * @param level - The level to set (must be 1-20)
   * @param user - The authenticated user making the change
   * @returns The updated party with new manualLevelOverride
   * @throws {NotFoundException} If party not found or user lacks access
   * @throws {ForbiddenException} If user lacks permission to set level
   * @throws {BadRequestException} If level is outside valid range (thrown by LevelValidator)
   */
  async setLevel(id: string, level: number, user: AuthenticatedUser): Promise<PrismaParty> {
    // Validate level range before processing
    LevelValidator.validateLevel(level, 'party');

    const party = await this.findById(id, user);
    if (!party) {
      throw new NotFoundException(`Party with ID ${id} not found`);
    }

    const hasPermission = await this.hasEditPermission(party.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to set level for this party');
    }

    const updated = await this.prisma.party.update({
      where: { id },
      data: { manualLevelOverride: level },
    });

    // Create audit entry
    await this.audit.log('party', id, 'UPDATE', user.id, { manualLevelOverride: level });

    // Publish entityModified event for level change
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'party',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    // Invalidate campaign context cache to reflect level change
    // Cache invalidation failures should not block the operation - cache will expire via TTL
    try {
      await this.campaignContext.invalidateContextForEntity('party', id, party.campaignId);
    } catch (error) {
      // Log but don't throw - cache invalidation is optional
      console.error(`Failed to invalidate campaign context for party ${id}:`, error);
    }

    // TODO (TICKET-013): Trigger rules engine recalculation when rules engine is implemented
    // await this.rulesEngine.invalidate({
    //   campaignId: party.campaignId,
    //   changeType: 'party_level',
    //   affectedVariables: ['party.level'],
    // });

    return updated;
  }

  /**
   * Add a character to the party.
   *
   * Associates a character with the party by setting the character's partyId field.
   * Verifies the character exists, belongs to the same campaign, and is not already
   * in another party. Only campaign owners or GMs can modify party membership.
   * Creates an audit log entry for the membership change.
   *
   * @param partyId - The party ID to add the character to
   * @param characterId - The character ID to add
   * @param user - The authenticated user making the change
   * @returns The updated party with the new member
   * @throws {NotFoundException} If party or character not found, or character not in same campaign
   * @throws {ForbiddenException} If user lacks permission to modify party
   */
  async addMember(
    partyId: string,
    characterId: string,
    user: AuthenticatedUser
  ): Promise<PrismaParty> {
    const party = await this.findById(partyId, user);
    if (!party) {
      throw new NotFoundException(`Party with ID ${partyId} not found`);
    }

    const hasPermission = await this.hasEditPermission(party.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to modify this party');
    }

    // Verify character exists and belongs to the same campaign
    const character = await this.prisma.character.findFirst({
      where: {
        id: characterId,
        campaignId: party.campaignId,
        deletedAt: null,
      },
    });

    if (!character) {
      throw new NotFoundException(
        `Character with ID ${characterId} not found or does not belong to this campaign`
      );
    }

    // Add character to party
    await this.prisma.character.update({
      where: { id: characterId },
      data: { partyId },
    });

    // Create audit entry
    await this.audit.log('party', partyId, 'UPDATE', user.id, {
      addedMember: characterId,
    });

    // Return updated party
    const updatedParty = await this.findById(partyId, user);
    if (!updatedParty) {
      throw new NotFoundException(`Party with ID ${partyId} not found after update`);
    }
    return updatedParty;
  }

  /**
   * Remove a character from the party.
   *
   * Disassociates a character from the party by clearing the character's partyId field.
   * Verifies the character exists and is currently in this party. Only campaign owners
   * or GMs can modify party membership. Creates an audit log entry for the membership change.
   *
   * @param partyId - The party ID to remove the character from
   * @param characterId - The character ID to remove
   * @param user - The authenticated user making the change
   * @returns The updated party without the removed member
   * @throws {NotFoundException} If party not found, or character not found/not in party
   * @throws {ForbiddenException} If user lacks permission to modify party
   */
  async removeMember(
    partyId: string,
    characterId: string,
    user: AuthenticatedUser
  ): Promise<PrismaParty> {
    const party = await this.findById(partyId, user);
    if (!party) {
      throw new NotFoundException(`Party with ID ${partyId} not found`);
    }

    const hasPermission = await this.hasEditPermission(party.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to modify this party');
    }

    // Verify character exists and is in this party
    const character = await this.prisma.character.findFirst({
      where: {
        id: characterId,
        partyId,
        deletedAt: null,
      },
    });

    if (!character) {
      throw new NotFoundException(
        `Character with ID ${characterId} not found or is not in this party`
      );
    }

    // Remove character from party
    await this.prisma.character.update({
      where: { id: characterId },
      data: { partyId: null },
    });

    // Create audit entry
    await this.audit.log('party', partyId, 'UPDATE', user.id, {
      removedMember: characterId,
    });

    // Return updated party
    const updatedParty = await this.findById(partyId, user);
    if (!updatedParty) {
      throw new NotFoundException(`Party with ID ${partyId} not found after update`);
    }
    return updatedParty;
  }
}
