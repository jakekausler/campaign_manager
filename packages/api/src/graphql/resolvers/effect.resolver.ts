/**
 * Effect Resolver
 *
 * GraphQL resolvers for managing Effects and executing JSON Patch operations
 * on world state. Effects represent atomic state mutations that can be applied
 * to entities at specific timing phases (before/after events/encounters).
 *
 * Key features:
 * - CRUD operations for effect definitions
 * - Execute single effects with optional dry-run mode
 * - Batch execution of all effects for an entity
 * - Effect activation toggle for conditional execution
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  CreateEffectInput,
  UpdateEffectInput,
  ExecuteEffectInput,
  ExecuteEffectsForEntityInput,
  EffectWhereInput,
  EffectOrderByInput,
} from '../inputs/effect.input';
import { EffectExecutionService } from '../services/effect-execution.service';
import { EffectService } from '../services/effect.service';
import {
  Effect,
  EffectExecutionResult,
  EffectExecutionSummary,
  EffectTiming,
} from '../types/effect.type';

@SkipThrottle()
@Resolver(() => Effect)
export class EffectResolver {
  constructor(
    private readonly effectService: EffectService,
    private readonly effectExecutionService: EffectExecutionService
  ) {}

  // ============= Query Resolvers =============

  /**
   * Retrieves a single effect definition by ID.
   *
   * Returns the effect's configuration including JSON Patch operations,
   * timing phase, entity association, and condition logic.
   *
   * @param id - Effect identifier
   * @param user - Authenticated user (required for access control)
   * @returns Effect if found, null otherwise
   *
   * @see {@link EffectService.findById} for retrieval logic
   */
  @Query(() => Effect, {
    nullable: true,
    description: 'Get an effect by ID',
  })
  @UseGuards(JwtAuthGuard)
  async getEffect(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Effect | null> {
    return this.effectService.findById(id, user) as Promise<Effect | null>;
  }

  /**
   * Retrieves a list of effects with optional filtering, sorting, and pagination.
   *
   * Supports filtering by entity type, entity ID, timing phase, active status,
   * and world ID. Results can be sorted and paginated for large datasets.
   *
   * @param where - Optional filter criteria (entity, timing, active status, etc.)
   * @param orderBy - Optional sort configuration
   * @param skip - Number of records to skip (for pagination)
   * @param take - Maximum number of records to return (for pagination)
   * @param user - Authenticated user (for access control)
   * @returns Array of effects matching the criteria
   *
   * @see {@link EffectService.findMany} for query implementation
   */
  @Query(() => [Effect], {
    description: 'List effects with optional filtering and sorting',
  })
  @UseGuards(JwtAuthGuard)
  async listEffects(
    @Args('where', { type: () => EffectWhereInput, nullable: true })
    where?: EffectWhereInput,
    @Args('orderBy', { type: () => EffectOrderByInput, nullable: true })
    orderBy?: EffectOrderByInput,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @CurrentUser() user?: AuthenticatedUser
  ): Promise<Effect[]> {
    return this.effectService.findMany(where, orderBy, skip, take, user) as Promise<Effect[]>;
  }

  /**
   * Retrieves all effects associated with a specific entity and timing phase.
   *
   * This is the primary query for fetching effects that will execute when an entity
   * (event or encounter) reaches a specific lifecycle phase. Only active effects are
   * returned. Results are ordered by priority (ascending) to ensure correct execution order.
   *
   * @param entityType - Entity type (e.g., 'ENCOUNTER', 'EVENT')
   * @param entityId - Entity identifier
   * @param timing - Timing phase (BEFORE_START, AFTER_START, BEFORE_END, AFTER_END)
   * @param user - Authenticated user (for access control)
   * @returns Array of active effects for the entity at the specified timing phase
   *
   * @see {@link EffectService.findForEntity} for filtering and ordering logic
   */
  @Query(() => [Effect], {
    description: 'Get all effects for a specific entity and timing phase',
  })
  @UseGuards(JwtAuthGuard)
  async getEffectsForEntity(
    @Args('entityType') entityType: string,
    @Args('entityId', { type: () => ID }) entityId: string,
    @Args('timing', { type: () => EffectTiming }) timing: EffectTiming,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Effect[]> {
    return this.effectService.findForEntity(entityType, entityId, timing, user) as Promise<
      Effect[]
    >;
  }

  // ============= Mutation Resolvers =============

  /**
   * Creates a new effect definition with JSON Patch operations.
   *
   * Effects define world state mutations that execute at specific timing phases
   * for entities (events or encounters). Each effect contains JSON Patch operations,
   * optional condition logic, and execution priority.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Effect starts in active state by default
   * - Validates JSON Patch operations format
   *
   * @param input - Effect creation data (name, operations, timing, entity reference, etc.)
   * @param user - Authenticated user creating the effect
   * @returns Newly created effect
   *
   * @see {@link EffectService.create} for validation and creation logic
   */
  @Mutation(() => Effect, {
    description: 'Create a new effect',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createEffect(
    @Args('input') input: CreateEffectInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Effect> {
    return this.effectService.create(input, user) as Promise<Effect>;
  }

  /**
   * Updates an existing effect's properties.
   *
   * Allows modification of effect name, description, JSON Patch operations,
   * timing phase, priority, condition logic, and active status. Partial updates
   * are supported - only provided fields will be modified.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp
   * - Validates JSON Patch operations if modified
   * - Changes take effect immediately for future executions
   *
   * @param id - Effect identifier
   * @param input - Fields to update (partial update supported)
   * @param user - Authenticated user performing the update
   * @returns Updated effect
   *
   * @see {@link EffectService.update} for update logic and validation
   */
  @Mutation(() => Effect, {
    description: 'Update an existing effect',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateEffect(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateEffectInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Effect> {
    return this.effectService.update(id, input, user) as Promise<Effect>;
  }

  /**
   * Soft deletes an effect by setting deletedAt timestamp.
   *
   * Deleted effects are excluded from queries and will not execute.
   * The effect definition is preserved in the database for audit purposes
   * and can potentially be restored if needed.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Effect excluded from normal queries and execution
   * - Creates audit log entry
   * - Historical executions remain in audit trail
   *
   * @param id - Effect identifier
   * @param user - Authenticated user performing the deletion
   * @returns True on successful deletion
   *
   * @see {@link EffectService.delete} for soft delete implementation
   */
  @Mutation(() => Boolean, {
    description: 'Delete an effect (soft delete)',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteEffect(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<boolean> {
    await this.effectService.delete(id, user);
    return true;
  }

  /**
   * Toggles the active status of an effect.
   *
   * Active effects execute when their timing conditions are met. Inactive effects
   * are skipped during execution. This provides a way to temporarily disable effects
   * without deleting them, useful for testing or conditional gameplay.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Updates isActive field
   * - Creates audit log entry
   * - Updates updatedAt timestamp
   * - Changes take effect immediately for future executions
   *
   * @param id - Effect identifier
   * @param isActive - New active status (true to enable, false to disable)
   * @param user - Authenticated user performing the toggle
   * @returns Updated effect with new active status
   *
   * @see {@link EffectService.toggleActive} for toggle logic
   */
  @Mutation(() => Effect, {
    description: 'Toggle active status of an effect',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async toggleEffectActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('isActive') isActive: boolean,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Effect> {
    return this.effectService.toggleActive(id, isActive, user) as Promise<Effect>;
  }

  /**
   * Executes a single effect with optional dry-run mode for testing.
   *
   * This mutation allows testing and debugging of effects by executing them in isolation
   * with a provided context. Dry-run mode previews the JSON Patch operations without
   * actually applying them to the world state, enabling safe validation of effect logic.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects (when dryRun = false):**
   * - Applies JSON Patch operations to world state
   * - Creates audit log entry for execution
   * - May trigger cache invalidation
   * - May trigger real-time update notifications
   *
   * **Side Effects (when dryRun = true):**
   * - No state mutations
   * - No audit log entry
   * - Returns preview of operations that would be applied
   *
   * @param input - Execution parameters (effect ID, context data, dry-run flag)
   * @param user - Authenticated user executing the effect
   * @returns Execution result with success status, applied operations, and any errors
   *
   * @see {@link EffectExecutionService.executeEffect} for execution logic and JSON Patch application
   */
  @Mutation(() => EffectExecutionResult, {
    description: 'Execute a single effect (for testing/debugging)',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async executeEffect(
    @Args('input') input: ExecuteEffectInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<EffectExecutionResult> {
    return this.effectExecutionService.executeEffect(
      input.effectId,
      input.context,
      user,
      input.dryRun ?? false
    );
  }

  /**
   * Executes all active effects for an entity at a specific timing phase.
   *
   * This is the primary mutation for triggering effect execution during entity lifecycle
   * events (e.g., when an encounter starts or an event completes). All active effects
   * for the entity and timing phase are executed in priority order. Execution stops if
   * a critical error occurs, but continues for non-critical errors.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Applies JSON Patch operations to world state for each effect
   * - Creates audit log entries for each execution
   * - May trigger cache invalidation
   * - May trigger real-time update notifications
   * - Executes effects in priority order (ascending)
   * - Skips inactive effects and effects with failing conditions
   *
   * @param input - Execution parameters (entity type, entity ID, timing phase)
   * @param user - Authenticated user executing the effects
   * @returns Execution summary with total count, success count, failure count, and individual results
   *
   * @see {@link EffectExecutionService.executeEffectsForEntity} for batch execution logic
   * @see {@link EffectService.findForEntity} for effect retrieval and ordering
   */
  @Mutation(() => EffectExecutionSummary, {
    description: 'Execute all effects for an entity at a specific timing phase',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async executeEffectsForEntity(
    @Args('input') input: ExecuteEffectsForEntityInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<EffectExecutionSummary> {
    return this.effectExecutionService.executeEffectsForEntity(
      input.entityType.toUpperCase() as 'ENCOUNTER' | 'EVENT',
      input.entityId,
      input.timing,
      user
    );
  }
}
