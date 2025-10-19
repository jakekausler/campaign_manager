import { memo } from 'react';

import type { EntityType, LayerVisibility } from './types';

interface LayerControlsProps {
  /**
   * Current layer visibility state
   */
  layerVisibility: LayerVisibility;

  /**
   * Callback to toggle layer visibility
   */
  onToggle: (entityType: EntityType) => void;

  /**
   * CSS class name for the controls container
   */
  className?: string;
}

/**
 * Layer type configuration for UI display
 */
const LAYER_CONFIGS: Record<EntityType, { label: string; color: string; description: string }> = {
  'location-point': {
    label: 'Location Points',
    color: 'bg-blue-500',
    description: 'Point locations on the map',
  },
  'location-region': {
    label: 'Location Regions',
    color: 'bg-blue-500',
    description: 'Regional areas on the map',
  },
  settlement: {
    label: 'Settlements',
    color: 'bg-green-500',
    description: 'Settlement markers',
  },
  structure: {
    label: 'Structures',
    color: 'bg-amber-500',
    description: 'Structure markers',
  },
};

/**
 * Map layer toggle controls component
 *
 * Provides checkboxes for toggling visibility of different map entity layers:
 * - Location Points (blue)
 * - Location Regions (blue)
 * - Settlements (green)
 * - Structures (amber)
 *
 * Memoized to prevent unnecessary re-renders when parent Map component updates.
 */
export const LayerControls = memo(function LayerControls({
  layerVisibility,
  onToggle,
  className = '',
}: LayerControlsProps) {
  const layers: EntityType[] = ['location-point', 'location-region', 'settlement', 'structure'];

  return (
    <div className={`bg-white rounded shadow-md p-4 ${className}`} data-testid="layer-controls">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Map Layers</h3>

      <div className="space-y-2">
        {layers.map((layerType) => {
          const config = LAYER_CONFIGS[layerType];
          const isVisible = layerVisibility[layerType];

          return (
            <label
              key={layerType}
              className="flex items-center space-x-2 cursor-pointer group"
              data-testid={`layer-toggle-${layerType}`}
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => onToggle(layerType)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                aria-label={`Toggle ${config.label}`}
                data-testid={`layer-checkbox-${layerType}`}
              />

              {/* Color indicator */}
              <span className={`w-3 h-3 rounded-full ${config.color}`} aria-hidden="true" />

              {/* Label */}
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                {config.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
});
