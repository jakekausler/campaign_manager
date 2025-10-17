/**
 * State Variable Resolver
 * GraphQL resolvers for StateVariable CRUD operations and evaluation
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
   * Get a single state variable by ID
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
   * List state variables with filtering, sorting, and pagination
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
   * Get all variables for a specific scope and scopeId
   */
  @Query(() => [StateVariable], {
    description: 'Get all variables for a specific scope and optional key',
  })
  @UseGuards(JwtAuthGuard)
  async getVariablesForScope(
    @Args('scope', { type: () => VariableScope }) scope: VariableScope,
    @Args('scopeId', { type: () => ID, nullable: true }) scopeId: string | null | undefined,
    @Args('key', { nullable: true }) key: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<StateVariable[]> {
    return this.stateVariableService.findByScope(scope, scopeId ?? null, key, user) as Promise<
      StateVariable[]
    >;
  }

  /**
   * Evaluate a variable with provided context
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
   * Create a new state variable
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
   * Update an existing state variable
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
   * Delete a state variable (soft delete)
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
   * Toggle active status of a state variable
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
   * Resolve createdBy user relation
   */
  @ResolveField('createdBy', () => ID)
  resolveCreatedBy(@Parent() variable: StateVariable): string {
    return variable.createdBy;
  }

  /**
   * Resolve updatedBy user relation
   */
  @ResolveField('updatedBy', () => ID, { nullable: true })
  resolveUpdatedBy(@Parent() variable: StateVariable): string | null | undefined {
    return variable.updatedBy;
  }

  /**
   * Resolve version field
   */
  @ResolveField('version', () => Int)
  resolveVersion(@Parent() variable: StateVariable): number {
    return variable.version;
  }
}
