# TICKET-013: State Variable System

## Status
- [ ] Completed
- **Commits**:

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
      {">": [{"var": "settlement.population"}, 10000]}, "thriving",
      {">": [{"var": "settlement.population"}, 5000]}, "prosperous",
      {">": [{"var": "settlement.population"}, 1000]}, "stable",
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
      {">": [{"var": "structure.integrity"}, 80]}, "excellent",
      {">": [{"var": "structure.integrity"}, 60]}, "good",
      {">": [{"var": "structure.integrity"}, 40]}, "fair",
      {">": [{"var": "structure.integrity"}, 20]}, "poor",
      "critical"
    ]
  }
}
```
