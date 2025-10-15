# TICKET-021: Flow View with React Flow

## Status

- [ ] Completed
- **Commits**:

## Description

Implement flowchart/dependency graph view using React Flow to visualize relationships between entities (events, encounters, locations, characters).

## Scope of Work

1. Install and configure React Flow
2. Create Flow component with custom nodes
3. Implement node types (event, encounter, location, character, settlement, structure)
4. Add edge types (requires, unlocks, influences)
5. Implement auto-layout algorithm
6. Add node editing (double-click to edit)
7. Create minimap and controls
8. Add selection and highlighting

## Acceptance Criteria

- [ ] Dependency graph renders correctly
- [ ] Different entity types have distinct node styles
- [ ] Edges show relationship types
- [ ] Auto-layout arranges nodes readably
- [ ] Can select and highlight nodes
- [ ] Minimap shows overview
- [ ] Performance good with 100+ nodes
- [ ] Settlement nodes render with distinct styles
- [ ] Structure nodes render with distinct styles
- [ ] Settlement-Kingdom relationships display correctly
- [ ] Structure-Settlement relationships display correctly

## Dependencies

- Requires: TICKET-014, TICKET-018

## Estimated Effort

4-5 days
