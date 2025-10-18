# Dependency Graph System

The Dependency Graph System (TICKET-014) tracks relationships between conditions, variables, effects, and entities to enable dependency analysis, cycle detection, and efficient cache invalidation for the rules engine.

## Overview

- Builds in-memory dependency graphs per campaign/branch
- Extracts dependencies from JSONLogic expressions (reads) and effects (writes)
- Detects cycles in dependency relationships
- Provides topological sort for evaluation order
- Automatic cache invalidation when conditions or variables change
- Supports incremental updates and invalidation propagation

## Key Components

### DependencyNode & DependencyEdge

Core types defined in `packages/api/src/graphql/utils/dependency-graph.ts`

**Node Types:**

- `VARIABLE` - State variables
- `CONDITION` - Field conditions
- `EFFECT` - Effects (future)
- `ENTITY` - Entities (future)

**Edge Types:**

- `READS` - Condition/effect reads from variable
- `WRITES` - Effect writes to variable
- `DEPENDS_ON` - Generic dependency

### DependencyExtractor

Located at `packages/api/src/graphql/utils/dependency-extractor.ts`

**Methods:**

- `extractReads(expression)` - Extracts all `{"var": "..."}` references from JSONLogic expressions
- `extractWrites(effect)` - Extracts target variables from effects (placeholder for TICKET-016)

**Features:**

- Recursive traversal of nested JSONLogic expressions
- Handles complex operators (`and`, `or`, `if`, `map`, `filter`, etc.)
- Deduplicates variable names
- Returns Set of variable names

**Testing:**

- 28 passing unit tests covering all JSONLogic patterns

### DependencyGraph

In-memory graph data structure at `packages/api/src/graphql/utils/dependency-graph.ts`

**Methods:**

- `addNode(node)` / `removeNode(nodeId)` - Manage nodes
- `addEdge(edge)` / `removeEdge(fromId, toId)` - Manage edges
- `getOutgoingEdges(nodeId)` / `getIncomingEdges(nodeId)` - Query relationships
- `detectCycles()` - DFS-based cycle detection with full paths
- `topologicalSort()` - Kahn's algorithm for evaluation order
- `wouldCreateCycle(fromId, toId)` - Validate edge addition
- `hasPath(sourceId, targetId)` - Path finding

**Features:**

- Adjacency list storage for O(1) node lookups
- DFS coloring algorithm (white/gray/black) for cycle detection
- Kahn's algorithm for stable topological ordering
- Returns detailed cycle paths when detected

**Testing:**

- 49 passing unit tests covering all graph operations

### DependencyGraphBuilderService

Located at `packages/api/src/graphql/services/dependency-graph-builder.service.ts`

**Methods:**

- `buildGraphForCampaign(campaignId, branchId)` - Build complete graph from database state

**Process:**

1. Query all active FieldConditions for campaign
2. Query all StateVariables for campaign/branch
3. Extract reads from condition expressions
4. Create nodes for variables and conditions
5. Create edges for all dependencies
6. Return populated DependencyGraph

**Testing:**

- 18 passing unit tests with mocked Prisma

### DependencyGraphService

Located at `packages/api/src/graphql/services/dependency-graph.service.ts`

**Methods:**

- `getGraph(campaignId, branchId, user)` - Get cached or build new graph
- `invalidateGraph(campaignId, branchId)` - Clear cache for rebuild
- `getDependenciesOf(campaignId, branchId, nodeId, user)` - Get upstream dependencies
- `getDependents(campaignId, branchId, nodeId, user)` - Get downstream dependents
- `validateNoCycles(campaignId, branchId, user)` - Check for cycles
- `getEvaluationOrder(campaignId, branchId, user)` - Get topological order

**Caching:**

- In-memory Map keyed by `${campaignId}:${branchId}`
- Cache invalidation on condition/variable changes
- Automatic rebuild on next access

**Authorization:**

- Campaign access verification via `verifyCampaignAccess`
- All operations require campaign membership

**Testing:**

- 28 passing unit tests with mocked dependencies

### DependencyGraphResolver

Located at `packages/api/src/graphql/resolvers/dependency-graph.resolver.ts`

**Query Resolvers:**

- `getDependencyGraph(campaignId, branchId)` - Get complete graph with stats
- `getNodeDependencies(campaignId, branchId, nodeId)` - Get what node depends on
- `getNodeDependents(campaignId, branchId, nodeId)` - Get what depends on node
- `validateDependencyGraph(campaignId, branchId)` - Check for cycles
- `getEvaluationOrder(campaignId, branchId)` - Get topological sort order

**Mutation Resolvers (owner/gm only):**

- `invalidateDependencyGraph(campaignId, branchId)` - Force cache rebuild

**Authorization:**

- All operations require JwtAuthGuard
- Mutation requires RolesGuard (owner/gm)
- Campaign access verified via service layer

**Testing:**

- 19 passing integration tests

## Cache Invalidation Integration

**Automatic Invalidation:**

The system automatically invalidates dependency graph cache when conditions or variables change:

**ConditionService** (`packages/api/src/graphql/services/condition.service.ts`):

- `create()` - Invalidates after creating instance-level condition
- `update()` - Invalidates after updating condition
- `delete()` - Invalidates after soft-deleting condition
- Type-level conditions (entityId=null) do NOT trigger invalidation

**StateVariableService** (`packages/api/src/graphql/services/state-variable.service.ts`):

- `create()` - Invalidates after creating campaign-scoped variable
- `update()` - Invalidates after updating variable
- `delete()` - Invalidates after soft-deleting variable
- World-scoped variables do NOT trigger invalidation

**Campaign ID Resolution:**

Both services include helper methods to extract campaignId from entities:

- `ConditionService.getCampaignIdForCondition()` - Traverses entity relationships
- `StateVariableService.getCampaignIdForScope()` - Already existed for versioning

**Error Handling:**

- Graceful failure if campaignId cannot be determined
- Try-catch blocks prevent invalidation errors from breaking mutations
- Logging via NestJS Logger for debugging

**Testing:**

- 10 passing integration tests in `dependency-graph-cache-invalidation.integration.test.ts`

## GraphQL API Examples

### Get Dependency Graph

```graphql
query GetDependencyGraph {
  getDependencyGraph(
    campaignId: "campaign-123"
    branchId: "main" # Optional, defaults to "main"
  ) {
    nodes {
      id
      type
      entityId
      metadata
    }
    edges {
      from
      to
      type
      metadata
    }
    statistics {
      nodeCount
      edgeCount
      variableCount
      conditionCount
    }
  }
}
```

### Get Node Dependencies

```graphql
query GetNodeDependencies {
  getNodeDependencies(
    campaignId: "campaign-123"
    branchId: "main"
    nodeId: "condition:condition-123"
  ) {
    id
    type
    entityId
  }
}
```

Returns all nodes that this node depends on (upstream dependencies).

### Get Node Dependents

```graphql
query GetNodeDependents {
  getNodeDependents(
    campaignId: "campaign-123"
    branchId: "main"
    nodeId: "variable:gold_production"
  ) {
    id
    type
    entityId
  }
}
```

Returns all nodes that depend on this node (downstream dependents).

### Validate Graph for Cycles

```graphql
query ValidateDependencyGraph {
  validateDependencyGraph(campaignId: "campaign-123", branchId: "main") {
    hasCycle
    cycles
    message
  }
}
```

Returns cycle detection results with full paths if cycles exist.

### Get Evaluation Order

```graphql
query GetEvaluationOrder {
  getEvaluationOrder(campaignId: "campaign-123", branchId: "main")
}
```

Returns array of node IDs in topological order for safe evaluation.

### Invalidate Cache

```graphql
mutation InvalidateDependencyGraph {
  invalidateDependencyGraph(campaignId: "campaign-123", branchId: "main")
}
```

Manually forces cache rebuild. Requires owner/gm role.

## Integration Points

1. **JSONLogic Parser** (TICKET-011): DependencyExtractor uses ExpressionParserService
2. **Condition System** (TICKET-012): Automatic cache invalidation on create/update/delete
3. **State Variable System** (TICKET-013): Automatic cache invalidation on create/update/delete
4. **Rules Engine** (TICKET-020+): Future integration for incremental recomputation
5. **Effect System** (TICKET-016): Future integration for write dependency tracking

## Performance Characteristics

**Time Complexity:**

- Graph build: O(C + V) where C=conditions, V=variables
- Cycle detection: O(N + E) where N=nodes, E=edges
- Topological sort: O(N + E)
- Cache lookup: O(1)

**Space Complexity:**

- In-memory cache: O(G × (N + E)) where G=campaigns
- Adjacency lists: O(N + E) per graph

**Caching Strategy:**

- Build once, cache until invalidated
- Separate caches per campaign/branch
- Invalidation on relevant mutations only

## Common Use Cases

1. **Cycle Detection**: Validate condition/variable configurations don't create circular dependencies
2. **Evaluation Order**: Determine safe order to evaluate conditions and variables
3. **Impact Analysis**: Find all conditions affected by changing a variable
4. **Dependency Visualization**: Show relationships between rules and data
5. **Incremental Recomputation**: Identify minimal set of nodes to recalculate (future)

## Known Limitations

1. **In-Memory Only**: Cache lost on server restart (acceptable for MVP)
2. **No Persistence**: Graphs rebuilt from database on demand
3. **No Type-Level Conditions**: Currently only tracks instance-level conditions
4. **No Effect Integration**: Effect writes not yet tracked (awaiting TICKET-016)
5. **No Cross-Campaign Dependencies**: Each campaign's graph is isolated

## Validation Rules

- Mutations require 'owner' or 'gm' role
- All operations require campaign membership
- Cycle detection runs before returning evaluation order
- Graph rebuilds automatically when cache miss occurs

## Future Enhancements

- Persistent graph storage (Redis/database)
- Graph visualization endpoints
- Real-time subscriptions for graph changes
- Cross-campaign dependency tracking
- Automatic graph repair (remove problematic edges)
- Graph diff and history tracking
- Performance metrics and profiling

## Testing

**Unit Tests:**

- DependencyExtractor: 28 tests covering JSONLogic patterns
- DependencyGraph: 49 tests covering all operations, cycles, topological sort
- DependencyGraphBuilderService: 18 tests with mocked Prisma
- DependencyGraphService: 28 tests with mocked dependencies

**Integration Tests:**

- DependencyGraphResolver: 19 tests covering all GraphQL operations
- Cache Invalidation: 10 tests verifying automatic invalidation on mutations

**Test Coverage:**

- All error paths tested
- Authorization scenarios verified
- Cycle detection with various patterns
- Topological sort correctness
- Cache invalidation triggers

## Implementation Details

**Commits:**

- Stages 1-5: 82b5bf1 (Core data structures, extraction, and graph algorithms)
- Stage 6: d76ecf7 (Dependency Graph Builder Service)
- Stage 7: 1ad5696 (Dependency Graph Service with caching)
- Stage 8: 7ad6abb (GraphQL Resolver)
- Stage 9: TBD (Integration with Condition/Variable Services)

**Files:**

- Core: `packages/api/src/graphql/utils/dependency-graph.ts`, `dependency-extractor.ts`
- Services: `packages/api/src/graphql/services/dependency-graph-builder.service.ts`, `dependency-graph.service.ts`
- Resolver: `packages/api/src/graphql/resolvers/dependency-graph.resolver.ts`
- Types: `packages/api/src/graphql/types/dependency-graph.type.ts`
- Tests: Colocated `.test.ts` and `.integration.test.ts` files
