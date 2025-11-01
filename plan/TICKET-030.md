# TICKET-030: Visual Rule Builder UI

## Status

- [ ] Completed
- **Commits**:
  - ea599f0 - Stage 1: Setup and Dependencies

## Implementation Notes

### Stage 1: Setup and Dependencies (Complete)

**Completed**: Stage 1 established the foundation for the visual rule builder.

**What was implemented**:

- Added @dnd-kit dependencies (core, sortable, utilities) to frontend package.json
- Created placeholder components: RuleBuilder, BlockEditor, JSONEditor
- Each component has proper TypeScript interfaces defining the props API
- Comprehensive test coverage (30 tests total)
- All components use modern React patterns (no React import, inline prop types)

**Key decisions**:

- Used @dnd-kit over react-dnd: More modern, better TypeScript support, actively maintained
- Separated visual (BlockEditor) from JSON (JSONEditor) editing: Allows independent development
- Props defined upfront with underscore prefix for unused params: Establishes API contract for future stages
- Latest stable versions: @dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2

**Testing**:

- All 30 tests passing
- TypeScript compilation passing
- ESLint passing with no new errors
- Code reviewed and approved by code-reviewer agent

**Next**: Stage 2 will implement JSONLogic type definitions and helper functions.

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
