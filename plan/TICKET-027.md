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

- **2025-10-29**: ✅ Completed Stage 6 (Frontend - Fork Branch UI) - Commit: 52a20e3
  - Created ForkBranchDialog component for creating alternate timeline branches
    - Modal dialog with name (required) and description (optional) inputs
    - Displays source branch name and metadata from current branch
    - Shows divergence point with current world time from campaign store
    - Executes forkBranch GraphQL mutation with loading/progress indicators
    - Shows success message with count of versions copied (singular/plural)
    - Automatically switches to new branch after successful fork
    - Refetches branch hierarchy to display new branch immediately in BranchSelector
  - Comprehensive error handling and validation
    - Validation: name required, source branch existence check, world time availability
    - GraphQL mutation error display with clear error messages
    - Form validation prevents submission with empty name (disabled state)
    - Whitespace trimming on both name and description inputs
    - Empty description treated as null (optional field)
  - User experience enhancements
    - Keyboard shortcuts: Enter to submit (when valid), Escape to cancel
    - Loading state disables inputs and shows progress message
    - Success state shows Close button instead of Create/Cancel buttons
    - Form reset when dialog opens/closes for clean state
    - Cannot close dialog during loading operation (prevents accidental cancellation)
  - Integration with BranchSelector component
    - Added "Fork" button to Sheet header with GitFork icon
    - Button disabled when no branch selected (proper validation)
    - Opens ForkBranchDialog with current branch as source
    - Closes both dialogs after successful fork operation
  - Created comprehensive test suite with 34 test scenarios
    - Dialog visibility and content rendering tests
    - Form interaction and controlled input behavior
    - Form submission with correct GraphQL variables (trimming, null handling)
    - Validation error scenarios (empty name, null branch, missing world time)
    - Loading state display and input/button disable logic
    - Error state display for GraphQL mutation failures
    - Success state with version count and automatic branch switching
    - Dialog close behavior (Cancel button, Escape key, prevented during loading)
    - Form reset behavior when dialog closes
    - Keyboard shortcuts (Enter/Escape key handling)
  - TypeScript compilation clean, no lint errors (fixed 4 ESLint errors)
  - Code reviewed and approved with no critical issues (optional optimizations noted)

- **2025-10-29**: ✅ Completed Stage 7 (Frontend - Branch Hierarchy Visualization) - Commit: dd80ade
  - Created BranchHierarchyView component using React Flow for tree visualization
  - Hierarchical layout with dagre for automatic node positioning
  - Custom branch nodes displaying metadata (name, description, diverged/created dates)
  - Current branch highlighted with primary border and "Current" badge
  - Click branches to switch campaign context
  - Search/filter functionality (case-insensitive, name and description)
  - Interactive controls: pan, zoom, minimap, background grid
  - Hover actions (fork, rename, delete) - disabled until Stage 10
  - Added accessibility improvements: ARIA labels, proper input labeling, screen reader support
  - Created BranchesPage and added /branches route with lazy loading
  - Comprehensive test suite with 22 test scenarios
  - Fixed dagre import to use namespace import (import \* as dagre)
  - TypeScript compilation clean, no lint errors
  - Code reviewed and approved after addressing priority fixes (disabled buttons, accessibility)

- **2025-10-29**: ✅ Completed Stage 8 (Frontend - Branch Comparison View) - Commit: 65fb8e8
  - Created BranchComparisonView component with side-by-side diff visualization
  - Uses react-diff-viewer-continued library for visual diff display with syntax highlighting
  - Compares settlement and structure entities between any two branches at specific world time
  - Smart defaults: auto-populates parent vs current branch comparison with current world time
  - Form inputs: source/target branch selectors, entity type dropdown, entity ID input, world time (ISO 8601)
  - Proper state management: useEffect for side effects, useMemo for computed values
  - Conditional GraphQL queries with skip flags for performance optimization
  - Created GraphQL hooks: useGetSettlementAsOf, useGetStructureAsOf (leveraging Stage 4 backend resolvers)
  - Added Select UI component (shadcn/ui pattern with Radix UI primitives)
  - Integrated into BranchesPage with scrollable layout below hierarchy view
  - Comprehensive error handling: loading states, error alerts, empty state warnings, validation
  - Help text explaining usage and providing guidance on finding entity IDs
  - 24 comprehensive test scenarios covering all functionality (rendering, interaction, comparison, errors, clear)
  - Fixed critical React bug: changed useMemo to useEffect for side effects (branch defaults)
  - Type-safe entity type validation (no unchecked type assertions)
  - TypeScript strict mode compliant, ESLint passing with zero frontend errors
  - Code reviewed and approved after fixing critical issues (useMemo→useEffect, type validation)
  - Dependencies added: react-diff-viewer-continued@3.4.0, @radix-ui/react-select@1.2.3
  - Note: Commit blocked by unrelated pre-existing lint errors in rules-engine package (jest-mock-extended imports)
  - All frontend code ready for commit once rules-engine lint issues are resolved

- **2025-10-29**: ✅ Completed Stage 9 (Integration Testing & Documentation) - Commit: f5875be
  - Created comprehensive E2E test suite (1,099 lines) in `branching-system.e2e.test.ts`
  - Tests complete fork workflow: campaign → branch → fork → verify versions
  - Tests version resolution across 4+ levels of branch hierarchy (main → branch1 → branch2 → branch3)
  - Tests Settlement-Structure hierarchy preservation in forks
  - Tests concurrent edits in different branches without conflicts
  - Tests branch ancestry inheritance and isolation
  - Tests parallel branch hierarchies with proper sibling isolation
  - 6 major test describe blocks with comprehensive coverage
  - Created detailed documentation (689 lines) in `docs/features/branching-system.md`
  - Documentation covers architecture, backend/frontend implementation, usage examples, performance, testing, troubleshooting
  - Updated README.md with expanded branching feature description and link to documentation
  - Updated CLAUDE.md to add branching system to feature documentation list
  - Code reviewed and approved with zero critical issues
  - Fixed ESLint errors: removed unused imports (PrismaBranch, PrismaSettlement, PrismaStructure, Version)
  - Fixed import order: moved RulesEngineClientService import after graphql imports
  - Fixed unused variables: removed settlementService and structureService declarations
  - All pre-commit hooks passed: formatting, linting (warnings only), no errors

- **2025-10-29**: ✅ Started Stage 10 (Polish & Edge Cases) - Commit: ce06668
  - **Task 1/8 Complete: Branch Deletion Safeguards**
  - Created DeleteBranchDialog component with 3-tier protection system:
    1. Root branch protection: Shows "Cannot Delete" with explanation
    2. Branches with children: Shows count, requires deleting children first
    3. Deletable branches: Shows confirmation with detailed impact warnings
  - Frontend implementation (packages/frontend/src/components/features/branches/):
    - DeleteBranchDialog.tsx: Reusable dialog with comprehensive safety checks
    - DeleteBranchDialog.test.tsx: 26 comprehensive tests covering all scenarios
    - BranchHierarchyView.tsx: Integrated delete button with full state management
    - Updated ForkBranchDialog.tsx with useCallback for consistency
  - Backend security (packages/api/src/graphql/services/):
    - Added root branch protection to BranchService.delete() method
    - Prevents deletion of branches without parents (parentId === null)
    - Added backend unit test for root branch protection (40 tests total, all passing)
    - Fixed existing test that incorrectly used root branch configuration
  - Defense in depth security model:
    - Frontend provides excellent UX with clear explanations
    - Backend enforces all business rules (never trust client)
    - Both layers validate: root branch check + children check + access control
  - User experience features:
    - Detailed warnings explain what will be permanently deleted
    - Warning when deleting currently active branch (auto-switches to parent)
    - Toast notifications for success/error feedback
    - Loading states during deletion operation
    - Refetches hierarchy after successful deletion
  - Code quality:
    - All tests passing (26 frontend + 40 backend)
    - Type-check clean (both frontend and API)
    - ESLint: 0 errors (only pre-existing warnings)
    - Code reviewed and approved after fixing critical security issue
  - Note: Code reviewer caught missing backend root branch validation (critical security issue)
    - Initially only had frontend protection (can be bypassed)
    - Added backend validation to enforce security properly
    - This demonstrates importance of code review and defense in depth

- **2025-10-29**: ✅ Completed Stage 10 Task 2 (Branch Rename Validation) - Commit: 64fde31
  - **Task 2/8 Complete: Branch Rename Validation**
  - Backend validation implementation (packages/api/src/graphql/services/):
    - BranchService.create(): Added duplicate name check before creating branches
    - BranchService.update(): Added duplicate name check with self-exclusion logic
    - Validates uniqueness within campaign scope (same name allowed in different campaigns)
    - Allows updating to same name (handles no-change scenario gracefully)
    - Clear error messages: "A branch named 'X' already exists in this campaign"
    - 3 new comprehensive unit tests covering all validation scenarios
    - TDD approach: wrote tests first (RED), implemented validation (GREEN)
    - All 43 BranchService tests passing
  - Frontend validation implementation (packages/frontend/src/components/features/branches/):
    - Created RenameBranchDialog.tsx: Full-featured rename dialog component
    - Real-time duplicate name detection using branch hierarchy data
    - Form validation: required name, duplicate checking, whitespace trimming
    - Handles null/empty descriptions correctly (sends null to backend)
    - Prevents submission when no changes made (button disabled)
    - Created Textarea UI component (packages/frontend/src/components/ui/textarea.tsx)
  - Integration with BranchHierarchyView:
    - Enabled rename button (was disabled in Stage 7)
    - Added onRename callback to node data and flow conversion
    - State management for rename dialog (branchToRename, renameDialogOpen)
    - handleRenameClick finds branch in hierarchy and opens dialog
    - handleRenameSuccess shows toast and refetches hierarchy
  - User experience features:
    - Keyboard shortcuts: Enter to submit, Escape to cancel
    - Loading states with progress indicators
    - Success feedback with toast notifications
    - Comprehensive error handling with clear validation messages
    - Form resets when dialog opens/closes for clean state
    - Prevents closing during loading operation
  - Defense in depth security:
    - Frontend provides immediate feedback before mutation
    - Backend enforces uniqueness constraint (never trust client)
    - Both layers validate with same error messages for consistency
  - Testing and quality:
    - Backend: 3 new tests (duplicate create, duplicate rename, allow same name)
    - Frontend: 25 comprehensive test scenarios covering all functionality
    - Type-check: 0 errors (both API and frontend)
    - ESLint: 0 errors (only pre-existing warnings in unrelated files)
    - Tests cover: rendering, form interaction, validation, mutations, loading/error/success states
  - Implementation notes:
    - Follows same patterns as DeleteBranchDialog and ForkBranchDialog for consistency
    - Uses TDD methodology: tests written first, then implementation
    - GraphQL refetchQueries ensures UI updates everywhere after rename
    - checkDuplicateName() uses memoized flatten helper for efficient checking

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
