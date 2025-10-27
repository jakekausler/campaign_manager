import {
  ChevronDown,
  ChevronRight,
  Building2,
  Church,
  Swords,
  Store,
  BookOpen,
  Hammer,
  Beer,
  Castle,
} from 'lucide-react';
import { memo, useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStructuresForMap } from '@/services/api/hooks/structures';

import { AddStructureModal } from './AddStructureModal';

/**
 * Structure data as returned by useStructuresForMap hook
 */
export interface StructureNode {
  id: string;
  name: string;
  type?: string;
  level?: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface SettlementHierarchyPanelProps {
  /** The settlement ID to display hierarchy for */
  settlementId: string;
  /** The settlement name for display */
  settlementName: string;
  /** Settlement level */
  settlementLevel: number;
  /** Callback when a structure is selected */
  onStructureSelect?: (structureId: string) => void;
  /** Callback when "Add Structure" is clicked */
  onAddStructure?: () => void;
}

/**
 * Map structure type to icon component
 */
const getStructureIcon = (type?: string) => {
  const iconClass = 'h-4 w-4 shrink-0';
  switch (type?.toLowerCase()) {
    case 'temple':
      return <Church className={iconClass} />;
    case 'barracks':
      return <Swords className={iconClass} />;
    case 'market':
      return <Store className={iconClass} />;
    case 'library':
      return <BookOpen className={iconClass} />;
    case 'forge':
      return <Hammer className={iconClass} />;
    case 'tavern':
      return <Beer className={iconClass} />;
    case 'fortress':
    case 'citadel':
      return <Castle className={iconClass} />;
    default:
      return <Building2 className={iconClass} />;
  }
};

/**
 * TreeNode - Memoized component for rendering a single structure tree node
 * Prevents unnecessary re-renders when parent state changes
 */
interface TreeNodeProps {
  structure: StructureNode;
  onClick: (id: string) => void;
}

const TreeNode = memo(({ structure, onClick }: TreeNodeProps) => {
  const handleClick = useCallback(() => {
    onClick(structure.id);
  }, [onClick, structure.id]);

  return (
    <button
      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors text-left group"
      onClick={handleClick}
    >
      {getStructureIcon(structure.type)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-900 truncate group-hover:text-blue-700">
            {structure.name}
          </span>
          {structure.type && (
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-xs shrink-0">
              {structure.type}
            </span>
          )}
          {structure.level !== undefined && (
            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium shrink-0">
              L{structure.level}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});

TreeNode.displayName = 'TreeNode';

/**
 * SettlementHierarchyPanel displays a tree view of a Settlement and its Structures.
 *
 * Features:
 * - Tree visualization with Settlement as root and Structures as children
 * - Expand/collapse functionality for the structure list
 * - Quick stats (total structures, average structure level)
 * - Structure type icons
 * - Click to select structure (opens in Entity Inspector)
 * - "Add Structure" button integration
 * - React.memo for tree nodes to prevent unnecessary re-renders
 *
 * This component is designed to be integrated into the SettlementPanel's Details tab
 * to provide a hierarchical view of the settlement's structures.
 *
 * @example
 * ```tsx
 * <SettlementHierarchyPanel
 *   settlementId={settlement.id}
 *   settlementName={settlement.name}
 *   settlementLevel={settlement.level}
 *   onStructureSelect={(id) => openInspector({ id, type: EntityType.STRUCTURE })}
 *   onAddStructure={() => setShowAddModal(true)}
 * />
 * ```
 */
export function SettlementHierarchyPanel({
  settlementId,
  settlementName,
  settlementLevel,
  onStructureSelect,
  onAddStructure,
}: SettlementHierarchyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const { structures, loading, error } = useStructuresForMap(settlementId);

  // Calculate quick stats
  const totalStructures = structures.length;
  const averageLevel =
    totalStructures > 0
      ? structures.reduce((sum, s) => sum + (s.level ?? 0), 0) / totalStructures
      : 0;

  // Handle structure selection (memoized)
  const handleStructureClick = useCallback(
    (structureId: string) => {
      if (onStructureSelect) {
        onStructureSelect(structureId);
      }
    },
    [onStructureSelect]
  );

  // Handle "Add Structure" button click (memoized)
  const handleAddStructure = useCallback(() => {
    // Call parent callback if provided (for backward compatibility)
    if (onAddStructure) {
      onAddStructure();
    }
    // Open internal modal
    setShowAddModal(true);
  }, [onAddStructure]);

  // Handle successful structure creation (memoized)
  const handleStructureCreated = useCallback(
    (structureId: string) => {
      // Optionally, select the newly created structure
      if (onStructureSelect) {
        onStructureSelect(structureId);
      }
    },
    [onStructureSelect]
  );

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header with quick stats */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hierarchy</h3>
            <p className="text-xs text-slate-500 mt-1">
              {totalStructures} structure{totalStructures !== 1 ? 's' : ''}
              {totalStructures > 0 && ` • Avg. Level ${averageLevel.toFixed(1)}`}
            </p>
          </div>
          {onAddStructure && (
            <Button variant="outline" size="sm" onClick={handleAddStructure}>
              Add Structure
            </Button>
          )}
        </div>

        {/* Settlement Root Node */}
        <div className="space-y-2">
          <button
            className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 transition-colors text-left"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
            )}
            <Castle className="h-5 w-5 text-purple-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 truncate">
                  {settlementName}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium shrink-0">
                  Level {settlementLevel}
                </span>
              </div>
            </div>
          </button>

          {/* Structure Children (shown when expanded) */}
          {isExpanded && (
            <div className="ml-6 border-l-2 border-slate-200 pl-3 space-y-1">
              {loading && (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              )}

              {error && (
                <div className="py-2 px-3 rounded-md bg-red-50 border border-red-200">
                  <p className="text-xs text-red-800">Failed to load structures</p>
                  <p className="text-xs text-red-600 mt-1">{error.message}</p>
                </div>
              )}

              {!loading && !error && totalStructures === 0 && (
                <div className="py-3 px-3 text-center">
                  <p className="text-xs text-slate-500 italic">No structures in this settlement</p>
                  {onAddStructure && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddStructure}
                      className="mt-2"
                    >
                      Add First Structure
                    </Button>
                  )}
                </div>
              )}

              {!loading &&
                !error &&
                structures.map((structure) => (
                  <TreeNode
                    key={structure.id}
                    structure={structure}
                    onClick={handleStructureClick}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Structure Modal */}
      <AddStructureModal
        settlementId={settlementId}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleStructureCreated}
      />
    </Card>
  );
}
