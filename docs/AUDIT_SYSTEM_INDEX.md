# Audit System Documentation Index

This directory contains comprehensive documentation for the Campaign Manager Audit System, including implementation details, API references, and quick guides.

## Documents

### 1. AUDIT_SYSTEM_RESEARCH.md (965 lines, 31 KB)

**Comprehensive technical reference document**

The complete implementation research with:

- Detailed Prisma schema documentation (fields, types, indexes)
- AuditService core logic and method signatures
- GraphQL types and resolver queries
- Permission system and role-based access control
- Frontend hooks and component architecture
- All utility functions and helpers
- Data flow diagrams
- Security considerations
- GraphQL query examples
- Testing entry points
- Limits and defaults

**Use this for**: Writing complete API documentation, understanding the entire system architecture, security reviews, testing strategy development.

**Key sections**:

- Section 1: Prisma Schema
- Section 2: Audit Service
- Section 3: GraphQL Types
- Section 4: GraphQL Resolvers
- Section 5: Permission System
- Section 6: Frontend Hooks
- Section 7: Frontend UI Components
- Section 8: Utility Functions
- Section 9: Data Flow Diagrams
- Section 10: Security Considerations
- Section 11: GraphQL Query Examples
- Section 12: Implementation Notes
- Section 13: Testing Entry Points
- Section 14: Limits & Defaults
- Section 15: Future Enhancements

---

### 2. AUDIT_SYSTEM_QUICK_REFERENCE.md (301 lines, 7.9 KB)

**Quick lookup guide for common tasks**

A condensed reference with:

- File locations (backend and frontend)
- Database schema summary
- Core API method signatures
- GraphQL query templates
- Frontend hook examples
- Permission matrix
- Common operations with code examples
- Key features overview
- Important limits table
- URL filter parameters
- Diff structure reference
- Security notes
- Testing checklist

**Use this for**: Quick lookups, code examples, remembering file locations, understanding permission levels, common operations reference.

**Best for**: Developer onboarding, quick implementation reference, during active development.

---

## Quick Navigation

### Finding a Specific File

**Backend Components**:

- Database schema: `packages/api/prisma/schema.prisma` (lines 712-733)
- Core service: `packages/api/src/graphql/services/audit.service.ts`
- GraphQL types: `packages/api/src/graphql/types/audit.type.ts`
- Query resolvers: `packages/api/src/graphql/resolvers/audit.resolver.ts`
- Permissions: `packages/api/src/auth/services/permissions.service.ts` (lines 40-42, 45-105)
- Diff utils: `packages/api/src/graphql/utils/version.utils.ts`

**Frontend Components**:

- Main page: `packages/frontend/src/pages/AuditLogPage.tsx`
- Filters component: `packages/frontend/src/components/features/audit/AuditLogFilters.tsx`
- Table component: `packages/frontend/src/components/features/audit/AuditLogTable.tsx`
- Diff viewer: `packages/frontend/src/components/features/audit/AuditDiffViewer.tsx`
- Export button: `packages/frontend/src/components/features/audit/ExportButton.tsx`
- Export dialog: `packages/frontend/src/components/features/audit/ExportConfirmationDialog.tsx`
- Query hooks: `packages/frontend/src/services/api/hooks/audit.ts`
- Filter utils: `packages/frontend/src/utils/audit-filters.ts`
- Export utils: `packages/frontend/src/utils/audit-export.ts`

---

### Finding Information About...

**Schema and Data Structure**:

- See AUDIT_SYSTEM_RESEARCH.md Section 1 (Prisma Schema)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (Database Schema)

**Logging Audit Entries**:

- See AUDIT_SYSTEM_RESEARCH.md Section 2 (Audit Service)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (Core API Methods)

**GraphQL API**:

- See AUDIT_SYSTEM_RESEARCH.md Section 4 (GraphQL Resolvers)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (GraphQL Queries)
- See AUDIT_SYSTEM_RESEARCH.md Section 11 (GraphQL Query Examples)

**Permissions and Access Control**:

- See AUDIT_SYSTEM_RESEARCH.md Section 5 (Permission System)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (Permissions)

**Frontend UI and Components**:

- See AUDIT_SYSTEM_RESEARCH.md Section 7 (Frontend UI Components)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (File Locations Summary - Frontend)

**Filtering, Sorting, and Pagination**:

- See AUDIT_SYSTEM_RESEARCH.md Section 7 (AuditLogFilters, AuditLogTable)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (URL Filter Parameters, Important Limits)

**Exporting Data**:

- See AUDIT_SYSTEM_RESEARCH.md Section 7 (ExportButton, ExportConfirmationDialog)
- See AUDIT_SYSTEM_RESEARCH.md Section 8 (Audit Export Utils)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (Common Operations - Export)

**Diff Calculation and Display**:

- See AUDIT_SYSTEM_RESEARCH.md Section 8 (Version Utils - Diff Calculation)
- See AUDIT_SYSTEM_RESEARCH.md Section 7 (AuditDiffViewer)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (Diff Structure)

**Security**:

- See AUDIT_SYSTEM_RESEARCH.md Section 10 (Security Considerations)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (Security Notes)

**Testing**:

- See AUDIT_SYSTEM_RESEARCH.md Section 13 (Testing Entry Points)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (Testing Checklist)

**Limits and Performance**:

- See AUDIT_SYSTEM_RESEARCH.md Section 14 (Important Limits & Defaults)
- See AUDIT_SYSTEM_QUICK_REFERENCE.md (Important Limits)

---

## Key Concepts

### Operation Types

The audit system supports 8 operation types:

1. **CREATE** - New entity created
2. **UPDATE** - Entity modified
3. **DELETE** - Entity deleted
4. **ARCHIVE** - Entity archived (soft delete)
5. **RESTORE** - Archived entity restored
6. **FORK** - Branch created (branching system)
7. **MERGE** - Branch merged
8. **CHERRY_PICK** - Selective commit applied

### Enhanced Audit Fields

- **previousState**: Full entity state before operation
- **newState**: Full entity state after operation
- **diff**: Automatically calculated structured diff
- **reason**: User-provided explanation

### Role-Based Access

- **OWNER**: Full audit access (AUDIT_READ + AUDIT_EXPORT)
- **GM**: Full audit access (AUDIT_READ + AUDIT_EXPORT)
- **PLAYER**: No audit access
- **VIEWER**: No audit access

### Key Features

1. Non-blocking audit logging (errors don't break operations)
2. Automatic diff calculation from state snapshots
3. Advanced filtering (operations, dates, entity types, search)
4. URL-based filter persistence
5. CSV and JSON export with progress tracking
6. Pagination support (up to 100 records per request)
7. Real-time export progress updates
8. Export cancellation support

---

## Related Documents

- **README.md**: User-facing setup and overview documentation
- **CLAUDE.md**: Development guidelines and workflow instructions
- **docs/features/**: Feature-specific documentation
- **docs/development/**: Development guides and tutorials

---

## For New Team Members

1. Start with **AUDIT_SYSTEM_QUICK_REFERENCE.md** to understand the basics
2. Read **AUDIT_SYSTEM_RESEARCH.md** sections 1-5 to understand the backend
3. Read **AUDIT_SYSTEM_RESEARCH.md** sections 6-8 to understand the frontend
4. Check the relevant test files to see examples of usage
5. Refer to quick reference for specific questions

---

## Contributing to Audit System

When making changes to the audit system:

1. Keep field documentation up to date
2. Update AUDIT_SYSTEM_RESEARCH.md with significant changes
3. Update AUDIT_SYSTEM_QUICK_REFERENCE.md for limits or common operations
4. Ensure all tests pass
5. Follow the security checklist in Section 10 of AUDIT_SYSTEM_RESEARCH.md
6. Consider backward compatibility when adding new features

---

## Version History

**Created**: 2025-11-06
**Status**: Complete research documentation
**Coverage**: Entire audit system implementation (backend + frontend)
**Document Lines**: 1,266 total (965 research + 301 quick reference)
