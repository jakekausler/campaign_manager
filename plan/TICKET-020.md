# TICKET-020: Map Editing Tools (Draw/Edit Geometry)

## Status

- [ ] Completed
- **Commits**: aec1738 (Stage 1), 8e20f64 (Stage 2), 7d3c845 (Stage 3), 42f5084 (Stage 4), a1ff302 (Stage 5), 04b1f82 + 8c84f41 (Stage 6)

## Description

Add map editing capabilities for creating and modifying point locations and polygon regions with drawing tools.

## Scope of Work

1. Integrate map drawing library (mapbox-gl-draw or maplibre-gl-draw)
2. Implement point creation tool
3. Implement polygon drawing tool
4. Add edit mode for existing geometry
5. Create geometry validation
6. Implement save/cancel workflow
7. Add undo/redo for edits

## Acceptance Criteria

- [ ] Can draw new point locations
- [ ] Can draw polygon regions
- [ ] Can edit existing geometry
- [ ] Invalid geometry is rejected
- [ ] Edits persist to backend
- [ ] Undo/redo works

## Dependencies

- Requires: TICKET-019

## Estimated Effort

3-4 days

## Implementation Notes

### Stage 1: Setup MapLibre GL Draw (aec1738)

**Completed**: Successfully integrated maplibre-gl-draw library with the Map component.

**Key Implementations**:

1. **Package Installation**:
   - Installed `maplibre-gl-draw@1.6.9` as dependency
   - Added CSS import to `main.tsx` (uses mapbox-gl-draw.css due to package naming convention)

2. **DrawControl Component** (`packages/frontend/src/components/features/map/DrawControl.tsx`):
   - Created React wrapper component for MapboxDraw
   - Proper TypeScript interfaces for draw events (DrawFeature, DrawCreateEvent, DrawUpdateEvent, DrawDeleteEvent)
   - Type assertions (`as unknown as IControl`) to bridge incompatibility between maplibre-gl-draw and maplibre-gl Map types
   - Event handlers for `draw.create`, `draw.update`, `draw.delete`
   - Proper cleanup on unmount to prevent memory leaks
   - Configurable controls and styles via props

3. **Custom Draw Styles** (`packages/frontend/src/components/features/map/draw-styles.ts`):
   - Blue theme (#3b82f6) matching application design
   - Distinct visual states for active/inactive features
   - Semi-transparent polygon fills (0.1 inactive, 0.2 active)
   - Vertex circles (white with blue outline) for editing
   - Midpoint circles for adding vertices
   - Line widths: 2px inactive, 3px active

4. **Map Component Integration**:
   - Added `enableDrawing` prop to Map component (default: false)
   - DrawControl positioned in top-left corner
   - Console logging for development (to be replaced with proper handlers in later stages)
   - Proper exports from map index

**Technical Challenges**:

- Map type incompatibility between maplibre-gl-draw and maplibre-gl required type assertions
- Package uses Mapbox naming convention (mapbox-gl-draw.css) despite being for MapLibre

**Code Review**: Approved with optional suggestions for future improvements

- Console.log statements should be replaced with proper event handlers
- DrawControl dependency array optimization recommended for better performance

**Next Steps**: Implement point creation tool with save/cancel workflow (Stage 2)

### Stage 2: Point Creation Tool (8e20f64)

**Completed**: Successfully implemented point creation functionality with comprehensive UI controls and state management.

**Key Implementations**:

1. **useMapDraw Hook** (`packages/frontend/src/components/features/map/useMapDraw.ts`):
   - Custom React hook for managing drawing state and interactions
   - DrawMode type: 'none' | 'draw_point' | 'draw_polygon' | 'edit'
   - State tracking: mode, currentFeature, hasUnsavedChanges, drawInstance
   - Actions: startDrawPoint, startDrawPolygon, startEdit, cancelDraw, saveFeature, clearFeature
   - Event handlers: handleFeatureCreated, handleFeatureUpdated
   - Proper cleanup and state transitions
   - Error handling with console.error for save failures

2. **DrawToolbar Component** (`packages/frontend/src/components/features/map/DrawToolbar.tsx`):
   - Three UI states based on mode and unsaved changes:
     - View mode: Shows "Add Point" and "Draw Region" buttons
     - Drawing mode (no feature yet): Shows instructional text
     - Unsaved changes: Shows "Save" and "Cancel" buttons
   - Buttons disabled during save operation
   - Accessibility: ARIA labels and data-testid attributes for testing
   - Positioned at `top-4 left-32` to avoid overlapping MapLibre controls

3. **DrawControl Updates**:
   - Added `onDrawReady` callback prop to expose MapboxDraw instance
   - Exported DrawFeature interface for reuse across components
   - Updated dependency array to include new callback

4. **Map Component Integration**:
   - Added useState for drawInstance and isSaving
   - Integrated useMapDraw hook with callbacks for feature events
   - Error handling wrapper around saveFeature (try/catch with TODO for user-friendly errors)
   - Connected DrawControl onCreate/onUpdate/onDelete events to hook handlers
   - Rendered DrawToolbar conditionally when enableDrawing is true
   - Used `void feature` pattern to suppress unused variable warnings

**Workflow**:

1. User clicks "Add Point" button → enters draw_point mode
2. User clicks on map → point is created, handleFeatureCreated called
3. Save/Cancel buttons appear → hasUnsavedChanges = true
4. User clicks "Save" → onSave callback invoked (simulated async operation)
5. After save → feature cleared, mode returns to 'none'
6. User clicks "Cancel" → feature deleted, mode returns to 'none'

**Type Safety**:

- All components fully typed with TypeScript
- DrawFeature type reused from DrawControl
- Proper function signatures for all callbacks
- No type assertions except in DrawControl (MapLibre/MapboxDraw compatibility)

**Code Quality**:

- All callbacks memoized with useCallback
- Proper React dependency arrays
- Clean separation of state (MapDrawState) and actions (MapDrawActions)
- Accessibility attributes on all interactive elements
- Comprehensive JSDoc comments with examples

**Testing Notes**:

- Type-check passes with no errors
- Lint passes with no new warnings
- Build succeeds with expected MapPage bundle size
- Ready for manual testing in browser

**Next Steps**: Implement polygon drawing tool (Stage 3)

### Stage 3: Polygon Drawing Tool (7d3c845)

**Completed**: Successfully implemented polygon drawing with real-time vertex count and area display.

**Key Implementations**:

1. **Geometry Utilities** (`packages/frontend/src/utils/geometry.ts`):
   - `calculatePolygonArea()`: Shoelace formula for spherical approximation (accurate for < 100 km²)
   - `formatArea()`: Auto-format with appropriate units (m², ha, km²)
   - `countPolygonVertices()`: Count vertices excluding GeoJSON closing point
   - Comprehensive input validation with type guards
   - Handles single-ring and multi-ring (with holes) polygons
   - Smart rounding: nearest 10 for values >= 100 m²
   - Named constants for conversion factors

2. **Unit Tests** (`packages/frontend/src/utils/geometry.test.ts`):
   - 28 comprehensive tests covering all three functions
   - Valid polygons: simple squares, triangles, with holes
   - Invalid/degenerate: < 3 vertices, null, undefined, malformed arrays
   - Edge cases: high latitudes, very small polygons, no closing point
   - All tests passing (100% coverage of geometry functions)

3. **UI Enhancements** (`DrawToolbar.tsx`):
   - Real-time polygon stats display: "{vertices} vertices | {area} area"
   - `useMemo` optimization to cache expensive trigonometric calculations
   - Validation before type casting (checks geometry.type and coordinates array)
   - Stats only shown for polygon features (not points)
   - Clean visual design with divider between stats

4. **Map Component Integration** (`Map.tsx`):
   - Pass `currentFeature` prop to DrawToolbar for stats calculation

**Technical Details**:

- Polygon mode already functional from Stage 2 (`startDrawPolygon()`)
- Area calculation uses spherical Shoelace formula with Earth radius (6,371 km)
- Accuracy limitations documented: degrades for large polygons (> 100 km²), high latitudes (> 60°), antimeridian crossing
- GeoJSON format: `[longitude, latitude]` coordinate pairs
- Performance optimized with React.useMemo

**Workflow**:

1. User clicks "Draw Region" button → enters `draw_polygon` mode
2. MapLibre GL Draw shows instruction: "Click to add vertices, double-click to complete"
3. User clicks on map → vertices added to polygon
4. Stats display updates in real-time: e.g., "4 vertices | 1.25 km² area"
5. User double-clicks → polygon completed, `hasUnsavedChanges` = true
6. Save/Cancel buttons appear with stats still visible
7. User clicks Save → onSave callback invoked (placeholder for Stage 6)
8. After save → feature cleared, mode returns to 'none'

**Code Quality**:

- All critical issues from code review addressed
- Type-check and lint passing
- 28/28 unit tests passing
- Code review approved
- TDD approach followed

**Testing Notes**:

- Unit tests verify area calculation accuracy (±10% tolerance for spherical approximation)
- Tests cover GeoJSON polygon format (both single-ring and multi-ring)
- Runtime validation ensures no crashes on malformed input
- Ready for manual browser testing

**Next Steps**: Implement geometry validation (Stage 4)

### Stage 4: Geometry Validation (42f5084)

**Completed**: Successfully implemented comprehensive validation for point and polygon geometries with real-time feedback.

**Key Implementations**:

1. **Validation Utilities** (`packages/frontend/src/utils/geometry-validation.ts`):
   - `validatePointCoordinates()`: Bounds checking for longitude (-180 to 180) and latitude (-90 to 90)
   - `validatePolygonGeometry()`: Comprehensive polygon validation:
     - Minimum 3 vertices (excluding GeoJSON closing point)
     - Self-intersection detection using Turf.js `kinks()` function
     - Area limits: 1 m² minimum, 10,000 km² maximum
     - Closed polygon verification (first point === last point)
     - All coordinates within valid geographic bounds
     - Handles both single-ring and multi-ring (with holes) polygons
   - `validateGeometry()`: Unified validation interface for DrawFeature (Point and Polygon)
   - `ValidationResult` interface: `{ isValid: boolean, errors: string[] }`
   - Error accumulation pattern: Collects all errors before returning for comprehensive feedback

2. **Test Coverage** (`packages/frontend/src/utils/geometry-validation.test.ts`):
   - 25 comprehensive unit tests covering all validation scenarios
   - Valid cases: points at bounds, simple polygons, polygons with holes, high latitudes
   - Invalid cases: out-of-bounds coordinates, self-intersecting polygons, area limits
   - Edge cases: null inputs, malformed data, missing closing points, non-numeric values
   - Full integration with DrawFeature type system
   - All tests passing with proper error message assertions

3. **State Management** (`packages/frontend/src/components/features/map/useMapDraw.ts`):
   - Added `validationResult: ValidationResult | null` to MapDrawState interface
   - Automatic validation on `handleFeatureCreated()` and `handleFeatureUpdated()`
   - Validation state cleared in all mode transitions: `startDrawPoint()`, `startDrawPolygon()`, `cancelDraw()`, `clearFeature()`
   - Imported and integrated `validateGeometry()` function

4. **UI Integration** (`packages/frontend/src/components/features/map/DrawToolbar.tsx`):
   - Added `validationResult` prop to DrawToolbarProps interface
   - Save button disabled when `!isValid` (grayed out with `disabled:bg-green-400` and `disabled:cursor-not-allowed`)
   - Tooltip on disabled save button: "Cannot save: validation errors present"
   - Error display: Red alert box below toolbar with semantic HTML:
     - `role="alert"` for screen readers
     - `data-testid="validation-errors"` for testing
     - Bulleted list (`ul` with `list-disc list-inside`) of all validation errors
     - Positioned in flex column layout below action buttons
   - Error box only shown when `hasValidationErrors` is true

5. **Map Component Integration** (`packages/frontend/src/components/features/map/Map.tsx`):
   - Pass `validationResult={drawState.validationResult}` to DrawToolbar
   - Validation happens automatically through state management hooks

6. **Dependencies**:
   - Installed `@turf/turf` (129 new packages) for geodesic self-intersection detection
   - Reused `calculatePolygonArea()` from existing `geometry.ts` utilities

**Technical Decisions**:

- **Turf.js for self-intersection**: Chosen for reliable, battle-tested geodesic calculations rather than implementing custom algorithms
- **All errors collected**: Better UX to show all validation problems at once rather than failing on first error
- **Area limits rationale**:
  - Minimum 1 m²: Prevents accidental sub-meter regions (smaller than a room)
  - Maximum 10,000 km²: Prevents continent-sized regions while allowing large kingdoms (~100km x 100km)
- **Real-time validation**: Runs on both create and update events for immediate feedback as user draws
- **Error messages**: User-friendly, actionable descriptions that explain how to fix the issue

**User Experience**:

- Validation errors appear immediately when feature is created/updated
- Save button visually disabled with tooltip explaining why
- All validation errors shown at once (not just first error)
- No silent failures - all problems surfaced to user
- Consistent error styling with red alert box matching Tailwind conventions

**Testing**:

- Type-check: Passed with no errors
- Lint: Passed with no new warnings
- Unit tests: 25/25 tests passing
- Coverage: All validation functions and edge cases covered

**Code Review**: Approved with no critical issues

- Optional suggestions noted for future optimization (debouncing expensive validations)
- Performance acceptable for Stage 4 (can optimize in future if needed)
- Excellent test coverage and type safety
- Proper accessibility with ARIA attributes

**Next Steps**: Implement edit mode for existing geometry (Stage 5)

### Stage 5: Edit Mode for Existing Geometry (a1ff302)

**Completed**: Successfully implemented edit mode that allows users to select and modify existing drawn features.

**Key Implementations**:

1. **Enhanced useMapDraw Hook** (`packages/frontend/src/components/features/map/useMapDraw.ts`):
   - Added `editFeatureId: string | null` to MapDrawState interface to track which feature is being edited
   - Enhanced `startEdit(featureId)` method:
     - Loads feature from draw instance using `draw.get(featureId)`
     - Enters `direct_select` mode (not `simple_select`) to allow vertex manipulation
     - Sets currentFeature and validates geometry immediately
     - Initializes `hasUnsavedChanges = false` (changes tracked when user modifies)
   - Updated `cancelDraw()` logic:
     - Preserves edited features (when `editFeatureId` is set)
     - Deletes newly created features (when `editFeatureId` is null)
     - Smart differentiation between edit vs create workflows
   - Updated all state reset methods to clear `editFeatureId`
   - All methods maintain proper state transitions

2. **DrawControl Event Integration** (`packages/frontend/src/components/features/map/DrawControl.tsx`):
   - Added `DrawSelectionChangeEvent` interface for type safety
   - Added `onSelectionChange?: (features: DrawFeature[]) => void` callback prop
   - Registered `draw.selectionchange` event listener
   - Proper cleanup in useEffect dependencies
   - Type-safe event handling throughout

3. **Map Component Integration** (`packages/frontend/src/components/features/map/Map.tsx`):
   - Added `onSelectionChange` handler to DrawControl
   - Triggers `drawActions.startEdit()` when user clicks on existing feature
   - Guards against missing feature IDs with conditional check
   - Type-safe casting with proper null checks
   - Seamless integration with existing draw workflow

4. **Enhanced Edit Mode UI** (`packages/frontend/src/components/features/map/DrawToolbar.tsx`):
   - Improved edit mode instruction text with visual hierarchy
   - Shows "Editing geometry • Drag vertices to modify" with color differentiation
   - Gray secondary text for instructional hint
   - Consistent with existing toolbar patterns

**User Workflow**:

1. User clicks on existing drawn feature (point or polygon)
2. `draw.selectionchange` event fires with selected feature
3. `onSelectionChange` handler triggers `startEdit(featureId)`
4. Feature loads into `direct_select` mode, vertices become draggable
5. Toolbar shows "Editing geometry • Drag vertices to modify"
6. User drags vertex → `handleFeatureUpdated` fires, `hasUnsavedChanges = true`
7. Save/Cancel buttons appear with validation
8. On Save → feature persisted to backend (Stage 6)
9. On Cancel → edited feature preserved (not deleted), returns to view mode

**Technical Decisions**:

- **direct_select mode**: Allows vertex manipulation (move, add, delete vertices). More appropriate than `simple_select` which only allows feature selection/movement.
- **Edit vs Create distinction**: `editFeatureId` null check determines whether to preserve (edit) or delete (create) on cancel. Clean separation of concerns.
- **Immediate validation**: Validates geometry when entering edit mode to catch any existing issues before user makes changes.
- **Type safety**: All events properly typed with interfaces, proper null/undefined checks throughout.
- **State consistency**: `editFeatureId` cleared in all mode transition methods for clean state resets.

**Testing**:

- Type-check: Passed with no errors
- Lint: Passed with no new warnings
- Code review: Approved with no critical issues
- All interfaces properly typed
- Event listeners properly registered and cleaned up
- State transitions correctly implemented

**Code Review**: Approved

- No security vulnerabilities
- No performance issues
- Type safety maintained throughout
- Proper error handling
- React hooks correctly used with proper dependencies
- Event cleanup prevents memory leaks

**Next Steps**: Implement save/cancel workflow with backend persistence (Stage 6)

### Stage 6: Save/Cancel Workflow (04b1f82, 8c84f41)

**Completed**: Successfully implemented full save/cancel workflow for editing existing location geometries.

**Key Implementations**:

1. **Location Geometry Mutation Hook** (`packages/frontend/src/services/api/mutations/locations.ts`):
   - Created `useUpdateLocationGeometry` hook following established mutation patterns
   - Matches settlements/structures hook structure (no custom onSuccess/onError callbacks)
   - Returns mutation function, loading, error, data, and reset
   - Automatic cache invalidation via refetchQueries: LocationsByWorld
   - Type-safe with Location type using literal union: type: 'point' | 'region'

2. **Enhanced Map Drawing State** (`packages/frontend/src/components/features/map/useMapDraw.ts`):
   - Added `LocationEditMetadata` interface to track database location fields
   - Stores locationId, version (for optimistic locking), and type during edit mode
   - Modified `startEdit()` to accept optional LocationEditMetadata parameter
   - Updated all state reset methods to clear editLocationMetadata
   - Maintains separation between MapboxDraw internal feature ID and database location ID

3. **Location Metadata Tracking** (`packages/frontend/src/components/features/map/Map.tsx`):
   - Added `version` field to location GraphQL queries (useLocationLayers) for optimistic locking
   - Created memoized `locationMetadata` Map to track locationId, version, and type
   - Used globalThis.Map to avoid naming conflict with MapLibre Map class
   - Metadata automatically populated when locations load from API
   - Stored in ref for stable access across renders without dependency issues

4. **Edit Mode Entry**:
   - Updated `handleLocationPointClick` and `handleLocationRegionClick` to enter edit mode when `enableDrawing` is true
   - Retrieves location metadata from ref using feature properties.id
   - Loads location geometry into DrawControl using `drawInstance.add()`
   - Passes LocationEditMetadata to `startEdit()` method
   - Seamless transition from viewing to editing mode

5. **Save Workflow**:
   - Integrated `useCurrentBranchId()` from campaign store for version control
   - Implemented comprehensive `onSave` callback in useMapDraw configuration:
     - Validates editLocationMetadata is present (edit mode only)
     - Validates branchId is available
     - Calls `updateLocationGeometry` mutation with geometry, branchId, expectedVersion
     - Automatic cache invalidation via refetchQueries (LocationsByWorld)
     - Sets `isSaving` state during async operation for loading indicators
     - Success: Clears feature and returns to view mode
     - Error: Sets user-friendly error message and keeps feature in edit mode

6. **User-Friendly Error Handling**:
   - Parse GraphQL errors and display context-specific messages:
     - Version conflict: "This location was modified by someone else. Please refresh and try again."
     - Network errors: "Network error. Please check your connection and try again."
     - Permission errors: "You do not have permission to edit this location."
     - Generic fallback: "Failed to save location geometry. Please try again."
   - Styled error alert component positioned below draw toolbar
   - Accessibility: role="alert", proper ARIA attributes, data-testid for testing
   - Dismissible with X button
   - Error state cleared on cancel or successful save

7. **Cancel Workflow**:
   - Confirmation dialog when `hasUnsavedChanges` is true
   - Uses `window.confirm()` for Stage 6 (TODO comment added for custom async dialog replacement)
   - User can cancel the cancel action (returns without changes)
   - Clears error state on cancel
   - Properly distinguishes edit vs create mode in `useMapDraw.cancelDraw()`:
     - Edit mode: Preserves feature (feature remains on map)
     - Create mode: Deletes feature (removes from map)

8. **Performance Optimizations**:
   - Memoized location metadata map using React.useMemo to avoid recreation on every render
   - Only recreates when locations array changes
   - Stored in ref for stable access across callbacks

**Workflow**:

1. User clicks on existing location point or region (when enableDrawing is true)
2. Click handler retrieves location metadata (ID, version, type) from ref
3. Geometry loaded into DrawControl, `startEdit()` called with metadata
4. User drags vertices to modify geometry → `hasUnsavedChanges = true`
5. Validation runs automatically on updates
6. User clicks "Save" → mutation called with branchId and expectedVersion
7. Success: Feature cleared, mode returns to 'none', cache invalidated
8. Error: User-friendly message displayed, feature remains in edit mode
9. User can cancel with confirmation dialog if unsaved changes exist

**Technical Decisions**:

- **Edit mode only**: Creating new locations deferred to future work (requires creating Location entity before geometry)
- **Optimistic locking**: Uses version field from database to detect concurrent modifications
- **Error categorization**: Parses error messages to provide context-specific user feedback
- **Cache invalidation**: Automatic via refetchQueries (LocationsByWorld) - ensures UI updates after save
- **Confirmation dialog**: Used window.confirm() for Stage 6 simplicity (marked with TODO for custom dialog)
- **State separation**: MapboxDraw feature ID vs. database location ID kept separate via metadata tracking

**Testing**:

- Type-check: Passed with no errors
- Lint: Passed with no new warnings
- Code review: Approved after addressing performance concerns (memoization added)
- All file modifications properly integrated
- Ready for manual browser testing

**Code Review**: Approved with improvements implemented

- Performance concern addressed: Added React.useMemo for location metadata map
- TODO added for window.confirm replacement with custom dialog
- All critical functionality complete and type-safe

**Scope Limitation**: Stage 6 focuses on **edit mode only** (editing existing locations). Create mode (drawing new locations from scratch) is intentionally deferred to future work as it requires a different strategy - creating the Location entity first, then updating its geometry.

**Files Modified**:

- `packages/frontend/src/components/features/map/Map.tsx`: Main integration (metadata tracking, edit mode entry, error display)
- `packages/frontend/src/components/features/map/useLocationLayers.ts`: Added version field to GraphQL query
- `packages/frontend/src/services/api/hooks/locations.ts`: Added version field to fragment
- `packages/frontend/src/services/api/mutations/locations.ts`: Refactored mutation hook to match patterns

**Commits**: 04b1f82 (foundational infrastructure), 8c84f41 (complete implementation)

**Next Steps**: Implement undo/redo for edits (Stage 7)
