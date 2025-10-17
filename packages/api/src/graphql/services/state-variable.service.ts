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
import { VariableScope, VariableType, type EvaluationStep } from '../types/state-variable.type';

import { AuditService } from './audit.service';
import { DependencyGraphService } from './dependency-graph.service';
import { VariableEvaluationService } from './variable-evaluation.service';
import { VersionService, type CreateVersionInput } from './version.service';

@Injectable()
export class StateVariableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly evaluationService: VariableEvaluationService,
    private readonly versionService: VersionService,
    private readonly dependencyGraphService: DependencyGraphService
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

    // Invalidate dependency graph cache for this variable's campaign
    if (variable.scope !== VariableScope.WORLD && variable.scopeId) {
      try {
        const campaignId = await this.getCampaignIdForScope(
          variable.scope as VariableScope,
          variable.scopeId
        );
        this.dependencyGraphService.invalidateGraph(campaignId);
      } catch {
        // If we can't get campaign ID (e.g., location scope), skip invalidation
      }
    }

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
   * Optionally creates Version snapshot for bitemporal queries
   *
   * @param id - Variable ID
   * @param input - Update data
   * @param user - Authenticated user
   * @param branchId - Optional branch ID for versioning (defaults to finding "main" branch)
   * @param worldTime - Optional world time for version validFrom (defaults to Campaign.currentWorldTime or now)
   */
  async update(
    id: string,
    input: UpdateStateVariableInput,
    user: AuthenticatedUser,
    branchId?: string,
    worldTime?: Date
  ): Promise<PrismaStateVariable> {
    // Fetch existing variable
    const variable = await this.findById(id, user);
    if (!variable) {
      throw new NotFoundException(`StateVariable with ID ${id} not found`);
    }

    // Optimistic locking check
    if (input.expectedVersion !== undefined && variable.version !== input.expectedVersion) {
      throw new OptimisticLockException(
        `StateVariable with ID ${id} was modified by another user. Expected version ${input.expectedVersion}, but found ${variable.version}. Please refresh and try again.`,
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

    // Check if versioning is requested and possible (campaign-scoped or below)
    const shouldCreateVersion =
      branchId !== undefined && variable.scope !== VariableScope.WORLD && variable.scopeId;

    let updated: PrismaStateVariable;

    if (shouldCreateVersion) {
      // Get campaign ID and verify branch
      const campaignId = await this.getCampaignIdForScope(
        variable.scope as VariableScope,
        variable.scopeId!
      );
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, campaignId, deletedAt: null },
      });

      if (!branch) {
        throw new BadRequestException(
          `Branch with ID ${branchId} not found or does not belong to this variable's campaign`
        );
      }

      // Get world time (from parameter, campaign, or default to now)
      let validFrom = worldTime;
      if (!validFrom) {
        const campaign = await this.prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { currentWorldTime: true },
        });
        validFrom = campaign?.currentWorldTime ?? new Date();
      }

      // Create new version payload (all fields)
      const newPayload: Record<string, unknown> = {
        ...variable,
        ...updateData,
        version: variable.version + 1,
      };

      // Use transaction to atomically update variable and create version
      updated = await this.prisma.$transaction(async (tx) => {
        // Update variable with new version
        const updatedVariable = await tx.stateVariable.update({
          where: { id },
          data: updateData,
        });

        // Create version snapshot
        const versionInput: CreateVersionInput = {
          entityType: 'state_variable',
          entityId: id,
          branchId: branch.id,
          validFrom,
          validTo: null,
          payload: newPayload,
        };
        await this.versionService.createVersion(versionInput, user);

        return updatedVariable;
      });
    } else {
      // Update without versioning
      updated = await this.prisma.stateVariable.update({
        where: { id },
        data: updateData,
      });
    }

    // Create audit entry
    await this.audit.log('state_variable', id, 'UPDATE', user.id, updateData);

    // Invalidate dependency graph cache for this variable's campaign
    if (updated.scope !== VariableScope.WORLD && updated.scopeId) {
      try {
        const campaignId = await this.getCampaignIdForScope(
          updated.scope as VariableScope,
          updated.scopeId
        );
        this.dependencyGraphService.invalidateGraph(campaignId);
      } catch {
        // If we can't get campaign ID (e.g., location scope), skip invalidation
      }
    }

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

    // Invalidate dependency graph cache for this variable's campaign
    if (deleted.scope !== VariableScope.WORLD && deleted.scopeId) {
      try {
        const campaignId = await this.getCampaignIdForScope(
          deleted.scope as VariableScope,
          deleted.scopeId
        );
        this.dependencyGraphService.invalidateGraph(campaignId);
      } catch {
        // If we can't get campaign ID (e.g., location scope), skip invalidation
      }
    }

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
    context: Record<string, unknown> | null | undefined,
    user: AuthenticatedUser
  ): Promise<{
    variableId: string;
    key: string;
    scope: VariableScope;
    scopeId: string | null;
    success: boolean;
    value: unknown;
    error?: string | null;
    trace?: EvaluationStep[] | null;
  }> {
    // Fetch variable
    const variable = await this.findById(id, user);
    if (!variable) {
      throw new NotFoundException(`StateVariable with ID ${id} not found`);
    }

    // Evaluate with trace
    const result = await this.evaluationService.evaluateWithTrace(variable, context ?? undefined);

    // Return complete VariableEvaluationResult
    return {
      variableId: variable.id,
      key: variable.key,
      scope: variable.scope as VariableScope,
      scopeId: variable.scopeId,
      success: result.success,
      value: result.value,
      error: result.error ?? null,
      trace: (result.trace as EvaluationStep[] | undefined) ?? null,
    };
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
   * Get campaign ID from scope entity
   * Required for version tracking which is tied to campaigns
   */
  private async getCampaignIdForScope(scope: VariableScope, scopeId: string): Promise<string> {
    const scopeLower = scope.toLowerCase();

    switch (scopeLower) {
      case 'campaign': {
        return scopeId;
      }

      case 'party': {
        const party = await this.prisma.party.findUnique({
          where: { id: scopeId },
          select: { campaignId: true },
        });
        if (!party) {
          throw new NotFoundException(`Party with ID ${scopeId} not found`);
        }
        return party.campaignId;
      }

      case 'kingdom': {
        const kingdom = await this.prisma.kingdom.findUnique({
          where: { id: scopeId },
          select: { campaignId: true },
        });
        if (!kingdom) {
          throw new NotFoundException(`Kingdom with ID ${scopeId} not found`);
        }
        return kingdom.campaignId;
      }

      case 'settlement': {
        const settlement = await this.prisma.settlement.findUnique({
          where: { id: scopeId },
          select: { kingdom: { select: { campaignId: true } } },
        });
        if (!settlement) {
          throw new NotFoundException(`Settlement with ID ${scopeId} not found`);
        }
        return settlement.kingdom.campaignId;
      }

      case 'structure': {
        const structure = await this.prisma.structure.findUnique({
          where: { id: scopeId },
          select: { settlement: { select: { kingdom: { select: { campaignId: true } } } } },
        });
        if (!structure) {
          throw new NotFoundException(`Structure with ID ${scopeId} not found`);
        }
        return structure.settlement.kingdom.campaignId;
      }

      case 'character': {
        const character = await this.prisma.character.findUnique({
          where: { id: scopeId },
          select: { campaignId: true },
        });
        if (!character) {
          throw new NotFoundException(`Character with ID ${scopeId} not found`);
        }
        return character.campaignId;
      }

      case 'event': {
        const event = await this.prisma.event.findUnique({
          where: { id: scopeId },
          select: { campaignId: true },
        });
        if (!event) {
          throw new NotFoundException(`Event with ID ${scopeId} not found`);
        }
        return event.campaignId;
      }

      case 'encounter': {
        const encounter = await this.prisma.encounter.findUnique({
          where: { id: scopeId },
          select: { campaignId: true },
        });
        if (!encounter) {
          throw new NotFoundException(`Encounter with ID ${scopeId} not found`);
        }
        return encounter.campaignId;
      }

      case 'location': {
        // Location is tied to World, not directly to Campaign
        // For versioning, we need to find which campaign(s) use this location
        // This is more complex - for now, throw an error
        throw new BadRequestException(
          'Location-scoped variables cannot be versioned (no direct campaign association)'
        );
      }

      default:
        throw new BadRequestException(`Cannot get campaign ID for scope: ${scope}`);
    }
  }

  /**
   * Get variable state as it existed at a specific point in world-time
   * Supports time-travel queries for version history
   */
  async getVariableAsOf(
    id: string,
    branchId: string,
    worldTime: Date,
    user: AuthenticatedUser
  ): Promise<PrismaStateVariable | null> {
    // Verify user has access to the variable
    const variable = await this.findById(id, user);
    if (!variable) {
      return null;
    }

    // Only campaign-scoped and below variables can be versioned
    if (variable.scope === VariableScope.WORLD) {
      throw new BadRequestException('World-scoped variables do not have version history');
    }

    // Resolve version at the specified time
    const version = await this.versionService.resolveVersion(
      'state_variable',
      id,
      branchId,
      worldTime
    );

    if (!version) {
      return null;
    }

    // Decompress and return the historical payload as a StateVariable object
    const payload = await this.versionService.decompressVersion(version);

    return payload as PrismaStateVariable;
  }

  /**
   * Get full version history for a variable
   * Returns all Version records ordered by validFrom DESC
   */
  async getVariableHistory(
    id: string,
    branchId: string,
    user: AuthenticatedUser
  ): Promise<
    Array<{
      version: number;
      validFrom: Date;
      validTo: Date | null;
      createdBy: string;
      createdAt: Date;
    }>
  > {
    // Verify user has access to the variable
    const variable = await this.findById(id, user);
    if (!variable) {
      throw new NotFoundException(`StateVariable with ID ${id} not found`);
    }

    // Only campaign-scoped and below variables can be versioned
    if (variable.scope === VariableScope.WORLD) {
      throw new BadRequestException('World-scoped variables do not have version history');
    }

    // Get version history using VersionService
    const history = await this.versionService.findVersionHistory(
      'state_variable',
      id,
      branchId,
      user
    );

    return history.map((v) => ({
      version: v.version,
      validFrom: v.validFrom,
      validTo: v.validTo,
      createdBy: v.createdBy,
      createdAt: v.createdAt,
    }));
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
