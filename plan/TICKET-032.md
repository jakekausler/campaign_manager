# TICKET-032: Audit System

## Status

- [ ] Completed
- **Commits**:

## Description

Implement comprehensive audit logging system that tracks all mutations with actor, timestamp, diff, and reason.

## Scope of Work

1. Create Audit model and service
2. Implement audit logging middleware
3. Add audit entry creation on all mutations
4. Audit logging for Settlement mutations (CREATE, UPDATE, DELETE)
5. Audit logging for Structure mutations (CREATE, UPDATE, DELETE)
6. Create audit query API
7. Add audit query filters: settlementsCreated, settlementsUpdated, settlementsDeleted
8. Add audit query filters: structuresCreated, structuresUpdated, structuresDeleted
9. Implement audit log viewer UI
10. Add filtering (by user, entity, date range)
11. Create audit export functionality

## Acceptance Criteria

- [ ] All mutations create audit entries
- [ ] Settlement mutations create audit records
- [ ] Structure mutations create audit records
- [ ] Audit includes actor, timestamp, diff
- [ ] Can query audit log
- [ ] Can filter audit log by Settlement operations
- [ ] Can filter audit log by Structure operations
- [ ] UI shows audit history
- [ ] Can filter and search audit log
- [ ] Can export audit log

## Dependencies

- Requires: TICKET-006

## Estimated Effort

~~2-3 days~~ **REVISED: 1.5-2 days** (based on discovery that Audit system already exists)

## Implementation Notes

### Stage 1 Research & Discovery (2025-11-05)

**Critical Discovery**: The Audit system is **NOT a greenfield project**—it already exists and is fully functional!

#### What Exists Today:

- **Database Model**: `Audit` table in Prisma schema (schema.prisma lines 712-727)
- **Service Layer**: `AuditService` at `packages/api/src/graphql/services/audit.service.ts`
  - Method: `log(entityType, entityId, operation, userId, changes, metadata?)`
  - Used by 22+ services (Settlement, Structure, Character, Event, Encounter, Branch, etc.)
  - Comprehensive test coverage in `audit.service.test.ts`
- **GraphQL API**: Two queries already implemented in `audit.resolver.ts`
  - `entityAuditHistory(entityType, entityId, limit)` - query by entity
  - `userAuditHistory(userId, limit)` - query by user
- **Operation Types**: CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, CHERRY_PICK
- **Integration**: Fully integrated across all entity services, proven in production

#### Gap Analysis:

Missing features required by TICKET-032:

1. **previousState** field - full entity snapshot before mutation
2. **newState** field - full entity snapshot after mutation
3. **diff** field - structured diff calculation
4. **reason** field - optional user-provided explanation
5. Advanced filtering (date range, multiple operations)
6. Frontend UI for viewing audit logs
7. Export functionality (CSV, JSON)

#### Implementation Decision: **Option A - Enhance Existing Model**

**Rationale**:

- Maintains backward compatibility with 22+ existing service integrations
- Aligns with project patterns (Version, MergeHistory, EffectExecution models)
- Enables future rollback/restore features
- Provides explicit semantics (clear field purpose)
- Better queryability for advanced use cases

**Approach**:

1. Add new **nullable** fields to existing Audit model (`previousState Json?`, `newState Json?`, `diff Json?`, `reason String?`)
2. Keep existing `changes` and `metadata` fields for backward compatibility
3. Enhance `AuditService.log()` with **optional** parameters (no breaking changes)
4. Auto-calculate diff using existing `calculateDiff` utility from `version.utils.ts`
5. Gradually migrate high-value services to use enhanced format

#### Key Resources Created:

- **`TICKET-032-gap-analysis.md`**: Detailed comparison of existing vs required functionality
- **`TICKET-032-implementation-plan-REVISED.md`**: Complete revised implementation plan with Option A stages
- Subagent research on:
  - Prisma migration patterns and workflow
  - GraphQL schema update patterns (code-first with NestJS)
  - AuditService implementation and enhancement strategy

#### Technical Findings:

1. **Diff Utility Already Exists**: `calculateDiff` in `version.utils.ts` - battle-tested, no new library needed
2. **Migration Pattern**: Use `pnpm --filter @campaign/api prisma:migrate` from project root
3. **GraphQL Pattern**: Code-first with `@Field()` decorators, use `GraphQLJSON` for JSON fields
4. **Backward Compatibility**: Optional parameters ensure existing code works unchanged
5. **Test Coverage**: Existing tests comprehensive, need enhancement for new fields

#### Revised Stages:

- **Stage 1A**: Enhance Prisma Schema with new fields
- **Stage 1B**: Create & Run Prisma Migration
- **Stage 1C**: Update GraphQL Schema Types
- **Stage 1D**: Enhance AuditService API
- **Stage 1E**: Write Integration Tests for Enhanced Audit
- **Stages 2-10**: Continue with UI, export, permissions (per revised plan)

**Status**: Research complete. Ready to begin Stage 1A (Prisma schema enhancement).

### Stage 1C Implementation (2025-11-05)

**Completed**: GraphQL Schema Types updated to expose enhanced audit fields.

#### Changes Made:

1. **GraphQL Type Extensions** (`packages/api/src/graphql/types/audit.type.ts`):
   - Added `previousState` field: nullable GraphQLJSON with description
   - Added `newState` field: nullable GraphQLJSON with description
   - Added `diff` field: nullable GraphQLJSON with description
   - Added `reason` field: nullable String with description
   - All fields properly marked as optional to maintain backward compatibility

2. **Resolver Updates** (`packages/api/src/graphql/resolvers/audit.resolver.ts`):
   - Updated `entityAuditHistory` resolver to cast new JSON fields
   - Updated `userAuditHistory` resolver to cast new JSON fields
   - Implemented null-to-undefined conversion for `reason` field (database null → GraphQL undefined)
   - Maintains consistent pattern with existing field casting

3. **Verification**:
   - Type-check: ✅ Passed without errors
   - Build: ✅ Compiled successfully
   - Pre-commit hooks: ✅ Format and lint passed

**Commit**: fa6b668 - feat(api): add enhanced audit fields to GraphQL schema

**Next Steps**: Stage 1D - Enhance AuditService API to populate new fields when creating audit entries.

### Stage 1D Implementation (2025-11-05)

**Completed**: Enhanced AuditService.log() method with optional state tracking parameters.

#### Changes Made:

1. **AuditService Enhancement** (`packages/api/src/graphql/services/audit.service.ts`):
   - Imported `calculateDiff` utility from version.utils for consistent diff logic
   - Added three new optional parameters to `log()` method:
     - `previousState?` - Full entity snapshot before mutation
     - `newState?` - Full entity snapshot after mutation
     - `reason?` - User-provided explanation for operation
   - Implemented auto-diff calculation when both states provided
   - Used JSON round-trip serialization for type-safe Prisma InputJsonValue conversion
   - Enhanced error logging with `hasEnhancedData` flag for debugging
   - Updated JSDoc comments to document new parameters

2. **Verification**:
   - Type-check: ✅ Passed without errors
   - Build: ✅ Compiled successfully
   - Pre-commit hooks: ✅ Format and lint passed
   - Code Review: ✅ Approved with no critical issues

**Commit**: 82ef735 - feat(api): enhance AuditService with state tracking and auto-diff

**Next Steps**: Stage 1E - Write integration tests for enhanced Audit functionality.
