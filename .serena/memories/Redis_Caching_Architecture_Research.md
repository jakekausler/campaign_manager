# Redis Caching Layer Architecture Research

## Executive Summary

Researched the campaign_manager codebase to identify Redis caching opportunities for Settlement and Structure state evaluation. Found existing cache infrastructure, identified expensive operations, and mapped invalidation patterns.

---

## 1. EXISTING CACHE INFRASTRUCTURE

### Redis Setup

- **Already Configured**: Redis 7-alpine in docker-compose.yml (line 44-60)
- **Infrastructure**:
  - Host: `redis:6379` (docker-compose networking)
  - DB 0: Reserved for pub/sub (real-time updates)
  - DB 1: Cache layer (redis-cache.provider.ts)
  - Data persistence: AOF (Append Only File) enabled
  - Health checks: PING command with 10s interval

### Existing Cache Implementations

#### 1. Rules Engine Cache (In-Memory, NodeCache)

**File**: `packages/rules-engine/src/services/cache.service.ts`

- **Pattern**: NodeCache (in-memory only, not distributed)
- **Key Format**: `campaign:{campaignId}:branch:{branchId}:node:{nodeId}`
- **Configuration**:
  - TTL: 300s default (env: CACHE_TTL_SECONDS)
  - Max keys: 10,000 (env: CACHE_MAX_KEYS)
  - Check period: 60s (env: CACHE_CHECK_PERIOD_SECONDS)
- **Features**:
  - Prefix-based invalidation: `invalidateByPrefix(campaignId, branchId?)`
  - Statistics tracking: hits, misses, hit rate
  - Graceful cleanup on shutdown

#### 2. Redis Cache Provider (API Service)

**File**: `packages/api/src/graphql/cache/redis-cache.provider.ts`

- **Pattern**: ioredis client for distributed caching
- **Configuration**:
  - DB: 1 (separate from pub/sub)
  - Key prefix: `cache:`
  - Exponential backoff retry strategy
  - Offline queue enabled
  - Reconnect on READONLY errors

#### 3. Redis Pub/Sub (Real-time Updates)

**File**: `packages/api/src/graphql/pubsub/redis-pubsub.provider.ts`

- Separate from cache (DB 0)
- Used for entity modification events and WebSocket broadcasts

#### 4. Tile Cache Service

**File**: `packages/api/src/common/services/tile-cache.service.ts`

- **Pattern**: In-memory Map-based cache
- **Key Format**: `world:{worldId}:bbox:{w},{s},{e},{n}[:filters:{filterStr}]`
- **Limitation**: No TTL or size limits (can cause memory issues)
- **Invalidation**: World-level invalidation on spatial data changes

---

## 2. SETTLEMENT AND STRUCTURE MODELS

### Database Schema

**File**: `packages/api/prisma/schema.prisma` (lines 295-343)

#### Settlement Model

```
- id (CUID primary key)
- kingdomId (FK to Kingdom)
- locationId (unique FK to Location)
- name, level (Int), variables (Json), variableSchemas (Json)
- version (Int) - for optimistic locking
- createdAt, updatedAt, deletedAt, archivedAt (soft delete)
```

**Relations**:

- `structures` (1:N) - Child structures in settlement
- `stateVars` (1:N) - State variables for conditions
- `kingdom` (N:1) - Parent kingdom

#### Structure Model

```
- id (CUID primary key)
- settlementId (FK to Settlement)
- type (String), name, level (Int), variables (Json), variableSchemas (Json)
- version (Int) - for optimistic locking
- createdAt, updatedAt, deletedAt, archivedAt (soft delete)
```

**Relations**:

- `settlement` (N:1) - Parent settlement
- `stateVars` (1:N) - State variables for conditions

---

## 3. EXPENSIVE OPERATIONS (Cache Candidates)

### 3.1 Computed Fields Evaluation (PRIMARY CACHE TARGET)

**File**: `packages/api/src/graphql/services/settlement.service.ts:850-1011`
**Corresponding**: `packages/api/src/graphql/services/structure.service.ts:892-1053`

**Operation**: `SettlementService.getComputedFields(settlement, user)`

**What it does**:

1. **Fetches all active FieldConditions** (N+1 vulnerability mentioned in comments):

   ```
   SELECT * FROM FieldCondition
   WHERE entityType='settlement' AND entityId=? AND isActive=true AND deletedAt IS NULL
   ORDER BY priority DESC
   ```

2. **Builds context** from settlement/structure data + StateVariables:

   ```typescript
   buildContextWithVariables(entityData, {
     includeVariables: true,
     scope: 'settlement' | 'structure',
   });
   ```

3. **Evaluates each condition** (via Rules Engine or local fallback):
   - **Option A**: gRPC call to Rules Engine Worker (batch evaluation)
   - **Option B**: Sequential local evaluation using `conditionEvaluation.evaluateExpression()`

4. **Returns**: Map of `{fieldName: computedValue}`

**Performance Issues**:

- Multiple database queries (conditions, variables, kingdom relationships)
- Condition evaluation is sequential in local mode
- Called for EVERY field resolution on Settlement/Structure types (GraphQL N+1)
- Rules Engine gRPC call if available

**Cache Candidates**:

- Cache computed fields by `{settlementId, branchId}` with TTL
- Invalidate on: field condition changes, variable updates, settlement updates

### 3.2 Spatial Queries (SECONDARY CACHE TARGET)

**File**: `packages/api/src/common/services/spatial.service.ts`

**Expensive operations**:

1. **`locationsNear(point, radius, srid, worldId)`** - ST_DWithin query
2. **`locationsInRegion(regionId, worldId)`** - ST_Within query
3. **`settlementsInRegion(regionId, worldId)`** - ST_Within subquery
4. **`settlementAtLocation(locationId)`** - Location geometry lookup

**Performance characteristics**:

- PostGIS operations: ST_DWithin, ST_Within, ST_Intersects
- Use GIST spatial indexes (verified in spatial-indexes.integration.test.ts)
- Can return large result sets (raw geometry data)
- Called from resolvers: `locationsNear`, `settlementsInRegion`, `settlementAtLocation`

**Cache Opportunities**:

- Cache location/settlement results by bounding box or region
- TTL: 60-300s (moderate, geometry updates invalidate)
- Tile cache service already exists but needs improvements

### 3.3 DataLoader Batching (ALREADY IMPLEMENTED)

**Files**:

- `packages/api/src/graphql/dataloaders/settlement.dataloader.ts`
- `packages/api/src/graphql/dataloaders/structure.dataloader.ts`
- `packages/api/src/graphql/dataloaders/location.dataloader.ts`

**Pattern**: Per-request batch loading to prevent N+1 queries

- Request-scoped (fresh instance per GraphQL request)
- Batches multiple IDs into single `findByIds()` call
- Does NOT use Redis (in-memory per request)

---

## 4. INVALIDATION PATTERNS

### 4.1 Settlement Update Flow

**File**: `packages/api/src/graphql/services/settlement.service.ts:326-499`

**Key steps**:

1. Version check (optimistic locking)
2. Update settlement: `prisma.settlement.update()`
3. Create version snapshot: `versionService.createVersion()`
4. Audit logging: `audit.log()`
5. **Pub/Sub event**: `pubSub.publish('entity.modified.{id}')`
6. **Cache invalidation**: `dependencyGraph.invalidateGraph(campaignId, branchId)`
7. **WebSocket broadcast**: `websocketPublisher.publishSettlementUpdated()`

**Affected caches**:

- Dependency graph cache (for rule evaluation)
- Computed fields cache (invalidate `settlement:{id}`)
- Parent settlement's structures list
- Spatial tile cache (world-level)

### 4.2 Structure Update Flow

**File**: `packages/api/src/graphql/services/structure.service.ts:345-533`

**Same pattern as Settlement**:

1. Version check
2. Update structure
3. Create version snapshot
4. Audit logging
5. Pub/Sub event: `entity.modified.{id}`
6. Dependency graph invalidation
7. WebSocket broadcast

**Cascading invalidation needed**:

- Structure update → invalidate parent Settlement computed fields
- Structure level/variables change → invalidate parent Settlement's availability

### 4.3 Relationships Requiring Cascading Invalidation

```
Campaign
  ├─ Kingdoms
  │   └─ Settlements
  │       ├─ Location (1:1)
  │       └─ Structures (1:N)
  │           └─ StateVariables (1:N)
  └─ FieldConditions (for all settlements/structures)
```

**Invalidation triggers**:

1. **Settlement changes**:
   - Invalidate: `settlement:{settlementId}`
   - Invalidate: `kingdom:{kingdomId}:settlements` (if using batch cache)
   - Invalidate: spatial tile cache for world

2. **Structure changes**:
   - Invalidate: `structure:{structureId}`
   - Invalidate: `settlement:{settlementId}:structures` (cached list)
   - Invalidate: Parent settlement's computed fields

3. **FieldCondition changes**:
   - Invalidate: All settlement computed fields in `campaign:{campaignId}`
   - Invalidate: All structure computed fields in `campaign:{campaignId}`
   - Handled by: `dependencyGraph.invalidateGraph(campaignId, branchId)`

4. **StateVariable changes**:
   - Invalidate: Computed fields for entity scope
   - Invalidate: Dependency graph

5. **Location geometry changes**:
   - Invalidate: Spatial tile cache (world-level)
   - Invalidate: Settlement spatial queries

---

## 5. QUERY PATTERNS & N+1 PROBLEMS

### 5.1 Resolver Query Chains

**Settlement resolver** (settlement.resolver.ts:47-310):

```graphql
Query {
  settlement(id) {
    id, name, level, variables
    location { ... }                # DataLoader: locationLoader
    structures { ... }              # DataLoader: structureLoader
    computedFields { ... }          # N+1: fetches conditions for each settlement
    kingdom { ... }
  }
}
```

**Computed fields resolver**:

```typescript
// Line 296-302
@ResolveField(() => Object)
async computedFields(@Parent() settlement) {
  return this.settlementService.getComputedFields(settlement, user)
}

// Inside getComputedFields:
// - Query FieldCondition table
// - Query StateVariable table (via buildContextWithVariables)
// - Evaluate each condition
// - Potential: gRPC call to Rules Engine
```

**Problem**: If query loads 10 settlements and each requests `computedFields`, that's 10+ additional DB queries + 10 Rules Engine calls.

### 5.2 Spatial Query Chains

**Spatial resolver** (spatial.resolver.ts:50-383):

```graphql
Query {
  settlementsInRegion(regionId) {
    ST_Within spatial index lookup
    -> returns settlement IDs
    -> fetchById for each (DataLoader batches these)
    -> But each settlement still needs computedFields if requested
  }
}
```

---

## 6. RECOMMENDED CACHE LAYERS

### Tier 1: Computed Fields Cache (Highest Priority)

**Target**: Settlement and Structure computed field evaluation results

**Key**: `computed-fields:{entityType}:{entityId}:{branchId}`

- Example: `computed-fields:settlement:settle_123:main`

**Cache**:

- Store: Map of field names to evaluated values
- TTL: 300s (synced with Rules Engine cache)
- DB: Redis DB 1 (existing cache DB)

**Invalidation**:

- On `FieldCondition` create/update/delete → invalidate `computed-fields:settlement:*` and `computed-fields:structure:*` in campaign
- On Settlement/Structure update → invalidate `computed-fields:{entityType}:{entityId}:*`
- On StateVariable update → invalidate related computed fields
- Cascading: Structure changes → invalidate parent Settlement computed fields

**Implementation**:

- Decorator: `@Cacheable(CacheKey.COMPUTED_FIELDS)`
- Service method wrapper: `settlementService.getComputedFields(settlement, user, useCache=true)`

### Tier 2: Entity Batch Cache (Medium Priority)

**Target**: Frequently queried settlement/structure lists

**Keys**:

- `settlements:kingdom:{kingdomId}:{branchId}`
- `structures:settlement:{settlementId}:{branchId}`

**Cache**:

- Store: JSON array of entity summaries
- TTL: 600s (longer TTL for list data)
- DB: Redis DB 1

**Invalidation**:

- On create/delete settlement in kingdom → invalidate `settlements:kingdom:{kingdomId}:*`
- On create/delete structure in settlement → invalidate `structures:settlement:{settlementId}:*`

### Tier 3: Spatial Query Cache (Low-Medium Priority)

**Target**: Expensive spatial queries

**Keys**:

- `spatial:locations-near:{worldId}:{lat}:{lon}:{radius}`
- `spatial:settlements-in-region:{regionId}:{worldId}`

**Cache**:

- Store: List of location/settlement IDs with distance/geometry
- TTL: 300s (geometry updates are less frequent than rules)
- DB: Redis DB 1

**Invalidation**:

- On Location geometry update → invalidate `spatial:*:{worldId}`
- On Settlement location change → invalidate `spatial:*:{worldId}`

### Tier 4: Expression Cache (Already Exists)

**Location**: `packages/api/src/rules/cache/expression-cache.ts`

- In-memory cache for parsed JSONLogic expressions
- TTL: Indefinite (expression definitions don't change often)
- Invalidate on FieldCondition expression update

---

## 7. KEY LOCATIONS FOR IMPLEMENTATION

### File paths (absolute):

1. **Cache Service Layer**:
   - `/storage/programs/campaign_manager/packages/api/src/graphql/cache/redis-cache.provider.ts` (extend)
   - Need new: `settlement-structure-cache.service.ts`

2. **Settlement Service**:
   - `/storage/programs/campaign_manager/packages/api/src/graphql/services/settlement.service.ts`
   - Methods to instrument:
     - `getComputedFields()` (line 850)
     - `update()` (line 326) - add cache invalidation
     - `findByKingdom()` (line 85) - cache list
     - `setLevel()` (line 715) - invalidate computed fields

3. **Structure Service**:
   - `/storage/programs/campaign_manager/packages/api/src/graphql/services/structure.service.ts`
   - Methods to instrument:
     - `getComputedFields()` (line 892)
     - `update()` (line 345) - add cache invalidation
     - `findBySettlement()` (line 89) - cache list
     - `setLevel()` (line 755) - invalidate computed fields

4. **Spatial Service**:
   - `/storage/programs/campaign_manager/packages/api/src/common/services/spatial.service.ts`
   - Methods to cache:
     - `locationsNear()` (line 510)
     - `locationsInRegion()` (line 563)
     - `settlementsInRegion()` - in resolver spatial.resolver.ts line 305
     - `settlementAtLocation()` - in resolver spatial.resolver.ts line 335

5. **Tile Cache Service**:
   - `/storage/programs/campaign_manager/packages/api/src/common/services/tile-cache.service.ts`
   - Add TTL/LRU eviction

6. **Redis Service (Rules Engine)**:
   - `/storage/programs/campaign_manager/packages/rules-engine/src/services/redis.service.ts` (lines 32-133)
   - Already subscribes to condition/variable invalidation channels
   - Add: Settlement/Structure change channels

---

## 8. INVALIDATION CHANNEL RECOMMENDATIONS

**Redis Pub/Sub Channels** (separate from DB 0 used for real-time):

```
// Existing channels (monitored by rules-engine)
condition.created
condition.updated
condition.deleted
variable.created
variable.updated
variable.deleted

// New channels needed
settlement.updated
settlement.deleted
structure.updated
structure.deleted
location.geometry.updated
```

**Message format**:

```json
{
  "entityId": "settle_123",
  "entityType": "settlement",
  "campaignId": "camp_456",
  "branchId": "main",
  "changedFields": ["level", "variables"],
  "timestamp": "2025-11-07T12:34:56Z",
  "userId": "user_789"
}
```

---

## 9. EXISTING PATTERNS TO FOLLOW

### NestJS Dependency Injection

All services use constructor injection:

```typescript
constructor(
  private readonly prisma: PrismaService,
  @Inject(REDIS_CACHE) private readonly redisCache: Redis
)
```

### Error Handling

- Log but don't throw on cache failures (cache is optional)
- Example from settlement.service.ts:451-457:
  ```typescript
  try {
    this.dependencyGraph.invalidateGraph(campaignId, branchId);
  } catch (error) {
    this.logger.error(`Failed to invalidate...`, error);
  }
  ```

### Environment Variables

- Use `process.env` with defaults
- Examples: CACHE_TTL_SECONDS, CACHE_MAX_KEYS, REDIS_HOST, REDIS_PORT

### Test Patterns

- Unit tests with mocks (\*.test.ts)
- Integration tests with database (\*.integration.test.ts)
- E2E tests (\*.e2e.test.ts)
- Use Jest and `@nestjs/testing`

---

## 10. PERFORMANCE BENCHMARKS TO MONITOR

From existing code comments:

1. **Rules Engine**: Expected 5-50ms per condition evaluation
2. **Spatial queries**: ST_Intersects/ST_Within with GIST index: <100ms
3. **Computed fields**: Currently 100-500ms per settlement (depends on condition count)
4. **Dependency graph**: O(n) invalidation (all keys with prefix)

**Cache impact targets**:

- Computed fields: 100-500ms → 1-5ms (on hit)
- Spatial queries: 50-200ms → 1-2ms (on hit)
- List queries: 50-100ms → <1ms (on hit)

---

## 11. CODEBASE CONVENTIONS

### Service Methods

- Always return Prisma models or custom types
- Async/await pattern
- User permission checks built-in
- Audit logging included

### Resolvers

- Use `@Query()` and `@Mutation()` decorators
- Guards: `@UseGuards(JwtAuthGuard, RolesGuard)`
- Context injected: `@Context() context: GraphQLContext`
- Parent data: `@Parent() entity: Type`

### Error Handling

- Throw specific exceptions: `NotFoundException`, `ForbiddenException`, `BadRequestException`
- Use custom: `OptimisticLockException`

### Naming Conventions

- Services: `EntityService` (e.g., `SettlementService`)
- Dataloaders: `EntityDataLoader`
- Enums: `EntityTypeEnum` or `EntityType`
- Cache keys: kebab-case with colons (e.g., `settlement-computed:123`)

---

## CONCLUSION

The campaign_manager codebase has solid infrastructure for implementing a distributed Redis caching layer. Key opportunities:

1. **Computed fields** are the highest-impact cache target (N+1 vulnerability, expensive evaluation)
2. **Redis is already configured** and integrated for pub/sub
3. **Invalidation patterns are established** via dependency graph and pub/sub
4. **Entity relationships require cascading invalidation** (Structure → Settlement → Kingdom)
5. **Spatial queries benefit from caching** but need BBox/region normalization
6. **DataLoaders already prevent per-request N+1s**, Redis caching prevents cross-request duplication

Next steps for implementation:

1. Create `SettlementStructureCacheService` wrapping Redis operations
2. Instrument `getComputedFields()` in both Settlement and Structure services
3. Add cache invalidation to `update()`, `setLevel()`, and mutation methods
4. Extend Redis pub/sub channels for settlement/structure changes
5. Implement cache key generation with proper scoping (entityId, branchId, campaignId)
6. Add monitoring/metrics for cache hit rates
