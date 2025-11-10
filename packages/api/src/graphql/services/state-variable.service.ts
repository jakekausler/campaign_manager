/**
 * State Variable Service
 *
 * Provides business logic for managing state variables across different scopes within
 * the campaign management system. State variables are dynamic data points that can be
 * either static (stored values) or derived (computed via JSONLogic formulas).
 *
 * Key Features:
 * - Hierarchical scope management (WORLD > CAMPAIGN > PARTY/KINGDOM > SETTLEMENT/CHARACTER > STRUCTURE)
 * - Variable types: STATIC (stored values) and DERIVED (JSONLogic formulas)
 * - JSONLogic formula validation and evaluation
 * - Bitemporal versioning for campaign-scoped and nested entities
 * - Optimistic locking for concurrent updates
 * - Access control based on campaign membership
 * - Dependency graph integration for change propagation
 * - Redis pub/sub for Rules Engine worker notifications
 * - Cache invalidation for computed fields
 *
 * Scope Hierarchy:
 * - WORLD: Global variables accessible across all campaigns
 * - CAMPAIGN: Campaign-specific variables
 * - PARTY: Party-scoped variables (within campaign)
 * - KINGDOM: Kingdom-scoped variables (within campaign)
 * - SETTLEMENT: Settlement-scoped variables (within kingdom)
 * - STRUCTURE: Structure-scoped variables (within settlement)
 * - CHARACTER: Character-scoped variables (within campaign)
 * - LOCATION: Location-scoped variables (within world)
 * - EVENT: Event-scoped variables (within campaign)
 * - ENCOUNTER: Encounter-scoped variables (within campaign)
 *
 * Variable Types:
 * - STATIC: Stores a value directly (JSON type)
 * - DERIVED: Computes value from a JSONLogic formula that references other variables
 *
 * Versioning:
 * Campaign-scoped and nested entities support bitemporal versioning with branches for
 * time-travel queries and alternate timelines. World-scoped variables are not versioned.
 *
 * @class
 * @see VariableEvaluationService for formula evaluation logic
 * @see DependencyGraphService for variable dependency tracking
 * @see VersionService for bitemporal version management
 */

import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import type { StateVariable as PrismaStateVariable } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { CacheService } from '../../common/cache/cache.service';
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
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
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
    private readonly dependencyGraphService: DependencyGraphService,
    private readonly cacheService: CacheService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Create a new state variable.
   *
   * Creates a state variable with the specified scope, type, and optional formula.
   * Validates that derived variables have formulas and that formulas are syntactically
   * correct using JSONLogic validation. Verifies user has access to the scope entity
   * (campaign, settlement, etc.) before allowing creation.
   *
   * Workflow:
   * 1. Validate that DERIVED type variables include a formula
   * 2. Validate formula syntax using VariableEvaluationService
   * 3. Verify user has access to the scope entity (skip for WORLD scope)
   * 4. Create the variable with appropriate value/formula
   * 5. Create audit log entry
   * 6. Invalidate dependency graph cache for the variable's campaign
   * 7. Invalidate computed fields cache if scope is SETTLEMENT or STRUCTURE
   * 8. Publish Redis event for Rules Engine worker notification
   *
   * @param input - Variable creation data (scope, key, value/formula, type, description)
   * @param user - Authenticated user
   * @returns The newly created StateVariable
   * @throws BadRequestException - If DERIVED variable lacks formula or formula is invalid
   * @throws NotFoundException - If scope entity not found or user lacks access
   *
   * @see VariableEvaluationService.validateFormula for formula validation
   * @see DependencyGraphService.invalidateGraph for cache invalidation
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

        // Invalidate entity's computed fields cache (settlements and structures have computed fields)
        if (variable.scope === VariableScope.SETTLEMENT) {
          await this.cacheService.del(`computed-fields:settlement:${variable.scopeId}:main`);
        } else if (variable.scope === VariableScope.STRUCTURE) {
          await this.cacheService.del(`computed-fields:structure:${variable.scopeId}:main`);
        }

        // Publish Redis event for Rules Engine worker
        await this.pubSub.publish('variable.created', {
          variableId: variable.id,
          campaignId,
          branchId: 'main',
        });
      } catch {
        // If we can't get campaign ID (e.g., location scope), skip invalidation
      }
    }

    return variable;
  }

  /**
   * Find a state variable by ID.
   *
   * Retrieves a single variable by its unique ID, ensuring the user has access to
   * the scope entity. Non-deleted variables are returned, or null if not found or
   * access is denied. Access verification is silently handled (returns null instead
   * of throwing exceptions).
   *
   * @param id - Variable ID
   * @param user - Authenticated user
   * @returns The StateVariable or null if not found/deleted/access denied
   *
   * @see verifyScopeAccess for access control logic
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
   * Find multiple state variables with filtering, sorting, and pagination.
   *
   * Queries state variables with optional filters (scope, key, type, active status, creator,
   * date range), sorting, and pagination. If user is provided, results are filtered to only
   * include variables the user has access to based on scope entity membership.
   *
   * Filtering Options:
   * - scope: Filter by VariableScope (WORLD, CAMPAIGN, etc.)
   * - scopeId: Filter by scope entity ID
   * - key: Filter by exact variable key
   * - type: Filter by VariableType (STATIC, DERIVED)
   * - isActive: Filter by active status
   * - createdBy: Filter by creator user ID
   * - createdAfter/createdBefore: Filter by creation date range
   * - includeDeleted: Include soft-deleted variables (default: false)
   *
   * @param where - Optional filter criteria
   * @param orderBy - Optional sort specification (field and order)
   * @param skip - Optional pagination offset
   * @param take - Optional pagination limit
   * @param user - Optional authenticated user for access control
   * @returns Array of StateVariables matching criteria and accessible to user
   *
   * @see buildOrderBy for order-by clause construction
   * @see verifyScopeAccess for access control logic
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
   * Find state variables for a specific scope and optional key.
   *
   * Retrieves all active, non-deleted variables for a given scope entity, with optional
   * key filtering. Results are sorted by key (ASC). User access to the scope entity is
   * verified before querying (except for WORLD scope).
   *
   * Common Use Cases:
   * - Get all variables for a settlement: findByScope(SETTLEMENT, settlementId, undefined, user)
   * - Get specific variable by scope+key: findByScope(CAMPAIGN, campaignId, "gold", user)
   *
   * @param scope - The VariableScope to query (WORLD, CAMPAIGN, SETTLEMENT, etc.)
   * @param scopeId - The scope entity ID (null for WORLD scope)
   * @param key - Optional variable key for exact match filtering
   * @param user - Authenticated user
   * @returns Array of StateVariables sorted by key (ASC)
   * @throws NotFoundException - If scope entity not found or user lacks access
   *
   * @see verifyScopeAccess for access control logic
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
   * Update an existing state variable.
   *
   * Updates variable properties (value, formula, description, isActive) with optimistic
   * locking to prevent race conditions. Optionally creates a Version snapshot for
   * bitemporal queries (time-travel and branch support).
   *
   * Optimistic Locking:
   * If expectedVersion is provided in input, it must match the current variable version.
   * On version mismatch, throws OptimisticLockException to force client refresh.
   *
   * Versioning:
   * If branchId is provided and the variable is campaign-scoped or nested within campaign,
   * a Version record is created atomically with the update. World-scoped variables are
   * not versioned. The validFrom timestamp is derived from:
   * 1. worldTime parameter (if provided)
   * 2. Campaign.currentWorldTime (if available)
   * 3. Current system time (fallback)
   *
   * Workflow:
   * 1. Fetch existing variable and verify user access
   * 2. Validate optimistic lock version (if provided)
   * 3. Validate formula (if changed)
   * 4. Build update data with incremented version
   * 5. If versioning: Create Version snapshot in transaction with update
   * 6. If no versioning: Perform standalone update
   * 7. Create audit log entry
   * 8. Invalidate dependency graph and computed fields caches
   * 9. Publish Redis event for Rules Engine worker
   *
   * @param id - Variable ID
   * @param input - Update data (value, formula, description, isActive, expectedVersion)
   * @param user - Authenticated user
   * @param branchId - Optional branch ID for versioning (enables bitemporal support)
   * @param worldTime - Optional world time for version validFrom timestamp
   * @returns The updated StateVariable
   * @throws NotFoundException - If variable not found or user lacks access
   * @throws OptimisticLockException - If expectedVersion doesn't match current version
   * @throws BadRequestException - If formula invalid or branch not found
   *
   * @see VersionService.createVersion for version snapshot logic
   * @see OptimisticLockException for concurrent update handling
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

        // Invalidate entity's computed fields cache (settlements and structures have computed fields)
        if (updated.scope === VariableScope.SETTLEMENT) {
          await this.cacheService.del(`computed-fields:settlement:${updated.scopeId}:main`);
        } else if (updated.scope === VariableScope.STRUCTURE) {
          await this.cacheService.del(`computed-fields:structure:${updated.scopeId}:main`);
        }

        // Publish Redis event for Rules Engine worker
        await this.pubSub.publish('variable.updated', {
          variableId: updated.id,
          campaignId,
          branchId: 'main',
        });
      } catch {
        // If we can't get campaign ID (e.g., location scope), skip invalidation
      }
    }

    return updated;
  }

  /**
   * Soft delete a state variable.
   *
   * Marks a variable as deleted by setting deletedAt timestamp. The record remains in
   * the database but is filtered out from normal queries. User access to the scope
   * entity is verified before deletion.
   *
   * Workflow:
   * 1. Verify variable exists and user has access
   * 2. Set deletedAt timestamp to current time
   * 3. Create audit log entry
   * 4. Invalidate dependency graph cache
   * 5. Invalidate computed fields cache (if SETTLEMENT or STRUCTURE scope)
   * 6. Publish Redis event for Rules Engine worker
   *
   * @param id - Variable ID to soft delete
   * @param user - Authenticated user
   * @returns The soft-deleted StateVariable with deletedAt timestamp
   * @throws NotFoundException - If variable not found or user lacks access
   *
   * @see DependencyGraphService.invalidateGraph for cache invalidation
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

        // Invalidate entity's computed fields cache (settlements and structures have computed fields)
        if (deleted.scope === VariableScope.SETTLEMENT) {
          await this.cacheService.del(`computed-fields:settlement:${deleted.scopeId}:main`);
        } else if (deleted.scope === VariableScope.STRUCTURE) {
          await this.cacheService.del(`computed-fields:structure:${deleted.scopeId}:main`);
        }

        // Publish Redis event for Rules Engine worker
        await this.pubSub.publish('variable.deleted', {
          variableId: deleted.id,
          campaignId,
          branchId: 'main',
        });
      } catch {
        // If we can't get campaign ID (e.g., location scope), skip invalidation
      }
    }

    return deleted;
  }

  /**
   * Toggle the active status of a state variable.
   *
   * Updates the isActive flag to enable or disable a variable. Inactive variables
   * remain in the database but can be filtered in queries. No cache invalidation or
   * Rules Engine notification is performed (lightweight operation).
   *
   * @param id - Variable ID
   * @param isActive - New active status (true = active, false = inactive)
   * @param user - Authenticated user
   * @returns The updated StateVariable with new isActive status
   * @throws NotFoundException - If variable not found or user lacks access
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
   * Evaluate a state variable with provided context.
   *
   * Evaluates a variable using the VariableEvaluationService. For STATIC variables,
   * returns the stored value. For DERIVED variables, evaluates the JSONLogic formula
   * against the provided context. Returns a detailed result with success status, value,
   * optional error, and trace information for debugging.
   *
   * Evaluation Trace:
   * The trace includes step-by-step evaluation details useful for debugging complex
   * formulas and understanding how derived values are computed.
   *
   * @param id - Variable ID to evaluate
   * @param context - Context data for formula evaluation (other variables, entity state)
   * @param user - Authenticated user
   * @returns Evaluation result with success, value, optional error, and trace
   * @throws NotFoundException - If variable not found or user lacks access
   *
   * @see VariableEvaluationService.evaluateWithTrace for evaluation logic
   * @see EvaluationStep for trace structure
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
   * Verify user has access to a scope entity.
   *
   * Validates that the scope entity exists and the user has access based on campaign
   * membership (owner or member). Access control logic varies by scope:
   *
   * - WORLD: Always accessible (returns immediately)
   * - CAMPAIGN: User must be campaign owner or member
   * - PARTY/KINGDOM/SETTLEMENT/STRUCTURE/CHARACTER/EVENT/ENCOUNTER: User must be campaign owner or member (via entity's campaign)
   * - LOCATION: Entity must exist in a valid world (no campaign-level check)
   *
   * This method throws exceptions for access denied or entity not found, enabling
   * consistent error handling across all CRUD operations.
   *
   * @param scope - The VariableScope to verify (WORLD, CAMPAIGN, SETTLEMENT, etc.)
   * @param scopeId - The scope entity ID
   * @param user - Authenticated user
   * @throws NotFoundException - If entity not found or user lacks access
   * @throws BadRequestException - If unsupported scope provided
   *
   * @private
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
   * Get campaign ID from a scope entity.
   *
   * Resolves the campaign ID for a given scope entity. Required for version tracking
   * since Version records are tied to campaigns. Traverses the entity hierarchy to
   * find the associated campaign.
   *
   * Resolution Logic:
   * - CAMPAIGN: scopeId is the campaign ID
   * - PARTY/KINGDOM/CHARACTER/EVENT/ENCOUNTER: Direct campaignId foreign key
   * - SETTLEMENT: Via kingdom.campaignId
   * - STRUCTURE: Via settlement.kingdom.campaignId
   * - LOCATION: Not supported (throws exception - no direct campaign association)
   *
   * @param scope - The VariableScope
   * @param scopeId - The scope entity ID
   * @returns The campaign ID
   * @throws NotFoundException - If entity not found
   * @throws BadRequestException - If scope doesn't have campaign association (LOCATION) or unsupported scope
   *
   * @private
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
   * Get variable state as it existed at a specific point in world-time.
   *
   * Performs a bitemporal query to retrieve the variable's state as it existed at
   * a given world-time on a specific branch. This supports "time-travel" queries
   * for viewing historical variable values.
   *
   * Only campaign-scoped and nested variables support versioning. World-scoped
   * variables throw an exception since they have no version history.
   *
   * Workflow:
   * 1. Verify user has access to the variable
   * 2. Validate variable is versionable (not WORLD scope)
   * 3. Resolve version at the specified time using VersionService
   * 4. Decompress and return the historical payload
   *
   * @param id - Variable ID
   * @param branchId - Branch ID to query
   * @param worldTime - The world-time to query at
   * @param user - Authenticated user
   * @returns The StateVariable as it existed at worldTime, or null if no version found
   * @throws BadRequestException - If variable is WORLD-scoped (not versionable)
   * @throws NotFoundException - If variable not found or user lacks access
   *
   * @see VersionService.resolveVersion for bitemporal version resolution
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
   * Get full version history for a state variable.
   *
   * Retrieves all Version records for a variable on a specific branch, ordered by
   * validFrom (DESC). Returns version metadata without the full payload for efficient
   * history browsing.
   *
   * Only campaign-scoped and nested variables support versioning. World-scoped
   * variables throw an exception since they have no version history.
   *
   * @param id - Variable ID
   * @param branchId - Branch ID to query
   * @param user - Authenticated user
   * @returns Array of version metadata (version, validFrom, validTo, createdBy, createdAt)
   * @throws BadRequestException - If variable is WORLD-scoped (not versionable)
   * @throws NotFoundException - If variable not found or user lacks access
   *
   * @see VersionService.findVersionHistory for version retrieval logic
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
   * Build Prisma order-by clause from GraphQL input.
   *
   * Converts GraphQL StateVariableOrderByInput (field + order) to Prisma's
   * StateVariableOrderByWithRelationInput format. Maps GraphQL field names
   * to Prisma model field names.
   *
   * Supported Sort Fields:
   * - KEY: Sort by variable key (alphabetical)
   * - SCOPE: Sort by scope (WORLD, CAMPAIGN, etc.)
   * - TYPE: Sort by type (STATIC, DERIVED)
   * - CREATED_AT: Sort by creation timestamp
   * - UPDATED_AT: Sort by last update timestamp
   *
   * @param orderBy - GraphQL order-by input (field and order)
   * @returns Prisma order-by clause
   *
   * @private
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
