/**
 * Custom styles for MapLibre GL Draw
 *
 * These styles customize the appearance of drawn features (points, polygons)
 * to match the application's design system.
 *
 * @see https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md#styling-draw
 */

/**
 * Default draw styles with custom colors and line widths
 *
 * - Active features (currently being edited): Blue outline, semi-transparent fill
 * - Inactive features (not selected): Gray outline, lighter fill
 * - Vertices: White circles with blue outline
 * - Midpoints (for adding vertices): Smaller white circles
 */
export const drawStyles = [
  // Polygon fill (inactive)
  {
    id: 'gl-draw-polygon-fill-inactive',
    type: 'fill',
    filter: [
      'all',
      ['==', 'active', 'false'],
      ['==', '$type', 'Polygon'],
      ['!=', 'mode', 'static'],
    ],
    paint: {
      'fill-color': '#3b82f6',
      'fill-outline-color': '#3b82f6',
      'fill-opacity': 0.1,
    },
  },
  // Polygon fill (active)
  {
    id: 'gl-draw-polygon-fill-active',
    type: 'fill',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': '#3b82f6',
      'fill-outline-color': '#3b82f6',
      'fill-opacity': 0.2,
    },
  },
  // Polygon outline (inactive)
  {
    id: 'gl-draw-polygon-stroke-inactive',
    type: 'line',
    filter: [
      'all',
      ['==', 'active', 'false'],
      ['==', '$type', 'Polygon'],
      ['!=', 'mode', 'static'],
    ],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#3b82f6',
      'line-width': 2,
    },
  },
  // Polygon outline (active)
  {
    id: 'gl-draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#3b82f6',
      'line-width': 3,
    },
  },
  // Line (inactive)
  {
    id: 'gl-draw-line-inactive',
    type: 'line',
    filter: [
      'all',
      ['==', 'active', 'false'],
      ['==', '$type', 'LineString'],
      ['!=', 'mode', 'static'],
    ],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#3b82f6',
      'line-width': 2,
    },
  },
  // Line (active)
  {
    id: 'gl-draw-line-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#3b82f6',
      'line-width': 3,
    },
  },
  // Point (inactive)
  {
    id: 'gl-draw-point-inactive',
    type: 'circle',
    filter: [
      'all',
      ['==', 'active', 'false'],
      ['==', '$type', 'Point'],
      ['==', 'meta', 'feature'],
      ['!=', 'mode', 'static'],
    ],
    paint: {
      'circle-radius': 6,
      'circle-color': '#3b82f6',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  },
  // Point (active)
  {
    id: 'gl-draw-point-active',
    type: 'circle',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: {
      'circle-radius': 8,
      'circle-color': '#3b82f6',
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  },
  // Vertex points
  {
    id: 'gl-draw-polygon-and-line-vertex-inactive',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
    paint: {
      'circle-radius': 5,
      'circle-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#3b82f6',
    },
  },
  // Midpoints (for adding vertices)
  {
    id: 'gl-draw-polygon-and-line-vertex-stroke-inactive',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'midpoint'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
    paint: {
      'circle-radius': 4,
      'circle-color': '#ffffff',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#3b82f6',
    },
  },
];
