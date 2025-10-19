import type { FeatureCollection } from 'geojson';
import type {
  Map as MapLibre,
  GeoJSONSource,
  CircleLayerSpecification,
  FillLayerSpecification,
} from 'maplibre-gl';
import { useCallback, useEffect, useState } from 'react';

import type { EntityType, LayerVisibility, MapFeature } from './types';

/**
 * Layer style configurations for different entity types
 */
const LAYER_STYLES: {
  'location-point': {
    type: 'circle';
    paint: CircleLayerSpecification['paint'];
  };
  'location-region': {
    type: 'fill';
    paint: FillLayerSpecification['paint'];
  };
  settlement: {
    type: 'circle';
    paint: CircleLayerSpecification['paint'];
  };
  structure: {
    type: 'circle';
    paint: CircleLayerSpecification['paint'];
  };
} = {
  'location-point': {
    type: 'circle' as const,
    paint: {
      'circle-radius': 6,
      'circle-color': '#3b82f6', // blue-500
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  },
  'location-region': {
    type: 'fill' as const,
    paint: {
      'fill-color': '#3b82f6', // blue-500
      'fill-opacity': 0.2,
      'fill-outline-color': '#1d4ed8', // blue-700
    },
  },
  settlement: {
    type: 'circle' as const,
    paint: {
      'circle-radius': 8,
      'circle-color': '#10b981', // green-500
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  },
  structure: {
    type: 'circle' as const,
    paint: {
      'circle-radius': 6,
      'circle-color': '#f59e0b', // amber-500
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  },
};

/**
 * Hook for managing GeoJSON layers on a MapLibre map
 *
 * Provides utilities for:
 * - Adding/removing GeoJSON sources and layers
 * - Toggling layer visibility
 * - Updating layer data
 */
export function useMapLayers(map: MapLibre | null) {
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    'location-point': true,
    'location-region': true,
    settlement: true,
    structure: true,
  });

  /**
   * Adds a GeoJSON source to the map
   */
  const addSource = useCallback(
    (
      sourceId: string,
      data: FeatureCollection<MapFeature['geometry'], MapFeature['properties']>
    ) => {
      if (!map) return;

      // Remove existing source if it exists
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }

      map.addSource(sourceId, {
        type: 'geojson',
        data,
      });
    },
    [map]
  );

  /**
   * Updates the data for an existing GeoJSON source
   */
  const updateSource = useCallback(
    (
      sourceId: string,
      data: FeatureCollection<MapFeature['geometry'], MapFeature['properties']>
    ) => {
      if (!map) return;

      const source = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (source && source.type === 'geojson') {
        source.setData(data);
      } else {
        // Source doesn't exist, add it
        addSource(sourceId, data);
      }
    },
    [map, addSource]
  );

  /**
   * Adds a layer to the map
   */
  const addLayer = useCallback(
    (layerId: string, sourceId: string, entityType: EntityType) => {
      if (!map) return;

      // Remove existing layer if it exists
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }

      const style = LAYER_STYLES[entityType];

      // Create layer specification based on type (must handle circle and fill separately due to TypeScript discriminated unions)
      if (style.type === 'circle') {
        const layerSpec: CircleLayerSpecification = {
          id: layerId,
          type: 'circle',
          source: sourceId,
          paint: style.paint,
          layout: {
            visibility: layerVisibility[entityType] ? 'visible' : 'none',
          },
        };
        map.addLayer(layerSpec);
      } else {
        const layerSpec: FillLayerSpecification = {
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: style.paint,
          layout: {
            visibility: layerVisibility[entityType] ? 'visible' : 'none',
          },
        };
        map.addLayer(layerSpec);
      }
    },
    [map, layerVisibility]
  );

  /**
   * Removes a layer and its source from the map
   */
  const removeLayer = useCallback(
    (layerId: string, sourceId: string) => {
      if (!map) return;

      // Remove layer first
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }

      // Then remove source
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    },
    [map]
  );

  /**
   * Toggles visibility of a specific entity type
   */
  const toggleLayerVisibility = useCallback((entityType: EntityType) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [entityType]: !prev[entityType],
    }));
  }, []);

  /**
   * Sets visibility for a specific entity type
   */
  const setLayerVisible = useCallback((entityType: EntityType, visible: boolean) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [entityType]: visible,
    }));
  }, []);

  /**
   * Updates map layer visibility when state changes
   */
  useEffect(() => {
    if (!map) return;

    // Update visibility for all entity types
    Object.entries(layerVisibility).forEach(([entityType, visible]) => {
      const layerId = `${entityType}-layer`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    });
  }, [map, layerVisibility]);

  /**
   * Adds a complete layer (source + layer) with data
   */
  const addDataLayer = useCallback(
    (
      entityType: EntityType,
      data: FeatureCollection<MapFeature['geometry'], MapFeature['properties']>
    ) => {
      const sourceId = `${entityType}-source`;
      const layerId = `${entityType}-layer`;

      addSource(sourceId, data);
      addLayer(layerId, sourceId, entityType);
    },
    [addSource, addLayer]
  );

  /**
   * Updates data for an existing layer
   */
  const updateDataLayer = useCallback(
    (
      entityType: EntityType,
      data: FeatureCollection<MapFeature['geometry'], MapFeature['properties']>
    ) => {
      const sourceId = `${entityType}-source`;
      updateSource(sourceId, data);
    },
    [updateSource]
  );

  return {
    // Layer management
    addSource,
    updateSource,
    addLayer,
    removeLayer,
    addDataLayer,
    updateDataLayer,

    // Visibility controls
    layerVisibility,
    toggleLayerVisibility,
    setLayerVisible,
  };
}
