import { X, ArrowUpFromLine } from 'lucide-react';
import { useMemo } from 'react';

import { useSettlementDetails } from '@/services/api/hooks';
import { useSelectionStore, EntityType } from '@/stores';

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
 * - Shows parent Settlement for selected Structures
 * - Clear selection button
 * - Auto-hides when no selection
 * - Positioned in bottom-right corner
 * - Keyboard accessible (Escape to clear)
 *
 * Part of TICKET-024 Stage 6 & 7 implementation (Cross-View Synchronization).
 */
export function SelectionInfo() {
  const { selectedEntities, clearSelection } = useSelectionStore();

  // Extract parent settlement IDs from selected structures
  const parentSettlementIds = useMemo(() => {
    return selectedEntities
      .filter((e) => e.type === EntityType.STRUCTURE && e.metadata?.settlementId)
      .map((e) => ({ structureId: e.id, settlementId: e.metadata!.settlementId! }));
  }, [selectedEntities]);

  // Query parent settlement details (only query first one for now, to avoid excessive queries)
  const firstParentId = parentSettlementIds[0]?.settlementId ?? null;
  const isParentAlreadySelected = firstParentId
    ? selectedEntities.some((e) => e.type === EntityType.SETTLEMENT && e.id === firstParentId)
    : false;

  const { settlement: parentSettlement } = useSettlementDetails(firstParentId ?? '', {
    skip: !firstParentId || isParentAlreadySelected,
  });

  // Create a map of structure ID to parent settlement name
  const parentSettlementMap = useMemo(() => {
    const map = new Map<string, string>();
    if (parentSettlement && parentSettlementIds.length > 0) {
      const structureId = parentSettlementIds[0].structureId;
      map.set(structureId, parentSettlement.name);
    }
    return map;
  }, [parentSettlement, parentSettlementIds]);

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
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {selectedEntities.map((entity) => (
          <div key={`${entity.type}-${entity.id}`} className="text-sm text-gray-700">
            {/* Entity row */}
            <div className="flex items-start gap-2">
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

            {/* Parent Settlement info (only for Structures) */}
            {entity.type === EntityType.STRUCTURE && parentSettlementMap.has(entity.id) && (
              <div className="ml-6 mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <ArrowUpFromLine className="h-3 w-3" />
                <span>
                  in <span className="font-medium">{parentSettlementMap.get(entity.id)}</span>
                </span>
              </div>
            )}
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
