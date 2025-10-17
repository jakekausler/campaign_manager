/**
 * State Variable Service
 * Business logic for StateVariable CRUD operations
 * Handles variable scoping, formula validation, and authorization
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { StateVariable as PrismaStateVariable } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { OptimisticLockException } from '../exceptions';
import type {
  CreateStateVariableInput,
  UpdateStateVariableInput,
  StateVariableWhereInput,
  StateVariableOrderByInput,
  StateVariableSortField,
} from '../inputs/state-variable.input';
import { VariableScope, VariableType } from '../types/state-variable.type';

import { AuditService } from './audit.service';
import { VariableEvaluationService } from './variable-evaluation.service';

@Injectable()
export class StateVariableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly evaluationService: VariableEvaluationService
  ) {}

  /**
   * Create a new state variable
   * Validates formula for derived variables and verifies user has access to scope entity
   */
  async create(
    input: CreateStateVariableInput,
    user: AuthenticatedUser
  ): Promise<PrismaStateVariable> {
    // Validate derived variable has formula
    if (input.type === VariableType.DERIVED && !input.formula) {
      throw new BadRequestException('Derived variables must have a formula');
    }

    // Validate formula if provided
    if (input.formula) {
      const validationResult = this.evaluationService.validateFormula(
        input.formula as Prisma.JsonValue
      );
      if (!validationResult.isValid) {
        throw new BadRequestException(`Invalid formula: ${validationResult.errors.join(', ')}`);
      }
    }

    // Verify scope access (skip for world-level variables)
    if (input.scope !== VariableScope.WORLD && input.scopeId) {
      await this.verifyScopeAccess(input.scope, input.scopeId, user);
    }

    // Create the variable
    const variable = await this.prisma.stateVariable.create({
      data: {
        scope: input.scope,
        scopeId: input.scopeId ?? null,
        key: input.key,
        value: (input.type === VariableType.DERIVED
          ? null
          : (input.value as Prisma.InputJsonValue)) as Prisma.InputJsonValue,
        type: input.type,
        formula: (input.formula
          ? (input.formula as Prisma.InputJsonValue)
          : null) as Prisma.InputJsonValue,
        description: input.description ?? null,
        createdBy: user.id,
      },
    });

    // Create audit entry
    await this.audit.log('state_variable', variable.id, 'CREATE', user.id, {
      scope: variable.scope,
      scopeId: variable.scopeId,
      key: variable.key,
      type: variable.type,
    });

    return variable;
  }

  /**
   * Find variable by ID
   * Ensures user has access to the related scope entity
   */
  async findById(id: string, user: AuthenticatedUser): Promise<PrismaStateVariable | null> {
    const variable = await this.prisma.stateVariable.findUnique({
      where: { id },
    });

    if (!variable || variable.deletedAt) {
      return null;
    }

    // Verify user has access to the scope entity (skip for world-level)
    if (variable.scope !== VariableScope.WORLD && variable.scopeId) {
      try {
        await this.verifyScopeAccess(variable.scope as VariableScope, variable.scopeId, user);
      } catch {
        return null; // Silent access denial
      }
    }

    return variable;
  }

  /**
   * Find many variables with filtering, sorting, and pagination
   */
  async findMany(
    where?: StateVariableWhereInput,
    orderBy?: StateVariableOrderByInput,
    skip?: number,
    take?: number,
    user?: AuthenticatedUser
  ): Promise<PrismaStateVariable[]> {
    // Build Prisma where clause
    const prismaWhere: Prisma.StateVariableWhereInput = where
      ? {
          scope: where.scope,
          scopeId: where.scopeId,
          key: where.key,
          type: where.type,
          isActive: where.isActive,
          createdBy: where.createdBy,
          deletedAt: where.includeDeleted ? undefined : null,
        }
      : {
          deletedAt: null,
        };

    // Add date range filters
    if (where?.createdAfter || where?.createdBefore) {
      prismaWhere.createdAt = {};
      if (where.createdAfter) {
        prismaWhere.createdAt.gte = where.createdAfter;
      }
      if (where.createdBefore) {
        prismaWhere.createdAt.lte = where.createdBefore;
      }
    }

    // Build order by clause
    const prismaOrderBy = orderBy ? this.buildOrderBy(orderBy) : { key: 'asc' as const };

    // Query variables
    const variables = await this.prisma.stateVariable.findMany({
      where: prismaWhere,
      orderBy: prismaOrderBy,
      skip,
      take,
    });

    // Filter by scope access if user provided
    if (user) {
      const accessibleVariables: PrismaStateVariable[] = [];
      for (const variable of variables) {
        // World-level variables are accessible to all
        if (variable.scope === VariableScope.WORLD || !variable.scopeId) {
          accessibleVariables.push(variable);
        } else {
          try {
            await this.verifyScopeAccess(variable.scope as VariableScope, variable.scopeId, user);
            accessibleVariables.push(variable);
          } catch {
            // Skip variables user doesn't have access to
          }
        }
      }
      return accessibleVariables;
    }

    return variables;
  }

  /**
   * Find variables for a specific scope and optional key
   * Returns variables in key order (ASC)
   */
  async findByScope(
    scope: VariableScope,
    scopeId: string | null,
    key: string | undefined,
    user: AuthenticatedUser
  ): Promise<PrismaStateVariable[]> {
    // Verify scope access (skip for world-level)
    if (scope !== VariableScope.WORLD && scopeId) {
      await this.verifyScopeAccess(scope, scopeId, user);
    }

    // Build where clause
    const where: Prisma.StateVariableWhereInput = {
      scope,
      scopeId: scopeId ?? null,
      deletedAt: null,
      isActive: true,
    };

    if (key) {
      where.key = key;
    }

    return this.prisma.stateVariable.findMany({
      where,
      orderBy: {
        key: 'asc',
      },
    });
  }

  /**
   * Update an existing state variable
   * Uses optimistic locking to prevent race conditions
   */
  async update(
    id: string,
    input: UpdateStateVariableInput,
    user: AuthenticatedUser
  ): Promise<PrismaStateVariable> {
    // Fetch existing variable
    const variable = await this.findById(id, user);
    if (!variable) {
      throw new NotFoundException(`StateVariable with ID ${id} not found`);
    }

    // Optimistic locking check
    if (input.expectedVersion !== undefined && variable.version !== input.expectedVersion) {
      throw new OptimisticLockException(
        `StateVariable was modified by another user. Expected version ${input.expectedVersion}, but found ${variable.version}. Please refresh and try again.`,
        input.expectedVersion,
        variable.version
      );
    }

    // Validate formula if changed
    if (input.formula) {
      const validationResult = this.evaluationService.validateFormula(
        input.formula as Prisma.JsonValue
      );
      if (!validationResult.isValid) {
        throw new BadRequestException(`Invalid formula: ${validationResult.errors.join(', ')}`);
      }
    }

    // Build update data
    const updateData: Prisma.StateVariableUpdateInput = {
      version: variable.version + 1,
      updater: {
        connect: { id: user.id },
      },
    };

    if (input.value !== undefined) {
      updateData.value = input.value as Prisma.InputJsonValue;
    }
    if (input.formula !== undefined) {
      updateData.formula = input.formula as Prisma.InputJsonValue;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    // Update variable
    const updated = await this.prisma.stateVariable.update({
      where: { id },
      data: updateData,
    });

    // Create audit entry
    await this.audit.log('state_variable', id, 'UPDATE', user.id, updateData);

    return updated;
  }

  /**
   * Soft delete a state variable
   */
  async delete(id: string, user: AuthenticatedUser): Promise<PrismaStateVariable> {
    // Verify variable exists and user has access
    const variable = await this.findById(id, user);
    if (!variable) {
      throw new NotFoundException(`StateVariable with ID ${id} not found`);
    }

    const deletedAt = new Date();

    // Soft delete
    const deleted = await this.prisma.stateVariable.update({
      where: { id },
      data: { deletedAt },
    });

    // Create audit entry
    await this.audit.log('state_variable', id, 'DELETE', user.id, { deletedAt });

    return deleted;
  }

  /**
   * Toggle active status of a variable
   */
  async toggleActive(
    id: string,
    isActive: boolean,
    user: AuthenticatedUser
  ): Promise<PrismaStateVariable> {
    // Verify variable exists and user has access
    const variable = await this.findById(id, user);
    if (!variable) {
      throw new NotFoundException(`StateVariable with ID ${id} not found`);
    }

    // Update active status
    const updated = await this.prisma.stateVariable.update({
      where: { id },
      data: { isActive },
    });

    // Create audit entry
    await this.audit.log('state_variable', id, 'UPDATE', user.id, { isActive });

    return updated;
  }

  /**
   * Evaluate a variable with provided context
   * Returns evaluation result with trace for debugging
   */
  async evaluateVariable(
    id: string,
    context: Record<string, unknown>,
    user: AuthenticatedUser
  ): Promise<{ success: boolean; value: unknown; trace?: unknown[] }> {
    // Fetch variable
    const variable = await this.findById(id, user);
    if (!variable) {
      throw new NotFoundException(`StateVariable with ID ${id} not found`);
    }

    // Evaluate with trace
    return this.evaluationService.evaluateWithTrace(variable, context);
  }

  /**
   * Verify user has access to a scope entity
   * Checks entity exists and user has campaign access
   */
  private async verifyScopeAccess(
    scope: VariableScope,
    scopeId: string,
    user: AuthenticatedUser
  ): Promise<void> {
    const scopeLower = scope.toLowerCase();

    switch (scopeLower) {
      case 'world': {
        // World scope is always accessible
        return;
      }

      case 'campaign': {
        const campaign = await this.prisma.campaign.findFirst({
          where: {
            id: scopeId,
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
          throw new NotFoundException(`Campaign with ID ${scopeId} not found or access denied`);
        }
        break;
      }

      case 'party': {
        const party = await this.prisma.party.findFirst({
          where: {
            id: scopeId,
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
          throw new NotFoundException(`Party with ID ${scopeId} not found or access denied`);
        }
        break;
      }

      case 'kingdom': {
        const kingdom = await this.prisma.kingdom.findFirst({
          where: {
            id: scopeId,
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
          throw new NotFoundException(`Kingdom with ID ${scopeId} not found or access denied`);
        }
        break;
      }

      case 'settlement': {
        const settlement = await this.prisma.settlement.findFirst({
          where: {
            id: scopeId,
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

        if (!settlement) {
          throw new NotFoundException(`Settlement with ID ${scopeId} not found or access denied`);
        }
        break;
      }

      case 'structure': {
        const structure = await this.prisma.structure.findFirst({
          where: {
            id: scopeId,
            deletedAt: null,
            settlement: {
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
          },
        });

        if (!structure) {
          throw new NotFoundException(`Structure with ID ${scopeId} not found or access denied`);
        }
        break;
      }

      case 'character': {
        const character = await this.prisma.character.findFirst({
          where: {
            id: scopeId,
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

        if (!character) {
          throw new NotFoundException(`Character with ID ${scopeId} not found or access denied`);
        }
        break;
      }

      case 'location': {
        // Location is tied to World, not Campaign directly
        // We verify the location exists and is not deleted
        // Campaign-level access control for location variables is handled at the World level
        const location = await this.prisma.location.findFirst({
          where: {
            id: scopeId,
            deletedAt: null,
            world: {
              deletedAt: null,
            },
          },
        });

        if (!location) {
          throw new NotFoundException(`Location with ID ${scopeId} not found or access denied`);
        }
        break;
      }

      case 'event': {
        const event = await this.prisma.event.findFirst({
          where: {
            id: scopeId,
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

        if (!event) {
          throw new NotFoundException(`Event with ID ${scopeId} not found or access denied`);
        }
        break;
      }

      case 'encounter': {
        const encounter = await this.prisma.encounter.findFirst({
          where: {
            id: scopeId,
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

        if (!encounter) {
          throw new NotFoundException(`Encounter with ID ${scopeId} not found or access denied`);
        }
        break;
      }

      default:
        throw new BadRequestException(`Unsupported scope: ${scope}`);
    }
  }

  /**
   * Build Prisma order by clause from GraphQL input
   */
  private buildOrderBy(
    orderBy: StateVariableOrderByInput
  ): Prisma.StateVariableOrderByWithRelationInput {
    const sortField = orderBy.field ?? 'KEY';
    const sortOrder = (orderBy.order ?? 'ASC').toLowerCase() as 'asc' | 'desc';

    const fieldMap: Record<StateVariableSortField, string> = {
      KEY: 'key',
      SCOPE: 'scope',
      TYPE: 'type',
      CREATED_AT: 'createdAt',
      UPDATED_AT: 'updatedAt',
    };

    const prismaField = fieldMap[sortField];

    return {
      [prismaField]: sortOrder,
    };
  }
}
