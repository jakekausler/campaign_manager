# TICKET-020 Implementation Plan: Map Editing Tools

## Overview

Add drawing and editing capabilities to the map interface using MapLibre GL Draw for creating point locations and polygon regions.

## Technical Decisions

- **Drawing Library**: MapLibre GL Draw (@maplibre/maplibre-gl-draw)
  - Chosen for compatibility with MapLibre GL JS (already in use)
  - Actively maintained fork of mapbox-gl-draw
  - Built-in support for point, polygon, and edit modes
  - Customizable controls and styling

- **State Management**: Zustand store for edit state
  - Track current edit mode (none, draw_point, draw_polygon, edit)
  - Track unsaved changes
  - Implement undo/redo stack

- **Geometry Validation**:
  - Use Turf.js for validation (already a dependency)
  - Validate polygon self-intersection
  - Validate minimum points (3 for polygon)
  - Validate coordinate bounds

- **Save Workflow**:
  - Draft/commit pattern (edit locally, save to backend)
  - Optimistic updates with rollback on error
  - Show save/cancel buttons when edits are pending

## Stages

### Stage 1: Setup MapLibre GL Draw

**Goal**: Install and configure the drawing library
**Success Criteria**: Map has drawing controls visible, can enter draw mode
**Status**: Complete
**Commit**: aec1738

- [x] Install @maplibre/maplibre-gl-draw package
- [x] Add MapLibre GL Draw CSS to main layout
- [x] Create DrawControl component wrapper
- [x] Add DrawControl to MapView
- [x] Configure basic draw styles (colors, line widths)
- [x] Test that controls appear and basic interaction works
- [x] Commit changes

### Stage 2: Point Creation Tool

**Goal**: Enable drawing new point locations
**Success Criteria**: Can click to place points, points appear on map
**Status**: Complete
**Commit**: 8e20f64

- [x] Create useMapDraw hook for draw state management
- [x] Implement point draw mode activation
- [x] Handle draw.create event for points
- [x] Convert MapLibre geometry to PostGIS Point format
- [x] Display temporary marker for unsaved point
- [x] Add save/cancel buttons when point is drawn
- [x] Test point creation workflow
- [x] Commit changes

### Stage 3: Polygon Drawing Tool

**Goal**: Enable drawing polygon regions
**Success Criteria**: Can draw polygons by clicking vertices, polygons render correctly
**Status**: Complete
**Commit**: 7d3c845

- [x] Implement polygon draw mode activation
- [x] Handle draw.create event for polygons
- [x] Convert MapLibre geometry to PostGIS Polygon format
- [x] Display temporary polygon fill for unsaved polygon
- [x] Show vertex count and area while drawing
- [x] Complete polygon on double-click or Enter
- [x] Test polygon drawing workflow
- [x] Commit changes

### Stage 4: Geometry Validation

**Goal**: Validate geometry before allowing save
**Success Criteria**: Invalid geometry shows errors, valid geometry can be saved
**Status**: Complete
**Commit**: 42f5084

- [x] Create geometry validation utility functions
- [x] Validate point coordinates are within map bounds
- [x] Validate polygon has minimum 3 vertices
- [x] Validate polygon has no self-intersections (using Turf.js)
- [x] Validate polygon area is within reasonable limits
- [x] Display validation errors to user
- [x] Disable save button when validation fails
- [x] Add unit tests for validation functions
- [x] Commit changes

### Stage 5: Edit Mode for Existing Geometry

**Goal**: Allow editing locations and regions already in the database
**Success Criteria**: Can select and modify existing geometries
**Status**: Not Started

- [ ] Implement edit mode activation (click on existing feature)
- [ ] Load existing geometry into draw control
- [ ] Handle draw.update event for modified geometries
- [ ] Track which feature is being edited
- [ ] Show different visual state for edit vs. create
- [ ] Allow vertex manipulation (move, add, delete)
- [ ] Test editing existing points and polygons
- [ ] Commit changes

### Stage 6: Save/Cancel Workflow

**Goal**: Persist geometry changes to backend
**Success Criteria**: Saved geometries persist after page reload, cancelled edits discard changes
**Status**: Not Started

- [ ] Create save handler that calls appropriate GraphQL mutation
- [ ] Implement optimistic updates for save
- [ ] Handle save errors with rollback
- [ ] Create cancel handler that discards changes
- [ ] Confirm before discarding unsaved changes
- [ ] Clear draw control after save/cancel
- [ ] Update map state to reflect saved changes
- [ ] Test save/cancel for both create and edit modes
- [ ] Commit changes

### Stage 7: Undo/Redo for Edits

**Goal**: Allow undoing and redoing geometry changes
**Success Criteria**: Can undo/redo vertex changes, complete undo history is maintained
**Status**: Not Started

- [ ] Create undo/redo state management in Zustand
- [ ] Track geometry change history (stack of states)
- [ ] Implement undo action (pop from undo stack, push to redo stack)
- [ ] Implement redo action (pop from redo stack, push to undo stack)
- [ ] Update draw control when undo/redo is triggered
- [ ] Add keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
- [ ] Add undo/redo buttons to UI
- [ ] Clear redo stack when new change is made
- [ ] Limit history stack size (max 50 states)
- [ ] Test undo/redo for various edit scenarios
- [ ] Commit changes

### Stage 8: Testing and Documentation

**Goal**: Comprehensive testing and user documentation
**Success Criteria**: All features tested, documentation complete
**Status**: Not Started

- [ ] Write unit tests for geometry validation
- [ ] Write integration tests for draw/edit workflows
- [ ] Test error handling and edge cases
- [ ] Add JSDoc comments to all functions
- [ ] Create user documentation for drawing tools
- [ ] Document keyboard shortcuts
- [ ] Add inline help/tooltips in UI
- [ ] Run full test suite and fix any failures
- [ ] Run TypeScript type-check and fix errors
- [ ] Run linter and fix issues
- [ ] Commit changes

## Notes

### Drawing Library Comparison

**MapLibre GL Draw** (chosen):

- Active maintenance (fork of mapbox-gl-draw)
- Works with MapLibre GL JS
- Built-in point, line, polygon modes
- Customizable styling and controls
- Event-driven API

**Alternatives considered**:

- terra-draw: More modern, but less mature
- Custom implementation: Too much work, reinventing the wheel

### Geometry Format Conversion

MapLibre GL Draw uses GeoJSON format:

```json
{
  "type": "Point",
  "coordinates": [lng, lat]
}
```

PostGIS expects WKT or GeoJSON. We'll use GeoJSON for both directions:

- Frontend → Backend: GeoJSON from draw control
- Backend → Frontend: GeoJSON from PostGIS ST_AsGeoJSON()

### Edit State Management

Three modes:

1. **View mode**: No editing, just display
2. **Create mode**: Drawing new geometry (point or polygon)
3. **Edit mode**: Modifying existing geometry

State transitions:

- View → Create: Click "Add Point" or "Draw Region" button
- Create → View: Save or Cancel
- View → Edit: Click existing feature
- Edit → View: Save or Cancel

### Undo/Redo Implementation

Simple stack-based approach:

- Each geometry change pushes current state to undo stack
- Undo pops from undo stack, pushes to redo stack
- Redo pops from redo stack, pushes to undo stack
- New change clears redo stack

Limitations:

- Only tracks geometry changes, not attribute edits
- Max 50 states in history
- History is per-session (not persisted)

## Risk Mitigation

**Risk**: MapLibre GL Draw incompatibility with current MapLibre GL JS version
**Mitigation**: Verify version compatibility before starting, have fallback plan for custom implementation

**Risk**: Complex polygon editing (many vertices) causes performance issues
**Mitigation**: Implement vertex simplification, limit polygon complexity, test with large polygons

**Risk**: Concurrent edits (two users editing same feature)
**Mitigation**: Out of scope for this ticket, will be addressed in future multi-user editing ticket

## Testing Strategy

- Unit tests for geometry validation functions
- Integration tests for draw/edit workflows using @testing-library/react
- Manual testing for edge cases (invalid polygons, boundary conditions)
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile testing (touch interactions)
