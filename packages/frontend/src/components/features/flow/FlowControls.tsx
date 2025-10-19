import { Controls, MiniMap, useReactFlow } from '@xyflow/react';
import { useEffect, useState } from 'react';

import { NODE_COLORS } from '@/utils/node-colors';

/**
 * Interval (in milliseconds) for polling zoom level changes.
 * Using polling as React Flow doesn't provide a direct zoom change event.
 * 100ms provides smooth updates without significant performance impact.
 */
const ZOOM_POLL_INTERVAL_MS = 100;

/**
 * FlowControls - Navigation controls for the dependency graph
 *
 * Provides:
 * - MiniMap: Overview of entire graph with styled node colors
 * - Controls: Zoom in/out, fit view, lock/unlock
 * - Zoom Level Indicator: Real-time zoom percentage display
 *
 * Part of TICKET-021 Stage 7 implementation.
 */
export function FlowControls() {
  const { getZoom } = useReactFlow();
  const [zoomLevel, setZoomLevel] = useState(100);

  // Update zoom level indicator when viewport changes
  useEffect(() => {
    const updateZoom = () => {
      const currentZoom = getZoom();
      setZoomLevel(Math.round(currentZoom * 100));
    };

    // Initial zoom level
    updateZoom();

    // Poll for viewport changes at regular interval
    const interval = setInterval(updateZoom, ZOOM_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [getZoom]);

  return (
    <>
      {/* MiniMap with themed colors matching node types */}
      <MiniMap
        nodeColor={(node) => {
          switch (node.type) {
            case 'variable':
              return NODE_COLORS.VARIABLE.bg;
            case 'condition':
              return NODE_COLORS.CONDITION.bg;
            case 'effect':
              return NODE_COLORS.EFFECT.bg;
            case 'entity':
              return NODE_COLORS.ENTITY.bg;
            default:
              return '#94a3b8'; // slate-400
          }
        }}
        className="bg-card border rounded-lg shadow-lg"
        maskColor="rgba(0, 0, 0, 0.1)"
      />

      {/* Standard React Flow controls */}
      <Controls showInteractive={false} className="bg-card border rounded-lg shadow-lg" />

      {/* Zoom level indicator */}
      <div className="absolute bottom-4 left-4 bg-card border rounded-lg px-3 py-2 shadow-lg">
        <div className="text-sm font-medium text-muted-foreground">Zoom: {zoomLevel}%</div>
      </div>
    </>
  );
}
