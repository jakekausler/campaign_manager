/**
 * Spatial Resolver
 *
 * GraphQL resolvers for spatial queries and geometry operations using PostGIS.
 * Provides geospatial functionality including bounding box queries, proximity searches,
 * containment checks, and geometry updates with GeoJSON support.
 */

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { GeoJSONGeometry, GeoJSONPoint } from '@campaign/shared';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SpatialService } from '../../common/services/spatial.service';
import { TileCacheService } from '../../common/services/tile-cache.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  BoundingBoxInput,
  LocationsNearInput,
  MapFilterInput,
  SettlementsNearInput,
  UpdateLocationGeometryInput,
} from '../inputs/spatial.input';
import { LocationService } from '../services/location.service';
import { SettlementService } from '../services/settlement.service';
import { Location } from '../types/location.type';
import { Settlement } from '../types/settlement.type';
import {
  GeoJSONFeatureCollection,
  LocationWithDistance,
  RegionOverlapResult,
  SettlementWithDistance,
} from '../types/spatial.type';

@Resolver()
export class SpatialResolver {
  constructor(
    private readonly spatialService: SpatialService,
    private readonly locationService: LocationService,
    private readonly settlementService: SettlementService,
    private readonly tileCacheService: TileCacheService
  ) {}

  /**
   * Retrieves map layer data as GeoJSON FeatureCollection for a viewport bounding box.
   *
   * Performs a spatial query to find all locations within the given bounding box,
   * optionally filtered by location type. Results include settlement data if locations
   * have associated settlements. Uses in-memory tile caching for improved performance
   * on repeated viewport requests.
   *
   * **Side Effects:**
   * - Caches result in TileCacheService for subsequent requests with same parameters
   * - Cache key based on worldId, bounding box, and filters
   *
   * @param worldId - World identifier to query locations from
   * @param bbox - Bounding box with west, south, east, north coordinates
   * @param filters - Optional filters (e.g., location types to include)
   * @param _user - Authenticated user (required for access control)
   * @returns GeoJSON FeatureCollection with location features and embedded settlement data
   *
   * @see {@link SpatialService.locationsInBounds} for PostGIS spatial query
   * @see {@link TileCacheService} for caching implementation
   */
  @Query(() => GeoJSONFeatureCollection, {
    description: 'Get map layer as GeoJSON FeatureCollection for viewport',
  })
  @UseGuards(JwtAuthGuard)
  async mapLayer(
    @Args('worldId', { type: () => ID }) worldId: string,
    @Args('bbox', { type: () => BoundingBoxInput }) bbox: BoundingBoxInput,
    @Args('filters', { type: () => MapFilterInput, nullable: true }) filters: MapFilterInput | null,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<GeoJSONFeatureCollection> {
    // Generate cache key
    const cacheFilters = filters
      ? { locationTypes: filters.locationTypes || undefined }
      : undefined;
    const cacheKey = this.tileCacheService.generateTileKey(
      worldId,
      {
        west: bbox.west,
        south: bbox.south,
        east: bbox.east,
        north: bbox.north,
      },
      cacheFilters
    );

    // Check cache first
    const cached = this.tileCacheService.get(cacheKey);
    if (cached) {
      // Type assertion: we know cached features always have string ids
      return cached as GeoJSONFeatureCollection;
    }

    // Cache miss - generate FeatureCollection
    // Query locations within bounding box
    const locations = await this.spatialService.locationsInBounds(
      {
        west: bbox.west,
        south: bbox.south,
        east: bbox.east,
        north: bbox.north,
      },
      worldId
    );

    // Apply additional filters if provided
    let filteredLocations = locations;
    if (filters) {
      filteredLocations = locations.filter((loc) => {
        // Filter by location types
        if (filters.locationTypes && filters.locationTypes.length > 0) {
          if (!filters.locationTypes.includes(loc.type)) {
            return false;
          }
        }
        return true;
      });
    }

    // Convert to GeoJSON FeatureCollection
    const features = await Promise.all(
      filteredLocations.map(async (loc) => {
        // Get geometry as GeoJSON (handle null geom)
        if (!loc.geom) {
          return null;
        }
        const geometry = this.spatialService.wkbToGeoJSON(loc.geom);

        // Build feature properties with entity metadata
        const properties: Record<string, unknown> = {
          name: loc.name,
          type: loc.type,
        };

        // Check if location has a settlement
        const settlement = await this.settlementService.findByLocationId(loc.id);
        if (settlement) {
          properties.settlement = {
            id: settlement.id,
            name: settlement.name,
            level: settlement.level,
            kingdomId: settlement.kingdomId,
          };
        }

        return {
          type: 'Feature' as const,
          id: loc.id,
          geometry,
          properties,
        };
      })
    );

    // Filter out null features (locations with null geometry)
    const validFeatures = features.filter((f): f is NonNullable<typeof f> => f !== null);

    const featureCollection: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: validFeatures,
    };

    // Store in cache - type assertion safe since geometry comes from wkbToGeoJSON
    this.tileCacheService.set(
      cacheKey,
      featureCollection as import('@campaign/shared').GeoJSONFeatureCollection
    );

    return featureCollection;
  }

  /**
   * Updates the geometry of an existing location using GeoJSON.
   *
   * Converts GeoJSON geometry to PostGIS WKB format and updates the location's
   * spatial data. Supports optimistic locking via expectedVersion and optional
   * branch-aware updates for the branching system.
   *
   * **Authorization:** OWNER or GM role required
   *
   * **Side Effects:**
   * - Updates location geometry in PostGIS
   * - Creates audit log entry with geometry diff
   * - Invalidates tile cache for affected viewport regions
   * - Updates version number for optimistic concurrency control
   * - Records worldTime if provided (for temporal tracking)
   *
   * @param id - Location identifier
   * @param input - Geometry update data (GeoJSON, version, branch, SRID, worldTime)
   * @param user - Authenticated user performing the update
   * @returns Updated location with new geometry
   *
   * @see {@link LocationService.updateLocationGeometry} for validation and update logic
   */
  @Mutation(() => Location, { description: 'Update location geometry' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async updateLocationGeometry(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateLocationGeometryInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Location> {
    // Cast geoJson to GeoJSONGeometry type
    const geoJson = input.geoJson as GeoJSONGeometry;

    // Call LocationService.updateLocationGeometry
    return this.locationService.updateLocationGeometry(
      id,
      geoJson,
      user,
      input.expectedVersion,
      input.branchId,
      input.srid,
      input.worldTime
    ) as unknown as Location;
  }

  /**
   * Finds all locations near a point within a specified radius.
   *
   * Uses PostGIS ST_DWithin for efficient proximity search with spatial indexing.
   * Returns locations sorted by distance from the query point. Distances are
   * calculated in the specified SRID's units (defaults to Web Mercator meters).
   *
   * @param input - Proximity search parameters (point, radius, SRID, worldId)
   * @param _user - Authenticated user (required for access control)
   * @returns Array of locations with calculated distance from query point
   *
   * @see {@link SpatialService.locationsNear} for PostGIS proximity query
   */
  @Query(() => [LocationWithDistance], {
    description: 'Find locations near a point within radius',
  })
  @UseGuards(JwtAuthGuard)
  async locationsNear(
    @Args('input') input: LocationsNearInput,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<LocationWithDistance[]> {
    const geoJsonPoint: GeoJSONPoint = {
      type: 'Point',
      coordinates: [input.point.longitude, input.point.latitude],
    };

    const results = await this.spatialService.locationsNear(
      geoJsonPoint,
      input.radius,
      input.srid || 3857, // Default to Web Mercator
      input.worldId
    );

    // Fetch full location data for each result to get all required fields
    const locationsWithDistance = await Promise.all(
      results.map(async (result) => {
        const location = await this.locationService.findById(result.id);
        if (!location) {
          throw new Error(`Location ${result.id} not found`);
        }
        return {
          id: location.id,
          worldId: location.worldId,
          type: location.type,
          name: location.name ?? undefined,
          description: location.description ?? undefined,
          parentLocationId: location.parentLocationId ?? undefined,
          distance: result.distance,
          createdAt: location.createdAt,
          updatedAt: location.updatedAt,
        };
      })
    );

    return locationsWithDistance;
  }

  /**
   * Finds all locations spatially contained within a region's polygon boundary.
   *
   * Uses PostGIS ST_Contains to perform spatial containment check between the
   * region's geometry and location geometries. Optionally filters by worldId
   * to restrict results to a specific world.
   *
   * @param regionId - Region identifier (location with polygon geometry)
   * @param worldId - Optional world identifier to filter results
   * @param _user - Authenticated user (required for access control)
   * @returns Array of locations fully contained within the region polygon
   *
   * @see {@link SpatialService.locationsInRegion} for PostGIS containment query
   */
  @Query(() => [Location], {
    description: 'Find all locations within a region',
  })
  @UseGuards(JwtAuthGuard)
  async locationsInRegion(
    @Args('regionId', { type: () => ID }) regionId: string,
    @Args('worldId', { type: () => ID, nullable: true }) worldId: string | null,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<Location[]> {
    const results = await this.spatialService.locationsInRegion(regionId, worldId || undefined);

    // Fetch full location data for each result to get all required fields
    const locations = await Promise.all(
      results.map(async (loc) => {
        const location = await this.locationService.findById(loc.id);
        if (!location) {
          throw new Error(`Location ${loc.id} not found`);
        }
        return {
          id: location.id,
          worldId: location.worldId,
          type: location.type,
          name: location.name ?? undefined,
          description: location.description ?? undefined,
          parentLocationId: location.parentLocationId ?? undefined,
          createdAt: location.createdAt,
          updatedAt: location.updatedAt,
          deletedAt: location.deletedAt ?? undefined,
          archivedAt: location.archivedAt ?? undefined,
        };
      })
    );

    return locations;
  }

  /**
   * Checks if two region polygons have any spatial overlap.
   *
   * Uses PostGIS ST_Overlaps to detect if two region geometries intersect
   * or share any common area. Useful for validating kingdom boundaries,
   * detecting territory conflicts, or checking region adjacency.
   *
   * @param region1Id - First region identifier (location with polygon geometry)
   * @param region2Id - Second region identifier (location with polygon geometry)
   * @param _user - Authenticated user (required for access control)
   * @returns Result object containing overlap boolean and region identifiers
   *
   * @see {@link SpatialService.checkRegionOverlap} for PostGIS overlap query
   */
  @Query(() => RegionOverlapResult, {
    description: 'Check if two regions overlap (utility function)',
  })
  @UseGuards(JwtAuthGuard)
  async checkRegionOverlap(
    @Args('region1Id', { type: () => ID }) region1Id: string,
    @Args('region2Id', { type: () => ID }) region2Id: string,
    @CurrentUser() _user: AuthenticatedUser
  ): Promise<RegionOverlapResult> {
    const overlaps = await this.spatialService.checkRegionOverlap(region1Id, region2Id);

    return {
      overlaps,
      region1Id,
      region2Id,
    };
  }

  /**
   * Finds all settlements spatially contained within a region's polygon boundary.
   *
   * Performs a spatial join between settlements (via their location geometries)
   * and the region polygon using PostGIS ST_Contains. Useful for determining
   * which settlements belong to a kingdom's territory or counting population
   * within a geographic area.
   *
   * @param regionId - Region identifier (location with polygon geometry)
   * @param worldId - Optional world identifier to filter results
   * @param user - Authenticated user (required for access control)
   * @returns Array of settlements whose locations are contained within the region
   *
   * @see {@link SpatialService.settlementsInRegion} for PostGIS spatial join query
   */
  @Query(() => [Settlement], {
    description: 'Find all settlements within a region',
  })
  @UseGuards(JwtAuthGuard)
  async settlementsInRegion(
    @Args('regionId', { type: () => ID }) regionId: string,
    @Args('worldId', { type: () => ID, nullable: true }) worldId: string | null,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement[]> {
    const results = await this.spatialService.settlementsInRegion(regionId, worldId || undefined);

    // Fetch full settlement data for each result to get all required fields
    const settlements = await Promise.all(
      results.map(async (result) => {
        const settlement = await this.settlementService.findById(result.id, user);
        if (!settlement) {
          throw new Error(`Settlement ${result.id} not found`);
        }
        return settlement as unknown as Settlement;
      })
    );

    return settlements;
  }

  /**
   * Finds the settlement associated with a specific location.
   *
   * Looks up the settlement directly linked to the given location ID.
   * A location can have at most one settlement. Returns null if no
   * settlement exists at the location.
   *
   * @param locationId - Location identifier to check for settlement
   * @param user - Authenticated user (required for access control)
   * @returns Settlement at the location, or null if none exists
   *
   * @see {@link SpatialService.settlementAtLocation} for lookup query
   */
  @Query(() => Settlement, {
    nullable: true,
    description: 'Find settlement at specific location',
  })
  @UseGuards(JwtAuthGuard)
  async settlementAtLocation(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Settlement | null> {
    const result = await this.spatialService.settlementAtLocation(locationId);

    if (!result) {
      return null;
    }

    // Fetch full settlement data to get all required fields
    const settlement = await this.settlementService.findById(result.id, user);
    if (!settlement) {
      throw new Error(`Settlement ${result.id} not found`);
    }

    return settlement as unknown as Settlement;
  }

  /**
   * Finds all settlements near a point within a specified radius.
   *
   * Performs a spatial proximity search using PostGIS ST_DWithin on settlement
   * locations. Returns settlements sorted by distance from the query point.
   * Distances are calculated in the specified SRID's units (defaults to Web
   * Mercator meters). Useful for "find nearest town" queries or radius-based
   * encounter generation.
   *
   * @param input - Proximity search parameters (point, radius, SRID, worldId)
   * @param user - Authenticated user (required for access control)
   * @returns Array of settlements with calculated distance from query point
   *
   * @see {@link SpatialService.settlementsNear} for PostGIS proximity query
   */
  @Query(() => [SettlementWithDistance], {
    description: 'Find settlements near a point within radius',
  })
  @UseGuards(JwtAuthGuard)
  async settlementsNear(
    @Args('input') input: SettlementsNearInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<SettlementWithDistance[]> {
    const geoJsonPoint: GeoJSONPoint = {
      type: 'Point',
      coordinates: [input.point.longitude, input.point.latitude],
    };

    const results = await this.spatialService.settlementsNear(
      geoJsonPoint,
      input.radius,
      input.srid || 3857, // Default to Web Mercator
      input.worldId
    );

    // Fetch full settlement data for each result to get all required fields
    const settlementsWithDistance = await Promise.all(
      results.map(async (result) => {
        const settlement = await this.settlementService.findById(result.id, user);
        if (!settlement) {
          throw new Error(`Settlement ${result.id} not found`);
        }
        return {
          id: settlement.id,
          locationId: settlement.locationId,
          name: settlement.name ?? undefined,
          kingdomId: settlement.kingdomId ?? undefined,
          level: settlement.level.toString(),
          distance: result.distance,
          createdAt: settlement.createdAt,
          updatedAt: settlement.updatedAt,
        };
      })
    );

    return settlementsWithDistance;
  }
}
