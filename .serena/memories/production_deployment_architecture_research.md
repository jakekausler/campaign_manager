# Campaign Manager - Production Deployment Architecture Research

## Overview

The Campaign Manager is a multi-service monorepo with Docker-based containerization, using docker-compose for orchestration with separate configurations for development and production environments.

## Docker Setup

### Base Configuration

- **Orchestration**: Docker Compose 3.8
- **Node Version**: 20-alpine (lightweight)
- **Base Images**:
  - Frontend: node:20-alpine (builder) → nginx:1.25-alpine (production)
  - API, Rules Engine, Scheduler: node:20-alpine → production stage
  - PostgreSQL: postgis/postgis:16-3.4-alpine
  - Redis: redis:7-alpine
  - MinIO: minio/minio:latest

### Build Patterns

All services use **multi-stage builds**:

1. **Builder Stage**: Installs dependencies, builds TypeScript code
2. **Production Stage**: Copies built artifacts, creates non-root user, minimal final image

### Key Dependencies

- **pnpm**: Monorepo package manager with workspace support
- **TypeScript**: Primary language
- **Frozen lockfile**: `pnpm install --frozen-lockfile` ensures reproducible builds

### Non-Root User Security

Each service creates a dedicated non-root user:

- API: `nestjs` (user 1001)
- Rules Engine: `worker` (user 1001)
- Scheduler: `worker` (user 1001)
- Frontend/Nginx: `nginx-user` (user 1001)

## Service Architecture

### 1. PostgreSQL + PostGIS (postgres)

**Image**: postgis/postgis:16-3.4-alpine
**Port**: 5432
**Volume**: postgres-data (persistent)

**Features**:

- PostGIS extension for spatial data (geometry/geography types)
- PostGIS Topology extension
- UUID-ossp extension for ID generation
- pg_trgm extension for text search
- Custom initialization via `/scripts/init-postgis.sql`

**Health Check**:

```bash
pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}
```

**Production Config**:

- max_connections=200
- shared_buffers=512MB
- effective_cache_size=1536MB
- maintenance_work_mem=128MB
- checkpoint_completion_target=0.9
- wal_buffers=16MB
- default_statistics_target=100
- random_page_cost=1.1
- effective_io_concurrency=200
- work_mem=2621kB
- min_wal_size=1GB
- max_wal_size=4GB

### 2. Redis (redis)

**Image**: redis:7-alpine
**Port**: 6379
**Volume**: redis-data (persistent)

**Configuration**:

- Append-only file (AOF) enabled: `--appendonly yes`
- Production: `--maxmemory 512mb --maxmemory-policy allkeys-lru`

**Health Check**:

```bash
redis-cli ping
```

**Usage**:

- Caching layer (API - Redis DB 1)
- Pub/Sub for real-time updates
- Socket.IO adapter for WebSocket scaling
- Rules Engine evaluation caching
- Scheduler job queue management

### 3. MinIO (S3-compatible storage)

**Image**: minio/minio:latest
**Ports**: 9000 (API), 9001 (Console)
**Volume**: minio-data (persistent)

**Health Check**:

```bash
curl -f http://localhost:9000/minio/health/live
```

**Configuration**:

```
MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
```

### 4. API Service (NestJS GraphQL)

**Image**: campaign:api (custom built)
**Port**: 3000
**Build**: packages/api/Dockerfile

**Key Dependencies**:

- @apollo/server (GraphQL)
- @nestjs/\* (framework)
- @grpc/grpc-js (communication with Rules Engine)
- socket.io (WebSockets)
- @prisma/client (database)
- ioredis (caching)
- @aws-sdk/client-s3 (MinIO)
- bcrypt (password hashing)
- passport (authentication)

**Health Check**:

```bash
node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

**Startup**: 60s grace period

**Production Deployment**:

- 2 replicas
- CPU limits: 1.0 (limit), 0.5 (reservation)
- Memory: 1024MB (limit), 512MB (reservation)
- Restart: on-failure, max 3 attempts, 5s delay

**Environment Variables**:

- NODE_ENV=production
- LOG_LEVEL=info
- LOG_FORMAT=json
- GRAPHQL_PLAYGROUND=false (disabled)
- GRAPHQL_INTROSPECTION=false (disabled)
- DATABASE_URL: postgres://user:pass@postgres:5432/campaign_db
- REDIS_URL: redis://redis:6379
- S3_ENDPOINT: http://minio:9000
- RULES_ENGINE_GRPC_HOST: rules-engine
- RULES_ENGINE_GRPC_PORT: 50051
- RULES_ENGINE_TIMEOUT_MS: 5000

### 5. Rules Engine Worker (gRPC microservice)

**Image**: campaign:rules-engine (custom built)
**Ports**: 9265 (HTTP health), 50051 (gRPC)
**Build**: packages/rules-engine/Dockerfile

**Key Dependencies**:

- @grpc/grpc-js (gRPC server)
- json-logic-js (condition evaluation)
- cache-manager (caching)
- ioredis (Redis integration)
- @nestjs/microservices

**Health Check**:

```bash
wget --no-verbose --tries=1 --spider http://localhost:9265/health/live
```

**Startup**: 20s grace period

**Production Deployment**:

- 1 replica
- CPU limits: 0.5 (limit), 0.25 (reservation)
- Memory: 512MB (limit), 256MB (reservation)
- Restart: on-failure, max 3 attempts, 5s delay

**Environment Variables**:

- NODE_ENV=production
- HTTP_PORT=9265
- GRPC_PORT=50051
- GRPC_HOST=0.0.0.0
- CACHE_TTL_SECONDS=300
- CACHE_CHECK_PERIOD_SECONDS=60
- CACHE_MAX_KEYS=10000
- LOG_LEVEL=info
- LOG_FORMAT=json

### 6. Scheduler Worker (background jobs)

**Image**: campaign:scheduler (custom built)
**Port**: 9266
**Build**: packages/scheduler/Dockerfile

**Key Dependencies**:

- @nestjs/bull (job queue)
- bull (Redis-based queue)
- node-cron / cron (scheduling)
- axios (HTTP client)
- opossum (circuit breaker)
- winston (logging)

**Health Check**:

```bash
wget --no-verbose --tries=1 --spider http://localhost:9266/health
```

**Startup**: 20s grace period

**Production Deployment**:

- 1 replica
- CPU limits: 0.5 (limit), 0.25 (reservation)
- Memory: 512MB (limit), 256MB (reservation)
- Restart: on-failure, max 3 attempts, 5s delay

**Environment Variables**:

- NODE_ENV=production
- PORT=9266
- LOG_LEVEL=info
- LOG_FORMAT=json
- REDIS_URL=redis://redis:6379
- API_URL=http://api:3000/graphql
- SCHEDULER_API_TOKEN=${SCHEDULER_API_TOKEN} (must set in production)
- CRON*EVENT_EXPIRATION=*/5 \_ \* \* \* (every 5 minutes)
- CRON_SETTLEMENT_GROWTH=0 \* \* \* \* (hourly)
- CRON_STRUCTURE_MAINTENANCE=0 \* \* \* \* (hourly)
- QUEUE_MAX_RETRIES=3
- QUEUE_RETRY_BACKOFF_MS=5000
- QUEUE_CONCURRENCY=5
- API_REQUEST_TIMEOUT_MS=10000
- API_CIRCUIT_BREAKER_THRESHOLD=5
- API_CIRCUIT_BREAKER_DURATION_MS=30000

### 7. Frontend (React + Nginx)

**Image**: campaign:frontend (custom built)
**Port**: 8080 (mapped to 80 in container)
**Build**: packages/frontend/Dockerfile

**Key Dependencies**:

- React 18+
- Vite (build tool)
- Tailwind CSS
- Apollo Client (GraphQL)
- Zustand (state management)

**Health Check**:

```bash
wget --no-verbose --tries=1 --spider http://localhost/health
```

**Startup**: 20s grace period

**Nginx Configuration** (`/etc/nginx/conf.d/default.conf`):

- Gzip compression enabled (minlength 1024B)
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- Static asset caching (1 year, immutable)
- SPA routing (404 → index.html)
- API proxy endpoints:
  - `/api` → http://api:3000
  - `/graphql` → http://api:3000/graphql
- Health check endpoint at `/health`

**Production Deployment**:

- 2 replicas
- CPU limits: 0.5 (limit), 0.25 (reservation)
- Memory: 256MB (limit), 128MB (reservation)
- Restart: on-failure, max 3 attempts, 5s delay

**Environment Variables**:

- VITE_API_URL=http://localhost:3000 (client-side)
- VITE_GRAPHQL_URL=http://localhost:3000/graphql
- VITE_WS_URL=ws://localhost:3000/graphql

## Network Architecture

### Networks

1. **backend-network**: Connects postgres, redis, minio, api, rules-engine, scheduler
2. **frontend-network**: Connects api and frontend

### Service Dependencies

Development relies on health checks for service readiness:

- **api** depends on: postgres, redis, minio, rules-engine
- **rules-engine** depends on: postgres, redis
- **scheduler** depends on: postgres, redis, api
- **frontend** depends on: api

## Database Migrations

### Prisma Configuration

- **Provider**: PostgreSQL with postgisExtensions
- **Schema**: packages/api/prisma/schema.prisma
- **Location**: packages/api/prisma/migrations/

**Features**:

- CUID primary keys
- Bitemporal versioning (createdAt, updatedAt, deletedAt)
- Soft delete pattern
- Audit trail support
- PostGIS geometry support (SRID 3857)

### Migration Commands

```bash
# Development
pnpm --filter @campaign/api prisma migrate dev

# Production deployment
pnpm --filter @campaign/api prisma migrate deploy

# Generate client
pnpm --filter @campaign/api exec prisma generate

# Studio (UI viewer)
pnpm --filter @campaign/api prisma studio
```

### CI Migration Process

```bash
pnpm --filter @campaign/api exec prisma generate
pnpm --filter @campaign/api exec prisma migrate deploy
```

## Environment Configuration

### File Structure

- `.env.example`: Template with all possible variables
- `.env.local.example`: Local development defaults
- `.env.local`: Local overrides (git-ignored)

### Critical Variables for Production

1. **DATABASE_URL**: PostgreSQL connection string
2. **JWT_SECRET**: Authentication key (must be strong)
3. **SCHEDULER_API_TOKEN**: Service-to-service communication
4. **S3_ACCESS_KEY**, **S3_SECRET_KEY**: MinIO credentials
5. **MINIO_ROOT_USER**, **MINIO_ROOT_PASSWORD**: MinIO admin
6. **REDIS_URL**: Redis connection

### Build vs Runtime Configuration

- **Build**: NODE_ENV, language-level optimizations
- **Runtime**: Database URLs, API endpoints, feature flags, logging levels

## Docker Secrets (Swarm Mode)

Production docker-compose.prod.yml defines:

- `jwt_secret`: JWT signing key
- `db_password`: Database password
- `minio_root_password`: MinIO admin password

These are mounted as external secrets in Swarm mode.

## CI/CD Pipeline (.github/workflows/ci.yml)

### Stages

1. **Lint and Type Check**: ESLint, Prettier, TypeScript
2. **Backend Tests**: API, Rules Engine, Scheduler, Shared packages
3. **Frontend Tests**: Category-based execution (prevents OOM)
4. **Performance Tests**: Rules Engine benchmarks
5. **Build**: All packages

### Database Setup in CI

- Service: postgis/postgis:16-3.5
- Health check: pg_isready
- Schema: campaign_test

### Test Environment

- PostgreSQL on localhost:5432
- Redis on localhost:6379
- No containerized services (run in GitHub Actions host)

## Volume Management

### Persistent Volumes

1. **postgres-data**: PostgreSQL data directory
2. **redis-data**: Redis persistent store (AOF)
3. **minio-data**: MinIO object storage

### Development Mounts

- Source code mounted as read-only for hot reload
- node_modules preserved (not mounted) to avoid conflicts

## Port Mapping

### Development (via docker-compose.dev.yml)

- Frontend Vite: 5173
- API: 3000 + debug 9229
- Rules Engine: 9265 (HTTP), 50051 (gRPC) + debug 9230
- Scheduler: debug 9231
- PostgreSQL: 5432
- Redis: 6379
- MinIO: 9000 (API), 9001 (Console)

### Production

- Frontend: 8080 (maps to 80)
- API: 3000
- Rules Engine: 9265 (HTTP), 50051 (gRPC)
- Scheduler: 9266
- PostgreSQL: 5432 (internal only)
- Redis: 6379 (internal only)
- MinIO: 9000 (internal), 9001 (internal)

## Build Process

### Key Files

- **Root**: Monorepo configuration (pnpm-workspace.yaml, package.json)
- **tsconfig.base.json**: Shared TypeScript configuration
- **Dockerfiles**: One per service with multi-stage build
- **.dockerignore**: Excludes unnecessary files from build context

### Build Flow

1. Install dependencies (pnpm install --frozen-lockfile)
2. Build @campaign/shared (required by other packages)
3. Build service-specific packages
4. Production stage copies built artifacts

### Optimization

- Layer caching: Separate COPY commands for package.json vs source
- Minimal final image: Only production dependencies
- Size reduction: Alpine Linux base images

## Environment-Specific Overrides

### Development (docker-compose.dev.yml)

- Uses `target: builder` for hot reload
- Mounts source code (read-only)
- Debug ports exposed
- Pretty logging
- GraphQL Playground enabled
- Higher log verbosity

### Production (docker-compose.prod.yml)

- Uses `target: production` for optimized final stage
- Deploy strategies with resource limits
- JSON logging format
- No debug ports
- GraphQL introspection disabled
- Graceful restart policies

## Health Check Patterns

### HTTP Health Checks

- API: GET http://localhost:3000/health
- Rules Engine: GET http://localhost:9265/health/live
- Scheduler: GET http://localhost:9266/health
- Frontend: GET http://localhost/health (Nginx)

### Database Health Checks

- PostgreSQL: pg_isready command
- Redis: redis-cli ping

### Timing

- Interval: 30s (services), 10s (postgres, redis)
- Timeout: 3-5s
- Start period: 10-60s (depends on service)
- Max retries: 3-5

## Security Considerations

### Non-Root Users

All production containers run as non-root users to limit privilege escalation.

### Disabled Features

- GraphQL Playground (production)
- GraphQL Introspection (production)

### Secrets Management

- External Docker secrets for sensitive data
- Environment variables passed at runtime
- JWT tokens for service-to-service communication

### File Permissions

Production Dockerfile properly sets ownership:

```dockerfile
COPY --chown=user:group
chown -R user:group /path
```

## Restart Policies

### Development

- `restart: unless-stopped`: Survives container restart

### Production

- Replicas with restart_policy
- Condition: on-failure
- Max attempts: 3
- Delay: 5s
- Window: 120s
