# TICKET-033 - Stage 4: Spatial Query Cache

## Goal

Implement caching for expensive spatial queries (PostGIS operations) to reduce database load for geometry-based operations like proximity searches and region queries.

## Context

### Prerequisites

- Stage 1 complete: Core CacheService available
- Spatial queries are in `packages/api/src/common/services/spatial.service.ts`

### Current Spatial Operations

Expensive PostGIS operations (50-200ms each with GIST indexes):

- `locationsNear(point, radius)` - ST_DWithin query for nearby locations
- `locationsInRegion(regionGeometry)` - ST_Within query for locations in region
- `settlementsInRegion(regionGeometry)` - Settlements within a region

### Cache Strategy

- **Key format**: `spatial:{queryType}:{params}:{branchId}`
  - `spatial:locations-near:{lat},{lon},{radius}:{branchId}`
  - `spatial:locations-in-region:{regionId}:{branchId}`
  - `spatial:settlements-in-region:{regionId}:{branchId}`
- **TTL**: 300 seconds (5 minutes) - geometry changes are infrequent
- **Cache location**: Wrap the spatial query methods
- **Invalidation triggers**:
  - Location geometry update → invalidate all spatial caches for that world/branch
  - Settlement location change → invalidate settlements-in-region caches

### Files to Modify

- `packages/api/src/common/services/spatial.service.ts` - Add caching to spatial methods
- `packages/api/src/graphql/services/location.service.ts` - Add cache invalidation to geometry updates
- `packages/api/src/graphql/services/settlement.service.ts` - Add cache invalidation when location changes

### Patterns to Follow

- Inject CacheService via constructor
- Generate deterministic cache keys (round coordinates, normalize params)
- Check cache first, return if hit
- On cache miss, execute query and store result
- Wrap cache operations in try-catch
- For region queries, use regionId as part of key (stable identifier)
- For proximity queries, hash the parameters for stable keys

### Challenges

- Cache keys must be deterministic: `locationsNear(1.234567, 2.345678, 1000)` should generate same key as `locationsNear(1.234567, 2.345678, 1000)`
- Invalidation is broad: geometry update should invalidate all spatial queries for that branch (use pattern deletion)

## Tasks

### Development Tasks

- [ ] Create helper function to generate spatial cache keys (normalize coordinates)
- [ ] Inject CacheService into SpatialService constructor
- [ ] Modify `SpatialService.locationsNear()` to check cache before querying
- [ ] Add cache.set() after executing locationsNear query
- [ ] Modify `SpatialService.locationsInRegion()` to check cache before querying
- [ ] Add cache.set() after executing locationsInRegion query
- [ ] Modify `SpatialService.settlementsInRegion()` to check cache before querying
- [ ] Add cache.set() after executing settlementsInRegion query
- [ ] Add cache invalidation to LocationService geometry update methods
- [ ] Add cache invalidation to SettlementService when location changes
- [ ] Implement pattern-based cache invalidation (delete all `spatial:*:{branchId}` keys)
- [ ] Add logging for cache hits/misses (debug level)

### Testing Tasks

- [ ] Write unit test: locationsNear cache hit returns cached data
- [ ] Write unit test: locationsNear cache miss queries and stores
- [ ] Write unit test: Cache keys are deterministic (same params = same key)
- [ ] Write unit test: locationsInRegion cache hit returns cached data
- [ ] Write unit test: locationsInRegion cache miss queries and stores
- [ ] Write unit test: settlementsInRegion cache hit returns cached data
- [ ] Write unit test: Geometry update invalidates spatial caches
- [ ] Write integration test: End-to-end spatial caching with real Redis
- [ ] Write integration test: Pattern-based invalidation clears all spatial queries

### Quality Assurance Tasks

- [ ] Run tests (use TypeScript Tester subagent)
- [ ] Fix test failures (if any exist from previous task)
- [ ] Run type-check and lint (use TypeScript Fixer subagent)
- [ ] Fix type/lint errors (if any exist from previous task)

### Review and Commit Tasks

- [ ] Run code review (use Code Reviewer subagent - MANDATORY)
- [ ] Address code review feedback (if any exists from previous task)
- [ ] Commit stage changes with detailed conventional commit message

## Implementation Notes

[Add notes here as tasks are completed]

## Commit Hash

[Added when final commit task is complete]
