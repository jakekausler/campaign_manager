# Timeline View - Event and Encounter Visualization

Interactive timeline visualization showing events and encounters over campaign world-time with drag-to-reschedule functionality.

## Overview

The Timeline View provides an interactive, visual representation of your campaign's events and encounters plotted against world-time. This makes it easy to see what's happening when, identify scheduling conflicts, track overdue items, and reschedule activities with simple drag-and-drop.

**Implementation**: TICKET-022 (12 stages, commits: 3273623 - [Stage 12 commit])

## Features

### Core Visualization

- **Interactive Timeline Canvas**: Powered by vis-timeline for smooth scrolling and zooming
- **Time-Based Layout**: Events/encounters positioned based on scheduled/occurred dates
- **Color-Coded Status**: Visual distinctions for completion states (completed, scheduled, overdue, resolved)
- **Current Time Marker**: Red vertical line showing campaign's current world time
- **Lane Grouping**: Organize items by type (Events/Encounters) or location
- **Zoom and Pan Controls**: Navigate through time with buttons or keyboard shortcuts
- **Drag-to-Reschedule**: Move items to new dates with validation and persistence

### Item Types and Status

Events and encounters are color-coded based on their status:

| Item Type            | Color                | Status Indicator | Description                                         |
| -------------------- | -------------------- | ---------------- | --------------------------------------------------- |
| Completed Event      | Green (#10b981)      | Solid            | Event occurred (has occurredAt date)                |
| Scheduled Event      | Blue (#3b82f6)       | Solid            | Event scheduled (has scheduledAt, not occurred)     |
| Overdue Event        | Red (#ef4444)        | Solid            | Past scheduledAt but not completed                  |
| Resolved Encounter   | Dark Green (#059669) | Solid            | Encounter resolved (has resolvedAt date)            |
| Unresolved Encounter | Orange (#f97316)     | Solid            | Encounter scheduled (has scheduledAt, not resolved) |

### Timeline Controls

**Zoom and Pan**:

- **Zoom In/Out**: Adjust time scale by 10% increments
- **Fit View**: Auto-scale to show all items in viewport
- **Jump to Now**: Center timeline on current world time marker
- **Keyboard Shortcuts**:
  - `+` or `=`: Zoom in
  - `-` or `_`: Zoom out
  - `0`: Fit all items
  - `T`: Jump to current time

**Smart Input Detection**: Keyboard shortcuts disabled when typing in text fields

### Drag-to-Reschedule

- **Event Rescheduling**: Drag events to change `scheduledAt` date
- **Encounter Rescheduling**: Drag encounters to change `scheduledAt` date
- **Validation Rules**:
  - Completed events cannot be rescheduled (editable: false)
  - Resolved encounters cannot be rescheduled (editable: false)
  - Items cannot be scheduled in the past (relative to current world time)
- **Optimistic UI**: Item moves immediately, reverts on error
- **Loading Indicator**: Shows "Rescheduling..." message during save
- **Error Handling**: Alert dialog with specific error messages on failure

### Filtering and Grouping

**Event Type Filters** (multi-select):

- Story events
- Kingdom events
- Party events
- World events
- Minimum one type must be selected at all times

**Status Filters** (multi-select):

- All (special filter that selects everything)
- Completed (events only)
- Scheduled (events only)
- Overdue (events only)
- Resolved (encounters only)
- Unresolved (encounters only)

**Lane Grouping**:

- **No Grouping**: All items in single timeline
- **By Type**: Separate lanes for Events and Encounters
- **By Location**: Separate lanes for each location (if location data available)

**URL Persistence**: Filter state synced to URL query params for bookmarking and sharing

### Error Boundaries

- **Timeline Rendering Protection**: ErrorBoundary wraps Timeline component
- **Custom Fallback UI**: User-friendly error message with retry button
- **Error Logging**: Console logging for debugging
- **Reset Functionality**: Try Again button resets error state
- **Accessibility**: Error alerts with proper ARIA attributes

### Performance

Performance benchmarks with large datasets:

| Dataset Size | Transformation Time | Status  |
| ------------ | ------------------- | ------- |
| 100 items    | < 2500ms            | ✅ Pass |
| 200 items    | < 3000ms            | ✅ Pass |
| 500 items    | < 5000ms            | ✅ Pass |

The vis-timeline library uses virtualization to efficiently render thousands of items.

### Accessibility

**Keyboard Navigation**:

- Full keyboard shortcut support for zoom/pan
- Escape key clears selections
- Tab navigation through controls
- Smart input field detection

**ARIA Labels**:

- All buttons have `aria-label` attributes
- Error states use `role="alert"` with `aria-live="assertive"`
- Retry buttons have descriptive labels

**Semantic HTML**:

- Proper button elements with `type` attributes
- Label elements associated with form controls
- Radio button grouping with `name` attribute
- Focus rings on interactive elements

**Screen Reader Support**:

- Descriptive text for loading/error states
- Status updates announced via ARIA live regions
- Accessible error details in collapsible sections

## User Interface

### Layout

```
┌───────────────────────────────────────────────────────────────┐
│ Campaign Timeline                                             │
│ 45 items • Current Time: Jan 15, 2024                         │
├───────────────────────────────────────────────────────────────┤
│ [Zoom In] [Zoom Out] [Fit View] [Jump to Now]  Shortcuts: +/-│
├────────────┬──────────────────────────────────────────────────┤
│  Filters   │                                                  │
│            │                                                  │
│ Event Types│           [Timeline Canvas]                      │
│ ☑ Story    │                                                  │
│ ☑ Kingdom  │     ─────────────────|────────────              │
│ ☑ Party    │        ●─────●   ●   |  ●                       │
│ ☑ World    │                      |                           │
│            │     Events  ──●──────|─●────                     │
│ Status     │                      |                           │
│ ☑ All      │     Encounters ──●───|────●──                   │
│            │                      |                           │
│ Grouping   │                  [Current]                       │
│ ○ None     │                                                  │
│ ● By Type  │                                                  │
│ ○ By Loc   │                                                  │
│            │                                                  │
└────────────┴──────────────────────────────────────────────────┘
```

### Components

#### TimelinePage (`/storage/programs/campaign_manager/packages/frontend/src/pages/TimelinePage.tsx`)

Main page component that coordinates all timeline functionality.

**Responsibilities**:

- Fetch events and encounters from GraphQL
- Manage filter state with URL sync
- Apply filters and transform data to timeline items
- Handle drag-to-reschedule with validation
- Render header, controls, filters, and timeline
- Show loading/error/empty states

**Key Features**:

- Real-time data from `useEventsByCampaign` and `useEncountersByCampaign` hooks
- Current world time integration for marker and overdue detection
- URL-persisted filter state via React Router's `useSearchParams`
- Combined loading/error states with retry functionality
- Optimistic UI updates during reschedule operations

#### Timeline (`/storage/programs/campaign_manager/packages/frontend/src/components/features/timeline/Timeline.tsx`)

Wrapper component for vis-timeline with React-friendly API.

**Props**:

- `items`: Timeline items (events and encounters)
- `groups`: Optional lane groups
- `options`: Custom vis-timeline options
- `currentTime`: Current world time marker
- `onItemMove`: Callback for drag-to-reschedule
- `onSelect`: Callback for item selection

**Features**:

- Memoized options prevent unnecessary re-renders
- ForwardRef pattern exposes imperative methods (zoomIn, zoomOut, fit, moveTo)
- Custom time marker styled with design system colors
- Editable configuration for drag-to-reschedule

#### TimelineControls (`/storage/programs/campaign_manager/packages/frontend/src/components/features/timeline/TimelineControls.tsx`)

Control panel for timeline navigation.

**Features**:

- Zoom in/out buttons (10% increments)
- Fit all items button
- Jump to current time button (conditional on currentTime)
- Keyboard shortcut registration (+/-, 0, T)
- Smart input field detection
- Event cleanup on unmount
- Memoized for performance

#### TimelineFilters (`/storage/programs/campaign_manager/packages/frontend/src/components/features/timeline/TimelineFilters.tsx`)

Filter panel for timeline items.

**Features**:

- Event type checkboxes (story, kingdom, party, world)
- Status filter checkboxes (all, completed, scheduled, overdue, resolved, unresolved)
- Lane grouping radio buttons (none, type, location)
- Minimum-one-selected validation for event types
- "All" status filter special handling
- Controlled component pattern with onChange callback
- Memoized for performance

#### ErrorBoundary (`/storage/programs/campaign_manager/packages/frontend/src/components/ErrorBoundary.tsx`)

Reusable error boundary component for catching rendering errors.

**Features**:

- Catches JavaScript errors in child components
- Custom fallback UI or function
- Error logging with boundary names
- Reset functionality to recover from errors
- Accessible error details in collapsible section
- ARIA attributes for screen readers

## Data Flow

### GraphQL Queries

**GET_EVENTS_BY_CAMPAIGN**:

```graphql
query GetEventsByCampaign($campaignId: ID!) {
  eventsByCampaign(campaignId: $campaignId) {
    id
    name
    description
    eventType
    scheduledAt
    occurredAt
    isCompleted
    locationId
  }
}
```

**GET_ENCOUNTERS_BY_CAMPAIGN**:

```graphql
query GetEncountersByCampaign($campaignId: ID!) {
  encountersByCampaign(campaignId: $campaignId) {
    id
    name
    description
    difficulty
    isResolved
    resolvedAt
    scheduledAt # Added in Stage 9
    locationId
  }
}
```

### Mutations

**UPDATE_EVENT**:

```graphql
mutation UpdateEvent($id: ID!, $data: UpdateEventInput!) {
  updateEvent(id: $id, data: $data) {
    id
    scheduledAt
    occurredAt
    isCompleted
  }
}
```

**UPDATE_ENCOUNTER**:

```graphql
mutation UpdateEncounter($id: ID!, $data: UpdateEncounterInput!) {
  updateEncounter(id: $id, data: $data) {
    id
    scheduledAt
    resolvedAt
    isResolved
  }
}
```

### Transformation Pipeline

```
useEventsByCampaign() + useEncountersByCampaign()
  ↓
filterEvents() + filterEncounters()
  ↓ (apply event type and status filters)
transformToTimelineItems()
  ↓ (convert to vis-timeline format with colors, tooltips, metadata)
applyGrouping()
  ↓ (assign lane groups based on strategy)
Timeline items ready for rendering
```

## Utilities

### timeline-transforms.ts

Core transformation functions for converting GraphQL data to vis-timeline format.

**Functions**:

- `transformEventToTimelineItem()`: Converts Event to TimelineItem
- `transformEncounterToTimelineItem()`: Converts Encounter to TimelineItem
- `transformToTimelineItems()`: Batch transformation with filtering
- `getEventColor()`: Determines color based on event status
- `getEncounterColor()`: Determines color based on encounter status

**Features**:

- Color-coded status visualization (completed, scheduled, overdue, resolved, unresolved)
- Rich tooltips with item details (name, type, status, description, difficulty)
- Editable flag prevents rescheduling completed/resolved items
- Null/undefined date handling returns null when no valid date
- Metadata fields (type, isCompleted, isResolved) for validation
- Overdue detection using optional currentWorldTime parameter

### timeline-validation.ts

Validation utilities for drag-to-reschedule functionality.

**Functions**:

- `validateScheduledTime()`: Validates new date is not in the past
- `canRescheduleItem()`: Checks if item can be rescheduled based on status

**Validation Rules**:

- Completed events cannot be rescheduled
- Resolved encounters cannot be rescheduled
- Items cannot be scheduled before current world time
- Editable flag checked for per-item control

### timeline-filters.ts

Filtering and grouping utilities for timeline items.

**Functions**:

- `filterEvents()`: Filters events by type and status
- `filterEncounters()`: Filters encounters by status
- `applyGrouping()`: Assigns lane groups based on strategy
- `parseFiltersFromURL()`: Parses filter state from URL query params
- `serializeFiltersToURL()`: Serializes filter state to URL query params

**Features**:

- Pure functions for easy testing
- O(n) filtering complexity with early returns
- Map-based grouping for O(1) lookups
- URL validation with graceful fallbacks
- Smart defaults (only serialize non-default values)

## Hooks

### useTimelineData

Composite hook that fetches and transforms timeline data.

**Note**: Replaced in Stage 11 with direct GraphQL hooks to support client-side filtering.

**Original Features**:

- Fetches both events and encounters in parallel
- Transforms combined data to timeline items
- Smart loading state (only shows loading when no cached data)
- Combined error handling
- Memoized items and refetch function
- Support for currentWorldTime parameter

### useTimelineReschedule

Hook for handling drag-to-reschedule operations.

**Parameters**:

- `currentWorldTime`: Optional current time for validation
- `onSuccess`: Callback fired on successful reschedule
- `onError`: Callback fired on reschedule failure

**Returns**:

- `reschedule()`: Async function to reschedule an item
- `loading`: Boolean indicating reschedule in progress

**Features**:

- Composes `useUpdateEvent` and `useUpdateEncounter` mutations
- Unified validation pipeline (canReschedule → validateTime → mutate)
- Type-safe with comprehensive error messages
- Memoized for optimal performance

## Backend Support

### Encounter Scheduling Field

**Migration**: `20251020015036_add_encounter_scheduled_at`

Added `scheduledAt DateTime?` field to Encounter model to support timeline visualization of unresolved encounters.

**Changes**:

- Prisma schema updated with `scheduledAt` field and index
- EncounterService.create() handles scheduledAt field
- EncounterService.update() handles scheduledAt field updates
- GraphQL type includes scheduledAt field
- CreateEncounterInput and UpdateEncounterInput accept scheduledAt

**Timeline Behavior**:

- Resolved encounters display at `resolvedAt` timestamp
- Unresolved encounters display at `scheduledAt` timestamp
- Encounters without valid date are filtered out

## Testing

### Test Coverage

**Total Tests**: 850 tests (all passing)

**Timeline-Specific Tests**:

- timeline-transforms.test.ts: 19 tests (transformation logic)
- timeline-validation.test.ts: 11 tests (validation rules)
- timeline-filters.test.ts: 51 tests (filtering and grouping)
- useTimelineReschedule.test.tsx: 8 tests (reschedule hook)
- events.test.tsx (mutations): 4 tests (updateEvent mutation)
- encounters.test.tsx (mutations): 4 tests (updateEncounter mutation)
- Timeline.test.tsx: 10 tests (component rendering)
- TimelineControls.test.tsx: 24 tests (controls and keyboard shortcuts)
- TimelineFilters.test.tsx: 28 tests (filter UI and state)
- TimelinePage.test.tsx: 20 tests (page integration)
- ErrorBoundary.test.tsx: 13 tests (error handling)

**Total Timeline Tests**: 192 tests

### Performance Tests

Performance benchmarks ensure acceptable rendering times:

- **100 nodes**: < 2500ms (includes test overhead)
- **200 nodes**: < 3000ms
- **500 nodes**: < 5000ms

Thresholds account for CI environment variability. Production performance is faster due to browser optimizations.

## Integration

### Routes

Timeline view accessible at `/timeline` (protected route requiring authentication).

**Route Configuration** (`packages/frontend/src/router/index.tsx`):

```tsx
{
  path: 'timeline',
  element: (
    <LazyPage>
      <TimelinePage />
    </LazyPage>
  ),
}
```

### State Management

**Campaign Store** (Zustand):

- `campaignId`: Used to fetch timeline items
- `currentWorldTime`: Optional field for current time marker

**URL State** (React Router):

- Filter configuration persisted to query params
- Enables bookmarking and sharing of filtered views

### GraphQL Integration

**Hooks**:

- `useEventsByCampaign()`: Fetches events for campaign
- `useEncountersByCampaign()`: Fetches encounters for campaign
- `useCurrentWorldTime()`: Fetches current world time
- `useUpdateEvent()`: Mutation for rescheduling events
- `useUpdateEncounter()`: Mutation for rescheduling encounters

**Cache Strategy**:

- `cache-and-network`: Fresh data on every view
- `refetchQueries`: After mutations to invalidate cache
- Network-only fetch policy ensures consistency

## Code Organization

```
packages/frontend/src/
├── components/
│   ├── ErrorBoundary.tsx                    # Reusable error boundary
│   ├── ErrorBoundary.test.tsx
│   └── features/timeline/
│       ├── Timeline.tsx                      # Main timeline component
│       ├── Timeline.test.tsx
│       ├── Timeline.css                      # Custom styles for marker
│       ├── TimelineControls.tsx              # Zoom/pan controls
│       ├── TimelineControls.test.tsx
│       ├── TimelineFilters.tsx               # Filter panel
│       ├── TimelineFilters.test.tsx
│       └── index.ts
├── pages/
│   ├── TimelinePage.tsx                      # Timeline page component
│   └── TimelinePage.test.tsx
├── hooks/
│   ├── useTimelineReschedule.ts              # Reschedule hook
│   └── useTimelineReschedule.test.tsx
├── services/api/
│   ├── hooks/
│   │   ├── events.ts                         # Event GraphQL hooks
│   │   ├── events.test.tsx
│   │   ├── encounters.ts                     # Encounter GraphQL hooks
│   │   └── encounters.test.tsx
│   └── mutations/
│       ├── events.ts                         # Event mutations
│       ├── events.test.tsx
│       ├── encounters.ts                     # Encounter mutations
│       └── encounters.test.tsx
└── utils/
    ├── timeline-transforms.ts                # Data transformation
    ├── timeline-transforms.test.ts
    ├── timeline-validation.ts                # Reschedule validation
    ├── timeline-validation.test.ts
    ├── timeline-filters.ts                   # Filtering and grouping
    └── timeline-filters.test.ts
```

## Future Enhancements

**Out of scope for TICKET-022**:

1. **Location Filtering**: Filter by specific locations (requires location data in queries)
2. **Date Range Filtering**: Show only events/encounters in specific date range
3. **Save Filter Presets**: Save and load common filter configurations
4. **Difficulty Range Filtering**: Filter encounters by difficulty range
5. **Combined Filters**: AND/OR logic for complex filter combinations
6. **Recurring Events**: Support for repeating events with recurrence rules
7. **Multi-Select Reschedule**: Batch reschedule multiple items at once
8. **Timeline Templates**: Save and load timeline view configurations
9. **Export**: Export timeline as image or PDF
10. **Custom Calendar Display**: Integration with World Time System custom calendars
11. **Real-Time Sync**: WebSocket-based collaborative editing
12. **Toast Notifications**: Replace alert() dialogs with toast messages
13. **Type Safety Improvements**: ExtendedTimelineItem interface to eliminate `any` types
14. **Debounced Reschedule**: Prevent rapid reschedule operations if performance issues arise

## Troubleshooting

### Timeline Not Rendering

**Symptoms**: Blank timeline area, no items visible

**Possible Causes**:

1. No campaign selected
2. No events/encounters in campaign
3. All items filtered out
4. JavaScript error (check ErrorBoundary fallback)

**Solutions**:

1. Select a campaign from campaign selector
2. Create events/encounters via GraphQL API
3. Adjust filters (click "All" status filter)
4. Check browser console for errors, use "Try Again" button

### Drag-to-Reschedule Not Working

**Symptoms**: Cannot drag items, drag reverts immediately

**Possible Causes**:

1. Item is completed/resolved (not editable)
2. Trying to schedule in the past
3. GraphQL mutation failing

**Solutions**:

1. Only uncompleted events and unresolved encounters can be rescheduled
2. Ensure new date is after current world time
3. Check network tab for mutation errors, verify backend connectivity

### Performance Issues

**Symptoms**: Slow rendering, laggy interactions

**Possible Causes**:

1. Extremely large dataset (>1000 items)
2. Browser performance constraints
3. Excessive re-renders

**Solutions**:

1. Use filters to reduce visible items
2. Close other browser tabs, check system resources
3. Check for console warnings about re-renders

### Keyboard Shortcuts Not Working

**Symptoms**: +/-, 0, T keys don't zoom/pan

**Possible Causes**:

1. Focus in text input field
2. Browser keyboard shortcuts override
3. Keyboard event listener not registered

**Solutions**:

1. Click timeline canvas to remove focus from inputs
2. Use button controls instead of keyboard
3. Refresh page to re-register event listeners

## Related Features

- **World Time System** (`docs/features/world-time-system.md`): Provides current world time for marker and overdue detection
- **Event System** (`packages/api/src/graphql/types/event.type.ts`): Backend model for events
- **Encounter System** (`packages/api/src/graphql/types/encounter.type.ts`): Backend model for encounters

## References

- **vis-timeline Documentation**: https://visjs.github.io/vis-timeline/docs/timeline/
- **React vis-timeline**: https://www.npmjs.com/package/react-vis-timeline
- **Implementation Ticket**: `plan/TICKET-022.md`
- **Implementation Plan**: `plan/TICKET-022-implementation-plan.md`
- **CLAUDE.md Timeline Section**: Line [to be added]
