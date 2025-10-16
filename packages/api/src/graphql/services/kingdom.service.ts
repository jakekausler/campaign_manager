/**
 * Kingdom Service
 * Business logic for Kingdom operations
 * Implements CRUD with soft delete, archive, and cascade delete to Settlements
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Kingdom as PrismaKingdom, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateKingdomInput, UpdateKingdomInput } from '../inputs/kingdom.input';

import { AuditService } from './audit.service';

@Injectable()
export class KingdomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Find kingdom by ID
   * Ensures user has access to the campaign
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaKingdom | null> {
    const kingdom = await this.prisma.kingdom.findFirst({
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

    return kingdom;
  }

  /**
   * Find kingdoms by campaign
   */
  async findByCampaign(campaignId: string, user: AuthenticatedUser): Promise<PrismaKingdom[]> {
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

    return this.prisma.kingdom.findMany({
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
   * Create a new kingdom
   * Only owner or GM can create kingdoms
   */
  async create(input: CreateKingdomInput, user: AuthenticatedUser): Promise<PrismaKingdom> {
    // Verify campaign exists and user has permission
    const hasPermission = await this.hasEditPermission(input.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to create kingdoms in this campaign'
      );
    }

    // Create kingdom
    const kingdom = await this.prisma.kingdom.create({
      data: {
        name: input.name,
        campaignId: input.campaignId,
        level: input.level ?? 1,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        variableSchemas: (input.variableSchemas ?? []) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('kingdom', kingdom.id, 'CREATE', user.id, {
      name: kingdom.name,
      campaignId: kingdom.campaignId,
      level: kingdom.level,
    });

    return kingdom;
  }

  /**
   * Update a kingdom
   * Only owner or GM can update
   */
  async update(
    id: string,
    input: UpdateKingdomInput,
    user: AuthenticatedUser
  ): Promise<PrismaKingdom> {
    // Verify kingdom exists and user has access
    const kingdom = await this.findById(id, user);
    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(kingdom.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this kingdom');
    }

    // Build update data
    const updateData: Prisma.KingdomUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.level !== undefined) updateData.level = input.level;
    if (input.variables !== undefined)
      updateData.variables = input.variables as Prisma.InputJsonValue;
    if (input.variableSchemas !== undefined)
      updateData.variableSchemas = input.variableSchemas as Prisma.InputJsonValue;

    // Update kingdom
    const updated = await this.prisma.kingdom.update({
      where: { id },
      data: updateData,
    });

    // Create audit entry
    await this.audit.log('kingdom', id, 'UPDATE', user.id, updateData);

    return updated;
  }

  /**
   * Soft delete a kingdom
   * Cascades to Settlements (which will cascade to Structures)
   * Only owner or GM can delete
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaKingdom> {
    // Verify kingdom exists and user has access
    const kingdom = await this.findById(id, user);
    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${id} not found`);
    }

    // Verify user has delete permissions
    const hasPermission = await this.hasEditPermission(kingdom.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this kingdom');
    }

    const deletedAt = new Date();

    // Soft delete kingdom
    const deleted = await this.prisma.kingdom.update({
      where: { id },
      data: { deletedAt },
    });

    // Cascade delete to settlements (which will cascade to structures)
    await this.cascadeDelete(id, deletedAt);

    // Create audit entry
    await this.audit.log('kingdom', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archive a kingdom
   * Does not cascade to settlements
   * Only owner or GM can archive
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaKingdom> {
    // Verify kingdom exists and user has access
    const kingdom = await this.findById(id, user);
    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(kingdom.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this kingdom');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.kingdom.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('kingdom', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restore an archived kingdom
   * Only owner or GM can restore
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaKingdom> {
    // Find kingdom even if archived
    const kingdom = await this.prisma.kingdom.findFirst({
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

    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.hasEditPermission(kingdom.campaignId, user);
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this kingdom');
    }

    const restored = await this.prisma.kingdom.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('kingdom', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }

  /**
   * Cascade soft delete to all settlements and their structures
   */
  private async cascadeDelete(kingdomId: string, deletedAt: Date): Promise<void> {
    // Find all settlements in this kingdom
    const settlements = await this.prisma.settlement.findMany({
      where: { kingdomId, deletedAt: null },
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
}
