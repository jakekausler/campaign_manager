import {
  ArrowDownAZ,
  ArrowUpDown,
  Building2,
  Church,
  Swords,
  Store,
  BookOpen,
  Hammer,
  Beer,
  Castle,
  Search,
  Filter,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useStructuresForMap } from '@/services/api/hooks/structures';

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

export interface StructureListViewProps {
  /** The settlement ID to display structures for */
  settlementId: string;
  /** Callback when a structure is selected */
  onStructureSelect?: (structureId: string) => void;
}

type SortBy = 'name' | 'type' | 'level';
type SortOrder = 'asc' | 'desc';

/**
 * Map structure type to icon component
 */
const getStructureIcon = (type?: string) => {
  const iconClass = 'h-5 w-5 shrink-0';
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
 * Get all unique structure types from a list of structures
 */
const getUniqueTypes = (structures: StructureNode[]): string[] => {
  const types = structures
    .map((s) => s.type)
    .filter((t): t is string => t !== undefined && t !== null);
  return Array.from(new Set(types)).sort();
};

/**
 * StructureListView displays a filterable, sortable list of structures in a settlement.
 *
 * Features:
 * - Filter by structure type via dropdown
 * - Sort by name, type, or level (ascending/descending)
 * - Search by name with debouncing (300ms)
 * - Click to select structure (opens in Entity Inspector)
 * - Empty state when no structures match filters
 * - Loading and error states
 *
 * This component is designed to be integrated into the SettlementPanel to provide
 * a comprehensive list view with advanced filtering and sorting capabilities.
 *
 * @example
 * ```tsx
 * <StructureListView
 *   settlementId={settlement.id}
 *   onStructureSelect={(id) => openInspector({ id, type: EntityType.STRUCTURE })}
 * />
 * ```
 */
export function StructureListView({ settlementId, onStructureSelect }: StructureListViewProps) {
  const { structures, loading, error } = useStructuresForMap(settlementId);

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Debounce search query (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get unique types for filter dropdown
  const uniqueTypes = useMemo(() => getUniqueTypes(structures), [structures]);

  // Filter and sort structures
  const filteredAndSortedStructures = useMemo(() => {
    let result = [...structures];

    // Apply search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(query));
    }

    // Apply type filter
    if (filterType !== 'all') {
      result = result.filter((s) => s.type === filterType);
    }

    // Apply sorting
    result.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'type':
          compareValue = (a.type ?? '').localeCompare(b.type ?? '');
          break;
        case 'level':
          compareValue = (a.level ?? 0) - (b.level ?? 0);
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return result;
  }, [structures, debouncedSearchQuery, filterType, sortBy, sortOrder]);

  // Handle structure selection
  const handleStructureClick = (structureId: string) => {
    if (onStructureSelect) {
      onStructureSelect(structureId);
    }
  };

  // Toggle sort order or change sort field
  const handleSortChange = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-sm font-bold text-slate-900">Structures</h3>
          <p className="text-xs text-slate-500 mt-1">
            {filteredAndSortedStructures.length} of {structures.length} structure
            {structures.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Controls: Search, Filter, Sort */}
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter and Sort Controls */}
          <div className="flex gap-2">
            {/* Filter by Type */}
            <div className="flex-1">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                >
                  <option value="all">All Types</option>
                  {uniqueTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sort Controls */}
            <div className="flex gap-1">
              <Button
                variant={sortBy === 'name' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('name')}
                className="text-xs"
              >
                <ArrowDownAZ className="h-3.5 w-3.5 mr-1" />
                Name
                {sortBy === 'name' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </Button>
              <Button
                variant={sortBy === 'type' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('type')}
                className="text-xs"
              >
                Type
                {sortBy === 'type' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </Button>
              <Button
                variant={sortBy === 'level' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('level')}
                className="text-xs"
              >
                Level
                {sortBy === 'level' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Structure List */}
        <div className="space-y-2">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {error && (
            <div className="py-3 px-4 rounded-md bg-red-50 border border-red-200">
              <p className="text-xs font-semibold text-red-800">Failed to load structures</p>
              <p className="text-xs text-red-600 mt-1">{error.message}</p>
            </div>
          )}

          {!loading && !error && filteredAndSortedStructures.length === 0 && (
            <div className="py-8 text-center">
              <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">No structures found</p>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery || filterType !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'This settlement has no structures'}
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            filteredAndSortedStructures.map((structure) => (
              <button
                key={structure.id}
                onClick={() => handleStructureClick(structure.id)}
                className="w-full flex items-center gap-3 p-3 rounded-md border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
              >
                {/* Icon */}
                <div className="text-slate-600 group-hover:text-blue-600 transition-colors">
                  {getStructureIcon(structure.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-slate-900 truncate group-hover:text-blue-700">
                      {structure.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {structure.type && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">
                        {structure.type}
                      </span>
                    )}
                    {structure.level !== undefined && (
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                        Level {structure.level}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </button>
            ))}
        </div>
      </div>
    </Card>
  );
}
