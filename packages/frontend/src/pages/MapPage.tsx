import { useState } from 'react';

import { Map, ViewportState } from '@/components/features/map';

/**
 * Map page component (protected route)
 *
 * Interactive map view for visualizing campaign world, locations, settlements, and structures.
 *
 * TODO: Get worldId from campaign context or route params when available
 */
export default function MapPage() {
  const [viewport, setViewport] = useState<ViewportState>({
    center: [0, 0],
    zoom: 2,
    bounds: null,
  });

  // TODO: Replace with actual worldId, kingdomId, and campaignId from campaign context
  // For now, using placeholders to demonstrate layer rendering and time scrubber
  const worldId = 'world-placeholder-id';
  const kingdomId = 'kingdom-placeholder-id';
  const campaignId = 'campaign-placeholder-id';

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
        />
      </main>

      {/* Footer with viewport info */}
      <footer className="bg-white border-t border-gray-200 px-6 py-2 text-xs text-gray-600 flex-shrink-0">
        Viewing: Zoom {viewport.zoom.toFixed(1)} | Center: {viewport.center[0].toFixed(2)},{' '}
        {viewport.center[1].toFixed(2)}
      </footer>
    </div>
  );
}
