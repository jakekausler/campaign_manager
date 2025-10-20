# Entity Inspector Feature Documentation

## Overview

The Entity Inspector is a comprehensive side-panel component that provides detailed views and editing capabilities for Settlement and Structure entities in the campaign management system. It features a tabbed interface with six specialized views covering all aspects of an entity.

**Location**: `packages/frontend/src/components/features/entity-inspector/`

**Implemented**: TICKET-023 (13 stages, commits: 23e8919 - [Stage 13 commit])

**Status**: ✅ Production-ready (WCAG 2.1 Level AA compliant)

## Quick Reference

- **Component**: `<EntityInspector entityType="settlement" entityId="..." isOpen={true} onClose={() => {}} />`
- **Tabs**: Overview, Details, Links, Conditions, Effects, Versions
- **Edit Mode**: Ctrl+S to save, Esc to cancel
- **Navigation**: Breadcrumb trail with back button for related entities
- **Accessibility**: Full keyboard navigation, screen reader support, ARIA labels
- **Responsive**: Mobile (3-column tabs), Desktop (6-column tabs)

## Key Features

### 1. **Overview Tab**: Entity Metadata

Displays core entity information with copy-to-clipboard functionality:

- **Basic Information**: ID, name, creation/update timestamps
- **Description**: Optional description field (if present)
- **Computed Fields**: Auto-evaluated fields from condition system
- **Edit Support**: Inline editing for name field with validation

**User Actions**:

- Copy any field value to clipboard
- Edit entity name (requires "Edit" mode)
- View formatted JSON for complex computed fields

### 2. **Details Tab**: Entity-Specific Attributes

Shows attributes specific to Settlement or Structure entities:

**Settlement Details**:

- Kingdom ID, Campaign ID
- Level, Owner ID
- Is Archived status
- Typed Variables (custom state data)

**Structure Details**:

- Type (e.g., "Barracks", "Market")
- Settlement ID (parent settlement)
- Level, Position (X, Y), Orientation
- Typed Variables (custom state data)

**Features**:

- Copy-to-clipboard for all fields
- Snake_case → Title Case conversion (e.g., "has_walls" → "Has Walls")
- Type-based formatting (numbers, booleans, strings, JSON objects)

### 3. **Links Tab**: Related Entity Navigation

Navigate between related entities with clickable links:

**Settlement Links**:

- **Parent Entities**: Kingdom, Location, Campaign
- **Child Entities**: Structures (list with count)

**Structure Links**:

- **Parent Entity**: Settlement

**Navigation Features**:

- Click/Enter/Space to navigate to related entity
- Navigation stack maintains history
- Breadcrumb trail shows path (e.g., "Settlement A › Structure B")
- Back button returns to previous entity

**Limitations**: Kingdom/Location/Campaign navigation shows TODO warning (not yet implemented)

### 4. **Conditions Tab**: Field Condition Rules

View and evaluate field conditions that compute entity fields:

**Condition Display**:

- Field name (Title Case)
- Description and priority
- Active/Inactive status badge
- Instance vs Type-level indicator
- JSONLogic expression (formatted JSON)

**Evaluation**:

- "Explain" button opens evaluation trace modal
- Shows step-by-step JSONLogic evaluation
- Displays evaluation context (all variables)
- Shows final result and intermediate steps

**Sorting**: Conditions sorted by priority (highest first)

### 5. **Effects Tab**: State Mutation Effects

View effects that modify world state when events/encounters resolve:

**Effect Organization**:

- Grouped by timing phase (PRE/ON_RESOLVE/POST)
- Color-coded phase badges
- Priority sorting within phases

**Effect Details**:

- Name, description, type
- Active/Inactive status
- JSON Patch operations (RFC 6902)
- Priority and timing phase

**Execution History**:

- "View History" button opens modal
- Chronological list of executions
- Timestamp, status (SUCCESS/FAILURE/ERROR), patch applied
- Error messages for failed executions

### 6. **Versions Tab**: Audit Trail

View complete change history for the entity:

**Timeline Display**:

- Chronological audit entries (newest first)
- "LATEST" badge on most recent entry
- Blue highlight on latest entry

**Operation Types**:

- **CREATE** (green): Initial entity creation
- **UPDATE** (blue): Field modifications
- **DELETE** (red): Entity deletion
- **ARCHIVE** (yellow): Soft deletion
- **RESTORE** (purple): Un-archiving

**Change Details**:

- Before/after values for UPDATE operations
- Initial values for CREATE operations
- Field name formatting (Title Case)
- User attribution (userId)
- Relative timestamps ("5 mins ago", "2 days ago")

**Limitations**: Max 10 fields displayed with "...and X more" overflow

## Edit Mode

### Activation

Click the **Edit** button in the inspector header to enter edit mode.

### Editable Fields

- **Name** (Overview tab): Required field, cannot be empty

### Keyboard Shortcuts

- **Ctrl+S** / **Cmd+S**: Save changes
- **Esc**: Cancel editing

### Validation

- Name field: Required (empty strings rejected)
- Error messages displayed below field
- Save button disabled until validation passes

### Unsaved Changes Protection

Attempting to close the inspector or navigate with unsaved changes shows a confirmation dialog:

```
Unsaved Changes
You have unsaved changes. Are you sure you want to discard them?
[Keep Editing] [Discard Changes]
```

### Future Edit Support

- Description field (requires backend schema update)
- Typed variables in Details tab
- Condition active status toggle
- Effect priority editing

## Navigation System

### Navigation Stack

The inspector maintains a stack of visited entities:

```
Start: Settlement A (inspector opens)
  Stack: []

Click Link: Structure B
  Stack: [Settlement A]
  Current: Structure B

Click Link: Settlement C
  Stack: [Settlement A, Structure B]
  Current: Settlement C

Click Back:
  Stack: [Settlement A]
  Current: Structure B
```

### Breadcrumb Trail

Visual breadcrumb shows navigation path:

```
Settlement A › Structure B › Settlement C
                            ^^^^^^^^^^^^^^
                            (current entity)
```

### Reset Behavior

Navigation stack resets when:

- Inspector closes
- Inspector opens with new entity from parent page

## Integration Points

### Map View Integration

**Location**: `packages/frontend/src/pages/MapPage.tsx`

**Trigger**: Click on settlement marker or structure polygon

**Implementation**:

```tsx
const handleEntitySelect = (type: 'settlement' | 'structure', id: string) => {
  setSelectedEntity({ type, id });
  setInspectorOpen(true);
};

<Map onEntitySelect={handleEntitySelect} />;
```

### Flow View Integration

**Location**: `packages/frontend/src/pages/FlowViewPage.tsx`

**Trigger**: Double-click on EFFECT node targeting Settlement/Structure

**Implementation**:

```tsx
const handleNodeDoubleClick = (node: Node) => {
  if (node.data.nodeType === 'EFFECT') {
    const { entityType, entityId } = node.data.metadata;
    if (entityType === 'Settlement' || entityType === 'Structure') {
      setSelectedEntity({ type: entityType.toLowerCase(), id: entityId });
      setInspectorOpen(true);
    }
  }
};
```

### Timeline View Integration

**Location**: `packages/frontend/src/pages/TimelinePage.tsx`

**Trigger**: Click on timeline item (Event/Encounter)

**Status**: Placeholder implementation (shows "coming soon" alert)

**Future**: TICKET-025 will add Event/Encounter inspector support

## GraphQL Integration

### Queries

- **GET_SETTLEMENT_DETAILS**: Fetch settlement with variables and computed fields
- **GET_STRUCTURE_DETAILS**: Fetch structure with variables and computed fields
- **GET_CONDITIONS_FOR_ENTITY**: Fetch field conditions for entity
- **EVALUATE_FIELD_CONDITION**: Evaluate condition with trace
- **GET_ALL_EFFECTS_FOR_ENTITY**: Fetch effects across all timing phases
- **GET_ENTITY_AUDIT_HISTORY**: Fetch audit trail for entity
- **GET_STRUCTURES_BY_SETTLEMENT**: Fetch child structures (Links tab)

### Mutations

- **updateSettlement**: Update settlement name
- **updateStructure**: Update structure name

### Cache Policies

- **cache-first**: Settlement/Structure details, conditions, effects (performance)
- **network-only**: Condition evaluation (always fresh results)

### Error Handling

- GraphQL errors display user-friendly messages
- Retry buttons for failed queries
- Graceful degradation (show partial data if available)

## Accessibility

### WCAG 2.1 Level AA Compliance

The Entity Inspector meets full WCAG 2.1 Level AA compliance standards.

### Keyboard Navigation

- **Tab**: Navigate interactive elements
- **Enter/Space**: Activate buttons and links
- **Ctrl+S**: Save changes (edit mode)
- **Esc**: Cancel editing / Close dialogs
- **Arrow Keys**: Navigate between tabs (Radix UI feature)

### Screen Reader Support

- Sheet announces title: "Settlement Inspector" or "Structure Inspector"
- Tab labels announced: "Overview", "Details", "Links", etc.
- Button labels descriptive: "Copy to clipboard", "Explain condition", "View history"
- Loading/error states announced via text
- Form labels properly associated with inputs

### Visual Accessibility

- **Color Contrast**: 4.5:1 minimum (WCAG AA)
- **Status Indicators**: Color + text (not color alone)
  - Active (green text + "Active" label)
  - Inactive (gray text + "Inactive" label)
  - Operation badges (color + operation name)
- **Touch Targets**: Minimum 44x44px for mobile
- **Text Size**: Minimum 12px (labels), 14px (body)

### Focus Management

- Focus trapped in Sheet when open (Radix UI)
- Focus returned to trigger element on close
- Focus visible on all interactive elements (blue ring)

See [entity-inspector-accessibility.md](./entity-inspector-accessibility.md) for complete accessibility documentation.

## Responsive Design

### Breakpoints

**Mobile** (`< 640px`):

- Full-width sheet (`w-full`)
- 3-column tab grid (2 rows of 3 tabs)
- Vertical scrolling for content

**Tablet/Desktop** (`>= 640px`):

- Constrained sheet width (`sm:max-w-xl` = 36rem)
- 6-column tab grid (1 row of 6 tabs)
- Vertical scrolling for content

### Layout Classes

```tsx
<SheetContent className="w-full sm:max-w-xl overflow-y-auto">

<TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
```

### Mobile Optimizations

- Touch-friendly buttons (minimum 44x44px)
- Adequate spacing between interactive elements
- Readable text sizes (14px minimum)
- No horizontal scrolling

## Performance

### Data Fetching

- **Conditional Queries**: Settlement and Structure queries skip based on `entityType`
- **Cache-First**: Apollo Client uses cached data when available
- **Lazy Loading**: Data fetched only when inspector opens

### Loading States

- **Initial Load**: 4 skeleton blocks for perceived performance
- **Tab Data**: Text loading indicators ("Loading conditions...")
- **Save Operations**: "Saving..." text with disabled buttons

### Optimizations

- **Skip Unnecessary Fetches**: Query skip option prevents redundant requests
- **No Heavy Computations**: Backend pre-computes fields (no client-side processing)
- **Minimal Re-renders**: useCallback for stable event handlers

### Bundle Size

- **Component Tree**: Small (< 10 components deep)
- **Dependencies**: Reuses existing shadcn/ui components
- **Tree-Shaking**: ES modules enable dead code elimination

## Testing

### Test Coverage

- **Total**: 174 tests across all inspector components
- **Pass Rate**: 100% (1065/1065 total frontend tests)
- **Coverage**: >80% line coverage for all components

### Test Files

- `EntityInspector.test.tsx`: 12 tests (rendering, loading, errors, tabs)
- `OverviewTab.test.tsx`: 20 tests (display, copy, edit, validation)
- `ConditionsTab.test.tsx`: 22 tests (loading, error, display, explanation)
- `EffectsTab.test.tsx`: 23 tests (loading, error, display, execution history)
- `LinksTab.test.tsx`: 24 tests (loading, error, display, navigation, keyboard)
- `VersionsTab.test.tsx`: 24 tests (loading, error, display, operations, changes)
- `SettlementPanel.test.tsx`: 24 tests (attributes, variables, copy, formatting)
- `StructurePanel.test.tsx`: 25 tests (attributes, variables, copy, formatting)

### Testing Tools

- **Vitest**: Fast, Vite-native test runner
- **Testing Library**: React component testing
- **MSW**: GraphQL API mocking at network level
- **happy-dom**: Lightweight DOM environment

### Running Tests

```bash
# All inspector tests
pnpm --filter @campaign/frontend test entity-inspector

# Specific component
pnpm --filter @campaign/frontend test EntityInspector.test.tsx

# Watch mode
pnpm --filter @campaign/frontend test:watch entity-inspector
```

## Known Limitations

1. **Edit Mode Scope**: Only name field editable (typed variables future enhancement)
2. **Navigation Scope**: Kingdom/Location/Campaign navigation not implemented
3. **Optimistic Updates**: Mutations wait for server response (no optimistic UI)
4. **Condition Auto-Evaluation**: Manual "Explain" click required
5. **Effect Execution**: View-only (no manual trigger)
6. **Audit History Limit**: Max 100 entries per query, 10 fields displayed

## Future Enhancements

### Planned (Next Tickets)

- [ ] Event/Encounter inspector support (TICKET-025)
- [ ] Typed variables editing in Details tab
- [ ] Description field editing (requires backend schema update)
- [ ] Kingdom/Location/Campaign navigation
- [ ] Optimistic updates for mutations

### Long-Term Ideas

- [ ] Condition active status toggle
- [ ] Effect priority editing
- [ ] Bulk edit mode for multiple entities
- [ ] Export audit history as CSV/JSON
- [ ] JSONLogic syntax highlighting
- [ ] Effect patch preview before execution
- [ ] Undo/redo for edits
- [ ] Draft mode (save locally, publish later)

## Security

### Authorization

- Backend enforces campaign-level authorization
- Users can only view/edit entities in their campaigns
- Audit trail prevents cross-campaign data leaks

### Data Validation

- Name field required (empty strings rejected)
- Future: Type-specific validation for typed variables
- Backend validates all mutations (client validation for UX only)

### XSS Protection

- React auto-escapes all user content
- JSON data sanitized via JSON.stringify
- No dangerouslySetInnerHTML usage

## Troubleshooting

### Common Issues

**Inspector doesn't open**:

- Ensure `selectedEntity` is not null
- Check `isOpen` prop is true
- Verify parent component state management

**Navigation doesn't work**:

- Provide `onNavigate` callback to LinksTab
- Check console for TODO warnings (Kingdom/Location/Campaign)

**Edit mode doesn't save**:

- Check mutation hook errors in console
- Verify backend validation passes
- Ensure name field not empty

**Keyboard shortcuts don't work**:

- Shortcuts only work when `isOpen && isEditing`
- Check for conflicting browser shortcuts
- Verify focus is within inspector

**Data not loading**:

- Check GraphQL query errors in Network tab
- Verify entityId exists in database
- Check Apollo Client cache in DevTools

## Related Features

- **Condition System**: Computes entity fields via JSONLogic expressions
- **Effect System**: Mutates world state via JSON Patch operations
- **Dependency Graph**: Tracks condition/effect dependencies
- **Audit System**: Records all entity changes with before/after values
- **World Time**: Entity changes tracked against campaign timeline

## References

- **Component README**: `packages/frontend/src/components/features/entity-inspector/README.md`
- **Accessibility Docs**: `docs/features/entity-inspector-accessibility.md`
- **Implementation Plan**: `plan/TICKET-023-implementation-plan.md`
- **Ticket**: `plan/TICKET-023.md`

## Changelog

### Stage 13: Polish, Testing, and Documentation (2025-10-20)

- Fixed clipboard test failures in SettlementPanel and StructurePanel
- Created accessibility audit documentation (WCAG 2.1 Level AA compliant)
- Improved responsive design (3-column mobile, 6-column desktop tabs)
- Created comprehensive README and feature documentation
- All 1065 frontend tests passing (100% pass rate)

### Stage 12: Integration with Map and Other Views (Commit: 43bcbd0)

- Integrated with MapPage for settlement/structure selection
- Integrated with FlowViewPage for EFFECT node inspection
- Added placeholder integration with TimelinePage (Event/Encounter support pending)

### Stage 11: Complete Edit Mode (Commit: 97d9a7d)

- Added keyboard shortcuts (Ctrl+S save, Esc cancel)
- Added loading states during save operations
- Enhanced EditableField with textarea support

### Stage 10: Edit Mode Infrastructure (Commit: 5975b50)

- Created useEditMode hook for state management
- Created EditableField component for inline editing
- Added edit/save/cancel buttons to inspector header
- Implemented name field editing in OverviewTab

### Stages 1-9: Core Implementation

- See TICKET-023.md for detailed implementation notes

---

**Last Updated**: 2025-10-20
**Status**: Production-ready
**Maintainer**: Campaign Management Tool Team
