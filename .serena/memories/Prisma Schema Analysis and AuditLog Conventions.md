# Prisma Schema Analysis - AuditLog Model Design Guide

## Schema File Location

- **Primary File**: `/storage/programs/campaign_manager/packages/api/prisma/schema.prisma`
- **Migrations**: `/storage/programs/campaign_manager/packages/api/prisma/migrations/`
- **Database**: PostgreSQL with PostGIS extension (SRID 3857)
- **Prisma Client**: Uses `previewFeatures = ["postgresqlExtensions"]`

---

## Naming Conventions

### Field Naming

- **camelCase** for all field names (e.g., `createdAt`, `updatedAt`, `deletedAt`)
- **PascalCase** for model names (e.g., `User`, `Campaign`, `Settlement`)
- **UPPERCASE** for enum values (e.g., `OWNER`, `PLAYER`, `VIEWER`)
- **snake_case** for mapped database column names (only when using `@map`)

### Common Field Patterns

- **IDs**: Always `String` type with `@id @default(cuid())` for primary keys
- **Foreign Keys**: `{entityName}Id` pattern (e.g., `userId`, `campaignId`, `settlementId`)
- **Timestamps**: Always use `DateTime` type with TIMESTAMP(3) precision
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
  - `deletedAt DateTime?` (for soft deletes)
  - `archivedAt DateTime?` (for archiving, separate from deletion)

### Enum Conventions

- Use enums for fixed sets of values (e.g., `CampaignRole`, `EffectTiming`)
- Enums are PascalCase with UPPERCASE values
- Keep enums co-located near the models that use them

---

## Field Type Conventions

### Standard Field Types Used

- **Identifiers**: `String @id @default(cuid())`
- **Text Content**: `String` (unlimited), `String?` (nullable)
- **Numeric**: `Int` for counts/levels, `Int?` for optional numeric
- **Flags**: `Boolean @default(false)` for status flags
- **Timestamps**: `DateTime @default(now())`, `DateTime @updatedAt`, `DateTime?` (nullable)
- **JSON Data**: `Json @default("{}")` or `Json @default("[]")` for flexible data structures
- **Arrays**: `String[]` for string arrays with `@default([])`
- **Bytes**: `Bytes` for binary data (used for compressed gzip content in Version model)
- **Unsupported Types**: `Unsupported("geometry")` for PostGIS geometry columns

### Optional vs Required

- Use `?` suffix for truly optional fields
- Use `@default()` for fields that should always have a value
- Never use bare nullable fields without defaults unless explicitly optional

---

## Index Patterns

### Single-Column Indexes

Most common:

- `@@index([deletedAt])` - For soft delete queries
- `@@index([archivedAt])` - For archive queries
- `@@index([campaignId])` - For foreign key lookups
- `@@index([ownerId])` - For ownership queries
- `@@index([timestamp])` - For time-based queries
- `@@index([isActive])` - For status filtering
- `@@index([createdBy])` - For user-related queries

### Composite Indexes

Used for multi-column queries:

- `@@index([entityType, entityId])` - For polymorphic entity lookups (very common)
- `@@index([entityType, entityId, timestamp])` - For audit trail pagination
- `@@index([scope, scopeId, key])` - For scoped variable lookups
- `@@index([campaignId, isPinned])` - For filtered lookups

### Unique Constraints

- `@@unique([field])` - Single field uniqueness
- `@@unique([field1, field2])` - Composite uniqueness
- `@@unique([scope, scopeId, key, deletedAt])` - Include soft-delete marker

---

## Timestamp Field Conventions

### Three-Tier Timestamp Pattern (STRONGLY USED)

Every mutable model includes:

1. **createdAt** - `DateTime @default(now())` - Immutable creation time
2. **updatedAt** - `DateTime @updatedAt` - Auto-updated on changes
3. **deletedAt** - `DateTime?` - Soft delete marker

### Additional Timestamps

- **archivedAt** - Separate from deletion (for archival)
- **revokedAt** - Revocation timestamp (RefreshToken, ApiKey)
- **expiresAt** - Expiration timestamp
- **scheduledAt** - When scheduled (Encounter, Event)
- **resolvedAt** - When resolved
- **occurredAt** - World time when occurred (Event)
- **mergedAt** - When merge completed (MergeHistory)
- **executedAt** - When executed (EffectExecution)

### Timestamp Indexing

- `@@index([timestamp])` - For reverse chronological queries
- `@@index([deletedAt])` - For "active records"
- Composite: `@@index([entityType, entityId, timestamp])` - For paginated audit trails

---

## Existing Audit/Logging Functionality

### Current Audit Model (Already Exists)

```prisma
model Audit {
  id         String   @id @default(cuid())
  entityType String
  entityId   String
  operation  String   // "CREATE", "UPDATE", "DELETE"
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  changes    Json     // JSON diff
  metadata   Json     @default("{}")
  timestamp  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
  @@index([operation])
}
```

### Related Auditing Models

- **EffectExecution** - Tracks effect executions with context/result
- **Version** - Bitemporal versioning for entities
- **MergeHistory** - Tracks branch merge operations

### IMPORTANT: NO AuditLog Model Currently Exists

The `Audit` model exists. AuditLog would be a new addition.

---

## Entity Types That Will Be Audited

### Campaign Management

- `Campaign`, `World`, `Party`, `Character`

### Spatial/Kingdom

- `Kingdom`, `Settlement`, `Structure`, `Location`

### Events & Encounters

- `Encounter`, `Event`, `Condition`, `Effect`, `EffectExecution`

### Variables & Rules

- `StateVariable`, `FieldCondition`, `Dependency`

### System

- `Branch`, `Version`, `MergeHistory`, `Link`

---

## Relevant Enums

### CampaignRole

```prisma
enum CampaignRole {
  OWNER
  GM
  PLAYER
  VIEWER
}
```

### EffectTiming

```prisma
enum EffectTiming {
  PRE
  ON_RESOLVE
  POST
}
```

### String-Based Enums

- **Entity Types**: "world", "campaign", "location", "encounter", "event", "party", "kingdom", "settlement", "structure", "character"
- **Operations**: "CREATE", "UPDATE", "DELETE"
- **Scopes**: "world", "campaign", "party", "kingdom", "settlement", "structure", "character", "location", "event", "encounter"
- **StateVariable Types**: "string", "integer", "float", "boolean", "json", "derived"
- **Link Types**: "prerequisite", "blocks", "triggers", "related"

---

## User Tracking Patterns

Models with creator/updater tracking:

1. **StateVariable** - `createdBy`, `creator`, `updatedBy`, `updater`
2. **FieldCondition** - `createdBy`, `creator`, `updatedBy`, `updater`
3. **Version** - `createdBy` with User relation
4. **MergeHistory** - `mergedBy` with User relation
5. **EffectExecution** - `executedBy` with User ID
6. **Audit** - `userId` with User relation

### User Relations

- Use `@relation(fields: [...], references: [id])`
- Most use `onDelete: Cascade` for dependent records
- Historical data models use `onDelete: Restrict` to prevent deletion

---

## Polymorphic Entity Pattern

Structure:

- **entityType** - String describing type ("encounter", "event", etc.)
- **entityId** - String with entity ID
- **Optional Relations** - Multiple optional relation fields (one per type)
- **Comments** - Explicit notes that entityType determines which relation to use

Examples: Condition, StateVariable, Effect, EffectExecution use this pattern.

---

## Key Design Principles

1. **Soft Delete Pattern**: `deletedAt` on all mutable entities
2. **Separate Archival**: Both `deletedAt` AND `archivedAt` when needed
3. **Version Fields**: `version Int @default(1)` for optimistic locking
4. **CUID IDs**: All primary keys use CUID
5. **Comprehensive Indexing**: Multiple indexes on queried fields
6. **User Attribution**: Track creator/modifier/executor
7. **Polymorphic Relations**: entityType + entityId pattern
8. **JSON Flexibility**: For extensible data (variables, settings, metadata)
9. **Default Values**: Always provide sensible defaults
10. **Composite Indexes**: For multi-column queries and pagination

---

## AuditLog Implementation Guide

**Model Name**: `AuditLog` (to differentiate from existing `Audit` model)

**Fields**:

- `id String @id @default(cuid())`
- `entityType String` - Type of entity being logged
- `entityId String` - ID of entity
- `action String` - Action performed
- `userId String` - Who performed action
- `user User @relation(fields: [userId], ...)`
- `changes Json` - What changed
- `metadata Json @default("{}")`
- `timestamp DateTime @default(now())`

**Indexes**:

- `@@index([entityType, entityId])`
- `@@index([userId])`
- `@@index([timestamp])`
- `@@index([action])`
- `@@index([entityType, entityId, timestamp])` - For pagination

**Characteristics**:

- Immutable (no updatedAt)
- No soft deletes (permanent record)
- No version field (it IS a historical record)
- User attribution required
- Time-indexed for queries
