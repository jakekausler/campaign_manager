# TICKET-013 Implementation Plan: State Variable System

## Overview

Implement a StateVariable system for storing and querying dynamic campaign state (flags, counters, computed values) with different scopes (world, campaign, party, character, location, settlement, structure, etc.). This system will enable flexible state management and support derived variables computed from expressions.

## Implementation Stages

### Stage 1: Database Schema and Prisma Model

**Goal**: Create StateVariable database schema with support for multiple scopes and versioning

**Tasks**:

- [ ] Design StateVariable Prisma model with fields:
  - `id` (String, CUID primary key)
  - `scope` (String enum: world/campaign/party/kingdom/settlement/structure/character/location/event/encounter)
  - `scopeId` (String, nullable for world-level vars)
  - `key` (String, variable name within scope)
  - `value` (Json, nullable for derived variables)
  - `type` (String enum: string/integer/float/boolean/json/derived)
  - `formula` (Json, nullable, JSONLogic expression for derived variables)
  - `description` (String, nullable)
  - `isActive` (Boolean, default true)
  - `deletedAt` (DateTime, nullable, soft delete)
  - `version` (Int, optimistic locking)
  - `createdAt`/`updatedAt` (DateTime)
  - `createdBy`/`updatedBy` (relations to User)
- [ ] Add composite unique constraint on (scope, scopeId, key, deletedAt)
- [ ] Add indexes:
  - Composite (scope, scopeId, key) for scope-based lookups
  - Individual on isActive, deletedAt for filtering
  - Individual on createdBy, updatedBy for audit queries
- [ ] Create Prisma migration
- [ ] Run migration on development database
- [ ] Verify migration with Prisma Studio
- [ ] Commit Stage 1

**Success Criteria**:

- [ ] Migration applies successfully
- [ ] Schema matches technical requirements
- [ ] Can query variables by scope and key
- [ ] Supports all 10 scope types including settlement and structure

**Tests**:

- Manual verification with Prisma Studio

---

### Stage 2: GraphQL Type Definitions

**Goal**: Define GraphQL types, inputs, and enums for StateVariable operations

**Tasks**:

- [ ] Create enum `VariableScope` (world/campaign/party/kingdom/settlement/structure/character/location/event/encounter)
- [ ] Create enum `VariableType` (string/integer/float/boolean/json/derived)
- [ ] Create type `StateVariable` with all fields
- [ ] Create input `CreateStateVariableInput`:
  - scope, scopeId, key, value (nullable), type, formula (nullable), description (nullable)
- [ ] Create input `UpdateStateVariableInput`:
  - value (nullable), formula (nullable), description (nullable), isActive (nullable), expectedVersion (nullable)
- [ ] Create input `StateVariableWhereInput` for filtering:
  - scope, scopeId, key, isActive, type, createdBy, createdAfter, createdBefore, includeDeleted
- [ ] Create input `EvaluateVariableInput`:
  - id, context (Json, nullable)
- [ ] Create type `VariableEvaluationResult`:
  - variableId, key, scope, scopeId, value (Json), success, error (nullable), trace (nullable)
- [ ] Create enum `StateVariableSortField` (key, scope, type, createdAt, updatedAt)
- [ ] Create input `StateVariableOrderByInput` (field, order ASC/DESC)
- [ ] Add schema documentation for all types
- [ ] Verify type-check passes
- [ ] Commit Stage 2

**Success Criteria**:

- [ ] All GraphQL types compile
- [ ] Types align with Prisma schema
- [ ] Input validation is comprehensive
- [ ] Supports settlement and structure scopes

**Tests**:

- `pnpm run type-check` passes

---

### Stage 3: Variable Evaluation Service

**Goal**: Create service for evaluating derived variables using JSONLogic formulas

**Tasks**:

- [ ] Create `VariableEvaluationService` in `packages/api/src/graphql/services/variable-evaluation.service.ts`
- [ ] Implement `evaluateVariable(variable, context)` method:
  - Return stored value if type is not 'derived'
  - Validate formula exists for derived variables
  - Build evaluation context from provided context
  - Use ExpressionParserService to evaluate formula
  - Return evaluation result with success/error
- [ ] Implement `evaluateWithTrace(variable, context)` method:
  - Same as evaluateVariable but include detailed trace
  - Capture formula validation, context building, evaluation steps
  - Extract and resolve variables used in formula
- [ ] Implement `buildEvaluationContext(scopeType, scopeId, additionalContext)` method:
  - Fetch scope entity data (campaign, party, settlement, structure, etc.)
  - Merge entity data with additionalContext
  - Format for JSONLogic evaluation
- [ ] Implement `validateFormula(formula)` method:
  - Check formula is valid JSONLogic
  - Enforce maximum depth limit (10 levels)
  - Validate operator syntax
- [ ] Add comprehensive error handling
- [ ] Add NestJS Logger for debugging
- [ ] Write unit tests (30+ tests):
  - Simple/complex formula evaluation
  - All variable types (non-derived return stored value)
  - Derived variables with various formulas
  - Context building for all scopes including settlement/structure
  - Formula validation (valid/invalid/depth limit)
  - Error handling (missing formula, invalid formula, evaluation failure)
  - Trace generation
- [ ] Run tests via TypeScript Tester subagent
- [ ] Verify type-check and lint pass
- [ ] Commit Stage 3

**Success Criteria**:

- [ ] Can evaluate derived variables with formulas
- [ ] Non-derived variables return stored values
- [ ] Context building works for all scopes
- [ ] Formula validation prevents attacks
- [ ] Comprehensive test coverage
- [ ] Supports settlement and structure scopes

**Tests**:

- Unit tests (30+ tests covering all scenarios)

---

### Stage 4: State Variable Service (CRUD Operations)

**Goal**: Implement full CRUD operations for StateVariable with authorization and validation

**Tasks**:

- [ ] Create `StateVariableService` in `packages/api/src/graphql/services/state-variable.service.ts`
- [ ] Implement `create(input, user)` method:
  - Validate scope and scopeId combination
  - Verify user has access to scope entity via campaign membership
  - Validate formula if type is 'derived' (use VariableEvaluationService)
  - Validate value is present if type is not 'derived'
  - Create variable with audit logging
- [ ] Implement `findById(id, user)` method:
  - Fetch variable with silent access control
  - Return null for both missing variables and access denial
- [ ] Implement `findMany(where, orderBy, skip, take, user?)` method:
  - Support filtering by scope, scopeId, key, type, isActive, etc.
  - Support pagination with skip/take
  - Support sorting by key, scope, type, createdAt, updatedAt
  - Filter by user access if user provided
- [ ] Implement `findByScope(scope, scopeId, key?, user)` method:
  - Get all variables for a specific scope/scopeId
  - Optionally filter by key
  - Order by key ASC
- [ ] Implement `update(id, input, user)` method:
  - Verify access
  - Validate formula if changed and type is 'derived'
  - Optimistic locking with version check
  - Increment version
  - Audit logging
- [ ] Implement `delete(id, user)` method:
  - Soft delete with deletedAt
  - Verify access
  - Audit logging
- [ ] Implement `toggleActive(id, isActive, user)` method:
  - Enable/disable variable without full update
- [ ] Implement `evaluateVariable(id, context, user)` method:
  - Verify access
  - Delegate to VariableEvaluationService
  - Return full evaluation result with trace
- [ ] Implement private helper `verifyScopeAccess(scope, scopeId, user)`:
  - Verify user has access to scope entity via campaign membership
  - Support all 10 scope types
  - Fail secure: throw NotFoundException for both missing and access denied
- [ ] Implement private helper `buildOrderBy(orderBy)`:
  - Map GraphQL sort fields to Prisma fields
- [ ] Add comprehensive error handling
- [ ] Add NestJS Logger
- [ ] Write unit tests (50+ tests):
  - All CRUD operations (create, findById, findMany, findByScope, update, delete)
  - Authorization for all 10 scope types including settlement/structure
  - Formula validation (valid/invalid formulas)
  - Optimistic locking (version mismatch)
  - Soft delete and active status toggling
  - Pagination, filtering, sorting
  - Edge cases (null values, missing entities, access denial)
  - Variable evaluation
  - Private helper methods
- [ ] Run tests via TypeScript Tester subagent
- [ ] Verify type-check and lint pass
- [ ] Commit Stage 4

**Success Criteria**:

- [ ] Full CRUD operations work correctly
- [ ] Authorization prevents unauthorized access
- [ ] Formula validation works for derived variables
- [ ] Optimistic locking prevents race conditions
- [ ] Comprehensive test coverage
- [ ] Supports all scopes including settlement/structure

**Tests**:

- Unit tests (50+ tests covering all CRUD and authorization scenarios)

---

### Stage 5: GraphQL Resolver

**Goal**: Create GraphQL resolver exposing StateVariable operations

**Tasks**:

- [ ] Create `StateVariableResolver` in `packages/api/src/graphql/resolvers/state-variable.resolver.ts`
- [ ] Implement Query resolvers:
  - `getStateVariable(id)` - Get single variable by ID
  - `listStateVariables(where, orderBy, skip, take)` - Paginated list with filtering/sorting
  - `getVariablesForScope(scope, scopeId, key?)` - Get all variables for specific scope
  - `evaluateStateVariable(input)` - Evaluate variable with custom context
- [ ] Implement Mutation resolvers (owner/gm roles only):
  - `createStateVariable(input)` - Create variable
  - `updateStateVariable(id, input)` - Update with optimistic locking
  - `deleteStateVariable(id)` - Soft delete
  - `toggleStateVariableActive(id, isActive)` - Enable/disable
- [ ] Implement Field resolvers:
  - `createdBy` - Return user ID
  - `updatedBy` - Return user ID or null
  - `version` - Return version number
- [ ] Add authorization guards:
  - JwtAuthGuard on all operations
  - RolesGuard with 'owner' or 'gm' role on mutations
- [ ] Delegate all logic to StateVariableService
- [ ] Write integration tests (30+ tests):
  - Query tests for all resolvers with various parameters
  - Mutation tests for CRUD operations and authorization
  - Field resolver tests
  - Edge cases (null handling, empty results)
- [ ] Run tests via TypeScript Tester subagent
- [ ] Verify type-check and lint pass
- [ ] Run Code Reviewer subagent before commit
- [ ] Address any critical issues from code review
- [ ] Commit Stage 5

**Success Criteria**:

- [ ] All query resolvers work correctly
- [ ] Mutations require proper roles
- [ ] Authorization delegated to service layer
- [ ] Comprehensive test coverage
- [ ] Code review passes

**Tests**:

- Integration tests (30+ tests covering all resolver operations)

---

### Stage 6: Variable Resolution for Conditions

**Goal**: Integrate StateVariable system with Condition evaluation context

**Tasks**:

- [ ] Update `ConditionEvaluationService.buildContext()` method to:
  - Accept optional `includeVariables` boolean parameter (default false)
  - If includeVariables is true, fetch variables for entity scope
  - Merge variable key-value pairs into context
  - Support derived variable evaluation during context building
- [ ] Create helper method `fetchScopeVariables(scope, scopeId)`:
  - Query StateVariable for scope/scopeId
  - Evaluate derived variables
  - Return key-value map
- [ ] Update Settlement/Structure computed field resolution:
  - Pass includeVariables=true when building evaluation context
  - Variables are now accessible in condition expressions via `var.{key}` notation
- [ ] Write integration tests:
  - Condition evaluation with variable references
  - Settlement conditions using settlement variables
  - Structure conditions using structure variables
  - Derived variable usage in conditions
  - Variable changes affecting computed fields
- [ ] Run tests via TypeScript Tester subagent
- [ ] Verify type-check and lint pass
- [ ] Run Code Reviewer subagent before commit
- [ ] Address any critical issues from code review
- [ ] Commit Stage 6

**Success Criteria**:

- [ ] Conditions can reference variables in expressions
- [ ] Variables are properly resolved during evaluation
- [ ] Derived variables work in condition context
- [ ] Settlement/Structure computed fields can use variables
- [ ] Test coverage demonstrates integration

**Tests**:

- Integration tests for condition-variable integration

---

### Stage 7: Variable Change History Integration

**Goal**: Track variable changes in Version history for bitemporal queries

**Tasks**:

- [ ] Update StateVariableService to create Version records on changes:
  - On create: Create Version with action='CREATE'
  - On update: Create Version with action='UPDATE', include diff
  - On delete: Create Version with action='DELETE'
- [ ] Add `validFrom`/`validTo` support for temporal queries:
  - Add optional parameters to `findByScope()`
  - Query variables as of specific world time
  - Respect Version.validFrom/validTo constraints
- [ ] Integrate with Campaign.currentWorldTime:
  - Use currentWorldTime as default validFrom if not specified
  - Support historical variable queries (asOf parameter)
- [ ] Create helper method `getVariableHistory(id)`:
  - Return all Version records for a variable
  - Include diff information showing value changes
- [ ] Write integration tests:
  - Variable versioning on CRUD operations
  - Historical queries (asOf parameter)
  - Variable state at different world times
  - Integration with Campaign.currentWorldTime
- [ ] Run tests via TypeScript Tester subagent
- [ ] Verify type-check and lint pass
- [ ] Run Code Reviewer subagent before commit
- [ ] Address any critical issues from code review
- [ ] Commit Stage 7

**Success Criteria**:

- [ ] Variable changes tracked in Version table
- [ ] Can query variable state at historical times
- [ ] Integrates with world time system
- [ ] Version history includes diffs
- [ ] Test coverage demonstrates bitemporal functionality

**Tests**:

- Integration tests for variable versioning and history

---

## Completion Checklist

Before marking ticket as complete:

- [ ] All 7 stages completed and committed
- [ ] All acceptance criteria met:
  - [ ] Can create variables at different scopes
  - [ ] Variables are queryable by scope and key
  - [ ] Variables can be scoped to specific Settlements
  - [ ] Variables can be scoped to specific Structures
  - [ ] Derived variables compute from other variables
  - [ ] Variable changes tracked in version history
  - [ ] Conditions can reference variables
- [ ] All tests passing (unit + integration)
- [ ] Type-check passing
- [ ] Lint passing
- [ ] Code review completed for all stages
- [ ] Project Manager subagent verification completed
- [ ] Documentation updated:
  - [ ] CLAUDE.md updated with StateVariable system section
  - [ ] README.md updated if needed
  - [ ] TICKET-013.md updated with implementation notes and commit hashes
  - [ ] EPIC.md updated to mark ticket complete

## Technical Dependencies

- **TICKET-006**: Entity CRUD operations (required for scope entity queries)
- **TICKET-011**: JSONLogic Expression Parser (required for derived variable formulas)
- **TICKET-012**: Condition System (integration point for variable resolution)
- **TICKET-007**: Versioning System (required for variable change history)
- **TICKET-010**: World Time System (integration for temporal queries)

## Risk Mitigation

1. **Scope Complexity**: 10 different scope types to support
   - Mitigation: Start with core scopes (world, campaign, party, settlement, structure), add others iteratively
   - Mitigation: Use helper method for scope access verification to centralize logic

2. **Circular Dependencies**: Variables referencing other variables
   - Mitigation: Implement dependency tracking in Stage 4
   - Mitigation: Detect circular references during formula validation
   - Mitigation: Consider deferring dependency graph to TICKET-014

3. **Performance**: Context building may require multiple queries
   - Mitigation: Document N+1 query patterns as future optimization opportunities
   - Mitigation: Consider DataLoader pattern in future iteration

4. **Formula Validation**: Complex expressions may bypass validation
   - Mitigation: Reuse ExpressionParserService validation from TICKET-011
   - Mitigation: Enforce depth limit (10 levels) to prevent recursion attacks

## Notes

- This implementation follows the same pattern as TICKET-012 (Condition System)
- StateVariable and FieldCondition are complementary systems:
  - StateVariable: Stores mutable state values (flags, counters, computed values)
  - FieldCondition: Defines rules for computed entity fields based on expressions
- Variables can be referenced in both FieldCondition expressions and derived variable formulas
- The variable system will be a critical building block for the Rules Engine (TICKET-015)
