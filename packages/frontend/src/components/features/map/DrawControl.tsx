import type { Map as MapLibre, IControl } from 'maplibre-gl';
import MapboxDraw from 'maplibre-gl-draw';
import { useEffect, useRef } from 'react';

/**
 * GeoJSON Feature type for draw events
 */
interface DrawFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  properties: Record<string, unknown>;
  id?: string;
}

/**
 * Draw event types from maplibre-gl-draw
 */
interface DrawCreateEvent {
  features: DrawFeature[];
}

interface DrawUpdateEvent {
  features: DrawFeature[];
}

interface DrawDeleteEvent {
  features: DrawFeature[];
}

/**
 * Props for DrawControl component
 */
export interface DrawControlProps {
  /**
   * MapLibre GL map instance to attach the draw control to
   */
  map: MapLibre | null;

  /**
   * Position of the draw controls on the map
   * @default 'top-left'
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /**
   * Custom styles for drawn features (optional)
   * @see https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md#styling-draw
   */
  styles?: Record<string, unknown>[];

  /**
   * Controls which drawing modes to display
   */
  controls?: {
    point?: boolean;
    line_string?: boolean;
    polygon?: boolean;
    trash?: boolean;
    combine_features?: boolean;
    uncombine_features?: boolean;
  };

  /**
   * Callback when a feature is created
   */
  onCreate?: (feature: DrawFeature) => void;

  /**
   * Callback when a feature is updated
   */
  onUpdate?: (features: DrawFeature[]) => void;

  /**
   * Callback when a feature is deleted
   */
  onDelete?: (features: DrawFeature[]) => void;
}

/**
 * DrawControl component wrapper for MapLibre GL Draw
 *
 * Provides drawing and editing capabilities for the map:
 * - Point creation
 * - Polygon drawing
 * - Edit mode for existing geometry
 *
 * @example
 * ```tsx
 * <DrawControl
 *   map={mapInstance}
 *   position="top-left"
 *   controls={{ point: true, polygon: true, trash: true }}
 *   onCreate={(feature) => console.log('Created:', feature)}
 *   onUpdate={(features) => console.log('Updated:', features)}
 *   onDelete={(features) => console.log('Deleted:', features)}
 * />
 * ```
 */
export function DrawControl({
  map,
  position = 'top-left',
  styles,
  controls = {
    point: true,
    line_string: false,
    polygon: true,
    trash: true,
    combine_features: false,
    uncombine_features: false,
  },
  onCreate,
  onUpdate,
  onDelete,
}: DrawControlProps) {
  const drawRef = useRef<MapboxDraw | null>(null);

  useEffect(() => {
    if (!map) return;

    // Initialize MapLibre GL Draw
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls,
      styles,
    });

    drawRef.current = draw;

    // Add control to map
    // Type assertion needed due to incompatibility between maplibre-gl-draw and maplibre-gl Map types
    map.addControl(draw as unknown as IControl, position);

    // Set up event listeners
    const handleCreate = (e: DrawCreateEvent) => {
      if (onCreate) {
        onCreate(e.features[0]);
      }
    };

    const handleUpdate = (e: DrawUpdateEvent) => {
      if (onUpdate) {
        onUpdate(e.features);
      }
    };

    const handleDelete = (e: DrawDeleteEvent) => {
      if (onDelete) {
        onDelete(e.features);
      }
    };

    map.on('draw.create', handleCreate);
    map.on('draw.update', handleUpdate);
    map.on('draw.delete', handleDelete);

    // Cleanup on unmount
    return () => {
      map.off('draw.create', handleCreate);
      map.off('draw.update', handleUpdate);
      map.off('draw.delete', handleDelete);

      if (drawRef.current) {
        // Type assertion needed due to incompatibility between maplibre-gl-draw and maplibre-gl Map types
        map.removeControl(drawRef.current as unknown as IControl);
        drawRef.current = null;
      }
    };
  }, [map, position, controls, styles, onCreate, onUpdate, onDelete]);

  // This component doesn't render anything itself - it just adds controls to the map
  return null;
}
