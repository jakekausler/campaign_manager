/**
 * Hook for managing location layers on the map
 *
 * This hook fetches location data from the GraphQL API and renders
 * location points and regions on the map using GeoJSON layers.
 */

import type { Map as MaplibreMap } from 'maplibre-gl';
import { useEffect } from 'react';

import { useLocationsByWorld } from '@/services/api/hooks';

import {
  createLocationPointFeature,
  createLocationRegionFeature,
  filterValidFeatures,
} from './geojson-utils';
import { useMapLayers } from './useMapLayers';

/**
 * Hook to render location layers on the map
 *
 * @param map - MapLibre map instance
 * @param worldId - World ID to fetch locations for
 * @param enabled - Whether to render location layers (default: true)
 */
export function useLocationLayers(map: MaplibreMap | null, worldId: string, enabled = true) {
  const { locations, loading, error } = useLocationsByWorld(worldId, { skip: !enabled });
  const { addDataLayer } = useMapLayers(map);

  useEffect(() => {
    if (!map || !enabled) {
      return;
    }

    if (loading || error || !locations || locations.length === 0) {
      // Don't render anything if loading, error, or no data
      return;
    }

    // Separate locations by type
    const pointLocations = locations.filter((loc) => loc.type === 'point');
    const regionLocations = locations.filter((loc) => loc.type === 'region');

    // Create GeoJSON features for point locations
    const pointFeatures = filterValidFeatures(
      pointLocations.map((location) => {
        if (!location.geojson) {
          return null;
        }

        // Extract and validate coordinates from GeoJSON (assumes Point geometry)
        const geojson = location.geojson as { coordinates?: [number, number] };
        if (
          !geojson.coordinates ||
          geojson.coordinates.length < 2 ||
          !Number.isFinite(geojson.coordinates[0]) ||
          !Number.isFinite(geojson.coordinates[1])
        ) {
          return null;
        }

        return createLocationPointFeature({
          id: location.id,
          worldId: location.worldId,
          name: location.name || 'Unnamed Location',
          description: location.description || undefined,
          longitude: geojson.coordinates[0],
          latitude: geojson.coordinates[1],
        });
      })
    );

    // Create GeoJSON features for region locations
    const regionFeatures = filterValidFeatures(
      regionLocations.map((location) => {
        if (!location.geojson) {
          return null;
        }

        // Extract and validate coordinates from GeoJSON (assumes Polygon geometry)
        const geojson = location.geojson as { coordinates?: number[][][] };
        if (
          !geojson.coordinates ||
          geojson.coordinates.length === 0 ||
          !Array.isArray(geojson.coordinates) ||
          !geojson.coordinates.every(
            (ring) =>
              Array.isArray(ring) &&
              ring.every(
                (coord) =>
                  Array.isArray(coord) &&
                  coord.length >= 2 &&
                  Number.isFinite(coord[0]) &&
                  Number.isFinite(coord[1])
              )
          )
        ) {
          return null;
        }

        return createLocationRegionFeature({
          id: location.id,
          worldId: location.worldId,
          name: location.name || 'Unnamed Region',
          description: location.description || undefined,
          rings: geojson.coordinates,
        });
      })
    );

    // Add/update point layer
    if (pointFeatures.length > 0) {
      const pointGeoJSON = {
        type: 'FeatureCollection' as const,
        features: pointFeatures,
      };
      addDataLayer('location-point', pointGeoJSON);
    }

    // Add/update region layer
    if (regionFeatures.length > 0) {
      const regionGeoJSON = {
        type: 'FeatureCollection' as const,
        features: regionFeatures,
      };
      addDataLayer('location-region', regionGeoJSON);
    }
  }, [map, locations, loading, error, enabled, addDataLayer]);

  return {
    loading,
    error,
    locationCount: locations?.length ?? 0,
  };
}
