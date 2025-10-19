# TICKET-019 Implementation Plan: Map View with MapLibre

This plan breaks down the implementation of an interactive map view with MapLibre GL JS into manageable stages.

## Stage 1: Install Dependencies and Basic Setup

**Goal**: Set up MapLibre GL JS and related dependencies

**Success Criteria**:

- MapLibre GL JS installed and configured
- TypeScript types available
- Basic CSS imported

**Tasks**:

- [x] Install `maplibre-gl` package
- [x] Install `@types/maplibre-gl` for TypeScript support
- [ ] Install `@maplibre/maplibre-gl-geocoder` for search functionality (optional - deferred)
- [x] Create basic Map component structure in `packages/frontend/src/components/features/map/`
- [x] Import MapLibre CSS in component or global styles

**Status**: Completed (Commit: 069050c)

---

## Stage 2: Create Base Map Component with Viewport State

**Goal**: Implement basic map rendering with viewport management

**Success Criteria**:

- Map renders with a base layer
- Viewport state (zoom, center, bounds) managed via React state or Zustand
- Map controls work (zoom, pan)
- Proper cleanup on unmount

**Tasks**:

- [x] Create `Map.tsx` component with ref to map container
- [x] Initialize MapLibre map instance with basic configuration
- [x] Set up viewport state management (consider Zustand slice or local state)
- [x] Implement map cleanup on component unmount
- [x] Add basic zoom and pan controls
- [x] Add reset viewport button
- [x] Style map container with proper dimensions
- [x] Create MapPage.tsx in `packages/frontend/src/pages/`
- [x] Add route for map page in router

**Tests**:

- [x] Map component renders without crashing
- [x] Map initializes with correct viewport
- [x] Cleanup properly disposes of map instance

**Status**: Completed (Commit: 79d7a03)

---

## Stage 3: GeoJSON Layer Infrastructure

**Goal**: Set up infrastructure for rendering GeoJSON data on the map

**Success Criteria**:

- Can add/remove GeoJSON sources and layers
- Layer visibility can be toggled
- Proper TypeScript types for GeoJSON features

**Tasks**:

- [x] Create utility functions for GeoJSON feature creation
- [x] Create hook or service for managing map layers (`useMapLayers` or similar)
- [x] Implement layer add/remove functions
- [x] Create TypeScript types for GeoJSON features (Location, Settlement, Structure)
- [x] Add layer visibility toggle functionality
- [x] Handle empty/null geometry gracefully

**Tests**:

- [x] Can add GeoJSON source to map
- [x] Can toggle layer visibility
- [x] Handles empty data without errors

**Status**: Completed (Commit: 6324d6c)

---

## Stage 4: Location and Region Visualization

**Goal**: Display Location entities (points and polygons) on the map

**Success Criteria**:

- Locations with type="point" display as markers
- Locations with type="region" display as polygons
- Can query locations by world from GraphQL
- Locations render with appropriate styling

**Tasks**:

- [x] Create GraphQL query for fetching locations by world (check if exists, if not create)
- [x] Create `useLocationsByWorld` hook (follow pattern from settlements/structures hooks)
- [x] Convert PostGIS geometry to GeoJSON format (may need backend changes)
- [x] Create point marker layer for Location type="point"
- [x] Create polygon layer for Location type="region"
- [x] Style markers and polygons distinctly
- [ ] Add location name labels (optional - deferred)

**Backend Tasks (if needed)**:

- [x] Add `geojson` field to Location GraphQL type (computed from PostGIS `geom`)
- [x] Implement field resolver to convert geometry to GeoJSON
- [x] Created LocationGeometryDataLoader to prevent N+1 queries

**Tests**:

- [x] Locations query returns correct data
- [x] Point locations render as markers
- [x] Region locations render as polygons
- [x] Handles locations without geometry

**Status**: Completed (Commit: e89ca81)

---

## Stage 5: Settlement Layer Rendering

**Goal**: Display Settlements on the map at their Location coordinates

**Success Criteria**:

- Settlements appear as distinct markers at Location coordinates
- Settlement markers are visually distinct from plain Location markers
- Can query settlements with location data

**Tasks**:

- [x] Extend existing `useSettlementsByKingdom` or create `useSettlementsForMap` hook
- [x] Ensure Settlement query includes Location relationship with geometry
- [x] Create Settlement GeoJSON features from Settlement + Location data
- [x] Create Settlement marker layer with distinct styling (different color/icon)
- [x] Display settlement level as marker size or icon variant
- [x] Handle settlements without location gracefully

**Tests**:

- [x] Settlement query includes location data
- [x] Settlements render at correct coordinates
- [x] Settlement markers are distinct from location markers
- [x] Settlement level affects visual appearance

**Status**: Completed (Commit: 58f6550)

---

## Stage 6: Structure Layer Visualization

**Goal**: Display Structures on the map

**Success Criteria**:

- Structures appear on map
- Structure markers vary by type
- Structure level affects visualization

**Tasks**:

- [x] Create `useStructuresForMap` query/hook (include Location relationship)
- [x] Create Structure GeoJSON features from Structure + Location/Settlement data
- [x] Create Structure marker layer with type-based styling
- [x] Implement icon or color variation by structure type
- [x] Display structure level visually (size, opacity, or label)
- [x] Handle structures without location

**Tests**:

- [x] Structure query returns correct data
- [x] Structures render on map
- [x] Structure type affects appearance
- [x] Structure level affects appearance

**Status**: Completed (Commit: c42f706)

---

## Stage 7: Entity Popups and Tooltips

**Goal**: Show detailed information when clicking on map entities

**Success Criteria**:

- Clicking Location shows popup with name, description
- Clicking Settlement shows name, level, kingdom, typed variables
- Clicking Structure shows name, type, level, typed variables
- Popups close properly
- Popups are styled consistently

**Tasks**:

- [ ] Create popup component or use MapLibre Popup API
- [ ] Implement click handlers for Location layer
- [ ] Implement click handlers for Settlement layer
- [ ] Implement click handlers for Structure layer
- [ ] Create LocationPopup component
- [ ] Create SettlementPopup component showing level and typed variables
- [ ] Create StructurePopup component showing type, level, and typed variables
- [ ] Style popups with Tailwind CSS
- [ ] Handle popup state (current selected entity)
- [ ] Close popup when clicking elsewhere on map

**Tests**:

- [ ] Clicking entity opens popup
- [ ] Popup shows correct data
- [ ] Popup closes when clicking elsewhere
- [ ] Multiple entity types can be selected

**Status**: Not Started

---

## Stage 8: Layer Toggle Controls

**Goal**: Allow users to toggle visibility of different entity types

**Success Criteria**:

- UI controls for toggling Locations, Settlements, Structures
- Toggling updates layer visibility immediately
- Toggle state persists during session (optional: localStorage)

**Tasks**:

- [ ] Create LayerControls component
- [ ] Add checkboxes/switches for each layer type (Location points, Location regions, Settlements, Structures)
- [ ] Connect toggles to layer visibility state
- [ ] Update map layer visibility when state changes
- [ ] Style controls panel (position, appearance)
- [ ] Optionally persist toggle state to localStorage

**Tests**:

- [ ] Layer toggles work correctly
- [ ] Toggling updates map immediately
- [ ] All layers can be toggled independently

**Status**: Not Started

---

## Stage 9: Time Scrubber for Historical View

**Goal**: Allow viewing entities at different points in world time

**Success Criteria**:

- Time scrubber UI shows current world time
- Can scrub through time to see historical state
- Entities appear/disappear based on time
- Performance is acceptable

**Tasks**:

- [ ] Create TimeScrubber component (slider or timeline)
- [ ] Integrate with WorldTime system (query current world time)
- [ ] Filter entities by `createdAt`, `deletedAt`, `archivedAt` based on selected time
- [ ] Update map layers when time changes
- [ ] Show current selected time in UI
- [ ] Add reset to "current time" button
- [ ] Consider caching historical queries for performance

**Backend Considerations**:

- [ ] Ensure GraphQL queries support filtering by time range
- [ ] May need new query arguments for "asOfTime" parameter

**Tests**:

- [ ] Time scrubber updates selected time
- [ ] Entities filter correctly by time
- [ ] Can reset to current time
- [ ] Performance is acceptable with 1000+ entities

**Status**: Not Started

---

## Stage 10: Loading States and Error Handling

**Goal**: Provide good UX during data loading and handle errors gracefully

**Success Criteria**:

- Loading spinner shown while fetching data
- Error messages displayed if queries fail
- Empty state shown when no entities exist
- Map remains interactive during loading

**Tasks**:

- [ ] Create LoadingSpinner component for map
- [ ] Create ErrorMessage component
- [ ] Create EmptyState component ("No locations to display")
- [ ] Handle loading state for all GraphQL queries
- [ ] Handle error state for all GraphQL queries
- [ ] Show appropriate message for empty data
- [ ] Ensure map doesn't break on error
- [ ] Add retry mechanism for failed queries (optional)

**Tests**:

- [ ] Loading state displays correctly
- [ ] Error state displays correctly
- [ ] Empty state displays correctly
- [ ] Map recovers from errors gracefully

**Status**: Not Started

---

## Stage 11: Performance Optimization

**Goal**: Ensure map performs well with 1000+ entities

**Success Criteria**:

- Map renders 1000+ entities smoothly
- Pan/zoom is responsive
- Layer toggles are instant
- Memory usage is reasonable

**Tasks**:

- [ ] Implement clustering for dense point data (if needed)
- [ ] Optimize GeoJSON feature generation
- [ ] Consider lazy loading or viewport-based filtering
- [ ] Profile component re-renders and optimize
- [ ] Use React.memo for expensive components
- [ ] Optimize popup rendering
- [ ] Add virtualization for large datasets (if needed)
- [ ] Test with realistic data volumes

**Tests**:

- [ ] Performance benchmark with 1000+ entities
- [ ] FPS remains >30 during pan/zoom
- [ ] Memory usage stays reasonable
- [ ] No memory leaks over extended use

**Status**: Not Started

---

## Stage 12: Testing and Documentation

**Goal**: Comprehensive tests and documentation

**Success Criteria**:

- Unit tests for map utilities and hooks
- Integration tests for map interactions
- Component tests for Map, popups, controls
- README documentation for map feature

**Tasks**:

- [ ] Write unit tests for GeoJSON utilities
- [ ] Write tests for map hooks (useMapLayers, useLocationsByWorld, etc.)
- [ ] Write component tests for Map component
- [ ] Write component tests for popup components
- [ ] Write component tests for LayerControls
- [ ] Write component tests for TimeScrubber
- [ ] Create README.md in `packages/frontend/src/components/features/map/`
- [ ] Update main frontend README with map feature
- [ ] Add inline code documentation
- [ ] Create usage examples

**Tests**:

- [ ] All tests pass
- [ ] Code coverage >80% for map feature
- [ ] Integration tests cover main user flows

**Status**: Not Started

---

## Stage 13: Final Integration and Polish

**Goal**: Polish UI, fix bugs, and integrate with overall app

**Success Criteria**:

- Map page accessible from navigation
- Map styling consistent with app theme
- All acceptance criteria met
- No known bugs

**Tasks**:

- [ ] Add map link to navigation/menu
- [ ] Ensure map page has proper layout (header, sidebar if applicable)
- [ ] Polish map controls styling
- [ ] Polish popup styling
- [ ] Add loading states for initial page load
- [ ] Test all user flows end-to-end
- [ ] Fix any discovered bugs
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsiveness check (if applicable)
- [ ] Accessibility audit (keyboard navigation, screen readers)

**Tests**:

- [ ] End-to-end test of full map workflow
- [ ] All acceptance criteria verified

**Status**: Not Started

---

## Notes

- MapLibre GL JS is an open-source fork of Mapbox GL JS, compatible with Mapbox styles
- Consider using OpenStreetMap or other free basemap tiles
- PostGIS geometry needs conversion to GeoJSON (may require backend changes)
- World coordinates use SRID 3857 (Web Mercator projection)
- GraphQL queries should be optimized to fetch only needed fields
- Layer rendering order matters (regions -> points -> settlements -> structures)
- Consider implementing debouncing for time scrubber to avoid excessive queries

## Dependencies

- Backend TICKET-008 (Locations and Regions) must be complete
- Backend TICKET-018 (State Management & GraphQL Client) must be complete
- May need backend enhancements for geometry-to-GeoJSON conversion

## Estimated Total Time

4-5 days across 13 stages
