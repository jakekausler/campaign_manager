# Condition System

The Condition System (TICKET-012) provides dynamic computed fields for entities using JSONLogic expressions. It enables game masters to define rules that compute field values based on entity state, creating dynamic properties like "is_trade_hub" for settlements or "is_operational" for structures.

## Overview

- Bind JSONLogic expressions to entity fields for dynamic computed values
- Support both instance-level (specific entity) and type-level (all entities of type) conditions
- Priority-based evaluation when multiple conditions apply to same field
- Full evaluation trace for debugging condition logic
- Integration with Settlement and Structure entities (extensible to other entities)
- Expression validation to prevent malicious or deeply nested expressions

## Key Components

### FieldCondition Model

Database model defined in `packages/api/prisma/schema.prisma`

**Fields:**

- `id` - Unique identifier (CUID)
- `entityType` - Entity type this condition applies to (Settlement, Structure, Kingdom, Party, Character)
- `entityId` - Specific entity instance ID (null for type-level conditions)
- `field` - Field name this condition computes
- `expression` - JSONLogic expression (JSONB)
- `description` - Human-readable explanation (optional)
- `isActive` - Enable/disable condition without deletion
- `priority` - Evaluation order when multiple conditions apply (higher = higher priority)
- `version` - Optimistic locking version number
- `deletedAt` - Soft delete timestamp
- Audit fields: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

**Indexes:**

- Composite: (entityType, entityId, field) for instance-level lookups
- Composite: (entityType, field) for type-level lookups
- Individual: isActive, deletedAt, createdBy, updatedBy

### ConditionEvaluationService

Located at `packages/api/src/graphql/services/condition-evaluation.service.ts`

**Methods:**

- `evaluateExpression<T>(expression, context)` - Core evaluation using JSONLogic parser. Returns success status, value, and optional error.
- `evaluateWithTrace(expression, context)` - Enhanced evaluation with detailed trace for debugging. Captures validation, context building, evaluation steps, and variable resolution.
- `buildContext(entity)` - Formats entity data into evaluation context for JSONLogic variable access. Handles nested objects.
- `validateExpression(expression)` - Validates expression structure before evaluation. Checks for null/undefined, validates object structure, enforces maximum depth limit (10 levels).

**Security Features:**

- Expression depth validation (max 10 levels) prevents infinite recursion attacks
- Safe evaluation via JSONLogic library (no eval or code execution)
- Context validation ensures only valid objects are processed
- Logger excludes sensitive context values (logs keys only)

**Testing:**

- 38 passing unit tests covering all scenarios
- Coverage includes simple/complex expressions, null handling, validation, error handling, trace generation

### ConditionService

Located at `packages/api/src/graphql/services/condition.service.ts`

**Methods:**

- `create(input, user)` - Creates conditions with expression validation and entity access verification
- `findById(id, user)` - Fetches condition with silent access control (prevents information disclosure)
- `findMany(where, orderBy, skip, take, user?)` - Paginated queries with filtering and sorting
- `findForEntity(entityType, entityId, field, user)` - Retrieves conditions for specific entities/fields ordered by priority
- `update(id, input, user)` - Updates with optimistic locking (version checking) and expression validation
- `delete(id, user)` - Soft deletes by setting deletedAt timestamp
- `toggleActive(id, isActive, user)` - Quick enable/disable without full update
- `evaluateCondition(id, context, user)` - Evaluates condition with provided context and returns full trace

**Authorization System:**

- Campaign-based access control via entity relationship traversal
- Supports 5 entity types: Settlement, Structure, Kingdom, Party, Character
- Type-level conditions (entityId=null) accessible to all authenticated users
- Instance-level conditions require campaign membership verification
- Silent failures in findById prevent information leakage
- Case-insensitive entity type handling prevents bypass attacks

**Security Features:**

- Expression validation before storage prevents recursion attacks
- Parameterized queries via Prisma ORM prevent SQL injection
- Optimistic locking with version field prevents race conditions
- Audit logging for all mutations
- Soft delete pattern prevents accidental data loss

**Testing:**

- 45 passing unit tests covering all CRUD operations
- Coverage includes authorization for all entity types, expression validation, optimistic locking, pagination, filtering, sorting

### FieldConditionResolver

Located at `packages/api/src/graphql/resolvers/field-condition.resolver.ts`

**Query Resolvers:**

- `getFieldCondition(id)` - Fetch single condition by ID with authorization
- `listFieldConditions(where, orderBy, skip, take)` - Paginated list with filtering and sorting
- `getConditionsForEntity(entityType, entityId, field?)` - Get all conditions for specific entity/field
- `evaluateFieldCondition(input)` - Evaluate condition with custom context, returns full trace

**Mutation Resolvers (owner/gm roles only):**

- `createFieldCondition(input)` - Create instance-level or type-level conditions
- `updateFieldCondition(id, input)` - Update with optimistic locking via expectedVersion
- `deleteFieldCondition(id)` - Soft delete via deletedAt timestamp
- `toggleFieldConditionActive(id, isActive)` - Quick enable/disable

**Authorization:**

- All operations require JwtAuthGuard (authenticated users only)
- All mutations require RolesGuard with 'owner' or 'gm' role
- Entity-level access verification delegated to ConditionService

**Testing:**

- 28 passing integration tests covering all resolvers
- Tests verify proper delegation to service layer
- Edge cases covered: null handling, empty results, authorization paths

### Entity Computed Fields Integration

**SettlementService** and **StructureService** (packages/api/src/graphql/services/)

**Methods:**

- `getComputedFields(entity, user)` - Fetches active conditions for the entity, builds evaluation context, evaluates each condition, returns map of field names to computed values

**Features:**

- Priority-based evaluation: Higher priority wins when multiple conditions apply to same field
- Graceful error handling: Returns empty object on failure, logs errors with NestJS Logger
- Type-safe implementation with proper Prisma types
- Authorization: Assumes caller has already verified campaign access

**Resolver Integration:**

- `SettlementResolver.computedFields` - Field resolver that calls service method
- `StructureResolver.computedFields` - Field resolver for structures

**Known Limitations:**

1. **N+1 Query Problem**: Current implementation queries conditions individually for each entity. Should be optimized with DataLoader pattern.
2. **Sequential Evaluation**: Conditions evaluated sequentially. Could be parallelized with Promise.all.
3. **No Type-Level Conditions**: Only supports instance-level conditions. Does not query type-level conditions (entityId: null).

## GraphQL API Examples

### Create Instance-Level Condition

```graphql
mutation CreateSettlementCondition {
  createFieldCondition(
    input: {
      entityType: "Settlement"
      entityId: "settlement-123"
      field: "is_trade_hub"
      expression: {
        and: [
          { ">=": [{ var: "population" }, 5000] }
          { ">=": [{ var: "merchant_count" }, 10] }
          { in: ["trade_route", { var: "tags" }] }
        ]
      }
      description: "Settlement qualifies as trade hub with sufficient population, merchants, and trade route access"
      priority: 100
    }
  ) {
    id
    entityType
    entityId
    field
    expression
    isActive
    priority
    createdAt
  }
}
```

### Create Type-Level Condition

```graphql
mutation CreateStructureTypeCondition {
  createFieldCondition(
    input: {
      entityType: "Structure"
      entityId: null  # Applies to all structures
      field: "requires_maintenance"
      expression: {
        ">": [{ var: "age_in_years" }, 10]
      }
      description: "All structures older than 10 years require maintenance"
      priority: 50
    }
  ) {
    id
    entityType
    field
    expression
  }
}
```

### List Conditions for Entity

```graphql
query GetSettlementConditions {
  getConditionsForEntity(
    entityType: "Settlement"
    entityId: "settlement-123"
    field: "is_trade_hub" # Optional - omit to get all fields
  ) {
    id
    field
    expression
    priority
    isActive
  }
}
```

### Query with Pagination and Filtering

```graphql
query ListActiveConditions {
  listFieldConditions(
    where: { entityType: "Settlement", isActive: true }
    orderBy: { field: PRIORITY, order: DESC }
    skip: 0
    take: 10
  ) {
    id
    entityType
    entityId
    field
    priority
    description
  }
}
```

### Evaluate Condition with Custom Context

```graphql
mutation TestCondition {
  evaluateFieldCondition(
    input: {
      id: "condition-123"
      context: { population: 6000, merchant_count: 15, tags: ["trade_route", "coastal"] }
    }
  ) {
    success
    value
    error
    trace {
      step
      description
      input
      output
      passed
    }
  }
}
```

### Query Computed Fields on Settlement

```graphql
query GetSettlement {
  getSettlement(id: "settlement-123") {
    id
    name
    population
    computedFields # Returns JSON object with evaluated conditions
  }
}
```

Example `computedFields` response:

```json
{
  "is_trade_hub": true,
  "danger_level": "medium",
  "prosperity_rating": 85
}
```

### Update Condition

```graphql
mutation UpdateCondition {
  updateFieldCondition(
    id: "condition-123"
    input: {
      expression: {
        ">=": [{ var: "population" }, 10000]
      }
      description: "Updated threshold for trade hub status"
      expectedVersion: 1  # Optimistic locking
    }
  ) {
    id
    expression
    version
  }
}
```

### Toggle Condition Active Status

```graphql
mutation DisableCondition {
  toggleFieldConditionActive(id: "condition-123", isActive: false) {
    id
    isActive
  }
}
```

## Context Building

When evaluating conditions, the ConditionEvaluationService builds a context object from entity data that variables in JSONLogic expressions can reference.

**Settlement Context Example:**

```javascript
{
  "id": "settlement-123",
  "name": "Rivertown",
  "population": 6000,
  "merchant_count": 15,
  "tags": ["trade_route", "coastal"],
  "kingdom": {
    "id": "kingdom-456",
    "name": "Northern Realm"
  }
}
```

**JSONLogic Expression:**

```json
{
  "and": [{ ">=": [{ "var": "population" }, 5000] }, { "in": ["trade_route", { "var": "tags" }] }]
}
```

**Variable Resolution:**

- `{ "var": "population" }` → `6000`
- `{ "var": "tags" }` → `["trade_route", "coastal"]`
- `{ "var": "kingdom.name" }` → `"Northern Realm"` (nested access)

## Evaluation Trace

The evaluation trace provides step-by-step debugging information:

```json
{
  "success": true,
  "value": true,
  "trace": [
    {
      "step": 1,
      "description": "Validation",
      "input": { "and": [...] },
      "output": { "valid": true },
      "passed": true
    },
    {
      "step": 2,
      "description": "Context Building",
      "input": { "population": 6000, "tags": [...] },
      "output": { "variableCount": 2 },
      "passed": true
    },
    {
      "step": 3,
      "description": "Expression Evaluation",
      "input": { "and": [...] },
      "output": true,
      "passed": true
    },
    {
      "step": 4,
      "description": "Variable Resolution",
      "input": null,
      "output": {
        "population": 6000,
        "tags": ["trade_route", "coastal"]
      },
      "passed": true
    }
  ]
}
```

## Common Use Cases

1. **Dynamic Availability**: Determine if a structure is operational based on integrity, staffing, and construction status
2. **Conditional Visibility**: Show/hide entities based on discovery conditions or player permissions
3. **Computed Properties**: Calculate derived values like "prosperity_rating" from multiple entity attributes
4. **Event Triggers**: Define conditions for when events should become available or execute
5. **Validation Rules**: Enforce business logic like "settlements need 100 population to build a market"
6. **Status Indicators**: Compute status badges like "endangered", "thriving", "abandoned" based on entity state

## Integration Points

1. **JSONLogic Parser** (TICKET-011): ConditionEvaluationService depends on ExpressionParserService for expression evaluation
2. **Settlement/Structure Services**: Integrated computed field resolution via `getComputedFields()` method
3. **Versioning System**: Uses Version model for audit trail of condition changes
4. **Audit System**: All condition mutations logged via AuditService
5. **Authorization System**: Campaign-based access control via entity relationship traversal

## Validation Rules

- Expression must be valid JSONLogic object (not null, not primitive)
- Maximum depth of 10 levels to prevent recursion attacks
- Entity must exist and user must have access via campaign membership
- Mutations require 'owner' or 'gm' role
- Type-level conditions (entityId=null) accessible to all authenticated users
- Instance-level conditions require campaign access verification

## Performance Considerations

**Current Limitations:**

1. **N+1 Query Pattern**: When querying multiple entities with computed fields, conditions are fetched individually for each entity. Future optimization: Implement DataLoader pattern for batch loading.

2. **Sequential Evaluation**: Conditions are evaluated sequentially in a loop. Future optimization: Parallelize with Promise.all for better performance.

3. **No Type-Level Condition Support**: Currently only queries instance-level conditions (entityId specific). Future enhancement: Query and merge type-level conditions (entityId=null) that apply to all entities of that type.

**Acceptable Trade-offs:**

- Minor N+1 query issue acceptable for typical use cases with small result sets
- Can be optimized with batch access verification if profiling shows issues
- Current implementation prioritizes simplicity and correctness over premature optimization

## Future Enhancements

- Implement DataLoader pattern for batch condition loading (resolves N+1 query problem)
- Parallelize condition evaluation with Promise.all
- Support type-level conditions (entityId: null) in computed field resolution
- Condition versioning with time-travel queries (query conditions as they existed at specific world time)
- Condition templates for common patterns (e.g., "requires minimum population", "has sufficient resources")
- Visual condition builder UI for non-technical game masters
- Condition impact analysis (show which entities would be affected by a condition change)

## Testing

**Unit Tests:**

- ConditionEvaluationService: 38 tests covering evaluation, tracing, validation, context building
- ConditionService: 45 tests covering all CRUD operations, authorization, pagination, validation

**Integration Tests:**

- FieldConditionResolver: 28 tests covering all GraphQL operations
- Settlement/Structure computed fields: Type-check and lint passing (integration tests deferred due to circular dependency issues in test infrastructure)

**Test Coverage:**

- All error paths tested
- Authorization verification for all entity types
- Optimistic locking scenarios
- Expression validation (valid/invalid expressions)
- Soft delete and active status toggling
- Pagination, filtering, sorting with all sort fields

## Implementation Details

**Migration:** `add_field_condition_model` (Stage 1)

**Commits:**

- Stage 1: 4377bae (Database Schema and Prisma Model)
- Stage 2: 765af11 (GraphQL Type Definitions)
- Stage 3: ac69733 (Condition Evaluation Service)
- Stage 4: a8c8961 (Condition Service CRUD Operations)
- Stage 5: 649e679 (GraphQL Resolver)
- Stage 6: 039ddd6 (Entity Computed Fields Integration)

**Files:**

- Model: `packages/api/prisma/schema.prisma` (FieldCondition model)
- Types: `packages/api/src/graphql/types/` (GraphQL type definitions)
- Services: `packages/api/src/graphql/services/condition-evaluation.service.ts`, `condition.service.ts`
- Resolver: `packages/api/src/graphql/resolvers/field-condition.resolver.ts`
- Tests: Colocated `.test.ts` files for all services and resolvers

## Running Migrations

```bash
# Development: Create and apply migration
pnpm --filter @campaign/api exec prisma migrate dev --name description

# Production: Apply pending migrations
pnpm --filter @campaign/api exec prisma migrate deploy

# Check migration status
pnpm --filter @campaign/api exec prisma migrate status

# Reset database (dev only - destructive!)
pnpm --filter @campaign/api exec prisma migrate reset
```

## Creating Migrations

```bash
# 1. Update schema.prisma file
# 2. Generate migration
pnpm --filter @campaign/api exec prisma migrate dev --name descriptive_name

# Create migration without applying (for review)
pnpm --filter @campaign/api exec prisma migrate dev --create-only

# Always commit both schema.prisma and migration files
```

## Common Migration Issues

**If you encounter any migration errors, delegate to the Prisma Database Debugger subagent immediately.**

Common scenarios:

- Migration conflicts
- Schema validation errors
- Database connection issues
- Failed migrations that need resolution
- Type generation issues after migration
