# Audit System - Quick Reference Guide

## File Locations Summary

### Backend

| Component         | File Path                                               | Lines   | Purpose                                                |
| ----------------- | ------------------------------------------------------- | ------- | ------------------------------------------------------ |
| **Schema**        | `packages/api/prisma/schema.prisma`                     | 712-733 | Audit model definition                                 |
| **Service**       | `packages/api/src/graphql/services/audit.service.ts`    | Full    | Core audit logging logic                               |
| **GraphQL Type**  | `packages/api/src/graphql/types/audit.type.ts`          | Full    | Audit object type for GraphQL                          |
| **Resolvers**     | `packages/api/src/graphql/resolvers/audit.resolver.ts`  | Full    | Query endpoints (entityAuditHistory, userAuditHistory) |
| **Permissions**   | `packages/api/src/auth/services/permissions.service.ts` | 45-105  | Role-based audit access control                        |
| **Version Utils** | `packages/api/src/graphql/utils/version.utils.ts`       | Full    | Diff calculation and compression utilities             |

### Frontend

| Component         | File Path                                                                      | Purpose                              |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| **Page**          | `packages/frontend/src/pages/AuditLogPage.tsx`                                 | Main audit log viewer page           |
| **Filters**       | `packages/frontend/src/components/features/audit/AuditLogFilters.tsx`          | Filter control component             |
| **Table**         | `packages/frontend/src/components/features/audit/AuditLogTable.tsx`            | Audit entries table display          |
| **Diff Viewer**   | `packages/frontend/src/components/features/audit/AuditDiffViewer.tsx`          | State change visualization           |
| **Export Button** | `packages/frontend/src/components/features/audit/ExportButton.tsx`             | CSV/JSON export controls             |
| **Export Dialog** | `packages/frontend/src/components/features/audit/ExportConfirmationDialog.tsx` | Large export confirmation            |
| **Hooks**         | `packages/frontend/src/services/api/hooks/audit.ts`                            | GraphQL query hooks                  |
| **Filters Utils** | `packages/frontend/src/utils/audit-filters.ts`                                 | Filter parsing and persistence       |
| **Export Utils**  | `packages/frontend/src/utils/audit-export.ts`                                  | CSV/JSON generation and API fetching |

---

## Database Schema

```prisma
model Audit {
  id         String   @id @default(cuid())
  entityType String
  entityId   String
  operation  String   // CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, CHERRY_PICK
  userId     String
  user       User     @relation(...)
  changes    Json     // LEGACY - use diff instead
  metadata   Json     @default("{}")
  timestamp  DateTime @default(now())
  previousState Json?  // Full state before
  newState      Json?  // Full state after
  diff          Json?  // Computed diff
  reason        String? // User explanation

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
  @@index([operation])
}
```

---

## Core API Methods

### AuditService.log()

```typescript
async log(
  entityType: string,
  entityId: string,
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE' | 'FORK' | 'MERGE' | 'CHERRY_PICK',
  userId: string,
  changes: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
  previousState?: Record<string, unknown>,
  newState?: Record<string, unknown>,
  reason?: string
): Promise<void>
```

**Key Feature**: Auto-calculates diff if both previousState and newState provided

---

## GraphQL Queries

### entityAuditHistory

Get audit history for a specific entity:

```graphql
query {
  entityAuditHistory(
    entityType: "Settlement"    # Settlement, Structure, Character, Event, or Encounter
    entityId: "settlement-1234"
    limit: 50                   # Optional, default 50, max 100
    operations: ["CREATE"]      # Optional filter
    startDate: "2025-01-01"     # Optional
    endDate: "2025-01-31"       # Optional
    sortBy: "timestamp"         # timestamp, operation, entityType
    sortOrder: "desc"           # asc or desc
  ) { ... }
}
```

### userAuditHistory

Get audit entries created by a user:

```graphql
query {
  userAuditHistory(
    userId: "user-123"          # Must match current user
    limit: 50                   # 1-100, default 50
    skip: 0                     # Pagination, max 100,000
    operations: ["UPDATE"]      # Optional
    entityTypes: ["Settlement"] # Optional
    startDate: "2025-01-01"     # Optional
    endDate: "2025-01-31"       # Optional
    sortBy: "timestamp"
    sortOrder: "desc"
  ) { ... }
}
```

---

## Frontend Hooks

### useUserAuditHistory()

```typescript
const { audits, loading, error, fetchMore } = useUserAuditHistory({
  userId: user?.id || '',
  operations: ['UPDATE'],
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  sortBy: 'timestamp',
  sortOrder: 'desc',
  limit: 50,
});
```

---

## Permissions

| Role   | AUDIT_READ | AUDIT_EXPORT |
| ------ | ---------- | ------------ |
| OWNER  | ✓          | ✓            |
| GM     | ✓          | ✓            |
| PLAYER | ✗          | ✗            |
| VIEWER | ✗          | ✗            |

---

## Common Operations

### Log an audit entry

```typescript
await auditService.log(
  'Settlement',
  'settlement-123',
  'UPDATE',
  userId,
  { name: { old: 'Old Name', new: 'New Name' } },
  { ip: '192.168.1.1', userAgent: '...' },
  previousState, // Full entity object before update
  newState, // Full entity object after update
  'Updated settlement details'
);
```

### Query entity audit history

```typescript
const audits = await apolloClient.query({
  query: GET_ENTITY_AUDIT_HISTORY,
  variables: {
    entityType: 'Settlement',
    entityId: 'settlement-123',
    limit: 50,
  },
});
```

### Export audit logs

```typescript
// CSV export
exportToCSV(auditEntries);

// JSON export
exportToJSON(auditEntries);

// Fetch all matching records for export
const allEntries = await fetchAllAuditData(
  apolloClient,
  { userId, operations, startDate, endDate },
  (count) => console.log(`Fetched ${count} records`)
);
```

---

## Key Features

1. **Enhanced Audit Fields**: previousState, newState, diff, reason
2. **Automatic Diff Calculation**: Computed from state snapshots
3. **Role-Based Access**: Owner/GM only
4. **Pagination**: Supports cursor-based pagination
5. **Advanced Filtering**: By operation, date range, entity type
6. **URL Persistence**: Filters stored in query parameters
7. **Export**: CSV (Excel-compatible) and JSON formats
8. **Progress Tracking**: Real-time progress for large exports

---

## Important Limits

| Item             | Value           | Notes                        |
| ---------------- | --------------- | ---------------------------- |
| Query limit      | 100 records max | 50 default                   |
| Export batch     | 100 records     | Used for "Export All"        |
| Skip max         | 100,000         | Prevents abuse               |
| Payload max      | 10 MB           | Before and after compression |
| Export threshold | 1000 records    | Shows confirmation dialog    |

---

## URL Filter Parameters

Filters persist in URL query params:

```
?operations=CREATE,UPDATE
&startDate=2025-01-01
&endDate=2025-01-31
&search=entity-123
&sortBy=timestamp
&sortOrder=desc
```

---

## Diff Structure

The computed diff has this structure:

```typescript
{
  added: {
    newField: 'value'
  },
  modified: {
    changedField: {
      old: 'old value',
      new: 'new value'
    }
  },
  removed: {
    deletedField: 'old value'
  }
}
```

---

## Security Notes

- JWT authentication required for all queries
- User can only view their own audit history
- Campaign membership checked for entity audits
- AUDIT_READ permission enforced
- Entity type whitelist prevents abuse
- Search queries sanitized
- Skip parameter rate-limited
- Payload size capped to prevent attacks

---

## Testing Checklist

- [ ] Audit records created on mutations
- [ ] Enhanced fields populated correctly
- [ ] Diff calculation accurate
- [ ] Authorization enforced (JWT, campaign membership, AUDIT_READ)
- [ ] Filters work (operations, dates, search)
- [ ] Sorting works (timestamp, operation, entityType)
- [ ] Pagination works (limit, skip)
- [ ] URL persistence works
- [ ] Diff viewer displays correctly
- [ ] Export creates valid CSV/JSON
- [ ] "Export All" pagination completes
- [ ] Large export confirmation appears
- [ ] Export cancellation works

---

## Related Documentation

- Full Research: `docs/AUDIT_SYSTEM_RESEARCH.md`
- Implementation Details: `docs/features/audit-system.md` (if exists)
- Permission System: `packages/api/src/auth/services/permissions.service.ts`
