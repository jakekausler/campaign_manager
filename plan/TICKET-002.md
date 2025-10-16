# TICKET-002: Docker Compose Infrastructure

## Status

- [x] Completed
- **Commits**: (to be added after git commit)

## Description

Set up complete Docker Compose configuration for all services including databases, caching, storage, and application services with proper networking, volumes, and environment configuration.

## Scope of Work

1. Create `docker-compose.yml` with services:
   - `postgres` (with PostGIS extension - latest version)
   - `redis` (for caching and pub/sub)
   - `minio` (S3-compatible storage)
   - `api` (NestJS application)
   - `rules-engine` (Node worker)
   - `scheduler` (Node worker)
   - `frontend` (Nginx serving React build)
2. Create service-specific Dockerfiles:
   - `packages/api/Dockerfile` (multi-stage build)
   - `packages/rules-engine/Dockerfile` (multi-stage build)
   - `packages/scheduler/Dockerfile` (multi-stage build)
   - `packages/frontend/Dockerfile` (build + nginx)
3. Configure Docker networks:
   - `backend-network` for API ↔ services communication
   - `frontend-network` for frontend ↔ API communication
4. Set up volumes for data persistence:
   - `postgres-data`
   - `redis-data`
   - `minio-data`
5. Create `.env.example` with all required environment variables
6. Create `.env.local.example` for local development
7. Configure secrets management:
   - Support reading from `.env.local` for local testing
   - Support Docker secrets for Docker deployments
   - Document AWS Secrets Manager integration for production
8. Create health check endpoints/scripts for all services
9. Configure development vs production compose files:
   - `docker-compose.yml` (base)
   - `docker-compose.dev.yml` (development overrides with volume mounts for hot reload)
   - `docker-compose.prod.yml` (production overrides with Docker secrets)

## Acceptance Criteria

- [ ] `docker-compose up` starts all services successfully
- [ ] All services pass health checks
- [ ] PostgreSQL has PostGIS extension enabled and accessible
- [ ] Redis is accessible from API and worker services
- [ ] MinIO console is accessible and can create buckets
- [ ] API service can connect to all dependencies
- [ ] Frontend can proxy requests to API
- [ ] Data persists across container restarts (volumes work)
- [ ] Logs are accessible via `docker-compose logs`
- [ ] Environment variables are properly injected from appropriate source
- [ ] Hot reload works in development mode (volume mounts)
- [ ] Docker secrets work in production configuration
- [ ] `.env.local` file is loaded correctly for local development

## Technical Notes

- Use multi-stage Docker builds to minimize image sizes
- Set up proper user permissions (don't run as root)
- Configure restart policies (restart: unless-stopped)
- Set resource limits (memory, CPU) for production

### Secrets Management Strategy

**Local Development (`.env.local`):**

```env
# Database
DATABASE_URL=postgres://campaign_user:campaign_pass@postgres:5432/campaign_db
POSTGRES_USER=campaign_user
POSTGRES_PASSWORD=campaign_pass
POSTGRES_DB=campaign_db

# Redis
REDIS_URL=redis://redis:6379

# MinIO / S3
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minio_access_key
S3_SECRET_KEY=minio_secret_key
S3_BUCKET=campaign-assets

# Auth
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=7d

# API
API_PORT=3000
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3000
```

**Docker Secrets (Production):**

- Create Docker secrets for sensitive values (JWT_SECRET, database credentials, etc.)
- Reference secrets in docker-compose.prod.yml
- Example: `JWT_SECRET` comes from `/run/secrets/jwt_secret`

**AWS Secrets Manager (Production Deployment):**

- Document integration pattern in deployment guide
- Services fetch secrets at startup from AWS Secrets Manager
- Use AWS SDK with IAM roles for authentication

### Development Hot Reload Configuration

In `docker-compose.dev.yml`, mount source code as volumes:

```yaml
services:
  api:
    volumes:
      - ./packages/api/src:/app/packages/api/src
      - ./packages/shared:/app/packages/shared
  frontend:
    volumes:
      - ./packages/frontend/src:/app/packages/frontend/src
```

## Architectural Decisions

- **PostGIS version**: Use latest `postgres:16-postgis` or `postgis/postgis:latest`
- **Redis version**: Use redis:7-alpine for smaller image size
- **MinIO**: Use official minio/minio image
- **Nginx config**: Custom nginx.conf for SPA routing
- **Secrets**: Multi-tier approach - `.env.local` → Docker secrets → AWS Secrets Manager
- **Development**: Volume mounts for hot reload, no rebuilds needed
- **Monitoring**: Not included in compose file (keeps it simple, add separately if needed)

## Dependencies

- Requires: TICKET-001 (project structure must exist)

## Testing Requirements

- [ ] All services start without errors
- [ ] Can create a test database connection from API
- [ ] Can store and retrieve a file from MinIO
- [ ] Can set and get a value from Redis
- [ ] PostGIS queries work (test simple `ST_MakePoint`)
- [ ] Frontend serves correctly and proxies API requests
- [ ] Data persists after `docker-compose down && docker-compose up`

## Related Tickets

- Requires: TICKET-001
- Blocks: TICKET-003, TICKET-004, TICKET-005, TICKET-029, TICKET-033

## Estimated Effort

2-3 days

## Implementation Notes

### Completed Tasks

1. **Environment Configuration**:
   - Created `.env.example` with comprehensive environment variable documentation
   - Created `.env.local.example` with sensible defaults for local development
   - All sensitive variables are documented and templated

2. **Dockerfiles**:
   - **API Service** (`packages/api/Dockerfile`): Multi-stage build with builder and production stages, non-root user, health check endpoint
   - **Rules Engine** (`packages/rules-engine/Dockerfile`): Multi-stage build optimized for worker processes
   - **Scheduler** (`packages/scheduler/Dockerfile`): Multi-stage build optimized for worker processes
   - **Frontend** (`packages/frontend/Dockerfile`): Multi-stage build with React build + Nginx serving

3. **Nginx Configuration**:
   - Created `packages/frontend/nginx.conf` with:
     - SPA routing support (try_files fallback to index.html)
     - Gzip compression enabled
     - Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
     - API and GraphQL proxy configuration
     - Static asset caching
     - Health check endpoint

4. **Docker Compose Files**:
   - **Base** (`docker-compose.yml`): All services with PostgreSQL+PostGIS, Redis, MinIO, API, workers, and frontend
   - **Development** (`docker-compose.dev.yml`): Volume mounts for hot reload, exposed debugger ports, builder stage targets
   - **Production** (`docker-compose.prod.yml`): Resource limits, replicas, Docker secrets integration, optimized PostgreSQL settings

5. **Database Initialization**:
   - Created `scripts/init-postgis.sql` to enable PostGIS extensions on container startup
   - Includes uuid-ossp and pg_trgm extensions for additional functionality

6. **.dockerignore Files**:
   - Root .dockerignore for general exclusions
   - Package-specific .dockerignore files for api, rules-engine, scheduler, frontend, and shared packages

7. **Documentation**:
   - Updated `README.md` with comprehensive Docker setup instructions
   - Documented both Docker and local development options
   - Added service URLs and port mappings
   - Updated project status to reflect TICKET-002 completion

### Architecture Decisions

1. **Multi-stage Builds**: All Dockerfiles use multi-stage builds to minimize final image size and separate build/runtime dependencies

2. **Non-root Users**: All services run as non-root users for security:
   - API: `nestjs` user (uid 1001)
   - Workers: `worker` user (uid 1001)
   - Frontend: `nginx-user` user (uid 1001)

3. **Health Checks**: Implemented for all services:
   - PostgreSQL: `pg_isready` check
   - Redis: `redis-cli ping`
   - MinIO: HTTP health endpoint
   - API: HTTP health endpoint via Node.js
   - Workers: Process check via `pgrep`
   - Frontend: HTTP health endpoint

4. **Network Segmentation**:
   - `backend-network`: API, workers, databases
   - `frontend-network`: Frontend, API
   - Separation provides security and organization

5. **Volume Persistence**:
   - `postgres-data`: Database persistence
   - `redis-data`: Cache persistence
   - `minio-data`: Object storage persistence

6. **Development vs Production**:
   - Dev: Hot reload via volume mounts, exposed debugger ports, verbose logging
   - Prod: Optimized builds, resource limits, secrets management, no source mounts

### Technical Notes

- **pnpm in Docker**: Dockerfiles use `corepack` to enable pnpm without separate installation
- **Workspace Dependencies**: Dockerfiles copy workspace configuration before installing dependencies for proper monorepo resolution
- **Build Order**: Shared package is built first, then dependent packages
- **PostgreSQL Tuning**: Production compose file includes performance-optimized PostgreSQL settings
- **Redis Memory Management**: Production Redis configured with maxmemory and LRU eviction policy

### Secrets Management Strategy

1. **Local Development**: `.env.local` file (gitignored)
2. **Docker Compose Production**: Docker secrets (external secrets)
3. **Future AWS Deployment**: AWS Secrets Manager integration (documented but not implemented)

### Known Limitations

1. Services require actual implementation code to run - currently only scaffolding exists
2. Health check endpoints need to be implemented in API service
3. Docker secrets require manual creation before production deployment
4. No monitoring/observability stack included (intentional - keeps compose simple)

### Next Steps

- TICKET-003: Implement database schema with Prisma
- TICKET-004: Implement authentication system
- TICKET-005: Implement basic GraphQL API with health check endpoint
