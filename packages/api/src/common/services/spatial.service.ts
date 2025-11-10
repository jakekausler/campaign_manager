/**
 * @fileoverview Spatial Service for PostGIS Operations
 *
 * Provides comprehensive spatial data operations for the Campaign Manager application.
 * Handles conversion between GeoJSON and PostGIS formats, geometry validation, and
 * spatial queries for locations, settlements, and geographic regions.
 *
 * Key Features:
 * - GeoJSON ↔ PostGIS WKB/EWKB format conversion using wkx library
 * - Comprehensive geometry validation for all GeoJSON geometry types
 * - CRS (Coordinate Reference System) configuration and SRID management
 * - Spatial query operations: proximity searches, containment checks, bounding box queries
 * - Settlement-specific spatial queries with caching support
 * - Distance calculations and region overlap detection
 *
 * Supported Geometry Types:
 * - Point, LineString, Polygon
 * - MultiPoint, MultiLineString, MultiPolygon
 * - GeometryCollection
 *
 * Default Coordinate Systems:
 * - SRID 4326 (WGS 84) - Standard geographic coordinates
 * - SRID 3857 (Web Mercator) - Default for spatial queries
 *
 * Database Integration:
 * - Uses PostGIS spatial extension for PostgreSQL
 * - Leverages spatial indexes for efficient queries
 * - Soft-delete aware (filters out deletedAt records)
 * - Supports Redis caching for frequently accessed spatial queries
 *
 * Performance Considerations:
 * - Spatial queries utilize PostGIS spatial indexes (GIST)
 * - Proximity queries use ST_DWithin for indexed distance filtering
 * - Results cached with 300-second TTL for repeated queries
 * - Cache keys normalized for consistent cache hits
 *
 * @module SpatialService
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as wkx from 'wkx';

import {
  GeoJSONGeometry,
  GeoJSONPoint,
  GeoJSONPolygon,
  GeoJSONMultiPolygon,
  GeometryValidationResult,
  CRSConfig,
  SRID,
} from '@campaign/shared';

import { PrismaService } from '../../database/prisma.service';
import { buildSpatialQueryKey, normalizeSpatialParams } from '../cache/cache-key.builder';
import { CacheService } from '../cache/cache.service';

/**
 * Bounding box for spatial queries.
 *
 * Defines a rectangular geographic area using west/south/east/north coordinates.
 * Coordinates are in the specified CRS (default: Web Mercator 3857).
 */
export interface BoundingBox {
  /** Western longitude boundary */
  west: number;
  /** Southern latitude boundary */
  south: number;
  /** Eastern longitude boundary */
  east: number;
  /** Northern latitude boundary */
  north: number;
  /** Spatial Reference System Identifier (default: 3857 Web Mercator) */
  srid?: number;
}

/**
 * Service for spatial data operations.
 *
 * Provides comprehensive spatial functionality including:
 * - Format conversion between GeoJSON and PostGIS WKB/EWKB
 * - Geometry validation for all GeoJSON types
 * - Spatial query operations (proximity, containment, overlap)
 * - Settlement-specific spatial queries
 * - CRS configuration and SRID management
 * - Redis caching for spatial query results
 *
 * Uses PostGIS spatial extension for all database operations.
 * All spatial queries respect soft-delete (filter by deletedAt IS NULL).
 */
@Injectable()
export class SpatialService {
  private readonly logger = new Logger(SpatialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService
  ) {}
  /**
   * Default CRS configurations
   */
  private readonly defaultCRSConfigs: Record<number, CRSConfig> = {
    [SRID.WGS84]: {
      srid: SRID.WGS84,
      name: 'WGS 84',
      isCustom: false,
    },
    [SRID.WEB_MERCATOR]: {
      srid: SRID.WEB_MERCATOR,
      name: 'Web Mercator',
      isCustom: true,
    },
  };

  /**
   * Convert GeoJSON geometry to PostGIS WKB (Well-Known Binary) format
   * @param geoJson GeoJSON geometry object
   * @returns Buffer containing WKB representation
   * @throws BadRequestException if GeoJSON is invalid
   */
  geoJsonToWKB(geoJson: GeoJSONGeometry): Buffer {
    // Validate basic structure before parsing
    if (!geoJson || typeof geoJson !== 'object') {
      throw new BadRequestException('Invalid GeoJSON: must be an object');
    }
    if (!geoJson.type) {
      throw new BadRequestException('Invalid GeoJSON: missing type property');
    }
    if (!('coordinates' in geoJson)) {
      throw new BadRequestException('Invalid GeoJSON: missing coordinates property');
    }
    if (!Array.isArray((geoJson as { coordinates?: unknown }).coordinates)) {
      throw new BadRequestException('Invalid GeoJSON: coordinates must be an array');
    }

    try {
      const geometry = wkx.Geometry.parseGeoJSON(geoJson);
      return geometry.toWkb();
    } catch (error) {
      throw new BadRequestException(
        `Invalid GeoJSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert PostGIS WKB to GeoJSON geometry
   * @param wkb Buffer containing WKB data
   * @returns GeoJSON geometry object
   * @throws BadRequestException if WKB is invalid
   */
  wkbToGeoJSON(wkb: Buffer): GeoJSONGeometry {
    try {
      // Ensure wkb is a Buffer (Prisma might return it as Uint8Array or similar)
      const buffer = Buffer.isBuffer(wkb) ? wkb : Buffer.from(wkb);
      const geometry = wkx.Geometry.parse(buffer);
      return geometry.toGeoJSON() as GeoJSONGeometry;
    } catch (error) {
      throw new BadRequestException(
        `Invalid WKB: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert GeoJSON geometry to EWKB (Extended Well-Known Binary) with SRID
   * @param geoJson GeoJSON geometry object
   * @param srid Spatial Reference System Identifier
   * @returns Buffer containing EWKB representation
   */
  geoJsonToEWKB(geoJson: GeoJSONGeometry, srid: number): Buffer {
    try {
      const geometry = wkx.Geometry.parseGeoJSON(geoJson);
      geometry.srid = srid;
      return geometry.toEwkb();
    } catch (error) {
      throw new BadRequestException(
        `Invalid GeoJSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert EWKB to GeoJSON geometry
   * @param ewkb Buffer containing EWKB data
   * @returns Object containing GeoJSON geometry and SRID
   */
  ewkbToGeoJSON(ewkb: Buffer): { geometry: GeoJSONGeometry; srid?: number } {
    try {
      const geometry = wkx.Geometry.parse(ewkb);
      return {
        geometry: geometry.toGeoJSON() as GeoJSONGeometry,
        srid: geometry.srid,
      };
    } catch (error) {
      throw new BadRequestException(
        `Invalid EWKB: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate a GeoJSON geometry
   * Checks for:
   * - Valid geometry type
   * - Closed polygon rings (first and last coordinates match)
   * - No self-intersections (basic check)
   * - Valid coordinate arrays
   * @param geometry GeoJSON geometry to validate
   * @returns Validation result with errors if invalid
   */
  validateGeometry(geometry: GeoJSONGeometry): GeometryValidationResult {
    const errors: string[] = [];

    try {
      // Type validation
      if (!geometry || !geometry.type) {
        errors.push('Geometry must have a type property');
        return { valid: false, errors };
      }

      // Validate based on geometry type
      switch (geometry.type) {
        case 'Point':
          this.validatePoint(geometry, errors);
          break;
        case 'LineString':
          this.validateLineString(geometry, errors);
          break;
        case 'Polygon':
          this.validatePolygon(geometry, errors);
          break;
        case 'MultiPoint':
          this.validateMultiPoint(geometry, errors);
          break;
        case 'MultiLineString':
          this.validateMultiLineString(geometry, errors);
          break;
        case 'MultiPolygon':
          this.validateMultiPolygon(geometry, errors);
          break;
        case 'GeometryCollection':
          this.validateGeometryCollection(geometry, errors);
          break;
        default:
          errors.push(`Unknown geometry type: ${(geometry as { type?: unknown }).type}`);
      }

      // Try parsing with wkx library for additional validation
      if (errors.length === 0) {
        try {
          wkx.Geometry.parseGeoJSON(geometry);
        } catch (error) {
          errors.push(
            `WKX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a Point geometry.
   *
   * Ensures the point has exactly 2 coordinate values (longitude, latitude)
   * and that both values are valid finite numbers.
   *
   * @param point GeoJSON Point geometry to validate
   * @param errors Array to collect validation error messages
   */
  private validatePoint(point: GeoJSONPoint, errors: string[]): void {
    if (!Array.isArray(point.coordinates)) {
      errors.push('Point coordinates must be an array');
      return;
    }
    if (point.coordinates.length !== 2) {
      errors.push('Point coordinates must have exactly 2 elements [lon, lat]');
    }
    if (!this.isValidCoordinate(point.coordinates)) {
      errors.push('Point coordinates must be valid numbers');
    }
  }

  /**
   * Validate a LineString geometry.
   *
   * Ensures the LineString has at least 2 coordinate positions,
   * and that all coordinates are valid finite numbers.
   *
   * @param lineString GeoJSON LineString geometry to validate
   * @param errors Array to collect validation error messages
   */
  private validateLineString(
    lineString: { coordinates: [number, number][] },
    errors: string[]
  ): void {
    if (!Array.isArray(lineString.coordinates)) {
      errors.push('LineString coordinates must be an array');
      return;
    }
    if (lineString.coordinates.length < 2) {
      errors.push('LineString must have at least 2 positions');
    }
    for (let i = 0; i < lineString.coordinates.length; i++) {
      if (!this.isValidCoordinate(lineString.coordinates[i])) {
        errors.push(`Invalid coordinate at position ${i}`);
      }
    }
  }

  /**
   * Validate a Polygon geometry.
   *
   * Ensures the polygon has at least one ring (exterior ring required),
   * each ring has at least 4 positions (minimum 3 distinct points + 1 closing point),
   * and all rings are properly closed (first and last positions must match).
   * Also validates that all coordinates are valid finite numbers.
   *
   * @param polygon GeoJSON Polygon geometry to validate
   * @param errors Array to collect validation error messages
   */
  private validatePolygon(polygon: GeoJSONPolygon, errors: string[]): void {
    if (!Array.isArray(polygon.coordinates)) {
      errors.push('Polygon coordinates must be an array');
      return;
    }
    if (polygon.coordinates.length === 0) {
      errors.push('Polygon must have at least one ring');
      return;
    }

    // Validate each ring
    for (let ringIndex = 0; ringIndex < polygon.coordinates.length; ringIndex++) {
      const ring = polygon.coordinates[ringIndex];
      const ringType = ringIndex === 0 ? 'exterior' : 'interior';

      if (!Array.isArray(ring)) {
        errors.push(`Polygon ${ringType} ring ${ringIndex} must be an array`);
        continue;
      }

      // A valid ring needs at least 4 positions (minimum 3 distinct points + 1 closing point)
      if (ring.length < 4) {
        errors.push(`Polygon ${ringType} ring ${ringIndex} must have at least 4 positions`);
        continue;
      }

      // Check if ring is closed (first and last positions match)
      const firstPos = ring[0];
      const lastPos = ring[ring.length - 1];
      const isClosed = firstPos[0] === lastPos[0] && firstPos[1] === lastPos[1];

      if (!isClosed) {
        // If not closed and has exactly 4 positions, it's too few (needs closing position)
        // If not closed and has more than 4 positions, it's just not closed properly
        if (ring.length === 4) {
          errors.push(`Polygon ${ringType} ring ${ringIndex} must have at least 4 positions`);
        } else {
          errors.push(
            `Polygon ${ringType} ring ${ringIndex} is not closed (first and last positions must match)`
          );
        }
      }

      // Validate each coordinate
      for (let i = 0; i < ring.length; i++) {
        if (!this.isValidCoordinate(ring[i])) {
          errors.push(`Invalid coordinate in ${ringType} ring ${ringIndex} at position ${i}`);
        }
      }
    }
  }

  /**
   * Validate a MultiPoint geometry.
   *
   * Ensures all point coordinates in the collection are valid finite numbers.
   *
   * @param multiPoint GeoJSON MultiPoint geometry to validate
   * @param errors Array to collect validation error messages
   */
  private validateMultiPoint(
    multiPoint: { coordinates: [number, number][] },
    errors: string[]
  ): void {
    if (!Array.isArray(multiPoint.coordinates)) {
      errors.push('MultiPoint coordinates must be an array');
      return;
    }
    for (let i = 0; i < multiPoint.coordinates.length; i++) {
      if (!this.isValidCoordinate(multiPoint.coordinates[i])) {
        errors.push(`Invalid coordinate at position ${i}`);
      }
    }
  }

  /**
   * Validate a MultiLineString geometry.
   *
   * Validates each LineString in the collection by delegating to validateLineString.
   * Ensures all LineStrings meet the minimum 2-position requirement and have valid coordinates.
   *
   * @param multiLineString GeoJSON MultiLineString geometry to validate
   * @param errors Array to collect validation error messages
   */
  private validateMultiLineString(
    multiLineString: { coordinates: [number, number][][] },
    errors: string[]
  ): void {
    if (!Array.isArray(multiLineString.coordinates)) {
      errors.push('MultiLineString coordinates must be an array');
      return;
    }
    for (let i = 0; i < multiLineString.coordinates.length; i++) {
      this.validateLineString({ coordinates: multiLineString.coordinates[i] }, errors);
    }
  }

  /**
   * Validate a MultiPolygon geometry.
   *
   * Validates each Polygon in the collection by delegating to validatePolygon.
   * Ensures all polygons meet ring requirements and have properly closed rings.
   *
   * @param multiPolygon GeoJSON MultiPolygon geometry to validate
   * @param errors Array to collect validation error messages
   */
  private validateMultiPolygon(multiPolygon: GeoJSONMultiPolygon, errors: string[]): void {
    if (!Array.isArray(multiPolygon.coordinates)) {
      errors.push('MultiPolygon coordinates must be an array');
      return;
    }
    for (let i = 0; i < multiPolygon.coordinates.length; i++) {
      this.validatePolygon({ type: 'Polygon', coordinates: multiPolygon.coordinates[i] }, errors);
    }
  }

  /**
   * Validate a GeometryCollection.
   *
   * Recursively validates each geometry in the collection by delegating to validateGeometry.
   * Supports nested GeometryCollections.
   *
   * @param collection GeoJSON GeometryCollection to validate
   * @param errors Array to collect validation error messages
   */
  private validateGeometryCollection(
    collection: { geometries: GeoJSONGeometry[] },
    errors: string[]
  ): void {
    if (!Array.isArray(collection.geometries)) {
      errors.push('GeometryCollection geometries must be an array');
      return;
    }
    for (let i = 0; i < collection.geometries.length; i++) {
      const result = this.validateGeometry(collection.geometries[i]);
      if (!result.valid) {
        errors.push(`GeometryCollection geometry ${i} is invalid: ${result.errors.join(', ')}`);
      }
    }
  }

  /**
   * Check if a coordinate is valid.
   *
   * A valid coordinate must:
   * - Be an array with exactly 2 elements [longitude, latitude]
   * - Both elements must be numbers
   * - Both elements must be finite (not NaN, not Infinity)
   *
   * @param coord Coordinate array to validate
   * @returns True if coordinate is valid, false otherwise
   */
  private isValidCoordinate(coord: [number, number]): boolean {
    return (
      Array.isArray(coord) &&
      coord.length === 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1]) &&
      isFinite(coord[0]) &&
      isFinite(coord[1])
    );
  }

  /**
   * Get CRS configuration for a given SRID
   * @param srid Spatial Reference System Identifier
   * @returns CRS configuration
   */
  getCRSConfig(srid: number): CRSConfig {
    if (this.defaultCRSConfigs[srid]) {
      return this.defaultCRSConfigs[srid];
    }

    // For custom SRIDs, return a default configuration
    return {
      srid,
      name: `Custom CRS ${srid}`,
      isCustom: true,
    };
  }

  /**
   * Get default SRID (Web Mercator)
   * @returns Default SRID
   */
  getDefaultSRID(): number {
    return SRID.WEB_MERCATOR;
  }

  /**
   * Check if an SRID is valid
   * @param srid SRID to check
   * @returns True if SRID is valid (positive integer)
   */
  isValidSRID(srid: number): boolean {
    return Number.isInteger(srid) && srid > 0;
  }

  // =================================================================
  // Spatial Query Operations
  // =================================================================

  /**
   * Check if a point location is within a region location.
   *
   * Uses PostGIS ST_Covers function to test spatial containment.
   * Includes points on the boundary of the region (covers vs. within).
   *
   * Performance: Leverages spatial index (GIST) for efficient lookup.
   *
   * @param pointId ID of the point location to test
   * @param regionId ID of the region location (polygon/multipolygon)
   * @returns True if point is within region (including boundary), false otherwise
   * @throws Error if either location ID does not exist
   */
  async pointWithinRegion(pointId: string, regionId: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<[{ within: boolean }]>`
      SELECT ST_Covers(
        (SELECT geom FROM "Location" WHERE id = ${regionId}),
        (SELECT geom FROM "Location" WHERE id = ${pointId})
      ) as within
    `;
    return result[0]?.within ?? false;
  }

  /**
   * Calculate distance between two locations.
   *
   * Uses PostGIS ST_Distance function to compute planar distance between geometries.
   * Distance units depend on the Spatial Reference System (SRS):
   * - For projected CRS (e.g., Web Mercator 3857): distance in meters
   * - For geographic CRS (e.g., WGS 84 4326): distance in degrees
   *
   * Note: For geographic coordinates, consider using ST_Distance_Sphere or
   * ST_Distance_Spheroid for accurate distances in meters.
   *
   * Performance: Leverages spatial index (GIST) for efficient lookup.
   *
   * @param location1Id ID of the first location
   * @param location2Id ID of the second location
   * @returns Distance in meters (for projected CRS) or degrees (for geographic CRS)
   * @throws Error if either location ID does not exist
   */
  async distance(location1Id: string, location2Id: string): Promise<number> {
    const result = await this.prisma.$queryRaw<[{ distance: number }]>`
      SELECT ST_Distance(
        (SELECT geom FROM "Location" WHERE id = ${location1Id}),
        (SELECT geom FROM "Location" WHERE id = ${location2Id})
      ) as distance
    `;
    return result[0]?.distance ?? 0;
  }

  /**
   * Find all locations within a bounding box.
   *
   * Uses PostGIS ST_Intersects with ST_MakeEnvelope to efficiently query
   * locations that intersect with the specified rectangular bounding box.
   *
   * The bounding box is specified using west/south/east/north coordinates
   * in the coordinate system identified by the SRID (default: Web Mercator 3857).
   *
   * Only returns non-deleted locations (deletedAt IS NULL).
   * If worldId is provided, results are filtered to that world.
   *
   * Performance: Uses spatial index (GIST) for efficient bounding box queries.
   *
   * @param bbox Bounding box with west, south, east, north coordinates
   * @param worldId Optional world ID to filter locations to a specific world
   * @returns Array of locations within the bounding box with geometry as WKB buffer
   */
  async locationsInBounds(
    bbox: BoundingBox,
    worldId?: string
  ): Promise<{ id: string; name: string | null; type: string; geom: Buffer | null }[]> {
    const srid = bbox.srid ?? SRID.WEB_MERCATOR;

    if (worldId) {
      return this.prisma.$queryRaw`
        SELECT id, name, type, ST_AsBinary(geom) as geom
        FROM "Location"
        WHERE "worldId" = ${worldId}
          AND "deletedAt" IS NULL
          AND ST_Intersects(
            geom,
            ST_MakeEnvelope(
              ${bbox.west}::double precision,
              ${bbox.south}::double precision,
              ${bbox.east}::double precision,
              ${bbox.north}::double precision,
              ${srid}::integer
            )
          )
      `;
    }

    return this.prisma.$queryRaw`
      SELECT id, name, type, ST_AsBinary(geom) as geom
      FROM "Location"
      WHERE "deletedAt" IS NULL
        AND ST_Intersects(
          geom,
          ST_MakeEnvelope(
            ${bbox.west}::double precision,
            ${bbox.south}::double precision,
            ${bbox.east}::double precision,
            ${bbox.north}::double precision,
            ${srid}::integer
          )
        )
    `;
  }

  /**
   * Find all locations near a point within a given radius.
   *
   * Uses PostGIS ST_DWithin for efficient proximity queries with spatial index.
   * Results are ordered by actual distance from the query point.
   *
   * The radius and distance units depend on the Spatial Reference System:
   * - For projected CRS (e.g., Web Mercator 3857): radius in meters
   * - For geographic CRS (e.g., WGS 84 4326): radius in degrees
   *
   * Only returns non-deleted locations (deletedAt IS NULL).
   * If worldId is provided, results are filtered to that world.
   *
   * Caching:
   * - Results cached with 300-second TTL using Redis
   * - Cache keys normalized to handle coordinate precision differences
   * - Graceful degradation if cache fails (logs warning, continues with query)
   *
   * Performance: ST_DWithin leverages spatial index (GIST) for indexed distance filtering.
   *
   * @param point GeoJSON point coordinates [longitude, latitude]
   * @param radius Search radius in meters (for projected CRS) or degrees (for geographic CRS)
   * @param srid Spatial reference system ID (default: Web Mercator 3857)
   * @param worldId Optional world ID to filter locations to a specific world
   * @returns Array of locations within radius with distances, ordered by distance ascending
   */
  async locationsNear(
    point: GeoJSONPoint,
    radius: number,
    srid: number = SRID.WEB_MERCATOR,
    worldId?: string
  ): Promise<
    { id: string; name: string | null; type: string; geom: Buffer | null; distance: number }[]
  > {
    // Build cache key with normalized parameters
    const branchId = 'main'; // TODO: Support branch parameter in future
    const normalizedParams = normalizeSpatialParams(
      point.coordinates[1], // latitude
      point.coordinates[0], // longitude
      radius,
      srid,
      worldId
    );

    const cacheKey = buildSpatialQueryKey('locations-near', normalizedParams, branchId);

    // Check cache first
    try {
      const cached =
        await this.cache.get<
          { id: string; name: string | null; type: string; geom: Buffer | null; distance: number }[]
        >(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for locations near: ${cacheKey}`);
        return cached;
      }

      this.logger.debug(`Cache miss for locations near: ${cacheKey}`);
    } catch (error) {
      // Log cache error but continue - graceful degradation
      this.logger.warn(
        `Failed to read cache for locations near ${cacheKey}`,
        error instanceof Error ? error.message : undefined
      );
    }

    // Execute spatial query
    const wkb = this.geoJsonToEWKB(point, srid);

    let results: {
      id: string;
      name: string | null;
      type: string;
      geom: Buffer | null;
      distance: number;
    }[];

    if (worldId) {
      results = await this.prisma.$queryRaw`
        SELECT
          id,
          name,
          type,
          ST_AsBinary(geom) as geom,
          ST_Distance(geom, ST_GeomFromEWKB(${wkb})) as distance
        FROM "Location"
        WHERE "worldId" = ${worldId}
          AND "deletedAt" IS NULL
          AND ST_DWithin(
            geom,
            ST_GeomFromEWKB(${wkb}),
            ${radius}
          )
        ORDER BY ST_Distance(geom, ST_GeomFromEWKB(${wkb}))
      `;
    } else {
      results = await this.prisma.$queryRaw`
        SELECT
          id,
          name,
          type,
          ST_AsBinary(geom) as geom,
          ST_Distance(geom, ST_GeomFromEWKB(${wkb})) as distance
        FROM "Location"
        WHERE "deletedAt" IS NULL
          AND ST_DWithin(
            geom,
            ST_GeomFromEWKB(${wkb}),
            ${radius}
          )
        ORDER BY ST_Distance(geom, ST_GeomFromEWKB(${wkb}))
      `;
    }

    // Store results in cache for future requests (TTL: 300 seconds)
    try {
      await this.cache.set(cacheKey, results, { ttl: 300 });
      this.logger.debug(`Cached locations near: ${cacheKey}`);
    } catch (error) {
      // Log cache error but don't throw - graceful degradation
      this.logger.warn(
        `Failed to cache locations near ${cacheKey}`,
        error instanceof Error ? error.message : undefined
      );
    }

    return results;
  }

  /**
   * Find all locations within a region.
   *
   * Uses PostGIS ST_Within to find all locations completely contained within
   * the specified region geometry. The region itself is excluded from results.
   *
   * Only returns non-deleted locations (deletedAt IS NULL).
   * If worldId is provided, results are filtered to that world.
   *
   * Caching:
   * - Results cached with 300-second TTL using Redis
   * - Cache key based on regionId and optional worldId
   * - Graceful degradation if cache fails (logs warning, continues with query)
   *
   * Performance: Uses spatial index (GIST) for efficient containment queries.
   *
   * @param regionId ID of the region location (polygon/multipolygon)
   * @param worldId Optional world ID to filter locations to a specific world
   * @returns Array of locations completely within the region with geometry as WKB buffer
   */
  async locationsInRegion(
    regionId: string,
    worldId?: string
  ): Promise<{ id: string; name: string | null; type: string; geom: Buffer | null }[]> {
    // Build cache key with regionId (stable identifier)
    const branchId = 'main'; // TODO: Support branch parameter in future
    const queryParams = worldId ? [regionId, worldId] : [regionId];
    const cacheKey = buildSpatialQueryKey('locations-in-region', queryParams, branchId);

    // Check cache first
    try {
      const cached =
        await this.cache.get<
          { id: string; name: string | null; type: string; geom: Buffer | null }[]
        >(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for locations in region: ${cacheKey}`);
        return cached;
      }

      this.logger.debug(`Cache miss for locations in region: ${cacheKey}`);
    } catch (error) {
      // Log cache error but continue - graceful degradation
      this.logger.warn(
        `Failed to read cache for locations in region ${cacheKey}`,
        error instanceof Error ? error.message : undefined
      );
    }

    // Execute spatial query
    let results: { id: string; name: string | null; type: string; geom: Buffer | null }[];

    if (worldId) {
      results = await this.prisma.$queryRaw`
        SELECT id, name, type, ST_AsBinary(geom) as geom
        FROM "Location"
        WHERE "worldId" = ${worldId}
          AND "deletedAt" IS NULL
          AND id != ${regionId}
          AND ST_Within(
            geom,
            (SELECT geom FROM "Location" WHERE id = ${regionId})
          )
      `;
    } else {
      results = await this.prisma.$queryRaw`
        SELECT id, name, type, ST_AsBinary(geom) as geom
        FROM "Location"
        WHERE "deletedAt" IS NULL
          AND id != ${regionId}
          AND ST_Within(
            geom,
            (SELECT geom FROM "Location" WHERE id = ${regionId})
          )
      `;
    }

    // Store results in cache for future requests (TTL: 300 seconds)
    try {
      await this.cache.set(cacheKey, results, { ttl: 300 });
      this.logger.debug(`Cached locations in region: ${cacheKey}`);
    } catch (error) {
      // Log cache error but don't throw - graceful degradation
      this.logger.warn(
        `Failed to cache locations in region ${cacheKey}`,
        error instanceof Error ? error.message : undefined
      );
    }

    return results;
  }

  /**
   * Check if two regions overlap.
   *
   * Uses PostGIS ST_Overlaps to test if two regions share space but neither
   * completely contains the other. Returns false if regions are identical,
   * adjacent but not overlapping, or one completely contains the other.
   *
   * Performance: Leverages spatial index (GIST) for efficient lookup.
   *
   * @param region1Id ID of the first region location (polygon/multipolygon)
   * @param region2Id ID of the second region location (polygon/multipolygon)
   * @returns True if regions overlap (share space but neither contains the other), false otherwise
   * @throws Error if either region ID does not exist
   */
  async checkRegionOverlap(region1Id: string, region2Id: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<[{ overlaps: boolean }]>`
      SELECT ST_Overlaps(
        (SELECT geom FROM "Location" WHERE id = ${region1Id}),
        (SELECT geom FROM "Location" WHERE id = ${region2Id})
      ) as overlaps
    `;
    return result[0]?.overlaps ?? false;
  }

  // =================================================================
  // Settlement Spatial Query Operations
  // =================================================================

  /**
   * Find all settlements within a region location.
   *
   * Uses PostGIS ST_Within to find all settlements whose locations are completely
   * contained within the specified region geometry. Joins Settlement table with
   * Location table to perform spatial query.
   *
   * Only returns non-deleted settlements and locations (deletedAt IS NULL).
   * If worldId is provided, results are filtered to that world.
   *
   * Caching:
   * - Results cached with 300-second TTL using Redis
   * - Cache key based on regionId and optional worldId
   * - Graceful degradation if cache fails (logs warning, continues with query)
   *
   * Performance: Uses spatial index (GIST) for efficient containment queries.
   *
   * @param regionId ID of the region location (polygon/multipolygon)
   * @param worldId Optional world ID to filter settlements to a specific world
   * @returns Array of settlements within the region with basic settlement data
   */
  async settlementsInRegion(
    regionId: string,
    worldId?: string
  ): Promise<
    {
      id: string;
      name: string;
      locationId: string;
      kingdomId: string;
      level: number;
    }[]
  > {
    // Build cache key with regionId (stable identifier)
    const branchId = 'main'; // TODO: Support branch parameter in future
    const queryParams = worldId ? [regionId, worldId] : [regionId];
    const cacheKey = buildSpatialQueryKey('settlements-in-region', queryParams, branchId);

    // Check cache first
    try {
      const cached = await this.cache.get<
        {
          id: string;
          name: string;
          locationId: string;
          kingdomId: string;
          level: number;
        }[]
      >(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for settlements in region: ${cacheKey}`);
        return cached;
      }

      this.logger.debug(`Cache miss for settlements in region: ${cacheKey}`);
    } catch (error) {
      // Log cache error but continue - graceful degradation
      this.logger.warn(
        `Failed to read cache for settlements in region ${cacheKey}`,
        error instanceof Error ? error.message : undefined
      );
    }

    // Execute spatial query
    let results: {
      id: string;
      name: string;
      locationId: string;
      kingdomId: string;
      level: number;
    }[];

    if (worldId) {
      results = await this.prisma.$queryRaw`
        SELECT s.id, s.name, s."locationId", s."kingdomId", s.level
        FROM "Settlement" s
        JOIN "Location" l ON s."locationId" = l.id
        WHERE l."worldId" = ${worldId}
          AND s."deletedAt" IS NULL
          AND l."deletedAt" IS NULL
          AND ST_Within(
            l.geom,
            (SELECT geom FROM "Location" WHERE id = ${regionId})
          )
      `;
    } else {
      results = await this.prisma.$queryRaw`
        SELECT s.id, s.name, s."locationId", s."kingdomId", s.level
        FROM "Settlement" s
        JOIN "Location" l ON s."locationId" = l.id
        WHERE s."deletedAt" IS NULL
          AND l."deletedAt" IS NULL
          AND ST_Within(
            l.geom,
            (SELECT geom FROM "Location" WHERE id = ${regionId})
          )
      `;
    }

    // Store results in cache for future requests (TTL: 300 seconds)
    try {
      await this.cache.set(cacheKey, results, { ttl: 300 });
      this.logger.debug(`Cached settlements in region: ${cacheKey}`);
    } catch (error) {
      // Log cache error but don't throw - graceful degradation
      this.logger.warn(
        `Failed to cache settlements in region ${cacheKey}`,
        error instanceof Error ? error.message : undefined
      );
    }

    return results;
  }

  /**
   * Find settlement at a specific location.
   *
   * Direct lookup of a settlement by its associated location ID.
   * Does not perform spatial queries, uses foreign key relationship.
   *
   * Only returns non-deleted settlements (deletedAt IS NULL).
   *
   * @param locationId ID of the location to check for a settlement
   * @returns Settlement at the location with basic settlement data, or null if no settlement exists
   */
  async settlementAtLocation(locationId: string): Promise<{
    id: string;
    name: string;
    locationId: string;
    kingdomId: string;
    level: number;
  } | null> {
    const result = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        locationId: string;
        kingdomId: string;
        level: number;
      }[]
    >`
      SELECT id, name, "locationId", "kingdomId", level
      FROM "Settlement"
      WHERE "locationId" = ${locationId}
        AND "deletedAt" IS NULL
    `;
    return result[0] ?? null;
  }

  /**
   * Find all settlements near a point within a given radius.
   *
   * Uses PostGIS ST_DWithin for efficient proximity queries with spatial index.
   * Results are ordered by actual distance from the query point.
   * Joins Settlement table with Location table to perform spatial query.
   *
   * The radius and distance units depend on the Spatial Reference System:
   * - For projected CRS (e.g., Web Mercator 3857): radius in meters
   * - For geographic CRS (e.g., WGS 84 4326): radius in degrees
   *
   * Only returns non-deleted settlements and locations (deletedAt IS NULL).
   * If worldId is provided, results are filtered to that world.
   *
   * Note: This method does not cache results (unlike locationsNear).
   *
   * Performance: ST_DWithin leverages spatial index (GIST) for indexed distance filtering.
   *
   * @param point GeoJSON point coordinates [longitude, latitude]
   * @param radius Search radius in meters (for projected CRS) or degrees (for geographic CRS)
   * @param srid Spatial reference system ID (default: Web Mercator 3857)
   * @param worldId Optional world ID to filter settlements to a specific world
   * @returns Array of settlements within radius with distances, ordered by distance ascending
   */
  async settlementsNear(
    point: GeoJSONPoint,
    radius: number,
    srid: number = SRID.WEB_MERCATOR,
    worldId?: string
  ): Promise<
    {
      id: string;
      name: string;
      locationId: string;
      kingdomId: string;
      level: number;
      distance: number;
    }[]
  > {
    const wkb = this.geoJsonToEWKB(point, srid);

    if (worldId) {
      return this.prisma.$queryRaw`
        SELECT
          s.id,
          s.name,
          s."locationId",
          s."kingdomId",
          s.level,
          ST_Distance(l.geom, ST_GeomFromEWKB(${wkb})) as distance
        FROM "Settlement" s
        JOIN "Location" l ON s."locationId" = l.id
        WHERE l."worldId" = ${worldId}
          AND s."deletedAt" IS NULL
          AND l."deletedAt" IS NULL
          AND ST_DWithin(
            l.geom,
            ST_GeomFromEWKB(${wkb}),
            ${radius}
          )
        ORDER BY ST_Distance(l.geom, ST_GeomFromEWKB(${wkb}))
      `;
    }

    return this.prisma.$queryRaw`
      SELECT
        s.id,
        s.name,
        s."locationId",
        s."kingdomId",
        s.level,
        ST_Distance(l.geom, ST_GeomFromEWKB(${wkb})) as distance
      FROM "Settlement" s
      JOIN "Location" l ON s."locationId" = l.id
      WHERE s."deletedAt" IS NULL
        AND l."deletedAt" IS NULL
        AND ST_DWithin(
          l.geom,
          ST_GeomFromEWKB(${wkb}),
          ${radius}
        )
      ORDER BY ST_Distance(l.geom, ST_GeomFromEWKB(${wkb}))
    `;
  }
}
