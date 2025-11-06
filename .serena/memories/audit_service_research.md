# AuditService Research & Enhancement Plan

## Current Implementation

### AuditService Location

`/storage/programs/campaign_manager/packages/api/src/graphql/services/audit.service.ts`

### Current API

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

### Current Features

- Logs all mutations via `prisma.audit.create()`
- Supports 8 operation types: CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, CHERRY_PICK
- Accepts optional metadata (IP address, user agent, etc.)
- Non-blocking error handling - doesn't throw errors, just logs failures
- Currently stores ALL data in a single `changes` JSON field

### Error Handling Pattern

- Wraps in try-catch to prevent breaking main operations
- Logs failures with context (entityType, entityId, operation, error message, stack trace)

## Prisma Schema (Current)

```prisma
model Audit {
  id         String   @id @default(cuid())
  entityType String
  entityId   String
  operation  String
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  changes    Json     // Currently stores all change data
  metadata   Json     @default("{}")
  timestamp  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
  @@index([operation])
}
```

## Usage Patterns Across Services

### Settlement Service

- CREATE: logs `{ name, kingdomId, locationId, level }`
- UPDATE: logs the entire `updateData` object passed to DB update
- DELETE: logs `{ deletedAt }`
- ARCHIVE: logs `{ archivedAt }`
- RESTORE: logs `{ archivedAt: null }`

### Structure Service

- Similar pattern to Settlement
- CREATE: logs new entity data
- UPDATE: logs change object
- DELETE, ARCHIVE, RESTORE: logs the status field changes

### Event Service

- Same patterns as Settlement/Structure
- UPDATE: logs partial data containing only changed fields
- CREATE: logs new entity data

### Merge Service

- Uses audit.log for version merges
- Creates entries with entityType = 'version'
- entityId = `${sourceVersion.entityType}:${sourceVersion.entityId}`
- Includes complex merge metadata

## Existing Diff Utilities

### Location

`/storage/programs/campaign_manager/packages/api/src/graphql/utils/version.utils.ts`

### VersionDiff Interface

```typescript
export interface VersionDiff {
  added: Record<string, unknown>;
  modified: Record<string, { old: unknown; new: unknown }>;
  removed: Record<string, unknown>;
}
```

### Available Functions

- `calculateDiff(oldPayload, newPayload): VersionDiff` - compares two objects
- `compressPayload(payload): Promise<Buffer>` - gzip compression
- `decompressPayload(compressed): Promise<Record<string, unknown>>` - decompression
- `deepEqual(a, b): boolean` - recursive deep equality with depth limit (max 50 levels)

### Implementation Details

- Uses custom diff calculation (not a library)
- Detects added, modified, and removed fields
- Handles nested objects and arrays
- Has depth limit protection to prevent stack overflow

## Dependencies

- **fast-json-patch**: ^3.1.1 - available but NOT currently used by audit service
- **@types/fast-json-patch**: ^1.1.7

## Backward Compatibility Considerations

### Current Usage Pattern

All current calls to `audit.log()` pass changes in format:

- CREATE: new entity fields
- UPDATE: changed field object (not necessarily complete before/after)
- DELETE/ARCHIVE/RESTORE: status field changes

### Services Not Using Audit (Found So Far)

- User/Auth services - may need audit coverage
- API Key service - may need audit coverage
- Character service - needs checking
- Location service - needs checking

## Recommendations for Enhancement

### API Enhancement Strategy (Backward Compatible)

1. Keep existing signature as-is
2. Add optional parameters for enhanced data:

   ```typescript
   async log(
     entityType: string,
     entityId: string,
     operation: AuditOperation,
     userId: string,
     changes: Record<string, unknown>,
     metadata?: Record<string, unknown>,
     previousState?: Record<string, unknown>,  // NEW (optional)
     newState?: Record<string, unknown>,        // NEW (optional)
     reason?: string                            // NEW (optional)
   ): Promise<void>
   ```

3. If previousState & newState provided, auto-calculate diff
4. If not provided, populate from existing changes field as before
5. Update Prisma schema to add:
   - `previousState Json?` (nullable)
   - `newState Json?` (nullable)
   - `diff Json?` (nullable)
   - `reason String?` (nullable)

### Diff Generation Strategy

- Use existing `calculateDiff` utility from version.utils.ts
- Or import `fast-json-patch` if deeper tracking needed
- Version.utils approach is simpler and already proven

### Migration Strategy

1. Gradual rollout - new services use enhanced API
2. Existing services continue working without changes
3. Over time, refactor high-value services (Settlement, Structure, Event) to pass previousState/newState
4. Merge service should definitely pass full state

### Fields to Populate in Changes (Current Behavior)

- For CREATE: new entity field values
- For UPDATE: only the fields that changed (not full before/after)
- For DELETE: deletion timestamp
- For ARCHIVE: archive timestamp
- This is currently the "changes" field behavior

### New Fields to Add

- **previousState**: Full state before operation (when available)
- **newState**: Full state after operation (when available)
- **diff**: Calculated difference (added, modified, removed)
- **reason**: Human-readable reason for change (e.g., "User requested update")

## Dependencies Check

- All required libraries already available
- No new npm packages needed
- fast-json-patch available but not required for basic diff

## Next Steps

1. Update Prisma schema with new optional fields
2. Create migration for schema changes
3. Update AuditService.log() with enhanced signature
4. Create utility function to auto-generate diff from previousState/newState
5. Update high-priority services (Settlement, Structure, Event, Merge) to pass new parameters
6. Update tests to cover new fields
7. Update GraphQL type definitions to expose new fields
