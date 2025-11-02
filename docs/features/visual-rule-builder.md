# Visual Rule Builder

The Visual Rule Builder (TICKET-030) provides an intuitive drag-and-drop interface for constructing conditional expressions using JSONLogic without writing JSON manually. It enables game masters to create complex rules visually with blocks, variable pickers, live preview, and seamless visual/JSON mode switching.

## Overview

- Build JSONLogic expressions visually with drag-and-drop blocks
- Variable picker with autocomplete for Settlement and Structure typed variables
- Support all JSONLogic operators: logical (AND/OR/NOT), comparison (==, !=, >, <, >=, <=, ===, !==), arithmetic (+, -, \*, /, %), and conditional (IF)
- Live preview with client-side evaluation using test contexts
- Seamless visual ↔ JSON mode toggle with bidirectional conversion
- Type-safe value inputs with validation
- Integrated into Entity Inspector Conditions tab
- Comprehensive error handling and validation feedback

## Key Components

### RuleBuilder

Main container component located at `packages/frontend/src/components/features/rule-builder/RuleBuilder.tsx`

**Props:**

- `initialExpression?: JSONLogicExpression` - Initial expression to load (optional)
- `onChange: (expression: JSONLogicExpression) => void` - Callback when expression changes
- `entityType?: string` - Entity type for context (Settlement, Structure, etc.)

**Features:**

- Tab-style mode toggle (Visual/JSON)
- State management for current expression
- Bi-directional sync with BlockEditor and JSONEditor
- useEffect to sync when initial expression prop changes (async data handling)
- useCallback for performance-optimized event handlers

**State Management:**

- Local state tracks current view mode and expression
- Synchronizes automatically when initialExpression prop changes
- Propagates changes to parent via onChange callback

### BlockEditor

Visual block-based editing interface located at `packages/frontend/src/components/features/rule-builder/BlockEditor.tsx`

**Features:**

- @dnd-kit integration for drag-and-drop (PointerSensor + KeyboardSensor)
- 8px activation distance for drag threshold (prevents accidental drags)
- verticalListSortingStrategy for reorderable lists
- Bi-directional JSONLogic ↔ Block conversion (parseExpression/serializeBlocks)
- Recursive block update/delete handlers for nested structures
- Block palette toggle with "Add Block" button
- Empty state when no blocks exist
- Automatic serialization to JSONLogic on changes

**Block Structure:**

```typescript
interface Block {
  id: string; // Unique ID generated with crypto.randomUUID()
  type:
    | 'if'
    | 'and'
    | 'or'
    | 'not'
    | '=='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | '==='
    | '!=='
    | '+'
    | '-'
    | '*'
    | '/'
    | '%'
    | 'var'
    | 'literal';
  value?: LiteralValue | string; // For literal blocks and variable references
  children?: Block[]; // Nested blocks (e.g., IF condition/then/else, AND/OR operands)
}
```

**Drag-and-Drop:**

- DndContext with closestCenter collision detection
- PointerSensor works on all devices (mouse, touch, stylus)
- KeyboardSensor for accessibility
- Visual feedback during drag (opacity: 0.5)
- Nested blocks rendered with NestedBlockRenderer (no drag)

### BlockRenderer

Draggable block wrapper located at `packages/frontend/src/components/features/rule-builder/BlockRenderer.tsx`

**Features:**

- useSortable hook for top-level block dragging
- Routes to appropriate operator component based on block.type
- Visual drag feedback
- Passes onUpdate/onDelete callbacks to child components
- Disables drag for nested blocks

**Component Routing:**

- IF → IfBlock
- AND/OR/NOT → LogicalBlock
- Comparison operators → ComparisonBlock
- Arithmetic operators → ArithmeticBlock
- var → VariableBlock
- literal → LiteralBlock

### NestedBlockRenderer

Non-draggable nested block renderer located at `packages/frontend/src/components/features/rule-builder/NestedBlockRenderer.tsx`

**Purpose:**

- Renders blocks inside parent blocks (e.g., IF condition, AND/OR children)
- Same routing logic as BlockRenderer but without drag functionality
- Prevents nested drag-and-drop conflicts

### Operator Block Components

#### OperatorBlock (Base Component)

Base wrapper for all operator blocks located at `packages/frontend/src/components/features/rule-builder/OperatorBlock.tsx`

**Features:**

- Consistent styling with type-specific colors:
  - Purple: Logical (AND/OR/NOT)
  - Blue: Comparison (==, !=, >, <, etc.)
  - Green: Arithmetic (+, -, \*, /, %)
  - Yellow: Conditional (IF)
  - Indigo: Variables
  - Gray: Literals
- Collapse/expand functionality
- Validation states with error messages
- ARIA support (aria-describedby for errors, role="region")
- Delete actions and custom action slots

#### IfBlock

Conditional if-then-else component located at `packages/frontend/src/components/features/rule-builder/IfBlock.tsx`

**Structure:**

- Three-part structure: condition, then value, else value
- Uses block.children array: [0]=condition, [1]=then, [2]=else
- Nested blocks rendered with NestedBlockRenderer
- Validation ensures all three parts present
- Visual separation between parts with labels

#### LogicalBlock

Logical operators (AND/OR/NOT) component located at `packages/frontend/src/components/features/rule-builder/LogicalBlock.tsx`

**Features:**

- Multiple children support for AND/OR operations
- Single child enforcement for NOT operator with validation
- Visual operator separators between children
- Icons for each operator: ∧ (AND), ∨ (OR), ¬ (NOT)

#### ComparisonBlock

Comparison operators component located at `packages/frontend/src/components/features/rule-builder/ComparisonBlock.tsx`

**Supported Operators:**

- Equality: ==, !=, ===, !==
- Relational: >, >=, <, <=

**Features:**

- Side-by-side layout for left and right operands
- Placeholder states for missing operands
- Validation for incomplete comparisons

#### ArithmeticBlock

Arithmetic operators component located at `packages/frontend/src/components/features/rule-builder/ArithmeticBlock.tsx`

**Supported Operators:**

- Addition (+), Subtraction (-), Multiplication (\*), Division (/), Modulo (%)

**Features:**

- Supports 2+ operands with validation
- Labeled operators (add, subtract, multiply, divide, modulo)
- Visual separators between operands

#### LiteralBlock

Constant value component located at `packages/frontend/src/components/features/rule-builder/LiteralBlock.tsx`

**Supported Types:**

- String: Text input
- Number: Numeric input with decimals and negatives
- Boolean: Select dropdown (true/false)
- Null: Disabled input showing "null"

**Features:**

- Type-specific input controls
- Non-collapsible for simple display
- Validation for each type

#### VariableBlock

Variable reference component located at `packages/frontend/src/components/features/rule-builder/VariableBlock.tsx`

**Features:**

- Read-only display of variable paths
- Monospace badge for technical variable paths
- Non-collapsible compact UI
- Icon indicator (🔢)

### BlockPalette

Block creation palette located at `packages/frontend/src/components/features/rule-builder/BlockPalette.tsx`

**Categories:**

1. **Conditional:** IF
2. **Logical:** AND, OR, NOT
3. **Comparison:** ==, !=, ===, !==, >, >=, <, <=
4. **Arithmetic:** +, -, \*, /, %
5. **Values:** Variable, Literal

**Features:**

- 25+ operator types with icons and descriptions
- Creates properly structured Block objects with default children
- Integrates with generateId() for unique block IDs
- Accessible keyboard navigation

### VariablePickerInput

Autocomplete variable picker located at `packages/frontend/src/components/features/rule-builder/VariablePickerInput.tsx`

**Features:**

- Dropdown showing all available variables with real-time filtering
- Case-insensitive search by variable path
- Category grouping (Settlement, Structure, Common, etc.) with headers
- Type hints (string, number, boolean, enum) as badges
- Optional descriptions for each variable
- Manual text entry for custom variable paths
- Click-outside to close dropdown

**Keyboard Navigation:**

- Arrow Up/Down: Navigate options
- Enter: Select highlighted option
- Escape: Close dropdown
- Tab: Close and reset highlight

**Accessibility (WCAG Compliant):**

- ARIA combobox pattern
- role="combobox", aria-autocomplete="list", aria-expanded
- aria-activedescendant tracking
- aria-selected for current selection
- Focusable options with tabIndex={0}

**Performance:**

- useMemo for filtering, grouping, and flattening
- Path-to-index lookup Map for O(1) lookups
- React 18's useId() for collision-free unique IDs

### ValueInput

Type-aware value input component located at `packages/frontend/src/components/features/rule-builder/ValueInput.tsx`

**Features:**

- Mode toggle: Literal vs Variable
- Type-specific inputs based on expectedType prop
- Real-time validation with inline error messages
- Integration with VariablePickerInput for variable mode
- ARIA attributes for accessibility

**Type-Specific Inputs:**

- **String:** Text input with full Unicode support
- **Number:** Numeric input with parseFloat, decimals, negatives
- **Boolean:** Select dropdown (true/false)
- **Array:** Text input with comma-separated parsing
- **Null:** Disabled input displaying "null"

**Validation:**

- NaN detection for number inputs
- Real-time validation during input
- Inline error messages with aria-live="polite"
- aria-invalid and aria-describedby linking

### JSONEditor

Raw JSON editing component located at `packages/frontend/src/components/features/rule-builder/JSONEditor.tsx`

**Features:**

- Textarea with auto-formatting (2-space indentation)
- Real-time validation on blur (not every keystroke)
- Clear error messages with ARIA support
- Local edit tracking (isLocalEdit flag) prevents infinite loops
- Prevents overwriting user input during typing
- useId() for unique error IDs

**Validation:**

- JSON parsing validation
- Detailed error messages
- Errors clear when typing starts after validation error

### RulePreview

Live evaluation panel located at `packages/frontend/src/components/features/rule-builder/RulePreview.tsx`

**Features:**

- Client-side JSONLogic evaluation using json-logic-js
- Test context editor with JSON validation
- Display of evaluation result (boolean/value)
- Clear error display for invalid expressions
- Optional debounced auto-evaluation (300ms, toggleable with checkbox)
- Timer cleanup on unmount to prevent memory leaks

**Evaluation:**

- Uses json-logic-js library (named import: applyJsonLogic)
- Evaluates expression against provided test context
- Shows final result and any evaluation errors
- No server-side call required (fully client-side)

**Test Context:**

- JSON editor for sample variable values
- Validation with error messages
- Supports Settlement and Structure context types
- Default empty context: {}

### RuleBuilderDialog

Dialog wrapper for Entity Inspector integration located at `packages/frontend/src/components/features/rule-builder/RuleBuilderDialog.tsx`

**Props:**

- `isOpen: boolean` - Dialog open state
- `onClose: () => void` - Close callback
- `entityType: string` - Entity type (Settlement, Structure, etc.)
- `entityId: string` - Entity ID
- `existingCondition?: FieldCondition` - For edit mode (optional)
- `onSaveSuccess?: () => void` - Success callback

**Features:**

- Create/Edit modes with appropriate UI
- Field name input (disabled in edit mode)
- snake_case validation for field names
- Description and priority inputs
- RuleBuilder integration
- Loading states during save operations
- Error handling with inline messages
- Form validation

**Form Fields:**

- **Field Name:** snake_case validated text input (disabled in edit mode)
- **Description:** Optional text input
- **Priority:** Number input (default: 0)
- **Expression:** RuleBuilder component

**Save Logic:**

- Create mode: calls useCreateFieldCondition mutation
- Edit mode: calls useUpdateFieldCondition mutation
- Automatic refetch of conditions list after save
- Closes dialog on success
- Keeps dialog open on error for retry
- Calls onSaveSuccess callback after successful save

**Dialog Structure:**

- DialogHeader with title: "Create New Rule" or "Edit Rule"
- DialogContent with form fields
- DialogFooter with Cancel and Save buttons

## Helper Functions

Located at `packages/frontend/src/components/features/rule-builder/helpers.ts`

### Builder Functions

- `createVarReference(path)` - Creates variable reference expression
- `createAndBlock(conditions[])` - Creates AND logical expression
- `createOrBlock(conditions[])` - Creates OR logical expression
- `createComparisonBlock(operator, left, right)` - Creates comparison expression
- `createArithmeticBlock(operator, operands[])` - Creates arithmetic expression
- `createIfBlock(condition, thenValue, elseValue)` - Creates conditional expression
- `createLiteralBlock(value)` - Creates literal value expression

### Conversion Functions

- `parseExpression(expression): Block[]` - Converts JSONLogic to visual Blocks
- `serializeBlocks(blocks): JSONLogicExpression` - Converts visual Blocks back to JSONLogic
- `generateId()` - Generates unique block IDs with crypto.randomUUID() (fallback to Math.random() in tests)

### Bidirectional Conversion

The helpers support full roundtrip conversion:

1. JSONLogic expression → parseExpression → Blocks
2. User edits blocks visually
3. Blocks → serializeBlocks → JSONLogic expression

## Type System

Located at `packages/frontend/src/components/features/rule-builder/types.ts`

### JSONLogic Expression Types

```typescript
// Logical
interface AndExpression {
  and: JSONLogicExpression[];
}
interface OrExpression {
  or: JSONLogicExpression[];
}
interface NotExpression {
  not: JSONLogicExpression[];
}

// Comparison
interface EqualExpression {
  '==': [JSONLogicExpression, JSONLogicExpression];
}
// ... other comparison operators

// Arithmetic
interface AddExpression {
  '+': JSONLogicExpression[];
}
// ... other arithmetic operators

// Conditional
interface IfExpression {
  if: [JSONLogicExpression, JSONLogicExpression, JSONLogicExpression];
}

// Variable and Literal
interface VarExpression {
  var: string;
}
type LiteralValue = string | number | boolean | null | string[];
```

### Block Interface

```typescript
interface Block {
  id: string;
  type:
    | 'if'
    | 'and'
    | 'or'
    | 'not'
    | '=='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | '==='
    | '!=='
    | '+'
    | '-'
    | '*'
    | '/'
    | '%'
    | 'var'
    | 'literal';
  value?: LiteralValue | string;
  children?: Block[];
}
```

### Variable Definition

```typescript
interface VariableDefinition {
  path: string; // Dot-separated path (e.g., "settlement.level")
  type: 'string' | 'number' | 'boolean' | 'enum';
  description?: string; // Optional explanation
  category?: string; // Grouping category (Settlement, Structure, Common)
}
```

## Type Guards

Located at `packages/frontend/src/components/features/rule-builder/typeGuards.ts`

**Individual Operator Guards:**

- `isAndExpression(expr)`, `isOrExpression(expr)`, `isNotExpression(expr)`
- `isEqualExpression(expr)`, `isNotEqualExpression(expr)`, etc.
- `isAddExpression(expr)`, `isSubtractExpression(expr)`, etc.
- `isIfExpression(expr)`, `isVarExpression(expr)`

**Category Guards:**

- `isLogicalExpression(expr)` - AND/OR/NOT
- `isComparisonExpression(expr)` - ==, !=, >, <, etc.
- `isArithmeticExpression(expr)` - +, -, \*, /, %

**Utility:**

- `isLiteral(expr)` - Primitive values

These enable safe type narrowing during parsing.

## Entity Inspector Integration

### ConditionsTab Integration

Located at `packages/frontend/src/components/features/entity-inspector/ConditionsTab.tsx`

**UI Elements Added:**

- "New Rule" button in header (next to condition count)
- "Edit" button on each condition card

**State Management:**

- `isRuleBuilderOpen: boolean` - Dialog open state
- `conditionToEdit: FieldCondition | null` - Selected condition for editing

**Button Handlers:**

- "New Rule" → `setConditionToEdit(null)`, `setIsRuleBuilderOpen(true)`
- "Edit" → `setConditionToEdit(condition)`, `setIsRuleBuilderOpen(true)`

**Dialog Rendering:**

```tsx
<RuleBuilderDialog
  isOpen={isRuleBuilderOpen}
  onClose={() => setIsRuleBuilderOpen(false)}
  entityType={entityType}
  entityId={entityId}
  existingCondition={conditionToEdit}
  onSaveSuccess={() => refetch()} // Automatic list refresh
/>
```

### GraphQL Mutations

Located at `packages/frontend/src/services/api/mutations/conditions.ts`

**useCreateFieldCondition Hook:**

```typescript
const { createFieldCondition, loading, error } = useCreateFieldCondition();

await createFieldCondition({
  entityType,
  entityId,
  field,
  expression,
  description,
  priority,
});
```

**useUpdateFieldCondition Hook:**

```typescript
const { updateFieldCondition, loading, error } = useUpdateFieldCondition();

await updateFieldCondition(conditionId, {
  expression,
  description,
  priority,
});
```

**useDeleteFieldCondition Hook:**

```typescript
const { deleteFieldCondition, loading, error } = useDeleteFieldCondition();

await deleteFieldCondition(conditionId);
```

**Auto-Refetch:**

All mutation hooks configured with `refetchQueries: ['GetConditionsForEntity']` for automatic list updates.

## Security Features

- **Secure ID Generation:** crypto.randomUUID() for block IDs (cryptographically secure)
- **XSS Prevention:** Unknown operators display generic message instead of raw values
- **Expression Validation:** Validates JSONLogic structure before storage (via backend)
- **Type Safety:** Full TypeScript strict mode with explicit types
- **Controlled Inputs:** All inputs use React controlled component pattern

## Performance Optimizations

- **useMemo:** Extensive use for filtering, grouping, parsing (BlockEditor, VariablePickerInput)
- **useCallback:** All event handlers memoized to prevent unnecessary re-renders
- **O(1) Lookups:** Path-to-index Map in VariablePickerInput (avoids O(n²) complexity)
- **Efficient Re-rendering:** Only updates when dependencies change
- **Lazy Evaluation:** parseExpression called only when initialExpression changes

## Accessibility (WCAG Compliance)

- **ARIA Attributes:** Full coverage with roles, labels, descriptions
- **Keyboard Navigation:** Arrow keys, Enter, Escape, Tab support
- **Screen Reader Support:** aria-live regions for dynamic updates
- **Focus Management:** Proper tab order and focus indicators
- **Error Association:** aria-describedby linking inputs to error messages
- **Semantic HTML:** Proper use of form elements and labels

## Testing

**Test Coverage:**

- RuleBuilder: 17 tests (mode toggle, state management, prop syncing)
- BlockEditor: 24 tests (palette UI, add/update/delete, drag-and-drop)
- JSONEditor: 17 tests (editing, validation, error handling, accessibility)
- BlockRenderer: 16 tests (operator routing, drag attributes, visual feedback)
- NestedBlockRenderer: 15 tests (nested rendering without drag)
- BlockPalette: 23 tests (all categories, block creation, keyboard navigation)
- OperatorBlock: 25 tests (base component, styling, validation)
- IfBlock: 20 tests (structure, validation, nested rendering)
- LogicalBlock: 24 tests (AND/OR/NOT, validation, children)
- ComparisonBlock: 26 tests (all operators, operands, validation)
- ArithmeticBlock: 22 tests (all operators, multiple operands, validation)
- LiteralBlock: 18 tests (all types, inputs, validation)
- VariableBlock: 12 tests (display, read-only)
- VariablePickerInput: 27 tests (autocomplete, filtering, keyboard, accessibility)
- ValueInput: 34 tests (all modes, types, validation, accessibility)
- RulePreview: 27 tests (evaluation, test context, auto-eval, errors)
- RuleBuilderDialog: 18 tests (create/edit modes, validation, integration)
- helpers: 40 tests (all builders, parser, serializer, roundtrip)

**Total Tests:** 365+ comprehensive tests covering all components and scenarios

**Test Strategy:**

- Unit tests for individual components
- Integration tests for component composition
- Accessibility tests for ARIA compliance
- Roundtrip tests for bidirectional conversion
- Edge case tests for validation and error handling

## Usage Examples

### Creating a New Rule from Entity Inspector

1. Open Entity Inspector for a Settlement or Structure
2. Navigate to "Conditions" tab
3. Click "New Rule" button
4. Enter field name (snake_case, e.g., "is_trade_hub")
5. Optionally add description and priority
6. Build rule visually:
   - Click "Add Block" to open palette
   - Drag blocks to reorder
   - Select variables from autocomplete
   - Configure operator parameters
7. Preview rule with test context (optional)
8. Switch to JSON mode to view/edit raw expression (optional)
9. Click "Save" to persist

### Editing an Existing Rule

1. Open Entity Inspector
2. Navigate to "Conditions" tab
3. Click "Edit" button on condition card
4. Field name is read-only (cannot change)
5. Modify expression, description, or priority
6. Click "Save" to update

### Building a Complex Rule (Visual Mode)

Example: "Settlement is a trade hub if level >= 3 AND (has port OR on trade route)"

1. Add IF block
2. For condition: Add AND block
3. Inside AND:
   - Add comparison block (>=)
   - Left: Variable "settlement.level"
   - Right: Literal number 3
   - Add OR block
   - Inside OR:
     - Add Variable "settlement.has_port"
     - Add Variable "settlement.on_trade_route"
4. For then: Literal boolean true
5. For else: Literal boolean false

Resulting JSONLogic:

```json
{
  "if": [
    {
      "and": [
        { ">=": [{ "var": "settlement.level" }, 3] },
        {
          "or": [{ "var": "settlement.has_port" }, { "var": "settlement.on_trade_route" }]
        }
      ]
    },
    true,
    false
  ]
}
```

### Testing a Rule with Preview

1. Build or edit expression
2. Scroll to "Rule Preview" section
3. Enter test context JSON:
   ```json
   {
     "settlement": {
       "level": 4,
       "has_port": true,
       "on_trade_route": false
     }
   }
   ```
4. Click "Evaluate" or enable auto-evaluation
5. View result (e.g., "Result: true")
6. Modify context or expression to test different scenarios

### Switching Between Visual and JSON Modes

1. Click "Visual" or "JSON" tab
2. Changes in one mode automatically reflect in the other
3. Invalid JSON shows error message (stays in JSON mode)
4. Valid JSON parses to blocks (can switch to Visual mode)

## Known Limitations & Future Enhancements

**Current Limitations:**

- No toast notifications (TODO comments in RuleBuilderDialog)
- No unsaved changes confirmation dialog
- No keyboard shortcuts (Ctrl+S, Esc)
- No inline tooltips on blocks
- No undo/redo functionality
- No block templates or saved snippets

**Future Enhancements (Potential):**

- Toast notifications for save success/failure
- Unsaved changes warning before closing dialog
- Keyboard shortcuts for common actions
- Inline help tooltips on hover
- Undo/redo with history stack
- Block templates library
- Export/import expressions
- Rule versioning and history
- Rule testing with actual entity data
- Rule performance profiling
- Visual evaluation trace (step-by-step)

## Related Documentation

- [Condition System](./condition-system.md) - Backend condition evaluation
- [Entity Inspector](./entity-inspector.md) - Entity Inspector integration
- [Rules Engine Worker](./rules-engine-worker.md) - High-performance evaluation microservice

## Code Locations

**Frontend Components:**

- `packages/frontend/src/components/features/rule-builder/` - All rule builder components
- `packages/frontend/src/components/features/entity-inspector/ConditionsTab.tsx` - Integration point

**GraphQL Mutations:**

- `packages/frontend/src/services/api/mutations/conditions.ts` - Mutation hooks

**Tests:**

- `packages/frontend/src/components/features/rule-builder/*.test.tsx` - Component tests

**Documentation:**

- `docs/features/visual-rule-builder.md` - This file
- `plan/TICKET-030.md` - Original ticket
- `plan/TICKET-030-implementation-plan.md` - Implementation stages

## Development Notes

**Technology Choices:**

- **@dnd-kit:** Modern, accessible, flexible drag-and-drop library
- **sonner:** Lightweight toast notifications (available but not yet integrated)
- **json-logic-js:** Standard JSONLogic evaluation library
- **React 18:** useId() for collision-free IDs, concurrent features

**Design Decisions:**

- Bi-directional conversion maintains JSONLogic compatibility
- Separate BlockRenderer/NestedBlockRenderer avoids drag conflicts
- Controlled component pattern for all inputs
- useMemo/useCallback for performance
- TypeScript strict mode for type safety
- ARIA compliance for accessibility

**Commit History:**

- ea599f0: Stage 1 - Setup and Dependencies
- 5cebb60: Stage 2 - JSONLogic Type Definitions and Helpers
- 7f782aa: Stage 3 - Variable Picker with Autocomplete
- 3b7219e: Stage 4 - Operator Block Components
- e150ea4: Stage 5 - Drag-and-Drop Block Reordering
- 68f0766: Stage 6 - Value Input with Type Validation
- 7e9976b: Stage 7 - Visual/JSON Mode Toggle
- 6f10ca8: Stage 8 - Live Preview and Rule Testing (with fixes)
- 06205e0: Stage 9 - Integration with Entity Inspector

---

**Status:** Feature Complete

**Ticket:** TICKET-030

**Estimated Effort:** 5-6 days (actual: 10 stages completed)
