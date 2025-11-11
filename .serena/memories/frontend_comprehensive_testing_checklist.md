# Frontend Comprehensive Playwright Testing Checklist

## Project Structure Overview

### Pages (Routes)

All pages use lazy loading with Suspense and PageLoader component. All authenticated pages wrapped in `<ProtectedRoute>`.

1. **HomePage** (`/`)
   - Public page
   - Landing page with feature overview cards
   - Call-to-action link to login
   - No form inputs, just informational

2. **LoginPage** (`/auth/login`)
   - Public page under AuthLayout
   - Email input field
   - Password input field
   - Submit button with loading state
   - Mock authentication (TODO: needs real API integration)
   - Redirects to dashboard or intended page on success

3. **DashboardPage** (`/dashboard`)
   - Protected route
   - Logout button
   - Cards showing: My Campaigns, Recent Activity, Quick Actions
   - Most features disabled (placeholders for future functionality)

4. **MapPage** (`/map`)
   - Protected route
   - Interactive map with MapLibre GL
   - Settlement and structure visualization
   - Drawing tools for geometry editing
   - Time scrubber for temporal filtering
   - Layer controls for toggling settlements/structures
   - Undo/Redo controls
   - Entity popup content on click
   - EntityInspector drawer opens on selection
   - SelectionInfo component shows selected entities count

5. **FlowViewPage** (`/flow`)
   - Protected route
   - React Flow dependency graph visualization
   - Node types: VARIABLE, CONDITION, EFFECT, ENTITY
   - Edge types: READS, WRITES, DEPENDS_ON (colored differently)
   - Selection panel showing selected entities
   - Filter panel for entity/node type filtering
   - Flow toolbar with zoom/pan controls
   - EntityInspector drawer opens on node selection
   - Cross-view selection synchronization
   - Keyboard shortcuts (Escape to clear selection)

6. **TimelinePage** (`/timeline`)
   - Protected route
   - vis-timeline visualization
   - Events and encounters displayed as timeline items
   - Current world time marker (red vertical line)
   - Color-coded status: completed, scheduled, overdue, resolved, unresolved
   - Timeline controls: zoom, pan, fit-to-view
   - Drag-to-reschedule with validation
   - TimelineFilters component with filtering options
   - URL-persisted filter state
   - Pagination with "load more" functionality
   - EntityInspector drawer opens on item click
   - Cross-view selection synchronization

7. **BranchesPage** (`/branches`)
   - Protected route
   - BranchHierarchyView: tree visualization of branches
   - BranchComparisonView: shows differences between branches
   - Branch operations: fork, merge, cherry-pick, delete, rename
   - Conflict resolution UI for merge conflicts
   - Merge history visualization
   - Merge preview dialog

8. **AuditLogPage** (`/audit`)
   - Protected route
   - Permission check: role-based access (admin/gm only)
   - AuditLogTable with sortable columns
   - AuditLogFilters component
   - ExportButton for CSV/JSON export
   - Pagination support
   - Search/filter by entity ID
   - Permission-denied UI if user lacks access
   - URL-persisted filter state

9. **EntityInspectorDemoPage** (`/inspector-demo`)
   - Protected route
   - Demo/testing page for EntityInspector component
   - Used for development testing

10. **NotFoundPage** (`/*`)
    - Catchall for undefined routes
    - 404 error message
    - Link back to home

---

## Core UI Components

### Layout Components

- **MainLayout**: Standard page layout with navigation
- **AuthLayout**: For authentication pages

### Shared Components

- **Button**: Primary CTA with variants (default, outline, ghost)
- **Input**: Text input field
- **Textarea**: Multi-line text input
- **Select**: Dropdown selector
- **Checkbox**: Toggle checkbox
- **Card/CardHeader/CardTitle/CardDescription/CardContent**: Card layout
- **Alert/AlertDialog**: Alert messages and confirmations
- **Dialog**: Modal dialogs
- **Sheet**: Side drawer
- **Tabs**: Tabbed interface
- **Badge**: Status/tag badges
- **Skeleton**: Loading placeholder
- **Toaster**: Toast notifications

### Specialized Components

- **SelectionInfo**: Displays selected entities count and list (appears in Map, Flow, Timeline)
- **ConnectionIndicator**: Shows WebSocket connection status
- **ErrorBoundary**: Error boundary wrapper

---

## Major Feature Components

### Map Feature (`packages/frontend/src/components/features/map/`)

**Main Components:**

- **Map**: Main map component with MapLibre GL integration
  - Props: initialCenter, initialZoom, onViewportChange, worldId, kingdomId, campaignId, onEntitySelect
  - Events: onViewportChange (pan/zoom), onEntitySelect (click settlements/structures)
  - Viewport state tracking (center, zoom, bounds)

- **DrawControl**: Map drawing tool for geometry editing
  - Drawing modes: polygon, line, point
  - Undo/Redo functionality

- **UndoRedoControls**: Control buttons for undo/redo

- **LayerControls**: Toggle visibility of settlement/structure/location layers

- **TimeScrubber**: Temporal filter control
  - Slider for time selection
  - Shows current time marker on map

- **EntityPopupContent**: Popup shown on entity hover/click
  - Shows entity name and basic info
  - Link to open inspector

**Interactions to Test:**

- Map pan and zoom
- Drawing geometries (polygon, line, point)
- Undo/redo drawing actions
- Layer visibility toggles
- Time scrubbing
- Click entity to open inspector
- Ctrl+Click multi-select
- Escape key clears selection
- Viewport tracking and display in footer

---

### Entity Inspector Feature (`packages/frontend/src/components/features/entity-inspector/`)

**Main Component:**

- **EntityInspector**: Drawer with tabbed entity details
  - Props: entityType (settlement/structure/event/encounter/location), entityId, isOpen, onClose
  - Opens as right-side drawer

**Tabs:**

1. **OverviewTab**: Entity name, description, basic properties
   - Editable fields (click to edit)
   - Save/Cancel buttons during edit mode
   - Shows unsaved changes dialog on close

2. **StructurePanel** (for settlements): List of child structures
   - Add structure button with AddStructureModal
   - Edit structure icon opens edit form
   - Delete structure with DeleteStructureConfirmationDialog

3. **SettlementPanel** (for structures): Shows parent settlement
   - Shows hierarchy context
   - KingdomContextPanel shows broader context
   - LocationContextPanel shows geographic context

4. **SettlementHierarchyPanel**: Shows settlement and structure hierarchy
   - Tree visualization of structure hierarchy within settlement

5. **ConditionsTab**: Shows active conditions
   - Displays condition rules using RuleBuilder
   - Shows computed field results

6. **EffectsTab**: Shows applied effects
   - Effect history and execution
   - EffectExecutionHistory timeline
   - Shows JSON Patch operations

7. **LinksTab**: Shows entity relationships/dependencies

8. **VersionsTab**: Version history
   - List of versions
   - Restore previous version
   - Compare versions with DiffViewer
   - ComparisonDialog for detailed diff view

**Dialogs:**

- **AddStructureModal**: Form to add new structure
- **DeleteStructureConfirmationDialog**: Confirmation before deletion
- **LevelChangeConfirmationDialog**: Confirms settlement level changes
- **ResolutionDialog**: Resolves events/encounters with effects
- **ResolutionButton**: Triggers resolution workflow

**Interactions to Test:**

- Open inspector from map/flow/timeline
- Edit entity fields (inline editing)
- Save/cancel edits
- Unsaved changes dialog
- Add/edit/delete structures
- View conditions and effects
- Browse version history
- Restore previous version
- Compare versions
- Resolve events/encounters
- Tab switching
- Close drawer (with unsaved changes handling)

---

### Rule Builder Feature (`packages/frontend/src/components/features/rule-builder/`)

**Main Component:**

- **RuleBuilder**: Visual JSON Logic expression builder
  - Props: expression (JSONLogic), onExpressionChange, entityType (for variable context), viewMode ('builder'|'json')
  - Used in ConditionsTab for viewing/editing conditions
  - Used for creating conditions on entities

**Block Types:**

- **VariableBlock**: References entity variables/attributes
  - VariablePickerInput for selecting variables
  - Shows available variables for entity type

- **LiteralBlock**: Literal values (numbers, strings, booleans)
  - ValueInput for entering values

- **ComparisonBlock**: Comparison operators (==, !=, <, >, <=, >=)
  - Dropdown for operator selection
  - Left/right value inputs

- **LogicalBlock**: AND/OR operators
  - Nested rule composition

- **IfBlock**: If-then-else expressions
  - Condition and result blocks

- **ArithmeticBlock**: Math operators (+, -, \*, /)

- **BlockRenderer**: Renders blocks based on type
- **NestedBlockRenderer**: Renders nested block hierarchies
- **BlockPalette**: Available blocks to add
- **BlockEditor**: Edit block properties
- **RulePreview**: Shows JSON Logic or visual representation
- **JSONEditor**: Raw JSON editing mode
- **RuleBuilderDialog**: Standalone dialog version

**Interactions to Test:**

- Add blocks from palette
- Select block types
- Edit block values
- Add nested blocks
- Switch between visual/JSON view
- Delete blocks
- Undo changes
- Save/cancel edits

---

### Timeline Feature (`packages/frontend/src/components/features/timeline/`)

**Main Component:**

- **Timeline**: vis-timeline visualization
  - Props: items, groups, onSelect, onDragEnd, options
  - Renders events and encounters on timeline
  - Current time marker tracking
  - Color-coded status

**Supporting Components:**

- **TimelineControls**: Zoom, pan, fit-to-view buttons
  - Keyboard shortcuts support (arrow keys, +/-, home)

- **TimelineFilters**: Advanced filtering UI
  - Filter by operation type
  - Filter by status
  - Filter by date range
  - Grouping options (by type, by status)
  - Search by entity ID

- **TimelineHandle**: Custom timeline item handles for reschedule drag

**Interactions to Test:**

- Zoom in/out with buttons and keyboard
- Pan timeline left/right
- Fit entire timeline in view
- Drag event/encounter to reschedule
- Click event/encounter to open inspector
- Apply filters and see results update
- Change grouping
- Date range filtering
- Search by entity ID
- Pagination: load more items
- Current time marker updates based on campaign time

---

### Flow View Feature (`packages/frontend/src/components/features/flow/`)

**Main Component:**

- **FlowViewPage**: React Flow integration
  - Node types: VARIABLE, CONDITION, EFFECT, ENTITY
  - Edge types: READS (blue), WRITES (green), DEPENDS_ON (orange)
  - Auto-layout using dagrejs

**Components:**

- **FlowToolbar**: Top controls for flow operations

- **FlowControls**: Pan, zoom, fit-to-view, layout recalculation
  - Keyboard shortcuts: +/- for zoom, home for fit

- **FilterPanel**: Filter nodes and edges
  - Filter by node type (variable, condition, effect, entity)
  - Filter by entity type
  - Filter by status

- **SelectionPanel**: Shows selected nodes/edges
  - Shows count and details
  - Navigation between selections

- **EntityNode**: Renders settlement/structure/event/encounter nodes

- **VariableNode**: Renders variable nodes with type badges

- **ConditionNode**: Renders condition nodes

- **EffectNode**: Renders effect nodes

- **CustomEdge**: Edge rendering with labels

- **ReadsEdge/WritesEdge/DependsOnEdge**: Specialized edge types

- **FlowLoadingSkeleton**: Loading placeholder

**Interactions to Test:**

- Pan flow with mouse drag
- Zoom with buttons or scroll wheel
- Fit to view button
- Recalculate layout button
- Click node to select (opens inspector if entity)
- Multi-select with Ctrl+Click
- Hover node to see connections
- Filter nodes by type
- Filter edges by type
- Search/filter by entity
- Keyboard shortcuts (Escape to clear selection)
- View edge direction and type colors

---

### Branches Feature (`packages/frontend/src/components/features/branches/`)

**Main Components:**

- **BranchHierarchyView**: Tree visualization of branches
  - Shows branch relationships and divergence points
  - Displays which branch is current

- **BranchComparisonView**: Compare entity states between branches
  - Select two branches to compare
  - Shows differences in entity properties
  - Shows conflicts if any

- **BranchSelector**: Select active branch
  - Dropdown of all branches
  - Switch branch
  - Shows branch info (diverged at, parent branch)

**Dialogs:**

- **ForkBranchDialog**: Create new branch from current
  - Branch name input
  - Confirmation

- **MergePreviewDialog**: Preview merge before confirming
  - Shows changes to be merged
  - Identifies conflicts

- **ConflictResolutionDialog**: Resolve merge conflicts
  - Shows conflicting fields
  - Choose resolution (keep current, keep incoming, custom)

- **RenameBranchDialog**: Rename branch
  - Text input for new name

- **DeleteBranchDialog**: Confirm branch deletion
  - Warning about losing branch history

- **MergeHistoryView**: Shows merge history of branch
  - Timeline of merges
  - Who merged, when, what changed

**Interactions to Test:**

- View branch hierarchy
- Switch branches with BranchSelector
- Create new fork from branch (ForkBranchDialog)
- Compare branches (BranchComparisonView)
- Preview merge (MergePreviewDialog)
- Perform 3-way merge
- Resolve conflicts (ConflictResolutionDialog)
- Cherry-pick changes from other branches (CherryPickDialog)
- Rename branch (RenameBranchDialog)
- Delete branch (DeleteBranchDialog)
- View merge history (MergeHistoryView)

---

### Audit Log Feature (`packages/frontend/src/components/features/audit/`)

**Main Component:**

- **AuditLogPage**: Audit log listing with filters
  - Permission check for access
  - Displays permission denied if user lacks access

**Supporting Components:**

- **AuditLogTable**: Table of audit entries
  - Columns: timestamp, operation, entity type, entity ID, user, changes
  - Sortable columns (asc/desc)
  - Row click shows AuditDiffViewer

- **AuditLogFilters**: Filter controls
  - Filter by operation (CREATE, UPDATE, DELETE)
  - Filter by date range (startDate, endDate)
  - Filter by entity ID (search)
  - Grouping options
  - Sorting options (sortBy, sortOrder)
  - Save filters to URL

- **ExportButton**: Export audit logs
  - CSV format
  - JSON format
  - Shows confirmation dialog for large exports
  - Disabled if user lacks AUDIT_EXPORT permission

- **AuditDiffViewer**: Shows detailed changes
  - Before/after values
  - Highlights changes
  - Full JSON view option

- **ExportConfirmationDialog**: Confirms before large export
  - Shows estimated file size
  - Warns about large exports

**Interactions to Test:**

- Permission-denied page for non-admin/gm users
- Apply filters (operation, date range, search)
- Clear filters
- Sort by column
- Pagination (load more)
- Click row to view details with AuditDiffViewer
- Export audit logs (with permission check)
- Confirmation dialog for large exports
- URL persistence of filters

---

## Forms and Input Validation

### Login Form (LoginPage)

- Email input: required, email format validation
- Password input: required
- Submit button: disabled during loading
- Form state: loading, error handling (TODO: implement)
- Redirect: on success to dashboard or intended page

### Entity Inspector Forms (various)

- Entity name: text input (max 255 chars)
- Entity description: textarea
- Settlement level: numeric input with +/- buttons
  - LevelChangeConfirmationDialog on change
- Structure slots: numeric input
- Custom properties: typed inputs based on property type

### Rule Builder Form

- Block type selection
- Variable selection from dropdown
- Literal value inputs: number, string, boolean
- Operator selection
- Nested block management
- Add/delete block buttons

### Timeline Filters Form

- Operation type checkboxes: CREATE, UPDATE, DELETE
- Date range pickers: startDate, endDate
- Entity ID search input
- Grouping select: by type, by status, none
- Sorting: sortBy (timestamp, operation, entityType), sortOrder (asc, desc)

### Audit Filters Form (same as Timeline)

- Operation type checkboxes
- Date range pickers
- Entity ID search
- Sorting options

### Branch Forms

- Fork: branch name input, confirmation
- Rename: text input for new name
- Delete: confirmation only
- Merge: select target branch, resolve conflicts

---

## Interactive Features

### Map Interactions

- **Draw geometries**: polygon, line, point
- **Undo/Redo**: delete drawn features
- **Layer toggle**: show/hide settlements, structures, locations
- **Time scrubbing**: drag slider to change time filter
- **Pan/Zoom**: mouse drag and scroll wheel
- **Click entities**: open inspector
- **Ctrl+Click multi-select**: select multiple entities
- **Escape clears selection**: reset selection state

### Flow View Interactions

- **Pan**: click and drag
- **Zoom**: scroll wheel, +/- buttons
- **Node selection**: click to select
- **Multi-select**: Ctrl+Click
- **Filter nodes**: dropdown selections
- **Search nodes**: type to filter
- **Edge highlighting**: hover to show connections
- **Escape clears selection**: deselect all

### Timeline Interactions

- **Pan timeline**: arrow keys or drag scrollbar
- **Zoom**: +/- buttons or scroll wheel
- **Fit to view**: home button
- **Reschedule**: drag event/encounter to new date
- **Filter events**: apply filters, see real-time updates
- **Sort**: column headers in table
- **Pagination**: load more button

### Entity Inspector Interactions

- **Edit mode**: click field to edit
- **Save edits**: click save button
- **Cancel edits**: click cancel button
- **Add structures**: button in panel
- **Delete structures**: icon with confirmation
- **Tab switching**: click tabs
- **Version restore**: restore button with confirmation
- **Resolve event**: button opens resolution dialog with effects

### Branch Interactions

- **Switch branch**: select from dropdown
- **Fork branch**: button opens dialog
- **Compare branches**: select two branches
- **Merge branch**: button shows preview, then merge
- **Resolve conflicts**: choose resolution strategy
- **Cherry-pick**: select commits to pick
- **Rename branch**: edit field
- **Delete branch**: confirmation dialog

### Audit Log Interactions

- **Filter by operation**: checkboxes
- **Filter by date**: date pickers
- **Search by ID**: text input
- **Sort table**: column headers
- **View diff**: click row
- **Export**: button with confirmation
- **Pagination**: load more button

---

## State Management (Zustand Stores)

### Auth Store (`packages/frontend/src/stores/auth-slice.ts`)

- **State**: token, user (name, email, role, id)
- **Selectors**: useAuthStore, useCurrentUser, useIsAuthenticated
- **Actions**: setUser, setToken, logout
- **Persistence**: localStorage (token, user)
- **Hooks**: useCurrentUser() - gets current user

### Campaign Store (`packages/frontend/src/stores/campaign-slice.ts`)

- **State**: currentCampaignId
- **Selectors**: useCurrentCampaignId
- **Actions**: setCampaignId
- **Hook**: useCurrentCampaignId() - gets campaign context

### Selection Store (`packages/frontend/src/stores/selection-slice.ts`)

- **State**: selectedEntities (cross-view selection)
- **Actions**: selectEntity, toggleSelection, clearSelection
- **Selectors**: useSelectionStore
- **Used by**: Map, Flow, Timeline for synchronized selection
- **Supported entity types**: SETTLEMENT, STRUCTURE, EVENT, ENCOUNTER, LOCATION

---

## GraphQL Integration

### Queries

- `getDependencyGraph`: Fetch dependency graph for flow view
- `getEventsByCampaign`: Fetch events for timeline
- `getEncountersByCampaign`: Fetch encounters for timeline
- `getCurrentWorldTime`: Fetch current campaign time
- `getEntity` (settlement/structure/event/encounter): Fetch entity details
- `getUserAuditHistory`: Fetch audit logs with filters
- `getVersions`: Fetch version history for entity
- `getBranches`: Fetch branch list
- `getConditions`: Fetch conditions for entity
- `getEffects`: Fetch effects for entity

### Mutations

- `createEntity`: Create settlement/structure/event/encounter
- `updateEntity`: Update entity properties
- `deleteEntity`: Delete entity
- `resolveEvent`/`resolveEncounter`: Mark as resolved with effects
- `createBranch`: Fork new branch
- `mergeBranch`: Merge branches
- `cherryPick`: Cherry-pick commits
- `restoreVersion`: Restore to previous version
- `createCondition`: Create condition on entity
- `deleteCondition`: Delete condition
- `createEffect`: Create effect on entity
- `executeEffect`: Manually execute effect

### Subscriptions (WebSocket)

- Real-time updates to entities
- Cache invalidation on remote changes
- Subscription handled by `useWebSocketSubscription` hook

---

## Dialog and Modal Types

### Full-Screen Modals (Dialog component)

- RuleBuilderDialog: Edit JSONLogic expressions
- ResolutionDialog: Resolve events/encounters with effects selection
- ComparisonDialog: Compare entity versions
- MergePreviewDialog: Preview branch merge
- ConflictResolutionDialog: Resolve merge conflicts

### Side Drawers (Sheet component)

- EntityInspector: Shows entity details (opened from map/flow/timeline)
- SelectionInfo: Shows selected entities (bottom or side)

### Alert Dialogs (AlertDialog component)

- LevelChangeConfirmationDialog: Confirm settlement level changes
- DeleteStructureConfirmationDialog: Confirm structure deletion
- ExportConfirmationDialog: Confirm large audit export
- UnsavedChangesDialog: Confirm discard edits
- RenameBranchDialog: Confirm branch rename
- DeleteBranchDialog: Confirm branch deletion

### Dropdown Dialogs (custom)

- BranchSelector: Select active branch
- VariablePickerInput: Select variable for rule builder

---

## Keyboard Shortcuts

### Map Page

- **Escape**: Clear selection

### Flow View

- **Escape**: Clear selection
- **+**: Zoom in
- **-**: Zoom out
- **Home**: Fit to view

### Timeline

- **Arrow Right/Left**: Pan timeline
- **+/-**: Zoom in/out
- **Home**: Fit to view

### Global

- Inherited from individual features

---

## Error Handling

### Error Boundaries

- ErrorBoundary component wraps pages
- Catches React component errors
- Shows fallback UI with error message

### GraphQL Errors

- errorLink in apollo client logs errors
- Handle UnauthorizedException for permission errors
- Network errors handled by Apollo Client
- User-facing toast notifications (via Toaster)

### Validation Errors

- Form validation (email format, required fields)
- Entity property validation
- Geometry validation (for map drawings)
- Timeline reschedule validation (prevents invalid dates)
- Resolution validation (ensures effects valid)

---

## Loading States

### Page Loading

- LazyPage component with PageLoader fallback
- Loading spinner with "Loading..." text

### Data Loading

- Skeleton loaders for lists and tables
- LoadingSpinner component for maps
- FlowLoadingSkeleton for flow view

### Action Loading

- Button disabled state during submission
- Loading spinner in buttons ("Saving...", "Loading more...")

### WebSocket Loading

- ConnectionIndicator shows connection status
- Automatic reconnection

---

## Responsive Design

### Breakpoints Used

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Responsive Components

- Grid layouts (md:grid-cols-2, lg:grid-cols-3)
- Flexible containers
- Tailwind responsive classes
- Full-viewport layouts for maps/flows/timelines

---

## Testing Considerations

### Components That Need E2E Testing

1. Authentication flow (login, redirect, logout)
2. Map interactions (draw, pan, zoom, select, time scrub)
3. Entity Inspector (edit, save, delete, navigation)
4. Rule Builder (add blocks, edit, switch view)
5. Timeline (filter, reschedule, select)
6. Flow View (filter, select, zoom)
7. Branch operations (fork, merge, compare)
8. Audit Log (filter, export, permission check)
9. Cross-view selection (map ↔ flow ↔ timeline)
10. Form validation (all forms)
11. Error handling (permission denied, network errors)
12. Modal/dialog interactions (open, close, actions)

### Key User Journeys

1. Login → Dashboard → Map view
2. Login → Map → select entity → Entity Inspector edit → save
3. Login → Timeline → reschedule event → refresh view
4. Login → Flow view → filter → multi-select → compare
5. Login → Audit log → filter → export
6. Login → Map → draw geometry → undo/redo
7. Login → Branch management → fork → merge → resolve conflicts
8. Login → Rule builder → create condition → preview

### Permission-Based Scenarios

1. Player user: limited access to audit logs
2. GM user: full access to audit logs
3. Admin user: full access to all features
4. Permission denied page display

---

## Network and Performance Considerations

### Lazy Loading

- All pages lazy loaded with code splitting
- Feature components split by route
- Map library loaded on demand

### Pagination

- Audit log: load more pattern
- Timeline: lazy load events/encounters

### WebSocket

- Real-time cache sync
- Connection status indicator
- Auto-reconnect on disconnect

### GraphQL

- Apollo Client caching
- Query batching
- Error handling and retry

---

## Accessibility Features

### ARIA Labels and Roles

- Buttons: role="button"
- Status indicators: role="status"
- Dialog headers: semantic headings
- Form labels: <label> with htmlFor
- Inputs: aria-label for hidden labels

### Keyboard Navigation

- Tab through form fields
- Enter submits forms
- Escape closes dialogs
- Keyboard shortcuts for common actions

### Color Contrast

- Status colors with text contrast
- Edge colors (reads/writes/dependsOn)
- Badge colors for status

---

## Time-Related Features

### World Time System

- useCurrentWorldTime hook fetches campaign time
- TimeScrubber adjusts filtered time
- Current time marker on timeline (red vertical line)
- Time displayed in footer

### Time-Based Filtering

- Map layers filtered by time (settlements at specific date)
- Timeline events shown with time markers
- Events and encounters scheduled at specific times
- Overdue detection (event time < current time)

---

## Browser Compatibility

The frontend uses modern JavaScript (ES2020+) and assumes recent browser versions:

- React 18+
- Modern CSS Grid and Flexbox
- Fetch API and async/await
- ES6+ features (destructuring, arrow functions, etc.)

---

## Summary of Testable Features by Category

### Authentication & Navigation (5 items)

1. Login form with email/password
2. Login with redirect to dashboard/intended page
3. Logout from dashboard
4. Protected routes (cannot access without auth)
5. Public routes (accessible without auth)

### Map View (15+ items)

1. Map rendering at initial coordinates
2. Pan map with mouse drag
3. Zoom in/out with scroll and buttons
4. Draw polygon, line, point geometries
5. Undo/redo drawing actions
6. Save drawings to backend
7. Toggle settlement layer visibility
8. Toggle structure layer visibility
9. Toggle location layer visibility
10. Time scrubber filtering
11. Click entity to select and open inspector
12. Ctrl+Click multi-select entities
13. Escape clears selection
14. Viewport tracking and display in footer
15. Entity popup on hover/click

### Entity Inspector (20+ items)

1. Open inspector from map select
2. Open inspector from flow select
3. Open inspector from timeline select
4. View Overview tab with entity info
5. Edit entity name (inline)
6. Edit entity description
7. Save entity edits
8. Cancel edits (discard changes)
9. Unsaved changes warning dialog
10. Add structure to settlement
11. Edit structure properties
12. Delete structure with confirmation
13. View Settlement Hierarchy panel
14. View Conditions tab
15. View Effects tab
16. View Links tab
17. View Versions tab
18. Browse version history
19. Restore to previous version
20. Compare versions with diff view
21. Resolve event with ResolutionDialog
22. Resolve encounter with effects
23. Navigate between multiple selected entities

### Rule Builder (15+ items)

1. Switch between visual and JSON view
2. Add variable block
3. Add literal block
4. Add comparison block
5. Add logical AND block
6. Add logical OR block
7. Add if-then-else block
8. Add arithmetic block
9. Delete block
10. Edit block parameters
11. Nest blocks
12. View JSON preview
13. Edit raw JSON
14. Undo block changes
15. Save and close

### Timeline View (20+ items)

1. Display events and encounters on timeline
2. Show current time marker
3. Color-code status (completed, scheduled, overdue, resolved)
4. Zoom in/out with buttons
5. Zoom with scroll wheel
6. Pan left/right with arrow keys
7. Pan with scrollbar
8. Fit to view with Home button
9. Click event to open inspector
10. Drag event to reschedule (validation)
11. Drag encounter to reschedule
12. Filter by operation type
13. Filter by date range
14. Group by type
15. Group by status
16. Search by entity ID
17. Sort by timestamp
18. Sort by operation
19. Pagination: load more
20. URL persistence of filters

### Flow View (18+ items)

1. Display dependency graph with nodes
2. Show entity nodes with colors
3. Show variable nodes
4. Show condition nodes
5. Show effect nodes
6. Show reads edges (blue)
7. Show writes edges (green)
8. Show depends-on edges (orange)
9. Pan with mouse drag
10. Zoom in/out with buttons
11. Zoom with scroll wheel
12. Fit to view
13. Recalculate layout
14. Click node to select and open inspector
15. Multi-select with Ctrl+Click
16. Filter by node type
17. Filter by entity type
18. Escape clears selection

### Branches (15+ items)

1. View branch hierarchy tree
2. View current branch indicator
3. Select and switch branches
4. Create fork with name input
5. Fork confirmation dialog
6. Compare two branches
7. Show branch comparison differences
8. Preview merge before merge
9. Perform 3-way merge
10. Resolve conflicts (ConflictResolutionDialog)
11. Cherry-pick changes from other branch
12. Rename branch with dialog
13. Delete branch with confirmation
14. View merge history
15. Show divergence points

### Audit Log (12+ items)

1. Permission check (admin/gm only)
2. Show permission denied page for non-admin
3. Display audit entries in table
4. Sort by timestamp
5. Sort by operation
6. Sort by entity type
7. Filter by operation type
8. Filter by date range
9. Search by entity ID
10. View audit entry details with diff
11. Export audit logs to CSV
12. Export audit logs to JSON
13. Confirm large exports
14. Pagination: load more entries

### Cross-View Selection (5 items)

1. Select on map, see selection in flow and timeline
2. Select on flow, see selection on map
3. Select on timeline, see selection on map and flow
4. SelectionInfo shows count
5. Escape clears selection globally

### Forms & Validation (10+ items)

1. Email validation on login form
2. Required field validation
3. Date picker validation
4. Numeric input validation
5. Password field masking
6. Submit button disabled during loading
7. Form error messages
8. Form success messages
9. Textarea auto-resize
10. Dropdown selection

### Loading States (8+ items)

1. Page loading skeleton
2. Table/list loading skeleton
3. Map loading spinner
4. Flow loading skeleton
5. Button loading state
6. Pagination loading state
7. Network request pending
8. WebSocket reconnecting indicator

### Error Handling (8+ items)

1. GraphQL error handling
2. Network error handling
3. Permission denied (403)
4. Not found (404)
5. Validation errors
6. Error boundary fallback UI
7. Toast notifications for errors
8. Retry mechanisms

### Dialogs & Modals (12+ items)

1. Open/close EntityInspector drawer
2. Open/close RuleBuilderDialog
3. Open/close ResolutionDialog
4. Open/close ComparisonDialog
5. Open/close AddStructureModal
6. Open/close DeleteStructureConfirmationDialog
7. Open/close LevelChangeConfirmationDialog
8. Open/close ExportConfirmationDialog
9. Open/close ForkBranchDialog
10. Open/close RenameBranchDialog
11. Open/close DeleteBranchDialog
12. Open/close ConflictResolutionDialog

### WebSocket & Real-Time (4+ items)

1. Connection indicator shows connected
2. Real-time entity updates
3. Cache invalidation on remote change
4. Reconnection on disconnect

---

## Total Estimated Test Cases: 200+

This comprehensive checklist covers all major features, interactions, and user journeys in the Campaign Manager frontend application.
