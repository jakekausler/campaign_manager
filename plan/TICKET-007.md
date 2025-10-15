# TICKET-007: Versioning System Implementation

## Status

- [ ] Completed
- **Commits**:

## Description

Implement bitemporal versioning system that tracks all changes to entities over world-time, enabling time-travel queries, audit trails, and support for branching timelines.

## Scope of Work

1. Create VersionService for managing entity versions:
   - Create new version on entity update (all fields versioned)
   - Query versions by entity + branch + time range
   - Resolve "current" version for given context
   - Compress payloads using gzip before storage
2. Implement version resolution logic:
   - Branch inheritance (child branches inherit parent versions)
   - Temporal queries (as-of world time)
   - Conflict detection between branches
3. Add versioning to entity services:
   - Wrap all update operations to create versions
   - Implement `getEntityAsOf(id, branchId, worldTime)`
   - Track field-level changes in version payload
   - All entity fields are versioned (no exceptions)
4. Implement concurrent edit detection:
   - Track entity version number/timestamp
   - Detect when entity was modified during edit session
   - Notify via GraphQL subscription when entity updated by another user
   - Prevent save with optimistic locking error
   - Require user to refresh state before saving
5. Create version history API:
   - GraphQL query: `entityVersions(entityId, entityType)`
   - GraphQL subscription: `entityModified(entityId)` for concurrent edit notifications
   - Get version diff between two versions
   - Restore entity to previous version
6. Implement version metadata:
   - Track creator and creation timestamp
   - Optional change comment (not required)
   - Calculate diff from previous version
7. Create utility functions:
   - JSON compression/decompression (gzip)
   - JSON diff calculator
   - Version merge helpers (for branch merging)
   - Temporal range queries

## Acceptance Criteria

- [ ] Updating any entity creates a Version record (all fields versioned)
- [ ] Version payloads are compressed with gzip
- [ ] Versions are kept forever (no pruning)
- [ ] Can query entity state as-of any world time
- [ ] Version history shows all changes chronologically
- [ ] Diffs accurately show what changed between versions
- [ ] Branch inheritance resolves versions correctly
- [ ] Can restore entity to previous version
- [ ] Version queries perform efficiently with indexes
- [ ] Concurrent edit detection works via GraphQL subscription
- [ ] Optimistic locking prevents concurrent saves
- [ ] User notified when entity modified by another user
- [ ] Version payload validates against entity schema
- [ ] Compression/decompression works correctly

## Technical Notes

### Version Resolution Algorithm

```typescript
async resolveVersion(
  entityType: string,
  entityId: string,
  branchId: string,
  asOf: Date,
): Promise<Version | null> {
  // 1. Try exact branch match
  let version = await this.findVersionInBranch(
    entityType,
    entityId,
    branchId,
    asOf,
  );

  if (version) return version;

  // 2. Walk up branch ancestry
  const branch = await this.branchService.findById(branchId);
  if (branch.parentBranchId) {
    return this.resolveVersion(
      entityType,
      entityId,
      branch.parentBranchId,
      asOf,
    );
  }

  return null;
}

private async findVersionInBranch(
  entityType: string,
  entityId: string,
  branchId: string,
  asOf: Date,
): Promise<Version | null> {
  return this.prisma.version.findFirst({
    where: {
      entityType,
      entityId,
      branchId,
      validFrom: { lte: asOf },
      OR: [
        { validTo: { gt: asOf } },
        { validTo: null }, // current version
      ],
    },
    orderBy: { validFrom: 'desc' },
  });
}
```

### Versioned Update Pattern

```typescript
async updateCampaign(
  id: string,
  input: UpdateCampaignInput,
  context: VersionContext,
  user: User,
): Promise<Campaign> {
  // Get current version
  const currentVersion = await this.versionService.resolveVersion(
    'campaign',
    id,
    context.branchId,
    context.worldTime,
  );

  // Close current version
  if (currentVersion) {
    await this.versionService.closeVersion(
      currentVersion.id,
      context.worldTime,
    );
  }

  // Create new version
  const newVersion = await this.versionService.createVersion({
    entityType: 'campaign',
    entityId: id,
    branchId: context.branchId,
    validFrom: context.worldTime,
    validTo: null,
    payloadJson: { ...currentVersion.payloadJson, ...input },
    createdBy: user.id,
  });

  return this.mapVersionToCampaign(newVersion);
}
```

### Diff Calculation

```typescript
interface VersionDiff {
  added: Record<string, unknown>;
  modified: Record<string, { old: unknown; new: unknown }>;
  removed: Record<string, unknown>;
}

calculateDiff(oldVersion: Version, newVersion: Version): VersionDiff {
  // Decompress payloads first
  const oldData = this.decompress(oldVersion.payloadJson);
  const newData = this.decompress(newVersion.payloadJson);

  return {
    added: this.getAddedFields(oldData, newData),
    modified: this.getModifiedFields(oldData, newData),
    removed: this.getRemovedFields(oldData, newData),
  };
}
```

### Compression Implementation

```typescript
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

async compressPayload(payload: object): Promise<Buffer> {
  const jsonString = JSON.stringify(payload);
  return await gzip(jsonString);
}

async decompressPayload(compressed: Buffer): Promise<object> {
  const decompressed = await gunzip(compressed);
  return JSON.parse(decompressed.toString());
}

// Store in database as BYTEA type
model Version {
  id           String   @id @default(cuid())
  entityType   String
  entityId     String
  branchId     String
  validFrom    DateTime
  validTo      DateTime?
  payloadGz    Bytes    // Compressed payload
  createdAt    DateTime @default(now())
  createdBy    String
  comment      String?  // Optional change comment
  version      Int      // For optimistic locking

  @@index([entityType, entityId, branchId, validFrom, validTo])
  @@index([entityType, entityId, version]) // For concurrent edit detection
}
```

### Concurrent Edit Detection

```typescript
// Add version field to entity
interface Entity {
  id: string;
  version: number; // Incremented on each update
  // ... other fields
}

// Mutation with optimistic locking
@Mutation(() => Campaign)
async updateCampaign(
  @Args('id') id: string,
  @Args('version') expectedVersion: number,
  @Args('input') input: UpdateInput,
): Promise<Campaign> {
  const current = await this.service.findById(id);

  if (current.version !== expectedVersion) {
    throw new OptimisticLockException(
      `Entity was modified. Expected version ${expectedVersion}, found ${current.version}`
    );
  }

  // Update with version increment
  const updated = await this.service.update(id, input, current.version + 1);

  // Publish modification event
  await this.pubSub.publish(`entity.modified.${id}`, {
    entityModified: { id, version: updated.version },
  });

  return updated;
}

// Subscription for concurrent edit notification
@Subscription(() => EntityModified)
entityModified(@Args('entityId') entityId: string) {
  return this.pubSub.asyncIterator(`entity.modified.${entityId}`);
}
```

## Architectural Decisions

- **Immutable versions**: Never modify existing versions, always create new
- **Null validTo**: Indicates current/open version
- **Branch resolution**: Walk ancestry chain if version not in current branch
- **Payload storage**: Full snapshot in each version (not deltas)
- **Compression**: gzip compression for all payloads to reduce storage
- **Version retention**: Keep all versions forever (no pruning)
- **All fields versioned**: No exceptions, all entity fields are versioned
- **Version comments**: Optional, not required
- **Concurrent edits**: Optimistic locking with version number + GraphQL subscription notifications
- **Performance**: Index on (entityType, entityId, branchId, validFrom, validTo, version)

## Dependencies

- Requires: TICKET-006 (Entity CRUD operations)
- Requires: TICKET-005 (GraphQL subscriptions)

## Testing Requirements

- [ ] Creating version stores complete compressed payload
- [ ] Compression/decompression round-trip preserves data
- [ ] Updating entity creates new version and closes previous
- [ ] Querying as-of past time returns correct version
- [ ] Branch inheritance finds parent versions
- [ ] Version diff shows accurate changes
- [ ] Restoring version recreates entity state
- [ ] Concurrent updates detected by version mismatch
- [ ] Optimistic locking throws error on version conflict
- [ ] GraphQL subscription notifies of entity modifications
- [ ] Query performance acceptable with many versions
- [ ] Version validation prevents invalid payloads
- [ ] All entity fields are properly versioned
- [ ] Versions kept forever (no pruning)

## Related Tickets

- Requires: TICKET-006
- Blocks: TICKET-011, TICKET-022, TICKET-027, TICKET-031

## Estimated Effort

4-5 days
