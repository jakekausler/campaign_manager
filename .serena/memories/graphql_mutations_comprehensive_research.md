# GraphQL Mutations Research - Campaign Manager

## Overview

Comprehensive research on all GraphQL mutations across the Campaign Manager API, organized by entity type with input types, return types, and implementation patterns.

---

## MUTATION PATTERNS & CONVENTIONS

### Standard CRUD Pattern

All entities follow consistent patterns:

- **Create**: `create<Entity>(input: Create<Entity>Input!) -> <Entity>`
- **Update**: `update<Entity>(id: ID!, input: Update<Entity>Input!) -> <Entity>`
- **Delete**: `delete<Entity>(id: ID!) -> <Entity>` (soft delete)
- **Archive**: `archive<Entity>(id: ID!) -> <Entity>`
- **Restore**: `restore<Entity>(id: ID!) -> <Entity>`

### Authorization Guards

- `@UseGuards(JwtAuthGuard)` - Requires authentication
- `@UseGuards(JwtAuthGuard, RolesGuard)` - Requires specific roles
- `@Roles('owner', 'gm')` - Owner or Game Master role required
- `@CurrentUser() user: AuthenticatedUser` - Provides user context

### Input Type Pattern: Optimistic Locking

Update inputs include:

```typescript
branchId!: string;          // For branching context
expectedVersion!: number;   // For optimistic locking
worldTime?: Date;           // For world time tracking
```

---

## MUTATIONS BY ENTITY TYPE

### CAMPAIGN ENTITY

**Resolver**: CampaignResolver
**Mutations**:

1. `createCampaign(input: CreateCampaignInput!) -> Campaign`
   - Input: name (required), worldId (required), settings?, isActive?
   - Guards: JWT + Roles (owner, gm)

2. `updateCampaign(id: ID!, input: UpdateCampaignInput!) -> Campaign`
   - Input: name?, settings?, isActive?, branchId, expectedVersion, worldTime?
   - Guards: JWT + Roles (owner, gm)
   - Optimistic locking enabled

3. `deleteCampaign(id: ID!) -> Campaign`
   - Soft delete operation
   - Guards: JWT + Roles (owner, gm)

4. `archiveCampaign(id: ID!) -> Campaign`
   - Archive campaign (preserves data)
   - Guards: JWT + Roles (owner, gm)

5. `restoreCampaign(id: ID!) -> Campaign`
   - Restore archived campaign
   - Guards: JWT + Roles (owner, gm)

---

### WORLD ENTITY

**Resolver**: WorldResolver
**Mutations**:

1. `createWorld(input: CreateWorldInput!) -> World`
   - Input: name (required), settings?
   - Guards: JWT + Roles (owner, gm)

2. `updateWorld(id: ID!, input: UpdateWorldInput!) -> World`
   - Input: name?, settings?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteWorld(id: ID!) -> World`
   - Soft delete

4. `archiveWorld(id: ID!) -> World`
   - Archive world

5. `restoreWorld(id: ID!) -> World`
   - Restore archived world

---

### LOCATION ENTITY

**Resolver**: LocationResolver
**Mutations**:

1. `createLocation(input: CreateLocationInput!) -> Location`
   - Input: worldId (required), type (required), name?, description?, parentLocationId?
   - Supports location hierarchy

2. `updateLocation(id: ID!, input: UpdateLocationInput!) -> Location`
   - Input: name?, description?, parentLocationId?, branchId, expectedVersion, worldTime?
   - Supports geometry updates via spatial resolver
   - Optimistic locking enabled

3. `deleteLocation(id: ID!) -> Location`
   - Soft delete

4. `archiveLocation(id: ID!) -> Location`
   - Archive location

5. `restoreLocation(id: ID!) -> Location`
   - Restore archived location

**Note**: Geometry handling is separate via @ResolveField in LocationResolver

---

### SETTLEMENT ENTITY

**Resolver**: SettlementResolver
**Mutations**:

1. `createSettlement(input: CreateSettlementInput!) -> Settlement`
   - Input: kingdomId (required), locationId (required), name (required), level?, variables?, variableSchemas?

2. `updateSettlement(id: ID!, input: UpdateSettlementInput!) -> Settlement`
   - Input: name?, level?, variables?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteSettlement(id: ID!) -> Settlement`
   - Soft delete

4. `archiveSettlement(id: ID!) -> Settlement`
   - Archive settlement

5. `restoreSettlement(id: ID!) -> Settlement`
   - Restore archived settlement

6. `setSettlementLevel(id: ID!, level: Int!) -> Settlement`
   - Update only level (special mutation)

7. `setSettlementVariable(settlementId: ID!, input: SetVariableInput!) -> Variable`
   - Returns: { name: string, value: unknown }
   - SetVariableInput: { name (required), value (required) }

8. `defineSettlementVariableSchema(input: DefineVariableSchemaInput!) -> VariableSchema`
   - Define dynamic variable schema for settlements

9. `deleteSettlementVariableSchema(settlementId: ID!, fieldName: String!) -> Boolean`
   - Remove variable schema

---

### STRUCTURE ENTITY (Buildings)

**Resolver**: StructureResolver
**Mutations**:

1. `createStructure(input: CreateStructureInput!) -> Structure`
   - Input: settlementId (required), name (required), type?, level?

2. `updateStructure(id: ID!, input: UpdateStructureInput!) -> Structure`
   - Input: name?, type?, level?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteStructure(id: ID!) -> Structure`
   - Soft delete

4. `archiveStructure(id: ID!) -> Structure`
   - Archive structure

5. `restoreStructure(id: ID!) -> Structure`
   - Restore archived structure

6. `setStructureLevel(id: ID!, level: Int!) -> Structure`
   - Update only level

7. `setStructureVariable(structureId: ID!, input: SetVariableInput!) -> Variable`
   - Returns: { name: string, value: unknown }

8. `defineStructureVariableSchema(input: DefineVariableSchemaInput!) -> VariableSchema`
   - Define dynamic variable schema

9. `deleteStructureVariableSchema(structureId: ID!, fieldName: String!) -> Boolean`
   - Remove variable schema

---

### KINGDOM ENTITY

**Resolver**: KingdomResolver
**Mutations**:

1. `createKingdom(input: CreateKingdomInput!) -> Kingdom`
   - Input: campaignId (required), name (required), level?

2. `updateKingdom(id: ID!, input: UpdateKingdomInput!) -> Kingdom`
   - Input: name?, level?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteKingdom(id: ID!) -> Kingdom`
   - Soft delete

4. `archiveKingdom(id: ID!) -> Kingdom`
   - Archive kingdom

5. `restoreKingdom(id: ID!) -> Kingdom`
   - Restore archived kingdom

6. `setKingdomLevel(id: ID!, level: Int!) -> Kingdom`
   - Update only level

7. `setKingdomVariable(kingdomId: ID!, input: SetVariableInput!) -> Variable`
   - Returns: { name: string, value: unknown }

8. `defineKingdomVariableSchema(input: DefineVariableSchemaInput!) -> VariableSchema`
   - Define dynamic variable schema

9. `deleteKingdomVariableSchema(kingdomId: ID!, fieldName: String!) -> Boolean`
   - Remove variable schema

---

### EVENT ENTITY

**Resolver**: EventResolver
**Mutations**:

1. `createEvent(input: CreateEventInput!) -> Event`
   - Input: campaignId (required), locationId?, name (required), description?, eventType (required), scheduledAt?, variables?
   - eventType enum: 'story' | 'kingdom' | 'party' | 'world'

2. `updateEvent(id: ID!, input: UpdateEventInput!) -> Event`
   - Input: name?, description?, eventType?, scheduledAt?, variables?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteEvent(id: ID!) -> Event`
   - Soft delete

4. `archiveEvent(id: ID!) -> Event`
   - Archive event

5. `restoreEvent(id: ID!) -> Event`
   - Restore archived event

6. `completeEvent(id: ID!, resolutionData?: JSON!) -> Event`
   - Mark event as completed
   - Resolution workflow mutation

7. `expireEvent(id: ID!) -> Event`
   - Mark event as expired (passed schedule time)

8. `getOverdueEvents(campaignId: ID!) -> [Event!]!`
   - Query-like mutation for workflow trigger

---

### ENCOUNTER ENTITY

**Resolver**: EncounterResolver
**Mutations**:

1. `createEncounter(input: CreateEncounterInput!) -> Encounter`
   - Input: campaignId (required), locationId?, name (required), description?, difficulty?

2. `updateEncounter(id: ID!, input: UpdateEncounterInput!) -> Encounter`
   - Input: name?, description?, difficulty?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteEncounter(id: ID!) -> Encounter`
   - Soft delete

4. `archiveEncounter(id: ID!) -> Encounter`
   - Archive encounter

5. `restoreEncounter(id: ID!) -> Encounter`
   - Restore archived encounter

6. `resolveEncounter(id: ID!, input: ResolveEncounterInput!) -> EncounterResolution`
   - Resolution workflow mutation
   - Returns detailed resolution results with effects

---

### PARTY ENTITY (Character Groups)

**Resolver**: PartyResolver
**Mutations**:

1. `createParty(input: CreatePartyInput!) -> Party`
   - Input: campaignId (required), name (required), level?

2. `updateParty(id: ID!, input: UpdatePartyInput!) -> Party`
   - Input: name?, level?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteParty(id: ID!) -> Party`
   - Soft delete

4. `archiveParty(id: ID!) -> Party`
   - Archive party

5. `restoreParty(id: ID!) -> Party`
   - Restore archived party

6. `setPartyLevel(id: ID!, level: Int!) -> Party`
   - Update only level

7. `addPartyMember(input: AddPartyMemberInput!) -> Party`
   - Input: partyId (required), characterId (required)
   - Returns updated party with new member

8. `removePartyMember(input: RemovePartyMemberInput!) -> Party`
   - Input: partyId (required), characterId (required)
   - Returns updated party after removal

9. `setPartyVariable(partyId: ID!, input: SetVariableInput!) -> Variable`
   - Returns: { name: string, value: unknown }

10. `definePartyVariableSchema(input: DefineVariableSchemaInput!) -> VariableSchema`
    - Define dynamic variable schema

11. `deletePartyVariableSchema(partyId: ID!, fieldName: String!) -> Boolean`
    - Remove variable schema

---

### CHARACTER ENTITY

**Resolver**: CharacterResolver
**Mutations**:

1. `createCharacter(input: CreateCharacterInput!) -> Character`
   - Input: campaignId (required), name (required), class?, level?

2. `updateCharacter(id: ID!, input: UpdateCharacterInput!) -> Character`
   - Input: name?, class?, level?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteCharacter(id: ID!) -> Character`
   - Soft delete

4. `archiveCharacter(id: ID!) -> Character`
   - Archive character

5. `restoreCharacter(id: ID!) -> Character`
   - Restore archived character

---

### STATE VARIABLE ENTITY (Dynamic Variables)

**Resolver**: StateVariableResolver
**Mutations**:

1. `createStateVariable(input: CreateStateVariableInput!) -> StateVariable`
   - Input:
     - scope (required): VariableScope enum (WORLD, CAMPAIGN, KINGDOM, SETTLEMENT, STRUCTURE, PARTY, CHARACTER)
     - scopeId?: string (null for world-level)
     - key (required): string
     - value?: unknown (required unless type is DERIVED)
     - type (required): VariableType enum
     - formula?: JSON (required if type is DERIVED)
     - description?: string

2. `updateStateVariable(id: ID!, input: UpdateStateVariableInput!) -> StateVariable`
   - Input: value?, formula?, description?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteStateVariable(id: ID!) -> StateVariable`
   - Delete state variable

4. `toggleStateVariableActive(id: ID!) -> StateVariable`
   - Toggle active/inactive status

5. `evaluateStateVariable(id: ID!, context?: JSON!) -> JSON`
   - Evaluate derived variable formula
   - Returns computed value

---

### FIELD CONDITION ENTITY

**Resolver**: FieldConditionResolver
**Mutations**:

1. `createFieldCondition(input: CreateFieldConditionInput!) -> FieldCondition`
   - Input: entityId (required), entityType (required), fieldPath (required), condition (required), description?
   - condition: JSONLogic expression

2. `updateFieldCondition(id: ID!, input: UpdateFieldConditionInput!) -> FieldCondition`
   - Input: fieldPath?, condition?, description?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteFieldCondition(id: ID!) -> FieldCondition`
   - Delete field condition

4. `toggleFieldConditionActive(id: ID!) -> FieldCondition`
   - Toggle active/inactive status

5. `evaluateFieldCondition(id: ID!, context?: JSON!) -> Boolean`
   - Evaluate condition against context
   - Returns true/false

---

### EFFECT ENTITY (State Mutations)

**Resolver**: EffectResolver
**Mutations**:

1. `createEffect(input: CreateEffectInput!) -> Effect`
   - Input:
     - name (required): string
     - description?: string (max 500 chars)
     - effectType (required): string (e.g., "modify_variable", "trigger_event")
     - payload (required): JSON (max 100KB) - JSON Patch operations
     - entityType (required): string (e.g., "encounter", "event")
     - entityId (required): string
     - timing?: EffectTiming enum (ON_RESOLVE, ON_COMPLETION, AFTER_DELAY)
     - priority?: number (default 0, lower executes first)

2. `updateEffect(id: ID!, input: UpdateEffectInput!) -> Effect`
   - Input: name?, description?, payload?, timing?, priority?, branchId, expectedVersion, worldTime?
   - Optimistic locking enabled

3. `deleteEffect(id: ID!) -> Effect`
   - Delete effect

4. `toggleEffectActive(id: ID!) -> Effect`
   - Toggle active/inactive status

5. `executeEffect(input: ExecuteEffectInput!) -> EffectExecutionResult`
   - Input: effectId (required), context?: JSON, dryRun?: boolean
   - Returns: { success: boolean, appliedPatches: number, errors?: string[], result?: JSON }
   - Testing/debugging mutation

6. `executeEffectsForEntity(input: ExecuteEffectsForEntityInput!) -> EffectExecutionResult`
   - Input: entityType (required), entityId (required), context?: JSON, dryRun?: boolean
   - Execute all active effects for entity

---

### BRANCH ENTITY (Branching/Timeline Management)

**Resolver**: BranchResolver
**Mutations**:

1. `createBranch(input: CreateBranchInput!) -> Branch`
   - Input:
     - campaignId (required): string
     - name (required): string
     - description?: string
     - parentId?: string (for hierarchy)
     - divergedAt?: Date
     - isPinned?: boolean
     - color?: string (hex color #RRGGBB)
     - tags?: string[]

2. `updateBranch(id: ID!, input: UpdateBranchInput!) -> Branch`
   - Input: name?, description?, isPinned?, color?, tags?

3. `deleteBranch(id: ID!) -> Branch`
   - Delete branch (only if no children and not main)

4. `forkBranch(input: ForkBranchInput!) -> ForkResult`
   - Input:
     - sourceBranchId (required): string
     - name (required): string
     - description?: string
     - worldTime?: Date
   - Returns: { newBranchId: string, copiedVersions: number }
   - Creates copy of entire branch history

---

### MERGE ENTITY (3-Way Merge Operations)

**Resolver**: MergeResolver
**Mutations**:

1. `executeMerge(input: ExecuteMergeInput!) -> MergeResult`
   - Input:
     - sourceBranchId (required): string
     - targetBranchId (required): string
     - worldTime (required): Date
     - resolutions?: ConflictResolution[]
   - Returns detailed merge result with conflicts and resolutions
   - Guards: JWT only (requires GM/owner role internally)
   - Performs 3-way merge with conflict resolution

2. `cherryPickVersion(input: CherryPickVersionInput!) -> VersionEdge`
   - Input:
     - sourceBranchId (required)
     - versionId (required)
     - targetBranchId (required)
     - worldTime (required)
   - Cherry-pick single version from source to target

---

### LINK ENTITY (Relationships/Dependencies)

**Resolver**: LinkResolver
**Mutations**:

1. `createLink(input: CreateLinkInput!) -> Link`
   - Input: sourceId (required), targetId (required), relationshipType (required), metadata?

2. `updateLink(id: ID!, input: UpdateLinkInput!) -> Link`
   - Input: relationshipType?, metadata?

3. `deleteLink(id: ID!) -> Link`
   - Delete link/relationship

---

### WORLD TIME ENTITY

**Resolver**: WorldTimeResolver
**Queries with state change** (implemented as mutations in business logic):

- World time tracking and progression
- Integrated with other mutations via `worldTime` parameter

---

## INPUT TYPE PATTERNS

### Basic Create Inputs

Contain only required and optional fields for new entity:

```typescript
CreateEntityInput {
  name (required)
  description? (optional)
  parentId? (optional)
  // other relevant fields
}
```

### Update Inputs

Extend create inputs with versioning fields:

```typescript
UpdateEntityInput {
  // Fields from create (all optional)
  name? (optional)
  description? (optional)

  // Versioning
  branchId (required) - Branch context
  expectedVersion (required) - Current version
  worldTime? (optional) - Time context
}
```

### Nested Input Types

Used for complex operations:

- `SetVariableInput`: { name, value }
- `DefineVariableSchemaInput`: { fieldName, schema, ... }
- `AddPartyMemberInput`: { partyId, characterId }
- `RemovePartyMemberInput`: { partyId, characterId }
- `ConflictResolution`: For merge conflicts
- `ExecuteEffectInput`: { effectId, context?, dryRun? }

---

## SPECIAL MUTATION PATTERNS

### Variable Mutations

**Pattern**: Setting dynamic variables on entities

```typescript
setEntityVariable(entityId: ID!, input: SetVariableInput!) -> Variable
defineEntityVariableSchema(...) -> VariableSchema
deleteEntityVariableSchema(...) -> Boolean
```

Used by: Settlement, Structure, Kingdom, Party

### Level Mutations

**Pattern**: Dedicated mutation for level updates

```typescript
setEntityLevel(id: ID!, level: Int!) -> Entity
```

Used by: Settlement, Structure, Kingdom, Party

### Resolution Workflows

**Pattern**: Complex workflow mutations

```typescript
completeEvent(id: ID!, resolutionData?: JSON!) -> Event
resolveEncounter(id: ID!, input: ResolveEncounterInput!) -> EncounterResolution
```

### Branching & Merge Mutations

**Pattern**: Complex timeline operations

```typescript
forkBranch(input: ForkBranchInput!) -> ForkResult
executeMerge(input: ExecuteMergeInput!) -> MergeResult
cherryPickVersion(input: CherryPickVersionInput!) -> VersionEdge
```

### Effect Execution

**Pattern**: Test/debug mutations with dry-run support

```typescript
executeEffect(input: ExecuteEffectInput!) -> EffectExecutionResult
executeEffectsForEntity(input: ExecuteEffectsForEntityInput!) -> EffectExecutionResult
```

---

## COMMON MUTATION FIELDS

### Entity ID

```typescript
id: ID!; // Standard for update/delete mutations
```

### Authorization & Context

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'gm')
@CurrentUser() user: AuthenticatedUser
```

### Optimistic Locking Fields

```typescript
branchId: string      // Branch context
expectedVersion: number  // Current version for conflict detection
worldTime?: Date      // Campaign time context
```

### Variable Schema Fields

```typescript
scope: VariableScope           // WORLD, CAMPAIGN, KINGDOM, etc.
scopeId?: string               // Null for world-level
key: string                    // Variable name
type: VariableType             // BOOLEAN, NUMBER, STRING, OBJECT, ARRAY, DERIVED
value?: unknown                // For non-derived
formula?: Record<string, unknown>  // JSONLogic for derived
```

---

## MUTATION RETURN TYPES

### Standard Entity Return

```typescript
@Mutation(() => Entity)
async mutateEntity(...): Promise<Entity>
```

### Workflow Result Return

```typescript
@Mutation(() => EncounterResolution)
async resolveEncounter(...): Promise<EncounterResolution>

@Mutation(() => MergeResult)
async executeMerge(...): Promise<MergeResult>

@Mutation(() => ForkResult)
async forkBranch(...): Promise<ForkResult>
```

### Variable Return

```typescript
@Mutation(() => Variable)
async setVariable(...): Promise<Variable>
// Returns: { name: string, value: unknown }
```

### Boolean Return

```typescript
@Mutation(() => Boolean)
async deleteVariableSchema(...): Promise<boolean>
```

### Execution Result Return

```typescript
@Mutation(() => EffectExecutionResult)
async executeEffect(...): Promise<EffectExecutionResult>
// Returns: { success, appliedPatches, errors?, result? }
```

---

## AUTHENTICATION & AUTHORIZATION SUMMARY

### Guards Used

1. `JwtAuthGuard` - Requires JWT authentication
2. `RolesGuard` - Checks user roles
3. Combined usage: `@UseGuards(JwtAuthGuard, RolesGuard)`

### Roles

- `'owner'` - Campaign owner (create operations)
- `'gm'` - Game Master (most mutations)
- Admin mutations require owner role

### Default Authorization

- Most mutations: JWT + Roles(['owner', 'gm'])
- Merge operations: JWT only (role checked internally)
- Branch operations: JWT only

---

## SUMMARY STATISTICS

- **Total Mutations**: 100+
- **Core CRUD Mutations**: ~50 (create, update, delete, archive, restore)
- **Variable Mutations**: ~15 (state variables, field conditions)
- **Complex Workflow Mutations**: ~10 (events, encounters, effects, merges)
- **Relationship Mutations**: ~3 (links)
- **Special Mutations**: ~10+ (fork, cherry-pick, execute effects)

---

## KEY IMPLEMENTATION PATTERNS

1. **Optimistic Locking**: Version field in updates for conflict detection
2. **Soft Deletes**: Archive/restore pattern instead of hard deletes
3. **Branching Context**: Most updates support branch-aware operations
4. **World Time**: Temporal awareness for time-sensitive operations
5. **Dry-Run Support**: Effect execution has dryRun flag for testing
6. **Dynamic Variables**: Schema-based variable system with JSONLogic
7. **Workflow Integration**: Resolution mutations return complex result types
8. **Relationship Tracking**: Link entity for tracking dependencies
