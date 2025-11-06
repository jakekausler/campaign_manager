import { Download, FileJson } from 'lucide-react';

import type { AuditEntry } from '../../../services/api/hooks/audit';
import { exportToCSV, exportToJSON } from '../../../utils/audit-export';
import { Button } from '../../ui/button';

interface ExportButtonProps {
  /** Audit entries to export */
  entries: AuditEntry[];
  /** Whether the button should be disabled */
  disabled?: boolean;
  /** Optional CSS classes */
  className?: string;
}

/**
 * ExportButton - Button group for exporting audit log entries to CSV or JSON format.
 *
 * Features:
 * - Exports currently filtered/displayed audit entries
 * - CSV format for spreadsheet compatibility (with UTF-8 BOM for Excel)
 * - JSON format for programmatic access (pretty-printed with 2-space indentation)
 * - Timestamp-based filenames
 * - Disabled state when no entries available
 * - Accessible buttons with icons
 *
 * Usage:
 * ```tsx
 * <ExportButton entries={auditEntries} disabled={loading} />
 * ```
 */
export const ExportButton = ({ entries, disabled = false, className = '' }: ExportButtonProps) => {
  const isDisabled = disabled || entries.length === 0;

  const handleExportCSV = () => {
    if (entries.length === 0) {
      console.warn('No audit entries to export');
      return;
    }

    exportToCSV(entries);
  };

  const handleExportJSON = () => {
    if (entries.length === 0) {
      console.warn('No audit entries to export');
      return;
    }

    exportToJSON(entries);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportCSV}
        disabled={isDisabled}
        aria-label="Export audit log to CSV"
      >
        <Download className="mr-2 h-4 w-4" />
        Export CSV ({entries.length})
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportJSON}
        disabled={isDisabled}
        aria-label="Export audit log to JSON"
      >
        <FileJson className="mr-2 h-4 w-4" />
        Export JSON ({entries.length})
      </Button>
    </div>
  );
};
