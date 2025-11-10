/**
 * @file Character Service
 * @description Service layer for character management operations
 *
 * Provides business logic for character CRUD operations with:
 * - Soft delete (sets deletedAt timestamp, no cascade)
 * - Archive/restore functionality for character organization
 * - Party membership management
 * - Custom variable storage (JSON)
 * - Character state tracking (level, race, class, NPC status)
 * - Optimistic locking for concurrent edit detection
 * - Version history with time-travel queries
 * - Real-time updates via Redis pub/sub
 * - Campaign-based access control (owner/GM permissions)
 * - Comprehensive audit logging for all operations
 *
 * @module services/character
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import type { Character as PrismaCharacter, Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateCharacterInput, UpdateCharacterData } from '../inputs/character.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';

import { AuditService } from './audit.service';
import { VersionService, type CreateVersionInput } from './version.service';

/**
 * Service for managing characters in campaigns
 *
 * Handles character CRUD operations with support for:
 * - Party membership assignment
 * - Custom variable storage for character attributes
 * - Archive/restore functionality
 * - Soft delete (no cascade to maintain audit trail)
 * - Optimistic locking with version numbers
 * - Time-travel queries for historical character states
 * - Real-time concurrent edit notifications
 *
 * Permission model:
 * - Campaign owner can create, update, delete, archive, restore characters
 * - GM role can create, update, delete, archive, restore characters
 * - Member role can only view characters (read operations)
 *
 * @class CharacterService
 */
@Injectable()
export class CharacterService {
  /**
   * Creates an instance of CharacterService
   *
   * @param prisma - Database service for Prisma ORM operations
   * @param audit - Service for logging all operations to audit trail
   * @param versionService - Service for managing version history and time-travel
   * @param pubSub - Redis pub/sub for real-time concurrent edit notifications
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Retrieves a single character by ID
   *
   * Ensures user has access to the campaign that owns the character.
   * Only returns non-deleted characters from non-deleted campaigns.
   * User must be either the campaign owner or a campaign member.
   *
   * @param id - UUID of the character to find
   * @param user - Authenticated user making the request
   * @returns The character if found and accessible, null otherwise
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaCharacter | null> {
    const character = await this.prisma.character.findFirst({
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

    return character;
  }

  /**
   * Retrieves all characters belonging to a campaign
   *
   * Returns only non-deleted and non-archived characters.
   * Results are sorted alphabetically by name.
   * User must have access to the campaign (owner or member).
   *
   * @param campaignId - UUID of the campaign
   * @param user - Authenticated user making the request
   * @returns Array of characters in the campaign
   * @throws {NotFoundException} If campaign not found or user lacks access
   */
  async findByCampaign(campaignId: string, user: AuthenticatedUser): Promise<PrismaCharacter[]> {
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

    return this.prisma.character.findMany({
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
   * Retrieves all characters belonging to a party
   *
   * Returns only non-deleted and non-archived characters in the party.
   * Results are sorted alphabetically by name.
   * User must have access to the campaign that owns the party.
   *
   * @param partyId - UUID of the party
   * @param user - Authenticated user making the request
   * @returns Array of characters in the party
   * @throws {NotFoundException} If party not found or user lacks access
   */
  async findByPartyId(partyId: string, user: AuthenticatedUser): Promise<PrismaCharacter[]> {
    // First verify party exists and user has access
    const party = await this.prisma.party.findFirst({
      where: {
        id: partyId,
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
      throw new NotFoundException(`Party with ID ${partyId} not found`);
    }

    return this.prisma.character.findMany({
      where: {
        partyId,
        deletedAt: null,
        archivedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Creates a new character in a campaign
   *
   * Validates campaign and party (if provided) exist and belong together.
   * Sets default values for optional fields (level=1, isNPC=false).
   * Creates audit log entry for the creation operation.
   * Only campaign owner or GM can create characters.
   *
   * @param input - Character creation data including name, campaign, party, attributes
   * @param user - Authenticated user making the request
   * @returns The newly created character
   * @throws {ForbiddenException} If user lacks permission to create characters
   * @throws {NotFoundException} If party not found or doesn't belong to campaign
   */
  async create(input: CreateCharacterInput, user: AuthenticatedUser): Promise<PrismaCharacter> {
    // Verify campaign exists and user has permission
    const hasPermission = await this.hasEditPermission(input.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to create characters in this campaign'
      );
    }

    // If partyId is provided, verify party exists and belongs to the campaign
    if (input.partyId) {
      const party = await this.prisma.party.findFirst({
        where: {
          id: input.partyId,
          campaignId: input.campaignId,
          deletedAt: null,
        },
      });

      if (!party) {
        throw new NotFoundException(`Party with ID ${input.partyId} not found in this campaign`);
      }
    }

    // Create character
    const character = await this.prisma.character.create({
      data: {
        name: input.name,
        campaignId: input.campaignId,
        partyId: input.partyId ?? null,
        level: input.level ?? 1,
        race: input.race ?? null,
        class: input.class ?? null,
        isNPC: input.isNPC ?? false,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('character', character.id, 'CREATE', user.id, {
      name: character.name,
      campaignId: character.campaignId,
      partyId: character.partyId,
      level: character.level,
      race: character.race,
      class: character.class,
      isNPC: character.isNPC,
    });

    return character;
  }

  /**
   * Updates an existing character with optimistic locking
   *
   * Implements optimistic locking to detect concurrent edits by comparing
   * version numbers. Creates a version snapshot in the specified branch.
   * Publishes real-time notification for concurrent edit detection.
   * All fields are optional in the update input - only provided fields are updated.
   * Only campaign owner or GM can update characters.
   *
   * Version handling:
   * - Checks expectedVersion matches current version
   * - Increments version number on successful update
   * - Creates version snapshot with new state
   * - Publishes entityModified event for real-time notifications
   *
   * @param id - UUID of the character to update
   * @param input - Partial character data to update (only provided fields updated)
   * @param user - Authenticated user making the request
   * @param expectedVersion - Expected version number for optimistic locking
   * @param branchId - UUID of the branch for version history
   * @param worldTime - World time for the version snapshot (defaults to current time)
   * @returns The updated character with incremented version
   * @throws {NotFoundException} If character not found or party invalid
   * @throws {ForbiddenException} If user lacks permission to update
   * @throws {BadRequestException} If branch invalid or doesn't belong to campaign
   * @throws {OptimisticLockException} If version mismatch (concurrent edit detected)
   */
  async update(
    id: string,
    input: UpdateCharacterData,
    user: AuthenticatedUser,
    expectedVersion: number,
    branchId: string,
    worldTime: Date = new Date()
  ): Promise<PrismaCharacter> {
    // Verify character exists and user has access
    const character = await this.findById(id, user);
    if (!character) {
      throw new NotFoundException(`Character with ID ${id} not found`);
    }

    // Verify branchId belongs to this entity's campaign
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, campaignId: character.campaignId, deletedAt: null },
    });

    if (!branch) {
      throw new BadRequestException(
        `Branch with ID ${branchId} not found or does not belong to this entity's campaign`
      );
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(character.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this character');
    }

    // Optimistic locking check: verify version matches
    if (character.version !== expectedVersion) {
      throw new OptimisticLockException(
        `Character was modified by another user. Expected version ${expectedVersion}, but found ${character.version}. Please refresh and try again.`,
        expectedVersion,
        character.version
      );
    }

    // If partyId is being updated, verify party exists and belongs to the campaign
    if (input.partyId !== undefined && input.partyId !== null) {
      const party = await this.prisma.party.findFirst({
        where: {
          id: input.partyId,
          campaignId: character.campaignId,
          deletedAt: null,
        },
      });

      if (!party) {
        throw new NotFoundException(`Party with ID ${input.partyId} not found in this campaign`);
      }
    }

    // Build update data with incremented version
    const updateData: Prisma.CharacterUpdateInput = {
      version: character.version + 1,
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.partyId !== undefined) {
      updateData.party =
        input.partyId === null ? { disconnect: true } : { connect: { id: input.partyId } };
    }
    if (input.level !== undefined) updateData.level = input.level;
    if (input.race !== undefined) updateData.race = input.race;
    if (input.class !== undefined) updateData.class = input.class;
    if (input.isNPC !== undefined) updateData.isNPC = input.isNPC;
    if (input.variables !== undefined)
      updateData.variables = input.variables as Prisma.InputJsonValue;

    // Create new version payload (all fields)
    const newPayload: Record<string, unknown> = {
      ...character,
      ...updateData,
      version: character.version + 1,
    };

    // Use transaction to atomically update entity and create version
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update character with new version
      const updatedCharacter = await tx.character.update({
        where: { id },
        data: updateData,
      });

      // Create version snapshot
      const versionInput: CreateVersionInput = {
        entityType: 'character',
        entityId: id,
        branchId,
        validFrom: worldTime,
        validTo: null,
        payload: newPayload,
      };
      await this.versionService.createVersion(versionInput, user);

      return updatedCharacter;
    });

    // Create audit entry
    await this.audit.log('character', id, 'UPDATE', user.id, updateData);

    // Publish entityModified event for concurrent edit detection
    await this.pubSub.publish(`entity.modified.${id}`, {
      entityModified: {
        entityId: id,
        entityType: 'character',
        version: updated.version,
        modifiedBy: user.id,
        modifiedAt: updated.updatedAt,
      },
    });

    return updated;
  }

  /**
   * Soft deletes a character
   *
   * Sets the deletedAt timestamp to mark the character as deleted.
   * Does NOT cascade delete - character is retained for audit trail.
   * Deleted characters are excluded from standard queries.
   * Creates audit log entry for the deletion operation.
   * Only campaign owner or GM can delete characters.
   *
   * @param id - UUID of the character to delete
   * @param user - Authenticated user making the request
   * @returns The deleted character (with deletedAt timestamp set)
   * @throws {NotFoundException} If character not found
   * @throws {ForbiddenException} If user lacks permission to delete
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaCharacter> {
    // Verify character exists and user has access
    const character = await this.findById(id, user);
    if (!character) {
      throw new NotFoundException(`Character with ID ${id} not found`);
    }

    // Verify user has delete permissions
    const hasPermission = await this.hasEditPermission(character.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this character');
    }

    const deletedAt = new Date();

    // Soft delete character (no cascade)
    const deleted = await this.prisma.character.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('character', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archives a character
   *
   * Sets the archivedAt timestamp to mark the character as archived.
   * Archived characters are excluded from standard queries but can be restored.
   * Useful for organizing characters that are no longer active but shouldn't be deleted.
   * Creates audit log entry for the archive operation.
   * Only campaign owner or GM can archive characters.
   *
   * @param id - UUID of the character to archive
   * @param user - Authenticated user making the request
   * @returns The archived character (with archivedAt timestamp set)
   * @throws {NotFoundException} If character not found
   * @throws {ForbiddenException} If user lacks permission to archive
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaCharacter> {
    // Verify character exists and user has access
    const character = await this.findById(id, user);
    if (!character) {
      throw new NotFoundException(`Character with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(character.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this character');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.character.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('character', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restores an archived character
   *
   * Clears the archivedAt timestamp to make the character active again.
   * The character will be included in standard queries after restoration.
   * Can find and restore even archived characters (doesn't filter by archivedAt in query).
   * Creates audit log entry for the restore operation.
   * Only campaign owner or GM can restore characters.
   *
   * @param id - UUID of the character to restore
   * @param user - Authenticated user making the request
   * @returns The restored character (with archivedAt cleared)
   * @throws {NotFoundException} If character not found
   * @throws {ForbiddenException} If user lacks permission to restore
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaCharacter> {
    // Find character even if archived
    const character = await this.prisma.character.findFirst({
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

    if (!character) {
      throw new NotFoundException(`Character with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(character.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this character');
    }

    const restored = await this.prisma.character.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('character', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Checks if user has edit permissions for a campaign
   *
   * Edit permissions are granted to:
   * - Campaign owner (owns the campaign)
   * - GM role members (have GM permissions in the campaign)
   *
   * Used internally to validate permissions for create, update, delete,
   * archive, and restore operations.
   *
   * @param campaignId - UUID of the campaign to check permissions for
   * @param user - Authenticated user to check permissions for
   * @returns True if user has edit permissions, false otherwise
   * @private
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
   * Retrieves historical character state at a specific point in world-time
   *
   * Implements time-travel queries to retrieve character state as it existed
   * at a specific moment in the campaign's world time. Uses the version history
   * system to reconstruct the character's state from version snapshots.
   * Useful for reviewing character progression or investigating past states.
   *
   * Time-travel behavior:
   * - Resolves version valid at the specified world time
   * - Decompresses version payload to reconstruct character state
   * - Returns null if no version exists at that time
   * - User must have access to the current character
   *
   * @param id - UUID of the character
   * @param branchId - UUID of the branch to query version history from
   * @param worldTime - World time to retrieve character state at
   * @param user - Authenticated user making the request
   * @returns Character state at the specified time, or null if not found/no access
   */
  async getCharacterAsOf(
    id: string,
    branchId: string,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<PrismaCharacter | null> {
    // Verify user has access to the character
    const character = await this.findById(id, user);
    if (!character) {
      return null;
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion('character', id, branchId, worldTime);

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as a Character object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaCharacter;
  }
}
