# TICKET-021: Flow View with React Flow - Implementation Plan

## Overview

Implement an interactive flowchart/dependency graph visualization using React Flow to display relationships between entities (variables, conditions, effects, settlements, structures, locations, characters, events, encounters).

## Stage 1: Install and Configure React Flow

**Goal**: Add React Flow library and set up basic configuration

**Tasks**:

- [x] Install React Flow and types (`@xyflow/react`, `@types/react-flow`)
- [x] Create basic FlowView page component
- [x] Add route for FlowView page (`/flow`)
- [x] Set up React Flow provider with initial config
- [x] Add React Flow CSS imports
- [x] Verify basic empty flow canvas renders

**Success Criteria**:

- React Flow library installed
- Empty flow canvas renders without errors
- Page accessible via `/flow` route
- No TypeScript errors

**Testing**:

- Manual verification of empty canvas
- Type-check passes

**Status**: Complete (Commit: 80ef9d3)

---

## Stage 2: Create GraphQL Integration

**Goal**: Connect to backend dependency graph API and fetch data

**Tasks**:

- [ ] Define GraphQL query for `getDependencyGraph` in frontend
- [ ] Run GraphQL code generator to create TypeScript types
- [ ] Create custom hook `useDependencyGraph(campaignId, branchId)`
- [ ] Add error handling and loading states
- [ ] Test query with mock data via MSW
- [ ] Verify data structure matches expected format

**Success Criteria**:

- GraphQL query successfully fetches dependency graph
- TypeScript types generated correctly
- Custom hook handles loading/error states
- Unit tests for hook with MSW

**Testing**:

- Unit tests for `useDependencyGraph` hook
- MSW handlers for GraphQL responses
- Error state testing

**Status**: Complete (Commit: 8406688)

---

## Stage 3: Transform Graph Data to React Flow Format

**Goal**: Convert backend DependencyGraphResult to React Flow nodes and edges

**Tasks**:

- [x] Create utility function `transformGraphToFlow(graphData)`
- [x] Map DependencyNode to React Flow Node format
- [x] Map DependencyEdge to React Flow Edge format
- [x] Calculate initial node positions using auto-layout algorithm (dagre or elkjs)
- [x] Add metadata preservation for node/edge types
- [x] Create unit tests for transformation logic

**Success Criteria**:

- Graph data transforms to React Flow format correctly
- Nodes have reasonable initial positions
- Edge connections are correct
- Unit tests pass with various graph structures

**Testing**:

- Unit tests for transformation function
- Test with empty graph
- Test with single node
- Test with complex graph (cycles, multiple types)

**Status**: Complete (Commit: 71610db)

---

## Stage 4: Create Custom Node Components

**Goal**: Design and implement custom node components for each entity type

**Tasks**:

- [x] Create base CustomNode component with common styling
- [x] Create VariableNode component (green, database icon)
- [x] Create ConditionNode component (blue, logic icon)
- [x] Create EffectNode component (orange, zap icon)
- [x] Create EntityNode component (purple, box icon)
- [x] Add node labels, icons, and tooltips
- [x] Implement node hover effects
- [x] Add selection highlighting
- [x] Register custom node types with React Flow

**Success Criteria**:

- ✅ All node types render with distinct styles
- ✅ Icons and labels display correctly
- ✅ Hover and selection states work
- ✅ Nodes are visually distinct and accessible

**Testing**:

- ✅ Visual regression tests (manual for MVP)
- ✅ Component rendering tests (27 unit tests)
- ✅ Interaction tests (hover, select)

**Status**: Complete (Commit: 8b2c7a4)

---

## Stage 5: Create Custom Edge Components

**Goal**: Design and implement custom edge components for relationship types

**Tasks**:

- [ ] Create base CustomEdge component
- [ ] Create ReadsEdge component (solid line, arrow)
- [ ] Create WritesEdge component (dashed line, arrow)
- [ ] Create DependsOnEdge component (dotted line, arrow)
- [ ] Add edge labels for relationship types
- [ ] Implement edge hover effects
- [ ] Add animated flow for active dependencies
- [ ] Register custom edge types with React Flow

**Success Criteria**:

- All edge types render with distinct styles
- Labels are readable
- Hover effects work
- Edges are visually distinct

**Testing**:

- Component rendering tests
- Interaction tests (hover)

**Status**: Not Started

---

## Stage 6: Implement Auto-Layout Algorithm

**Goal**: Automatically arrange nodes in a readable hierarchical layout

**Tasks**:

- [ ] Install layout library (dagre or elkjs)
- [ ] Create `applyAutoLayout(nodes, edges)` utility function
- [ ] Implement hierarchical layout (top-to-bottom or left-to-right)
- [ ] Handle disconnected subgraphs
- [ ] Add padding and spacing configuration
- [ ] Optimize for readability (minimize edge crossings)
- [ ] Add "Re-layout" button to toolbar
- [ ] Persist user manual adjustments (optional)

**Success Criteria**:

- Nodes arranged in readable hierarchy
- No overlapping nodes
- Edges have minimal crossings
- Layout updates smoothly
- Performance good with 100+ nodes

**Testing**:

- Unit tests for layout algorithm
- Test with various graph sizes (10, 50, 100+ nodes)
- Test with disconnected subgraphs
- Performance testing

**Status**: Not Started

---

## Stage 7: Add Minimap and Controls

**Goal**: Provide navigation tools for large graphs

**Tasks**:

- [ ] Add React Flow MiniMap component
- [ ] Style minimap to match theme
- [ ] Add React Flow Controls component (zoom, fit view, lock)
- [ ] Create custom toolbar with additional controls
- [ ] Add "Fit View" button to center graph
- [ ] Add zoom level indicator
- [ ] Add fullscreen toggle (optional)
- [ ] Test minimap interaction

**Success Criteria**:

- Minimap renders correctly
- Controls are functional and accessible
- Can navigate large graphs easily
- Zoom and pan work smoothly

**Testing**:

- Manual testing with large graphs
- Interaction tests for controls

**Status**: Not Started

---

## Stage 8: Implement Selection and Highlighting

**Goal**: Enable node selection and highlight connected nodes

**Tasks**:

- [ ] Implement single node selection
- [ ] Implement multi-node selection (Shift+Click, box selection)
- [ ] Highlight upstream dependencies (what this node depends on)
- [ ] Highlight downstream dependents (what depends on this node)
- [ ] Add "Highlight Path" feature (click two nodes to show path)
- [ ] Add selection info panel (show node details)
- [ ] Add "Clear Selection" button
- [ ] Add keyboard shortcuts (Delete to remove, Escape to deselect)

**Success Criteria**:

- Single and multi-selection work
- Connected nodes highlight correctly
- Selection info displays relevant data
- Keyboard shortcuts work

**Testing**:

- Interaction tests for selection
- Test highlighting logic with various graph structures
- Keyboard shortcut tests

**Status**: Not Started

---

## Stage 9: Add Node Editing Integration

**Goal**: Enable double-click to edit underlying entities

**Tasks**:

- [ ] Add double-click event handler to nodes
- [ ] Create routing logic to appropriate edit page based on node type
- [ ] Pass entity ID and campaign context to edit page
- [ ] Add "View Details" button to node context menu
- [ ] Handle navigation to variable/condition/effect edit forms
- [ ] Add back navigation to return to flow view
- [ ] Preserve flow state (zoom, pan, selection) on return

**Success Criteria**:

- Double-click navigates to correct edit page
- Entity ID and context passed correctly
- Can return to flow view with preserved state
- Works for all node types

**Testing**:

- Integration tests for navigation
- Test each node type's edit flow
- State preservation tests

**Status**: Not Started

---

## Stage 10: Performance Optimization

**Goal**: Ensure smooth rendering with 100+ nodes

**Tasks**:

- [ ] Implement virtualization for large graphs (if needed)
- [ ] Optimize node/edge rendering (React.memo)
- [ ] Add lazy loading for node details
- [ ] Debounce layout recalculations
- [ ] Profile and optimize hot paths
- [ ] Add loading skeleton for initial render
- [ ] Test with 200+ node graphs
- [ ] Measure FPS and time to interactive

**Success Criteria**:

- 60 FPS with 100+ nodes
- Smooth zoom and pan
- Layout recalculation <500ms
- Initial render <2s for 100 nodes

**Testing**:

- Performance benchmarks with large graphs
- FPS measurement during interactions
- Memory profiling

**Status**: Not Started

---

## Stage 11: Add Filtering and Search

**Goal**: Enable users to filter and search nodes

**Tasks**:

- [ ] Add search input to filter nodes by label
- [ ] Add filter dropdown for node types (Variable, Condition, Effect, Entity)
- [ ] Add filter for edge types (Reads, Writes, Depends On)
- [ ] Implement "Show only selected and connected" filter
- [ ] Add "Show cycles only" filter
- [ ] Highlight search results
- [ ] Update minimap to show filtered view
- [ ] Add "Clear Filters" button

**Success Criteria**:

- Search finds nodes by label
- Type filters work correctly
- Filtered graphs render properly
- Can combine multiple filters
- Minimap reflects filtered state

**Testing**:

- Unit tests for filter logic
- Integration tests for UI interactions
- Test with various filter combinations

**Status**: Not Started

---

## Stage 12: Testing and Documentation

**Goal**: Comprehensive testing and user documentation

**Tasks**:

- [ ] Write unit tests for all utilities
- [ ] Write integration tests for FlowView component
- [ ] Write tests for custom nodes and edges
- [ ] Test with real backend data (not just mocks)
- [ ] Add accessibility testing (keyboard navigation, ARIA labels)
- [ ] Create user documentation for flow view
- [ ] Document keyboard shortcuts
- [ ] Add inline help tooltips
- [ ] Update CLAUDE.md with flow view section
- [ ] Update README.md with flow view feature

**Success Criteria**:

- All tests passing
- Test coverage >80%
- Accessibility audit passes
- Documentation complete and accurate
- No console errors or warnings

**Testing**:

- Run full test suite
- Manual accessibility testing
- Cross-browser testing (Chrome, Firefox, Safari)

**Status**: Not Started

---

## Technical Decisions

### React Flow vs Other Libraries

**Decision**: Use React Flow (@xyflow/react)

**Reasoning**:

- Best React integration and TypeScript support
- Built-in minimap, controls, and interaction handlers
- Good performance with large graphs (100+ nodes)
- Active maintenance and good documentation
- Supports custom nodes and edges
- MIT license

**Alternatives considered**:

- D3.js: More flexible but requires more custom code
- Cytoscape.js: Good for scientific graphs but less React-friendly
- vis.js: Older library, less active maintenance

### Layout Algorithm

**Decision**: Use dagre for hierarchical layout

**Reasoning**:

- Proven algorithm for directed graphs
- Fast performance (100+ nodes in <100ms)
- Good integration with React Flow
- Handles cycles gracefully
- Simple API

**Alternatives considered**:

- elkjs: More sophisticated but heavier and slower
- Custom layout: Too much work for MVP

### Node Positioning Strategy

**Decision**: Auto-layout on load, manual adjustments preserved

**Reasoning**:

- Auto-layout provides good initial view
- Manual adjustments let users organize for their needs
- "Re-layout" button available to reset
- Positions stored in component state (not persisted for MVP)

**Future enhancement**: Persist layout to user preferences

### Performance Strategy

**Decision**: React.memo for nodes/edges, no virtualization initially

**Reasoning**:

- React Flow handles most performance optimization
- Memoization prevents unnecessary re-renders
- Virtualization adds complexity
- 100 nodes should perform well without virtualization
- Can add virtualization later if needed

### Data Fetching Strategy

**Decision**: Fetch entire graph on page load, no real-time updates

**Reasoning**:

- Dependency graphs don't change frequently
- Simpler implementation for MVP
- Can add polling or subscriptions later
- "Refresh" button allows manual updates

**Future enhancement**: GraphQL subscription for real-time updates

---

## Integration Points

1. **Dependency Graph API** (TICKET-014):
   - `getDependencyGraph` query provides nodes and edges
   - `validateDependencyGraph` for cycle detection
   - `getNodeDependencies` and `getNodeDependents` for highlighting

2. **State Management** (TICKET-018):
   - Campaign ID from Zustand campaign store
   - Auth token for GraphQL requests

3. **Routing** (TICKET-017):
   - New `/flow` route with lazy loading
   - Protected route requiring authentication

4. **GraphQL Client** (TICKET-018):
   - Apollo Client for queries
   - Code generation for TypeScript types

---

## Success Metrics

- Flow view renders dependency graphs correctly
- All entity types visually distinct
- Can navigate graphs with 100+ nodes smoothly
- Selection and highlighting work as expected
- Auto-layout produces readable results
- No performance issues (60 FPS, <2s initial render)
- Tests pass with >80% coverage
- Accessibility standards met

---

## Notes

- This is a visualization-focused feature, not a graph editor
- Users cannot create/delete nodes or edges in the flow view (edit via forms)
- Focus on read-only visualization with good UX
- Performance is critical for usability with large campaigns
- Accessibility is important (keyboard navigation, screen reader support)
