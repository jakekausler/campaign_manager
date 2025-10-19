# TICKET-021: Flow View with React Flow

## Status

- [ ] Completed
- **Commits**: 66d4238, 80ef9d3, 8406688, 71610db

## Implementation Notes

### Planning Phase (Commit: 66d4238)

Created detailed 12-stage implementation plan.

### Stage 1: Install and Configure React Flow (Commit: 80ef9d3)

Successfully installed React Flow library and created basic FlowView page:

**Implemented**:

- Installed @xyflow/react v12.8.6 with all dependencies
- Created FlowViewPage component with ReactFlow, Background, Controls, and MiniMap
- Added /flow route with lazy loading and ProtectedRoute wrapper
- Exported FlowViewPage from pages index
- React Flow CSS imports included directly in component
- Type-check and lint passing

**Technical Decisions**:

- Used full-screen layout (h-screen) for immersive visualization experience
- Included CSS imports directly in component for proper style encapsulation
- Protected route ensures authentication requirement like other authenticated pages

**Code Review**: Approved with optional suggestions for:

1. Adding consistent header/footer layout (deferred to later stages)
2. Extracting to feature component following MapPage pattern (deferred to Stage 2)

**Next**: Stage 3 will transform graph data to React Flow format.

### Stage 2: Create GraphQL Integration (Commit: 8406688)

Successfully implemented complete GraphQL integration for fetching dependency graph data:

**Implemented**:

- Created GET_DEPENDENCY_GRAPH query fetching nodes, edges, and statistics
- Implemented useDependencyGraph custom hook with loading/error states
- Added 9 comprehensive unit tests (all passing)
- Integrated hook into FlowViewPage with 4 UI states (loading, error, no campaign, no data)
- Added mockDependencyGraph test data (7 nodes, 7 edges, realistic relationships)
- Added MSW handler for GetDependencyGraph query
- Temporary TypeScript types (codegen pending backend startup fix)
- Temporary stats panel displays graph metrics

**Technical Decisions**:

- cache-and-network fetch policy for fresh data while using cache
- useMemo optimization to prevent unnecessary re-renders
- Comprehensive error handling with user-friendly messages
- Test coverage includes all edge cases and error scenarios
- Backend has NestJS dependency injection error (RulesEngineClientService), preventing codegen

**Code Review**: Approved - production-quality code with excellent test coverage

**Tests**:

- ✅ 9 new tests passing (dependency graph hook)
- ✅ 404 total frontend tests passing (no regressions)
- ✅ TypeScript compilation successful
- ✅ ESLint clean (no new errors or warnings)

**Next**: Stage 3 will create utility to transform DependencyGraphResult to React Flow nodes/edges format.

### Stage 3: Transform Graph Data to React Flow Format (Commit: 71610db)

Successfully implemented complete transformation pipeline with auto-layout algorithm:

**Implemented**:

- Created graph-layout.ts utility with comprehensive transformation functions
- transformNode(): Maps DependencyNode to React Flow Node with type-based styling
  - VARIABLE nodes: Green (#22c55e)
  - CONDITION nodes: Blue (#3b82f6)
  - EFFECT nodes: Orange (#f97316)
  - ENTITY nodes: Purple (#a855f7)
  - Fallback label to entityId when label is null
  - Node dimensions: 180x60px for readability
- transformEdge(): Maps DependencyEdge to React Flow Edge with relationship-based styling
  - READS: Solid line (no dash array)
  - WRITES: Dashed line (5,5) with animation
  - DEPENDS_ON: Dotted line (2,2)
  - All edges use smoothstep type for better readability
  - Arrow markers on all edges
- applyAutoLayout(): Dagre hierarchical layout algorithm
  - Top-to-bottom (TB) layout direction for natural flow
  - Node spacing: 100px horizontal, 80px vertical
  - Handles cycles gracefully
  - Handles disconnected subgraphs
  - Handles single nodes without edges
  - Margins: 50px around the graph
- transformGraphToFlow(): Main function combining transformation and layout
  - Transforms nodes and edges
  - Applies auto-layout
  - Returns positioned nodes and styled edges
- Integrated transformation into FlowViewPage with useMemo optimization
  - useMemo called before conditional returns (React Hooks rules)
  - Null-safe check for graph data
- Added color legend to stats panel for node type identification
- Installed dagre v0.8.5 and @types/dagre v0.7.52
- Exported all types and functions from utils/index.ts

**Technical Decisions**:

- Dagre layout algorithm chosen for fast, proven hierarchical layout (100+ nodes in <100ms)
- Namespace import (`import * as dagre`) for compatibility with ESLint import/default rule
- Color scheme uses Tailwind color palette for consistency with rest of app
- useMemo prevents unnecessary recalculations when graph data hasn't changed
- React Hooks rules enforced: useMemo called unconditionally before conditional returns

**Tests**:

- 18 comprehensive unit tests covering all transformation functions
- transformNode: 6 tests (all node types, fallback label, styling, position)
- transformEdge: 4 tests (all edge types, animation, arrow markers)
- applyAutoLayout: 4 tests (basic layout, disconnected subgraphs, single node, cycles)
- transformGraphToFlow: 4 tests (empty graph, single node, complex graph, cycles)
- All 422 tests passing with no regressions
- Test coverage: node types, edge types, empty graphs, cycles, disconnected graphs

**Code Review**: Approved - production-quality code with excellent test coverage

**Next**: Stage 4 will create custom node components for each entity type (VariableNode, ConditionNode, EffectNode, EntityNode).

### Stage 4: Create Custom Node Components (Commit: 8b2c7a4)

Successfully implemented custom node components for all dependency graph entity types:

**Implemented**:

- Created CustomNode base component with shared styling and behavior
  - Hover effects (scale-105 transform) and selection states (blue ring)
  - Connection handles (top=target, bottom=source) for edges
  - Icon + label + node type display with text truncation
  - Consistent 180x60px sizing with proper ARIA labels
  - Memoized with React.memo for performance
- Created 4 specialized node components:
  - VariableNode: Green (#22c55e) with Database icon
  - ConditionNode: Blue (#3b82f6) with GitBranch icon
  - EffectNode: Orange (#f97316) with Zap icon
  - EntityNode: Purple (#a855f7) with Box icon
- Centralized color constants in utils/node-colors.ts (DRY principle)
  - NODE_COLORS constant with background and border colors
  - Type-safe mapping using DependencyNodeType
  - Single source of truth for all node colors
- Registered custom node types with React Flow in FlowViewPage
  - Lowercase type mapping (variable, condition, effect, entity)
  - Updated stats panel legend to use NODE_COLORS
- Updated test infrastructure:
  - Created renderWithReactFlow utility for testing React Flow components
  - Added ReactFlowProvider to test-utils.tsx
- Comprehensive test coverage: 27 new unit tests
  - CustomNode: 11 tests (rendering, styling, interactions, accessibility)
  - VariableNode: 4 tests (label, color, icon, accessibility)
  - ConditionNode: 4 tests (label, color, icon, accessibility)
  - EffectNode: 4 tests (label, color, icon, accessibility)
  - EntityNode: 4 tests (label, color, icon, accessibility)

**Technical Decisions**:

- Lucide React icons chosen for consistency with existing UI components
- React.memo prevents unnecessary re-renders of static nodes
- Hover transform could impact performance with 100+ nodes (flagged for future profiling)
- Colors use Tailwind CSS palette (-500 for bg, -600 for borders)
- Custom node components handle their own styling (removed from transformation layer)
- Lowercase node type keys match React Flow's nodeTypes registration

**Code Review**: Approved after refactoring hardcoded colors to NODE_COLORS constant

**Tests**:

- ✅ 448 total frontend tests passing (27 new, no regressions)
- ✅ TypeScript compilation successful
- ✅ ESLint clean (no new errors or warnings)
- ✅ All node types render correctly with distinct styles
- ✅ Hover and selection interactions working
- ✅ Accessibility features verified (ARIA labels, keyboard nav)

**Next**: Stage 5 will create custom edge components for relationship types (ReadsEdge, WritesEdge, DependsOnEdge).

### Planning Phase Details

Created detailed 12-stage implementation plan covering:

1. **Stage 1**: Install and Configure React Flow - Add @xyflow/react library, create FlowView page, set up routing
2. **Stage 2**: Create GraphQL Integration - Define getDependencyGraph query, create useDependencyGraph hook
3. **Stage 3**: Transform Graph Data - Convert backend data to React Flow format, implement auto-layout
4. **Stage 4**: Create Custom Node Components - VariableNode (green), ConditionNode (blue), EffectNode (orange), EntityNode (purple)
5. **Stage 5**: Create Custom Edge Components - ReadsEdge (solid), WritesEdge (dashed), DependsOnEdge (dotted)
6. **Stage 6**: Implement Auto-Layout - Use dagre for hierarchical layout, handle disconnected subgraphs
7. **Stage 7**: Add Minimap and Controls - React Flow MiniMap, Controls, custom toolbar with zoom and fit view
8. **Stage 8**: Implement Selection and Highlighting - Single/multi-select, highlight dependencies, selection info panel
9. **Stage 9**: Add Node Editing Integration - Double-click to edit, navigate to entity edit forms, preserve state
10. **Stage 10**: Performance Optimization - React.memo, profile and optimize for 100+ nodes, target 60 FPS
11. **Stage 11**: Add Filtering and Search - Search by label, filter by node/edge types, "Show cycles only"
12. **Stage 12**: Testing and Documentation - Unit/integration tests, accessibility testing, update docs

**Technical Decisions**:

- React Flow (@xyflow/react) chosen for best React/TypeScript integration and performance
- Dagre for auto-layout algorithm (fast, proven, handles cycles)
- No layout persistence for MVP (positions stored in component state only)
- React.memo for optimization, no virtualization initially
- Fetch entire graph on load, manual refresh (no real-time updates for MVP)

**Integration Points**:

- Dependency Graph API (TICKET-014): getDependencyGraph, validateDependencyGraph, getNodeDependencies/Dependents
- State Management (TICKET-018): Campaign ID from Zustand store
- Routing (TICKET-017): New /flow route with lazy loading and protected route
- GraphQL Client (TICKET-018): Apollo Client with code generation

## Description

Implement flowchart/dependency graph view using React Flow to visualize relationships between entities (events, encounters, locations, characters).

## Scope of Work

1. Install and configure React Flow
2. Create Flow component with custom nodes
3. Implement node types (event, encounter, location, character, settlement, structure)
4. Add edge types (requires, unlocks, influences)
5. Implement auto-layout algorithm
6. Add node editing (double-click to edit)
7. Create minimap and controls
8. Add selection and highlighting

## Acceptance Criteria

- [ ] Dependency graph renders correctly
- [ ] Different entity types have distinct node styles
- [ ] Edges show relationship types
- [ ] Auto-layout arranges nodes readably
- [ ] Can select and highlight nodes
- [ ] Minimap shows overview
- [ ] Performance good with 100+ nodes
- [ ] Settlement nodes render with distinct styles
- [ ] Structure nodes render with distinct styles
- [ ] Settlement-Kingdom relationships display correctly
- [ ] Structure-Settlement relationships display correctly

## Dependencies

- Requires: TICKET-014, TICKET-018

## Estimated Effort

4-5 days
