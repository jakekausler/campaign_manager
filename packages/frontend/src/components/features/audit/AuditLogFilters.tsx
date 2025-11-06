/**
 * AuditLogFilters Component
 * Provides filter controls for the audit log viewer (operations, dates, search)
 */

import { Search, X, Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuditEntry } from '@/services/api/hooks/audit';
import type { AuditLogFilters as Filters } from '@/utils/audit-filters';
import { ALL_OPERATIONS, hasActiveFilters } from '@/utils/audit-filters';

interface AuditLogFiltersProps {
  /**
   * Current filter values
   */
  filters: Filters;

  /**
   * Callback when filters change
   */
  onFiltersChange: (filters: Filters) => void;

  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Operation filter badge colors
 */
const OPERATION_COLORS: Record<AuditEntry['operation'], string> = {
  CREATE: 'bg-green-100 text-green-800 hover:bg-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  DELETE: 'bg-red-100 text-red-800 hover:bg-red-200',
  ARCHIVE: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
  RESTORE: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  FORK: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200',
  MERGE: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
  CHERRY_PICK: 'bg-pink-100 text-pink-800 hover:bg-pink-200',
};

/**
 * Helper function to get tooltip text for operation filter buttons
 */
function getOperationFilterTooltip(operation: AuditEntry['operation']): string {
  switch (operation) {
    case 'CREATE':
      return 'Show entity creation operations';
    case 'UPDATE':
      return 'Show entity modification operations';
    case 'DELETE':
      return 'Show entity deletion operations';
    case 'ARCHIVE':
      return 'Show entity archival operations';
    case 'RESTORE':
      return 'Show entity restoration operations';
    case 'FORK':
      return 'Show branch creation operations';
    case 'MERGE':
      return 'Show branch merge operations';
    case 'CHERRY_PICK':
      return 'Show cherry-pick operations from other branches';
    default:
      return 'Filter by this operation type';
  }
}

/**
 * AuditLogFilters component for filtering audit log entries
 *
 * Provides controls for:
 * - Operation type multi-select (checkboxes)
 * - Date range filtering (start/end dates)
 * - Entity ID search
 * - Clear filters button
 */
export function AuditLogFilters({
  filters,
  onFiltersChange,
  className = '',
}: AuditLogFiltersProps) {
  /**
   * Handle operation toggle (add/remove from filters)
   */
  const handleOperationToggle = (operation: AuditEntry['operation']) => {
    const isSelected = filters.operations.includes(operation);

    const newOperations = isSelected
      ? filters.operations.filter((op) => op !== operation) // Remove
      : [...filters.operations, operation]; // Add

    onFiltersChange({
      ...filters,
      operations: newOperations,
    });
  };

  /**
   * Handle start date change
   */
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      startDate: e.target.value,
    });
  };

  /**
   * Handle end date change
   */
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      endDate: e.target.value,
    });
  };

  /**
   * Handle search query change
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      searchQuery: e.target.value,
    });
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    onFiltersChange({
      operations: [],
      startDate: '',
      endDate: '',
      searchQuery: '',
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });
  };

  const isAnyFilterActive = hasActiveFilters(filters);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
          {isAnyFilterActive && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Operation Type Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium" title="Filter audit logs by operation type">
            Operation Types
          </Label>
          <div className="flex flex-wrap gap-2">
            {ALL_OPERATIONS.map((operation) => {
              const isSelected = filters.operations.includes(operation);
              const colorClass = OPERATION_COLORS[operation];
              const tooltip = getOperationFilterTooltip(operation);

              return (
                <button
                  key={operation}
                  type="button"
                  onClick={() => handleOperationToggle(operation)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium transition-all
                    ${isSelected ? colorClass : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                    ${isSelected ? 'ring-2 ring-offset-1 ring-current' : ''}
                  `}
                  aria-pressed={isSelected}
                  title={tooltip}
                >
                  {operation.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
          {filters.operations.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">{filters.operations.length} selected</p>
          )}
        </div>

        {/* Date Range Filter */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="start-date"
              className="text-sm font-medium"
              title="Filter audit logs from this date forward"
            >
              Start Date
            </Label>
            <Input
              id="start-date"
              type="date"
              value={filters.startDate}
              onChange={handleStartDateChange}
              max={filters.endDate || undefined}
              className="text-sm"
              title="Earliest date to include in results"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="end-date"
              className="text-sm font-medium"
              title="Filter audit logs up to this date"
            >
              End Date
            </Label>
            <Input
              id="end-date"
              type="date"
              value={filters.endDate}
              onChange={handleEndDateChange}
              min={filters.startDate || undefined}
              className="text-sm"
              title="Latest date to include in results"
            />
          </div>
        </div>

        {/* Search Filter */}
        <div className="space-y-1.5">
          <Label
            htmlFor="search-entity"
            className="text-sm font-medium"
            title="Search for specific entity IDs"
          >
            Search Entity ID
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="search-entity"
              type="text"
              placeholder="Filter by entity ID..."
              value={filters.searchQuery}
              onChange={handleSearchChange}
              className="pl-9 text-sm"
              title="Search for audit logs by entity ID"
            />
          </div>
        </div>

        {/* Active Filters Summary */}
        {isAnyFilterActive && (
          <div className="pt-2 border-t">
            <p className="text-xs text-gray-600">
              <span className="font-medium">Active filters:</span>{' '}
              {[
                filters.operations.length > 0 && `${filters.operations.length} operations`,
                filters.startDate && 'start date',
                filters.endDate && 'end date',
                filters.searchQuery && 'search',
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
