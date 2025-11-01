# TICKET-030: Visual Rule Builder UI

## Status

- [ ] Completed
- **Commits**:
  - ea599f0 - Stage 1: Setup and Dependencies
  - 5cebb60 - Stage 2: JSONLogic Type Definitions and Helpers

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

### Stage 2: JSONLogic Type Definitions and Helpers (Complete)

**Completed**: Stage 2 implemented the complete type system and utilities for working with JSONLogic expressions.

**What was implemented**:

1. **types.ts** - Complete TypeScript type definitions:
   - Interfaces for all JSONLogic operators (var, and, or, not, if, comparisons, arithmetic)
   - Union types for operator categories (LogicalExpression, ComparisonExpression, ArithmeticExpression)
   - Block interface for visual editor representation
   - LiteralValue type for primitive values

2. **typeGuards.ts** - Runtime type checking functions:
   - Individual operator guards (isAndExpression, isEqualExpression, etc.)
   - Category guards (isLogicalExpression, isComparisonExpression, isArithmeticExpression)
   - Literal detection (isLiteral)
   - Enables safe type narrowing in parsing logic

3. **helpers.ts** - JSONLogic AST builders and converters:
   - Builder functions: createVarReference, createAndBlock, createOrBlock, createComparisonBlock, createArithmeticBlock, createIfBlock, createLiteralBlock
   - parseExpression: Converts JSONLogic to visual Block structures
   - serializeBlocks: Converts visual Blocks back to JSONLogic
   - Bidirectional conversion maintains JSONLogic compatibility
   - Unique ID generation for visual editor blocks

4. **helpers.test.ts** - Comprehensive test suite:
   - 40 tests covering all operators and edge cases
   - Tests for all builder functions
   - Parser tests for simple and nested expressions
   - Serializer tests for all block types
   - Roundtrip tests ensuring bidirectional conversion works correctly

**Key decisions**:

- Type-safe foundation prevents runtime errors
- Separation of types, guards, and helpers in separate files for clarity
- Builder pattern makes expression construction programmatic and testable
- Bidirectional conversion enables seamless switching between visual and JSON modes
- Comprehensive type guards enable safe type narrowing during parsing
- Strong typing catches errors at compile time rather than runtime

**Testing**:

- All 52 tests passing (40 new tests in helpers.test.ts)
- TypeScript compilation passes with strict mode
- ESLint passes with no new errors (only pre-existing warnings in other files)
- Test coverage includes edge cases and complex nested expressions
- Roundtrip tests verify parse→serialize→parse maintains data integrity
- Code reviewed and approved by code-reviewer agent

**Next**: Stage 3 will implement the Variable Picker with Autocomplete component.

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
