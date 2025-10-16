# TICKET-008: PostGIS Spatial Data Integration

## Status

- [ ] Completed (Stage 6 of 7 complete)
- **Commits**:
  - Stage 1: 5f70ea5918fb3462f8b5e7a94f612118112a1f22
  - Stage 2: c7948bfc0345a4bba1cdcec8225f3b58f38916b5
  - Stage 3: 00947a331e89e0d6ce17af3d3f886b111032ffd8
  - Stage 4: a8fde52
  - Stage 5: b63eea6
  - Stage 6: c329ee5

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

- Stage 5 will add Settlement spatial queries

---

### Stage 4: Location Geometry Operations (✅ Complete)

Successfully implemented complete geometry CRUD operations for LocationService:

**Achievements:**

- Implemented `updateLocationGeometry` method with full versioning integration
- Supports Point, Polygon, and MultiPolygon geometries from GeoJSON input
- Custom SRID support per update (defaults to campaign SRID or Web Mercator 3857)
- Comprehensive GeoJSON validation before storage
- Atomic optimistic locking prevents concurrent update race conditions

**Technical Details:**

- **Geometry Storage**: Uses raw SQL with `ST_GeomFromEWKB` to store PostGIS geometry data
- **Geometry Retrieval**: Modified `findById()` to use `ST_AsBinary` for proper geometry retrieval (workaround for Prisma's `Unsupported("geometry")` type limitation)
- **Atomic Locking**: Optimistic locking check moved into UPDATE statement's WHERE clause with `version = ${expectedVersion}` for atomic protection against race conditions
- **Version Integration**: Creates version snapshots with geometry data included in compressed payload
- **Buffer Handling**: Proper handling of WKB/EWKB binary data as Buffers (with Uint8Array conversion when needed)
- **LocationWithGeometry type**: Extends Prisma types to include geom field for TypeScript type safety

**Files Modified:**

- `packages/api/src/graphql/services/location.service.ts` - Added `updateLocationGeometry` method and updated `findById` with ST_AsBinary
- `packages/api/src/graphql/services/location-geometry.integration.test.ts` - 14 comprehensive integration tests

**Integration Tests:**

All 14 tests passing:

- Point geometry: creation and updates (2 tests)
- Polygon geometry: simple, complex (1000+ vertices), and polygons with holes (3 tests)
- MultiPolygon: non-contiguous regions (1 test)
- Custom SRID: explicit SRID and campaign defaults (2 tests)
- Validation: invalid GeoJSON, unclosed rings, NaN/Infinity coordinates (3 tests)
- Versioning: version increment, optimistic locking, payload storage (3 tests)

**Implementation Decisions:**

1. **Raw SQL for PostGIS**: Prisma doesn't fully support PostGIS `Unsupported("geometry")` type, requiring raw SQL with `ST_GeomFromEWKB` for storage and `ST_AsBinary` for retrieval

2. **Atomic Optimistic Locking**: Originally had version check outside transaction, creating race condition. Fixed by moving check into UPDATE WHERE clause:

   ```sql
   UPDATE "Location"
   SET geom = ST_GeomFromEWKB(${ewkb}),
       version = version + 1,
       "updatedAt" = CURRENT_TIMESTAMP
   WHERE id = ${id}
     AND version = ${expectedVersion}
   ```

   This ensures only one concurrent update succeeds, with others failing atomically.

3. **Buffer Conversion**: PostgreSQL returns WKB data as either Buffer or Uint8Array depending on driver. Implemented explicit Buffer conversion to ensure consistent type for wkx library.

4. **Version Payload**: Geometry data (as Buffer) is included in version payload for historical tracking and time-travel queries.

**Performance:**

- Tested with complex polygons (1000+ vertices) - storage and retrieval work correctly
- Geometry validation happens before database interaction (fail-fast approach)
- Uses GIST spatial index created in Stage 2 for efficient spatial queries
- Transaction scope minimized to critical operations only (audit and pubsub outside transaction)

**Code Quality:**

- Code Reviewer approval after fixing critical race condition
- All tests passing with proper concurrent update protection
- Follows NestJS patterns with dependency injection
- Comprehensive JSDoc documentation
- TypeScript strict mode compliant

**Next Steps:**

- Stage 6 will implement GraphQL API and map layer generation

---

### Stage 5: Settlement Spatial Queries (✅ Complete)

Successfully implemented Settlement spatial query methods in SpatialService:

**Achievements:**

- Implemented 3 Settlement spatial query methods using PostGIS spatial functions
- All methods properly handle soft-deleted settlements and locations
- Added comprehensive integration tests (15 passing tests)
- Queries leverage GIST spatial index for optimal performance

**Technical Details:**

- **settlementsInRegion(regionId, worldId?)**: Uses ST_Within to find settlements within a region polygon. Joins Settlement with Location table to access geometry. Supports optional worldId filtering for multi-world campaigns.

- **settlementAtLocation(locationId)**: Direct query to find settlement at specific location using unique locationId relationship. Returns null if no settlement exists.

- **settlementsNear(point, radius, srid, worldId?)**: Uses ST_DWithin for efficient spatial index usage and ST_Distance for ordering by proximity. Joins Settlement with Location to access geometry. Supports custom SRID per query.

**Implementation Decisions:**

1. **WorldId filtering**: All methods support optional worldId parameter for multi-world campaign support, consistent with Location spatial queries.

2. **Soft-delete handling**: All queries filter both Settlement.deletedAt and Location.deletedAt to ensure deleted entities are excluded.

3. **Return types**: Methods return essential settlement fields (id, name, locationId, kingdomId, level) plus distance for settlementsNear. Kept lightweight for performance.

4. **Spatial functions**:
   - ST_Within for region containment (settlements inside polygon)
   - ST_DWithin for radius queries with spatial index support
   - ST_Distance for ordering by proximity

**Files Modified:**

- `packages/api/src/common/services/spatial.service.ts` - Added 3 Settlement spatial query methods
- `packages/api/src/common/services/settlement-spatial.integration.test.ts` - 15 comprehensive integration tests

**Integration Tests:**

All 15 tests passing:

**settlementsInRegion** (5 tests):

- Returns settlements within the region (3 settlements)
- Excludes settlements outside the region
- Respects worldId filter
- Returns empty array for region with no settlements
- Excludes soft-deleted settlements

**settlementAtLocation** (4 tests):

- Finds settlement at specific location
- Returns null when no settlement at location
- Returns null for non-existent location
- Excludes soft-deleted settlements

**settlementsNear** (6 tests):

- Returns settlements within radius, ordered by distance
- Excludes settlements outside radius
- Returns empty array when no settlements in radius
- Respects worldId filter
- Includes distance values in results
- Excludes soft-deleted settlements

**Performance:**

- All queries use the GIST spatial index on Location.geom
- ST_DWithin queries benefit from spatial indexing for efficient radius searches
- Joins are efficient due to Settlement.locationId unique index
- WorldId filtering reduces result set for better performance

**Code Quality:**

- Code Reviewer approval with no critical issues
- Follows existing SpatialService patterns
- Proper TypeScript type safety throughout
- Consistent with Location spatial query methods
- JSDoc documentation for all methods

---

### Stage 6: GraphQL API and Map Layer Generation (✅ Complete)

Successfully implemented comprehensive GraphQL API for spatial queries and map layer generation:

**Achievements:**

- Created complete GraphQL input/output types for spatial operations
- Implemented SpatialResolver with 8 queries/mutations (all spatial operations)
- Added 14 comprehensive integration tests (100% passing)
- Proper authentication guards and role-based authorization
- Full input validation with class-validator decorators

**GraphQL Inputs Created:**

- BoundingBoxInput: Map viewport coordinates for bbox queries
- PointInput: Longitude/latitude for spatial searches
- MapFilterInput: Optional filters (location types, tags, availability)
- UpdateLocationGeometryInput: GeoJSON geometry updates with versioning support
- LocationsNearInput/SettlementsNearInput: Radius searches with optional SRID

**GraphQL Output Types:**

- GeoJSONFeature/GeoJSONFeatureCollection: Map layer output following RFC 7946
- LocationWithDistance: Location results with computed distance from query point
- SettlementWithDistance: Settlement results with computed distance
- RegionOverlapResult: Boolean result for overlap detection queries

**SpatialResolver Implementation:**

1. **mapLayer Query**: Returns GeoJSON FeatureCollection for map viewport
   - Accepts bounding box and optional filters
   - Includes settlement metadata in feature properties
   - Filters null geometries automatically
   - Protected with JwtAuthGuard

2. **updateLocationGeometry Mutation**: Updates location geometry with versioning
   - Supports Point, Polygon, and MultiPolygon geometries
   - Optional custom SRID per update
   - Optimistic locking via expectedVersion
   - Protected with JwtAuthGuard + RolesGuard (owner/gm only)

3. **locationsNear Query**: Find locations within radius, ordered by distance
   - Custom SRID support (defaults to Web Mercator 3857)
   - Optional worldId filtering
   - Results include computed distance in meters

4. **locationsInRegion Query**: Find all locations within region polygon
   - Uses ST_Within for precise containment queries
   - Optional worldId filtering
   - Excludes soft-deleted locations

5. **checkRegionOverlap Query**: Detect if two regions overlap
   - Utility function for region validation
   - Uses ST_Overlaps PostGIS function
   - Returns boolean result with region IDs

6. **settlementsInRegion Query**: Find settlements within region
   - Joins Settlement with Location for geometry queries
   - Optional worldId filtering
   - Respects soft deletes on both entities

7. **settlementAtLocation Query**: Find settlement at specific location
   - Direct lookup by locationId (unique constraint)
   - Returns null if no settlement exists
   - Protected with JwtAuthGuard

8. **settlementsNear Query**: Find settlements within radius, ordered by distance
   - Similar to locationsNear but for settlements
   - Includes distance values in results
   - Custom SRID support

**Service Updates:**

- Added `SettlementService.findByLocationId()` method for efficient settlement lookups
- Fixed `SpatialService.wkbToGeoJSON()` Buffer handling (converts Uint8Array to Buffer)
- Registered SpatialResolver and SpatialService in GraphQL module
- All services properly integrated with dependency injection

**Shared Package Updates:**

- Added optional `srid` field to BoundingBox interface for custom coordinate systems
- Maintains backward compatibility (field is optional)
- Allows SRID specification for fantasy map projections

**Integration Tests (14 tests, 100% passing):**

Test suite: `packages/api/src/graphql/resolvers/spatial.resolver.integration.test.ts`

- **mapLayer Query** (3 tests): FeatureCollection generation, settlement metadata inclusion, location type filtering
- **updateLocationGeometry Mutation** (1 test): Geometry updates with version increment
- **locationsNear Query** (2 tests): Radius searches with distance ordering
- **locationsInRegion Query** (2 tests): Region containment with exclusion of external locations
- **checkRegionOverlap Query** (1 test): Non-overlapping region detection
- **settlementsInRegion Query** (1 test): Settlement region containment
- **settlementAtLocation Query** (2 tests): Settlement lookup and null handling
- **settlementsNear Query** (2 tests): Settlement proximity with distance ordering

**Security Implementation:**

- All queries protected with `@UseGuards(JwtAuthGuard)`
- Mutation restricted with `@Roles('owner', 'gm')` decorator
- Input validation using class-validator decorators
- Proper authentication and authorization checks throughout

**Performance Considerations:**

Code Review identified N+1 query patterns for future optimization:

- mapLayer resolver: Fetches settlements one-by-one (acceptable for 10-50 locations)
- locationsNear/settlement resolvers: Sequential full data fetches
- Should be addressed in follow-up ticket with batch loading

**Code Quality:**

- TypeScript strict mode compliant
- All ESLint rules passing
- Prettier formatted
- Comprehensive JSDoc documentation
- Follows existing NestJS resolver patterns
- Proper error handling with descriptive messages

**Files Added:**

- `packages/api/src/graphql/inputs/spatial.input.ts` (180 lines)
- `packages/api/src/graphql/types/spatial.type.ts` (96 lines)
- `packages/api/src/graphql/resolvers/spatial.resolver.ts` (358 lines)
- `packages/api/src/graphql/resolvers/spatial.resolver.integration.test.ts` (480 lines)

**Files Modified:**

- `packages/api/src/graphql/services/settlement.service.ts` - Added findByLocationId method
- `packages/api/src/graphql/graphql.module.ts` - Registered SpatialResolver and SpatialService
- `packages/api/src/common/services/spatial.service.ts` - Fixed Buffer handling in wkbToGeoJSON
- `packages/shared/src/types/geojson.ts` - Added optional srid field to BoundingBox

**Next Steps:**

- Stage 7 will implement tile generation and caching (final stage)

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
