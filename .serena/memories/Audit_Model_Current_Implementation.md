# Audit Model - Current Implementation Analysis

## Overview

The Audit model is a fully functional audit logging system for tracking entity mutations in the campaign management system. It is NOT a placeholder - it's actively used across the codebase.

## Files & Locations

### Core Implementation

- **Service**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/audit.service.ts`
- **GraphQL Type**: `/storage/programs/campaign_manager/packages/api/src/graphql/types/audit.type.ts`
- **Resolver**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/audit.resolver.ts`
- **Prisma Schema**: `/storage/programs/campaign_manager/packages/api/prisma/schema.prisma`
- **Tests**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/audit.service.test.ts`

## Prisma Schema Definition

```prisma
model Audit {
  id         String   @id @default(cuid())
  entityType String
  entityId   String
  operation  String // "CREATE", "UPDATE", "DELETE", "ARCHIVE", "RESTORE", "FORK", "MERGE", "CHERRY_PICK"
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  changes    Json // JSON diff of changes (before/after)
  metadata   Json     @default("{}") // Additional context (IP, user agent, etc.)
  timestamp  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
  @@index([operation])
}
```

## AuditService API

### Method: `log()`

```typescript
async log(
  entityType: string,
  entityId: string,
  operation: AuditOperation,
  userId: string,
  changes: Record<string, unknown>,
  metadata: Record<string, unknown> = {}
): Promise<void>
```

**Supported Operations**:

- 'CREATE'
- 'UPDATE'
- 'DELETE'
- 'ARCHIVE'
- 'RESTORE'
- 'FORK'
- 'MERGE'
- 'CHERRY_PICK'

**Behavior**: Logs audit entries with error handling (failures don't break main operations)

## Current Usage in Codebase

### Services Using AuditService (22+ services):

- BranchService
- VersionService
- StateVariableService
- LinkService
- WorldService
- ConditionService
- CharacterService
- SettlementService
- StructureService
- KingdomService
- PartyService
- LocationService
- CampaignService
- EventService
- EncounterService
- EffectService
- MergeService
- VariableSchemaService
- EffectExecutionService
- All provide AuditService in their module definitions

### Example Audit Log Calls

**CREATE Operation** (state-variable.service.ts:88):

```typescript
await this.audit.log('state_variable', variable.id, 'CREATE', user.id, {
  scope: variable.scope,
  scopeId: variable.scopeId,
  key: variable.key,
  type: variable.type,
});
```

**UPDATE Operation** (state-variable.service.ts:380):

```typescript
await this.audit.log('state_variable', id, 'UPDATE', user.id, updateData);
// updateData contains the changed fields
```

**DELETE Operation** (state-variable.service.ts:424):

```typescript
await this.audit.log('state_variable', id, 'DELETE', user.id, { deletedAt });
```

**CHARACTER CREATE** (character.service.ts:185):

```typescript
await this.audit.log('character', character.id, 'CREATE', user.id, {
  name: character.name,
  campaignId: character.campaignId,
  partyId: character.partyId,
  level: character.level,
  race: character.race,
  class: character.class,
  isNPC: character.isNPC,
});
```

## Changes Field Format

### Actual Structure in Practice

**For CREATE operations**: Contains key properties being created

```json
{
  "name": "Test Campaign",
  "campaignId": "campaign-1",
  "level": 5
}
```

**For UPDATE operations**: Contains changed fields OR before/after diffs

```json
{
  "name": { "from": "Old Name", "to": "New Name" }
}
// OR simple field changes
{
  "level": 5,
  "description": "Updated description"
}
```

**For DELETE/ARCHIVE operations**: Contains timestamp and final state

```json
{
  "deletedAt": "2024-01-15T10:30:00Z"
}
// OR
{
  "archivedAt": "2024-01-15T10:30:00Z"
}
```

### Type Definition

From `level-history.service.ts`:

```typescript
type AuditChanges = {
  level?: number;
  manualLevelOverride?: number | null;
  averageLevel?: number;
  [key: string]: unknown; // Flexible for different entity types
};
```

## GraphQL Resolver Queries

### 1. entityAuditHistory

```graphql
query entityAuditHistory($entityType: String!, $entityId: ID!, $limit: Int) {
  entityAuditHistory(entityType: $entityType, entityId: $entityId, limit: $limit) {
    id
    entityType
    entityId
    operation
    userId
    changes
    metadata
    timestamp
  }
}
```

Supports:

- Settlement, Structure, Character, Event, Encounter
- Defaults to 50 limit, caps at 100
- Requires campaign access verification

### 2. userAuditHistory

```graphql
query userAuditHistory($userId: ID!, $limit: Int) {
  userAuditHistory(userId: $userId, limit: $limit) {
    id
    entityType
    entityId
    operation
    userId
    changes
    metadata
    timestamp
  }
}
```

Requires user to view own history (TODO: add role-based admin access)

## Metadata Field Usage

Currently used for optional context like:

- IP address
- User agent
- Request context

Example:

```typescript
await this.audit.log(
  'campaign',
  'campaign-1',
  'CREATE',
  'user-1',
  { name: 'Test Campaign' },
  { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
);
```

## Key Characteristics

1. **Error Handling**: Audit failures are logged but don't break main operations
2. **Flexibility**: Changes field accepts any JSON structure
3. **Indexed for Performance**:
   - entityType + entityId
   - userId
   - timestamp
   - operation
4. **Type Safe**: Uses TypeScript with Prisma InputJsonValue
5. **Query Accessible**: Full GraphQL API with permission checks

## Current Limitations/Gaps

1. **No structured changes format** - varies by entity type, not standardized
2. **No before/after tracking** - CREATE logs new values, UPDATE logs only what changed
3. **No cascade tracking** - doesn't capture related entity changes
4. **No branch/version context** - doesn't track which branch/version affected
5. **No relationship tracking** - doesn't log which related entities were affected
6. **Resolver whitelisting limited** - only supports 5 entity types (Settlement, Structure, Character, Event, Encounter)
7. **Manual logging** - services must remember to call audit.log()
8. **No undo/restore capability** - audit is read-only, doesn't support rollback

## Test Examples

From `audit.service.test.ts`:

- CREATE operation with basic properties
- UPDATE operation with before/after diffs
- DELETE operation with timestamp
- ARCHIVE operation
- RESTORE operation
- Optional metadata inclusion

All tests verify that prisma.audit.create is called with correct data structure.

## Services Using Level History (Audit-based)

`LevelHistoryService` reads from Audit to reconstruct level change history:

- Fetches all CREATE and UPDATE operations for an entity
- Processes in chronological order
- Extracts level changes from the changes JSON field
