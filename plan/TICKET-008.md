# TICKET-008: PostGIS Spatial Data Integration

## Status

- [ ] Completed (Stage 1 of 7 complete)
- **Commits**:
  - Stage 1: 5f70ea5918fb3462f8b5e7a94f612118112a1f22

## Implementation Notes

### Stage 1: Foundation - Spatial Utilities and Types (✅ Complete)

Successfully implemented core spatial utilities foundation:

**Achievements:**

- Created comprehensive GeoJSON type definitions in `@campaign/shared` following RFC 7946
- Implemented `SpatialService` with bidirectional conversion methods (GeoJSON ↔ WKB/EWKB)
- Added robust geometry validation for all GeoJSON types
- Implemented CRS configuration utilities with support for Web Mercator (3857), WGS84 (4326), and custom SRIDs
- Wrote 29 comprehensive unit tests covering all functionality (100% passing)

**Technical Details:**

- Uses `wkx` library (v0.5.0) for efficient WKB/EWKB binary serialization
- Strong TypeScript type safety with no `any` types
- Comprehensive error handling with NestJS `BadRequestException`
- Supports complex polygons with unlimited vertices (tested with 1000+ vertices)
- Validates polygon ring closure, coordinate validity (NaN/Infinity detection)
- Handles holes in polygons and MultiPolygon geometries

**Files Added:**

- `packages/shared/src/types/geojson.ts` - Complete GeoJSON type definitions
- `packages/api/src/common/services/spatial.service.ts` - Core spatial service
- `packages/api/src/common/services/spatial.service.test.ts` - 29 passing tests
- `packages/api/src/common/services/index.ts` - Barrel export

**Configuration Updates:**

- Updated `.eslintrc.json` with proper TypeScript import resolver for monorepo
- Added `wkx` dependency to `@campaign/api`

## Description

Integrate PostGIS spatial capabilities for map-based features, including geometry storage, spatial queries, GeoJSON conversion, and map layer generation for points and regions.

## Scope of Work

1. Create spatial utility service:
   - GeoJSON ↔ PostGIS WKB conversion
   - Geometry validation (valid polygons, no self-intersections)
   - Custom CRS support for fantasy maps (in addition to WGS84)
   - CRS configuration per campaign
2. Implement spatial queries:
   - Point within polygon (`ST_Within`)
   - Distance calculations (`ST_Distance`)
   - Bounding box queries (`ST_MakeEnvelope`, `ST_Intersects`)
   - Nearest neighbor searches
   - Region overlap detection (`ST_Overlaps`) - utility function, not enforced
3. Add Location geometry operations:
   - Create/update point locations (support unlimited complexity)
   - Create/update polygon regions (support unlimited vertices)
   - Handle multi-polygons for complex regions
   - Parent-child region hierarchy
4. Create server-side map tile API:
   - Generate map tiles from vector data
   - Tile caching strategy
   - Generate GeoJSON FeatureCollection for map viewport
   - Filter by entity type, availability, tags
   - Include entity metadata in feature properties
   - Settlement-Location spatial queries (settlements at locations)
   - Structure location context (via Settlement-Location association)
5. Implement spatial indexes:
   - GIST index on Location.geom
   - Performance testing for large datasets with complex geometries
6. Add spatial GraphQL resolvers:
   - Query: `mapLayer(bbox, filters)`
   - Mutation: `updateLocationGeometry(id, geoJSON, srid?)`
   - Query: `locationsNear(point, radius)`
   - Query: `locationsInRegion(regionId)`
   - Query: `checkRegionOverlap(regionId1, regionId2)`
   - Query: `settlementsInRegion(regionId)` - Find settlements within a region
   - Query: `settlementAtLocation(locationId)` - Find settlement at specific location
   - Query: `settlementsNear(point, radius)` - Find settlements near coordinates

## Acceptance Criteria

- [ ] Can store Point geometry for locations
- [ ] Can store Polygon/MultiPolygon for regions with unlimited vertices
- [ ] GeoJSON input converts to PostGIS geometry
- [ ] PostGIS geometry converts to GeoJSON output
- [ ] Supports custom SRID for fantasy map coordinate systems
- [ ] Can configure CRS per campaign
- [ ] Spatial queries return correct results (within, distance)
- [ ] Server-side map tiles are generated correctly
- [ ] Tile caching works efficiently
- [ ] Map layer API returns GeoJSON FeatureCollection
- [ ] Bounding box queries perform efficiently with complex geometries
- [ ] Geometry validation rejects invalid shapes
- [ ] Can query locations within a region
- [ ] Can find nearest locations to a point
- [ ] Can detect if two regions overlap (utility function)
- [ ] Spatial indexes improve query performance
- [ ] Can query settlements at a specific location
- [ ] Can query all settlements within a region
- [ ] Can find settlements near coordinates
- [ ] Settlement-Location spatial association works correctly

## Technical Notes

### GeoJSON Types

```typescript
interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [exterior ring, ...interior rings]
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONPoint | GeoJSONPolygon;
  properties: Record<string, unknown>;
}
```

### Spatial Service

```typescript
@Injectable()
export class SpatialService {
  async pointWithinRegion(pointId: string, regionId: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<[{ within: boolean }]>`
      SELECT ST_Within(
        (SELECT geom FROM "Location" WHERE id = ${pointId}),
        (SELECT geom FROM "Location" WHERE id = ${regionId})
      ) as within
    `;
    return result[0].within;
  }

  async locationsInBounds(bbox: BoundingBox): Promise<Location[]> {
    return this.prisma.$queryRaw<Location[]>`
      SELECT *
      FROM "Location"
      WHERE ST_Intersects(
        geom,
        ST_MakeEnvelope(
          ${bbox.west}, ${bbox.south},
          ${bbox.east}, ${bbox.north},
          4326
        )
      )
    `;
  }

  geoJsonToWKB(geoJson: GeoJSON): Buffer {
    // Use wellknown or wkx library
    return wkx.Geometry.parseGeoJSON(geoJson).toWkb();
  }

  wkbToGeoJSON(wkb: Buffer): GeoJSON {
    return wkx.Geometry.parse(wkb).toGeoJSON();
  }
}
```

### Map Layer Generation

```typescript
@Query(() => GraphQLJSON)
async mapLayer(
  @Args('campaignId') campaignId: string,
  @Args('bbox') bbox: BoundingBox,
  @Args('filters', { nullable: true }) filters: MapFilter,
  @Context('branch') branchId: string,
  @Context('asOf') asOf: Date,
): Promise<GeoJSONFeatureCollection> {
  const locations = await this.locationService.findInBounds(
    campaignId,
    bbox,
    branchId,
    asOf,
    filters,
  );

  return {
    type: 'FeatureCollection',
    features: locations.map(loc => ({
      type: 'Feature',
      id: loc.id,
      geometry: this.spatialService.wkbToGeoJSON(loc.geom),
      properties: {
        name: loc.name,
        type: loc.type,
        available: loc.computedAvailability,
        links: loc.linkedEntities,
      },
    })),
  };
}
```

### Settlement Spatial Queries

```typescript
// Query settlements within a region
@Query(() => [Settlement])
async settlementsInRegion(
  @Args('regionId') regionId: string,
  @Context('branch') branchId: string,
  @Context('asOf') asOf: Date,
): Promise<Settlement[]> {
  // Join Settlement with Location, check if location geometry is within region
  return this.prisma.$queryRaw<Settlement[]>`
    SELECT s.*
    FROM "Settlement" s
    JOIN "Location" l ON s."locationId" = l.id
    WHERE ST_Within(
      l.geom,
      (SELECT geom FROM "Location" WHERE id = ${regionId})
    )
    AND s."deletedAt" IS NULL
  `;
}

// Query settlement at a specific location
@Query(() => Settlement, { nullable: true })
async settlementAtLocation(
  @Args('locationId') locationId: string,
): Promise<Settlement | null> {
  return this.prisma.settlement.findFirst({
    where: {
      locationId,
      deletedAt: null,
    },
  });
}

// Find settlements near coordinates
@Query(() => [Settlement])
async settlementsNear(
  @Args('point') point: GeoJSONPoint,
  @Args('radius') radius: number, // in meters
): Promise<Settlement[]> {
  const wkb = this.spatialService.geoJsonToWKB(point);

  return this.prisma.$queryRaw<Settlement[]>`
    SELECT s.*
    FROM "Settlement" s
    JOIN "Location" l ON s."locationId" = l.id
    WHERE ST_DWithin(
      l.geom,
      ST_GeomFromWKB(${wkb}, 3857),
      ${radius}
    )
    AND s."deletedAt" IS NULL
    ORDER BY ST_Distance(l.geom, ST_GeomFromWKB(${wkb}, 3857))
  `;
}
```

## Architectural Decisions

- **CRS**: Support Web Mercator (SRID 3857) as default, plus custom SRIDs for fantasy maps configured per campaign
- **Geometry type**: Use PostGIS `geometry` not `geography` (simpler for game maps)
- **Complexity**: No limits on polygon complexity - support unlimited vertices
- **Topology**: No automatic overlap validation, but provide `checkRegionOverlap()` utility
- **Simplification**: No automatic simplification - preserve full detail
- **Tiles**: Server-side tile generation with caching
- **GeoJSON**: Standard for web mapping, good library support
- **Raw queries**: Use Prisma's `$queryRaw` for spatial operations
- **Indexing**: GIST index for spatial queries
- **Settlement location binding**: Settlements inherit geometry from their associated Location (no duplicate geometry storage)

## Dependencies

- Requires: TICKET-003 (Database with PostGIS)

## Testing Requirements

- [ ] Store and retrieve Point geometry
- [ ] Store and retrieve Polygon geometry with thousands of vertices
- [ ] Store and retrieve custom SRID geometries
- [ ] Point-in-polygon query returns correct result
- [ ] Distance calculation is accurate
- [ ] Bounding box query returns locations within bounds
- [ ] GeoJSON conversion preserves coordinates
- [ ] Invalid geometry is rejected with clear error
- [ ] Spatial index improves query performance with complex geometries
- [ ] Can handle MultiPolygon for complex regions
- [ ] checkRegionOverlap() correctly identifies overlapping regions
- [ ] checkRegionOverlap() correctly identifies non-overlapping regions
- [ ] Server-side tiles render correctly
- [ ] Tile caching reduces server load
- [ ] settlementsInRegion() returns correct settlements
- [ ] settlementAtLocation() finds settlement at location
- [ ] settlementsNear() returns settlements ordered by distance

## Related Tickets

- Requires: TICKET-003
- Blocks: TICKET-019, TICKET-020

## Estimated Effort

3-4 days
