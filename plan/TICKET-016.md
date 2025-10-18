# TICKET-016: Effect System Implementation

## Status

- [ ] Completed
- **Commits**:
  - Stage 1: 7d1439d (Database Schema Enhancement)
  - Stage 2: e125476 (GraphQL Type Definitions)
  - Stage 3: c88a40d (Effect Patch Application Service)
  - Stage 4: 86455e4 (Effect Execution Engine Service)
  - Stage 5: 051d96b (Effect CRUD Service)

## Description

Implement the Effect system that allows events/encounters to mutate world state or other entities when they resolve, with support for pre/post/onResolve timing.

## Scope of Work

1. Create Effect CRUD operations
2. Implement effect execution engine
3. Add timing support (pre/post/onResolve)
4. Create effect patch application
5. Track effect execution history
6. Integrate with dependency graph

## Acceptance Criteria

- [ ] Can create effects on events/encounters
- [ ] Effects execute at correct timing
- [ ] Patch JSON correctly updates target entities
- [ ] Effect execution creates audit trail
- [ ] Effects can trigger other effects
- [ ] Circular effect dependencies detected

## Dependencies

- Requires: TICKET-012, TICKET-015

## Estimated Effort

3-4 days

## Implementation Notes

### Stage 1: Database Schema Enhancement (7d1439d)

**Completed**: Database schema successfully enhanced with effect timing and execution audit trail.

**Changes Made:**

- Created `EffectTiming` enum with three execution phases: PRE, ON_RESOLVE, POST
- Added `timing` field to Effect model (default: ON_RESOLVE)
- Added `version` field to Effect model for optimistic locking
- Created `EffectExecution` model with comprehensive audit fields:
  - Foreign key to Effect with CASCADE delete
  - Polymorphic reference to triggering entity (entityType/entityId)
  - User tracking (executedBy)
  - Complete audit context (entity state snapshot before execution)
  - Execution results (patch applied, success status, affected fields)
  - Error messages for failed executions

**Performance Optimizations:**

- Composite index on Effect(entityType, entityId, timing) for efficient phase-based queries
- Composite index on EffectExecution(entityType, entityId, executedAt) for audit trail pagination
- Individual indexes on all foreign keys and common query fields

**Migration Handling:**

- Properly handled Location GIST index (Prisma limitation - must drop and recreate in each migration)
- All indexes created for optimal query performance

**Code Review:** Approved by code-reviewer subagent after addressing Location GIST index issue and adding composite index for audit trail queries.

---

### Stage 2: GraphQL Type Definitions (e125476)

**Completed**: GraphQL type system successfully created for effect operations and execution results.

**Changes Made:**

- Created comprehensive type definitions in `effect.type.ts`:
  - `EffectTiming` enum (PRE, ON_RESOLVE, POST) with detailed descriptions
  - `EffectEntityType` enum (ENCOUNTER, EVENT)
  - `Effect` object type matching Prisma model with all fields
  - `EffectExecution` object type for audit trail
  - `EffectExecutionResult` type for individual execution outcomes
  - `EffectExecutionSummary` type for bulk execution results

- Created comprehensive input types in `effect.input.ts`:
  - `CreateEffectInput` with full validation (@MaxLength, @IsEnum, @IsString)
  - `UpdateEffectInput` with optimistic locking via expectedVersion
  - `ExecuteEffectInput` with dry-run support and optional context
  - `ExecuteEffectsForEntityInput` for bulk execution by timing phase
  - `EffectWhereInput` and `EffectOrderByInput` for flexible querying
  - `EffectExecutionWhereInput` and `EffectExecutionOrderByInput` for execution history

**Key Features:**

- Comprehensive validation decorators (class-validator)
- CUID-compatible ID validation (@IsString instead of @IsUUID)
- RFC 6902 JSON Patch documentation on payload fields
- Max 100KB payload size documented
- Context auto-loading when omitted in ExecuteEffectInput
- Optimistic locking support via version field
- Soft delete support via deletedAt
- Priority-based execution ordering

**Code Review:** Approved by code-reviewer subagent after addressing:

1. Added @MaxLength(500) to description fields
2. Fixed UUID validation to use @IsString for CUID compatibility
3. Added payload validation documentation (max size, EffectPatchService validation)
4. Clarified context loading behavior in ExecuteEffectInput
5. Enhanced payload field documentation with RFC 6902 reference

---

### Stage 3: Effect Patch Application Service (c88a40d)

**Completed**: Core patch application service successfully implemented with comprehensive security validation.

**Changes Made:**

- Created `EffectPatchService` in `effect-patch.service.ts`:
  - `validatePatch()` - Validates JSON Patch format and enforces path whitelisting
  - `applyPatch()` - Applies patches immutably using fast-json-patch library
  - `generatePatchPreview()` - Generates before/after diffs with changed field detection

- Security Features:
  - Protected field whitelisting (id, createdAt, updatedAt, deletedAt, version)
  - Entity-specific protection (Settlement: campaignId/kingdomId/locationId, Structure: settlementId, Kingdom: campaignId, etc.)
  - Validates all RFC 6902 operations (add, remove, replace, copy, move, test)
  - Rejects operations on protected fields before application

- Performance Optimizations:
  - Uses native `structuredClone()` for fast, safe deep cloning (handles Date objects, circular refs)
  - Enhanced `deepEqual()` with Date object comparison support
  - Early validation prevents unnecessary patch attempts

- Created comprehensive test suite (`effect-patch.service.test.ts`):
  - 51 unit tests covering all operations and edge cases
  - Patch format validation (missing fields, invalid operations)
  - Path whitelisting for Settlement, Structure, Kingdom entities
  - Immutability verification (original entities unchanged)
  - Nested path and array operation handling
  - Error handling for validation and application failures
  - Preview generation with accurate change detection

**Key Design Decisions:**

1. **Native structuredClone()**: Replaced `JSON.parse(JSON.stringify())` for better performance and proper Date/circular reference handling
2. **Path Whitelisting**: Uses allowlist approach (secure by default) rather than blocklist
3. **Immutable Operations**: All patch operations create new objects without modifying originals
4. **Clear Error Messages**: Detailed validation errors with specific field paths for debugging

**Code Review:** Approved by code-reviewer subagent after addressing:

1. Replaced `JSON.parse(JSON.stringify())` with `structuredClone()` for better performance and Date support
2. Enhanced `deepEqual()` to handle Date objects properly using `getTime()` comparison
3. Added clarifying comments to `applyPatch()` method explaining boolean parameters (validate, mutateDocument)

**Test Results:**

- ✅ All 51 tests pass
- ✅ Type-check passes with no errors
- ✅ Lint passes with no new warnings
- ✅ Test coverage > 90%

---

### Stage 4: Effect Execution Engine Service (86455e4)

**Completed**: Core orchestration service successfully implemented with comprehensive test coverage.

**Changes Made:**

- Created `EffectExecutionService` in `effect-execution.service.ts`:
  - `executeEffect()` - Single effect execution with full audit trail
    - Loads effect and validates it's active (throws ForbiddenException if inactive)
    - Loads or uses provided entity context (throws NotFoundException if missing)
    - Applies JSON Patch using EffectPatchService
    - Persists changes and creates audit record in transaction
    - Supports dry-run mode for preview without side effects
  - `executeEffectsForEntity()` - Multi-effect execution at timing phase
    - Queries active effects for entity + timing phase
    - Sorts by priority (ascending) for deterministic execution
    - Executes sequentially to maintain correct order
    - Failed effects logged but don't block subsequent effects
    - Returns summary with total/succeeded/failed counts
  - `executeEffectsWithDependencies()` - NOT YET IMPLEMENTED
    - Throws NotImplementedException until Stage 7
    - Requires dependency graph integration for effect-level tracking
    - Clear error message directs users to use executeEffectsForEntity()

- Service Architecture:
  - Type-safe entity loading (Encounter/Event with proper type guards)
  - Immutable patch application via EffectPatchService
  - Transaction semantics for atomicity (entity update + audit record)
  - Proper error handling with descriptive messages
  - Comprehensive logging for debugging

- Key Design Decisions:
  1. **Sequential Execution**: Effects execute sequentially in priority order to ensure correctness and prevent race conditions
  2. **Transaction Boundaries**: Each effect execution is atomic (entity update + audit record in single transaction)
  3. **Error Isolation**: Failed effects don't block subsequent effects (logged and continue)
  4. **Type Safety**: Used `Prisma.TransactionClient` instead of `any` for transaction parameter
  5. **Future-Proofing**: Stub method for dependency-ordered execution (Stage 7)

- Created comprehensive test suite (`effect-execution.service.test.ts`):
  - 17 unit tests covering all execution scenarios
  - Single effect execution (success/failure/dry-run/inactive/missing)
  - Multi-effect execution with priority ordering
  - Entity type handling (Encounter/Event)
  - Transaction semantics and error handling
  - NotImplementedException for dependency-ordered execution

**Code Review:** Approved after addressing critical issues:

1. ✅ Fixed transaction client type from `any` to `Prisma.TransactionClient`
2. ✅ Changed `executeEffectsWithDependencies` to throw clear NotImplementedException
3. ✅ Removed DependencyGraphService dependency (not needed until Stage 7)
4. ✅ Added comprehensive documentation explaining future implementation needs

**Test Results:**

- ✅ All 17 tests pass (effect-execution.service.test.ts)
- ✅ All 51 tests pass (effect-patch.service.test.ts)
- ✅ Type-check passes with no errors
- ✅ Lint passes (only non-critical `@typescript-eslint/no-explicit-any` warnings in test mocks)
- ✅ Test coverage comprehensive

---

### Stage 5: Effect CRUD Service (051d96b)

**Completed**: Complete service layer successfully implemented with comprehensive CRUD operations and authorization.

**Changes Made:**

- Created `EffectService` in `effect.service.ts`:
  - `create()` - Create effect with campaign authorization and payload validation
  - `findById()` - Get effect with access verification
  - `findMany()` - Paginated queries with JOIN-based campaign access filtering
  - `findForEntity()` - Get effects for entity at specific timing phase
  - `update()` - Update with optimistic locking (version field)
  - `delete()` - Soft delete (set deletedAt)
  - `toggleActive()` - Enable/disable effects

- Campaign Authorization:
  - Resolves campaignId from encounter/event relations
  - Verifies user has campaign access (owner or member)
  - Supports both encounter and event entity types
  - Throws NotFoundException for missing entities or access denied

- Payload Validation:
  - Validates JSON Patch format using EffectPatchService
  - Safe type casting with explanation comments (GraphQL generic types → specific validation types)
  - Rejects malformed patches before database writes

- Performance Optimizations:
  - **N+1 Query Fix**: `findMany()` uses JOIN-based campaign access filtering in initial Prisma query
  - Single database query instead of N separate authorization checks
  - Composite indexes on Effect(entityType, entityId, timing) for efficient queries

- Dependency Graph Integration:
  - Invalidates cache on create/update/delete via `DependencyGraphService.invalidateGraph()`
  - Resolves campaignId from entity relations for cache invalidation
  - Publishes Redis events for Rules Engine worker

- Created comprehensive test suite (`effect.service.test.ts`):
  - 30 unit tests covering all CRUD operations
  - Authorization scenarios (success/forbidden/not found)
  - Optimistic locking with version mismatch
  - Payload validation (valid/invalid patches)
  - Campaign access filtering with JOIN queries
  - Date range filtering and sorting
  - Soft delete behavior
  - Entity type handling (encounter/event)

**Key Design Decisions:**

1. **JOIN-Based Authorization**: Campaign access filtering built into initial Prisma query using OR clauses for encounter/event relations (eliminates N+1 query problem)
2. **Optimistic Locking**: Uses version field to prevent race conditions (same pattern as ConditionService)
3. **Safe Type Casting**: GraphQL accepts generic `Record<string, unknown>` for payload, but EffectPatchService validates specific types (`Operation[]`) - casts documented with explanation comments
4. **Audit Trail**: All mutations logged via AuditService for compliance
5. **Soft Deletes**: Preserves effect execution history by setting deletedAt instead of hard delete

**Code Review:** Initially flagged critical N+1 query issue in `findMany()` where authorization checks happened in a loop after query. Refactored to include campaign access filtering in the initial Prisma query using JOINs. Second review approved after fix.

**Test Results:**

- ✅ All 30 tests pass (effect.service.test.ts)
- ✅ Type-check passes with no errors
- ✅ Lint passes with zero new warnings (no `any` types used)
- ✅ Test coverage > 90%
- ✅ Performance: Single query for findMany (no N+1 issues)
