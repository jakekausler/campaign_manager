import { X } from 'lucide-react';

import { useSelectionStore } from '@/stores';

/**
 * SelectionInfo - Visual indicator for cross-view entity selection
 *
 * Displays a floating panel showing the count and list of currently selected
 * entities across all views (Map, Flow, Timeline). Provides a "Clear Selection"
 * button for easy deselection.
 *
 * Features:
 * - Shows count of selected entities
 * - Lists entity names and types
 * - Clear selection button
 * - Auto-hides when no selection
 * - Positioned in bottom-right corner
 * - Keyboard accessible (Escape to clear)
 *
 * Part of TICKET-024 Stage 6 implementation (Cross-View Synchronization).
 */
export function SelectionInfo() {
  const { selectedEntities, clearSelection } = useSelectionStore();

  // Don't render if no entities selected
  if (selectedEntities.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm"
      role="status"
      aria-live="polite"
      aria-label={`${selectedEntities.length} ${selectedEntities.length === 1 ? 'entity' : 'entities'} selected`}
    >
      {/* Header with count and clear button */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-900">
          {selectedEntities.length} {selectedEntities.length === 1 ? 'Entity' : 'Entities'} Selected
        </div>
        <button
          onClick={clearSelection}
          className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded p-1"
          aria-label="Clear selection"
          title="Clear selection (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Entity list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {selectedEntities.map((entity) => (
          <div
            key={`${entity.type}-${entity.id}`}
            className="text-sm text-gray-700 flex items-start gap-2"
          >
            {/* Entity type badge */}
            <span
              className={`
                inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0
                ${entity.type === 'SETTLEMENT' ? 'bg-purple-100 text-purple-800' : ''}
                ${entity.type === 'STRUCTURE' ? 'bg-blue-100 text-blue-800' : ''}
                ${entity.type === 'EVENT' ? 'bg-green-100 text-green-800' : ''}
                ${entity.type === 'ENCOUNTER' ? 'bg-orange-100 text-orange-800' : ''}
              `}
            >
              {entity.type}
            </span>

            {/* Entity name */}
            <span className="truncate" title={entity.name || entity.id}>
              {entity.name || entity.id}
            </span>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
        Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">Esc</kbd> to
        clear selection
      </div>
    </div>
  );
}
