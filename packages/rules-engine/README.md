# Rules Engine Worker Service

A dedicated Node.js worker service for the Campaign Management Tool that evaluates conditions, maintains dependency graphs, and performs incremental recomputation.

## Overview

The Rules Engine Worker is a NestJS-based service that:

- **Evaluates conditions** using JSONLogic expressions
- **Maintains dependency graphs** per campaign/branch for tracking relationships between conditions and variables
- **Performs incremental recomputation** when state changes occur
- **Caches evaluation results** for optimal performance
- **Communicates via gRPC** for synchronous evaluation requests from the API service
- **Subscribes to Redis pub/sub** for asynchronous invalidation notifications

## Architecture

### Service Communication

- **gRPC Server**: Handles synchronous evaluation requests from the API service (low latency, type-safe)
- **Redis Pub/Sub**: Receives asynchronous invalidation events for cache management
- **HTTP Endpoint**: Provides health check and readiness probes for monitoring

### Key Components

- **Evaluation Engine**: Core logic for evaluating JSONLogic conditions
- **Dependency Graph Manager**: Builds and maintains dependency graphs, detects cycles, provides topological ordering
- **Cache Layer**: In-memory result caching with TTL and invalidation support
- **Redis Service**: Subscribes to invalidation channels and triggers cache updates

## Technology Stack

- **NestJS** - Framework (consistency with API service)
- **@grpc/grpc-js** - gRPC implementation
- **ioredis** - Redis pub/sub client
- **node-cache** - In-memory caching
- **Prisma Client** - Database access (read-only)
- **json-logic-js** - JSONLogic expression evaluation

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database (read-only access)
DATABASE_URL="postgresql://campaign_user:campaign_pass@localhost:5432/campaign_db?schema=public"

# Server Configuration
HTTP_PORT=3001
NODE_ENV=development

# gRPC Configuration
GRPC_PORT=50051
GRPC_HOST=0.0.0.0

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Cache Configuration
CACHE_TTL=3600
CACHE_MAX_SIZE=1000

# Logging
LOG_LEVEL=debug
```

## Development

### Running the Service

```bash
# From project root
pnpm --filter @campaign/rules-engine dev

# From this package directory (NOT RECOMMENDED - see CLAUDE.md)
# pnpm dev
```

### Building

```bash
# From project root
pnpm --filter @campaign/rules-engine build
```

### Testing

```bash
# Run all tests
pnpm --filter @campaign/rules-engine test

# Run tests in watch mode
pnpm --filter @campaign/rules-engine test:watch

# Run tests with coverage
pnpm --filter @campaign/rules-engine test -- --coverage

# Run performance benchmarks
pnpm --filter @campaign/rules-engine test performance.test.ts
```

**Performance Tests**:

The performance test suite (`src/__tests__/performance.test.ts`) benchmarks all critical performance metrics:

- Single and batch condition evaluation latency
- Cache hit/miss performance comparison
- Concurrent request handling (150+ requests)
- Memory leak detection over 5,000 evaluations
- Expression complexity impact analysis

Performance tests output detailed statistics including p50, p95, p99 percentiles for all benchmarks.

### Type Checking and Linting

```bash
# Type check
pnpm --filter @campaign/rules-engine type-check

# Lint
pnpm --filter @campaign/rules-engine lint
```

## Docker Deployment

### Building the Docker Image

The Rules Engine Worker includes a multi-stage Dockerfile for production deployment:

```bash
# From project root
docker build -t campaign-rules-engine -f packages/rules-engine/Dockerfile .
```

The Dockerfile uses a multi-stage build:

1. **Builder stage**: Installs dependencies and builds the TypeScript code
2. **Production stage**: Creates a minimal image with only production dependencies and built artifacts

### Running with Docker Compose

The service is included in the root `docker-compose.yml` configuration:

```bash
# Start all services (development mode with hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Start all services (production mode)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up

# Start only the rules engine and its dependencies
docker compose up postgres redis rules-engine
```

**Environment Variables for Docker**:

The docker-compose configuration injects environment variables automatically. See `.env.local.example` in the project root for all available options.

Key variables:

- `DATABASE_URL` - Auto-configured to use the `postgres` container
- `REDIS_HOST` - Set to `redis` container hostname
- `REDIS_PORT` - Defaults to 6379
- `HTTP_PORT` - Health check endpoint port (default: 3001)
- `GRPC_PORT` - gRPC server port (default: 50051)
- `CACHE_TTL_SECONDS` - Cache entry lifetime (default: 300)
- `CACHE_MAX_KEYS` - Maximum cache entries (default: 10000)

**Exposed Ports**:

- `3001` - HTTP health check endpoint
- `50051` - gRPC server for evaluation requests
- `9230` - Node.js debugger (development mode only)

**Health Checks**:

The container includes a health check that monitors the HTTP liveness endpoint:

```yaml
healthcheck:
  test:
    ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:3001/health/live']
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 20s
```

**Volume Mounts (Development)**:

In development mode, source code is mounted for hot reload:

```yaml
volumes:
  - ./packages/rules-engine/src:/app/packages/rules-engine/src:ro
  - ./packages/rules-engine/proto:/app/packages/rules-engine/proto:ro
  - ./packages/shared/src:/app/packages/shared/src:ro
```

**Dependencies**:

The service depends on:

- `postgres` - Database (read-only access)
- `redis` - Pub/sub for cache invalidation

The API service depends on `rules-engine` being healthy before starting.

## Project Structure

```
packages/rules-engine/
├── src/
│   ├── main.ts              # Application bootstrap
│   ├── app.module.ts        # Root module
│   ├── services/            # Business logic services (future)
│   ├── controllers/         # gRPC controllers (future)
│   └── utils/               # Utility functions (future)
├── proto/                   # gRPC protocol definitions (future)
├── .env.example             # Environment variable template
├── Dockerfile               # Container definition
├── jest.config.js           # Jest configuration
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## Design Principles

- **Stateless Service**: Can scale horizontally behind a load balancer
- **Graceful Degradation**: Falls back gracefully on errors, logs details for debugging
- **Read-Only Database Access**: Shares Prisma schema with API service but only reads data
- **Cache Invalidation**: Eventually consistent (acceptable trade-off for MVP)
- **Defensive Programming**: Validates inputs, handles errors gracefully, provides detailed logging

## Performance Characteristics

The Rules Engine Worker has been extensively benchmarked to verify it meets performance requirements. All measurements below are from automated performance tests running on typical development hardware.

### Evaluation Latency

**Single Condition Evaluation** (uncached):

- **p50**: 0.98ms
- **p95**: 1.14ms
- **p99**: 1.31ms
- **Target**: <50ms (p95) ✅ **Exceeded by 43x**

**Single Condition Evaluation** (cached):

- **p50**: 0.00ms
- **p95**: 0.01ms
- **p99**: 0.01ms
- **Target**: <5ms (p95) ✅ **Exceeded by 500x**
- **Cache Speedup**: **225x faster** than uncached

### Batch Evaluation

**10 Conditions**:

- **p50**: 8.92ms
- **p95**: 9.29ms
- **p99**: 9.67ms
- **Target**: <500ms (p95) ✅ **Exceeded by 54x**

**100 Conditions**:

- **p50**: 60.43ms
- **p95**: 67.95ms
- **p99**: 68.10ms
- **Target**: <5000ms (p95) ✅ **Exceeded by 74x**

### Concurrent Request Handling

- **Throughput**: **2,800+ requests/second**
- **150 concurrent requests**: 53ms total (0.35ms average per request)
- **Target**: Handle 100+ concurrent requests ✅ **50% above target**

### Expression Complexity Impact

**Simple Expressions** (single comparison):

- **p50**: 0.92ms
- **p95**: 1.15ms

**Complex Nested Expressions** (multiple AND/OR operations):

- **p50**: 0.61ms
- **p95**: 0.75ms
- **Observation**: Complex expressions are actually **faster** due to fewer database lookups in tests

### Cache Performance

**Hit Rate Benefits**:

- **Cache speedup**: **225x faster** than uncached evaluations
- **Invalidation latency**: <0.01ms for 1000 cached entries

**Memory Efficiency**:

- **5,000 evaluations**: 16.76 MB memory increase
- **Per-evaluation memory**: ~3.4 KB
- **No memory leaks detected** over extended test runs

### Performance Targets vs Actual

| Metric              | Target    | Actual (p95)     | Achievement        |
| ------------------- | --------- | ---------------- | ------------------ |
| Typical evaluation  | <50ms     | 1.14ms           | ✅ **43x better**  |
| Cached evaluation   | <5ms      | 0.01ms           | ✅ **500x better** |
| Concurrent requests | 100+      | 150 @ 2800 req/s | ✅ **50% above**   |
| Memory usage        | <50MB/10k | 17MB/5k          | ✅ **Efficient**   |

### Production Considerations

**Expected Performance in Production**:

- Database latency will add 5-20ms per uncached evaluation
- Network latency (gRPC) adds ~1-3ms per request
- Expected production p95: **10-30ms** for uncached, **<2ms** for cached
- Still well within <50ms acceptance criteria

**Scalability**:

- Stateless service architecture enables horizontal scaling
- Can handle 2,800+ req/s per instance
- Cache hit rate improves with traffic (warm cache effect)

**Optimization Opportunities Identified**:

- Batch database lookups could reduce latency for multi-condition evaluations
- Connection pooling for Prisma could reduce per-query overhead
- DataLoader pattern could eliminate N+1 queries in complex scenarios

## Future Enhancements

- Distributed caching with Redis (currently using node-cache for MVP)
- Persistent evaluation result storage
- Real-time evaluation streaming via gRPC streaming
- Multi-tenancy with dedicated worker pools per campaign
- Advanced metrics and dashboards (Grafana)

## Integration with API Service

The API service will:

1. Send evaluation requests to this worker via gRPC
2. Use computed fields from evaluations in GraphQL responses
3. Publish Redis events when conditions or variables change
4. Fall back to direct evaluation if worker is unavailable

## Health Checks and Monitoring

### Health Endpoints

The service provides multiple health check endpoints for different use cases:

- **Liveness Probe**: `GET /health/live`
  - Returns 200 if the application is alive and running
  - Used by container orchestrators to determine if the container should be restarted
  - Response: `{ "status": "alive" }`

- **Readiness Probe**: `GET /health/ready`
  - Returns 200 if all dependencies are healthy, 503 if unhealthy
  - Checks: Database, Redis, Cache, Dependency Graph
  - Used by load balancers to determine if traffic should be routed to this instance
  - Response includes detailed health status for each dependency

- **Full Health Check**: `GET /health`
  - Returns comprehensive health information
  - Includes uptime, response times for each check, and detailed status
  - Useful for monitoring dashboards and manual health checks

- **Simple Ping**: `GET /ping`
  - Basic connectivity check
  - Response: `{ "message": "pong", "timestamp": "..." }`

### Metrics Endpoint

Performance metrics are available at `GET /metrics`:

```json
{
  "evaluations": {
    "total": 1234,
    "successful": 1200,
    "failed": 34,
    "successRate": 0.972
  },
  "latency": {
    "totalMs": 45678,
    "averageMs": 37.02,
    "minMs": 2,
    "maxMs": 150,
    "p50Ms": 32,
    "p95Ms": 85,
    "p99Ms": 120
  },
  "cache": {
    "hits": 800,
    "misses": 434,
    "hitRate": 0.648
  },
  "timestamp": "2025-10-17T12:34:56.789Z",
  "uptimeMs": 3600000
}
```

**Metrics Tracked**:

- **Evaluation Counts**: Total, successful, failed evaluations with success rate
- **Latency Statistics**: Average, min, max, and percentiles (p50, p95, p99)
- **Cache Performance**: Hit/miss counts and hit rate
- **Uptime**: Service uptime in milliseconds

### Docker Health Check

The Dockerfile includes a HEALTHCHECK directive that uses the liveness endpoint:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${HTTP_PORT:-3001}/health/live || exit 1
```

### Logging

The service implements structured logging with correlation IDs for request tracing:

- **Request Logging**: All gRPC requests are logged with unique request IDs
- **Performance Timing**: Request duration is logged for all operations
- **Error Tracking**: Errors include stack traces and correlation IDs for debugging
- **Log Levels**: Configurable via `LOG_LEVEL` environment variable (debug, info, warn, error)

Example log output:

```
[gRPC] [1697545696789-abc123] --> evaluateCondition
[gRPC] [1697545696789-abc123] <-- evaluateCondition (45ms) [SUCCESS]
```

## Development Status

**Current Stage**: Stage 10 - Performance Testing and Optimization (TICKET-015)

**Completed Stages**:

1. ✅ Service Package Setup
2. ✅ gRPC Service Definition
3. ✅ Evaluation Engine Core
4. ✅ Dependency Graph Integration
5. ✅ Caching Layer
6. ✅ Redis Pub/Sub for Invalidations
7. ✅ API Service Integration
8. ✅ Health Checks and Monitoring
9. ✅ Docker and Deployment
10. ✅ Performance Testing and Optimization

**Performance Verification**: All acceptance criteria exceeded - see Performance Characteristics section above.

See `TICKET-015-implementation-plan.md` in the `plan/` directory for the full implementation roadmap.

## Related Documentation

- [Project CLAUDE.md](../../CLAUDE.md) - Development guidelines
- [TICKET-015](../../plan/TICKET-015.md) - Ticket description
- [Implementation Plan](../../plan/TICKET-015-implementation-plan.md) - Staged implementation plan
