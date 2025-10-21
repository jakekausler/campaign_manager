# TICKET-025: Event & Encounter Resolution System

## Status

- [ ] Completed
- **Commits**:
  - Stage 1: 50c5d1e (EventPanel and EncounterPanel components)
  - Stage 2: 449d0e9 (GraphQL hooks for Event and Encounter detail queries)
  - Stage 3: e1daa41 (EntityInspector extension for Event/Encounter types)
  - Stage 4: 4edfcfe (EntityInspector integration with TimelinePage)

## Description

Implement comprehensive system for inspecting, resolving, and managing events and encounters. This includes expanding the EntityInspector to support Event and Encounter entity types with specialized panels, integrating with the TimelinePage for entity selection, creating resolution workflow UI, executing effects in proper order (PRE/ON_RESOLVE/POST), validating resolution preconditions, tracking resolution history, and providing rollback capability.

## Scope of Work

1. Create EventPanel and EncounterPanel components for entity inspector
2. Expand EntityInspector to support Event and Encounter entity types
3. Integrate Event/Encounter inspector with TimelinePage
4. Create resolution workflow UI with confirmation dialog
5. Implement pre/post/onResolve effect execution
6. Add resolution validation
7. Create resolution history tracking
8. Implement rollback capability
9. Add resolution notifications

## Acceptance Criteria

- [ ] EventPanel displays event metadata (name, type, description, status, scheduled/occurred times)
- [ ] EncounterPanel displays encounter metadata (name, type, description, status, resolution details)
- [ ] EntityInspector opens for Event entities via timeline click
- [ ] EntityInspector opens for Encounter entities via timeline click
- [ ] Inspector shows correct tabs for Event/Encounter (Overview, Details, Links, Conditions, Effects, Versions)
- [ ] Can mark event/encounter as resolved from inspector
- [ ] Effects execute in correct order (PRE → ON_RESOLVE → POST)
- [ ] Resolution updates world state
- [ ] Resolution creates audit entry
- [ ] Can view resolution history in Versions tab
- [ ] Failed resolutions can be retried
- [ ] Timeline "coming soon" alert is replaced with inspector integration

## Dependencies

- Requires: TICKET-010, TICKET-016, TICKET-023

## Estimated Effort

3-4 days
