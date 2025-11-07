# TICKET-033 - Stage 6: Monitoring & Statistics

## Goal

Implement cache monitoring, statistics collection, and observability features to track cache performance, hit rates, and identify optimization opportunities.

## Context

### Prerequisites

- Stage 1-5 complete: Full caching system implemented
- Need visibility into cache effectiveness

### Monitoring Requirements

From acceptance criteria:

- Cache statistics should be available
- Need to track cache hits vs misses
- Monitor cache size and memory usage
- Track invalidation frequency
- Measure performance improvements

### Metrics to Collect

1. **Hit/Miss Rates**:
   - Total hits, misses per cache type (computed-fields, settlements, structures, spatial)
   - Hit rate percentage per cache type
   - Reset period (daily, hourly, or configurable)

2. **Performance**:
   - Cache operation latency (get, set, delete)
   - Time saved by cache hits (estimated)
   - Response time improvement percentages

3. **Invalidation**:
   - Invalidation count per cache type
   - Cascade invalidation count
   - Pattern-based invalidation count

4. **Size/Memory**:
   - Number of keys per cache type
   - Memory usage (if available from Redis INFO)
   - TTL distribution

### Implementation Approach

- Add statistics tracking to CacheService
- Use in-memory counters for hit/miss (lightweight)
- Optionally persist stats to Redis for cross-instance visibility
- Expose statistics via GraphQL query for admin dashboard
- Add cache health endpoint for monitoring tools
- Consider integration with existing logging/monitoring infrastructure

### Files to Modify/Create

- `packages/api/src/common/cache/cache.service.ts` - Add statistics tracking methods
- `packages/api/src/common/cache/cache-stats.service.ts` - Dedicated statistics service
- `packages/api/src/graphql/resolvers/cache-stats.resolver.ts` - GraphQL resolver for stats
- `packages/api/src/graphql/schema/cache-stats.graphql` - GraphQL schema for stats
- `packages/api/src/common/health/cache-health.indicator.ts` - Health check indicator

### Patterns to Follow

- Use decorator pattern to wrap cache operations with statistics
- Atomic increment operations for thread-safe counters
- Lazy initialization of stats (don't slow down first request)
- Graceful degradation (stats failures don't break caching)
- Admin-only access to stats endpoints (permission check)

## Tasks

### Development Tasks

- [ ] Create cache-stats.service.ts with counters for hits/misses/invalidations
- [ ] Add statistics tracking to CacheService.get() (increment hit/miss)
- [ ] Add statistics tracking to CacheService.set() (increment sets)
- [ ] Add statistics tracking to CacheService.del() and delPattern() (increment invalidations)
- [ ] Create method to calculate hit rate percentage per cache type
- [ ] Create method to estimate time saved by cache hits
- [ ] Add method to query Redis INFO for memory usage
- [ ] Add method to count keys per cache type (using SCAN with patterns)
- [ ] Create GraphQL schema for CacheStats type (hits, misses, hitRate, invalidations, etc.)
- [ ] Create cache-stats.resolver.ts with getCacheStats query (admin-only)
- [ ] Create cache-health.indicator.ts for NestJS health check
- [ ] Register health indicator in health.module.ts
- [ ] Add configuration for stats reset period (environment variable)
- [ ] Add admin permission check to stats resolver

### Testing Tasks

- [ ] Write unit test: Hit counter increments on cache hit
- [ ] Write unit test: Miss counter increments on cache miss
- [ ] Write unit test: Invalidation counter increments on delete
- [ ] Write unit test: Hit rate calculation is correct
- [ ] Write unit test: Stats reset works correctly
- [ ] Write integration test: Stats persist across cache operations
- [ ] Write integration test: GraphQL query returns stats (with admin auth)
- [ ] Write integration test: Health check endpoint returns cache status
- [ ] Write E2E test: Verify stats accuracy over multiple cache operations

### Quality Assurance Tasks

- [ ] Run tests (use TypeScript Tester subagent)
- [ ] Fix test failures (if any exist from previous task)
- [ ] Run type-check and lint (use TypeScript Fixer subagent)
- [ ] Fix type/lint errors (if any exist from previous task)

### Review and Commit Tasks

- [ ] Run code review (use Code Reviewer subagent - MANDATORY)
- [ ] Address code review feedback (if any exists from previous task)
- [ ] Commit stage changes with detailed conventional commit message

## Implementation Notes

[Add notes here as tasks are completed]

## Commit Hash

[Added when final commit task is complete]
