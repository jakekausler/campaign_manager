# TICKET-032 Implementation Plan: Audit System

## Overview

Implement a comprehensive audit logging system that tracks all mutations with actor information, timestamps, diffs, and optional reasons. The system will provide queryable audit logs with filtering capabilities and a UI for viewing, searching, and exporting audit history.

## Architecture Decisions

### Database Schema

- Create `AuditLog` table with fields: id, userId, entityType, entityId, operation, previousState, newState, diff, reason, createdAt
- Use JSON columns for previousState, newState, and diff to support flexible data structures
- Index on userId, entityType, entityId, operation, and createdAt for efficient querying
- Consider partitioning by date for large-scale deployments (future enhancement)

### Middleware vs Interceptor Approach

- Use NestJS interceptors for automatic audit logging on mutations
- Interceptors provide access to execution context, allowing us to capture before/after states
- Centralized approach reduces code duplication across resolvers
- Alternative: Prisma middleware (considered but rejected due to limited access to GraphQL context)

### Diff Generation Strategy

- Use `json-diff` or similar library to generate structured diffs
- Store both full states (previousState, newState) and computed diff
- Rationale: Full states provide complete context, diff provides quick understanding of changes
- Trade-off: Increased storage vs query performance and debugging ease (favoring the latter)

### Audit Log Querying

- Provide GraphQL queries for audit log retrieval with comprehensive filtering
- Support filtering by: userId, entityType, entityId, operation, date range
- Implement cursor-based pagination for large result sets
- Include aggregation queries (e.g., count by operation type, activity by user)

### Frontend Implementation

- Create dedicated Audit Log page/section
- Provide table view with sortable columns and inline filters
- Display diffs in a readable format (using DiffViewer from TICKET-031)
- Export functionality: CSV and JSON formats
- Consider adding audit log to Entity Inspector as a tab (future enhancement)

## Implementation Stages

### Stage 1: Database Schema & Prisma Model

**Goal**: Create database schema and Prisma model for audit logging

**Status**: Not Started

Tasks:

- [ ] Define `AuditLog` Prisma model with all required fields
- [ ] Add indexes for userId, entityType, entityId, operation, createdAt
- [ ] Create and run Prisma migration
- [ ] Verify schema in database
- [ ] Add AuditLog to GraphQL schema types

**Success Criteria**:

- Migration runs successfully
- AuditLog table exists with proper indexes
- Can manually insert and query audit records

**Tests**:

- Integration test: Create audit log entry via Prisma
- Integration test: Query audit logs with various filters
- Integration test: Verify indexes are used in queries (EXPLAIN ANALYZE)

---

### Stage 2: Audit Service - Core Creation Logic

**Goal**: Create AuditService with audit log creation and diff calculation

**Status**: Not Started

Tasks:

- [ ] Create `audit` module with `audit.service.ts`
- [ ] Implement `createAuditLog()` method in AuditService
- [ ] Implement diff calculation using `json-diff` library
- [ ] Add proper error handling and logging

**Success Criteria**:

- AuditService can create audit log entries
- Diff calculation produces accurate, structured diffs
- Service handles errors gracefully without throwing

**Tests**:

- Unit test: `createAuditLog()` with various entity types
- Unit test: Diff calculation produces correct output for simple changes
- Unit test: Diff calculation handles nested object changes
- Unit test: Diff calculation handles array changes
- Unit test: Error handling when database write fails

---

### Stage 3: Audit Service - Query Methods

**Goal**: Implement query and filtering capabilities for audit logs

**Status**: Not Started

Tasks:

- [ ] Implement `findAuditLogs()` method in AuditService
- [ ] Implement `countAuditLogs()` method
- [ ] Add filtering logic for userId, entityType, entityId, operation
- [ ] Add date range filtering
- [ ] Implement cursor-based pagination

**Success Criteria**:

- AuditService can query with multiple filter combinations
- Pagination works correctly with cursor-based approach
- Empty result sets handled properly
- Performance is acceptable for large datasets

**Tests**:

- Unit test: Filtering by userId
- Unit test: Filtering by entityType and operation
- Unit test: Date range filtering (start date, end date, both)
- Unit test: Combining multiple filters
- Unit test: Pagination with various page sizes
- Unit test: Pagination cursor navigation (forward/backward)

---

### Stage 4: Audit Logging Interceptor

**Goal**: Create NestJS interceptor to automatically log all mutations

**Status**: Not Started

Tasks:

- [ ] Create `AuditInterceptor` class implementing `NestInterceptor`
- [ ] Extract mutation metadata from GraphQL execution context
- [ ] Capture entity state before mutation
- [ ] Capture entity state after mutation
- [ ] Call AuditService.createAuditLog() with captured data
- [ ] Handle errors gracefully (log but don't block mutation)
- [ ] Apply interceptor globally or to specific resolvers

**Success Criteria**:

- Interceptor runs on all mutations
- Captures before/after states correctly
- Creates audit log entries asynchronously (non-blocking)
- Handles errors without breaking mutations

**Tests**:

- Integration test: Create entity triggers audit log
- Integration test: Update entity triggers audit log with correct diff
- Integration test: Delete entity triggers audit log
- Integration test: Mutation succeeds even if audit logging fails
- Integration test: Verify audit log contains correct user information

---

### Stage 5: Settlement & Structure Audit Integration

**Goal**: Ensure Settlement and Structure mutations are properly audited

**Status**: Not Started

Tasks:

- [ ] Verify AuditInterceptor captures Settlement CREATE operations
- [ ] Verify AuditInterceptor captures Settlement UPDATE operations
- [ ] Verify AuditInterceptor captures Settlement DELETE operations
- [ ] Verify AuditInterceptor captures Structure CREATE operations
- [ ] Verify AuditInterceptor captures Structure UPDATE operations
- [ ] Verify AuditInterceptor captures Structure DELETE operations
- [ ] Add Settlement/Structure-specific metadata to audit logs if needed

**Success Criteria**:

- All Settlement mutations create audit logs
- All Structure mutations create audit logs
- Audit logs contain full entity state in previousState/newState
- Diffs correctly show changed fields

**Tests**:

- Integration test: Create Settlement with nested Structures generates audit logs
- Integration test: Update Settlement generates audit log with correct diff
- Integration test: Delete Settlement generates audit log
- Integration test: Update Structure generates audit log
- Integration test: Verify hierarchical changes are captured

---

### Stage 6: GraphQL Audit Query API - Basic Queries

**Goal**: Expose basic GraphQL queries for retrieving audit logs

**Status**: Not Started

Tasks:

- [ ] Create `audit.resolver.ts` for GraphQL resolvers
- [ ] Define `AuditLogFilterInput` GraphQL input type
- [ ] Define `AuditLogConnection` type for paginated results
- [ ] Define `AuditLog` GraphQL object type
- [ ] Implement basic `auditLogs` query resolver
- [ ] Implement `auditLogCount` query resolver

**Success Criteria**:

- Can query audit logs with no filters (returns all)
- Can query audit log count
- Pagination returns correct page sizes and cursors
- GraphQL schema is properly typed

**Tests**:

- Integration test: Query all audit logs
- Integration test: Query audit log count
- Integration test: Pagination with cursors
- Integration test: Empty result set handling

---

### Stage 7: GraphQL Audit Query API - Filtering & Sorting

**Goal**: Add comprehensive filtering and sorting to audit query API

**Status**: Not Started

Tasks:

- [ ] Add filter support: by user, entity type, entity ID, operation, date range
- [ ] Add Settlement-specific filter: `settlementsCreated`, `settlementsUpdated`, `settlementsDeleted`
- [ ] Add Structure-specific filter: `structuresCreated`, `structuresUpdated`, `structuresDeleted`
- [ ] Add sorting options (by createdAt, userId, operation)
- [ ] Optimize query performance with proper database indexes

**Success Criteria**:

- Can filter by each supported dimension
- Can combine multiple filters
- Settlement/Structure-specific filters work correctly
- Sorting works in both ascending and descending order

**Tests**:

- Integration test: Filter by userId
- Integration test: Filter by entityType
- Integration test: Filter by operation (CREATE, UPDATE, DELETE)
- Integration test: Filter by date range
- Integration test: Filter for settlementsCreated
- Integration test: Filter for structuresUpdated
- Integration test: Combine multiple filters
- Integration test: Sorting by createdAt (asc/desc)

---

### Stage 8: Audit Log Viewer UI - Basic Display

**Goal**: Create frontend UI for viewing audit logs

**Status**: Not Started

Tasks:

- [ ] Create `AuditLogPage` component with route `/audit`
- [ ] Create `AuditLogTable` component with column headers
- [ ] Implement column headers: Timestamp, User, Entity Type, Entity, Operation, Reason
- [ ] Integrate with `useAuditLogs` GraphQL hook
- [ ] Add loading and error states
- [ ] Add basic responsive styling

**Success Criteria**:

- Audit log page displays all audit entries
- Table columns display correct data
- Loading states provide good UX
- Error states show helpful messages

**Tests**:

- Component test: AuditLogTable renders with mock data
- Component test: Columns display correct values
- Component test: Loading state displays correctly
- Component test: Error state displays correctly
- Component test: Empty state displays when no audit logs

---

### Stage 9: Audit Log Viewer UI - Filters & Pagination

**Goal**: Add filtering, sorting, and pagination to audit log viewer

**Status**: Not Started

Tasks:

- [ ] Add inline filters: user dropdown, entity type dropdown, operation dropdown
- [ ] Add date range picker for date filtering
- [ ] Implement client-side sorting on columns
- [ ] Implement pagination controls (load more / infinite scroll)
- [ ] Add filter reset/clear functionality
- [ ] Persist filter state in URL query parameters

**Success Criteria**:

- Can filter by user, entity type, operation, date range
- Can sort by timestamp (ascending/descending)
- Pagination loads more results correctly
- Filter state persists across page refreshes

**Tests**:

- Component test: Clicking filter applies filter to query
- Component test: Date range picker updates query
- Component test: Sorting changes query order
- Component test: Pagination loads next page
- Component test: Clear filters resets all filters
- Component test: URL query params update with filters

---

### Stage 10: Audit Log Viewer UI - Diff Display

**Goal**: Add detailed diff view for audit log entries

**Status**: Not Started

Tasks:

- [ ] Add expandable row detail view to AuditLogTable
- [ ] Integrate `DiffViewer` component from TICKET-031
- [ ] Display previousState and newState side-by-side
- [ ] Highlight changed fields in diff view
- [ ] Add "View Full Entity" links to entity pages
- [ ] Format JSON states for readability
- [ ] Handle deleted entities (no newState) gracefully

**Success Criteria**:

- Clicking audit log row expands to show diff
- DiffViewer correctly highlights changes
- Can navigate to entity from audit log
- Deleted entities show clear indication
- JSON formatting is readable

**Tests**:

- Component test: Expanding row shows diff viewer
- Component test: DiffViewer highlights changed fields
- Component test: "View Full Entity" link navigates correctly
- Component test: Deleted entity displays appropriate message
- Visual test: Screenshot of expanded audit log entry

---

### Stage 11: Audit Log Export - Basic Functionality

**Goal**: Add basic export functionality for audit logs (CSV and JSON)

**Status**: Not Started

Tasks:

- [ ] Create `ExportButton` component with format selection (CSV, JSON)
- [ ] Implement CSV export: flatten audit log data to CSV rows
- [ ] Implement JSON export: export filtered results as JSON array
- [ ] Add download trigger using browser download API
- [ ] Include current filters in export (export visible data only)
- [ ] Generate reasonable filenames (e.g., `audit-log-2025-11-03.csv`)

**Success Criteria**:

- Can export audit logs as CSV
- Can export audit logs as JSON
- Export respects current filters
- Downloaded files have reasonable filenames
- CSV format is valid and opens in spreadsheet software

**Tests**:

- Component test: Export button triggers download
- Unit test: CSV export produces valid CSV format
- Unit test: JSON export produces valid JSON
- Integration test: Export respects filters
- Integration test: Exported data matches displayed data

---

### Stage 12: Audit Log Export - Advanced Features

**Goal**: Add advanced export features (export all, progress, confirmations)

**Status**: Not Started

Tasks:

- [ ] Add "Export All" option (ignores pagination, fetches all matching records)
- [ ] Show progress indicator for large exports
- [ ] Add confirmation dialog for large exports (>1000 records)
- [ ] Implement streaming/chunked export for very large datasets
- [ ] Add export cancellation capability

**Success Criteria**:

- Export All fetches all matching records regardless of pagination
- Large exports show progress indicator
- User is warned before exporting large datasets
- Can cancel long-running exports

**Tests**:

- Integration test: Export all fetches all records
- Integration test: Large export shows progress
- Integration test: Confirmation dialog appears for large exports
- Component test: Export can be cancelled
- Integration test: Cancelled export stops fetching data

---

### Stage 13: Permission & Authorization

**Goal**: Add authorization checks to audit log access

**Status**: Not Started

Tasks:

- [ ] Define audit log permissions: `audit:read`, `audit:export`
- [ ] Add permission checks to GraphQL audit queries
- [ ] Restrict audit log page to authorized users
- [ ] Add UI indicators when user lacks permissions
- [ ] Consider role-based filtering (users can only see their own audits vs admins see all)
- [ ] Document permission requirements

**Success Criteria**:

- Only users with `audit:read` can query audit logs
- Only users with `audit:export` can export audit logs
- Unauthorized users see appropriate error messages
- Permission checks are enforced at GraphQL layer

**Tests**:

- Integration test: User without permission receives error
- Integration test: User with permission can query audits
- Integration test: User without export permission cannot export
- Integration test: Admin can see all audit logs
- Integration test: Regular user can see only their own audits (if implemented)

---

### Stage 14: Documentation & Polish

**Goal**: Document audit system and add final polish

**Status**: Not Started

Tasks:

- [ ] Create `docs/features/audit-system.md` documentation
- [ ] Document audit log schema and fields
- [ ] Document GraphQL API queries and filters
- [ ] Add JSDoc comments to AuditService methods
- [ ] Add user-facing help text in UI
- [ ] Add tooltips for filter options
- [ ] Ensure consistent styling with rest of application
- [ ] Add analytics/telemetry for audit log usage (optional)
- [ ] Update README.md with audit system overview

**Success Criteria**:

- Documentation clearly explains audit system architecture
- All public APIs have JSDoc comments
- UI has helpful tooltips and guidance
- Feature documentation exists in docs/features/

**Tests**:

- Review documentation for completeness
- Verify JSDoc comments are present
- Manual testing of UI for polish and consistency

---

## Technical Considerations

### Performance

- Audit logging should not significantly impact mutation performance
- Use asynchronous logging (fire-and-forget pattern)
- Consider batching audit log writes for high-volume scenarios
- Monitor database size growth and implement retention policies if needed

### Data Privacy

- Consider PII in audit logs (passwords, sensitive fields)
- Implement field-level redaction for sensitive data
- Document what data is captured in audit logs

### Testing Strategy

- Unit tests for AuditService methods
- Integration tests for interceptor behavior
- E2E tests for complete audit workflow (mutation → audit log → query → display)
- Performance tests for high-volume audit logging

### Future Enhancements (Out of Scope)

- Audit log retention policies (auto-delete old logs)
- Real-time audit log streaming (WebSocket)
- Audit log analytics dashboard
- Anomaly detection (unusual activity patterns)
- Audit log integration with Entity Inspector (as a tab)

---

## Dependencies

- **Required**: TICKET-006 (Entity CRUD Operations) - Provides base mutations to audit
- **Used By**: TICKET-035 (Demo Seed Data) - May include sample audit logs

---

## Risks & Mitigations

### Risk: Performance Impact on Mutations

**Mitigation**: Use asynchronous logging, monitor performance, implement batching if needed

### Risk: Large Audit Log Table

**Mitigation**: Implement pagination, consider retention policies, add database indexes

### Risk: Incomplete Audit Coverage

**Mitigation**: Use interceptor pattern to ensure all mutations are captured, add integration tests to verify

### Risk: Sensitive Data in Audit Logs

**Mitigation**: Implement field-level redaction, document PII handling, review compliance requirements

---

## Completion Checklist

- [ ] All stages marked complete
- [ ] All tests passing
- [ ] Documentation written
- [ ] Code review completed
- [ ] Manual testing completed
- [ ] Performance verified
- [ ] Security review completed
- [ ] Ticket acceptance criteria met
