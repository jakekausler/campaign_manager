# TICKET-012: Condition System Implementation

## Status

- [ ] Completed
- **Commits**:
  - Stage 1: 4377bae (Database Schema)
  - Stage 2: 765af11 (GraphQL Type Definitions)
  - Stage 3: ac69733 (Condition Evaluation Service)
  - Stage 4: a8c8961 (Condition Service CRUD Operations)
  - Stage 5: 649e679 (GraphQL Resolver)

## Description

Implement the Condition system that binds JSONLogic expressions to entity fields for dynamic computed values (visibility, availability, descriptions, etc.).

## Scope of Work

1. Create Condition CRUD operations
2. Implement condition evaluation
3. Bind conditions to entity fields
4. Create computed field resolver
5. Add condition UI helpers (explain trace)

## Acceptance Criteria

- [ ] Can create conditions with JSONLogic expressions
- [ ] Conditions evaluate correctly with context
- [ ] Computed fields reflect condition results
- [ ] Can attach conditions to any entity field
- [ ] Conditions can be attached to Settlement entities
- [ ] Conditions can be attached to Structure entities
- [ ] Evaluation trace shows why condition passed/failed

## Dependencies

- Requires: TICKET-011

## Estimated Effort

3-4 days

## Technical Notes

### Example Settlement Condition

```json
{
  "entity_type": "Settlement",
  "entity_id": "settlement-123",
  "field": "is_trade_hub",
  "condition": {
    "and": [
      { ">=": [{ "var": "settlement.population" }, 5000] },
      { ">=": [{ "var": "settlement.merchant_count" }, 10] },
      { "in": ["trade_route", { "var": "settlement.tags" }] }
    ]
  }
}
```

### Example Structure Condition

```json
{
  "entity_type": "Structure",
  "entity_id": "structure-456",
  "field": "is_operational",
  "condition": {
    "and": [
      { "==": [{ "var": "structure.construction_status" }, "complete"] },
      { ">": [{ "var": "structure.integrity" }, 50] },
      { ">=": [{ "var": "structure.staff_count" }, { "var": "structure.min_staff" }] }
    ]
  }
}
```

## Implementation Notes

### Stage 1: Database Schema and Prisma Model (Complete)

**Model Design:**

- Created `FieldCondition` model (named to avoid confusion with existing `Condition` model used for Encounter/Event conditions)
- Supports both instance-level (specific entityId) and type-level (entityId = null) conditions
- Uses JSONB for expression storage (efficient, supports future GIN indexing)
- Priority field enables deterministic ordering when multiple conditions apply to same field
- Full audit trail with createdBy/updatedBy relations to User model
- Soft delete pattern with deletedAt
- Optimistic locking with version field

**Indexes:**

- Composite index (entityType, entityId, field) for instance-level lookups
- Composite index (entityType, field) for type-level lookups
- Individual indexes on isActive, deletedAt, createdBy, updatedBy

**Migration Notes:**

- Migration includes recreation of PostGIS spatial index on Location.geom
- This is necessary because Prisma cannot track indexes on Unsupported geometry types
- Without recreation, the index would be dropped, severely degrading spatial query performance

### Stage 3: Condition Evaluation Service (Complete)

**Service Implementation:**

Created `ConditionEvaluationService` in `packages/api/src/graphql/services/condition-evaluation.service.ts` with the following key methods:

- `evaluateExpression<T>(expression, context)` - Core evaluation method that uses ExpressionParserService to evaluate JSONLogic expressions with entity context data. Returns success status, value, and optional error message.

- `evaluateWithTrace(expression, context)` - Enhanced evaluation with detailed trace generation for debugging. Captures each step of the evaluation process including validation, context building, evaluation, and variable resolution.

- `buildContext(entity)` - Formats entity data into evaluation context for JSONLogic variable access. Handles nested objects and preserves structure for dot-notation variable paths.

- `validateExpression(expression)` - Validates expression structure before evaluation. Checks for null/undefined, validates object structure, ensures at least one operator exists, and enforces maximum depth limit (10 levels) to prevent recursion attacks.

- `extractVariables(expression)` - Private helper that extracts all variable paths from a JSONLogic expression using Set for deduplication.

- `resolveVariable(varPath, context)` - Private helper that resolves dot-notation variable paths in the context for trace generation.

**Security Features:**

- Expression depth validation (max 10 levels) prevents infinite recursion attacks
- Safe evaluation via JSONLogic library (no eval or code execution)
- Context validation ensures only valid objects are processed
- Logger excludes sensitive context values (logs keys only, not values)

**Testing:**

- Comprehensive test suite with 38 passing unit tests
- Coverage includes: simple/complex expressions, null/undefined handling, context validation, error handling, trace generation, variable extraction/resolution
- All tests passing, no TypeScript or ESLint errors
- Code reviewed and approved by Code Reviewer subagent

**Integration Points:**

- Depends on ExpressionParserService from TICKET-011 (JSONLogic rules engine)
- Uses GraphQL types from Stage 2 (EvaluationResult, EvaluationTrace)
- Aligns with FieldCondition Prisma model from Stage 1
- Used by ConditionService (Stage 4) for expression validation and evaluation

### Stage 4: Condition Service (CRUD Operations) (Complete)

**Service Implementation:**

Created `ConditionService` in `packages/api/src/graphql/services/condition.service.ts` implementing full CRUD operations for FieldCondition entities with comprehensive authorization, validation, and audit logging.

**Key Methods:**

- `create(input, user)` - Creates new conditions with expression validation via ConditionEvaluationService and entity access verification. Supports both instance-level and type-level conditions.

- `findById(id, user)` - Fetches conditions with silent access control that prevents information disclosure to unauthorized users. Returns null for both missing conditions and access denial.

- `findMany(where, orderBy, skip, take, user?)` - Paginated queries with filtering, sorting, and optional user-based access filtering. Supports date range filters, active status, and inclusion of deleted records.

- `findForEntity(entityType, entityId, field, user)` - Retrieves conditions for specific entities/fields ordered by priority DESC. Supports null field parameter to get all fields.

- `update(id, input, user)` - Updates conditions with optimistic locking (version checking), expression validation if changed, and version increment. Uses Prisma relation syntax for updatedBy field.

- `delete(id, user)` - Soft deletes conditions by setting deletedAt timestamp. All mutations are audited.

- `toggleActive(id, isActive, user)` - Enables/disables conditions without full update. Useful for quick activation control.

- `evaluateCondition(id, context, user)` - Evaluates condition with provided context and returns full trace for debugging.

**Authorization System:**

- Campaign-based access control via entity relationship traversal
- Supports 5 entity types: Settlement (via kingdom→campaign), Structure (via settlement→kingdom→campaign), Kingdom (via campaign), Party (via campaign), Character (via campaign)
- Type-level conditions (entityId=null) accessible to all authenticated users
- Instance-level conditions require campaign membership verification
- Silent failures in findById prevent information leakage
- Case-insensitive entity type handling prevents bypass attacks

**Helper Methods:**

- `verifyEntityAccess(entityType, entityId, user)` - Private method verifying user has access to entity via campaign membership. Uses fail-secure pattern by throwing NotFoundException for both missing entities and access denial.

- `buildOrderBy(orderBy)` - Maps GraphQL sort field enums to Prisma field names. Supports sorting by entityType, field, priority, createdAt, updatedAt with ASC/DESC order.

**Security Features:**

- Expression validation before storage (max 10 levels depth) prevents recursion attacks
- Parameterized queries via Prisma ORM prevent SQL injection
- Optimistic locking with version field prevents race conditions
- Audit logging for all mutations (create, update, delete, toggleActive)
- Soft delete pattern prevents accidental data loss
- Type safety with full TypeScript strict mode

**Testing:**

- Comprehensive unit test suite with 45 passing tests
- Coverage includes:
  - All CRUD operations (create, findById, findMany, findForEntity, update, delete, toggleActive, evaluateCondition)
  - Authorization verification for all 5 entity types (Settlement, Structure, Kingdom, Party, Character)
  - Expression validation (valid/invalid expressions, null handling)
  - Optimistic locking version mismatch scenarios
  - Soft delete and active status toggling
  - Pagination, filtering, and sorting with all sort fields
  - Edge cases (null values, missing entities, access denial, type-level conditions)
  - Private helper methods (verifyEntityAccess, buildOrderBy)
- All tests use proper mocking (PrismaService, AuditService, ConditionEvaluationService)
- Test quality: Clear naming, comprehensive edge case coverage, proper assertions
- All tests passing, no TypeScript or ESLint errors

**Code Quality:**

- Follows NestJS best practices with @Injectable() decorator
- Single Responsibility Principle - each method has focused purpose
- DRY principle with reusable helper methods
- Clear JSDoc documentation on all public methods
- Proper dependency injection (PrismaService, AuditService, ConditionEvaluationService)
- Type-safe implementation with Prisma-generated types
- Appropriate exception types (BadRequestException, NotFoundException, OptimisticLockException)
- Code reviewed and approved by Code Reviewer subagent

**Performance Considerations:**

- Minor N+1 query potential in findMany when filtering by user access with large result sets
- Acceptable for typical use cases with small result sets
- Can be optimized with batch access verification if profiling shows issues

**Integration Points:**

- Depends on ConditionEvaluationService (Stage 3) for expression validation and evaluation
- Uses GraphQL input types from Stage 2 (CreateFieldConditionInput, UpdateFieldConditionInput, FieldConditionWhereInput, etc.)
- Aligns with FieldCondition Prisma model from Stage 1
- Ready for GraphQL resolver integration (Stage 5)

### Stage 5: GraphQL Resolver (Complete)

**Resolver Implementation:**

Created `FieldConditionResolver` in `packages/api/src/graphql/resolvers/field-condition.resolver.ts` implementing complete GraphQL interface for FieldCondition operations.

**Query Resolvers:**

- `getFieldCondition(id)` - Fetch single condition by ID with authorization
- `listFieldConditions(where, orderBy, skip, take)` - Paginated list with filtering and sorting
  - Filter options: entityType, entityId, field, isActive, createdBy, date ranges, includeDeleted
  - Sort options: entityType, field, priority, createdAt, updatedAt (ASC/DESC)
  - Pagination: skip and take parameters for offset-based pagination
- `getConditionsForEntity(entityType, entityId, field?)` - Get all conditions for specific entity/field
- `evaluateFieldCondition(input)` - Evaluate condition with custom context, returns full trace

**Mutation Resolvers (owner/gm roles only):**

- `createFieldCondition(input)` - Create instance-level or type-level conditions
- `updateFieldCondition(id, input)` - Update with optimistic locking via expectedVersion
- `deleteFieldCondition(id)` - Soft delete via deletedAt timestamp
- `toggleFieldConditionActive(id, isActive)` - Quick enable/disable without full update

**Field Resolvers:**

- `createdBy` - Returns user ID (placeholder for future User object resolution)
- `updatedBy` - Returns user ID or null
- `version` - Returns version number for optimistic locking

**Authorization:**

- All operations require JwtAuthGuard (authenticated users only)
- All mutations require RolesGuard with 'owner' or 'gm' role
- Entity-level access verification delegated to ConditionService
- Type-level conditions (entityId=null) accessible to all authenticated users

**Service Changes:**

Made minor updates to ConditionService to support resolver usage:

- Made `findMany` where/orderBy parameters optional (supports querying all conditions)
- Added `undefined` support to `findForEntity` field parameter (GraphQL optional vs null)
- Changes are backward compatible with existing service callers

**Testing:**

- Comprehensive test suite with 28 passing integration tests
- Query tests: 13 tests covering all query resolvers with various parameters
- Mutation tests: 11 tests covering CRUD operations and authorization
- Field resolver tests: 4 tests verifying field resolution
- Tests verify proper delegation to service layer with correct parameters
- Edge cases covered: null handling, empty results, authorization paths
- All tests use proper mocking of ConditionService
- Test quality: Clear naming, comprehensive coverage, proper assertions

**Code Quality:**

- Follows NestJS resolver patterns with proper decorator usage (@Query, @Mutation, @ResolveField)
- Clean separation: resolver is thin layer delegating to ConditionService
- Type-safe implementation with explicit Prisma-to-GraphQL type casting
- Matches existing resolver conventions in the codebase (consistent with world-time.resolver.ts)
- Clear JSDoc documentation on all resolver methods
- All tests passing, type-check passing, lint warnings only (consistent with existing test patterns)

**Security:**

- Proper authorization guards at resolver level
- Entity access verification in service layer prevents unauthorized access
- Input validation via class-validator decorators on input types
- No SQL injection vectors (parameterized Prisma queries)
- Audit logging for all mutations (handled by service layer)

**Code Review:**

- Approved by Code Reviewer subagent with no critical issues
- Minor optimization opportunity noted: N+1 query pattern in findMany (not blocking, can be optimized in future if needed)
- Follows all project conventions and NestJS best practices
- Ready for production use

**Integration Points:**

- Depends on ConditionService (Stage 4) for all CRUD and evaluation logic
- Uses GraphQL types/inputs from Stage 2 (FieldCondition, EvaluationResult, CreateFieldConditionInput, UpdateFieldConditionInput, etc.)
- Uses Prisma FieldCondition model from Stage 1
- Ready for entity computed fields integration in Stage 6 (Settlement/Structure resolvers)
