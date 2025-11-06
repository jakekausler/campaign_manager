# Campaign Manager Audit System - Comprehensive Research Summary

## Overview

The audit system is a comprehensive logging and tracking mechanism for all entity mutations in the campaign management application. It provides detailed change history, role-based access control, and export capabilities.

---

## 1. PRISMA SCHEMA - Audit Model

**File**: `packages/api/prisma/schema.prisma` (lines 712-733)

### Model Definition

```prisma
model Audit {
  id         String   @id @default(cuid())
  entityType String
  entityId   String
  operation  String // "CREATE", "UPDATE", "DELETE"
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  changes    Json // JSON diff of changes (before/after) - LEGACY: use diff instead
  metadata   Json     @default("{}") // Additional context (IP, user agent, etc.)
  timestamp  DateTime @default(now())

  // Enhanced audit fields (TICKET-032)
  previousState Json? // Full entity state before the operation
  newState      Json? // Full entity state after the operation
  diff          Json? // Computed structured diff between previousState and newState
  reason        String? // Optional user-provided reason for the operation

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
  @@index([operation])
}
```

### Field Documentation

| Field           | Type          | Nullable | Purpose                                                                                          |
| --------------- | ------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `id`            | String        | No       | Primary key (CUID format) for unique audit entry identification                                  |
| `entityType`    | String        | No       | Type of entity modified (e.g., "Settlement", "Structure", "Character", "Event", "Encounter")     |
| `entityId`      | String        | No       | ID of the specific entity instance that was modified                                             |
| `operation`     | String        | No       | Type of operation performed (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, CHERRY_PICK) |
| `userId`        | String        | No       | ID of the user who performed the operation (foreign key to User)                                 |
| `user`          | User relation | No       | Reference to the User who performed the operation                                                |
| `changes`       | Json          | No       | LEGACY FIELD: JSON representation of changes - superseded by `diff` field                        |
| `metadata`      | Json          | No       | Additional context data (IP address, user agent, browser info, etc.) - defaults to empty object  |
| `timestamp`     | DateTime      | No       | When the audit entry was created - defaults to current time (UTC)                                |
| `previousState` | Json          | Yes      | **ENHANCED**: Full entity state before the operation (null for CREATE operations initially)      |
| `newState`      | Json          | Yes      | **ENHANCED**: Full entity state after the operation (null for DELETE operations)                 |
| `diff`          | Json          | Yes      | **ENHANCED**: Computed structured diff between previousState and newState (auto-calculated)      |
| `reason`        | String        | Yes      | **ENHANCED**: Optional user-provided explanation for why the operation was performed             |

### Indexes

1. **Composite Index** `[entityType, entityId]` - Fast lookup of audit history for specific entities
2. **Index** on `[userId]` - Fast lookup of audit history for specific users
3. **Index** on `[timestamp]` - Fast time-range queries for audit logs
4. **Index** on `[operation]` - Fast filtering by operation type

### Key Design Notes

- **Backward Compatibility**: `changes` field is LEGACY; new audits should use `diff`
- **Enhanced Fields**: `previousState`, `newState`, `diff`, and `reason` are nullable for backward compatibility with older audit entries
- **Automatic Diff Calculation**: The `diff` field is automatically calculated from `previousState` and `newState` by the AuditService
- **User Relationship**: Foreign key to User model ensures audit entries are linked to their author

---

## 2. AUDIT SERVICE - Core Logic

**File**: `packages/api/src/graphql/services/audit.service.ts`

### Service Class

```typescript
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
```

### Main Method: `log()`

**Signature**:

```typescript
async log(
  entityType: string,
  entityId: string,
  operation: AuditOperation,
  userId: string,
  changes: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
  previousState?: Record<string, unknown>,
  newState?: Record<string, unknown>,
  reason?: string
): Promise<void>
```

**Parameters**:

| Parameter       | Type                    | Required | Description                                                                         |
| --------------- | ----------------------- | -------- | ----------------------------------------------------------------------------------- |
| `entityType`    | string                  | Yes      | Type of entity (e.g., 'campaign', 'world', 'event')                                 |
| `entityId`      | string                  | Yes      | ID of the entity instance                                                           |
| `operation`     | AuditOperation          | Yes      | Operation type (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, CHERRY_PICK) |
| `userId`        | string                  | Yes      | ID of the user performing the operation                                             |
| `changes`       | Record<string, unknown> | Yes      | Changes made: for CREATE (new values), UPDATE (diff), DELETE/ARCHIVE (final state)  |
| `metadata`      | Record<string, unknown> | No       | Additional context like IP address, user agent (default: {})                        |
| `previousState` | Record<string, unknown> | No       | Full entity state before the operation (enables auto-diff calculation)              |
| `newState`      | Record<string, unknown> | No       | Full entity state after the operation (enables auto-diff calculation)               |
| `reason`        | string                  | No       | Optional user-provided explanation for the operation                                |

**Return Value**: `Promise<void>` (non-blocking, failures logged but not thrown)

### Key Logic

1. **Automatic Diff Calculation** (lines 53-59):
   - If both `previousState` and `newState` are provided, the service automatically calculates the diff
   - Uses `calculateDiff()` utility function from `version.utils.ts`
   - Converts VersionDiff to InputJsonValue via JSON serialization

2. **Database Creation** (lines 61-75):
   - Creates audit record with all provided fields
   - Enhanced fields are optional/nullable for backward compatibility
   - Handles type coercion to Prisma's InputJsonValue

3. **Error Handling** (lines 76-87):
   - Catches all errors and logs them without throwing
   - Ensures audit failures don't break main application operations
   - Logs enhanced data indicator for debugging

**Operation Types**:

```typescript
type AuditOperation =
  | 'CREATE' // New entity created
  | 'UPDATE' // Existing entity modified
  | 'DELETE' // Entity deleted
  | 'ARCHIVE' // Entity archived (soft delete)
  | 'RESTORE' // Archived entity restored
  | 'FORK' // Branch created (for branching system)
  | 'MERGE' // Branch merged
  | 'CHERRY_PICK'; // Selective commit applied
```

---

## 3. GRAPHQL TYPES - API Representation

**File**: `packages/api/src/graphql/types/audit.type.ts`

### Type Definition

```typescript
@ObjectType()
export class Audit {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'Type of entity...' })
  entityType!: string;

  @Field(() => ID, { description: 'ID of the entity...' })
  entityId!: string;

  @Field(() => String, { description: 'Operation performed...' })
  operation!: string;

  @Field(() => ID, { description: 'User who performed...' })
  userId!: string;

  @Field(() => GraphQLJSON, { description: '...' })
  changes!: Record<string, unknown>;

  @Field(() => GraphQLJSON, { description: '...' })
  metadata!: Record<string, unknown>;

  @Field({ description: 'When this audit entry was created' })
  timestamp!: Date;

  @Field(() => GraphQLJSON, { nullable: true, description: '...' })
  previousState?: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true, description: '...' })
  newState?: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true, description: '...' })
  diff?: Record<string, unknown>;

  @Field(() => String, { nullable: true, description: '...' })
  reason?: string;
}
```

### GraphQL Fields

| Field           | GraphQL Type | Nullable | Description                                     |
| --------------- | ------------ | -------- | ----------------------------------------------- |
| `id`            | ID           | No       | Unique identifier                               |
| `entityType`    | String       | No       | Type of modified entity                         |
| `entityId`      | ID           | No       | ID of modified entity                           |
| `operation`     | String       | No       | Operation type (CREATE, UPDATE, DELETE, etc.)   |
| `userId`        | ID           | No       | User who performed operation                    |
| `changes`       | JSON         | No       | Changes made (LEGACY field)                     |
| `metadata`      | JSON         | No       | Additional context (IP, user agent, etc.)       |
| `timestamp`     | DateTime     | No       | When entry was created                          |
| `previousState` | JSON         | Yes      | Full state before operation                     |
| `newState`      | JSON         | Yes      | Full state after operation                      |
| `diff`          | JSON         | Yes      | Structured diff (added/modified/removed fields) |
| `reason`        | String       | Yes      | User-provided explanation                       |

---

## 4. GRAPHQL RESOLVERS - Query API

**File**: `packages/api/src/graphql/resolvers/audit.resolver.ts`

### Query 1: `entityAuditHistory`

**Purpose**: Get audit history for a specific entity with advanced filtering

**Signature**:

```typescript
@Query(() => [Audit])
@UseGuards(JwtAuthGuard)
async entityAuditHistory(
  @CurrentUser() user: AuthenticatedUser,
  @Args('entityType') entityType: string,
  @Args('entityId', { type: () => ID }) entityId: string,
  @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number = 50,
  @Args('operations', { type: () => [String], nullable: true }) operations?: string[],
  @Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
  @Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
  @Args('sortBy', { nullable: true, defaultValue: 'timestamp' }) sortBy: string = 'timestamp',
  @Args('sortOrder', { nullable: true, defaultValue: 'desc' }) sortOrder: 'asc' | 'desc' = 'desc'
): Promise<Audit[]>
```

**Parameters**:

| Parameter    | Type     | Required | Description                                                                    |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------ |
| `entityType` | string   | Yes      | Entity type to query (Settlement, Structure, Character, Event, Encounter only) |
| `entityId`   | ID       | Yes      | Specific entity ID                                                             |
| `limit`      | Int      | No       | Max results to return (default: 50, max: 100)                                  |
| `operations` | [String] | No       | Filter by operation types (empty = all)                                        |
| `startDate`  | Date     | No       | Start of date range filter                                                     |
| `endDate`    | Date     | No       | End of date range filter                                                       |
| `sortBy`     | String   | No       | Sort field: 'timestamp', 'operation', 'entityType' (default: 'timestamp')      |
| `sortOrder`  | String   | No       | Sort order: 'asc' or 'desc' (default: 'desc')                                  |

**Return Value**: Array of Audit entries (max 100 records)

**Security**:

- Requires JWT authentication
- Validates entityType against whitelist (Settlement, Structure, Character, Event, Encounter)
- Resolves entity to campaign and checks user is campaign member
- Verifies user has `Permission.AUDIT_READ` for the campaign

**Authorization Flow**:

1. Lookup entity's campaign ID based on entityType
2. Check user owns the campaign OR is a campaign member
3. Check user has AUDIT_READ permission in that campaign
4. If authorization fails, throws UnauthorizedException

---

### Query 2: `userAuditHistory`

**Purpose**: Get audit entries created by a specific user with advanced filtering

**Signature**:

```typescript
@Query(() => [Audit])
@UseGuards(JwtAuthGuard)
async userAuditHistory(
  @CurrentUser() user: AuthenticatedUser,
  @Args('userId', { type: () => ID }) userId: string,
  @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number = 50,
  @Args('skip', { type: () => Int, nullable: true, defaultValue: 0 }) skip: number = 0,
  @Args('operations', { type: () => [String], nullable: true }) operations?: string[],
  @Args('entityTypes', { type: () => [String], nullable: true }) entityTypes?: string[],
  @Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
  @Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
  @Args('sortBy', { nullable: true, defaultValue: 'timestamp' }) sortBy: string = 'timestamp',
  @Args('sortOrder', { nullable: true, defaultValue: 'desc' }) sortOrder: 'asc' | 'desc' = 'desc'
): Promise<Audit[]>
```

**Parameters**:

| Parameter     | Type     | Required | Description                                                               |
| ------------- | -------- | -------- | ------------------------------------------------------------------------- |
| `userId`      | ID       | Yes      | User ID to fetch history for (restricted to current user unless admin)    |
| `limit`       | Int      | No       | Max results per request (default: 50, max: 100)                           |
| `skip`        | Int      | No       | Pagination offset (default: 0, max: 100,000)                              |
| `operations`  | [String] | No       | Filter by operation types (empty = all)                                   |
| `entityTypes` | [String] | No       | Filter by entity types (empty = all)                                      |
| `startDate`   | Date     | No       | Start of date range                                                       |
| `endDate`     | Date     | No       | End of date range                                                         |
| `sortBy`      | String   | No       | Sort field: 'timestamp', 'operation', 'entityType' (default: 'timestamp') |
| `sortOrder`   | String   | No       | Sort order: 'asc' or 'desc' (default: 'desc')                             |

**Return Value**: Array of Audit entries (paginated, max 100 per request)

**Security**:

- Requires JWT authentication
- Users can ONLY view their own audit history (userId must match current user)
- Requires user to be campaign owner OR have GM role
- TODO: Add admin override for viewing other users' history

**Authorization Flow**:

1. Check requesting user matches userId parameter (deny cross-user access)
2. Verify user is campaign owner OR has GM role in at least one campaign
3. If authorized, fetch audit entries with filters and pagination

---

## 5. PERMISSION SYSTEM - Access Control

**File**: `packages/api/src/auth/services/permissions.service.ts`

### Permission Enum

```typescript
export enum Permission {
  // ... other permissions ...
  AUDIT_READ = 'audit:read',
  AUDIT_EXPORT = 'audit:export',
}
```

### Role-Based Permissions

| Role   | AUDIT_READ | AUDIT_EXPORT |
| ------ | ---------- | ------------ |
| OWNER  | ✓ Yes      | ✓ Yes        |
| GM     | ✓ Yes      | ✓ Yes        |
| PLAYER | ✗ No       | ✗ No         |
| VIEWER | ✗ No       | ✗ No         |

### Permission Resolution

**Code Location**: lines 45-105

```typescript
const ROLE_PERMISSIONS: Record<CampaignRole, Permission[]> = {
  [CampaignRole.OWNER]: [
    // ... full access including audit ...
    Permission.AUDIT_READ,
    Permission.AUDIT_EXPORT,
  ],
  [CampaignRole.GM]: [
    // ... limited access including audit ...
    Permission.AUDIT_READ,
    Permission.AUDIT_EXPORT,
  ],
  [CampaignRole.PLAYER]: [
    // No audit access
    // ...
  ],
  [CampaignRole.VIEWER]: [
    // No audit access
    // ...
  ],
};
```

### Key Methods

| Method                                                 | Purpose                                  |
| ------------------------------------------------------ | ---------------------------------------- |
| `getUserPermissions(campaignId, userId)`               | Get all permissions for user in campaign |
| `hasPermission(campaignId, userId, permission)`        | Check single permission                  |
| `hasAllPermissions(campaignId, userId, permissions[])` | Check all permissions required           |
| `hasAnyPermission(campaignId, userId, permissions[])`  | Check any permission                     |

---

## 6. FRONTEND HOOKS - Data Fetching

**File**: `packages/frontend/src/services/api/hooks/audit.ts`

### Hook 1: `useEntityAuditHistory`

**Purpose**: Fetch audit history for a specific entity

```typescript
useEntityAuditHistory(entityType: string, entityId: string, limit: number = 50)
```

**Returns**:

```typescript
{
  audits: AuditEntry[],
  loading: boolean,
  error: ApolloError | undefined,
  refetch: (options?) => Promise<ApolloQueryResult>
}
```

**Behavior**:

- Uses Apollo cache-first fetch policy
- Skips query if required parameters missing
- Notifies on network status changes

---

### Hook 2: `useUserAuditHistory`

**Purpose**: Fetch audit entries for current user with advanced filtering and pagination

```typescript
useUserAuditHistory(options: UseUserAuditHistoryOptions)
```

**Options Interface**:

```typescript
interface UseUserAuditHistoryOptions {
  userId: string; // Required
  limit?: number; // 1-100, default 50
  skip?: number; // Default 0
  operations?: AuditOperation[]; // Filter by operation types
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
  sortBy?: 'timestamp' | 'operation' | 'entityType';
  sortOrder?: 'asc' | 'desc';
}
```

**Returns**:

```typescript
{
  audits: AuditEntry[],
  loading: boolean,
  error: ApolloError | undefined,
  refetch: (options?) => Promise<ApolloQueryResult>,
  fetchMore: (options?) => Promise<ApolloQueryResult>
}
```

**Date Conversion Logic** (lines 263-264):

- Client converts date strings to UTC dates
- Start date: `YYYY-MM-DD + T00:00:00.000Z` (start of day)
- End date: `YYYY-MM-DD + T23:59:59.999Z` (end of day, critical for inclusivity)

**Behavior**:

- Uses Apollo cache-and-network fetch policy (always fresh data)
- Supports cursor-based pagination via `fetchMore()`
- Skips query if userId missing

---

## 7. FRONTEND UI COMPONENTS

**File**: `packages/frontend/src/pages/AuditLogPage.tsx`

### Main Page Component

**Features**:

1. **Permission Checking** (line 86):
   - Checks if user role is 'admin' or 'gm'
   - Shows access denied message for others

2. **Filter Persistence** (lines 34-35):
   - Filters stored in URL query parameters
   - Survives page refreshes

3. **Sorting Controls** (lines 139-161):
   - Toggle sort field: timestamp → operation → entityType → timestamp
   - Toggle sort order: asc ↔ desc

4. **Pagination** (lines 166-186):
   - Load more button when `canLoadMore` heuristic passes
   - Loads 50 additional entries per request

---

### Component: `AuditLogFilters`

**File**: `packages/frontend/src/components/features/audit/AuditLogFilters.tsx`

**Features**:

- **Operation Type Filter**: Multi-select checkboxes with color coding
  - CREATE (green), UPDATE (blue), DELETE (red)
  - ARCHIVE (orange), RESTORE (purple)
  - FORK (cyan), MERGE (indigo), CHERRY_PICK (pink)

- **Date Range Filter**: Start date and end date inputs
  - Validates date range (start <= end)

- **Search Filter**: Entity ID text search
  - Client-side filtering (TODO: move to server)

- **Clear Button**: Resets all filters to defaults

- **Active Filters Summary**: Shows which filters are applied

---

### Component: `AuditLogTable`

**File**: `packages/frontend/src/components/features/audit/AuditLogTable.tsx`

**Features**:

- **Loading State**: Skeleton loaders while fetching
- **Error State**: Error message display
- **Empty State**: Helpful message when no results
- **Main Content**: List of audit entries with expandable details

**Row Component** (`AuditLogRow`):

- **Operation Badge**: Color-coded with type
- **Entity Info**: Type and ID with optional external link
- **User & Time**: User ID and timestamp in right column
- **Reason Display**: Shows reason if provided
- **Expand Button**: Toggles diff viewer when data available
- **Entity Links**: Maps entity types to detail page routes:
  - Settlement → `/settlements/{id}`
  - Structure → `/structures/{id}`
  - Character → `/characters/{id}`
  - Event → `/events/{id}`
  - Encounter → `/encounters/{id}`

---

### Component: `AuditDiffViewer`

**File**: `packages/frontend/src/components/features/audit/AuditDiffViewer.tsx`

**Props**:

```typescript
interface AuditDiffViewerProps {
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  diff?: Record<string, unknown> | null;
  operation: AuditOperation;
  className?: string;
}
```

**Display Sections** (collapsible):

1. **Changes Section** (default expanded):
   - **Added Fields** (green background)
   - **Modified Fields** (blue background) - shows before/after
   - **Removed Fields** (red background)

2. **State Before Operation** (gray background):
   - Full JSON of entity before operation
   - Hidden for CREATE operations (no previousState)

3. **State After Operation** (gray background):
   - Full JSON of entity after operation
   - Hidden for DELETE operations (no newState)

**Features**:

- Operation-specific guidance text
- Format values for display (null, undefined, empty strings)
- Pretty-printed JSON in `<JsonHighlighter>` component
- Memoized for performance

---

### Component: `ExportButton`

**File**: `packages/frontend/src/components/features/audit/ExportButton.tsx`

**Features**:

- **Export All Checkbox**: Toggles between filtered view vs all matching records
- **CSV Export Button**: Exports with UTF-8 BOM for Excel compatibility
- **JSON Export Button**: Exports pretty-printed JSON
- **Progress Indicator**: Shows fetch progress when exporting all
- **Cancel Button**: Aborts ongoing export operation
- **Large Export Confirmation**: Dialog warns before exporting >1000 records

**Export Behavior**:

- Default: Export current filtered/paginated results
- With "Export All" checked:
  - Fetches all matching records via paginated API calls
  - Batch size: 100 records per request
  - Shows progress counter
  - Supports cancellation via AbortController

---

### Component: `ExportConfirmationDialog`

**File**: `packages/frontend/src/components/features/audit/ExportConfirmationDialog.tsx`

**Props**:

```typescript
interface ExportConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  recordCount: number;
  isUnknownCount?: boolean; // For "Export All" before fetch
  format: 'CSV' | 'JSON';
  loading?: boolean;
}
```

**Behavior**:

- Warns user about large exports (>1000 records)
- Shows minimum count for "Export All" scenarios
- Disables buttons while exporting
- Provides clear action buttons (Cancel/Confirm)

---

## 8. UTILITY FUNCTIONS

### Version Utils - Diff Calculation

**File**: `packages/api/src/graphql/utils/version.utils.ts`

**Core Function**: `calculateDiff(oldPayload, newPayload): VersionDiff`

**Returns**:

```typescript
interface VersionDiff {
  added: Record<string, unknown>; // New fields
  modified: Record<string, { old: unknown; new: unknown }>; // Changed values
  removed: Record<string, unknown>; // Deleted fields
}
```

**Algorithm**:

1. Compares old and new object keys
2. Records new fields in `added`
3. Detects modified fields via deep equality check
4. Records deleted fields in `removed`

**Deep Equality**: `deepEqual()` function

- Handles primitives, null/undefined, arrays, and objects
- Includes depth limit (50) to prevent stack overflow
- Used for comparing field values

---

### Audit Filters Utils

**File**: `packages/frontend/src/utils/audit-filters.ts`

**Types**:

- `AuditSortBy`: 'timestamp' | 'operation' | 'entityType'
- `SortOrder`: 'asc' | 'desc'
- `AuditLogFilters`: Interface with operations[], dates, search, sort

**Functions**:

1. `parseFiltersFromURL(searchParams)`: Parse URL query params to filter object
   - Validates operations against whitelist
   - Validates date format (YYYY-MM-DD)
   - Sanitizes search query (alphanumeric + hyphen/underscore only)
   - Validates sortBy and sortOrder

2. `serializeFiltersToURL(filters)`: Convert filters to URL params
   - Only includes non-default values to keep URLs clean

3. `hasActiveFilters(filters)`: Check if any filters applied

4. `resetFilters()`: Return default filter state

---

### Audit Export Utils

**File**: `packages/frontend/src/utils/audit-export.ts`

**CSV Export**: `exportToCSV(entries, filename?)`

- Headers: Timestamp, User ID, Entity Type, Entity ID, Operation, Reason, Previous State, New State, Diff
- Escapes CSV fields per RFC 4180 (quotes and newlines)
- Adds UTF-8 BOM for Excel compatibility
- Triggers browser download

**JSON Export**: `exportToJSON(entries, filename?)`

- Pretty-prints with 2-space indentation
- Preserves full data fidelity
- Triggers browser download

**Fetch All Data**: `fetchAllAuditData(client, options, onProgress?, signal?)`

- Paginates through API results (100 per batch)
- Supports AbortSignal for cancellation
- Calls onProgress callback for each batch
- Converts date strings to UTC Date objects
- Detects end of pagination when batch < 100 records

---

## 9. DATA FLOW DIAGRAM

### Audit Entry Creation Flow

```
Entity Mutation (CREATE/UPDATE/DELETE)
    ↓
Application Code calls auditService.log()
    ↓
Service receives: entityType, entityId, operation, userId, changes, metadata, previousState?, newState?, reason?
    ↓
If previousState && newState:
  → Call calculateDiff() → Get VersionDiff
  → Convert to JSON → Store in diff field
    ↓
Create Audit record in database with all fields
    ↓
Non-blocking: Log any errors without throwing
```

### Query Execution Flow - `entityAuditHistory`

```
User requests audit history for Settlement#1234
    ↓
GraphQL Query arrives at AuditResolver.entityAuditHistory()
    ↓
1. Verify JWT authentication
2. Validate entityType against whitelist
3. Lookup Settlement#1234 → Get campaign ID
4. Check user owns campaign OR is member
5. Check user has AUDIT_READ permission
    ↓
If authorization passes:
  → Build WHERE clause with filters
  → Apply operation/date filters
  → Execute Prisma query with ordering
  → Return max 100 records
    ↓
If authorization fails:
  → Throw UnauthorizedException
```

### Frontend Data Display Flow

```
User navigates to /audit-logs
    ↓
AuditLogPage mounted
    ↓
1. Check user role (admin/gm required)
2. Parse filters from URL
3. Call useUserAuditHistory() hook
    ↓
Hook executes GET_USER_AUDIT_HISTORY GraphQL query
  → Backend validates and returns audit entries
  → Apollo caches results
    ↓
Render AuditLogTable with entries
  → Each row shows operation, entity, user, timestamp
  → Expandable rows show AuditDiffViewer
    ↓
User can:
  → Filter by operation type/date/search
  → Sort by timestamp/operation/entityType
  → Load more entries (pagination)
  → Export to CSV/JSON
```

---

## 10. SECURITY CONSIDERATIONS

### Authentication & Authorization

1. **All Queries Protected**: JWT authentication required via `@UseGuards(JwtAuthGuard)`

2. **Campaign-Based Access**:
   - User must be campaign owner OR member
   - Audit read permission tied to campaign role

3. **User Privacy**:
   - `userAuditHistory` restricted to current user
   - Cannot view other users' operations
   - TODO: Add admin override

4. **Rate Limiting**:
   - `skip` parameter capped at 100,000 (prevents scanning entire audit log)
   - `limit` capped at 100 (prevents excessive data transfer)

5. **Entity Type Whitelist**:
   - Only 5 entity types allowed: Settlement, Structure, Character, Event, Encounter
   - Prevents arbitrary entity type lookups

### Data Protection

1. **Error Handling**:
   - Audit failures don't break main operations (non-blocking)
   - Errors logged for debugging

2. **Payload Size Limits** (in version.utils.ts):
   - Max 10MB before compression
   - Max 10MB after decompression
   - Prevents decompression bomb attacks

3. **Input Validation**:
   - Date format validation (YYYY-MM-DD)
   - Search query sanitization (alphanumeric + hyphen/underscore)
   - Operation type whitelist validation

---

## 11. GRAPHQL QUERY EXAMPLES

### Get Entity Audit History

```graphql
query {
  entityAuditHistory(
    entityType: "Settlement"
    entityId: "settlement-123"
    limit: 20
    operations: ["CREATE", "UPDATE"]
    startDate: "2025-01-01"
    endDate: "2025-01-31"
    sortBy: "timestamp"
    sortOrder: "desc"
  ) {
    id
    entityType
    entityId
    operation
    userId
    timestamp
    reason
    diff
    previousState
    newState
  }
}
```

### Get User Audit History

```graphql
query {
  userAuditHistory(
    userId: "user-456"
    limit: 50
    skip: 0
    operations: ["UPDATE"]
    entityTypes: ["Settlement", "Character"]
    startDate: "2025-01-01"
    sortBy: "timestamp"
    sortOrder: "desc"
  ) {
    id
    operation
    entityType
    entityId
    timestamp
    reason
    diff {
      added
      modified
      removed
    }
  }
}
```

---

## 12. KEY IMPLEMENTATION NOTES

### Enhanced Audit Fields (TICKET-032)

The system includes enhanced audit tracking capabilities:

1. **previousState** & **newState**: Full entity snapshots
   - Enable complete state reconstruction
   - Support for detailed before/after comparison
   - Nullable for backward compatibility

2. **Diff Field**: Automatically calculated
   - Structured diff with added/modified/removed fields
   - Only calculated when both previous and new states available
   - Enables efficient change visualization

3. **Reason Field**: User-provided context
   - Optional explanation for why operation was performed
   - Improves audit trail documentation
   - Displayed in audit log UI

### Frontend URL Persistence

Filters and sorting are persisted in URL query parameters:

- `?operations=CREATE,UPDATE`
- `?startDate=2025-01-01&endDate=2025-01-31`
- `?search=entity-123`
- `?sortBy=operation&sortOrder=asc`

Survives page refreshes and can be shared/bookmarked.

### Export Strategy

- **Filtered View Export**: Uses current page results
- **Export All**: Batches 100-record requests until all data fetched
- **Progress Tracking**: Real-time counter for long exports
- **Cancellation**: AbortController support for aborting mid-export

---

## 13. TESTING ENTRY POINTS

Key areas to test when working with audit system:

1. **Audit Creation**:
   - Verify audit records created on entity mutations
   - Verify enhanced fields (previousState, newState, diff) populated correctly
   - Verify non-blocking error handling

2. **Query Authorization**:
   - Verify JWT required for all queries
   - Verify campaign membership checked
   - Verify AUDIT_READ permission enforced
   - Verify user cannot access other users' history

3. **Filtering & Sorting**:
   - Verify operation type filtering works
   - Verify date range filtering (inclusive)
   - Verify sorting by timestamp/operation/entityType
   - Verify limit and skip parameters work correctly

4. **Frontend Features**:
   - Verify filters persist in URL
   - Verify diff viewer displays correctly
   - Verify export creates valid CSV/JSON
   - Verify "Export All" pagination completes

---

## 14. IMPORTANT LIMITS & DEFAULTS

| Limit/Default       | Value   | Notes                                |
| ------------------- | ------- | ------------------------------------ |
| Query limit         | 100     | Max records returned per query       |
| Default limit       | 50      | Default records per query            |
| Export batch size   | 100     | Records per paginated export request |
| Export threshold    | 1000    | Shows confirmation dialog            |
| Skip parameter max  | 100,000 | Prevents scanning entire log         |
| Payload max size    | 10 MB   | Before and after compression         |
| Deep equality depth | 50      | Prevents stack overflow              |
| Search length       | 100     | Max characters after sanitization    |

---

## 15. FUTURE ENHANCEMENTS

Based on TODOs in code:

1. **Server-Side Entity Search** (AuditLogPage.tsx:61):
   - Currently: Client-side filtering of entityId
   - Future: Move to server-side for proper pagination

2. **Admin Override for User History** (audit.resolver.ts:201):
   - Currently: Users can only view own history
   - Future: Admins can view any user's history

3. **GraphQL Code Generation** (audit.ts:26):
   - Currently: Hand-written interfaces
   - Future: Generate from GraphQL schema with code-gen tool
