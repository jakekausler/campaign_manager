# TICKET-031: Version History & Diff Viewer

## Status

- [ ] Completed (Stages 1-4 of 10 complete)
- **Commits**:
  - b1f4384 - Stage 2: Frontend GraphQL Hooks
  - 70cf597 - Stage 3: Version List Component
  - 760a327 - Stage 4: DiffViewer Component

## Description

Create UI components for viewing version history with visual diffs and ability to restore previous versions.

## Scope of Work

1. Create version history list component
2. Display Settlement entity version history
3. Display Structure entity version history
4. Implement diff viewer with side-by-side comparison
5. Add syntax highlighting for JSON diffs
6. Diff viewer handles Settlement payloads (level, variables, structures)
7. Diff viewer handles Structure payloads (type, level, variables)
8. Create restore/revert functionality
9. Add version comparison (any two versions)
10. Implement version filtering and search

## Acceptance Criteria

- [ ] Version history shows all changes
- [ ] Settlement version history displays correctly
- [ ] Structure version history displays correctly
- [ ] Diff viewer highlights changes clearly
- [ ] Settlement diffs highlight level and variable changes
- [ ] Structure diffs highlight type, level, and variable changes
- [ ] Can restore to any previous version
- [ ] Can compare any two versions
- [ ] User and timestamp displayed

## Dependencies

- Requires: TICKET-007, TICKET-023

## Estimated Effort

3-4 days
