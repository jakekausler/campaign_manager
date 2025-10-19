import type { DrawMode } from './useMapDraw';

/**
 * Props for DrawToolbar component
 */
export interface DrawToolbarProps {
  /** Current drawing mode */
  mode: DrawMode;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Callback to start drawing a point */
  onStartDrawPoint: () => void;
  /** Callback to start drawing a polygon */
  onStartDrawPolygon: () => void;
  /** Callback to save the current feature */
  onSave: () => void;
  /** Callback to cancel and discard changes */
  onCancel: () => void;
  /** Whether save operation is in progress */
  isSaving?: boolean;
}

/**
 * Toolbar for map drawing controls
 *
 * Displays buttons for activating drawing modes and saving/canceling edits.
 * Shows different UI states based on current mode and unsaved changes.
 *
 * @example
 * ```tsx
 * <DrawToolbar
 *   mode={state.mode}
 *   hasUnsavedChanges={state.hasUnsavedChanges}
 *   onStartDrawPoint={actions.startDrawPoint}
 *   onStartDrawPolygon={actions.startDrawPolygon}
 *   onSave={actions.saveFeature}
 *   onCancel={actions.cancelDraw}
 * />
 * ```
 */
export function DrawToolbar({
  mode,
  hasUnsavedChanges,
  onStartDrawPoint,
  onStartDrawPolygon,
  onSave,
  onCancel,
  isSaving = false,
}: DrawToolbarProps) {
  // In view mode, show create buttons
  if (mode === 'none') {
    return (
      <div className="absolute top-4 left-32 flex gap-2">
        <button
          onClick={onStartDrawPoint}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="start-draw-point-button"
          aria-label="Start drawing a point location"
        >
          Add Point
        </button>
        <button
          onClick={onStartDrawPolygon}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="start-draw-polygon-button"
          aria-label="Start drawing a polygon region"
        >
          Draw Region
        </button>
      </div>
    );
  }

  // In draw/edit mode with unsaved changes, show save/cancel buttons
  if (hasUnsavedChanges) {
    return (
      <div className="absolute top-4 left-32 flex gap-2">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
          data-testid="save-feature-button"
          aria-label="Save the drawn feature"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          data-testid="cancel-draw-button"
          aria-label="Cancel and discard changes"
        >
          Cancel
        </button>
      </div>
    );
  }

  // In draw/edit mode but no feature created yet, show instruction text
  return (
    <div className="absolute top-4 left-32 bg-white bg-opacity-90 text-gray-700 font-medium py-2 px-4 rounded shadow-md">
      {mode === 'draw_point' && 'Click on the map to place a point'}
      {mode === 'draw_polygon' && 'Click to add vertices, double-click to complete'}
      {mode === 'edit' && 'Drag vertices to edit the shape'}
    </div>
  );
}
