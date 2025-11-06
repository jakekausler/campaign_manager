/**
 * Audit Log Page
 * Displays all audit log entries for the current user with advanced filtering and pagination
 */

import { useApolloClient } from '@apollo/client/react';
import { ScrollText, ArrowUpDown, ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AuditLogFilters } from '@/components/features/audit/AuditLogFilters';
import { AuditLogTable } from '@/components/features/audit/AuditLogTable';
import { ExportButton } from '@/components/features/audit/ExportButton';
import { Button } from '@/components/ui/button';
import { useUserAuditHistory } from '@/services/api/hooks/audit';
import { useCurrentUser } from '@/stores';
import type { AuditLogFilters as Filters, AuditSortBy, SortOrder } from '@/utils/audit-filters';
import { parseFiltersFromURL, serializeFiltersToURL } from '@/utils/audit-filters';

/**
 * Main audit log page component with filters, sorting, and pagination
 */
export default function AuditLogPage() {
  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP (Rules of Hooks)

  // Get Apollo client for export functionality
  const apolloClient = useApolloClient();

  // Get current user for authorization
  const user = useCurrentUser();

  // URL-persisted filter state
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFiltersFromURL(searchParams), [searchParams]);

  // Track initial batch size (for pagination)
  const [initialLimit] = useState(50);

  // Track loading state for pagination
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch audit logs with server-side filters and sorting
  // Note: userId can be undefined initially, hook will handle it
  const {
    audits: rawAudits,
    loading,
    error,
    fetchMore,
  } = useUserAuditHistory({
    userId: user?.id || '', // Provide empty string if user not loaded yet
    limit: initialLimit,
    operations: filters.operations.length > 0 ? filters.operations : undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  // Client-side search filtering (filter by entity ID)
  // TODO: Move entity ID filtering to server-side for better pagination
  // Current limitation: Client-side filtering may reduce results after server pagination
  const filteredAudits = useMemo(() => {
    if (!filters.searchQuery.trim()) {
      return rawAudits;
    }

    const query = filters.searchQuery.toLowerCase().trim();
    return rawAudits.filter((audit) => audit.entityId.toLowerCase().includes(query));
  }, [rawAudits, filters.searchQuery]);

  // Early return after all hooks have been called
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600">Loading user information...</p>
        </div>
      </div>
    );
  }

  /**
   * Update filters and persist to URL
   */
  const handleFiltersChange = (newFilters: Filters) => {
    const params = serializeFiltersToURL(newFilters);
    setSearchParams(params, { replace: true });
  };

  /**
   * Toggle sort field (cycle through: timestamp -> operation -> entityType -> back to timestamp)
   */
  const handleToggleSortBy = () => {
    const sortByOptions: AuditSortBy[] = ['timestamp', 'operation', 'entityType'];
    const currentIndex = sortByOptions.indexOf(filters.sortBy);
    const nextIndex = (currentIndex + 1) % sortByOptions.length;
    const nextSortBy = sortByOptions[nextIndex];

    handleFiltersChange({
      ...filters,
      sortBy: nextSortBy,
    });
  };

  /**
   * Toggle sort order (asc <-> desc)
   */
  const handleToggleSortOrder = () => {
    const nextSortOrder: SortOrder = filters.sortOrder === 'asc' ? 'desc' : 'asc';

    handleFiltersChange({
      ...filters,
      sortOrder: nextSortOrder,
    });
  };

  /**
   * Load more audit entries (pagination)
   */
  const handleLoadMore = async () => {
    if (!fetchMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      await fetchMore({
        variables: {
          limit: 50, // Load next 50 entries
        },
      });
    } catch (err) {
      console.error('Failed to load more audit entries:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Determine if we can load more
  // Note: This is a heuristic - ideally backend should return hasMore flag
  // Shows button if we have at least initialLimit results and count is divisible by 50
  const canLoadMore = rawAudits.length >= initialLimit && rawAudits.length % 50 === 0;

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Page Header */}
      <header className="bg-white border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <ScrollText className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
              <p className="text-sm text-muted-foreground">
                Track all changes made to your campaign entities
              </p>
            </div>
          </div>

          {/* Sort Controls and Export Button */}
          <div className="flex items-center gap-2">
            {/* Export Button */}
            <ExportButton
              entries={filteredAudits}
              disabled={loading}
              className="mr-2"
              apolloClient={apolloClient}
              filterOptions={{
                userId: user?.id || '',
                operations: filters.operations.length > 0 ? filters.operations : undefined,
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined,
                sortBy: filters.sortBy,
                sortOrder: filters.sortOrder,
              }}
            />

            {/* Sort Controls */}
            <div className="text-xs text-gray-600 font-medium">Sort by:</div>
            <Button variant="outline" size="sm" onClick={handleToggleSortBy} className="capitalize">
              {filters.sortBy}
              <ArrowUpDown className="ml-2 h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToggleSortOrder}>
              {filters.sortOrder === 'asc' ? (
                <>
                  <ArrowUp className="h-3 w-3 mr-1" />
                  Ascending
                </>
              ) : (
                <>
                  <ArrowDown className="h-3 w-3 mr-1" />
                  Descending
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Filters */}
          <AuditLogFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            className="w-full"
          />

          {/* Audit Log Table */}
          <AuditLogTable audits={filteredAudits} loading={loading} error={error || null} />

          {/* Load More Button (Pagination) */}
          {!loading && !error && canLoadMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="min-w-[200px]"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Load More (${rawAudits.length} shown)`
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
