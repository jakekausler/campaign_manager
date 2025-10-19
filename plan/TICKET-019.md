# TICKET-019: Map View with MapLibre

## Status

- [ ] Completed
- **Commits**: 9d4a967 (implementation plan), 069050c (Stage 1), 79d7a03 (Stage 2)

## Description

Implement interactive map view using MapLibre GL JS with GeoJSON layers, viewport management, and entity visualization.

## Scope of Work

1. Install and configure MapLibre GL JS
2. Create Map component with viewport state
3. Implement GeoJSON layer rendering
4. Add location/region visualization
5. Settlement layer rendering (distinct markers at Location coordinates)
6. Structure layer visualization
7. Create map controls (zoom, pan, reset)
8. Add entity popups/tooltips
9. Popups showing Settlement details (name, level, kingdom, typed variables)
10. Popups showing Structure details (name, type, level, typed variables)
11. Implement layer toggles (by type, availability)
12. Layer toggles for Settlements and Structures
13. Add time scrubber for viewing history
14. Create loading states and error handling

## Acceptance Criteria

- [ ] Map renders with base layer
- [ ] Locations display as markers
- [ ] Regions display as polygons
- [ ] Settlement layer renders with distinct markers
- [ ] Structure layer renders correctly
- [ ] Can pan and zoom
- [ ] Clicking entity shows details
- [ ] Settlement popups show level and typed variables
- [ ] Structure popups show type, level, and typed variables
- [ ] Layer toggles work
- [ ] Layer toggles work for Settlements and Structures
- [ ] Time scrubber changes visible entities
- [ ] Performance good with 1000+ entities

## Dependencies

- Requires: TICKET-008, TICKET-018

## Estimated Effort

4-5 days

## Implementation Notes

### Stage 1: Install Dependencies and Basic Setup (Commit: 069050c)

**What was implemented:**

- Installed maplibre-gl (^5.9.0) and @types/maplibre-gl for TypeScript support
- Created basic Map component in `packages/frontend/src/components/features/map/Map.tsx`
- Map component includes:
  - Proper initialization with useRef to persist map instance
  - Navigation controls (zoom buttons)
  - Clean cleanup on unmount to prevent memory leaks
  - Empty map style (basemap tiles deferred to later stages)
  - TypeScript interfaces with JSDoc documentation
  - data-testid attribute for future testing

**Design decisions:**

- Map CSS imported at component level rather than globally for better encapsulation
- Map initializes once on mount and doesn't re-initialize when props change (useEffect with empty dependency array)
- Fixed React Hook dependency array issue flagged by Code Reviewer (changed from `[initialCenter, initialZoom]` to `[]`)
- Added comment explaining empty map style is intentional for Stage 1
- Deferred optional geocoder package installation (not needed for MVP)

**Code quality:**

- All TypeScript type-check and ESLint checks pass
- Code reviewed by specialized Code Reviewer subagent
- Follows project conventions (barrel exports, component structure)
- Proper use of React hooks and cleanup patterns

### Stage 2: Create Base Map Component with Viewport State (Commit: 79d7a03)

**What was implemented:**

- Enhanced Map component with viewport state management:
  - Viewport state tracks center coordinates, zoom level, and bounds in real-time
  - React state with `useState` and `useCallback` for efficient updates
  - Event listeners for `moveend` and `zoomend` events update viewport state
  - Optional `onViewportChange` callback prop for parent components
  - Exported `ViewportState` TypeScript interface for type safety

- Reset viewport functionality:
  - Button positioned top-left with accessible styling
  - Smooth `flyTo` animation (1 second duration) returns to initial viewport
  - Stores initial viewport in `useRef` for reset
  - Proper ARIA label for accessibility

- Development debugging:
  - Debug panel in bottom-left showing current viewport (development only)
  - Uses `import.meta.env.DEV` for Vite environment detection

- MapPage component (`packages/frontend/src/pages/MapPage.tsx`):
  - Full-screen responsive layout with header, map content, footer
  - Protected route at `/map` with lazy loading
  - Displays current viewport state in footer
  - Clean semantic HTML with Tailwind CSS styling
  - Proper state initialization to match Map component defaults

- Router integration:
  - Added `/map` route with `ProtectedRoute` wrapper
  - Lazy-loaded MapPage component for code splitting
  - Exported from pages barrel export
  - Follows existing router patterns

- Comprehensive testing:
  - 23 unit tests covering all Map component functionality
  - Tests for rendering, initialization, viewport management, reset, cleanup, edge cases
  - MapLibre GL JS properly mocked for isolated testing
  - Tests verify accessibility, state updates, and lifecycle management
  - 100% test coverage for Map component

**Design decisions:**

- Used local React state rather than Zustand for viewport management:
  - Viewport state is component-specific, not global application state
  - Parent components can opt-in via `onViewportChange` callback if needed
  - Simpler and more appropriate for this use case

- `useCallback` for `updateViewport` and `resetViewport`:
  - Ensures stable function references to prevent unnecessary re-renders
  - Safe to omit from useEffect dependencies with explanatory comment

- MapPage initializes viewport state to match Map defaults:
  - Eliminates null checks and potential rendering issues
  - Footer always shows viewport info (no conditional rendering)

- Development-only debug panel:
  - Uses `import.meta.env.DEV` instead of `process.env.NODE_ENV` for Vite
  - Helpful for debugging during development without cluttering production

- Reset button placement:
  - Top-left position avoids conflict with MapLibre's navigation controls (top-right)
  - Tailwind styling matches project design system
  - Focus ring for keyboard accessibility

**Code quality:**

- All TypeScript type-check and ESLint checks pass
- Code reviewed by specialized Code Reviewer subagent with all feedback addressed:
  - Removed unused `LngLatBounds` import
  - Fixed Vite environment check (`import.meta.env.DEV`)
  - Added explanatory comment for ESLint disable
  - Simplified MapPage component (direct `setViewport` usage)
- Import order fixed per project ESLint rules
- Follows project conventions (barrel exports, component structure, lazy loading)
- Proper use of React hooks and cleanup patterns
- All 23 tests passing with comprehensive coverage
