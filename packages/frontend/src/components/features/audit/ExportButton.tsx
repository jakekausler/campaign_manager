import { type ApolloClient } from '@apollo/client';
import { Download, FileJson, Loader2 } from 'lucide-react';
import { useState } from 'react';

import type { AuditEntry, UseUserAuditHistoryOptions } from '../../../services/api/hooks/audit';
import { exportToCSV, exportToJSON, fetchAllAuditData } from '../../../utils/audit-export';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';

interface ExportButtonProps {
  /** Audit entries currently displayed (filtered/paginated) */
  entries: AuditEntry[];
  /** Whether the button should be disabled */
  disabled?: boolean;
  /** Optional CSS classes */
  className?: string;
  /** Apollo Client for fetching all data */
  apolloClient: ApolloClient;
  /** Filter options to apply when fetching all data */
  filterOptions: Omit<UseUserAuditHistoryOptions, 'limit' | 'skip'>;
}

/**
 * ExportButton - Button group for exporting audit log entries to CSV or JSON format.
 *
 * Features:
 * - "Export All" checkbox to fetch all matching records (bypasses pagination)
 * - CSV format for spreadsheet compatibility (with UTF-8 BOM for Excel)
 * - JSON format for programmatic access (pretty-printed with 2-space indentation)
 * - Loading state with progress indicator while fetching all data
 * - Timestamp-based filenames
 * - Disabled state when no entries available
 * - Accessible buttons with icons
 *
 * Usage:
 * ```tsx
 * <ExportButton
 *   entries={auditEntries}
 *   disabled={loading}
 *   apolloClient={apolloClient}
 *   filterOptions={{ userId, operations, startDate, endDate, sortBy, sortOrder }}
 * />
 * ```
 */
export const ExportButton = ({
  entries,
  disabled = false,
  className = '',
  apolloClient,
  filterOptions,
}: ExportButtonProps) => {
  const [exportAll, setExportAll] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);

  const isDisabled = disabled || entries.length === 0 || isFetching;

  /**
   * Fetch all audit data if "Export All" is checked, otherwise return current entries
   */
  const getEntriesToExport = async (): Promise<AuditEntry[]> => {
    if (exportAll) {
      setIsFetching(true);
      setFetchProgress(0);
      try {
        const allEntries = await fetchAllAuditData(apolloClient, filterOptions, (count) =>
          setFetchProgress(count)
        );
        return allEntries;
      } catch (error) {
        console.error('Failed to fetch all audit data:', error);
        throw error;
      } finally {
        setIsFetching(false);
        setFetchProgress(0);
      }
    }

    return entries;
  };

  const handleExportCSV = async () => {
    if (entries.length === 0) {
      console.warn('No audit entries to export');
      return;
    }

    try {
      const entriesToExport = await getEntriesToExport();
      exportToCSV(entriesToExport);
    } catch (error) {
      // Provide specific error message based on error type
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to export audit data. Please try again.';
      console.error('Export CSV error:', error);
      alert(`Export failed: ${errorMessage}`);
    }
  };

  const handleExportJSON = async () => {
    if (entries.length === 0) {
      console.warn('No audit entries to export');
      return;
    }

    try {
      const entriesToExport = await getEntriesToExport();
      exportToJSON(entriesToExport);
    } catch (error) {
      // Provide specific error message based on error type
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to export audit data. Please try again.';
      console.error('Export JSON error:', error);
      alert(`Export failed: ${errorMessage}`);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Export All Checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="export-all"
          checked={exportAll}
          onCheckedChange={(checked) => setExportAll(checked === true)}
          disabled={isDisabled}
          aria-label="Export all matching records"
        />
        <Label htmlFor="export-all" className="text-sm font-normal cursor-pointer select-none">
          Export All <span className="text-muted-foreground">(fetch all matching records)</span>
        </Label>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={isDisabled}
          aria-label="Export audit log to CSV"
        >
          {isFetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching... ({fetchProgress})
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export CSV ({exportAll ? 'All' : entries.length})
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportJSON}
          disabled={isDisabled}
          aria-label="Export audit log to JSON"
        >
          {isFetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching... ({fetchProgress})
            </>
          ) : (
            <>
              <FileJson className="mr-2 h-4 w-4" />
              Export JSON ({exportAll ? 'All' : entries.length})
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
