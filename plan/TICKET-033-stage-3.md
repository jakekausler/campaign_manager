# TICKET-033 - Stage 3: Entity List Cache

## Goal

Implement caching for entity list queries (settlements by kingdom, structures by settlement) to reduce database round-trips for frequently accessed collections.

## Context

### Prerequisites

- Stage 1 complete: Core CacheService available
- Stage 2 complete: Computed fields caching established the pattern

### Current Query Patterns

Entity lists are loaded frequently:

- `SettlementService.findByKingdom(kingdomId)` - Returns all settlements in a kingdom
- `StructureService.findBySettlement(settlementId)` - Returns all structures in a settlement
- These queries are called when rendering kingdom views, map overlays, etc.

### Cache Strategy

- **Key format**:
  - `settlements:kingdom:{kingdomId}:{branchId}` - Settlement list by kingdom
  - `structures:settlement:{settlementId}:{branchId}` - Structure list by settlement
- **TTL**: 600 seconds (10 minutes) - longer than computed fields since lists change less frequently
- **Cache location**: Wrap the existing `findByKingdom()` and `findBySettlement()` methods
- **Invalidation triggers**:
  - Settlement created/deleted → invalidate kingdom's settlement list
  - Structure created/deleted → invalidate settlement's structure list

### Files to Modify

- `packages/api/src/graphql/services/settlement.service.ts` - Add caching to `findByKingdom()`
- `packages/api/src/graphql/services/structure.service.ts` - Add caching to `findBySettlement()`
- `packages/api/src/graphql/services/settlement.service.ts` - Add cache invalidation to `create()`, `delete()`, `archive()`
- `packages/api/src/graphql/services/structure.service.ts` - Add cache invalidation to `create()`, `delete()`, `archive()`

### Patterns to Follow

- Inject CacheService (already done in Stage 2)
- Check cache first, return if hit
- On cache miss, query database and store result
- Wrap cache operations in try-catch
- Invalidate parent collection cache on child create/delete

## Tasks

### Development Tasks

- [ ] Modify `SettlementService.findByKingdom()` to check cache before querying
- [ ] Add cache.set() after querying settlements by kingdom
- [ ] Add cache invalidation to `SettlementService.create()` (invalidate kingdom's list)
- [ ] Add cache invalidation to `SettlementService.delete()` (invalidate kingdom's list)
- [ ] Add cache invalidation to `SettlementService.archive()` (invalidate kingdom's list)
- [ ] Modify `StructureService.findBySettlement()` to check cache before querying
- [ ] Add cache.set() after querying structures by settlement
- [ ] Add cache invalidation to `StructureService.create()` (invalidate settlement's list)
- [ ] Add cache invalidation to `StructureService.delete()` (invalidate settlement's list)
- [ ] Add cache invalidation to `StructureService.archive()` (invalidate settlement's list)
- [ ] Add logging for cache hits/misses (debug level)

### Testing Tasks

- [ ] Write unit test: Settlement list cache hit returns cached data
- [ ] Write unit test: Settlement list cache miss queries and stores
- [ ] Write unit test: Settlement create invalidates kingdom's settlement list
- [ ] Write unit test: Settlement delete invalidates kingdom's settlement list
- [ ] Write unit test: Structure list cache hit returns cached data
- [ ] Write unit test: Structure list cache miss queries and stores
- [ ] Write unit test: Structure create invalidates settlement's structure list
- [ ] Write unit test: Structure delete invalidates settlement's structure list
- [ ] Write integration test: End-to-end entity list caching with real Redis

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
