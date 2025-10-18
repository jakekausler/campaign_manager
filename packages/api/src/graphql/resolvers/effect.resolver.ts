/**
 * Effect Resolver
 * GraphQL resolvers for Effect queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

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

@Resolver(() => Effect)
export class EffectResolver {
  constructor(
    private readonly effectService: EffectService,
    private readonly effectExecutionService: EffectExecutionService
  ) {}

  // ============= Query Resolvers =============

  /**
   * Get a single effect by ID
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
   * List effects with filtering, sorting, and pagination
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
   * Get all effects for a specific entity and timing phase
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
   * Create a new effect
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
   * Update an existing effect
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
   * Delete an effect (soft delete)
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
   * Toggle active status of an effect
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
   * Execute a single effect (for testing/debugging)
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
   * Execute all effects for an entity at a specific timing phase
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
