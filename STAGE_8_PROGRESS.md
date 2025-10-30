# Stage 8 Progress: Cherry-Pick Functionality

## Completed (Backend - GraphQL API Layer)

### GraphQL Mutation & Types (commit c2e9f22)

- **File**: `packages/api/src/graphql/resolvers/merge.resolver.ts`
- **Mutation**: `cherryPickVersion(input: CherryPickVersionInput): CherryPickResult`
- **Features**:
  - Validates source version and target branch existence
  - Enforces same-campaign constraint (prevents cross-campaign cherry-pick)
  - Requires GM/OWNER authorization via checkCanMerge()
  - Converts service result to GraphQL types with JSON serialization
  - Returns conflict information for UI to display before resolution
  - Delegates business logic to MergeService layer

- **GraphQL Types**:
  - `CherryPickResult`: success, hasConflict, conflicts, versionId, error
  - Reuses `MergeConflict` type for consistent conflict representation
  - Reuses `CherryPickVersionInput` from branch.input.ts

### Integration Tests (commit c2e9f22)

- **File**: `packages/api/src/graphql/resolvers/merge.resolver.integration.test.ts`
- **7 comprehensive test scenarios**:
  1. Validation: Non-existent source version (NotFoundException)
  2. Validation: Non-existent target branch (NotFoundException)
  3. Validation: Cross-campaign cherry-pick (BadRequestException)
  4. Authorization: User without campaign access (ForbiddenException)
  5. Success: Cherry-pick without conflicts (auto-apply)
  6. Success: Conflict detection when target modified
  7. Success: Conflict resolution with manual resolutions

**All 21 integration tests passing** ✅ (7 new cherry-pick + 14 existing merge/preview)

### Bug Fixes (discovered during testing)

1. **Prisma model name**: Changed `entityVersion` → `version` (resolver line 205)
2. **Conflict mapping**: Service `MergeConflict` doesn't have `description`/`suggestion`, resolver generates them (lines 244-245)
3. **Cherry-pick semantics**: Fixed to compare against **current** target state instead of historical state (service.ts:768)
4. **Test cleanup**: Fixed foreign key constraint violations by deleting entities in correct order

## Completed (Backend Service Layer)

### 1. MergeService Implementation

- **File**: `packages/api/src/graphql/services/merge.service.ts`
- **Method**: `cherryPickVersion(sourceVersionId, targetBranchId, user, resolutions?)`
- **Features**:
  - Validates source version and target branch existence
  - Performs 2-way conflict detection (source vs target)
  - Auto-applies version if no conflicts
  - Returns conflict information if conflicts detected
  - Accepts manual resolutions for conflicts
  - Creates new version in target branch
  - Generates audit log with 'CHERRY_PICK' operation

### 2. TypeScript Types

- **Added `CherryPickResult` interface** with fields:
  - `success`: boolean
  - `hasConflict`: boolean
  - `conflicts?`: MergeConflict[]
  - `versionCreated?`: any
  - `error?`: string

### 3. GraphQL Input Types

- **File**: `packages/api/src/graphql/inputs/branch.input.ts`
- **Added `CherryPickVersionInput`** with fields:
  - `sourceVersionId`: UUID (required)
  - `targetBranchId`: UUID (required)
  - `resolutions?`: ConflictResolution[] (optional)

### 4. Comprehensive Unit Tests

- **File**: `packages/api/src/graphql/services/merge.service.test.ts`
- **11 test scenarios** covering:
  1. Missing source version (NotFoundException)
  2. Missing target branch (BadRequestException)
  3. No conflict scenario (auto-apply)
  4. Conflict detection when target modified
  5. Manual conflict resolution
  6. Conflict information return
  7. Entity doesn't exist in target
  8. Correct world time usage
  9. Audit log creation
  10. Partial resolution validation
  11. Nested property conflicts

**All 20 MergeService tests passing** ✅

## Remaining Work for Stage 8

### 1. GraphQL Mutation Layer

- Add `cherryPickVersion` mutation to `MergeResolver`
- Authorization checks (require GM/OWNER role)
- GraphQL return type for cherry-pick result
- Integration tests for GraphQL API

### 2. Frontend React Components

- `useCherryPickVersion` GraphQL hook
- Add "Cherry-Pick" button to version history UI
- `CherryPickDialog` component for conflict handling
- 20+ UI test scenarios

### 3. Integration Testing

- End-to-end cherry-pick workflow tests
- Authorization validation tests
- Conflict resolution flow tests

## Key Design Decisions

1. **2-Way Conflict Detection**: Cherry-pick uses empty base `{}` for conflict detection (not 3-way merge), treating any difference between source and target as a conflict.

2. **Flexible Conflict Handling**: Returns conflict info when no resolutions provided (doesn't throw), allowing UI to show conflicts before requiring resolution.

3. **Reuses Existing Infrastructure**: Leverages `ConflictDetector`, `ConflictResolution` input type, and existing conflict resolution logic from merge system.

4. **Audit Trail**: Creates 'CHERRY_PICK' audit log entries with metadata (source version, target branch, conflicts resolved).

## Next Steps

1. Complete GraphQL mutation in `MergeResolver` with authorization
2. Write integration tests for GraphQL API
3. Implement frontend hooks and UI components
4. Write comprehensive UI tests
5. Test end-to-end workflow
6. Update documentation

## Performance Notes

- Uses single DB query to fetch source version
- Single DB query to fetch target branch
- Parallel resolution of target version state
- No N+1 queries in conflict detection
- Efficient conflict detection using existing `ConflictDetector` class
