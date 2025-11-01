# TICKET-030 Implementation Plan: Visual Rule Builder UI

## Overview

Create a visual rule builder interface that allows users to construct conditional expressions using drag-and-drop blocks, variable pickers with autocomplete, and live preview of rule evaluation. This will provide an intuitive alternative to manually writing JSONLogic expressions.

## Architecture Decisions

### Component Structure

- **RuleBuilder**: Main container component with view toggle (visual/JSON)
- **BlockEditor**: Visual block-based editing interface with drag-and-drop
- **OperatorBlock**: Individual operator blocks (if/and/or/comparison)
- **VariablePickerInput**: Autocomplete input for selecting variables
- **ValueInput**: Type-aware input for literal values
- **RulePreview**: Live evaluation panel with test context
- **JSONEditor**: Code editor fallback for manual JSON editing

### Technical Choices

- **Drag-and-Drop**: `@dnd-kit` (modern, accessible, flexible)
- **JSONLogic Library**: Use existing backend evaluation (via GraphQL)
- **State Management**: Local React state (no Zustand needed for isolated feature)
- **Autocomplete**: Custom implementation using existing UI components

### Integration Points

- **Entity Inspector**: Add new "Rule Builder" tab or integrate into Conditions tab
- **GraphQL**: Use existing `evaluateFieldCondition` mutation for live preview
- **Type System**: Support Settlement, Structure, and generic entity types

---

## Stage 1: Setup and Dependencies

**Goal**: Install required dependencies and create basic component structure

**Tasks**:

- [ ] Add `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` to package.json
- [ ] Install dependencies with `pnpm install`
- [ ] Create directory structure: `packages/frontend/src/components/features/rule-builder/`
- [ ] Create placeholder components:
  - `RuleBuilder.tsx` (main container)
  - `BlockEditor.tsx` (visual editor)
  - `JSONEditor.tsx` (code editor)
- [ ] Create basic tests for each component

**Success Criteria**:

- Dependencies installed successfully
- All placeholder components render without errors
- Tests pass
- Type-check passes

**Status**: Not Started

---

## Stage 2: JSONLogic Type Definitions and Helpers

**Goal**: Create TypeScript types and utility functions for working with JSONLogic expressions

**Tasks**:

- [ ] Define TypeScript interfaces for JSONLogic operators (`if`, `and`, `or`, `==`, `!=`, `>`, `<`, etc.)
- [ ] Create type guards to distinguish between operator types
- [ ] Implement helpers for building JSONLogic AST:
  - `createIfBlock(condition, thenValue, elseValue)`
  - `createAndBlock(conditions[])`
  - `createOrBlock(conditions[])`
  - `createComparisonBlock(operator, left, right)`
  - `createVarReference(variablePath)`
- [ ] Create helpers for parsing JSONLogic to visual blocks:
  - `parseExpression(expression): Block[]`
  - `serializeBlocks(blocks): JSONLogicExpression`
- [ ] Write comprehensive tests for all helpers

**Success Criteria**:

- All type definitions compile without errors
- Helper functions correctly build JSONLogic expressions
- Parse and serialize functions are bidirectional (roundtrip works)
- 100% test coverage for utilities

**Status**: Not Started

---

## Stage 3: Variable Picker with Autocomplete

**Goal**: Implement variable selection with autocomplete, supporting Settlement and Structure types

**Tasks**:

- [ ] Create `VariablePickerInput.tsx` component
- [ ] Implement variable context fetching:
  - Query available variables for entity type
  - Include computed fields, custom variables, and system fields
- [ ] Build autocomplete UI:
  - Dropdown with categorized variables (Settlement, Structure, Common)
  - Search/filter by variable name
  - Display variable type hints
- [ ] Add keyboard navigation (arrow keys, enter, escape)
- [ ] Implement variable path syntax (support nested paths like `settlement.level`)
- [ ] Write tests for autocomplete behavior and filtering

**Success Criteria**:

- Variable picker shows all available variables
- Variables are correctly categorized by entity type
- Search filtering works correctly
- Keyboard navigation functions properly
- Component integrates with existing Settlement/Structure queries

**Status**: Not Started

---

## Stage 4: Operator Block Components

**Goal**: Create reusable block components for different JSONLogic operators

**Tasks**:

- [ ] Create `OperatorBlock.tsx` base component
- [ ] Implement specific operator blocks:
  - `IfBlock.tsx` (if-then-else structure)
  - `LogicalBlock.tsx` (and/or with multiple children)
  - `ComparisonBlock.tsx` (==, !=, >, <, >=, <=)
  - `ArithmeticBlock.tsx` (+, -, \*, /, %)
  - `LiteralBlock.tsx` (constant values)
  - `VariableBlock.tsx` (variable references using var operator)
- [ ] Style blocks with distinctive colors/icons per operator type
- [ ] Add block validation (highlight invalid configurations)
- [ ] Implement block collapse/expand for nested structures
- [ ] Write tests for each block type

**Success Criteria**:

- All operator blocks render correctly
- Blocks display appropriate UI based on operator type
- Visual distinction between different operator categories
- Validation shows errors for incomplete blocks
- Tests verify correct JSONLogic generation

**Status**: Not Started

---

## Stage 5: Drag-and-Drop Block Reordering

**Goal**: Implement drag-and-drop functionality for rearranging blocks

**Tasks**:

- [ ] Set up `@dnd-kit` context providers in `BlockEditor.tsx`
- [ ] Make blocks draggable with drag handles
- [ ] Implement drop zones for reordering
- [ ] Add visual feedback during drag (ghost/overlay)
- [ ] Handle nested block dragging (drag into/out of containers)
- [ ] Implement block deletion (drag to trash or delete button)
- [ ] Add "Add Block" palette/menu with available operators
- [ ] Write tests for drag-and-drop interactions (using @testing-library/user-event)

**Success Criteria**:

- Blocks can be reordered by dragging
- Visual feedback shows valid drop locations
- Nested blocks can be moved in/out of parent containers
- Blocks can be deleted
- New blocks can be added from palette
- Drag interactions work on touch devices

**Status**: Not Started

---

## Stage 6: Value Input with Type Validation

**Goal**: Create type-aware input fields for literal values in expressions

**Tasks**:

- [ ] Create `ValueInput.tsx` component
- [ ] Implement type-specific inputs:
  - String input (text field)
  - Number input (numeric field with validation)
  - Boolean input (checkbox/toggle)
  - Array input (comma-separated or multi-value)
  - Null/undefined option
- [ ] Add input validation based on expected type
- [ ] Display validation errors inline
- [ ] Support both literal values and variable references
- [ ] Write tests for all input types and validation

**Success Criteria**:

- Correct input type shown based on context
- Validation prevents invalid values
- Error messages are clear and helpful
- Both literal and variable inputs work
- Tests cover all input types

**Status**: Not Started

---

## Stage 7: Visual/JSON Mode Toggle

**Goal**: Allow switching between visual block editor and raw JSON editing

**Tasks**:

- [ ] Implement view toggle UI (tabs or switch button)
- [ ] Create `JSONEditor.tsx` component with syntax highlighting
- [ ] Use `<textarea>` or simple code editor for JSON input
- [ ] Implement JSON validation and error display
- [ ] Synchronize state between visual and JSON views:
  - Parse JSON to blocks when switching to visual mode
  - Serialize blocks to JSON when switching to JSON mode
  - Preserve user intent during conversions
- [ ] Handle parse errors gracefully (show error, keep JSON mode)
- [ ] Write tests for mode switching and synchronization

**Success Criteria**:

- Can switch between visual and JSON modes
- Changes in one mode reflect in the other
- Invalid JSON shows clear error message
- Valid JSONLogic expressions parse to blocks correctly
- Tests verify bidirectional synchronization

**Status**: Not Started

---

## Stage 8: Live Preview and Rule Testing

**Goal**: Implement real-time evaluation of rules with test contexts

**Tasks**:

- [ ] Create `RulePreview.tsx` component
- [ ] Build test context editor:
  - Allow users to input sample variable values
  - Pre-populate with current entity state (if applicable)
  - Support Settlement and Structure context types
- [ ] Integrate with `evaluateFieldCondition` GraphQL mutation
- [ ] Display evaluation result:
  - Show final boolean/value result
  - Display evaluation trace (step-by-step)
  - Highlight which branches were taken
- [ ] Add "Test with current values" quick action
- [ ] Show evaluation errors clearly
- [ ] Implement debounced auto-evaluation (optional toggle)
- [ ] Write tests for preview functionality

**Success Criteria**:

- Test context can be manually edited
- Rules evaluate against test context
- Evaluation result is clearly displayed
- Evaluation trace shows step-by-step logic
- Works with Settlement and Structure variables
- Tests verify evaluation integration

**Status**: Not Started

---

## Stage 9: Integration with Entity Inspector

**Goal**: Integrate rule builder into the existing Entity Inspector UI

**Tasks**:

- [ ] Add "Edit Rule" button/action to ConditionsTab
- [ ] Create modal or drawer for rule builder (using existing Dialog component)
- [ ] Pass entity type and ID to rule builder for context
- [ ] Implement save functionality:
  - Create new condition via GraphQL
  - Update existing condition via GraphQL
- [ ] Add cancel/discard changes confirmation
- [ ] Show success/error toasts after save
- [ ] Refresh ConditionsTab after save
- [ ] Write integration tests with Entity Inspector

**Success Criteria**:

- Rule builder can be opened from Conditions tab
- Entity context is correctly passed
- New rules can be created
- Existing rules can be edited
- Changes persist to backend
- UI updates after save
- Integration tests pass

**Status**: Not Started

---

## Stage 10: Polish, Error Handling, and Documentation

**Goal**: Finalize UX, handle edge cases, and document the feature

**Tasks**:

- [ ] Add loading states for all async operations
- [ ] Implement comprehensive error handling:
  - Network errors
  - Invalid JSONLogic expressions
  - Evaluation failures
  - Save conflicts
- [ ] Add helpful tooltips and hints
- [ ] Implement keyboard shortcuts (Ctrl+S to save, Esc to close, etc.)
- [ ] Add empty state for new rules
- [ ] Create onboarding/help modal explaining block types
- [ ] Optimize performance (memoization, lazy loading)
- [ ] Write E2E tests for complete workflows
- [ ] Update documentation:
  - Add feature docs to `docs/features/visual-rule-builder.md`
  - Update CLAUDE.md with rule builder details
  - Add usage examples to README

**Success Criteria**:

- All loading states are smooth and informative
- Errors are handled gracefully with helpful messages
- UX is polished and intuitive
- Performance is acceptable with complex rules
- Documentation is complete and accurate
- E2E tests cover critical user journeys

**Status**: Not Started

---

## Testing Strategy

### Unit Tests

- Component rendering and props
- JSONLogic helper functions
- Type validation logic
- Autocomplete filtering

### Integration Tests

- Block editor with drag-and-drop
- Visual/JSON mode synchronization
- Live preview evaluation
- Entity Inspector integration

### E2E Tests (via Vitest + Testing Library)

- Create new rule from scratch
- Edit existing rule
- Test rule with different contexts
- Switch between visual and JSON modes
- Save rule and verify persistence

---

## Rollout Plan

1. **Stage 1-2**: Foundation (types, utilities, structure)
2. **Stage 3-4**: Core UI (variables, blocks)
3. **Stage 5-6**: Interactivity (drag-and-drop, inputs)
4. **Stage 7-8**: Advanced features (JSON mode, live preview)
5. **Stage 9-10**: Integration and polish

Each stage should be committed incrementally with passing tests.

---

## Success Metrics

- [ ] Users can create valid JSONLogic expressions without writing JSON
- [ ] Variable picker includes Settlement and Structure variables
- [ ] Drag-and-drop feels smooth and intuitive
- [ ] Live preview accurately evaluates rules
- [ ] Mode toggle works bidirectionally without data loss
- [ ] All acceptance criteria from TICKET-030 are met
- [ ] Test coverage > 80%
- [ ] No TypeScript or ESLint errors

---

## Notes

- This is a large feature; each stage represents significant work
- Prioritize user experience and accessibility
- Follow existing patterns from Entity Inspector and ConditionsTab
- Reuse existing UI components (Button, Card, Dialog, etc.)
- Maintain consistency with project code style
