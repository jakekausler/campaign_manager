/**
 * Location Resolver
 * GraphQL resolvers for Location queries and mutations
 */

import { Logger, UseGuards } from '@nestjs/common';
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
import { SpatialService } from '../../common/services/spatial.service';
import type { AuthenticatedUser, GraphQLContext } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  CreateLocationInput,
  UpdateLocationInput,
  UpdateLocationData,
} from '../inputs/location.input';
import { GeoJSONScalar } from '../scalars/geojson.scalar';
import { LocationService } from '../services/location.service';
import { Location } from '../types/location.type';

@Resolver(() => Location)
export class LocationResolver {
  private readonly logger = new Logger(LocationResolver.name);

  constructor(
    private readonly locationService: LocationService,
    private readonly spatialService: SpatialService
  ) {}

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

  @ResolveField(() => GeoJSONScalar, {
    nullable: true,
    description: 'GeoJSON geometry representation',
  })
  async geojson(
    @Parent() location: Location,
    @Context() context: GraphQLContext
  ): Promise<unknown | null> {
    // Use DataLoader to batch geometry fetches and prevent N+1 queries
    const geom = await context.dataloaders.locationGeometryLoader.load(location.id);

    if (!geom) {
      return null;
    }

    try {
      // Convert WKB buffer to GeoJSON
      return this.spatialService.wkbToGeoJSON(geom);
    } catch (error) {
      // Log error but return null to prevent GraphQL from failing
      this.logger.error(`Failed to convert geometry for location ${location.id}:`, error);
      return null;
    }
  }
}
