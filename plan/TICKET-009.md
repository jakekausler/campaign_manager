# TICKET-009: Party & Kingdom Management

## Status

- [ ] Completed
- **Commits**:
  - Stage 2 (Party Management): `4d12e2d`
  - Stage 3 (Kingdom Management): `60a04af`
  - Stage 4 (Settlement & Structure Management): `803a4cd`

## Description

Implement Party and Kingdom management systems with level tracking, typed custom variables, and integration with the conditional availability system. Kingdoms contain Settlements which contain Structures, each with their own levels and state.

## Scope of Work

1. Create Party management:
   - Party CRUD operations (support multiple parties per campaign)
   - Average level calculation (mean) and manual override
   - Party-specific typed state variables
   - Party member association with Characters
2. Create Kingdom management:
   - Kingdom CRUD operations
   - Kingdom level tracking
   - Kingdom-specific typed state variables
   - Territory/region association
3. Create Settlement management:
   - Settlement CRUD operations
   - Settlement-Kingdom association (many settlements per kingdom)
   - Settlement level tracking
   - Settlement-specific typed state variables
   - Settlement-Location association (settlements exist at locations)
4. Create Structure management:
   - Structure CRUD operations
   - Structure-Settlement association (many structures per settlement)
   - Structure level tracking
   - Structure-specific typed state variables
   - Structure type definitions (e.g., temple, barracks, market, etc.)
5. Implement typed variable schema system:
   - Define variable type definitions (string, number, boolean, enum, etc.)
   - Variable schema validation
   - Type-safe variable setting/getting
6. Implement level change events:
   - Track level history for parties, kingdoms, settlements, structures
   - Trigger rules engine recalculation on level changes
   - Emit events for UI updates
7. Create GraphQL API:
   - Queries: `party(id)`, `kingdom(id)`, `settlement(id)`, `structure(id)`
   - Mutations: `setPartyLevel`, `setKingdomLevel`, `setSettlementLevel`, `setStructureLevel`
   - Mutations: `setPartyVariable`, `setKingdomVariable`, `setSettlementVariable`, `setStructureVariable`
   - Queries: `parties(campaignId)`, `kingdoms(campaignId)`, `settlements(kingdomId)`, `structures(settlementId)`
8. Add validation:
   - Level ranges (custom for characters/parties/kingdoms/settlements/structures)
   - Variable type validation against schemas
9. Integrate with context system:
   - Include party/kingdom/settlement/structure state in compute context
   - Support multiple parties per campaign

## Acceptance Criteria

- [ ] Can create and manage multiple parties per campaign
- [ ] Can set party average level (computed via mean or manual override)
- [ ] Can create and manage kingdoms
- [ ] Can create and manage settlements within kingdoms
- [ ] Can create and manage structures within settlements
- [ ] Can set levels for kingdoms, settlements, and structures
- [ ] Can define typed variable schemas (string, number, boolean, enum)
- [ ] Can set typed variables on parties/kingdoms/settlements/structures
- [ ] Variable type validation works correctly
- [ ] Level changes trigger rules engine updates for all entity types
- [ ] Party members (characters) are associated correctly
- [ ] Kingdom territories (regions) are associated
- [ ] Settlements are associated with locations
- [ ] Structures are associated with settlements
- [ ] GraphQL API exposes all CRUD operations for parties, kingdoms, settlements, structures
- [ ] Variable changes are versioned
- [ ] Can query all settlements in a kingdom
- [ ] Can query all structures in a settlement

## Technical Notes

```typescript
interface VariableSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  enumValues?: string[]; // for enum type
  defaultValue?: unknown;
  description?: string;
}

interface PartyState {
  id: string;
  campaignId: string;
  averageLevel: number;
  manualLevelOverride?: number;
  variableSchemas: VariableSchema[];
  variables: Record<string, unknown>; // validated against schemas
  members: Character[];
}

interface KingdomState {
  id: string;
  campaignId: string;
  level: number;
  variableSchemas: VariableSchema[];
  variables: Record<string, unknown>; // validated against schemas
  territories: Location[];
  settlements: Settlement[];
}

interface SettlementState {
  id: string;
  kingdomId: string;
  kingdom: Kingdom;
  locationId: string;
  location: Location;
  level: number;
  variableSchemas: VariableSchema[];
  variables: Record<string, unknown>; // validated against schemas
  structures: Structure[];
}

interface StructureState {
  id: string;
  settlementId: string;
  settlement: Settlement;
  type: string; // e.g., 'temple', 'barracks', 'market', 'library'
  level: number;
  variableSchemas: VariableSchema[];
  variables: Record<string, unknown>; // validated against schemas
}

@Mutation(() => PartyLevelResult)
async setPartyLevel(
  @Args('campaignId') campaignId: string,
  @Args('level') level: number,
  @CurrentUser() user: User,
): Promise<PartyLevelResult> {
  const party = await this.partyService.setLevel(campaignId, level);

  // Trigger rules engine recalculation
  await this.rulesEngine.invalidate({
    campaignId,
    changeType: 'party_level',
    affectedVariables: ['party.average_level'],
  });

  return { party, recomputedEntities: [...] };
}
```

## Dependencies

- Requires: TICKET-006 (Entity CRUD)

## Testing Requirements

- [ ] Can create multiple parties in a campaign
- [ ] Set party level updates successfully (manual override and mean calculation)
- [ ] Set kingdom/settlement/structure levels successfully
- [ ] Level changes trigger invalidations for all entity types
- [ ] Can define variable schemas with different types
- [ ] Variables are stored and retrieved correctly with type validation
- [ ] Invalid variable values are rejected based on schema
- [ ] Party member associations work
- [ ] Kingdom-settlement associations work
- [ ] Settlement-structure associations work
- [ ] Settlement-location associations work
- [ ] Can query all settlements in a kingdom
- [ ] Can query all structures in a settlement

## Related Tickets

- Requires: TICKET-006
- Blocks: TICKET-013, TICKET-015

## Estimated Effort

4-5 days (expanded scope with Settlements, Structures, and typed variable schemas)

## Implementation Notes

### Stage 2: Party Management (Completed)

Enhanced PartyService with the following new methods:

- **calculateAverageLevel()**: Calculates mean level from party members, returns null for empty parties
- **setLevel()**: Sets manual level override with event emission for real-time UI updates
- **addMember()**: Adds characters to party with campaign boundary validation
- **removeMember()**: Removes characters from party with existence validation

All methods include:

- Proper authorization checks via `hasEditPermission()`
- Audit logging for compliance
- Comprehensive unit tests (25 total tests passing)

Variable operations (defineSchema, setVariable, getVariable) deferred to Stage 5 for centralized implementation via VariableSchemaService.

### Stage 3: Kingdom Management (Completed - Commit 60a04af)

Enhanced KingdomService with comprehensive management capabilities:

- **setLevel()**: Sets kingdom level with audit logging and real-time event publishing
- **CRUD operations**: Full create, read, update, delete with soft delete
- **Cascade delete**: Deletes cascade to settlements and structures (maintains referential integrity)
- **Archive/Restore**: Archive doesn't cascade (allows temporary hiding without deletion)
- **Optimistic locking**: Update operations include version checking for concurrent edit detection
- **Time-travel queries**: `getKingdomAsOf()` retrieves historical state from version snapshots
- **Event publishing**: Level changes publish `entity.modified` events via Redis PubSub

All methods include:

- Authorization checks via `hasEditPermission()` (owner or GM role)
- Audit logging on all state-changing operations
- Comprehensive unit tests (21 tests, all passing)
- Proper error handling with appropriate exception types
- Batch operations for cascade delete to avoid N+1 queries

Variable operations (defineSchema, setVariable, getVariable) deferred to Stage 5 for centralized implementation via VariableSchemaService.

Territory management (addTerritory, removeTerritory) deferred as not currently in requirements.

### Stage 4: Settlement & Structure Management (Completed - Commit 803a4cd)

Enhanced SettlementService and StructureService with level tracking capabilities:

**SettlementService**:

- **setLevel()**: Sets settlement level with audit logging and real-time event publishing
- **CRUD operations**: Full create, read, update, delete with soft delete
- **Cascade delete**: Deletes cascade to structures (maintains referential integrity)
- **Archive/Restore**: Archive doesn't cascade (allows temporary hiding without deletion)
- **Location validation**: Ensures locations are unique per settlement and belong to same world
- **Event publishing**: Level changes publish `entity.modified` events via Redis PubSub

**StructureService**:

- **setLevel()**: Sets structure level with audit logging and real-time event publishing
- **CRUD operations**: Full create, read, update, delete with soft delete
- **DataLoader support**: `findBySettlementIds()` for efficient GraphQL field resolution
- **Archive/Restore**: Standard archive operations without cascade
- **Type tracking**: Structures have types (temple, barracks, market, library, etc.)
- **Event publishing**: Level changes publish `entity.modified` events via Redis PubSub

All methods include:

- Authorization checks via `hasEditPermission()` (owner or GM role)
- Audit logging on all state-changing operations
- Comprehensive unit tests (18 tests for SettlementService, 19 for StructureService, all passing)
- Proper error handling with appropriate exception types
- Consistent patterns with PartyService and KingdomService

Both services follow the architectural patterns established in Stage 2 and Stage 3:

- setLevel() methods provide quick level updates without full versioning overhead
- Full versioning is available through update() method with optimistic locking
- Cascade delete for Settlement->Structure maintains referential integrity
- PubSub events enable real-time UI updates and concurrent edit detection

Variable operations (defineSchema, setVariable, getVariable) deferred to Stage 5 for centralized implementation via VariableSchemaService.
