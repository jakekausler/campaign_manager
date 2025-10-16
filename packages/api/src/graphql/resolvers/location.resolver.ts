/**
 * Location Resolver
 * GraphQL resolvers for Location queries and mutations
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import type {
  CreateLocationInput,
  UpdateLocationInput,
  UpdateLocationData,
} from '../inputs/location.input';
import { LocationService } from '../services/location.service';
import { Location } from '../types/location.type';

@Resolver(() => Location)
export class LocationResolver {
  constructor(private readonly locationService: LocationService) {}

  @Query(() => Location, { nullable: true, description: 'Get location by ID' })
  @UseGuards(JwtAuthGuard)
  async location(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<Location | null> {
    return this.locationService.findById(id) as Promise<Location | null>;
  }

  @Query(() => [Location], { description: 'Get all locations for a world' })
  @UseGuards(JwtAuthGuard)
  async locationsByWorld(
    @Args('worldId', { type: () => ID }) worldId: string,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<Location[]> {
    return this.locationService.findByWorldId(worldId) as Promise<Location[]>;
  }

  @Query(() => [Location], { description: 'Get child locations of a parent location' })
  @UseGuards(JwtAuthGuard)
  async locationsByParent(
    @Args('parentLocationId', { type: () => ID }) parentLocationId: string,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<Location[]> {
    return this.locationService.findByParentId(parentLocationId) as Promise<Location[]>;
  }

  @Mutation(() => Location, { description: 'Create a new location' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createLocation(
    @Args('input') input: CreateLocationInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Location> {
    return this.locationService.create(input, user) as Promise<Location>;
  }

  @Mutation(() => Location, { description: 'Update a location' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateLocation(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateLocationInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Location> {
    const { branchId, expectedVersion, worldTime, ...updateData } = input;
    const locationData: UpdateLocationData = updateData;
    return this.locationService.update(
      id,
      locationData,
      user,
      expectedVersion,
      branchId,
      worldTime
    ) as Promise<Location>;
  }

  @Mutation(() => Location, { description: 'Delete a location (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteLocation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Location> {
    return this.locationService.delete(id, user) as Promise<Location>;
  }

  @Mutation(() => Location, { description: 'Archive a location' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveLocation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Location> {
    return this.locationService.archive(id, user) as Promise<Location>;
  }

  @Mutation(() => Location, { description: 'Restore an archived location' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreLocation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Location> {
    return this.locationService.restore(id, user) as Promise<Location>;
  }
}
