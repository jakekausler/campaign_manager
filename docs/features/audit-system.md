# Audit System

The Audit System (TICKET-032) provides comprehensive tracking of all entity mutations across the campaign management tool. It records actor, timestamp, operation type, and detailed state changes with automatic diff calculation, enabling full accountability, debugging capabilities, and potential future rollback functionality.

## Overview

- Tracks all CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, and CHERRY_PICK operations on entities
- Captures full before/after state snapshots with automatic diff calculation
- Optional user-provided reason field for explaining changes
- Role-based access control (Owner/GM only)
- Advanced filtering by operation type, date range, and entity type
- Real-time export to CSV/JSON with progress tracking and cancellation support
- Backward-compatible enhancement of existing audit infrastructure
- Non-blocking async logging to minimize performance impact

## Key Components

### Audit Model

Database model defined in `packages/api/prisma/schema.prisma` (lines 712-727)

**Core Fields:**

- `id` - Unique identifier (CUID)
- `entityType` - Type of entity being audited (Settlement, Structure, Event, etc.)
- `entityId` - Unique identifier of the audited entity instance
- `operation` - Type of operation performed (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, CHERRY_PICK)
- `userId` - Foreign key to User who performed the operation
- `user` - Relation to User model
- `timestamp` - When the operation occurred (default: now())

**Legacy Fields (Backward Compatibility):**

- `changes` - JSON field storing change data (legacy format, gradually being phased out)
- `metadata` - JSON field for additional operation context (default: {})

**Enhanced Fields (Added in TICKET-032):**

- `previousState` - Full entity JSON snapshot before the mutation (nullable)
- `newState` - Full entity JSON snapshot after the mutation (nullable)
- `diff` - Structured diff object with added/modified/removed fields (nullable, auto-calculated)
- `reason` - Optional user-provided explanation for the change (nullable, max 500 chars)

**Indexes:**

- Composite: (entityType, entityId) for efficient entity history queries
- Individual: userId for user activity queries
- Individual: timestamp for chronological queries and pagination
- Individual: operation for filtering by operation type

### AuditService

Located at `packages/api/src/graphql/services/audit.service.ts`

Core service for creating audit log entries with automatic diff calculation.

**Main Method:**

```typescript
async log(
  entityType: string,
  entityId: string,
  operation: AuditOperation,
  userId: string,
  changes: Record<string, unknown>,
  metadata?: Record<string, unknown>,
  previousState?: Record<string, unknown>,
  newState?: Record<string, unknown>,
  reason?: string
): Promise<Audit>
```

**Parameters:**

- `entityType` - Type of entity (e.g., 'Settlement', 'Structure', 'Event')
- `entityId` - Unique identifier of the entity instance
- `operation` - Operation type enum (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, CHERRY_PICK)
- `userId` - ID of the user performing the operation
- `changes` - Legacy change data (for backward compatibility)
- `metadata` - Optional additional context (default: {})
- `previousState` - Full entity state before mutation (optional, new in TICKET-032)
- `newState` - Full entity state after mutation (optional, new in TICKET-032)
- `reason` - User-provided explanation (optional, new in TICKET-032)

**Automatic Diff Calculation:**

When both `previousState` and `newState` are provided, the service automatically calculates a structured diff using the existing `calculateDiff` utility from `version.utils.ts`:

```typescript
// Diff format (VersionDiff structure)
{
  added: { fieldName: value },      // Fields present in new but not in previous
  modified: {                        // Fields changed between versions
    fieldName: {
      old: previousValue,
      new: newValue
    }
  },
  removed: { fieldName: value }     // Fields present in previous but not in new
}
```

**Key Features:**

- **Non-blocking Error Handling**: Audit failures are logged but don't block mutations
- **Immutable Operations**: Uses JSON round-trip serialization for type-safe Prisma values
- **Consistent Diff Logic**: Reuses battle-tested `calculateDiff` utility from Version system
- **Backward Compatible**: All enhanced parameters are optional; existing code works unchanged
- **Comprehensive Logging**: Logs success/failure with enhanced data flag for debugging

### GraphQL API

#### Audit Type

Defined in `packages/api/src/graphql/types/audit.type.ts`

```graphql
type Audit {
  id: ID!
  entityType: String!
  entityId: String!
  operation: String!
  userId: String!
  user: User!
  timestamp: DateTime!
  changes: JSON!
  metadata: JSON
  previousState: JSON # New in TICKET-032
  newState: JSON # New in TICKET-032
  diff: JSON # New in TICKET-032
  reason: String # New in TICKET-032
}
```

#### entityAuditHistory Query

Query audit history for a specific entity with advanced filtering.

**Location:** `packages/api/src/graphql/resolvers/audit.resolver.ts` (lines 90-155)

**Signature:**

```graphql
entityAuditHistory(
  entityType: String!
  entityId: String!
  limit: Int = 100
  operations: [String!]
  startDate: DateTime
  endDate: DateTime
  sortBy: String = "timestamp"
  sortOrder: String = "desc"
): [Audit!]!
```

**Parameters:**

- `entityType` - Type of entity (must be in whitelist: Settlement, Structure, Character, Event, Encounter)
- `entityId` - Unique identifier of the entity
- `limit` - Maximum records to return (default: 100, max: 100)
- `operations` - Filter by operation types (optional, multi-select)
- `startDate` - Filter records on or after this date (optional)
- `endDate` - Filter records on or before this date (optional, includes full day)
- `sortBy` - Sort field: "timestamp" | "operation" | "entityType" (default: "timestamp")
- `sortOrder` - Sort direction: "asc" | "desc" (default: "desc")

**Authorization:**

- Requires AUDIT_READ permission
- Requires campaign membership (entity must belong to a campaign the user has access to)
- Defense-in-depth: both membership AND permission checks enforced

**Example:**

```graphql
query {
  entityAuditHistory(
    entityType: "Settlement"
    entityId: "clx123abc"
    operations: ["UPDATE", "DELETE"]
    startDate: "2025-01-01T00:00:00.000Z"
    endDate: "2025-01-31T23:59:59.999Z"
    sortBy: "timestamp"
    sortOrder: "desc"
    limit: 50
  ) {
    id
    operation
    timestamp
    user {
      id
      username
    }
    previousState
    newState
    diff
    reason
  }
}
```

#### userAuditHistory Query

Query audit history for a specific user's actions with advanced filtering.

**Location:** `packages/api/src/graphql/resolvers/audit.resolver.ts` (lines 202-241)

**Signature:**

```graphql
userAuditHistory(
  userId: String!
  limit: Int = 100
  skip: Int = 0
  operations: [String!]
  entityTypes: [String!]
  startDate: DateTime
  endDate: DateTime
  sortBy: String = "timestamp"
  sortOrder: String = "desc"
): [Audit!]!
```

**Parameters:**

- `userId` - ID of the user whose actions to query
- `limit` - Maximum records to return (default: 100, max: 100)
- `skip` - Number of records to skip for pagination (max: 100,000, prevents abuse)
- `operations` - Filter by operation types (optional, multi-select)
- `entityTypes` - Filter by entity types (optional, multi-select from whitelist)
- `startDate` - Filter records on or after this date (optional)
- `endDate` - Filter records on or before this date (optional, includes full day)
- `sortBy` - Sort field: "timestamp" | "operation" | "entityType" (default: "timestamp")
- `sortOrder` - Sort direction: "asc" | "desc" (default: "desc")

**Authorization:**

- Users can only query their own audit history (self-access restriction)
- Requires role-based permission: OWNER or GM membership in ANY campaign
- Performance-optimized: single database query using `findFirst` with OR condition

**Example:**

```graphql
query {
  userAuditHistory(
    userId: "clx456def"
    operations: ["CREATE", "UPDATE"]
    entityTypes: ["Settlement", "Structure"]
    startDate: "2025-01-01T00:00:00.000Z"
    limit: 100
    skip: 0
  ) {
    id
    entityType
    entityId
    operation
    timestamp
    previousState
    newState
    diff
    reason
  }
}
```

### Permission System

Defined in `packages/api/src/auth/services/permissions.service.ts`

**Permissions:**

- `AUDIT_READ` - Permission to view audit logs
- `AUDIT_EXPORT` - Permission to export audit logs (CSV/JSON)

**Role Assignments:**

- **OWNER** - Has both AUDIT_READ and AUDIT_EXPORT
- **GM** (Game Master) - Has both AUDIT_READ and AUDIT_EXPORT
- **PLAYER** - No audit permissions
- **VIEWER** - No audit permissions

**Security Model:**

- **Defense in Depth**: Frontend UX restrictions + backend enforcement
- **Campaign-Based Access**: Users must have campaign membership for entity audit queries
- **Self-Access Only**: Users can only view their own audit history via userAuditHistory
- **Least Privilege**: Only necessary roles granted audit access

## Frontend Components

### AuditLogPage

Located at `packages/frontend/src/pages/AuditLogPage.tsx`

Full-page audit log viewer with filtering, sorting, pagination, and export capabilities.

**Route:** `/audit`

**Features:**

- Role-based access control (admin/gm only)
- Permission-denied UI for unauthorized users
- URL-persisted filter state for shareability
- Sort controls in header (field and order toggle)
- Client-side entity ID search filtering
- "Load More" pagination using Apollo fetchMore
- Export buttons (CSV and JSON) with entry count display
- Proper loading and error states
- Authenticated guard (requires login)

**Access Control:**

```typescript
// Permission check in component
const isAuthorized = user && (user.role === 'admin' || user.role === 'gm');

// Permission-denied UI
if (!isAuthorized) {
  return <AccessDeniedMessage />;
}
```

### AuditLogTable

Located at `packages/frontend/src/components/features/audit/AuditLogTable.tsx`

Reusable table component for displaying audit log entries with expandable rows.

**Features:**

- Color-coded operation badges for visual distinction:
  - CREATE: green
  - UPDATE: blue
  - DELETE: red
  - ARCHIVE: orange
  - RESTORE: purple
  - FORK: cyan
  - MERGE: indigo
  - CHERRY_PICK: pink
- Expandable rows showing diff viewer (when enhanced data available)
- Entity navigation links to detail pages
- Memoized row components for performance
- Loading, error, and empty states
- Locale-aware timestamp formatting
- Truncated IDs with tooltips
- Accessibility attributes (aria-expanded, aria-label, data-testid)

### AuditLogFilters

Located at `packages/frontend/src/components/features/audit/AuditLogFilters.tsx`

Comprehensive filtering UI with operation multi-select, date range, and search.

**Filter Options:**

- **Operation Type Multi-Select**: All 8 operation types with checkboxes
- **Date Range**: Native HTML5 date pickers (startDate, endDate)
- **Entity ID Search**: Client-side filtering input
- **Clear All**: Reset all filters to defaults
- **Active Filters Summary**: Shows applied filter count

**URL Persistence:**

Filters are synchronized with URL query parameters for shareability:

```
/audit?operations=UPDATE,DELETE&startDate=2025-01-01&endDate=2025-01-31&search=settlement123
```

### AuditDiffViewer

Located at `packages/frontend/src/components/features/audit/AuditDiffViewer.tsx`

Specialized diff viewer for audit log entries showing state changes.

**Features:**

- Expandable sections for previousState, newState, and structured diff
- Color-coded change types:
  - Added fields: green
  - Modified fields: blue
  - Removed fields: red
- Operation-specific guidance text:
  - CREATE: Shows newState only
  - DELETE: Shows previousState only
  - UPDATE: Shows all sections with emphasis on diff
- Syntax-highlighted JSON display using JsonHighlighter
- Empty state for legacy audit entries without enhanced fields
- Collapsible sections (diff expanded by default, JSON collapsed)

### ExportButton

Located at `packages/frontend/src/components/features/audit/ExportButton.tsx`

Export functionality with CSV/JSON formats, progress tracking, and cancellation.

**Features:**

- Two export formats: CSV (spreadsheet-friendly) and JSON (programmatic)
- "Export All" checkbox to fetch all matching records (beyond pagination)
- Entry count display: "Export CSV (42)" or "Export CSV (All)"
- Confirmation dialog for large exports (>1000 records)
- Progress indicators showing fetched record count during batch fetching
- Export cancellation using AbortController integration
- Toast notifications for success/error/cancellation feedback
- Proper accessibility (ARIA labels, disabled states)

**CSV Export Features:**

- CSV injection prevention through field escaping
- BOM (Byte Order Mark) for Excel compatibility
- Timestamp-based filenames: `audit-log-YYYY-MM-DD-HH-MM-SS.csv`
- Nested JSON fields serialized to JSON strings

**JSON Export Features:**

- Pretty-printing with 2-space indentation
- Includes all fields: previousState, newState, diff, reason
- Proper MIME type: `application/json;charset=utf-8`
- Timestamp-based filenames: `audit-log-YYYY-MM-DD-HH-MM-SS.json`

**Export All Implementation:**

- Fetches records in batches of 100 using GraphQL skip parameter
- Progress callback updates UI: "Fetched 300 records..."
- Respects all active filters (date range, operations, entity types)
- Backend skip validation (0-100,000 limit) prevents resource abuse
- `fetchPolicy: 'network-only'` ensures fresh data

### Hooks

#### useUserAuditHistory

Located at `packages/frontend/src/services/api/hooks/audit.ts` (lines 239-280)

Apollo GraphQL hook for fetching user audit history with filters.

**Signature:**

```typescript
useUserAuditHistory(
  userId: string,
  options?: {
    limit?: number;
    skip?: number;
    operations?: string[];
    startDate?: Date;
    endDate?: Date;
    sortBy?: AuditSortBy;
    sortOrder?: SortOrder;
  }
)
```

**Features:**

- Proper userId parameter handling for authorization
- Date conversion with `.999Z` for end-of-day filtering
- Apollo fetchMore support for "Load More" pagination
- Cache-and-network fetch policy for responsive UX
- TypeScript typed with AuditEntry interface

### Utilities

#### audit-filters.ts

Located at `packages/frontend/src/utils/audit-filters.ts`

Filter utilities with URL persistence and validation.

**Exports:**

- `AuditLogFilters` - TypeScript type for filter state
- `parseFiltersFromURL()` - Parse filters from URL query parameters
- `serializeFiltersToURL()` - Serialize filters to URL query string
- `hasActiveFilters()` - Check if any non-default filters are applied
- `resetFilters()` - Get default filter configuration

**Validation:**

- Operation type validation (8 supported operations)
- Date format validation (YYYY-MM-DD)
- Sort parameter validation

#### audit-export.ts

Located at `packages/frontend/src/utils/audit-export.ts`

Export utilities for CSV/JSON generation and batch fetching.

**Exports:**

- `exportToCSV()` - Generate and download CSV file from audit entries
- `exportToJSON()` - Generate and download JSON file from audit entries
- `fetchAllAuditData()` - Fetch all matching audit records in batches of 100

**Security:**

- CSV injection prevention via field escaping
- XSS protection via Blob API (no inline data URIs)
- Client-side export (no server processing)

## Usage Examples

### Backend: Creating Enhanced Audit Logs

```typescript
import { AuditService } from '../services/audit.service';
import { AuditOperation } from '@prisma/client';

// In a mutation resolver (e.g., SettlementService.update)
async updateSettlement(id: string, data: UpdateSettlementInput, userId: string) {
  // Fetch current state
  const previousSettlement = await this.prisma.settlement.findUnique({ where: { id } });

  // Perform mutation
  const updatedSettlement = await this.prisma.settlement.update({
    where: { id },
    data,
  });

  // Log audit with enhanced fields (fire-and-forget)
  this.auditService.log(
    'Settlement',
    id,
    AuditOperation.UPDATE,
    userId,
    data,                      // Legacy changes field
    { source: 'graphql' },     // Optional metadata
    previousSettlement,        // Full state before
    updatedSettlement,         // Full state after
    'Updated settlement name and population' // Optional reason
  ).catch(err => {
    // Non-blocking: log error but don't fail mutation
    this.logger.error('Audit log failed', err);
  });

  return updatedSettlement;
}
```

### Backend: Querying Audit History

```typescript
// In a GraphQL resolver
@Query(() => [Audit])
async getSettlementHistory(
  @Args('settlementId') settlementId: string,
  @CurrentUser() user: User
) {
  // Check authorization
  await this.permissionsService.requirePermission(
    user.id,
    campaignId,
    Permission.AUDIT_READ
  );

  // Query audit history
  return this.prisma.audit.findMany({
    where: {
      entityType: 'Settlement',
      entityId: settlementId,
    },
    orderBy: { timestamp: 'desc' },
    take: 100,
    include: { user: true },
  });
}
```

### Frontend: Using Audit Log Page

```typescript
// In router configuration (packages/frontend/src/App.tsx)
import { AuditLogPage } from './pages/AuditLogPage';

<Route path="/audit" element={<AuditLogPage />} />
```

**URL with Filters:**

```
/audit?operations=UPDATE,DELETE&startDate=2025-01-01&endDate=2025-01-31&search=settlement123&sortBy=timestamp&sortOrder=desc
```

### Frontend: Using Audit Components

```typescript
import { AuditLogTable } from '../components/features/audit/AuditLogTable';
import { useUserAuditHistory } from '../services/api/hooks/audit';

function MyAuditView() {
  const { data, loading, error, fetchMore } = useUserAuditHistory(
    currentUser.id,
    {
      limit: 100,
      operations: ['UPDATE', 'DELETE'],
      startDate: new Date('2025-01-01'),
      sortBy: 'timestamp',
      sortOrder: 'desc',
    }
  );

  return (
    <AuditLogTable
      entries={data?.userAuditHistory || []}
      loading={loading}
      error={error}
    />
  );
}
```

## Backward Compatibility

The audit system enhancement maintains full backward compatibility with existing code:

### Legacy vs Enhanced Format

**Legacy Format (Pre-TICKET-032):**

```typescript
await auditService.log(
  'Settlement',
  settlementId,
  AuditOperation.UPDATE,
  userId,
  { name: 'New Name', population: 5000 },  // changes field
  { source: 'graphql' }                     // metadata
);

// Database record:
{
  id: 'clx123',
  entityType: 'Settlement',
  entityId: 'settlement123',
  operation: 'UPDATE',
  userId: 'user456',
  timestamp: '2025-01-15T10:30:00Z',
  changes: { name: 'New Name', population: 5000 },
  metadata: { source: 'graphql' },
  previousState: null,    // Not provided
  newState: null,         // Not provided
  diff: null,             // Not calculated
  reason: null            // Not provided
}
```

**Enhanced Format (Post-TICKET-032):**

```typescript
await auditService.log(
  'Settlement',
  settlementId,
  AuditOperation.UPDATE,
  userId,
  { name: 'New Name' },                     // changes (still used)
  { source: 'graphql' },                    // metadata
  { name: 'Old Name', population: 3000 },   // previousState (NEW)
  { name: 'New Name', population: 5000 },   // newState (NEW)
  'Renamed settlement after player vote'    // reason (NEW)
);

// Database record:
{
  id: 'clx123',
  entityType: 'Settlement',
  entityId: 'settlement123',
  operation: 'UPDATE',
  userId: 'user456',
  timestamp: '2025-01-15T10:30:00Z',
  changes: { name: 'New Name' },
  metadata: { source: 'graphql' },
  previousState: { name: 'Old Name', population: 3000 },
  newState: { name: 'New Name', population: 5000 },
  diff: {                                   // Auto-calculated!
    added: {},
    modified: {
      name: { old: 'Old Name', new: 'New Name' },
      population: { old: 3000, new: 5000 }
    },
    removed: {}
  },
  reason: 'Renamed settlement after player vote'
}
```

### Migration Strategy

**Phase 1: No Changes Required** (Current State)

- All existing service code works unchanged
- 22+ services using AuditService.log() continue to function
- Legacy audit entries remain queryable
- No breaking changes

**Phase 2: Gradual Enhancement** (Recommended)

Enhance high-value services to use new fields when convenient:

```typescript
// Before (still works)
await auditService.log('Settlement', id, AuditOperation.UPDATE, userId, changes);

// After (enhanced, when refactoring)
await auditService.log(
  'Settlement',
  id,
  AuditOperation.UPDATE,
  userId,
  changes,
  {},
  previousState,
  newState,
  reason
);
```

**Recommended Priority for Migration:**

1. Settlement and Structure mutations (high user visibility)
2. Event and Encounter resolution (valuable for game state tracking)
3. Character and Party mutations (player-facing)
4. Condition and Effect mutations (debugging value)
5. Remaining entity types as needed

**No Deadline:**

- Both formats supported indefinitely
- Migrate at your own pace
- Focus on areas where state tracking adds most value

## Performance Considerations

### Async Logging Pattern

Audit logging uses a fire-and-forget pattern to avoid blocking mutations:

```typescript
// Non-blocking audit log
this.auditService.log(...).catch(err => {
  this.logger.error('Audit log failed', err);
});

// Mutation continues regardless of audit success
return updatedEntity;
```

**Benefits:**

- Mutations complete quickly even if audit logging is slow
- Database failures don't propagate to user-facing operations
- Audit errors logged for monitoring without user impact

### Database Performance

**Indexes:**

- Composite (entityType, entityId) enables fast entity history queries
- Individual userId, timestamp, operation indexes support common filter patterns
- Foreign key indexes optimize join performance

**Query Optimization:**

- Limit enforced at 100 records per query (prevents excessive data retrieval)
- Skip parameter validated (0-100,000 max) to prevent pagination abuse
- GraphQL query uses Prisma's optimized query builder
- Result set caching via Apollo Client on frontend

**Storage Considerations:**

- Enhanced fields (previousState, newState, diff) are nullable (minimal storage for legacy entries)
- JSON compression at database level reduces storage overhead
- Consider retention policies for very high-volume deployments

### Frontend Performance

**Component Optimization:**

- Memoized row components prevent unnecessary re-renders
- useCallback hooks for event handlers
- Lazy loading of diff content (collapsed by default)
- Virtual scrolling not yet implemented (future enhancement for very large logs)

**Export Performance:**

- Batch fetching (100 records per request) balances network overhead and server load
- Progress indicators provide user feedback during long operations
- Export cancellation prevents resource waste if user changes mind
- Client-side CSV/JSON generation avoids server processing

## Security and Privacy

### Authorization Model

**Multi-Layer Security:**

1. **Authentication**: JWT token required for all GraphQL queries
2. **Permission Checks**: AUDIT_READ/AUDIT_EXPORT permissions enforced
3. **Campaign Membership**: Entity audit queries verify campaign access
4. **Self-Access**: User audit queries restricted to own history
5. **Entity Type Whitelist**: Only audits entities with proper auth (Settlement, Structure, Character, Event, Encounter)

### Data Privacy

**Sensitive Data Considerations:**

- `previousState` and `newState` may contain sensitive entity data
- No automatic PII redaction (implement if needed for specific fields)
- User passwords never logged (services should pre-redact sensitive fields)
- Consider field-level redaction utility for future enhancement

**Best Practices:**

```typescript
// Redact sensitive fields before logging
const sanitizePII = (u) => ({
  ...u,
  password: '[REDACTED]',
  // Note: Email typically not redacted (needed for user identification)
  // but can be redacted if required by privacy policy
});

await auditService.log(
  'User',
  userId,
  AuditOperation.UPDATE,
  actorId,
  changes,
  {},
  sanitizePII(previousUser),
  sanitizePII(newUser),
  reason
);
```

### Input Validation

**Backend Validation:**

- Entity type whitelist prevents unauthorized entity auditing
- Operation enum validation ensures only valid operations logged
- Skip parameter limits prevent pagination abuse (0-100,000 max)
- Date validation prevents malformed query inputs
- Prisma's type-safe query builder prevents SQL injection

**Frontend Validation:**

- Filter input sanitization before URL serialization
- CSV field escaping prevents CSV injection attacks
- XSS protection via Blob API (no inline data URIs)
- Toast notifications for user-friendly error messages

## Testing

### Backend Tests

Located at `packages/api/src/graphql/services/audit.service.test.ts`

**Test Coverage:**

- Basic audit log creation (legacy format)
- Enhanced audit with previousState and newState
- Automatic diff calculation verification
- Reason field storage
- CREATE operation with newState only
- DELETE operation with previousState only
- Backward compatibility with existing calls
- Combined enhanced fields functionality

**Running Tests:**

```bash
# Run audit service tests
pnpm --filter @campaign/api test -- audit.service.test.ts
```

### Frontend Tests

**Component Tests:** (Planned for Stage 10B or later)

- AuditLogTable rendering with various data states
- AuditLogFilters interaction and URL synchronization
- AuditDiffViewer diff display logic
- ExportButton export functionality
- Permission-denied UI rendering

**Integration Tests:** (Planned)

- End-to-end audit log creation and retrieval
- Filter and pagination workflows
- Export workflows (CSV/JSON)
- Permission enforcement

## Migration Guide for Service Developers

### Adding Enhanced Audit Logging to Your Service

**Step 1: Import AuditService and Operation Enum**

```typescript
import { AuditService } from '../services/audit.service';
import { AuditOperation } from '@prisma/client';

@Injectable()
export class MyEntityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly logger: Logger
  ) {}
}
```

**Step 2: Capture Previous State (UPDATE/DELETE)**

```typescript
// Before mutation
const previousEntity = await this.prisma.myEntity.findUnique({
  where: { id },
});
```

**Step 3: Perform Mutation**

```typescript
const updatedEntity = await this.prisma.myEntity.update({
  where: { id },
  data: updateData,
});
```

**Step 4: Log Audit with Enhanced Fields**

```typescript
// Fire-and-forget audit log (non-blocking)
this.auditService
  .log(
    'MyEntity', // Entity type
    id, // Entity ID
    AuditOperation.UPDATE, // Operation
    userId, // User performing operation
    updateData, // Legacy changes field
    { source: 'graphql' }, // Optional metadata
    previousEntity, // Previous state (for diff)
    updatedEntity, // New state (for diff)
    reason // Optional user-provided reason
  )
  .catch((err) => {
    // Non-blocking: log error but don't fail mutation
    this.logger.error(`Audit log failed for ${id}`, err);
  });
```

**Step 5: Return Result**

```typescript
return updatedEntity;
```

### Operation-Specific Patterns

**CREATE Operation:**

```typescript
// No previous state for CREATE
this.auditService.log(
  'Settlement',
  newSettlement.id,
  AuditOperation.CREATE,
  userId,
  createData,
  {},
  undefined, // No previousState
  newSettlement, // newState only
  reason
);
```

**DELETE Operation:**

```typescript
// No new state for DELETE
this.auditService.log(
  'Settlement',
  id,
  AuditOperation.DELETE,
  userId,
  {},
  {},
  deletedSettlement, // previousState only
  undefined, // No newState
  reason
);
```

**UPDATE Operation:**

```typescript
// Both states for UPDATE
this.auditService.log(
  'Settlement',
  id,
  AuditOperation.UPDATE,
  userId,
  updateData,
  {},
  previousSettlement, // Before mutation
  updatedSettlement, // After mutation
  reason
);
```

### Common Pitfalls

**❌ Don't block mutations on audit failures:**

```typescript
// BAD: Mutation fails if audit fails
await this.auditService.log(...);
return updatedEntity;
```

**✅ Do use fire-and-forget pattern:**

```typescript
// GOOD: Mutation succeeds even if audit fails
this.auditService.log(...).catch(err => {
  this.logger.error('Audit failed', err);
});
return updatedEntity;
```

**❌ Don't log sensitive fields:**

```typescript
// BAD: Logging password
this.auditService.log('User', id, AuditOperation.UPDATE, userId, {}, {}, previousUser, updatedUser);
```

**✅ Do redact sensitive data:**

```typescript
// GOOD: Redacted password
const sanitized = (u) => ({ ...u, password: '[REDACTED]' });
this.auditService.log(
  'User',
  id,
  AuditOperation.UPDATE,
  userId,
  {},
  {},
  sanitized(previousUser),
  sanitized(updatedUser)
);
```

## Troubleshooting

### Common Issues

**Issue: Audit logs not appearing in UI**

- Check user role (must be admin/gm)
- Verify AUDIT_READ permission granted to role
- Check browser console for GraphQL errors
- Verify campaign membership for entity audit queries

**Issue: Export not working**

- Check AUDIT_EXPORT permission
- Verify browser allows file downloads
- Check for popup blocker interference
- Review browser console for JavaScript errors

**Issue: Diff not showing in UI**

- Verify previousState and newState fields populated in database
- Check that service is passing both states to auditService.log()
- Ensure diff auto-calculation succeeded (check for errors in server logs)
- Verify GraphQL query includes diff, previousState, newState fields

**Issue: Performance degradation**

- Check audit table size (consider retention policies if very large)
- Verify indexes exist on audit table
- Review slow query logs for missing index usage
- Consider pagination limit reduction if fetching too many records

## Future Enhancements

**Out of Scope for TICKET-032, Potential Future Work:**

- Audit log retention policies (auto-delete old logs after N days)
- Real-time audit log streaming via WebSocket
- Audit log analytics dashboard (operation frequency, user activity patterns)
- Anomaly detection (unusual activity patterns, suspicious operations)
- Entity Inspector integration (audit log as a tab in entity details)
- Rollback/restore functionality using audit history
- Field-level PII redaction utility
- Virtual scrolling for very large audit logs
- Audit log search with full-text indexing

## Related Systems

- **Version System**: Uses same `calculateDiff` utility for consistent diff format
- **Permission System**: Provides AUDIT_READ/AUDIT_EXPORT permissions
- **User System**: Provides user relation for actor tracking
- **Campaign System**: Provides campaign membership for authorization

## References

- **TICKET-032**: Audit System enhancement ticket
- **TICKET-032-implementation-plan.md**: Detailed implementation stages
- **packages/api/prisma/schema.prisma**: Audit model definition
- **packages/api/src/graphql/services/audit.service.ts**: AuditService implementation
- **packages/api/src/graphql/resolvers/audit.resolver.ts**: GraphQL query resolvers
- **packages/frontend/src/pages/AuditLogPage.tsx**: Main audit UI

---

_Last Updated: 2025-11-06_
_Part of TICKET-032 Stage 10A implementation_
