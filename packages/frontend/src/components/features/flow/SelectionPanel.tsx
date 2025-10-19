import type { Node } from '@xyflow/react';
import { X } from 'lucide-react';
import { memo } from 'react';

import type { FlowNodeData } from '@/utils';

/**
 * Props for SelectionPanel component
 */
export type SelectionPanelProps = {
  /** Selected nodes to display information about */
  selectedNodes: Node<FlowNodeData>[];
  /** Number of upstream dependencies */
  upstreamCount: number;
  /** Number of downstream dependents */
  downstreamCount: number;
  /** Callback to clear selection */
  onClearSelection: () => void;
};

/**
 * SelectionPanel - Display information about selected nodes
 *
 * Shows details about the current selection including:
 * - Selected node names and types
 * - Upstream dependency count
 * - Downstream dependent count
 * - Legend explaining highlight colors
 *
 * Part of TICKET-021 Stage 8: Selection and Highlighting
 */
export const SelectionPanel = memo<SelectionPanelProps>(
  ({ selectedNodes, upstreamCount, downstreamCount, onClearSelection }) => {
    // Don't render if nothing is selected
    if (selectedNodes.length === 0) {
      return null;
    }

    return (
      <div className="absolute bottom-4 left-4 bg-card border rounded-lg p-4 shadow-lg max-w-sm z-10">
        {/* Header with clear button */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">
            Selection {selectedNodes.length > 1 && `(${selectedNodes.length})`}
          </h3>
          <button
            onClick={onClearSelection}
            className="p-1 hover:bg-accent rounded transition-colors"
            aria-label="Clear selection"
            title="Clear selection (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected nodes list */}
        <div className="space-y-2 mb-3">
          {selectedNodes.map((node) => (
            <div key={node.id} className="text-sm">
              <div className="font-medium truncate" title={node.data.label}>
                {node.data.label}
              </div>
              <div className="text-xs text-muted-foreground">{node.data.nodeType}</div>
            </div>
          ))}
        </div>

        {/* Dependency counts */}
        <div className="text-sm space-y-1 mb-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Upstream dependencies:</span>
            <span className="font-medium">{upstreamCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Downstream dependents:</span>
            <span className="font-medium">{downstreamCount}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="pt-3 border-t">
          <div className="text-xs font-medium mb-2">Highlight Legend:</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 border-2 border-blue-500 rounded" />
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 border-2 border-green-500 rounded" />
              <span>Upstream (dependencies)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 border-2 border-orange-500 rounded" />
              <span>Downstream (dependents)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

SelectionPanel.displayName = 'SelectionPanel';
