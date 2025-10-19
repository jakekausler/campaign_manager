import { Map as MapLibre, NavigationControl } from 'maplibre-gl';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type MapboxDraw from 'maplibre-gl-draw';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import { useCurrentWorldTime } from '@/services/api/hooks';
import { useUpdateLocationGeometry } from '@/services/api/mutations/locations';
import { useCurrentBranchId } from '@/stores';

import { DrawControl } from './DrawControl';
import { DrawToolbar } from './DrawToolbar';
import { EmptyState } from './EmptyState';
import { ErrorMessage } from './ErrorMessage';
import { LayerControls } from './LayerControls';
import { LoadingSpinner } from './LoadingSpinner';
import { TimeScrubber } from './TimeScrubber';
import { UndoRedoControls } from './UndoRedoControls';
import { drawStyles } from './draw-styles';
import type {
  LocationPointProperties,
  LocationRegionProperties,
  SettlementProperties,
  StructureProperties,
  PopupData,
} from './types';
import { useEntityPopup } from './useEntityPopup';
import { useLocationLayers } from './useLocationLayers';
import { useMapDraw } from './useMapDraw';
import type { DrawFeature, LocationEditMetadata } from './useMapDraw';
import { useMapLayers } from './useMapLayers';
import { useSettlementLayers } from './useSettlementLayers';

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

  /**
   * Kingdom ID to fetch and display settlements for (optional)
   * When provided, settlement layers will be rendered on the map
   */
  kingdomId?: string;

  /**
   * Campaign ID for querying world time (optional)
   * When provided, enables time scrubber for historical view
   */
  campaignId?: string;

  /**
   * Enable drawing controls (optional)
   * When true, adds drawing tools for creating and editing geometry
   * @default false
   */
  enableDrawing?: boolean;
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
 * Optionally displays settlement layers when kingdomId is provided
 */
export function Map({
  initialCenter = [0, 0],
  initialZoom = 2,
  className = '',
  onViewportChange,
  worldId,
  kingdomId,
  campaignId,
  enableDrawing = false,
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

  // World time for time scrubber
  const { currentTime, loading: timeLoading } = useCurrentWorldTime(campaignId);

  // Selected time state (null means "current time")
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);

  // Drawing state
  const [drawInstance, setDrawInstance] = useState<MapboxDraw | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Campaign branch ID for mutations
  const branchId = useCurrentBranchId();

  // Location geometry mutation
  const { updateLocationGeometry } = useUpdateLocationGeometry();

  // Store location data for looking up metadata when entering edit mode
  const locationDataRef = useRef(new globalThis.Map<string, LocationEditMetadata>());

  // Determine filter time: use selectedTime if set, otherwise null (shows all active)
  const filterTime = selectedTime;

  // Map layer visibility management
  const { layerVisibility, toggleLayerVisibility } = useMapLayers(map.current);

  // Load location layers if worldId is provided
  const {
    loading: locationsLoading,
    error: locationsError,
    locationCount,
    locations,
  } = useLocationLayers(map.current, worldId ?? '', Boolean(worldId), filterTime);

  // Load settlement layers if kingdomId is provided
  const {
    loading: settlementsLoading,
    error: settlementsError,
    settlementCount,
  } = useSettlementLayers(map.current, kingdomId ?? '', Boolean(kingdomId), filterTime);

  // Map drawing hook
  const {
    state: drawState,
    actions: drawActions,
    handleFeatureCreated,
    handleFeatureUpdated,
  } = useMapDraw(drawInstance, {
    onFeatureCreated: (feature: DrawFeature) => {
      // Feature created - will be handled in future work (create mode)
      void feature;
    },
    onFeatureUpdated: (feature: DrawFeature) => {
      // Feature updated - tracked automatically by useMapDraw
      void feature;
    },
    onSave: async (feature: DrawFeature) => {
      // Clear any previous errors
      setSaveError(null);

      // Only handle edit mode saves (editLocationMetadata must be present)
      const { editLocationMetadata } = drawState;
      if (!editLocationMetadata) {
        setSaveError(
          'Cannot save: Create mode not yet implemented. Please edit existing locations only.'
        );
        return;
      }

      // Validate branchId is available
      if (!branchId) {
        setSaveError('Cannot save: No branch selected. Please select a campaign branch.');
        return;
      }

      setIsSaving(true);
      try {
        // Call mutation with location geometry
        await updateLocationGeometry(editLocationMetadata.locationId, {
          geoJson: feature.geometry,
          branchId,
          expectedVersion: editLocationMetadata.version,
        });

        // Success - geometry has been saved and cache invalidated
        console.log('Location geometry saved successfully');
        setSaveError(null);
      } catch (error) {
        // Parse error and set user-friendly message
        let errorMessage = 'Failed to save location geometry. Please try again.';

        if (error instanceof Error) {
          // Check for version conflict (optimistic lock failure)
          if (error.message.includes('version') || error.message.includes('conflict')) {
            errorMessage =
              'This location was modified by someone else. Please refresh and try again.';
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Network error. Please check your connection and try again.';
          } else if (error.message.includes('auth') || error.message.includes('permission')) {
            errorMessage = 'You do not have permission to edit this location.';
          }
        }

        setSaveError(errorMessage);
        console.error('Failed to save location geometry:', error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
  });

  // When current time loads, initialize selectedTime to current time
  useEffect(() => {
    if (currentTime && !selectedTime) {
      setSelectedTime(currentTime);
    }
  }, [currentTime, selectedTime]);

  // Populate location metadata ref when locations change
  // Memoize to avoid recreating Map on every render
  const locationMetadata = useMemo(() => {
    if (!locations || locations.length === 0) {
      return new globalThis.Map<string, LocationEditMetadata>();
    }

    const map = new globalThis.Map<string, LocationEditMetadata>();
    locations.forEach((location) => {
      map.set(location.id, {
        locationId: location.id,
        version: location.version,
        type: location.type,
      });
    });
    return map;
  }, [locations]);

  // Update ref when metadata changes
  useEffect(() => {
    locationDataRef.current = locationMetadata;
  }, [locationMetadata]);

  // Entity popup management
  const { showPopup } = useEntityPopup(map.current);

  /**
   * Handle clicks on location point layer
   */
  const handleLocationPointClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const properties = feature.properties as unknown as LocationPointProperties;
      const geometry = feature.geometry;

      if (geometry.type !== 'Point') return;

      // If drawing is enabled, enter edit mode for this location
      if (enableDrawing && drawInstance) {
        const locationMetadata = locationDataRef.current.get(properties.id);
        if (locationMetadata) {
          // Add feature to draw control
          const drawFeature = {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: geometry.coordinates as [number, number],
            },
            properties: {},
          };
          const addedFeatures = drawInstance.add(drawFeature);
          if (addedFeatures && addedFeatures.length > 0) {
            const featureId = addedFeatures[0];
            drawActions.startEdit(featureId, locationMetadata);
          }
        }
        return;
      }

      // Otherwise show popup
      const popupData: PopupData = {
        type: 'location-point',
        id: properties.id,
        name: properties.name,
        description: properties.description,
        coordinates: geometry.coordinates as [number, number],
      };

      showPopup(popupData);
    },
    [showPopup, enableDrawing, drawInstance, drawActions]
  );

  /**
   * Handle clicks on location region layer
   */
  const handleLocationRegionClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const properties = feature.properties as unknown as LocationRegionProperties;
      const geometry = feature.geometry;

      if (geometry.type !== 'Polygon') return;

      // If drawing is enabled, enter edit mode for this location
      if (enableDrawing && drawInstance) {
        const locationMetadata = locationDataRef.current.get(properties.id);
        if (locationMetadata) {
          // Add feature to draw control
          const drawFeature = {
            type: 'Feature' as const,
            geometry: {
              type: 'Polygon' as const,
              coordinates: geometry.coordinates as number[][][],
            },
            properties: {},
          };
          const addedFeatures = drawInstance.add(drawFeature);
          if (addedFeatures && addedFeatures.length > 0) {
            const featureId = addedFeatures[0];
            drawActions.startEdit(featureId, locationMetadata);
          }
        }
        return;
      }

      // Otherwise show popup
      // For polygons, use the click coordinates as popup position
      const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      const popupData: PopupData = {
        type: 'location-region',
        id: properties.id,
        name: properties.name,
        description: properties.description,
        coordinates,
      };

      showPopup(popupData);
    },
    [showPopup, enableDrawing, drawInstance, drawActions]
  );

  /**
   * Handle clicks on settlement layer
   */
  const handleSettlementClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const properties = feature.properties as unknown as SettlementProperties;
      const geometry = feature.geometry;

      if (geometry.type !== 'Point') return;

      const popupData: PopupData = {
        type: 'settlement',
        id: properties.id,
        name: properties.name,
        level: properties.level,
        kingdomId: properties.kingdomId,
        typedVariables: properties.typedVariables,
        coordinates: geometry.coordinates as [number, number],
      };

      showPopup(popupData);
    },
    [showPopup]
  );

  /**
   * Handle clicks on structure layer
   */
  const handleStructureClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const properties = feature.properties as unknown as StructureProperties;
      const geometry = feature.geometry;

      if (geometry.type !== 'Point') return;

      const popupData: PopupData = {
        type: 'structure',
        id: properties.id,
        name: properties.name,
        structureType: properties.structureType,
        level: properties.level,
        settlementId: properties.settlementId,
        typedVariables: properties.typedVariables,
        coordinates: geometry.coordinates as [number, number],
      };

      showPopup(popupData);
    },
    [showPopup]
  );

  /**
   * Set up click handlers for all entity layers
   */
  useEffect(() => {
    if (!map.current) return;

    const mapInstance = map.current;

    // Add click handlers for all layers
    mapInstance.on('click', 'location-point-layer', handleLocationPointClick);
    mapInstance.on('click', 'location-region-layer', handleLocationRegionClick);
    mapInstance.on('click', 'settlement-layer', handleSettlementClick);
    mapInstance.on('click', 'structure-layer', handleStructureClick);

    // Change cursor to pointer when hovering over clickable layers
    const layers = [
      'location-point-layer',
      'location-region-layer',
      'settlement-layer',
      'structure-layer',
    ];

    const handleMouseEnter = () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = () => {
      mapInstance.getCanvas().style.cursor = '';
    };

    layers.forEach((layerId) => {
      mapInstance.on('mouseenter', layerId, handleMouseEnter);
      mapInstance.on('mouseleave', layerId, handleMouseLeave);
    });

    // Cleanup
    return () => {
      mapInstance.off('click', 'location-point-layer', handleLocationPointClick);
      mapInstance.off('click', 'location-region-layer', handleLocationRegionClick);
      mapInstance.off('click', 'settlement-layer', handleSettlementClick);
      mapInstance.off('click', 'structure-layer', handleStructureClick);

      layers.forEach((layerId) => {
        mapInstance.off('mouseenter', layerId, handleMouseEnter);
        mapInstance.off('mouseleave', layerId, handleMouseLeave);
      });
    };
  }, [
    handleLocationPointClick,
    handleLocationRegionClick,
    handleSettlementClick,
    handleStructureClick,
  ]);

  /**
   * Set up keyboard shortcuts for undo/redo when drawing is enabled
   */
  useEffect(() => {
    if (!enableDrawing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Z (undo) or Cmd+Z on Mac
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        drawActions.undo();
      }

      // Check for Ctrl+Shift+Z (redo) or Cmd+Shift+Z on Mac
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        drawActions.redo();
      }

      // Also support Ctrl+Y (redo) on Windows
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        drawActions.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableDrawing, drawActions]);

  // Determine overall loading state
  const isLoading = timeLoading || locationsLoading || settlementsLoading;

  // Determine overall error state
  const hasError = locationsError || settlementsError;
  const errorMessage =
    locationsError?.message || settlementsError?.message || 'Failed to load map data';

  // Determine empty state (no data available after loading completes)
  const isEmpty =
    !isLoading &&
    !hasError &&
    Boolean(worldId || kingdomId) && // Only show empty if we're trying to load data
    locationCount === 0 &&
    settlementCount === 0;

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

      {/* Drawing controls (conditionally rendered) */}
      {enableDrawing && (
        <>
          <DrawControl
            map={map.current}
            position="top-left"
            styles={drawStyles}
            onCreate={handleFeatureCreated}
            onUpdate={(features) => {
              if (features.length > 0) {
                handleFeatureUpdated(features[0]);
              }
            }}
            onDelete={(features) => {
              void features;
              drawActions.clearFeature();
            }}
            onSelectionChange={(features) => {
              // When user clicks on a drawn feature, enter edit mode
              if (features.length > 0 && features[0].id) {
                drawActions.startEdit(features[0].id as string);
              }
            }}
            onDrawReady={setDrawInstance}
          />
          <DrawToolbar
            mode={drawState.mode}
            hasUnsavedChanges={drawState.hasUnsavedChanges}
            currentFeature={drawState.currentFeature}
            validationResult={drawState.validationResult}
            onStartDrawPoint={drawActions.startDrawPoint}
            onStartDrawPolygon={drawActions.startDrawPolygon}
            onSave={async () => {
              try {
                await drawActions.saveFeature();
              } catch (error) {
                // Error message is already set in onSave callback via setSaveError
                // Don't need to do anything here - just prevent error propagation
                void error;
              }
            }}
            onCancel={() => {
              // If there are unsaved changes, confirm before discarding
              // TODO: Replace window.confirm with custom async dialog component for better UX/accessibility
              if (drawState.hasUnsavedChanges) {
                const confirmed = window.confirm(
                  'You have unsaved changes. Are you sure you want to discard them?'
                );
                if (!confirmed) {
                  return; // User cancelled the cancel action
                }
              }
              // Clear error state when cancelling
              setSaveError(null);
              // Proceed with cancel
              drawActions.cancelDraw();
            }}
            isSaving={isSaving}
          />
          {/* Undo/Redo controls (only shown when editing) */}
          {(drawState.mode === 'edit' ||
            drawState.mode === 'draw_point' ||
            drawState.mode === 'draw_polygon') && (
            <UndoRedoControls
              canUndo={drawState.canUndo}
              canRedo={drawState.canRedo}
              onUndo={drawActions.undo}
              onRedo={drawActions.redo}
            />
          )}
          {/* Error message display */}
          {saveError && (
            <div
              className="absolute top-32 left-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded shadow-md max-w-sm"
              role="alert"
              data-testid="save-error-message"
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{saveError}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    type="button"
                    className="inline-flex text-red-400 hover:text-red-500 focus:outline-none"
                    onClick={() => setSaveError(null)}
                    aria-label="Dismiss error"
                  >
                    <svg
                      className="h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reset viewport button */}
      <button
        onClick={resetViewport}
        className="absolute top-4 left-4 bg-white hover:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        data-testid="reset-viewport-button"
        aria-label="Reset map viewport to initial position"
      >
        Reset View
      </button>

      {/* Layer toggle controls */}
      <LayerControls
        layerVisibility={layerVisibility}
        onToggle={toggleLayerVisibility}
        className="absolute top-4 right-4 mt-20"
      />

      {/* Time scrubber (only shown if campaignId provided) */}
      {campaignId && (
        <TimeScrubber
          currentTime={currentTime}
          selectedTime={selectedTime}
          onTimeChange={setSelectedTime}
          loading={timeLoading}
        />
      )}

      {/* Loading state */}
      {isLoading && <LoadingSpinner message="Loading map data..." />}

      {/* Error state */}
      {!isLoading && hasError && (
        <ErrorMessage
          title="Error Loading Map Data"
          message={errorMessage}
          onRetry={() => window.location.reload()}
        />
      )}

      {/* Empty state */}
      {isEmpty && (
        <EmptyState
          title="No Map Data Available"
          message="There are no locations or settlements to display on the map."
        />
      )}

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
