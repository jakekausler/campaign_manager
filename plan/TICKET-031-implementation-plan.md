# TICKET-031 Implementation Plan: Version History & Diff Viewer

## Overview

Build comprehensive UI components for viewing version history with visual diffs and restore functionality, leveraging the existing versioning infrastructure from TICKET-007 and Entity Inspector from TICKET-023.

---

## Stage 1: Backend GraphQL API Enhancement ✅ COMPLETE

**Goal**: Extend GraphQL API to support version comparison and restore operations

**Status**: ✅ All requirements already implemented in TICKET-007

**Tasks**:

- [x] Review existing version-related GraphQL queries/mutations from TICKET-007
- [x] Create `compareVersions` query to compute diffs between two versions _(exists as `versionDiff`)_
- [x] Create `restoreVersion` mutation to revert entity to previous version _(already implemented)_
- [x] Add authorization checks (campaign membership required) _(implemented in VersionService)_
- [x] Implement payload decompression in resolvers _(handled in all resolvers)_
- [x] Add version validation (ensure target version exists and belongs to entity) _(implemented)_
- [x] Create tests for new resolvers _(comprehensive tests exist)_

**Success Criteria**: ✅ ALL MET

- ✅ `versionDiff(versionId1: String!, versionId2: String!)` returns structured diff
- ✅ `restoreVersion(input: RestoreVersionInput!)` creates new version with old payload
- ✅ Authorization prevents cross-campaign version access
- ✅ Compressed payloads properly decompressed before comparison
- ✅ All tests passing (resolver and service tests comprehensive)

**Tests**: ✅ ALL IMPLEMENTED

- ✅ Authorization test: User cannot compare/restore versions from different campaign
- ✅ Comparison test: Diff accurately shows added/modified/removed fields
- ✅ Restore test: Creates new version (doesn't modify history)
- ✅ Decompression test: Properly handles gzip-compressed payloads

**Implementation Notes**:

The backend infrastructure from TICKET-007 already provides all required functionality:

1. **GraphQL Schema** (`packages/api/src/graphql/types/version.type.ts`):
   - `Version` type with decompressed payload
   - `VersionDiff` type with added/modified/removed fields
   - `RestoreVersionInput` with versionId, branchId, worldTime, comment

2. **GraphQL Resolvers** (`packages/api/src/graphql/resolvers/version.resolver.ts`):
   - `entityVersions` query: Returns version history with auto-decompression
   - `versionDiff` query: Computes diff between two versions
   - `restoreVersion` mutation: Creates new version from historical payload
   - All resolvers use `@UseGuards(JwtAuthGuard)` for authentication

3. **Service Layer** (`packages/api/src/graphql/services/version.service.ts`):
   - `findVersionHistory()`: Fetches versions with campaign membership authorization
   - `getVersionDiff()`: Decompresses payloads and calculates structured diff
   - `restoreVersion()`: Creates immutable new version (preserves history)
   - All methods validate branch exists and user has campaign access

4. **Tests**:
   - Resolver tests: 15+ test cases covering happy paths and edge cases
   - Service tests: 20+ test cases covering authorization, diff calculation, restore
   - Integration tests exist for settlement/structure versioning

**No additional backend work required for TICKET-031 Stage 1.**

---

## Stage 2: Frontend GraphQL Hooks ✅ COMPLETE

**Goal**: Create React hooks for version operations

**Status**: ✅ All requirements implemented and tested

**Tasks**:

- [x] Create `useEntityVersions` hook for fetching version list
- [x] Create `useCompareVersions` hook (lazy query) for diff computation
- [x] Create `useRestoreVersion` hook (mutation) for restore operations
- [x] Add proper TypeScript types for Version, VersionDiff, RestoreResult
- [x] Implement cache-first policy for version list
- [x] Implement network-only policy for comparisons
- [x] Add mutation cache updates after restore (refetchQueries)
- [x] Create comprehensive tests using MSW

**Success Criteria**: ✅ ALL MET

- ✅ Hooks follow project patterns (similar to conditions/effects hooks)
- ✅ Proper loading/error states handled
- ✅ TypeScript types match GraphQL schema
- ✅ Cache policies optimize for performance
- ✅ All tests passing (19/19 tests pass)

**Tests**: ✅ ALL PASSING (19 tests)

- ✅ Version list fetching with entity filtering
- ✅ Version comparison with two version IDs
- ✅ Restore operation with cache invalidation
- ✅ Error handling for invalid version IDs
- ✅ Loading states for async operations
- ✅ Skip option functionality
- ✅ Refetch capability
- ✅ Lazy query behavior (doesn't execute immediately)
- ✅ Network status tracking
- ✅ Optional parameters (worldTime, comment)

**Implementation Notes**:

- **Files Created**:
  - `packages/frontend/src/services/api/hooks/versions.ts` (380 lines)
  - `packages/frontend/src/services/api/hooks/versions.test.tsx` (623 lines)

- **Hook Implementations**:
  1. `useEntityVersions`: Query hook with cache-first policy, returns simplified data shape with useMemo optimization
  2. `useCompareVersions`: Lazy query hook with network-only policy for fresh diff calculations
  3. `useRestoreVersion`: Mutation hook with automatic cache refetch via refetchQueries

- **Design Decisions**:
  - Cache strategy: versions cache-first (relatively static), diffs network-only (computed fresh)
  - Type safety: Complete TypeScript typing with placeholder types following existing patterns
  - Developer experience: Simplified return shapes, comprehensive JSDoc with examples, exported types
  - Testing: 19 comprehensive tests covering all hooks, error states, loading states, lazy behavior, cache invalidation

- **Code Review**: Approved by code-reviewer subagent with no critical issues, follows all project conventions

**Commit**: b1f4384

---

## Stage 3: Version List Component

**Goal**: Display chronological list of entity versions

**Tasks**:

- [ ] Create `VersionList` component accepting entityType and entityId props
- [ ] Display versions in reverse chronological order (newest first)
- [ ] Show metadata: timestamp, user, change comment (if available)
- [ ] Add "CURRENT" badge for most recent version
- [ ] Implement version selection (for comparison and restore)
- [ ] Add loading skeleton for version fetching
- [ ] Add error state with retry button
- [ ] Add empty state when no versions exist
- [ ] Create comprehensive tests

**Success Criteria**:

- Versions display with formatted timestamps (relative for recent, absolute for old)
- User can select single version (for restore) or two versions (for comparison)
- Current version clearly marked
- Responsive design works on mobile and desktop
- All tests passing

**Tests**:

- Version list rendering with multiple versions
- Current version badge display
- Single version selection for restore
- Two version selection for comparison
- Empty state when entity has no versions
- Error state with retry button

---

## Stage 4: Diff Viewer Component - Basic Structure

**Goal**: Create side-by-side diff viewer for version comparison

**Tasks**:

- [ ] Create `DiffViewer` component accepting two version payloads
- [ ] Implement side-by-side layout (two columns with divider)
- [ ] Display field names with added/modified/removed indicators
- [ ] Use color coding: green for added, blue for modified, red for removed
- [ ] Add field-level navigation (jump to next/previous change)
- [ ] Implement collapsible sections for unchanged fields
- [ ] Add "expand all" / "collapse all" controls
- [ ] Create responsive mobile layout (stacked instead of side-by-side)
- [ ] Create comprehensive tests

**Success Criteria**:

- Clear visual distinction between added/modified/removed fields
- Side-by-side comparison on desktop (≥768px)
- Stacked comparison on mobile (<768px)
- Unchanged fields collapsed by default
- All tests passing

**Tests**:

- Diff rendering with added/modified/removed fields
- Color coding for different change types
- Field navigation (next/previous change)
- Expand/collapse functionality
- Mobile responsive layout

---

## Stage 5: Diff Viewer - Settlement & Structure Payloads

**Goal**: Handle entity-specific payload structures in diff viewer

**Tasks**:

- [ ] Add Settlement payload handler (level, variables, structures array)
- [ ] Add Structure payload handler (type, level, variables)
- [ ] Implement nested diff for variables object (typed variables)
- [ ] Implement nested diff for structures array (Settlement only)
- [ ] Add type-specific field formatting (e.g., level → "Level 3", boolean → "Yes/No")
- [ ] Add field labels with snake_case to Title Case conversion
- [ ] Handle null/undefined values gracefully ("N/A" display)
- [ ] Create comprehensive tests for both entity types

**Success Criteria**:

- Settlement diffs show level, variables, and structures changes
- Structure diffs show type, level, and variables changes
- Nested variable changes displayed with indentation
- Field names formatted for readability
- All tests passing

**Tests**:

- Settlement diff with level change
- Settlement diff with variable change (nested)
- Settlement diff with structures array change
- Structure diff with type change
- Structure diff with variable change (nested)
- Null/undefined value handling

---

## Stage 6: Syntax Highlighting for JSON Diffs

**Goal**: Add syntax highlighting to improve readability

**Tasks**:

- [ ] Research lightweight JSON syntax highlighting libraries (react-json-view, react-syntax-highlighter)
- [ ] Choose library balancing bundle size and features
- [ ] Integrate syntax highlighter into DiffViewer
- [ ] Apply syntax highlighting to JSONLogic expressions (conditions)
- [ ] Apply syntax highlighting to JSON Patch operations (effects)
- [ ] Ensure accessibility (color contrast, screen reader support)
- [ ] Add dark mode support (follow project theme)
- [ ] Create comprehensive tests

**Success Criteria**:

- JSON values syntax highlighted (strings, numbers, booleans, null)
- Syntax highlighting respects project theme (light/dark mode)
- Accessibility standards met (WCAG 2.1 Level AA)
- Bundle size increase minimal (<50KB gzipped)
- All tests passing

**Tests**:

- Syntax highlighting for different JSON types
- Dark mode color scheme verification
- Accessibility contrast ratio tests
- Bundle size regression test

---

## Stage 7: Version Restore Functionality

**Goal**: Implement restore/revert to previous version

**Tasks**:

- [ ] Add "Restore" button to selected version in VersionList
- [ ] Create confirmation dialog before restore operation
- [ ] Show diff preview in confirmation dialog
- [ ] Implement restore mutation with optimistic update
- [ ] Add success/error toast notifications
- [ ] Invalidate relevant caches after restore (entity data, version list)
- [ ] Add loading state during restore operation
- [ ] Handle errors gracefully (display message, keep dialog open)
- [ ] Create comprehensive tests

**Success Criteria**:

- User can restore any previous version with confirmation
- Diff preview shows what will change
- Optimistic UI updates immediately
- Success/error feedback clear and actionable
- All tests passing

**Tests**:

- Restore button click opens confirmation dialog
- Confirmation dialog shows diff preview
- Successful restore creates new version
- Failed restore shows error message
- Cache invalidation after restore

---

## Stage 8: Version Comparison (Any Two Versions)

**Goal**: Allow comparison of any two versions, not just adjacent ones

**Tasks**:

- [ ] Add "Compare" mode toggle in VersionList component
- [ ] Implement multi-select UI for version selection (checkboxes)
- [ ] Disable selection when two versions already selected
- [ ] Add "Compare Selected" button that triggers diff viewer
- [ ] Display selected versions in comparison UI (labels A and B)
- [ ] Add "Clear Selection" button to reset
- [ ] Update DiffViewer to accept version IDs instead of payloads
- [ ] Fetch and decompress versions in DiffViewer
- [ ] Create comprehensive tests

**Success Criteria**:

- User can select any two versions for comparison
- UI prevents selecting more than two versions
- Comparison shows clear labels (Version A vs Version B)
- Can clear selection and start over
- All tests passing

**Tests**:

- Version selection (first and second)
- Selection limit (cannot select third version)
- Compare button triggers diff viewer
- Clear selection resets state
- Diff viewer shows correct version labels

---

## Stage 9: Version Filtering and Search

**Goal**: Add filtering and search to version history

**Tasks**:

- [ ] Add search input to filter by change comment
- [ ] Add date range picker for temporal filtering
- [ ] Add user filter dropdown (show versions by specific user)
- [ ] Implement client-side filtering (versions already fetched)
- [ ] Add "Clear Filters" button
- [ ] Show filter count indicator (e.g., "Showing 5 of 20 versions")
- [ ] Preserve filter state during component lifecycle
- [ ] Add "No results" state when filters match nothing
- [ ] Create comprehensive tests

**Success Criteria**:

- Can filter by comment text (case-insensitive)
- Can filter by date range
- Can filter by user ID
- Filters combine with AND logic
- Clear filters button resets all filters
- All tests passing

**Tests**:

- Comment search filtering
- Date range filtering
- User filtering
- Combined filters (comment + date + user)
- Clear filters button
- No results state

---

## Stage 10: Integration with Entity Inspector

**Goal**: Integrate version history UI into existing Entity Inspector

**Tasks**:

- [ ] Update EntityInspector Versions tab (TICKET-023) to use new components
- [ ] Replace existing audit history with version history + diff viewer
- [ ] Add tab-specific state management (selected versions, comparison mode)
- [ ] Ensure proper data fetching (skip when tab not active)
- [ ] Add keyboard shortcuts (Ctrl+R to restore, Ctrl+D to diff)
- [ ] Update EntityInspector documentation
- [ ] Update TICKET-023 documentation with new version features
- [ ] Create comprehensive tests

**Success Criteria**:

- Versions tab shows full version history with diff viewer
- All version operations accessible from Entity Inspector
- Keyboard shortcuts work correctly
- Documentation updated
- All tests passing

**Tests**:

- Versions tab renders VersionList component
- Version selection triggers DiffViewer
- Restore operation works from Versions tab
- Keyboard shortcuts (Ctrl+R, Ctrl+D)
- Tab switching preserves state

---

## Completion Checklist

### Code Quality

- [ ] TypeScript compilation: 0 errors
- [ ] ESLint: 0 errors (ignoring pre-existing warnings)
- [ ] All tests passing (target >95% pass rate)
- [ ] Code review approved by subagent

### Documentation

- [ ] Feature documentation created in `docs/features/version-history.md`
- [ ] Developer README created for version history components
- [ ] TICKET-031.md updated with implementation notes
- [ ] CLAUDE.md updated if new patterns introduced

### Testing

- [ ] Unit tests for all new components
- [ ] Integration tests for GraphQL operations
- [ ] E2E tests for restore workflow
- [ ] Accessibility tests (keyboard navigation, screen readers)
- [ ] Responsive design tests (mobile and desktop)

### Deployment

- [ ] Pre-commit hooks pass
- [ ] Final code review by code-reviewer subagent
- [ ] Project manager verification by project-manager subagent
- [ ] All commits reference TICKET-031
- [ ] EPIC.md updated with ticket completion

---

## Technical Notes

### Version Payload Structure (from TICKET-007)

```typescript
interface Version {
  id: string;
  entityType: string;
  entityId: string;
  branchId: string;
  validFrom: Date;
  validTo: Date | null;
  payloadGz: Buffer; // Compressed with gzip
  createdAt: Date;
  createdBy: string;
  comment?: string;
  version: number; // For optimistic locking
}
```

### Diff Structure

```typescript
interface VersionDiff {
  added: Record<string, unknown>;
  modified: Record<string, { old: unknown; new: unknown }>;
  removed: Record<string, unknown>;
}
```

### Settlement Payload Example

```json
{
  "name": "Ironhold",
  "level": 3,
  "kingdomId": "kingdom-1",
  "locationId": "location-1",
  "campaignId": "campaign-1",
  "ownerId": "user-1",
  "isArchived": false,
  "variables": {
    "prosperity": 75,
    "morale": 80,
    "has_walls": true,
    "population": 5000
  },
  "structures": ["structure-1", "structure-2"]
}
```

### Structure Payload Example

```json
{
  "name": "Main Barracks",
  "type": "Military",
  "settlementId": "settlement-1",
  "level": 2,
  "positionX": 100,
  "positionY": 200,
  "orientation": 90,
  "variables": {
    "garrison_size": 50,
    "is_upgraded": false,
    "training_speed": 1.5
  }
}
```

---

## Architecture Decisions

1. **Immutable Version History**: Restore creates new version instead of modifying existing ones
2. **Client-Side Filtering**: Version list small enough (<100 versions) for client-side filtering
3. **Side-by-Side Diff**: Desktop uses two-column layout, mobile uses stacked layout
4. **Syntax Highlighting**: Improves readability for JSON-heavy payloads
5. **Confirmation Dialogs**: Prevent accidental restores with diff preview
6. **Lazy Loading**: Diff viewer only fetches versions when comparison requested
7. **Cache-First Policy**: Version list cached, comparisons always fresh
8. **Optimistic Updates**: Restore mutation updates UI before server confirmation

---

## Dependencies

- TICKET-007: Versioning System Implementation (✅ Complete)
- TICKET-023: Entity Inspector Component (✅ Complete)
- Libraries:
  - `react-json-view` or `react-syntax-highlighter` (Stage 6)
  - `date-fns` (already installed, for date formatting)
  - `zlib` (Node.js built-in, for decompression)

---

## Estimated Effort Per Stage

- Stage 1: Backend API (1 day)
- Stage 2: Frontend Hooks (0.5 day)
- Stage 3: Version List (0.5 day)
- Stage 4: Diff Viewer Structure (1 day)
- Stage 5: Entity-Specific Payloads (0.5 day)
- Stage 6: Syntax Highlighting (0.5 day)
- Stage 7: Restore Functionality (0.5 day)
- Stage 8: Version Comparison (0.5 day)
- Stage 9: Filtering & Search (0.5 day)
- Stage 10: Entity Inspector Integration (0.5 day)

**Total**: 6 days (within 3-4 day estimate range considering parallel work)

---

## Risk Mitigation

1. **Bundle Size**: Monitor bundle size during Stage 6 (syntax highlighting), consider code splitting if >50KB
2. **Performance**: If version list grows large (>100 versions), implement server-side pagination in Stage 9
3. **Decompression**: Test decompression performance with large payloads, consider worker thread if slow
4. **Diff Algorithm**: Complex nested diffs may be slow, optimize if comparison takes >200ms

---

## Future Enhancements (Out of Scope)

- Three-way merge diff (common ancestor comparison)
- Batch restore (multiple entities at once)
- Version comments editing (after creation)
- Export version history to CSV/JSON
- Version annotations (mark important versions)
- Diff visualization graph (timeline with branches)
