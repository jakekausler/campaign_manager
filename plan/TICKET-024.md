# TICKET-024: Cross-View Synchronization

## Status

- [ ] Completed
- **Commits**: 4fb08aa, a97f37b, fce9730, e1b4a20

## Description

Implement synchronized selection and highlighting across Map, Flow, and Timeline views so selecting an entity in one view highlights it in all views.

## Scope of Work

1. Create shared selection state
2. Implement cross-view event bus
3. Add highlighting in Map view
4. Add highlighting in Flow view
5. Add highlighting in Timeline view
6. Implement smooth scrolling/panning to selected entity
7. Add multi-select support
8. Extend selection state to include Settlement and Structure entities
9. Highlight Settlements across Map, Flow, and Timeline views
10. Highlight Structures (show parent Settlement location on map)

## Acceptance Criteria

- [ ] Selecting in Map highlights in Flow and Timeline
- [ ] Selecting in Flow highlights in Map and Timeline
- [ ] Selecting in Timeline highlights in Map and Flow
- [ ] Views auto-scroll to show selected entity
- [ ] Multi-select works across views
- [ ] Selecting a Settlement synchronizes across all views
- [ ] Selecting a Structure synchronizes across all views
- [ ] Structure highlighting shows parent Settlement location on map

## Dependencies

- Requires: TICKET-019, TICKET-021, TICKET-022

## Estimated Effort

2-3 days
