/**
 * State Variable Resolver
 *
 * Provides GraphQL resolvers for managing state variables - dynamic computed fields
 * that can be defined at runtime using JSONLogic expressions. State variables support
 * scoped definitions (GLOBAL, WORLD, CAMPAIGN) and dynamic evaluation with context.
 *
 * State variables consist of:
 * - Schema definitions: Define variable structure, type, scope, and computation logic
 * - Values: Runtime instances of variables with evaluated results
 *
 * Key features:
 * - Runtime variable definition without schema changes
 * - JSONLogic-based computation expressions
 * - Dependency tracking for variable relationships
 * - Scoped visibility (GLOBAL, WORLD, CAMPAIGN)
 * - Type validation (string, number, boolean, object)
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  CreateStateVariableInput,
  EvaluateVariableInput,
  StateVariableOrderByInput,
  StateVariableWhereInput,
  UpdateStateVariableInput,
} from '../inputs/state-variable.input';
import { StateVariableService } from '../services/state-variable.service';
import {
  StateVariable,
  VariableEvaluationResult,
  VariableScope,
} from '../types/state-variable.type';

@Resolver(() => StateVariable)
export class StateVariableResolver {
  constructor(private readonly stateVariableService: StateVariableService) {}

  // ============= Query Resolvers =============

  /**
   * Retrieves a single state variable by ID.
   *
   * Returns the state variable definition including its schema (key, type, scope,
   * computation logic) and metadata (timestamps, version, active status).
   *
   * **Authorization:** JWT authentication required
   *
   * @param id - State variable identifier
   * @param user - Authenticated user (required for access control)
   * @returns State variable if found and accessible, null otherwise
   *
   * @see {@link StateVariableService.findById} for retrieval logic
   */
  @Query(() => StateVariable, {
    nullable: true,
    description: 'Get a state variable by ID',
  })
  @UseGuards(JwtAuthGuard)
  async getStateVariable(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<StateVariable | null> {
    return this.stateVariableService.findById(id, user) as Promise<StateVariable | null>;
  }

  /**
   * Lists state variables with filtering, sorting, and pagination.
   *
   * Supports flexible querying of state variable definitions with filters on key,
   * type, scope, active status, and more. Results can be sorted by various fields
   * and paginated using skip/take.
   *
   * **Authorization:** JWT authentication required
   *
   * @param where - Optional filter criteria (key, type, scope, isActive, etc.)
   * @param orderBy - Optional sort order (by key, createdAt, etc.)
   * @param skip - Number of records to skip for pagination
   * @param take - Maximum number of records to return
   * @param user - Authenticated user (required for access control)
   * @returns Array of state variables matching the query criteria
   *
   * @see {@link StateVariableService.findMany} for query implementation
   */
  @Query(() => [StateVariable], {
    description: 'List state variables with optional filtering and sorting',
  })
  @UseGuards(JwtAuthGuard)
  async listStateVariables(
    @Args('where', { type: () => StateVariableWhereInput, nullable: true })
    where?: StateVariableWhereInput,
    @Args('orderBy', { type: () => StateVariableOrderByInput, nullable: true })
    orderBy?: StateVariableOrderByInput,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @CurrentUser() user?: AuthenticatedUser
  ): Promise<StateVariable[]> {
    return this.stateVariableService.findMany(where, orderBy, skip, take, user) as Promise<
      StateVariable[]
    >;
  }

  /**
   * Retrieves all state variables for a specific scope.
   *
   * Scope determines variable visibility and inheritance:
   * - GLOBAL: Available to all worlds and campaigns
   * - WORLD: Available only within a specific world (requires scopeId)
   * - CAMPAIGN: Available only within a specific campaign (requires scopeId)
   *
   * Optionally filter by variable key to find specific variable definitions
   * across the scope hierarchy.
   *
   * **Authorization:** JWT authentication required
   *
   * @param scope - Variable scope level (GLOBAL, WORLD, or CAMPAIGN)
   * @param scopeId - Scope identifier (required for WORLD/CAMPAIGN scopes, null for GLOBAL)
   * @param key - Optional variable key to filter by specific variable name
   * @param user - Authenticated user (required for access control)
   * @returns Array of state variables within the specified scope
   *
   * @see {@link StateVariableService.findByScope} for scope resolution logic
   */
  @Query(() => [StateVariable], {
    description: 'Get all variables for a specific scope and optional key',
  })
  @UseGuards(JwtAuthGuard)
  async getVariablesForScope(
    @Args('scope', { type: () => VariableScope }) scope: VariableScope,
    @Args('scopeId', { type: () => ID, nullable: true }) scopeId: string | null | undefined,
    @Args('key', { type: () => String, nullable: true }) key: string | null | undefined,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<StateVariable[]> {
    return this.stateVariableService.findByScope(
      scope,
      scopeId ?? null,
      key ?? undefined,
      user
    ) as Promise<StateVariable[]>;
  }

  /**
   * Evaluates a state variable with provided context data.
   *
   * Executes the variable's JSONLogic computation expression using the supplied
   * context object. The context provides input data for the expression evaluation
   * (e.g., entity properties, world state, custom values).
   *
   * Returns both the computed value and metadata about the evaluation including
   * success status, type information, and any dependencies used.
   *
   * **Authorization:** JWT authentication required
   *
   * @param input - Evaluation input containing variableId and context data
   * @param user - Authenticated user (required for access control)
   * @returns Evaluation result with computed value and metadata
   *
   * @see {@link StateVariableService.evaluateVariable} for evaluation logic
   * @see {@link VariableEvaluationResult} for result structure
   */
  @Query(() => VariableEvaluationResult, {
    description: 'Evaluate a state variable with custom context',
  })
  @UseGuards(JwtAuthGuard)
  async evaluateStateVariable(
    @Args('input') input: EvaluateVariableInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VariableEvaluationResult> {
    return this.stateVariableService.evaluateVariable(input.variableId, input.context, user);
  }

  // ============= Mutation Resolvers =============

  /**
   * Creates a new state variable definition.
   *
   * Defines a new dynamic computed field that can be evaluated at runtime.
   * The variable includes a JSONLogic expression for computation, type validation,
   * scope rules, and optional dependency tracking for relationship analysis.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Variable starts in active state (isActive: true)
   * - Initializes version counter to 1
   * - Adds dependency relationships if specified
   *
   * @param input - Variable definition data (key, type, scope, valueType, computation, dependencies)
   * @param user - Authenticated user creating the variable
   * @returns Newly created state variable definition
   *
   * @see {@link StateVariableService.create} for validation and creation logic
   */
  @Mutation(() => StateVariable, {
    description: 'Create a new state variable',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createStateVariable(
    @Args('input') input: CreateStateVariableInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<StateVariable> {
    return this.stateVariableService.create(input, user) as Promise<StateVariable>;
  }

  /**
   * Updates an existing state variable definition.
   *
   * Modifies variable properties such as name, description, computation logic,
   * type validation, or dependencies. Partial updates are supported - only
   * provided fields will be modified.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff of changes
   * - Increments version counter
   * - Updates updatedAt timestamp and updatedBy user
   * - Modifies dependency relationships if specified
   *
   * @param id - State variable identifier
   * @param input - Fields to update (partial update supported)
   * @param user - Authenticated user performing the update
   * @returns Updated state variable definition
   *
   * @see {@link StateVariableService.update} for update logic and validation
   */
  @Mutation(() => StateVariable, {
    description: 'Update an existing state variable',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateStateVariable(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStateVariableInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<StateVariable> {
    return this.stateVariableService.update(id, input, user) as Promise<StateVariable>;
  }

  /**
   * Soft deletes a state variable definition.
   *
   * Marks the variable as deleted by setting deletedAt timestamp. The variable
   * is excluded from normal queries but data is preserved. This allows for
   * potential restoration and maintains audit trail integrity.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Variable excluded from normal queries
   * - Data preserved for audit purposes
   * - Creates audit log entry
   * - Dependency relationships preserved but inactive
   *
   * @param id - State variable identifier
   * @param user - Authenticated user performing the deletion
   * @returns True if deletion successful
   *
   * @see {@link StateVariableService.delete} for soft delete implementation
   */
  @Mutation(() => Boolean, {
    description: 'Delete a state variable (soft delete)',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteStateVariable(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<boolean> {
    await this.stateVariableService.delete(id, user);
    return true;
  }

  /**
   * Toggles the active status of a state variable.
   *
   * Controls whether a variable definition is active and available for evaluation.
   * Inactive variables are still visible in queries but won't be evaluated by
   * the rules engine or included in computed field processing.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Updates isActive flag
   * - Creates audit log entry
   * - Updates updatedAt timestamp and updatedBy user
   * - Increments version counter
   *
   * @param id - State variable identifier
   * @param isActive - New active status (true to activate, false to deactivate)
   * @param user - Authenticated user performing the toggle
   * @returns Updated state variable with new active status
   *
   * @see {@link StateVariableService.toggleActive} for toggle implementation
   */
  @Mutation(() => StateVariable, {
    description: 'Toggle active status of a state variable',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async toggleStateVariableActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('isActive') isActive: boolean,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<StateVariable> {
    return this.stateVariableService.toggleActive(id, isActive, user) as Promise<StateVariable>;
  }

  // ============= Field Resolvers =============

  /**
   * Resolves the createdBy field to the user ID who created the variable.
   *
   * @param variable - Parent state variable instance
   * @returns User ID of the creator
   */
  @ResolveField('createdBy', () => ID)
  resolveCreatedBy(@Parent() variable: StateVariable): string {
    return variable.createdBy;
  }

  /**
   * Resolves the updatedBy field to the user ID who last updated the variable.
   *
   * Returns null if the variable has never been updated (only created).
   *
   * @param variable - Parent state variable instance
   * @returns User ID of the last updater, or null if never updated
   */
  @ResolveField('updatedBy', () => ID, { nullable: true })
  resolveUpdatedBy(@Parent() variable: StateVariable): string | null | undefined {
    return variable.updatedBy;
  }

  /**
   * Resolves the version field for optimistic concurrency control.
   *
   * Version counter increments with each update to detect concurrent modifications.
   * Used for optimistic locking in update operations.
   *
   * @param variable - Parent state variable instance
   * @returns Current version number (starts at 1)
   */
  @ResolveField('version', () => Int)
  resolveVersion(@Parent() variable: StateVariable): number {
    return variable.version;
  }
}
