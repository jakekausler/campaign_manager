/**
 * Settlement Service
 * Business logic for Settlement operations
 * Implements CRUD with soft delete, archive, and cascade delete to Structures
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Settlement as PrismaSettlement, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateSettlementInput, UpdateSettlementInput } from '../inputs/settlement.input';

import { AuditService } from './audit.service';

@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Find settlement by ID
   * Ensures user has access to the kingdom
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaSettlement | null> {
    const settlement = await this.prisma.settlement.findFirst({
      where: {
        id,
        deletedAt: null,
        kingdom: {
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
      },
    });

    return settlement;
  }

  /**
   * Find settlements by kingdom
   */
  async findByKingdom(kingdomId: string, user: AuthenticatedUser): Promise<PrismaSettlement[]> {
    // First verify user has access to this kingdom
    const kingdom = await this.prisma.kingdom.findFirst({
      where: {
        id: kingdomId,
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

    if (!kingdom) {
      throw new NotFoundException(`Kingdom with ID ${kingdomId} not found`);
    }

    return this.prisma.settlement.findMany({
      where: {
        kingdomId,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Create a new settlement
   * Only owner or GM can create settlements
   */
  async create(input: CreateSettlementInput, user: AuthenticatedUser): Promise<PrismaSettlement> {
    // Verify user has access to create settlements in this kingdom
    const kingdom = await this.prisma.kingdom.findFirst({
      where: {
        id: input.kingdomId,
        deletedAt: null,
        campaign: {
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
      },
      include: {
        campaign: true,
      },
    });

    if (!kingdom) {
      throw new ForbiddenException(
        'You do not have permission to create settlements in this kingdom'
      );
    }

    // Verify location exists and belongs to the same world
    const location = await this.prisma.location.findFirst({
      where: {
        id: input.locationId,
        worldId: kingdom.campaign.worldId,
        deletedAt: null,
      },
    });

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${input.locationId} not found in the same world`
      );
    }

    // Check if location is already used by another settlement
    const existingSettlement = await this.prisma.settlement.findFirst({
      where: {
        locationId: input.locationId,
        deletedAt: null,
      },
    });

    if (existingSettlement) {
      throw new ForbiddenException('This location is already occupied by another settlement');
    }

    const settlement = await this.prisma.settlement.create({
      data: {
        kingdomId: input.kingdomId,
        locationId: input.locationId,
        name: input.name,
        level: input.level ?? 1,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        variableSchemas: (input.variableSchemas ?? []) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('settlement', settlement.id, 'CREATE', user.id, {
      name: settlement.name,
      kingdomId: settlement.kingdomId,
      locationId: settlement.locationId,
      level: settlement.level,
    });

    return settlement;
  }

  /**
   * Update a settlement
   * Only owner or GM can update
   */
  async update(
    id: string,
    input: UpdateSettlementInput,
    user: AuthenticatedUser
  ): Promise<PrismaSettlement> {
    // Verify settlement exists and user has access
    const settlement = await this.findById(id, user);
    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
          campaign: {
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
        },
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this settlement');
    }

    // Build update data
    const updateData: Prisma.SettlementUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.level !== undefined) updateData.level = input.level;
    if (input.variables !== undefined)
      updateData.variables = input.variables as Prisma.InputJsonValue;
    if (input.variableSchemas !== undefined)
      updateData.variableSchemas = input.variableSchemas as Prisma.InputJsonValue;

    const updated = await this.prisma.settlement.update({
      where: { id },
      data: updateData,
    });

    // Create audit entry
    await this.audit.log('settlement', id, 'UPDATE', user.id, updateData);

    return updated;
  }

  /**
   * Soft delete a settlement
   * Cascades to Structures
   * Only owner or GM can delete
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaSettlement> {
    // Verify settlement exists and user has access
    const settlement = await this.findById(id, user);
    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${id} not found`);
    }

    // Verify user has delete permissions
    const hasPermission = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
          campaign: {
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
        },
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this settlement');
    }

    const deletedAt = new Date();

    // Soft delete settlement
    const deleted = await this.prisma.settlement.update({
      where: { id },
      data: { deletedAt },
    });

    // Cascade delete to structures
    await this.prisma.structure.updateMany({
      where: { settlementId: id, deletedAt: null },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('settlement', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archive a settlement
   * Does not cascade to structures
   * Only owner or GM can archive
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaSettlement> {
    // Verify settlement exists and user has access
    const settlement = await this.findById(id, user);
    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
          campaign: {
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
        },
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this settlement');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.settlement.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('settlement', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restore an archived settlement
   * Only owner or GM can restore
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaSettlement> {
    // Find settlement even if archived
    const settlement = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
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
      },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.settlement.findFirst({
      where: {
        id,
        kingdom: {
          campaign: {
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
        },
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this settlement');
    }

    const restored = await this.prisma.settlement.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('settlement', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }
}
