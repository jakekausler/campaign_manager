import { type ApolloClient } from '@apollo/client';
import { Download, FileJson, Loader2, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import type { AuditEntry, UseUserAuditHistoryOptions } from '../../../services/api/hooks/audit';
import { exportToCSV, exportToJSON, fetchAllAuditData } from '../../../utils/audit-export';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';

import { ExportConfirmationDialog } from './ExportConfirmationDialog';

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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingExport, setPendingExport] = useState<{
    format: 'CSV' | 'JSON';
    count: number;
  } | null>(null);

  // AbortController ref for cancelling export operations
  const abortControllerRef = useRef<AbortController | null>(null);

  const isDisabled = disabled || entries.length === 0 || isFetching;
  const LARGE_EXPORT_THRESHOLD = 1000;

  /**
   * Cancel the ongoing export operation
   */
  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsFetching(false);
      setFetchProgress(0);
      toast.info('Export cancelled', {
        description: 'The export operation has been cancelled',
      });
    }
  };

  /**
   * Fetch all audit data if "Export All" is checked, otherwise return current entries
   */
  const getEntriesToExport = async (): Promise<AuditEntry[]> => {
    if (exportAll) {
      // Create new AbortController for this export operation
      abortControllerRef.current = new AbortController();
      setIsFetching(true);
      setFetchProgress(0);

      try {
        const allEntries = await fetchAllAuditData(
          apolloClient,
          filterOptions,
          (count) => setFetchProgress(count),
          abortControllerRef.current.signal
        );
        return allEntries;
      } catch (error) {
        // Check if error is due to cancellation
        if (error instanceof Error && error.message === 'Export cancelled') {
          throw error; // Re-throw to be caught by performExport
        }
        console.error('Failed to fetch all audit data:', error);
        throw error;
      } finally {
        abortControllerRef.current = null;
        setIsFetching(false);
        setFetchProgress(0);
      }
    }

    return entries;
  };

  /**
   * Initiate export with confirmation if dataset is large
   */
  const initiateExport = (format: 'CSV' | 'JSON') => {
    if (entries.length === 0) {
      toast.error('No audit entries to export');
      return;
    }

    // Determine if confirmation is needed
    // For "Export All", we know it's >threshold but don't have exact count yet
    // For current entries, use the actual count
    const needsConfirmation = exportAll || entries.length > LARGE_EXPORT_THRESHOLD;

    if (needsConfirmation) {
      // Use threshold as minimum count indicator for Export All
      const countForDialog = exportAll ? LARGE_EXPORT_THRESHOLD : entries.length;
      setPendingExport({ format, count: countForDialog });
      setShowConfirmation(true);
    } else {
      // Directly export without confirmation for small datasets
      performExport(format);
    }
  };

  /**
   * Perform the actual export operation
   */
  const performExport = async (format: 'CSV' | 'JSON') => {
    try {
      const entriesToExport = await getEntriesToExport();

      if (format === 'CSV') {
        exportToCSV(entriesToExport);
      } else {
        exportToJSON(entriesToExport);
      }

      toast.success(`Audit logs exported as ${format}`, {
        description: `Successfully exported ${entriesToExport.length.toLocaleString()} ${
          entriesToExport.length === 1 ? 'entry' : 'entries'
        }`,
      });
    } catch (error) {
      // Don't show error toast if export was cancelled (already shown by handleCancelExport)
      if (error instanceof Error && error.message === 'Export cancelled') {
        return; // Silent return for cancelled exports
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to export audit data. Please try again.';
      console.error(`Export ${format} error:`, error);
      toast.error(`Export failed: ${format}`, {
        description: errorMessage,
      });
    }
  };

  /**
   * Handle confirmation dialog confirm action
   */
  const handleConfirmExport = () => {
    if (pendingExport) {
      setShowConfirmation(false);
      performExport(pendingExport.format);
      setPendingExport(null);
    }
  };

  /**
   * Handle confirmation dialog close action
   */
  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    setPendingExport(null);
  };

  const handleExportCSV = () => {
    initiateExport('CSV');
  };

  const handleExportJSON = () => {
    initiateExport('JSON');
  };

  return (
    <>
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

        {/* Export Buttons or Cancel Button */}
        <div className="flex gap-2">
          {isFetching ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelExport}
              aria-label="Cancel export operation"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Export
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={isDisabled}
                aria-label="Export audit log to CSV"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV ({exportAll ? 'All' : entries.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJSON}
                disabled={isDisabled}
                aria-label="Export audit log to JSON"
              >
                <FileJson className="mr-2 h-4 w-4" />
                Export JSON ({exportAll ? 'All' : entries.length})
              </Button>
            </>
          )}
        </div>

        {/* Progress Indicator */}
        {isFetching && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Fetching records... ({fetchProgress})</span>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Large Exports */}
      {pendingExport && (
        <ExportConfirmationDialog
          open={showConfirmation}
          onClose={handleCloseConfirmation}
          onConfirm={handleConfirmExport}
          recordCount={pendingExport.count}
          isUnknownCount={exportAll}
          format={pendingExport.format}
          loading={isFetching}
        />
      )}
    </>
  );
};
