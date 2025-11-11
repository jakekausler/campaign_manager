# Environment Variables Reference

Complete reference for all environment variables used across the Campaign Manager project.

> **⚠️ SECURITY WARNING**: All example passwords and secrets in this guide (`campaign_pass`, `minioadmin`, `your-secret-key-here`, etc.) are for **DEMONSTRATION ONLY**. **NEVER use these in production**. Always generate strong, unique secrets using:
>
> ```bash
> openssl rand -hex 32
> ```
>
> Rotate credentials quarterly and never commit `.env` files to version control.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Variable Categories](#variable-categories)
3. [Required vs Optional](#required-vs-optional)
4. [Service-Specific Variables](#service-specific-variables)
5. [Validation & Constraints](#validation--constraints)
6. [Examples](#examples)
7. [Migration Guide](#migration-guide)

---

## Quick Start

### For Local Development

1. Copy environment template files:

   ```bash
   cp .env.example .env.local
   cp packages/api/.env.example packages/api/.env
   cp packages/frontend/.env.example packages/frontend/.env
   cp packages/scheduler/.env.example packages/scheduler/.env
   cp packages/rules-engine/.env.example packages/rules-engine/.env
   ```

2. Update values in `.env.local` as needed for your environment

3. Run with Docker Compose:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
   ```

### For Production

Use Docker secrets and environment variables from your orchestration platform (Kubernetes, ECS, etc.):

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Variable Categories

### 1. Node Environment

| Variable   | Required | Default       | Type     | Description                                      |
| ---------- | -------- | ------------- | -------- | ------------------------------------------------ |
| `NODE_ENV` | No       | `development` | `string` | Environment: `development`, `production`, `test` |

**Usage:**

- Development: More logging, GraphQL playground enabled, hot reload
- Production: Optimized, reduced logging, security features active
- Test: Minimal logging, test-specific configurations

**Services:** All packages

---

### 2. Database Configuration (PostgreSQL + PostGIS)

| Variable            | Required | Default         | Type      | Description                                   |
| ------------------- | -------- | --------------- | --------- | --------------------------------------------- |
| `DATABASE_URL`      | **Yes**  | -               | `string`  | Full PostgreSQL connection string with schema |
| `POSTGRES_USER`     | **Yes**  | `campaign_user` | `string`  | Database user for Docker                      |
| `POSTGRES_PASSWORD` | **Yes**  | `campaign_pass` | `string`  | Database password                             |
| `POSTGRES_DB`       | **Yes**  | `campaign_db`   | `string`  | Database name                                 |
| `POSTGRES_HOST`     | **Yes**  | `postgres`      | `string`  | Database hostname (in Docker: service name)   |
| `POSTGRES_PORT`     | No       | `5432`          | `integer` | Database port                                 |

**Connection String Format:**

```
postgresql://[user]:[password]@[host]:[port]/[database]?schema=public
```

**Example:**

```bash
DATABASE_URL=postgresql://campaign_user:campaign_pass@postgres:5432/campaign_db?schema=public
```

**Services:** API (via Prisma), Rules Engine

**Validation:**

- Prisma validates connection on module init
- Server fails to start if connection fails

---

### 3. Redis Configuration (Caching & Pub/Sub)

#### Connection

| Variable         | Required            | Default     | Type      | Description                  |
| ---------------- | ------------------- | ----------- | --------- | ---------------------------- |
| `REDIS_URL`      | **Yes** (scheduler) | -           | `string`  | Full Redis URL for scheduler |
| `REDIS_HOST`     | **Yes**             | `localhost` | `string`  | Redis hostname               |
| `REDIS_PORT`     | No                  | `6379`      | `integer` | Redis port                   |
| `REDIS_PASSWORD` | No                  | -           | `string`  | Redis password (optional)    |

#### Database Selection

| Variable         | Required | Default | Type      | Description                            |
| ---------------- | -------- | ------- | --------- | -------------------------------------- |
| `REDIS_DB`       | No       | `0`     | `integer` | Redis database for rules-engine (0-15) |
| `REDIS_CACHE_DB` | No       | `1`     | `integer` | Redis database for cache (0-15)        |

**Notes:**

- Database 0: Pub/Sub operations (real-time updates, shared across services)
- Database 1: Cache (API cache layer, isolated)
- Rules Engine and Pub/Sub use DB 0
- Cache uses DB 1 to avoid conflicts

**Services:** API, Scheduler, Rules Engine

**Connection String Format (Scheduler):**

```
redis://[password@]host:port/database
redis://redis:6379/0
redis://:password@redis:6379/0
```

---

### 4. API Service Configuration

#### Port & Host

| Variable               | Required                 | Default   | Type      | Description                               |
| ---------------------- | ------------------------ | --------- | --------- | ----------------------------------------- |
| `PORT` (or `API_PORT`) | No                       | `9264`    | `integer` | API server port                           |
| `API_HOST`             | No                       | `0.0.0.0` | `string`  | Bind address                              |
| `API_URL`              | **Yes** (scheduler only) | -         | `string`  | GraphQL endpoint for inter-service calls  |
| `FRONTEND_URL`         | No                       | -         | `string`  | Frontend origin for WebSocket connections |

#### GraphQL Configuration

| Variable                | Required | Default      | Type      | Description                                              |
| ----------------------- | -------- | ------------ | --------- | -------------------------------------------------------- |
| `GRAPHQL_PLAYGROUND`    | No       | `true` (dev) | `boolean` | Enable GraphQL Playground (`true`/`false` or Vite-style) |
| `GRAPHQL_INTROSPECTION` | No       | `true` (dev) | `boolean` | Enable schema introspection                              |

**Security Notes:**

- Both disabled in production
- Introspection enables schema discovery (potential security risk)

**Services:** API

---

### 5. Frontend Service Configuration

#### Dev Server

| Variable            | Required | Default | Type      | Description                     |
| ------------------- | -------- | ------- | --------- | ------------------------------- |
| `VITE_PORT`         | No       | `9263`  | `integer` | Frontend dev server port        |
| `VITE_BACKEND_PORT` | No       | `9264`  | `integer` | Backend port for Vite proxy     |
| `PORT`              | No       | `9263`  | `integer` | Fallback if `VITE_PORT` not set |

#### API Endpoints

| Variable             | Required | Default                         | Type     | Description                                  |
| -------------------- | -------- | ------------------------------- | -------- | -------------------------------------------- |
| `VITE_API_URL`       | **Yes**  | `/graphql`                      | `string` | GraphQL endpoint path (relative or absolute) |
| `VITE_GRAPHQL_URL`   | No       | -                               | `string` | Full GraphQL URL for codegen                 |
| `VITE_API_WS_URL`    | **Yes**  | -                               | `string` | WebSocket URL for subscriptions              |
| `GRAPHQL_SCHEMA_URL` | No       | `http://localhost:9264/graphql` | `string` | Used by codegen, not runtime                 |

#### Application Configuration

| Variable           | Required | Default | Type     | Description                               |
| ------------------ | -------- | ------- | -------- | ----------------------------------------- |
| `VITE_APP_NAME`    | **Yes**  | -       | `string` | Application name for UI                   |
| `VITE_ENVIRONMENT` | **Yes**  | -       | `string` | `development`, `staging`, or `production` |

#### Feature Flags

| Variable                | Required | Default | Type      | Description                        |
| ----------------------- | -------- | ------- | --------- | ---------------------------------- |
| `VITE_ENABLE_DEBUG`     | No       | `false` | `boolean` | Enable debug logging in console    |
| `VITE_ENABLE_MOCK_AUTH` | No       | `false` | `boolean` | Use mock authentication (dev only) |

#### Optional: Analytics & Monitoring

| Variable            | Required | Default | Type     | Description                             |
| ------------------- | -------- | ------- | -------- | --------------------------------------- |
| `VITE_ANALYTICS_ID` | No       | -       | `string` | Google Analytics or similar tracking ID |
| `VITE_SENTRY_DSN`   | No       | -       | `string` | Sentry error tracking DSN               |

**Services:** Frontend

**WebSocket URL Validation:**

- Development: `ws://localhost:9263/graphql` (via proxy)
- Production: MUST use `wss://` (secure WebSocket)

---

### 6. Authentication & Security

| Variable                    | Required            | Default | Type     | Description                              |
| --------------------------- | ------------------- | ------- | -------- | ---------------------------------------- |
| `JWT_SECRET`                | **Yes**             | -       | `string` | Secret key for signing JWT tokens        |
| `JWT_EXPIRATION`            | No                  | `7d`    | `string` | Access token expiration time             |
| `JWT_REFRESH_EXPIRATION`    | No                  | `30d`   | `string` | Refresh token expiration time            |
| `API_SERVICE_ACCOUNT_TOKEN` | **Yes** (scheduler) | -       | `string` | API key for scheduler→API authentication |

**Constraints:**

- `JWT_SECRET` MUST be at least 32 characters
- Recommended: 64+ characters with high entropy
- Use `openssl rand -base64 32` to generate

**Example:**

```bash
JWT_SECRET=aB9xK2pL5nM8qR1sT4uV7wX0yZ3cD6eF9gH2jK5mN8pQ1sT4uV7wX0yZ3cD6eF9g
```

**Services:** API, Scheduler

#### API Key Format (API_SERVICE_ACCOUNT_TOKEN)

The `API_SERVICE_ACCOUNT_TOKEN` is an API key (not a JWT token) used for inter-service authentication between the scheduler and API services.

**Format:** `camp_sk_<32_base64url_characters>`

**Example:** `camp_sk_abc123xyz789def456ghi012jkl`

**How to Generate:**

1. **Via Seed Script** (Development):

   ```bash
   pnpm --filter @campaign/api prisma:seed
   ```

   The seed script creates a default API key for the scheduler service.

2. **Via API Endpoint** (Production):
   ```bash
   # Requires valid JWT token for authentication
   curl -X POST http://localhost:9264/auth/api-keys \
     -H "Authorization: Bearer <jwt-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Scheduler Service",
       "description": "API key for scheduler service authentication",
       "expiresAt": null
     }'
   ```

**Important Notes:**

- **One-time display**: The API key is shown only once when created. Save it immediately.
- **Secure storage**: Store keys in environment variables or secrets management systems.
- **Production security**: Never use the example key (`camp_sk_example1234567890abcdefghijk`) in production.
- **Key rotation**: Regenerate keys periodically and update environment variables.
- **No expiration**: Service account keys typically have no expiration (set `expiresAt: null`).

---

### 7. CORS Configuration (API)

| Variable           | Required | Default                 | Type      | Description                       |
| ------------------ | -------- | ----------------------- | --------- | --------------------------------- |
| `CORS_ORIGIN`      | No       | `http://localhost:9263` | `string`  | Allowed origins (comma-separated) |
| `CORS_CREDENTIALS` | No       | `true`                  | `boolean` | Allow credentials in requests     |

**Format:**

```bash
# Single origin
CORS_ORIGIN=http://localhost:9263

# Multiple origins (comma-separated, no spaces)
CORS_ORIGIN=http://localhost:9263,https://example.com,https://app.example.com
```

**Services:** API

---

### 8. Cache Service Configuration (API)

#### Redis Database

| Variable         | Required | Default | Type      | Description                      |
| ---------------- | -------- | ------- | --------- | -------------------------------- |
| `REDIS_CACHE_DB` | No       | `1`     | `integer` | Redis DB number for cache (0-15) |

#### TTL & Metrics

| Variable                | Required | Default | Type      | Description                        |
| ----------------------- | -------- | ------- | --------- | ---------------------------------- |
| `CACHE_DEFAULT_TTL`     | No       | `300`   | `integer` | Default cache TTL in seconds       |
| `CACHE_METRICS_ENABLED` | No       | `true`  | `boolean` | Track cache hit/miss statistics    |
| `CACHE_LOGGING_ENABLED` | No       | `false` | `boolean` | Debug logging for cache operations |

#### Statistics

| Variable                       | Required | Default | Type      | Description                      |
| ------------------------------ | -------- | ------- | --------- | -------------------------------- |
| `CACHE_STATS_TRACKING_ENABLED` | No       | `true`  | `boolean` | Enable statistics collection     |
| `CACHE_STATS_RESET_PERIOD_MS`  | No       | `0`     | `integer` | Auto-reset period (0 = disabled) |

#### Context Size Warnings

| Variable                         | Required | Default | Type      | Description                                |
| -------------------------------- | -------- | ------- | --------- | ------------------------------------------ |
| `CONTEXT_SIZE_WARNING_THRESHOLD` | No       | `1000`  | `integer` | Warn if campaign context exceeds this size |

**Constraints:**

- `CONTEXT_SIZE_WARNING_THRESHOLD`: min 100, max 10000

**Services:** API

**Performance Tuning:**

- Reduce `CACHE_DEFAULT_TTL` for frequently-changing data
- Disable `CACHE_LOGGING_ENABLED` in production (high overhead)
- Set `CACHE_STATS_RESET_PERIOD_MS=3600000` (1 hour) in production

---

### 9. Rules Engine Worker Configuration

#### Integration Control

| Variable               | Required | Default | Type      | Description                             |
| ---------------------- | -------- | ------- | --------- | --------------------------------------- |
| `RULES_ENGINE_ENABLED` | No       | `true`  | `boolean` | Enable/disable rules engine integration |

#### gRPC Client (API → Rules Engine)

| Variable                  | Required | Default     | Type      | Description                          |
| ------------------------- | -------- | ----------- | --------- | ------------------------------------ |
| `RULES_ENGINE_GRPC_HOST`  | No       | `localhost` | `string`  | Rules engine hostname                |
| `RULES_ENGINE_GRPC_PORT`  | No       | `50051`     | `integer` | Rules engine gRPC port               |
| `RULES_ENGINE_TIMEOUT_MS` | No       | `5000`      | `integer` | gRPC request timeout in milliseconds |

#### HTTP Server (Rules Engine)

| Variable                 | Required | Default   | Type      | Description                     |
| ------------------------ | -------- | --------- | --------- | ------------------------------- |
| `RULES_ENGINE_HTTP_PORT` | No       | `9265`    | `integer` | HTTP health check endpoint port |
| `GRPC_PORT`              | No       | `50051`   | `integer` | gRPC server port                |
| `GRPC_HOST`              | No       | `0.0.0.0` | `string`  | gRPC bind address               |

#### Performance Tuning

| Variable                     | Required | Default | Type      | Description                      |
| ---------------------------- | -------- | ------- | --------- | -------------------------------- |
| `RULES_ENGINE_CONCURRENCY`   | No       | `5`     | `integer` | Parallel rule evaluation jobs    |
| `RULES_ENGINE_POLL_INTERVAL` | No       | `1000`  | `integer` | Polling interval in milliseconds |

#### Caching (Rules Engine Only)

| Variable                     | Required | Default | Type      | Description            |
| ---------------------------- | -------- | ------- | --------- | ---------------------- |
| `CACHE_TTL_SECONDS`          | No       | `300`   | `integer` | Cache TTL in seconds   |
| `CACHE_CHECK_PERIOD_SECONDS` | No       | `60`    | `integer` | Cleanup check interval |
| `CACHE_MAX_KEYS`             | No       | `10000` | `integer` | Maximum cached entries |

**Constraints:**

- `CACHE_TTL_SECONDS`: min 1, max 86400 (24 hours)
- `CACHE_CHECK_PERIOD_SECONDS`: min 10, max 3600
- `CACHE_MAX_KEYS`: min 100, max 1000000

**Services:** API (client), Rules Engine (server)

---

### 10. Scheduler Service Configuration

#### Service Port & Logging

| Variable    | Required | Default | Type      | Description                                 |
| ----------- | -------- | ------- | --------- | ------------------------------------------- |
| `PORT`      | No       | `9266`  | `integer` | Scheduler service port                      |
| `LOG_LEVEL` | No       | `info`  | `string`  | Log level: `debug`, `info`, `warn`, `error` |

#### Polling & Concurrency

| Variable                  | Required | Default | Type      | Description                      |
| ------------------------- | -------- | ------- | --------- | -------------------------------- |
| `SCHEDULER_POLL_INTERVAL` | No       | `5000`  | `integer` | Polling interval in milliseconds |
| `SCHEDULER_CONCURRENCY`   | No       | `3`     | `integer` | Parallel jobs processed          |

#### Cron Schedules

| Variable                     | Required | Default       | Type   | Description                            |
| ---------------------------- | -------- | ------------- | ------ | -------------------------------------- |
| `CRON_EVENT_EXPIRATION`      | No       | `*/5 * * * *` | `cron` | Check for expired events (every 5 min) |
| `CRON_SETTLEMENT_GROWTH`     | No       | `0 * * * *`   | `cron` | Process settlement growth (hourly)     |
| `CRON_STRUCTURE_MAINTENANCE` | No       | `0 * * * *`   | `cron` | Structure maintenance (hourly)         |

**Cron Format:** `minute hour day-of-month month day-of-week`

**Examples:**

- `*/5 * * * *` = Every 5 minutes
- `0 * * * *` = Every hour at minute 0
- `0 0 * * *` = Daily at midnight
- `0 0 * * 0` = Weekly on Sunday at midnight

#### Job Queue Configuration

| Variable                 | Required | Default | Type      | Description                |
| ------------------------ | -------- | ------- | --------- | -------------------------- |
| `QUEUE_MAX_RETRIES`      | No       | `3`     | `integer` | Failed job retry attempts  |
| `QUEUE_RETRY_BACKOFF_MS` | No       | `5000`  | `integer` | Backoff delay before retry |
| `QUEUE_CONCURRENCY`      | No       | `5`     | `integer` | Parallel job processing    |

#### API Client Configuration

| Variable                          | Required | Default | Type      | Description                   |
| --------------------------------- | -------- | ------- | --------- | ----------------------------- |
| `API_REQUEST_TIMEOUT_MS`          | No       | `10000` | `integer` | API request timeout           |
| `API_CIRCUIT_BREAKER_THRESHOLD`   | No       | `5`     | `integer` | Failures before circuit opens |
| `API_CIRCUIT_BREAKER_DURATION_MS` | No       | `30000` | `integer` | Duration circuit stays open   |

**Services:** Scheduler

**Circuit Breaker Logic:**

- After N consecutive failures, circuit opens
- Requests fail fast without calling API
- Circuit closes after duration expires
- Good for preventing cascading failures

---

### 11. MinIO / S3-Compatible Storage

| Variable              | Required | Default             | Type     | Description               |
| --------------------- | -------- | ------------------- | -------- | ------------------------- |
| `S3_ENDPOINT`         | No       | `http://minio:9000` | `string` | S3/MinIO service endpoint |
| `S3_ACCESS_KEY`       | No       | `minio_access_key`  | `string` | Access key                |
| `S3_SECRET_KEY`       | No       | `minio_secret_key`  | `string` | Secret key                |
| `S3_BUCKET`           | No       | `campaign-assets`   | `string` | Bucket name               |
| `S3_REGION`           | No       | `us-east-1`         | `string` | AWS region                |
| `MINIO_ROOT_USER`     | No       | `minioadmin`        | `string` | MinIO root username       |
| `MINIO_ROOT_PASSWORD` | No       | `minioadmin`        | `string` | MinIO root password       |

**Services:** API (for file uploads)

**AWS S3 vs MinIO:**

- MinIO: Self-hosted, compatible API
- AWS S3: Use full endpoint URL (e.g., `https://s3.amazonaws.com`)
- Both use same credentials format

---

### 12. Logging Configuration

| Variable     | Required | Default                       | Type     | Description                 |
| ------------ | -------- | ----------------------------- | -------- | --------------------------- |
| `LOG_LEVEL`  | No       | `info` (prod), `debug` (dev)  | `string` | Minimum log level to output |
| `LOG_FORMAT` | No       | `json` (prod), `pretty` (dev) | `string` | Log output format           |

**Log Levels (in order of verbosity):**

1. `error` - Only errors
2. `warn` - Warnings and errors
3. `info` - Info, warnings, errors (default)
4. `debug` - All messages including debug info

**Formats:**

- `json` - Machine-readable, suitable for log aggregation (production)
- `pretty` - Human-readable with colors (development)

**Services:** All packages

---

### 13. Rate Limiting

| Variable         | Required | Default      | Type      | Description                  |
| ---------------- | -------- | ------------ | --------- | ---------------------------- |
| `RATE_LIMIT_TTL` | No       | `60`         | `integer` | Rate limit window in seconds |
| `RATE_LIMIT_MAX` | No       | `100`-`1000` | `integer` | Max requests per window      |

**Development:** 1000 requests/60s (lenient)
**Production:** 100 requests/60s (strict)

**Services:** API

---

### 14. File Upload Configuration

| Variable             | Required | Default                   | Type      | Description                       |
| -------------------- | -------- | ------------------------- | --------- | --------------------------------- |
| `MAX_FILE_SIZE`      | No       | `10485760`                | `integer` | Maximum file size in bytes (10MB) |
| `ALLOWED_FILE_TYPES` | No       | `image/*,application/pdf` | `string`  | Comma-separated MIME types        |

**Services:** API

---

### 15. Testing Configuration

| Variable            | Required | Default | Type      | Description                    |
| ------------------- | -------- | ------- | --------- | ------------------------------ |
| `INTEGRATION_TESTS` | No       | `false` | `boolean` | Enable integration test suites |
| `CI`                | No       | -       | `boolean` | CI environment flag            |

**Notes:**

- Integration tests skipped by default (require external services)
- Set `INTEGRATION_TESTS=true` to run full integration test suite
- `CI` is auto-detected by some CI systems

**Services:** Test suites

---

## Required vs Optional

### Absolutely Required (Server Won't Start)

1. **API Service:**
   - `JWT_SECRET` - Validated in main.ts with 32-char minimum

2. **Scheduler Service:**
   - `REDIS_URL` - Required by ConfigService
   - `API_URL` - Required by ConfigService
   - `API_SERVICE_ACCOUNT_TOKEN` - Required by ConfigService

3. **Rules Engine:**
   - `DATABASE_URL` - Implicit (via Prisma, any node_env)

4. **Frontend:**
   - `VITE_ENVIRONMENT` - Required, validates allowed values
   - `VITE_API_URL` - Required, used for GraphQL endpoint
   - `VITE_APP_NAME` - Required, used in UI

### Highly Recommended (Service Degradation)

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - Docker configuration
- `CORS_ORIGIN` - Defaults to localhost, might break cross-origin

### Optional (Sensible Defaults)

- `LOG_LEVEL` - Defaults to info/debug based on NODE_ENV
- `PORT` variables - Defaults to standard ports
- Cache variables - Have reasonable defaults
- Cron schedules - Have reasonable defaults

---

## Service-Specific Variables

### API Service

**Required:**

- `JWT_SECRET`
- `DATABASE_URL`

**Recommended:**

- `REDIS_HOST`, `REDIS_PORT`
- `CORS_ORIGIN`
- `NODE_ENV`

**Optional:**

- `PORT` (default: 9264)
- `CACHE_*` variables
- `RULES_ENGINE_*` variables
- `LOG_LEVEL`, `LOG_FORMAT`

### Scheduler Service

**Required:**

- `REDIS_URL`
- `API_URL`
- `API_SERVICE_ACCOUNT_TOKEN`

**Optional:**

- `PORT` (default: 9266)
- `LOG_LEVEL`
- `CRON_*` schedules
- `QUEUE_*` settings
- `API_CIRCUIT_BREAKER_*` settings

### Rules Engine Worker

**Required:**

- `DATABASE_URL` (for read-only access)

**Recommended:**

- `REDIS_HOST`, `REDIS_PORT`

**Optional:**

- `GRPC_PORT`, `GRPC_HOST`
- `HTTP_PORT`
- `CACHE_*` variables
- `LOG_LEVEL`

### Frontend

**Required:**

- `VITE_ENVIRONMENT`
- `VITE_API_URL`
- `VITE_APP_NAME`

**Required:**

- `VITE_API_WS_URL`

**Optional:**

- `VITE_PORT`, `VITE_BACKEND_PORT`
- `VITE_ENABLE_DEBUG`, `VITE_ENABLE_MOCK_AUTH`
- `VITE_ANALYTICS_ID`, `VITE_SENTRY_DSN`

---

## Validation & Constraints

### Type Validation

**Integers:**

- Parsed with `parseInt(..., 10)` for base-10 safety
- Must be valid numbers or service fails

**Booleans:**

- No strict boolean type in environment variables
- Patterns:
  - `!== 'false'` treats any non-"false" value as true (default: true)
  - `=== 'true'` requires exactly "true" string (default: false)
  - Vite style: `'true'`, `'1'`, `'yes'` treated as true

**Strings:**

- No validation unless documented
- Comma-separated lists split with `.split(',')`
- URLs validated for protocol (http, https, ws, wss)

### Range Constraints

| Variable                         | Min      | Max     | Notes                   |
| -------------------------------- | -------- | ------- | ----------------------- |
| `CACHE_TTL_SECONDS`              | 1        | 86400   | Max 24 hours            |
| `CACHE_CHECK_PERIOD_SECONDS`     | 10       | 3600    | Min 10s, max 1 hour     |
| `CACHE_MAX_KEYS`                 | 100      | 1000000 | Min 100 entries         |
| `CONTEXT_SIZE_WARNING_THRESHOLD` | 100      | 10000   | Validated in code       |
| `JWT_SECRET`                     | 32 chars | ∞       | Minimum length enforced |

### Format Constraints

| Variable             | Format               | Example                                             |
| -------------------- | -------------------- | --------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL URL       | `postgresql://user:pass@host:5432/db?schema=public` |
| `REDIS_URL`          | Redis URL            | `redis://:password@host:6379/0`                     |
| `CRON_*`             | Cron expression      | `0 * * * *` (hourly)                                |
| `JWT_*_EXPIRATION`   | Duration string      | `7d`, `30d`, `24h`, `3600s`                         |
| `CORS_ORIGIN`        | Comma-separated URLs | `http://localhost:9263,https://example.com`         |
| `ALLOWED_FILE_TYPES` | MIME types           | `image/jpeg,image/png,application/pdf`              |

---

## Examples

### Local Development (Docker Compose)

Create `.env.local`:

```bash
# Node
NODE_ENV=development

# Database
DATABASE_URL=postgresql://campaign_user:local_dev_password@postgres:5432/campaign_db?schema=public
POSTGRES_USER=campaign_user
POSTGRES_PASSWORD=local_dev_password
POSTGRES_DB=campaign_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379

# API
PORT=9264
JWT_SECRET=local-dev-secret-change-me-in-production-123456
CORS_ORIGIN=http://localhost:9263
GRAPHQL_PLAYGROUND=true
GRAPHQL_INTROSPECTION=true

# Frontend
VITE_PORT=9263
VITE_BACKEND_PORT=9264
VITE_API_URL=/graphql
VITE_APP_NAME=Campaign Manager
VITE_ENVIRONMENT=development
VITE_ENABLE_DEBUG=true
VITE_ENABLE_MOCK_AUTH=true

# Scheduler
SCHEDULER_POLL_INTERVAL=5000

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### Production (Kubernetes Secrets)

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: campaign-manager-secrets
type: Opaque
stringData:
  NODE_ENV: production
  JWT_SECRET: <generate-with-openssl>
  POSTGRES_PASSWORD: <strong-password>
  MINIO_ROOT_PASSWORD: <strong-password>
  API_SERVICE_ACCOUNT_TOKEN: <api-key-from-seed-or-endpoint>
  REDIS_PASSWORD: <redis-password>

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: campaign-manager-config
data:
  DATABASE_URL: 'postgresql://campaign_user@postgres.default.svc:5432/campaign_db?schema=public'
  REDIS_URL: 'redis://redis.default.svc:6379/0'
  LOG_LEVEL: info
  LOG_FORMAT: json
  GRAPHQL_PLAYGROUND: 'false'
  GRAPHQL_INTROSPECTION: 'false'
  CORS_ORIGIN: 'https://app.example.com'
```

### Testing (CI/CD)

```bash
# .github/workflows/tests.yml
env:
  NODE_ENV: test
  DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/test_db?schema=public
  REDIS_URL: redis://localhost:6379/1
  JWT_SECRET: test-secret-key-minimum-32-characters
  API_SERVICE_ACCOUNT_TOKEN: camp_sk_testkey1234567890abcdefgh
  INTEGRATION_TESTS: "true"
  LOG_LEVEL: error
  CI: "true"
```

---

## Migration Guide

### Updating Environment Variables

When an environment variable changes (renamed, removed, or added):

1. **Update `.env.example` files** in root and packages
2. **Update this documentation** with new constraints/descriptions
3. **Add migration notes** in PR description
4. **Test all affected services** with new configuration
5. **Announce breaking changes** if renaming or removing variables

### Handling Variable Deprecation

1. Support both old and new names for 1-2 releases
2. Log deprecation warning when old name is used
3. Update all `.env.example` files to use new name
4. Remove old name after deprecation period

### Adding New Variables

1. Add to appropriate `.env.example` file with comment
2. Add to service's configuration reading logic (ConfigService or main.ts)
3. Validate in service constructor or module initialization
4. Document in this reference with:
   - Purpose and description
   - Default value (if any)
   - Required vs optional
   - Min/max constraints (if any)
   - Service(s) that use it

### Example: Adding CACHE_INVALIDATION_TIMEOUT

1. **Update `.env.example`:**

   ```bash
   # Cache invalidation timeout (milliseconds)
   CACHE_INVALIDATION_TIMEOUT_MS=5000
   ```

2. **Update API cache module:**

   ```typescript
   @Injectable()
   export class CacheService {
     private readonly invalidationTimeoutMs: number;

     constructor(@Inject(REDIS_CACHE) redis: Redis) {
       this.invalidationTimeoutMs = parseInt(
         process.env.CACHE_INVALIDATION_TIMEOUT_MS || '5000',
         10
       );
     }
   }
   ```

3. **Update this documentation** with new variable details

4. **Test** with new configuration value

---

## Security Best Practices

1. **Never commit `.env` files** - Only commit `.env.example`
2. **Rotate secrets regularly** - Especially JWT_SECRET and database passwords
3. **Use strong passwords** - Min 16 chars with mix of types
4. **Store production secrets securely:**
   - AWS Secrets Manager
   - Kubernetes Secrets
   - HashiCorp Vault
   - Docker Secrets
5. **Audit access** to production secrets
6. **Disable GraphQL introspection** in production
7. **Use secure WebSocket (`wss://`)** in production
8. **Enable CORS_CREDENTIALS** only when necessary
9. **Keep LOG_LEVEL=info in production** (debug is verbose)
10. **Validate all environment variables** on startup

---

## Troubleshooting

### "Missing required environment variable"

Check `.env` or `.env.local` file exists and is loaded:

```bash
# For API
cat packages/api/.env

# For scheduler
cat packages/scheduler/.env

# Verify Docker has access
docker-compose config | grep -i environment
```

### JWT_SECRET too short

Generate a proper secret:

```bash
openssl rand -base64 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Redis connection refused

Check Redis is running and accessible:

```bash
docker ps | grep redis
redis-cli -h localhost -p 6379 ping
```

### CORS errors in browser

Update `CORS_ORIGIN` to match frontend URL:

```bash
# Dev with different port
CORS_ORIGIN=http://localhost:3000

# Multiple origins
CORS_ORIGIN=http://localhost:9263,https://example.com
```

### Cache database conflict

Ensure different Redis databases for different purposes:

- REDIS_DB=0: Pub/Sub, shared data
- REDIS_CACHE_DB=1: Cache layer (isolated)

---

## Summary

This comprehensive reference covers:

- 70+ environment variables
- 5 packages with distinct configurations
- Development, production, and testing scenarios
- Validation patterns and constraints
- Security best practices
- Migration and troubleshooting guides

For questions or additions, refer to:

- `.env.example` - Current configuration template
- `packages/*/README.md` - Package-specific setup
- `CLAUDE.md` - Development guidelines
- Source code comments - Implementation details
