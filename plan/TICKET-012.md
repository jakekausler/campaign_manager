# TICKET-012: Condition System Implementation

## Status

- [ ] Completed
- **Commits**:

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
