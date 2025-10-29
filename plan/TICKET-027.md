# TICKET-027: Branching System (Fork & View)

## Status

- [ ] Completed
- **Commits**:
  - Planning: 5fda299 (Implementation plan created)

## Implementation Notes

- **2025-10-29**: Created comprehensive 10-stage implementation plan in `TICKET-027-implementation-plan.md`
  - Stages 1-4: Backend (Branch service, fork operation, GraphQL API, version resolution)
  - Stages 5-8: Frontend (Branch selector, fork UI, hierarchy visualization, comparison view)
  - Stages 9-10: Integration testing, documentation, and production polish
  - Leverages existing versioning system from TICKET-007
  - Database schema already in place (Branch model exists), no migrations needed

- **2025-10-29**: ✅ Completed Stage 1 (Branch Service & Basic CRUD Operations) - Commit: aaf526e
  - Created BranchService with full CRUD operations (create, findById, findByCampaign, update, delete, find)
  - Implemented hierarchy methods: getHierarchy() for tree structure, getAncestry() for parent chain walking
  - Added comprehensive validation: campaign access checks, parent validation, delete protection for branches with children
  - Extracted checkCampaignAccess() helper method for reusable authorization logic
  - Created Branch input DTOs (CreateBranchInput, UpdateBranchInput, BranchWhereInput)
  - Added getBranchById() method to VersionService for branch resolution
  - Wrote 27 comprehensive unit tests covering all operations, hierarchy, validation, and edge cases
  - All tests passing, code reviewed and security-hardened (added access check to create() per reviewer feedback)

- **2025-10-29**: ✅ Completed Stage 2 (Fork Operation & Version Copying) - Commit: 83f7754
  - Implemented BranchService.fork() method to create alternate timeline branches
  - Creates child branch with parentId and divergedAt timestamp
  - Copies all entity versions at fork point for 10 entity types (Campaign, World, Location, Character, Party, Kingdom, Settlement, Structure, Encounter, Event)
  - Implemented copyVersionsForEntityType() helper with branch ancestry filtering
  - Uses branch ancestry chain to ensure only relevant versions are copied (prevents copying from unrelated branches)
  - Batch resolves versions using Promise.all to avoid N+1 query pattern for performance
  - Reuses compressed payloads directly without cloning for memory efficiency
  - Transaction-wrapped for atomic operation (rollback on any failure)
  - Returns ForkResult interface with new branch and count of versions copied
  - Added 'FORK' to AuditOperation type for audit logging
  - Wrote 12 comprehensive unit tests for fork operation (39 total BranchService tests)
  - All tests passing, code reviewed twice and approved (fixed critical branch filtering and N+1 query issues)

- **2025-10-29**: ✅ Completed Stage 3 (GraphQL API for Branches) - Commit: 754b3d0
  - Created BranchResolver with comprehensive GraphQL API for branch operations
  - Implemented 3 queries: branch (by ID), branches (flat list), branchHierarchy (tree structure)
  - Implemented 4 mutations: createBranch, updateBranch, deleteBranch, forkBranch
  - Created GraphQL types: Branch, BranchNode (recursive tree), ForkResult, ForkBranchInput
  - Authorization: queries check campaign access at resolver level, mutations delegate to service layer
  - No N+1 queries - single database call per operation (removed pre-flight checks)
  - Throws ForbiddenException for unauthorized access attempts
  - Wrote 19 comprehensive E2E integration tests covering all operations, edge cases, and authorization
  - All tests passing (4.8s execution), TypeScript compilation clean, no lint errors
  - Code reviewed and approved after addressing critical issues (N+1 queries, authorization pattern, test coverage)

- **2025-10-29**: ✅ Completed Stage 4 (Version Resolution for Settlement & Structure) - Commit: ac87286
  - Added settlementAsOf GraphQL query (id, branchId, asOf parameters) to SettlementResolver
  - Added structureAsOf GraphQL query (id, branchId, asOf parameters) to StructureResolver
  - Both queries delegate to existing getXxxAsOf() service methods (already implemented in services)
  - Service methods use versionService.resolveVersion() with branch ancestry walking
  - Returns entity state as it existed at specific world time in specific branch
  - Created comprehensive integration test file: settlement-structure-branch-versioning.integration.test.ts
  - 16 tests covering: version resolution from main branch, child branch inheritance, parent isolation, 3-level hierarchy, authorization
  - All tests passing, TypeScript compilation clean, no lint errors
  - Code reviewed and approved with zero issues - exemplary implementation following all patterns

- **2025-10-29**: ✅ Completed Stage 5 (Frontend - Branch Selector Component) - Commit: ad01e75
  - Created comprehensive GraphQL hooks in services/api/hooks/branches.ts
    - useGetBranches, useGetBranchHierarchy, useGetBranch for queries
    - useCreateBranch, useUpdateBranch, useDeleteBranch, useForkBranch for mutations
    - Extensive JSDoc documentation with examples for all hooks
    - useGetBranchHierarchy includes flatBranches memoized helper for easy iteration
  - Implemented BranchSelector component with Sheet/drawer UI pattern
    - Hierarchical branch display with indentation based on depth (12px + depth \* 24px)
    - Shows branch metadata: divergedAt timestamp, description, creation date
    - Loading, error, and empty states handled gracefully
    - Mobile-friendly using Sheet component instead of traditional dropdown
    - Proper accessibility with aria-current for selection indication
  - Added per-campaign branch persistence to Zustand campaign store
    - Introduced campaignBranchMap: Record<string, string> for per-campaign persistence
    - Updated setCurrentBranch to persist selection to campaignBranchMap
    - Updated setCurrentCampaign to restore branch from campaignBranchMap
    - Prevents cross-campaign state leakage with isolated branch selections
    - campaignBranchMap persisted to localStorage via store middleware
  - Integrated BranchSelector in MainLayout header
    - Shown conditionally when campaign is selected
    - Positioned between nav links and auth buttons
    - Clean conditional rendering with campaign context check
  - Created comprehensive test suite with 12 test scenarios
    - Visibility tests (shown/hidden based on campaign context)
    - Trigger button tests (displays current branch name)
    - Branch list tests (displays all branches with hierarchy, metadata, selection state)
    - Selection tests (calls setCurrentBranch, closes sheet after selection)
    - Loading/error/empty states
    - Query skip logic (skips when no campaign)
    - Fixed aria-current assertions (was incorrectly using aria-selected)
    - Fixed hook call expectations to match actual signature
  - TypeScript compilation clean, no lint errors
  - Code reviewed and approved with minor test fixes applied

## Description

Implement branching system that allows creating alternate timeline branches and viewing campaign state in different branches.

## Scope of Work

1. Create Branch CRUD operations
2. Implement fork operation (create child branch)
3. Add branch switching in UI
4. Implement version resolution for branches
5. Create branch comparison view
6. Add branch metadata (name, description, fork point)
7. Implement branch hierarchy visualization
8. Version resolution for Settlement entities
9. Version resolution for Structure entities
10. Fork operation copies Settlement hierarchy and Structure relationships

## Acceptance Criteria

- [ ] Can create branch from current state
- [ ] Branch inherits parent versions
- [ ] Can switch between branches in UI
- [ ] Branch changes don't affect parent
- [ ] Can view branch comparison
- [ ] Branch hierarchy is clear
- [ ] Settlement versions resolve correctly across branches
- [ ] Structure versions resolve correctly across branches
- [ ] Forking preserves Settlement-Structure hierarchy

## Dependencies

- Requires: TICKET-007

## Estimated Effort

4-5 days
