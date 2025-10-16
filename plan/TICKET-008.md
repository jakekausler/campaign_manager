# TICKET-008: PostGIS Spatial Data Integration

## Status

- [ ] Completed (Stage 3 of 7 complete)
- **Commits**:
  - Stage 1: 5f70ea5918fb3462f8b5e7a94f612118112a1f22
  - Stage 2: c7948bfc0345a4bba1cdcec8225f3b58f38916b5
  - Stage 3: 00947a331e89e0d6ce17af3d3f886b111032ffd8

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

---

### Stage 2: Database Schema and Indexes (✅ Complete)

Successfully implemented database schema updates and spatial indexes:

**Achievements:**

- Added Campaign.srid field (Int, default 3857) to support configurable coordinate systems per campaign
- Created GIST spatial index on Location.geom for efficient spatial query performance
- Wrote comprehensive integration tests (8 passing tests) verifying schema and index functionality
- Validated index usage with PostgreSQL EXPLAIN queries

**Technical Details:**

- Campaign.srid defaults to Web Mercator (EPSG:3857) for standard maps
- Custom SRIDs supported for fantasy campaign maps (can use any valid SRID)
- GIST index created with `IF NOT EXISTS` for idempotent migrations
- Migration applied cleanly to existing database without data loss

**Files Modified:**

- `packages/api/prisma/schema.prisma` - Added Campaign.srid field
- `packages/api/prisma/migrations/20251016162546_add_campaign_srid/migration.sql` - Migration with GIST index
- `packages/api/src/common/services/spatial-indexes.integration.test.ts` - 8 comprehensive integration tests

**Integration Tests:**

- Verified Campaign.srid field schema (column exists, correct type, default value 3857)
- Verified GIST index creation on Location.geom
- Validated GIST index is used for bounding box queries (ST_Intersects)
- Validated GIST index is used for distance queries (ST_DWithin)
- Tested Campaign CRUD operations with default SRID
- Tested Campaign CRUD operations with custom SRID (4326)
- Tested Campaign SRID updates
- Performance tested with 100 location grid

**Performance:**

- EXPLAIN queries confirm GIST index usage for spatial operations
- Index enables efficient ST_Intersects and ST_DWithin queries
- Tested with 100 test locations in 10x10 grid pattern
- All spatial queries successfully use the index (verified via EXPLAIN)

**Next Steps:**

- Stage 4 will implement Location geometry operations in LocationService
- These operations will integrate with the spatial query methods

---

### Stage 3: Core Spatial Query Operations (✅ Complete)

Successfully implemented all core spatial query methods in SpatialService:

**Achievements:**

- Implemented 6 spatial query methods using PostGIS functions
- All methods properly handle NULL geometries and soft-deleted locations
- Added proper type casting for Prisma compatibility
- Used ST_AsBinary for geometry serialization in query results
- Wrote comprehensive integration tests (23 passing tests)
- All queries leverage the GIST spatial index for optimal performance

**Technical Details:**

- **pointWithinRegion**: Uses ST_Covers to include boundary points (not ST_Within)
- **distance**: Calculates distance between two location geometries
- **locationsInBounds**: Uses ST_MakeEnvelope and ST_Intersects for bbox queries
- **locationsNear**: Uses ST_DWithin and orders by ST_Distance
- **locationsInRegion**: Uses ST_Within to find child locations
- **checkRegionOverlap**: Uses ST_Overlaps to detect overlapping regions

**Implementation Decisions:**

1. **ST_Covers vs ST_Within**: Changed to ST_Covers for boundary inclusion
   - ST_Within excludes points on the boundary
   - ST_Covers includes points on the boundary (more intuitive)

2. **Type Casting**: Added explicit casts for PostgreSQL compatibility
   - Bbox coordinates cast to `::double precision`
   - SRID values cast to `::integer`

3. **Geometry Serialization**: Used ST_AsBinary instead of raw geometry
   - Prisma cannot deserialize raw PostGIS geometry type
   - ST_AsBinary converts to Buffer format that Prisma handles correctly

4. **worldId Filtering**: Optional parameter for all query methods
   - Allows filtering by world for multi-world campaigns
   - Reduces query result set for better performance

**Files Added:**

- `packages/api/src/common/services/spatial-queries.integration.test.ts` - 23 comprehensive integration tests

**Files Modified:**

- `packages/api/src/common/services/spatial.service.ts` - Added 6 spatial query methods

**Integration Tests:**

All 23 tests passing:

- pointWithinRegion: 3 tests (inside, outside, boundary)
- distance: 3 tests (between points, zero distance, large distance)
- locationsInBounds: 4 tests (within bbox, outside bbox, empty bbox, worldId filter)
- locationsNear: 5 tests (within radius, outside radius, ordering, empty, distance values)
- locationsInRegion: 4 tests (within region, outside region, exclude self, empty region)
- checkRegionOverlap: 4 tests (overlapping, non-overlapping, same region, adjacent)

**Performance:**

- All spatial queries use the GIST index created in Stage 2
- Queries with worldId filter are more efficient (smaller result set)
- ST_DWithin queries benefit significantly from spatial indexing

**Next Steps:**

- Stage 4 will add Location geometry CRUD operations to LocationService

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
