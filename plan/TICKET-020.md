# TICKET-020: Map Editing Tools (Draw/Edit Geometry)

## Status

- [ ] Completed
- **Commits**: aec1738 (Stage 1), 8e20f64 (Stage 2)

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
