/**
 * Audit Log Filter Utilities
 * Utilities for managing audit log filter state and URL persistence
 */

import type { AuditEntry } from '@/services/api/hooks/audit';

/**
 * Type for sort field options
 */
export type AuditSortBy = 'timestamp' | 'operation' | 'entityType';

/**
 * Type for sort order
 */
export type SortOrder = 'asc' | 'desc';

/**
 * All available operation types for filtering
 */
export const ALL_OPERATIONS: AuditEntry['operation'][] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'ARCHIVE',
  'RESTORE',
  'FORK',
  'MERGE',
  'CHERRY_PICK',
];

/**
 * Audit log filter configuration
 */
export interface AuditLogFilters {
  /**
   * Operation types to include (empty array = show all)
   */
  operations: AuditEntry['operation'][];

  /**
   * Start date for filtering (ISO 8601 date string, YYYY-MM-DD)
   */
  startDate: string;

  /**
   * End date for filtering (ISO 8601 date string, YYYY-MM-DD)
   */
  endDate: string;

  /**
   * Search query for entity IDs
   */
  searchQuery: string;

  /**
   * Field to sort by
   */
  sortBy: AuditSortBy;

  /**
   * Sort order (ascending or descending)
   */
  sortOrder: SortOrder;
}

/**
 * Default filter values
 */
export const DEFAULT_FILTERS: AuditLogFilters = {
  operations: [], // Empty = show all operations
  startDate: '', // Empty = no start date filter
  endDate: '', // Empty = no end date filter
  searchQuery: '', // Empty = no search filter
  sortBy: 'timestamp',
  sortOrder: 'desc', // Most recent first by default
};

/**
 * Parse filter configuration from URL query parameters
 *
 * @param searchParams - URLSearchParams from React Router
 * @returns Parsed filter configuration with validated values
 *
 * @example
 * ```ts
 * const [searchParams] = useSearchParams();
 * const filters = parseFiltersFromURL(searchParams);
 * // Returns validated filter object from URL params
 * ```
 */
export function parseFiltersFromURL(searchParams: URLSearchParams): AuditLogFilters {
  const operationsParam = searchParams.get('operations');
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const searchQueryParam = searchParams.get('search');
  const sortByParam = searchParams.get('sortBy');
  const sortOrderParam = searchParams.get('sortOrder');

  // Parse and validate operations
  const operations = operationsParam
    ? (operationsParam
        .split(',')
        .filter((op) =>
          ALL_OPERATIONS.includes(op as AuditEntry['operation'])
        ) as AuditEntry['operation'][])
    : DEFAULT_FILTERS.operations;

  // Parse date strings (validate format YYYY-MM-DD)
  const isValidDate = (dateStr: string) => /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const startDate =
    startDateParam && isValidDate(startDateParam) ? startDateParam : DEFAULT_FILTERS.startDate;
  const endDate =
    endDateParam && isValidDate(endDateParam) ? endDateParam : DEFAULT_FILTERS.endDate;

  // Parse search query - sanitize input for security
  // Allow only alphanumeric characters, hyphens, underscores (valid for entity IDs)
  const searchQuery = searchQueryParam
    ? searchQueryParam.replace(/[^\w-]/g, '').slice(0, 100)
    : DEFAULT_FILTERS.searchQuery;

  // Parse and validate sortBy
  const sortBy = (
    ['timestamp', 'operation', 'entityType'].includes(sortByParam || '')
      ? sortByParam
      : DEFAULT_FILTERS.sortBy
  ) as AuditSortBy;

  // Parse and validate sortOrder
  const sortOrder = (
    ['asc', 'desc'].includes(sortOrderParam || '') ? sortOrderParam : DEFAULT_FILTERS.sortOrder
  ) as SortOrder;

  return {
    operations,
    startDate,
    endDate,
    searchQuery,
    sortBy,
    sortOrder,
  };
}

/**
 * Serialize filter configuration to URL query params
 *
 * Only includes parameters that differ from default values to keep URLs clean
 *
 * @param filters - Filter configuration
 * @returns URLSearchParams object
 *
 * @example
 * ```ts
 * const filters = { operations: ['CREATE'], startDate: '2025-01-01', ... };
 * const params = serializeFiltersToURL(filters);
 * setSearchParams(params, { replace: true });
 * ```
 */
export function serializeFiltersToURL(filters: AuditLogFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Only add params if they differ from defaults

  // Operations - only if not showing all
  if (filters.operations.length > 0) {
    params.set('operations', filters.operations.join(','));
  }

  // Date range - only if set
  if (filters.startDate) {
    params.set('startDate', filters.startDate);
  }
  if (filters.endDate) {
    params.set('endDate', filters.endDate);
  }

  // Search query - only if not empty
  if (filters.searchQuery.trim()) {
    params.set('search', filters.searchQuery.trim());
  }

  // Sort - only if different from defaults
  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) {
    params.set('sortBy', filters.sortBy);
  }
  if (filters.sortOrder !== DEFAULT_FILTERS.sortOrder) {
    params.set('sortOrder', filters.sortOrder);
  }

  return params;
}

/**
 * Check if any filters are active (non-default)
 *
 * @param filters - Filter configuration to check
 * @returns true if any filters are applied, false if all are default
 */
export function hasActiveFilters(filters: AuditLogFilters): boolean {
  return (
    filters.operations.length > 0 ||
    filters.startDate !== '' ||
    filters.endDate !== '' ||
    filters.searchQuery.trim() !== '' ||
    filters.sortBy !== DEFAULT_FILTERS.sortBy ||
    filters.sortOrder !== DEFAULT_FILTERS.sortOrder
  );
}

/**
 * Reset all filters to default values
 *
 * @returns Default filter configuration
 */
export function resetFilters(): AuditLogFilters {
  return { ...DEFAULT_FILTERS };
}
