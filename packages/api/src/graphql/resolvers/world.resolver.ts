/**
 * World Resolver
 * GraphQL resolvers for World queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateWorldInput, UpdateWorldInput } from '../inputs/world.input';
import { WorldService } from '../services/world.service';
import { World } from '../types/world.type';

@SkipThrottle()
@Resolver(() => World)
export class WorldResolver {
  constructor(private readonly worldService: WorldService) {}

  /**
   * Retrieves a single world by ID.
   *
   * @param id - World identifier
   * @param _user - Authenticated user (required for access control)
   * @returns World if found, null otherwise
   */
  @Query(() => World, { nullable: true, description: 'Get world by ID' })
  @UseGuards(JwtAuthGuard)
  async world(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<World | null> {
    return this.worldService.findById(id) as Promise<World | null>;
  }

  /**
   * Retrieves all worlds accessible to the authenticated user.
   *
   * Returns all non-deleted worlds. Currently no filtering by campaign
   * membership, but service layer may apply access control logic.
   *
   * @param _user - Authenticated user
   * @returns Array of accessible worlds
   */
  @Query(() => [World], { description: 'Get all worlds accessible to the user' })
  @UseGuards(JwtAuthGuard)
  async worlds(@CurrentUser() _user: AuthenticatedUser): Promise<World[]> {
    return this.worldService.findAll() as Promise<World[]>;
  }

  /**
   * Creates a new world definition.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - World starts in active (non-archived) state
   *
   * @param input - World creation data (name, description, settings)
   * @param user - Authenticated user creating the world
   * @returns Newly created world
   *
   * @see {@link WorldService.create} for validation and creation logic
   */
  @Mutation(() => World, { description: 'Create a new world' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createWorld(
    @Args('input') input: CreateWorldInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<World> {
    return this.worldService.create(input, user) as Promise<World>;
  }

  /**
   * Updates an existing world's properties.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp
   *
   * @param id - World identifier
   * @param input - Fields to update (partial update supported)
   * @param user - Authenticated user performing the update
   * @returns Updated world
   *
   * @see {@link WorldService.update} for update logic and validation
   */
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

  /**
   * Soft deletes a world by setting deletedAt timestamp.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - World excluded from normal queries but data preserved
   * - Can be restored with restoreWorld mutation
   * - Creates audit log entry
   *
   * @param id - World identifier
   * @param user - Authenticated user performing the deletion
   * @returns Deleted world with deletedAt set
   *
   * @see {@link WorldService.delete} for soft delete implementation
   */
  @Mutation(() => World, { description: 'Delete a world (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteWorld(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<World> {
    return this.worldService.delete(id, user) as Promise<World>;
  }

  /**
   * Archives a world by setting archivedAt timestamp.
   *
   * Archiving is distinct from deletion - archived worlds are intentionally
   * preserved for historical reference but hidden from active use.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets archivedAt to current timestamp
   * - World excluded from normal queries
   * - Can be restored with restoreWorld mutation
   * - Creates audit log entry
   *
   * @param id - World identifier
   * @param user - Authenticated user performing the archive
   * @returns Archived world with archivedAt set
   *
   * @see {@link WorldService.archive} for archive implementation
   */
  @Mutation(() => World, { description: 'Archive a world' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveWorld(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<World> {
    return this.worldService.archive(id, user) as Promise<World>;
  }

  /**
   * Restores an archived world to active status.
   *
   * Clears the archivedAt timestamp, making the world visible in normal queries again.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Clears archivedAt timestamp
   * - World becomes visible in normal queries
   * - Creates audit log entry
   *
   * @param id - World identifier
   * @param user - Authenticated user performing the restore
   * @returns Restored world with archivedAt cleared
   *
   * @see {@link WorldService.restore} for restore implementation
   */
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
