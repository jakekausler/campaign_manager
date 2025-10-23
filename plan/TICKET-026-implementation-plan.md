# TICKET-026: Scheduler Service Worker - Implementation Plan

## Overview

Create a standalone NestJS scheduler service that manages time-based operations including world-time progression, deferred effect execution, scheduled event triggering, and Settlement/Structure periodic events (growth, construction, maintenance). The service uses node-cron for scheduling, Bull queue for job management, and Redis for pub/sub integration with the main API.

## Architecture Decisions

### Service Type

- **Standalone NestJS microservice** (similar to rules-engine pattern) running as separate process
- **Location**: `packages/scheduler/` (already exists with basic structure)
- **Communication**: REST API for job management, Redis pub/sub for event notifications
- **Job Queue**: Bull (Redis-based) for reliable job execution with retries

### Key Features

1. **Cron-based scheduling** using node-cron for periodic tasks
2. **Job queue system** using Bull for reliable deferred effect execution
3. **Event expiration handling** - mark events as expired if scheduledAt < currentWorldTime
4. **Settlement growth scheduling** - population changes, resource generation, level progression
5. **Structure scheduling** - construction completion, maintenance cycles, upgrade workflows
6. **Redis integration** - pub/sub for world time changes, entity updates
7. **Health checks** - monitoring endpoints for service health

### Integration Points

- **API Service**: REST endpoints for triggering scheduler operations
- **World Time System**: Subscribe to time advancement events via Redis
- **Effect System**: Execute deferred effects when conditions are met
- **Settlement/Structure Services**: Trigger periodic events via GraphQL mutations

## Stages

### Stage 1: Service Foundation & Configuration ✅

**Status**: COMPLETED
**Commit**: a48a6ff

**Goal**: Set up NestJS scheduler service with proper configuration, dependency injection, and TypeScript infrastructure

**Tasks**:

- [x] Install dependencies (Bull, bull-board, ioredis, @nestjs/bull, @nestjs/schedule)
- [x] Create NestJS module structure (AppModule, SchedulerModule, ConfigModule)
- [x] Set up environment configuration (Redis URL, API URL, port, log level)
- [x] Configure Bull connection with Redis
- [x] Add health check endpoint (GET /health)
- [x] Update tsconfig.json for NestJS patterns
- [x] Create Dockerfile for containerization
- [x] Add to docker-compose.yml alongside API and rules-engine

**Acceptance Criteria**:

- [x] Service starts without errors
- [x] Health check returns 200 OK
- [x] Can connect to Redis
- [x] Logs startup information

**Testing**:

- [x] Unit tests for ConfigModule (31 tests passing)
- [x] Integration test for health endpoint
- [x] Manual verification of Redis connection

**Implementation Notes**:

- Created NestJS service with modular architecture (ConfigModule, HealthModule)
- ConfigService validates all required environment variables on startup (fail-fast)
- HealthController provides HTTP endpoint for Docker health checks
- Bull queue integration configured with Redis connection
- Security enhancements: No sensitive data in logs, JWT token warnings
- Docker configuration updated with proper health checks and environment variables
- Port clarification: localhost:9264 for local dev, api:3000 in Docker
- All acceptance criteria met with comprehensive test coverage

---

### Stage 2: Job Queue System with Bull ✅

**Goal**: Implement Bull queue system for reliable job execution with retries, priorities, and dead-letter handling

**Tasks**:

- [ ] Create QueueModule with Bull configuration
- [ ] Define job types enum (DEFERRED_EFFECT, SETTLEMENT_GROWTH, STRUCTURE_MAINTENANCE, EVENT_EXPIRATION)
- [ ] Create base Job interface with type, payload, campaignId
- [ ] Implement job processor with type routing
- [ ] Add job retry logic (exponential backoff, max 3 attempts)
- [ ] Add job priority system (0-10, higher = more urgent)
- [ ] Add dead-letter queue for failed jobs
- [ ] Create Bull Board UI for job monitoring (development only)
- [ ] Add job queue metrics (active, waiting, completed, failed)

**Acceptance Criteria**:

- Jobs can be queued and processed
- Failed jobs retry with exponential backoff
- Dead-letter queue captures unrecoverable failures
- Bull Board accessible at /admin/queues in development

**Testing**:

- Unit tests for job processor
- Integration tests for retry logic
- Test priority ordering
- Test dead-letter queue

---

### Stage 3: Cron Scheduling Engine ✅

**Goal**: Implement cron-based scheduling using @nestjs/schedule for periodic tasks

**Tasks**:

- [ ] Create ScheduleService with @nestjs/schedule decorators
- [ ] Add periodic task: check event expiration (every 5 minutes)
- [ ] Add periodic task: process settlement growth (every hour)
- [ ] Add periodic task: process structure maintenance (every hour)
- [ ] Add configurable cron expressions via environment variables
- [ ] Add dynamic schedule management (enable/disable tasks)
- [ ] Add task execution logging with timestamps
- [ ] Add task error handling with alerting

**Acceptance Criteria**:

- Cron tasks execute on schedule
- Tasks can be dynamically enabled/disabled
- Execution logs show task runs
- Errors are logged and don't crash service

**Testing**:

- Unit tests for ScheduleService
- Manual verification of cron execution
- Test error handling
- Test dynamic enable/disable

---

### Stage 4: Deferred Effect Execution ✅

**Goal**: Execute effects from Effect System when timing conditions are met

**Tasks**:

- [ ] Create DeferredEffectService
- [ ] Add method: queueDeferredEffect(effectId, executeAt, campaignId)
- [ ] Implement job processor for DEFERRED_EFFECT job type
- [ ] Query API for effect details (GET /effects/:id)
- [ ] Execute effect via API mutation (POST /effects/:id/execute)
- [ ] Handle execution results (success, error)
- [ ] Add retry logic for transient API failures
- [ ] Create audit log for deferred executions

**Acceptance Criteria**:

- Effects can be scheduled for future execution
- Effects execute at specified time
- Execution results are logged
- Failed effects retry up to 3 times

**Testing**:

- Unit tests for DeferredEffectService
- Integration test with mock API
- Test retry logic
- Test execution at future time (use fake timers)

---

### Stage 5: Event Expiration Handling ✅

**Goal**: Mark events as expired if their scheduledAt time has passed

**Tasks**:

- [ ] Create EventExpirationService
- [ ] Query API for events with scheduledAt < currentWorldTime and isCompleted = false
- [ ] Mark events as expired via API mutation (PATCH /events/:id/expire)
- [ ] Handle batch expiration (process multiple events)
- [ ] Add configurable expiration window (e.g., grace period)
- [ ] Log expiration actions
- [ ] Integrate with cron schedule (every 5 minutes)

**Acceptance Criteria**:

- Overdue events are detected
- Events are marked as expired via API
- Batch processing works for multiple events
- Expiration actions are logged

**Testing**:

- Unit tests for EventExpirationService
- Integration test with mock API
- Test batch expiration
- Test grace period handling

---

### Stage 6: Settlement Growth Scheduling ✅

**Goal**: Schedule and execute periodic settlement growth events (population, resources, level progression)

**Tasks**:

- [ ] Create SettlementSchedulingService
- [ ] Define growth event types (POPULATION_GROWTH, RESOURCE_GENERATION, LEVEL_UP_CHECK)
- [ ] Query API for settlements with active growth schedules
- [ ] Calculate next growth event time based on settlement level and variables
- [ ] Queue growth jobs with appropriate timing
- [ ] Implement job processor for SETTLEMENT_GROWTH job type
- [ ] Execute growth effects via Effect System (create/execute effects)
- [ ] Update settlement typed variables after growth
- [ ] Handle settlement-specific growth rates from variables
- [ ] Log growth events for audit trail

**Acceptance Criteria**:

- Settlements schedule growth events based on level
- Growth events execute at correct times
- Effects mutate settlement state correctly
- Typed variables influence growth rates
- Growth events are logged

**Testing**:

- Unit tests for SettlementSchedulingService
- Integration test with mock API
- Test growth rate calculations
- Test variable-driven growth

---

### Stage 7: Structure Scheduling ✅

**Goal**: Schedule and execute structure construction completion, maintenance, and upgrades

**Tasks**:

- [ ] Create StructureSchedulingService
- [ ] Define structure event types (CONSTRUCTION_COMPLETE, MAINTENANCE_DUE, UPGRADE_AVAILABLE)
- [ ] Query API for structures with active schedules
- [ ] Schedule construction completion based on constructionStartedAt + duration
- [ ] Schedule maintenance based on lastMaintenanceAt + interval
- [ ] Implement job processor for STRUCTURE_MAINTENANCE job type
- [ ] Execute structure effects via Effect System
- [ ] Update structure typed variables (isOperational, health, etc.)
- [ ] Handle structure dependencies (e.g., requires settlement resources)
- [ ] Log structure events

**Acceptance Criteria**:

- Construction completes at scheduled time
- Maintenance schedules repeat correctly
- Effects mutate structure state correctly
- Dependencies are checked before execution
- Structure events are logged

**Testing**:

- Unit tests for StructureSchedulingService
- Integration test with mock API
- Test construction completion
- Test maintenance cycles
- Test dependency checking

---

### Stage 8: Redis Pub/Sub Integration ✅

**Goal**: Subscribe to Redis events for world time changes and entity updates to trigger scheduler reactions

**Tasks**:

- [ ] Create RedisSubscriberService
- [ ] Subscribe to channel: campaign.{campaignId}.worldTimeAdvanced
- [ ] Subscribe to channel: campaign.{campaignId}.entityModified
- [ ] On worldTimeAdvanced: trigger event expiration check
- [ ] On worldTimeAdvanced: recalculate settlement/structure schedules
- [ ] On entityModified (Settlement): update growth schedule
- [ ] On entityModified (Structure): update maintenance schedule
- [ ] Add error handling for subscription failures
- [ ] Add reconnection logic for Redis failures

**Acceptance Criteria**:

- Service subscribes to Redis channels on startup
- World time changes trigger appropriate reactions
- Entity modifications update schedules
- Redis failures don't crash service
- Reconnection works after Redis downtime

**Testing**:

- Unit tests for RedisSubscriberService
- Integration test with real Redis
- Test reconnection logic
- Manual verification of event reactions

---

### Stage 9: API Client & GraphQL Integration ✅

**Goal**: Create API client for querying and mutating data in the main API service

**Tasks**:

- [ ] Create ApiClientService with axios
- [ ] Add authentication (JWT token from service account)
- [ ] Implement GraphQL query methods (getSettlements, getStructures, getEvents, getEffects)
- [ ] Implement GraphQL mutation methods (executeEffect, completeEvent, updateSettlement, updateStructure)
- [ ] Add request retry logic for transient failures
- [ ] Add circuit breaker pattern for API downtime
- [ ] Add request timeout configuration
- [ ] Cache frequently accessed data (campaigns, effect definitions)

**Acceptance Criteria**:

- API client can query GraphQL endpoints
- Mutations execute successfully
- Retries work for transient failures
- Circuit breaker opens during API downtime
- Requests timeout after configured duration

**Testing**:

- Unit tests for ApiClientService (mocked axios)
- Integration test with mock GraphQL server
- Test retry logic
- Test circuit breaker
- Test timeout handling

---

### Stage 10: Monitoring & Health Checks ✅

**Goal**: Add comprehensive monitoring, metrics, and health checks for observability

**Tasks**:

- [ ] Extend health check endpoint with detailed status
- [ ] Add metrics endpoint (GET /metrics) with Prometheus format
- [ ] Track metrics: jobs queued, jobs completed, jobs failed, API requests, Redis connection status
- [ ] Add logging with structured format (JSON)
- [ ] Add log levels (DEBUG, INFO, WARN, ERROR)
- [ ] Create dashboard config for Grafana (optional, future)
- [ ] Add alerting hooks for critical failures
- [ ] Document monitoring setup in README

**Acceptance Criteria**:

- Health check shows Redis, API, and queue status
- Metrics endpoint returns Prometheus format
- Logs are structured and filterable
- Critical failures trigger alerts
- Monitoring documentation is complete

**Testing**:

- Unit tests for metrics collection
- Manual verification of Prometheus format
- Test health check during failures
- Verify alert triggers

---

### Stage 11: Testing & Documentation ✅

**Goal**: Comprehensive testing and documentation for scheduler service

**Tasks**:

- [ ] Write unit tests for all services (target 80%+ coverage)
- [ ] Write integration tests for end-to-end workflows
- [ ] Add E2E tests with real Redis and mock API
- [ ] Create scheduler service README.md with:
  - Architecture overview
  - Configuration options
  - Job types and payloads
  - Cron schedules
  - API endpoints
  - Deployment guide
  - Troubleshooting guide
- [ ] Update root CLAUDE.md with scheduler documentation
- [ ] Update docker-compose.yml with scheduler service
- [ ] Add scheduler section to main README.md
- [ ] Create docs/features/scheduler-service.md

**Acceptance Criteria**:

- Test coverage >80%
- All integration tests pass
- README is complete and clear
- Documentation is comprehensive
- Docker setup works

**Testing**:

- Run full test suite
- Verify E2E tests
- Manual review of documentation
- Test Docker deployment

---

### Stage 12: Performance Optimization & Polish ✅

**Goal**: Optimize performance, add final polish, and prepare for production

**Tasks**:

- [ ] Profile job execution times
- [ ] Optimize database queries (batching, caching)
- [ ] Add connection pooling for API requests
- [ ] Implement graceful shutdown (drain queues)
- [ ] Add job concurrency limits (prevent overload)
- [ ] Add rate limiting for API requests
- [ ] Test under load (simulate many jobs)
- [ ] Add production deployment guide
- [ ] Final code review and cleanup
- [ ] Update TICKET-026.md with completion notes

**Acceptance Criteria**:

- Job execution is performant (<2s avg)
- Graceful shutdown drains queues
- Service handles load without crashing
- Production deployment guide is clear
- Code review passes

**Testing**:

- Load testing with 1000+ jobs
- Test graceful shutdown
- Verify no memory leaks
- Performance benchmarks

---

## Dependencies

- **TICKET-010**: World Time System (currentWorldTime, advanceWorldTime mutation)
- **TICKET-016**: Effect System (Effect model, executeEffect mutation)
- **TICKET-025**: Event & Encounter Resolution (completeEvent, resolveEncounter mutations)
- **Redis**: For Bull queue and pub/sub
- **Main API**: For GraphQL queries and mutations

## Technical Stack

- **NestJS**: Framework for scheduler service
- **Bull**: Redis-based job queue
- **node-cron**: Already installed for cron scheduling (or use @nestjs/schedule)
- **@nestjs/schedule**: Alternative cron implementation with decorators
- **ioredis**: Redis client for Bull and pub/sub
- **axios**: HTTP client for API requests
- **bull-board**: UI for monitoring job queues (development)

## Configuration

Environment variables for `packages/scheduler/.env`:

```bash
# Service Configuration
NODE_ENV=development
PORT=9266
LOG_LEVEL=info

# Redis Configuration
REDIS_URL=redis://localhost:6379

# API Configuration
API_URL=http://localhost:9264/graphql
API_SERVICE_ACCOUNT_TOKEN=<generated-jwt-token>

# Cron Schedules (override defaults)
CRON_EVENT_EXPIRATION=*/5 * * * *  # Every 5 minutes
CRON_SETTLEMENT_GROWTH=0 * * * *   # Every hour
CRON_STRUCTURE_MAINTENANCE=0 * * * * # Every hour

# Job Queue Configuration
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_BACKOFF_MS=5000
QUEUE_CONCURRENCY=5

# API Client Configuration
API_REQUEST_TIMEOUT_MS=10000
API_CIRCUIT_BREAKER_THRESHOLD=5
API_CIRCUIT_BREAKER_DURATION_MS=30000
```

## Success Metrics

- [ ] All 12 stages completed
- [ ] Test coverage >80%
- [ ] All acceptance criteria met
- [ ] Documentation complete
- [ ] Scheduler runs in production
- [ ] Jobs execute on schedule
- [ ] No memory leaks or crashes

## Notes

- Scheduler service will be similar in architecture to rules-engine worker
- Use Bull for reliable job processing with retries
- Settlement/Structure scheduling will leverage typed variables for customization
- Event expiration should have grace period to avoid premature expiration
- Consider future enhancements: webhook notifications, advanced scheduling (recurring events), job cancellation API
