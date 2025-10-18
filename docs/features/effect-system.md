# Effect System

The Effect System (TICKET-016) enables events and encounters to mutate world state or other entities when they resolve. Effects use JSON Patch (RFC 6902) operations to apply precise, auditable state changes with support for three timing phases: pre-resolution, during resolution, and post-resolution.

## Overview

- Apply JSON Patch operations to mutate entity state when events/encounters resolve
- Three-phase execution model: PRE → ON_RESOLVE → POST
- Priority-based ordering within each timing phase for deterministic execution
- Comprehensive audit trail via EffectExecution records
- Security validation with path whitelisting to protect sensitive fields
- Integration with dependency graph system for circular dependency detection
- Support for dry-run mode to preview effects without applying changes

## Key Components

### Effect Model

Database model defined in `packages/api/prisma/schema.prisma`

**Fields:**

- `id` - Unique identifier (CUID)
- `name` - Human-readable effect name
- `description` - Detailed explanation (optional, max 500 chars)
- `effectType` - Type of effect (currently 'patch' for JSON Patch operations)
- `payload` - JSON Patch operations array (JSONB, max 100KB)
- `entityType` - Source entity type (ENCOUNTER or EVENT)
- `entityId` - Source entity instance ID
- `timing` - Execution phase (PRE, ON_RESOLVE, POST) - default: ON_RESOLVE
- `priority` - Execution order within timing phase (ascending, default: 0)
- `isActive` - Enable/disable effect without deletion
- `version` - Optimistic locking version number
- `deletedAt` - Soft delete timestamp
- Audit fields: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

**Indexes:**

- Composite: (entityType, entityId, timing) for phase-based queries
- Individual: isActive, deletedAt, createdBy, updatedBy for filtering
- Foreign keys indexed for efficient joins

**Timing Phases:**

- **PRE**: Execute before encounter/event resolution (preparation effects)
- **ON_RESOLVE**: Execute during resolution (main effects)
- **POST**: Execute after resolution (cleanup/cascading effects)

### EffectExecution Model

Comprehensive audit trail for all effect executions

**Fields:**

- `id` - Unique identifier (CUID)
- `effectId` - Foreign key to Effect (CASCADE on delete)
- `entityType` - Entity type that was affected
- `entityId` - Entity instance ID that was affected
- `executedAt` - Timestamp of execution
- `executedBy` - User who triggered the execution
- `context` - Entity state snapshot before execution (JSONB)
- `patchApplied` - JSON Patch operations that were applied (JSONB)
- `affectedFields` - Array of field paths that changed
- `success` - Execution success status
- `error` - Error message if execution failed (nullable)

**Indexes:**

- Composite: (effectId, executedAt) for effect history pagination
- Composite: (entityType, entityId, executedAt) for entity audit trail queries
- Individual: executedBy, executedAt for time-based filtering

### EffectPatchService

Located at `packages/api/src/graphql/services/effect-patch.service.ts`

Core service for applying JSON Patch operations to entities with security validation.

**Methods:**

- `validatePatch(patch, entityType)` - Validates JSON Patch format and enforces path whitelisting. Rejects operations on protected fields (id, timestamps, deletedAt, version). Returns validation errors or null if valid.
- `applyPatch(entity, patch, entityType)` - Applies JSON Patch operations immutably using fast-json-patch library. Returns patched entity (original unchanged). Supports all RFC 6902 operations: add, remove, replace, copy, move, test.
- `generatePatchPreview(entity, patch, entityType)` - Generates before/after diff preview. Returns original entity, patched entity, and array of changed field paths. Useful for dry-run mode.

**Security Features:**

- **Path Whitelisting**: Only allows patches to safe entity fields
  - Protected fields: id, createdAt, updatedAt, deletedAt, version
  - Entity-specific protection:
    - Settlement: campaignId, kingdomId, locationId (prevent ownership changes)
    - Structure: settlementId (prevent relocation)
    - Kingdom: campaignId (prevent ownership changes)
    - Party: campaignId (prevent ownership changes)
    - Character: partyId (prevent reassignment)
- **Immutable Operations**: All patch operations create new objects without modifying originals
- **RFC 6902 Compliance**: Validates all patch operations before application
- **Clear Error Messages**: Detailed validation errors with specific field paths

**Performance:**

- Uses native `structuredClone()` for fast, safe deep cloning
- Handles Date objects and circular references correctly
- Enhanced `deepEqual()` with Date object comparison support

**Testing:**

- 51 passing unit tests covering all operations and edge cases
- Coverage includes format validation, path whitelisting, immutability, nested paths, error handling

### EffectExecutionService

Located at `packages/api/src/graphql/services/effect-execution.service.ts`

Orchestrates effect execution with audit logging and transaction semantics.

**Methods:**

- `executeEffect(effectId, context?, userId, dryRun?)` - Executes single effect with full audit trail. Validates effect is active, loads entity context, applies patch, persists changes (unless dry-run), creates audit record. Throws ForbiddenException if effect is inactive. Supports dry-run mode for preview without side effects.

- `executeEffectsForEntity(entityType, entityId, timing, userId, skipEntityUpdate?)` - Executes all active effects for entity at specific timing phase. Queries effects by entity + timing, sorts by priority (ascending), executes sequentially. Failed effects logged but don't block subsequent effects. Returns summary with total/succeeded/failed counts and individual execution results.

  Parameters:
  - `skipEntityUpdate` - When true, creates execution records without updating entity (used during multi-phase workflows to prevent redundant updates)

- `executeEffectsWithDependencies(effectIds, context, userId)` - NOT YET IMPLEMENTED. Throws NotImplementedException. Reserved for future dependency-ordered execution using topological sort from dependency graph system.

**Architecture:**

- **Sequential Execution**: Effects execute sequentially in priority order to ensure correctness
- **Transaction Boundaries**: Each effect execution is atomic (entity update + audit record in single transaction)
- **Error Isolation**: Failed effects don't block subsequent effects
- **Type Safety**: Uses `Prisma.TransactionClient` for transaction parameter typing
- **Entity Loading**: Type-safe entity loading (Encounter/Event) with proper type guards

**Testing:**

- 17 passing unit tests covering all execution scenarios
- Coverage includes single/multi-effect execution, priority ordering, dry-run mode, error handling, transaction semantics

### EffectService

Located at `packages/api/src/graphql/services/effect.service.ts`

Complete service layer for effect management with authorization and validation.

**Methods:**

- `create(input, user)` - Creates effect with campaign authorization and payload validation. Validates JSON Patch format using EffectPatchService. Resolves campaignId from encounter/event relations. Creates audit entry. Invalidates dependency graph cache.

- `findById(id, user)` - Fetches effect with access verification. Throws NotFoundException for missing entities or access denied.

- `findMany(where, orderBy, skip, take, user)` - Paginated queries with JOIN-based campaign access filtering. Single database query (no N+1 issues). Supports date range filtering and sorting.

- `findForEntity(entityType, entityId, timing, user)` - Gets effects for entity at specific timing phase. Ordered by priority for execution.

- `update(id, input, user)` - Updates with optimistic locking (version field). Validates JSON Patch format. Invalidates dependency graph cache.

- `delete(id, user)` - Soft deletes by setting deletedAt. Preserves effect execution history. Invalidates dependency graph cache.

- `toggleActive(id, isActive, user)` - Enables/disables effects quickly without full update.

**Campaign Authorization:**

- Resolves campaignId from encounter/event relations
- Verifies user has campaign access (owner or member)
- Supports both ENCOUNTER and EVENT entity types
- Throws NotFoundException for missing entities or access denied

**Performance Optimizations:**

- **N+1 Query Fix**: `findMany()` uses JOIN-based campaign access filtering in initial Prisma query
- Single database query instead of N separate authorization checks
- Composite indexes on Effect(entityType, entityId, timing) for efficient queries

**Dependency Graph Integration:**

- Invalidates cache on create/update/delete via `DependencyGraphService.invalidateGraph()`
- Resolves campaignId from entity relations for cache invalidation
- Publishes Redis events for Rules Engine worker

**Testing:**

- 30 passing unit tests covering all CRUD operations
- Coverage includes authorization, optimistic locking, payload validation, campaign access filtering, soft deletes

### EffectResolver

Located at `packages/api/src/graphql/resolvers/effect.resolver.ts`

GraphQL resolver exposing effect operations via API.

**Query Resolvers:**

- `getEffect(id)` - Fetch single effect by ID with campaign authorization
- `listEffects(where, orderBy, skip, take)` - Paginated list with filters and sorting
- `getEffectsForEntity(entityType, entityId, timing)` - Get effects for specific entity and timing phase

**Mutation Resolvers** (owner/gm only):

- `createEffect(input)` - Create new effect with campaign authorization
- `updateEffect(id, input)` - Update with optimistic locking via version field
- `deleteEffect(id)` - Soft delete (returns boolean)
- `toggleEffectActive(id, isActive)` - Enable/disable effect
- `executeEffect(input)` - Manual single effect execution with dry-run support
- `executeEffectsForEntity(input)` - Bulk execution for entity at timing phase

**Security Guards:**

- `JwtAuthGuard` on all operations for authentication
- `RolesGuard` with `@Roles('owner', 'gm')` on all mutations
- Campaign access control enforced at service layer

**Testing:**

- 13 passing unit tests covering all resolver methods
- Coverage includes queries, mutations, authorization, error handling

## Integration with Encounter/Event Resolution

Effects are integrated into the encounter/event resolution workflow with three-phase execution.

### EncounterService.resolve()

Located at `packages/api/src/graphql/services/encounter.service.ts`

**Workflow:**

1. Execute PRE effects (skipEntityUpdate = true)
2. Mark encounter as resolved (isResolved = true, resolvedAt = now, version++)
3. Execute ON_RESOLVE effects (skipEntityUpdate = true)
4. Execute POST effects (skipEntityUpdate = true)
5. Return EncounterResolutionResult with encounter + effect summaries (pre/onResolve/post)

**Features:**

- Authorization via `findById()` ensures campaign access
- Rejects if encounter already resolved (BadRequestException)
- Creates audit entry with operation type 'UPDATE'
- Publishes entityModified event via Redis pub/sub

**Return Type:**

```typescript
type EncounterResolutionResult = {
  encounter: Encounter;
  preEffects: EffectExecutionSummary;
  onResolveEffects: EffectExecutionSummary;
  postEffects: EffectExecutionSummary;
};
```

### EventService.complete()

Located at `packages/api/src/graphql/services/event.service.ts`

**Workflow:**

1. Execute PRE effects (skipEntityUpdate = true)
2. Mark event as completed (isCompleted = true, occurredAt = now, version++)
3. Execute ON_RESOLVE effects (skipEntityUpdate = true)
4. Execute POST effects (skipEntityUpdate = true)
5. Return EventCompletionResult with event + effect summaries (pre/onResolve/post)

**Features:**

- Authorization via `findById()` ensures campaign access
- Rejects if event already completed (BadRequestException)
- Creates audit entry with operation type 'UPDATE'
- Publishes entityModified event via Redis pub/sub

**Return Type:**

```typescript
type EventCompletionResult = {
  event: Event;
  preEffects: EffectExecutionSummary;
  onResolveEffects: EffectExecutionSummary;
  postEffects: EffectExecutionSummary;
};
```

### GraphQL Mutations

**EncounterResolver:**

- `resolveEncounter(id)` - Mutation restricted to owner/gm roles

**EventResolver:**

- `completeEvent(id)` - Mutation restricted to owner/gm roles

### Integration Testing

- encounter.service.integration.test.ts: 7 tests (433 lines)
- event.service.integration.test.ts: 7 tests (434 lines)
- Coverage: no effects, all 3 phases, not found, already resolved/completed, partial failures, timing order, event publishing

## Dependency Graph Integration

Effects are tracked as nodes in the dependency graph system with WRITES edges to variables they modify.

### DependencyExtractor

Located at `packages/api/src/graphql/utils/dependency-extractor.ts`

**Methods:**

- `extractWrites(effect)` - Parses JSON Patch (RFC 6902) operations from effect payloads. Extracts target variable paths from patch operations (add, replace, remove, copy, move). Returns Set of base variable names.

- `extractBaseVariableFromPath(path)` - Parses JSON Pointer paths (RFC 6901). Extracts base variable name from nested paths (e.g., "/resources/gold" → "resources"). Handles malformed paths gracefully.

**Features:**

- Comprehensive validation with graceful error handling
- Support for all patch operation types
- Handles nested paths and array operations
- 23 passing tests covering all operation types and edge cases

### DependencyGraphBuilderService

Located at `packages/api/src/graphql/services/dependency-graph-builder.service.ts`

**Effect Integration:**

- `buildGraphForCampaign()` - Queries and adds Effect nodes to graph
  - Filters effects by `isActive`, `deletedAt`, and `effectType='patch'` at query level
  - Resolves campaign ownership via encounter/event relations for proper isolation
  - Creates WRITES edges from effects to variables based on payload analysis
  - Defensive effect type checking to skip non-patch effects

- `updateGraphForEffect(campaignId, effectId)` - Incremental graph updates on effect mutations
  - Removes old effect node and edges
  - Queries updated effect from database
  - Re-adds effect node with new WRITES edges if active

- `makeEffectNodeId(effectId)` - Helper following existing node ID pattern (EFFECT:effectId)

**Features:**

- Effect nodes appear in dependency graph with EFFECT type
- WRITES edges connect effects to variables they write to
- Circular dependency detection includes effect chains
- Automatic graph invalidation on effect create/update/delete
- Campaign-level isolation prevents cross-campaign effect dependencies
- 11 passing tests for effect integration

### Integration with EffectService

EffectService automatically calls `DependencyGraphService.invalidateGraph()` on mutations:

- `create()` - Invalidates graph after creating effect
- `update()` - Invalidates graph after updating effect
- `delete()` - Invalidates graph after soft-deleting effect

This ensures the dependency graph stays synchronized with effect changes.

## GraphQL API Examples

### Create Effect

```graphql
mutation CreateEffect {
  createEffect(
    input: {
      name: "Harvest Resources"
      description: "Increase settlement gold by 100 when harvest event completes"
      effectType: "patch"
      payload: [{ op: "replace", path: "/resources/gold", value: 1100 }]
      entityType: EVENT
      entityId: "event123"
      timing: POST
      priority: 10
    }
  ) {
    id
    name
    timing
    priority
    isActive
  }
}
```

### List Effects for Entity

```graphql
query GetEffects {
  getEffectsForEntity(entityType: ENCOUNTER, entityId: "enc123", timing: ON_RESOLVE) {
    id
    name
    description
    priority
    isActive
  }
}
```

### Execute Effect (Manual Trigger)

```graphql
mutation ExecuteEffect {
  executeEffect(input: { effectId: "eff123", dryRun: false }) {
    success
    error
    patchApplied
    executionId
  }
}
```

### Resolve Encounter (Triggers Effects)

```graphql
mutation ResolveEncounter {
  resolveEncounter(id: "enc123") {
    encounter {
      id
      isResolved
      resolvedAt
    }
    preEffects {
      total
      succeeded
      failed
      executionOrder
    }
    onResolveEffects {
      total
      succeeded
      failed
      executionOrder
    }
    postEffects {
      total
      succeeded
      failed
      executionOrder
    }
  }
}
```

### Complete Event (Triggers Effects)

```graphql
mutation CompleteEvent {
  completeEvent(id: "event123") {
    event {
      id
      isCompleted
      occurredAt
    }
    preEffects {
      total
      succeeded
      failed
    }
    onResolveEffects {
      total
      succeeded
      failed
    }
    postEffects {
      total
      succeeded
      failed
    }
  }
}
```

## JSON Patch Format

Effects use JSON Patch (RFC 6902) for precise state mutations.

### Supported Operations

**replace**: Replace field value

```json
{ "op": "replace", "path": "/resources/gold", "value": 500 }
```

**add**: Add new field or array element

```json
{ "op": "add", "path": "/tags/-", "value": "fertile" }
```

**remove**: Remove field or array element

```json
{ "op": "remove", "path": "/resources/wood" }
```

**copy**: Copy value from one path to another

```json
{ "op": "copy", "from": "/resources/gold", "path": "/resources/goldBackup" }
```

**move**: Move value from one path to another

```json
{ "op": "move", "from": "/resources/gold", "path": "/treasury/gold" }
```

**test**: Test that value at path matches expected (assertion)

```json
{ "op": "test", "path": "/level", "value": 3 }
```

### Path Format (JSON Pointer - RFC 6901)

- Root-level field: `/fieldName`
- Nested field: `/resources/gold`
- Array element by index: `/tags/0`
- Array append: `/tags/-`

### Protected Paths

The following paths are protected and cannot be modified via effects:

- `/id` - Entity identifier
- `/createdAt` - Creation timestamp
- `/updatedAt` - Update timestamp
- `/deletedAt` - Soft delete timestamp
- `/version` - Optimistic locking version

Entity-specific protected paths:

- Settlement: `/campaignId`, `/kingdomId`, `/locationId`
- Structure: `/settlementId`
- Kingdom: `/campaignId`
- Party: `/campaignId`
- Character: `/partyId`

## Common Use Cases

### Resource Modification

```javascript
// Increase settlement gold by 100
[{ op: 'replace', path: '/resources/gold', value: 1100 }][
  // Add food to settlement resources
  { op: 'replace', path: '/resources/food', value: 500 }
];
```

### Status Changes

```javascript
// Mark settlement as trade hub
[{ op: 'add', path: '/tags/-', value: 'trade_hub' }][
  // Update structure operational status
  { op: 'replace', path: '/isOperational', value: true }
];
```

### Complex Multi-Field Updates

```javascript
// Harvest event: increase resources and update harvest timestamp
[
  { op: 'replace', path: '/resources/gold', value: 1100 },
  { op: 'replace', path: '/resources/food', value: 500 },
  { op: 'replace', path: '/lastHarvestAt', value: '2025-10-18T00:00:00Z' },
];
```

### Cascading Effects

Use timing phases to create cascading effect chains:

```javascript
// PRE: Prepare for harvest (mark settlement as "harvesting")
timing: PRE[{ op: 'add', path: '/tags/-', value: 'harvesting' }];

// ON_RESOLVE: Apply harvest (increase resources)
timing: ON_RESOLVE[{ op: 'replace', path: '/resources/gold', value: 1100 }];

// POST: Cleanup (remove "harvesting" tag)
timing: POST[
  { op: 'remove', path: '/tags/0' } // Assumes "harvesting" is first tag
];
```

## Security Model

### Authorization

- **Campaign-Based Access Control**: All operations verify user has campaign access via encounter/event relations
- **Role-Based Mutations**: Only owner/gm roles can create/update/delete effects
- **Silent Access Failures**: `findById()` throws NotFoundException for missing entities or access denied (prevents information disclosure)
- **Type-Level Effects**: Effects are always bound to specific entity instances (no type-level effects)

### Validation

- **Payload Validation**: JSON Patch format validated before storage using EffectPatchService
- **Path Whitelisting**: Only safe entity fields can be modified (protected fields rejected)
- **Expression Depth**: JSON Patch operations have max depth limit (validated by EffectPatchService)
- **Entity Type Validation**: Case-insensitive entity type handling prevents bypass attacks

### Audit Trail

- **EffectExecution Records**: Complete execution history with context, results, and errors
- **Audit Service Integration**: All mutations logged with userId and operation type
- **Context Snapshots**: Entity state before execution preserved in execution records
- **Affected Fields Tracking**: Array of changed field paths recorded for each execution

### Data Integrity

- **Optimistic Locking**: Version field prevents race conditions during updates
- **Soft Deletes**: Effects soft-deleted to preserve execution history
- **Transaction Semantics**: Effect execution and audit record creation in single transaction
- **Immutable Operations**: Patch application doesn't modify original entities

## Performance Considerations

### Query Optimization

- **Composite Indexes**: Effect(entityType, entityId, timing) for phase-based queries
- **JOIN-Based Filtering**: Campaign access filtering in initial Prisma query (no N+1 issues)
- **Single Query Fetches**: `findMany()` uses single database query instead of N authorization checks

### Execution Efficiency

- **Sequential Execution**: Effects execute sequentially in priority order (ensures correctness)
- **Error Isolation**: Failed effects logged but don't block subsequent effects
- **Dry-Run Mode**: Preview effects without database writes (useful for testing)
- **Skip Entity Update**: Multi-phase workflows update entity exactly once (not per-effect)

### Caching

- **Dependency Graph Cache**: Leverages in-memory cache for evaluation order
- **Cache Invalidation**: Automatic invalidation on effect create/update/delete
- **Redis Pub/Sub**: Publishes cache invalidation events for Rules Engine worker

### Scalability

- **Priority Ordering**: Effects execute in deterministic order (ascending priority)
- **Campaign Isolation**: Dependency graph isolation prevents cross-campaign dependencies
- **Graceful Degradation**: Failed effects don't cascade to subsequent effects
- **Transaction Boundaries**: Each effect execution is atomic (prevents partial updates)

## Future Enhancements

The following features are planned for future tickets:

- **Conditional Effects**: Effects that only execute if a JSONLogic condition is met
- **Effect Templates**: Reusable effect patterns for common mutations
- **Effect Chains**: Explicit chaining with data passing between effects
- **Rollback Support**: Undo effect executions using inverse patches
- **Effect Scheduler**: Time-delayed effect execution (scheduled effects)
- **Rules Engine Integration**: Use gRPC service for high-performance evaluation
- **Batch Operations**: Apply same effect to multiple entities
- **Effect Visualization**: Graph view of effect chains and dependencies
- **Dependency-Ordered Execution**: Use topological sort for optimal execution order (Stage 8 foundation laid)

## Related Systems

- **Condition System** (TICKET-012): Provides JSONLogic evaluation patterns and authorization models
- **Dependency Graph** (TICKET-014): Tracks effect write dependencies and circular dependency detection
- **Rules Engine** (TICKET-015): May be used for optimized effect evaluation in future
- **World Time System** (TICKET-010): Events/encounters may be triggered by world time advancement
- **Audit Service**: Logs all effect mutations for compliance and debugging

## Implementation Details

- **Commits**:
  - Stage 1: 7d1439d (Database Schema Enhancement)
  - Stage 2: e125476 (GraphQL Type Definitions)
  - Stage 3: c88a40d (Effect Patch Application Service)
  - Stage 4: 86455e4 (Effect Execution Engine Service)
  - Stage 5: 051d96b (Effect CRUD Service)
  - Stage 6: 34d74a7 (Effect GraphQL Resolver)
  - Stage 7: e27f995 (Dependency Graph Integration)
  - Stage 8: c2e0b90 (Encounter/Event Integration)

- **Test Coverage**:
  - 51 tests (EffectPatchService)
  - 17 tests (EffectExecutionService)
  - 30 tests (EffectService)
  - 13 tests (EffectResolver)
  - 14 tests (Integration: Encounter/Event resolution)
  - 34 tests (Dependency Graph integration)
  - **Total**: 159 tests covering all scenarios

- **Key Files**:
  - Schema: `packages/api/prisma/schema.prisma` (Effect, EffectExecution models)
  - Services: `packages/api/src/graphql/services/effect*.service.ts`
  - Resolver: `packages/api/src/graphql/resolvers/effect.resolver.ts`
  - Types: `packages/api/src/graphql/types/effect.type.ts`
  - Inputs: `packages/api/src/graphql/inputs/effect.input.ts`
  - Utils: `packages/api/src/graphql/utils/dependency-extractor.ts`
