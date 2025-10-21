# TICKET-025 Implementation Plan: Event & Encounter Resolution System

## Overview

This ticket implements a comprehensive system for inspecting, resolving, and managing events and encounters. It extends the existing EntityInspector component to support Event and Encounter entity types with specialized panels, integrates with TimelinePage for entity selection, creates resolution workflow UI, executes effects in proper order (PRE/ON_RESOLVE/POST), validates resolution preconditions, tracks resolution history, and provides rollback capability.

## Architecture

### Key Components

1. **EventPanel & EncounterPanel**: Specialized detail panels for Event and Encounter entities (similar to SettlementPanel/StructurePanel)
2. **EntityInspector Extension**: Support for Event and Encounter entity types with appropriate tabs
3. **Resolution Workflow UI**: Confirmation dialog with effect preview, validation checks, and execution feedback
4. **GraphQL Integration**: Hooks for `completeEvent` and `resolveEncounter` mutations with cache updates
5. **Timeline Integration**: Click handler to open inspector for Event/Encounter entities

### Data Flow

1. User clicks Event/Encounter on Timeline → Opens EntityInspector
2. User views entity details, effects, conditions, versions in tabs
3. User clicks "Resolve" button → Shows confirmation dialog with effect preview
4. User confirms → Executes mutation → Effects run in order (PRE → ON_RESOLVE → POST)
5. Success → Closes inspector, refreshes timeline, shows success notification
6. Failure → Shows error, allows retry

## Implementation Stages

### Stage 1: Create EventPanel and EncounterPanel Components ✅

**Status**: COMPLETE (Commit: 50c5d1e)

**Goal**: Build specialized detail panels for Event and Encounter entities following the pattern of SettlementPanel/StructurePanel.

**Tasks**:

- [x] Create `packages/frontend/src/components/features/entity-inspector/EventPanel.tsx`
  - Display event metadata: name, type, description, eventType
  - Display scheduling info: scheduledAt, occurredAt, isCompleted
  - Display variables as typed fields with formatting
  - Add copy-to-clipboard functionality for field values
  - Edit mode support (name field will be added in EntityInspector integration)
- [x] Create `packages/frontend/src/components/features/entity-inspector/EncounterPanel.tsx`
  - Display encounter metadata: name, type, description, difficulty
  - Display resolution info: scheduledAt, isResolved, resolvedAt
  - Display variables as typed fields with formatting
  - Add copy-to-clipboard functionality for field values
  - Edit mode support (name field will be added in EntityInspector integration)
- [x] Write unit tests for EventPanel (following SettlementPanel.test.tsx pattern)
- [x] Write unit tests for EncounterPanel (following StructurePanel.test.tsx pattern)
- [x] Export components from `packages/frontend/src/components/features/entity-inspector/index.ts`

**Files to create**:

- `packages/frontend/src/components/features/entity-inspector/EventPanel.tsx`
- `packages/frontend/src/components/features/entity-inspector/EventPanel.test.tsx`
- `packages/frontend/src/components/features/entity-inspector/EncounterPanel.tsx`
- `packages/frontend/src/components/features/entity-inspector/EncounterPanel.test.tsx`

**Testing**:

- EventPanel renders event metadata correctly
- EncounterPanel renders encounter metadata correctly
- Copy-to-clipboard works for field values
- Edit mode enables/disables correctly
- Typed variables display with proper formatting

**Success Criteria**:

- ✅ EventPanel displays all event fields with proper formatting
- ✅ EncounterPanel displays all encounter fields with proper formatting
- ✅ Tests pass with >95% coverage (31 EventPanel tests, 32 EncounterPanel tests)
- ✅ Components follow existing panel patterns

**Implementation Notes**:

- Added `formatTimestamp()` helper to convert ISO 8601 timestamps to locale-formatted dates
- Implemented invalid timestamp handling with `isNaN(date.getTime())` check
- Used nullish coalescing (`??`) for difficulty field to properly handle 0 as valid value
- Added `data-testid` attributes to field values for precise test queries
- Memory leak prevention via timeout cleanup in useEffect
- Three-section layout: Attributes, Scheduling/Resolution Information, Typed Variables
- Conditional rendering for optional fields (locationId only shows if present)
- Helper functions: copyToClipboard, formatValue, formatTimestamp, toTitleCase, renderField

**Code Review Findings**:

- Approved with optional improvements noted
- Suggestion: Extract shared helper functions to custom hook (future refactoring)
- Suggestion: Add semantic HTML sections with ARIA labels (future enhancement)
- Suggestion: Memoize variables check with useMemo (minor performance optimization)
- No critical issues found

---

### Stage 2: Create GraphQL Hooks for Event and Encounter Detail Queries

**Goal**: Create hooks to fetch individual Event and Encounter entities by ID, following the pattern of `useSettlementDetails` and `useStructureDetails`.

**Tasks**:

- [ ] Add `GET_EVENT_BY_ID` query to `packages/frontend/src/services/api/hooks/events.ts`
  - Include all fields: id, campaignId, locationId, name, description, eventType, scheduledAt, occurredAt, isCompleted, variables
  - Use cache-first fetch policy
- [ ] Add `useEventDetails(eventId: string)` hook to `packages/frontend/src/services/api/hooks/events.ts`
  - Return { event, loading, error, refetch }
  - Handle null/undefined cases
- [ ] Add `GET_ENCOUNTER_BY_ID` query to `packages/frontend/src/services/api/hooks/encounters.ts`
  - Include all fields: id, campaignId, locationId, name, description, difficulty, scheduledAt, isResolved, resolvedAt, variables
  - Use cache-first fetch policy
- [ ] Add `useEncounterDetails(encounterId: string)` hook to `packages/frontend/src/services/api/hooks/encounters.ts`
  - Return { encounter, loading, error, refetch }
  - Handle null/undefined cases
- [ ] Write integration tests for `useEventDetails` (following settlement/structure patterns)
- [ ] Write integration tests for `useEncounterDetails` (following settlement/structure patterns)
- [ ] Update MSW handlers to support detail queries

**Files to modify**:

- `packages/frontend/src/services/api/hooks/events.ts`
- `packages/frontend/src/services/api/hooks/events.test.tsx`
- `packages/frontend/src/services/api/hooks/encounters.ts`
- `packages/frontend/src/services/api/hooks/encounters.test.tsx`
- `packages/frontend/src/__tests__/mocks/handlers.ts`

**Testing**:

- useEventDetails fetches event by ID correctly
- useEncounterDetails fetches encounter by ID correctly
- Loading and error states handled properly
- Cache policies work as expected

**Success Criteria**:

- GraphQL queries return correct data structure
- Hooks integrate with Apollo Client cache
- Tests pass with >90% coverage
- MSW handlers provide realistic test data

---

### Stage 3: Extend EntityInspector to Support Event and Encounter Types

**Goal**: Modify EntityInspector component to recognize Event and Encounter entity types and render appropriate panels/tabs.

**Tasks**:

- [ ] Update `EntityType` enum in `packages/frontend/src/stores/selection-slice.ts` (if not already present)
  - Add EVENT and ENCOUNTER types
- [ ] Modify `EntityInspector.tsx` to handle Event and Encounter types
  - Add conditional data fetching for Event/Encounter (useEventDetails, useEncounterDetails)
  - Update type guards/switches to handle EVENT and ENCOUNTER
  - Pass event/encounter data to EventPanel/EncounterPanel in Details tab
  - Show appropriate tabs for Event/Encounter (Overview, Details, Links, Conditions, Effects, Versions)
- [ ] Update `OverviewTab.tsx` to display Event/Encounter basic info
  - Show name, type, description
  - Show scheduling/resolution info
  - Add copy-to-clipboard for entity IDs
- [ ] Update `LinksTab.tsx` to show related entities for Event/Encounter
  - Show associated location (if locationId present)
  - Show related settlements/structures at location
- [ ] Write integration tests for EntityInspector with Event/Encounter types
- [ ] Update EntityInspector type definitions

**Files to modify**:

- `packages/frontend/src/components/features/entity-inspector/EntityInspector.tsx`
- `packages/frontend/src/components/features/entity-inspector/EntityInspector.test.tsx`
- `packages/frontend/src/components/features/entity-inspector/OverviewTab.tsx`
- `packages/frontend/src/components/features/entity-inspector/LinksTab.tsx`
- `packages/frontend/src/stores/selection-slice.ts` (if needed)

**Testing**:

- EntityInspector opens for Event entities
- EntityInspector opens for Encounter entities
- Correct tabs shown for Event/Encounter (no Settlement/Structure-specific tabs)
- Event/Encounter data loads and displays correctly
- Navigation between Event/Encounter entities works

**Success Criteria**:

- EntityInspector renders Event entities correctly
- EntityInspector renders Encounter entities correctly
- All six tabs (Overview, Details, Links, Conditions, Effects, Versions) work for Event/Encounter
- Tests pass with >90% coverage

---

### Stage 4: Integrate EntityInspector with TimelinePage

**Goal**: Add click handlers to TimelinePage to open EntityInspector when Event or Encounter items are clicked.

**Tasks**:

- [ ] Modify `TimelinePage.tsx` to handle item click events
  - Add `onSelect` handler to Timeline component
  - Determine entity type (Event or Encounter) from timeline item
  - Call `selectEntity` from selection store with correct entity type
  - Open EntityInspector sheet
- [ ] Update `Timeline.tsx` component to support click handlers
  - Pass `onSelect` prop to vis-timeline
  - Extract entity ID and type from clicked item
- [ ] Remove "coming soon" alert from TimelinePage (no longer needed)
- [ ] Test click-to-open workflow for both Event and Encounter items
- [ ] Ensure EntityInspector closes properly when clicking outside or pressing Escape

**Files to modify**:

- `packages/frontend/src/pages/TimelinePage.tsx`
- `packages/frontend/src/components/features/timeline/Timeline.tsx`
- `packages/frontend/src/pages/TimelinePage.test.tsx`

**Testing**:

- Clicking Event item on timeline opens EntityInspector
- Clicking Encounter item on timeline opens EntityInspector
- EntityInspector shows correct data for clicked entity
- Escape key closes inspector
- "Coming soon" alert is removed

**Success Criteria**:

- Timeline click integration works seamlessly
- EntityInspector opens with correct entity data
- User can navigate between Event/Encounter entities from timeline
- Tests pass with >90% coverage

---

### Stage 5: Create Resolution Workflow UI Components

**Goal**: Build UI components for the resolution workflow, including a confirmation dialog that shows effect preview, validation checks, and execution status.

**Tasks**:

- [ ] Create `ResolutionDialog.tsx` component in `packages/frontend/src/components/features/entity-inspector/`
  - Accept entity (Event or Encounter), effects list, onConfirm, onCancel props
  - Display entity name and type
  - Show list of effects grouped by timing phase (PRE, ON_RESOLVE, POST)
  - Display effect descriptions and target paths
  - Show validation warnings (if any)
  - Show loading spinner during execution
  - Show success/error messages
  - Handle keyboard shortcuts (Enter to confirm, Escape to cancel)
- [ ] Create `ResolutionButton.tsx` component
  - Display "Complete Event" or "Resolve Encounter" button
  - Disable if already completed/resolved
  - Show loading state during mutation
  - Open ResolutionDialog on click
- [ ] Add resolution UI to EntityInspector
  - Show ResolutionButton in Overview tab header
  - Render ResolutionDialog when triggered
- [ ] Write unit tests for ResolutionDialog
- [ ] Write unit tests for ResolutionButton

**Files to create**:

- `packages/frontend/src/components/features/entity-inspector/ResolutionDialog.tsx`
- `packages/frontend/src/components/features/entity-inspector/ResolutionDialog.test.tsx`
- `packages/frontend/src/components/features/entity-inspector/ResolutionButton.tsx`
- `packages/frontend/src/components/features/entity-inspector/ResolutionButton.test.tsx`

**Files to modify**:

- `packages/frontend/src/components/features/entity-inspector/EntityInspector.tsx`
- `packages/frontend/src/components/features/entity-inspector/index.ts`

**Testing**:

- ResolutionDialog displays effect preview correctly
- ResolutionButton disabled for already resolved entities
- Confirmation flow works (open dialog → preview → confirm → execute)
- Cancellation flow works (open dialog → cancel → close)
- Loading and error states render correctly

**Success Criteria**:

- Resolution dialog shows clear effect preview
- User can confirm or cancel resolution
- UI provides clear feedback during execution
- Tests pass with >90% coverage

---

### Stage 6: Implement GraphQL Mutation Hooks for Resolution

**Goal**: Create mutation hooks for `completeEvent` and `resolveEncounter` with proper cache updates and error handling.

**Tasks**:

- [ ] Create `useCompleteEvent` hook in `packages/frontend/src/services/api/mutations/`
  - Define COMPLETE_EVENT mutation
  - Handle optimistic response
  - Update cache (mark event as completed, set occurredAt)
  - Refetch GET_EVENTS_BY_CAMPAIGN query
  - Return { completeEvent, loading, error, data }
- [ ] Create `useResolveEncounter` hook in `packages/frontend/src/services/api/mutations/`
  - Define RESOLVE_ENCOUNTER mutation
  - Handle optimistic response
  - Update cache (mark encounter as resolved, set resolvedAt)
  - Refetch GET_ENCOUNTERS_BY_CAMPAIGN query
  - Return { resolveEncounter, loading, error, data }
- [ ] Write integration tests for `useCompleteEvent`
  - Test successful completion
  - Test error handling
  - Test cache updates
  - Test optimistic UI
- [ ] Write integration tests for `useResolveEncounter`
  - Test successful resolution
  - Test error handling
  - Test cache updates
  - Test optimistic UI
- [ ] Update MSW handlers to support mutation responses

**Files to create**:

- `packages/frontend/src/services/api/mutations/complete-event.ts`
- `packages/frontend/src/services/api/mutations/complete-event.test.tsx`
- `packages/frontend/src/services/api/mutations/resolve-encounter.ts`
- `packages/frontend/src/services/api/mutations/resolve-encounter.test.tsx`

**Files to modify**:

- `packages/frontend/src/services/api/mutations/index.ts`
- `packages/frontend/src/__tests__/mocks/handlers.ts`

**Testing**:

- Mutations execute successfully with valid data
- Optimistic updates provide instant feedback
- Cache updates reflect completed/resolved state
- Error handling works correctly
- Timeline refreshes after resolution

**Success Criteria**:

- completeEvent mutation works end-to-end
- resolveEncounter mutation works end-to-end
- Apollo cache updates correctly
- Tests pass with >90% coverage

---

### Stage 7: Integrate Resolution Mutations with UI

**Goal**: Wire up the resolution UI components with GraphQL mutation hooks to enable end-to-end resolution workflow.

**Tasks**:

- [ ] Integrate `useCompleteEvent` hook in ResolutionDialog for Event entities
  - Call mutation when user confirms
  - Show loading state during execution
  - Handle success (close dialog, show notification, refresh data)
  - Handle errors (show error message, allow retry)
- [ ] Integrate `useResolveEncounter` hook in ResolutionDialog for Encounter entities
  - Call mutation when user confirms
  - Show loading state during execution
  - Handle success (close dialog, show notification, refresh data)
  - Handle errors (show error message, allow retry)
- [ ] Add toast notifications for resolution success/failure
  - Success: "Event completed successfully" / "Encounter resolved successfully"
  - Error: Show error message with retry option
- [ ] Ensure EntityInspector closes after successful resolution
- [ ] Ensure Timeline refreshes to show updated status
- [ ] Write end-to-end tests for complete resolution workflow
  - Open inspector → Click resolve → Preview effects → Confirm → See success

**Files to modify**:

- `packages/frontend/src/components/features/entity-inspector/ResolutionDialog.tsx`
- `packages/frontend/src/components/features/entity-inspector/ResolutionDialog.test.tsx`
- `packages/frontend/src/components/features/entity-inspector/EntityInspector.tsx`

**Testing**:

- End-to-end resolution workflow completes successfully
- Toast notifications appear for success/failure
- Timeline updates after resolution
- EntityInspector closes after success
- Retry works after failure

**Success Criteria**:

- User can complete events from inspector
- User can resolve encounters from inspector
- Effects execute in correct order (verified via backend)
- World state updates (verified via audit trail)
- Tests pass with >90% coverage

---

### Stage 8: Add Resolution History to Versions Tab

**Goal**: Extend the Versions tab to display resolution history, showing when Event/Encounter was completed/resolved and which effects were executed.

**Tasks**:

- [ ] Update `VersionsTab.tsx` to show resolution-specific audit entries
  - Highlight COMPLETE_EVENT / RESOLVE_ENCOUNTER operations
  - Show effects that were executed during resolution
  - Display execution timestamps for each effect
  - Link to effect execution history modal (from EffectsTab)
- [ ] Enhance `useEntityAuditHistory` hook to include effect execution data
  - Join with EffectExecution records
  - Include effect names and timing phases
- [ ] Add "View Effect Executions" button to resolution audit entries
  - Opens modal showing detailed effect execution log
  - Shows before/after state changes for each effect
- [ ] Write tests for resolution history display

**Files to modify**:

- `packages/frontend/src/components/features/entity-inspector/VersionsTab.tsx`
- `packages/frontend/src/components/features/entity-inspector/VersionsTab.test.tsx`
- `packages/frontend/src/services/api/hooks/entity-audit.ts` (if needed)

**Testing**:

- Resolution entries appear in Versions tab after resolution
- Effect execution details display correctly
- "View Effect Executions" modal shows detailed logs
- Timestamps and operation badges render correctly

**Success Criteria**:

- Versions tab shows resolution audit trail
- Effect executions are visible in history
- User can inspect before/after state changes
- Tests pass with >90% coverage

---

### Stage 9: Implement Validation for Resolution Preconditions

**Goal**: Add validation logic to prevent resolution of Event/Encounter when preconditions are not met (e.g., missing required variables, invalid state).

**Tasks**:

- [ ] Create validation utility functions in `packages/frontend/src/utils/resolution-validation.ts`
  - `validateEventResolution(event: Event): ValidationResult`
    - Check if event is already completed
    - Check if event is in the past (if required)
    - Check for required variables
  - `validateEncounterResolution(encounter: Encounter): ValidationResult`
    - Check if encounter is already resolved
    - Check for required variables (e.g., difficulty, participants)
    - Check if encounter can be resolved (business logic)
  - Return { isValid: boolean, errors: string[], warnings: string[] }
- [ ] Integrate validation into ResolutionDialog
  - Run validation when dialog opens
  - Display validation errors prominently
  - Disable "Confirm" button if validation fails
  - Show warnings (but allow confirmation)
- [ ] Add backend validation to mutation resolvers (if not already present)
  - completeEvent should validate before executing effects
  - resolveEncounter should validate before executing effects
- [ ] Write unit tests for validation functions
- [ ] Write integration tests for validation in UI

**Files to create**:

- `packages/frontend/src/utils/resolution-validation.ts`
- `packages/frontend/src/utils/resolution-validation.test.ts`

**Files to modify**:

- `packages/frontend/src/components/features/entity-inspector/ResolutionDialog.tsx`
- `packages/frontend/src/components/features/entity-inspector/ResolutionDialog.test.tsx`

**Testing**:

- Validation prevents resolution of already completed/resolved entities
- Validation catches missing required fields
- Warnings displayed but don't block resolution
- Backend validation prevents invalid resolutions

**Success Criteria**:

- Invalid resolutions are blocked with clear error messages
- Validation errors guide user to fix issues
- Backend validates to prevent data corruption
- Tests pass with >90% coverage

---

### Stage 10: Implement Rollback Capability (Optional/Stretch Goal)

**Goal**: Add ability to rollback (undo) a completed event or resolved encounter, reversing the effects that were executed.

**Tasks**:

- [ ] Check if backend supports rollback (may require new mutation)
  - If not, consider creating ROLLBACK_EVENT and ROLLBACK_ENCOUNTER mutations
  - Rollback should reverse effects in opposite order (POST → ON_RESOLVE → PRE)
  - Rollback should create audit trail entry
- [ ] Create `useRollbackEvent` and `useRollbackEncounter` mutation hooks
  - Similar structure to completion/resolution hooks
  - Update cache to mark entity as incomplete/unresolved
  - Refetch queries to refresh UI
- [ ] Add "Rollback" button to Versions tab
  - Show only for the most recent resolution entry
  - Confirm before executing rollback
  - Show loading and success/error states
- [ ] Create RollbackDialog component
  - Show warning about reversing effects
  - Display effects that will be reversed
  - Require confirmation
- [ ] Write tests for rollback functionality

**Files to create** (if implementing):

- `packages/frontend/src/services/api/mutations/rollback-event.ts`
- `packages/frontend/src/services/api/mutations/rollback-encounter.ts`
- `packages/frontend/src/components/features/entity-inspector/RollbackDialog.tsx`

**Files to modify** (if implementing):

- `packages/frontend/src/components/features/entity-inspector/VersionsTab.tsx`

**Testing**:

- Rollback reverses completed event
- Rollback reverses resolved encounter
- Effects reversed in correct order
- Audit trail records rollback operation

**Success Criteria** (if implementing):

- User can rollback recent resolutions
- Effects are reversed correctly
- World state reverts to pre-resolution state
- Audit trail tracks rollback
- Tests pass with >90% coverage

**Note**: This stage is optional and depends on backend support. If backend doesn't support rollback, skip this stage and note in documentation.

---

### Stage 11: Add Resolution Notifications and User Feedback

**Goal**: Enhance user experience with clear notifications, feedback, and visual indicators throughout the resolution workflow.

**Tasks**:

- [ ] Add toast notifications for all resolution actions
  - Event completion success/failure
  - Encounter resolution success/failure
  - Validation errors
  - Rollback success/failure (if implemented)
- [ ] Add visual indicators on Timeline for resolved entities
  - Different color/icon for completed events
  - Different color/icon for resolved encounters
  - Tooltip showing resolution timestamp
- [ ] Add badge to EntityInspector header showing resolution status
  - "Completed" badge for events
  - "Resolved" badge for encounters
  - Color-coded (green for completed/resolved, gray for pending)
- [ ] Add loading skeleton for EntityInspector when fetching Event/Encounter data
- [ ] Add empty state messages for entities with no effects
- [ ] Write tests for notification and feedback mechanisms

**Files to modify**:

- `packages/frontend/src/components/features/timeline/Timeline.tsx`
- `packages/frontend/src/components/features/entity-inspector/EntityInspector.tsx`
- `packages/frontend/src/components/features/entity-inspector/OverviewTab.tsx`
- `packages/frontend/src/utils/timeline-transforms.ts` (for visual indicators)

**Testing**:

- Toast notifications appear at appropriate times
- Visual indicators display correctly on timeline
- Resolution status badges render in inspector
- Loading states provide smooth UX

**Success Criteria**:

- User receives clear feedback for all actions
- Visual indicators make resolution status obvious
- Loading states prevent confusion
- Tests pass with >90% coverage

---

### Stage 12: Documentation, Testing, and Polish

**Goal**: Comprehensive testing, documentation, accessibility audit, and final polish.

**Tasks**:

- [ ] Write comprehensive integration tests
  - Full resolution workflow (Event)
  - Full resolution workflow (Encounter)
  - Validation edge cases
  - Error recovery scenarios
- [ ] Run full test suite and ensure all tests pass
  - Frontend unit tests
  - Frontend integration tests
  - E2E tests (if applicable)
- [ ] Accessibility audit
  - Keyboard navigation works for all dialogs
  - Screen reader support for resolution workflow
  - ARIA labels on all interactive elements
  - Color contrast meets WCAG 2.1 Level AA
- [ ] Performance testing
  - EntityInspector loads quickly for Event/Encounter
  - Resolution mutation completes in reasonable time
  - Timeline updates smoothly after resolution
- [ ] Create feature documentation
  - User guide: "How to Complete Events"
  - User guide: "How to Resolve Encounters"
  - Developer guide: "Event & Encounter Inspector Architecture"
  - Add to `docs/features/event-encounter-inspector.md`
- [ ] Update CLAUDE.md with Event/Encounter inspector information
  - Add quick reference section
  - Document key components and hooks
  - Link to feature documentation
- [ ] Update README.md if needed
- [ ] Code review and cleanup
  - Remove console.logs
  - Remove TODOs
  - Clean up commented code
  - Ensure consistent code style

**Files to create**:

- `docs/features/event-encounter-inspector.md`

**Files to modify**:

- `CLAUDE.md`
- `README.md` (if needed)
- All test files (ensure comprehensive coverage)

**Testing**:

- All tests pass (100% of existing + new tests)
- No console errors or warnings
- Accessibility score meets standards
- Performance benchmarks met

**Success Criteria**:

- Test coverage >90% for new code
- Accessibility audit passes
- Documentation is comprehensive and clear
- Code is clean and maintainable
- All acceptance criteria from ticket are met

---

## Testing Strategy

### Unit Tests

- EventPanel and EncounterPanel components
- Resolution validation functions
- GraphQL mutation hooks (useCompleteEvent, useResolveEncounter)
- Resolution UI components (ResolutionDialog, ResolutionButton)

### Integration Tests

- EntityInspector with Event/Encounter types
- Timeline click-to-open workflow
- Resolution workflow end-to-end
- Cache updates after resolution

### E2E Tests (if applicable)

- Complete event workflow from timeline click to resolution
- Resolve encounter workflow from timeline click to resolution
- Validation preventing invalid resolutions
- Rollback workflow (if implemented)

## Success Metrics

- [ ] All 12 acceptance criteria from ticket are met
- [ ] Test coverage >90% for new code
- [ ] No TypeScript or ESLint errors
- [ ] All tests pass
- [ ] Accessibility audit passes (WCAG 2.1 Level AA)
- [ ] Performance benchmarks met (inspector loads <500ms, mutations complete <2s)
- [ ] Documentation is comprehensive and clear
- [ ] Code review approval (via code-reviewer subagent)

## Notes

- Follow existing patterns from Settlement/Structure inspector implementation
- Reuse components where possible (OverviewTab, LinksTab, ConditionsTab, EffectsTab, VersionsTab)
- Ensure consistency with existing UI/UX patterns
- Use shadcn/ui components for dialogs, buttons, badges
- Follow GraphQL best practices for cache updates
- Implement optimistic UI for better perceived performance
- Handle errors gracefully with user-friendly messages
- Test thoroughly before marking stage complete
