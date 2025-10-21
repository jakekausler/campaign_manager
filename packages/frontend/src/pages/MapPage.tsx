import { useState, useEffect } from 'react';

import { SelectionInfo } from '@/components';
import { EntityInspector } from '@/components/features/entity-inspector';
import { Map, ViewportState } from '@/components/features/map';
import { useSelectionStore, EntityType } from '@/stores';

/**
 * Map page component (protected route)
 *
 * Interactive map view for visualizing campaign world, locations, settlements, and structures.
 *
 * Features:
 * - Interactive map with settlements and structures
 * - Entity inspector for viewing detailed entity information
 * - Click settlements/structures on map to open inspector
 *
 * TODO: Get worldId from campaign context or route params when available
 */
export default function MapPage() {
  const [viewport, setViewport] = useState<ViewportState>({
    center: [0, 0],
    zoom: 2,
    bounds: null,
  });

  // Entity inspector state
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'settlement' | 'structure';
    id: string;
  } | null>(null);

  // Selection store for cross-view synchronization
  const { selectEntity, toggleSelection, clearSelection } = useSelectionStore();

  // Handle entity selection from map
  // This function handles both local inspector state AND cross-view selection state
  const handleEntitySelect = (
    type: 'settlement' | 'structure',
    id: string,
    event?: { ctrlKey?: boolean; metaKey?: boolean },
    metadata?: { locationId?: string; settlementId?: string }
  ) => {
    // Create SelectedEntity for cross-view synchronization
    const entity = {
      id,
      type: type === 'settlement' ? EntityType.SETTLEMENT : EntityType.STRUCTURE,
      metadata,
    };

    // Check if Ctrl/Cmd key is pressed for multi-select
    const isMultiSelect = event?.ctrlKey || event?.metaKey;

    if (isMultiSelect) {
      // Multi-select: toggle entity in selection
      toggleSelection(entity);
      // Don't open inspector for multi-select
    } else {
      // Single-select: update global selection state
      selectEntity(entity);
      // Open inspector for single-select
      setSelectedEntity({ type, id });
      setInspectorOpen(true);
    }
  };

  // Handle inspector close
  const handleInspectorClose = () => {
    setInspectorOpen(false);
    // Don't clear selectedEntity immediately to allow smooth close animation
    setTimeout(() => setSelectedEntity(null), 300);
  };

  // TODO: Replace with actual worldId, kingdomId, and campaignId from campaign context
  // For now, using placeholders to demonstrate layer rendering and time scrubber
  const worldId = 'world-placeholder-id';
  const kingdomId = 'kingdom-placeholder-id';
  const campaignId = 'campaign-placeholder-id';

  // Keyboard shortcuts for selection management
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape: clear selection
      if (event.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);

  return (
    <div className="h-screen flex flex-col">
      {/* Page header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Campaign Map</h1>
          <p className="text-sm text-muted-foreground">Interactive view of your campaign world</p>
        </div>
      </header>

      {/* Map container - takes remaining viewport height */}
      <main className="flex-1 relative">
        <Map
          initialCenter={[0, 0]}
          initialZoom={2}
          onViewportChange={setViewport}
          worldId={worldId}
          kingdomId={kingdomId}
          campaignId={campaignId}
          onEntitySelect={handleEntitySelect}
        />
      </main>

      {/* Footer with viewport info */}
      <footer className="bg-white border-t border-gray-200 px-6 py-2 text-xs text-gray-600 flex-shrink-0">
        Viewing: Zoom {viewport.zoom.toFixed(1)} | Center: {viewport.center[0].toFixed(2)},{' '}
        {viewport.center[1].toFixed(2)}
      </footer>

      {/* Entity Inspector */}
      {selectedEntity && (
        <EntityInspector
          entityType={selectedEntity.type}
          entityId={selectedEntity.id}
          isOpen={inspectorOpen}
          onClose={handleInspectorClose}
        />
      )}

      {/* Selection Info - shows selected entities count and list */}
      <SelectionInfo />
    </div>
  );
}
