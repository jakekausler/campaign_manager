# TICKET-012 Implementation Plan: Condition System

## Overview

Implement a Condition system that binds JSONLogic expressions to entity fields for dynamic computed values. This system will enable entities (Settlement, Structure, and others) to have computed fields whose values are determined by evaluating JSONLogic conditions against entity data.

## Architecture Overview

1. **Condition Entity**: Stores JSONLogic expressions bound to entity fields
2. **Evaluation Service**: Evaluates conditions against entity context using the JSONLogic parser from TICKET-011
3. **GraphQL Layer**: Provides CRUD operations and computed field resolution
4. **Trace System**: Captures evaluation steps for debugging

## Stages

### Stage 1: Database Schema and Prisma Model

**Status**: [x] Complete
**Commit**: 4377bae

**Goal**: Define the Condition model in Prisma schema and create migration

**Tasks**:

- [ ] Add Condition model to schema.prisma with fields:
  - id (cuid)
  - entityType (String) - type of entity this condition applies to
  - entityId (String) - specific entity instance (nullable for type-level conditions)
  - field (String) - the field name this condition computes
  - expression (Json) - the JSONLogic expression
  - description (String, optional) - human-readable explanation
  - isActive (Boolean, default true) - enable/disable conditions
  - priority (Int, default 0) - for ordering when multiple conditions apply
  - timestamps (createdAt, updatedAt)
  - audit fields (createdBy, updatedBy user relations)
  - version tracking fields (versionId relation)
- [ ] Add indexes for efficient querying (entityType+entityId+field, entityType+field)
- [ ] Create and apply Prisma migration
- [ ] Generate Prisma client
- [ ] Run type-check to verify schema

**Success Criteria**:

- Migration applied successfully
- Prisma client generates without errors
- Can query Condition model through Prisma

**Tests**:

- No tests for this stage (schema only)

---

### Stage 2: GraphQL Type Definitions

**Status**: [x] Complete
**Commit**: 765af11

**Goal**: Define GraphQL types, inputs, and operations for Conditions

**Tasks**:

- [ ] Create condition.types.graphql with:
  - Condition type (maps to Prisma model)
  - CreateConditionInput
  - UpdateConditionInput
  - ConditionWhereInput (for filtering)
  - ConditionOrderByInput (for sorting)
  - EvaluationResult type (value, success, trace)
  - EvaluationTrace type (step, input, output, passed)
- [ ] Add condition queries to Query type:
  - getCondition(id: ID!)
  - listConditions(where: ConditionWhereInput, orderBy: ConditionOrderByInput, skip: Int, take: Int)
  - getConditionsForEntity(entityType: String!, entityId: String!, field: String)
  - evaluateCondition(id: ID!, context: JSON!)
- [ ] Add condition mutations to Mutation type:
  - createCondition(input: CreateConditionInput!)
  - updateCondition(id: ID!, input: UpdateConditionInput!)
  - deleteCondition(id: ID!)
  - toggleConditionActive(id: ID!, isActive: Boolean!)
- [ ] Add computed fields to entity types (Settlement, Structure):
  - Add computedFields: JSON field to return evaluated conditions
- [ ] Run type-check to verify GraphQL schema

**Success Criteria**:

- GraphQL schema compiles without errors
- Types are properly exported and available

**Tests**:

- No tests for this stage (types only)

---

### Stage 3: Condition Evaluation Service

**Status**: [ ] Complete

**Goal**: Create service to evaluate JSONLogic conditions with trace generation

**Tasks**:

- [ ] Create ConditionEvaluationService in packages/api/src/graphql/services/
- [ ] Implement evaluateExpression(expression: Json, context: any) method:
  - Use JSONLogicParser from TICKET-011
  - Validate expression structure
  - Execute expression against context
  - Return result with success flag
- [ ] Implement evaluateWithTrace(expression: Json, context: any) method:
  - Wrap JSONLogic evaluation to capture intermediate steps
  - Build trace array showing each operation and result
  - Include variable resolution details
  - Return EvaluationResult with full trace
- [ ] Implement buildContext(entity: any) helper:
  - Extract relevant fields from entity for evaluation
  - Format data for JSONLogic variable access
  - Handle nested objects and relations
- [ ] Implement validateExpression(expression: Json) method:
  - Check expression is valid JSON
  - Verify it follows JSONLogic structure
  - Return validation errors if any
- [ ] Add error handling for:
  - Invalid expressions
  - Missing context variables
  - Evaluation failures
- [ ] Add unit tests for ConditionEvaluationService:
  - Test basic expression evaluation
  - Test complex nested expressions
  - Test trace generation
  - Test context building
  - Test validation
  - Test error scenarios
- [ ] Run tests and verify all pass
- [ ] Run type-check and lint

**Success Criteria**:

- Service can evaluate JSONLogic expressions
- Trace generation captures evaluation steps
- Context building works for entity data
- All unit tests pass

**Tests**:

- Unit tests: ~15-20 test cases covering evaluation, tracing, context building, validation, errors

---

### Stage 4: Condition Service (CRUD Operations)

**Status**: [ ] Complete

**Goal**: Create service for Condition CRUD operations with authorization

**Tasks**:

- [ ] Create ConditionService in packages/api/src/graphql/services/
- [ ] Inject dependencies:
  - PrismaService
  - VersionService (for version tracking)
  - ConditionEvaluationService
  - AuditService
- [ ] Implement create(input, userId, campaignId) method:
  - Validate expression using ConditionEvaluationService
  - Verify entity exists and user has access
  - Create condition with audit fields
  - Create version record
  - Log audit entry
  - Return created condition
- [ ] Implement findById(id, user) method:
  - Fetch condition by ID
  - Verify user has access to related campaign
  - Return condition or throw NotFound
- [ ] Implement findMany(where, orderBy, skip, take, user) method:
  - Build Prisma query with filters
  - Apply campaign-based authorization
  - Return paginated conditions
- [ ] Implement findForEntity(entityType, entityId, field, user) method:
  - Query conditions for specific entity and field
  - Filter by isActive=true
  - Order by priority DESC
  - Verify user access
  - Return matching conditions
- [ ] Implement update(id, input, userId) method:
  - Fetch existing condition
  - Verify user access and permissions
  - If expression changed, validate it
  - Update condition with new values
  - Create new version record
  - Log audit entry
  - Return updated condition
- [ ] Implement delete(id, userId) method:
  - Fetch condition
  - Verify user access and permissions
  - Soft delete by setting isActive=false or hard delete
  - Log audit entry
  - Return success
- [ ] Implement toggleActive(id, isActive, userId) method:
  - Update isActive field
  - Log audit entry
  - Return updated condition
- [ ] Implement evaluateCondition(id, context, user) method:
  - Fetch condition
  - Verify user access
  - Use ConditionEvaluationService.evaluateWithTrace
  - Return evaluation result with trace
- [ ] Add unit tests for ConditionService:
  - Test create with valid/invalid expressions
  - Test findById with authorization
  - Test findMany with filters and pagination
  - Test findForEntity with multiple conditions
  - Test update with expression validation
  - Test delete and toggleActive
  - Test evaluateCondition
  - Test error scenarios (not found, unauthorized, validation)
- [ ] Run tests and verify all pass
- [ ] Run type-check and lint

**Success Criteria**:

- CRUD operations work correctly
- Authorization prevents unauthorized access
- Expression validation prevents invalid conditions
- Version tracking records all changes
- All unit tests pass

**Tests**:

- Unit tests: ~25-30 test cases covering all CRUD operations, authorization, validation, evaluation

---

### Stage 5: GraphQL Resolver

**Status**: [ ] Complete

**Goal**: Create GraphQL resolver for Condition operations

**Tasks**:

- [ ] Create ConditionResolver in packages/api/src/graphql/resolvers/
- [ ] Add JwtAuthGuard to all operations
- [ ] Add RolesGuard with appropriate roles for mutations
- [ ] Implement Query resolvers:
  - getCondition(id: string, user: User) - delegates to ConditionService.findById
  - listConditions(args, user: User) - delegates to ConditionService.findMany
  - getConditionsForEntity(entityType, entityId, field, user: User) - delegates to ConditionService.findForEntity
  - evaluateCondition(id, context, user: User) - delegates to ConditionService.evaluateCondition
- [ ] Implement Mutation resolvers:
  - createCondition(input, user: User) - delegates to ConditionService.create
  - updateCondition(id, input, user: User) - delegates to ConditionService.update
  - deleteCondition(id, user: User) - delegates to ConditionService.delete
  - toggleConditionActive(id, isActive, user: User) - delegates to ConditionService.toggleActive
- [ ] Implement field resolvers for Condition type:
  - createdBy - resolve user relation
  - updatedBy - resolve user relation
  - version - resolve version relation
- [ ] Add integration tests for ConditionResolver:
  - Test all queries with various inputs
  - Test all mutations with valid/invalid data
  - Test authorization (authorized vs unauthorized users)
  - Test error scenarios
- [ ] Run tests and verify all pass
- [ ] Run type-check and lint

**Success Criteria**:

- All GraphQL operations work end-to-end
- Authorization is enforced
- Errors are properly formatted and returned
- All integration tests pass

**Tests**:

- Integration tests: ~20-25 test cases covering all queries, mutations, authorization, errors

---

### Stage 6: Entity Computed Fields Integration

**Status**: [ ] Complete

**Goal**: Add computed field resolution to Settlement and Structure entities

**Tasks**:

- [ ] Update SettlementService:
  - Add method getComputedFields(settlement, user) that:
    - Fetches all active conditions for this settlement
    - Builds context from settlement data
    - Evaluates each condition
    - Returns map of field -> value
- [ ] Update SettlementResolver:
  - Add field resolver computedFields that calls SettlementService.getComputedFields
  - Handle errors gracefully (return empty object on failure)
- [ ] Update StructureService:
  - Add method getComputedFields(structure, user) that:
    - Fetches all active conditions for this structure
    - Builds context from structure data
    - Evaluates each condition
    - Returns map of field -> value
- [ ] Update StructureResolver:
  - Add field resolver computedFields that calls StructureService.getComputedFields
  - Handle errors gracefully
- [ ] Add integration tests for computed fields:
  - Create settlement with conditions
  - Query settlement and verify computedFields
  - Update settlement data and verify computedFields reflect changes
  - Same for structures
  - Test with multiple conditions on same field (priority ordering)
  - Test with inactive conditions (should not evaluate)
- [ ] Run tests and verify all pass
- [ ] Run type-check and lint

**Success Criteria**:

- Settlement and Structure queries return computedFields
- Computed values reflect current entity state
- Multiple conditions are evaluated in priority order
- Inactive conditions are skipped
- All integration tests pass

**Tests**:

- Integration tests: ~15-20 test cases covering computed field resolution for settlements and structures

---

### Stage 7: Documentation and Examples

**Status**: [ ] Complete

**Goal**: Document the Condition system and provide usage examples

**Tasks**:

- [ ] Update CLAUDE.md with Condition System section:
  - Overview of condition system
  - Key components (models, services, resolvers)
  - How to create and evaluate conditions
  - Context building details
  - Trace interpretation
  - Integration points with Settlement and Structure
- [ ] Create example GraphQL queries and mutations in documentation:
  - Creating conditions for settlements
  - Creating conditions for structures
  - Evaluating conditions with test context
  - Querying computed fields
- [ ] Add inline code comments for complex logic
- [ ] Update README.md if needed
- [ ] Commit documentation updates

**Success Criteria**:

- Documentation is comprehensive and clear
- Examples are accurate and helpful
- Future developers can understand and extend the system

**Tests**:

- No tests for this stage (documentation only)

---

## Testing Strategy

### Unit Tests

- ConditionEvaluationService: Expression evaluation, trace generation, context building, validation
- ConditionService: CRUD operations, authorization, expression validation

### Integration Tests

- ConditionResolver: GraphQL operations end-to-end
- Settlement/Structure computed fields: Field resolution with real conditions

### Test Coverage Goals

- Minimum 90% coverage for services
- All GraphQL operations covered
- All error paths tested

## Rollout Plan

1. Complete all stages in order
2. Run full test suite after each stage
3. Commit after each successful stage with detailed messages
4. Update ticket file with progress after each commit
5. Use Code Reviewer before each commit
6. Use Project Manager at the end to verify completion

## Success Metrics

- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Type-check passing
- [ ] Lint passing
- [ ] Documentation complete
- [ ] Code reviewed and approved
- [ ] Project Manager verification complete
