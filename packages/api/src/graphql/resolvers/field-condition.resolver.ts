/**
 * Field Condition Resolver
 *
 * GraphQL resolvers for managing field conditions and computed fields.
 * Field conditions define JSONLogic formulas that dynamically compute field values
 * based on entity state and context. Supports dependency tracking and bulk evaluation.
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  CreateFieldConditionInput,
  EvaluateConditionInput,
  FieldConditionOrderByInput,
  FieldConditionWhereInput,
  UpdateFieldConditionInput,
} from '../inputs/field-condition.input';
import { ConditionService } from '../services/condition.service';
import { EvaluationResult, FieldCondition } from '../types/field-condition.type';

@Resolver(() => FieldCondition)
export class FieldConditionResolver {
  constructor(private readonly conditionService: ConditionService) {}

  // ============= Query Resolvers =============

  /**
   * Retrieves a single field condition by ID.
   *
   * Returns complete condition definition including JSONLogic formula,
   * field mapping, priority, and metadata.
   *
   * @param id - Field condition identifier
   * @param user - Authenticated user (required for access control)
   * @returns Field condition if found and accessible, null otherwise
   *
   * @see {@link ConditionService.findById} for access control logic
   */
  @Query(() => FieldCondition, {
    nullable: true,
    description: 'Get a field condition by ID',
  })
  @UseGuards(JwtAuthGuard)
  async getFieldCondition(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<FieldCondition | null> {
    return this.conditionService.findById(id, user) as Promise<FieldCondition | null>;
  }

  /**
   * Lists field conditions with flexible filtering, sorting, and pagination.
   *
   * Supports filtering by entity type, field name, priority, active status, and more.
   * Useful for bulk operations and building condition management UIs.
   *
   * @param where - Optional filter criteria (entity type, field, priority, isActive)
   * @param orderBy - Optional sort configuration (field and direction)
   * @param skip - Number of records to skip for pagination (offset)
   * @param take - Maximum number of records to return (limit)
   * @param user - Authenticated user (for access control filtering)
   * @returns Array of matching field conditions
   *
   * @see {@link ConditionService.findMany} for filtering implementation
   */
  @Query(() => [FieldCondition], {
    description: 'List field conditions with optional filtering and sorting',
  })
  @UseGuards(JwtAuthGuard)
  async listFieldConditions(
    @Args('where', { type: () => FieldConditionWhereInput, nullable: true })
    where?: FieldConditionWhereInput,
    @Args('orderBy', { type: () => FieldConditionOrderByInput, nullable: true })
    orderBy?: FieldConditionOrderByInput,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @CurrentUser() user?: AuthenticatedUser
  ): Promise<FieldCondition[]> {
    return this.conditionService.findMany(where, orderBy, skip, take, user) as Promise<
      FieldCondition[]
    >;
  }

  /**
   * Retrieves all conditions for a specific entity, optionally filtered by field.
   *
   * Returns conditions sorted by priority (ascending). If field is provided,
   * only returns conditions for that specific field. If field is omitted,
   * returns all conditions for the entity across all fields.
   *
   * @param entityType - Entity type identifier (e.g., "Character", "Location")
   * @param entityId - Specific entity instance identifier
   * @param field - Optional field name to filter conditions (null/undefined = all fields)
   * @param user - Authenticated user (for access control)
   * @returns Array of field conditions sorted by priority
   *
   * @see {@link ConditionService.findForEntity} for priority sorting logic
   */
  @Query(() => [FieldCondition], {
    description: 'Get all conditions for a specific entity and optional field',
  })
  @UseGuards(JwtAuthGuard)
  async getConditionsForEntity(
    @Args('entityType', { type: () => String }) entityType: string,
    @Args('entityId', { type: () => ID }) entityId: string,
    @Args('field', { type: () => String, nullable: true }) field: string | null | undefined,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<FieldCondition[]> {
    return this.conditionService.findForEntity(
      entityType,
      entityId,
      field ?? undefined,
      user
    ) as Promise<FieldCondition[]>;
  }

  /**
   * Evaluates a field condition's JSONLogic formula with provided context data.
   *
   * Executes the condition's formula against the supplied context to compute
   * the field value. Returns both the computed value and evaluation metadata
   * (success status, execution time, error details if failed).
   *
   * Useful for testing condition formulas or computing values on-demand
   * without persisting them to entity state.
   *
   * @param input - Condition ID and context data for evaluation
   * @param user - Authenticated user (for access control)
   * @returns Evaluation result with computed value, success flag, and metadata
   *
   * @see {@link ConditionService.evaluateCondition} for JSONLogic evaluation
   */
  @Query(() => EvaluationResult, {
    description: 'Evaluate a field condition with custom context',
  })
  @UseGuards(JwtAuthGuard)
  async evaluateFieldCondition(
    @Args('input') input: EvaluateConditionInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<EvaluationResult> {
    return this.conditionService.evaluateCondition(input.conditionId, input.context, user);
  }

  // ============= Mutation Resolvers =============

  /**
   * Creates a new field condition with JSONLogic formula.
   *
   * Defines a computed field that evaluates dynamically based on entity context.
   * The formula is validated on creation to ensure it's valid JSONLogic.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Condition starts in active state by default
   * - May trigger dependency graph updates if dependencies are specified
   *
   * @param input - Condition definition (entity type, field, formula, priority)
   * @param user - Authenticated user creating the condition
   * @returns Newly created field condition
   *
   * @see {@link ConditionService.create} for formula validation and creation logic
   */
  @Mutation(() => FieldCondition, {
    description: 'Create a new field condition',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createFieldCondition(
    @Args('input') input: CreateFieldConditionInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<FieldCondition> {
    return this.conditionService.create(input, user) as Promise<FieldCondition>;
  }

  /**
   * Updates an existing field condition's properties.
   *
   * Can modify formula, priority, active status, and metadata. If formula
   * is updated, validation is performed to ensure new formula is valid JSONLogic.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp and increments version
   * - May trigger re-evaluation of affected computed fields
   * - May update dependency graph if formula dependencies change
   *
   * @param id - Field condition identifier
   * @param input - Fields to update (partial update supported)
   * @param user - Authenticated user performing the update
   * @returns Updated field condition
   *
   * @see {@link ConditionService.update} for update logic and validation
   */
  @Mutation(() => FieldCondition, {
    description: 'Update an existing field condition',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateFieldCondition(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateFieldConditionInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<FieldCondition> {
    return this.conditionService.update(id, input, user) as Promise<FieldCondition>;
  }

  /**
   * Soft deletes a field condition by setting deletedAt timestamp.
   *
   * Deleted conditions are excluded from evaluation but data is preserved
   * for audit purposes. Computed fields depending on this condition will
   * no longer be updated until condition is restored.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Condition excluded from evaluation queries
   * - Creates audit log entry
   * - May trigger dependency graph updates
   *
   * @param id - Field condition identifier
   * @param user - Authenticated user performing the deletion
   * @returns true if deletion succeeded
   *
   * @see {@link ConditionService.delete} for soft delete implementation
   */
  @Mutation(() => Boolean, {
    description: 'Delete a field condition (soft delete)',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteFieldCondition(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<boolean> {
    await this.conditionService.delete(id, user);
    return true;
  }

  /**
   * Toggles the active status of a field condition.
   *
   * Inactive conditions are skipped during evaluation but remain in the database.
   * Useful for temporarily disabling conditions without deleting them.
   * Computed fields depending on inactive conditions will not be updated.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Updates isActive flag
   * - Creates audit log entry
   * - Updates updatedAt timestamp and increments version
   * - May trigger re-evaluation of affected computed fields
   *
   * @param id - Field condition identifier
   * @param isActive - New active status (true = active, false = inactive)
   * @param user - Authenticated user performing the toggle
   * @returns Updated field condition with new active status
   *
   * @see {@link ConditionService.toggleActive} for toggle implementation
   */
  @Mutation(() => FieldCondition, {
    description: 'Toggle active status of a field condition',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async toggleFieldConditionActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('isActive') isActive: boolean,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<FieldCondition> {
    return this.conditionService.toggleActive(id, isActive, user) as Promise<FieldCondition>;
  }

  // ============= Field Resolvers =============

  /**
   * Resolves the createdBy user ID field.
   *
   * Returns the ID of the user who created this field condition.
   * Can be used to populate user details via GraphQL field selection.
   *
   * @param condition - Parent field condition object
   * @returns User ID of the creator
   */
  @ResolveField('createdBy', () => ID)
  resolveCreatedBy(@Parent() condition: FieldCondition): string {
    return condition.createdBy;
  }

  /**
   * Resolves the updatedBy user ID field.
   *
   * Returns the ID of the user who last updated this field condition,
   * or null if the condition has never been updated.
   *
   * @param condition - Parent field condition object
   * @returns User ID of the last updater, or null if never updated
   */
  @ResolveField('updatedBy', () => ID, { nullable: true })
  resolveUpdatedBy(@Parent() condition: FieldCondition): string | null | undefined {
    return condition.updatedBy;
  }

  /**
   * Resolves the version number field.
   *
   * Returns the optimistic concurrency control version number.
   * Incremented on each update to detect concurrent modifications.
   *
   * @param condition - Parent field condition object
   * @returns Current version number (starts at 1, increments on updates)
   */
  @ResolveField('version', () => Int)
  resolveVersion(@Parent() condition: FieldCondition): number {
    return condition.version;
  }
}
