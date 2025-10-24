# Scheduler Service Worker

Dedicated NestJS microservice for managing time-based operations including world-time progression, deferred effect execution, scheduled event triggering, and Settlement/Structure periodic events.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Configuration](#configuration)
- [Job Types](#job-types)
- [Monitoring & Observability](#monitoring--observability)
- [API Endpoints](#api-endpoints)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The Scheduler Service is a standalone NestJS microservice that manages all time-based operations in the campaign management system. It uses:

- **Node-cron** / **@nestjs/schedule** for periodic task scheduling
- **Bull** (Redis-based) for reliable job queue management with retries
- **Redis pub/sub** for real-time event reactivity
- **Winston** for structured JSON logging
- **Prometheus** for metrics exposure

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Scheduler Service                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Cron Schedule Engine                     │   │
│  │  - Event expiration (*/5 * * * *)                │   │
│  │  - Settlement growth (0 * * * *)                 │   │
│  │  - Structure maintenance (0 * * * *)             │   │
│  └──────────────────────────────────────────────────┘   │
│               ↓                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Bull Job Queue (Redis)                    │   │
│  │  - Deferred effects                              │   │
│  │  - Event expiration                              │   │
│  │  - Settlement/Structure scheduling               │   │
│  │  - Dead-letter queue for failures                │   │
│  └──────────────────────────────────────────────────┘   │
│               ↓                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Job Processor                            │   │
│  │  - Type routing                                  │   │
│  │  - Retry logic (exponential backoff)            │   │
│  │  - Error handling                                │   │
│  └──────────────────────────────────────────────────┘   │
│               ↓                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         API Client Service                       │   │
│  │  - GraphQL mutations/queries                     │   │
│  │  - Circuit breaker pattern                       │   │
│  │  - Request caching (5min TTL)                    │   │
│  └──────────────────────────────────────────────────┘   │
│               ↓                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Main API Service                         │   │
│  │  - Effect execution                              │   │
│  │  - Event completion                              │   │
│  │  - Settlement/Structure updates                  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

         ↕ (Redis pub/sub)

┌─────────────────────────────────────────────────────────┐
│              Campaign Events                             │
│  - campaign.*.worldTimeAdvanced                         │
│  - campaign.*.entityModified                            │
└─────────────────────────────────────────────────────────┘
```

## Features

### Core Functionality

- **Event Expiration**: Automatically marks events as expired if `scheduledAt < currentWorldTime`
- **Deferred Effects**: Executes effects at specified times with retry logic
- **Settlement Growth**: Schedules population growth, resource generation, and level progression
- **Structure Maintenance**: Manages construction completion and maintenance cycles
- **Redis Reactivity**: Responds to world time changes and entity modifications in real-time

### Reliability

- **Job Retries**: Exponential backoff with configurable max attempts (default: 3)
- **Dead-Letter Queue**: Failed jobs moved to DLQ for investigation
- **Circuit Breaker**: API failures trigger circuit breaker (50% error rate threshold)
- **Graceful Degradation**: Service continues operating even if individual components fail

### Performance Optimizations

- **Thundering Herd Prevention**: Queue-based job processing instead of immediate execution
- **Deduplication**: 5-second cooldown for worldTimeAdvanced events per campaign
- **Caching**: 5-minute TTL for frequently accessed data (effects, campaign IDs)
- **Batch Processing**: Event expiration processes in batches of 10
- **Connection Pooling**: HTTP/HTTPS agents reuse TCP connections (10 max sockets, 5 idle)
- **Job Concurrency Limits**: Maximum 5 concurrent jobs to prevent overload
- **Graceful Shutdown**: Drains job queues on SIGTERM/SIGINT before exit
- **Automatic Cleanup**: Keeps last 100 completed jobs, last 500 failed jobs in queue

## Configuration

Environment variables (`.env` file):

```bash
# Service Configuration
NODE_ENV=development                    # development | production
PORT=9266                               # HTTP server port
LOG_LEVEL=info                          # error | warn | info | debug | verbose

# Redis Configuration
REDIS_URL=redis://localhost:6379

# API Configuration
API_URL=http://localhost:9264/graphql
API_SERVICE_ACCOUNT_TOKEN=<jwt-token>   # Service account JWT

# Cron Schedules (optional overrides)
CRON_EVENT_EXPIRATION=*/5 * * * *       # Every 5 minutes
CRON_SETTLEMENT_GROWTH=0 * * * *        # Every hour
CRON_STRUCTURE_MAINTENANCE=0 * * * *    # Every hour

# Job Queue Configuration
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_BACKOFF_MS=5000
QUEUE_CONCURRENCY=5

# API Client Configuration
API_REQUEST_TIMEOUT_MS=10000
API_CIRCUIT_BREAKER_THRESHOLD=5
API_CIRCUIT_BREAKER_DURATION_MS=30000
```

## Job Types

### 1. DEFERRED_EFFECT

Execute an effect at a specified time.

**Payload**:

```typescript
{
  type: 'DEFERRED_EFFECT',
  campaignId: string,
  payload: {
    effectId: string,
    executeAt: string  // ISO 8601 timestamp
  }
}
```

### 2. EVENT_EXPIRATION

Check for overdue events and mark them as expired.

**Payload**:

```typescript
{
  type: 'EVENT_EXPIRATION',
  campaignId: string,
  payload: {}
}
```

### 3. SETTLEMENT_GROWTH

Process growth events for a settlement.

**Payload**:

```typescript
{
  type: 'SETTLEMENT_GROWTH',
  campaignId: string,
  payload: {
    settlementId: string,
    growthType: 'POPULATION_GROWTH' | 'RESOURCE_GENERATION' | 'LEVEL_UP_CHECK'
  }
}
```

### 4. STRUCTURE_MAINTENANCE

Process maintenance events for a structure.

**Payload**:

```typescript
{
  type: 'STRUCTURE_MAINTENANCE',
  campaignId: string,
  payload: {
    structureId: string,
    eventType: 'CONSTRUCTION_COMPLETE' | 'MAINTENANCE_DUE' | 'UPGRADE_AVAILABLE'
  }
}
```

### 5. RECALCULATE_SETTLEMENT_SCHEDULES

Recalculate all settlement growth schedules for a campaign (triggered by world time advance).

### 6. RECALCULATE_STRUCTURE_SCHEDULES

Recalculate all structure maintenance schedules for a campaign (triggered by world time advance).

## Monitoring & Observability

### Health Check Endpoint

**GET /health**

Returns comprehensive health status of all components:

```json
{
  "status": "healthy",
  "timestamp": "2025-10-24T12:00:00.000Z",
  "components": {
    "redis": {
      "status": "up",
      "message": "Connected (latency: 5ms)",
      "lastChecked": "2025-10-24T12:00:00.000Z"
    },
    "redisSubscriber": {
      "status": "up",
      "message": "Subscribed to campaign channels",
      "lastChecked": "2025-10-24T12:00:00.000Z"
    },
    "bullQueue": {
      "status": "up",
      "message": "Active: 2, Waiting: 5, Delayed: 1, Failed: 0",
      "lastChecked": "2025-10-24T12:00:00.000Z"
    },
    "api": {
      "status": "up",
      "message": "Connected (latency: 15ms)",
      "lastChecked": "2025-10-24T12:00:00.000Z"
    }
  },
  "version": "0.1.0",
  "uptime": 3600
}
```

**Health Status Values**:

- `healthy`: All components operational
- `degraded`: Some components experiencing issues but service functional
- `unhealthy`: Critical components down

**Component Status Values**:

- `up`: Component operational
- `degraded`: Component experiencing issues
- `down`: Component unavailable

### Metrics Endpoints

#### **GET /metrics** (JSON Format)

Human-readable JSON metrics for dashboards:

```json
{
  "queue": {
    "active": 2,
    "waiting": 5,
    "completed": 1234,
    "failed": 12,
    "delayed": 1
  },
  "deadLetter": {
    "count": 3
  },
  "timestamp": "2025-10-24T12:00:00.000Z"
}
```

#### **GET /metrics/prometheus** (Prometheus Format)

Prometheus-compatible metrics for scraping:

```prometheus
# HELP scheduler_queue_active Number of active jobs
# TYPE scheduler_queue_active gauge
scheduler_queue_active 2

# HELP scheduler_queue_waiting Number of waiting jobs
# TYPE scheduler_queue_waiting gauge
scheduler_queue_waiting 5

# HELP scheduler_queue_completed Number of completed jobs
# TYPE scheduler_queue_completed counter
scheduler_queue_completed 1234

# HELP scheduler_queue_failed Number of failed jobs
# TYPE scheduler_queue_failed counter
scheduler_queue_failed 12

# HELP scheduler_dead_letter_count Number of jobs in dead-letter queue
# TYPE scheduler_dead_letter_count gauge
scheduler_dead_letter_count 3

# HELP scheduler_health_status Overall health status (0=unhealthy, 1=degraded, 2=healthy)
# TYPE scheduler_health_status gauge
scheduler_health_status 2

# HELP scheduler_component_status Component health status (0=down, 1=degraded, 2=up)
# TYPE scheduler_component_status gauge
scheduler_component_status{component="redis"} 2
scheduler_component_status{component="redis_subscriber"} 2
scheduler_component_status{component="bull_queue"} 2
scheduler_component_status{component="api"} 2

# HELP scheduler_uptime_seconds Scheduler service uptime in seconds
# TYPE scheduler_uptime_seconds counter
scheduler_uptime_seconds 3600

# HELP process_cpu_usage_percent Process CPU usage percentage
# TYPE process_cpu_usage_percent gauge
process_cpu_usage_percent 15.2

# HELP process_memory_usage_bytes Process memory usage in bytes
# TYPE process_memory_usage_bytes gauge
process_memory_usage_bytes{type="rss"} 104857600
process_memory_usage_bytes{type="heap_used"} 52428800
process_memory_usage_bytes{type="heap_total"} 78643200
process_memory_usage_bytes{type="external"} 1048576
```

### Structured Logging

Logs are output in **JSON format in production** and **human-readable format in development**.

**Production Log Example** (JSON):

```json
{
  "timestamp": "2025-10-24T12:00:00.000Z",
  "level": "info",
  "message": "Job processing completed",
  "context": "JobProcessorService",
  "jobId": "123",
  "jobType": "DEFERRED_EFFECT",
  "duration": 250
}
```

**Development Log Example** (Human-readable):

```
2025-10-24 12:00:00 INFO [JobProcessorService] Job processing completed
{
  "jobId": "123",
  "jobType": "DEFERRED_EFFECT",
  "duration": 250
}
```

**Log Levels**:

- `error`: Critical errors requiring immediate attention
- `warn`: Warning conditions that may require investigation
- `info`: Informational messages about normal operation
- `debug`: Detailed debugging information
- `verbose`: Very detailed tracing information

Configure log level via `LOG_LEVEL` environment variable.

### Alerting

The Alerting Service provides hooks for critical failure notifications.

**Alert Severities**:

- `CRITICAL`: Service-impacting failures (jobs failed after all retries)
- `WARNING`: Non-critical issues requiring attention
- `INFO`: Informational alerts

**Example Integration**:

```typescript
import { AlertingService } from './monitoring/alerting.service';

@Injectable()
export class MyService {
  constructor(private readonly alertingService: AlertingService) {}

  async handleCriticalFailure(error: Error) {
    await this.alertingService.critical(
      'Critical System Failure',
      `System component failed: ${error.message}`,
      {
        component: 'MyService',
        error: error.message,
        stack: error.stack,
      }
    );
  }
}
```

**Custom Alert Handlers**:

Register custom handlers to integrate with external alerting systems (PagerDuty, Slack, email):

```typescript
alertingService.registerHandler(async (alert) => {
  // Send to PagerDuty, Slack, email, etc.
  if (alert.severity === AlertSeverity.CRITICAL) {
    await sendToPagerDuty(alert);
  }
});
```

### Bull Board UI (Development Only)

Access job queue monitoring UI at **http://localhost:9266/admin/queues** when `NODE_ENV=development`.

Features:

- View jobs in all states (waiting, active, completed, failed)
- Retry failed jobs
- View job details and error messages
- Monitor queue metrics in real-time

## API Endpoints

| Endpoint              | Method | Description                      |
| --------------------- | ------ | -------------------------------- |
| `/health`             | GET    | Health status of all components  |
| `/metrics`            | GET    | Queue metrics in JSON format     |
| `/metrics/prometheus` | GET    | Prometheus-compatible metrics    |
| `/admin/queues`       | GET    | Bull Board UI (development only) |

## Development

### Installation

```bash
# From project root
pnpm install
```

### Running Locally

```bash
# From project root
pnpm --filter @campaign/scheduler dev
```

### Running Tests

```bash
# Run all tests
pnpm --filter @campaign/scheduler test

# Run tests in watch mode
pnpm --filter @campaign/scheduler test:watch

# Run tests with coverage
pnpm --filter @campaign/scheduler test -- --coverage
```

### Type Checking

```bash
pnpm --filter @campaign/scheduler type-check
```

### Linting

```bash
# Check for issues
pnpm --filter @campaign/scheduler lint

# Auto-fix issues
pnpm --filter @campaign/scheduler lint:fix
```

### Performance Testing

```bash
# Run performance benchmarks
pnpm --filter @campaign/scheduler benchmark

# Run load test (requires Redis running)
# Usage: pnpm --filter @campaign/scheduler load-test [numJobs] [numCampaigns]
pnpm --filter @campaign/scheduler load-test 100 5
```

## Production Deployment

### Docker

The scheduler service includes a Dockerfile for containerization:

```bash
# Build image
docker build -t campaign-scheduler:latest -f packages/scheduler/Dockerfile .

# Run container
docker run -d \
  --name campaign-scheduler \
  -p 9266:9266 \
  --env-file packages/scheduler/.env \
  campaign-scheduler:latest
```

### Docker Compose

Included in root `docker-compose.yml`:

```yaml
scheduler:
  build:
    context: .
    dockerfile: packages/scheduler/Dockerfile
  ports:
    - '9266:9266'
  environment:
    NODE_ENV: production
    REDIS_URL: redis://redis:6379
    API_URL: http://api:3000/graphql
  depends_on:
    - redis
    - api
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:9266/health']
    interval: 30s
    timeout: 10s
    retries: 3
```

### Environment Preparation

1. **Generate Service Account Token**:

   ```bash
   # Use main API to generate JWT token for scheduler service
   # Token should have appropriate permissions for scheduler operations
   ```

2. **Configure Environment**:

   ```bash
   cp packages/scheduler/.env.example packages/scheduler/.env
   # Edit .env with production values
   ```

3. **Verify Dependencies**:
   - Redis running and accessible
   - Main API service running
   - Database migrations applied

### Monitoring Setup

#### Prometheus Integration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'scheduler'
    static_configs:
      - targets: ['scheduler:9266']
    metrics_path: '/metrics/prometheus'
    scrape_interval: 15s
```

#### Grafana Dashboard

Recommended metrics to monitor:

- `scheduler_health_status` - Overall service health
- `scheduler_component_status` - Individual component health
- `scheduler_queue_active` - Active job count
- `scheduler_queue_waiting` - Waiting job count
- `scheduler_queue_failed` - Failed job count
- `scheduler_dead_letter_count` - Dead-letter queue size
- `process_memory_usage_bytes` - Memory usage
- `process_cpu_usage_percent` - CPU usage

## Troubleshooting

### High Failed Job Count

**Symptoms**: `scheduler_queue_failed` metric increasing rapidly

**Possible Causes**:

1. API service down or unreachable
2. Database connection issues
3. Invalid job data

**Resolution**:

1. Check API health: `curl http://api:3000/health`
2. Check circuit breaker status in logs
3. Review dead-letter queue: Access Bull Board UI
4. Check job error messages for patterns

### Dead-Letter Queue Growing

**Symptoms**: `scheduler_dead_letter_count` > 0 and increasing

**Possible Causes**:

1. Persistent API failures
2. Data validation errors
3. Effect execution failures

**Resolution**:

1. Access Bull Board UI: http://localhost:9266/admin/queues
2. Review failed job details and error messages
3. Fix underlying issue (API, data, schema)
4. Retry jobs from Bull Board or clear DLQ

### Redis Connection Failures

**Symptoms**: Health check shows Redis component as `down`

**Possible Causes**:

1. Redis service not running
2. Network connectivity issues
3. Authentication failures

**Resolution**:

1. Verify Redis is running: `redis-cli ping`
2. Check `REDIS_URL` environment variable
3. Check Redis logs for authentication or connection errors
4. Test connection: `redis-cli -u $REDIS_URL ping`

### High Memory Usage

**Symptoms**: `process_memory_usage_bytes{type="rss"}` increasing over time

**Possible Causes**:

1. Memory leak in job processor
2. Large job payloads
3. Cache not being cleaned

**Resolution**:

1. Monitor `heap_used` vs `heap_total` metrics
2. Check for large jobs in Bull Board
3. Review cache configuration (TTL, max size)
4. Restart service if memory leak suspected

### Cron Jobs Not Executing

**Symptoms**: No jobs being queued at scheduled times

**Possible Causes**:

1. Cron service not started
2. Invalid cron expression
3. Service shutdown

**Resolution**:

1. Check service logs for cron registration messages
2. Verify cron expressions in environment variables
3. Ensure `@nestjs/schedule` module is loaded
4. Check for exceptions in ScheduleService

### API Circuit Breaker Open

**Symptoms**: Logs show "Circuit breaker open" messages

**Possible Causes**:

1. API service experiencing high error rate (>50%)
2. Network issues between scheduler and API
3. Database issues in API service

**Resolution**:

1. Check API health and logs
2. Wait for circuit breaker to reset (30s default)
3. Reduce load on API if overwhelmed
4. Investigate root cause of API failures

---

## Additional Resources

- **NestJS Documentation**: https://docs.nestjs.com
- **Bull Documentation**: https://github.com/OptimalBits/bull
- **Prometheus Metrics**: https://prometheus.io/docs/introduction/overview/
- **Winston Logging**: https://github.com/winstonjs/winston

## License

See root LICENSE file.
