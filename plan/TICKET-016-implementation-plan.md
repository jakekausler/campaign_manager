# TICKET-016 Implementation Plan: Effect System

## Overview

Implement the Effect system that allows events/encounters to mutate world state or other entities when they resolve, with support for pre/post/onResolve timing.

## Background

The Effect model already exists in the schema (`packages/api/prisma/schema.prisma`) with basic fields. This ticket will:

1. Enhance the schema with timing support (pre/post/onResolve)
2. Implement effect execution engine with patch application
3. Create CRUD operations via GraphQL
4. Track effect execution history
5. Integrate with dependency graph for cycle detection

**Related Systems:**

- Condition System (TICKET-012): Provides JSONLogic evaluation infrastructure
- Dependency Graph (TICKET-014): Will track effect write dependencies
- Rules Engine (TICKET-015): May be used for optimized effect evaluation
- Event/Encounter models: Already exist with Effect relations

## Stages

### Stage 1: Database Schema Enhancement

**Goal**: Add timing field to Effect model and create EffectExecution audit model

**Tasks:**

- [x] Read existing Effect model in schema.prisma
- [x] Add `timing` enum field (PRE | ON_RESOLVE | POST) to Effect model
- [x] Create EffectExecution model for audit trail:
  - id, effectId, entityType, entityId (polymorphic to Encounter/Event)
  - executedAt (timestamp), executedBy (user)
  - context (JSON - entity state before execution)
  - result (JSON - patch applied + success status)
  - error (nullable string)
- [x] Generate Prisma migration
- [x] Run migration in development database
- [x] Regenerate Prisma client

**Success Criteria:**

- [x] Migration applies without errors
- [x] Effect model has timing field with proper enum constraint
- [x] EffectExecution model created with proper indexes
- [x] Prisma client regenerated with new types

**Testing:**

- Manual verification via Prisma Studio
- Migration rollback/reapply test

**Commit Message Template:**

```
feat(api): add effect timing and execution audit models

Enhances Effect schema with timing field (pre/post/onResolve) to control
when effects execute during encounter/event resolution. Adds EffectExecution
model to create comprehensive audit trail of all effect executions including
context, results, and errors.

Part of TICKET-016 Stage 1 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Stage 2: GraphQL Type Definitions

**Goal**: Define GraphQL types for Effect operations and execution results

**Tasks:**

- [ ] Create `packages/api/src/graphql/types/effect.type.ts`:
  - EffectType (enum: pre | post | onResolve)
  - EffectEntityType (enum: encounter | event)
  - EffectPayloadType (enum for effect types)
  - EffectObjectType (matches Prisma model + relations)
  - EffectExecutionObjectType
  - EffectExecutionResultType (success, patchApplied, error, executionId)
- [ ] Create input types in `packages/api/src/graphql/inputs/effect.input.ts`:
  - CreateEffectInput (name, description, effectType, payload, entityType, entityId, timing, priority)
  - UpdateEffectInput (partial fields + expectedVersion)
  - ExecuteEffectInput (effectId, context, dryRun?)
  - EffectWhereInput (filtering for queries)
  - EffectOrderByInput (sorting)
- [ ] Register types in GraphQL module

**Success Criteria:**

- [ ] All GraphQL types compile without errors
- [ ] Types match Prisma models exactly
- [ ] Input validation decorators present (class-validator)
- [ ] Enums properly defined and exported

**Testing:**

- TypeScript compilation
- GraphQL schema introspection

**Commit Message Template:**

```
feat(api): add GraphQL types for effect system

Defines comprehensive GraphQL type system for effects including:
- Effect timing enums (pre/post/onResolve)
- CRUD input types with validation
- Execution result types with audit trail
- Filtering and sorting inputs

Part of TICKET-016 Stage 2 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Stage 3: Effect Patch Application Service

**Goal**: Implement core patch application logic using JSON Patch (RFC 6902)

**Tasks:**

- [ ] Create `packages/api/src/graphql/services/effect-patch.service.ts`
- [ ] Implement `applyPatch(entity, patch)` using json-patch library:
  - Validate patch operations (add, remove, replace, copy, move, test)
  - Apply patch to entity clone (immutable)
  - Return patched entity + validation errors
- [ ] Implement `validatePatch(patch, entityType)` for security:
  - Whitelist allowed paths per entity type
  - Reject dangerous operations (e.g., changing IDs, deletedAt)
  - Validate JSON Patch format
- [ ] Implement `generatePatchPreview(entity, patch)`:
  - Show before/after diff
  - Highlight changed fields
- [ ] Add comprehensive error handling with descriptive messages
- [ ] Write unit tests (30+ tests):
  - Valid patch operations on all entity types
  - Invalid patches (malformed, unauthorized paths)
  - Edge cases (null values, nested paths, arrays)
  - Security scenarios (attempting to modify protected fields)

**Success Criteria:**

- [ ] Service passes all unit tests
- [ ] Patches correctly modify Settlement, Structure, Kingdom entities
- [ ] Protected fields cannot be modified via patches
- [ ] Clear error messages for validation failures
- [ ] Immutable patch application (original entity unchanged)

**Testing:**

- Unit tests with mocked entities
- Test coverage > 90%

**Commit Message Template:**

```
feat(api): implement effect patch application service

Core service for applying JSON Patch (RFC 6902) operations to entities
with security validation. Includes:
- Immutable patch application using json-patch library
- Path whitelisting per entity type (prevents ID/timestamp modification)
- Comprehensive validation and error messages
- Preview generation for before/after diffs

Includes 30+ unit tests covering valid operations, security scenarios,
and edge cases.

Part of TICKET-016 Stage 3 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Stage 4: Effect Execution Engine Service

**Goal**: Orchestrate effect execution with dependency ordering and audit logging

**Tasks:**

- [ ] Create `packages/api/src/graphql/services/effect-execution.service.ts`
- [ ] Implement `executeEffect(effectId, context, user, dryRun)`:
  - Load effect from database
  - Validate effect is active
  - Load target entity (encounter/event)
  - Apply patch using EffectPatchService
  - Save patched entity (if not dryRun)
  - Create EffectExecution audit record
  - Return execution result
- [ ] Implement `executeEffectsForEntity(entityType, entityId, timing, user)`:
  - Query all active effects for entity + timing
  - Sort by priority (ascending)
  - Execute effects sequentially
  - Collect results + errors
  - Return summary (total, succeeded, failed)
- [ ] Implement `executeEffectsWithDependencies(effectIds, context, user)`:
  - Use DependencyGraphService to get evaluation order
  - Execute effects in topological order
  - Detect circular dependencies (fail fast)
  - Return execution results + dependency order
- [ ] Add transaction support for multi-effect execution
- [ ] Write unit tests (40+ tests):
  - Single effect execution (success/failure)
  - Multi-effect execution with priorities
  - Dependency-ordered execution
  - Circular dependency detection
  - Dry-run mode (no database writes)
  - Error handling and rollback

**Success Criteria:**

- [ ] Service passes all unit tests
- [ ] Effects execute in correct priority order
- [ ] Dependency graph integration works correctly
- [ ] Circular dependencies are detected and rejected
- [ ] Audit records created for all executions
- [ ] Dry-run mode works without side effects

**Testing:**

- Unit tests with mocked PrismaService and EffectPatchService
- Integration tests with real database (using test fixtures)

**Commit Message Template:**

```
feat(api): implement effect execution engine

Orchestrates effect execution with support for:
- Single effect execution with patch application
- Multi-effect execution sorted by priority
- Dependency-ordered execution using topological sort
- Circular dependency detection via DependencyGraphService
- Comprehensive audit trail via EffectExecution records
- Dry-run mode for preview without side effects

Includes 40+ unit tests covering execution scenarios, dependency
ordering, error handling, and transaction semantics.

Part of TICKET-016 Stage 4 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Stage 5: Effect CRUD Service

**Goal**: Implement effect CRUD operations with authorization and validation

**Tasks:**

- [ ] Create `packages/api/src/graphql/services/effect.service.ts`
- [ ] Implement CRUD operations:
  - `create(input, user)` - Create effect with campaign authorization
  - `findById(id, user)` - Get effect with access verification
  - `findMany(where, orderBy, skip, take, user)` - Paginated queries
  - `findForEntity(entityType, entityId, timing, user)` - Get effects for entity
  - `update(id, input, user)` - Update with optimistic locking
  - `delete(id, user)` - Soft delete (set deletedAt)
  - `toggleActive(id, isActive, user)` - Enable/disable
- [ ] Implement campaign authorization:
  - Resolve campaignId from entity (encounter/event → campaign)
  - Verify user has campaign access
  - Mutations require 'owner' or 'gm' role
- [ ] Implement payload validation:
  - Validate JSON Patch format for patch-type effects
  - Validate effect-specific payload schemas
- [ ] Integrate with DependencyGraphService:
  - Invalidate cache on create/update/delete
  - Extract write dependencies from patches
- [ ] Write unit tests (45+ tests):
  - CRUD operations (all paths)
  - Authorization scenarios (success/failure)
  - Optimistic locking
  - Payload validation
  - Dependency graph invalidation
  - Soft delete behavior

**Success Criteria:**

- [ ] Service passes all unit tests
- [ ] Campaign authorization works for all operations
- [ ] Optimistic locking prevents race conditions
- [ ] Dependency graph cache invalidates correctly
- [ ] Payload validation catches malformed effects
- [ ] Soft deletes preserve audit trail

**Testing:**

- Unit tests with mocked dependencies
- Test coverage > 90%

**Commit Message Template:**

```
feat(api): implement effect CRUD service

Complete service layer for effect management with:
- Full CRUD operations with pagination and filtering
- Campaign-based authorization (via encounter/event relations)
- Role-based access control (owner/gm for mutations)
- Optimistic locking to prevent race conditions
- Payload validation for effect-specific schemas
- Dependency graph cache invalidation on mutations

Includes 45+ unit tests covering CRUD operations, authorization,
validation, and integration with dependency graph system.

Part of TICKET-016 Stage 5 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Stage 6: Effect GraphQL Resolver

**Goal**: Expose effect operations via GraphQL API

**Tasks:**

- [ ] Create `packages/api/src/graphql/resolvers/effect.resolver.ts`
- [ ] Implement Query resolvers:
  - `getEffect(id)` - Single effect by ID
  - `listEffects(where, orderBy, skip, take)` - Paginated list
  - `getEffectsForEntity(entityType, entityId, timing)` - Entity-specific effects
  - `getEffectExecutionHistory(effectId, skip, take)` - Audit trail
- [ ] Implement Mutation resolvers (owner/gm only):
  - `createEffect(input)` - Create new effect
  - `updateEffect(id, input)` - Update with optimistic locking
  - `deleteEffect(id)` - Soft delete
  - `toggleEffectActive(id, isActive)` - Enable/disable
  - `executeEffect(input)` - Manual effect execution (for testing)
  - `executeEffectsForEntity(entityType, entityId, timing)` - Execute all effects
- [ ] Implement Field resolvers:
  - `Effect.entity` - Resolve polymorphic encounter/event relation
  - `Effect.executions` - Resolve execution history
- [ ] Add guards:
  - JwtAuthGuard for all operations
  - RolesGuard for mutations (owner/gm)
- [ ] Write integration tests (30+ tests):
  - All query resolvers
  - All mutation resolvers
  - Authorization scenarios
  - Field resolver correctness
  - Error handling

**Success Criteria:**

- [ ] All resolvers work correctly via GraphQL
- [ ] Authorization guards prevent unauthorized access
- [ ] Field resolvers load related data
- [ ] Integration tests pass
- [ ] GraphQL schema generates correctly

**Testing:**

- Integration tests with mocked EffectService
- GraphQL schema validation

**Commit Message Template:**

```
feat(api): add effect GraphQL resolver

Exposes effect system via GraphQL API with:
- Query resolvers for fetching effects and execution history
- Mutation resolvers for CRUD operations (owner/gm only)
- Manual effect execution for testing and debugging
- Bulk execution for encounter/event resolution
- Field resolvers for polymorphic relations
- Comprehensive authorization via guards

Includes 30+ integration tests covering all resolvers, authorization
scenarios, and field resolution.

Part of TICKET-016 Stage 6 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Stage 7: Dependency Graph Integration

**Goal**: Track effect write dependencies in dependency graph system

**Tasks:**

- [ ] Update `packages/api/src/graphql/utils/dependency-extractor.ts`:
  - Implement `extractWrites(effect)` for patch-type effects
  - Parse JSON Patch operations to identify target variables
  - Return Set of variable paths being written
  - Handle complex patch operations (nested paths, arrays)
- [ ] Update `packages/api/src/graphql/services/dependency-graph-builder.service.ts`:
  - Query active Effect records when building graph
  - Create EFFECT nodes for each effect
  - Extract write dependencies using DependencyExtractor
  - Create WRITES edges from effects to variables
  - Update integration tests
- [ ] Update EffectService (from Stage 5):
  - Call DependencyGraphService.invalidateGraph on create/update/delete
  - Extract campaignId from effect's entity relation
- [ ] Write integration tests (15+ tests):
  - Effect nodes appear in dependency graph
  - Write edges created correctly
  - Cycles detected when effect creates circular dependency
  - Graph invalidation triggers on effect mutations
  - Complex patch paths parsed correctly

**Success Criteria:**

- [ ] Effects appear as nodes in dependency graph
- [ ] Write dependencies correctly extracted from patches
- [ ] Cycles involving effects are detected
- [ ] Graph invalidates when effects change
- [ ] Integration tests pass

**Testing:**

- Integration tests with real DependencyGraphService
- Cycle detection scenarios with effects

**Commit Message Template:**

```
feat(api): integrate effects into dependency graph system

Extends dependency graph to track effect write dependencies:
- Implemented extractWrites() to parse JSON Patch operations
- Effect nodes added to dependency graph with WRITES edges
- Circular dependency detection includes effect chains
- Automatic graph invalidation on effect create/update/delete
- Support for complex patch paths and nested variables

Includes 15+ integration tests verifying effect dependency tracking,
cycle detection, and cache invalidation.

Part of TICKET-016 Stage 7 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Stage 8: Encounter/Event Integration

**Goal**: Integrate effect execution into encounter/event resolution workflow

**Tasks:**

- [ ] Update `packages/api/src/graphql/services/encounter.service.ts`:
  - Add `resolve(encounterId, user)` method
  - Execute "pre" effects before marking resolved
  - Mark encounter as resolved (isResolved = true, resolvedAt = now)
  - Execute "onResolve" effects
  - Execute "post" effects after resolution
  - Return resolution result with effect summary
- [ ] Update `packages/api/src/graphql/services/event.service.ts`:
  - Add `complete(eventId, user)` method
  - Execute "pre" effects before marking completed
  - Mark event as completed (isCompleted = true, occurredAt = now)
  - Execute "onResolve" effects
  - Execute "post" effects after completion
  - Return completion result with effect summary
- [ ] Update resolvers to expose new operations:
  - `Mutation.resolveEncounter(id)` in EncounterResolver
  - `Mutation.completeEvent(id)` in EventResolver
- [ ] Write integration tests (20+ tests):
  - Encounter resolution with effects
  - Event completion with effects
  - Effect timing (pre/onResolve/post) verification
  - Effect execution order (priority)
  - Error handling (effect failure doesn't block resolution)
  - Authorization

**Success Criteria:**

- [ ] Encounters resolve with effects executing in correct order
- [ ] Events complete with effects executing in correct order
- [ ] Effect timing is respected (pre → onResolve → post)
- [ ] Priority ordering works within each timing phase
- [ ] Failed effects don't prevent resolution (logged but continue)
- [ ] Integration tests pass

**Testing:**

- Integration tests with real database
- End-to-end resolution workflow tests

**Commit Message Template:**

```
feat(api): integrate effect execution into encounter/event resolution

Implements complete resolution workflow with effect execution:
- Added resolveEncounter() to EncounterService with 3-phase effect execution
- Added completeEvent() to EventService with 3-phase effect execution
- Phases: pre (before resolution) → onResolve (during) → post (after)
- Effects execute in priority order within each phase
- Failed effects logged but don't block resolution
- Comprehensive audit trail via EffectExecution records

Includes 20+ integration tests verifying resolution workflows, effect
timing, priority ordering, and error handling.

Part of TICKET-016 Stage 8 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Stage 9: Documentation and Testing

**Goal**: Create comprehensive documentation and end-to-end tests

**Tasks:**

- [ ] Create `docs/features/effect-system.md`:
  - System overview
  - Effect timing explanation (pre/post/onResolve)
  - JSON Patch format examples
  - Common use cases
  - GraphQL API examples
  - Security model
  - Integration points
  - Performance considerations
- [ ] Write end-to-end tests in `packages/api/src/__tests__/e2e/effect-system.e2e.test.ts`:
  - Complete encounter resolution with multi-effect chain
  - Event completion with state mutations
  - Circular dependency rejection
  - Authorization scenarios
  - Complex patch operations
- [ ] Update CLAUDE.md with Effect System quick reference
- [ ] Update README.md with effect system capabilities

**Success Criteria:**

- [ ] Documentation is comprehensive and accurate
- [ ] All examples in documentation work correctly
- [ ] E2E tests pass
- [ ] CLAUDE.md includes effect system quick reference
- [ ] README.md updated

**Testing:**

- E2E tests with real database and full system integration
- Manual testing via GraphQL playground

**Commit Message Template:**

```
docs(api): add comprehensive effect system documentation

Complete documentation for effect system including:
- System architecture and design decisions
- Effect timing phases (pre/post/onResolve) with examples
- JSON Patch format guide with security model
- Common use cases (state mutations, cascading effects)
- GraphQL API examples for all operations
- Integration with dependency graph system
- Performance considerations and optimization tips

Includes end-to-end tests demonstrating complete resolution workflows
with complex effect chains. Updated CLAUDE.md and README.md with
effect system quick reference.

Part of TICKET-016 Stage 9 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Dependencies

- **TICKET-012** (Condition System): Provides JSONLogic evaluation patterns and authorization models
- **TICKET-014** (Dependency Graph): Required for tracking effect write dependencies and cycle detection
- **TICKET-015** (Rules Engine): Optional - may be used for optimized effect evaluation in future

## Testing Strategy

- **Unit Tests**: Each service has comprehensive unit tests (90%+ coverage)
- **Integration Tests**: Resolvers and services tested with mocked dependencies
- **E2E Tests**: Full resolution workflows with real database
- **Manual Testing**: GraphQL playground for all operations

## Security Considerations

- **Path Whitelisting**: Only allow patches to safe entity fields (no IDs, timestamps, deletedAt)
- **Campaign Authorization**: All operations verify user has campaign access via entity relations
- **Role-Based Mutations**: Only owner/gm can create/update/delete effects
- **Audit Trail**: Complete execution history in EffectExecution records
- **Circular Dependency Detection**: Prevent infinite effect loops via dependency graph

## Performance Considerations

- **Priority Ordering**: Effects execute in priority order within each timing phase
- **Dependency Ordering**: Use topological sort for optimal execution order
- **Batch Execution**: Execute multiple effects in single transaction where possible
- **Dry-Run Mode**: Preview effect results without database writes
- **Caching**: Leverage dependency graph cache for evaluation order

## Future Enhancements (Post-TICKET-016)

- **Conditional Effects**: Effects that only execute if a condition is met
- **Effect Templates**: Reusable effect patterns for common mutations
- **Effect Chains**: Explicit chaining with data passing between effects
- **Rollback Support**: Undo effect executions (inverse patches)
- **Effect Scheduler**: Time-delayed effect execution
- **Rules Engine Integration**: Use gRPC service for high-performance evaluation
- **Batch Operations**: Apply same effect to multiple entities
- **Effect Visualization**: Graph view of effect chains and dependencies

## Notes

- Use Test-Driven Development (TDD) for all services
- Follow existing patterns from Condition System (TICKET-012)
- Delegate to specialized subagents:
  - TypeScript Fixer for type/lint errors
  - TypeScript Tester for running/debugging tests
  - Code Reviewer before each commit
  - Project Manager before ticket closure
- Commit after each stage completion
- Update this plan with commit hashes as stages complete
