/**
 * Character Service
 * Business logic for Character operations
 * Implements CRUD with soft delete and archive (no cascade delete)
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Character as PrismaCharacter, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type { CreateCharacterInput, UpdateCharacterData } from '../inputs/character.input';

import { AuditService } from './audit.service';
import { VersionService, type CreateVersionInput } from './version.service';

@Injectable()
export class CharacterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly versionService: VersionService
  ) {}

  /**
   * Find character by ID
   * Ensures user has access to the campaign
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
   * Find characters by campaign
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
   * Find characters by party
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
   * Create a new character
   * Only owner or GM can create characters
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
   * Update a character with optimistic locking and versioning
   * Only owner or GM can update
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

    return updated;
  }

  /**
   * Soft delete a character
   * Does NOT cascade - characters are kept for audit trail
   * Only owner or GM can delete
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
   * Archive a character
   * Only owner or GM can archive
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
   * Restore an archived character
   * Only owner or GM can restore
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
   * Check if user has edit permissions for a campaign
   * Owner or GM role can edit
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
   * Get character state as it existed at a specific point in world-time
   * Supports time-travel queries for version history
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
