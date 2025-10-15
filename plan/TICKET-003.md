# TICKET-003: Database Schema Design & Prisma Setup

## Status

- [ ] Completed
- **Commits**:

## Description

Design and implement the complete database schema using Prisma ORM with PostGIS support, including all core entities, versioning tables, and spatial types. Set up migrations and seed data framework.

## Scope of Work

1. Initialize Prisma in the API package
2. Configure Prisma for PostgreSQL with PostGIS extension
3. Design and implement schema for core entities:
   - `World`, `Campaign`, `Branch`
   - `Party`, `Kingdom`, `Settlement`, `Structure`, `Character`
   - `Location` (with PostGIS geometry)
   - `Encounter`, `Event`
   - `StateVariable`, `Link`, `Condition`, `Effect`
   - `VariableSchema` (typed variable definitions)
   - `Version` (bitemporal versioning)
   - `Dependency` (for dependency graph)
   - `Audit` (audit trail with every mutation tracked)
   - `User`, `Role`, `Permission` (auth)
4. Add soft delete fields:
   - Add `deletedAt` DateTime? field to all mutable entities
   - Entities are never hard deleted, only marked with deletedAt timestamp
5. Set up database indexes:
   - Spatial indexes on Location.geom (GIST index)
   - B-tree indexes on version valid_from/valid_to
   - Indexes on foreign keys and frequently queried fields
   - Index on deletedAt for filtering active records
6. Create Prisma migrations
7. Set up seed script framework
8. Create database utility functions (connection pooling, transaction helpers, soft delete helpers)

## Acceptance Criteria

- [ ] Prisma schema compiles without errors
- [ ] Prisma Client generates successfully
- [ ] Initial migration runs successfully against Postgres
- [ ] PostGIS extension is enabled and geometry types work
- [ ] All entity relationships are properly defined
- [ ] Indexes are created for performance-critical queries
- [ ] Seed script runs and creates sample data
- [ ] Can query spatial data using PostGIS functions via Prisma
- [ ] Soft delete functionality works (deletedAt field)
- [ ] Audit records created for all mutations
- [ ] CUID IDs generate correctly

## Technical Notes

### Prisma Schema Highlights

```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  extensions = [postgis]
}

model World {
  id        String   @id @default(cuid())
  name      String
  calendars Json     // Custom JSON schema for calendar systems
  campaigns Campaign[]
  locations Location[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([deletedAt])
}

model Campaign {
  id            String   @id @default(cuid())
  worldId       String
  world         World    @relation(fields: [worldId], references: [id])
  branchRootId  String?
  settings      Json
  parties       Party[]
  kingdoms      Kingdom[]
  characters    Character[]
  encounters    Encounter[]
  events        Event[]
  branches      Branch[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  @@index([worldId])
  @@index([deletedAt])
}

model Party {
  id                  String   @id @default(cuid())
  campaignId          String
  campaign            Campaign @relation(fields: [campaignId], references: [id])
  name                String
  averageLevel        Int?     // Computed from members, can be null if no members
  manualLevelOverride Int?     // Override computed level
  variables           Json     // Typed variables validated against schemas
  variableSchemas     Json     // Array of VariableSchema definitions
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  deletedAt           DateTime?

  @@index([campaignId])
  @@index([deletedAt])
}

model Kingdom {
  id              String   @id @default(cuid())
  campaignId      String
  campaign        Campaign @relation(fields: [campaignId], references: [id])
  name            String
  level           Int
  variables       Json     // Typed variables validated against schemas
  variableSchemas Json     // Array of VariableSchema definitions
  settlements     Settlement[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  @@index([campaignId])
  @@index([deletedAt])
}

model Version {
  id           String   @id @default(cuid())
  entityType   String   // enum: world, campaign, location, etc.
  entityId     String
  branchId     String
  branch       Branch   @relation(fields: [branchId], references: [id])
  validFrom    DateTime // world time
  validTo      DateTime? // world time, null = current
  payloadJson  Json
  createdAt    DateTime @default(now())
  createdBy    String
  user         User     @relation(fields: [createdBy], references: [id])

  @@index([entityType, entityId, branchId])
  @@index([validFrom, validTo])
}

model Location {
  id              String   @id @default(cuid())
  worldId         String
  world           World    @relation(fields: [worldId], references: [id])
  type            String   // point | region
  geom            Unsupported("geometry")?  // PostGIS type (SRID 3857)
  parentLocationId String?
  parent          Location? @relation("LocationHierarchy", fields: [parentLocationId], references: [id])
  children        Location[] @relation("LocationHierarchy")
  settlements     Settlement[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  @@index([worldId])
  @@index([parentLocationId])
  @@index([deletedAt])
}

model Settlement {
  id              String   @id @default(cuid())
  kingdomId       String
  kingdom         Kingdom  @relation(fields: [kingdomId], references: [id])
  locationId      String
  location        Location @relation(fields: [locationId], references: [id])
  level           Int
  variables       Json     // Typed variables validated against schemas
  variableSchemas Json     // Array of VariableSchema definitions
  structures      Structure[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  @@index([kingdomId])
  @@index([locationId])
  @@index([deletedAt])
}

model Structure {
  id              String   @id @default(cuid())
  settlementId    String
  settlement      Settlement @relation(fields: [settlementId], references: [id])
  type            String   // e.g., 'temple', 'barracks', 'market', 'library'
  level           Int
  variables       Json     // Typed variables validated against schemas
  variableSchemas Json     // Array of VariableSchema definitions
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  @@index([settlementId])
  @@index([type])
  @@index([deletedAt])
}

model Audit {
  id          String   @id @default(cuid())
  entityType  String
  entityId    String
  operation   String   // CREATE, UPDATE, DELETE
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  changes     Json     // Diff of changes
  timestamp   DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
}

// Note: Use Prisma's rawQuery for spatial queries
// Example: SELECT * FROM Location WHERE ST_Within(geom, ST_MakeEnvelope(...))
```

### PostGIS Setup

- Enable extension in migration: `CREATE EXTENSION IF NOT EXISTS postgis;`
- Use `Unsupported("geometry")` for spatial types in Prisma
- Use SRID 3857 (Web Mercator) for flexibility with different map types
- SRID 3857 rationale: Works well for:
  - Regional maps (square/rectangular areas)
  - Town maps with arbitrary scales
  - Fantasy world maps (flat projections)
  - Hand-drawn maps without accurate scale
  - Web mapping libraries (MapLibre, Leaflet)
- Store coordinates in meters (planar), not spherical
- Create custom raw SQL queries for spatial operations
- Create GeoJSON utility to convert to/from PostGIS formats

### Versioning Pattern

- Every mutable entity has corresponding Version records
- `validFrom`/`validTo` define temporal validity (world time)
- `branchId` supports alternate histories
- Query pattern: find version where branch matches (or ancestor) and world time is within valid range

### Soft Delete Pattern

- All mutable entities have `deletedAt` DateTime? field
- Never hard delete records (preserves audit trail and versioning)
- Filter queries: `WHERE deletedAt IS NULL` for active records
- Utility functions: `softDelete(id)`, `restore(id)`, `findActive()`

### Audit Pattern

- Every mutation (CREATE, UPDATE, DELETE) creates an Audit record
- Audit records store:
  - Entity type and ID
  - Operation type
  - User who performed action
  - JSON diff of changes
  - Timestamp
- Implemented via Prisma middleware or service layer decorators

### Calendar System JSON Schema

Custom JSON schema stored in `World.calendars` field:

```json
{
  "calendars": [
    {
      "id": "primary",
      "name": "Absalom Reckoning",
      "monthsPerYear": 12,
      "daysPerMonth": [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
      "monthNames": ["Abadius", "Calistril", ...],
      "epoch": "2700-01-01T00:00:00Z",
      "notes": "Standard fantasy calendar"
    }
  ]
}
```

## Architectural Decisions

- **ORM choice**: Prisma for type safety and migrations
- **Spatial support**: PostGIS via Unsupported() type + raw queries
- **SRID choice**: 3857 (Web Mercator) for flexibility with various map types and scales
- **ID strategy**: CUID for distributed-friendly, sortable unique IDs
- **JSON fields**: Use for flexible/extensible data (payloads, settings, calendars)
- **Versioning**: Store all versions, never delete (audit trail)
- **Soft delete**: All entities use deletedAt field, never hard delete
- **Audit**: Every mutation creates an Audit record (comprehensive tracking)
- **Calendar**: Custom JSON schema stored in World entity

## Dependencies

- Requires: TICKET-002 (Docker infrastructure with Postgres)

## Testing Requirements

- [ ] Can create and query each entity type
- [ ] Foreign key constraints work correctly
- [ ] Version queries return correct records for given branch + time
- [ ] Spatial queries work (point within polygon, distance calculations)
- [ ] Migrations can be rolled back successfully
- [ ] Seed data creates valid relationships
- [ ] Indexes improve query performance (check EXPLAIN ANALYZE)

## Related Tickets

- Requires: TICKET-002
- Blocks: TICKET-005, TICKET-006, TICKET-008

## Estimated Effort

3-4 days
