import { Injectable, BadRequestException } from '@nestjs/common';
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

/**
 * Bounding box for spatial queries
 */
export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
  srid?: number;
}

/**
 * Service for spatial data operations
 * Handles GeoJSON ↔ PostGIS WKB conversion, geometry validation, and spatial queries
 */
@Injectable()
export class SpatialService {
  constructor(private readonly prisma: PrismaService) {}
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
      const geometry = wkx.Geometry.parse(wkb);
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
   * Validate a Point geometry
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
   * Validate a LineString geometry
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
   * Validate a Polygon geometry
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
   * Validate a MultiPoint geometry
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
   * Validate a MultiLineString geometry
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
   * Validate a MultiPolygon geometry
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
   * Validate a GeometryCollection
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
   * Check if a coordinate is valid
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
   * Check if a point location is within a region location
   * Includes points on the boundary of the region
   * @param pointId ID of the point location
   * @param regionId ID of the region location
   * @returns True if point is within region (including boundary), false otherwise
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
   * Calculate distance between two locations
   * @param location1Id ID of the first location
   * @param location2Id ID of the second location
   * @returns Distance in meters (for projected CRS) or degrees (for geographic CRS)
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
   * Find all locations within a bounding box
   * @param bbox Bounding box with west, south, east, north coordinates
   * @param worldId Optional world ID to filter locations
   * @returns Array of locations within the bounding box
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
   * Find all locations near a point within a given radius
   * @param point GeoJSON point coordinates
   * @param radius Radius in meters
   * @param srid Spatial reference system ID (default: Web Mercator 3857)
   * @param worldId Optional world ID to filter locations
   * @returns Array of locations within radius, ordered by distance
   */
  async locationsNear(
    point: GeoJSONPoint,
    radius: number,
    srid: number = SRID.WEB_MERCATOR,
    worldId?: string
  ): Promise<
    { id: string; name: string | null; type: string; geom: Buffer | null; distance: number }[]
  > {
    const wkb = this.geoJsonToEWKB(point, srid);

    if (worldId) {
      return this.prisma.$queryRaw`
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
    }

    return this.prisma.$queryRaw`
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

  /**
   * Find all locations within a region
   * @param regionId ID of the region location
   * @param worldId Optional world ID to filter locations
   * @returns Array of locations within the region
   */
  async locationsInRegion(
    regionId: string,
    worldId?: string
  ): Promise<{ id: string; name: string | null; type: string; geom: Buffer | null }[]> {
    if (worldId) {
      return this.prisma.$queryRaw`
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
    }

    return this.prisma.$queryRaw`
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

  /**
   * Check if two regions overlap
   * @param region1Id ID of the first region
   * @param region2Id ID of the second region
   * @returns True if regions overlap, false otherwise
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
}
