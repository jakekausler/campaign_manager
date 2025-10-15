# TICKET-020: Map Editing Tools (Draw/Edit Geometry)

## Status
- [ ] Completed
- **Commits**:

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
