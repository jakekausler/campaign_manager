# TICKET-023 Implementation Plan: Entity Inspector Component

## Overview

Create a comprehensive entity inspector drawer/panel with tabs for overview, links, conditions, effects, and version history. This component will provide a detailed view of Settlement and Structure entities with inline editing capabilities.

## Architecture Decisions

### Component Structure

- **Sheet Component**: We need a Sheet/Drawer UI component from shadcn/ui (not currently in ui/)
- **Tabs Component**: We need a Tabs UI component from shadcn/ui (not currently in ui/)
- **Entity Inspector**: Main component that orchestrates the tabs and handles entity selection
- **Tab Components**: Separate components for each tab (Overview, Links, Conditions, Effects, Versions)
- **Settlement/Structure Panels**: Specialized panels for entity-specific details

### State Management

- Use local component state for inspector open/close and selected entity
- Leverage existing `useSettlementDetails` and `useStructureDetails` hooks
- Create new hooks for conditions, effects, and version history data

### GraphQL Integration

- Reuse existing queries: `GET_SETTLEMENT_DETAILS`, `GET_STRUCTURE_DETAILS`
- Leverage existing `getConditionsForEntity` and `getEffectsForEntity` resolvers
- Create new frontend hooks for conditions and effects by entity
- Version history will require new GraphQL queries (audit trail from EffectExecution)

### Edit Mode

- Inline editing using existing mutation hooks
- Optimistic updates for better UX
- Validation before mutations

### Condition Explanations

- Use existing `evaluateFieldCondition` with trace support
- Display evaluation tree/trace in expandable format
- Show JSONLogic expression and result

## Stages

### Stage 1: UI Component Setup

**Goal**: Install and configure shadcn/ui Sheet and Tabs components

**Tasks**:

- [x] Add Sheet component from shadcn/ui to `packages/frontend/src/components/ui/`
- [x] Add Tabs component from shadcn/ui to `packages/frontend/src/components/ui/`
- [x] Add Label component from shadcn/ui if not already present
- [x] Export new components from `packages/frontend/src/components/ui/index.ts`
- [x] Create basic EntityInspector component structure with Sheet wrapper
- [x] Add basic styling and test that Sheet opens/closes

**Acceptance Criteria**:

- [x] Sheet component renders and can open/close
- [x] Tabs component renders with basic tab navigation
- [x] Components follow project styling conventions

**Status**: ✅ COMPLETED

**Commit**: 23e8919

---

### Stage 2: GraphQL Hooks for Conditions and Effects

**Goal**: Create frontend hooks to fetch conditions and effects for entities

**Tasks**:

- [ ] Create `packages/frontend/src/services/api/hooks/conditions.ts`
- [ ] Add `GET_CONDITIONS_FOR_ENTITY` GraphQL query
- [ ] Create `useConditionsForEntity` hook with proper typing
- [ ] Add `EVALUATE_FIELD_CONDITION` GraphQL query with trace support
- [ ] Create `useEvaluateCondition` hook for condition explanations
- [ ] Create `packages/frontend/src/services/api/hooks/effects.ts`
- [ ] Add `GET_EFFECTS_FOR_ENTITY` GraphQL query
- [ ] Create `useEffectsForEntity` hook with proper typing
- [ ] Export hooks from `packages/frontend/src/services/api/hooks/index.ts`
- [ ] Write unit tests for hooks using MSW mocking

**Acceptance Criteria**:

- Hooks successfully fetch conditions and effects data
- Proper TypeScript typing for all data structures
- Loading and error states handled correctly
- Tests pass with >80% coverage

---

### Stage 3: EntityInspector Core Component

**Goal**: Create main EntityInspector component with tab structure

**Tasks**:

- [x] Create `packages/frontend/src/components/features/entity-inspector/` directory
- [x] Create `EntityInspector.tsx` with Sheet and Tabs structure
- [x] Add props interface: `entityType`, `entityId`, `isOpen`, `onClose`
- [x] Fetch entity data using appropriate hooks based on `entityType`
- [x] Create tab structure: Overview, Links, Conditions, Effects, Versions
- [x] Add loading skeleton for data fetching
- [x] Add error boundary for graceful error handling
- [x] Create basic test file for EntityInspector
- [x] Export from `packages/frontend/src/components/features/entity-inspector/index.ts`

**Acceptance Criteria**:

- [x] Inspector opens with correct entity data
- [x] Tabs render and are navigable
- [x] Loading states show skeleton
- [x] Errors are handled gracefully
- [x] Component is properly typed

**Status**: ✅ COMPLETED

**Commit**: b1ad688

---

### Stage 4: Overview Tab Implementation

**Goal**: Display entity overview with description and computed fields

**Tasks**:

- [ ] Create `OverviewTab.tsx` component
- [ ] Display basic entity info (id, name, createdAt, updatedAt)
- [ ] Display description field (if available)
- [ ] Display computed fields in expandable/collapsible sections
- [ ] Format JSON data for readability
- [ ] Add copy-to-clipboard for field values
- [ ] Create edit mode for description and basic fields
- [ ] Integrate with mutation hooks for saving edits
- [ ] Add validation for field edits
- [ ] Write tests for OverviewTab component

**Acceptance Criteria**:

- Overview displays all basic entity information
- Computed fields are formatted and readable
- Edit mode allows inline editing
- Changes save successfully
- Validation prevents invalid data

---

### Stage 5: Settlement and Structure Specific Panels

**Goal**: Create specialized panels for Settlement and Structure entity types

**Tasks**:

- [ ] Create `SettlementPanel.tsx` for Settlement-specific details
- [ ] Display: name, location, kingdom, level
- [ ] Display typed variables (Settlement state variables)
- [ ] Format variables by type (number, string, boolean, JSON)
- [ ] Create `StructurePanel.tsx` for Structure-specific details
- [ ] Display: type, settlement, level, position, orientation
- [ ] Display typed variables (Structure state variables)
- [ ] Add edit capability for typed variables
- [ ] Create mutation hooks for variable updates (if not exists)
- [ ] Write tests for both panels

**Acceptance Criteria**:

- Settlement panel shows all Settlement-specific data
- Structure panel shows all Structure-specific data
- Typed variables display correctly by type
- Variable editing works and saves
- Tests cover all entity types

---

### Stage 6: Conditions Tab Implementation

**Goal**: Display field conditions with evaluation trace

**Tasks**:

- [ ] Create `ConditionsTab.tsx` component
- [ ] Fetch conditions using `useConditionsForEntity` hook
- [ ] Display list of conditions with name, field, priority
- [ ] Show active/inactive status with toggle
- [ ] Create "Explain" button for each condition
- [ ] Create `ConditionExplanation.tsx` modal/accordion component
- [ ] Display JSONLogic expression in formatted view
- [ ] Display evaluation trace as tree structure
- [ ] Show final result and intermediate steps
- [ ] Add syntax highlighting for JSONLogic (optional)
- [ ] Write tests for ConditionsTab and ConditionExplanation

**Acceptance Criteria**:

- All conditions for entity are displayed
- Can toggle condition active status
- Explain feature shows evaluation trace
- Trace is readable and navigable
- Tests cover explanation rendering

---

### Stage 7: Effects Tab Implementation

**Goal**: Display effects and execution history

**Tasks**:

- [ ] Create `EffectsTab.tsx` component
- [ ] Fetch effects using `useEffectsForEntity` hook
- [ ] Display list of effects with name, type, phase, priority
- [ ] Show active/inactive status
- [ ] Group effects by phase (PRE/ON_RESOLVE/POST)
- [ ] Display JSON Patch operations in formatted view
- [ ] Create `EffectExecution.tsx` component for execution history
- [ ] Query effect execution history (requires new GraphQL query)
- [ ] Display execution timestamp, status, and patch applied
- [ ] Add filter/sort for effect history
- [ ] Write tests for EffectsTab and EffectExecution

**Acceptance Criteria**:

- All effects for entity are displayed
- Effects grouped by phase
- Execution history shows past applications
- JSON Patch operations are readable
- Tests cover effect rendering

---

### Stage 8: Links Tab Implementation

**Goal**: Display related entities with clickable navigation

**Tasks**:

- [ ] Create `LinksTab.tsx` component
- [ ] Identify entity relationships from GraphQL schema
  - Settlement → Kingdom, Location, Structures
  - Structure → Settlement, Type
- [ ] Display related entities as cards/list items
- [ ] Add entity type icons/badges
- [ ] Make links clickable to open related entity in inspector
- [ ] Handle navigation state (stack of opened entities)
- [ ] Add breadcrumb navigation for entity stack
- [ ] Create "back" button to return to previous entity
- [ ] Write tests for LinksTab navigation

**Acceptance Criteria**:

- All related entities are displayed
- Links navigate to related entities
- Breadcrumb shows navigation history
- Back button works correctly
- Navigation state is maintained

---

### Stage 9: Versions Tab Implementation (History)

**Goal**: Display version history and audit trail

**Tasks**:

- [ ] Create `VersionsTab.tsx` component
- [ ] Research available version history data sources:
  - EffectExecution table for effect-based changes
  - Optimistic locking `version` field for change count
  - May need audit trail table (check schema)
- [ ] Create GraphQL query for entity version history
- [ ] Display timeline of changes with timestamps
- [ ] Show what changed (field diffs if available)
- [ ] Display who made the change (createdBy/updatedBy)
- [ ] Add time-travel preview (show entity state at version)
- [ ] Create diff viewer for field changes
- [ ] Write tests for VersionsTab

**Acceptance Criteria**:

- Version history displays chronologically
- Changes are clearly indicated
- User attribution is shown
- Can preview entity at past versions
- Tests cover version rendering

---

### Stage 10: Edit Mode Infrastructure

**Goal**: Implement inline editing across all tabs

**Tasks**:

- [ ] Create `useEditMode` hook for edit state management
- [ ] Add edit/cancel/save buttons to inspector header
- [ ] Implement form validation using existing patterns
- [ ] Create `EditableField` component for inline editing
- [ ] Support different field types (text, number, select, JSON)
- [ ] Add optimistic updates for better UX
- [ ] Implement error handling for failed mutations
- [ ] Add confirmation dialog for discarding unsaved changes
- [ ] Add keyboard shortcuts (Ctrl+S to save, Esc to cancel)
- [ ] Write tests for edit mode functionality

**Acceptance Criteria**:

- Edit mode can be toggled
- All editable fields work correctly
- Validation prevents invalid data
- Optimistic updates work
- Error handling is graceful
- Tests cover edit workflows

---

### Stage 11: Integration with Map and Other Views

**Goal**: Integrate EntityInspector with existing pages

**Tasks**:

- [ ] Add EntityInspector to MapPage
- [ ] Trigger inspector on entity selection (click on map marker/polygon)
- [ ] Add EntityInspector to FlowViewPage
- [ ] Trigger inspector on node double-click (already has handler)
- [ ] Add EntityInspector to TimelinePage
- [ ] Trigger inspector on timeline item click
- [ ] Create shared state/context for inspector (if needed)
- [ ] Ensure only one inspector is open at a time
- [ ] Test inspector integration with all pages
- [ ] Update page components to pass correct entity type/id

**Acceptance Criteria**:

- Inspector opens from map entity selection
- Inspector opens from flow view nodes
- Inspector opens from timeline items
- Entity data loads correctly from all sources
- Only one inspector open at a time

---

### Stage 12: Polish, Testing, and Documentation

**Goal**: Final quality checks, comprehensive testing, and documentation

**Tasks**:

- [ ] Run all tests and ensure >80% coverage
- [ ] Perform accessibility audit (keyboard navigation, ARIA labels)
- [ ] Test with screen readers (basic checks)
- [ ] Add loading skeletons for better perceived performance
- [ ] Polish animations (sheet slide-in, tab transitions)
- [ ] Ensure responsive design (mobile, tablet, desktop)
- [ ] Add error boundaries around critical sections
- [ ] Create `packages/frontend/src/components/features/entity-inspector/README.md`
- [ ] Document component API, props, and usage examples
- [ ] Add JSDoc comments to all exported functions/components
- [ ] Update `packages/frontend/README.md` with EntityInspector section
- [ ] Create feature documentation in `docs/features/entity-inspector.md`
- [ ] Add screenshots/diagrams to documentation

**Acceptance Criteria**:

- All tests pass with >80% coverage
- Accessibility score is acceptable
- Responsive design works on all screen sizes
- Documentation is comprehensive
- Code is well-commented

---

## Technical Notes

### Dependencies to Add

- No new npm dependencies expected (shadcn/ui uses existing Radix UI)

### GraphQL Queries Needed (Frontend)

1. `GET_CONDITIONS_FOR_ENTITY` - Uses existing `getConditionsForEntity` resolver
2. `GET_EFFECTS_FOR_ENTITY` - Uses existing `getEffectsForEntity` resolver
3. `EVALUATE_FIELD_CONDITION` - Uses existing `evaluateFieldCondition` resolver
4. `GET_ENTITY_VERSION_HISTORY` - May need new backend resolver (TBD in Stage 9)

### Backend Changes Needed

- Possibly add version history/audit trail resolver (Stage 9)
- All other resolvers already exist

### UI Components to Add

1. Sheet (from shadcn/ui)
2. Tabs (from shadcn/ui)
3. Label (from shadcn/ui, if not present)

### Testing Strategy

- Unit tests for all hooks
- Component tests for all tab components
- Integration tests for inspector workflow
- MSW mocking for all GraphQL queries
- Accessibility testing with Testing Library

### Performance Considerations

- Lazy load tabs (only fetch data when tab is active)
- Use React.memo for tab components
- Debounce edit field changes
- Optimize computed field rendering (large JSON data)

---

## Risk Mitigation

### Risk: Version History Data Not Available

**Mitigation**: Stage 9 includes research phase. If no audit trail exists, we can display version count and last modified info only, with a TODO for future implementation.

### Risk: Complex JSONLogic Evaluation Trace

**Mitigation**: Start with simple tree view in Stage 6. Can enhance with syntax highlighting and interactive exploration in future ticket if needed.

### Risk: Performance Issues with Large Condition/Effect Lists

**Mitigation**: Implement pagination or virtual scrolling if lists exceed 50 items. Start with simple list and optimize if needed.

---

## Success Criteria

1. **Functional**: All acceptance criteria in ticket met
2. **Quality**: >80% test coverage, no TypeScript errors, passes linting
3. **UX**: Smooth animations, responsive, accessible
4. **Documentation**: Comprehensive docs with examples
5. **Integration**: Works seamlessly with Map, Flow, and Timeline views
