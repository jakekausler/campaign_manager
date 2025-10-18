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
# Run tests
pnpm --filter @campaign/rules-engine test

# Run tests in watch mode
pnpm --filter @campaign/rules-engine test:watch

# Run tests with coverage
pnpm --filter @campaign/rules-engine test -- --coverage
```

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

## Performance Goals

- **Evaluation Latency**: <50ms for typical evaluations (p95)
- **Cached Evaluations**: <5ms (p95)
- **Concurrent Requests**: Support 100+ concurrent evaluation requests
- **Incremental Recomputation**: Only recalculate affected nodes on state changes

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

**Current Stage**: Stage 1 - Service Package Setup (TICKET-015)

See `TICKET-015-implementation-plan.md` in the `plan/` directory for the full implementation roadmap.

## Related Documentation

- [Project CLAUDE.md](../../CLAUDE.md) - Development guidelines
- [TICKET-015](../../plan/TICKET-015.md) - Ticket description
- [Implementation Plan](../../plan/TICKET-015-implementation-plan.md) - Staged implementation plan
