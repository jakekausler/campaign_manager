/**
 * Field Condition Resolver
 * GraphQL resolvers for FieldCondition CRUD operations and evaluation
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
   * Get a single field condition by ID
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
   * List field conditions with filtering, sorting, and pagination
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
   * Get all conditions for a specific entity and field
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
   * Evaluate a condition with provided context
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
   * Create a new field condition
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
   * Update an existing field condition
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
   * Delete a field condition (soft delete)
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
   * Toggle active status of a field condition
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
   * Resolve createdBy user relation
   */
  @ResolveField('createdBy', () => ID)
  resolveCreatedBy(@Parent() condition: FieldCondition): string {
    return condition.createdBy;
  }

  /**
   * Resolve updatedBy user relation
   */
  @ResolveField('updatedBy', () => ID, { nullable: true })
  resolveUpdatedBy(@Parent() condition: FieldCondition): string | null | undefined {
    return condition.updatedBy;
  }

  /**
   * Resolve version field
   */
  @ResolveField('version', () => Int)
  resolveVersion(@Parent() condition: FieldCondition): number {
    return condition.version;
  }
}
