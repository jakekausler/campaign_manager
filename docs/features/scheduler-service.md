# Scheduler Service Worker

**Status**: ✅ Implemented (TICKET-026)
**Package**: `@campaign/scheduler`
**Location**: `packages/scheduler/`

## Overview

The Scheduler Service is a standalone NestJS microservice that manages time-based operations for the campaign management system. It handles world-time progression, deferred effect execution, scheduled event triggering, and periodic Settlement/Structure maintenance events.

## Architecture

### Service Type

- **Standalone NestJS microservice** running as a separate process (similar to rules-engine pattern)
- **Communication**: REST API for job management, Redis pub/sub for event notifications
- **Job Queue**: Bull (Redis-based) for reliable job execution with retries and priorities
- **Scheduling**: node-cron for periodic tasks via `@nestjs/schedule`

### Key Components

```
packages/scheduler/
├── src/
│   ├── api/                    # API client for main GraphQL service
│   │   └── api-client.service.ts
│   ├── config/                 # Environment configuration
│   │   └── config.service.ts
│   ├── effects/                # Deferred effect execution
│   │   └── deferred-effect.service.ts
│   ├── events/                 # Event expiration handling
│   │   └── event-expiration.service.ts
│   ├── health/                 # Health check endpoints
│   │   ├── health.controller.ts
│   │   └── health.service.ts
│   ├── logger/                 # Winston structured logging
│   │   └── logger.module.ts
│   ├── monitoring/             # Metrics and alerting
│   │   └── alerting.service.ts
│   ├── queue/                  # Bull job queue system
│   │   ├── queue.service.ts
│   │   ├── job-processor.service.ts
│   │   ├── metrics.controller.ts
│   │   └── dead-letter.service.ts
│   ├── redis/                  # Redis pub/sub integration
│   │   └── redis-subscriber.service.ts
│   ├── schedule/               # Cron task management
│   │   └── schedule.service.ts
│   ├── settlements/            # Settlement growth scheduling
│   │   └── settlement-scheduling.service.ts
│   └── structures/             # Structure maintenance scheduling
│       └── structure-scheduling.service.ts
├── Dockerfile
└── package.json
```

## Features

### 1. Job Queue System (Bull)

Reliable job execution with:

- **Retry logic**: Exponential backoff, max 3 attempts (configurable)
- **Priority system**: LOW (1), NORMAL (5), HIGH (8), CRITICAL (10)
- **Dead-letter queue**: Captures failed jobs after retry exhaustion
- **Bull Board UI**: Dev-only monitoring at `/admin/queues`

**Job Types**:

```typescript
enum JobType {
  DEFERRED_EFFECT = 'DEFERRED_EFFECT',
  EVENT_EXPIRATION = 'EVENT_EXPIRATION',
  SETTLEMENT_GROWTH = 'SETTLEMENT_GROWTH',
  STRUCTURE_MAINTENANCE = 'STRUCTURE_MAINTENANCE',
  RECALCULATE_SETTLEMENT_SCHEDULES = 'RECALCULATE_SETTLEMENT_SCHEDULES',
  RECALCULATE_STRUCTURE_SCHEDULES = 'RECALCULATE_STRUCTURE_SCHEDULES',
}
```

### 2. Cron Scheduling

Periodic tasks via `@nestjs/schedule`:

| Task                  | Default Schedule            | Description                          |
| --------------------- | --------------------------- | ------------------------------------ |
| Event Expiration      | `*/5 * * * *` (every 5 min) | Mark overdue events as expired       |
| Settlement Growth     | `0 * * * *` (hourly)        | Process settlement growth events     |
| Structure Maintenance | `0 * * * *` (hourly)        | Process structure maintenance events |

**Configurable via environment variables**:

```bash
CRON_EVENT_EXPIRATION=*/5 * * * *
CRON_SETTLEMENT_GROWTH=0 * * * *
CRON_STRUCTURE_MAINTENANCE=0 * * * *
```

### 3. Deferred Effect Execution

Execute effects from the Effect System when timing conditions are met:

- Queue effects with `executeAt` timestamp
- GraphQL integration with API service
- Circuit breaker pattern for API resilience
- Retry logic for transient failures
- Audit logging for all executions

**Example**:

```typescript
// Queue effect for future execution
await deferredEffectService.queueDeferredEffect(
  effectId: 'effect-123',
  executeAt: new Date('2025-10-25T12:00:00Z'),
  campaignId: 'campaign-1'
);
```

### 4. Event Expiration Handling

Mark events as expired if `scheduledAt` < `currentWorldTime`:

- **5-minute grace period**: Prevents premature expiration from scheduling delays
- **Batch processing**: 10 events per batch to prevent API overload
- **Sequential campaign processing**: Prioritizes safety over speed
- **Partial failure handling**: Tracks errors but allows job completion

**GraphQL Operations**:

- `getOverdueEvents(campaignId, gracePeriodMs)` - Query overdue events
- `expireEvent(eventId)` - Mark event as expired

### 5. Settlement Growth Scheduling

Periodic growth events for settlements:

**Growth Event Types**:

- `POPULATION_GROWTH`: Population increases based on growth rate
- `RESOURCE_GENERATION`: Generate resources (food, gold, materials)
- `LEVEL_UP_CHECK`: Check if settlement can level up

**Level-based Growth Multipliers**:
| Level | Multiplier | Effect |
|-------|-----------|--------|
| 1 | 1.0 | Baseline speed |
| 2 | 0.9 | 10% faster |
| 3 | 0.8 | 25% faster |
| 4 | 0.7 | 43% faster |
| 5 | 0.6 | 67% faster |

**Customizable via Settlement Variables**:

```json
{
  "populationGrowthIntervalMinutes": 60,
  "resourceGenerationIntervalMinutes": 60,
  "populationGrowthRate": 0.05,
  "generationRates": {
    "food": 10,
    "gold": 5,
    "materials": 3
  }
}
```

### 6. Structure Maintenance Scheduling

Periodic maintenance events for structures:

**Maintenance Event Types**:

- `CONSTRUCTION_COMPLETE`: Structure construction finishes
- `MAINTENANCE_DUE`: Regular maintenance required
- `UPGRADE_AVAILABLE`: Check if structure can upgrade

**Logic**:

- **Construction**: Only for structures with `constructionDurationMinutes > 0`
- **Maintenance**: Only for operational structures (`isOperational = true`)
- **Upgrade**: Only if `currentLevel < maxLevel` and operational

**Customizable via Structure Variables**:

```json
{
  "maintenanceIntervalMinutes": 120,
  "constructionDurationMinutes": 60,
  "isOperational": true,
  "level": 2,
  "maxLevel": 5,
  "health": 80
}
```

### 7. Redis Pub/Sub Integration

Subscribe to events from the main API:

**Channels**:

- `campaign.{campaignId}.worldTimeAdvanced` - World time changes
- `campaign.{campaignId}.entityModified` - Entity CRUD operations

**Reactions**:

- **World Time Advanced**:
  - Queue event expiration check (HIGH priority)
  - Recalculate settlement schedules
  - Recalculate structure schedules
- **Entity Modified (Settlement)**:
  - Update growth schedule (CREATE/UPDATE)
  - Skip scheduling (DELETE)
- **Entity Modified (Structure)**:
  - Update maintenance schedule (CREATE/UPDATE)
  - Skip scheduling (DELETE)

**Performance Optimizations**:

1. **Thundering herd prevention**: Queue jobs instead of direct service calls
2. **Deduplication**: 5-second cooldown per campaign prevents race conditions
3. **Responsive reconnection**: 60-second max backoff (down from 512s)

### 8. Monitoring & Health Checks

#### Health Check Endpoint

`GET /health`

Returns detailed component status:

```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2025-10-24T10:00:00.000Z",
  "version": "1.0.0",
  "components": {
    "redis": {
      "status": "up",
      "message": "Connected",
      "latency": 5
    },
    "redisSubscriber": {
      "status": "up",
      "message": "Connected"
    },
    "bullQueue": {
      "status": "up",
      "message": "Operational"
    },
    "api": {
      "status": "up",
      "message": "Reachable",
      "latency": 50
    }
  }
}
```

#### Metrics Endpoint (JSON)

`GET /metrics`

Returns queue metrics:

```json
{
  "queue": {
    "active": 5,
    "waiting": 10,
    "completed": 100,
    "failed": 2,
    "delayed": 3
  },
  "deadLetter": {
    "count": 1
  },
  "timestamp": "2025-10-24T10:00:00.000Z"
}
```

#### Prometheus Metrics

`GET /metrics/prometheus`

Returns Prometheus format metrics:

```
# HELP scheduler_queue_active Number of active jobs
# TYPE scheduler_queue_active gauge
scheduler_queue_active 5

# HELP scheduler_health_status Overall health status (0=unhealthy, 1=degraded, 2=healthy)
# TYPE scheduler_health_status gauge
scheduler_health_status 2

# HELP scheduler_component_status Component health status (0=down, 1=degraded, 2=up)
# TYPE scheduler_component_status gauge
scheduler_component_status{component="redis"} 2
scheduler_component_status{component="redis_subscriber"} 2
scheduler_component_status{component="bull_queue"} 2
scheduler_component_status{component="api"} 2
```

#### Structured Logging

Winston logger with environment-based formatting:

- **Production**: JSON format for log aggregation
- **Development**: Human-readable colored format

**Log Levels**: `DEBUG`, `INFO`, `WARN`, `ERROR` (configurable via `LOG_LEVEL`)

#### Alerting

Built-in alerting service with handler registration:

- **Severity levels**: CRITICAL, WARNING, INFO
- **Default handler**: Structured logging
- **Extensible**: Add PagerDuty, Slack, email handlers

## Configuration

Environment variables (`.env`):

```bash
# Service Configuration
NODE_ENV=development
PORT=9266
LOG_LEVEL=info

# Redis Configuration
REDIS_URL=redis://localhost:6379

# API Configuration
API_URL=http://localhost:9264/graphql
API_SERVICE_ACCOUNT_TOKEN=<api-key>  # Format: camp_sk_...

# Cron Schedules
CRON_EVENT_EXPIRATION=*/5 * * * *
CRON_SETTLEMENT_GROWTH=0 * * * *
CRON_STRUCTURE_MAINTENANCE=0 * * * *

# Job Queue Configuration
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_BACKOFF_MS=5000
QUEUE_CONCURRENCY=5

# API Client Configuration
API_REQUEST_TIMEOUT_MS=10000
API_CIRCUIT_BREAKER_THRESHOLD=5
API_CIRCUIT_BREAKER_DURATION_MS=30000
```

## Development

### Running Locally

```bash
# From project root
pnpm --filter @campaign/scheduler dev

# Or with Docker
docker-compose up scheduler
```

### Running Tests

```bash
# All tests
pnpm --filter @campaign/scheduler test

# Watch mode
pnpm --filter @campaign/scheduler test:watch

# With coverage
pnpm --filter @campaign/scheduler test --coverage
```

**Test Coverage**: 82.13% line coverage, 285 tests

### Bull Board UI

Access job queue UI in development:

```
http://localhost:9266/admin/queues
```

## Production Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @campaign/scheduler build
CMD ["node", "packages/scheduler/dist/main.js"]
```

### Docker Compose

```yaml
services:
  scheduler:
    build: .
    ports:
      - '9266:9266'
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - API_URL=http://api:3000/graphql
    depends_on:
      - redis
      - api
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9266/health']
      interval: 30s
      timeout: 10s
      retries: 3
```

### Monitoring with Prometheus + Grafana

1. **Prometheus Configuration** (`prometheus.yml`):

```yaml
scrape_configs:
  - job_name: 'scheduler'
    static_configs:
      - targets: ['scheduler:9266']
    metrics_path: '/metrics/prometheus'
```

2. **Grafana Dashboard**:
   - Queue metrics: active, waiting, completed, failed, delayed
   - Health status: overall + component-level
   - Process metrics: CPU, memory
   - Dead-letter queue count

## Integration with Other Services

### Main API Service

- **GraphQL Client**: Queries and mutations for entities, events, effects
- **Circuit Breaker**: Handles API downtime gracefully
- **Authentication**: API key authentication (format: `camp_sk_<32_base64url_chars>`)

### Rules Engine

- **Independent**: No direct integration
- **Shared Redis**: Both use Redis for pub/sub and caching

### Frontend

- **No direct integration**: Frontend interacts with main API only

## Troubleshooting

### Jobs Not Executing

1. Check Redis connection: `GET /health`
2. Check queue metrics: `GET /metrics`
3. Check Bull Board: `http://localhost:9266/admin/queues` (dev only)
4. Check dead-letter queue for failed jobs

### Redis Connection Failures

- Verify `REDIS_URL` environment variable
- Check Redis is running: `redis-cli ping`
- Review reconnection logs in scheduler output

### API Client Errors

- Verify `API_URL` points to GraphQL endpoint
- Check `API_SERVICE_ACCOUNT_TOKEN` is valid (format: `camp_sk_...`)
- Ensure API key has not been revoked or expired
- Review circuit breaker status in logs

### High Memory Usage

- Check for job queue buildup (delayed jobs)
- Review cache sizes in API client service
- Check for memory leaks with `--detectOpenHandles`

## Future Enhancements

Potential improvements for future tickets:

1. **Webhook Notifications**: Alert external systems on job failures
2. **Advanced Scheduling**: Recurring events with cron-like patterns
3. **Job Cancellation API**: REST endpoint to cancel queued jobs
4. **Graceful Shutdown**: Drain queues before stopping service
5. **Rate Limiting**: Prevent API overload with configurable limits
6. **Connection Pooling**: Optimize API request throughput

## Implementation Notes

### TICKET-026 Stages

The scheduler service was implemented across 11 stages:

1. **Stage 1**: Service foundation & configuration (commit: a48a6ff)
2. **Stage 2**: Job queue system with Bull (commit: 859dbc9)
3. **Stage 3**: Cron scheduling engine (commit: 24b0ba8)
4. **Stage 4**: Deferred effect execution (commit: c4a216f)
5. **Stage 5**: Event expiration handling (commit: a9f88ce)
6. **Stage 5a**: API support for event expiration (commit: 73a07cf)
7. **Stage 6**: Settlement growth scheduling (commit: cf18baf)
8. **Stage 7**: Structure scheduling (commit: 07edab0)
9. **Stage 8**: Redis pub/sub integration (commit: fb824ba)
10. **Stage 9**: API client & GraphQL integration (commit: 7a4f93f)
11. **Stage 10**: Monitoring & health checks (commit: 52b9c08)
12. **Stage 11**: Testing & documentation (commit: [TBD])

### Key Decisions

- **Bull over node-cron**: For reliability, retries, and persistence
- **Redis pub/sub**: For loose coupling with main API
- **Circuit breaker**: For resilience during API downtime
- **Batch processing**: For performance with many events
- **Graceful degradation**: Continue processing despite partial failures

### Testing Strategy

- **Unit tests**: 285 tests, 82.13% line coverage
- **Integration tests**: Redis and API mocking with MSW patterns
- **Test coverage by component**:
  - Settlement scheduling: 95.32%
  - Structure scheduling: 94.84%
  - Event expiration: 94.11%
  - Metrics controller: 100%
  - Queue services: 79-100%

See `packages/scheduler/README.md` for additional details on architecture, configuration, and deployment.
