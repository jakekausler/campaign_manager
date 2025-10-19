import { Search, X, Filter } from 'lucide-react';
import { memo } from 'react';

import { Button } from '@/components/ui';
import type { DependencyEdgeType, DependencyNodeType } from '@/services/api/hooks';
import type { GraphFilters } from '@/utils';
import { NODE_COLORS } from '@/utils/node-colors';

export type FilterPanelProps = {
  /** Current filter configuration */
  filters: GraphFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: GraphFilters) => void;
  /** Callback when clear filters is clicked */
  onClearFilters: () => void;
  /** Total count of each node type (for displaying counts) */
  nodeTypeCounts: {
    VARIABLE: number;
    CONDITION: number;
    EFFECT: number;
    ENTITY: number;
  };
  /** Total count of each edge type (for displaying counts) */
  edgeTypeCounts: {
    READS: number;
    WRITES: number;
    DEPENDS_ON: number;
  };
  /** Whether any filters are active */
  hasActiveFilters: boolean;
};

/**
 * FilterPanel - Filter controls for dependency graph visualization.
 *
 * Provides:
 * - Search input to filter nodes by label
 * - Multi-select checkboxes for node types
 * - Multi-select checkboxes for edge types
 * - Toggle for "Show cycles only"
 * - Toggle for "Show selected and connected only"
 * - Clear all filters button
 *
 * Part of TICKET-021 Stage 11 implementation.
 */
const FilterPanel = memo<FilterPanelProps>(
  ({
    filters,
    onFiltersChange,
    onClearFilters,
    nodeTypeCounts,
    edgeTypeCounts,
    hasActiveFilters,
  }) => {
    // Handle search query change
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({
        ...filters,
        searchQuery: e.target.value,
      });
    };

    // Handle node type filter toggle
    const handleNodeTypeToggle = (nodeType: DependencyNodeType) => {
      const newNodeTypes = new Set(filters.nodeTypes);
      if (newNodeTypes.has(nodeType)) {
        newNodeTypes.delete(nodeType);
      } else {
        newNodeTypes.add(nodeType);
      }
      onFiltersChange({
        ...filters,
        nodeTypes: newNodeTypes,
      });
    };

    // Handle edge type filter toggle
    const handleEdgeTypeToggle = (edgeType: DependencyEdgeType) => {
      const newEdgeTypes = new Set(filters.edgeTypes);
      if (newEdgeTypes.has(edgeType)) {
        newEdgeTypes.delete(edgeType);
      } else {
        newEdgeTypes.add(edgeType);
      }
      onFiltersChange({
        ...filters,
        edgeTypes: newEdgeTypes,
      });
    };

    // Handle cycles only toggle
    const handleCyclesOnlyToggle = () => {
      onFiltersChange({
        ...filters,
        showCyclesOnly: !filters.showCyclesOnly,
      });
    };

    // Handle selected only toggle
    const handleSelectedOnlyToggle = () => {
      onFiltersChange({
        ...filters,
        showSelectedOnly: !filters.showSelectedOnly,
      });
    };

    return (
      <div className="absolute top-4 left-4 bg-card border rounded-lg shadow-lg max-w-xs z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Filters</h3>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-6 px-2 text-xs"
              title="Clear all filters"
              aria-label="Clear all filters"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Search Input */}
        <div className="p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={filters.searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Search nodes by label"
            />
          </div>

          {/* Node Type Filters */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Node Types</div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.nodeTypes.has('VARIABLE')}
                  onChange={() => handleNodeTypeToggle('VARIABLE')}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: NODE_COLORS.VARIABLE.bg }}
                />
                <span>Variables ({nodeTypeCounts.VARIABLE})</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.nodeTypes.has('CONDITION')}
                  onChange={() => handleNodeTypeToggle('CONDITION')}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: NODE_COLORS.CONDITION.bg }}
                />
                <span>Conditions ({nodeTypeCounts.CONDITION})</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.nodeTypes.has('EFFECT')}
                  onChange={() => handleNodeTypeToggle('EFFECT')}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: NODE_COLORS.EFFECT.bg }}
                />
                <span>Effects ({nodeTypeCounts.EFFECT})</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.nodeTypes.has('ENTITY')}
                  onChange={() => handleNodeTypeToggle('ENTITY')}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: NODE_COLORS.ENTITY.bg }}
                />
                <span>Entities ({nodeTypeCounts.ENTITY})</span>
              </label>
            </div>
          </div>

          {/* Edge Type Filters */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Edge Types</div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.edgeTypes.has('READS')}
                  onChange={() => handleEdgeTypeToggle('READS')}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>Reads ({edgeTypeCounts.READS})</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.edgeTypes.has('WRITES')}
                  onChange={() => handleEdgeTypeToggle('WRITES')}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>Writes ({edgeTypeCounts.WRITES})</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.edgeTypes.has('DEPENDS_ON')}
                  onChange={() => handleEdgeTypeToggle('DEPENDS_ON')}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>Dependencies ({edgeTypeCounts.DEPENDS_ON})</span>
              </label>
            </div>
          </div>

          {/* Special Filters */}
          <div className="pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-2">Special Filters</div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showCyclesOnly}
                  onChange={handleCyclesOnlyToggle}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>Show cycles only</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showSelectedOnly}
                  onChange={handleSelectedOnlyToggle}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>Show selected and connected</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

FilterPanel.displayName = 'FilterPanel';

export { FilterPanel };
