import { Map as MapLibre, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

interface MapProps {
  /**
   * Initial center coordinates [longitude, latitude]
   * Default: [0, 0]
   */
  initialCenter?: [number, number];

  /**
   * Initial zoom level
   * Default: 2
   */
  initialZoom?: number;

  /**
   * CSS class name for the map container
   */
  className?: string;
}

/**
 * MapLibre GL JS map component
 *
 * Renders an interactive map with basic controls (zoom, pan)
 */
export function Map({ initialCenter = [0, 0], initialZoom = 2, className = '' }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // Initialize map only once

    // Create map instance
    map.current = new MapLibre({
      container: mapContainer.current,
      // Empty style for Stage 1 - basemap tiles will be added in later stages
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      center: initialCenter,
      zoom: initialZoom,
    });

    // Add navigation controls (zoom buttons)
    map.current.addControl(new NavigationControl(), 'top-right');

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Map initializes once and never updates

  return (
    <div ref={mapContainer} className={`w-full h-full ${className}`} data-testid="map-container" />
  );
}
