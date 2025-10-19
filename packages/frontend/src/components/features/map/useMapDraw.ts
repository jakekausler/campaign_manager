import MapboxDraw from 'maplibre-gl-draw';
import { useEffect, useRef, useState, useCallback } from 'react';

import type { DrawFeature as DrawFeatureType } from './DrawControl';

/**
 * Re-export DrawFeature for convenience
 */
export type DrawFeature = DrawFeatureType;

/**
 * Drawing mode types
 */
export type DrawMode = 'none' | 'draw_point' | 'draw_polygon' | 'edit';

/**
 * State for the map drawing interface
 */
export interface MapDrawState {
  /** Current drawing mode */
  mode: DrawMode;
  /** Currently drawn/edited feature (unsaved) */
  currentFeature: DrawFeature | null;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Reference to the MapboxDraw instance */
  drawInstance: MapboxDraw | null;
}

/**
 * Actions for controlling the drawing interface
 */
export interface MapDrawActions {
  /** Activate point drawing mode */
  startDrawPoint: () => void;
  /** Activate polygon drawing mode */
  startDrawPolygon: () => void;
  /** Enter edit mode for existing feature */
  startEdit: (featureId: string) => void;
  /** Exit current mode and return to view */
  cancelDraw: () => void;
  /** Save the current feature */
  saveFeature: () => Promise<void>;
  /** Clear the current feature from the map */
  clearFeature: () => void;
}

/**
 * Options for useMapDraw hook
 */
export interface UseMapDrawOptions {
  /** Callback when a feature is created */
  onFeatureCreated?: (feature: DrawFeature) => void;
  /** Callback when a feature is updated */
  onFeatureUpdated?: (feature: DrawFeature) => void;
  /** Callback when save is requested */
  onSave?: (feature: DrawFeature) => Promise<void>;
}

/**
 * Custom hook for managing map drawing state and interactions
 *
 * Provides state management for drawing points and polygons on the map,
 * as well as editing existing geometry. Handles mode transitions and
 * unsaved changes tracking.
 *
 * @example
 * ```tsx
 * const { state, actions } = useMapDraw(drawInstance, {
 *   onSave: async (feature) => {
 *     await createLocation({ geometry: feature.geometry });
 *   }
 * });
 *
 * // Start drawing a point
 * <button onClick={actions.startDrawPoint}>Add Point</button>
 *
 * // Save the drawn feature
 * {state.hasUnsavedChanges && (
 *   <button onClick={actions.saveFeature}>Save</button>
 * )}
 * ```
 */
export function useMapDraw(
  drawInstance: MapboxDraw | null,
  options: UseMapDrawOptions = {}
): {
  state: MapDrawState;
  actions: MapDrawActions;
  handleFeatureCreated: (feature: DrawFeature) => void;
  handleFeatureUpdated: (feature: DrawFeature) => void;
} {
  const { onFeatureCreated, onFeatureUpdated, onSave } = options;

  // Internal state
  const [mode, setMode] = useState<DrawMode>('none');
  const [currentFeature, setCurrentFeature] = useState<DrawFeature | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Store draw instance in ref for access in callbacks
  const drawRef = useRef<MapboxDraw | null>(drawInstance);
  useEffect(() => {
    drawRef.current = drawInstance;
  }, [drawInstance]);

  /**
   * Activate point drawing mode
   */
  const startDrawPoint = useCallback(() => {
    if (!drawRef.current) return;

    // Clear any existing features
    drawRef.current.deleteAll();

    // Change mode to draw_point
    drawRef.current.changeMode('draw_point');
    setMode('draw_point');
    setCurrentFeature(null);
    setHasUnsavedChanges(false);
  }, []);

  /**
   * Activate polygon drawing mode
   */
  const startDrawPolygon = useCallback(() => {
    if (!drawRef.current) return;

    // Clear any existing features
    drawRef.current.deleteAll();

    // Change mode to draw_polygon
    drawRef.current.changeMode('draw_polygon');
    setMode('draw_polygon');
    setCurrentFeature(null);
    setHasUnsavedChanges(false);
  }, []);

  /**
   * Enter edit mode for an existing feature
   */
  const startEdit = useCallback((featureId: string) => {
    if (!drawRef.current) return;

    // Change to simple_select mode and select the feature
    drawRef.current.changeMode('simple_select', { featureIds: [featureId] });
    setMode('edit');
  }, []);

  /**
   * Cancel current drawing/editing and return to view mode
   */
  const cancelDraw = useCallback(() => {
    if (!drawRef.current) return;

    // Delete all drawn features
    drawRef.current.deleteAll();

    // Change to simple_select mode (non-interactive viewing)
    drawRef.current.changeMode('simple_select');

    // Reset state
    setMode('none');
    setCurrentFeature(null);
    setHasUnsavedChanges(false);
  }, []);

  /**
   * Clear the current feature from the map
   */
  const clearFeature = useCallback(() => {
    if (!drawRef.current) return;

    drawRef.current.deleteAll();
    setCurrentFeature(null);
    setHasUnsavedChanges(false);
  }, []);

  /**
   * Save the current feature
   */
  const saveFeature = useCallback(async () => {
    if (!currentFeature || !onSave) return;

    try {
      await onSave(currentFeature);

      // Clear the feature after successful save
      clearFeature();

      // Return to view mode
      setMode('none');
    } catch (error) {
      // Error handling is delegated to the onSave callback
      // The caller should handle error display
      console.error('Failed to save feature:', error);
      throw error;
    }
  }, [currentFeature, onSave, clearFeature]);

  /**
   * Handle feature creation events
   */
  const handleFeatureCreated = useCallback(
    (feature: DrawFeature) => {
      setCurrentFeature(feature);
      setHasUnsavedChanges(true);

      if (onFeatureCreated) {
        onFeatureCreated(feature);
      }
    },
    [onFeatureCreated]
  );

  /**
   * Handle feature update events
   */
  const handleFeatureUpdated = useCallback(
    (feature: DrawFeature) => {
      setCurrentFeature(feature);
      setHasUnsavedChanges(true);

      if (onFeatureUpdated) {
        onFeatureUpdated(feature);
      }
    },
    [onFeatureUpdated]
  );

  // Expose state and actions
  const state: MapDrawState = {
    mode,
    currentFeature,
    hasUnsavedChanges,
    drawInstance: drawRef.current,
  };

  const actions: MapDrawActions = {
    startDrawPoint,
    startDrawPolygon,
    startEdit,
    cancelDraw,
    saveFeature,
    clearFeature,
  };

  return { state, actions, handleFeatureCreated, handleFeatureUpdated };
}
