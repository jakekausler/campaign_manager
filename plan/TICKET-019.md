# TICKET-019: Map View with MapLibre

## Status

- [ ] Completed
- **Commits**: 9d4a967 (implementation plan), 069050c (Stage 1), 79d7a03 (Stage 2), 6324d6c (Stage 3), e89ca81 (Stage 4)

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

### Stage 3: GeoJSON Layer Infrastructure (Commit: 6324d6c)

**What was implemented:**

- TypeScript type system for GeoJSON features (`types.ts`):
  - EntityType union ('location-point', 'location-region', 'settlement', 'structure')
  - Feature property interfaces for each entity type with discriminated unions
  - GeoJSON Feature types (LocationPointFeature, LocationRegionFeature, SettlementFeature, StructureFeature)
  - LayerConfig and LayerVisibility interfaces for map layer management
  - Proper TypeScript strict mode compliance with exported type-only imports

- GeoJSON utility functions (`geojson-utils.ts`):
  - createLocationPointFeature() - converts location data to GeoJSON Point feature
  - createLocationRegionFeature() - converts location data to GeoJSON Polygon feature
  - createSettlementFeature() - converts settlement + location to GeoJSON Point feature
  - createStructureFeature() - converts structure + location to GeoJSON Point feature
  - filterValidFeatures() - removes null features from arrays using type guards
  - Comprehensive validation: checks for null, undefined, NaN, Infinity coordinates
  - Polygon ring validation: ensures minimum 3 coordinates per ring
  - Returns null for invalid data to enable graceful error handling

- Map layer management hook (`useMapLayers.ts`):
  - addSource/updateSource() - manage GeoJSON data sources on map
  - addLayer/removeLayer() - manage MapLibre layers with entity-specific styling
  - toggleLayerVisibility/setLayerVisible() - control layer visibility
  - addDataLayer/updateDataLayer() - convenience methods for source + layer
  - Layer style configuration constants (colors, sizes, stroke widths):
    - location-point: blue circle (6px)
    - location-region: blue fill with opacity
    - settlement: green circle (8px)
    - structure: amber circle (6px)
  - React state management with useCallback for stable function references
  - useEffect to sync visibility state changes to MapLibre map
  - Proper handling of null map instance

- Comprehensive test coverage (128 test cases):
  - geojson-utils.test.ts (84 tests):
    - Valid feature creation for all entity types
    - Edge cases: NaN, Infinity, null, undefined, zero coordinates
    - Polygon validation: empty rings, too few coordinates, holes
    - Feature filtering with type guards
    - 100% coverage of utility functions
  - useMapLayers.test.ts (44 tests):
    - Source and layer CRUD operations
    - Visibility toggling and state management
    - MapLibre GL mock with realistic map behavior
    - Async state updates with renderHook + act
    - All hook functions and edge cases covered

- Updated barrel exports (`index.ts`):
  - Exported all new types, utilities, and hooks
  - Follows existing project patterns for type-only exports

- Dependencies:
  - Added @types/geojson (2.0.0) for proper GeoJSON TypeScript types

**Design decisions:**

- Null return pattern for invalid data:
  - Allows callers to decide how to handle errors (filter, log, skip)
  - More flexible than throwing exceptions
  - Enables bulk processing with filterValidFeatures()

- Coordinate validation prevents rendering bugs:
  - Checks for NaN/Infinity prevent MapLibre crashes
  - Checks for null/undefined prevent type errors
  - Zero coordinates are valid (equator/prime meridian)

- Layer visibility managed in React state:
  - Enables UI integration (checkboxes, toggles)
  - useEffect syncs state to MapLibre map
  - Separation of concerns (React state vs. MapLibre state)

- Entity-specific styling configuration:
  - Extracted to LAYER_STYLES constant for maintainability
  - Distinct colors for each entity type (blue/green/amber)
  - Settlement circles larger (8px) than structures (6px) for hierarchy

- TypeScript discriminated unions:
  - Type-safe feature properties with EntityType discriminator
  - Enables exhaustive type checking in switch statements
  - Prevents mixing incompatible feature types

- Comprehensive validation in factories:
  - Polygon rings validated for minimum 3 coordinates
  - Prevents MapLibre errors from malformed geometry
  - Graceful degradation for missing location data

**Code quality:**

- All TypeScript type-check and ESLint checks pass (0 errors)
- 11 ESLint warnings about `any` types in tests (acceptable for MapLibre mocks)
- Code reviewed by specialized Code Reviewer subagent with approval
- TypeScript Fixer subagent resolved all type errors:
  - Removed extends GeoJsonProperties (can't extend type aliases)
  - Added GeoJSONSource type imports and assertions
  - Fixed import ordering per project ESLint rules
  - Added `as any` for MapLibre layer config (complex type unions)
- Follows project conventions:
  - Barrel exports with type-only imports
  - Vitest testing patterns with @testing-library/react
  - React hook patterns with useCallback and proper dependencies
  - JSDoc documentation for all public functions
- 128 test cases with comprehensive edge case coverage
- No security vulnerabilities detected (validated by Code Reviewer)

### Stage 4: Location and Region Visualization (Commit: e89ca81)

**What was implemented:**

Backend:

- Added `geojson` field to Location GraphQL type using GeoJSONScalar
- Created LocationGeometryDataLoader to batch geometry fetches (prevents N+1 queries)
- Implemented field resolver in LocationResolver using DataLoader pattern
- Registered LocationGeometryDataLoader in GraphQL module and context
- Uses Prisma $queryRaw to efficiently fetch PostGIS geometry for multiple locations
- Converts WKB buffers to GeoJSON using SpatialService.wkbToGeoJSON()
- NestJS Logger for error handling instead of console.error

Frontend:

- Created useLocationsByWorld GraphQL hook following settlement/structure patterns
- Implemented GET_LOCATIONS_BY_WORLD and GET_LOCATION_DETAILS queries
- Created useLocationLayers hook for managing location layers on map
- Comprehensive coordinate validation (Number.isFinite checks for both Point and Polygon)
- Validates GeoJSON structure before rendering to prevent runtime errors
- Separate rendering for location-point and location-region layers
- Integrated into Map component with optional worldId prop
- Updated MapPage to pass worldId (currently placeholder)
- Added 11 comprehensive unit tests for useLocationLayers hook

**Design decisions:**

- DataLoader batching pattern:
  - Prevents N+1 query problem when loading multiple locations
  - Batches up to 100 location IDs per query
  - Per-request caching for performance
  - Graceful error handling returns nulls instead of throwing

- Coordinate validation:
  - Point coordinates: checks for finite numbers before rendering
  - Polygon coordinates: validates all rings and coordinate pairs
  - Prevents MapLibre crashes from NaN, Infinity, or malformed data
  - Returns null for invalid geometries to enable graceful degradation

- GraphQL integration:
  - Field resolver uses DataLoader from context
  - Follows existing patterns (StructureDataLoader)
  - No authorization needed for geometry data (public info)
  - Logger service for production-ready error logging

- Frontend hook architecture:
  - useLocationsByWorld follows settlement/structure hook patterns
  - useLocationLayers manages layer lifecycle in useEffect
  - Filters locations by type (point vs region) before feature creation
  - Uses existing geojson-utils factory functions
  - Properly manages useEffect dependencies

**Code quality:**

- All TypeScript type-check and ESLint checks pass (0 errors)
- Code reviewed by specialized Code Reviewer subagent with approval
- All critical issues addressed:
  - N+1 query problem solved with DataLoader
  - Unsafe type assertions fixed with comprehensive validation
  - Console.error replaced with NestJS Logger
- 11 new tests for useLocationLayers (all passing)
- Updated Map component tests to use Apollo Client context
- 204/207 total tests passing (3 pre-existing failures unrelated to this stage)
- No security vulnerabilities detected
