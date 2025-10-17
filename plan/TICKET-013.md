# TICKET-013: State Variable System

## Status

- [ ] Completed (Stage 1/7 complete)
- **Commits**:
  - Stage 1: ec59dfb - Database Schema and Prisma Model

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
