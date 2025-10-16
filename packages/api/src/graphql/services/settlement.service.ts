/**
 * Settlement Service
 * Business logic for Settlement operations
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Settlement as PrismaSettlement, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { CreateSettlementInput, UpdateSettlementInput } from '../inputs/settlement.input';

@Injectable()
export class SettlementService {
  constructor(private readonly prisma: PrismaService) {}

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
    });

    if (!kingdom) {
      throw new ForbiddenException(
        'You do not have permission to create settlements in this kingdom'
      );
    }

    return this.prisma.settlement.create({
      data: {
        kingdomId: input.kingdomId,
        locationId: input.locationId,
        name: input.name,
        level: input.level ?? 1,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        variableSchemas: (input.variableSchemas ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Update a settlement
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

    return this.prisma.settlement.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
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
   * Delete a settlement (soft delete)
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

    return this.prisma.settlement.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
