/**
 * Structure Service
 * Business logic for Structure operations
 * Implements CRUD with soft delete and archive (no cascade delete)
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Structure as PrismaStructure, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateStructureInput, UpdateStructureInput } from '../inputs/structure.input';

import { AuditService } from './audit.service';

@Injectable()
export class StructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Find structure by ID
   * Ensures user has access to the settlement's campaign
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaStructure | null> {
    const structure = await this.prisma.structure.findFirst({
      where: {
        id,
        deletedAt: null,
        settlement: {
          deletedAt: null,
          kingdom: {
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
        },
      },
    });

    return structure;
  }

  /**
   * Find structures by settlement
   */
  async findBySettlement(
    settlementId: string,
    user: AuthenticatedUser
  ): Promise<PrismaStructure[]> {
    // First verify user has access to this settlement
    const settlement = await this.prisma.settlement.findFirst({
      where: {
        id: settlementId,
        deletedAt: null,
        kingdom: {
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
      },
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement with ID ${settlementId} not found`);
    }

    return this.prisma.structure.findMany({
      where: {
        settlementId,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find structures by settlement IDs (for DataLoader)
   * IMPORTANT: This method performs authorization checks to prevent
   * unauthorized access through the DataLoader cache
   */
  async findBySettlementIds(
    settlementIds: readonly string[],
    user: AuthenticatedUser
  ): Promise<PrismaStructure[][]> {
    // First, verify user has access to all requested settlements
    const accessibleSettlements = await this.prisma.settlement.findMany({
      where: {
        id: {
          in: [...settlementIds],
        },
        deletedAt: null,
        kingdom: {
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
      },
      select: { id: true },
    });

    const accessibleIds = new Set(accessibleSettlements.map((s) => s.id));

    // Only fetch structures for settlements user has access to
    const structures = await this.prisma.structure.findMany({
      where: {
        settlementId: {
          in: [...accessibleIds],
        },
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Group structures by settlementId
    const structuresBySettlement = new Map<string, PrismaStructure[]>();
    structures.forEach((structure) => {
      const existing = structuresBySettlement.get(structure.settlementId) || [];
      existing.push(structure);
      structuresBySettlement.set(structure.settlementId, existing);
    });

    // Return in same order as input IDs
    // Return empty array for settlements user doesn't have access to
    return settlementIds.map((id) => {
      if (!accessibleIds.has(id)) {
        return []; // User doesn't have access to this settlement
      }
      return structuresBySettlement.get(id) || [];
    });
  }

  /**
   * Create a new structure
   * Only owner or GM can create structures
   */
  async create(input: CreateStructureInput, user: AuthenticatedUser): Promise<PrismaStructure> {
    // Verify user has access to create structures in this settlement
    const settlement = await this.prisma.settlement.findFirst({
      where: {
        id: input.settlementId,
        deletedAt: null,
        kingdom: {
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
      },
    });

    if (!settlement) {
      throw new ForbiddenException(
        'You do not have permission to create structures in this settlement'
      );
    }

    const structure = await this.prisma.structure.create({
      data: {
        settlementId: input.settlementId,
        type: input.type,
        name: input.name,
        level: input.level ?? 1,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        variableSchemas: (input.variableSchemas ?? []) as Prisma.InputJsonValue,
      },
    });

    // Create audit entry
    await this.audit.log('structure', structure.id, 'CREATE', user.id, {
      name: structure.name,
      settlementId: structure.settlementId,
      type: structure.type,
      level: structure.level,
    });

    return structure;
  }

  /**
   * Update a structure
   * Only owner or GM can update
   */
  async update(
    id: string,
    input: UpdateStructureInput,
    user: AuthenticatedUser
  ): Promise<PrismaStructure> {
    // Verify structure exists and user has access
    const structure = await this.findById(id, user);
    if (!structure) {
      throw new NotFoundException(`Structure with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to update this structure');
    }

    // Build update data
    const updateData: Prisma.StructureUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.level !== undefined) updateData.level = input.level;
    if (input.variables !== undefined)
      updateData.variables = input.variables as Prisma.InputJsonValue;
    if (input.variableSchemas !== undefined)
      updateData.variableSchemas = input.variableSchemas as Prisma.InputJsonValue;

    const updated = await this.prisma.structure.update({
      where: { id },
      data: updateData,
    });

    // Create audit entry
    await this.audit.log('structure', id, 'UPDATE', user.id, updateData);

    return updated;
  }

  /**
   * Soft delete a structure
   * Does NOT cascade - structures are kept for audit trail
   * Only owner or GM can delete
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaStructure> {
    // Verify structure exists and user has access
    const structure = await this.findById(id, user);
    if (!structure) {
      throw new NotFoundException(`Structure with ID ${id} not found`);
    }

    // Verify user has delete permissions
    const hasPermission = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to delete this structure');
    }

    const deletedAt = new Date();

    const deleted = await this.prisma.structure.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('structure', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Archive a structure
   * Only owner or GM can archive
   */
  async archive(id: string, user: AuthenticatedUser): Promise<PrismaStructure> {
    // Verify structure exists and user has access
    const structure = await this.findById(id, user);
    if (!structure) {
      throw new NotFoundException(`Structure with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to archive this structure');
    }

    const archivedAt = new Date();

    const archived = await this.prisma.structure.update({
      where: { id },
      data: { archivedAt },
    });

    // Create audit entry
    await this.audit.log('structure', id, 'ARCHIVE', user.id, { archivedAt });

    return archived;
  }

  /**
   * Restore an archived structure
   * Only owner or GM can restore
   */
  async restore(id: string, user: AuthenticatedUser): Promise<PrismaStructure> {
    // Find structure even if archived
    const structure = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!structure) {
      throw new NotFoundException(`Structure with ID ${id} not found`);
    }

    // Verify user has edit permissions
    const hasPermission = await this.prisma.structure.findFirst({
      where: {
        id,
        settlement: {
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
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to restore this structure');
    }

    const restored = await this.prisma.structure.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Create audit entry
    await this.audit.log('structure', id, 'RESTORE', user.id, { archivedAt: null });

    return restored;
  }
}
