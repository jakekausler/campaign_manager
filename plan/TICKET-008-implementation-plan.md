# TICKET-008 Implementation Plan: PostGIS Spatial Data Integration

## Overview

This ticket integrates PostGIS spatial capabilities into the Campaign Manager, enabling map-based features with geometry storage, spatial queries, GeoJSON conversion, and map layer generation.

## Stages

### Stage 1: Foundation - Spatial Utilities and Types

**Goal**: Create core spatial utility service with GeoJSON ↔ PostGIS conversion and validation

**Tasks**:

- [x] Install required dependencies (wkx or wellknown library for geometry conversion)
- [x] Create shared GeoJSON type definitions in `@campaign/shared`
- [x] Create `SpatialService` in `@campaign/api` with GeoJSON ↔ WKB conversion methods
- [x] Add geometry validation methods (valid polygons, no self-intersections)
- [x] Create CRS configuration utilities (Web Mercator 3857 default, custom SRID support)
- [x] Write unit tests for conversion and validation functions

**Success Criteria**:

- ✅ GeoJSON Point converts to WKB and back without data loss
- ✅ GeoJSON Polygon converts to WKB and back without data loss
- ✅ Invalid geometries are rejected with clear error messages
- ✅ CRS utilities handle both standard and custom SRIDs

**Tests**:

- ✅ Point geometry conversion roundtrip preserves coordinates
- ✅ Polygon geometry conversion roundtrip preserves all vertices
- ✅ MultiPolygon geometry conversion works correctly
- ✅ Invalid polygon (self-intersecting) is rejected
- ✅ Invalid polygon (unclosed ring) is rejected
- ✅ CRS configuration returns correct SRID

**Status**: ✅ Complete

**Commit**: 5f70ea5918fb3462f8b5e7a94f612118112a1f22

---

### Stage 2: Database Schema and Indexes

**Goal**: Update Prisma schema with spatial columns and create GIST indexes

**Tasks**:

- [x] Add Campaign.srid field (Int, default 3857) to Prisma schema
- [x] Verify Location.geom field exists and is configured correctly
- [x] Create Prisma migration for Campaign.srid field
- [x] Create raw SQL migration for GIST index on Location.geom
- [x] Run and test migrations
- [x] Write integration tests for spatial indexes

**Success Criteria**:

- ✅ Campaign has srid field with default value
- ✅ Location.geom has GIST index
- ✅ Spatial queries use index (verify with EXPLAIN)
- ✅ Migrations apply cleanly on fresh database

**Tests**:

- ✅ Campaign creation includes default SRID
- ✅ GIST index exists on Location.geom
- ✅ Spatial query performance with 100 test locations
- ✅ Index is used for bounding box queries

**Status**: ✅ Complete

**Commit**: c7948bfc0345a4bba1cdcec8225f3b58f38916b5

---

### Stage 3: Core Spatial Query Operations

**Goal**: Implement fundamental spatial query methods in SpatialService

**Tasks**:

- [x] Implement `pointWithinRegion(pointId, regionId)` using ST_Covers (includes boundary)
- [x] Implement `distance(location1Id, location2Id)` using ST_Distance
- [x] Implement `locationsInBounds(bbox, worldId)` using ST_MakeEnvelope and ST_Intersects
- [x] Implement `locationsNear(point, radius, srid, worldId)` using ST_DWithin
- [x] Implement `locationsInRegion(regionId, worldId)` using ST_Within
- [x] Implement `checkRegionOverlap(region1Id, region2Id)` using ST_Overlaps
- [x] Write integration tests for all spatial queries

**Success Criteria**:

- ✅ Point-in-polygon queries return correct boolean results
- ✅ Distance calculations return accurate results
- ✅ Bounding box queries return only locations within bounds
- ✅ Nearest neighbor searches return results ordered by distance
- ✅ Region overlap detection identifies overlapping regions

**Tests**:

- ✅ pointWithinRegion() returns true for point inside polygon
- ✅ pointWithinRegion() returns false for point outside polygon
- ✅ pointWithinRegion() returns true for point on boundary
- ✅ distance() returns correct distance between two points
- ✅ distance() returns zero for same point
- ✅ locationsInBounds() returns all locations in bbox
- ✅ locationsInBounds() excludes locations outside bbox
- ✅ locationsNear() returns locations within radius, ordered by distance
- ✅ locationsNear() excludes locations outside radius
- ✅ locationsInRegion() returns all child locations
- ✅ locationsInRegion() excludes the region itself
- ✅ checkRegionOverlap() detects overlapping regions
- ✅ checkRegionOverlap() returns false for non-overlapping regions
- ✅ checkRegionOverlap() returns false for adjacent regions

**Status**: ✅ Complete

**Commit**: 00947a331e89e0d6ce17af3d3f886b111032ffd8

---

### Stage 4: Location Geometry Operations

**Goal**: Add geometry operations to LocationService for creating/updating locations

**Tasks**:

- [x] Add `updateLocationGeometry(locationId, geoJson, srid?)` method to LocationService
- [x] Support Point geometry input
- [x] Support Polygon geometry input
- [x] Support MultiPolygon geometry input
- [x] Integrate with versioning system for geometry updates
- [ ] Handle parent-child region hierarchy constraints (deferred - not required for this stage)
- [x] Write tests for geometry CRUD operations

**Success Criteria**:

- ✅ Can create location with Point geometry
- ✅ Can create location with Polygon geometry (unlimited vertices)
- ✅ Can create location with MultiPolygon geometry
- ✅ Can update existing location's geometry
- ✅ Geometry updates create new entity versions
- ✅ Custom SRID is respected when provided

**Tests**:

- ✅ Create location with Point geometry
- ✅ Create location with complex Polygon (1000+ vertices)
- ✅ Create location with MultiPolygon
- ✅ Update location geometry creates new version
- ✅ Custom SRID is stored and retrieved correctly
- ✅ Invalid GeoJSON is rejected

**Status**: ✅ Complete

**Commit**: a8fde52

---

### Stage 5: Settlement Spatial Queries

**Goal**: Implement spatial queries for settlements at locations

**Tasks**:

- [x] Implement `settlementsInRegion(regionId, worldId?)` query
- [x] Implement `settlementAtLocation(locationId)` query
- [x] Implement `settlementsNear(point, radius, srid, worldId?)` query
- [x] Ensure queries respect soft deletes
- [x] Write integration tests for settlement spatial queries

**Success Criteria**:

- ✅ Can find all settlements within a region polygon
- ✅ Can find settlement at specific location
- ✅ Can find settlements near a point, ordered by distance
- ✅ Queries exclude soft-deleted settlements
- ✅ Queries support optional worldId filtering

**Tests**:

- ✅ settlementsInRegion() returns settlements inside region (3 settlements)
- ✅ settlementsInRegion() excludes settlements outside region
- ✅ settlementsInRegion() respects worldId filter
- ✅ settlementsInRegion() returns empty array for empty region
- ✅ settlementsInRegion() excludes soft-deleted settlements
- ✅ settlementAtLocation() finds settlement at location
- ✅ settlementAtLocation() returns null when no settlement exists
- ✅ settlementAtLocation() returns null for non-existent location
- ✅ settlementAtLocation() excludes soft-deleted settlements
- ✅ settlementsNear() returns settlements within radius, ordered by distance
- ✅ settlementsNear() excludes settlements outside radius
- ✅ settlementsNear() returns empty array when no settlements in radius
- ✅ settlementsNear() respects worldId filter
- ✅ settlementsNear() includes distance values in results
- ✅ settlementsNear() excludes soft-deleted settlements

**Status**: ✅ Complete

**Commit**: b63eea6

---

### Stage 6: GraphQL API and Map Layer Generation

**Goal**: Create GraphQL resolvers for spatial queries and map layer generation

**Tasks**:

- [ ] Create GraphQL input types (BoundingBox, GeoJSONPoint, MapFilter)
- [ ] Create GraphQL output types (use GraphQLJSON for GeoJSON)
- [ ] Implement `mapLayer(campaignId, bbox, filters?)` query
- [ ] Implement `updateLocationGeometry(id, geoJSON, srid?)` mutation
- [ ] Implement `locationsNear(point, radius)` query
- [ ] Implement `locationsInRegion(regionId)` query
- [ ] Implement `checkRegionOverlap(region1Id, region2Id)` query
- [ ] Implement `settlementsInRegion(regionId)` query
- [ ] Implement `settlementAtLocation(locationId)` query
- [ ] Implement `settlementsNear(point, radius)` query
- [ ] Add entity metadata to map layer feature properties
- [ ] Write integration tests for all GraphQL resolvers

**Success Criteria**:

- mapLayer() returns GeoJSON FeatureCollection
- Map features include entity metadata in properties
- All spatial queries available via GraphQL
- Mutations create entity versions correctly
- GraphQL errors are clear and helpful

**Tests**:

- mapLayer() returns valid GeoJSON FeatureCollection
- mapLayer() filters by entity type
- mapLayer() filters by availability
- mapLayer() includes entity metadata
- updateLocationGeometry() updates geometry
- locationsNear() GraphQL query works
- locationsInRegion() GraphQL query works
- checkRegionOverlap() GraphQL query works
- settlementsInRegion() GraphQL query works
- settlementAtLocation() GraphQL query works
- settlementsNear() GraphQL query works

**Status**: ✅ Complete

**Commit**: c329ee5

---

### Stage 7: Tile Generation and Caching

**Goal**: Implement server-side map tile generation with caching

**Tasks**:

- [ ] Research and select tile generation approach (MVT, raster, or simplified vector tiles)
- [ ] Implement tile generation service
- [ ] Implement tile caching strategy (in-memory or Redis)
- [ ] Create tile endpoint (REST or GraphQL)
- [ ] Add cache invalidation on geometry updates
- [ ] Write tests for tile generation and caching

**Success Criteria**:

- Tiles are generated correctly from vector data
- Tile caching reduces server load
- Cache invalidates when underlying geometry changes
- Tiles render correctly in map client (future ticket)

**Tests**:

- Tile generation produces valid tiles
- Tile caching returns cached tiles on repeat requests
- Cache hit rate is measurable
- Cache invalidates on location update
- Tiles include correct features for zoom level

**Status**: Not Started

---

## Notes

- **Dependency Management**: `wkx` is the recommended library for WKB ↔ GeoJSON conversion in Node.js
- **PostGIS Functions**: All spatial queries use PostGIS SQL functions via Prisma's `$queryRaw`
- **SRID Handling**: Default to Web Mercator (3857) but allow custom SRID per campaign for fantasy maps
- **Versioning Integration**: All location geometry updates must integrate with the entity versioning system
- **Performance**: GIST index is critical for spatial query performance
- **Testing**: Focus on integration tests for spatial queries; unit tests for conversion/validation
- **Tile Strategy**: May defer complex tile generation to future ticket if time-intensive; prioritize GeoJSON FeatureCollection approach

## Risks and Mitigation

- **Risk**: Complex polygon performance issues
  - **Mitigation**: Test with 1000+ vertex polygons, verify GIST index usage

- **Risk**: Tile generation complexity may exceed time estimate
  - **Mitigation**: Deprioritize tile generation; focus on GeoJSON FeatureCollection API first

- **Risk**: Custom SRID support may complicate distance calculations
  - **Mitigation**: Document SRID behavior clearly; test with multiple SRID values

## Dependencies

- TICKET-003 (Database Schema Design & Prisma Setup) - ✓ Complete
- PostGIS extension enabled in PostgreSQL

## Estimated Total Time

3-4 days across 7 stages
