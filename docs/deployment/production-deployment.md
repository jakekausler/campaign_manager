# Production Deployment Guide

This guide covers deploying the Campaign Management Tool to production environments using Docker and Docker Compose. It includes setup instructions, service orchestration, database migrations, monitoring, and troubleshooting.

> **⚠️ SECURITY WARNING**: All example passwords and secrets in this guide (`campaign_pass`, `minioadmin`, `your-secret-key-here`, etc.) are for **DEMONSTRATION ONLY**. **NEVER use these in production**. Always generate strong, unique secrets using:
>
> ```bash
> openssl rand -hex 32
> ```
>
> Rotate credentials quarterly and never commit `.env` files to version control.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Architecture](#architecture)
5. [Docker Setup](#docker-setup)
6. [Database Migrations](#database-migrations)
7. [Service Orchestration](#service-orchestration)
8. [Environment Configuration](#environment-configuration)
9. [Security Hardening](#security-hardening)
10. [Health Checks & Monitoring](#health-checks--monitoring)
11. [Scaling Strategy](#scaling-strategy)
12. [Troubleshooting](#troubleshooting)
13. [Disaster Recovery](#disaster-recovery)

---

## Overview

The Campaign Management Tool is a microservices-based application consisting of:

- **API Service** (NestJS GraphQL): Main application server
- **Rules Engine** (gRPC microservice): High-performance condition evaluation
- **Scheduler** (Background worker): Time-based operations and periodic jobs
- **Frontend** (React + Nginx): Static SPA served via Nginx
- **PostgreSQL with PostGIS**: Primary database with geospatial support
- **Redis**: Caching, pub/sub, WebSocket adapter, job queue
- **MinIO**: S3-compatible object storage

All services are containerized using Docker and orchestrated via Docker Compose with production-optimized configurations.

---

## Prerequisites

Before deploying to production, ensure you have:

### System Requirements

- **Docker**: Version 24.0+ (with BuildKit enabled)
- **Docker Compose**: Version 2.20+ (with Compose V2)
- **Operating System**: Linux (Ubuntu 22.04+ or equivalent recommended)
- **CPU**: Minimum 4 cores (8+ recommended for production load)
- **Memory**: Minimum 8GB RAM (16GB+ recommended)
- **Storage**: Minimum 50GB available (SSD recommended)

### Network Requirements

- Ports 80/443 available for frontend (or configure reverse proxy)
- Internal service ports: 3000 (API), 5432 (PostgreSQL), 6379 (Redis), 9000/9001 (MinIO)
- Outbound internet access for pulling Docker images (can be cached/mirrored)

### Access & Credentials

- Docker Hub access (or private registry)
- Strong, randomly-generated secrets for JWT, database password, S3 credentials
- SSL/TLS certificates (if terminating SSL at the application level)

### Knowledge Requirements

- Familiarity with Docker and containerization
- Basic understanding of PostgreSQL administration
- Experience with Linux system administration
- Knowledge of reverse proxy configuration (Nginx, Traefik, etc.)

---

## Quick Start

For experienced teams familiar with Docker Compose, here's the TL;DR:

```bash
# 1. Clone repository
git clone <repository-url>
cd campaign_manager

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env with production values (see Environment Configuration section)

# 3. Generate strong secrets
export JWT_SECRET=$(openssl rand -hex 32)
export DB_PASSWORD=$(openssl rand -hex 32)
export S3_SECRET_KEY=$(openssl rand -hex 32)

# 4. Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# 5. Start infrastructure services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis minio

# 6. Wait for database to be ready (check health)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

# 7. Run database migrations
docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api \
  pnpm --filter @campaign/api exec prisma migrate deploy

# 8. Start all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 9. Verify all services are healthy
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

**Next Steps:**

- Configure reverse proxy (see [Reverse Proxy Configuration](#reverse-proxy-configuration))
- Set up monitoring and alerting (see [Health Checks & Monitoring](#health-checks--monitoring))
- Review security hardening checklist (see [Security Hardening](#security-hardening))

---

## Architecture

### Service Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer / Reverse Proxy           │
│                        (Nginx, Traefik, HAProxy)                │
└────────────┬───────────────────────────────────┬────────────────┘
             │                                   │
             │                                   │
    ┌────────▼─────────┐              ┌─────────▼─────────┐
    │   Frontend (x2)  │              │    API (x2)       │
    │  React + Nginx   │              │  NestJS GraphQL   │
    │   Port: 8080     │              │   Port: 3000      │
    └──────────────────┘              └─────┬─────────┬───┘
                                            │         │
                                            │         │
                         ┌──────────────────┘         └──────────┐
                         │                                       │
              ┌──────────▼─────────┐              ┌─────────────▼──────────┐
              │  Rules Engine (x1) │              │   Scheduler (x1)       │
              │   gRPC + HTTP      │              │  Background Worker     │
              │   Port: 50051/9265 │              │   Port: 9266           │
              └──────┬──────────────┘              └────────┬───────────────┘
                     │                                      │
                     └──────────────┬───────────────────────┘
                                    │
                     ┌──────────────┴────────────────┐
                     │                               │
          ┌──────────▼──────────┐      ┌────────────▼─────────┐
          │  PostgreSQL + PostGIS│      │      Redis (x1)      │
          │     Port: 5432       │      │    Port: 6379        │
          └──────────────────────┘      └──────────────────────┘

                                        ┌──────────────────────┐
                                        │    MinIO (x1)        │
                                        │  Port: 9000/9001     │
                                        └──────────────────────┘
```

### Network Segmentation

**Backend Network** (`backend-network`):

- PostgreSQL, Redis, MinIO, API, Rules Engine, Scheduler
- Internal-only communication
- No external access

**Frontend Network** (`frontend-network`):

- Frontend, API
- Exposed to internet via reverse proxy
- API accessible to frontend

### Data Flow

1. **Client Request**: Browser → Load Balancer → Frontend (Nginx)
2. **API Request**: Frontend → API (GraphQL/REST)
3. **Condition Evaluation**: API → Rules Engine (gRPC)
4. **Background Jobs**: Scheduler → API (HTTP with circuit breaker)
5. **Real-time Updates**: API → Redis (pub/sub) → WebSocket clients
6. **Data Persistence**: All services → PostgreSQL
7. **Caching**: All services → Redis (cache, sessions, job queue)
8. **File Storage**: API → MinIO (S3 API)

---

## Docker Setup

### Multi-Stage Build Strategy

All services use multi-stage Docker builds for optimal image size and security:

```dockerfile
# Stage 1: Builder (development dependencies, TypeScript compilation)
FROM node:20-alpine AS builder
# ... install dependencies, build TypeScript

# Stage 2: Production (minimal runtime, only production dependencies)
FROM node:20-alpine AS production
# ... copy built artifacts, run as non-root user
```

**Visual Representation of Build Process**:

```mermaid
graph LR
    subgraph "Stage 1: Builder Image"
        Base1[node:20-alpine<br/>~180MB] --> InstallPnpm[Install pnpm globally]
        InstallPnpm --> CopyWorkspace[Copy workspace files<br/>pnpm-workspace.yaml<br/>package.json files]
        CopyWorkspace --> InstallDeps[pnpm install<br/>--frozen-lockfile<br/>All deps incl. devDeps]
        InstallDeps --> CopySource[Copy source code<br/>.ts files]
        CopySource --> BuildShared[Build @campaign/shared<br/>tsc compilation]
        BuildShared --> BuildService[Build target service<br/>tsc compilation]
        BuildService --> Artifacts[Compiled JS artifacts<br/>in dist/ folders]
    end

    subgraph "Stage 2: Production Image"
        Base2[node:20-alpine<br/>~180MB] --> ReinstallPnpm[Install pnpm]
        ReinstallPnpm --> CopyProdWorkspace[Copy workspace files]
        CopyProdWorkspace --> ProdDeps[pnpm install<br/>--prod --frozen-lockfile<br/>Production deps only]
        ProdDeps --> CopyBuiltFiles[Copy dist/ from builder<br/>Compiled JS only]
        CopyBuiltFiles --> NonRoot[Switch to user 1001<br/>Non-root security]
        NonRoot --> FinalImage[Production Image<br/>~350-400MB<br/>No TypeScript, no devDeps]
    end

    Artifacts -.->|COPY --from=builder| CopyBuiltFiles

    style Base1 fill:#e1f5ff
    style Base2 fill:#e1f5ff
    style Artifacts fill:#fff4e6
    style FinalImage fill:#e8f5e9
```

**Benefits:**

- **Smaller Images**: Production images exclude dev dependencies and build tools (saves ~500MB per service)
- **Security**: Production stage runs as non-root user (uid 1001)
- **Layer Caching**: Separate layers for package.json and source code optimize rebuild times
- **Reproducibility**: `--frozen-lockfile` ensures consistent builds

### Service-Specific Dockerfiles

#### API Service

**Location**: `packages/api/Dockerfile`

**Build Process**:

1. Install pnpm globally
2. Copy workspace configuration
3. Install dependencies with frozen lockfile
4. Build `@campaign/shared` (dependency)
5. Build `@campaign/api`
6. Production stage: Copy artifacts, set user 1001

**Key Configuration**:

```dockerfile
# Builder stage
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @campaign/shared build
RUN pnpm --filter @campaign/api build

# Production stage
USER 1001
CMD ["node", "packages/api/dist/main.js"]
```

**Image Size**: ~400MB (production)

#### Rules Engine Service

**Location**: `packages/rules-engine/Dockerfile`

**Build Process**:

1. Same multi-stage pattern as API
2. Build `@campaign/shared` first
3. Build `@campaign/rules-engine`
4. Production stage optimized for gRPC workload

**Key Configuration**:

```dockerfile
USER 1001
CMD ["node", "packages/rules-engine/dist/main.js"]
```

**Image Size**: ~350MB (production)

#### Scheduler Service

**Location**: `packages/scheduler/Dockerfile`

**Build Process**:

1. Same multi-stage pattern
2. Build `@campaign/shared` first
3. Build `@campaign/scheduler`
4. Production stage includes cron and HTTP health check

**Key Configuration**:

```dockerfile
USER 1001
CMD ["node", "packages/scheduler/dist/main.js"]
```

**Image Size**: ~350MB (production)

#### Frontend Service

**Location**: `packages/frontend/Dockerfile`

**Build Process**:

1. Builder stage: Install deps, build React app with Vite
2. Production stage: Use `nginx:1.25-alpine` (minimal)
3. Copy static build artifacts to Nginx html directory
4. Copy custom Nginx configuration

**Key Configuration**:

```dockerfile
# Builder
RUN pnpm --filter @campaign/frontend build

# Production
FROM nginx:1.25-alpine
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/nginx.conf
```

**Image Size**: ~30MB (production)

**Nginx Configuration Highlights**:

- Gzip compression (min 1024 bytes)
- SPA routing (404 → index.html)
- API/GraphQL proxy to backend
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- Static asset caching (1 year)

### Building Images

**Development Build**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build
```

**Production Build**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
```

**Build a Single Service**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build api
```

**Build with No Cache** (clean build):

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
```

**Parallel Builds** (faster):

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --parallel
```

### Image Registry

For production deployments, push images to a private registry:

```bash
# Tag images
docker tag campaign_manager-api:latest registry.example.com/campaign/api:1.0.0
docker tag campaign_manager-frontend:latest registry.example.com/campaign/frontend:1.0.0

# Push to registry
docker push registry.example.com/campaign/api:1.0.0
docker push registry.example.com/campaign/frontend:1.0.0

# Update docker-compose.prod.yml to reference registry images
# image: registry.example.com/campaign/api:1.0.0
```

**Recommended Registry Options**:

- **Docker Hub** (public or private repositories)
- **AWS ECR** (Elastic Container Registry)
- **Google GCR** (Google Container Registry)
- **Azure ACR** (Azure Container Registry)
- **Self-hosted**: Harbor, GitLab Container Registry

---

## Database Migrations

### Prisma Migration Strategy

The project uses Prisma for database schema management with a production-safe migration workflow.

#### Migration Commands

**Generate Prisma Client** (required after schema changes):

```bash
pnpm --filter @campaign/api exec prisma generate
```

**Production Deployment** (apply pending migrations):

```bash
pnpm --filter @campaign/api exec prisma migrate deploy
```

**Development** (interactive, creates migration files):

```bash
pnpm --filter @campaign/api exec prisma migrate dev --name <migration_name>
```

**Check Migration Status**:

```bash
pnpm --filter @campaign/api exec prisma migrate status
```

**Reset Database** (DESTRUCTIVE, development only):

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=I_CONSENT_TO_DATABASE_RESET \
  pnpm --filter @campaign/api exec prisma migrate reset
```

#### Migration Workflow in Production

**Step 1: Prepare Migration Locally**

```bash
# Make schema changes in packages/api/prisma/schema.prisma
# Generate migration file
pnpm --filter @campaign/api exec prisma migrate dev --name add_user_roles

# Commit migration file to version control
git add packages/api/prisma/migrations/
git commit -m "feat(db): add user roles migration"
```

**Step 2: Deploy Migration to Production**

```bash
# Pull latest code on production server
git pull origin main

# Run migration inside Docker container
docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api \
  pnpm --filter @campaign/api exec prisma migrate deploy

# Restart services to pick up schema changes
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart api
```

**Step 3: Verify Migration**

```bash
# Check migration status
docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api \
  pnpm --filter @campaign/api exec prisma migrate status

# Verify database schema
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U campaign_user -d campaign_db -c "\dt"
```

#### Migration Best Practices

**DO:**

- ✅ Test migrations in staging environment first
- ✅ Create backups before running migrations (see [Disaster Recovery](#disaster-recovery))
- ✅ Use `migrate deploy` in production (never `migrate dev`)
- ✅ Commit migration files to version control
- ✅ Review generated SQL before applying
- ✅ Use descriptive migration names
- ✅ Plan for zero-downtime migrations (additive changes first, breaking changes later)

**DON'T:**

- ❌ Run `migrate reset` in production (DESTRUCTIVE)
- ❌ Manually edit migration files after creation
- ❌ Skip migrations or apply them out of order
- ❌ Delete old migration files
- ❌ Run migrations directly on production database without testing
- ❌ Use `migrate dev` in production (creates migration files)

#### Zero-Downtime Migration Strategy

For breaking schema changes:

**Phase 1: Additive Changes**

1. Add new columns/tables (nullable or with defaults)
2. Deploy application code that writes to both old and new columns
3. Backfill data from old to new columns

**Phase 2: Transition** 4. Deploy application code that reads from new columns 5. Monitor and verify correctness

**Phase 3: Cleanup** 6. Deploy application code that no longer uses old columns 7. Remove old columns/tables in a new migration

**Example**: Renaming a column

```sql
-- Migration 1: Add new column
ALTER TABLE users ADD COLUMN email_address VARCHAR(255);

-- Application code updated to write to both columns
-- (deployed and running)

-- Migration 2: Backfill data
UPDATE users SET email_address = email WHERE email_address IS NULL;

-- Application code updated to read from new column
-- (deployed and running)

-- Migration 3: Remove old column (after monitoring period)
ALTER TABLE users DROP COLUMN email;
```

#### PostGIS Initialization

PostgreSQL container automatically initializes PostGIS extensions on first startup.

**Initialization Script**: `scripts/init-postgis.sql`

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**Extensions Enabled**:

- **postgis**: Geospatial data types and functions
- **postgis_topology**: Topology support
- **uuid-ossp**: UUID generation functions
- **pg_trgm**: Trigram text search (for fuzzy matching)

The script is automatically executed via Docker's `docker-entrypoint-initdb.d` mechanism on first container creation.

#### Seed Data

**Development Seed Data** (comprehensive demo):

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm api \
  pnpm --filter @campaign/api exec ts-node packages/api/src/database/seed.ts
```

**Production Seed Data** (minimal, if needed):

```bash
# Create a production-safe seed script (e.g., seed-production.ts)
# with only essential data (default roles, system users, etc.)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api \
  node packages/api/dist/database/seed-production.js
```

**⚠️ Warning**: Only run seed scripts on empty databases. Seeding an existing database may cause conflicts or duplicate data.

---

## Service Orchestration

### Docker Compose Configuration

The project uses a layered Docker Compose configuration:

- **`docker-compose.yml`**: Base configuration (services, networks, volumes)
- **`docker-compose.dev.yml`**: Development overrides (hot reload, debug ports, pretty logging)
- **`docker-compose.prod.yml`**: Production overrides (replicas, resource limits, security)

#### Service Dependency Graph

```
postgres ─┬─> api ──> frontend
          │
          ├─> rules-engine
          │
          └─> scheduler

redis ────┬─> api
          │
          ├─> rules-engine
          │
          └─> scheduler

minio ────┬─> api
          │
          └─> scheduler
```

**Startup Order** (enforced by `depends_on` with health checks):

1. Infrastructure: `postgres`, `redis`, `minio` (start in parallel)
2. Backend Services: `api`, `rules-engine`, `scheduler` (wait for infrastructure health checks)
3. Frontend: `frontend` (wait for API health check)

#### Health Checks

All services implement health checks to ensure proper startup sequencing.

**PostgreSQL**:

```yaml
healthcheck:
  test: ['CMD', 'pg_isready', '-U', '${POSTGRES_USER}', '-d', '${POSTGRES_DB}']
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s
```

**Redis**:

```yaml
healthcheck:
  test: ['CMD', 'redis-cli', 'ping']
  interval: 10s
  timeout: 3s
  retries: 5
  start_period: 10s
```

**MinIO**:

```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 20s
```

**API**:

```yaml
healthcheck:
  test:
    [
      'CMD',
      'node',
      '-e',
      "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))",
    ]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 60s
```

**Rules Engine**:

```yaml
healthcheck:
  test:
    ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:9265/health/live']
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 20s
```

**Scheduler**:

```yaml
healthcheck:
  test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:9266/health']
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 20s
```

**Frontend**:

```yaml
healthcheck:
  test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:80/health']
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 10s
```

#### Service Replicas and Resource Limits

**Production Configuration** (`docker-compose.prod.yml`):

| Service      | Replicas | CPU Limit | Memory Limit | Restart Policy |
| ------------ | -------- | --------- | ------------ | -------------- |
| API          | 2        | 1.0       | 1024MB       | on-failure:3   |
| Frontend     | 2        | 0.5       | 256MB        | on-failure:3   |
| Rules Engine | 1        | 0.5       | 512MB        | on-failure:3   |
| Scheduler    | 1        | 0.5       | 512MB        | on-failure:3   |
| PostgreSQL   | 1        | 2.0       | 2048MB       | always         |
| Redis        | 1        | 0.5       | 512MB        | always         |
| MinIO        | 1        | 0.5       | 512MB        | always         |

**Notes**:

- **API replicas**: Load balanced for high availability
- **Frontend replicas**: Serve static assets, minimal resources
- **Scheduler singleton**: Single instance to prevent duplicate cron jobs
- **Rules Engine singleton**: Can scale horizontally if needed (stateless)
- **Infrastructure services**: Always restart to ensure availability

#### Starting Services

**Start All Services** (production):

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Start Specific Services**:

```bash
# Start infrastructure only
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis minio

# Start backend services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d api rules-engine scheduler

# Start frontend
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend
```

**View Logs**:

```bash
# All services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 api
```

**Check Service Status**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

**Stop Services**:

```bash
# Stop all
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Stop but keep volumes
docker-compose -f docker-compose.yml -f docker-compose.prod.yml stop

# Stop specific service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml stop api
```

**Restart Services**:

```bash
# Restart all
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart api
```

#### Scaling Services

**Scale API Replicas**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=4
```

**Scale Frontend Replicas**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale frontend=4
```

**⚠️ Important**:

- Only scale **stateless** services (API, Frontend, Rules Engine)
- Do **NOT** scale Scheduler (singleton required for cron jobs)
- Do **NOT** scale databases without proper clustering setup
- Update reverse proxy configuration when scaling

---

## Environment Configuration

### Environment Variables

The project requires specific environment variables for production deployment.

**Template Files**:

- `.env.example`: Complete reference with all variables and descriptions
- `.env.local.example`: Development defaults

#### Required Variables

**Database Configuration**:

```bash
DATABASE_URL="postgresql://campaign_user:CHANGE_ME@postgres:5432/campaign_db?schema=public"
POSTGRES_USER="campaign_user"
POSTGRES_PASSWORD="CHANGE_ME"  # Generate with: openssl rand -hex 32
POSTGRES_DB="campaign_db"
```

**JWT Authentication**:

```bash
JWT_SECRET="CHANGE_ME"  # Generate with: openssl rand -hex 32
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="CHANGE_ME"  # Generate with: openssl rand -hex 32
JWT_REFRESH_EXPIRES_IN="7d"
```

**Redis Configuration**:

```bash
REDIS_HOST="redis"
REDIS_PORT="6379"
REDIS_DB="1"  # DB 1 for caching (DB 0 reserved for Bull jobs)
REDIS_TTL="300"  # 5 minutes default cache TTL
```

**MinIO (S3-compatible storage)**:

```bash
S3_ENDPOINT="http://minio:9000"
S3_BUCKET="campaign-assets"
S3_REGION="us-east-1"
S3_ACCESS_KEY="minioadmin"  # CHANGE IN PRODUCTION
S3_SECRET_KEY="minioadmin"  # CHANGE IN PRODUCTION, use: openssl rand -hex 32
S3_FORCE_PATH_STYLE="true"  # Required for MinIO
```

**Service-to-Service Authentication**:

```bash
SCHEDULER_API_TOKEN="CHANGE_ME"  # Generate with: openssl rand -hex 32
```

**Application Configuration**:

```bash
NODE_ENV="production"
LOG_LEVEL="info"  # error, warn, info, debug
LOG_FORMAT="json"  # json or pretty
PORT="3000"  # API port
FRONTEND_PORT="8080"  # Frontend port
```

**gRPC Configuration** (API → Rules Engine):

```bash
GRPC_RULES_ENGINE_HOST="rules-engine"
GRPC_RULES_ENGINE_PORT="50051"
GRPC_TIMEOUT_MS="5000"
```

**GraphQL Configuration**:

```bash
GRAPHQL_PLAYGROUND="false"  # Disable in production
GRAPHQL_INTROSPECTION="false"  # Disable in production
GRAPHQL_DEBUG="false"  # Disable in production
```

**CORS Configuration**:

```bash
CORS_ORIGIN="https://yourdomain.com"  # Comma-separated if multiple
CORS_CREDENTIALS="true"
```

**Scheduler Configuration**:

```bash
SCHEDULER_EVENT_EXPIRATION_CRON="*/5 * * * *"  # Every 5 minutes
SCHEDULER_SETTLEMENT_GROWTH_CRON="0 * * * *"  # Hourly
SCHEDULER_STRUCTURE_MAINTENANCE_CRON="0 * * * *"  # Hourly
SCHEDULER_CIRCUIT_BREAKER_TIMEOUT="5000"
SCHEDULER_CIRCUIT_BREAKER_THRESHOLD="5"
SCHEDULER_CIRCUIT_BREAKER_RESET="30000"
```

#### Optional Variables

**PostgreSQL Tuning** (for performance):

```bash
POSTGRES_MAX_CONNECTIONS="200"
POSTGRES_SHARED_BUFFERS="512MB"
POSTGRES_EFFECTIVE_CACHE_SIZE="1536MB"
POSTGRES_MIN_WAL_SIZE="1GB"
POSTGRES_MAX_WAL_SIZE="4GB"
```

**Redis Tuning**:

```bash
REDIS_MAXMEMORY="512mb"
REDIS_MAXMEMORY_POLICY="allkeys-lru"
```

**Rules Engine Cache**:

```bash
RULES_ENGINE_CACHE_TTL="300"  # 5 minutes
RULES_ENGINE_CACHE_CHECK_PERIOD="60"  # 1 minute
RULES_ENGINE_CACHE_MAX_KEYS="10000"
```

#### Generating Secrets

**Strong Random Secrets**:

```bash
# JWT Secret (64 hex characters)
openssl rand -hex 32

# Database Password (64 hex characters)
openssl rand -hex 32

# S3 Secret Key (64 hex characters)
openssl rand -hex 32

# Scheduler API Token (64 hex characters)
openssl rand -hex 32
```

**UUID-based Secrets**:

```bash
# Alternative: UUID v4
uuidgen
```

#### Docker Secrets (Swarm Mode)

For Docker Swarm deployments, use Docker secrets instead of environment variables:

**Create Secrets**:

```bash
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "your-db-password" | docker secret create db_password -
echo "your-s3-secret" | docker secret create minio_root_password -
```

**Reference in Compose File** (`docker-compose.prod.yml`):

```yaml
services:
  api:
    secrets:
      - jwt_secret
      - db_password
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

secrets:
  jwt_secret:
    external: true
  db_password:
    external: true
  minio_root_password:
    external: true
```

**Application Code** (read secret from file):

```typescript
const jwtSecret = process.env.JWT_SECRET_FILE
  ? fs.readFileSync(process.env.JWT_SECRET_FILE, 'utf8').trim()
  : process.env.JWT_SECRET;
```

---

## Security Hardening

### Container Security

**1. Non-Root User Execution**

All production containers run as non-root user (uid 1001):

```dockerfile
# Production stage in Dockerfile
USER 1001
```

**Benefits**:

- Limits privilege escalation attacks
- Follows principle of least privilege
- Required by many enterprise security policies

**2. Read-Only Filesystems** (optional enhancement)

For maximum security, run containers with read-only filesystems:

```yaml
services:
  api:
    read_only: true
    tmpfs:
      - /tmp
      - /app/logs
```

**3. Resource Limits**

Enforce CPU and memory limits to prevent resource exhaustion:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1024M
        reservations:
          cpus: '0.5'
          memory: 512M
```

**4. Network Segmentation**

Use separate Docker networks for backend and frontend:

```yaml
networks:
  backend-network:
    driver: bridge
    internal: true # No external access
  frontend-network:
    driver: bridge
```

### Application Security

**1. Disable Debug Features in Production**

Ensure these environment variables are set:

```bash
GRAPHQL_PLAYGROUND="false"
GRAPHQL_INTROSPECTION="false"
GRAPHQL_DEBUG="false"
NODE_ENV="production"
LOG_LEVEL="info"  # Not "debug"
```

**2. Strong Authentication**

- Use strong JWT secrets (64+ hex characters)
- Set short access token expiration (15 minutes)
- Use refresh tokens with longer expiration (7 days)
- Implement token rotation

**3. CORS Configuration**

Restrict CORS to specific origins:

```bash
# Single origin
CORS_ORIGIN="https://yourdomain.com"

# Multiple origins (comma-separated)
CORS_ORIGIN="https://yourdomain.com,https://app.yourdomain.com"
```

**Never use `*` in production.**

**4. Rate Limiting** (via reverse proxy)

Implement rate limiting at the reverse proxy level:

```nginx
# Nginx example
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /graphql {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://api:3000/graphql;
}
```

**5. SQL Injection Prevention**

Prisma ORM provides automatic SQL injection prevention. Always use Prisma queries, never raw SQL unless absolutely necessary.

**Safe** (parameterized):

```typescript
await prisma.user.findUnique({ where: { email } });
```

**Unsafe** (avoid):

```typescript
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`);
```

If raw SQL is required, use `$queryRaw` with template literals (parameterized):

```typescript
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;
```

### Database Security

**1. Strong Database Password**

Generate and use strong passwords:

```bash
POSTGRES_PASSWORD=$(openssl rand -hex 32)
```

**2. Network Isolation**

PostgreSQL should only be accessible from backend network:

```yaml
postgres:
  networks:
    - backend-network # Not frontend-network
  # No ports exposed to host
```

**3. Encrypted Connections** (optional)

For production, enable SSL/TLS for database connections:

```bash
DATABASE_URL="postgresql://user:pass@postgres:5432/db?sslmode=require"
```

Configure PostgreSQL to require SSL:

```conf
# postgresql.conf
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

**4. Regular Backups**

Implement automated backups (see [Disaster Recovery](#disaster-recovery)).

### Secrets Management

**Options**:

**1. Environment Variables** (simplest)

- Use `.env` file (never commit to version control)
- Add `.env` to `.gitignore`
- Inject via Docker Compose

**2. Docker Secrets** (Swarm mode)

- Store secrets in Docker Swarm
- Mount as files in `/run/secrets/`
- More secure than environment variables

**3. External Secret Managers** (enterprise)

- **HashiCorp Vault**: Industry-standard secret management
- **AWS Secrets Manager**: For AWS deployments
- **Azure Key Vault**: For Azure deployments
- **Google Secret Manager**: For GCP deployments

**Example**: HashiCorp Vault integration

```typescript
import * as vault from 'node-vault';

const vaultClient = vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
});

const secrets = await vaultClient.read('secret/data/campaign-manager');
const jwtSecret = secrets.data.data.jwt_secret;
```

### SSL/TLS Configuration

**Option 1: Reverse Proxy Termination** (recommended)

Terminate SSL at the reverse proxy (Nginx, Traefik, HAProxy):

```nginx
# Nginx SSL configuration
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://frontend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Option 2: Application-Level SSL** (not recommended for this stack)

For maximum security, enable SSL at the application level, but this adds complexity.

### Security Checklist

Before deploying to production, verify:

- [ ] All secrets are strong, randomly-generated (64+ hex characters)
- [ ] `.env` file is excluded from version control (`.gitignore`)
- [ ] GraphQL Playground is disabled (`GRAPHQL_PLAYGROUND=false`)
- [ ] GraphQL introspection is disabled (`GRAPHQL_INTROSPECTION=false`)
- [ ] Debug logging is disabled (`LOG_LEVEL=info`, `NODE_ENV=production`)
- [ ] CORS is restricted to specific origins (not `*`)
- [ ] Containers run as non-root user (uid 1001)
- [ ] Database is network-isolated (backend network only)
- [ ] SSL/TLS is enabled (reverse proxy or application)
- [ ] Rate limiting is configured (reverse proxy)
- [ ] Resource limits are enforced (CPU, memory)
- [ ] Health checks are configured for all services
- [ ] Backups are automated and tested
- [ ] Security headers are enabled (Nginx: X-Frame-Options, CSP, etc.)
- [ ] Default credentials are changed (MinIO: minioadmin/minioadmin)
- [ ] Firewall rules are configured (only necessary ports exposed)
- [ ] Monitoring and alerting are configured
- [ ] Logs are centralized and monitored
- [ ] Dependency vulnerabilities are scanned (`pnpm audit`)

---

## Health Checks & Monitoring

### Built-in Health Endpoints

All services expose HTTP health check endpoints:

| Service      | Endpoint                   | Port |
| ------------ | -------------------------- | ---- |
| API          | `GET /health`              | 3000 |
| Rules Engine | `GET /health/live`         | 9265 |
| Scheduler    | `GET /health`              | 9266 |
| Frontend     | `GET /health` (Nginx stub) | 80   |

**Example Health Check**:

```bash
curl http://localhost:3000/health
```

**Response** (healthy):

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "rulesEngine": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "rulesEngine": { "status": "up" }
  }
}
```

**Response** (unhealthy):

```json
{
  "status": "error",
  "info": {
    "database": { "status": "up" }
  },
  "error": {
    "redis": {
      "status": "down",
      "message": "Connection timeout"
    }
  },
  "details": {
    "database": { "status": "up" },
    "redis": {
      "status": "down",
      "message": "Connection timeout"
    }
  }
}
```

### Docker Compose Health Checks

Health checks are configured in `docker-compose.yml` and verify service readiness.

**Check Status**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

**Output**:

```
NAME                     STATUS              PORTS
campaign_manager-api-1   Up (healthy)        0.0.0.0:3000->3000/tcp
campaign_manager-postgres-1  Up (healthy)    0.0.0.0:5432->5432/tcp
campaign_manager-redis-1     Up (healthy)    0.0.0.0:6379->6379/tcp
```

### Logging Strategy

**Log Formats**:

- **Development**: Pretty-printed, colorized logs
- **Production**: JSON-structured logs for log aggregation

**Production Logging Configuration**:

```bash
LOG_FORMAT="json"
LOG_LEVEL="info"
```

**Example JSON Log**:

```json
{
  "timestamp": "2025-01-15T10:30:00.123Z",
  "level": "info",
  "message": "User login successful",
  "userId": "cm4abc123",
  "ip": "192.168.1.100",
  "service": "api"
}
```

**Viewing Logs**:

```bash
# All services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 api

# Filter by keyword (using grep)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs api | grep ERROR
```

### Log Aggregation

For production, centralize logs using a log aggregation service:

**Options**:

1. **ELK Stack** (Elasticsearch, Logstash, Kibana)
2. **Grafana Loki** (lightweight, designed for Kubernetes)
3. **Datadog** (commercial, comprehensive monitoring)
4. **Splunk** (enterprise-grade log management)
5. **CloudWatch Logs** (AWS)
6. **Azure Monitor** (Azure)
7. **Google Cloud Logging** (GCP)

**Example**: Sending logs to Elasticsearch

```yaml
# docker-compose.prod.yml
services:
  api:
    logging:
      driver: gelf
      options:
        gelf-address: 'udp://logstash:12201'
        tag: 'campaign-api'
```

### Application Metrics

**Recommended Metrics to Track**:

- **Request Metrics**: Request rate, response time, error rate
- **GraphQL Metrics**: Query execution time, resolver performance
- **gRPC Metrics**: RPC call duration, success/failure rates
- **Database Metrics**: Connection pool usage, query performance, slow queries
- **Cache Metrics**: Hit rate, miss rate, eviction rate
- **Job Queue Metrics**: Job throughput, wait time, failure rate
- **Resource Metrics**: CPU usage, memory usage, disk I/O

**Instrumentation Options**:

1. **Prometheus + Grafana**: Industry-standard metrics stack
   - Add `prom-client` to services
   - Expose `/metrics` endpoint
   - Scrape with Prometheus
   - Visualize in Grafana

2. **Datadog APM**: Commercial application performance monitoring

3. **New Relic**: Commercial observability platform

**Example**: Prometheus metrics endpoint

```typescript
// packages/api/src/metrics/metrics.service.ts
import { register, Counter, Histogram } from 'prom-client';

export class MetricsService {
  private requestCounter = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
  });

  private requestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route'],
  });

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
```

```typescript
// packages/api/src/app.controller.ts
@Get('/metrics')
async metrics() {
  return this.metricsService.getMetrics();
}
```

### Alerting

Set up alerts for critical conditions:

**Alert Conditions**:

- Service health check failures (3+ consecutive)
- High error rate (>5% of requests)
- High response time (p95 > 2 seconds)
- Database connection pool exhausted
- Redis memory usage > 90%
- Disk space < 10% free
- CPU usage > 80% for 5+ minutes
- Memory usage > 90%

**Alerting Tools**:

1. **Prometheus Alertmanager**: Rule-based alerting for Prometheus metrics
2. **Grafana Alerts**: Integrated with Grafana dashboards
3. **Datadog Monitors**: Commercial alerting with integrations
4. **PagerDuty**: Incident management and on-call rotation
5. **Opsgenie**: Incident management platform

**Example**: Prometheus alert rule

```yaml
# prometheus-alerts.yml
groups:
  - name: campaign_manager
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is {{ $value }} (>5%) for {{ $labels.service }}'

      - alert: ServiceDown
        expr: up{job="campaign-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Service is down'
          description: '{{ $labels.job }} has been down for more than 1 minute'
```

### Monitoring Dashboard

**Recommended Dashboards**:

1. **System Overview**:
   - Service health status
   - Request rate (all services)
   - Error rate (all services)
   - Response time (p50, p95, p99)

2. **API Performance**:
   - GraphQL query performance
   - Resolver execution time
   - Database query time
   - Cache hit rate

3. **Infrastructure**:
   - CPU, memory, disk usage (all services)
   - PostgreSQL connection pool
   - Redis memory usage
   - Network I/O

4. **Business Metrics**:
   - Active users
   - Active campaigns
   - Event resolutions per hour
   - Encounter completions per hour

**Grafana Dashboard Example**:

Import pre-built dashboards:

- Node.js application metrics: Dashboard ID 11159
- PostgreSQL metrics: Dashboard ID 9628
- Redis metrics: Dashboard ID 11835
- Nginx metrics: Dashboard ID 12708

---

## Scaling Strategy

### Horizontal Scaling

**Stateless Services** (can scale horizontally):

- **API**: Scale to multiple replicas behind load balancer
- **Frontend**: Scale to multiple replicas (Nginx static serving)
- **Rules Engine**: Scale to multiple replicas (stateless gRPC)

**Stateful Services** (require special consideration):

- **Scheduler**: MUST remain singleton (single replica) to prevent duplicate cron jobs
- **PostgreSQL**: Requires replication/clustering (see [Database Scaling](#database-scaling))
- **Redis**: Requires clustering or sentinel (see [Redis Scaling](#redis-scaling))

#### Scaling API Service

**Scale up**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=4
```

**Load Balancing** (via reverse proxy):

```nginx
# Nginx upstream configuration
upstream campaign_api {
    least_conn;  # Load balancing algorithm
    server api-1:3000 max_fails=3 fail_timeout=30s;
    server api-2:3000 max_fails=3 fail_timeout=30s;
    server api-3:3000 max_fails=3 fail_timeout=30s;
    server api-4:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    location /graphql {
        proxy_pass http://campaign_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Session Affinity** (if needed):

WebSocket connections require session affinity (sticky sessions):

```nginx
upstream campaign_api {
    ip_hash;  # Route same client IP to same backend
    server api-1:3000;
    server api-2:3000;
}
```

Or use Redis for session storage (already configured via Socket.IO Redis adapter).

#### Scaling Frontend Service

**Scale up**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale frontend=4
```

**Load Balancing** (Nginx serves static files, minimal CPU/memory):

```nginx
upstream campaign_frontend {
    server frontend-1:80;
    server frontend-2:80;
    server frontend-3:80;
    server frontend-4:80;
}

server {
    listen 80;
    location / {
        proxy_pass http://campaign_frontend;
        proxy_cache static_cache;  # Optional: cache static assets
    }
}
```

#### Scaling Rules Engine

**Scale up**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale rules-engine=2
```

**gRPC Load Balancing** (API client-side):

Use round-robin DNS or gRPC client-side load balancing:

```typescript
// packages/api/src/rules-engine/grpc-client.config.ts
const channelOptions = {
  'grpc.lb_policy_name': 'round_robin',
  'grpc.service_config': JSON.stringify({
    loadBalancingConfig: [{ round_robin: {} }],
  }),
};

const client = new RulesEngineServiceClient(
  'dns:///rules-engine:50051', // DNS with multiple A records
  credentials.createInsecure(),
  channelOptions
);
```

Or use a gRPC load balancer (Envoy, Linkerd).

### Vertical Scaling

**Increase Resources per Container**:

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0' # Increased from 1.0
          memory: 2048M # Increased from 1024M
```

**When to Vertical Scale**:

- Single-threaded bottlenecks (Node.js event loop)
- Memory-intensive operations (large GraphQL queries)
- CPU-intensive computations (complex JSONLogic conditions)

**Limitations**:

- Node.js single-threaded (limited CPU scaling)
- Maximum instance size (cloud provider limits)
- More expensive than horizontal scaling

### Database Scaling

**Read Replicas** (for read-heavy workloads):

```yaml
services:
  postgres-primary:
    image: postgis/postgis:16-3.4-alpine
    environment:
      POSTGRES_MAX_CONNECTIONS: 300
      POSTGRES_SHARED_BUFFERS: 1GB

  postgres-replica-1:
    image: postgis/postgis:16-3.4-alpine
    environment:
      POSTGRES_PRIMARY_HOST: postgres-primary
      POSTGRES_REPLICATION_MODE: slave
```

**Application Configuration** (use read replicas for queries):

```typescript
// packages/api/src/database/prisma.service.ts
const primaryClient = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

const replicaClient = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_REPLICA_URL },
  },
});

// Use replica for read-only queries
const users = await replicaClient.user.findMany();

// Use primary for writes
await primaryClient.user.create({ data: { email } });
```

**Pooling** (PgBouncer):

Use connection pooling to support more concurrent clients:

```yaml
services:
  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_DBNAME: campaign_db
      PGBOUNCER_POOL_MODE: transaction
      PGBOUNCER_MAX_CLIENT_CONN: 1000
      PGBOUNCER_DEFAULT_POOL_SIZE: 25
```

**Partitioning** (for very large tables):

Partition tables by campaign or date range:

```sql
-- Partition AuditLog by date
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    -- other columns
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2025_01 PARTITION OF audit_log
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit_log_2025_02 PARTITION OF audit_log
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

### Redis Scaling

**Redis Cluster** (for high availability):

```yaml
services:
  redis-1:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf

  redis-2:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf

  redis-3:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf
```

**Redis Sentinel** (for automatic failover):

```yaml
services:
  redis-primary:
    image: redis:7-alpine

  redis-replica-1:
    image: redis:7-alpine
    command: redis-server --replicaof redis-primary 6379

  redis-sentinel-1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

**Application Configuration** (use cluster):

```typescript
// packages/api/src/cache/redis.config.ts
import { Cluster } from 'ioredis';

const cluster = new Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 },
]);
```

### Auto-Scaling (Kubernetes)

For Kubernetes deployments, use Horizontal Pod Autoscaler (HPA):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: campaign-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: campaign-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

## Troubleshooting

### Common Issues

#### Issue: Service Won't Start

**Symptoms**:

```
ERROR: Service 'api' failed to start: container exited with code 1
```

**Diagnosis**:

```bash
# Check logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs api

# Check environment variables
docker-compose -f docker-compose.yml -f docker-compose.prod.yml config

# Verify .env file exists and is valid
cat .env
```

**Solutions**:

1. **Missing environment variables**: Ensure `.env` file exists and contains all required variables
2. **Invalid DATABASE_URL**: Verify PostgreSQL connection string format
3. **Port conflicts**: Check if ports are already in use (`lsof -i :3000`)
4. **Permission issues**: Ensure user 1001 has write access to volumes

#### Issue: Database Connection Fails

**Symptoms**:

```
PrismaClientInitializationError: Can't reach database server at `postgres:5432`
```

**Diagnosis**:

```bash
# Check PostgreSQL health
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps postgres

# Test connection from API container
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec api \
  nc -zv postgres 5432

# Check PostgreSQL logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs postgres
```

**Solutions**:

1. **PostgreSQL not ready**: Wait for health check to pass (check `docker-compose ps`)
2. **Wrong credentials**: Verify `POSTGRES_USER` and `POSTGRES_PASSWORD` match in `.env`
3. **Network isolation**: Ensure API and PostgreSQL are on same Docker network (`backend-network`)
4. **PostgreSQL crashed**: Check logs for errors, restart service

#### Issue: Redis Connection Timeout

**Symptoms**:

```
Error: Redis connection timeout after 5000ms
```

**Diagnosis**:

```bash
# Check Redis health
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps redis

# Test connection
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec redis \
  redis-cli ping

# Check Redis logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs redis
```

**Solutions**:

1. **Redis not ready**: Wait for health check to pass
2. **Memory limit exceeded**: Check Redis memory usage (`redis-cli info memory`)
3. **Wrong Redis DB**: Verify `REDIS_DB` is set correctly (default: 1)
4. **Network issues**: Ensure services are on `backend-network`

#### Issue: Migration Fails

**Symptoms**:

```
Error: Migration failed to apply cleanly
```

**Diagnosis**:

```bash
# Check migration status
docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api \
  pnpm --filter @campaign/api exec prisma migrate status

# Check database schema
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U campaign_user -d campaign_db -c "\dt"
```

**Solutions**:

1. **Migration already applied**: Check `_prisma_migrations` table for duplicate entries
2. **Schema drift**: Manually fix schema to match expected state, mark migration as applied
3. **Concurrent migrations**: Ensure only one migration runs at a time (use locking)
4. **Invalid migration SQL**: Review migration file, fix syntax errors

#### Issue: Health Check Failing

**Symptoms**:

```
api-1  Up (unhealthy)  Health check failed
```

**Diagnosis**:

```bash
# Check health endpoint manually
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec api \
  wget -qO- http://localhost:3000/health

# Check detailed logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50 api
```

**Solutions**:

1. **Startup delay**: Increase `start_period` in health check config
2. **Dependency not ready**: Check PostgreSQL, Redis, Rules Engine health
3. **Application error**: Review logs for startup errors
4. **Incorrect health check command**: Verify health check command in `docker-compose.yml`

#### Issue: High Memory Usage

**Symptoms**:

```
Error: Process killed due to OOM (Out of Memory)
```

**Diagnosis**:

```bash
# Check container memory usage
docker stats

# Check specific service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec api \
  top

# Check Node.js heap usage
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs api | grep "heap"
```

**Solutions**:

1. **Increase memory limit**: Update `deploy.resources.limits.memory` in `docker-compose.prod.yml`
2. **Memory leak**: Use heap profiling to identify leaks (e.g., `--inspect`, `heapdump`)
3. **Large cache**: Reduce Redis cache size or TTL
4. **Too many connections**: Reduce database connection pool size

#### Issue: Slow GraphQL Queries

**Symptoms**:

```
Query execution took 5000ms (expected <500ms)
```

**Diagnosis**:

```bash
# Enable GraphQL query logging
# Set LOG_LEVEL=debug in .env

# Check database query performance
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U campaign_user -d campaign_db -c "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"

# Check Prisma query logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs api | grep "prisma:query"
```

**Solutions**:

1. **Missing indexes**: Add indexes to frequently queried columns
2. **N+1 queries**: Use Prisma's `include` to eagerly load relations
3. **Large result sets**: Implement pagination and limit query size
4. **Inefficient resolvers**: Optimize resolver logic, use DataLoader for batching
5. **Cold cache**: Warm up cache with common queries

#### Issue: gRPC Connection Failed

**Symptoms**:

```
Error: 14 UNAVAILABLE: failed to connect to rules-engine:50051
```

**Diagnosis**:

```bash
# Check Rules Engine health
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps rules-engine

# Test gRPC port
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec api \
  nc -zv rules-engine 50051

# Check Rules Engine logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs rules-engine
```

**Solutions**:

1. **Rules Engine not started**: Start service and wait for health check
2. **Network issue**: Verify both services are on `backend-network`
3. **Timeout too short**: Increase `GRPC_TIMEOUT_MS` (default: 5000)
4. **gRPC port not exposed**: Check Dockerfile `EXPOSE 50051`

#### Issue: Scheduler Jobs Not Running

**Symptoms**:

```
Expected cron job to run every 5 minutes, but no execution detected
```

**Diagnosis**:

```bash
# Check Scheduler logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs scheduler | grep cron

# Check Scheduler health
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps scheduler

# Verify cron configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec scheduler \
  env | grep CRON
```

**Solutions**:

1. **Scheduler not running**: Check container status, restart if exited
2. **Multiple instances**: Ensure only ONE scheduler replica (singleton)
3. **Invalid cron expression**: Validate cron syntax (use crontab.guru)
4. **API token missing**: Verify `SCHEDULER_API_TOKEN` is set and matches API
5. **Circuit breaker open**: Check logs for repeated failures, reset circuit breaker

### Debugging Tools

**View Container Processes**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml top
```

**Inspect Container**:

```bash
docker inspect campaign_manager-api-1
```

**Execute Shell in Container**:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec api sh
```

**Copy Files from Container**:

```bash
docker cp campaign_manager-api-1:/app/logs/error.log ./local-error.log
```

**Network Debugging**:

```bash
# Install network tools in container
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec api \
  apk add --no-cache curl wget netcat-openbsd

# Test connectivity
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec api \
  nc -zv postgres 5432
```

**Database Debugging**:

```bash
# Connect to PostgreSQL
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U campaign_user -d campaign_db

# Show all tables
\dt

# Describe table schema
\d users

# Check active connections
SELECT * FROM pg_stat_activity;

# Check slow queries
SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

**Redis Debugging**:

```bash
# Connect to Redis CLI
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec redis \
  redis-cli

# Check memory usage
INFO memory

# List all keys (use with caution in production)
KEYS *

# Get cache hit/miss rate
INFO stats

# Monitor commands in real-time
MONITOR
```

---

## Disaster Recovery

### Backup Strategy

**What to Backup**:

1. **PostgreSQL Database**: All campaign data
2. **Redis Data** (optional): Cache can be rebuilt, but job queue may be important
3. **MinIO Storage**: Uploaded assets
4. **Environment Configuration**: `.env` file (encrypted)
5. **Docker Volumes**: Persistent data volumes

**Backup Frequency**:

- **PostgreSQL**: Daily full backups + continuous WAL archiving
- **MinIO**: Daily incremental backups
- **Configuration**: On every change

### PostgreSQL Backup

**Manual Backup** (pg_dump):

```bash
# Full database dump
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  pg_dump -U campaign_user -d campaign_db -F c -f /tmp/backup.dump

# Copy to host
docker cp campaign_manager-postgres-1:/tmp/backup.dump ./backup-$(date +%Y%m%d).dump
```

**Automated Backup** (with cron):

Create a backup script:

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backups/postgresql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/campaign_db_${TIMESTAMP}.dump"

# Create backup
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U campaign_user -d campaign_db -F c > "${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_FILE}"

# Upload to S3 (or other remote storage)
aws s3 cp "${BACKUP_FILE}.gz" "s3://your-backup-bucket/postgresql/"

# Delete backups older than 30 days
find "${BACKUP_DIR}" -name "*.dump.gz" -mtime +30 -delete
```

Add to crontab:

```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup-database.sh
```

**Continuous WAL Archiving** (for point-in-time recovery):

Configure PostgreSQL for WAL archiving:

```conf
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://your-backup-bucket/wal/%f'
max_wal_senders = 3
wal_keep_size = 1GB
```

### PostgreSQL Restore

**Restore from Dump**:

```bash
# Stop API services (to prevent connections)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml stop api rules-engine scheduler

# Drop and recreate database
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U campaign_user -c "DROP DATABASE IF EXISTS campaign_db;"
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres \
  psql -U campaign_user -c "CREATE DATABASE campaign_db;"

# Restore dump
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U campaign_user -d campaign_db -F c < backup-20250115.dump

# Restart services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml start api rules-engine scheduler
```

**Point-in-Time Recovery** (using WAL archives):

1. Restore base backup (full dump)
2. Replay WAL archives up to desired point in time
3. Configure `recovery.conf` with target time:

```conf
# recovery.conf
restore_command = 'aws s3 cp s3://your-backup-bucket/wal/%f %p'
recovery_target_time = '2025-01-15 14:30:00'
recovery_target_action = 'promote'
```

### MinIO Backup

**Manual Backup** (mc client):

```bash
# Install MinIO client
docker pull minio/mc

# Configure alias
docker run --rm -it --network campaign_manager_backend-network minio/mc \
  alias set campaign-minio http://minio:9000 minioadmin minioadmin

# Mirror bucket to local
docker run --rm -it --network campaign_manager_backend-network \
  -v /backups/minio:/backup minio/mc \
  mirror campaign-minio/campaign-assets /backup
```

**Automated Backup**:

```bash
#!/bin/bash
# backup-minio.sh

BACKUP_DIR="/backups/minio"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Sync bucket to local
docker run --rm --network campaign_manager_backend-network \
  -v "${BACKUP_DIR}:/backup" minio/mc \
  mirror campaign-minio/campaign-assets "/backup/${TIMESTAMP}"

# Upload to remote S3
aws s3 sync "${BACKUP_DIR}/${TIMESTAMP}" "s3://your-backup-bucket/minio/${TIMESTAMP}/"

# Delete backups older than 30 days
find "${BACKUP_DIR}" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;
```

### Redis Backup (Optional)

**Manual Backup** (RDB snapshot):

```bash
# Trigger background save
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec redis \
  redis-cli BGSAVE

# Copy RDB file
docker cp campaign_manager-redis-1:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

**Restore Redis**:

```bash
# Stop Redis
docker-compose -f docker-compose.yml -f docker-compose.prod.yml stop redis

# Copy RDB file to volume
docker cp redis-backup-20250115.rdb campaign_manager-redis-1:/data/dump.rdb

# Start Redis
docker-compose -f docker-compose.yml -f docker-compose.prod.yml start redis
```

### Docker Volume Backup

**Backup Volumes**:

```bash
# List volumes
docker volume ls

# Backup a volume
docker run --rm -v campaign_manager_postgres-data:/data -v /backups:/backup \
  alpine tar czf /backup/postgres-data-$(date +%Y%m%d).tar.gz /data
```

**Restore Volume**:

```bash
# Create new volume
docker volume create campaign_manager_postgres-data-restored

# Restore data
docker run --rm -v campaign_manager_postgres-data-restored:/data -v /backups:/backup \
  alpine tar xzf /backup/postgres-data-20250115.tar.gz -C /
```

### Backup Testing

**Regularly test backups** to ensure they can be restored:

```bash
#!/bin/bash
# test-restore.sh

# 1. Create test environment
docker-compose -f docker-compose.test.yml up -d

# 2. Restore latest backup
LATEST_BACKUP=$(ls -t /backups/postgresql/*.dump.gz | head -1)
gunzip -c "${LATEST_BACKUP}" | docker-compose -f docker-compose.test.yml exec -T postgres \
  pg_restore -U campaign_user -d campaign_db -F c

# 3. Run smoke tests
docker-compose -f docker-compose.test.yml run --rm api \
  pnpm --filter @campaign/api test:smoke

# 4. Cleanup
docker-compose -f docker-compose.test.yml down -v
```

Run monthly to verify backup integrity.

### Disaster Recovery Plan

**In Case of Data Loss**:

1. **Assess Damage**: Determine what data was lost (database, files, configuration)
2. **Stop Services**: Prevent further data corruption
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
   ```
3. **Restore from Backup**:
   - PostgreSQL: Restore latest dump or use point-in-time recovery
   - MinIO: Restore from S3 or local backup
   - Redis: Restore RDB snapshot (if applicable)
4. **Verify Data Integrity**:
   - Run database consistency checks
   - Verify critical data exists (users, campaigns, etc.)
5. **Restart Services**:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```
6. **Monitor**: Watch logs and metrics for anomalies
7. **Post-Mortem**: Document incident, root cause, prevention steps

**Recovery Time Objective (RTO)**: Aim for < 1 hour downtime

**Recovery Point Objective (RPO)**: Aim for < 24 hours data loss (daily backups)

---

## Reverse Proxy Configuration

For production, use a reverse proxy in front of the application.

### Nginx Reverse Proxy

**Configuration** (`/etc/nginx/sites-available/campaign-manager`):

```nginx
# Upstream backend servers
upstream campaign_api {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
}

upstream campaign_frontend {
    server 127.0.0.1:8080;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=graphql_limit:10m rate=20r/s;

    # GraphQL endpoint
    location /graphql {
        limit_req zone=graphql_limit burst=40 nodelay;
        proxy_pass http://campaign_api/graphql;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # WebSocket endpoint (Socket.IO)
    location /socket.io/ {
        proxy_pass http://campaign_api/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;  # 24 hours for long-lived WebSocket connections
    }

    # API endpoints (REST)
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://campaign_api/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }

    # Frontend (SPA)
    location / {
        proxy_pass http://campaign_frontend/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Cache static assets
        proxy_cache static_cache;
        proxy_cache_valid 200 1d;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        add_header X-Cache-Status $upstream_cache_status;
    }

    # Health check endpoint (bypass rate limiting)
    location /health {
        access_log off;
        proxy_pass http://campaign_api/health;
    }
}

# Cache configuration
proxy_cache_path /var/cache/nginx/static levels=1:2 keys_zone=static_cache:10m max_size=1g inactive=7d use_temp_path=off;
```

**Enable and Restart Nginx**:

```bash
sudo ln -s /etc/nginx/sites-available/campaign-manager /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

### Traefik Reverse Proxy

**Configuration** (`traefik.yml` + `docker-compose.yml` labels):

```yaml
# traefik.yml
entryPoints:
  web:
    address: ':80'
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ':443'

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@yourdomain.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

**Docker Compose Labels** (`docker-compose.prod.yml`):

```yaml
services:
  frontend:
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.frontend.rule=Host(`yourdomain.com`)'
      - 'traefik.http.routers.frontend.entrypoints=websecure'
      - 'traefik.http.routers.frontend.tls.certresolver=letsencrypt'

  api:
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.api.rule=Host(`yourdomain.com`) && PathPrefix(`/graphql`, `/api`, `/socket.io`)'
      - 'traefik.http.routers.api.entrypoints=websecure'
      - 'traefik.http.routers.api.tls.certresolver=letsencrypt'
      - 'traefik.http.middlewares.api-ratelimit.ratelimit.average=100'
      - 'traefik.http.middlewares.api-ratelimit.ratelimit.burst=50'
      - 'traefik.http.routers.api.middlewares=api-ratelimit'
```

---

## Conclusion

This guide covers the essential aspects of deploying the Campaign Management Tool to production. For additional assistance:

- **Architecture Documentation**: See `docs/architecture/system-overview.md`
- **Environment Variables**: See `docs/deployment/environment-variables.md`
- **Scaling Guide**: See `docs/deployment/scaling-guide.md`
- **Feature Documentation**: See `docs/features/`
- **Development Guide**: See `CLAUDE.md` and `docs/development/`

For issues not covered in this guide, refer to the troubleshooting section or consult the development team.
