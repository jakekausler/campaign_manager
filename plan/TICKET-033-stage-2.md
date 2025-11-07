# TICKET-033 - Stage 2: Computed Fields Cache

## Goal

Implement caching for computed field evaluations in Settlement and Structure services. This is the highest-priority optimization as computed fields currently cause N+1 query problems and expensive Rules Engine evaluations (100-500ms per entity).

## Context

### Prerequisites

- Stage 1 complete: Core CacheService available
- Computed fields are evaluated in:
  - `packages/api/src/graphql/services/settlement.service.ts:850-1011` - `getComputedFields()`
  - `packages/api/src/graphql/services/structure.service.ts:892-1053` - `getComputedFields()`

### Current Performance Problem

When loading 10 settlements with computed fields:

1. Each settlement calls `getComputedFields(settlementId)`
2. Each call fetches field conditions (1 DB query)
3. Each call builds evaluation context (fetches related data)
4. Each call evaluates expressions via Rules Engine (100-500ms)
5. Total: 10+ DB queries + 10 Rules Engine calls = 1-5 seconds

### Cache Strategy

- **Key format**: `computed-fields:{entityType}:{entityId}:{branchId}`
- **TTL**: 300 seconds (5 minutes)
- **Cache location**: Wrap the existing `getComputedFields()` logic
- **Invalidation triggers**: Entity updates, FieldCondition changes, StateVariable changes

### Files to Modify

- `packages/api/src/graphql/services/settlement.service.ts` - Add caching to `getComputedFields()`
- `packages/api/src/graphql/services/structure.service.ts` - Add caching to `getComputedFields()`
- `packages/api/src/graphql/services/settlement.service.ts` - Add cache invalidation to `update()`, `setLevel()`, `updateSettlementAndStructures()`
- `packages/api/src/graphql/services/structure.service.ts` - Add cache invalidation to `update()`, `setLevel()`

### Patterns to Follow

- Inject CacheService via constructor
- Check cache first, return if hit
- On cache miss, compute normally and store result
- Wrap cache operations in try-catch (graceful degradation)
- Log cache hits/misses for monitoring
- Invalidate cache on entity mutations

## Tasks

### Development Tasks

- [ ] Inject CacheService into SettlementService constructor
- [ ] Modify `SettlementService.getComputedFields()` to check cache before computing
- [ ] Add cache.set() after computing fields in SettlementService
- [ ] Add cache invalidation to `SettlementService.update()` method
- [ ] Add cache invalidation to `SettlementService.setLevel()` method
- [ ] Add cache invalidation to `SettlementService.updateSettlementAndStructures()` method
- [ ] Inject CacheService into StructureService constructor
- [ ] Modify `StructureService.getComputedFields()` to check cache before computing
- [ ] Add cache.set() after computing fields in StructureService
- [ ] Add cache invalidation to `StructureService.update()` method
- [ ] Add cache invalidation to `StructureService.setLevel()` method
- [ ] Add logging for cache hits/misses (debug level)

### Testing Tasks

- [ ] Write unit test: Settlement computed fields cache hit returns cached data
- [ ] Write unit test: Settlement computed fields cache miss computes and stores
- [ ] Write unit test: Settlement update invalidates computed fields cache
- [ ] Write unit test: Structure computed fields cache hit returns cached data
- [ ] Write unit test: Structure computed fields cache miss computes and stores
- [ ] Write unit test: Structure update invalidates computed fields cache
- [ ] Write integration test: End-to-end cache behavior with real Redis
- [ ] Write integration test: Verify cache invalidation on entity mutations

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
