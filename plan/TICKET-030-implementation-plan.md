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

- [x] Add `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` to package.json
- [x] Install dependencies with `pnpm install`
- [x] Create directory structure: `packages/frontend/src/components/features/rule-builder/`
- [x] Create placeholder components:
  - `RuleBuilder.tsx` (main container)
  - `BlockEditor.tsx` (visual editor)
  - `JSONEditor.tsx` (code editor)
- [x] Create basic tests for each component

**Success Criteria**:

- ✅ Dependencies installed successfully (@dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2)
- ✅ All placeholder components render without errors
- ✅ Tests pass (30 tests: 13 RuleBuilder + 9 BlockEditor + 8 JSONEditor)
- ✅ Type-check passes

**Status**: ✅ Complete (Commit: ea599f0)

---

## Stage 2: JSONLogic Type Definitions and Helpers

**Goal**: Create TypeScript types and utility functions for working with JSONLogic expressions

**Tasks**:

- [x] Define TypeScript interfaces for JSONLogic operators (`if`, `and`, `or`, `==`, `!=`, `>`, `<`, etc.)
- [x] Create type guards to distinguish between operator types
- [x] Implement helpers for building JSONLogic AST:
  - `createIfBlock(condition, thenValue, elseValue)`
  - `createAndBlock(conditions[])`
  - `createOrBlock(conditions[])`
  - `createComparisonBlock(operator, left, right)`
  - `createVarReference(variablePath)`
  - `createArithmeticBlock(operator, operands[])`
  - `createLiteralBlock(value)`
- [x] Create helpers for parsing JSONLogic to visual blocks:
  - `parseExpression(expression): Block[]`
  - `serializeBlocks(blocks): JSONLogicExpression`
- [x] Write comprehensive tests for all helpers

**Success Criteria**:

- ✅ All type definitions compile without errors
- ✅ Helper functions correctly build JSONLogic expressions
- ✅ Parse and serialize functions are bidirectional (roundtrip works)
- ✅ Comprehensive test coverage for utilities (40 tests)

**Status**: ✅ Complete (Commit: 5cebb60)

---

## Stage 3: Variable Picker with Autocomplete

**Goal**: Implement variable selection with autocomplete, supporting Settlement and Structure types

**Tasks**:

- [x] Create `VariablePickerInput.tsx` component
- [x] Implement variable context fetching:
  - Query available variables for entity type
  - Include computed fields, custom variables, and system fields
- [x] Build autocomplete UI:
  - Dropdown with categorized variables (Settlement, Structure, Common)
  - Search/filter by variable name
  - Display variable type hints
- [x] Add keyboard navigation (arrow keys, enter, escape)
- [x] Implement variable path syntax (support nested paths like `settlement.level`)
- [x] Write tests for autocomplete behavior and filtering

**Success Criteria**:

- ✅ Variable picker shows all available variables
- ✅ Variables are correctly categorized by entity type
- ✅ Search filtering works correctly
- ✅ Keyboard navigation functions properly
- ✅ Component integrates with existing Settlement/Structure queries

**Status**: ✅ Complete (Commit: 7f782aa)

---

## Stage 4: Operator Block Components

**Goal**: Create reusable block components for different JSONLogic operators

**Tasks**:

- [x] Create `OperatorBlock.tsx` base component
- [x] Implement specific operator blocks:
  - `IfBlock.tsx` (if-then-else structure)
  - `LogicalBlock.tsx` (and/or with multiple children)
  - `ComparisonBlock.tsx` (==, !=, >, <, >=, <=)
  - `ArithmeticBlock.tsx` (+, -, \*, /, %)
  - `LiteralBlock.tsx` (constant values)
  - `VariableBlock.tsx` (variable references using var operator)
- [x] Style blocks with distinctive colors/icons per operator type
- [x] Add block validation (highlight invalid configurations)
- [x] Implement block collapse/expand for nested structures
- [x] Write tests for each block type

**Success Criteria**:

- ✅ All operator blocks render correctly
- ✅ Blocks display appropriate UI based on operator type
- ✅ Visual distinction between different operator categories
- ✅ Validation shows errors for incomplete blocks
- ✅ Tests verify correct JSONLogic generation

**Status**: ✅ Complete (Commit: 3b7219e)

---

## Stage 5: Drag-and-Drop Block Reordering

**Goal**: Implement drag-and-drop functionality for rearranging blocks

**Tasks**:

- [x] Set up `@dnd-kit` context providers in `BlockEditor.tsx`
- [x] Make blocks draggable with drag handles
- [x] Implement drop zones for reordering
- [x] Add visual feedback during drag (ghost/overlay)
- [x] Handle nested block dragging (drag into/out of containers)
- [x] Implement block deletion (drag to trash or delete button)
- [x] Add "Add Block" palette/menu with available operators
- [x] Write tests for drag-and-drop interactions (using @testing-library/user-event)

**Success Criteria**:

- ✅ Blocks can be reordered by dragging
- ✅ Visual feedback shows valid drop locations
- ✅ Nested blocks can be moved in/out of parent containers
- ✅ Blocks can be deleted
- ✅ New blocks can be added from palette
- ✅ Drag interactions work on touch devices (via PointerSensor)

**Status**: ✅ Complete (Commit: e150ea4)

---

## Stage 6: Value Input with Type Validation

**Goal**: Create type-aware input fields for literal values in expressions

**Tasks**:

- [x] Create `ValueInput.tsx` component
- [x] Implement type-specific inputs:
  - String input (text field)
  - Number input (numeric field with validation)
  - Boolean input (select dropdown)
  - Array input (comma-separated with auto-parsing)
  - Null option (disabled input)
- [x] Add input validation based on expected type
- [x] Display validation errors inline
- [x] Support both literal values and variable references
- [x] Write tests for all input types and validation

**Success Criteria**:

- ✅ Correct input type shown based on context
- ✅ Validation prevents invalid values (NaN detection for numbers)
- ✅ Error messages are clear and helpful (ARIA live regions)
- ✅ Both literal and variable inputs work (mode toggle)
- ✅ Tests cover all input types (34 comprehensive tests)

**Status**: ✅ Complete (Commit: 68f0766)

---

## Stage 7: Visual/JSON Mode Toggle

**Goal**: Allow switching between visual block editor and raw JSON editing

**Tasks**:

- [x] Implement view toggle UI (tabs or switch button)
- [x] Create `JSONEditor.tsx` component with syntax highlighting
- [x] Use `<textarea>` or simple code editor for JSON input
- [x] Implement JSON validation and error display
- [x] Synchronize state between visual and JSON views:
  - Parse JSON to blocks when switching to visual mode
  - Serialize blocks to JSON when switching to JSON mode
  - Preserve user intent during conversions
- [x] Handle parse errors gracefully (show error, keep JSON mode)
- [x] Write tests for mode switching and synchronization

**Success Criteria**:

- ✅ Can switch between visual and JSON modes
- ✅ Changes in one mode reflect in the other
- ✅ Invalid JSON shows clear error message
- ✅ Valid JSONLogic expressions parse to blocks correctly
- ✅ Tests verify bidirectional synchronization

**Status**: ✅ Complete (Commit: 7e9976b)

---

## Stage 8: Live Preview and Rule Testing

**Goal**: Implement real-time evaluation of rules with test contexts

**Tasks**:

- [x] Create `RulePreview.tsx` component
- [x] Build test context editor:
  - [x] Allow users to input sample variable values
  - [x] JSON validation with error messages
  - [x] Support Settlement and Structure context types
- [x] Integrate client-side JSONLogic evaluation (using json-logic-js library)
- [x] Display evaluation result:
  - [x] Show final boolean/value result
  - [x] Clear error display for invalid expressions
- [x] Show evaluation errors clearly
- [x] Implement debounced auto-evaluation (optional toggle with 300ms debounce)
- [x] Write tests for preview functionality (27 comprehensive tests)
- [x] **Fix Checkbox component to follow project UI patterns**:
  - ✅ Uses React.forwardRef for ref forwarding
  - ✅ Imports and uses `cn` utility from `@/lib/utils` for class merging
  - ✅ Extends React.InputHTMLAttributes<HTMLInputElement>
  - ✅ Added displayName for debugging
  - ✅ Props spread before controlled props for correct precedence
- [x] **Fix RulePreview code ordering issue**:
  - ✅ Moved `evaluate` callback definition BEFORE the auto-evaluate useEffect
  - ✅ Removed eslint-disable comment
  - ✅ Ensures proper dependency tracking in useEffect
- [x] **Add timer cleanup to prevent memory leaks**:
  - ✅ Added useEffect with cleanup to clear debounceTimerRef.current on component unmount
  - ✅ Prevents errors if component unmounts while timer is pending
- [x] **Additional improvements**:
  - ✅ Changed jsonLogic import to named import (applyJsonLogic) to fix ESLint warning
  - ✅ Removed unused resultStatusId
  - ✅ Removed unnecessary type cast in Checkbox onCheckedChange

**Success Criteria**:

- [x] Test context can be manually edited
- [x] Rules evaluate against test context (client-side with json-logic-js)
- [x] Evaluation result is clearly displayed
- [ ] Evaluation trace shows step-by-step logic (deferred - using simple result display for now)
- [x] Works with Settlement and Structure variables
- [x] Tests verify evaluation integration (27 passing tests)
- [x] **Code review issues resolved** (all 3 critical fixes applied + optional improvements)

**Status**: ✅ Complete (Commit: 6f10ca8)

---

## Stage 9: Integration with Entity Inspector

**Goal**: Integrate rule builder into the existing Entity Inspector UI

**Tasks**:

- [x] **Explore Entity Inspector architecture** (packages/frontend/src/components/features/entity-inspector/)
  - ✅ Analyzed ConditionsTab structure and existing patterns
  - ✅ Identified Dialog component usage patterns
  - ✅ Understood refetch() mechanism for updating condition lists
  - ✅ Studied GraphQL resolver API (createFieldCondition, updateFieldCondition)
  - ✅ Reviewed field condition input types (entityType, entityId, field, expression, description, priority)

- [x] **Create GraphQL mutation hooks** (packages/frontend/src/services/api/mutations/conditions.ts)
  - ✅ Implemented useCreateFieldCondition hook with auto-refetch
  - ✅ Implemented useUpdateFieldCondition hook with auto-refetch
  - ✅ Implemented useDeleteFieldCondition hook with auto-refetch
  - ✅ Exported all hooks from mutations/index.ts
  - ✅ Added TypeScript types (CreateFieldConditionInput, UpdateFieldConditionInput, FieldCondition)
  - ✅ Configured automatic refetchQueries for 'GetConditionsForEntity'

- [x] **Create RuleBuilderDialog component** (packages/frontend/src/components/features/rule-builder/RuleBuilderDialog.tsx)
  - ✅ Wrapper component that integrates RuleBuilder with Dialog UI
  - ✅ Props: isOpen, onClose, entityType, entityId, existingCondition (optional for edit mode), onSaveSuccess
  - ✅ DialogHeader with title: "Create New Rule" or "Edit Rule"
  - ✅ Field name input (TextField) for new rules with snake_case validation
  - ✅ Field name disabled and displayed as read-only in edit mode
  - ✅ Description input (optional TextField)
  - ✅ Priority input (NumberField, default: 0)
  - ✅ RuleBuilder component integrated into DialogContent within Card
  - ✅ DialogFooter with Cancel and Save buttons
  - ✅ Loading state during save operations (buttons disabled, text changes to "Saving...")
  - ✅ Error handling with inline error messages (Card with error styling)
  - ✅ Save logic implemented:
    - ✅ Calls useCreateFieldCondition for new rules
    - ✅ Calls useUpdateFieldCondition for existing rules
    - ✅ Passes entityType, entityId, field, expression, description, priority
    - ✅ Closes dialog on success
    - ✅ Keeps dialog open on error (allows user to retry)
    - ✅ Calls onSaveSuccess callback after successful save
  - ⚠️ Toast notifications deferred (TODOs added in code)
  - ⚠️ Unsaved changes confirmation deferred to Stage 10

- [x] **Update ConditionsTab** (packages/frontend/src/components/features/entity-inspector/ConditionsTab.tsx)
  - ✅ Added "New Rule" button in header (next to condition count)
  - ✅ Added "Edit" button to each condition card
  - ✅ State management for dialog:
    - ✅ isRuleBuilderOpen: boolean
    - ✅ conditionToEdit: FieldCondition | null
  - ✅ Wire button click handlers:
    - ✅ "New Rule" → setConditionToEdit(null), setIsRuleBuilderOpen(true)
    - ✅ "Edit" → setConditionToEdit(condition), setIsRuleBuilderOpen(true)
  - ✅ Render RuleBuilderDialog with appropriate props
  - ✅ Pass refetch callback to onSaveSuccess (automatic list refresh)

- [x] **Write integration tests** (packages/frontend/src/components/features/rule-builder/RuleBuilderDialog.test.tsx)
  - ✅ 18 comprehensive test scenarios covering:
    - ✅ Create Mode: dialog rendering, field name input, validation
    - ✅ Edit Mode: read-only field name, form population, update button
    - ✅ Form Submission: validation enforcement, loading states, error display
    - ✅ Dialog Lifecycle: form reset on open, mode switching
    - ✅ Accessibility: ARIA labels, invalid field marking, descriptive buttons
    - ✅ Integration: RuleBuilder props passing
  - ⚠️ Tests for successful GraphQL operations deferred (mutation mocking complexity)
  - ⚠️ Unsaved changes confirmation tests deferred to Stage 10

- [x] **TypeScript fixes and exports**
  - ✅ Fixed 6 TypeScript compilation errors
  - ✅ Added type conversions between JSONLogicExpression and Record<string, unknown>
  - ✅ Exported RuleBuilderDialog and RuleBuilderDialogProps from index.ts
  - ✅ Exported RulePreview and RulePreviewProps from index.ts
  - ✅ Exported RulePreviewProps interface from RulePreview.tsx

- [x] **Checkbox component fix**
  - ✅ Moved {...props} spread before controlled props for correct precedence
  - ✅ Ensures component's controlled props override user-provided props

**Success Criteria**:

- [x] GraphQL mutation hooks created and exported
- [x] Rule builder can be opened from Conditions tab (both "New Rule" and "Edit" buttons)
- [x] Entity context is correctly passed (entityType, entityId)
- [x] New rules can be created with field name, expression, description, and priority
- [x] Existing rules can be edited (expression, description, priority)
- [x] Changes persist to backend via GraphQL mutations
- [x] UI updates after save (automatic refetch via mutation hooks)
- [ ] Success/error toasts display appropriately (deferred to Stage 10)
- [x] Integration tests pass (18 test scenarios)

**Status**: ✅ Complete (Commit: 06205e0)

**What was implemented**:

1. **RuleBuilderDialog component** (322 lines)
   - Complete dialog wrapper with create/edit modes
   - Field name validation with snake_case regex
   - Form state management and validation
   - Integration with useCreateFieldCondition and useUpdateFieldCondition hooks
   - Loading states and error handling
   - Full accessibility with ARIA attributes

2. **ConditionsTab integration**
   - Already completed in previous work
   - "New Rule" and "Edit" buttons functional
   - State management for dialog control
   - Automatic list refresh after save

3. **Comprehensive test suite** (404 lines)
   - 18 test scenarios covering all use cases
   - Create/edit modes, validation, accessibility
   - Dialog lifecycle, form population, error handling

4. **Type safety improvements**
   - Fixed 6 TypeScript compilation errors
   - Added proper type conversions with explanatory comments
   - Exported all necessary types and components

5. **Checkbox component fix**
   - Props precedence corrected for controlled components

**Key decisions**:

- Used `as unknown as` pattern for type conversions (safe and explicit)
- Field name disabled in edit mode (prevents accidental changes)
- Toast notifications deferred to Stage 10 (simpler implementation)
- Unsaved changes confirmation deferred to Stage 10 (not critical)
- Focus on core functionality and type safety first

**Testing**:

- TypeScript compilation: ✅ Passes with strict mode
- ESLint: ✅ No errors in changed files
- Tests: ✅ 18 comprehensive unit/integration tests
- Code Review: ✅ Approved by code-reviewer subagent

**What's deferred to Stage 10**:

- Toast notifications (TODO comments added in code)
- Unsaved changes confirmation dialog
- E2E tests for complete workflows
- Additional error handling edge cases

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
