/**
 * Hook for managing structure layers on the map
 *
 * This hook fetches structure data (with associated settlement and location) from the GraphQL API
 * and renders structure markers on the map using GeoJSON layers.
 */

import type { Map as MaplibreMap } from 'maplibre-gl';
import { useEffect } from 'react';

import { useStructuresForMap } from '@/services/api/hooks';

import { createStructureFeature, filterValidFeatures } from './geojson-utils';
import { filterByTime } from './time-filter';
import { useMapLayers } from './useMapLayers';

/**
 * Hook to render structure layers on the map
 *
 * Fetches structures with their settlement and location data and renders them as distinct markers.
 * Structure markers are positioned at the settlement's location coordinates.
 *
 * @param map - MapLibre map instance
 * @param settlementId - Settlement ID to fetch structures for
 * @param enabled - Whether to render structure layers (default: true)
 * @param filterTime - Optional time to filter entities by (for historical view)
 */
export function useStructureLayers(
  map: MaplibreMap | null,
  settlementId: string,
  enabled = true,
  filterTime: Date | null = null
) {
  const { structures, loading, error } = useStructuresForMap(settlementId, { skip: !enabled });
  const { addDataLayer } = useMapLayers(map);

  useEffect(() => {
    if (!map || !enabled) {
      return;
    }

    if (loading || error || !structures || structures.length === 0) {
      // Don't render anything if loading, error, or no data
      return;
    }

    // Filter structures by time
    const filteredStructures = filterByTime(structures, filterTime);

    // Create GeoJSON features for structures
    const structureFeatures = filterValidFeatures(
      filteredStructures.map((structure) => {
        // Structure must have a settlement with a location and valid geometry
        if (
          !structure.settlement ||
          !structure.settlement.location ||
          !structure.settlement.location.geojson
        ) {
          return null;
        }

        // Extract and validate coordinates from settlement's location GeoJSON (assumes Point geometry)
        const geojson = structure.settlement.location.geojson as {
          type?: string;
          coordinates?: [number, number];
        };
        if (
          geojson.type !== 'Point' ||
          !geojson.coordinates ||
          geojson.coordinates.length < 2 ||
          !Number.isFinite(geojson.coordinates[0]) ||
          !Number.isFinite(geojson.coordinates[1])
        ) {
          return null;
        }

        // Skip if structure is missing required type or level fields
        if (!structure.type || typeof structure.level !== 'number') {
          return null;
        }

        return createStructureFeature({
          id: structure.id,
          name: structure.name,
          structureType: structure.type,
          level: structure.level,
          settlementId: structure.settlementId,
          location: {
            longitude: geojson.coordinates[0],
            latitude: geojson.coordinates[1],
          },
        });
      })
    );

    // Add/update structure layer
    if (structureFeatures.length > 0) {
      const structureGeoJSON = {
        type: 'FeatureCollection' as const,
        features: structureFeatures,
      };
      addDataLayer('structure', structureGeoJSON);
    }
  }, [map, structures, loading, error, enabled, addDataLayer, filterTime]);

  return {
    loading,
    error,
    structureCount: structures?.length ?? 0,
  };
}
