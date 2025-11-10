/**
 * Location Resolver
 *
 * GraphQL resolvers for Location queries and mutations. Handles CRUD operations
 * for location entities including GeoJSON geometry management, parent-child
 * hierarchies, and location-specific variable management.
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

  /**
   * Retrieves a single location by ID.
   *
   * Returns location with all properties except geometry (use geojson field
   * for geometry data). Uses DataLoader for efficient batched loading.
   *
   * @param id - Location identifier
   * @param _user - Authenticated user (required for access control)
   * @returns Location if found, null otherwise
   */
  @Query(() => Location, { nullable: true, description: 'Get location by ID' })
  @UseGuards(JwtAuthGuard)
  async location(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<Location | null> {
    return this.locationService.findById(id) as Promise<Location | null>;
  }

  /**
   * Retrieves all locations belonging to a specific world.
   *
   * Returns all non-deleted locations for the specified world, regardless
   * of their parent-child relationships. Useful for building location trees
   * or displaying all locations in a world.
   *
   * @param worldId - World identifier
   * @param _user - Authenticated user
   * @returns Array of locations in the world
   */
  @Query(() => [Location], { description: 'Get all locations for a world' })
  @UseGuards(JwtAuthGuard)
  async locationsByWorld(
    @Args('worldId', { type: () => ID }) worldId: string,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<Location[]> {
    return this.locationService.findByWorldId(worldId) as Promise<Location[]>;
  }

  /**
   * Retrieves all direct child locations of a parent location.
   *
   * Returns only immediate children (one level deep), not all descendants.
   * Useful for building hierarchical location trees or exploring location
   * structures incrementally.
   *
   * @param parentLocationId - Parent location identifier
   * @param _user - Authenticated user
   * @returns Array of child locations
   */
  @Query(() => [Location], { description: 'Get child locations of a parent location' })
  @UseGuards(JwtAuthGuard)
  async locationsByParent(
    @Args('parentLocationId', { type: () => ID }) parentLocationId: string,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<Location[]> {
    return this.locationService.findByParentId(parentLocationId) as Promise<Location[]>;
  }

  /**
   * Creates a new location in a world.
   *
   * Locations support optional parent-child hierarchies (e.g., city contains
   * buildings). Validates that parent location exists and belongs to the same
   * world. Geometry is not set during creation - use updateLocationGeometry
   * mutation to add spatial data.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry
   * - Invalidates tile cache for the world (location appears on map)
   * - Location starts in active (non-archived, non-deleted) state
   *
   * @param input - Location creation data (worldId, type, name, description, parentLocationId)
   * @param user - Authenticated user creating the location
   * @returns Newly created location
   *
   * @see {@link LocationService.create} for validation and creation logic
   */
  @Mutation(() => Location, { description: 'Create a new location' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createLocation(
    @Args('input') input: CreateLocationInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Location> {
    return this.locationService.create(input, user) as Promise<Location>;
  }

  /**
   * Updates an existing location's properties.
   *
   * Supports optimistic locking via expectedVersion parameter to prevent
   * conflicting concurrent updates. Can modify location hierarchy by changing
   * parentLocationId (validates no circular references). Validates parent
   * belongs to same world and prevents location from being its own parent.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Creates audit log entry with diff
   * - Creates version record for branching support
   * - Publishes real-time update via Redis PubSub
   * - Invalidates cache for location and world
   * - Invalidates tile cache if geometry or name changed
   * - Increments location version number
   * - Updates updatedAt timestamp
   *
   * @param id - Location identifier
   * @param input - Fields to update (partial update supported) with expectedVersion, branchId, worldTime
   * @param user - Authenticated user performing the update
   * @returns Updated location
   *
   * @see {@link LocationService.update} for validation and update logic
   */
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

  /**
   * Soft deletes a location by setting deletedAt timestamp.
   *
   * Cascades deletion to all child locations (recursive soft delete of entire
   * subtree). Location data is preserved for audit purposes and can be queried
   * by requesting deleted entities explicitly.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets deletedAt to current timestamp (location and all children)
   * - Location excluded from normal queries but data preserved
   * - Cascades to all descendant locations
   * - Creates audit log entry
   * - Invalidates cache for location and world
   * - Invalidates tile cache for the world
   *
   * @param id - Location identifier
   * @param user - Authenticated user performing the deletion
   * @returns Deleted location with deletedAt set
   *
   * @see {@link LocationService.delete} for soft delete implementation
   */
  @Mutation(() => Location, { description: 'Delete a location (soft delete)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async deleteLocation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Location> {
    return this.locationService.delete(id, user) as Promise<Location>;
  }

  /**
   * Archives a location by setting archivedAt timestamp.
   *
   * Archiving is distinct from deletion - archived locations are intentionally
   * preserved for historical reference but hidden from active use. Does not
   * cascade to child locations (children remain active). Useful for locations
   * that are no longer relevant but may be referenced in historical events.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Sets archivedAt to current timestamp
   * - Location excluded from normal queries
   * - Can be restored with restoreLocation mutation
   * - Creates audit log entry
   * - Invalidates cache for location and world
   *
   * @param id - Location identifier
   * @param user - Authenticated user performing the archive
   * @returns Archived location with archivedAt set
   *
   * @see {@link LocationService.archive} for archive implementation
   */
  @Mutation(() => Location, { description: 'Archive a location' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async archiveLocation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Location> {
    return this.locationService.archive(id, user) as Promise<Location>;
  }

  /**
   * Restores an archived location to active status.
   *
   * Clears the archivedAt timestamp, making the location visible in normal
   * queries again. Does not affect child locations (they must be restored
   * separately if needed).
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Clears archivedAt timestamp
   * - Location becomes visible in normal queries
   * - Creates audit log entry
   * - Invalidates cache for location and world
   *
   * @param id - Location identifier
   * @param user - Authenticated user performing the restore
   * @returns Restored location with archivedAt cleared
   *
   * @see {@link LocationService.restore} for restore implementation
   */
  @Mutation(() => Location, { description: 'Restore an archived location' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async restoreLocation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Location> {
    return this.locationService.restore(id, user) as Promise<Location>;
  }

  /**
   * Resolves the GeoJSON geometry for a location.
   *
   * Converts PostGIS WKB (Well-Known Binary) geometry stored in the database
   * to GeoJSON format for client consumption. Uses DataLoader to batch geometry
   * fetches and prevent N+1 query problems when loading multiple locations.
   *
   * Returns null if location has no geometry or if conversion fails. Errors
   * are logged but do not fail the GraphQL query.
   *
   * @param location - Parent location object being resolved
   * @param context - GraphQL context containing DataLoaders
   * @returns GeoJSON object (Point, LineString, Polygon, etc.) or null
   *
   * @see {@link SpatialService.wkbToGeoJSON} for WKB to GeoJSON conversion
   */
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
