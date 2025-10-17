# TICKET-013: State Variable System

## Status

- [ ] Completed (Stage 4/7 complete)
- **Commits**:
  - Stage 1: ec59dfb - Database Schema and Prisma Model
  - Stage 2: b6d254f - GraphQL Type Definitions
  - Stage 3: 889baaa - Variable Evaluation Service
  - Stage 4: ae28ed6 - State Variable Service (CRUD Operations)

## Description

Implement StateVariable system for storing and querying dynamic campaign state (flags, counters, computed values) with different scopes (world, campaign, party, character, location, etc.).

## Scope of Work

1. Create StateVariable CRUD
2. Implement variable scoping (world/campaign/party/kingdom/settlement/structure/character/location/event/encounter)
3. Add derived variable support
4. Create variable resolver for condition evaluation
5. Track variable dependencies

## Acceptance Criteria

- [ ] Can create variables at different scopes
- [ ] Variables are queryable by scope and key
- [ ] Variables can be scoped to specific Settlements
- [ ] Variables can be scoped to specific Structures
- [ ] Derived variables compute from other variables
- [ ] Variable changes tracked in version history
- [ ] Conditions can reference variables

## Dependencies

- Requires: TICKET-006

## Estimated Effort

2-3 days

## Technical Notes

### Example Settlement Variable - Population Tracking

```json
{
  "scope": "settlement",
  "scope_id": "settlement-123",
  "key": "population",
  "value": 8500,
  "type": "integer",
  "description": "Current population of the settlement"
}
```

### Example Settlement Variable - Prosperity Level

```json
{
  "scope": "settlement",
  "scope_id": "settlement-123",
  "key": "prosperity_level",
  "type": "derived",
  "formula": {
    "if": [
      { ">": [{ "var": "settlement.population" }, 10000] },
      "thriving",
      { ">": [{ "var": "settlement.population" }, 5000] },
      "prosperous",
      { ">": [{ "var": "settlement.population" }, 1000] },
      "stable",
      "struggling"
    ]
  }
}
```

### Example Structure Variable - Upgrade Progress

```json
{
  "scope": "structure",
  "scope_id": "structure-456",
  "key": "upgrade_progress",
  "value": 65,
  "type": "integer",
  "description": "Percentage completion of current upgrade (0-100)"
}
```

### Example Structure Variable - Maintenance Status

```json
{
  "scope": "structure",
  "scope_id": "structure-456",
  "key": "maintenance_status",
  "type": "derived",
  "formula": {
    "if": [
      { ">": [{ "var": "structure.integrity" }, 80] },
      "excellent",
      { ">": [{ "var": "structure.integrity" }, 60] },
      "good",
      { ">": [{ "var": "structure.integrity" }, 40] },
      "fair",
      { ">": [{ "var": "structure.integrity" }, 20] },
      "poor",
      "critical"
    ]
  }
}
```

## Implementation Notes

### Stage 1: Database Schema and Prisma Model (ec59dfb)

**Completed:** 2025-10-17

**Summary:** Created comprehensive StateVariable model with support for derived variables, audit trails, and optimistic locking.

**Key Changes:**

- Renamed fields to semantic names:
  - `name` → `key` (variable name within scope)
  - `entityType` → `scope` (world/campaign/party/kingdom/settlement/structure/character/location/event/encounter)
  - `entityId` → `scopeId` (nullable for world-level variables)
- Added new fields:
  - `formula` (Json, nullable) - JSONLogic expressions for derived variables
  - `description` (String, nullable) - Human-readable explanation
  - `isActive` (Boolean) - Enable/disable flag
  - `version` (Int) - Optimistic locking version
  - `createdBy/updatedBy` (String) - Audit trail with User foreign keys
- Implemented database constraints:
  - CHECK constraint for type validation (string/integer/float/boolean/json/derived)
  - CHECK constraint enforcing derived variables have formulas, non-derived have values
  - Foreign key constraints with appropriate ON DELETE behavior
- Optimized indexes:
  - Composite index on (scope, scopeId, key) for exact lookups
  - Partial index on (scope, scopeId, isActive) WHERE deletedAt IS NULL for common queries
  - Partial index on updatedBy WHERE updatedBy IS NOT NULL for sparse column efficiency
  - Individual indexes on isActive, createdBy for filtering
- Enhanced soft delete pattern:
  - Unique constraint includes deletedAt to allow key reuse after deletion
  - NULL deletedAt values treated as distinct

**Migration Safety:**

- Populates createdBy for existing rows before adding NOT NULL constraint
- Maintains backward compatibility with existing polymorphic relations
- All foreign keys properly configured

**Code Review:** Approved by code-reviewer subagent after addressing all critical issues.

**Files Modified:**

- `packages/api/prisma/schema.prisma` - Updated StateVariable model and User relations
- `packages/api/prisma/migrations/20251017140736_update_state_variable_model/migration.sql` - Comprehensive migration with constraints and optimized indexes

---

### Stage 2: GraphQL Type Definitions (b6d254f)

**Completed:** 2025-10-17

**Summary:** Created comprehensive GraphQL type definitions and input types for StateVariable operations with support for derived variables.

**Key Changes:**

- Type Definitions:
  - `VariableScope` enum with 10 scope types (world, campaign, party, kingdom, settlement, structure, character, location, event, encounter)
  - `VariableType` enum with 6 data types (string, integer, float, boolean, json, derived)
  - `StateVariable` type with all fields including formula support for derived variables
  - `VariableEvaluationResult` type with detailed trace information for debugging
  - `EvaluationStep` type for step-by-step evaluation trace
- Input Types:
  - `CreateStateVariableInput` with conditional validation (derived requires formula, non-derived requires value)
  - `UpdateStateVariableInput` with optimistic locking via expectedVersion
  - `StateVariableWhereInput` with comprehensive filtering (scope, type, active, dates)
  - `StateVariableSortField` enum and `StateVariableOrderByInput` for flexible sorting
  - `EvaluateVariableInput` for variable evaluation with custom context
- Validation:
  - Used `ValidateIf` decorators for conditional requirements based on variable type
  - Comprehensive class-validator decorators on all inputs
  - Enum registration with descriptive GraphQL documentation
- Alignment:
  - All fields match Prisma schema from Stage 1
  - Consistent with FieldCondition implementation patterns
  - Follows project conventions for type definitions

**Code Review Notes:**

- Approved by code-reviewer subagent with suggestions for Stage 3
- Campaign scope authorization to be handled in service layer (no direct Prisma relation)
- Formula depth validation (max 10 levels) to be implemented in service layer
- Value type validation to be implemented in service layer

**Files Created:**

- `packages/api/src/graphql/types/state-variable.type.ts` - GraphQL type definitions
- `packages/api/src/graphql/inputs/state-variable.input.ts` - Input type definitions

---

### Stage 3: Variable Evaluation Service (889baaa)

**Completed:** 2025-10-17

**Summary:** Implemented comprehensive evaluation service for StateVariable values, especially derived variables with JSONLogic formulas.

**Key Features:**

- Core Functionality:
  - `evaluateVariable()` - Evaluates stored values (non-derived) or formulas (derived)
  - `evaluateWithTrace()` - Provides detailed debugging trace of evaluation steps
  - `buildEvaluationContext()` - Fetches scope entity data for formula evaluation
  - `validateFormula()` - Enforces JSONLogic structure and max depth limits
- Scope Support:
  - Supports all 9 entity types: World, Campaign, Party, Kingdom, Settlement, Structure, Character, Location, Event, Encounter
  - Context building automatically fetches appropriate entity for scope
  - Merges scope entity data with additional context
- Security Features:
  - Formula depth validation (max 10 levels) prevents recursion attacks
  - Safe evaluation via ExpressionParserService (no code execution)
  - Input validation for derived variables
  - Proper error handling without exposing sensitive data
- Integration:
  - Follows pattern from ConditionEvaluationService
  - Uses ExpressionParserService for JSONLogic evaluation
  - Integrates with Prisma for scope entity fetching

**Implementation Details:**

- Non-derived variables return stored value directly without evaluation
- Derived variables require formula field and evaluate using JSONLogic
- Context building fetches scope entity and merges with additional context
- Formula validation recursively checks structure and enforces depth limit
- Variable extraction and resolution for trace debugging
- Graceful error handling with proper logging

**Testing:**

- 35 comprehensive unit tests covering all scenarios
- evaluateVariable method (6 tests)
- evaluateWithTrace method (4 tests)
- buildEvaluationContext for all 9 scopes (14 tests)
- validateFormula method (11 tests)
- All edge cases and error paths covered
- Zero TypeScript or linting errors

**Code Review:**

- Approved by code-reviewer subagent with no critical issues
- Excellent test coverage and documentation
- Security-conscious implementation
- Performance-aware with efficient short-circuits
- Consistent with existing codebase patterns

**Files Created:**

- `packages/api/src/graphql/services/variable-evaluation.service.ts` - Implementation (500 lines)
- `packages/api/src/graphql/services/variable-evaluation.service.test.ts` - Tests (677 lines, 35 tests)

---

### Stage 4: State Variable Service (CRUD Operations) (ae28ed6)

**Completed:** 2025-10-17

**Summary:** Implemented comprehensive StateVariable service for managing dynamic campaign state with support for 10 scope types and derived variables.

**Core Features:**

- Full CRUD operations (create, read, update, delete) with authorization
- Support for 10 scope types: world, campaign, party, kingdom, settlement, structure, character, location, event, encounter
- Derived variable support with JSONLogic formula validation
- Optimistic locking with version checking to prevent race conditions
- Soft delete pattern with deletedAt timestamps
- Silent access denial in findById to prevent information disclosure
- Comprehensive audit logging for all mutations

**Key Methods:**

- `create()` - Creates variables with formula validation and scope access verification
- `findById()` - Fetches variable with silent access control
- `findMany()` - Paginated queries with filtering, sorting, and access filtering
- `findByScope()` - Retrieves variables for specific scope/scopeId
- `update()` - Updates with optimistic locking and formula validation
- `delete()` - Soft delete with audit logging
- `toggleActive()` - Quick enable/disable without full update
- `evaluateVariable()` - Evaluates variable with trace support
- `verifyScopeAccess()` - Private helper for all 10 scope types
- `buildOrderBy()` - Maps GraphQL sort fields to Prisma fields

**Authorization:**

- Campaign-based access control via entity relationship traversal
- Verifies user access to scope entities before operations
- World-level variables accessible to all authenticated users
- Instance-level variables require campaign membership
- Silent access denial prevents information disclosure

**Security Features:**

- Formula depth validation (max 10 levels) prevents recursion attacks
- Parameterized queries via Prisma ORM prevent SQL injection
- Silent access denial prevents information disclosure
- Comprehensive audit trail for compliance

**Performance Considerations:**

- Known N+1 query pattern in findMany when filtering by user access
- Acceptable for typical use cases with small result sets
- Documented for future optimization with batch access verification

**Testing:**

- 37 comprehensive unit tests covering all scenarios
- Authorization tests for all 10 scope types
- Edge cases: null handling, deleted entities, version conflicts
- Formula validation, pagination, filtering, sorting tests
- All tests passing with zero TypeScript or linting errors

**Code Review:**

- Approved by code-reviewer subagent with no critical issues
- Minor suggestions for future optimization include batch access verification and enhanced type safety for JSON value handling
- Security, authorization, and audit logging all properly implemented
- Follows project conventions and patterns from FieldConditionService

**Files Created:**

- `packages/api/src/graphql/services/state-variable.service.ts` - Main CRUD service (658 lines)
- `packages/api/src/graphql/services/state-variable.service.test.ts` - Comprehensive unit tests (1,014 lines, 37 tests)
