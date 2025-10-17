# TICKET-015 Implementation Plan: Rules Engine Service Worker

## Overview

Create a dedicated Node.js worker service for the rules engine that evaluates conditions, maintains dependency graphs, performs incremental recomputation, and communicates with the API service.

## Architecture Decisions

### Service Communication

- **gRPC** for synchronous evaluation requests (low latency, type-safe)
- **Redis Pub/Sub** for asynchronous invalidation notifications
- **HTTP** health check endpoint for monitoring

### Technology Stack

- **NestJS** for consistency with API service
- **@grpc/grpc-js** for gRPC implementation
- **ioredis** for Redis pub/sub
- **node-cache** for in-memory caching
- **Prisma Client** for database access (read-only)

### Design Principles

- Stateless service (can scale horizontally)
- Cache evaluation results with invalidation
- Incremental recomputation using dependency graphs
- Graceful degradation on errors

## Implementation Stages

### Stage 1: Service Package Setup

**Goal**: Create rules-engine package with NestJS foundation and basic configuration

**Tasks**:

- [ ] Create `packages/rules-engine/` directory structure
- [ ] Add package.json with dependencies (@nestjs/core, @grpc/grpc-js, ioredis, prisma)
- [ ] Create tsconfig.json extending base configuration
- [ ] Add NestJS application bootstrap with basic module
- [ ] Configure environment variables (.env.example)
- [ ] Add npm scripts (dev, build, start, test, lint, type-check)
- [ ] Update root package.json workspace references
- [ ] Create basic README.md documenting the service

**Success Criteria**:

- Package builds successfully
- Service starts and logs startup message
- No TypeScript or linting errors

**Status**: Not Started

---

### Stage 2: gRPC Service Definition

**Goal**: Define gRPC protocol and implement server

**Tasks**:

- [ ] Create `proto/rules-engine.proto` with service definitions
  - EvaluateCondition RPC
  - EvaluateConditions (batch) RPC
  - GetEvaluationOrder RPC
  - ValidateDependencies RPC
- [ ] Generate TypeScript types from proto files
- [ ] Implement gRPC server in NestJS
- [ ] Create RulesEngineController with handler stubs
- [ ] Add gRPC interceptor for logging and error handling
- [ ] Write unit tests for gRPC controller

**Success Criteria**:

- gRPC server starts on configured port
- Can receive and respond to gRPC calls
- Proto definitions compile to TypeScript types
- Error handling returns proper gRPC status codes

**Status**: Not Started

---

### Stage 3: Evaluation Engine Core

**Goal**: Implement condition evaluation logic using existing services

**Tasks**:

- [ ] Create EvaluationEngineService
- [ ] Integrate ConditionEvaluationService from @campaign/api
- [ ] Integrate DependencyGraphService for graph operations
- [ ] Implement single condition evaluation
- [ ] Implement batch condition evaluation
- [ ] Add evaluation context building from entity data
- [ ] Handle errors and return detailed results
- [ ] Write unit tests for evaluation engine (mock dependencies)
- [ ] Write integration tests with actual Prisma queries

**Success Criteria**:

- Can evaluate conditions using JSONLogic
- Returns success/failure with values and traces
- Handles missing variables gracefully
- Performance <10ms per evaluation (without I/O)

**Status**: Not Started

---

### Stage 4: Dependency Graph Integration

**Goal**: Use dependency graphs for evaluation ordering and cycle detection

**Tasks**:

- [ ] Integrate DependencyGraphBuilderService
- [ ] Implement graph caching strategy (per campaign/branch)
- [ ] Add topological sort for evaluation order
- [ ] Implement cycle detection before evaluation
- [ ] Create invalidation tracking (which nodes need recomputation)
- [ ] Add incremental recomputation logic
- [ ] Write unit tests for dependency graph operations
- [ ] Write integration tests for incremental recomputation scenarios

**Success Criteria**:

- Evaluates conditions in dependency order
- Detects and reports cycles
- Only recomputes affected nodes on invalidation
- Graph caching reduces redundant database queries

**Status**: Not Started

---

### Stage 5: Caching Layer

**Goal**: Implement result caching with invalidation

**Tasks**:

- [ ] Create CacheService using node-cache
- [ ] Define cache key strategy (campaign:branch:nodeId)
- [ ] Implement cache get/set/invalidate operations
- [ ] Add TTL configuration (environment variable)
- [ ] Integrate cache with evaluation engine
- [ ] Implement cache warming on graph build
- [ ] Add cache statistics endpoint
- [ ] Write unit tests for cache service
- [ ] Write integration tests for cache invalidation scenarios

**Success Criteria**:

- Cached evaluations return in <5ms
- Cache invalidates correctly on state changes
- Cache respects TTL configuration
- Cache hit/miss metrics available

**Status**: Not Started

---

### Stage 6: Redis Pub/Sub for Invalidations

**Goal**: Subscribe to invalidation events from API service

**Tasks**:

- [ ] Create RedisService with ioredis client
- [ ] Subscribe to invalidation channels (condition._, variable._)
- [ ] Implement message handlers for each event type
- [ ] Trigger cache invalidation on messages
- [ ] Trigger dependency graph rebuild on structure changes
- [ ] Add connection retry logic and error handling
- [ ] Write unit tests for Redis service (mock Redis)
- [ ] Write integration tests with actual Redis instance

**Success Criteria**:

- Receives invalidation messages from API service
- Invalidates cache and graphs correctly
- Handles Redis connection failures gracefully
- Reconnects automatically on disconnect

**Status**: Not Started

---

### Stage 7: API Service Integration

**Goal**: Update API service to communicate with rules engine

**Tasks**:

- [ ] Add gRPC client to API service (@grpc/grpc-js)
- [ ] Create RulesEngineClient service in API package
- [ ] Integrate with FieldConditionResolver for computed fields
- [ ] Publish invalidation events to Redis on mutations
- [ ] Add fallback to direct evaluation if worker unavailable
- [ ] Add circuit breaker pattern for resilience
- [ ] Write integration tests for API <-> Worker communication
- [ ] Update CLAUDE.md with rules engine architecture

**Success Criteria**:

- API service sends evaluation requests to worker
- Computed fields use worker for evaluation
- Publishes Redis events on condition/variable changes
- Falls back gracefully if worker is down

**Status**: Not Started

---

### Stage 8: Health Checks and Monitoring

**Goal**: Add observability and health check endpoints

**Tasks**:

- [ ] Create HTTP health check endpoint (/health)
- [ ] Add readiness probe (checks Prisma, Redis connections)
- [ ] Add liveness probe (basic ping response)
- [ ] Implement metrics collection (evaluation count, latency, cache hits)
- [ ] Add structured logging with correlation IDs
- [ ] Create Prometheus metrics endpoint (optional)
- [ ] Add Docker health check configuration
- [ ] Document monitoring setup in README

**Success Criteria**:

- Health endpoint returns 200 when healthy
- Readiness probe verifies dependencies
- Logs include request IDs for tracing
- Metrics show evaluation performance

**Status**: Not Started

---

### Stage 9: Docker and Deployment

**Goal**: Containerize service and update deployment configuration

**Tasks**:

- [ ] Create Dockerfile for rules-engine service
- [ ] Add docker-compose service definition
- [ ] Configure environment variables for Docker
- [ ] Add volume mounts for development
- [ ] Update root docker-compose.yml
- [ ] Test full stack startup with docker-compose
- [ ] Document Docker setup in README
- [ ] Update root README.md with rules engine architecture

**Success Criteria**:

- Service builds in Docker
- Starts via docker-compose alongside other services
- Can communicate with API and database containers
- Hot reload works in development mode

**Status**: Not Started

---

### Stage 10: Performance Testing and Optimization

**Goal**: Verify performance meets acceptance criteria (<50ms)

**Tasks**:

- [ ] Create performance test suite
- [ ] Benchmark single evaluation latency
- [ ] Benchmark batch evaluation throughput
- [ ] Benchmark cache hit/miss scenarios
- [ ] Profile with Node.js profiler to find bottlenecks
- [ ] Optimize hot paths if needed
- [ ] Add performance regression tests
- [ ] Document performance characteristics in README

**Success Criteria**:

- Typical evaluations complete in <50ms (p95)
- Cached evaluations complete in <5ms (p95)
- Can handle 100+ concurrent evaluation requests
- Performance tests run in CI pipeline

**Status**: Not Started

---

## Testing Strategy

### Unit Tests

- Each service class has isolated unit tests with mocked dependencies
- Test coverage target: >80%

### Integration Tests

- Test actual gRPC communication
- Test Redis pub/sub with real Redis instance
- Test Prisma queries against test database
- Test full evaluation flow end-to-end

### Performance Tests

- Latency benchmarks for evaluation operations
- Cache performance tests
- Load testing for concurrent requests

## Rollout Plan

1. Deploy rules-engine worker alongside API service
2. Enable feature flag for using worker (default: false)
3. Monitor performance and error rates
4. Gradually increase traffic to worker
5. Switch default to worker when stable
6. Keep fallback to direct evaluation for resilience

## Future Enhancements (Out of Scope)

- Distributed caching with Redis (use node-cache for MVP)
- Persistent evaluation result storage
- Real-time evaluation streaming via gRPC streaming
- Multi-tenancy with dedicated worker pools per campaign
- Advanced metrics and dashboards (Grafana)

## Notes

- Worker shares Prisma schema with API service but has read-only access
- Cache invalidation is eventually consistent (acceptable trade-off for MVP)
- Service is stateless and can scale horizontally behind load balancer
- Error handling follows defensive programming (fail gracefully, log details)
