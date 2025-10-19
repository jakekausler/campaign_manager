/**
 * Hook for managing settlement layers on the map
 *
 * This hook fetches settlement data (with associated locations) from the GraphQL API
 * and renders settlement markers on the map using GeoJSON layers.
 */

import type { Map as MaplibreMap } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';

import { useSettlementsForMap } from '@/services/api/hooks';

import { createSettlementFeature, filterValidFeatures } from './geojson-utils';
import { filterByTime } from './time-filter';
import { useMapLayers } from './useMapLayers';

/**
 * Hook to render settlement layers on the map
 *
 * Fetches settlements with their location data and renders them as distinct markers.
 * Settlement markers are visually different from plain location markers and sized by level.
 *
 * @param map - MapLibre map instance
 * @param kingdomId - Kingdom ID to fetch settlements for
 * @param enabled - Whether to render settlement layers (default: true)
 * @param filterTime - Optional time to filter entities by (for historical view)
 */
export function useSettlementLayers(
  map: MaplibreMap | null,
  kingdomId: string,
  enabled = true,
  filterTime: Date | null = null
) {
  const { settlements, loading, error } = useSettlementsForMap(kingdomId, { skip: !enabled });
  const { addDataLayer } = useMapLayers(map);

  // Memoize filtered and processed GeoJSON features
  const settlementFeatures = useMemo(() => {
    if (loading || error || !settlements || settlements.length === 0) {
      return [];
    }

    // Filter settlements by time
    const filteredSettlements = filterByTime(settlements, filterTime);

    // Create GeoJSON features for settlements
    return filterValidFeatures(
      filteredSettlements.map((settlement) => {
        // Settlement must have a location with valid geometry
        if (!settlement.location || !settlement.location.geojson) {
          return null;
        }

        // Extract and validate coordinates from location's GeoJSON (assumes Point geometry)
        const geojson = settlement.location.geojson as { coordinates?: [number, number] };
        if (
          !geojson.coordinates ||
          geojson.coordinates.length < 2 ||
          !Number.isFinite(geojson.coordinates[0]) ||
          !Number.isFinite(geojson.coordinates[1])
        ) {
          return null;
        }

        return createSettlementFeature({
          id: settlement.id,
          name: settlement.name,
          level: settlement.level,
          locationId: settlement.location.id,
          location: {
            longitude: geojson.coordinates[0],
            latitude: geojson.coordinates[1],
          },
        });
      })
    );
  }, [settlements, loading, error, filterTime]);

  useEffect(() => {
    if (!map || !enabled) {
      return;
    }

    // Add/update settlement layer
    if (settlementFeatures.length > 0) {
      const settlementGeoJSON = {
        type: 'FeatureCollection' as const,
        features: settlementFeatures,
      };
      addDataLayer('settlement', settlementGeoJSON);
    }
  }, [map, enabled, settlementFeatures, addDataLayer]);

  return {
    loading,
    error,
    settlementCount: settlements?.length ?? 0,
  };
}
