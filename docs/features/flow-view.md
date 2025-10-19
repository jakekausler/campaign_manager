# Flow View - Dependency Graph Visualization

Interactive flowchart visualization for exploring relationships between campaign entities using React Flow.

## Overview

The Flow View provides an interactive, visual representation of your campaign's dependency graph, showing how variables, conditions, effects, and other entities relate to and depend on each other. This makes it easy to understand complex campaign logic at a glance.

**Implementation**: TICKET-021 (12 stages, commits: 66d4238 - ea4f9e0)

## Features

### Core Visualization

- **Interactive Graph Canvas**: Powered by React Flow for smooth panning and zooming
- **Auto-Layout Algorithm**: Dagre hierarchical layout arranges nodes automatically
- **Custom Node Types**: Color-coded nodes for different entity types
- **Custom Edge Types**: Visual distinctions for different relationship types
- **MiniMap**: Overview of the entire graph with current viewport indicator
- **Zoom Controls**: Zoom in/out and fit-to-view buttons
- **Zoom Indicator**: Real-time display of current zoom level

### Node Types

Each entity type has a distinct visual style:

| Node Type | Color            | Icon      | Description                                          |
| --------- | ---------------- | --------- | ---------------------------------------------------- |
| VARIABLE  | Green (#22c55e)  | Database  | State variables (e.g., gold amount, quest status)    |
| CONDITION | Blue (#3b82f6)   | GitBranch | Logical conditions (e.g., has quest, health > 50)    |
| EFFECT    | Orange (#f97316) | Zap       | Effects that mutate state (e.g., gain XP, lose gold) |
| ENTITY    | Purple (#a855f7) | Box       | Generic entities (events, encounters, locations)     |

### Edge Types

Relationships between nodes are shown with different line styles:

| Edge Type  | Style             | Color            | Animation | Description                          |
| ---------- | ----------------- | ---------------- | --------- | ------------------------------------ |
| READS      | Solid line        | Slate (#64748b)  | None      | Entity reads from variable/condition |
| WRITES     | Dashed line (5,5) | Orange (#f97316) | Flowing   | Entity writes to/modifies variable   |
| DEPENDS_ON | Dotted line (2,2) | Purple (#a855f7) | None      | Entity depends on another entity     |

### Selection and Highlighting

- **Single Selection**: Click a node to select it
- **Multi-Selection**: Shift/Ctrl/Cmd+Click to select multiple nodes
- **Box Selection**: Drag to select multiple nodes (partial selection mode)
- **Dependency Highlighting**:
  - Selected nodes: Blue border with shadow
  - Upstream dependencies: Green border (what this depends on)
  - Downstream dependents: Orange border (what depends on this)
  - Unrelated nodes: Dimmed to 30% opacity
- **Selection Panel**: Shows selected node details and dependency counts
- **Clear Selection**: Click pane, press Escape, or use Clear button

### Filtering and Search

- **Search**: Filter nodes by label (case-insensitive)
- **Node Type Filters**: Show/hide VARIABLE, CONDITION, EFFECT, ENTITY nodes
- **Edge Type Filters**: Show/hide READS, WRITES, DEPENDS_ON edges
- **Show Cycles Only**: Display only nodes that are part of circular dependencies
- **Show Selected and Connected**: Focus on selected nodes and their direct connections
- **Real-time Counts**: See number of visible nodes and edges by type
- **Clear All Filters**: Reset all filters with one click

### Performance Optimizations

- **React.memo**: All components memoized to prevent unnecessary re-renders
- **useMemo**: Expensive computations cached (layout, filtering, selection)
- **Loading Skeleton**: Animated placeholders during initial load
- **Efficient Algorithms**:
  - Auto-layout: O(V + E) Dagre algorithm
  - Cycle detection: O(V + E) DFS traversal
  - Selection highlighting: O(V + E) BFS traversal

### Node Editing Integration

- **Double-Click**: Double-click any node to edit (infrastructure ready)
- **Current Behavior**: Shows informational alert (edit pages not yet implemented)
- **Route Templates**: `/variables/:id`, `/conditions/:id`, `/effects/:id`, `/entities/:id`
- **Future**: Will navigate to entity edit forms when pages are created

## User Interface

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Filter Panel]                    [Toolbar: Re-layout] │
│                                                         │
│                   [Flow Canvas]                         │
│                                                         │
│                    • Nodes                              │
│                    • Edges                              │
│                    • Selection highlighting             │
│                                                         │
│ [Stats Panel]                                           │
│ Nodes: 45 • Edges: 62                          [Controls] │
│                                                [MiniMap] │
│ [Selection Panel]                              [Zoom: 100%] │
└─────────────────────────────────────────────────────────┘
```

### Controls and Tools

#### Filter Panel (Top-Left)

- Search input for filtering by node label
- Checkboxes for node types (Variable, Condition, Effect, Entity)
- Checkboxes for edge types (Reads, Writes, Depends On)
- Toggle for "Show cycles only"
- Toggle for "Show selected and connected only"
- Real-time count display (e.g., "Variable (12)")
- Clear all filters button (shown when filters are active)

#### Toolbar (Top-Left, below filters)

- **Re-layout Button**: Reapplies auto-layout algorithm to reset positions
  - Icon animates (spinning) during layout
  - Disabled during layout operation

#### Stats Panel (Bottom-Left)

- Total node and edge counts
- Color legend for node types

#### Selection Panel (Bottom-Left, appears when nodes selected)

- List of selected node labels and types
- Upstream dependency count
- Downstream dependent count
- Visual legend explaining highlight colors
- Clear selection button with Escape key hint

#### Flow Controls (Bottom-Right)

- **MiniMap**: Overview of entire graph with color-coded nodes
- **Controls**: Zoom in, zoom out, fit view buttons
- **Zoom Indicator**: Current zoom percentage

## Keyboard Shortcuts

| Shortcut             | Action                                  |
| -------------------- | --------------------------------------- |
| **Escape**           | Clear node selection                    |
| **Shift + Click**    | Toggle node in selection                |
| **Ctrl/Cmd + Click** | Toggle node in selection                |
| **Tab**              | Navigate focusable elements             |
| **Arrow Keys**       | Pan canvas (React Flow default)         |
| **+ / -**            | Zoom in/out (React Flow default)        |
| **0**                | Reset zoom to 100% (React Flow default) |

## Technical Implementation

### Architecture

```
FlowViewPage (Main Component)
├── useDependencyGraph (GraphQL hook)
├── transformGraphToFlow (Data transformation + layout)
├── FilterPanel (Search and filtering)
├── FlowToolbar (Re-layout button)
├── ReactFlow (Core visualization)
│   ├── Custom Node Components
│   │   ├── VariableNode
│   │   ├── ConditionNode
│   │   ├── EffectNode
│   │   └── EntityNode
│   ├── Custom Edge Components
│   │   ├── ReadsEdge
│   │   ├── WritesEdge
│   │   └── DependsOnEdge
│   └── FlowControls
│       ├── MiniMap
│       ├── Controls
│       └── Zoom Indicator
├── SelectionPanel (Selection info)
└── Stats Panel (Graph metrics)
```

### Key Technologies

- **React Flow (@xyflow/react)**: Core graph visualization library
- **Dagre**: Hierarchical layout algorithm
- **GraphQL + Apollo Client**: Data fetching
- **Zustand**: Campaign context state management
- **Tailwind CSS**: Styling and theming
- **Lucide React**: Icons
- **Vitest + Testing Library**: Unit and integration tests

### Data Flow

1. **Fetch**: `useDependencyGraph` queries GraphQL API for `getDependencyGraph`
2. **Transform**: `transformGraphToFlow` converts backend data to React Flow format
3. **Layout**: `applyAutoLayout` (Dagre) positions nodes hierarchically
4. **Filter**: `filterNodes` and `filterEdges` apply user-selected filters
5. **Select**: `calculateSelectionState` computes upstream/downstream dependencies
6. **Render**: React Flow displays nodes and edges with applied styling

### GraphQL Query

```graphql
query GetDependencyGraph($campaignId: ID!, $branchId: ID) {
  getDependencyGraph(campaignId: $campaignId, branchId: $branchId) {
    nodes {
      id
      type
      label
      entityId
      metadata
    }
    edges {
      id
      fromId
      toId
      type
      metadata
    }
    statistics {
      nodeCount
      edgeCount
      cycleCount
    }
    branchId
    campaignId
    builtAt
  }
}
```

### Component Files

**Location**: `packages/frontend/src`

#### Pages

- `pages/FlowViewPage.tsx` - Main page component

#### Components

- `components/features/flow/CustomNode.tsx` - Base node component
- `components/features/flow/VariableNode.tsx` - Variable node type
- `components/features/flow/ConditionNode.tsx` - Condition node type
- `components/features/flow/EffectNode.tsx` - Effect node type
- `components/features/flow/EntityNode.tsx` - Entity node type
- `components/features/flow/CustomEdge.tsx` - Base edge component
- `components/features/flow/ReadsEdge.tsx` - Reads relationship edge
- `components/features/flow/WritesEdge.tsx` - Writes relationship edge
- `components/features/flow/DependsOnEdge.tsx` - Dependency relationship edge
- `components/features/flow/FilterPanel.tsx` - Filtering UI
- `components/features/flow/SelectionPanel.tsx` - Selection info panel
- `components/features/flow/FlowToolbar.tsx` - Re-layout button
- `components/features/flow/FlowControls.tsx` - MiniMap, controls, zoom indicator
- `components/features/flow/FlowLoadingSkeleton.tsx` - Loading state skeleton

#### Utilities

- `utils/graph-layout.ts` - Data transformation and auto-layout
- `utils/graph-selection.ts` - Selection state and dependency traversal
- `utils/graph-filters.ts` - Filtering logic and cycle detection
- `utils/graph-generator.ts` - Test graph generation (for performance tests)
- `utils/node-navigation.ts` - Node edit route mapping
- `utils/node-colors.ts` - Centralized node color constants

#### Hooks

- `services/api/hooks/useDependencyGraph.ts` - GraphQL query hook

#### Tests

- `pages/FlowViewPage.test.tsx` - Page integration tests (13 tests)
- `components/features/flow/*.test.tsx` - Component unit tests (124 tests)
- `utils/graph-*.test.ts` - Utility function tests (102 tests)
- `services/api/hooks/useDependencyGraph.test.ts` - Hook tests (9 tests)

**Total Test Coverage**: 248 tests specific to Flow View feature

## Performance Benchmarks

Based on performance tests with generated graphs:

| Graph Size | Nodes | Edges | Transform Time | Status     |
| ---------- | ----- | ----- | -------------- | ---------- |
| Small      | 100   | ~200  | ~1065 ms       | ✅ <2000ms |
| Medium     | 200   | ~400  | ~1600 ms       | ✅ <3000ms |
| Large      | 500   | ~1000 | ~2926 ms       | ✅ <5000ms |

**Algorithms**:

- Auto-layout (Dagre): O(V + E)
- Cycle detection (DFS): O(V + E)
- Selection traversal (BFS): O(V + E)

**Rendering**: React Flow handles virtualization and viewport clipping automatically

## Accessibility

The Flow View meets WCAG 2.1 Level AA accessibility standards:

### Keyboard Navigation

- All controls accessible via keyboard
- Tab navigation for focusable elements
- Escape key to clear selection
- Multi-select with Shift/Ctrl/Cmd modifiers

### ARIA Labels

- Descriptive labels on all nodes: `"VARIABLE node: Gold Amount"`
- Labels on interactive buttons and controls
- Connection handles labeled for screen readers
- Decorative icons marked with `aria-hidden="true"`

### Visual Accessibility

- Color contrast meets 4.5:1 ratio for all text
- Focus indicators visible on all interactive elements
- Color + shape coding (edges use line styles, not just colors)
- Clear visual feedback for selection and highlighting

### Screen Reader Support

- Semantic HTML throughout
- Proper button elements for interactive controls
- Form inputs with labels
- Meaningful text content (not icon-only)

**See Also**: `packages/frontend/ACCESSIBILITY-AUDIT-FLOW-VIEW.md` for full audit

## Use Cases

### 1. Understanding Campaign Logic

**Scenario**: GM wants to understand how completing Quest A affects the game world

**Steps**:

1. Navigate to Flow View (`/flow`)
2. Search for "Quest A" in filter panel
3. Click the Quest A condition node
4. View highlighted dependencies:
   - **Green borders**: What Quest A depends on (e.g., variables it reads)
   - **Orange borders**: What depends on Quest A (e.g., effects triggered on completion)
5. Review selection panel for dependency counts

### 2. Debugging Circular Dependencies

**Scenario**: Effects aren't resolving correctly, suspect circular logic

**Steps**:

1. Open Flow View
2. Enable "Show cycles only" filter
3. View all nodes that are part of cycles
4. Trace the circular path by following edges
5. Identify which condition/effect to refactor to break the cycle

### 3. Exploring Variable Usage

**Scenario**: Want to see all places where "Gold" variable is used

**Steps**:

1. Open Flow View
2. Filter node types: Show only VARIABLE nodes
3. Search for "Gold"
4. Click the Gold variable node
5. See all effects that write to gold (orange downstream)
6. See all conditions that read from gold (upstream/downstream based on edge direction)

### 4. Planning New Features

**Scenario**: Planning to add a new quest line, want to see existing quest structure

**Steps**:

1. Open Flow View
2. Search for "Quest" to see all quest-related nodes
3. Use box selection to select multiple quest nodes
4. View how quests connect and depend on each other
5. Identify where new quest should fit in the dependency graph

### 5. Performance Analysis

**Scenario**: Checking if dependency graph is getting too complex

**Steps**:

1. Open Flow View
2. Check stats panel for total node/edge counts
3. Enable "Show cycles only" to check for complexity issues
4. Use zoom out to see overall structure
5. Look for overly dense areas that might need refactoring

## Known Limitations

1. **Backend Dependency**: Requires TICKET-014 (Dependency Graph API) to be deployed
2. **Edit Pages**: Double-click navigation not active (edit pages don't exist yet)
3. **Real-time Updates**: No GraphQL subscriptions (manual refresh required)
4. **Layout Persistence**: Node positions reset on page reload (no save functionality)
5. **Large Graphs**: With 500+ nodes, initial layout may take 3-5 seconds
6. **Visual-First**: Not ideal for users who rely entirely on screen readers (recommend using dependency list API as alternative)

## Future Enhancements

### Planned (Post-MVP)

1. **Edit Page Integration**: Activate double-click navigation when edit pages are implemented
2. **Layout Persistence**: Save custom node positions to user preferences
3. **Export**: Download graph as PNG/SVG image
4. **Real-time Updates**: GraphQL subscriptions for live graph changes
5. **Advanced Filtering**:
   - Filter by metadata values
   - Filter by creation date
   - Filter by branch/version
6. **Search Enhancements**:
   - Search by entity ID
   - Search by metadata values
   - Highlight search results in minimap

### Optional (Future Iterations)

1. **Graph Editing**: Create/delete nodes and edges directly in flow view
2. **Multiple Layout Algorithms**: Force-directed, circular, tree layouts
3. **Clustering**: Group related nodes into collapsible clusters
4. **Path Finding**: Show shortest path between two nodes
5. **History**: Undo/redo for layout changes
6. **Collaboration**: Real-time multi-user viewing and annotations
7. **Accessibility**: Roving tabindex, ARIA live regions, screen reader announcements

## Troubleshooting

### Graph Not Loading

**Symptom**: Empty state message or loading forever

**Solutions**:

1. Check that campaign is selected (campaign store)
2. Verify backend API is running and healthy
3. Check browser console for GraphQL errors
4. Try refreshing the page
5. Verify you have permissions to view the campaign

### Performance Issues

**Symptom**: Slow rendering, laggy interactions

**Solutions**:

1. Check graph size in stats panel (500+ nodes may be slow)
2. Use filters to reduce visible nodes
3. Try "Show selected and connected only" to focus view
4. Close other browser tabs to free memory
5. Disable browser extensions that might interfere

### Layout Issues

**Symptom**: Overlapping nodes, poor arrangement

**Solutions**:

1. Click "Re-layout" button to reapply auto-layout
2. Try zooming out to see full graph
3. Manually drag nodes to desired positions
4. Check for cycles (may cause layout difficulties)

### Selection Not Working

**Symptom**: Can't select nodes or selection doesn't highlight

**Solutions**:

1. Check if filters are hiding selected nodes
2. Disable "Show selected and connected only" filter
3. Press Escape to clear stale selection
4. Refresh the page if selection state is corrupted

## Related Documentation

- **Backend API**: See TICKET-014 (Dependency Graph System)
- **GraphQL Schema**: `packages/api/src/graphql/schema.graphql`
- **Accessibility Audit**: `packages/frontend/ACCESSIBILITY-AUDIT-FLOW-VIEW.md`
- **Frontend Setup**: `packages/frontend/README.md`
- **Implementation Plan**: `plan/TICKET-021-implementation-plan.md`
- **Ticket Details**: `plan/TICKET-021.md`

## Support

For issues or questions:

1. Check this documentation first
2. Review implementation notes in `plan/TICKET-021.md`
3. Check test files for usage examples
4. Consult React Flow documentation: https://reactflow.dev
