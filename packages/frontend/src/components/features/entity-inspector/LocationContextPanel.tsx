import { MapPin, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocationDetails } from '@/services/api/hooks';

export interface LocationContextPanelProps {
  /** The ID of the location to display */
  locationId: string;
  /** Optional settlement name for context */
  settlementName?: string;
}

/**
 * LocationContextPanel displays Settlement's associated Location information.
 *
 * Features:
 * - Location name and coordinates display
 * - "Jump to Location" button for map navigation
 * - Coordinate formatting (latitude, longitude)
 * - Loading skeleton and error states
 * - GeoJSON geometry parsing for coordinate extraction
 *
 * Integration:
 * - Uses useLocationDetails hook to fetch location data
 * - Navigates to /map view with React Router
 * - (Future) Will integrate with selection store for map highlighting
 *
 * @example
 * ```tsx
 * <LocationContextPanel
 *   locationId="loc-123"
 *   settlementName="Capital City"
 * />
 * ```
 */
export function LocationContextPanel({ locationId, settlementName }: LocationContextPanelProps) {
  const navigate = useNavigate();
  const { location, loading, error } = useLocationDetails(locationId);

  /**
   * Extract coordinates from GeoJSON geometry.
   * Supports both Point and Polygon geometries.
   *
   * @param geojson - GeoJSON geometry object
   * @returns Coordinate tuple [longitude, latitude] or null
   */
  const extractCoordinates = (geojson: unknown): [number, number] | null => {
    if (!geojson || typeof geojson !== 'object') {
      return null;
    }

    const geometry = geojson as {
      type?: string;
      coordinates?: unknown;
    };

    if (!geometry.type || !geometry.coordinates) {
      return null;
    }

    // Handle Point geometry: coordinates are [longitude, latitude]
    if (geometry.type === 'Point') {
      const coords = geometry.coordinates as number[];
      if (Array.isArray(coords) && coords.length >= 2) {
        return [coords[0], coords[1]];
      }
    }

    // Handle Polygon geometry: coordinates are [[[lon, lat], ...]]
    // Extract the first point of the first ring
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates as number[][][];
      if (
        Array.isArray(coords) &&
        coords.length > 0 &&
        Array.isArray(coords[0]) &&
        coords[0].length > 0 &&
        Array.isArray(coords[0][0]) &&
        coords[0][0].length >= 2
      ) {
        return [coords[0][0][0], coords[0][0][1]];
      }
    }

    return null;
  };

  /**
   * Format coordinate value to 6 decimal places.
   *
   * @param value - Coordinate value (latitude or longitude)
   * @returns Formatted string with 6 decimal places
   */
  const formatCoordinate = (value: number): string => {
    return value.toFixed(6);
  };

  /**
   * Navigate to map view.
   * Future: Will also trigger map pan/zoom to location and highlight it.
   */
  const handleJumpToLocation = () => {
    // Navigate to map view
    navigate('/map');

    // TODO (Stage 6): Integrate with selection store to:
    // 1. selectEntity({ id: locationId, type: EntityType.LOCATION })
    // 2. Trigger map pan/zoom to location coordinates
  };

  // Loading state
  if (loading) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Location Context
        </h3>
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-700">Location Name</Label>
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-700">Coordinates</Label>
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Location Context
        </h3>
        <div
          className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
          role="alert"
        >
          Failed to load location: {error.message}
        </div>
      </Card>
    );
  }

  // Missing location state
  if (!location) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Location Context
        </h3>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-500">
          No location data available for this settlement.
        </div>
      </Card>
    );
  }

  const coordinates = extractCoordinates(location.geojson);
  const locationName = location.name || 'Unnamed Location';
  const coordinatesText = coordinates
    ? `${formatCoordinate(coordinates[1])}°, ${formatCoordinate(coordinates[0])}°`
    : 'N/A';

  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
        <MapPin className="w-4 h-4" />
        Location Context
      </h3>

      <div className="space-y-3">
        {/* Location Name */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-semibold text-slate-700">Location Name</Label>
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono">
            {locationName}
          </div>
        </div>

        {/* Location Type */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-semibold text-slate-700">Location Type</Label>
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono capitalize">
            {location.type}
          </div>
        </div>

        {/* Coordinates */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-semibold text-slate-700">Coordinates (Lat, Lon)</Label>
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono">
            {coordinatesText}
          </div>
        </div>

        {/* Jump to Location Button */}
        <Button
          onClick={handleJumpToLocation}
          className="w-full"
          variant="default"
          disabled={!coordinates}
          title={
            coordinates
              ? 'Navigate to map and highlight this location'
              : 'No coordinates available for this location'
          }
        >
          <Navigation className="w-4 h-4 mr-2" />
          Jump to Location on Map
        </Button>

        {/* Optional description */}
        {location.description && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-700">Description</Label>
            <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700">
              {location.description}
            </div>
          </div>
        )}

        {/* Settlement Context (if provided) */}
        {settlementName && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              This location is associated with{' '}
              <span className="font-semibold">{settlementName}</span>
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
