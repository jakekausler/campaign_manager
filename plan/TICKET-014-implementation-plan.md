# TICKET-014: Dependency Graph Builder - Implementation Plan

## Overview

Build a dependency graph system that tracks relationships between conditions, variables, effects, and entities. This system will enable the rules engine to understand dependencies, detect cycles, compute evaluation order, and propagate changes efficiently.

## Architecture Design

### Core Components

1. **DependencyNode**: Represents a node in the graph (condition, variable, effect, entity)
2. **DependencyGraph**: Main graph data structure with DAG operations
3. **DependencyExtractor**: Extracts dependencies from JSONLogic expressions
4. **DependencyGraphBuilder**: Builds graphs from database state
5. **DependencyGraphService**: Service layer for graph operations

### Key Design Decisions

- **In-Memory Storage**: Graph stored in memory per campaign/branch for fast access
- **Node Types**: `VARIABLE`, `CONDITION`, `EFFECT`, `ENTITY` (extensible enum)
- **Edge Types**: `READS` (condition/effect reads variable), `WRITES` (effect writes variable), `DEPENDS_ON` (generic dependency)
- **Incremental Updates**: Support adding/removing nodes and edges without full rebuild
- **Cycle Detection**: Use DFS-based cycle detection before graph operations
- **Topological Sort**: Use Kahn's algorithm for stable evaluation order

## Implementation Stages

### Stage 1: Core Data Structures and Types ✅

**Goal**: Define TypeScript types and GraphQL schema for dependency graph components

**Tasks**:

- [ ] Create `DependencyNodeType` enum (VARIABLE, CONDITION, EFFECT, ENTITY)
- [ ] Create `DependencyEdgeType` enum (READS, WRITES, DEPENDS_ON)
- [ ] Define `DependencyNode` interface with id, type, entityId, metadata
- [ ] Define `DependencyEdge` interface with from, to, type, metadata
- [ ] Define GraphQL types for DependencyNode, DependencyEdge, DependencyGraph
- [ ] Define GraphQL input types for graph queries
- [ ] Add GraphQL query/mutation scaffolding

**Success Criteria**:

- All TypeScript types defined and compile
- GraphQL schema includes dependency graph types
- Types exported from shared package if needed

**Tests**:

- Type definitions compile without errors
- GraphQL schema validates

**Status**: Not Started

---

### Stage 2: Dependency Extraction from JSONLogic ✅

**Goal**: Implement logic to extract variable dependencies from JSONLogic expressions

**Tasks**:

- [ ] Create `DependencyExtractor` class in `packages/api/src/graphql/utils/dependency-extractor.ts`
- [ ] Implement `extractReads(expression: JsonLogicExpression): Set<string>` - recursively find all `{ "var": "..." }` operations
- [ ] Implement `extractWrites(effect: EffectDefinition): Set<string>` - extract target variables from effects
- [ ] Handle nested expressions and complex JSONLogic operators
- [ ] Add validation for circular references in single expressions
- [ ] Write comprehensive unit tests for all JSONLogic patterns

**Success Criteria**:

- Can extract all variable reads from any JSONLogic expression
- Can extract all variable writes from effect definitions
- Handles nested expressions correctly
- All unit tests pass (15+ test cases)

**Tests**:

- Simple variable reads: `{ "var": "foo" }` → `["foo"]`
- Nested reads: `{ "and": [{ ">": [{ "var": "x" }, 5] }, { "var": "y" }] }` → `["x", "y"]`
- Array access: `{ "var": "items.0.name" }` → `["items"]`
- No duplicates in result set
- Empty expressions return empty set
- Invalid expressions throw helpful errors

**Status**: Not Started

---

### Stage 3: In-Memory Dependency Graph Structure ✅

**Goal**: Implement the core in-memory DAG data structure with basic operations

**Tasks**:

- [ ] Create `DependencyGraph` class in `packages/api/src/graphql/utils/dependency-graph.ts`
- [ ] Implement `addNode(node: DependencyNode): void`
- [ ] Implement `removeNode(nodeId: string): void` - also removes connected edges
- [ ] Implement `addEdge(edge: DependencyEdge): void`
- [ ] Implement `removeEdge(fromId: string, toId: string): void`
- [ ] Implement `getNode(nodeId: string): DependencyNode | null`
- [ ] Implement `getOutgoingEdges(nodeId: string): DependencyEdge[]`
- [ ] Implement `getIncomingEdges(nodeId: string): DependencyEdge[]`
- [ ] Implement `clear(): void` - reset graph state
- [ ] Add internal adjacency list storage for efficient lookups
- [ ] Write comprehensive unit tests (20+ test cases)

**Success Criteria**:

- Graph supports add/remove operations for nodes and edges
- Efficient lookups (O(1) for nodes, O(E) for edges where E is edge count for a node)
- Removing a node removes all connected edges
- All unit tests pass

**Tests**:

- Add/remove nodes
- Add/remove edges
- Get incoming/outgoing edges
- Remove node cascades to edges
- Handle non-existent nodes/edges gracefully
- Clear operation resets state

**Status**: Not Started

---

### Stage 4: Cycle Detection ✅

**Goal**: Implement DFS-based cycle detection algorithm

**Tasks**:

- [ ] Add `detectCycles(): CycleDetectionResult` method to DependencyGraph
- [ ] Implement DFS with coloring (white/gray/black) to detect back edges
- [ ] Return detailed cycle information: `{ hasCycle: boolean, cycles: string[][] }`
- [ ] Include full paths of all detected cycles
- [ ] Implement `isCyclicFromNode(nodeId: string): boolean` helper
- [ ] Write comprehensive unit tests (10+ test cases)

**Success Criteria**:

- Correctly detects cycles in directed graphs
- Returns all cycles with full node paths
- Handles graphs with no cycles (returns empty array)
- Efficient: O(V + E) time complexity
- All unit tests pass

**Tests**:

- Simple cycle: A → B → A
- Complex cycle: A → B → C → D → B
- Multiple disconnected cycles
- No cycles in DAG
- Self-loops (A → A)
- Large graphs (100+ nodes)

**Status**: Not Started

---

### Stage 5: Topological Sort ✅

**Goal**: Implement Kahn's algorithm for topological sorting

**Tasks**:

- [ ] Add `topologicalSort(): TopologicalSortResult` method to DependencyGraph
- [ ] Implement Kahn's algorithm using in-degree tracking and queue
- [ ] Return: `{ success: boolean, order: string[], remainingNodes: string[] }`
- [ ] If cycle detected, include remaining nodes that couldn't be sorted
- [ ] Implement stable sort (consistent order for nodes at same level)
- [ ] Write comprehensive unit tests (12+ test cases)

**Success Criteria**:

- Returns valid topological order for DAGs
- Detects cycles and returns partial order with remaining nodes
- Stable ordering (deterministic results)
- Efficient: O(V + E) time complexity
- All unit tests pass

**Tests**:

- Simple linear chain: A → B → C → [A, B, C]
- Diamond dependency: A → B, A → C, B → D, C → D → valid order
- Multiple valid orders (verify any valid one returned)
- Cycle detection returns failure with remaining nodes
- Empty graph returns empty array
- Disconnected components handled correctly

**Status**: Not Started

---

### Stage 6: Dependency Graph Builder Service ✅

**Goal**: Create service to build dependency graphs from database state

**Tasks**:

- [ ] Create `DependencyGraphBuilderService` in `packages/api/src/graphql/services/dependency-graph-builder.service.ts`
- [ ] Inject PrismaService, DependencyExtractor
- [ ] Implement `buildGraphForCampaign(campaignId: string, branchId: string): Promise<DependencyGraph>`
  - Query all active FieldConditions for campaign
  - Query all StateVariables for campaign/branch
  - Query all Effects for campaign (future - stub for now)
  - Extract reads from conditions using DependencyExtractor
  - Extract writes from effects using DependencyExtractor
  - Build nodes for all variables, conditions, effects
  - Build edges for all dependencies
  - Return populated DependencyGraph
- [ ] Implement `updateGraphForCondition(graph: DependencyGraph, conditionId: string): Promise<void>` - incremental update
- [ ] Implement `updateGraphForVariable(graph: DependencyGraph, variableId: string): Promise<void>` - incremental update
- [ ] Implement `removeFromGraph(graph: DependencyGraph, nodeId: string): void` - remove node and edges
- [ ] Write comprehensive unit tests with mocked Prisma (15+ test cases)

**Success Criteria**:

- Can build complete graph from database state
- Supports incremental updates for individual entities
- Handles missing/deleted entities gracefully
- All unit tests pass with mocked dependencies

**Tests**:

- Build graph with conditions and variables
- Build graph with no conditions (only variables)
- Incremental add condition
- Incremental remove condition
- Incremental update condition (remove old edges, add new edges)
- Handle condition referencing non-existent variable
- Handle deleted entities during build

**Status**: Not Started

---

### Stage 7: Dependency Graph Service (NestJS Service Layer) ✅

**Goal**: Create high-level service for dependency graph operations with caching

**Tasks**:

- [ ] Create `DependencyGraphService` in `packages/api/src/graphql/services/dependency-graph.service.ts`
- [ ] Inject DependencyGraphBuilderService
- [ ] Implement in-memory cache: `Map<string, DependencyGraph>` keyed by `${campaignId}:${branchId}`
- [ ] Implement `getGraph(campaignId: string, branchId: string, user: User): Promise<DependencyGraph>` - with campaign access check
- [ ] Implement `invalidateGraph(campaignId: string, branchId: string): void` - clear cache
- [ ] Implement `getDependenciesOf(campaignId: string, branchId: string, nodeId: string, user: User): Promise<DependencyNode[]>` - get all dependent nodes
- [ ] Implement `getDependents(campaignId: string, branchId: string, nodeId: string, user: User): Promise<DependencyNode[]>` - get all nodes that depend on this node
- [ ] Implement `validateNoCycles(campaignId: string, branchId: string, user: User): Promise<CycleDetectionResult>` - check for cycles
- [ ] Implement `getEvaluationOrder(campaignId: string, branchId: string, user: User): Promise<string[]>` - get topological order
- [ ] Add authorization checks via CampaignService
- [ ] Write comprehensive unit tests with mocked dependencies (20+ test cases)

**Success Criteria**:

- Graph cached per campaign/branch for performance
- Authorization enforced on all operations
- Cache invalidation works correctly
- All query operations return correct results
- All unit tests pass

**Tests**:

- Get graph (builds and caches)
- Get graph (returns cached version)
- Invalidate cache (forces rebuild)
- Get dependencies of variable
- Get dependents of condition
- Validate no cycles on valid graph
- Validate cycles detected on invalid graph
- Get evaluation order
- Authorization denied for non-member
- Handle non-existent campaign

**Status**: Not Started

---

### Stage 8: GraphQL Resolver ✅

**Goal**: Expose dependency graph operations via GraphQL API

**Tasks**:

- [ ] Create `DependencyGraphResolver` in `packages/api/src/graphql/resolvers/dependency-graph.resolver.ts`
- [ ] Inject DependencyGraphService
- [ ] Add JwtAuthGuard to all operations
- [ ] Implement `query getDependencyGraph(campaignId: ID!, branchId: String = "main"): DependencyGraphResult!`
- [ ] Implement `query getNodeDependencies(campaignId: ID!, branchId: String!, nodeId: ID!): [DependencyNode!]!`
- [ ] Implement `query getNodeDependents(campaignId: ID!, branchId: String!, nodeId: ID!): [DependencyNode!]!`
- [ ] Implement `query validateDependencyGraph(campaignId: ID!, branchId: String = "main"): CycleDetectionResult!`
- [ ] Implement `query getEvaluationOrder(campaignId: ID!, branchId: String = "main"): [String!]!`
- [ ] Implement `mutation invalidateDependencyGraph(campaignId: ID!, branchId: String = "main"): Boolean!` - requires owner/gm role
- [ ] Add RolesGuard to mutation (owner/gm only)
- [ ] Write integration tests (12+ test cases)

**Success Criteria**:

- All GraphQL operations work correctly
- Authorization enforced (authenticated for queries, owner/gm for mutations)
- Integration tests pass
- GraphQL schema validates

**Tests**:

- Get dependency graph for campaign
- Get node dependencies
- Get node dependents
- Validate graph with no cycles
- Validate graph with cycles
- Get evaluation order
- Invalidate cache (authorized)
- Invalidate cache (unauthorized - fails)
- Handle non-existent campaign
- Handle non-existent node
- Branch parameter defaults to "main"

**Status**: Not Started

---

### Stage 9: Integration with Condition/Variable Services ✅

**Goal**: Hook dependency graph into existing services for automatic cache invalidation

**Tasks**:

- [ ] Update `ConditionService.create()` to invalidate dependency graph cache
- [ ] Update `ConditionService.update()` to invalidate dependency graph cache
- [ ] Update `ConditionService.delete()` to invalidate dependency graph cache
- [ ] Update `StateVariableService.create()` to invalidate dependency graph cache
- [ ] Update `StateVariableService.update()` to invalidate dependency graph cache
- [ ] Update `StateVariableService.delete()` to invalidate dependency graph cache
- [ ] Add integration tests verifying cache invalidation (8+ test cases)
- [ ] Update CLAUDE.md documentation with dependency graph system info

**Success Criteria**:

- Creating/updating/deleting conditions invalidates graph cache
- Creating/updating/deleting variables invalidates graph cache
- Integration tests verify proper invalidation
- Documentation updated

**Tests**:

- Create condition → graph invalidated
- Update condition → graph invalidated
- Delete condition → graph invalidated
- Create variable → graph invalidated
- Update variable → graph invalidated
- Delete variable → graph invalidated
- Cache rebuilds correctly after invalidation
- Multiple campaigns have separate caches

**Status**: Not Started

---

## Testing Strategy

### Unit Tests

- **DependencyExtractor**: 15+ tests covering all JSONLogic patterns
- **DependencyGraph**: 20+ tests covering graph operations
- **Cycle Detection**: 10+ tests covering various cycle scenarios
- **Topological Sort**: 12+ tests covering valid/invalid graphs
- **DependencyGraphBuilderService**: 15+ tests with mocked Prisma
- **DependencyGraphService**: 20+ tests with mocked dependencies

### Integration Tests

- **DependencyGraphResolver**: 12+ tests with real GraphQL operations
- **Service Integration**: 8+ tests verifying cache invalidation

### Total Test Coverage Goal

- 112+ test cases across all components
- All critical paths covered
- Edge cases and error scenarios tested

## Technical Notes

### Performance Considerations

- In-memory graph storage for O(1) node lookups
- Adjacency list representation for efficient edge traversal
- Graph cached per campaign/branch to avoid repeated builds
- Incremental updates supported (though full rebuild is acceptable for MVP)

### Security Considerations

- Campaign access verification for all graph operations
- Owner/GM role required for cache invalidation
- No sensitive data in graph metadata (only IDs and types)

### Future Enhancements (Out of Scope)

- Persistent graph storage (Redis/database)
- Graph visualization endpoints
- Dependency impact analysis
- Automatic graph repair (remove problematic edges)
- Graph diff and history tracking
- Real-time graph updates via subscriptions

## Dependencies

- TICKET-012: Condition System (completed)
- TICKET-013: State Variable System (completed)
- JSONLogic Parser (TICKET-011, completed)

## Estimated Effort

**Total**: 4-5 days

- Stage 1: 2-3 hours
- Stage 2: 4-6 hours
- Stage 3: 4-6 hours
- Stage 4: 3-4 hours
- Stage 5: 3-4 hours
- Stage 6: 6-8 hours
- Stage 7: 4-6 hours
- Stage 8: 4-6 hours
- Stage 9: 3-4 hours

## Completion Checklist

- [ ] All stages completed
- [ ] All unit tests passing (100+ tests)
- [ ] All integration tests passing (20+ tests)
- [ ] GraphQL schema validated
- [ ] Type-check passing
- [ ] Lint passing
- [ ] Documentation updated (CLAUDE.md)
- [ ] Code reviewed
- [ ] All acceptance criteria met
