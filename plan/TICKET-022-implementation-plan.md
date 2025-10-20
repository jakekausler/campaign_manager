# TICKET-022: Timeline View Implementation Plan

## Overview

Implement a timeline view for visualizing events and encounters over world-time. The timeline will show scheduled events/encounters, allow drag-to-reschedule functionality, display availability states with color coding, and provide zoom/pan controls for time navigation.

## Technical Decisions

### Timeline Library Selection

After evaluating options (vis-timeline, react-calendar-timeline, recharts), we'll use **vis-timeline-react** because:

- Native timeline/gantt chart support with drag-and-drop
- Built-in zoom and pan controls
- Good TypeScript support
- Lightweight and performant
- Supports custom item templates and styling
- Well-maintained and documented

Alternative considered: react-calendar-timeline (more complex API, less features out-of-box)

### Data Model

From the GraphQL types analysis:

- **Events**: Have `scheduledAt` (when scheduled), `occurredAt` (when completed), `isCompleted` status
- **Encounters**: Don't have scheduling fields currently (will need backend extension)
- **World Time**: Campaign has `currentWorldTime` field for tracking "now"

### Architecture

- **Page**: `TimelinePage` at `/timeline` route (protected)
- **Components**:
  - `Timeline` - Main vis-timeline wrapper
  - `TimelineControls` - Zoom, pan, time range controls
  - `TimelineFilters` - Filter by type, location, completion status
  - `TimelineItem` - Custom item renderer for events/encounters
  - `CurrentTimeMarker` - Visual indicator for current world time
- **Hooks**:
  - `useTimelineData` - Fetch and transform events/encounters for timeline
  - `useTimelineReschedule` - Handle drag-to-reschedule mutations
- **Utils**:
  - `timeline-transforms.ts` - Transform GraphQL data to vis-timeline format
  - `timeline-validation.ts` - Validate time ranges and prevent invalid moves

## Stages

### Stage 1: Install Dependencies and Setup Timeline Component

**Goal**: Install vis-timeline library and create basic Timeline component structure
**Success Criteria**:

- [ ] vis-timeline-react installed
- [ ] Basic `Timeline` component renders with mock data
- [ ] TypeScript types configured for vis-timeline
- [ ] Component exported and accessible

**Tests**:

- Unit test: Timeline renders with empty dataset
- Unit test: Timeline renders with mock items

**Files to create**:

- `packages/frontend/src/components/features/timeline/Timeline.tsx`
- `packages/frontend/src/components/features/timeline/index.ts`
- `packages/frontend/src/components/features/timeline/Timeline.test.tsx`

**Status**: ✅ Complete

**Commit**: 3273623

**Implementation Notes**:

- Installed react-vis-timeline@2.0.3 with matching vis-timeline@7.7.4, vis-data@7.1.10, vis-util@5.0.7
- Version 7.x selected to match react-vis-timeline peer dependencies and avoid bundle duplication
- Created Timeline wrapper component with memoized options to prevent unnecessary re-renders
- Used CSS import (non-minified) for better development debugging
- Implemented comprehensive JSDoc documentation
- 10 unit tests covering rendering, props, and item types
- TypeScript path mapping for vis-timeline/types
- Code reviewed and approved - all critical issues resolved

---

### Stage 2: Create GraphQL Queries for Events and Encounters

**Goal**: Add GraphQL queries to fetch events and encounters with time-related fields
**Success Criteria**:

- [x] `GET_EVENTS` query includes all needed fields (id, name, scheduledAt, occurredAt, isCompleted, eventType, locationId)
- [x] `GET_ENCOUNTERS` query includes all needed fields (id, name, difficulty, isResolved, resolvedAt, locationId)
- [x] MSW handlers created for testing
- [x] Types use placeholder types (codegen will run later)

**Tests**:

- Integration test: useEventsByCampaign returns correct data structure (8 tests)
- Integration test: useEncountersByCampaign returns correct data structure (9 tests)

**Files created**:

- `packages/frontend/src/services/api/hooks/events.ts`
- `packages/frontend/src/services/api/hooks/events.test.tsx`
- `packages/frontend/src/services/api/hooks/encounters.ts`
- `packages/frontend/src/services/api/hooks/encounters.test.tsx`

**Files modified**:

- `packages/frontend/src/__tests__/mocks/data.ts` (added mockEvents and mockEncounters)
- `packages/frontend/src/__tests__/mocks/graphql-handlers.ts` (added query handlers)
- `packages/frontend/src/services/api/hooks/index.ts` (exported new hooks)

**Status**: ✅ Complete

**Commit**: 466e13e

**Implementation Notes**:

- Created `useEventsByCampaign` hook with GET_EVENTS_BY_CAMPAIGN query
  - Fetches events with scheduledAt, occurredAt, isCompleted, eventType
  - Cache-and-network fetch policy for fresh data
  - Returns simplified data shape with loading/error/refetch
  - 8 integration tests covering filtering, scheduling info, event types, locations
- Created `useEncountersByCampaign` hook with GET_ENCOUNTERS_BY_CAMPAIGN query
  - Fetches encounters with difficulty, isResolved, resolvedAt
  - Cache-and-network fetch policy for fresh data
  - Returns simplified data shape with loading/error/refetch
  - 9 integration tests covering filtering, resolution info, difficulty, variables
- Mock data includes 4 events and 4 encounters across different campaigns
  - Events: completed/scheduled, different event types (kingdom, world, party, story)
  - Encounters: resolved/unresolved, varying difficulty levels (3-15)
- MSW handlers filter by campaignId and return proper GraphQL responses
- All 17 new tests passing (666 total tests passing)
- Follows exact patterns from settlement/structure hooks
- TypeScript types use placeholders with TODO comments for codegen
- Comprehensive JSDoc documentation on all hooks and queries
- Code reviewed and approved - no critical issues

---

### Stage 3: Create Data Transformation Utilities

**Goal**: Transform GraphQL event/encounter data into vis-timeline item format
**Success Criteria**:

- [x] `transformEventToTimelineItem()` function works correctly
- [x] `transformEncounterToTimelineItem()` function works correctly
- [x] Items have correct start/end times based on scheduledAt/occurredAt
- [x] Items have type-based styling (colors, icons)
- [x] Handles null/undefined dates gracefully

**Tests**:

- Unit test: Transform completed event with occurredAt ✓
- Unit test: Transform scheduled event without occurredAt ✓
- Unit test: Transform encounter (handle missing scheduling fields) ✓
- Unit test: Handle null dates ✓

**Files created**:

- `packages/frontend/src/utils/timeline-transforms.ts`
- `packages/frontend/src/utils/timeline-transforms.test.ts`

**Status**: ✅ Complete

**Commit**: 0e8b1ef

**Implementation Notes**:

- Created comprehensive transformation utilities to convert GraphQL data to vis-timeline format
- Three main transformation functions:
  - `transformEventToTimelineItem()` - Transforms events using scheduledAt or occurredAt dates
  - `transformEncounterToTimelineItem()` - Transforms encounters using resolvedAt date
  - `transformToTimelineItems()` - Batch transformation combining events and encounters
- Color-coded status visualization matching implementation plan:
  - Completed events: #10b981 (green-500)
  - Scheduled events: #3b82f6 (blue-500)
  - Overdue events: #ef4444 (red-500) - past scheduledAt but not completed
  - Resolved encounters: #059669 (green-600)
  - Unresolved encounters: #f97316 (orange-500)
- Graceful null/undefined date handling - returns null when no valid date available
- Type-safe with placeholder interfaces (will be replaced by codegen in Stage 4)
- Rich tooltips with event/encounter details (name, type, status, description, difficulty)
- Editable flag prevents rescheduling completed/resolved items
- Overdue detection using optional currentWorldTime parameter
- 19 comprehensive unit tests covering:
  - Completed events with occurredAt
  - Scheduled events with scheduledAt
  - Overdue events (past scheduledAt, not completed)
  - Resolved encounters with resolvedAt
  - Unresolved encounters (returns null - scheduledAt field to be added in Stage 9)
  - Null/undefined date handling
  - Optional field handling (description, difficulty)
  - Combined transformations with filtering
  - Edge cases (empty arrays, current world time)
- All tests passing (19/19)
- Code reviewed and approved - no critical issues
- TypeScript and ESLint checks passing

---

### Stage 4: Implement useTimelineData Hook

**Goal**: Create React hook to fetch and combine events/encounters data
**Success Criteria**:

- [x] Hook fetches both events and encounters
- [x] Combines data into single timeline items array
- [x] Handles loading and error states
- [x] Supports filtering by campaign ID
- [x] Memoizes transformed data

**Tests**:

- Integration test: Hook combines events and encounters ✓
- Integration test: Hook handles loading state ✓
- Integration test: Hook handles GraphQL errors ✓
- Integration test: Hook transforms events/encounters to timeline items ✓
- Integration test: Hook detects overdue events with currentWorldTime ✓
- Integration test: Hook provides refetch function ✓
- Integration test: Hook memoizes items correctly ✓
- Integration test: Hook updates when currentWorldTime changes ✓

**Files created**:

- `packages/frontend/src/hooks/useTimelineData.ts`
- `packages/frontend/src/hooks/useTimelineData.test.tsx`

**Files modified**:

- `packages/frontend/src/hooks/index.ts` (exported new hook)
- `packages/frontend/src/__tests__/mocks/data.ts` (corrected mock data)
- `packages/frontend/src/services/api/hooks/events.test.tsx` (updated assertions)
- `packages/frontend/src/services/api/hooks/encounters.test.tsx` (updated assertions)

**Status**: ✅ Complete

**Commit**: 0673f47

**Implementation Notes**:

- Created useTimelineData hook that combines useEventsByCampaign and useEncountersByCampaign
- Fetches both data sources in parallel using existing GraphQL hooks
- Transforms combined data using transformToTimelineItems utility from Stage 3
- Smart loading state logic:
  - Only shows loading when no cached data exists (not during refetch)
  - Prevents flashing loading state when data is already available
- Combined error handling returns first error encountered from either query
- Memoization strategy:
  - Items memoized with useMemo based on events, encounters, currentWorldTime
  - Refetch function wrapped in useCallback to stabilize reference
  - Return object memoized to prevent unnecessary re-renders
- Support for optional currentWorldTime parameter for overdue detection
- Parallel refetch using Promise.all for optimal performance
- 10 comprehensive integration tests (all passing):
  - Combining events and encounters into timeline items
  - Handling campaign with only events
  - Handling campaign with no data
  - Event transformation with correct properties (completed/scheduled)
  - Encounter transformation with correct properties (resolved)
  - Overdue event detection with currentWorldTime
  - Refetch functionality
  - Loading state handling
  - Memoization behavior (reference stability)
  - Dynamic updates when currentWorldTime changes
- Corrected mock data for realistic test scenarios:
  - event-2 scheduledAt changed to 2024-08-20 (enables overdue detection)
  - encounter-1 changed to "Dragon Attack" with difficulty 15
- All 695 frontend tests passing
- TypeScript type-check passing
- ESLint checks passing
- Code review approved with no issues
- Follows exact patterns from settlement/structure hooks
- Comprehensive JSDoc documentation with usage examples

---

### Stage 5: Implement TimelinePage with Basic Visualization

**Goal**: Create page component that renders timeline with real data
**Success Criteria**:

- [x] TimelinePage component created and routed at `/timeline`
- [x] Timeline displays events/encounters from GraphQL
- [x] Loading skeleton shown while fetching
- [x] Error state displayed on fetch failure
- [x] Timeline is responsive

**Tests**:

- Integration test: Page renders timeline with data ✓
- Integration test: Page shows loading state ✓
- Integration test: Page shows error state ✓

**Files created**:

- `packages/frontend/src/pages/TimelinePage.tsx`
- `packages/frontend/src/pages/TimelinePage.test.tsx`

**Files modified**:

- `packages/frontend/src/router/index.tsx` (added /timeline route)
- `packages/frontend/src/pages/index.ts` (exported TimelinePage)

**Status**: ✅ Complete

**Commit**: 347b057

**Implementation Notes**:

- Created TimelinePage component with comprehensive state handling
- Timeline displays events/encounters using useTimelineData hook from Stage 4
- Loading state shows user-friendly message during data fetch
- Error state with retry button (accessible with ARIA label and focus ring styles)
- Empty states for:
  - No campaign selected
  - No timeline items exist
- Responsive full-height layout with header showing item count
- Protected route at /timeline requiring authentication
- Lazy-loaded for optimal bundle size
- 15 comprehensive integration tests (all passing):
  - Loading state rendering (2 tests)
  - Error state with retry functionality (3 tests)
  - Empty states for no campaign and no data (2 tests)
  - Success state with timeline rendering (4 tests)
  - Data fetching with campaign ID (2 tests)
  - Responsive layout structure (2 tests)
- Code quality improvements based on Code Reviewer feedback:
  - Removed unnecessary useMemo (identity transformation)
  - Added accessibility to retry button (type, aria-label, focus ring)
  - Direct pass-through of items to Timeline component
- All 710 frontend tests passing (no regressions)
- TypeScript type-check passing
- ESLint checks passing
- Follows existing page patterns (FlowViewPage, MapPage)
- TODO placeholder for currentWorldTime integration in Stage 6

---

### Stage 6: Add Current World Time Marker

**Goal**: Display visual marker for campaign's current world time
**Success Criteria**:

- [x] Fetches currentWorldTime from GraphQL
- [x] Renders vertical line at current time position
- [x] Updates when world time advances
- [x] Styled distinctly (red/orange color)
- [x] Current time displayed in page header

**Tests**:

- Integration test: Marker renders at correct position ✓
- Integration test: Marker updates when world time changes ✓
- Integration test: Handles null currentWorldTime ✓
- Integration test: currentTime passed to useTimelineData ✓
- Integration test: currentTime displayed in header ✓

**Files created**:

- `packages/frontend/src/components/features/timeline/Timeline.css`

**Files modified**:

- `packages/frontend/src/stores/campaign-slice.ts` (added currentWorldTime field)
- `packages/frontend/src/components/features/timeline/Timeline.tsx` (added currentTime prop)
- `packages/frontend/src/components/features/timeline/Timeline.test.tsx` (added 5 tests)
- `packages/frontend/src/pages/TimelinePage.tsx` (integrated useCurrentWorldTime hook)
- `packages/frontend/src/pages/TimelinePage.test.tsx` (added 4 tests)

**Status**: ✅ Complete

**Commit**: fd8f766

**Implementation Notes**:

- Used vis-timeline's customTimes API with `datetime` property for marker
- Marker styled with design system's destructive color (red/orange)
- CSS uses `hsl(var(--destructive))` for theme consistency
- Integrated useCurrentWorldTime hook from existing world-time.ts
- Marker updates automatically when currentWorldTime changes
- Proper null/undefined handling throughout
- Current time displayed in page header with localized date format
- Memoized customTimes to prevent unnecessary re-renders
- All 719 frontend tests passing (9 new tests added)
- TypeScript strict mode compliant
- ESLint checks passing
- Code review approved with no critical issues

---

### Stage 7: Implement Zoom and Pan Controls

**Goal**: Add controls for navigating timeline (zoom in/out, fit to window)
**Success Criteria**:

- [x] TimelineControls component with zoom buttons
- [x] Zoom in/out functions work
- [x] "Fit to window" button shows all items
- [x] "Jump to current time" button
- [x] Keyboard shortcuts (+ / -, 0 for fit, T for jump to current time)

**Tests**:

- Unit test: Zoom in/out buttons update timeline ✓
- Unit test: Fit to window shows all items ✓
- Unit test: Jump to current time centers marker ✓
- Unit test: Keyboard shortcuts work (24 total tests) ✓

**Files created**:

- `packages/frontend/src/components/features/timeline/TimelineControls.tsx`
- `packages/frontend/src/components/features/timeline/TimelineControls.test.tsx`

**Files modified**:

- `packages/frontend/src/components/features/timeline/Timeline.tsx` (added forwardRef and TimelineHandle)
- `packages/frontend/src/components/features/timeline/index.ts` (added exports)
- `packages/frontend/src/pages/TimelinePage.tsx` (integrated TimelineControls)
- `packages/frontend/src/pages/TimelinePage.test.tsx` (updated mock)

**Status**: ✅ Complete

**Commit**: 5f7a863

**Implementation Notes**:

- Converted Timeline component to use forwardRef pattern for imperative control
- Created TimelineHandle interface exposing zoomIn(), zoomOut(), fit(), moveTo() methods
- Implemented TimelineControls with four buttons:
  - Zoom In/Out: Adjust scale by 10% increments via vis-timeline API
  - Fit View: Auto-scale to show all items using timeline.fit()
  - Jump to Now: Center on current world time (conditional rendering)
- Comprehensive keyboard shortcut support:
  - '+' or '=': Zoom in
  - '-' or '\_': Zoom out
  - '0': Fit all items
  - 'T' or 't': Jump to current time
- Smart input field detection prevents shortcuts during typing in text fields
- Event cleanup in useEffect prevents memory leaks
- 24 unit tests covering all scenarios (743 total frontend tests passing):
  - Rendering with/without current time (4 tests)
  - Button interactions (4 tests)
  - Keyboard shortcuts (+/-, 0, T keys) (9 tests)
  - Input field detection (2 tests)
  - preventDefault behavior (1 test)
  - Accessibility (2 tests)
  - Edge cases (null refs, unmounting, custom className) (2 tests)
- Full accessibility with ARIA labels and title attributes
- Responsive design with mobile-friendly hints
- Memoization with memo() and useCallback for performance
- All TypeScript type-check and ESLint passing
- Code review approved with no critical issues
- Follows shadcn/ui button patterns and project conventions

---

### Stage 8: Add Availability Color Coding

**Goal**: Color-code timeline items based on availability/status
**Success Criteria**:

- [x] Completed events are green
- [x] Scheduled (future) events are blue
- [x] Overdue events (past scheduledAt, not completed) are red
- [x] Resolved encounters are green
- [x] Unresolved encounters are orange
- [x] Tooltip shows status on hover

**Tests**:

- Unit test: Completed event has green color ✓
- Unit test: Scheduled event has blue color ✓
- Unit test: Overdue event has red color ✓
- Unit test: Resolved encounter has green color ✓
- Unit test: Tooltip shows status information ✓

**Files updated**:

- `packages/frontend/src/utils/timeline-transforms.ts` (color logic already implemented in Stage 3)
- `packages/frontend/src/utils/timeline-transforms.test.ts` (comprehensive color tests already present)

**Status**: ✅ Complete (implemented proactively in Stage 3)

**Commit**: 0e8b1ef (same as Stage 3, where this was implemented)

**Implementation Notes**:

- This stage was completed proactively during Stage 3 when transformation utilities were created
- All color coding logic was implemented in `getEventColor()` and `getEncounterColor()` functions
- Color scheme matches implementation plan exactly:
  - Completed events: #10b981 (green-500)
  - Scheduled events: #3b82f6 (blue-500)
  - Overdue events: #ef4444 (red-500)
  - Resolved encounters: #059669 (green-600)
  - Unresolved encounters: #f97316 (orange-500)
- Colors applied via inline `style` attribute on timeline items
- Tooltips include status information (Completed, Scheduled, Overdue, Resolved, Unresolved)
- 19 comprehensive unit tests cover all color scenarios:
  - Completed event color test (line 33)
  - Scheduled event color test (line 59)
  - Overdue event color test (line 79)
  - Resolved encounter color test (line 167)
  - Status tooltips for all states (lines 35, 60, 80, 169)
- All tests passing (19/19 in timeline-transforms.test.ts)
- TypeScript type-check passing
- ESLint checks passing

---

### Stage 9: Implement Backend Support for Encounter Scheduling

**Goal**: Add scheduling fields to Encounter model and GraphQL API
**Success Criteria**:

- [x] Prisma schema updated with `scheduledAt` field on Encounter
- [x] Migration created and documented
- [x] EncounterService supports scheduling field
- [x] GraphQL type includes `scheduledAt`
- [x] Update/create mutations accept `scheduledAt`

**Tests**:

- Integration test: Create encounter with scheduledAt ✓
- Integration test: Update encounter's scheduledAt ✓
- Integration test: Query encounter returns scheduledAt ✓

**Files updated**:

- `packages/api/prisma/schema.prisma` - Added scheduledAt DateTime field with index
- `packages/api/src/graphql/types/encounter.type.ts` - Added scheduledAt field to Encounter type
- `packages/api/src/graphql/services/encounter.service.ts` - Updated create/update methods
- `packages/api/src/graphql/inputs/encounter.input.ts` - Added scheduledAt to input types
- `packages/frontend/src/utils/timeline-transforms.ts` - Updated Encounter interface and transformation logic
- `packages/frontend/src/services/api/hooks/encounters.ts` - Added scheduledAt to GraphQL query

**Files created**:

- `packages/api/prisma/migrations/20251020015036_add_encounter_scheduled_at/migration.sql`

**Status**: ✅ Complete

**Commit**: 3fd3bbb

**Implementation Notes**:

Backend implementation:

- Added `scheduledAt DateTime?` field to Encounter model with dedicated index for query optimization
- Updated Encounter GraphQL type to expose scheduledAt field
- Modified CreateEncounterInput to accept optional scheduledAt parameter
- Modified UpdateEncounterInput and UpdateEncounterData interface to accept optional scheduledAt parameter
- Updated EncounterService.create() to handle scheduledAt field in data object
- Updated EncounterService.update() to handle scheduledAt field updates
- Added scheduledAt to audit log entries for tracking changes
- Database migration `20251020015036_add_encounter_scheduled_at` created and applied successfully

Frontend implementation:

- Updated Encounter TypeScript interface to include scheduledAt field
- Modified transformEncounterToTimelineItem() to prioritize resolvedAt for resolved encounters, otherwise use scheduledAt for display
- Updated GET_ENCOUNTERS_BY_CAMPAIGN GraphQL query to fetch scheduledAt field
- Removed TODO comments noting Stage 9 as future work

Timeline behavior:

- Resolved encounters display at resolvedAt timestamp (unchanged)
- Scheduled encounters now display at scheduledAt timestamp (new)
- Encounters without any valid date are filtered out (return null from transformer)
- Resolved encounters remain non-editable on timeline (editable: false)

Type-check passed with no errors. All pre-commit hooks (formatting, linting) passed successfully.

This completes the foundation for drag-to-reschedule functionality in Stage 10.

---

### Stage 10: Implement Drag-to-Reschedule Functionality

**Goal**: Allow dragging timeline items to reschedule events/encounters
**Success Criteria**:

- [ ] vis-timeline editable mode enabled
- [ ] Dragging event updates `scheduledAt` via mutation
- [ ] Dragging encounter updates `scheduledAt` via mutation
- [ ] Optimistic UI update during drag
- [ ] Validation prevents scheduling in past (before current world time)
- [ ] Error handling with rollback on mutation failure

**Tests**:

- Integration test: Dragging event calls updateEvent mutation
- Integration test: Dragging encounter calls updateEncounter mutation
- Integration test: Validation prevents past scheduling
- Integration test: Failed mutation rolls back optimistic update

**Files to create**:

- `packages/frontend/src/hooks/useTimelineReschedule.ts`
- `packages/frontend/src/hooks/useTimelineReschedule.test.tsx`
- `packages/frontend/src/utils/timeline-validation.ts`
- `packages/frontend/src/utils/timeline-validation.test.ts`

**Files to update**:

- `packages/frontend/src/components/features/timeline/Timeline.tsx` (add drag handlers)

**Status**: Not Started

---

### Stage 11: Add Filtering and Lane Grouping

**Goal**: Filter timeline items and group into lanes by type/location
**Success Criteria**:

- [ ] TimelineFilters component with checkboxes
- [ ] Filter by event type (story, kingdom, party, world)
- [ ] Filter by completion status (all, completed, scheduled, overdue)
- [ ] Group items into lanes (Events lane, Encounters lane, or by location)
- [ ] Filters persist to URL query params

**Tests**:

- Integration test: Filtering by event type hides items
- Integration test: Filtering by status works
- Integration test: Lane grouping separates items correctly
- Integration test: URL params update when filters change

**Files to create**:

- `packages/frontend/src/components/features/timeline/TimelineFilters.tsx`
- `packages/frontend/src/components/features/timeline/TimelineFilters.test.tsx`
- `packages/frontend/src/utils/timeline-filters.ts`
- `packages/frontend/src/utils/timeline-filters.test.ts`

**Status**: Not Started

---

### Stage 12: Testing, Documentation, and Polish

**Goal**: Comprehensive testing, documentation, and UI polish
**Success Criteria**:

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Feature documentation created in `docs/features/timeline-view.md`
- [ ] README.md updated with timeline view section
- [ ] CLAUDE.md updated with timeline view reference
- [ ] Accessibility audit (keyboard nav, ARIA labels)
- [ ] Performance testing with 100+ items
- [ ] Error boundaries added

**Tests**:

- E2E test: Full timeline workflow (load, filter, drag, reschedule)
- Accessibility test: Keyboard navigation works
- Performance test: Timeline renders 100+ items in <3s

**Files to create**:

- `docs/features/timeline-view.md`

**Files to update**:

- `README.md`
- `CLAUDE.md`
- `packages/frontend/README.md`

**Status**: Not Started

---

## Implementation Notes

### vis-timeline Configuration

```typescript
const options = {
  editable: {
    updateTime: true, // Allow dragging items
    remove: false, // Prevent deletion from timeline
  },
  orientation: 'top',
  stack: true, // Stack overlapping items
  zoomMin: 1000 * 60 * 60 * 24, // Min zoom: 1 day
  zoomMax: 1000 * 60 * 60 * 24 * 365 * 10, // Max zoom: 10 years
  showCurrentTime: false, // We'll render custom marker
  verticalScroll: true,
  horizontalScroll: true,
};
```

### Timeline Item Format

```typescript
interface TimelineItem {
  id: string;
  content: string; // HTML or React component
  start: Date;
  end?: Date;
  type: 'box' | 'point' | 'range';
  className?: string; // For custom styling
  style?: string; // Inline CSS
  group?: string; // For lane grouping
  editable?: boolean; // Per-item editability
  title?: string; // Tooltip text
}
```

### Color Scheme

- **Completed Events**: `bg-green-500`
- **Scheduled Events**: `bg-blue-500`
- **Overdue Events**: `bg-red-500`
- **Resolved Encounters**: `bg-green-600`
- **Unresolved Encounters**: `bg-orange-500`
- **Current Time Marker**: `border-red-600` (2px solid line)

### GraphQL Mutations Needed

For drag-to-reschedule:

- `updateEvent(id, scheduledAt)` - Already exists (verify)
- `updateEncounter(id, scheduledAt)` - Will be added in Stage 9

### URL Structure

`/timeline?filters=completed,scheduled&group=type&start=2024-01-01&end=2024-12-31`

Query params:

- `filters`: Comma-separated status filters
- `group`: Grouping strategy (type, location, none)
- `start`, `end`: Visible time range (ISO dates)

## Dependencies

- **TICKET-007**: Event/Encounter models (✅ Complete)
- **TICKET-018**: State Management & GraphQL Client (✅ Complete)
- **TICKET-010**: World Time System (✅ Complete - needed for current time marker)

## Estimated Effort

**Total**: 4-5 days (12 stages × 2-4 hours per stage)

## Risks and Mitigations

1. **Risk**: vis-timeline may have TypeScript typing issues
   - **Mitigation**: Create custom type definitions if needed, or use alternative library

2. **Risk**: Performance with large datasets (1000+ events)
   - **Mitigation**: Implement pagination or windowing, lazy load items in visible range

3. **Risk**: Encounter model doesn't have scheduling fields
   - **Mitigation**: Add in Stage 9 with proper migration (may require data backfill)

4. **Risk**: Complex calendar systems (custom calendars from World Time System)
   - **Mitigation**: Start with ISO dates, add calendar formatting in future ticket

## Future Enhancements (Out of Scope)

- Recurring events
- Multi-select and batch reschedule
- Timeline templates (save/load views)
- Export timeline as image/PDF
- Custom calendar display integration
- Real-time collaborative editing (WebSocket sync)
