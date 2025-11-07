# TICKET-033 - Stage 1: Core Cache Service

## Goal

Create a foundational cache service abstraction that provides a unified interface for Redis operations with proper error handling, key generation, and TTL management. This service will be used by all subsequent caching implementations.

## Context

### Prerequisites

- Redis is already configured in `docker-compose.yml` (DB 1 for cache)
- NestJS cache-manager is likely already available or needs to be installed
- Existing `redis-cache.provider.ts` provides basic Redis connection

### Files to Create/Modify

- Create: `packages/api/src/common/cache/cache.service.ts` - Main cache service
- Create: `packages/api/src/common/cache/cache.module.ts` - Cache module registration
- Create: `packages/api/src/common/cache/cache-key.builder.ts` - Key generation utilities
- Create: `packages/api/src/common/cache/cache.types.ts` - TypeScript types/interfaces
- Modify: `packages/api/src/app.module.ts` - Import CacheModule globally
- Create: `packages/api/src/common/cache/__tests__/cache.service.test.ts` - Unit tests

### Patterns to Follow

- Use NestJS dependency injection with `@Injectable()`
- Constructor injection for Redis client: `@Inject(CACHE_MANAGER)`
- All methods should be async and return Promises
- Wrap Redis operations in try-catch with error logging
- Follow existing service patterns from `settlement.service.ts` (graceful degradation)

### Key Generation Strategy

Keys should be hierarchical and predictable:

```typescript
// Pattern: {prefix}:{entityType}:{entityId}:{branchId}
// Examples:
'computed-fields:settlement:123:main';
'settlements:kingdom:456:main';
'spatial:settlements-in-region:789:main';
```

## Tasks

### Development Tasks

- [ ] Install @nestjs/cache-manager and cache-manager-redis-store (if not already present)
- [ ] Create cache.types.ts with interfaces (CacheOptions, CacheStats, CacheKeyParams)
- [ ] Create cache-key.builder.ts with key generation utilities
- [ ] Create cache.service.ts with core methods: get(), set(), del(), delPattern(), getStats()
- [ ] Implement TTL management with configurable defaults from environment variables
- [ ] Add graceful degradation (return null on cache errors, don't throw)
- [ ] Create cache.module.ts with Redis configuration and service registration
- [ ] Import CacheModule globally in app.module.ts
- [ ] Add cache configuration to environment variables (.env.example)

### Testing Tasks

- [ ] Write unit tests for CacheKeyBuilder (key generation patterns)
- [ ] Write unit tests for CacheService with mocked Redis client
- [ ] Write unit tests for error handling (cache failures don't throw)
- [ ] Write unit tests for TTL configuration
- [ ] Write integration test with real Redis (docker-compose)

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
