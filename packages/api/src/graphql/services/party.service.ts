/**
 * Party Service
 * Business logic for Party operations
 * Implements CRUD with soft delete and archive (no cascade delete)
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
   * Find party by ID
   * Ensures user has access to the campaign
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
   * Find parties by campaign
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
   * Create a new party
   * Only owner or GM can create parties
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
   * Update a party with optimistic locking and versioning
   * Only owner or GM can update
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
   * Soft delete a party
   * Does NOT cascade - parties are kept for audit trail
   * Only owner or GM can delete
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
   * Archive a party
   * Only owner or GM can archive
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
   * Restore an archived party
   * Only owner or GM can restore
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
   * Get party state as it existed at a specific point in world-time
   * Supports time-travel queries for version history
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
   * Calculate average level from party members
   * Returns the mean of all member character levels
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
   * Set party level using manual override
   * This overrides the calculated average level
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
   * Add a character to the party
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
   * Remove a character from the party
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
