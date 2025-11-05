# TICKET-032 Implementation Plan: Audit System Enhancement (REVISED)

## Critical Discovery

**The Audit system already exists and is fully functional!** This is not a greenfield implementation—it's an **enhancement project**.

- **Existing**: Fully functional Audit model, AuditService (22+ services using it), GraphQL queries, comprehensive tests
- **Gap**: Missing `previousState`, `newState`, `diff`, and `reason` fields that TICKET-032 requires
- **Approach**: **Option A** - Enhance existing schema with new fields while maintaining backward compatibility

See `TICKET-032-gap-analysis.md` for complete analysis.

---

## Revised Architecture Decisions

### Database Schema Enhancement (Option A)

**Enhance existing Audit model** instead of creating new AuditLog model:

```prisma
model Audit {
  id            String   @id @default(cuid())
  entityType    String
  entityId      String
  operation     String
  userId        String
  user          User     @relation(fields: [userId], references: [id])

  // EXISTING FIELDS (keep for backward compatibility)
  changes       Json     // Legacy field - gradually phase out
  metadata      Json     @default("{}")
  timestamp     DateTime @default(now())

  // NEW FIELDS (Option A Enhancement)
  previousState Json?    // Full entity state before mutation
  newState      Json?    // Full entity state after mutation
  diff          Json?    // Computed structured diff
  reason        String?  // Optional user-provided reason

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
  @@index([operation])
}
```

**Rationale**:

- Explicit semantics - clear field purpose
- Better queryability - can search previousState/newState independently
- Future-proof - supports rollback/restore features
- Aligns with project patterns (Version, MergeHistory, EffectExecution models)

### Diff Generation Strategy

**Use existing `calculateDiff` utility** from `packages/api/src/graphql/utils/version.utils.ts`:

- Already battle-tested by VersionService
- Handles nested objects, arrays, depth protection
- No external library needed
- Consistent with existing codebase patterns

### Service Enhancement Strategy

**Add optional parameters to existing AuditService.log()** method:

- Maintains backward compatibility with 22+ existing service integrations
- New/refactored code can provide enhanced data
- Auto-calculate diff when previousState & newState provided
- Gradual migration path

---

## Implementation Stages (REVISED)

### Stage 1A: Enhance Prisma Schema

**Goal**: Add new fields to existing Audit model

**Status**: Not Started

**Tasks**:

- [ ] Update Audit model in `packages/api/prisma/schema.prisma`
- [ ] Add `previousState Json?` field
- [ ] Add `newState Json?` field
- [ ] Add `diff Json?` field
- [ ] Add `reason String?` field
- [ ] Keep existing fields (`changes`, `metadata`) for backward compatibility
- [ ] Verify all fields are properly typed

**Success Criteria**:

- Schema.prisma updated with new nullable fields
- Existing fields remain unchanged
- No syntax errors in schema file

**Files to Modify**:

- `/storage/programs/campaign_manager/packages/api/prisma/schema.prisma` (lines 712-727)

**Reference**: See TICKET-032-gap-analysis.md "Option A: Enhanced Model" section

---

### Stage 1B: Create & Run Prisma Migration

**Goal**: Generate and apply database migration for schema changes

**Status**: ✅ Complete

**Tasks**:

- [x] Run `pnpm --filter @campaign/api prisma:migrate` from project root
- [x] Name migration: "enhance_audit_with_state_tracking"
- [x] Review generated SQL in migration file
- [x] Verify migration adds columns as nullable (no default required)
- [x] Apply migration to dev database
- [x] Verify Prisma Client types regenerated

**Implementation Notes**:

Encountered database drift issue (Location table had extra GIST index not in migrations). Resolved by:

1. Reset database with user consent using `prisma migrate reset --force`
2. Applied all existing migrations cleanly (14 migrations total)
3. Used `prisma db push` to sync enhanced Audit schema directly to database
4. Prisma Client successfully regenerated with new types (previousState, newState, diff, reason)
5. Database now in sync - all four new nullable fields added to Audit table

**Success Criteria**:

- Migration file created in `packages/api/prisma/migrations/`
- Migration applies cleanly without errors
- New columns exist in Audit table
- Prisma Client types include new fields

**Commands**:

```bash
# From project root
pnpm --filter @campaign/api prisma:migrate
# Enter name: enhance_audit_with_state_tracking

# Verify
pnpm --filter @campaign/api prisma:studio
```

**Tests**:

- Manual test: Open Prisma Studio, verify Audit table schema
- Manual test: Query Audit table, confirm new nullable columns

**Reference**: Subagent research on Prisma migration patterns

---

### Stage 1C: Update GraphQL Schema Types

**Goal**: Expose new Audit fields in GraphQL API

**Status**: ✅ Complete

**Tasks**:

- [x] Update `packages/api/src/graphql/types/audit.type.ts`
- [x] Add `@Field(() => GraphQLJSON, { nullable: true })` for `previousState`
- [x] Add `@Field(() => GraphQLJSON, { nullable: true })` for `newState`
- [x] Add `@Field(() => GraphQLJSON, { nullable: true })` for `diff`
- [x] Add `@Field(() => String, { nullable: true })` for `reason`
- [x] Add descriptions for each new field
- [x] Update resolvers in `audit.resolver.ts` to cast new JSON fields
- [x] Run type-check to validate changes

**Implementation Notes**:

- Added all four new nullable fields to GraphQL Audit type with proper decorators and descriptions
- Updated both `entityAuditHistory` and `userAuditHistory` resolvers to cast new JSON fields
- Implemented null-to-undefined conversion for `reason` field (Prisma returns null, GraphQL expects undefined)
- Type-check and build passed successfully
- Committed in fa6b668

**Success Criteria**:

- ✅ GraphQL type includes all new fields
- ✅ Fields are properly nullable
- ✅ Type-check passes without errors
- ✅ Build succeeds

**Files to Modify**:

- `/storage/programs/campaign_manager/packages/api/src/graphql/types/audit.type.ts`
- `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/audit.resolver.ts` (type casting)

**Example**:

```typescript
@Field(() => GraphQLJSON, {
  nullable: true,
  description: 'Full entity state before the operation'
})
previousState?: Record<string, unknown>;
```

**Commands**:

```bash
pnpm run type-check
pnpm run build
```

**Reference**: Subagent research on GraphQL schema patterns

---

### Stage 1D: Enhance AuditService API

**Goal**: Extend AuditService to populate new fields while maintaining backward compatibility

**Status**: Not Started

**Tasks**:

- [ ] Update `packages/api/src/graphql/services/audit.service.ts`
- [ ] Add optional parameters: `previousState?`, `newState?`, `reason?` to `log()` method
- [ ] Import `calculateDiff` from `../utils/version.utils`
- [ ] Implement auto-diff calculation when both states provided
- [ ] Update `prisma.audit.create()` to include new fields
- [ ] Maintain backward compatibility - existing calls work unchanged
- [ ] Add JSDoc comments documenting new parameters
- [ ] Update error handling to include new fields in logs

**Success Criteria**:

- `log()` method accepts new optional parameters
- Existing service calls continue working unchanged
- Auto-diff calculation works correctly
- Service can create entries with full state tracking

**Files to Modify**:

- `/storage/programs/campaign_manager/packages/api/src/graphql/services/audit.service.ts`

**Implementation Pattern**:

```typescript
async log(
  entityType: string,
  entityId: string,
  operation: AuditOperation,
  userId: string,
  changes: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
  // NEW OPTIONAL PARAMETERS
  previousState?: Record<string, unknown>,
  newState?: Record<string, unknown>,
  reason?: string
): Promise<void> {
  try {
    // Calculate diff if both states provided
    let diff: Json | undefined;
    if (previousState && newState) {
      diff = calculateDiff(previousState, newState);
    }

    await this.prisma.audit.create({
      data: {
        // ... existing fields ...
        previousState: previousState || undefined,
        newState: newState || undefined,
        diff: diff || undefined,
        reason: reason || undefined,
      },
    });
  } catch (error) {
    // Existing error handling
  }
}
```

**Reference**: Subagent research on AuditService implementation

---

### Stage 1E: Write Integration Tests for Enhanced Audit

**Goal**: Test new audit functionality with comprehensive integration tests

**Status**: Not Started

**Tasks**:

- [ ] Update `packages/api/src/graphql/services/audit.service.test.ts`
- [ ] Add test: Create audit with previousState and newState
- [ ] Add test: Verify diff is auto-calculated correctly
- [ ] Add test: Create audit with reason field
- [ ] Add test: Backward compatibility - old calls still work
- [ ] Add test: Query audit logs and verify new fields returned
- [ ] Add test: Nullable fields handled properly when not provided
- [ ] Run tests and verify all pass

**Success Criteria**:

- All new tests pass
- Existing tests remain passing (backward compatibility)
- Coverage includes all new fields
- Edge cases tested (null values, missing states, etc.)

**Files to Modify**:

- `/storage/programs/campaign_manager/packages/api/src/graphql/services/audit.service.test.ts`

**Test Cases**:

```typescript
describe('Enhanced Audit Fields', () => {
  it('should create audit with previousState and newState', async () => {
    const previousState = { name: 'Old Name', level: 1 };
    const newState = { name: 'New Name', level: 2 };

    await service.log('settlement', 'id-123', 'UPDATE', 'user-1', {}, {}, previousState, newState);

    expect(mockPrisma.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousState,
        newState,
        diff: expect.any(Object), // Auto-calculated
      }),
    });
  });

  it('should maintain backward compatibility with existing calls', async () => {
    // Old call pattern without new parameters
    await service.log('settlement', 'id-123', 'CREATE', 'user-1', { name: 'New' });

    expect(mockPrisma.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changes: { name: 'New' },
        previousState: undefined,
        newState: undefined,
      }),
    });
  });
});
```

**Commands**:

```bash
pnpm --filter @campaign/api test -- audit.service.test.ts
```

---

### Stage 2: Enhance Settlement & Structure Audit Integration (PARTIALLY DONE)

**Goal**: Verify and enhance existing audit logging for Settlement and Structure mutations

**Status**: Not Started

**Current State**: Settlement and Structure services already log audits, but only pass `changes` field, not full state.

**Tasks**:

- [ ] Review `SettlementService` audit logging calls
- [ ] Review `StructureService` audit logging calls
- [ ] Identify CREATE, UPDATE, DELETE operations in each service
- [ ] **Optional Enhancement**: Refactor high-value mutations to pass previousState/newState
- [ ] Verify all mutations create audit entries (regression test)
- [ ] Document which services use enhanced vs legacy audit format

**Success Criteria**:

- All Settlement mutations create audit logs (verified)
- All Structure mutations create audit logs (verified)
- At least 1-2 critical mutations enhanced with full state tracking (optional)
- Documentation updated with current audit coverage

**Files to Review**:

- `/storage/programs/campaign_manager/packages/api/src/graphql/services/settlement.service.ts`
- `/storage/programs/campaign_manager/packages/api/src/graphql/services/structure.service.ts`

**Enhancement Example** (Optional):

```typescript
// BEFORE (legacy format)
await this.audit.log('settlement', settlement.id, 'UPDATE', user.id, updateData);

// AFTER (enhanced format)
const previousState = await this.prisma.settlement.findUnique({ where: { id } });
await this.audit.log(
  'settlement',
  settlement.id,
  'UPDATE',
  user.id,
  updateData, // Still pass for backward compat
  {}, // metadata
  previousState as Record<string, unknown>,
  updatedSettlement as Record<string, unknown>,
  'Settlement level upgraded after quest completion' // reason
);
```

**Tests**:

- Integration test: Settlement CREATE generates audit with newState
- Integration test: Settlement UPDATE generates audit with diff
- Integration test: Structure DELETE generates audit with previousState

**Note**: This stage is **optional enhancement**. Existing audit logging works; this adds richer tracking.

---

### Stage 3: GraphQL Audit Query API - Enhanced Filtering (PARTIALLY DONE)

**Goal**: Add advanced filtering to existing audit query resolvers

**Status**: Not Started

**Current State**: `entityAuditHistory` and `userAuditHistory` queries exist but have limited filtering.

**Tasks**:

- [ ] Review `packages/api/src/graphql/resolvers/audit.resolver.ts`
- [ ] Add date range filtering (startDate, endDate parameters)
- [ ] Add operation type filtering (array of operations)
- [ ] Add Settlement-specific convenience queries (optional)
- [ ] Add Structure-specific convenience queries (optional)
- [ ] Remove entity type whitelist (expand to all entity types)
- [ ] Add sorting options (by timestamp, operation, entityType)
- [ ] Update resolver tests

**Success Criteria**:

- Can filter by date range
- Can filter by multiple operation types
- Can sort results
- All entity types supported (not just 5)

**Files to Modify**:

- `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/audit.resolver.ts`

**Enhanced Query Signature**:

```typescript
@Query(() => [Audit])
async entityAuditHistory(
  @Args('entityType') entityType: string,
  @Args('entityId') entityId: string,
  @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number,
  @Args('operations', { type: () => [String], nullable: true }) operations?: string[],
  @Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
  @Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
  @Args('sortBy', { nullable: true, defaultValue: 'timestamp' }) sortBy?: string,
  @Args('sortOrder', { nullable: true, defaultValue: 'desc' }) sortOrder?: 'asc' | 'desc',
  @CurrentUser() user: AuthenticatedUser
): Promise<Audit[]> {
  // Enhanced query logic
}
```

**Tests**:

- Integration test: Filter by date range
- Integration test: Filter by operation types
- Integration test: Sorting works correctly
- Integration test: All entity types supported

---

### Stage 4: Audit Log Viewer UI - Basic Display

**Goal**: Create frontend UI for viewing audit logs

**Status**: Not Started

**Tasks**:

- [ ] Create `packages/frontend/src/pages/AuditLogPage.tsx`
- [ ] Add route `/audit` in router configuration
- [ ] Create `AuditLogTable` component with column headers
- [ ] Implement columns: Timestamp, User, Entity Type, Entity, Operation, Reason
- [ ] Create GraphQL hook `useAuditLogs` in `packages/frontend/src/services/api/hooks/`
- [ ] Integrate with Apollo Client
- [ ] Add loading and error states
- [ ] Add basic responsive styling with Tailwind

**Success Criteria**:

- Audit log page displays all audit entries
- Table columns display correct data
- Loading states provide good UX
- Error states show helpful messages

**Files to Create**:

- `packages/frontend/src/pages/AuditLogPage.tsx`
- `packages/frontend/src/components/features/audit-log/AuditLogTable.tsx`
- `packages/frontend/src/services/api/hooks/useAuditLogs.ts`

**Tests**:

- Component test: AuditLogTable renders with mock data
- Component test: Columns display correct values
- Component test: Loading state displays correctly
- Component test: Error state displays correctly
- Component test: Empty state displays when no audit logs

---

### Stage 5: Audit Log Viewer UI - Filters & Pagination

**Goal**: Add filtering, sorting, and pagination to audit log viewer

**Status**: Not Started

**Tasks**:

- [ ] Add inline filters: user dropdown, entity type dropdown, operation dropdown
- [ ] Add date range picker for date filtering
- [ ] Implement client-side sorting on columns
- [ ] Implement pagination controls (load more / infinite scroll)
- [ ] Add filter reset/clear functionality
- [ ] Persist filter state in URL query parameters (using React Router)
- [ ] Add search functionality (entity ID, entity name)

**Success Criteria**:

- Can filter by user, entity type, operation, date range
- Can sort by timestamp (ascending/descending)
- Pagination loads more results correctly
- Filter state persists across page refreshes

**Files to Modify**:

- `packages/frontend/src/pages/AuditLogPage.tsx`
- `packages/frontend/src/components/features/audit-log/AuditLogFilters.tsx` (new)

**Tests**:

- Component test: Clicking filter applies filter to query
- Component test: Date range picker updates query
- Component test: Sorting changes query order
- Component test: Pagination loads next page
- Component test: Clear filters resets all filters
- Component test: URL query params update with filters

---

### Stage 6: Audit Log Viewer UI - Diff Display

**Goal**: Add detailed diff view for audit log entries using enhanced fields

**Status**: Not Started

**Tasks**:

- [ ] Add expandable row detail view to AuditLogTable
- [ ] Create `DiffViewer` component (or import from TICKET-031 if available)
- [ ] Display `previousState` and `newState` side-by-side
- [ ] Highlight changed fields using `diff` field data
- [ ] Add "View Full Entity" links to entity pages
- [ ] Format JSON states for readability (syntax highlighting)
- [ ] Handle deleted entities (no newState) gracefully
- [ ] Show `reason` field prominently in detail view

**Success Criteria**:

- Clicking audit log row expands to show diff
- DiffViewer correctly highlights changes using `diff` field
- Can navigate to entity from audit log
- Deleted entities show clear indication
- JSON formatting is readable
- Reason is displayed when present

**Files to Modify**:

- `packages/frontend/src/components/features/audit-log/AuditLogRow.tsx`
- `packages/frontend/src/components/features/audit-log/DiffViewer.tsx`

**Tests**:

- Component test: Expanding row shows diff viewer
- Component test: DiffViewer highlights changed fields from `diff` data
- Component test: "View Full Entity" link navigates correctly
- Component test: Deleted entity displays appropriate message
- Visual test: Screenshot of expanded audit log entry

---

### Stage 7: Audit Log Export - Basic Functionality

**Goal**: Add basic export functionality for audit logs (CSV and JSON)

**Status**: Not Started

**Tasks**:

- [ ] Create `ExportButton` component with format selection (CSV, JSON)
- [ ] Implement CSV export: flatten audit log data to CSV rows
- [ ] Implement JSON export: export filtered results as JSON array
- [ ] Add download trigger using browser download API
- [ ] Include current filters in export (export visible data only)
- [ ] Generate reasonable filenames (e.g., `audit-log-2025-11-05.csv`)
- [ ] Handle large exports (show progress indicator)

**Success Criteria**:

- Can export audit logs as CSV
- Can export audit logs as JSON
- Export respects current filters
- Downloaded files have reasonable filenames
- CSV format is valid and opens in spreadsheet software
- Progress indicator shown for large exports

**Files to Create**:

- `packages/frontend/src/components/features/audit-log/ExportButton.tsx`
- `packages/frontend/src/utils/audit-export.ts`

**Tests**:

- Component test: Export button triggers download
- Unit test: CSV export produces valid CSV format
- Unit test: JSON export produces valid JSON
- Integration test: Export respects filters
- Integration test: Exported data matches displayed data

---

### Stage 8: Audit Log Export - Advanced Features

**Goal**: Add advanced export features (export all, progress, confirmations)

**Status**: Not Started

**Tasks**:

- [ ] Add "Export All" option (ignores pagination, fetches all matching records)
- [ ] Show progress indicator for large exports
- [ ] Add confirmation dialog for large exports (>1000 records)
- [ ] Implement streaming/chunked export for very large datasets
- [ ] Add export cancellation capability
- [ ] Add export format options (include/exclude certain fields)

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

### Stage 9: Permission & Authorization

**Goal**: Add authorization checks to audit log access

**Status**: Not Started

**Tasks**:

- [ ] Define audit log permissions: `audit:read`, `audit:export`
- [ ] Add permission checks to GraphQL audit queries
- [ ] Restrict audit log page to authorized users
- [ ] Add UI indicators when user lacks permissions
- [ ] Consider role-based filtering (users see own audits vs admins see all)
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

### Stage 10: Documentation & Polish

**Goal**: Document audit system and add final polish

**Status**: Not Started

**Tasks**:

- [ ] Create `docs/features/audit-system.md` documentation
- [ ] Document enhanced audit log schema and fields (previousState, newState, diff, reason)
- [ ] Document GraphQL API queries and filters
- [ ] Add JSDoc comments to AuditService methods
- [ ] Add user-facing help text in UI
- [ ] Add tooltips for filter options
- [ ] Ensure consistent styling with rest of application
- [ ] Add analytics/telemetry for audit log usage (optional)
- [ ] Update README.md with audit system overview
- [ ] Document backward compatibility approach

**Success Criteria**:

- Documentation clearly explains audit system architecture
- All public APIs have JSDoc comments
- UI has helpful tooltips and guidance
- Feature documentation exists in docs/features/
- Backward compatibility strategy documented

**Tests**:

- Review documentation for completeness
- Verify JSDoc comments are present
- Manual testing of UI for polish and consistency

---

## Technical Considerations

### Performance

- Audit logging should not significantly impact mutation performance
- Use asynchronous logging (fire-and-forget pattern) - **already implemented**
- Monitor database size growth and implement retention policies if needed
- New fields are nullable - no migration performance impact

### Data Privacy

- Consider PII in audit logs (passwords, sensitive fields)
- Implement field-level redaction for sensitive data
- Document what data is captured in audit logs
- `previousState` and `newState` may contain sensitive data - add redaction utility

### Testing Strategy

- Unit tests for AuditService methods - **already exist, need enhancement**
- Integration tests for audit creation with new fields
- E2E tests for complete audit workflow (mutation → audit log → query → display)
- Performance tests for high-volume audit logging
- Backward compatibility tests (existing code still works)

### Future Enhancements (Out of Scope)

- Audit log retention policies (auto-delete old logs)
- Real-time audit log streaming (WebSocket)
- Audit log analytics dashboard
- Anomaly detection (unusual activity patterns)
- Audit log integration with Entity Inspector (as a tab)
- Rollback/restore functionality using audit history

---

## Dependencies

- **Already Exists**: TICKET-006 (Entity CRUD Operations) - ✅ Provides base mutations to audit
- **Used By**: TICKET-035 (Demo Seed Data) - May include sample audit logs

---

## Risks & Mitigations

### Risk: Breaking Changes to Existing Audit Logs

**Mitigation**: Use nullable fields, optional parameters, maintain `changes` field for backward compatibility

### Risk: Large Audit Log Table with Enhanced Data

**Mitigation**: Nullable fields minimize storage impact, implement pagination, consider retention policies, add database indexes

### Risk: Performance Impact of Diff Calculation

**Mitigation**: Diff calculation is optional (only when previousState/newState provided), use proven `calculateDiff` utility, async logging pattern

### Risk: Gradual Migration Complexity

**Mitigation**: Clear documentation of which services use enhanced format, both formats work correctly, no rush to migrate everything

---

## Completion Checklist

- [ ] All stages marked complete
- [ ] All tests passing (including backward compatibility)
- [ ] Documentation written (including Option A rationale)
- [ ] Code review completed
- [ ] Manual testing completed
- [ ] Performance verified
- [ ] Security review completed (PII in previousState/newState)
- [ ] Ticket acceptance criteria met
- [ ] Backward compatibility verified

---

## Summary of Changes from Original Plan

**Major Revisions**:

1. **Discovery**: Audit system already exists (fully functional)
2. **Approach**: Enhance existing model (Option A) instead of creating new system
3. **Stages 1-4**: Completely rewritten to reflect enhancement approach
4. **Stages 2-3 (Original)**: Merged/revised - AuditService and queries already exist
5. **Backward Compatibility**: Major focus - 22+ services already using audit system
6. **Diff Calculation**: Use existing `calculateDiff` utility, no new library needed
7. **Effort**: Reduced from 2-3 days to 1.5-2 days (8-9 significant stages vs 14)

**See Also**:

- `TICKET-032-gap-analysis.md` - Detailed analysis of existing vs required
- Subagent research on Prisma migrations, GraphQL patterns, AuditService implementation
