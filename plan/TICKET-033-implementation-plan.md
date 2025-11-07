# TICKET-033 Implementation Plan

## Ticket

[Link to ticket: See [TICKET-033.md](TICKET-033.md)]

## Overview

Implement a comprehensive Redis-based caching layer to improve performance of computed field evaluations, spatial queries, and entity lookups. The primary target is the computed fields system which currently causes N+1 query problems and expensive Rules Engine evaluations (100-500ms per entity). Secondary targets include spatial queries and entity batch operations.

The implementation will follow a tiered approach:

1. **Tier 1 (Highest Priority)**: Computed fields caching - eliminates 100-500ms per entity evaluation
2. **Tier 2**: Entity list caching - reduces database round-trips for kingdom → settlements queries
3. **Tier 3**: Spatial query caching - optimizes expensive PostGIS operations
4. **Tier 4**: Integration with existing Rules Engine cache

## Architecture Considerations

### Existing Infrastructure

- Redis is already configured in docker-compose (DB 0 for pub/sub, DB 1 for cache)
- Rules Engine has in-memory NodeCache with prefix-based invalidation patterns
- WebSocket pub/sub system exists for real-time updates
- Dependency graph system tracks entity relationships

### Cache Key Strategy

Use hierarchical keys with prefixes for easy invalidation:

- `computed-fields:{entityType}:{entityId}:{branchId}` - Individual computed fields
- `settlements:kingdom:{kingdomId}:{branchId}` - Settlement lists by kingdom
- `structures:settlement:{settlementId}:{branchId}` - Structure lists by settlement
- `spatial:{queryType}:{params}:{branchId}` - Spatial query results

### TTL Policies

- Computed fields: 300s (5 min) - balance freshness vs performance
- Entity lists: 600s (10 min) - less frequently changed
- Spatial queries: 300s (5 min) - geometry changes are infrequent
- Expression cache: 3600s (1 hour) - existing Rules Engine policy

### Cascading Invalidation Strategy

Parent-child relationships require cascading invalidation:

```
Campaign level change (FieldCondition) → invalidate ALL computed fields
Settlement change → invalidate settlement + its structures + spatial cache
Structure change → invalidate structure + parent settlement
StateVariable change → invalidate entity's computed fields
```

### Error Handling Philosophy

- Cache failures should NOT break functionality (graceful degradation)
- Log cache errors but continue with direct database queries
- Use try-catch around all cache operations
- Return fresh data if cache operation fails

### Testing Strategy

- Unit tests: Test CacheService methods in isolation with mocked Redis
- Integration tests: Test cache behavior with real Redis (docker-compose)
- E2E tests: Verify invalidation flows work end-to-end
- Performance tests: Measure cache hit rates and response time improvements

### Code Patterns to Follow

- Constructor injection with `@Inject(REDIS_CACHE)` or `@Inject(CACHE_MANAGER)`
- Use NestJS @nestjs/cache-manager for standardized cache interface
- Async/await throughout (no callbacks)
- User permission checks before cache operations
- Audit logging for cache invalidation events

## Implementation Stages

| Stage                           | Status      | File                                           |
| ------------------------------- | ----------- | ---------------------------------------------- |
| Stage 1: Core Cache Service     | complete    | [TICKET-033-stage-1.md](TICKET-033-stage-1.md) |
| Stage 2: Computed Fields Cache  | not started | [TICKET-033-stage-2.md](TICKET-033-stage-2.md) |
| Stage 3: Entity List Cache      | not started | [TICKET-033-stage-3.md](TICKET-033-stage-3.md) |
| Stage 4: Spatial Query Cache    | not started | [TICKET-033-stage-4.md](TICKET-033-stage-4.md) |
| Stage 5: Cascading Invalidation | not started | [TICKET-033-stage-5.md](TICKET-033-stage-5.md) |
| Stage 6: Monitoring & Stats     | not started | [TICKET-033-stage-6.md](TICKET-033-stage-6.md) |

**Status Values:**

- `not started` - Stage has not been begun
- `in progress` - At least one task complete, but not all
- `complete` - All tasks in stage are complete

## Progress Notes

[Add notes here as implementation progresses]

## Commit History

[Updated as stages are completed:]

- Stage 1: `f78df73` - Core cache service infrastructure with CacheService, CacheKeyBuilder, and CacheModule
