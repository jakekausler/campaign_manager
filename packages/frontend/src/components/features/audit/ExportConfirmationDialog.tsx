import { AlertTriangle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Props for ExportConfirmationDialog component
 */
export interface ExportConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when export is confirmed */
  onConfirm: () => void;
  /** Number of records to be exported (or minimum for unknown counts) */
  recordCount: number;
  /** Whether the exact count is unknown (e.g., Export All before fetching) */
  isUnknownCount?: boolean;
  /** Export format (CSV or JSON) */
  format: 'CSV' | 'JSON';
  /** Whether the confirmation action is loading */
  loading?: boolean;
}

/**
 * Confirmation dialog for large audit log exports.
 *
 * This dialog warns users when they are about to export a large number of records,
 * giving them a chance to review the operation before proceeding. Appears when
 * exporting more than 1000 records.
 *
 * @example
 * ```tsx
 * <ExportConfirmationDialog
 *   open={showConfirmation}
 *   onClose={() => setShowConfirmation(false)}
 *   onConfirm={handleConfirmExport}
 *   recordCount={2547}
 *   format="CSV"
 *   loading={exporting}
 * />
 * ```
 */
export function ExportConfirmationDialog({
  open,
  onClose,
  onConfirm,
  recordCount,
  isUnknownCount = false,
  format,
  loading = false,
}: ExportConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Export Large Dataset?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                You are about to export{' '}
                {isUnknownCount ? (
                  <>
                    <strong>more than {recordCount.toLocaleString()}</strong> audit log entries
                  </>
                ) : (
                  <>
                    <strong>{recordCount.toLocaleString()}</strong> audit log{' '}
                    {recordCount === 1 ? 'entry' : 'entries'}
                  </>
                )}{' '}
                as {format}.
              </p>
              <p className="text-sm text-amber-600">
                <strong>Note:</strong> Large exports may take a moment to complete. Your browser may
                appear unresponsive during the download process.
              </p>
              <p className="text-sm text-muted-foreground">
                The export will include all selected audit entries with their associated metadata,
                state changes, and diff information.
              </p>
              <p className="pt-2 text-sm font-medium">Do you want to continue?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? 'Exporting...' : `Yes, export ${format}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
