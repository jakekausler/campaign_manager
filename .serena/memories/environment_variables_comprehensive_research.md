# Environment Variables Comprehensive Research

## Research Date

Generated on 2025-11-09

## Summary

Complete environment variable catalog for Campaign Manager project discovered across:

- Root level `.env.example` and `.env.local.example`
- 5 packages: api, frontend, scheduler, rules-engine, shared
- Docker Compose configurations (base, dev, prod)
- Configuration services and validation logic
- Test suites with environment variable usage

## Discovered Variables by Category

### 1. Node Environment

- NODE_ENV: development/production/test (default: development)
- Used in: all packages

### 2. Database (PostgreSQL + PostGIS)

- DATABASE_URL: Connection string
- POSTGRES_USER: DB user
- POSTGRES_PASSWORD: DB password
- POSTGRES_DB: Database name
- POSTGRES_HOST: Host
- POSTGRES_PORT: Port (default: 5432)

### 3. Redis Configuration

- REDIS_URL: Full connection URL
- REDIS_HOST: Host (default: localhost)
- REDIS_PORT: Port (default: 6379)
- REDIS_PASSWORD: Optional password
- REDIS_DB: Database number (0-15, default: 0)
- REDIS_CACHE_DB: Cache-specific DB (default: 1)

### 4. API Service Configuration

- PORT: API port (default: 9264)
- API_PORT: Alias for PORT
- API_HOST: Bind address (default: 0.0.0.0)
- API_URL: GraphQL endpoint for scheduler access
- FRONTEND_URL: Frontend origin for CORS/WebSocket

### 5. Frontend Service Configuration

- VITE_PORT: Dev server port (default: 9263)
- VITE_BACKEND_PORT: Backend port for proxying (default: 9264)
- VITE_API_URL: GraphQL endpoint path (default: /graphql)
- VITE_GRAPHQL_URL: Full GraphQL URL
- VITE_API_WS_URL: WebSocket URL
- VITE_APP_NAME: Application name
- VITE_ENVIRONMENT: development/staging/production
- VITE_ENABLE_DEBUG: Enable debug logging
- VITE_ENABLE_MOCK_AUTH: Use mock authentication
- GRAPHQL_SCHEMA_URL: Schema introspection URL (for codegen)

### 6. Authentication & Security

- JWT_SECRET: Secret key for JWT signing (min 32 chars)
- JWT_EXPIRATION: Access token expiration (default: 7d)
- JWT_REFRESH_EXPIRATION: Refresh token expiration (default: 30d)
- API_SERVICE_ACCOUNT_TOKEN: Service account JWT for scheduler

### 7. CORS Configuration

- CORS_ORIGIN: Allowed origins (comma-separated)
- CORS_CREDENTIALS: Enable credentials (default: true)

### 8. Cache Service (API)

- CACHE_DEFAULT_TTL: Default TTL in seconds (default: 300)
- CACHE_METRICS_ENABLED: Track cache statistics (default: true)
- CACHE_LOGGING_ENABLED: Debug logging (default: false)
- CACHE_STATS_TRACKING_ENABLED: Enable stats tracking (default: true)
- CACHE_STATS_RESET_PERIOD_MS: Auto-reset period (0 = disabled)
- CONTEXT_SIZE_WARNING_THRESHOLD: Campaign context size threshold (default: 1000)

### 9. Rules Engine Worker

- RULES_ENGINE_ENABLED: Enable/disable integration (default: true)
- RULES_ENGINE_GRPC_HOST: gRPC host (default: localhost)
- RULES_ENGINE_GRPC_PORT: gRPC port (default: 50051)
- RULES_ENGINE_TIMEOUT_MS: Request timeout (default: 5000)
- RULES_ENGINE_HTTP_PORT: HTTP port (default: 9265)
- RULES_ENGINE_CONCURRENCY: Parallel jobs (default: 5)
- RULES_ENGINE_POLL_INTERVAL: Poll interval in ms (default: 1000)

### 10. Rules Engine Cache

- CACHE_TTL_SECONDS: Cache TTL (default: 300, min: 1, max: 86400)
- CACHE_CHECK_PERIOD_SECONDS: Cleanup check period (default: 60, min: 10, max: 3600)
- CACHE_MAX_KEYS: Max entries (default: 10000, min: 100, max: 1000000)

### 11. Scheduler Service

- PORT: Service port (default: 9266)
- SCHEDULER_POLL_INTERVAL: Poll interval in ms (default: 5000)
- SCHEDULER_CONCURRENCY: Parallel jobs (default: 3)
- CRON*EVENT_EXPIRATION: Cron schedule (default: */5 \_ \* \* \*)
- CRON_SETTLEMENT_GROWTH: Cron schedule (default: 0 \* \* \* \*)
- CRON_STRUCTURE_MAINTENANCE: Cron schedule (default: 0 \* \* \* \*)
- QUEUE_MAX_RETRIES: Retry attempts (default: 3)
- QUEUE_RETRY_BACKOFF_MS: Backoff delay (default: 5000)
- QUEUE_CONCURRENCY: Parallel jobs (default: 5)
- API_REQUEST_TIMEOUT_MS: API timeout (default: 10000)
- API_CIRCUIT_BREAKER_THRESHOLD: Failure threshold (default: 5)
- API_CIRCUIT_BREAKER_DURATION_MS: Open duration (default: 30000)

### 12. MinIO/S3 Storage

- S3_ENDPOINT: Service endpoint (default: http://minio:9000)
- S3_ACCESS_KEY: Access key
- S3_SECRET_KEY: Secret key
- S3_BUCKET: Bucket name (default: campaign-assets)
- S3_REGION: AWS region (default: us-east-1)
- MINIO_ROOT_USER: MinIO root username
- MINIO_ROOT_PASSWORD: MinIO root password

### 13. Logging

- LOG_LEVEL: Level (debug/info/warn/error, default: info)
- LOG_FORMAT: Format (json/pretty, default: json in prod, pretty in dev)

### 14. GraphQL Configuration

- GRAPHQL_PLAYGROUND: Enable playground (default: true in dev)
- GRAPHQL_INTROSPECTION: Enable introspection (default: true in dev)

### 15. Rate Limiting

- RATE_LIMIT_TTL: Window in seconds (default: 60)
- RATE_LIMIT_MAX: Max requests per window (default: 100-1000)

### 16. File Upload

- MAX_FILE_SIZE: Max bytes (default: 10485760 = 10MB)
- ALLOWED_FILE_TYPES: Comma-separated MIME types

### 17. Testing

- INTEGRATION_TESTS: Enable integration tests (default: 'false' when skipped)
- CI: CI environment marker

## Services and Their Required Variables

### API Service

Required: JWT_SECRET, DATABASE_URL, REDIS_HOST, REDIS_PORT
Optional: CORS_ORIGIN, PORT, NODE_ENV, LOG_LEVEL

### Scheduler Service

Required: REDIS*URL, API_URL, API_SERVICE_ACCOUNT_TOKEN
Optional: PORT, LOG_LEVEL, CRON*\_ variables, QUEUE\_\_ variables

### Rules Engine Worker

Required: DATABASE*URL, REDIS_HOST, REDIS_PORT
Optional: GRPC_PORT, HTTP_PORT, CACHE*\* variables

### Frontend

Required: VITE_ENVIRONMENT, VITE_API_URL, VITE_APP_NAME
Optional: VITE_PORT, VITE_BACKEND_PORT, Feature flags

## Docker Compose Variables

- Uses env_file: .env.local
- SERVICE\_\* environment variables set in docker-compose files
- Secrets configured for production (jwt_secret, db_password)

## Validation Patterns

### API (main.ts)

- JWT_SECRET required and >= 32 chars
- CORS_ORIGIN split by commas
- PORT uses default 9264

### Scheduler (ConfigService)

- REDIS_URL required (throws if missing)
- API_URL required
- API_SERVICE_ACCOUNT_TOKEN required
- All others have sensible defaults

### Rules Engine

- DATABASE_URL required (implicit via Prisma)
- REDIS configuration with defaults
- CACHE\_\* variables with min/max constraints

### Frontend (vite.config.ts)

- VITE_PORT parsed as integer
- Uses process.env fallback to 9263
- GRAPHQL_SCHEMA_URL for codegen

## File Locations

- Root: /.env.example (126 lines)
- Root local: /.env.local.example (112 lines)
- API: /packages/api/.env.example (25 lines)
- Frontend: /packages/frontend/.env.example (51 lines)
- Scheduler: /packages/scheduler/.env.example (30 lines)
- Rules Engine: /packages/rules-engine/.env.example (25 lines)

## Key Insights

1. **Multiple Configuration Approaches**: Direct env vars (API), TypedConfigService (Scheduler), Vite (Frontend)
2. **Database Setup**: Requires PostGIS extension (configured via docker-entrypoint)
3. **Redis Multi-DB Strategy**: Cache uses DB 1, pubsub/rules-engine use DB 0
4. **Security Sensitive Variables**: JWT_SECRET, POSTGRES_PASSWORD, S3_SECRET_KEY, MINIO_ROOT_PASSWORD
5. **Numeric Parsing**: All numeric vars use parseInt(..., 10) with base 10
6. **Boolean Patterns**: Different services use different conventions (!== 'false' vs === 'true')
7. **Time Format Mixing**: Some use milliseconds (_MS), seconds (\_SECONDS), some use cron (CRON_\*)
8. **Defaults Vary by Service**: Some aggressive defaults (3-5 retries), others conservative
9. **Cron Schedules**: All defined as cron expressions, no hardcoded timer values
10. **Feature Flags**: RULES_ENGINE_ENABLED and INTEGRATION_TESTS pattern for optional features
