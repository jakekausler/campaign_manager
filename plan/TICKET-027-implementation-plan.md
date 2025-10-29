# TICKET-027 Implementation Plan: Branching System (Fork & View)

## Overview

Implement the branching system that enables alternate timeline management. The database schema for branches already exists (from TICKET-003), and the version resolution algorithm (from TICKET-007) already supports branch inheritance. This ticket focuses on:

1. **Backend Services**: Branch CRUD, fork operation, version resolution for Settlement/Structure
2. **GraphQL API**: Queries, mutations, and subscriptions for branch operations
3. **Frontend UI**: Branch selector, hierarchy visualization, comparison view

## Stage 1: Branch Service & Basic CRUD Operations

**Goal**: Create the backend service layer for branch management with full CRUD operations.

**Tasks**:

- [x] Create `packages/api/src/graphql/services/branch.service.ts`
  - Implement `create(campaignId, name, description, parentId?, divergedAt?)`
  - Implement `findById(id)` with parent/children relations
  - Implement `findByCampaign(campaignId)`
  - Implement `update(id, input)` for name/description only
  - Implement `delete(id)` with soft delete (set deletedAt)
  - Implement `getHierarchy(campaignId)` for tree structure
  - Implement `getAncestry(branchId)` to walk up parent chain
  - Add validation: prevent circular parent references
  - Add validation: prevent deleting branch with children
- [x] Create `packages/api/src/graphql/inputs/branch.input.ts`
  - Define `CreateBranchInput`, `UpdateBranchInput`, `BranchWhereInput`
- [x] Create unit tests in `packages/api/src/graphql/services/branch.service.test.ts`
  - Test CRUD operations
  - Test hierarchy retrieval
  - Test ancestry chain walking
  - Test validation rules (circular refs, delete with children)
- [x] Update `packages/api/src/graphql/services/version.service.ts`
  - Add `getBranchById(branchId)` method for resolution algorithm to use
  - Ensure `resolveVersion` correctly handles branch ancestry

**Success Criteria**:

- ✅ All branch CRUD operations work correctly
- ✅ Branch hierarchy can be retrieved for a campaign
- ✅ Ancestry chain correctly walks up parent references
- ✅ Validation prevents invalid branch configurations
- ✅ All unit tests pass

**Commit Message Template**:

```
feat(api): implement Branch service with CRUD operations

Created BranchService with full CRUD functionality:
- Create, read, update (name/description only), soft delete
- Hierarchy retrieval (tree structure for campaign)
- Ancestry chain walking for version resolution
- Validation for circular references and protected deletions

Added comprehensive unit tests covering all operations and edge cases.

Part of TICKET-027 Stage 1.
```

**Status**: ✅ Complete (Commit: aaf526e)

---

## Stage 2: Fork Operation & Version Copying

**Goal**: Implement the fork operation that creates a child branch and copies current entity state as the divergence point.

**Tasks**:

- [x] Add `fork(sourceBranchId, name, description, worldTime, userId)` to BranchService
  - Create child branch with parentId = sourceBranchId
  - Set divergedAt to worldTime parameter
  - Copy current versions for all entity types:
    - Query versions at worldTime for source branch using resolveVersion
    - Create new version records in target branch with validFrom = worldTime
    - Entity types: Campaign, World, Location, Character, Party, Kingdom, Settlement, Structure, Encounter, Event
  - Handle Settlement hierarchy (Settlement → Structures relationship)
  - Transaction: rollback if any version copy fails
  - Return the new branch with count of copied versions
- [x] Add helper method `copyVersionsForEntityType(sourceId, targetId, entityType, worldTime, userId)`
  - Query all entities of type in source branch at worldTime
  - For each entity, resolve current version
  - Create new version in target branch
  - Reuse compressed payloads directly without decompression/recompression
- [x] ~~Add helper method `copySettlementHierarchy(sourceBranchId, targetBranchId, settlementId, worldTime, userId)`~~
  - Not needed: Settlement-Structure hierarchy preserved automatically by copying all entity types
- [x] Update version service to expose compression utilities if not already public
  - Already public, no changes needed
- [x] Create unit tests in `branch.service.test.ts`
  - Test fork creates child branch correctly
  - Test versions copied for all entity types
  - Test branch ancestry filtering (only copies from source branch chain)
  - Test transaction rollback on error
  - Test divergedAt timestamp set correctly
  - Test batch resolution optimization (Promise.all)

**Success Criteria**:

- ✅ Fork operation creates child branch with correct parent reference
- ✅ All entity versions at fork point copied to new branch
- ✅ Settlement-Structure hierarchy preserved in fork
- ✅ Transaction rollback works on copy failure
- ✅ Payload compression maintained in copied versions
- ✅ All unit tests pass

**Commit Message Template**:

```
feat(api): implement fork operation for branching system

Added BranchService.fork() to create alternate timeline branches:
- Creates child branch with divergedAt timestamp
- Copies all entity versions at fork point (Campaign, World, Location,
  Character, Party, Kingdom, Settlement, Structure, Encounter, Event)
- Preserves Settlement-Structure hierarchy relationships
- Uses transactions to ensure atomic operation
- Maintains payload compression for storage efficiency

Includes comprehensive tests for fork operation and error handling.

Part of TICKET-027 Stage 2.
```

**Status**: ✅ Complete (Commit: 83f7754)

---

## Stage 3: GraphQL API for Branches

**Goal**: Create GraphQL queries, mutations, and types for branch operations.

**Tasks**:

- [ ] Create `packages/api/src/graphql/resolvers/branch.resolver.ts`
  - Query: `branch(id: ID!): Branch`
  - Query: `branches(campaignId: ID!): [Branch!]!`
  - Query: `branchHierarchy(campaignId: ID!): [BranchNode!]!` (tree structure)
  - Mutation: `createBranch(input: CreateBranchInput!): Branch!`
  - Mutation: `updateBranch(id: ID!, input: UpdateBranchInput!): Branch!`
  - Mutation: `deleteBranch(id: ID!): Boolean!`
  - Mutation: `forkBranch(input: ForkBranchInput!): ForkResult!`
  - Add authorization checks (must be campaign member)
- [ ] Define GraphQL types in resolver or separate schema file
  - `Branch` type with fields: id, name, description, parent, children, campaign, divergedAt, createdAt, updatedAt
  - `BranchNode` type for hierarchy: branch, children (recursive)
  - `ForkBranchInput`: sourceBranchId, name, description, worldTime
  - `ForkResult`: branch, versionsCopied
- [ ] Update `packages/api/src/graphql/schema.graphql` (if using schema-first approach)
- [ ] Create E2E tests in `packages/api/src/graphql/resolvers/__tests__/branch.resolver.e2e.test.ts`
  - Test all queries and mutations
  - Test authorization (non-members cannot access)
  - Test fork operation via GraphQL
  - Test error handling (invalid input, not found, etc.)

**Success Criteria**:

- ✅ All GraphQL operations work correctly
- ✅ Authorization enforced for campaign membership
- ✅ Fork mutation returns correct result with version count
- ✅ Hierarchy query returns proper tree structure
- ✅ All E2E tests pass

**Commit Message Template**:

```
feat(api): add GraphQL API for branch operations

Created BranchResolver with complete GraphQL API:
- Queries: branch, branches, branchHierarchy (tree structure)
- Mutations: create, update, delete, fork
- Authorization checks for campaign membership
- Comprehensive error handling

Added E2E tests covering all operations, auth checks, and error cases.

Part of TICKET-027 Stage 3.
```

**Status**: ✅ Complete (Commit: 754b3d0)

---

## Stage 4: Version Resolution for Settlement & Structure

**Goal**: Ensure Settlement and Structure entities correctly resolve versions across branches using the existing version service.

**Tasks**:

- [ ] Update `packages/api/src/graphql/services/settlement.service.ts`
  - Add `getSettlementAsOf(id, branchId, worldTime)` method
  - Use `versionService.resolveVersion('settlement', id, branchId, worldTime)`
  - Decompress payload and map to Settlement entity
- [ ] Update `packages/api/src/graphql/services/structure.service.ts`
  - Add `getStructureAsOf(id, branchId, worldTime)` method
  - Use `versionService.resolveVersion('structure', id, branchId, worldTime)`
  - Decompress payload and map to Structure entity
- [ ] Update Settlement resolver to support branch context
  - Accept optional `branchId` and `asOf` arguments in queries
  - Default to campaign's current branch and world time if not specified
- [ ] Update Structure resolver to support branch context
  - Accept optional `branchId` and `asOf` arguments in queries
  - Default to campaign's current branch and world time if not specified
- [ ] Create integration tests
  - Test Settlement version resolution across branch hierarchy
  - Test Structure version resolution across branch hierarchy
  - Test that child branches inherit parent versions correctly
  - Test that child branch changes don't affect parent

**Success Criteria**:

- ✅ Settlement versions resolve correctly using branch ancestry
- ✅ Structure versions resolve correctly using branch ancestry
- ✅ Child branches inherit parent versions when no override exists
- ✅ Child branch modifications don't affect parent branch
- ✅ All integration tests pass

**Commit Message Template**:

```
feat(api): add version resolution for Settlement and Structure entities

Extended Settlement and Structure services with branch-aware queries:
- Implemented getSettlementAsOf(id, branchId, worldTime)
- Implemented getStructureAsOf(id, branchId, worldTime)
- Updated GraphQL resolvers to accept branch context
- Leverages existing version resolution with branch ancestry

Added integration tests verifying correct resolution across branch hierarchy.

Part of TICKET-027 Stage 4.
```

**Status**: ✅ Complete (Commit: ac87286)

---

## Stage 5: Frontend - Branch Selector Component

**Goal**: Create UI component for selecting and switching between branches.

**Tasks**:

- [x] Create `packages/frontend/src/components/features/branches/BranchSelector.tsx`
  - Drawer/Sheet showing all branches for current campaign
  - Display current branch prominently
  - Show branch hierarchy (indent children, show parent path)
  - Click to switch to different branch
  - Show branch metadata (name, description, divergedAt) on hover
- [x] Create GraphQL queries in `packages/frontend/src/services/api/hooks/branches.ts`
  - `GET_BRANCHES` query for campaign
  - `GET_BRANCH_HIERARCHY` query for tree structure
  - `GET_BRANCH` query for single branch details
- [x] Add branch context to Zustand store `packages/frontend/src/stores/campaign-slice.ts`
  - Add `campaignBranchMap: Record<string, string>` for per-campaign persistence
  - `currentBranchId` already exists
  - Update `setCurrentBranch(branchId: string)` action to persist to campaignBranchMap
  - Persist branch selection in localStorage per campaign via campaignBranchMap
- [x] Update campaign context provider to include branch (N/A for Stage 5)
  - Note: This will be done in later stages when features query branch-specific data
  - BranchSelector manages branch selection state only in Stage 5
- [x] Add branch indicator to main navigation/header
  - Show current branch name in BranchSelector button
  - Integrated into MainLayout header
  - Click to open BranchSelector Sheet
- [x] Create Vitest tests for BranchSelector component

**Success Criteria**:

- ✅ Branch selector shows all campaign branches in hierarchy
- ✅ Clicking branch switches context and refetches data
- ✅ Current branch persisted across page reloads (per campaign via campaignBranchMap)
- ✅ Branch indicator visible in main UI (integrated in MainLayout header)
- ✅ Component tests pass (12 comprehensive test scenarios)

**Commit Message Template**:

```
feat(frontend): add branch selector component

Created BranchSelector UI component for branch management:
- Sheet/drawer with hierarchical branch display
- Switch between branches with single click
- Shows branch metadata on hover
- Branch context stored in Zustand with localStorage persistence per campaign
- Branch indicator in main navigation

Added component tests covering selection and context switching.

Part of TICKET-027 Stage 5.
```

**Status**: ✅ Complete (Commit: ad01e75)

---

## Stage 6: Frontend - Fork Branch UI

**Goal**: Create UI for forking branches (creating new alternate timelines).

**Tasks**:

- [x] Create `packages/frontend/src/components/features/branches/ForkBranchDialog.tsx`
  - Modal dialog for fork operation
  - Input: new branch name (required)
  - Input: description (optional)
  - Display: source branch name
  - Display: current world time as divergence point
  - Button: "Create Fork" (with loading state)
  - Show progress: "Copying versions..." with count
  - Show result: "Fork created successfully. X versions copied."
- [x] GraphQL mutation already exists in `packages/frontend/src/services/api/hooks/branches.ts`
  - `FORK_BRANCH` mutation with ForkBranchInput (already implemented in Stage 5)
  - `useForkBranch` hook ready to use
- [x] Add fork action to BranchSelector
  - Button "Fork this branch" in Sheet header
  - Opens ForkBranchDialog with current branch as source
- [ ] Add fork action to campaign settings (deferred to future stage)
  - Allow forking from any branch (not just current)
- [x] Handle errors gracefully
  - Show error message if fork fails
  - Validation: branch name required, source branch existence, world time availability
- [x] Create Vitest tests for ForkBranchDialog

**Success Criteria**:

- ✅ Fork dialog collects necessary input
- ✅ Fork mutation executes and shows progress
- ✅ New branch created and automatically selected
- ✅ Error handling shows helpful messages
- ✅ Component tests pass

**Commit Message Template**:

```
feat(frontend): add fork branch UI dialog

Created ForkBranchDialog for creating alternate timeline branches:
- Modal with name, description inputs
- Shows source branch and divergence point (world time)
- Executes fork mutation with loading/progress state
- Displays success with version count copied
- Comprehensive error handling and validation

Added component tests for fork dialog and user interactions.

Part of TICKET-027 Stage 6.
```

**Status**: ✅ Complete (Commit: 52a20e3)

---

## Stage 7: Frontend - Branch Hierarchy Visualization

**Goal**: Create visual representation of branch hierarchy as a tree diagram.

**Tasks**:

- [ ] Create `packages/frontend/src/components/branches/BranchHierarchyView.tsx`
  - Tree visualization using React Flow or similar library
  - Each node shows: branch name, divergedAt timestamp, created date
  - Lines connecting parent to child branches
  - Highlight current branch
  - Click node to switch to that branch
  - Show branch actions on hover (fork, rename, delete)
- [ ] Add branch hierarchy view to campaign settings/management page
  - Tab or section dedicated to branch management
  - Shows full hierarchy visualization
- [ ] Add branch statistics to nodes
  - Count of versions in branch
  - Count of diverged entities (entities with versions different from parent)
  - Last modified timestamp
- [ ] Make hierarchy interactive
  - Pan and zoom for large trees
  - Expand/collapse branches with many children
  - Search/filter branches by name
- [ ] Create Vitest tests for hierarchy component

**Success Criteria**:

- ✅ Branch hierarchy displayed as clear tree diagram
- ✅ Current branch highlighted
- ✅ Click to switch branches
- ✅ Statistics shown for each branch
- ✅ Interactive controls work (pan, zoom, search)
- ✅ Component tests pass

**Commit Message Template**:

```
feat(frontend): add branch hierarchy visualization

Created BranchHierarchyView with interactive tree diagram:
- Visual tree showing parent-child relationships
- Nodes display branch metadata and statistics
- Highlighted current branch
- Click to switch, hover for actions
- Pan/zoom/search controls for large hierarchies

Uses React Flow for smooth, performant visualization.

Added component tests for hierarchy rendering and interactions.

Part of TICKET-027 Stage 7.
```

**Status**: ✅ Complete (Commit: dd80ade)

---

## Stage 8: Frontend - Branch Comparison View

**Goal**: Create UI for comparing entity states between branches.

**Tasks**:

- [ ] Create `packages/frontend/src/components/branches/BranchComparisonView.tsx`
  - Side-by-side diff view for two branches
  - Select source and target branches from dropdowns
  - Select entity to compare (search/autocomplete)
  - Show entity state in both branches at specific world time
  - Highlight differences (added, modified, removed fields)
  - Use diff library (e.g., `diff` or `react-diff-viewer`) for visual comparison
- [ ] Create GraphQL query for comparison
  - `COMPARE_BRANCHES` query that accepts branchId1, branchId2, entityType, entityId, worldTime
  - Returns resolved versions from both branches
  - Backend calculates diff using existing version diff utility
- [ ] Add comparison view to branch management page
  - Tab or modal for branch comparison
  - Link from hierarchy view ("Compare with parent")
- [ ] Support common comparison scenarios
  - Compare current branch with parent (default)
  - Compare any two branches
  - Compare same entity across multiple branches
- [ ] Create Vitest tests for comparison component

**Success Criteria**:

- ✅ Can select two branches and entity to compare
- ✅ Diff view clearly shows added/modified/removed fields
- ✅ Default comparison (current vs parent) works out of the box
- ✅ Visual diff is easy to read and understand
- ✅ Component tests pass

**Commit Message Template**:

```
feat(frontend): add branch comparison view

Created BranchComparisonView for diffing entity states:
- Side-by-side comparison of two branches
- Entity search with autocomplete
- Visual diff highlighting changes (add/modify/remove)
- Default comparison with parent branch
- Supports comparison at specific world time

Uses react-diff-viewer for clear, readable diffs.

Added component tests for comparison scenarios.

Part of TICKET-027 Stage 8.
```

**Status**: ✅ Complete (Commit: 65fb8e8)

---

## Stage 9: Integration Testing & Documentation

**Goal**: Comprehensive E2E testing and user documentation.

**Tasks**:

- [ ] Create E2E test suite in `packages/api/src/__tests__/e2e/branching.e2e.test.ts`
  - Test complete fork workflow (create campaign, create branch, fork, verify versions)
  - Test version resolution across 3+ levels of branch hierarchy
  - Test Settlement-Structure hierarchy preservation in forks
  - Test switching branches in UI (if E2E tests cover frontend)
  - Test concurrent edits in different branches don't conflict
- [ ] Create frontend integration tests
  - Test branch selector integration with campaign data
  - Test fork operation from UI to backend
  - Test branch switching updates all views (Map, Timeline, Flow)
  - Test comparison view shows accurate diffs
- [ ] Update documentation
  - Add branching system overview to `docs/features/branching-system.md`
  - Document fork operation with examples
  - Document version resolution algorithm for branches
  - Add screenshots of branch UI components
  - Update `README.md` with branching feature description
  - Update `CLAUDE.md` with branching patterns for future development
- [ ] Performance testing
  - Test fork operation with large number of entities (1000+)
  - Test version resolution performance with deep branch hierarchy (10+ levels)
  - Add database indexes if performance issues found

**Success Criteria**:

- ✅ All E2E tests pass
- ✅ Frontend integration tests pass
- ✅ Complete documentation with examples
- ✅ Performance acceptable for realistic data volumes
- ✅ No regressions in existing functionality

**Commit Message Template**:

```
test(api): add comprehensive E2E tests for branching system

Created extensive test suite covering:
- Complete fork workflow end-to-end
- Version resolution across deep branch hierarchies
- Settlement-Structure relationship preservation
- Concurrent edits in separate branches
- Performance with large datasets

docs(features): document branching system

Added comprehensive documentation:
- Branching system overview with architecture
- Fork operation examples and use cases
- Version resolution algorithm explanation
- UI component screenshots and workflows

Part of TICKET-027 Stage 9.
```

**Status**: Not Started

---

## Stage 10: Polish & Edge Cases

**Goal**: Handle edge cases, add polish, and prepare for production.

**Tasks**:

- [ ] Add branch deletion safeguards
  - Confirmation dialog with warning about impact
  - Prevent deletion of default/main branch
  - Cascade delete or orphan child branches (decide policy)
  - Archive instead of hard delete option
- [ ] Add branch rename validation
  - Check for name conflicts within campaign
  - Update UI immediately when renamed
  - Broadcast rename to other users via subscription (future: TICKET-029)
- [ ] Add branch metadata features
  - Favorite/pin branches for quick access
  - Color coding for branch categories (what-if, historical, experimental)
  - Tags for organizing branches
- [ ] Add branch permissions (if needed for campaign roles)
  - Only GM can fork/delete branches?
  - Players can view but not modify branch structure?
  - Configurable per campaign
- [ ] Handle orphaned branches gracefully
  - If parent deleted, what happens to children?
  - UI indication of orphaned status
- [ ] Add loading states and optimistic updates
  - Branch operations feel instant with optimistic UI
  - Rollback on error
- [ ] Add keyboard shortcuts for branch operations
  - Ctrl+B to open branch selector
  - Ctrl+Shift+F to fork current branch
- [ ] Create release notes for branching feature
  - User-facing changelog entry
  - Migration notes if schema changes needed

**Success Criteria**:

- ✅ All edge cases handled gracefully
- ✅ UI polish complete (loading, errors, validation)
- ✅ Keyboard shortcuts work
- ✅ Documentation complete
- ✅ Ready for production release

**Commit Message Template**:

```
feat(api,frontend): polish branching system for production

Added final polish and edge case handling:
- Branch deletion safeguards with confirmation
- Rename validation and conflict detection
- Metadata features (favorites, colors, tags)
- Optional permissions based on campaign roles
- Graceful handling of orphaned branches
- Optimistic UI updates with error rollback
- Keyboard shortcuts for common operations

All edge cases tested and documented.

Part of TICKET-027 Stage 10.
```

**Status**: Not Started

---

## Notes

### Architecture Decisions

1. **Branch Schema**: Already exists in database, no migrations needed
2. **Version Resolution**: Leverages existing algorithm from TICKET-007
3. **Fork Strategy**: Full version copy at divergence point (not lazy copy)
4. **UI Library**: React Flow for hierarchy visualization
5. **Diff Library**: react-diff-viewer for comparison view

### Dependencies

- TICKET-007 (Versioning System) - Complete ✅
- TICKET-009 (Party & Kingdom Management) - Complete ✅
- Settlement and Structure entities - Complete ✅

### Testing Strategy

- **Unit Tests**: Service methods, utilities, components
- **Integration Tests**: Version resolution, fork operation
- **E2E Tests**: Complete workflows from UI to database
- **Performance Tests**: Large datasets, deep hierarchies

### Potential Issues

1. **Performance**: Forking with many entities could be slow
   - Mitigation: Background job for fork operation
   - Mitigation: Progress tracking and cancellation
2. **Storage**: Many branches could consume significant space
   - Mitigation: Already using gzip compression
   - Mitigation: Archive/delete old branches
3. **Complexity**: Deep branch hierarchies could confuse users
   - Mitigation: Clear visualization with hierarchy view
   - Mitigation: Breadcrumbs showing ancestry path

### Future Enhancements (Out of Scope)

- Branch merging (TICKET-028)
- Conflict resolution between branches (TICKET-028)
- Branch permissions and access control
- Branch templates/presets
- Automatic branch creation on major events
- Branch analytics (divergence metrics, activity tracking)
