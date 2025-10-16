/**
 * World Resolver
 * GraphQL resolvers for World queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { CreateWorldInput, UpdateWorldInput } from '../inputs/world.input';
import { WorldService } from '../services/world.service';
import { World } from '../types/world.type';

@Resolver(() => World)
export class WorldResolver {
  constructor(private readonly worldService: WorldService) {}

  @Query(() => World, { nullable: true, description: 'Get world by ID' })
  @UseGuards(JwtAuthGuard)
  async world(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<World | null> {
    return this.worldService.findById(id) as Promise<World | null>;
  }

  @Query(() => [World], { description: 'Get all worlds accessible to the user' })
  @UseGuards(JwtAuthGuard)
  async worlds(@CurrentUser() _user: AuthenticatedUser): Promise<World[]> {
    return this.worldService.findAll() as Promise<World[]>;
  }

  @Mutation(() => World, { description: 'Create a new world' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createWorld(
    @Args('input') input: CreateWorldInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<World> {
    return this.worldService.create(input, user) as Promise<World>;
  }

  @Mutation(() => World, { description: 'Update a world' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateWorld(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateWorldInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<World> {
    return this.worldService.update(id, input, user) as Promise<World>;
  }

  @Mutation(() => World, { description: 'Delete a world (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteWorld(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<World> {
    return this.worldService.delete(id, user) as Promise<World>;
  }

  @Mutation(() => World, { description: 'Archive a world' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveWorld(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<World> {
    return this.worldService.archive(id, user) as Promise<World>;
  }

  @Mutation(() => World, { description: 'Restore an archived world' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreWorld(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<World> {
    return this.worldService.restore(id, user) as Promise<World>;
  }
}
