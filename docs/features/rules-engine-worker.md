# Rules Engine Service Worker

The Rules Engine Service Worker (TICKET-015) is a dedicated NestJS microservice that handles high-performance condition evaluation, dependency-based ordering, caching, and incremental recomputation for the campaign management system.

## Overview

- Standalone Node.js worker service running alongside the API
- gRPC server for low-latency synchronous evaluation requests
- Redis pub/sub for asynchronous cache invalidation notifications
- In-memory caching with TTL-based expiration
- Dependency graph integration for correct evaluation ordering
- Circuit breaker pattern for resilient API integration
- Falls back to local evaluation when worker unavailable

## Architecture

```
┌─────────────────┐         gRPC         ┌──────────────────────┐
│                 │◄──────────────────────│                      │
│   API Service   │                       │  Rules Engine Worker │
│                 │──────────────────────►│                      │
└─────────────────┘      Redis Pub/Sub    └──────────────────────┘
        │                                            │
        │                                            │
        │            ┌──────────────────┐            │
        └───────────►│   PostgreSQL     │◄───────────┘
                     │  (Read-Only for  │
                     │   Worker)        │
                     └──────────────────┘
```

## Key Components

### Rules Engine Worker Service

Located at root level (not in packages/ directory)

**gRPC Service Definition** (`proto/rules-engine.proto`):

- `EvaluateCondition` - Single condition evaluation with trace support
- `EvaluateConditions` - Batch evaluation with dependency ordering
- `GetEvaluationOrder` - Topological sort for conditions
- `ValidateDependencies` - Cycle detection in dependency graph
- `InvalidateCache` - Cache invalidation for campaign/branch
- `GetCacheStats` - Cache performance metrics

**Core Services**:

1. **EvaluationEngineService**: JSONLogic expression evaluation
   - Single and batch condition evaluation
   - Context building from entity data
   - Variable extraction and resolution
   - Expression validation (max depth: 10 levels)
   - Detailed trace generation for debugging

2. **DependencyGraphService**: Graph management for evaluation ordering
   - Builds dependency graphs per campaign/branch
   - Caches graphs in memory until invalidated
   - Provides topological sort for safe evaluation order
   - Detects cycles to prevent infinite loops

3. **CacheService**: Result caching with TTL
   - In-memory cache using node-cache
   - Structured cache keys: `campaign:{id}:branch:{id}:node:{id}`
   - Configurable TTL (default 300s)
   - Cache statistics tracking (hits, misses, hit rate)
   - Bypass cache when trace requested

4. **RedisService**: Invalidation event subscription
   - Subscribes to 6 invalidation channels:
     - `condition.created`, `condition.updated`, `condition.deleted`
     - `variable.created`, `variable.updated`, `variable.deleted`
   - Exponential backoff retry (1s-10s, max 10 attempts)
   - Graceful shutdown handling
   - Event-driven cache invalidation

### API Service Integration

Located at `packages/api/src/grpc/rules-engine-client.service.ts`

**RulesEngineClientService**:

- gRPC client for communicating with worker
- Circuit breaker pattern for resilience:
  - States: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery)
  - Failure threshold: 5 consecutive failures
  - Reset timeout: 30 seconds
- Automatic reconnection with connection pooling
- Request timeout configuration (default 5000ms)
- Health check via `isAvailable()` method
- Environment-based enable/disable flag

**Settlement/Structure Service Integration**:

Both services use `getComputedFields()` method with fallback strategy:

1. Check if Rules Engine worker is available
2. If available, send batch evaluation request via gRPC
3. Build context with StateVariable integration
4. Parse results and build computed fields map
5. If worker unavailable or fails, fall back to local evaluation
6. Log warnings for debugging

**Redis Pub/Sub Publisher** (packages/api/src/graphql/services/):

- **ConditionService**: Publishes events on create/update/delete
- **StateVariableService**: Publishes events on create/update/delete
- Event format: `{ conditionId/variableId, campaignId, branchId }`
- Automatic publication after successful mutations

## Configuration

**Rules Engine Worker** (root `.env`):

```bash
# Database (read-only access)
DATABASE_URL=postgresql://user:pass@localhost:5432/campaign_db

# gRPC Server
GRPC_PORT=50051

# HTTP Server (health checks)
HTTP_PORT=9265

# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Caching
CACHE_TTL_SECONDS=300           # 5 minutes
CACHE_CHECK_PERIOD_SECONDS=60   # Cleanup interval
CACHE_MAX_KEYS=10000            # Max cache entries

# Logging
LOG_LEVEL=info
```

**API Service** (`packages/api/.env`):

```bash
# Rules Engine Worker
RULES_ENGINE_ENABLED=true
RULES_ENGINE_GRPC_HOST=localhost
RULES_ENGINE_GRPC_PORT=50051
RULES_ENGINE_TIMEOUT_MS=5000
```

## Communication Patterns

### Synchronous (gRPC)

Used for immediate evaluation requests from API to worker:

```typescript
// API Service
const result = await rulesEngineClient.evaluateCondition({
  conditionId: 'condition-123',
  campaignId: 'campaign-456',
  branchId: 'main',
  contextJson: JSON.stringify(context),
  includeTrace: false,
});
```

Benefits:

- Low latency (<50ms for typical evaluations)
- Type-safe protocol buffers
- Efficient binary serialization
- Built-in deadline/timeout support

### Asynchronous (Redis Pub/Sub)

Used for invalidation notifications from API to worker:

```typescript
// API Service (ConditionService)
await this.pubSub.publish('condition.updated', {
  conditionId: updated.id,
  campaignId,
  branchId: 'main',
});

// Rules Engine Worker (RedisService)
// Automatically receives message and invalidates cache
```

Benefits:

- Decoupled services
- Fire-and-forget semantics
- No blocking mutations
- Automatic retry on connection loss

## Performance Characteristics

**Evaluation Performance:**

- Cached evaluations: <5ms (p95)
- Uncached evaluations: <50ms (p95)
- Batch evaluations: Dependency-ordered, parallel-ready

**Cache Performance:**

- Hit rate: Tracked per campaign/branch
- Memory usage: Monitored via cache statistics
- Eviction strategy: Reject new when maxKeys reached (not LRU)

**Scalability:**

- Stateless service (can scale horizontally)
- Per-campaign/branch cache isolation
- No cross-campaign data sharing
- Connection pooling for gRPC and Redis

## Circuit Breaker Pattern

Protects API service from cascading failures:

**States:**

1. **CLOSED** (Normal):
   - All requests forwarded to worker
   - Failure count tracked
   - Opens after 5 consecutive failures

2. **OPEN** (Failing):
   - All requests immediately rejected
   - Falls back to local evaluation
   - Transitions to HALF_OPEN after 30s

3. **HALF_OPEN** (Testing):
   - Single request allowed to test recovery
   - Success → closes circuit
   - Failure → reopens circuit

**Monitoring:**

```typescript
const state = rulesEngineClient.getCircuitState();
// Returns: { state, failureCount, isConnected }
```

## Graceful Degradation

The system maintains availability even when the worker is down:

1. **Circuit breaker opens** after failure threshold
2. **API falls back** to local evaluation (ConditionEvaluationService)
3. **Users experience** slightly higher latency but no errors
4. **Worker recovery** automatically detected via HALF_OPEN state
5. **Circuit closes** when worker responds successfully

## Integration Tests

Located at `packages/api/src/grpc/rules-engine-client.integration.test.ts`

**Test Coverage:**

- Connection and health checks
- Single condition evaluation
- Batch condition evaluation
- Evaluation order queries
- Dependency validation
- Cache operations (invalidation, statistics)
- Error handling (timeouts, invalid JSON)
- Circuit breaker behavior
- Disabled worker scenarios

**Running Integration Tests:**

```bash
# Start Rules Engine worker first
pnpm --filter @campaign/api dev  # In one terminal

# Run integration tests
INTEGRATION_TESTS=true pnpm --filter @campaign/api test rules-engine-client.integration.test.ts
```

Note: Integration tests are skipped by default to avoid requiring the worker for CI/CD.

## Common Use Cases

1. **Computed Field Evaluation**: Settlement/Structure computed fields via worker
2. **Batch Evaluation**: Evaluate multiple conditions with dependency ordering
3. **Cache Warming**: Pre-populate cache after deployments
4. **Dependency Analysis**: Query evaluation order and detect cycles
5. **Performance Monitoring**: Track cache hit rates and evaluation latency

## Monitoring and Observability

**Cache Statistics:**

```graphql
query GetCacheStats {
  # Via gRPC client
  rulesEngineClient.getCacheStats({
    campaignId: "campaign-123",
    branchId: "main"
  })
}
```

Returns:

- Total hits/misses
- Cache size (keys, memory usage)
- Hit rate percentage
- Sample cache keys

**Circuit Breaker State:**

```typescript
const { state, failureCount, isConnected } = rulesEngineClient.getCircuitState();
logger.info(`Circuit breaker: ${state}, failures: ${failureCount}`);
```

**Redis Connection:**

- Automatic reconnection with exponential backoff
- Connection status logged on connect/disconnect
- Error handling prevents service crashes

## Known Limitations (Acceptable for MVP)

1. **In-Memory Cache**: Lost on worker restart (future: Redis cache)
2. **Single-Node Worker**: No distributed caching (future: horizontal scaling)
3. **No Persistent Graphs**: Dependency graphs rebuilt from database on demand
4. **Direct Prisma Client**: Worker creates own PrismaClient (future: shared service)
5. **Unbounded Queries**: Fetches all active conditions/variables (future: pagination)

## Future Enhancements

- Distributed caching with Redis
- Horizontal scaling with load balancer
- Persistent dependency graph storage
- Real-time graph updates via subscriptions
- Advanced metrics and dashboards (Grafana)
- Cache warming on startup
- LRU eviction policy for cache
- Incremental recomputation (TICKET-020+)

## Implementation Details

**Migration**: None (service only, no database changes)

**Commits:**

- Stage 1: 3717b35 (Service package setup)
- Stage 2: 0ec4355 (gRPC service definition and server)
- Stage 3: d1d8563 (Evaluation engine core)
- Stage 4: 04772f2 (Dependency graph integration)
- Stage 5: f69cdd9 (Caching layer)
- Stage 6: ea36e66 (Redis pub/sub invalidations)
- Stage 7: ce8a51e (API service integration)

**Files:**

Worker Service (root level):

- Proto: `proto/rules-engine.proto`
- Types: `src/generated/rules-engine.types.ts`
- Controllers: `src/controllers/rules-engine.controller.ts`
- Services: `src/services/evaluation-engine.service.ts`, `src/services/dependency-graph.service.ts`, `src/services/cache.service.ts`, `src/services/redis.service.ts`
- Tests: Colocated `.test.ts` and `.integration.test.ts` files

API Service Integration:

- Client: `packages/api/src/grpc/rules-engine-client.service.ts`
- Types: `packages/api/src/grpc/rules-engine.types.ts`
- Proto: `packages/api/proto/rules-engine.proto`
- Integration: `packages/api/src/graphql/services/settlement.service.ts`, `structure.service.ts`
- Publishers: `packages/api/src/graphql/services/condition.service.ts`, `state-variable.service.ts`
- Tests: `packages/api/src/grpc/rules-engine-client.integration.test.ts`
