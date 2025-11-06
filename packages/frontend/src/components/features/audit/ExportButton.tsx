import { Download } from 'lucide-react';

import type { AuditEntry } from '../../../services/api/hooks/audit';
import { exportToCSV } from '../../../utils/audit-export';
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
 * ExportButton - Button component for exporting audit log entries to CSV format.
 *
 * Features:
 * - Exports currently filtered/displayed audit entries
 * - CSV format with timestamp-based filename
 * - Disabled state when no entries available
 * - Accessible button with icon
 *
 * Usage:
 * ```tsx
 * <ExportButton entries={auditEntries} disabled={loading} />
 * ```
 */
export const ExportButton = ({ entries, disabled = false, className = '' }: ExportButtonProps) => {
  const handleExport = () => {
    if (entries.length === 0) {
      console.warn('No audit entries to export');
      return;
    }

    exportToCSV(entries);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={disabled || entries.length === 0}
      className={className}
      aria-label="Export audit log to CSV"
    >
      <Download className="mr-2 h-4 w-4" />
      Export CSV ({entries.length})
    </Button>
  );
};
