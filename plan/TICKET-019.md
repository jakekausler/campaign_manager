# TICKET-019: Map View with MapLibre

## Status

- [ ] Completed
- **Commits**: 9d4a967 (implementation plan)

## Description

Implement interactive map view using MapLibre GL JS with GeoJSON layers, viewport management, and entity visualization.

## Scope of Work

1. Install and configure MapLibre GL JS
2. Create Map component with viewport state
3. Implement GeoJSON layer rendering
4. Add location/region visualization
5. Settlement layer rendering (distinct markers at Location coordinates)
6. Structure layer visualization
7. Create map controls (zoom, pan, reset)
8. Add entity popups/tooltips
9. Popups showing Settlement details (name, level, kingdom, typed variables)
10. Popups showing Structure details (name, type, level, typed variables)
11. Implement layer toggles (by type, availability)
12. Layer toggles for Settlements and Structures
13. Add time scrubber for viewing history
14. Create loading states and error handling

## Acceptance Criteria

- [ ] Map renders with base layer
- [ ] Locations display as markers
- [ ] Regions display as polygons
- [ ] Settlement layer renders with distinct markers
- [ ] Structure layer renders correctly
- [ ] Can pan and zoom
- [ ] Clicking entity shows details
- [ ] Settlement popups show level and typed variables
- [ ] Structure popups show type, level, and typed variables
- [ ] Layer toggles work
- [ ] Layer toggles work for Settlements and Structures
- [ ] Time scrubber changes visible entities
- [ ] Performance good with 1000+ entities

## Dependencies

- Requires: TICKET-008, TICKET-018

## Estimated Effort

4-5 days
