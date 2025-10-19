# Map Feature

Interactive map view for visualizing campaign worlds, locations, settlements, and structures using MapLibre GL JS.

## Overview

The map feature provides a full-featured interactive map with:

- **GeoJSON Layer Rendering**: Displays locations (points and regions), settlements, and structures
- **Entity Popups**: Click entities to view detailed information with typed variables
- **Layer Controls**: Toggle visibility of different entity types
- **Time Scrubber**: View historical state of the world at different points in time
- **Loading & Error States**: Graceful handling of data loading and errors
- **Performance Optimized**: Handles 1000+ entities smoothly with memoization

## Components

### Map Component

Main map component that orchestrates all map functionality.

**Props:**

```typescript
interface MapProps {
  initialCenter?: [number, number]; // Default: [0, 0]
  initialZoom?: number; // Default: 2
  className?: string; // Optional CSS class
  onViewportChange?: (viewport: ViewportState) => void;
  worldId?: string; // For loading locations
  kingdomId?: string; // For loading settlements
  campaignId?: string; // For time scrubber
}
```

**Usage:**

```tsx
import { Map } from '@/components/features/map';

function MyMapPage() {
  return (
    <Map
      initialCenter={[0, 0]}
      initialZoom={4}
      worldId="world-123"
      kingdomId="kingdom-456"
      campaignId="campaign-789"
    />
  );
}
```

### LayerControls Component

UI panel with checkboxes for toggling layer visibility.

**Features:**

- Toggle Location Points (blue)
- Toggle Location Regions (blue)
- Toggle Settlements (green)
- Toggle Structures (amber)
- Color indicators matching layer styles
- Full keyboard accessibility

### TimeScrubber Component

Slider control for viewing map state at different points in world time.

**Features:**

- Displays current world time
- Shows selected viewing time
- Slider for time selection (0-100% of campaign duration)
- Reset button to return to current time
- Historical state indicator (amber warning when viewing past)

**Usage:**

```tsx
<TimeScrubber
  currentTime={new Date('2024-01-01')}
  selectedTime={selectedTime}
  onTimeChange={setSelectedTime}
/>
```

### Entity Popup Components

Three specialized popup components for different entity types:

- **LocationPopupContent**: Name, type (Point/Region), description, coordinates
- **SettlementPopupContent**: Name, level, kingdom ID, typed variables, coordinates
- **StructurePopupContent**: Name, type, level, settlement ID, typed variables, coordinates

All popups:

- Display typed variables in a separate section
- Show coordinates for reference
- Styled consistently with Tailwind CSS
- Minimum width of 200px

### State Components

**LoadingSpinner**: Overlay with animated spinner shown during data loading

**ErrorMessage**: Error display with icon, message, and optional retry button

**EmptyState**: Shown when no data is available after successful loading

All three components follow accessibility best practices with proper ARIA attributes.

## Hooks

### useMapLayers

Core hook for managing MapLibre layers and visibility.

**API:**

```typescript
const {
  layerVisibility, // Current visibility state
  toggleLayerVisibility, // Toggle function
  addDataLayer, // Add source + layer
  updateDataLayer, // Update source data
  setLayerVisible, // Set explicit visibility
} = useMapLayers(mapInstance);
```

**Features:**

- Manages GeoJSON sources and layers
- Tracks visibility state in React
- Provides layer styling configuration (colors, sizes, strokes)
- Syncs React state to MapLibre map via useEffect

### useLocationLayers

Fetches and renders location layers on the map.

**Usage:**

```typescript
const { loading, error, locationCount } = useLocationLayers(mapInstance, worldId, filterTime);
```

**Features:**

- Fetches locations via GraphQL with `useLocationsByWorld` hook
- Converts PostGIS geometry to GeoJSON
- Validates coordinates (Number.isFinite checks)
- Filters by time if provided
- Renders separate layers for points and regions
- Returns loading/error states and count

### useSettlementLayers

Fetches and renders settlement markers on the map.

**Usage:**

```typescript
const { loading, error, settlementCount } = useSettlementLayers(mapInstance, kingdomId, filterTime);
```

**Features:**

- Fetches settlements with location data via GraphQL
- Creates settlement GeoJSON features at location coordinates
- Validates coordinates and handles missing locations
- Filters by time if provided
- Distinct green markers (8px circles)
- Returns loading/error states and count

### useStructureLayers

Fetches and renders structure markers on the map.

**Usage:**

```typescript
const { loading, error, structureCount } = useStructureLayers(mapInstance, kingdomId, filterTime);
```

**Features:**

- Fetches structures with settlement + location data via GraphQL
- Renders structures at parent settlement's location
- Validates coordinates and GeoJSON type (Point only)
- Filters by time if provided
- Distinct amber markers (6px circles)
- Returns loading/error states and count

### useEntityPopup

Manages popup lifecycle with React portal rendering.

**Usage:**

```typescript
const { showPopup, closePopup } = useEntityPopup(mapInstance);

// Show popup for an entity
showPopup({
  type: 'settlement',
  data: {
    id: 'settlement-123',
    name: 'Winterfell',
    level: 3,
    kingdomId: 'kingdom-456',
    typedVariables: { population: 5000 },
    coordinates: [0, 0],
  },
});

// Close popup
closePopup();
```

**Features:**

- Creates React root for popup content
- Renders appropriate popup component based on entity type
- Proper cleanup (unmounts React root and removes MapLibre popup)
- Closes existing popup before opening new one
- Configuration: closeButton=true, closeOnClick=true, maxWidth=400px

### useCurrentWorldTime

GraphQL hook for fetching current world time for a campaign.

**Usage:**

```typescript
const { data: currentTime, loading, error } = useCurrentWorldTime(campaignId);
```

## Utilities

### GeoJSON Factory Functions

**createLocationPointFeature(location)**

- Converts location data to GeoJSON Point feature
- Validates coordinates (no NaN, Infinity, null, undefined)
- Returns null for invalid data

**createLocationRegionFeature(location)**

- Converts location data to GeoJSON Polygon feature
- Validates polygon rings (minimum 3 coordinates per ring)
- Returns null for invalid data

**createSettlementFeature(settlement, location)**

- Converts settlement + location to GeoJSON Point feature
- Includes settlement properties (id, name, level, kingdomId, typedVariables)
- Returns null if location or coordinates invalid

**createStructureFeature(structure, settlement)**

- Converts structure + settlement to GeoJSON Point feature
- Uses settlement's location coordinates
- Includes structure properties (id, name, type, level, settlementId, typedVariables)
- Returns null if settlement or location invalid

**filterValidFeatures(features)**

- Filters out null features from array
- Uses type guards for type safety
- Returns array of valid GeoJSON features

### Time Filtering

**filterByTime<T>(entities, time)**

- Generic function for filtering entities by time
- Checks `createdAt`, `deletedAt`, and `archivedAt` timestamps
- `null` time returns only active entities (not deleted or archived)
- Entity hidden at exact deletion/archival time
- Works with Date objects and ISO string timestamps

**Usage:**

```typescript
const activeSettlements = filterByTime(settlements, null); // Current active only
const historicalSettlements = filterByTime(settlements, new Date('2024-01-01'));
```

## TypeScript Types

### GeoJSON Feature Types

```typescript
type EntityType = 'location-point' | 'location-region' | 'settlement' | 'structure';

interface LocationPointProperties {
  type: 'location-point';
  id: string;
  name: string;
  description?: string;
}

interface LocationRegionProperties {
  type: 'location-region';
  id: string;
  name: string;
  description?: string;
}

interface SettlementProperties {
  type: 'settlement';
  id: string;
  name: string;
  level: number;
  kingdomId: string;
  typedVariables?: Record<string, unknown>;
}

interface StructureProperties {
  type: 'structure';
  id: string;
  name: string;
  structureType: string;
  level: number;
  settlementId: string;
  typedVariables?: Record<string, unknown>;
}

type LocationPointFeature = Feature<Point, LocationPointProperties>;
type LocationRegionFeature = Feature<Polygon, LocationRegionProperties>;
type SettlementFeature = Feature<Point, SettlementProperties>;
type StructureFeature = Feature<Point, StructureProperties>;
```

### Popup Data Types

```typescript
interface LocationPopupData {
  type: 'location';
  data: {
    id: string;
    name: string;
    locationType: 'point' | 'region';
    description?: string;
    coordinates: [number, number];
  };
}

interface SettlementPopupData {
  type: 'settlement';
  data: {
    id: string;
    name: string;
    level: number;
    kingdomId: string;
    typedVariables?: Record<string, unknown>;
    coordinates: [number, number];
  };
}

interface StructurePopupData {
  type: 'structure';
  data: {
    id: string;
    name: string;
    structureType: string;
    level: number;
    settlementId: string;
    typedVariables?: Record<string, unknown>;
    coordinates: [number, number];
  };
}

type PopupData = LocationPopupData | SettlementPopupData | StructurePopupData;
```

### Layer Configuration

```typescript
interface LayerConfig {
  id: string;
  color: string;
  size: number;
  label: string;
}

type LayerVisibility = Record<EntityType, boolean>;
```

## Architecture Decisions

### Coordinate Validation

All GeoJSON factory functions validate coordinates to prevent MapLibre crashes:

- Checks for `NaN`, `Infinity`, `null`, `undefined`
- Zero coordinates are valid (equator/prime meridian)
- Polygon rings validated for minimum 3 coordinates
- Returns `null` for invalid data to enable graceful degradation

### Layer Visibility Management

Layer visibility is managed in React state (via `useMapLayers` hook):

- Enables UI integration (checkboxes, toggles)
- `useEffect` syncs state changes to MapLibre map
- Separation of concerns (React state vs. MapLibre state)

### Time Filtering Strategy

Client-side filtering approach:

- No backend changes required
- Filters entities before rendering
- `useMemo` for performance optimization
- Acceptable for MVP (1000+ entities)
- Future optimization: backend filtering for larger datasets

### Performance Optimizations

**useMemo for expensive computations:**

- GeoJSON feature generation memoized in all layer hooks
- Dependencies: entities, loading, error, filterTime
- Prevents redundant filtering, mapping, and validation

**React.memo for presentational components:**

- All pure UI components wrapped with React.memo
- Prevents cascading re-renders when parent Map updates
- Particularly beneficial with 1000+ entities on map

### Popup Rendering

Uses React portal rendering:

- MapLibre Popup API accepts DOM elements via `setDOMContent()`
- Creates React root on popup container div
- Allows using React components while integrating with MapLibre's native popups
- Proper cleanup prevents memory leaks

**Positioning strategy:**

- Points: use geometry coordinates for precise positioning
- Polygons: use click coordinates (e.lngLat) for intuitive placement
- Settlements/Structures always use Point geometry (positioned at exact coordinates)

### DataLoader Pattern (Backend)

Prevents N+1 query problems:

- LocationGeometryDataLoader batches geometry fetches
- LocationDataLoader batches location fetches for settlements
- SettlementDataLoader batches settlement + location fetches for structures
- Batches up to 100 IDs per query
- Per-request caching for performance
- Graceful error handling returns nulls instead of throwing

## Testing

Comprehensive test coverage across all components and utilities:

- **geojson-utils.test.ts** (84 tests): All factory functions, validation, edge cases
- **useMapLayers.test.ts** (44 tests): Source/layer CRUD, visibility toggling
- **useLocationLayers.test.ts** (11 tests): Fetching, rendering, coordinate validation
- **useSettlementLayers.test.ts** (10 tests): Fetching, rendering, null handling
- **useStructureLayers.test.ts** (5 tests): Fetching, rendering, structure count
- **Map.test.tsx** (23 tests): Rendering, initialization, viewport management, cleanup
- **EntityPopupContent.test.tsx** (10 tests): All three popup variants
- **useEntityPopup.test.tsx** (9 tests): Popup lifecycle, cleanup, React portal rendering
- **LayerControls.test.tsx** (16 tests): Rendering, interaction, accessibility
- **time-filter.test.ts** (49 tests): Boundary conditions, edge cases, precision
- **TimeScrubber.test.tsx** (15 tests): Rendering, interaction, accessibility
- **LoadingSpinner.test.tsx** (11 tests): Rendering, custom messages, accessibility
- **ErrorMessage.test.tsx** (14 tests): Rendering, retry functionality, accessibility
- **EmptyState.test.tsx** (10 tests): Rendering, custom messages, accessibility
- **MapPage.test.tsx** (12 tests): Page layout, Map integration, viewport state

**Total: 342 tests** covering all map functionality

Run tests:

```bash
# From project root
pnpm --filter @campaign/frontend test

# Watch mode for development
pnpm --filter @campaign/frontend test:watch

# With coverage
pnpm --filter @campaign/frontend test -- --coverage
```

## Performance

**Target**: Good performance with 1000+ entities

**Optimizations implemented:**

- useMemo for GeoJSON feature generation (O(n) filtering per entity type)
- React.memo for presentational components
- DataLoader batching on backend (prevents N+1 queries)
- Client-side time filtering (acceptable for MVP)

**Benchmarks** (not yet measured):

- [ ] Map renders 1000+ entities smoothly
- [ ] Pan/zoom is responsive
- [ ] Layer toggles are instant
- [ ] Memory usage is reasonable

**Future optimizations** (if needed):

- Clustering for dense point data
- Viewport-based filtering
- Backend time filtering for historical queries
- Virtualization for large datasets

## Accessibility

All components follow WCAG accessibility guidelines:

- **LoadingSpinner**: `role="status"`, `aria-live="polite"`, `aria-label`
- **ErrorMessage**: `role="alert"`, `aria-live="assertive"`
- **EmptyState**: `role="status"`, `aria-live="polite"`
- **LayerControls**: Keyboard navigation (Tab, Space), `aria-label` on toggles
- **TimeScrubber**: Keyboard navigation, `aria-label`, proper heading hierarchy
- **Popups**: Proper heading hierarchy (h3), semantic HTML

All decorative icons marked `aria-hidden="true"`.

## Known Limitations

### Current Implementation

1. **No basemap tiles**: Empty map style (no satellite/street view imagery)
   - Deferred to future ticket
   - Free options: OpenStreetMap, Mapbox (requires API key)

2. **Placeholder IDs in MapPage**: worldId, kingdomId, campaignId are hardcoded
   - TODO: Get from campaign context or route params when available

3. **Client-side time filtering**: Filtering done in frontend
   - Acceptable for MVP (1000+ entities)
   - Future optimization: backend filtering for larger datasets

4. **Layer visibility not persisted**: Resets to default (all visible) on page reload
   - Not required for MVP
   - Future enhancement: localStorage persistence

5. **No clustering**: Dense point data may overlap
   - Performance optimization deferred to future ticket

6. **No location name labels**: Locations don't show names on map
   - Optional feature deferred

7. **No geocoder**: No search functionality for locations
   - Optional feature deferred

### Structures Rendering

Structures don't have direct locations - they use parent settlement's coordinates:

- Requires querying settlement with location to get coordinates
- Multiple structures at same settlement render as overlapping markers
- Future enhancement: offset markers or show count badge

## Future Enhancements

**High Priority:**

- [ ] Add basemap tiles (OpenStreetMap or Mapbox)
- [ ] Get worldId/kingdomId/campaignId from campaign context
- [ ] Performance benchmarking with realistic data

**Medium Priority:**

- [ ] localStorage persistence for layer visibility
- [ ] Clustering for dense point data
- [ ] Backend time filtering for large datasets
- [ ] Offset structure markers at same settlement

**Low Priority:**

- [ ] Location name labels
- [ ] Geocoder for location search
- [ ] Custom map styles/themes
- [ ] Drawing tools for creating new locations
- [ ] Measure distance tool
- [ ] Print/export map image

## Related Documentation

- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [GeoJSON Specification](https://datatracker.ietf.org/doc/html/rfc7946)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Frontend README](../../../README.md)
- [TICKET-019: Map View with MapLibre](../../../../../../plan/TICKET-019.md)
