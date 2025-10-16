/**
 * Campaign Service
 * Business logic for Campaign operations
 * Implements CRUD with soft delete, archive, and cascade delete to child entities
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Campaign as PrismaCampaign, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateCampaignInput, UpdateCampaignInput } from '../inputs/campaign.input';

import { AuditService } from './audit.service';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Find campaign by ID
   * Ensures user has access to the campaign
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaCampaign | null> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id,
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

    return campaign;
  }

  /**
   * Find all campaigns accessible to the user
   */
  async findAll(user: AuthenticatedUser): Promise<PrismaCampaign[]> {
    return this.prisma.campaign.findMany({
      where: {
        deletedAt: null,
        archivedAt: null,
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
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Create a new campaign
   * User becomes the owner and a default branch is created
   */
  async create(input: CreateCampaignInput, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Verify world exists
    const world = await this.prisma.world.findFirst({
      where: { id: input.worldId, deletedAt: null },
    });

    if (!world) {
      throw new NotFoundException(`World with ID ${input.worldId} not found`);
    }

    // Create campaign
    const campaign = await this.prisma.campaign.create({
      data: {
        name: input.name,
        worldId: input.worldId,
        ownerId: user.id,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
      },
    });

    // Create default branch
    await this.prisma.branch.create({
      data: {
        campaignId: campaign.id,
        name: 'Main',
        description: 'Primary campaign timeline',
      },
    });

    // Create audit entry
    await this.audit.log('campaign', campaign.id, 'CREATE', user.id, {
      name: campaign.name,
      worldId: campaign.worldId,
      settings: campaign.settings,
      isActive: campaign.isActive,
    });

    return campaign;
  }

  /**
   * Update a campaign
   * Only owner or GM can update
   */
  async update(
    id: string,
    input: UpdateCampaignInput,
    user: AuthenticatedUser
  ): Promise<PrismaCampaign> {
    // Verify campaign exists and user has access
    const campaign = await this.findById(id, user);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify user has edit permissions (owner or GM)
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this campaign');
    }

    // Build update data
    const updateData: Prisma.CampaignUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.settings !== undefined) updateData.settings = input.settings as Prisma.InputJsonValue;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    // Update campaign
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: updateData,
    });

    // Create audit entry
    await this.audit.log('campaign', id, 'UPDATE', user.id, updateData);

    return updated;
  }

  /**
   * Soft delete a campaign
   * Cascades to Events, Encounters, Characters, Parties, Kingdoms, and Branches
   * Only owner or GM can delete
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Verify campaign exists and user has access
    const campaign = await this.findById(id, user);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify user has delete permissions (owner or GM)
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this campaign');
    }

    const deletedAt = new Date();

    // Soft delete campaign
    const deleted = await this.prisma.campaign.update({
      where: { id },
      data: { deletedAt },
    });

    // Cascade delete to child entities
    await this.cascadeDelete(id, deletedAt);

    // Create audit entry
    await this.audit.log('campaign', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archive a campaign
   * Does not cascade to child entities
   * Only owner or GM can archive
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Verify campaign exists and user has access
    const campaign = await this.findById(id, user);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this campaign');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.campaign.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('campaign', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restore an archived campaign
   * Only owner or GM can restore
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaCampaign> {
    // Find campaign even if archived
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id,
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
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(id, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this campaign');
    }

    const restored = await this.prisma.campaign.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('campaign', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Cascade soft delete to all child entities
   * According to ticket requirements, cascade to:
   * - Events
   * - Encounters
   * - Characters
   * - Parties
   * - Kingdoms
   * - Branches
   */
  private async cascadeDelete(campaignId: string, deletedAt: Date): Promise<void> {
    // Soft delete all events
    await this.prisma.event.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Soft delete all encounters
    await this.prisma.encounter.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Soft delete all characters
    await this.prisma.character.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Soft delete all parties
    await this.prisma.party.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });

    // Soft delete all kingdoms (which will trigger their own cascade to settlements)
    const kingdoms = await this.prisma.kingdom.findMany({
      where: { campaignId, deletedAt: null },
      select: { id: true },
    });

    for (const kingdom of kingdoms) {
      // Soft delete kingdom
      await this.prisma.kingdom.update({
        where: { id: kingdom.id },
        data: { deletedAt },
      });

      // Cascade to settlements
      const settlements = await this.prisma.settlement.findMany({
        where: { kingdomId: kingdom.id, deletedAt: null },
        select: { id: true },
      });

      for (const settlement of settlements) {
        // Soft delete settlement
        await this.prisma.settlement.update({
          where: { id: settlement.id },
          data: { deletedAt },
        });

        // Cascade to structures
        await this.prisma.structure.updateMany({
          where: { settlementId: settlement.id, deletedAt: null },
          data: { deletedAt },
        });
      }
    }

    // Soft delete all branches
    await this.prisma.branch.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt },
    });
  }

  /**
   * Check if user has edit permissions for a campaign
   * Owner or GM role can edit
   */
  private async hasEditPermission(campaignId: string, user: AuthenticatedUser): Promise<boolean> {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
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
}
