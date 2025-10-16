/**
 * Link Resolver
 * GraphQL resolvers for Link queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { CreateLinkInput, UpdateLinkInput } from '../inputs/link.input';
import { LinkService } from '../services/link.service';
import { Link } from '../types/link.type';

@Resolver(() => Link)
export class LinkResolver {
  constructor(private readonly linkService: LinkService) {}

  @Query(() => Link, { nullable: true, description: 'Get link by ID' })
  @UseGuards(JwtAuthGuard)
  async link(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Link | null> {
    return this.linkService.findById(id, user) as Promise<Link | null>;
  }

  @Query(() => [Link], { description: 'Get all links from a source entity' })
  @UseGuards(JwtAuthGuard)
  async linksBySource(
    @Args('sourceType') sourceType: string,
    @Args('sourceId', { type: () => ID }) sourceId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Link[]> {
    return this.linkService.findBySourceEntity(sourceType, sourceId, user) as Promise<Link[]>;
  }

  @Query(() => [Link], { description: 'Get all links to a target entity' })
  @UseGuards(JwtAuthGuard)
  async linksByTarget(
    @Args('targetType') targetType: string,
    @Args('targetId', { type: () => ID }) targetId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Link[]> {
    return this.linkService.findByTargetEntity(targetType, targetId, user) as Promise<Link[]>;
  }

  @Mutation(() => Link, { description: 'Create a new link between entities' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createLink(
    @Args('input') input: CreateLinkInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Link> {
    return this.linkService.create(input, user) as Promise<Link>;
  }

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
