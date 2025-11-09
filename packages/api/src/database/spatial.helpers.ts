/**
 * PostGIS Spatial Helpers
 *
 * Utilities for working with PostGIS geometry types.
 * SRID 3857 (Web Mercator) is used for all geometries.
 *
 * Note: Prisma uses Unsupported("geometry") for PostGIS types,
 * so we use raw SQL queries for spatial operations.
 */

import { PrismaClient } from '@prisma/client';

/**
 * SRID for all spatial data (Web Mercator)
 * Works well for regional maps, town maps, and fantasy world maps
 */
export const SPATIAL_SRID = 3857;

/**
 * GeoJSON Point type
 */
export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude] or [x, y]
}

/**
 * GeoJSON Polygon type
 */
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // Array of rings, first is outer, rest are holes
}

/**
 * Union type for all supported GeoJSON geometries
 */
export type GeoJsonGeometry = GeoJsonPoint | GeoJsonPolygon;

/**
 * Convert GeoJSON to PostGIS geometry WKT (Well-Known Text)
 *
 * @param geojson - GeoJSON geometry
 * @returns WKT representation of the geometry
 *
 * @example
 * ```typescript
 * const point = { type: 'Point', coordinates: [-73.9352, 40.7306] };
 * const wkt = geoJsonToWKT(point);
 * // Returns: "POINT(-73.9352 40.7306)"
 * ```
 */
export function geoJsonToWKT(geojson: GeoJsonGeometry): string {
  if (geojson.type === 'Point') {
    const [x, y] = geojson.coordinates;
    return `POINT(${x} ${y})`;
  }

  if (geojson.type === 'Polygon') {
    const rings = geojson.coordinates
      .map((ring) => {
        const coords = ring.map(([x, y]) => `${x} ${y}`).join(', ');
        return `(${coords})`;
      })
      .join(', ');
    return `POLYGON(${rings})`;
  }

  throw new Error(`Unsupported GeoJSON type: ${(geojson as { type: string }).type}`);
}

/**
 * Create a Location with PostGIS geometry from GeoJSON
 *
 * @param prisma - Prisma client instance
 * @param data - Location data with geometry as GeoJSON
 * @returns Created location
 *
 * @example
 * ```typescript
 * const location = await createLocationWithGeometry(prisma, {
 *   worldId: 'world123',
 *   type: 'point',
 *   name: 'Absalom',
 *   geometry: { type: 'Point', coordinates: [100, 200] }
 * });
 * ```
 */
export async function createLocationWithGeometry(
  prisma: PrismaClient,
  data: {
    worldId: string;
    type: string;
    name?: string;
    description?: string;
    parentLocationId?: string;
    geometry?: GeoJsonGeometry;
  }
) {
  const { worldId, type, name, description, parentLocationId, geometry } = data;

  if (!geometry) {
    // Create location without geometry
    return prisma.location.create({
      data: {
        worldId,
        type,
        name,
        description,
        parentLocationId,
      },
    });
  }

  const wkt = geoJsonToWKT(geometry);

  // Use raw SQL to insert with PostGIS geometry
  const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    INSERT INTO "Location" (id, "worldId", type, name, description, "parentLocationId", geom, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      ${worldId},
      ${type},
      ${name || null},
      ${description || null},
      ${parentLocationId || null},
      ST_GeomFromText(${wkt}, ${SPATIAL_SRID}::integer),
      NOW(),
      NOW()
    )
    RETURNING id, "worldId", type, name, description, "parentLocationId", ST_AsText(geom) as geom, "createdAt", "updatedAt";
  `;

  return result[0];
}

/**
 * Update a Location's geometry
 *
 * @param prisma - Prisma client instance
 * @param locationId - Location ID
 * @param geometry - New geometry as GeoJSON
 *
 * @example
 * ```typescript
 * await updateLocationGeometry(prisma, 'loc123', {
 *   type: 'Polygon',
 *   coordinates: [[[0, 0], [0, 100], [100, 100], [100, 0], [0, 0]]]
 * });
 * ```
 */
export async function updateLocationGeometry(
  prisma: PrismaClient,
  locationId: string,
  geometry: GeoJsonGeometry
) {
  const wkt = geoJsonToWKT(geometry);

  await prisma.$executeRaw`
    UPDATE "Location"
    SET geom = ST_GeomFromText(${wkt}, ${SPATIAL_SRID}),
        "updatedAt" = NOW()
    WHERE id = ${locationId};
  `;
}

/**
 * Find locations within a bounding box
 *
 * @param prisma - Prisma client instance
 * @param worldId - World ID to filter by
 * @param bounds - Bounding box [minX, minY, maxX, maxY]
 * @returns Locations within the bounding box
 *
 * @example
 * ```typescript
 * const locations = await findLocationsInBounds(prisma, 'world123', [0, 0, 100, 100]);
 * ```
 */
export async function findLocationsInBounds(
  prisma: PrismaClient,
  worldId: string,
  bounds: [number, number, number, number]
) {
  const [minX, minY, maxX, maxY] = bounds;

  return prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT *
    FROM "Location"
    WHERE "worldId" = ${worldId}
      AND geom IS NOT NULL
      AND ST_Intersects(
        geom,
        ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, ${SPATIAL_SRID})
      )
      AND "deletedAt" IS NULL;
  `;
}

/**
 * Find locations within a certain distance from a point
 *
 * @param prisma - Prisma client instance
 * @param worldId - World ID to filter by
 * @param point - Center point [x, y]
 * @param distance - Maximum distance in meters (planar units for SRID 3857)
 * @returns Locations within the distance
 *
 * @example
 * ```typescript
 * const nearby = await findLocationsNearPoint(prisma, 'world123', [50, 50], 1000);
 * ```
 */
export async function findLocationsNearPoint(
  prisma: PrismaClient,
  worldId: string,
  point: [number, number],
  distance: number
) {
  const [x, y] = point;

  return prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT *,
           ST_Distance(geom, ST_SetSRID(ST_MakePoint(${x}, ${y}), ${SPATIAL_SRID})) as distance
    FROM "Location"
    WHERE "worldId" = ${worldId}
      AND geom IS NOT NULL
      AND ST_DWithin(
        geom,
        ST_SetSRID(ST_MakePoint(${x}, ${y}), ${SPATIAL_SRID}),
        ${distance}
      )
      AND "deletedAt" IS NULL
    ORDER BY distance;
  `;
}

/**
 * Check if a point is within a location's geometry
 *
 * @param prisma - Prisma client instance
 * @param locationId - Location ID
 * @param point - Point to check [x, y]
 * @returns True if point is within the location
 *
 * @example
 * ```typescript
 * const isInside = await isPointWithinLocation(prisma, 'loc123', [50, 50]);
 * ```
 */
export async function isPointWithinLocation(
  prisma: PrismaClient,
  locationId: string,
  point: [number, number]
): Promise<boolean> {
  const [x, y] = point;

  const result = await prisma.$queryRaw<{ within: boolean }[]>`
    SELECT ST_Within(
      ST_SetSRID(ST_MakePoint(${x}, ${y}), ${SPATIAL_SRID}),
      geom
    ) as within
    FROM "Location"
    WHERE id = ${locationId}
      AND geom IS NOT NULL;
  `;

  return result[0]?.within || false;
}

/**
 * Get location geometry as GeoJSON
 *
 * @param prisma - Prisma client instance
 * @param locationId - Location ID
 * @returns GeoJSON representation of the geometry
 *
 * @example
 * ```typescript
 * const geojson = await getLocationGeoJSON(prisma, 'loc123');
 * console.log(geojson); // { type: 'Point', coordinates: [100, 200] }
 * ```
 */
export async function getLocationGeoJSON(
  prisma: PrismaClient,
  locationId: string
): Promise<GeoJsonGeometry | null> {
  const result = await prisma.$queryRaw<{ geojson: string }[]>`
    SELECT ST_AsGeoJSON(geom) as geojson
    FROM "Location"
    WHERE id = ${locationId}
      AND geom IS NOT NULL;
  `;

  if (!result[0]?.geojson) {
    return null;
  }

  return JSON.parse(result[0].geojson);
}
