# TICKET-032 Stage 9: Permission-Based Access Control

Part of [TICKET-032 Implementation Plan](./TICKET-032-implementation-plan.md)

## Overview

Stage 9 implements authorization for the audit log system with permission-based access control at both the GraphQL resolver level and the frontend UI. This ensures that only authorized users can view and export audit logs, with role-based filtering for appropriate data access.

---

## Stage 9A: Implement Backend Permission Checks

**Goal**: Add authorization for audit log access at GraphQL layer

**Status**: In Progress

**Tasks**:

- [x] Define permission constants: `audit:read`, `audit:export` (in permissions module)
- [x] Add `AUDIT_READ` and `AUDIT_EXPORT` to OWNER and GM roles
- [x] Inject PermissionsService into AuditResolver
- [x] Add permission checks to `entityAuditHistory` resolver
- [x] Use `UnauthorizedException` for proper error handling in `entityAuditHistory`
- [x] Run type-check and lint - both passing
- [x] Initial code review completed - identified critical issues
- [x] **FIXED**: Add permission check to `userAuditHistory` resolver
- [x] **FIXED**: Replace generic `Error` with `UnauthorizedException` in `userAuditHistory`
- [x] **FIXED**: Optimize permission check to avoid N+1 query pattern
- [x] Run type-check and lint after fixes - both passing
- [ ] Final code review with Code Reviewer subagent
- [ ] Commit Stage 9A changes with detailed message
- [ ] Write integration tests for permission enforcement (deferred to future stage)
- [ ] Test unauthorized access returns proper error (deferred to future stage)
- [ ] Test authorized access works correctly (deferred to future stage)

**Success Criteria**:

- ✅ Permission checks enforced at GraphQL layer
- ✅ `audit:read` required to query audit logs
- ✅ Proper error messages for unauthorized users
- ✅ Role-based filtering implemented
- ✅ Integration tests passing

**Files to Modify**:

- `packages/api/src/graphql/resolvers/audit.resolver.ts` (add permission checks)
- Permission/authorization module (define new permissions)
- `packages/api/src/graphql/resolvers/audit.resolver.test.ts` (add permission tests)

**Example Permission Check**:

```typescript
@Query(() => [Audit])
@RequirePermission('audit:read')
async userAuditHistory(
  @CurrentUser() user: AuthenticatedUser,
  // ... other parameters
): Promise<Audit[]> {
  // Implementation
}
```

**Commands**:

```bash
pnpm --filter @campaign/api test -- audit.resolver.test.ts
pnpm run type-check
```

**Estimated Time**: 35-45 minutes

**Progress Summary** (2025-01-06):

Completed:

- ✅ Added `AUDIT_READ` and `AUDIT_EXPORT` permissions to Permission enum (permissions.service.ts:39-41)
- ✅ Added both permissions to OWNER role (permissions.service.ts:68-69)
- ✅ Added both permissions to GM role (permissions.service.ts:86-87)
- ✅ Injected PermissionsService into AuditResolver constructor (audit.resolver.ts:18-21)
- ✅ Added permission check to `entityAuditHistory` resolver (audit.resolver.ts:110-120)
- ✅ Type-check passing, lint passing (initial)
- ✅ Initial code review completed - identified critical issues
- ✅ **FIXED**: Added permission check to `userAuditHistory` resolver (audit.resolver.ts:206-232)
- ✅ **FIXED**: Replaced generic `Error` with `UnauthorizedException` (audit.resolver.ts:203)
- ✅ **FIXED**: Optimized permission check to avoid N+1 query pattern using single `findFirst` query
- ✅ Type-check passing, lint passing (after fixes)

**Performance Optimization Details**:

The permission check was optimized from an N+1 query pattern (fetching all campaigns, then checking permissions for each) to a single optimized query that checks if the user is either:

1. A campaign owner (via `ownerId`), OR
2. A GM member (via `memberships` with `role: 'GM'`)

This reduces database queries from N+1 to just 1, significantly improving performance for users with many campaign memberships.

**Next Steps**:

1. Run final code review with Code Reviewer subagent
2. Commit Stage 9A changes with detailed message

---

## Stage 9B: Implement Frontend Permission UI

**Goal**: Add UI restrictions and indicators based on permissions

**Status**: Not Started

**Prerequisites**: Stage 9A complete (backend permissions working)

**Tasks**:

- [ ] Add permission checks to `/audit` route guard
- [ ] Redirect unauthorized users to appropriate page
- [ ] Add permission-based UI indicators (disabled export button, etc.)
- [ ] Show helpful message when user lacks `audit:read` permission
- [ ] Disable export functionality for users without `audit:export` permission
- [ ] Add tooltips explaining permission requirements
- [ ] Test with various user roles/permissions
- [ ] Ensure graceful degradation for limited permissions

**Success Criteria**:

- ✅ Route guard prevents unauthorized access
- ✅ UI adapts based on user permissions
- ✅ Clear messaging for permission issues
- ✅ Export disabled without `audit:export` permission
- ✅ Tooltips explain requirements

**Files to Modify**:

- `packages/frontend/src/router/index.tsx` (add route guard)
- `packages/frontend/src/pages/AuditLogPage.tsx` (add permission checks)
- `packages/frontend/src/components/features/audit/ExportButton.tsx` (permission-based disable)

**Example Permission Guard**:

```typescript
if (!user?.permissions.includes('audit:read')) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <p>You don't have permission to view audit logs.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Contact your administrator to request access.
        </p>
      </CardContent>
    </Card>
  );
}
```

**Estimated Time**: 25-35 minutes

---

## Stage 9C: Code Review and Commit Permissions

**Goal**: Review and commit permission implementation

**Status**: Not Started

**Prerequisites**: Stages 9A and 9B complete

**Tasks**:

- [ ] Run backend tests (audit.resolver.test.ts)
- [ ] Run type-check and lint for both packages
- [ ] Use Code Reviewer subagent to review permission code
- [ ] Address any security issues flagged
- [ ] Manually test with different user roles
- [ ] Verify error messages are user-friendly
- [ ] Stage changes and commit
- [ ] Update TICKET-032.md with Stage 9 completion notes

**Success Criteria**:

- ✅ All tests passing
- ✅ Code Reviewer approval received
- ✅ Security concerns addressed
- ✅ Changes committed with proper message
- ✅ Ticket and plan files updated

**Commit Message Template**:

```bash
feat(api,frontend): add permission-based access control for audit logs

Implements authorization for audit system:

Backend:
- Added audit:read and audit:export permissions
- Permission checks in entityAuditHistory and userAuditHistory resolvers
- Role-based filtering (users see own audits, admins see all)
- Integration tests for permission enforcement

Frontend:
- Route guard for /audit page
- Permission-based UI restrictions (disabled export, helpful messages)
- Tooltips explaining permission requirements
- Graceful degradation for limited permissions

Part of TICKET-032 Stage 9 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Estimated Time**: 15-20 minutes

---

## Technical Considerations

### Permission System

- **Authorization Strategy**: Check permissions at GraphQL resolver level
- **Role-Based Access**: Users see own audits, admins see all
- **Permission Granularity**: Separate read and export permissions
- **Error Handling**: User-friendly messages without leaking information

### Security Best Practices

- **Defense in Depth**: Permission checks at both backend and frontend
- **Fail Secure**: Deny access by default, explicit permission grants
- **Audit Trail**: Permission checks themselves should be logged
- **Error Messages**: Informative for legitimate users, non-revealing to attackers

### Testing Strategy

- **Integration Tests**: Test permission enforcement at resolver level
- **Unit Tests**: Test permission check logic in isolation
- **Manual Testing**: Verify UI behavior with different user roles
- **Edge Cases**: Test boundary conditions (no permissions, partial permissions)

---

## Stage 9 Summary

**Status**: Not Started

**Estimated Total Time**: 75-100 minutes

**Key Deliverables**:

1. Backend permission checks at GraphQL resolver level
2. Frontend route guards and UI restrictions
3. Role-based filtering for audit data access
4. Comprehensive integration tests
5. User-friendly error messages and tooltips

**Dependencies**:

- Existing authentication/authorization system
- Permission module for defining new permissions
- User role system for role-based filtering

---

[← Back: Stage 8 (Advanced Export)](./TICKET-032-stage-8-advanced-export.md) | [Next: Stage 10 (Documentation) →](./TICKET-032-stage-10-documentation.md)

[Back to Main Plan](./TICKET-032-implementation-plan.md) | [Back to Ticket](./TICKET-032.md)
