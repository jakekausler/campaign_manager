/**
 * Structure Service
 * Business logic for Structure operations
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Structure as PrismaStructure, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateStructureInput, UpdateStructureInput } from '../inputs/structure.input';

@Injectable()
export class StructureService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.structure.create({
      data: {
        settlementId: input.settlementId,
        type: input.type,
        name: input.name,
        level: input.level ?? 1,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        variableSchemas: (input.variableSchemas ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Update a structure
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

    return this.prisma.structure.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.level !== undefined && { level: input.level }),
        ...(input.variables !== undefined && {
          variables: input.variables as Prisma.InputJsonValue,
        }),
        ...(input.variableSchemas !== undefined && {
          variableSchemas: input.variableSchemas as Prisma.InputJsonValue,
        }),
      },
    });
  }

  /**
   * Delete a structure (soft delete)
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

    return this.prisma.structure.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
