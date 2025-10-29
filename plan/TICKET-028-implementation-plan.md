# TICKET-028 Implementation Plan: Branch Merge & Conflict Resolution

## Overview

Implement comprehensive branch merging capabilities with 3-way merge algorithm, conflict detection, resolution UI, and merge preview. This builds on the existing branching system from TICKET-027.

## Stage 1: 3-Way Merge Algorithm Foundation

**Goal**: Implement core 3-way merge algorithm for version comparison and merging

**Tasks**:

- [ ] Create `MergeService` class in `packages/api/src/graphql/services/merge.service.ts`
- [ ] Implement `findCommonAncestor(sourceBranchId, targetBranchId)` to identify merge base
- [ ] Implement `getEntityVersionsForMerge(entityType, entityId, sourceBranch, targetBranch, baseBranch, worldTime)` to retrieve the three versions
- [ ] Create `MergeResult` type with fields: `success`, `conflicts`, `mergedPayload`, `conflictDetails`
- [ ] Implement `compareVersions(base, source, target)` to detect changes in each branch
- [ ] Create unit tests for common ancestor finding (linear hierarchy, sibling branches, complex trees)
- [ ] Create unit tests for version retrieval logic

**Success Criteria**:

- [ ] Can find common ancestor branch for any two branches
- [ ] Can retrieve base, source, and target versions for 3-way merge
- [ ] All unit tests passing

## Stage 2: Conflict Detection Logic

**Goal**: Implement conflict detection for entity property changes

**Tasks**:

- [ ] Create `ConflictDetector` class for conflict analysis
- [ ] Implement `detectPropertyConflicts(basePayload, sourcePayload, targetPayload)` for JSON property comparison
- [ ] Create `ConflictType` enum: `BOTH_MODIFIED`, `BOTH_DELETED`, `MODIFIED_DELETED`, `DELETED_MODIFIED`
- [ ] Create `Conflict` interface with `path`, `type`, `baseValue`, `sourceValue`, `targetValue`
- [ ] Implement JSON path-based conflict representation (e.g., `settlement.population`, `structure.defenseRating`)
- [ ] Handle nested property conflicts (e.g., changes within Settlement's `resources` object)
- [ ] Implement auto-resolution for non-conflicting changes (only one branch modified)
- [ ] Create unit tests for all conflict scenarios (property modified in both, deleted in one, etc.)

**Success Criteria**:

- [ ] Detects conflicts when both branches modify same property
- [ ] Auto-resolves when only one branch has changes
- [ ] Provides detailed conflict information with JSON paths
- [ ] All unit tests passing for conflict detection

## Stage 3: Settlement & Structure Conflict Detection

**Goal**: Implement entity-specific conflict detection for Settlement and Structure entities

**Tasks**:

- [ ] Create `SettlementMergeHandler` class extending base merge logic
- [ ] Implement Settlement-specific conflict detection (population, resources, leaderName, etc.)
- [ ] Handle Settlement association conflicts (parentSettlement changes, kingdom changes)
- [ ] Create `StructureMergeHandler` class extending base merge logic
- [ ] Implement Structure-specific conflict detection (defenseRating, capacity, status, etc.)
- [ ] Handle Structure association conflicts (settlement changes, location changes)
- [ ] Create unit tests for Settlement merge scenarios (15+ scenarios)
- [ ] Create unit tests for Structure merge scenarios (15+ scenarios)

**Success Criteria**:

- [ ] Settlement property conflicts detected correctly
- [ ] Structure property conflicts detected correctly
- [ ] Association changes handled properly
- [ ] All entity-specific tests passing

## Stage 4: Merge Service GraphQL API

**Goal**: Expose merge operations through GraphQL API

**Tasks**:

- [ ] Create `MergeResolver` class with GraphQL decorators
- [ ] Implement `previewMerge(sourceBranchId, targetBranchId, worldTime)` query
- [ ] Create `MergePreview` GraphQL type with `conflicts`, `autoResolvedChanges`, `requiresManualResolution`
- [ ] Implement `executeMerge(sourceBranchId, targetBranchId, worldTime, resolutions)` mutation
- [ ] Create `ConflictResolution` input type for manual conflict resolution
- [ ] Create `MergeConflict` GraphQL type with detailed conflict information
- [ ] Add authorization checks (requires GM or OWNER role)
- [ ] Create integration tests for merge preview (10+ scenarios)
- [ ] Create integration tests for merge execution (10+ scenarios)

**Success Criteria**:

- [ ] GraphQL API exposes merge preview
- [ ] GraphQL API exposes merge execution
- [ ] Authorization enforced properly
- [ ] All integration tests passing

## Stage 5: Merge Execution & Version Creation

**Goal**: Implement merge execution that creates new versions in target branch

**Tasks**:

- [ ] Implement `MergeService.executeMerge()` to apply merge results
- [ ] Create merged versions in target branch for all affected entities
- [ ] Handle auto-resolved changes (create versions without user input)
- [ ] Apply manual conflict resolutions from user input
- [ ] Validate conflict resolutions (all conflicts must be resolved)
- [ ] Create audit log entries for merge operations (new `MERGE` operation type)
- [ ] Implement transaction wrapping for atomic merge execution
- [ ] Create `MergeHistory` model to track merge operations (source, target, conflicts, resolutions, timestamp)
- [ ] Create unit tests for merge execution (20+ scenarios)
- [ ] Create integration tests for end-to-end merge workflow

**Success Criteria**:

- [ ] Merge creates new versions in target branch
- [ ] Auto-resolved changes applied automatically
- [ ] Manual resolutions applied correctly
- [ ] Merge operations are atomic (all-or-nothing)
- [ ] Merge history tracked in database
- [ ] All tests passing

## Stage 6: Frontend - Merge Preview UI

**Goal**: Create UI for previewing merge changes and conflicts

**Tasks**:

- [ ] Create GraphQL hooks: `usePreviewMerge(sourceBranchId, targetBranchId, worldTime)`
- [ ] Create `MergePreviewDialog` component with source/target branch selection
- [ ] Display auto-resolved changes with visual diff (green highlighting)
- [ ] Display conflicts with detailed information (red highlighting)
- [ ] Show JSON path for each conflict (e.g., `settlement.population`)
- [ ] Show base, source, and target values side-by-side for conflicts
- [ ] Create expandable conflict details with syntax-highlighted JSON
- [ ] Add "Conflicts" and "Auto-Resolved" tabs for organization
- [ ] Implement world time selector for merge point
- [ ] Create 25+ comprehensive tests for merge preview UI

**Success Criteria**:

- [ ] User can preview merge before execution
- [ ] Conflicts displayed clearly with context
- [ ] Auto-resolved changes shown separately
- [ ] UI is responsive and user-friendly
- [ ] All UI tests passing

## Stage 7: Frontend - Conflict Resolution UI

**Goal**: Create interactive UI for resolving merge conflicts

**Tasks**:

- [ ] Create `ConflictResolutionDialog` component for manual resolution
- [ ] Display each conflict with "Choose Source", "Choose Target", "Edit Manually" options
- [ ] Implement inline JSON editor for custom conflict resolution (with validation)
- [ ] Show progress indicator (e.g., "3 of 12 conflicts resolved")
- [ ] Validate all conflicts resolved before allowing merge execution
- [ ] Create `useExecuteMerge(sourceBranchId, targetBranchId, worldTime, resolutions)` GraphQL hook
- [ ] Implement merge execution with loading states and progress feedback
- [ ] Show success message with count of entities merged
- [ ] Refetch branch data after successful merge
- [ ] Create 30+ comprehensive tests for conflict resolution UI

**Success Criteria**:

- [ ] User can resolve each conflict individually
- [ ] Can choose source/target values or edit manually
- [ ] Cannot execute merge until all conflicts resolved
- [ ] Merge execution creates versions in target branch
- [ ] All UI tests passing

## Stage 8: Cherry-Pick Functionality

**Goal**: Implement cherry-pick to selectively merge specific entity versions

**Tasks**:

- [ ] Create `MergeService.cherryPickVersion(versionId, targetBranchId)` method
- [ ] Validate cherry-pick source version exists and is accessible
- [ ] Create new version in target branch with cherry-picked payload
- [ ] Handle cherry-pick conflicts (if entity already modified in target)
- [ ] Create `cherryPickVersion` GraphQL mutation
- [ ] Create unit tests for cherry-pick logic (15+ scenarios)
- [ ] Create integration tests for cherry-pick GraphQL API
- [ ] Create `useCherryPickVersion(versionId, targetBranchId)` GraphQL hook
- [ ] Add "Cherry-Pick" button to version history UI (in branch comparison view)
- [ ] Create `CherryPickDialog` component for conflict handling
- [ ] Create 20+ comprehensive tests for cherry-pick UI

**Success Criteria**:

- [ ] Can cherry-pick individual versions between branches
- [ ] Cherry-pick conflicts detected and resolvable
- [ ] UI provides clear feedback on cherry-pick operations
- [ ] All tests passing

## Stage 9: Merge History Tracking & Visualization

**Goal**: Track and visualize merge history for audit trail

**Tasks**:

- [ ] Create Prisma migration for `MergeHistory` model (id, sourceBranchId, targetBranchId, mergedAt, userId, conflictsCount, resolutionsData)
- [ ] Implement `MergeService.recordMergeHistory()` called during merge execution
- [ ] Create `getMergeHistory(branchId)` GraphQL query to retrieve merge history
- [ ] Create `MergeHistoryEntry` GraphQL type with full merge details
- [ ] Create `useGetMergeHistory(branchId)` GraphQL hook
- [ ] Create `MergeHistoryView` component displaying merge timeline
- [ ] Show merge operations with source/target branches, timestamps, conflict counts
- [ ] Add expandable details showing which entities were merged and resolutions applied
- [ ] Integrate into BranchHierarchyView as expandable panel
- [ ] Create 15+ comprehensive tests for merge history UI

**Success Criteria**:

- [ ] All merges tracked in database
- [ ] Merge history viewable in UI
- [ ] Shows complete audit trail of merge operations
- [ ] All tests passing

## Stage 10: Integration Testing & Polish

**Goal**: Comprehensive end-to-end testing and production polish

**Tasks**:

- [ ] Create E2E test: Full merge workflow (create branches, modify entities, merge, resolve conflicts)
- [ ] Create E2E test: Settlement merge with property and association conflicts
- [ ] Create E2E test: Structure merge with property and association conflicts
- [ ] Create E2E test: Cherry-pick workflow across multiple branches
- [ ] Create E2E test: Multi-level branch merging (grandchild → child → parent)
- [ ] Create E2E test: Merge history tracking and retrieval
- [ ] Test error handling: unauthorized merge attempts, invalid conflict resolutions
- [ ] Test edge cases: merging into ancestor, circular merge attempts, concurrent merges
- [ ] Performance test: Merge with 100+ entity conflicts
- [ ] Add loading states and error handling polish to all UI components
- [ ] Add keyboard shortcuts for conflict resolution (n/p for next/previous, s/t for source/target)
- [ ] Update documentation: Add merge system to `docs/features/branching-system.md`
- [ ] Update CLAUDE.md and README.md with merge feature references

**Success Criteria**:

- [ ] All E2E tests passing
- [ ] Error handling comprehensive and user-friendly
- [ ] Performance acceptable with large conflict sets
- [ ] Documentation complete and accurate
- [ ] Production-ready polish applied

## Notes

- **3-Way Merge**: Uses common ancestor (merge base) + source branch + target branch to detect conflicts
- **Auto-Resolution**: If only one branch modified a property, automatically use that value
- **Conflict**: Both branches modified the same property - requires manual resolution
- **Cherry-Pick**: Selectively apply specific version from one branch to another
- **Merge Direction**: Typically merge child branch → parent branch, but algorithm supports any direction
- **World Time**: Merge happens at a specific world time point - uses version resolution to get entity states
- **Transaction Safety**: All merge operations must be atomic (rollback on failure)
- **Authorization**: Only GM and OWNER roles can execute merges (same as branch creation/deletion)

## Dependencies

- TICKET-027 (Branching System - Fork & View) - ✅ COMPLETE
- Existing versioning system from TICKET-007
- Existing Settlement and Structure entities

## Estimated Effort

4-5 days (consistent with ticket estimate)
