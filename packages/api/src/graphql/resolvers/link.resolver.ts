/**
 * Link Resolver
 * GraphQL resolvers for Link queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateLinkInput, UpdateLinkInput } from '../inputs/link.input';
import { LinkService } from '../services/link.service';
import { Link } from '../types/link.type';

@SkipThrottle()
@Resolver(() => Link)
export class LinkResolver {
  constructor(private readonly linkService: LinkService) {}

  /**
   * Retrieves a single link by ID.
   *
   * Links represent directed relationships between entities (e.g., Event → Location,
   * Quest → Character). Each link has a source entity, target entity, and relationship type.
   *
   * @param id - Link identifier
   * @param user - Authenticated user (required for access control)
   * @returns Link if found, null otherwise
   *
   * @see {@link LinkService.findById} for access control and retrieval logic
   */
  @Query(() => Link, { nullable: true, description: 'Get link by ID' })
  @UseGuards(JwtAuthGuard)
  async link(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Link | null> {
    return this.linkService.findById(id, user) as Promise<Link | null>;
  }

  /**
   * Retrieves all outgoing links from a source entity.
   *
   * Returns all relationships where the specified entity is the source (origin).
   * Useful for finding what an entity links to (e.g., all locations visited in an event,
   * all characters involved in a quest).
   *
   * @param sourceType - Entity type (e.g., 'event', 'quest', 'character')
   * @param sourceId - Source entity identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of links originating from the source entity
   *
   * @see {@link LinkService.findBySourceEntity} for filtering and access control
   */
  @Query(() => [Link], { description: 'Get all links from a source entity' })
  @UseGuards(JwtAuthGuard)
  async linksBySource(
    @Args('sourceType') sourceType: string,
    @Args('sourceId', { type: () => ID }) sourceId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Link[]> {
    return this.linkService.findBySourceEntity(sourceType, sourceId, user) as Promise<Link[]>;
  }

  /**
   * Retrieves all incoming links to a target entity.
   *
   * Returns all relationships where the specified entity is the target (destination).
   * Useful for finding what links to an entity (e.g., all events that reference a location,
   * all quests that involve a character).
   *
   * @param targetType - Entity type (e.g., 'location', 'character', 'item')
   * @param targetId - Target entity identifier
   * @param user - Authenticated user (required for access control)
   * @returns Array of links pointing to the target entity
   *
   * @see {@link LinkService.findByTargetEntity} for filtering and access control
   */
  @Query(() => [Link], { description: 'Get all links to a target entity' })
  @UseGuards(JwtAuthGuard)
  async linksByTarget(
    @Args('targetType') targetType: string,
    @Args('targetId', { type: () => ID }) targetId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Link[]> {
    return this.linkService.findByTargetEntity(targetType, targetId, user) as Promise<Link[]>;
  }

  /**
   * Creates a new link between two entities.
   *
   * Establishes a directed relationship from a source entity to a target entity
   * with a specified relationship type (e.g., 'location', 'requires', 'involves').
   * Links enable dependency tracking and graph-based relationship analysis.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - May trigger dependency graph updates
   * - Link starts in active (non-deleted) state
   *
   * @param input - Link creation data (source, target, relationship type, metadata)
   * @param user - Authenticated user creating the link
   * @returns Newly created link
   *
   * @see {@link LinkService.create} for validation and relationship creation logic
   */
  @Mutation(() => Link, { description: 'Create a new link between entities' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createLink(
    @Args('input') input: CreateLinkInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Link> {
    return this.linkService.create(input, user) as Promise<Link>;
  }

  /**
   * Updates an existing link's properties.
   *
   * Allows modification of link metadata, relationship type, or other properties.
   * Cannot change source/target entities - delete and recreate the link instead.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Updates updatedAt timestamp
   * - May trigger dependency graph recalculation if relationship type changes
   *
   * @param id - Link identifier
   * @param input - Fields to update (partial update supported)
   * @param user - Authenticated user performing the update
   * @returns Updated link
   *
   * @see {@link LinkService.update} for update logic and validation
   */
  @Mutation(() => Link, { description: 'Update a link' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateLink(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateLinkInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Link> {
    return this.linkService.update(id, input, user) as Promise<Link>;
  }

  /**
   * Soft deletes a link by setting deletedAt timestamp.
   *
   * Removes the relationship from active queries while preserving the link data
   * for audit history and potential restoration. Useful for cleaning up obsolete
   * or incorrect relationships without losing historical context.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp
   * - Link excluded from normal queries but data preserved
   * - May trigger dependency graph updates to reflect removed relationship
   * - Creates audit log entry
   *
   * @param id - Link identifier
   * @param user - Authenticated user performing the deletion
   * @returns Deleted link with deletedAt set
   *
   * @see {@link LinkService.delete} for soft delete implementation
   */
  @Mutation(() => Link, { description: 'Delete a link (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteLink(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Link> {
    return this.linkService.delete(id, user) as Promise<Link>;
  }
}
