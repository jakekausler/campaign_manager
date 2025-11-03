/**
 * RestoreConfirmationDialog component
 *
 * Displays a confirmation dialog before restoring a previous version with:
 * - Diff preview showing changes that will be reverted
 * - Warning about creating a new version (immutable history)
 * - Loading states during diff fetch and restore operation
 * - Success/error toast notifications
 */

import { memo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

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
import { useCompareVersions, useRestoreVersion } from '@/services/api/hooks/versions';

import { DiffViewer } from './DiffViewer';

/**
 * Props for RestoreConfirmationDialog component
 */
export interface RestoreConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;

  /** Callback when dialog is closed */
  onClose: () => void;

  /** Callback when restore operation succeeds */
  onRestore: () => void;

  /** ID of the current version (for comparison) */
  currentVersionId: string;

  /** ID of the version to restore to */
  restoreToVersionId: string;

  /** Branch ID for restore operation */
  branchId: string;
}

/**
 * RestoreConfirmationDialog component
 *
 * Shows a confirmation dialog with diff preview before restoring a version.
 * Fetches the diff between current and target version on mount.
 * Executes restore mutation and shows success/error toast notifications.
 *
 * @example
 * ```tsx
 * <RestoreConfirmationDialog
 *   open={showDialog}
 *   onClose={() => setShowDialog(false)}
 *   onRestore={() => refetchVersions()}
 *   currentVersionId="version-current"
 *   restoreToVersionId="version-2"
 *   branchId="branch-1"
 * />
 * ```
 */
export const RestoreConfirmationDialog = memo(function RestoreConfirmationDialog({
  open,
  onClose,
  onRestore,
  currentVersionId,
  restoreToVersionId,
  branchId,
}: RestoreConfirmationDialogProps) {
  // Fetch diff between current and target version
  const [compareVersions, { data: diffData, loading: diffLoading, error: diffError }] =
    useCompareVersions();
  const diff = diffData?.versionDiff ?? null;

  // Restore version mutation
  const [restoreVersion, { loading: restoreLoading }] = useRestoreVersion();

  // Fetch diff when dialog opens
  useEffect(() => {
    if (open) {
      compareVersions({
        variables: {
          versionId1: restoreToVersionId,
          versionId2: currentVersionId,
        },
      });
    }
  }, [open, compareVersions, currentVersionId, restoreToVersionId]);

  // Handle restore confirmation
  const handleRestore = useCallback(async () => {
    try {
      await restoreVersion({
        variables: {
          input: {
            versionId: restoreToVersionId,
            branchId,
          },
        },
      });

      toast.success('Version restored successfully');
      onRestore();
      onClose();
    } catch (error) {
      console.error('Failed to restore version:', error);
      toast.error('Failed to restore version. Please try again.');
    }
  }, [restoreVersion, restoreToVersionId, branchId, onRestore, onClose]);

  // Determine if restore button should be disabled
  const isRestoreDisabled = diffLoading || diffError !== null || restoreLoading;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Restore Previous Version</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {/* Warning message */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-900">
                  <strong className="font-semibold">⚠️ Important:</strong> This will create a new
                  version with the data from the selected version. Your version history will be
                  preserved.
                </p>
              </div>

              {/* Diff preview section */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Changes to be Reverted:</h3>

                {/* Loading state */}
                {diffLoading && (
                  <div
                    className="flex flex-col items-center justify-center p-8"
                    role="status"
                    aria-live="polite"
                    aria-label="Loading changes"
                  >
                    <div
                      className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"
                      aria-hidden="true"
                    />
                    <p className="mt-4 text-gray-700 text-sm font-medium">Loading changes...</p>
                  </div>
                )}

                {/* Error state */}
                {diffError && (
                  <div
                    className="p-4 bg-red-50 border border-red-200 rounded-md"
                    role="alert"
                    aria-live="assertive"
                  >
                    <p className="text-sm text-red-900">
                      <strong>Error:</strong> Failed to load changes. Please try again.
                    </p>
                  </div>
                )}

                {/* Diff display */}
                {!diffLoading && !diffError && diff && <DiffViewer diff={diff} />}

                {/* No changes state */}
                {!diffLoading && !diffError && !diff && (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-sm text-gray-700">No changes detected.</p>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={restoreLoading} onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isRestoreDisabled}
            onClick={(e) => {
              e.preventDefault();
              handleRestore();
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            {restoreLoading ? 'Restoring...' : 'Restore'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
