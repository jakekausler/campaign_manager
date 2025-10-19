import { useMemo } from 'react';

import { calculatePolygonArea, countPolygonVertices, formatArea } from '../../../utils/geometry';
import type { ValidationResult } from '../../../utils/geometry-validation';

import type { DrawMode, DrawFeature } from './useMapDraw';

/**
 * Props for DrawToolbar component
 */
export interface DrawToolbarProps {
  /** Current drawing mode */
  mode: DrawMode;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Current feature being drawn/edited (for showing stats) */
  currentFeature?: DrawFeature | null;
  /** Validation result for the current feature */
  validationResult?: ValidationResult | null;
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
  currentFeature,
  validationResult,
  onStartDrawPoint,
  onStartDrawPolygon,
  onSave,
  onCancel,
  isSaving = false,
}: DrawToolbarProps) {
  // Calculate polygon stats if we're drawing a polygon
  // Use useMemo to avoid expensive recalculation on every render
  const polygonStats = useMemo(() => {
    const isPolygon =
      currentFeature?.geometry.type === 'Polygon' &&
      Array.isArray(currentFeature.geometry.coordinates);

    if (!isPolygon || !currentFeature) {
      return null;
    }

    return {
      vertices: countPolygonVertices(
        currentFeature.geometry.coordinates as number[][] | number[][][]
      ),
      area: calculatePolygonArea(currentFeature.geometry.coordinates as number[][] | number[][][]),
    };
  }, [currentFeature]);
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

  // Check if current feature is valid
  const isValid = validationResult?.isValid ?? true;
  const hasValidationErrors = validationResult && !validationResult.isValid;

  // In draw/edit mode with unsaved changes, show save/cancel buttons
  if (hasUnsavedChanges) {
    return (
      <div className="absolute top-4 left-32 flex flex-col gap-2">
        <div className="flex gap-2">
          {/* Show polygon stats if available */}
          {polygonStats && (
            <div className="bg-white bg-opacity-90 text-gray-700 font-medium py-2 px-4 rounded shadow-md flex items-center gap-4">
              <span className="text-sm">
                <span className="font-semibold">{polygonStats.vertices}</span> vertices
              </span>
              <span className="text-sm border-l border-gray-300 pl-4">
                <span className="font-semibold">{formatArea(polygonStats.area)}</span> area
              </span>
            </div>
          )}
          <button
            onClick={onSave}
            disabled={isSaving || !isValid}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
            data-testid="save-feature-button"
            aria-label="Save the drawn feature"
            title={!isValid ? 'Cannot save: validation errors present' : undefined}
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
        {/* Show validation errors */}
        {hasValidationErrors && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md"
            role="alert"
            data-testid="validation-errors"
          >
            <div className="font-semibold text-sm mb-1">Validation Errors:</div>
            <ul className="list-disc list-inside text-sm space-y-1">
              {validationResult.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
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
