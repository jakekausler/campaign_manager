# TICKET-024 Implementation Plan: Cross-View Synchronization

## Overview

Implement synchronized selection and highlighting across Map, Flow, and Timeline views using Zustand state management. When a user selects an entity (Settlement, Structure, Event, or Encounter) in one view, it should be highlighted in all other views with smooth scrolling/panning to bring it into view.

## Architecture

- **State Management**: New Zustand `selection-slice.ts` for shared selection state
- **Entity Types**: Settlement, Structure, Event, Encounter
- **Views**: Map (MapPage), Flow (FlowViewPage), Timeline (TimelinePage)
- **Pattern**: Follow existing slice pattern (auth-slice, campaign-slice)
- **Persistence**: No persistence needed (ephemeral session state)
- **Multi-select**: Support via array of selected entity IDs

## Stages

### Stage 1: Create Selection State Slice ✅ COMPLETE

**Goal**: Create Zustand slice for managing cross-view selection state

**Tasks**:

- [x] Create `packages/frontend/src/stores/selection-slice.ts`
- [x] Define `EntityType` enum (SETTLEMENT, STRUCTURE, EVENT, ENCOUNTER)
- [x] Define `SelectedEntity` interface with id, type, and metadata
- [x] Implement state: `selectedEntities: SelectedEntity[]`
- [x] Implement actions:
  - `selectEntity(entity: SelectedEntity)` - Replace current selection
  - `addToSelection(entity: SelectedEntity)` - Add to multi-select
  - `removeFromSelection(entityId: string)` - Remove from multi-select
  - `clearSelection()` - Clear all selections
  - `toggleSelection(entity: SelectedEntity)` - Toggle entity in selection
- [x] Add selection slice to root store in `packages/frontend/src/stores/index.ts`
- [x] Export `useSelectionStore()` hook with optimized selectors
- [x] Write unit tests in `packages/frontend/src/stores/selection-slice.test.ts`

**Success Criteria**:

- ✅ Selection slice integrates with root store
- ✅ All actions update state correctly
- ✅ Unit tests pass with >90% coverage (49 tests, all passing)
- ✅ Type safety enforced for entity types

**Implementation Notes**:

- State is ephemeral (not persisted to localStorage) as expected
- Followed existing slice pattern from auth-slice and campaign-slice
- Used optimized selectors to prevent unnecessary re-renders
- Exported EntityType as value (not type) since enums are runtime values
- Used get() in addToSelection/toggleSelection for conditional logic
- Duplicate prevention via ID checking prevents multiple selections of same entity
- Flexible metadata field allows view-specific data without coupling
- Comprehensive test coverage: all actions, all entity types, edge cases (duplicates, large multi-select, interleaved operations)

**Commit**: 4fb08aa

---

### Stage 2: Map View Selection Integration ✅ COMPLETE

**Goal**: Integrate selection state with MapPage for settlements and structures

**Tasks**:

- [x] Read current MapPage implementation to understand map click handlers
- [x] Add `useSelectionStore()` hook to MapPage component
- [x] Implement click handlers for settlements:
  - Single-click: select settlement (update selection state)
  - Ctrl+click: toggle settlement in multi-select
- [x] Implement click handlers for structures:
  - Single-click: select structure (update selection state)
  - Ctrl+click: toggle structure in multi-select
- [x] Add highlighting for selected settlements (blue border, larger radius)
- [x] Add highlighting for selected structures (blue border, larger radius)
- [x] Subscribe to selection state changes from other views
- [x] Implement auto-pan to selected entity when selection changes externally
- [x] Write integration tests for map selection with MSW handlers

**Success Criteria**:

- ✅ Clicking settlement/structure updates global selection state
- ✅ Map highlights selected entities with visual indicators
- ✅ Map pans to entity when selected from another view
- ✅ Multi-select works with Ctrl+click
- ✅ Tests verify selection state updates

**Implementation Notes**:

- MapPage: Dual-mode click handling (single-click opens inspector, Ctrl+click toggles multi-select)
- Map component: Enhanced onEntitySelect callback with event data and metadata
- Highlighting: MapLibre setPaintProperty for dynamic styling (blue border #3b82f6, larger radius)
- Auto-pan: flyTo() for single entity (zoom 12, 500ms), fitBounds() for multiple (50px padding)
- Metadata: locationId for settlements, settlementId for structures
- Tests: 6 new integration tests covering single/multi-select for both entity types
- All 1120 tests pass (69 test files)
- Code Reviewer approved with optional improvements deferred
- Polygon centroid uses first coordinate (could improve with Turf.js in future)

**Commit**: a97f37b

---

### Stage 3: Flow View Selection Integration ✅ COMPLETE

**Goal**: Integrate selection state with FlowViewPage for all entity types

**Tasks**:

- [x] Read current FlowViewPage implementation to understand node selection
- [x] Add `useSelectionStore()` hook to FlowViewPage component
- [x] Implement node click handlers:
  - Single-click: select entity (update selection state based on node type)
  - Ctrl+click: toggle entity in multi-select
- [x] Map React Flow node types to EntityType:
  - VariableNode → Not selectable (no entity metadata)
  - ConditionNode → Not selectable (no entity metadata)
  - EffectNode → SETTLEMENT, STRUCTURE, EVENT, or ENCOUNTER (based on metadata.entityType)
  - EntityNode → SETTLEMENT or STRUCTURE (based on metadata.entityType)
- [x] Add node highlighting for selected entities (uses existing applySelectionStyles)
- [x] Subscribe to selection state changes from other views
- [x] Implement auto-scroll/zoom to selected node when selection changes externally
- [x] Update SelectionPanel to show cross-view selection (already working)
- [x] Write integration tests for flow selection

**Success Criteria**:

- ✅ Clicking node updates global selection state
- ✅ Flow highlights selected nodes with visual indicators
- ✅ Flow auto-scrolls/zooms to node when selected from another view
- ✅ Multi-select works with Ctrl+click
- ✅ SelectionPanel reflects global selection state

**Implementation Notes**:

- Created `nodeToSelectedEntity()` function to map Flow nodes to SelectedEntity
- EFFECT nodes extract entityType from metadata: "Settlement" → SETTLEMENT, "Structure" → STRUCTURE, etc.
- ENTITY nodes also extract entityType from metadata
- VARIABLE and CONDITION nodes return null (not selectable entities)
- Bidirectional sync: Local clicks → global store, global changes → local selection
- Echo prevention via `isLocalSelectionChange` ref to prevent infinite loops
- Auto-scroll: single node uses `setCenter(x+75, y+30, { zoom: 1.5, duration: 500 })`
- Auto-scroll: multiple nodes use `fitView({ nodes, duration: 500, padding: 0.2 })`
- ReactFlowProvider wrapper enables programmatic control via reactFlowInstance ref
- Highlighting reuses existing `applySelectionStyles()` from TICKET-021
- Pane click and Escape key clear both local and global selection
- Added 16 integration tests documenting all selection patterns
- All 1,107 tests pass with proper TypeScript types
- Code review approved with only optional performance improvements

**Commit**: fce9730

---

### Stage 4: Timeline View Selection Integration ✅

**Goal**: Integrate selection state with TimelinePage for events and encounters

**Tasks**:

- [ ] Read current TimelinePage implementation to understand item selection
- [ ] Add `useSelectionStore()` hook to TimelinePage component
- [ ] Implement timeline item click handlers:
  - Single-click: select event/encounter (update selection state)
  - Ctrl+click: toggle item in multi-select
- [ ] Add item highlighting for selected events/encounters (border/background)
- [ ] Subscribe to selection state changes from other views
- [ ] Implement auto-scroll to selected item when selection changes externally
- [ ] Handle case where selected entity is Settlement/Structure:
  - Find related events/encounters for that entity
  - Optionally highlight or filter to show related items
- [ ] Write integration tests for timeline selection

**Success Criteria**:

- Clicking timeline item updates global selection state
- Timeline highlights selected items with visual indicators
- Timeline auto-scrolls to item when selected from another view
- Multi-select works with Ctrl+click
- Related entity filtering works (e.g., show events for selected settlement)

**Notes**:

- vis-timeline has `setSelection()` API for programmatic selection
- Use `timeline.focus()` for auto-scrolling to selected items
- Consider showing related items when Settlement/Structure selected
- Test with items at different time ranges

---

### Stage 5: Cross-View Auto-Scroll/Pan Implementation ✅

**Goal**: Implement smooth auto-scroll/pan to selected entities in all views

**Tasks**:

- [ ] Create utility function `scrollToEntity()` for Map view:
  - Accept entity type and ID
  - Query entity location from GraphQL if needed
  - Use `map.flyTo()` for smooth pan/zoom animation
  - Handle case where entity not in current viewport
- [ ] Create utility function `scrollToNode()` for Flow view:
  - Accept node ID
  - Use React Flow `fitView()` or `setCenter()` with animation
  - Calculate appropriate zoom level to show node and immediate neighbors
- [ ] Create utility function `scrollToItem()` for Timeline view:
  - Accept item ID
  - Use vis-timeline `focus()` with animation
  - Adjust timeline range if item outside current view
- [ ] Add debouncing to prevent scroll thrashing with rapid selection changes
- [ ] Add user preference to disable auto-scroll (optional)
- [ ] Write unit tests for scroll utilities

**Success Criteria**:

- All views smoothly scroll to selected entity
- Animations are smooth and not jarring (300-500ms duration)
- Multiple rapid selections don't cause scroll thrashing
- Scroll works even when entity initially off-screen

**Notes**:

- Use 300-500ms animation duration for smooth transitions
- Debounce selection changes by 100-200ms to prevent thrashing
- Consider zoom level: should show context, not just the entity
- Test with entities at extreme positions (edges of map/timeline)

---

### Stage 6: Multi-Select Support and Keyboard Shortcuts ✅

**Goal**: Implement multi-select with keyboard modifiers and visual feedback

**Tasks**:

- [ ] Implement Ctrl+click to toggle entity in selection (all views)
- [ ] Implement Shift+click for range selection in Timeline view
- [ ] Add keyboard shortcut Ctrl+A to select all visible entities
- [ ] Add keyboard shortcut Escape to clear selection
- [ ] Add visual indicator showing number of selected entities
- [ ] Create `SelectionInfo` component to show selected entities:
  - Count: "3 entities selected"
  - List of entity names/types
  - "Clear Selection" button
- [ ] Position SelectionInfo component (e.g., bottom-right corner)
- [ ] Update all view highlighting to show multi-select state
- [ ] Write tests for multi-select interactions

**Success Criteria**:

- Ctrl+click toggles entities in/out of selection
- Shift+click selects range in Timeline
- Keyboard shortcuts work (Ctrl+A, Escape)
- SelectionInfo shows accurate count and entity list
- All views reflect multi-select state visually

**Notes**:

- Multi-select should work across different entity types
- SelectionInfo should be dismissible but not intrusive
- Consider max selection limit (e.g., 50 entities) for performance
- Test with mixed entity types (settlement + event, etc.)

---

### Stage 7: Structure Parent Settlement Highlighting ✅

**Goal**: When Structure selected, show parent Settlement location on map

**Tasks**:

- [ ] Query parent Settlement for selected Structure:
  - Use existing GraphQL hook `useStructureDetails()`
  - Extract parent Settlement ID and location
- [ ] Add secondary highlighting on Map for parent Settlement:
  - Different visual style from primary selection (e.g., dashed border)
  - Label showing "Parent of [Structure Name]"
- [ ] Update Map auto-pan to show both Structure and parent Settlement:
  - Calculate bounding box containing both
  - Zoom to fit both in viewport with padding
- [ ] Add parent Settlement info to SelectionInfo component
- [ ] Write tests for parent Settlement highlighting

**Success Criteria**:

- Selecting Structure highlights parent Settlement on Map
- Visual distinction between primary and parent highlighting
- Map zooms to show both Structure and parent Settlement
- SelectionInfo shows parent relationship
- Tests verify GraphQL query and highlighting

**Notes**:

- Parent highlighting should be subtle but visible
- Handle case where parent Settlement location not available
- Consider showing breadcrumb: "Settlement > Structure"
- Test with Structures at different locations from parent

---

### Stage 8: Testing, Documentation, and Polish ✅

**Goal**: Comprehensive testing, documentation, and final polish

**Tasks**:

- [ ] Write comprehensive integration tests:
  - Cross-view selection synchronization (Map → Flow → Timeline)
  - Multi-select across different entity types
  - Auto-scroll/pan in all views
  - Keyboard shortcuts (Ctrl+click, Ctrl+A, Escape)
  - Parent Settlement highlighting for Structures
- [ ] Write MSW handlers for all GraphQL queries used in selection
- [ ] Update all view READMEs with selection documentation
- [ ] Create feature documentation: `docs/features/cross-view-selection.md`
  - Architecture overview
  - Selection state management
  - Integration guide for new views
  - Keyboard shortcuts reference
  - Performance considerations
- [ ] Performance testing:
  - Test with 100+ entities selected
  - Measure selection state update time
  - Optimize re-renders with React.memo if needed
- [ ] Accessibility audit:
  - Keyboard navigation for selection
  - Screen reader announcements for selection changes
  - ARIA attributes for selected entities
  - Focus management during auto-scroll
- [ ] Visual polish:
  - Consistent highlight colors across all views
  - Smooth animations for all transitions
  - Clear visual feedback for all interactions
- [ ] Run all tests and ensure >90% coverage
- [ ] Update CLAUDE.md with Cross-View Selection section

**Success Criteria**:

- All integration tests pass (target: 50+ tests for this ticket)
- Feature documentation is comprehensive and clear
- Performance is acceptable (<100ms for selection updates)
- Accessibility audit passes (WCAG 2.1 Level AA)
- Visual polish is complete and consistent
- CLAUDE.md updated with feature reference

**Notes**:

- Test edge cases: empty selection, single entity, 100+ entities
- Document known limitations (if any)
- Ensure consistent behavior across all browsers
- Get user feedback on auto-scroll sensitivity

---

## Technical Details

### Selection State Shape

```typescript
interface SelectedEntity {
  id: string;
  type: EntityType;
  name?: string; // Optional display name
  metadata?: {
    // View-specific data for optimization
    settlementId?: string; // For Structures
    locationId?: string; // For map panning
    scheduledAt?: string; // For timeline scrolling
  };
}

enum EntityType {
  SETTLEMENT = 'SETTLEMENT',
  STRUCTURE = 'STRUCTURE',
  EVENT = 'EVENT',
  ENCOUNTER = 'ENCOUNTER',
}

interface SelectionSlice {
  selectedEntities: SelectedEntity[];
  selectEntity: (entity: SelectedEntity) => void;
  addToSelection: (entity: SelectedEntity) => void;
  removeFromSelection: (entityId: string) => void;
  clearSelection: () => void;
  toggleSelection: (entity: SelectedEntity) => void;
}
```

### GraphQL Queries Needed

- Settlement location (for map panning): existing `useSettlementDetails()`
- Structure parent Settlement: existing `useStructureDetails()`
- Event/Encounter details: existing hooks from Timeline implementation

### Performance Considerations

- Debounce selection changes (100-200ms) to prevent thrashing
- Use React.memo for view components to prevent unnecessary re-renders
- Optimize Zustand selectors to only trigger re-renders when relevant state changes
- Consider virtualizing large entity lists in SelectionInfo component
- Limit max selection to 50-100 entities to prevent performance degradation

### Accessibility Requirements

- All selected entities must have `aria-selected="true"`
- Selection changes must announce to screen readers
- Keyboard navigation must work for all selection actions
- Focus management during auto-scroll (don't steal focus)
- High contrast mode support for selection highlights

## Dependencies

- Zustand (already installed)
- MapLibre GL (already installed, for Map view)
- React Flow (already installed, for Flow view)
- vis-timeline (already installed, for Timeline view)
- Existing GraphQL hooks (Settlement, Structure, Event, Encounter)

## Testing Strategy

- **Unit tests**: Selection slice state management (selection-slice.test.ts)
- **Integration tests**: Each view's selection integration (Map, Flow, Timeline)
- **E2E tests**: Cross-view synchronization scenarios
- **Performance tests**: Selection with 100+ entities
- **Accessibility tests**: Keyboard navigation and screen reader support

## Risks and Mitigation

- **Risk**: Selection state updates causing excessive re-renders
  - **Mitigation**: Optimize Zustand selectors, use React.memo
- **Risk**: Auto-scroll conflicts with user manual scrolling
  - **Mitigation**: Debounce selection changes, add user preference to disable
- **Risk**: Different entity types having different data requirements
  - **Mitigation**: Use flexible metadata field in SelectedEntity interface
- **Risk**: Performance issues with large multi-select
  - **Mitigation**: Limit max selection, virtualize SelectionInfo list

## Success Metrics

- All 8 acceptance criteria met
- > 90% test coverage for selection code
- <100ms selection state update time (p95)
- Zero accessibility violations (WCAG 2.1 Level AA)
- User feedback positive on auto-scroll sensitivity

## Estimated Effort

- Stage 1: 0.5 days (Selection state slice)
- Stage 2: 0.5 days (Map integration)
- Stage 3: 0.5 days (Flow integration)
- Stage 4: 0.5 days (Timeline integration)
- Stage 5: 0.5 days (Auto-scroll implementation)
- Stage 6: 0.5 days (Multi-select and keyboard shortcuts)
- Stage 7: 0.25 days (Structure parent highlighting)
- Stage 8: 0.75 days (Testing and documentation)

**Total**: 4 days (within 2-3 day estimate with some buffer)
