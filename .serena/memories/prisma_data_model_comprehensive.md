# Campaign Manager - Prisma Data Model Comprehensive Documentation

## Overview

The Campaign Manager uses PostgreSQL with PostGIS for spatial data. The data model implements:

- Bitemporal versioning for entity history
- Soft delete pattern (deletedAt field)
- Comprehensive audit trail with state snapshots
- CUID primary keys for all models
- Polymorphic relationships for flexible entity associations

**Database Configuration:**

- Provider: PostgreSQL
- Extensions: PostGIS (for geometry types)
- SRID: 3857 (Web Mercator - default, but configurable per campaign)
- Compression: gzip for Version payloads

---

## 1. PRISMA SCHEMA STRUCTURE

### Key Data Types Used

| Type                      | Usage                            | Examples                                |
| ------------------------- | -------------------------------- | --------------------------------------- |
| `String`                  | Text content, identifiers, names | email, description, type                |
| `Int`                     | Numeric counts, levels, priority | level, difficulty, priority             |
| `Boolean`                 | State flags                      | isActive, isResolved, isNPC             |
| `DateTime`                | Timestamps (system time)         | createdAt, updatedAt, timestamp         |
| `Json`/`Jsonb`            | Flexible data structures         | variables, settings, formula            |
| `Bytes`                   | Binary data                      | payloadGz (compressed entity snapshots) |
| `Unsupported("geometry")` | PostGIS geometry                 | geom (spatial data)                     |

### Primary Key Strategy

All models use **CUID** (Cryptographically Unique IDs):

```typescript
@id @default(cuid())
```

**Benefits:**

- Sortable by creation time
- Distributed ID generation (no central sequence)
- URL-safe
- Collision-resistant

### Timestamps & Soft Deletes

Every core entity includes:

```typescript
createdAt DateTime  @default(now())     // System time creation
updatedAt DateTime  @updatedAt           // System time last update
deletedAt DateTime?                      // Soft delete marker
archivedAt DateTime?                     // Optional archival (separate from delete)
```

**Soft Delete Pattern:**

- Records are marked with `deletedAt` timestamp instead of actual deletion
- Queries typically filter `where: { deletedAt: null }`
- Allows recovery and historical analysis
- Many models include: `@@index([deletedAt])`

---

## 2. RELATIONSHIPS OVERVIEW

### One-to-Many Relationships

**User → Multiple Entities:**

```
User -> Version[]          (audit creator)
User -> Audit[]           (audit actor)
User -> MergeHistory[]    (merge performer)
User -> RefreshToken[]    (auth tokens)
User -> ApiKey[]          (api access)
User -> CampaignMembership[] (campaign participation)
```

**Campaign → Game Entities:**

```
Campaign -> Branch[]      (timeline variants)
Campaign -> Party[]       (player groups)
Campaign -> Kingdom[]     (political entities)
Campaign -> Character[]   (actors)
Campaign -> Encounter[]   (combat/interactions)
Campaign -> Event[]       (story events)
```

**Location Hierarchy (Self-Referential):**

```typescript
model Location {
  parentLocationId String?
  parent Location? @relation("LocationHierarchy", fields: [parentLocationId], references: [id])
  children Location[] @relation("LocationHierarchy")
}
```

- Supports nested regions (continent → country → region → settlement)
- One-to-many self-relationship using "LocationHierarchy" relation name

**Branch Hierarchy (Self-Referential):**

```typescript
model Branch {
  parentId String?
  parent Branch? @relation("BranchForks", fields: [parentId], references: [id])
  children Branch[] @relation("BranchForks")
}
```

- Tracks branch divergence from parent timeline
- Supports multiple branches from same parent (branching tree)

**Organizational Hierarchy:**

```
Kingdom -> Settlement[] (contains settlements)
Settlement -> Structure[] (buildings/features)
Party -> Character[] (party members)
```

### Many-to-Many Relationships

**User ↔ Role (via UserRole junction table):**

```typescript
model User {
  roles UserRole[]
}

model Role {
  users UserRole[]
}

model UserRole {
  userId String @unique([userId, roleId])
  roleId String
}
```

**Role ↔ Permission (direct array in Prisma):**

```typescript
model Role {
  permissions Permission[]
}

model Permission {
  roles Role[]
}
```

**Campaign ↔ User (via CampaignMembership):**

```typescript
model CampaignMembership {
  userId String
  campaignId String
  role CampaignRole // OWNER | GM | PLAYER | VIEWER
  permissions Json  // Array of custom permissions

  @@unique([userId, campaignId])
}
```

### Polymorphic Relationships (Without Foreign Keys)

The design intentionally avoids foreign key constraints for polymorphic relationships to support flexible entity types.

**Condition Model (Polymorphic to Encounter/Event):**

```typescript
model Condition {
  entityType String // "encounter" or "event"
  entityId String   // ID of the entity (no FK constraint)

  // No @relation directive = no foreign key in database
  // Application code enforces referential integrity

  @@index([entityType, entityId])
}
```

**Effect Model (Polymorphic to Encounter/Event):**

```typescript
model Effect {
  entityType String // "encounter" or "event"
  entityId String   // ID of the entity (no FK constraint)
  timing EffectTiming // PRE | ON_RESOLVE | POST
  priority Int      // Execution order

  // Relations
  executions EffectExecution[]

  @@index([entityType, entityId, timing])
}

model EffectExecution {
  effectId String
  effect Effect @relation(fields: [effectId], references: [id], onDelete: Cascade)

  entityType String // "encounter" or "event" - which entity triggered execution
  entityId String   // ID of trigger entity

  context Json      // Entity state before execution (snapshot for audit)
  result Json       // { success: bool, patchApplied: [], affectedFields: [] }
  error String?     // Error message if execution failed

  @@index([entityType, entityId, executedAt]) // Audit trail pagination
}
```

**Link Model (Polymorphic, No FK):**

```typescript
model Link {
  sourceType String  // "encounter" or "event"
  sourceId String    // No FK constraint
  targetType String  // "encounter" or "event"
  targetId String    // No FK constraint
  linkType String    // "prerequisite" | "blocks" | "triggers" | "related"

  @@unique([sourceType, sourceId, targetType, targetId, linkType])
}
```

**Why No FK Constraints for Polymorphic Relations?**

- PostgreSQL foreign keys require target table to be known
- Polymorphic design stores different entity types in different tables
- FK constraint would require separate column per entity type (verbose)
- Application layer enforces referential integrity via business logic
- Allows flexible entity associations without schema changes

### StateVariable Polymorphic Relations

StateVariable uses a hybrid approach - weak FK constraints based on scope type:

```typescript
model StateVariable {
  scope String    // "world" | "campaign" | "party" | "kingdom" | "settlement" | "structure" | "character" | "location" | "event" | "encounter"
  scopeId String? // Nullable for world-level variables
  key String      // Variable name within scope

  // Weak polymorphic relations (actual relation depends on scope value)
  party Party? @relation(fields: [scopeId], references: [id], map: "StateVariable_party_fkey")
  kingdom Kingdom? @relation(fields: [scopeId], references: [id], map: "StateVariable_kingdom_fkey")
  settlement Settlement? @relation(fields: [scopeId], references: [id], map: "StateVariable_settlement_fkey")
  structure Structure? @relation(fields: [scopeId], references: [id], map: "StateVariable_structure_fkey")
  character Character? @relation(fields: [scopeId], references: [id], map: "StateVariable_character_fkey")

  @@unique([scope, scopeId, key, deletedAt])
  @@index([scope, scopeId, key])
}
```

**Important:** Only the relation matching the `scope` value should be used in application code.

### Dependency Graph

```typescript
model Dependency {
  sourceId String
  source StateVariable @relation(fields: [sourceId], references: [id])

  targetType String  // "encounter" | "event" | "condition" | "effect"
  targetId String    // ID of target entity (no FK due to polymorphism)

  @@unique([sourceId, targetType, targetId])
  @@index([sourceId])
  @@index([targetType, targetId])
}
```

Tracks which state variables are used by conditions, effects, encounters, and events.

---

## 3. KEY ENTITIES

### User Management

#### User Model

```typescript
model User {
  id String @id @default(cuid())
  email String @unique
  name String
  password String // Hashed with bcrypt
  roles UserRole[]

  // Audit trail references
  versions Version[]
  audits Audit[]
  mergeHistory MergeHistory[]

  // Ownership
  ownedCampaigns Campaign[]

  // Membership
  campaignMemberships CampaignMembership[]

  // API access
  refreshTokens RefreshToken[]
  apiKeys ApiKey[]

  // Audit fields (who created/modified)
  createdFieldConditions FieldCondition[] @relation("FieldConditionCreator")
  updatedFieldConditions FieldCondition[] @relation("FieldConditionUpdater")
  createdStateVariables StateVariable[] @relation("StateVariableCreator")
  updatedStateVariables StateVariable[] @relation("StateVariableUpdater")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([email])
  @@index([deletedAt])
}
```

#### Role & Permission Models

```typescript
model Role {
  id String @id @default(cuid())
  name String @unique
  description String?
  permissions Permission[]
  users UserRole[]

  @@index([name])
  @@index([deletedAt])
}

model Permission {
  id String @id @default(cuid())
  name String @unique
  resource String      // e.g., "campaign", "world", "location"
  action String        // e.g., "create", "read", "update", "delete"
  roles Role[]

  @@unique([resource, action])
  @@index([resource, action])
}
```

#### CampaignMembership Model

```typescript
enum CampaignRole {
  OWNER    // Full access, can manage members
  GM       // Game Master, can modify world state
  PLAYER   // Can control their characters
  VIEWER   // Read-only access
}

model CampaignMembership {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaignId String
  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  role CampaignRole
  permissions Json @default("[]")  // Array of custom permission strings

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, campaignId])
  @@index([userId])
  @@index([campaignId])
  @@index([role])
}
```

#### RefreshToken & ApiKey Models

```typescript
model RefreshToken {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  token String @unique  // Hashed token
  expiresAt DateTime
  createdAt DateTime @default(now())
  revokedAt DateTime?

  @@index([userId])
  @@index([expiresAt])
}

model ApiKey {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  key String @unique  // Hashed API key
  name String         // User-defined name
  scopes Json @default("[]")  // Array of scope strings
  campaignId String?  // Optional: limit key to specific campaign
  expiresAt DateTime?
  lastUsedAt DateTime?
  createdAt DateTime @default(now())
  revokedAt DateTime?

  @@index([userId])
  @@index([campaignId])
  @@index([expiresAt])
}
```

### Campaign & World

#### World Model

```typescript
model World {
  id String @id @default(cuid())
  name String
  calendars Json // Custom JSON schema for calendar systems (world-specific time)
  settings Json @default("{}")  // World-level configuration
  version Int @default(1)  // Optimistic locking

  campaigns Campaign[]
  locations Location[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  archivedAt DateTime?

  @@index([deletedAt])
  @@index([archivedAt])
}
```

#### Campaign Model

```typescript
model Campaign {
  id String @id @default(cuid())
  name String
  worldId String
  world World @relation(fields: [worldId], references: [id])
  ownerId String
  owner User @relation(fields: [ownerId], references: [id])

  srid Int @default(3857)  // Spatial Reference System (Web Mercator)
  currentWorldTime DateTime?  // Current world time in this campaign
  settings Json @default("{}")
  isActive Boolean @default(true)
  version Int @default(1)  // Optimistic locking

  // Game entities
  branches Branch[]
  parties Party[]
  kingdoms Kingdom[]
  characters Character[]
  encounters Encounter[]
  events Event[]
  memberships CampaignMembership[]
  apiKeys ApiKey[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  archivedAt DateTime?

  @@index([worldId])
  @@index([ownerId])
  @@index([deletedAt])
  @@index([archivedAt])
  @@index([isActive])
  @@index([currentWorldTime])
}
```

### Geographic Entities

#### Location Model (with PostGIS)

```typescript
model Location {
  id String @id @default(cuid())
  worldId String
  world World @relation(fields: [worldId], references: [id])

  type String  // "point" (landmark) | "region" (area)
  geom Unsupported("geometry")?  // PostGIS geometry (SRID 3857)
  name String?
  description String?

  // Hierarchical relationship (self-referential)
  parentLocationId String?
  parent Location? @relation("LocationHierarchy", fields: [parentLocationId], references: [id])
  children Location[] @relation("LocationHierarchy")

  // Child entities
  settlement Settlement?  // One-to-one: location is either a settlement or a generic location
  encounters Encounter[]
  events Event[]

  version Int @default(1)  // Optimistic locking
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  archivedAt DateTime?

  @@index([worldId])
  @@index([parentLocationId])
  @@index([deletedAt])
  @@index([archivedAt])
  @@index([type])
  // GIST index on geom created manually in migration (Prisma doesn't support GIST)
}
```

**PostGIS Notes:**

- `geom` field stores geometry using PostGIS type (POINT, POLYGON, MULTIPOLYGON, etc.)
- SRID 3857 (Web Mercator) is standard but configurable per campaign
- A manual GIST index is created via migration: `CREATE INDEX ON "Location" USING gist (geom)`
- Application code queries spatial data via raw SQL or ORM spatial functions

### Political/Organizational Hierarchy

#### Kingdom Model

```typescript
model Kingdom {
  id String @id @default(cuid())
  campaignId String
  campaign Campaign @relation(fields: [campaignId], references: [id])
  name String
  level Int @default(1)  // Political power level

  variables Json @default("{}")  // Custom typed variables
  variableSchemas Json @default("[]")  // Array of VariableSchema definitions

  settlements Settlement[]
  stateVars StateVariable[]  // Variables scoped to this kingdom

  version Int @default(1)  // Optimistic locking
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  archivedAt DateTime?

  @@index([campaignId])
  @@index([deletedAt])
  @@index([archivedAt])
}
```

#### Settlement Model

```typescript
model Settlement {
  id String @id @default(cuid())
  kingdomId String
  kingdom Kingdom @relation(fields: [kingdomId], references: [id])
  locationId String @unique  // One-to-one with Location
  location Location @relation(fields: [locationId], references: [id])

  name String
  level Int @default(1)  // Population/development level

  variables Json @default("{}")  // Typed variables
  variableSchemas Json @default("[]")

  structures Structure[]
  stateVars StateVariable[]

  version Int @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  archivedAt DateTime?

  @@index([kingdomId])
  @@index([locationId])
  @@index([deletedAt])
  @@index([archivedAt])
}
```

#### Structure Model

```typescript
model Structure {
  id String @id @default(cuid())
  settlementId String
  settlement Settlement @relation(fields: [settlementId], references: [id])

  type String  // e.g., "temple", "barracks", "market", "library", "forge"
  name String
  level Int @default(1)  // Building quality/development level

  variables Json @default("{}")
  variableSchemas Json @default("[]")

  stateVars StateVariable[]

  version Int @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  archivedAt DateTime?

  @@index([settlementId])
  @@index([type])
  @@index([deletedAt])
  @@index([archivedAt])
}
```

### Party & Characters

#### Party Model

```typescript
model Party {
  id String @id @default(cuid())
  campaignId String
  campaign Campaign @relation(fields: [campaignId], references: [id])
  name String

  averageLevel Int? @default(1)
  manualLevelOverride Int?  // Override computed level for custom campaigns

  variables Json @default("{}")  // Typed variables (treasury, morale, etc.)
  variableSchemas Json @default("[]")

  members Character[]  // Party members
  stateVars StateVariable[]

  version Int @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  archivedAt DateTime?

  @@index([campaignId])
  @@index([deletedAt])
  @@index([archivedAt])
}
```

#### Character Model

```typescript
model Character {
  id String @id @default(cuid())
  campaignId String
  campaign Campaign @relation(fields: [campaignId], references: [id])
  partyId String?
  party Party? @relation(fields: [partyId], references: [id])  // Optional party membership

  name String
  level Int @default(1)
  race String?
  class String?
  isNPC Boolean @default(false)  // Non-Player Character flag

  variables Json @default("{}")  // Typed variables (stats, inventory, spells, etc.)

  stateVars StateVariable[]

  version Int @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  archivedAt DateTime?

  @@index([campaignId])
  @@index([partyId])
  @@index([deletedAt])
  @@index([archivedAt])
  @@index([isNPC])
}
```

### Events & Encounters

#### Encounter Model

```typescript
model Encounter {
  id String @id @default(cuid())
  campaignId String
  campaign Campaign @relation(fields: [campaignId], references: [id])
  locationId String?
  location Location? @relation(fields: [locationId], references: [id])

  name String
  description String?
  difficulty Int?  // Challenge Rating or similar metric

  scheduledAt DateTime?  // When encounter is scheduled to occur (world time)
  isResolved Boolean @default(false)
  resolvedAt DateTime?

  variables Json @default("{}")  // Custom encounter data

  version Int @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  archivedAt DateTime?

  // Conditions, Effects, Links are stored polymorphically
  // Query using: Condition.entityType='encounter' && Condition.entityId=this.id

  @@index([campaignId])
  @@index([locationId])
  @@index([deletedAt])
  @@index([archivedAt])
  @@index([isResolved])
  @@index([scheduledAt])
}
```

#### Event Model

```typescript
model Event {
  id String @id @default(cuid())
  campaignId String
  campaign Campaign @relation(fields: [campaignId], references: [id])
  locationId String?
  location Location? @relation(fields: [locationId], references: [id])

  name String
  description String?
  eventType String  // "story" | "kingdom" | "party" | "world"

  scheduledAt DateTime?  // World time when event is scheduled
  occurredAt DateTime?   // World time when event occurred
  isCompleted Boolean @default(false)

  variables Json @default("{}")  // Custom event data

  version Int @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  archivedAt DateTime?

  // Conditions, Effects, Links are stored polymorphically
  // Query using: Condition.entityType='event' && Condition.entityId=this.id

  @@index([campaignId])
  @@index([locationId])
  @@index([deletedAt])
  @@index([archivedAt])
  @@index([scheduledAt])
  @@index([isCompleted])
  @@index([eventType])
}
```

---

## 4. SPECIAL FEATURES

### PostGIS/Spatial Types

**Location.geom Field:**

- Type: `Unsupported("geometry")` (PostGIS geometry type)
- SRID: 3857 (Web Mercator projection)
- Can store: POINT, POLYGON, MULTIPOLYGON, LINESTRING, etc.
- Index: Manual GIST index created via migration
  ```sql
  CREATE INDEX "Location_geom_gist_idx" ON "Location" USING gist (geom);
  ```

**Campaign.srid Field:**

- Configurable per campaign
- Default: 3857 (Web Mercator)
- Allows different campaigns to use different coordinate systems
- Used when querying spatial data for that campaign

**Why Unsupported("geometry")?**

- Prisma doesn't have native PostGIS type support
- Using raw SQL for spatial queries
- ORM handles polymorphic relationships but not spatial operations

### JSON/JSONB Fields

**Purpose:** Store flexible, schema-less data

| Model                | Field             | Purpose                                            |
| -------------------- | ----------------- | -------------------------------------------------- |
| `World`              | `calendars`       | Custom calendar system definitions                 |
| `World`              | `settings`        | World-level configuration                          |
| `Campaign`           | `settings`        | Campaign-specific settings                         |
| `Party`              | `variables`       | Typed custom variables (treasury, morale)          |
| `Kingdom`            | `variables`       | Political/economic variables                       |
| `Settlement`         | `variables`       | Settlement characteristics                         |
| `Structure`          | `variables`       | Building-specific data                             |
| `Character`          | `variables`       | Stats, inventory, spells, etc.                     |
| `Encounter`          | `variables`       | Custom encounter data                              |
| `Event`              | `variables`       | Custom event data                                  |
| `StateVariable`      | `value`           | Variable value (stored as JSON)                    |
| `StateVariable`      | `formula`         | JSONLogic expression for computed values           |
| `Condition`          | `expression`      | JSONLogic expression                               |
| `Effect`             | `payload`         | Effect-specific data (JSON Patch operations)       |
| `EffectExecution`    | `context`         | Entity state snapshot before execution             |
| `EffectExecution`    | `result`          | Execution result (patches applied, success status) |
| `CampaignMembership` | `permissions`     | Array of custom permission strings                 |
| `ApiKey`             | `scopes`          | Array of API scopes                                |
| `FieldCondition`     | `expression`      | JSONLogic expression                               |
| `Audit`              | `changes`         | JSON diff (legacy, use diff instead)               |
| `Audit`              | `previousState`   | Full entity state before operation                 |
| `Audit`              | `newState`        | Full entity state after operation                  |
| `Audit`              | `diff`            | Computed structured diff                           |
| `MergeHistory`       | `resolutionsData` | Conflict resolutions applied                       |
| `MergeHistory`       | `metadata`        | Merge context (strategy, notes)                    |
| `Version`            | `payloadGz`       | Compressed entity snapshot (gzip)                  |

**VariableSchemas Pattern:**
Many entities have `variableSchemas Json @default("[]")` - an array of schema definitions that validate against the `variables` field:

```json
[
  {
    "name": "treasury",
    "type": "integer",
    "description": "Gold coins in party treasury"
  },
  {
    "name": "morale",
    "type": "float",
    "min": 0,
    "max": 100
  }
]
```

### Enums

**CampaignRole:**

```typescript
enum CampaignRole {
  OWNER   // Campaign owner, full control
  GM      // Game Master, can modify world
  PLAYER  // Player, controls own characters
  VIEWER  // Read-only access
}
```

**EffectTiming:**

```typescript
enum EffectTiming {
  PRE         // Execute before encounter/event resolution
  ON_RESOLVE  // Execute during resolution (default)
  POST        // Execute after resolution
}
```

### Indexes

**Purpose:** Optimize query performance

**Types of Indexes:**

1. **Single-Column Indexes** (common lookups):

   ```typescript
   @@index([email])        // User lookup by email
   @@index([deletedAt])    // Filter out deleted records
   @@index([campaignId])   // Filter by campaign
   @@index([type])         // Filter by entity type
   @@index([isActive])     // Filter active records
   @@index([role])         // Filter by role
   ```

2. **Composite Indexes** (query optimization):

   ```typescript
   @@index([scope, scopeId, key])           // StateVariable lookup
   @@index([entityType, entityId])          // Polymorphic queries
   @@index([entityType, entityId, timing])  // Effect queries by timing
   @@index([userId, campaignId])            // Membership lookup
   @@index([entityType, entityId, executedAt])  // Audit trail pagination
   ```

3. **Unique Indexes** (constraints):

   ```typescript
   @@unique([email])                        // User email uniqueness
   @@unique([userId, roleId])               // Prevent duplicate role assignments
   @@unique([scope, scopeId, key, deletedAt])  // State variable uniqueness with soft delete
   @@unique([sourceType, sourceId, targetType, targetId, linkType])  // Link uniqueness
   ```

4. **Partial Indexes** (sparse data via migration):

   ```sql
   -- Sparse index for updatedBy (many NULLs)
   CREATE INDEX "StateVariable_updatedBy_idx"
     ON "StateVariable"("updatedBy")
     WHERE "updatedBy" IS NOT NULL;
   ```

5. **Spatial Indexes** (PostGIS, via migration):
   ```sql
   CREATE INDEX "Location_geom_gist_idx" ON "Location" USING gist (geom);
   ```

### Cascade Behaviors

**OnDelete: Cascade** - Delete related records when parent deleted:

```typescript
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

Examples:

- User deleted → RefreshToken, ApiKey, UserRole, CampaignMembership deleted
- Campaign deleted → Branch, Party, Kingdom, Character, Encounter, Event deleted
- Effect deleted → EffectExecution deleted
- Branch deleted → Version, MergeHistory records related to branch still queryable

**OnDelete: Restrict** - Prevent deletion if related records exist:

```typescript
creator User @relation("StateVariableCreator", fields: [createdBy], references: [id], onDelete: Restrict)
```

**OnDelete: Set Null** - Set foreign key to NULL when parent deleted:

```typescript
updater User? @relation("StateVariableUpdater", fields: [updatedBy], references: [id], onDelete: Set Null)
```

---

## 5. DESIGN PATTERNS

### Polymorphic Relationships Pattern

**Problem:** Multiple entity types (Encounter, Event) need Conditions, Effects, and Links without creating separate tables for each combination.

**Solution:** Store `entityType` and `entityId` without FK constraints.

**Implementation:**

```typescript
model Condition {
  entityType String  // "encounter" | "event"
  entityId String    // ID (no FK constraint)
  @@index([entityType, entityId])
}

model Effect {
  entityType String  // "encounter" | "event"
  entityId String    // ID (no FK constraint)
  @@index([entityType, entityId, timing])
}
```

**Application Enforcement:**

```typescript
// When creating a Condition
if (entityType === 'encounter') {
  const encounter = await prisma.encounter.findUnique({ where: { id: entityId } });
  if (!encounter) throw new Error('Encounter not found');
}
```

**Advantages:**

- Flexible entity types without schema changes
- Avoids separate tables for each type combination
- Query polymorphic data efficiently

**Disadvantages:**

- No database-level referential integrity
- Application must enforce consistency
- Requires careful data validation

### Hierarchical/Tree Structure Pattern

**Location Hierarchy:**

```typescript
model Location {
  parentLocationId String?
  parent Location? @relation("LocationHierarchy", fields: [parentLocationId], references: [id])
  children Location[] @relation("LocationHierarchy")
}
```

**Supports:**

- Continent → Country → Region → Settlement → District
- Deep nesting without separate models
- Efficient querying of direct children via `children` relation
- Recursive parent traversal via `parent` relation

**Branch Hierarchy (Versioning):**

```typescript
model Branch {
  parentId String?
  parent Branch? @relation("BranchForks", fields: [parentId], references: [id])
  children Branch[] @relation("BranchForks")
}
```

**For Querying Entire Ancestor Chain:**
Use raw SQL (Prisma doesn't support recursive queries in ORM):

```sql
WITH RECURSIVE hierarchy AS (
  SELECT * FROM "Location" WHERE id = $1
  UNION ALL
  SELECT l.* FROM "Location" l
  INNER JOIN hierarchy h ON l.id = h."parentLocationId"
)
SELECT * FROM hierarchy;
```

### Versioning System (Bitemporal) Pattern

**Models Involved:**

- `Branch` - Timeline variant
- `Version` - Historical snapshots
- `MergeHistory` - Branch merge operations

**Key Concepts:**

```typescript
model Version {
  entityType String    // What entity is versioned
  entityId String      // Which entity instance
  branchId String      // Which timeline/branch
  validFrom DateTime   // World time: when version starts
  validTo DateTime?    // World time: when version ends (null = current)
  payloadGz Bytes      // Compressed entity snapshot
  version Int          // For concurrent edit detection
  createdAt DateTime   // System time: when recorded
  createdBy String     // Who made the change
}
```

**Timeline Queries:**

```typescript
// Get current state of an entity on a branch
const currentVersion = await prisma.version.findFirst({
  where: {
    entityType: 'encounter',
    entityId: encounterId,
    branchId: branchId,
    validTo: null, // Current version
  },
});

// Get entity state at a specific world time
const historicalVersion = await prisma.version.findFirst({
  where: {
    entityType: 'encounter',
    entityId: encounterId,
    branchId: branchId,
    validFrom: { lte: worldTime },
    OR: [{ validTo: null }, { validTo: { gte: worldTime } }],
  },
});

// Get entire version history for an entity
const history = await prisma.version.findMany({
  where: {
    entityType: 'encounter',
    entityId: encounterId,
  },
  orderBy: { validFrom: 'asc' },
});
```

**Advantages:**

- Query any entity at any point in campaign history
- Support multiple alternate timelines (branches)
- Audit trail with world time context
- Merge two timelines with conflict detection

### Typed Variables Pattern

**Problem:** Entities need custom fields validated against a schema.

**Solution:** Store data as JSON with separate schema definitions.

**Example - Party:**

```typescript
model Party {
  variables Json @default("{}")           // {"treasury": 5000, "morale": 75}
  variableSchemas Json @default("[]")     // Schema definitions
}

// In application:
const schema = [
  { name: "treasury", type: "integer", min: 0 },
  { name: "morale", type: "float", min: 0, max: 100 }
];

const variables = {
  treasury: 5000,
  morale: 75
};
```

**Validation Logic (Application):**

```typescript
function validateVariables(variables: Json, schemas: Json) {
  for (const schema of schemas) {
    const value = variables[schema.name];
    if (typeof value !== schema.type) {
      throw new Error(`${schema.name} must be ${schema.type}`);
    }
    if (schema.min !== undefined && value < schema.min) {
      throw new Error(`${schema.name} must be >= ${schema.min}`);
    }
  }
}
```

**Advantages:**

- No schema migration for new custom fields
- Each entity can have different variable sets
- Runtime validation
- Flexible data model

### Audit Trail Pattern

**Audit Model:**

```typescript
model Audit {
  entityType String      // Which entity type changed
  entityId String        // Which entity instance
  operation String       // "CREATE" | "UPDATE" | "DELETE"
  userId String          // Who made the change

  // Legacy field
  changes Json           // JSON diff (deprecated, use diff)

  // Enhanced fields (TICKET-032)
  previousState Json?    // Full state before
  newState Json?         // Full state after
  diff Json?             // Structured diff
  reason String?         // Why the change was made

  timestamp DateTime     // When the change occurred
  metadata Json          // Context (IP, user agent, etc.)
}
```

**Complete Audit Trail for Entity:**

```typescript
const auditTrail = await prisma.audit.findMany({
  where: {
    entityType: 'encounter',
    entityId: encounterId,
  },
  orderBy: { timestamp: 'desc' },
});
```

**Audit with User Context:**

```typescript
const auditWithUser = await prisma.audit.findMany({
  where: { entityId: encounterId },
  include: { user: true }, // Get who made the change
});
```

### Soft Delete Pattern

**Implementation:**

```typescript
model Entity {
  deletedAt DateTime?

  @@index([deletedAt])
}
```

**Query Active Records:**

```typescript
// Exclude deleted
const active = await prisma.entity.findMany({
  where: { deletedAt: null },
});
```

**Query Deleted Records:**

```typescript
const deleted = await prisma.entity.findMany({
  where: { NOT: { deletedAt: null } },
});
```

**Restore Deleted Record:**

```typescript
await prisma.entity.update({
  where: { id },
  data: { deletedAt: null },
});
```

**Actually Delete (Hard Delete):**

```typescript
await prisma.entity.delete({
  where: { id },
});
```

### Effect System Pattern

**Execution Flow:**

1. Create Effect with payload containing JSON Patch operations
2. Associate Effect with Encounter/Event (polymorphic)
3. When condition met, execute effect:
   - Apply patches to entity state
   - Record execution in EffectExecution
   - Store result (patches applied, affected fields)

**Effect Payload Example:**

```json
{
  "type": "json-patch",
  "operations": [
    { "op": "add", "path": "/variables/morale", "value": 10 },
    { "op": "replace", "path": "/variables/treasure", "value": 5000 }
  ]
}
```

**Execution Audit:**

```typescript
model EffectExecution {
  effectId String        // Which effect was executed
  entityType String      // "encounter" or "event"
  entityId String        // ID of entity that triggered it
  executedAt DateTime    // When executed
  executedBy String      // Which user triggered it
  context Json           // Entity state before (snapshot)
  result Json            // Patches applied + success status
  error String?          // Error if execution failed
}
```

---

## 6. KEY RELATIONSHIPS SUMMARY TABLE

| Source          | Target             | Cardinality | Type                 | Notes                          |
| --------------- | ------------------ | ----------- | -------------------- | ------------------------------ |
| User            | Role               | M:N         | Junction (UserRole)  | Role-based access control      |
| User            | Campaign           | 1:N         | FK (ownerId)         | User owns campaigns            |
| User            | CampaignMembership | 1:N         | FK                   | User participates in campaigns |
| User            | RefreshToken       | 1:N         | FK with cascade      | Auth token per user            |
| User            | ApiKey             | 1:N         | FK with cascade      | API access per user            |
| User            | Version            | 1:N         | FK                   | Audit trail creator            |
| User            | Audit              | 1:N         | FK                   | Audit trail actor              |
| Campaign        | World              | N:1         | FK                   | Multiple campaigns per world   |
| Campaign        | Branch             | 1:N         | FK with cascade      | Alternate timelines            |
| Campaign        | Party              | 1:N         | FK with cascade      | Groups within campaign         |
| Campaign        | Kingdom            | 1:N         | FK with cascade      | Political entities             |
| Campaign        | Character          | 1:N         | FK with cascade      | All actors                     |
| Campaign        | Encounter          | 1:N         | FK with cascade      | Combat/interactions            |
| Campaign        | Event              | 1:N         | FK with cascade      | Story events                   |
| Party           | Character          | 1:N         | FK                   | Party membership               |
| Kingdom         | Settlement         | 1:N         | FK                   | Political hierarchy            |
| Settlement      | Location           | 1:1         | FK with unique       | Location anchor                |
| Settlement      | Structure          | 1:N         | FK                   | Buildings in settlement        |
| Location        | Location           | 1:N         | Self-referential     | Parent-child hierarchy         |
| Location        | Settlement         | 1:1         | Reverse FK           | One settlement per location    |
| Location        | Encounter          | 1:N         | FK optional          | Where encounters happen        |
| Location        | Event              | 1:N         | FK optional          | Where events occur             |
| Branch          | Branch             | 1:N         | Self-referential     | Branch divergence              |
| Branch          | Version            | 1:N         | FK                   | Versions on this branch        |
| Branch          | MergeHistory       | 1:N         | FK (source & target) | Merge operations               |
| StateVariable   | \*                 | Polymorphic | Weak FK              | Variables for multiple scopes  |
| Condition       | Encounter/Event    | Polymorphic | No FK                | Attached to entities           |
| Effect          | Encounter/Event    | Polymorphic | No FK                | Actions on entities            |
| Effect          | EffectExecution    | 1:N         | FK with cascade      | Execution history              |
| EffectExecution | \*                 | Polymorphic | No FK                | Records execution              |
| Dependency      | StateVariable      | N:1         | FK                   | Source variable                |
| Dependency      | \*                 | Polymorphic | No FK                | Target entity                  |
| Link            | Encounter/Event    | Polymorphic | No FK                | Relationships between entities |
| FieldCondition  | User               | N:1         | FK                   | Created/updated by             |

---

## 7. SPECIAL MIGRATION NOTES

### Polymorphic Foreign Key Removal (2025-11-09)

Migration `20251109152229_remove_polymorphic_fk_constraints` removed FK constraints from:

- `Condition` (was constrained to Encounter/Event)
- `Effect` (was constrained to Encounter/Event)

**Reason:** Polymorphic FKs don't work well in PostgreSQL with multiple possible target tables.

**Application Requirement:** Application code must validate that entityType/entityId pairs reference valid entities.

### StateVariable Audit Fields Update (2025-10-17)

Migration `20251017140736_update_state_variable_model` added comprehensive audit support:

- `createdBy` and `updatedBy` user tracking
- Formula support for computed derived variables
- Type validation with CHECK constraints
- Sparse index on `updatedBy` for memory efficiency

### Audit Enhancement (2025-11-09)

Migration `20251109152229_remove_polymorphic_fk_constraints` also added enhanced audit fields:

- `previousState` - Full entity state before operation
- `newState` - Full entity state after operation
- `diff` - Structured diff (instead of legacy `changes`)
- `reason` - User-provided rationale for change

### Effect Timing & Execution (2025-10-18)

Migration `20251018041515_add_effect_timing_and_execution` added:

- `EffectTiming` enum (PRE, ON_RESOLVE, POST)
- `EffectExecution` model for recording effect applications
- Audit trail via `context` (before) and `result` (after)
- Composite indexes for efficient audit trail queries

---

## 8. QUERY PATTERNS & EXAMPLES

### Soft Delete Filtering

```typescript
// Active entities only
const active = await prisma.campaign.findMany({
  where: { deletedAt: null },
});

// Include deleted
const all = await prisma.campaign.findMany({
  // no filter
});

// Deleted only
const deleted = await prisma.campaign.findMany({
  where: { NOT: { deletedAt: null } },
});
```

### Hierarchical Queries

```typescript
// Get entire location tree
const locations = await prisma.location.findMany({
  include: { children: true, parent: true },
});

// Get direct children of a location
const children = await prisma.location.findUnique({
  where: { id: locationId },
  include: { children: true },
});

// Get all ancestors (requires raw SQL)
const ancestors = await prisma.$queryRaw`
  WITH RECURSIVE hierarchy AS (
    SELECT * FROM "Location" WHERE id = $1
    UNION ALL
    SELECT l.* FROM "Location" l
    INNER JOIN hierarchy h ON l.id = h."parentLocationId"
  )
  SELECT * FROM hierarchy;
`;
```

### Polymorphic Queries

```typescript
// Get all conditions for an encounter
const conditions = await prisma.condition.findMany({
  where: {
    entityType: 'encounter',
    entityId: encounterId,
  },
});

// Get all effects for an event (ordered by timing then priority)
const effects = await prisma.effect.findMany({
  where: {
    entityType: 'event',
    entityId: eventId,
  },
  orderBy: [
    { timing: 'asc' }, // PRE, ON_RESOLVE, POST
    { priority: 'asc' },
  ],
});

// Get links between two events
const links = await prisma.link.findMany({
  where: {
    sourceType: 'event',
    sourceId: sourceEventId,
    targetType: 'event',
    targetId: targetEventId,
  },
});
```

### State Variable Queries

```typescript
// Get all active variables for a party
const partyVars = await prisma.stateVariable.findMany({
  where: {
    scope: 'party',
    scopeId: partyId,
    isActive: true,
    deletedAt: null,
  },
});

// Get a specific variable
const morale = await prisma.stateVariable.findFirst({
  where: {
    scope: 'party',
    scopeId: partyId,
    key: 'morale',
    deletedAt: null,
  },
});

// Get all variables of a specific type
const derivedVars = await prisma.stateVariable.findMany({
  where: {
    scope: 'party',
    scopeId: partyId,
    type: 'derived',
  },
});
```

### Audit Trail Queries

```typescript
// Full audit history for an entity
const history = await prisma.audit.findMany({
  where: {
    entityType: 'encounter',
    entityId: encounterId,
  },
  include: { user: true },
  orderBy: { timestamp: 'desc' },
});

// Recent changes by a user
const userChanges = await prisma.audit.findMany({
  where: { userId: userId },
  orderBy: { timestamp: 'desc' },
  take: 50, // Last 50 changes
});

// Changes with detailed state snapshots
const detailedAudit = await prisma.audit.findMany({
  where: { entityId: encounterId },
  select: {
    operation: true,
    timestamp: true,
    user: { select: { name: true } },
    previousState: true,
    newState: true,
    diff: true,
    reason: true,
  },
});
```

### Version/Branching Queries

```typescript
// Current state on a branch
const currentVersion = await prisma.version.findFirst({
  where: {
    entityType: 'encounter',
    entityId: encounterId,
    branchId: branchId,
    validTo: null,
  },
});

// State at a specific world time
const historicalState = await prisma.version.findFirst({
  where: {
    entityType: 'encounter',
    entityId: encounterId,
    branchId: branchId,
    validFrom: { lte: worldTime },
    OR: [{ validTo: null }, { validTo: { gte: worldTime } }],
  },
});

// Full history of an entity across all branches
const allVersions = await prisma.version.findMany({
  where: {
    entityType: 'encounter',
    entityId: encounterId,
  },
  include: { branch: true, user: true },
  orderBy: [{ branchId: 'asc' }, { validFrom: 'asc' }],
});
```

### Effect Execution Queries

```typescript
// When an effect was executed
const executions = await prisma.effectExecution.findMany({
  where: { effectId: effectId },
  orderBy: { executedAt: 'desc' },
});

// Track what state changed when effect executed
const executionAudit = await prisma.effectExecution.findMany({
  where: {
    entityType: 'encounter',
    entityId: encounterId,
  },
  select: {
    effect: { select: { name: true } },
    executedAt: true,
    executedBy: true,
    context: true, // Before state
    result: true, // After state + patches
    error: true,
  },
});
```

---

## Summary

The Prisma schema implements a sophisticated campaign management system with:

1. **Flexible Entity Model** - Typed variables and JSON fields allow custom properties without schema changes
2. **Polymorphic Relationships** - Conditions, Effects, and Links work with multiple entity types
3. **Historical Tracking** - Versions, Audit trail, and soft deletes provide complete history
4. **Branching System** - Alternate timelines with merge capability
5. **Spatial Awareness** - PostGIS integration for map-based features
6. **Role-Based Access** - Users, roles, permissions, and campaign memberships
7. **Audit Compliance** - Complete change tracking with state snapshots and user attribution
8. **Optimistic Locking** - Version fields prevent concurrent edit conflicts

All models follow consistent patterns for:

- Automatic timestamps (createdAt, updatedAt)
- Soft deletion (deletedAt)
- Optimistic locking (version)
- Comprehensive indexing for query performance
