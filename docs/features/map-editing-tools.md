# Map Editing Tools (TICKET-020)

Interactive map-based geometry editing for creating and modifying point locations and polygon regions using MapLibre GL Draw.

## Overview

- Draw new point locations by clicking on the map
- Draw polygon regions by clicking vertices (double-click to complete)
- Edit existing location geometries by selecting and dragging vertices
- Real-time validation with user-friendly error messages
- Undo/redo support for geometry changes (up to 50 operations)
- Save/cancel workflow with optimistic locking for concurrency control
- Keyboard shortcuts for common operations

## Key Components

### DrawControl Component

**Location:** `packages/frontend/src/components/features/map/DrawControl.tsx`

**Purpose:** React wrapper for MapLibre GL Draw library

**Props:**

- `map: Map` - MapLibre GL Map instance
- `onDrawReady?: (draw: MapboxDraw) => void` - Callback when draw control is initialized
- `onCreate?: (e: DrawCreateEvent) => void` - Callback when feature is created
- `onUpdate?: (e: DrawUpdateEvent) => void` - Callback when feature is updated
- `onDelete?: (e: DrawDeleteEvent) => void` - Callback when feature is deleted
- `onSelectionChange?: (features: DrawFeature[]) => void` - Callback when selection changes
- `controls?: object` - Which drawing controls to show
- `styles?: object[]` - Custom drawing styles

**Features:**

- Automatic lifecycle management (add/remove from map)
- Event handlers for all draw events
- Custom blue theme styling (#3b82f6)
- Type-safe event interfaces

**Custom Styles:**

- Blue theme matching application design
- Semi-transparent polygon fills (0.1 inactive, 0.2 active)
- Vertex circles (white with blue outline) for editing
- Midpoint circles for adding vertices
- Line widths: 2px inactive, 3px active

### useMapDraw Hook

**Location:** `packages/frontend/src/components/features/map/useMapDraw.ts`

**Purpose:** State management for drawing and editing geometry

**State (MapDrawState):**

- `mode: DrawMode` - Current drawing mode ('none' | 'draw_point' | 'draw_polygon' | 'edit')
- `currentFeature: DrawFeature | null` - Currently drawn/edited feature (unsaved)
- `hasUnsavedChanges: boolean` - Whether there are unsaved changes
- `drawInstance: MapboxDraw | null` - Reference to the MapboxDraw instance
- `validationResult: ValidationResult | null` - Validation result for current feature
- `editFeatureId: string | null` - ID of feature being edited (null if creating new)
- `editLocationMetadata: LocationEditMetadata | null` - Database location metadata during edit
- `canUndo: boolean` - Whether undo is available
- `canRedo: boolean` - Whether redo is available

**Actions (MapDrawActions):**

- `startDrawPoint()` - Activate point drawing mode
- `startDrawPolygon()` - Activate polygon drawing mode
- `startEdit(featureId, locationMetadata?)` - Enter edit mode for existing feature
- `cancelDraw()` - Exit current mode and return to view (with confirmation if unsaved changes)
- `saveFeature()` - Save the current feature (async)
- `clearFeature()` - Clear the current feature from the map
- `undo()` - Undo the last geometry change
- `redo()` - Redo the last undone change

**Options (UseMapDrawOptions):**

- `onFeatureCreated?: (feature: DrawFeature) => void` - Callback when feature created
- `onFeatureUpdated?: (feature: DrawFeature) => void` - Callback when feature updated
- `onSave?: (feature: DrawFeature) => Promise<void>` - Callback when save requested

**Features:**

- Automatic validation on create/update events
- Undo/redo history with 50-operation limit
- Deep cloning to prevent mutation bugs
- Smart mode transitions (create vs edit workflows)
- Location metadata tracking for database integration

### DrawToolbar Component

**Location:** `packages/frontend/src/components/features/map/DrawToolbar.tsx`

**Purpose:** User interface for drawing controls and status

**Props:**

- `mode: DrawMode` - Current drawing mode
- `hasUnsavedChanges: boolean` - Whether there are unsaved changes
- `currentFeature: DrawFeature | null` - Current feature being drawn/edited
- `validationResult: ValidationResult | null` - Validation result
- `isSaving: boolean` - Whether save operation is in progress
- `onStartDrawPoint: () => void` - Start drawing point
- `onStartDrawPolygon: () => void` - Start drawing polygon
- `onSave: () => void` - Save current feature
- `onCancel: () => void` - Cancel current operation

**UI States:**

1. **View mode** (mode='none', !hasUnsavedChanges):
   - Shows "Add Point" and "Draw Region" buttons
   - User can enter drawing mode

2. **Drawing mode** (mode='draw_point' or 'draw_polygon', !currentFeature):
   - Shows instructional text:
     - Point: "Click on the map to place a point"
     - Polygon: "Click to add vertices, double-click to complete"

3. **Edit mode** (mode='edit', !hasUnsavedChanges):
   - Shows "Editing geometry • Drag vertices to modify"
   - Instructional text in gray

4. **Unsaved changes** (hasUnsavedChanges=true):
   - Shows "Save" and "Cancel" buttons
   - For polygons: displays "{vertices} vertices | {area} area"
   - Validation errors shown in red alert box
   - Save button disabled if validation fails

**Accessibility:**

- ARIA labels on all interactive elements
- data-testid attributes for testing
- Tooltips on disabled save button
- role="alert" on validation errors

### UndoRedoControls Component

**Location:** `packages/frontend/src/components/features/map/UndoRedoControls.tsx`

**Purpose:** Undo/redo buttons for geometry editing

**Props:**

- `canUndo: boolean` - Whether undo is available
- `canRedo: boolean` - Whether redo is available
- `onUndo: () => void` - Undo callback
- `onRedo: () => void` - Redo callback

**Features:**

- Positioned at bottom-left of map
- Buttons disabled when stack is empty
- Tooltips with keyboard shortcut hints
- Lucide React icons (Undo2, Redo2)
- Only visible when actively editing

### Geometry Utilities

**Location:** `packages/frontend/src/utils/geometry.ts`

**Functions:**

- `calculatePolygonArea(coordinates): number` - Calculate polygon area in m² using Shoelace formula
- `formatArea(areaInSquareMeters): string` - Format area with appropriate units (m², ha, km²)
- `countPolygonVertices(coordinates): number` - Count polygon vertices (excluding closing point)

**Features:**

- Spherical approximation (accurate for < 100 km²)
- Handles single-ring and multi-ring (with holes) polygons
- Auto-format with locale-specific number formatting
- Smart rounding for readability

**Limitations:**

- Accuracy degrades for large polygons (> 100 km²)
- Less accurate at high latitudes (> 60° N/S)
- Not suitable for polygons crossing antimeridian

### Geometry Validation

**Location:** `packages/frontend/src/utils/geometry-validation.ts`

**Functions:**

- `validatePointCoordinates(coordinates): ValidationResult` - Validate point bounds
- `validatePolygonGeometry(coordinates): ValidationResult` - Validate polygon geometry
- `validateGeometry(feature): ValidationResult` - Unified validation for DrawFeature

**Point Validation:**

- Longitude: -180 to 180 degrees
- Latitude: -90 to 90 degrees

**Polygon Validation:**

- Minimum 3 vertices (excluding GeoJSON closing point)
- No self-intersections (using Turf.js kinks detection)
- Area limits: 1 m² minimum, 10,000 km² maximum
- All coordinates within valid geographic bounds
- Polygon must be closed (first point === last point)

**Error Handling:**

- Collects all validation errors (not just first)
- User-friendly error messages
- Real-time validation on create/update events

## User Workflows

### Drawing a New Point Location

1. User clicks "Add Point" button
2. Mode changes to 'draw_point'
3. Instructional text appears: "Click on the map to place a point"
4. User clicks on map → point is created
5. Validation runs automatically
6. Save/Cancel buttons appear
7. User clicks "Save" → onSave callback invoked
8. After save → feature cleared, mode returns to 'none'

**Note:** Currently, creating new locations from scratch is not fully implemented (requires creating Location entity first). The save workflow is prepared for future implementation.

### Drawing a Polygon Region

1. User clicks "Draw Region" button
2. Mode changes to 'draw_polygon'
3. Instructional text appears: "Click to add vertices, double-click to complete"
4. User clicks on map → vertices added to polygon
5. Real-time stats display: "{vertices} vertices | {area} area"
6. Validation runs on each vertex addition
7. User double-clicks → polygon completed
8. Save/Cancel buttons appear with stats
9. User clicks "Save" → onSave callback invoked
10. After save → feature cleared, mode returns to 'none'

**Note:** Same limitation as points - full create workflow requires backend Location entity creation.

### Editing Existing Location Geometry

1. User clicks on existing location point or region (when enableDrawing=true)
2. Click handler retrieves location metadata (ID, version, type)
3. Geometry loaded into DrawControl
4. Mode changes to 'edit', feature enters 'direct_select' mode
5. Vertices become draggable
6. Toolbar shows "Editing geometry • Drag vertices to modify"
7. User drags vertex → validation runs, hasUnsavedChanges=true
8. Save/Cancel buttons appear
9. User clicks "Save" → updateLocationGeometry mutation called with:
   - Geometry (GeoJSON)
   - Branch ID (from campaign store)
   - Expected version (optimistic locking)
10. Success: Feature cleared, cache invalidated, mode returns to 'none'
11. Error: User-friendly message displayed, feature remains in edit mode

**Error Messages:**

- Version conflict: "This location was modified by someone else. Please refresh and try again."
- Network error: "Network error. Please check your connection and try again."
- Permission error: "You do not have permission to edit this location."
- Generic: "Failed to save location geometry. Please try again."

### Canceling Changes

1. User clicks "Cancel" button
2. If hasUnsavedChanges=true → confirmation dialog appears
3. User can:
   - Confirm cancel → changes discarded, mode returns to 'none'
   - Cancel the cancel → returns to editing
4. **Edit mode:** Feature preserved on map (not deleted)
5. **Create mode:** Feature deleted from map

### Using Undo/Redo

1. User edits geometry (drags vertex)
2. Current feature snapshot pushed to undo stack
3. Redo stack cleared (standard undo/redo behavior)
4. User presses **Ctrl+Z** (or clicks Undo button)
   - Previous feature restored from undo stack
   - Current feature pushed to redo stack
   - Validation runs on restored feature
5. User presses **Ctrl+Shift+Z** or **Ctrl+Y** (or clicks Redo button)
   - Next feature restored from redo stack
   - Current feature pushed to undo stack
   - Validation runs on restored feature

**History Management:**

- Max 50 operations in history (FIFO eviction)
- History cleared on save, cancel, or mode switch
- Input field detection: shortcuts don't fire when typing in INPUT/TEXTAREA/contentEditable

## Keyboard Shortcuts

| Shortcut                                                  | Action           | Notes                        |
| --------------------------------------------------------- | ---------------- | ---------------------------- |
| **Ctrl+Z** (Windows/Linux)<br>**Cmd+Z** (Mac)             | Undo last change | Only when actively editing   |
| **Ctrl+Shift+Z** (Windows/Linux)<br>**Cmd+Shift+Z** (Mac) | Redo last change | Only when actively editing   |
| **Ctrl+Y** (Windows)                                      | Redo last change | Alternative Windows shortcut |
| **Double-click**                                          | Complete polygon | When drawing polygon         |
| **Escape**                                                | Cancel (future)  | Not yet implemented          |

**Platform Support:**

- Cross-platform (Windows, Mac, Linux)
- Automatic platform detection (metaKey for Mac)
- Proper event.preventDefault() to avoid browser defaults

## GraphQL Integration

### Mutation: updateLocationGeometry

**Location:** `packages/frontend/src/services/api/mutations/locations.ts`

**Hook:** `useUpdateLocationGeometry()`

**Returns:**

- `updateLocationGeometry: (id, input) => Promise<UpdateLocationGeometryData>`
- `loading: boolean`
- `error: ApolloError | undefined`
- `data: UpdateLocationGeometryData | undefined`
- `reset: () => void`

**Mutation:**

```graphql
mutation UpdateLocationGeometry(
  $id: ID!
  $geometry: JSON!
  $branchId: ID!
  $expectedVersion: Int!
) {
  updateLocationGeometry(
    id: $id
    geometry: $geometry
    branchId: $branchId
    expectedVersion: $expectedVersion
  ) {
    id
    geometry
    version
  }
}
```

**Cache Strategy:**

- Automatic cache invalidation via `refetchQueries: ['LocationsByWorld']`
- Ensures UI updates immediately after save
- No manual cache updates needed

### Query: LocationsByWorld

**Location:** `packages/frontend/src/services/api/hooks/locations.ts`

**Fragment includes:**

```graphql
fragment LocationFields on Location {
  id
  name
  type
  geometry
  version # Added for optimistic locking
  worldId
  # ... other fields
}
```

**Usage:**

- Used by `useLocationLayers` hook
- Provides location data for map rendering
- Version field enables optimistic locking

## Technical Details

### MapLibre GL Draw Integration

**Library:** `maplibre-gl-draw@1.6.9`

**Type Compatibility:**

- MapLibre GL Draw types are incompatible with MapLibre GL Map types
- Requires type assertion: `as unknown as IControl`
- Well-documented with explanatory comments

**CSS Import:**

- Uses `mapbox-gl-draw.css` (naming convention from forked library)
- Imported in `main.tsx` for global styles

### State Management

**Location Metadata Tracking:**

- Uses `React.useMemo` to create Map<featureId, LocationEditMetadata>
- Stored in ref for stable access across renders
- Automatically populated when locations load from API
- Avoids dependency array issues

**Undo/Redo Implementation:**

- Two separate stacks: `undoStack` and `redoStack`
- Deep cloning with `JSON.parse(JSON.stringify())` to prevent mutation
- MAX_HISTORY_SIZE constant (50 operations)
- FIFO eviction when limit exceeded

### Validation Strategy

**When Validation Runs:**

- On feature create (handleFeatureCreated)
- On feature update (handleFeatureUpdated)
- After undo/redo operations
- When entering edit mode (initial validation)

**Turf.js Integration:**

- Used for self-intersection detection (`kinks()` function)
- Provides geodesic calculations
- Battle-tested and reliable

**Performance:**

- Validation is synchronous and fast (< 10ms typically)
- Could be optimized with debouncing for expensive operations
- Acceptable performance for current use cases

### Optimistic Locking

**Version Field:**

- Each Location has a `version: Int` field
- Incremented on every update
- Mutation requires `expectedVersion` parameter
- Backend rejects update if version mismatch

**User Experience:**

- Version conflicts show user-friendly error message
- User prompted to refresh and try again
- Prevents lost updates in concurrent editing scenarios

## Testing

### Unit Tests

**Location:** `packages/frontend/src/utils/`

**Coverage:**

- `geometry.test.ts` - 28 tests (area calculation, formatting, vertex counting)
- `geometry-validation.test.ts` - 25 tests (point/polygon validation)

**Total:** 53 unit tests covering all validation and utility functions

### Test Coverage Areas

1. **Valid Polygons:**
   - Simple squares, triangles
   - Polygons with holes
   - High latitude polygons
   - Very small polygons

2. **Invalid/Degenerate:**
   - < 3 vertices
   - Self-intersecting
   - Out-of-bounds coordinates
   - Null/undefined inputs
   - Malformed arrays

3. **Edge Cases:**
   - High latitudes
   - No closing point
   - Area limits (min/max)
   - Format edge cases

4. **Error Handling:**
   - All validation errors collected
   - User-friendly error messages
   - Proper error message assertions

## Future Enhancements

### Not Yet Implemented

1. **Create New Locations:**
   - Drawing new points/regions from scratch
   - Requires backend Location entity creation first
   - Save workflow infrastructure already in place

2. **Custom Async Dialog:**
   - Replace `window.confirm()` with custom dialog component
   - Better UX and consistent styling
   - Support for async operations

3. **Mobile Touch Support:**
   - Touch-optimized drawing
   - Pinch-to-zoom compatibility
   - Touch gesture controls

4. **Advanced Editing:**
   - Multi-select editing
   - Bulk operations
   - Copy/paste geometry

5. **Geometry Snapping:**
   - Snap to existing features
   - Snap to grid
   - Alignment guides

### Potential Optimizations

1. **Debounced Validation:**
   - Reduce validation calls during rapid editing
   - Only validate on pause or completion

2. **Vertex Simplification:**
   - Reduce vertex count for large polygons
   - Douglas-Peucker algorithm
   - Maintain visual fidelity

3. **Lazy Loading:**
   - Load DrawControl only when needed
   - Reduce initial bundle size
   - Code-split drawing tools

## Dependencies

### Production Dependencies

- `maplibre-gl-draw@1.6.9` - Drawing library
- `@turf/turf` - Geodesic calculations and validation
- `lucide-react` - Icons for undo/redo buttons

### Development Dependencies

- `vitest` - Test runner
- `@testing-library/react` - Component testing
- `@types/maplibre-gl-draw` - TypeScript types

## Implementation Timeline

**TICKET-020 Stages:**

1. ✅ **Stage 1:** Setup MapLibre GL Draw (Commit: aec1738)
2. ✅ **Stage 2:** Point Creation Tool (Commit: 8e20f64)
3. ✅ **Stage 3:** Polygon Drawing Tool (Commit: 7d3c845)
4. ✅ **Stage 4:** Geometry Validation (Commit: 42f5084)
5. ✅ **Stage 5:** Edit Mode for Existing Geometry (Commit: a1ff302)
6. ✅ **Stage 6:** Save/Cancel Workflow (Commits: 04b1f82, 8c84f41)
7. ✅ **Stage 7:** Undo/Redo for Edits (Commit: 9672861)
8. 🔄 **Stage 8:** Testing and Documentation (In Progress)

## Related Documentation

- Frontend README: `packages/frontend/README.md`
- Map Component Documentation: `packages/frontend/src/components/features/map/README.md`
- GraphQL Schema: `packages/api/src/graphql/schema.graphql`
- TICKET-020 Plan: `plan/TICKET-020.md`
- TICKET-020 Implementation Plan: `plan/TICKET-020-implementation-plan.md`

## Quick Reference

**Enable Drawing on Map:**

```tsx
<Map
  enableDrawing={true}
  // ... other props
/>
```

**Keyboard Shortcuts:**

- **Undo:** Ctrl+Z (Cmd+Z on Mac)
- **Redo:** Ctrl+Shift+Z (Cmd+Shift+Z on Mac) or Ctrl+Y (Windows)

**Validation Limits:**

- Point: -180 to 180° longitude, -90 to 90° latitude
- Polygon: 3+ vertices, 1 m² to 10,000 km², no self-intersections

**History Limit:**

- 50 operations (FIFO eviction)
