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

## Health Checks

- **Liveness Probe**: `GET /health` - Basic ping response
- **Readiness Probe**: `GET /health` - Checks Prisma and Redis connections

## Development Status

**Current Stage**: Stage 1 - Service Package Setup (TICKET-015)

See `TICKET-015-implementation-plan.md` in the `plan/` directory for the full implementation roadmap.

## Related Documentation

- [Project CLAUDE.md](../../CLAUDE.md) - Development guidelines
- [TICKET-015](../../plan/TICKET-015.md) - Ticket description
- [Implementation Plan](../../plan/TICKET-015-implementation-plan.md) - Staged implementation plan
