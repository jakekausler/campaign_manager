import MapboxDraw from 'maplibre-gl-draw';
import { useEffect, useRef, useState, useCallback } from 'react';

import { validateGeometry, type ValidationResult } from '../../../utils/geometry-validation';

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
 * Metadata about the location being edited
 */
export interface LocationEditMetadata {
  /** Database location ID */
  locationId: string;
  /** Current version (for optimistic locking) */
  version: number;
  /** Location type ("point" | "region") */
  type: string;
}

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
  /** Validation result for the current feature */
  validationResult: ValidationResult | null;
  /** ID of the feature being edited (null if creating new) */
  editFeatureId: string | null;
  /** Metadata about the location being edited (null if creating new or not editing) */
  editLocationMetadata: LocationEditMetadata | null;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
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
  startEdit: (featureId: string, locationMetadata?: LocationEditMetadata) => void;
  /** Exit current mode and return to view */
  cancelDraw: () => void;
  /** Save the current feature */
  saveFeature: () => Promise<void>;
  /** Clear the current feature from the map */
  clearFeature: () => void;
  /** Undo the last geometry change */
  undo: () => void;
  /** Redo the last undone change */
  redo: () => void;
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
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [editFeatureId, setEditFeatureId] = useState<string | null>(null);
  const [editLocationMetadata, setEditLocationMetadata] = useState<LocationEditMetadata | null>(
    null
  );

  // Undo/redo history stacks
  const [undoStack, setUndoStack] = useState<DrawFeature[]>([]);
  const [redoStack, setRedoStack] = useState<DrawFeature[]>([]);

  // Maximum history size
  const MAX_HISTORY_SIZE = 50;

  // Store draw instance in ref for access in callbacks
  const drawRef = useRef<MapboxDraw | null>(drawInstance);
  useEffect(() => {
    drawRef.current = drawInstance;
  }, [drawInstance]);

  /**
   * Helper to clear undo/redo history
   */
  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

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
    setValidationResult(null);
    setEditFeatureId(null);
    setEditLocationMetadata(null);
    clearHistory();
  }, [clearHistory]);

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
    setValidationResult(null);
    setEditFeatureId(null);
    setEditLocationMetadata(null);
    clearHistory();
  }, [clearHistory]);

  /**
   * Enter edit mode for an existing feature
   */
  const startEdit = useCallback(
    (featureId: string, locationMetadata?: LocationEditMetadata) => {
      if (!drawRef.current) return;

      // Get the feature from the draw instance
      const feature = drawRef.current.get(featureId);
      if (!feature) {
        console.error(`Feature with ID ${featureId} not found in draw control`);
        return;
      }

      // Change to direct_select mode to allow vertex manipulation
      drawRef.current.changeMode('direct_select', { featureId });

      // Update state
      setMode('edit');
      setEditFeatureId(featureId);
      setEditLocationMetadata(locationMetadata || null);
      setCurrentFeature(feature as DrawFeature);
      setHasUnsavedChanges(false); // No changes yet until user modifies

      // Validate the feature
      const validation = validateGeometry(feature as DrawFeature);
      setValidationResult(validation);

      // Clear history when entering edit mode
      clearHistory();
    },
    [clearHistory]
  );

  /**
   * Cancel current drawing/editing and return to view mode
   */
  const cancelDraw = useCallback(() => {
    if (!drawRef.current) return;

    // If we were editing, keep the original feature
    // If we were creating, delete the feature
    if (!editFeatureId && currentFeature) {
      drawRef.current.delete(currentFeature.id || '');
    }

    // Change to simple_select mode (non-interactive viewing)
    drawRef.current.changeMode('simple_select');

    // Reset state
    setMode('none');
    setCurrentFeature(null);
    setHasUnsavedChanges(false);
    setValidationResult(null);
    setEditFeatureId(null);
    setEditLocationMetadata(null);
    clearHistory();
  }, [editFeatureId, currentFeature, clearHistory]);

  /**
   * Clear the current feature from the map
   */
  const clearFeature = useCallback(() => {
    if (!drawRef.current) return;

    drawRef.current.deleteAll();
    setCurrentFeature(null);
    setHasUnsavedChanges(false);
    setValidationResult(null);
    setEditFeatureId(null);
    setEditLocationMetadata(null);
    clearHistory();
  }, [clearHistory]);

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

      // Clear history after successful save
      clearHistory();
    } catch (error) {
      // Error handling is delegated to the onSave callback
      // The caller should handle error display
      console.error('Failed to save feature:', error);
      throw error;
    }
  }, [currentFeature, onSave, clearFeature, clearHistory]);

  /**
   * Handle feature creation events
   */
  const handleFeatureCreated = useCallback(
    (feature: DrawFeature) => {
      setCurrentFeature(feature);
      setHasUnsavedChanges(true);

      // Validate the feature
      const validation = validateGeometry(feature);
      setValidationResult(validation);

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
      // Push current feature to undo stack before updating
      if (currentFeature) {
        setUndoStack((prev) => {
          const newStack = [...prev, currentFeature];
          // Limit stack size to MAX_HISTORY_SIZE
          if (newStack.length > MAX_HISTORY_SIZE) {
            return newStack.slice(1); // Remove oldest entry
          }
          return newStack;
        });

        // Clear redo stack when a new change is made
        setRedoStack([]);
      }

      setCurrentFeature(feature);
      setHasUnsavedChanges(true);

      // Validate the updated feature
      const validation = validateGeometry(feature);
      setValidationResult(validation);

      if (onFeatureUpdated) {
        onFeatureUpdated(feature);
      }
    },
    [onFeatureUpdated, currentFeature, MAX_HISTORY_SIZE]
  );

  /**
   * Undo the last geometry change
   */
  const undo = useCallback(() => {
    if (!drawRef.current || undoStack.length === 0 || !currentFeature) return;

    // Pop from undo stack
    const previousFeature = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    // Push current feature to redo stack
    setRedoStack((prev) => [...prev, currentFeature]);

    // Update the feature in the draw control
    drawRef.current.delete(currentFeature.id || '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    drawRef.current.add(previousFeature as any);

    // If we're in edit mode, re-enter direct_select mode
    if (mode === 'edit' && previousFeature.id) {
      drawRef.current.changeMode('direct_select', { featureId: previousFeature.id });
    }

    // Update state
    setCurrentFeature(previousFeature);

    // Validate the restored feature
    const validation = validateGeometry(previousFeature);
    setValidationResult(validation);
  }, [undoStack, currentFeature, mode]);

  /**
   * Redo the last undone change
   */
  const redo = useCallback(() => {
    if (!drawRef.current || redoStack.length === 0 || !currentFeature) return;

    // Pop from redo stack
    const nextFeature = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    // Push current feature to undo stack
    setUndoStack((prev) => [...prev, currentFeature]);

    // Update the feature in the draw control
    drawRef.current.delete(currentFeature.id || '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    drawRef.current.add(nextFeature as any);

    // If we're in edit mode, re-enter direct_select mode
    if (mode === 'edit' && nextFeature.id) {
      drawRef.current.changeMode('direct_select', { featureId: nextFeature.id });
    }

    // Update state
    setCurrentFeature(nextFeature);

    // Validate the restored feature
    const validation = validateGeometry(nextFeature);
    setValidationResult(validation);
  }, [redoStack, currentFeature, mode]);

  // Expose state and actions
  const state: MapDrawState = {
    mode,
    currentFeature,
    hasUnsavedChanges,
    drawInstance: drawRef.current,
    validationResult,
    editFeatureId,
    editLocationMetadata,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };

  const actions: MapDrawActions = {
    startDrawPoint,
    startDrawPolygon,
    startEdit,
    cancelDraw,
    saveFeature,
    clearFeature,
    undo,
    redo,
  };

  return { state, actions, handleFeatureCreated, handleFeatureUpdated };
}
