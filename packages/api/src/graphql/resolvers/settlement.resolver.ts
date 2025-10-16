/**
 * Settlement Resolver
 * GraphQL resolvers for Settlement queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser, GraphQLContext } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { CreateSettlementInput, UpdateSettlementInput } from '../inputs/settlement.input';
import { SettlementService } from '../services/settlement.service';
import { Settlement } from '../types/settlement.type';
import { Structure } from '../types/structure.type';

@Resolver(() => Settlement)
export class SettlementResolver {
  constructor(private readonly settlementService: SettlementService) {}

  @Query(() => Settlement, { nullable: true, description: 'Get settlement by ID' })
  @UseGuards(JwtAuthGuard)
  async settlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement | null> {
    return this.settlementService.findById(id, user) as Promise<Settlement | null>;
  }

  @Query(() => [Settlement], { description: 'Get all settlements for a kingdom' })
  @UseGuards(JwtAuthGuard)
  async settlementsByKingdom(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement[]> {
    return this.settlementService.findByKingdom(kingdomId, user) as Promise<Settlement[]>;
  }

  @Mutation(() => Settlement, { description: 'Create a new settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createSettlement(
    @Args('input') input: CreateSettlementInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.create(input, user) as Promise<Settlement>;
  }

  @Mutation(() => Settlement, { description: 'Update a settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateSettlement(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSettlementInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.update(id, input, user) as Promise<Settlement>;
  }

  @Mutation(() => Settlement, { description: 'Delete a settlement (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteSettlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.delete(id, user) as Promise<Settlement>;
  }

  @Mutation(() => Settlement, { description: 'Archive a settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveSettlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.archive(id, user) as Promise<Settlement>;
  }

  @Mutation(() => Settlement, { description: 'Restore an archived settlement' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreSettlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement> {
    return this.settlementService.restore(id, user) as Promise<Settlement>;
  }

  @ResolveField(() => [Structure], { description: 'Structures in this settlement' })
  async structures(
    @Parent() settlement: Settlement,
    @Context() context: GraphQLContext
  ): Promise<Structure[]> {
    // Use DataLoader to batch and cache structure queries
    return context.dataloaders.structureLoader.load(settlement.id) as Promise<Structure[]>;
  }
}
