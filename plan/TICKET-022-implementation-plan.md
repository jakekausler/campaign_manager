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

- [ ] `GET_EVENTS` query includes all needed fields (id, name, scheduledAt, occurredAt, isCompleted, eventType, locationId)
- [ ] `GET_ENCOUNTERS` query includes all needed fields (id, name, difficulty, isResolved, resolvedAt, locationId)
- [ ] MSW handlers created for testing
- [ ] Types generated via codegen

**Tests**:

- Integration test: useEventsQuery returns correct data structure
- Integration test: useEncountersQuery returns correct data structure

**Files to create**:

- `packages/frontend/src/services/api/hooks/useEvents.ts`
- `packages/frontend/src/services/api/hooks/useEncounters.ts`
- `packages/frontend/src/__tests__/mocks/handlers/events.ts`
- `packages/frontend/src/__tests__/mocks/handlers/encounters.ts`

**Status**: Not Started

---

### Stage 3: Create Data Transformation Utilities

**Goal**: Transform GraphQL event/encounter data into vis-timeline item format
**Success Criteria**:

- [ ] `transformEventToTimelineItem()` function works correctly
- [ ] `transformEncounterToTimelineItem()` function works correctly
- [ ] Items have correct start/end times based on scheduledAt/occurredAt
- [ ] Items have type-based styling (colors, icons)
- [ ] Handles null/undefined dates gracefully

**Tests**:

- Unit test: Transform completed event with occurredAt
- Unit test: Transform scheduled event without occurredAt
- Unit test: Transform encounter (handle missing scheduling fields)
- Unit test: Handle null dates

**Files to create**:

- `packages/frontend/src/utils/timeline-transforms.ts`
- `packages/frontend/src/utils/timeline-transforms.test.ts`

**Status**: Not Started

---

### Stage 4: Implement useTimelineData Hook

**Goal**: Create React hook to fetch and combine events/encounters data
**Success Criteria**:

- [ ] Hook fetches both events and encounters
- [ ] Combines data into single timeline items array
- [ ] Handles loading and error states
- [ ] Supports filtering by campaign ID
- [ ] Memoizes transformed data

**Tests**:

- Integration test: Hook combines events and encounters
- Integration test: Hook handles loading state
- Integration test: Hook handles GraphQL errors

**Files to create**:

- `packages/frontend/src/hooks/useTimelineData.ts`
- `packages/frontend/src/hooks/useTimelineData.test.tsx`

**Status**: Not Started

---

### Stage 5: Implement TimelinePage with Basic Visualization

**Goal**: Create page component that renders timeline with real data
**Success Criteria**:

- [ ] TimelinePage component created and routed at `/timeline`
- [ ] Timeline displays events/encounters from GraphQL
- [ ] Loading skeleton shown while fetching
- [ ] Error state displayed on fetch failure
- [ ] Timeline is responsive

**Tests**:

- Integration test: Page renders timeline with data
- Integration test: Page shows loading state
- Integration test: Page shows error state

**Files to create**:

- `packages/frontend/src/pages/TimelinePage.tsx`
- `packages/frontend/src/pages/TimelinePage.test.tsx`
- Update: `packages/frontend/src/router/index.tsx` (add route)
- Update: `packages/frontend/src/pages/index.ts` (export)

**Status**: Not Started

---

### Stage 6: Add Current World Time Marker

**Goal**: Display visual marker for campaign's current world time
**Success Criteria**:

- [ ] Fetches currentWorldTime from GraphQL
- [ ] Renders vertical line at current time position
- [ ] Updates when world time advances
- [ ] Styled distinctly (red/orange color)
- [ ] Includes tooltip showing exact time

**Tests**:

- Integration test: Marker renders at correct position
- Integration test: Marker updates when world time changes
- Integration test: Handles null currentWorldTime

**Files to create**:

- `packages/frontend/src/components/features/timeline/CurrentTimeMarker.tsx`
- `packages/frontend/src/components/features/timeline/CurrentTimeMarker.test.tsx`

**Status**: Not Started

---

### Stage 7: Implement Zoom and Pan Controls

**Goal**: Add controls for navigating timeline (zoom in/out, fit to window)
**Success Criteria**:

- [ ] TimelineControls component with zoom buttons
- [ ] Zoom in/out functions work
- [ ] "Fit to window" button shows all items
- [ ] "Jump to current time" button
- [ ] Keyboard shortcuts (+ / -, 0 for fit)

**Tests**:

- Unit test: Zoom in/out buttons update timeline
- Unit test: Fit to window shows all items
- Unit test: Jump to current time centers marker

**Files to create**:

- `packages/frontend/src/components/features/timeline/TimelineControls.tsx`
- `packages/frontend/src/components/features/timeline/TimelineControls.test.tsx`

**Status**: Not Started

---

### Stage 8: Add Availability Color Coding

**Goal**: Color-code timeline items based on availability/status
**Success Criteria**:

- [ ] Completed events are green
- [ ] Scheduled (future) events are blue
- [ ] Overdue events (past scheduledAt, not completed) are red
- [ ] Resolved encounters are green
- [ ] Unresolved encounters are orange
- [ ] Tooltip shows status on hover

**Tests**:

- Unit test: Completed event has green color
- Unit test: Overdue event has red color
- Unit test: Resolved encounter has green color

**Files to update**:

- `packages/frontend/src/utils/timeline-transforms.ts` (add color logic)
- `packages/frontend/src/utils/timeline-transforms.test.ts` (add color tests)

**Status**: Not Started

---

### Stage 9: Implement Backend Support for Encounter Scheduling

**Goal**: Add scheduling fields to Encounter model and GraphQL API
**Success Criteria**:

- [ ] Prisma schema updated with `scheduledAt` field on Encounter
- [ ] Migration created and documented
- [ ] EncounterService supports scheduling field
- [ ] GraphQL type includes `scheduledAt`
- [ ] Update/create mutations accept `scheduledAt`

**Tests**:

- Integration test: Create encounter with scheduledAt
- Integration test: Update encounter's scheduledAt
- Integration test: Query encounter returns scheduledAt

**Files to update**:

- `packages/api/prisma/schema.prisma`
- `packages/api/src/graphql/types/encounter.type.ts`
- `packages/api/src/graphql/services/encounter.service.ts`
- `packages/api/src/graphql/resolvers/encounter.resolver.ts`

**Files to create**:

- Migration file (via `prisma migrate dev`)

**Status**: Not Started

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
