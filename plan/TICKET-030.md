# TICKET-030: Visual Rule Builder UI

## Status
- [ ] Completed
- **Commits**:

## Description
Create visual rule builder interface for constructing conditional expressions without writing JSON, with drag-and-drop blocks and live preview.

## Scope of Work
1. Create rule builder component
2. Implement if/and/or block components
3. Add variable picker with autocomplete
4. Variable picker includes Settlement typed variables
5. Variable picker includes Structure typed variables
6. Autocomplete categorizes variables by entity type (includes Settlement, Structure)
7. Create operator selection UI
8. Add value input fields with validation
9. Implement drag-and-drop reordering
10. Add JSON preview/edit mode toggle
11. Create "test this rule" live preview
12. Live preview evaluates Settlement and Structure variable rules

## Acceptance Criteria
- [ ] Can build rules visually
- [ ] Generated JSON is valid
- [ ] Can switch between visual and JSON modes
- [ ] Variable autocomplete works
- [ ] Can select Settlement variables in picker
- [ ] Can select Structure variables in picker
- [ ] Live preview shows rule evaluation
- [ ] Live preview works with Settlement/Structure rules
- [ ] Invalid rules show clear errors

## Dependencies
- Requires: TICKET-012, TICKET-023

## Estimated Effort
5-6 days
