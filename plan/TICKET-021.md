# TICKET-021: Flow View with React Flow

## Status

- [ ] Completed
- **Commits**: 66d4238

## Implementation Notes

### Planning Phase (Commit: 66d4238)

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
