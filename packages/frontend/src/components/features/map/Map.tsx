import { Map as MapLibre, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, useCallback } from 'react';

import { useLocationLayers } from './useLocationLayers';

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

  /**
   * Callback when viewport changes (optional)
   */
  onViewportChange?: (viewport: ViewportState) => void;

  /**
   * World ID to fetch and display locations for (optional)
   * When provided, location layers will be rendered on the map
   */
  worldId?: string;
}

/**
 * Viewport state for map view
 */
export interface ViewportState {
  center: [number, number];
  zoom: number;
  bounds: [[number, number], [number, number]] | null;
}

/**
 * MapLibre GL JS map component
 *
 * Renders an interactive map with basic controls (zoom, pan, reset viewport)
 * Manages viewport state internally and exposes it via callback
 * Optionally displays location layers when worldId is provided
 */
export function Map({
  initialCenter = [0, 0],
  initialZoom = 2,
  className = '',
  onViewportChange,
  worldId,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);

  // Store initial viewport for reset functionality
  const initialViewport = useRef({ center: initialCenter, zoom: initialZoom });

  // Viewport state
  const [viewport, setViewport] = useState<ViewportState>({
    center: initialCenter,
    zoom: initialZoom,
    bounds: null,
  });

  // Load location layers if worldId is provided
  useLocationLayers(map.current, worldId ?? '', Boolean(worldId));

  // Update viewport state from map
  const updateViewport = useCallback(() => {
    if (!map.current) return;

    const center = map.current.getCenter();
    const zoom = map.current.getZoom();
    const bounds = map.current.getBounds();

    const newViewport: ViewportState = {
      center: [center.lng, center.lat],
      zoom,
      bounds: bounds
        ? [
            [bounds.getWest(), bounds.getSouth()],
            [bounds.getEast(), bounds.getNorth()],
          ]
        : null,
    };

    setViewport(newViewport);
    onViewportChange?.(newViewport);
  }, [onViewportChange]);

  // Reset viewport to initial state
  const resetViewport = useCallback(() => {
    if (!map.current) return;

    map.current.flyTo({
      center: initialViewport.current.center,
      zoom: initialViewport.current.zoom,
      duration: 1000,
    });
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // Initialize map only once

    // Create map instance
    map.current = new MapLibre({
      container: mapContainer.current,
      // Empty style for Stage 2 - basemap tiles will be added in later stages
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

    // Listen to viewport changes
    map.current.on('moveend', updateViewport);
    map.current.on('zoomend', updateViewport);

    // Set initial viewport state
    updateViewport();

    // Cleanup on unmount
    return () => {
      if (map.current) {
        map.current.off('moveend', updateViewport);
        map.current.off('zoomend', updateViewport);
        map.current.remove();
        map.current = null;
      }
    };
    // Map initializes once and never updates - updateViewport is stable via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className={`w-full h-full ${className}`}
        data-testid="map-container"
      />

      {/* Reset viewport button */}
      <button
        onClick={resetViewport}
        className="absolute top-4 left-4 bg-white hover:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        data-testid="reset-viewport-button"
        aria-label="Reset map viewport to initial position"
      >
        Reset View
      </button>

      {/* Viewport debug info (hidden by default, useful for development) */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 text-xs p-2 rounded shadow-md font-mono">
          <div>
            Center: [{viewport.center[0].toFixed(4)}, {viewport.center[1].toFixed(4)}]
          </div>
          <div>Zoom: {viewport.zoom.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}
