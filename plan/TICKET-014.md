# TICKET-014: Dependency Graph Builder

## Status

- [x] Completed (All 9 stages complete)
- **Commits**:
  - 82b5bf1 (Stages 1-5: Core data structures, extraction, and graph algorithms)
  - d76ecf7 (Stage 6: Dependency Graph Builder Service)
  - 1ad5696 (Stage 7: Dependency Graph Service with caching)
  - 7ad6abb (Stage 8: GraphQL Resolver)
  - a60a396 (Stage 9: Cache Invalidation Integration)

## Description

Build a dependency graph system that tracks relationships between conditions, variables, effects, and entities to enable incremental recomputation and cycle detection.

## Scope of Work

1. Create dependency graph data structure
2. Extract dependencies from conditions (reads)
3. Extract dependencies from effects (writes)
4. Build in-memory DAG per campaign/branch
5. Implement topological sort
6. Add cycle detection
7. Create invalidation propagation system

## Acceptance Criteria

- [x] Dependency graph builds from conditions/effects
- [x] Can detect cycles in dependencies
- [x] Topological sort provides evaluation order
- [x] Changes propagate to dependent nodes (via automatic cache invalidation)
- [x] Graph updates incrementally on changes

## Dependencies

- Requires: TICKET-012, TICKET-013

## Estimated Effort

4-5 days

## Implementation Notes

### Stage 8: GraphQL Resolver (Commit: 7ad6abb)

**What was implemented:**

- Created DependencyGraphResolver with 6 GraphQL operations (5 queries + 1 mutation)
- Registered resolver and all related services in GraphQLConfigModule
- Implemented comprehensive integration tests (19 test cases)

**Key decisions:**

- All queries require JwtAuthGuard for authenticated access
- Mutation requires both JwtAuthGuard and RolesGuard (owner/gm only)
- Access verification done via service layer's verifyCampaignAccess
- Cache invalidation requires explicit access check by calling getGraph first
- Default branch parameter is "main" for all operations
- Statistics calculated in resolver from graph nodes/edges

**GraphQL Operations:**

1. `getDependencyGraph`: Returns complete graph with nodes, edges, and stats
2. `getNodeDependencies`: Get upstream dependencies (what this node depends on)
3. `getNodeDependents`: Get downstream dependents (what depends on this node)
4. `validateDependencyGraph`: Check for cycles with detailed path information
5. `getEvaluationOrder`: Get topological sort order for evaluation
6. `invalidateDependencyGraph`: Force cache rebuild (mutation, owner/gm only)

**Module registration:**

- Added DependencyGraphResolver to resolvers array
- Added DependencyGraphService to services array
- Added DependencyGraphBuilderService to services array
- Added DependencyExtractor to services array
- Added ConditionService to services array (was missing)
- Added ConditionEvaluationService to services array (was missing)
- Added FieldConditionResolver to resolvers array (was missing)

**Testing:**

- 19 integration tests covering all resolver methods
- Tests verify proper delegation to service layer
- Authorization scenarios tested (access granted/denied)
- Branch parameter handling tested (default and custom)
- Edge cases: empty graphs, missing nodes, cycles detected
- All tests pass successfully

**Code quality:**

- Type-check: passes
- Lint: passes (133 warnings about `any` types in test files, acceptable)
- Code review: approved by code-reviewer subagent

### Stage 9: Cache Invalidation Integration (Commit: a60a396)

**What was implemented:**

- Integrated automatic dependency graph cache invalidation into ConditionService and StateVariableService
- Cache automatically invalidates when conditions or variables are created, updated, or deleted
- Created comprehensive integration tests (10 test cases)
- Updated CLAUDE.md with full Dependency Graph System documentation

**Key decisions:**

- Type-level conditions (entityId=null) do NOT trigger cache invalidation (they don't belong to specific campaigns)
- World-scoped variables do NOT trigger cache invalidation (they're global)
- Graceful error handling with try-catch blocks ensures invalidation failures don't break mutations
- Campaign ID resolution traverses entity relationships (Settlement → Kingdom → Campaign, etc.)

**ConditionService changes:**

- Added DependencyGraphService dependency injection
- Created `getCampaignIdForCondition()` helper method
- Added cache invalidation to `create()`, `update()`, and `delete()` methods
- Supports 5 entity types: Settlement, Structure, Kingdom, Party, Character

**StateVariableService changes:**

- Added DependencyGraphService dependency injection
- Added cache invalidation to `create()`, `update()`, and `delete()` methods
- Leverages existing `getCampaignIdForScope()` method for campaign resolution
- Handles all scope types: Campaign, Kingdom, Settlement, Structure, Location, World

**Integration Tests:**

- File: `dependency-graph-cache-invalidation.integration.test.ts`
- 10 comprehensive test cases:
  - 4 tests for ConditionService cache invalidation
  - 4 tests for StateVariableService cache invalidation
  - 1 test for cache rebuilds after invalidation
  - 1 test for separate caches per campaign
- All tests verify proper delegation and edge cases
- Tests cover type-level conditions and world-scoped variables (no invalidation)

**Documentation:**

- Added comprehensive "Dependency Graph System" section to CLAUDE.md (lines 1674-2066)
- Documented all components, architecture, API examples
- Detailed cache invalidation integration documentation
- Testing strategy and implementation details included

**Testing:**

- 10 integration tests all passing
- Total test count: 122 unit tests + 29 integration tests = 151 tests
- Type-check: passes
- Lint: passes (165 warnings about `any` types in test files, acceptable)

**Code quality:**

- Type-check: passes
- Lint: passes
- Code review: approved by project-manager subagent
- All acceptance criteria verified and met
