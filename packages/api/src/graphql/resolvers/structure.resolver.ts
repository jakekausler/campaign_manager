/**
 * Structure Resolver
 * GraphQL resolvers for Structure queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { CreateStructureInput, UpdateStructureInput } from '../inputs/structure.input';
import { StructureService } from '../services/structure.service';
import { Structure } from '../types/structure.type';

@Resolver(() => Structure)
export class StructureResolver {
  constructor(private readonly structureService: StructureService) {}

  @Query(() => Structure, { nullable: true, description: 'Get structure by ID' })
  @UseGuards(JwtAuthGuard)
  async structure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure | null> {
    return this.structureService.findById(id, user) as Promise<Structure | null>;
  }

  @Query(() => [Structure], { description: 'Get all structures for a settlement' })
  @UseGuards(JwtAuthGuard)
  async structuresBySettlement(
    @Args('settlementId', { type: () => ID }) settlementId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure[]> {
    return this.structureService.findBySettlement(settlementId, user) as Promise<Structure[]>;
  }

  @Mutation(() => Structure, { description: 'Create a new structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createStructure(
    @Args('input') input: CreateStructureInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.create(input, user) as Promise<Structure>;
  }

  @Mutation(() => Structure, { description: 'Update a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateStructure(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStructureInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.update(id, input, user) as Promise<Structure>;
  }

  @Mutation(() => Structure, { description: 'Delete a structure (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteStructure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.delete(id, user) as Promise<Structure>;
  }

  @Mutation(() => Structure, { description: 'Archive a structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveStructure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.archive(id, user) as Promise<Structure>;
  }

  @Mutation(() => Structure, { description: 'Restore an archived structure' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreStructure(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Structure> {
    return this.structureService.restore(id, user) as Promise<Structure>;
  }
}
