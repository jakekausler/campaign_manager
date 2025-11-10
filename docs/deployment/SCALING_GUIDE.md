# Campaign Manager - Production Scaling Guide

## Overview

The Campaign Manager is architected for horizontal scaling with stateless API services, distributed caching via Redis, and worker microservices that can be independently scaled. This guide provides concrete patterns, configurations, and best practices for scaling to handle increased load in production environments.

**Key Principle**: The system is designed to scale linearly with load by distributing work across stateless service replicas while maintaining data consistency through Redis coordination.

> **⚠️ SECURITY WARNING**: All example passwords and secrets in this guide (`campaign_pass`, `minioadmin`, etc.) are for **DEMONSTRATION ONLY**. **NEVER use these in production**. Always generate strong, unique secrets using:
>
> ```bash
> openssl rand -hex 32
> ```
>
> Rotate credentials quarterly and never commit `.env` files to version control.

---

## Part 1: Horizontal Scaling Patterns

### 1.1 Service Statelessness

The architecture supports horizontal scaling through stateless service design:

#### API Service (`@campaign/api`)

**Status**: ✅ Stateless - can scale horizontally

**Features enabling statelessness**:

- No in-process session storage
- All state stored in PostgreSQL + Redis
- JWT tokens validated per-request (no server-side sessions)
- WebSocket connections handled via Socket.IO Redis adapter (see Section 1.3)
- DataLoader instances created fresh per-request (section 4.1)

**Scaling Configuration** (from `docker-compose.prod.yml`):

```yaml
api:
  deploy:
    replicas: 2 # Start with 2, scale based on CPU/memory metrics
    resources:
      limits:
        cpus: '1.0'
        memory: 1024M
      reservations:
        cpus: '0.5'
        memory: 512M
```

**Load Balancing Strategy**:

```
Load Balancer (nginx/HAProxy)
        ↓
    ┌───┴────┐
    v        v
   API-1   API-2  (both connect to same PostgreSQL, Redis)
    └───┬────┘
        ↓
   Shared State: PostgreSQL + Redis
```

**Scaling this tier**:

```bash
# Docker Swarm
docker service scale campaign_api=4

# Kubernetes equivalent
kubectl scale deployment api --replicas=4

# Recommended replicas based on load:
# Light: 2 replicas
# Medium: 3-4 replicas
# Heavy: 5-8 replicas
# Extreme: 10+ replicas (requires load testing)
```

#### Rules Engine Worker (`@campaign/rules-engine`)

**Status**: ⚠️ Mostly Stateless (per-service caching)

**Stateless aspects**:

- Expression evaluation is pure (same input = same output)
- No client session management
- gRPC endpoints are stateless

**Stateful aspects**:

- In-memory NodeCache (10,000 max keys by default)
- Cache is NOT shared across replicas
- Cache invalidation via Redis pub/sub channels

**Why single replica by default**:

- Each replica maintains independent cache
- Cache hit rate degrades with multiple replicas
- Invalidation overhead increases linearly

**When to scale Rules Engine**:

Scale horizontally ONLY if:

1. CPU utilization consistently >70% on single replica
2. gRPC response times exceed 50ms (p99)
3. Cache hit rate still acceptable after invalidations

```yaml
# docker-compose.prod.yml - if scaling needed
rules-engine:
  deploy:
    replicas: 2 # Only if CPU-bound
    resources:
      limits:
        cpus: '0.5' # Per-replica limit
        memory: 512M
```

**Scaling considerations**:

```typescript
// From packages/rules-engine/src/services/cache.service.ts
// Each replica has independent cache:
CACHE_MAX_KEYS = 10000; // Per-replica
CACHE_TTL_SECONDS = 300; // Per-replica

// With 2 replicas:
// - Total cache capacity: 20,000 keys (distributed)
// - Invalidation channels needed for sync
// - Measured hit rate penalty: ~30-40% on second replica
```

**Recommendation**: Keep at 1 replica unless profiling shows CPU is limiting factor.

#### Scheduler Worker (`@campaign/scheduler`)

**Status**: ⚠️ Stateless but timing-sensitive

**Characteristics**:

- Cron-based job scheduling (not distributed)
- Bull job queue (Redis-backed, distributed)
- Single replica by default to prevent duplicate execution

**Job Execution Pattern**:

```typescript
// Single scheduled event processes in one replica
// If multiple replicas run same cron, need distributed locking

// Current implementation (single replica):
CRON_EVENT_EXPIRATION=*/5 * * * *        // Runs on one instance
CRON_SETTLEMENT_GROWTH=0 * * * *         // Runs on one instance
CRON_STRUCTURE_MAINTENANCE=0 * * * *     // Runs on one instance
```

**Bull Queue** (distributed across replicas):

```typescript
// Bull jobs ARE distributed:
// - Job added to Redis queue
// - Any scheduler replica can process it
// - Uses locking to prevent duplicate processing
// - Recommended: Can have 2-3 replicas for job processing

deploy:
  replicas: 1  # For cron jobs (use locking if scaling)
  # But Bull queue can distribute work across multiple replicas
```

**If scaling to 2+ scheduler replicas**:

```bash
# Implement distributed locking for cron jobs:
# 1. Use Redis SET NX (atomic test-and-set)
# 2. Lock key: "cron:event-expiration:lock" with 30s TTL
# 3. Only replica that acquires lock runs the cron

// Pseudo-code for distributed cron with 2 replicas:
@Cron('*/5 * * * *')
async runExpiredEvents() {
  const lockKey = 'cron:event-expiration:lock';
  const acquired = await redis.set(lockKey, 'processing', 'NX', 'EX', 30);

  if (!acquired) {
    this.logger.debug('Another instance is already processing events');
    return;
  }

  try {
    await this.processExpiredEvents();
  } finally {
    await redis.del(lockKey);
  }
}
```

### 1.2 Load Balancing Configuration

#### Frontend Load Balancing (Nginx)

**Configuration** (Production - 2 replicas):

```yaml
frontend:
  deploy:
    replicas: 2 # Behind load balancer
    resources:
      limits:
        cpus: '0.5'
        memory: 256M
```

**Nginx upstream configuration** (in production):

```nginx
upstream frontend_upstream {
  least_conn;  # Load balancing strategy
  server frontend_1:80 max_fails=3 fail_timeout=30s;
  server frontend_2:80 max_fails=3 fail_timeout=30s;
}

server {
  listen 80;

  location / {
    proxy_pass http://frontend_upstream;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

#### API Load Balancing (gRPC + HTTP)

**HTTP Load Balancing** (GraphQL):

```nginx
upstream api_upstream {
  least_conn;
  server api_1:3000 max_fails=3 fail_timeout=10s;
  server api_2:3000 max_fails=3 fail_timeout=10s;
  server api_3:3000 max_fails=3 fail_timeout=10s;
}

server {
  listen 3000;

  location /graphql {
    proxy_pass http://api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_buffering off;  # Important for subscriptions
  }

  location /socket.io {
    proxy_pass http://api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_buffering off;  # Important for WebSocket
    proxy_read_timeout 3600s;
  }
}
```

**gRPC Load Balancing** (Rules Engine):

```
API replicas all connect to Rules Engine via gRPC
Rules Engine runs on single host with DNS round-robin or client-side load balancing

// From API environment:
RULES_ENGINE_GRPC_HOST=rules-engine  // Docker DNS (or K8s service)
RULES_ENGINE_GRPC_PORT=50051
RULES_ENGINE_TIMEOUT_MS=5000
```

### 1.3 Session/State Management

#### Authentication State (JWT)

**Pattern**: Stateless token-based

```typescript
// From packages/api/src/auth/services/jwt.service.ts (implied)
// Access token: 15 minutes
// Refresh token: 7 days (stored in DB, can be revoked)

// No server-side session storage
// Each request validates JWT signature and payload
// Database only consulted for permission checks
```

**Scaling implications**:

- JWT validation is CPU-bound but fast (<1ms)
- No session affinity needed
- Can safely round-robin requests across API replicas

#### Real-time Connection State (WebSocket)

**Pattern**: Distributed via Socket.IO Redis adapter

**From** `packages/api/src/websocket/websocket.gateway.ts`:

```typescript
// WebSocket Gateway with Redis Adapter
async afterInit(server: Server): Promise<void> {
  // Create Redis clients for Socket.IO pub/sub
  this.pubClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  });

  // Attach Redis adapter - enables horizontal scaling
  server.adapter(createAdapter(this.pubClient, this.subClient));

  this.logger.log('Redis adapter attached - WebSocket scaling enabled');
}
```

**How it works**:

```
Client A → API-1 (WebSocket connection)
                 ↓
              Socket.IO Redis Adapter
                 ↓
           Redis Pub/Sub Channel (broadcast-entity-123)
                 ↓
              Socket.IO Redis Adapter
                 ↓
Client B ← API-2 (receives event from other API instance)
```

**Room-based subscriptions**:

```typescript
// From types.ts:
getRoomName(type: RoomType, entityId: string): string {
  // Returns: "campaign:123", "settlement:456", etc.
  // All API replicas subscribe to same rooms
  // Pub/Sub delivers messages to ALL replicas
  // Socket.IO delivers to connected clients on that replica
}
```

**Scaling considerations**:

- Each API replica maintains its own WebSocket connections
- Redis Pub/Sub coordinates message delivery across replicas
- No affinity needed - client can disconnect/reconnect to different API
- Latency: <50ms for cross-instance message delivery (if Redis co-located)

**Configuration for optimal Redis performance**:

```yaml
# docker-compose.prod.yml - Redis for WebSocket
redis:
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
  command:
    - redis-server
    - --appendonly yes
    - --maxmemory 512mb
    - --maxmemory-policy allkeys-lru # Evict least recently used
```

#### GraphQL Subscription State (Apollo Server)

**Pattern**: Redis Pub/Sub + request-scoped resolvers

```typescript
// From packages/api/src/graphql/pubsub/redis-pubsub.provider.ts
export function createRedisPubSub(): RedisPubSub {
  return new RedisPubSub({
    publisher: redis, // DB 0 (different from cache)
    subscriber: redis, // DB 0
  });
}

// Each subscription:
// 1. Client connects to API-1
// 2. Apollo resolves @Subscription handlers
// 3. Handlers subscribe to RedisPubSub topics
// 4. Events published on any API instance go to Redis
// 5. All replicas' subscriptions receive via Redis Pub/Sub
// 6. Apollo sends to connected client on that replica
```

**Broadcast pattern**:

```typescript
// When settlement updates:
// 1. API-1 receives mutation (any replica)
// 2. Updates database
// 3. Publishes: pubSub.publish('entity.modified.settlement-123', {...})
// 4. All replicas (API-1, API-2, API-3) receive via Redis Pub/Sub
// 5. Clients subscribed to that entity receive update
```

### 1.4 Connection Pooling

#### PostgreSQL Connection Pooling

**Current Configuration** (from environment):

```
DATABASE_URL=postgres://user:pass@postgres:5432/campaign_db
```

**Recommendation for scaling**:

```bash
# Use PgBouncer as connection pool between API replicas and database
# Single database with 200 max connections can handle:
# - 2 API replicas: ~50 connections each
# - 4 API replicas: ~30 connections each
# - 8 API replicas: ~15 connections each

# Deploy PgBouncer (separate container):
pgbouncer:
  image: pgbouncer:latest
  environment:
    # Connection pooling mode
    DATABASES: campaign_db=host=postgres port=5432 dbname=campaign_db
    POOL_MODE: transaction  # or session for better isolation
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 25   # Per replica: 25 connections
    RESERVE_POOL_SIZE: 5
    RESERVE_POOL_TIMEOUT: 3
```

**Prisma with PgBouncer**:

```env
# For transaction mode (recommended)
DATABASE_URL=postgres://user:pass@pgbouncer:6432/campaign_db
```

#### Redis Connection Pooling

**Separate connections for different use cases**:

```typescript
// Cache (DB 1)
REDIS_CACHE = new Redis({
  host: 'redis',
  port: 6379,
  db: 1,
  maxRetriesPerRequest: null,  // Enable connection pool
  enableReadyCheck: false,
});

// Pub/Sub (DB 0)
REDIS_PUBSUB = new Redis({
  host: 'redis',
  port: 6379,
  db: 0,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Socket.IO Redis Adapter (separate clients)
pubClient = createClient({...});
subClient = createClient({...});
```

**Redis Memory Scaling** (from docker-compose.prod.yml):

```yaml
redis:
  command:
    - redis-server
    - --maxmemory 512mb # Adjust based on cache size
    - --maxmemory-policy allkeys-lru # Evict least recently used
    - --tcp-backlog 511 # For high throughput
    - --tcp-keepalive 300 # Detect dead connections
```

**Estimating Redis memory needs**:

```
Cache items: ~5KB average (computed fields, entity lists)
Estimated hit rate: 70-80% (well-configured cache)

Memory calculation:
- Settlement computed fields: 100 settlements × 5KB = 500KB
- Structure computed fields: 500 structures × 3KB = 1.5MB
- Entity lists: 100 lists × 2KB = 200KB
- Spatial queries: 50 cached results × 10KB = 500KB
- Total: ~2.7MB minimum

For 10,000 key capacity with 512MB max:
- Average key size: 50KB max (very conservative)
- Effective capacity: ~10,000 keys
- Recommendation: 512MB - 1GB for production

Scaling formula:
Memory = (Average_Key_Size_KB * Max_Keys) * Safety_Factor(1.5)
```

---

## Part 2: Multi-Layer Caching Architecture

### 2.1 Caching Layers Overview

The system implements a 3-tier caching strategy:

```
┌─────────────────────────────────────────────────┐
│ Client (Browser) - Apollo Client Cache          │
│ (GraphQL response cache, normalized store)      │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│ API Service - DataLoader (Request-scoped)       │
│ (Batches DB queries within single request)      │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│ API Service - Redis Cache (Cross-request)       │
│ (Persists across requests, TTL-based)           │
│ - Computed fields: 300s TTL                     │
│ - Entity lists: 600s TTL                        │
│ - Spatial queries: 300s TTL                     │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│ Rules Engine Worker - In-Memory Cache           │
│ (Expression evaluation results, per-instance)   │
│ - Max 10,000 keys per replica                   │
│ - 300s TTL                                      │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│ Database (PostgreSQL + PostGIS)                 │
│ (Single source of truth)                        │
└─────────────────────────────────────────────────┘
```

### 2.2 Redis Cache Layer (Tier 2)

**Configuration** (from `packages/api/src/graphql/cache/redis-cache.provider.ts`):

```typescript
export function createRedisCache(): Redis {
  const options: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_CACHE_DB || '1', 10), // DB 1 for cache
    retryStrategy: (times: number) => {
      // Exponential backoff: 50ms → 100ms → 150ms → ... → 3000ms
      const delay = Math.min(times * 50, 3000);
      return delay;
    },
    connectTimeout: 10000,
    enableOfflineQueue: true, // Buffer commands during disconnection
    reconnectOnError: (err: Error) => {
      if (err.message.includes('READONLY')) {
        return true; // Reconnect on read-only replica
      }
      return false;
    },
    keyPrefix: 'cache:', // Namespace all keys
  };

  const redis = new Redis(options);
  return redis;
}
```

**Environment Variables** (from `.env.example`):

```bash
# Cache Service (API - Redis DB 1)
CACHE_DEFAULT_TTL=300              # Default TTL: 5 minutes
CACHE_METRICS_ENABLED=true         # Track hit/miss rates
CACHE_LOGGING_ENABLED=false        # Debug logging (disable in production)
```

#### Cache Key Patterns

From `packages/api/src/common/cache/cache-key.builder.ts`:

**Computed Fields Cache**:

```typescript
buildComputedFieldsKey(entityType, entityId, branchId);
// Pattern: 'computed-fields:{entityType}:{entityId}:{branchId}'
// Examples:
//   'computed-fields:settlement:settle_123:main'
//   'computed-fields:structure:struct_456:main'
//   'computed-fields:settlement:settle_789:alternate-1'

// TTL: 300 seconds (5 minutes)
// Invalidation triggers:
//   - FieldCondition created/updated/deleted
//   - Settlement/Structure updated
//   - StateVariable updated
//   - Branch deletion
```

**Entity List Cache**:

```typescript
buildEntityListKey(childType, parentType, parentId, branchId);
// Pattern: '{childType}:{parentType}:{parentId}:{branchId}'
// Examples:
//   'settlements:kingdom:kingdom_123:main'
//   'structures:settlement:settle_456:main'

// TTL: 600 seconds (10 minutes)
// Invalidation triggers:
//   - Child created/deleted in parent
//   - Parent deleted
```

**Spatial Query Cache**:

```typescript
buildSpatialQueryKey(queryType, queryParams, branchId);
// Pattern: 'spatial:{queryType}:{param1}:{param2}:...:{branchId}'
// Examples:
//   'spatial:settlements-in-region:region_123:main'
//   'spatial:entities-within-bounds:0.0:0.0:100.0:100.0:main'

// TTL: 300 seconds
// Invalidation triggers:
//   - Location geometry updated
//   - Settlement location changed
```

**Cache Service Methods** (from `packages/api/src/common/cache/cache.service.ts`):

```typescript
// Core operations
async get<T>(key: string, options?): Promise<T | null>
async set<T>(key: string, value: T, options?): Promise<void>
async del(key: string, options?): Promise<number>

// Pattern-based invalidation (for cascading deletes)
async delPattern(pattern: string): Promise<CacheDeleteResult>

// Semantic invalidation (higher-level)
async invalidatePattern(pattern: string, reason?: string): Promise<CacheDeleteResult>

// Cascading invalidation helpers
async invalidateSettlementCascade(settlementId, branchId): Promise<CacheDeleteResult>
async invalidateStructureCascade(structureId, settlementId, branchId): Promise<CacheDeleteResult>
async invalidateCampaignComputedFields(campaignId, branchId): Promise<CacheDeleteResult>
```

### 2.3 Cache Invalidation Patterns

#### Single Entity Invalidation

**When Settlement is Updated**:

```typescript
// From packages/api/src/graphql/services/settlement.service.ts (pattern)

async updateSettlement(id: string, input: UpdateSettlementInput, user: AuthenticatedUser) {
  // 1. Update database
  const updated = await this.prisma.settlement.update({
    where: { id },
    data: { ...input, version: input.version + 1 }
  });

  // 2. Invalidate computed fields
  await this.cache.invalidatePattern(
    `computed-fields:settlement:${id}:*`,
    'Settlement updated'
  );

  // 3. Invalidate parent kingdom's settlement list
  await this.cache.del(`settlements:kingdom:${updated.kingdomId}:${branchId}`);

  // 4. Publish real-time event
  this.pubSub.publish(`entity.modified.${id}`, {
    entityId: id,
    entityType: 'settlement',
    changes: input
  });

  return updated;
}
```

**Performance Impact**:

- Single entity delete: 1-2ms
- Pattern-based delete: 5-50ms (depends on matching key count)
- Recommendation: Use specific keys when entity ID is known, patterns for cascades

#### Cascading Invalidation

**Structure Update → Parent Settlement Invalidation**:

```typescript
// When a structure changes, its parent settlement's cache must also be invalidated
// because settlement might have computed fields that reference structures

async invalidateStructureCascade(structureId, settlementId, branchId) {
  let totalDeleted = 0;

  // 1. Invalidate structure's own computed fields
  totalDeleted += await this.cache.del(
    `computed-fields:structure:${structureId}:${branchId}`
  );

  // 2. CRITICAL: Invalidate parent settlement's computed fields
  // (parent may have conditions like "sum of child structures")
  totalDeleted += await this.cache.del(
    `computed-fields:settlement:${settlementId}:${branchId}`
  );

  // 3. Invalidate parent settlement's structures list
  totalDeleted += await this.cache.del(
    `structures:settlement:${settlementId}:${branchId}`
  );

  return { success: true, keysDeleted: totalDeleted };
}
```

**Relationship Diagram**:

```
Campaign
  ├─ FieldCondition(s) - define computed field logic
  ├─ Kingdom(s)
  │   └─ Settlement(s)
  │       ├─ Location (1:1)
  │       ├─ StateVariable(s)
  │       └─ Structure(s)
  │           └─ StateVariable(s)

Invalidation triggers:
1. FieldCondition changes
   → Invalidate: ALL settlement/structure computed fields in campaign

2. Settlement changes
   → Invalidate:
     - computed-fields:settlement:{id}:*
     - settlements:kingdom:{parentId}:*
     - spatial:*:{worldId}

3. Structure changes
   → Invalidate:
     - computed-fields:structure:{id}:*
     - computed-fields:settlement:{parentId}:*
     - structures:settlement:{parentId}:*

4. StateVariable changes
   → Invalidate: computed-fields:*:{entityId}:*
```

#### Cache Invalidation via Redis Pub/Sub

**Pub/Sub Channels for Invalidation** (monitored by Rules Engine):

```typescript
// From packages/rules-engine/src/services/redis.service.ts pattern

// Channels for Rules Engine cache invalidation
'condition.created'      // New field condition
'condition.updated'      // Field condition modified
'condition.deleted'      // Field condition removed
'variable.created'       // New state variable
'variable.updated'       // State variable modified
'variable.deleted'       // State variable removed

// Message format (JSON):
{
  entityId: 'settle_123',
  entityType: 'settlement',
  campaignId: 'camp_456',
  branchId: 'main',
  changedFields: ['level', 'variables'],
  timestamp: '2025-11-09T12:34:56Z',
  userId: 'user_789'
}
```

**Integration with Rules Engine**:

```typescript
// Rules Engine subscribes and invalidates its cache
this.redis.subscribe('condition.updated', 'condition.deleted', (message) => {
  const { campaignId, branchId } = JSON.parse(message);

  // Invalidate all expression caches in this campaign/branch
  this.cacheService.invalidateByPrefix(`campaign:${campaignId}:branch:${branchId}`);
});
```

### 2.4 Cache Warming Strategies

#### Proactive Cache Warming

**Use case**: High-traffic campaigns with predictable access patterns

```typescript
// On application startup or manual trigger
async warmCacheForCampaign(campaignId: string) {
  const settlements = await this.prisma.settlement.findMany({
    where: { campaign: { id: campaignId } },
    include: { structures: true, stateVariables: true }
  });

  // Pre-compute and cache frequently accessed data
  for (const settlement of settlements) {
    // Warm computed fields cache
    const computedFields = await this.getComputedFields(settlement);
    await this.cache.set(
      buildComputedFieldsKey('settlement', settlement.id, 'main'),
      computedFields,
      { ttl: 600 }  // Longer TTL for warmed cache
    );

    // Warm structures list
    await this.cache.set(
      buildEntityListKey('structures', 'settlement', settlement.id, 'main'),
      settlement.structures,
      { ttl: 600 }
    );
  }

  this.logger.log(`Warmed cache for campaign ${campaignId}: ${settlements.length} settlements`);
}

// Trigger on:
// 1. Application startup
// 2. Manual admin action
// 3. Off-peak hours (late night)
```

#### Lazy Caching (Current Approach)

**How it works**:

```typescript
async getComputedFields(settlement: Settlement): Promise<Record<string, any>> {
  const cacheKey = buildComputedFieldsKey('settlement', settlement.id, 'main');

  // Check cache
  const cached = await this.cache.get(cacheKey);
  if (cached) {
    this.logger.debug(`Cache HIT: ${cacheKey}`);
    return cached;
  }

  // Cache miss - compute and store
  this.logger.debug(`Cache MISS: ${cacheKey}`);
  const computed = await this.evaluateComputedFields(settlement);

  // Store in cache for future requests
  await this.cache.set(cacheKey, computed, { ttl: 300 });

  return computed;
}
```

**Hybrid approach for production**:

```typescript
// Combine both strategies:

// 1. Important/hot data: Warm on startup
async onApplicationBootstrap() {
  const hotCampaigns = await this.getHotCampaigns();  // Top 10 by usage
  for (const campaign of hotCampaigns) {
    await this.warmCacheForCampaign(campaign.id);
  }
}

// 2. Other data: Lazy cache on access
async getComputedFields(settlement, options = {}) {
  const cacheKey = buildComputedFieldsKey('settlement', settlement.id, 'main');
  const cached = await this.cache.get(cacheKey);

  if (cached) return cached;

  const computed = await this.evaluateComputedFields(settlement);

  // Extend TTL for frequently accessed data
  const ttl = options.isFrequentlyAccessed ? 600 : 300;
  await this.cache.set(cacheKey, computed, { ttl });

  return computed;
}
```

### 2.5 Cache Statistics and Monitoring

**Cache Metrics** (from `packages/api/src/common/cache/cache-stats.service.ts` pattern):

```typescript
interface CacheStats {
  hits: number; // Cache hits (returned cached value)
  misses: number; // Cache misses (computed fresh)
  hitRate: number; // Percentage: hits / (hits + misses)
  sets: number; // Number of cache writes
  deletes: number; // Number of cache deletes
  patternDeletes: number; // Number of pattern-based deletes
  startTime: Date; // When stats started tracking
  enabled: boolean; // Whether metrics are enabled
}
```

**Accessing Cache Stats** (GraphQL endpoint):

```graphql
query {
  cacheStats {
    hits
    misses
    hitRate
    sets
    deletes
    patternDeletes
  }
}
```

**Production Monitoring Targets**:

```bash
# Optimal cache hit rate: 70-85%
# Target = (hits / (hits + misses)) * 100

# If hit rate < 50%:
# - Increase TTL for frequently accessed patterns
# - Implement cache warming
# - Check for cache invalidation storms

# If hit rate > 90%:
# - Cache is well-tuned
# - Monitor memory usage (may grow unbounded)
# - Consider longer TTL

# Monitor metrics:
- Hit rate per cache type (computed-fields, spatial, lists)
- Pattern delete frequency (indicates invalidation load)
- Average items deleted per pattern (indicates cascade size)
- Hit rate over time (should be stable)
```

**Health Check Integration** (from `packages/api/src/common/health/cache-health.indicator.ts`):

```typescript
// Periodic health check status
{
  status: 'up' | 'degraded' | 'down',
  metrics: {
    hitRate: 0.75,        // 75% hit rate
    redisPingMs: 2,       // 2ms response
    memoryUsageMB: 256,   // Memory consumed
    keyCountByType: {
      'computed-fields': 1234,
      'spatial': 567,
      'settlements': 89
    }
  },
  thresholds: {
    minHitRate: 0.5,      // Degraded if < 50%
    maxMemory: 512,       // MB
    maxLatency: 50        // ms
  }
}
```

---

## Part 3: Performance Optimization

### 3.1 Database Query Optimization

#### Indexes for Scaling

**Critical Indexes** (from Prisma schema patterns):

```prisma
model Settlement {
  id        String @id @default(cuid())
  kingdomId String  // Should be indexed for "find by kingdom"
  locationId String @unique  // Unique index
  level     Int     // May be indexed for range queries
  createdAt DateTime @default(now())
  deletedAt DateTime?  // Must be indexed for soft-delete filtering

  @@index([kingdomId])  // Find settlements by kingdom
  @@index([deletedAt])  // Filter out deleted entities efficiently
  @@index([createdAt])  // Time-based queries
}

model FieldCondition {
  id       String @id @default(cuid())
  campaignId String
  entityType String  // 'settlement' | 'structure'
  entityId String?   // Null for campaign-level conditions
  priority Int

  @@index([campaignId, entityType])  // Query conditions by type
  @@index([entityId])  // Find conditions for specific entity
  @@index([campaignId, entityId])  // Combined lookup
}

model StateVariable {
  id         String @id @default(cuid())
  entityId   String  // settlement or structure
  entityType String

  @@index([entityId, entityType])  // Find variables for entity
  @@index([entityId])  // Common query pattern
}
```

**PostGIS Spatial Indexes**:

```sql
-- From production schema (verified in spatial-indexes.integration.test.ts)
CREATE INDEX location_geometry_gist ON "Location" USING GIST(geometry);

-- Typical query: Find locations within radius
-- Query: SELECT * FROM "Location" WHERE ST_DWithin(geometry, point, radius)
-- Index usage: GIST performs best for spatial queries
-- Expected: <100ms for 1000+ locations with GIST index
```

**Index Tuning for Load**:

```bash
# Monitor slow queries in production
log_min_duration_statement = 100  # Log queries > 100ms

# Analyze query plans
EXPLAIN ANALYZE SELECT ...

# Common slow patterns to avoid:
1. N+1 queries (use DataLoader - see Section 4.1)
2. Missing indexes on WHERE/JOIN columns
3. SELECT * (fetch only needed columns)
4. Unindexed sorting
5. Subqueries instead of JOINs
```

#### Query Batching with DataLoader

**Problem**: Without batching

```typescript
// Bad: Triggers N+1 queries
async resolveSettlements(parent: Kingdom) {
  // This resolver runs for each settlement in the list
  return await this.prisma.settlement.findMany({
    where: { kingdomId: parent.id }
  });
}

// GraphQL query:
query {
  kingdoms {      // Query 1: SELECT * FROM Kingdom
    settlements { // Nested query
      id          // Query 2, 3, 4, ...: SELECT * FROM Settlement WHERE kingdomId = ?
      structures {
        id        // Query 5+: SELECT * FROM Structure WHERE settlementId = ?
      }
    }
  }
}
// Result: 1 query for kingdoms + N queries for settlements = N+1 total queries
```

**Solution**: DataLoader for batching

```typescript
// From packages/api/src/graphql/dataloaders/settlement.dataloader.ts

@Injectable()
export class SettlementDataLoader {
  createLoader(): DataLoader<string, SettlementWithLocation | null> {
    return new DataLoader<string, SettlementWithLocation | null>(
      async (settlementIds: readonly string[]) => {
        // Batch query: fetch all settlements at once
        const settlements = await this.prisma.settlement.findMany({
          where: { id: { in: settlementIds as string[] } }
        });

        // Return in same order as input IDs (DataLoader requirement)
        return settlementIds.map(
          id => settlements.find(s => s.id === id) || null
        );
      },
      { cache: true }  // Cache within single request
    );
  }
}

// Usage in resolver:
@ResolveField(() => [Settlement])
async settlements(
  @Parent() kingdom: Kingdom,
  @Context() context: GraphQLContext
) {
  // Batches all settlement loads across entire request
  return context.dataloaders.settlementLoader.loadMany(
    [kingdom.id]  // All requested settlement IDs batched into one query
  );
}

// Result: 1 query for kingdoms + 1 query for all settlements = 2 total queries
// Performance improvement: O(N) → O(1) for query count
```

**DataLoader Performance Metrics**:

```
Without DataLoader (N+1):
- 1000 settlements loaded: 1000 queries
- Time: ~1000ms (avg 1ms per query)

With DataLoader:
- 1000 settlements loaded: 1 query (batch of 1000)
- Time: ~5ms
- Improvement: 200x faster

# DataLoader is ESSENTIAL for nested GraphQL queries
```

### 3.2 GraphQL Query Optimization

#### Field-Level Caching

**Problem**: Same field resolved multiple times in single request

```graphql
query {
  settlement(id: "123") {
    computedFields # Calls getComputedFields()
  }
  settlements(kingdomId: "456") {
    ... on Settlement {
      computedFields # Calls getComputedFields() again
    }
  }
}
```

**Solution**: Request-scoped cache via DataLoader

```typescript
// Request context includes field cache
context.cache.get('computed-fields:settlement:123:main');

// First access: Cache miss, compute and store
// Second access: Cache hit, return immediately
// Cleared at end of request
```

#### Query Complexity Limits

**Prevent expensive queries**:

```typescript
// From app configuration (pseudocode pattern)
@GraphQLModule({
  plugins: [
    {
      requestDidStart: async () => ({
        didResolveOperation: async ({ request, operationAST }) => {
          const complexity = getQueryComplexity(operationAST);

          if (complexity > 1000) {
            throw new Error('Query too complex');
          }
        }
      })
    }
  ]
})
```

#### GraphQL Depth Limits

**Prevent deep nesting attacks**:

```graphql
# Bad: Unbounded depth
query {
  campaign {
    kingdoms {
      settlements {
        structures {
          ...deeply nested...
        }
      }
    }
  }
}

# Good: Limited depth (max 5-7 levels)
query {
  campaign {
    kingdoms(limit: 10) {
      settlements(limit: 10) {
        id
        name
        # Stop here - don't fetch structures
      }
    }
  }
}
```

### 3.3 Frontend Performance Patterns

#### Code Splitting (Vite)

**Configuration** (from build setup):

```typescript
// packages/frontend/vite.config.ts pattern
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split by feature/page
          'map-editor': ['src/pages/MapEditor', 'src/components/MapTools'],
          'timeline-view': ['src/pages/TimelineView'],
          'flow-view': ['src/pages/FlowView'],
          vendor: ['react', 'react-dom', 'apollo-client'],
        },
      },
    },
  },
};
```

**Result**:

- Initial bundle: ~200KB (index.js)
- Lazy-loaded pages: 50-100KB each
- Load time improvement: Only download needed chunks

#### Apollo Client Caching

**Configuration**:

```typescript
// From packages/frontend pattern
const client = new ApolloClient({
  cache: new InMemoryCache({
    possibleTypes: {
      // For unions/interfaces
    },
    typePolicies: {
      Settlement: {
        // Cache key generation
        keyFields: ['id'],
        fields: {
          // Field-level cache policies
          computedFields: {
            merge(existing, incoming) {
              return { ...existing, ...incoming };
            },
          },
        },
      },
    },
  }),
  link: createHttpLink({
    uri: '/graphql',
    credentials: 'include',
    fetchOptions: {
      // Optimize for mobile
    },
  }),
});
```

**Performance impact**:

- Normalized cache prevents duplication
- Field-level caching avoids re-fetching
- Client-side: 50-200ms response time (vs 500-2000ms from server)

### 3.4 Real-time Update Performance

#### WebSocket Message Batching

**Pattern**: Batch changes over 50-100ms window

```typescript
// From websocket-publisher.service pattern (pseudocode)

class WebSocketPublisherService {
  private pendingMessages: Map<string, any> = new Map();
  private flushTimer?: NodeJS.Timeout;

  publishSettlementUpdated(settlement: Settlement) {
    // Store message with dedup key
    this.pendingMessages.set(`settlement:${settlement.id}`, settlement);

    // Flush after 50ms (collects multiple updates)
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushMessages();
        this.flushTimer = undefined;
      }, 50);
    }
  }

  private flushMessages() {
    // Send all pending messages as batch
    for (const [key, message] of this.pendingMessages) {
      this.server.emit(key, message);
    }
    this.pendingMessages.clear();
  }
}
```

**Performance impact**:

- Without batching: 10 updates = 10 messages sent
- With batching: 10 updates = 1 batch message sent
- Reduction: 90% fewer network packets

#### Redis Pub/Sub Optimization

**Current setup** (from docker-compose):

```yaml
redis:
  command:
    - redis-server
    - --notify-keyspace-events "AKE" # Enable key events
    - --maxmemory 512mb
```

**Subscription patterns**:

```typescript
// Bad: Too many topics
pubSub.subscribe(
  `settlement:${id}:field:*`, // Wildcard topic (expensive)
  `structure:${id}:field:*`,
  `character:${id}:field:*`
  // ... 100 more topics
);

// Good: Broad topics with client-side filtering
pubSub.subscribe(
  `campaign:${campaignId}:entities`, // All entity updates
  `campaign:${campaignId}:rules` // All rule updates
);

// Client filters in handler
if (message.entityType === 'settlement' && message.entityId === targetId) {
  // Process
}
```

**Topic design for scaling**:

```
One Redis Pub/Sub topic per 100-1000 entities
Total topics: campaign_entities / 500 = manageable count
Subscribers: 1-10 per topic (API replicas)
Message throughput: <1000 msg/sec per topic
```

### 3.5 Rules Engine Performance

#### Expression Evaluation Optimization

**Cache configuration** (from docker-compose.prod.yml):

```env
# Rules Engine Worker
CACHE_TTL_SECONDS=300              # Expression result TTL
CACHE_CHECK_PERIOD_SECONDS=60      # Expiration check interval
CACHE_MAX_KEYS=10000               # Max expressions cached per replica
RULES_ENGINE_CONCURRENCY=5         # gRPC concurrent requests
RULES_ENGINE_TIMEOUT_MS=5000       # Timeout per request
```

**Performance characteristics**:

```
Expression evaluation times (measured):
- Simple condition (1-2 operators): 0.5-1ms
- Complex condition (5-10 operators): 2-5ms
- Very complex (20+ operators): 10-20ms

Cache hit: <0.1ms
Cache miss: 2-5ms average

With caching (70% hit rate):
- Avg: (0.7 * 0.0001) + (0.3 * 0.005) = 0.0016ms
- Effective throughput: ~600,000 evals/sec per replica
```

**Dependency graph optimization**:

```typescript
// Incremental re-evaluation (not full recalculation)
// Only re-evaluate conditions that depend on changed state

// Example:
// State change: settlement.level = 5 (was 4)
// Dependency graph: { level → computed.isAdvanced, isAdvanced → triggers }
//
// Only re-evaluate: computed.isAdvanced and its dependents
// Skip: conditions that don't depend on level
//
// Performance: O(dependent_count) instead of O(total_conditions)
```

---

## Part 4: Monitoring and Observability

### 4.1 Health Check Endpoints

#### API Health Check

```graphql
query {
  health {
    status
    timestamp
    version
  }
}

# Response:
{
  "data": {
    "health": {
      "status": "ok",
      "timestamp": "2025-11-09T12:34:56.789Z",
      "version": "1.0.0"
    }
  }
}
```

#### Cache Health Indicator

```http
GET /health/cache

# Response:
{
  "status": "up",
  "cache": {
    "status": "up",
    "responseTime": 2,
    "metrics": {
      "hitRate": 0.75,
      "memoryUsageMB": 256,
      "redisPingMs": 2,
      "keyCount": 3456
    }
  }
}
```

### 4.2 Performance Metrics Collection

**Key metrics to monitor**:

```
API Service:
- Request latency (p50, p95, p99): Target <100ms for queries
- Error rate: Target <0.1%
- Active connections: Number of concurrent clients
- Subscription count: Active WebSocket subscriptions
- Cache hit rate: Target 70-85%

Database:
- Query latency (p95): Target <50ms
- Connection count: Should not exceed 80% of max_connections
- Index hit ratio: Target >95%
- Slow query count: <5 per minute

Rules Engine:
- Evaluation latency: Target <5ms
- Cache hit rate: Target 60-75% (lower than API cache)
- Expression throughput: Monitor max capacity
- Memory usage: Watch for unbounded growth

Redis:
- Memory usage: Should not exceed 80% of maxmemory
- Eviction rate: Monitor for over-full conditions
- Replication lag: Should be <100ms
- Pub/Sub subscribers: Track for leak detection
```

### 4.3 Logging Strategy

**Log levels**:

```env
# Development
LOG_LEVEL=debug
LOG_FORMAT=text

# Production
LOG_LEVEL=info
LOG_FORMAT=json
```

**Important events to log**:

```typescript
// Cache invalidations (at INFO level)
2025-11-09T12:34:56.789Z INFO CacheService: Cache cascade invalidation: pattern="computed-fields:settlement:settle_123:main", deleted=5 keys

// Query performance (at WARN if slow)
2025-11-09T12:34:56.789Z WARN SettlementService: Slow query for settlement.getComputedFields took 250ms (threshold: 100ms)

// Service errors (at ERROR)
2025-11-09T12:34:56.789Z ERROR WebSocketGateway: Failed to initialize Redis adapter: Connection refused

// Scaling events (at INFO)
2025-11-09T12:34:56.789Z INFO SchedulerService: Distributed cron lock acquired for event-expiration

// Rate limiting (at WARN)
2025-11-09T12:34:56.789Z WARN RateLimitGuard: Rate limit exceeded for user user_123
```

---

## Part 5: Scaling to Specific Load Tiers

### Tier 1: Small (1-100 concurrent users)

**Architecture**:

```
Load Balancer
    ↓
Single API instance (all requests)
    ↓
Single PostgreSQL instance
Single Redis instance
Single Rules Engine instance
Single Scheduler instance
```

**Configuration**:

```yaml
api:
  replicas: 1
  resources:
    limits: { cpus: '0.5', memory: 512M }

rules-engine:
  replicas: 1
  resources:
    limits: { cpus: '0.5', memory: 256M }

postgres:
  resources:
    limits: { cpus: '1', memory: 1024M }
  command: ['-c', 'max_connections=50']

redis:
  command: ['redis-server', '--maxmemory 256mb']
```

**Monitoring**:

- CPU <50%, Memory <60%
- Cache hit rate >60%
- P99 latency <200ms

### Tier 2: Medium (100-1000 concurrent users)

**Architecture** (from docker-compose.prod.yml):

```
Load Balancer
    ├─→ API-1 ──────┐
    ├─→ API-2 ──────┼─→ PostgreSQL with PgBouncer
    └─→ API-3 ──────┘

    Rules Engine (single instance)
    Scheduler (single instance)
    Redis (persistent)
```

**Configuration**:

```yaml
api:
  replicas: 3
  resources:
    limits: { cpus: '1.0', memory: 1024M }
    reservations: { cpus: '0.5', memory: 512M }

postgres:
  resources:
    limits: { cpus: '2.0', memory: 2048M }
  command:
    - "-c" "max_connections=100"
    - "-c" "shared_buffers=512MB"

redis:
  command: ["redis-server", "--maxmemory 512mb", "--maxmemory-policy allkeys-lru"]

# Add PgBouncer
pgbouncer:
  image: pgbouncer:latest
  environment:
    DATABASES: campaign_db=host=postgres port=5432 dbname=campaign_db
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 500
    DEFAULT_POOL_SIZE: 25
```

**Monitoring**:

- API CPU <70%, Memory <80%
- Cache hit rate >70%
- DB connections <80% of max
- P99 latency <150ms

### Tier 3: Large (1000-10000 concurrent users)

**Architecture**:

```
                    Load Balancer (sticky sessions if needed)
                            ↓
    ┌─────────────────────────┼─────────────────────────┐
    v                         v                         v
   API-1                    API-5                    API-10
   API-2                    API-6                   (horizontal scaling)
   API-3                    API-7
    ^                         ^                         ^
    └─────────────────────────┼─────────────────────────┘
                    PostgreSQL cluster (read replicas)
                    Redis cluster (sharded)
                    Rules Engine (2-3 replicas if CPU-bound)
                    Scheduler (1-2 with distributed locking)
```

**Configuration**:

```yaml
api:
  replicas: 10
  resources:
    limits: { cpus: '1.0', memory: 1024M }

postgres:
  replicas: 1 (primary)
  replica: 2-3 read replicas
  resources:
    limits: { cpus: '4.0', memory: 4096M }
  command:
    - "-c" "max_connections=200"
    - "-c" "shared_buffers=1024MB"
    - "-c" "effective_cache_size=3072MB"

redis:
  # Switch to Redis Cluster or Master/Replica with Sentinel
  replicas: 3 (cluster nodes)
  resources:
    limits: { cpus: '1.0', memory: 1024M }

rules-engine:
  replicas: 2-3  # If CPU-bound
  resources:
    limits: { cpus: '0.5', memory: 512M }

pgbouncer:
  instances: 2 (load balanced)
  resources:
    limits: { cpus: '0.5', memory: 256M }
```

**Database optimization**:

```sql
-- Read replicas for read-heavy queries
-- Write all mutations to primary
-- Implement read-write splitting in ORM

-- Connection pooling via PgBouncer
-- Transaction mode for better concurrency
```

**Monitoring**:

- API P99 <100ms
- DB replication lag <50ms
- Cache hit rate >75%
- Memory usage trending (growth should be linear, not exponential)

### Tier 4: Extreme (10000+ concurrent users)

**Architecture**:

```
CDN (static assets)
    ↓
Load Balancer (geographic)
    ├─ Region 1: 15 API replicas
    ├─ Region 2: 15 API replicas
    └─ Region 3: 15 API replicas
    ↓
PostgreSQL (multi-region or global)
Redis Cluster (distributed)
Rules Engine (autoscaling)
Scheduler (distributed with coordination)
```

**This tier requires**:

- Multi-region deployment
- Database sharding or global replication
- Advanced monitoring and alerting
- Dedicated DevOps/SRE team
- Performance testing infrastructure

**Not recommended without**:

- Load testing up to this tier
- Performance analysis of current bottlenecks
- Cost-benefit analysis (is the load real?)

---

## Part 6: Troubleshooting and Optimization

### 6.1 Common Bottlenecks

**Symptom: High API response times (>500ms)**

```
Diagnosis:
1. Check cache hit rate
   - If <50%: Increase TTL, implement warming
2. Check database query times
   - If slow: Add indexes, use EXPLAIN ANALYZE
3. Check Rules Engine latency
   - If slow: Check expression complexity

Resolution checklist:
- [ ] Database indexes present and used
- [ ] DataLoader batching implemented
- [ ] Cache TTL appropriate (300-600s)
- [ ] Rules Engine replicas scaled if needed
- [ ] Connection pooling configured
```

**Symptom: Out of memory errors**

```
Diagnosis:
1. Check which service (API, Rules Engine, Redis)
2. Identify memory leak or unbounded cache

For API:
- Memory leak: Check for circular references
- Unbounded cache: Implement TTL/LRU

For Rules Engine:
- Max keys exceeded: Increase CACHE_MAX_KEYS or reduce TTL
- Memory leak: Monitor cache size growth

For Redis:
- Eviction rate high: Increase maxmemory or reduce dataset
- Large keys: Optimize computed field sizes

Resolution:
- [ ] Set memory limits on containers
- [ ] Monitor memory growth over time
- [ ] Implement cache eviction policies
- [ ] Check for N+1 queries loading huge datasets
```

**Symptom: Cache not preventing repeated queries**

```
Diagnosis:
1. Check if cache.set() is being called
   - May not be called if exception occurs
   - Check error logs
2. Check cache key generation
   - Ensure consistent key format
3. Check TTL
   - If 0 or negative, immediately expires

Resolution checklist:
- [ ] Verify cache.set() called after compute
- [ ] Check cache key format (use builders)
- [ ] Increase TTL if too short
- [ ] Verify cache is not disabled (CACHE_METRICS_ENABLED=true)
- [ ] Check Redis connection (may be failing silently)
```

### 6.2 Performance Tuning Steps

**Step 1: Establish baseline**

```bash
# Measure before optimizing
- P50, P95, P99 latency
- Throughput (requests/sec)
- Cache hit rate
- Memory usage
- CPU utilization
- Database connection count
```

**Step 2: Identify bottleneck**

```bash
# Profiling (order of impact):
1. Database queries
   - Use EXPLAIN ANALYZE
   - Check missing indexes
   - Use DataLoader to batch

2. Rules Engine evaluation
   - Check expression complexity
   - Verify cache hit rate
   - Consider scaling replicas

3. Redis latency
   - Check latency (redis-cli --latency)
   - Verify no network issues
   - Check memory pressure

4. Application code
   - Profile hot paths
   - Check for N+1 queries
   - Optimize serialization
```

**Step 3: Implement fix**

```bash
# Start with highest-impact changes:
1. Add missing database index (likely 10-50x improvement)
2. Implement DataLoader batching (likely 5-20x improvement)
3. Increase cache TTL or warm cache (likely 2-5x improvement)
4. Scale Rules Engine if CPU-bound (linear improvement)
5. Optimize expensive computations (varies)
```

**Step 4: Measure improvement**

```bash
# Verify fix worked
- Latency reduced by expected amount?
- Throughput increased?
- Memory usage stable?
- No new problems introduced?

If improvement <10%:
- May not be the actual bottleneck
- Continue profiling other areas
```

### 6.3 Scaling Checklist

Before scaling production:

- [ ] Baseline performance metrics captured
- [ ] Load testing completed (10x expected load minimum)
- [ ] Database indexes verified and used
- [ ] Cache hit rate >70%
- [ ] Error rate <0.1%
- [ ] Memory trending stable (not exponential growth)
- [ ] Health checks passing
- [ ] Monitoring and alerting configured
- [ ] Runbooks for common issues written
- [ ] Rollback procedure documented
- [ ] Capacity plan for next 6 months created
- [ ] Cost analysis completed

---

## Appendix: Reference Configurations

### A. Environment Variables for Scaling

```bash
# .env for scaling scenarios

# === Cache Configuration ===
CACHE_DEFAULT_TTL=300              # 5 minutes - adjust based on change frequency
CACHE_METRICS_ENABLED=true         # Always enable for monitoring
CACHE_LOGGING_ENABLED=false        # Disable in production (too verbose)

# === Rules Engine ===
RULES_ENGINE_ENABLED=true
RULES_ENGINE_GRPC_HOST=rules-engine
RULES_ENGINE_GRPC_PORT=50051
RULES_ENGINE_TIMEOUT_MS=5000       # Increase if complex expressions
RULES_ENGINE_HTTP_PORT=9265
CACHE_TTL_SECONDS=300
CACHE_CHECK_PERIOD_SECONDS=60
CACHE_MAX_KEYS=10000               # Increase if memory available

# === Database ===
DATABASE_URL=postgres://user:pass@pgbouncer:6432/campaign_db  # Use connection pooler
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=campaign_user
POSTGRES_PASSWORD=campaign_pass
POSTGRES_DB=campaign_db

# === Redis ===
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=                    # Set in production
REDIS_CACHE_DB=1                   # Separate DB for cache

# === API ===
API_PORT=3000
API_HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json

# === Scheduler ===
SCHEDULER_POLL_INTERVAL=5000
SCHEDULER_CONCURRENCY=3            # Increase if more jobs needed

# === Limits ===
MAX_FILE_SIZE=10485760
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100                 # Adjust per scaling tier
```

### B. Docker Compose for Large Tier

```yaml
version: '3.8'

services:
  # Load Balancer (Nginx)
  load-balancer:
    image: nginx:1.25-alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api-1
      - api-2
      - api-3

  # API Replicas
  api-1:
    build:
      context: .
      dockerfile: packages/api/Dockerfile
      target: production
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://user:pass@pgbouncer:6432/campaign_db
      REDIS_HOST: redis
    depends_on:
      - postgres
      - redis
      - rules-engine
    deploy:
      resources:
        limits: { cpus: '1.0', memory: 1024M }

  api-2:
    # Same as api-1

  api-3:
    # Same as api-1

  # Connection Pooler
  pgbouncer:
    image: pgbouncer:latest
    environment:
      DATABASES: campaign_db=host=postgres port=5432 dbname=campaign_db
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 500
      DEFAULT_POOL_SIZE: 25
    depends_on:
      - postgres

  # Database (read replica setup)
  postgres:
    image: postgis/postgis:16-3.4-alpine
    environment:
      POSTGRES_USER: campaign_user
      POSTGRES_PASSWORD: campaign_pass
      POSTGRES_DB: campaign_db
    volumes:
      - postgres-data:/var/lib/postgresql/data
    deploy:
      resources:
        limits: { cpus: '2.0', memory: 2048M }

  # Redis Cluster (or single instance with replication)
  redis:
    image: redis:7-alpine
    command:
      - redis-server
      - --appendonly yes
      - --maxmemory 512mb
      - --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 512M }

  # Rules Engine Worker
  rules-engine:
    # Single or multiple replicas as needed
    build:
      context: .
      dockerfile: packages/rules-engine/Dockerfile
      target: production
    environment:
      NODE_ENV: production
      REDIS_HOST: redis
    depends_on:
      - redis

  # Scheduler Worker
  scheduler:
    build:
      context: .
      dockerfile: packages/scheduler/Dockerfile
      target: production
    environment:
      NODE_ENV: production
      REDIS_HOST: redis
      API_URL: http://api-1:3000/graphql

  # Frontend (with Nginx reverse proxy)
  frontend:
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
      target: production
    environment:
      VITE_API_URL: /graphql
    deploy:
      replicas: 2
      resources:
        limits: { cpus: '0.5', memory: 256M }

volumes:
  postgres-data:
  redis-data:
```

---

## Conclusion

The Campaign Manager is designed for horizontal scaling with several key principles:

1. **Stateless services**: API replicas don't maintain state
2. **Distributed caching**: Redis coordinates state across replicas
3. **Background workers**: Async jobs prevent API blocking
4. **Real-time coordination**: WebSocket and Pub/Sub keep clients synchronized

Start with Tier 1/2 configurations and monitor metrics closely. Scale only when metrics show the need, not in anticipation. Most scaling issues are resolved by optimizing queries and caching before adding replicas.

For production deployments, maintain:

- Baseline performance metrics
- Health checks and alerts
- Capacity planning
- Load testing infrastructure
- Clear runbooks for scaling operations
