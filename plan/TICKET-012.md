# TICKET-012: Condition System Implementation

## Status

- [ ] Completed
- **Commits**:
  - Stage 1: 4377bae (Database Schema)
  - Stage 2: 765af11 (GraphQL Type Definitions)

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
