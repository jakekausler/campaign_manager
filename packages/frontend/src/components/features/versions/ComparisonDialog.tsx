/**
 * ComparisonDialog component for comparing two versions
 *
 * Displays a side-by-side comparison of two entity versions using the DiffViewer component.
 * Automatically fetches the diff when the dialog opens and displays version metadata.
 */

import { format, formatDistanceToNow } from 'date-fns';
import { memo, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCompareVersions } from '@/services/api/hooks/versions';

import { DiffViewer } from './DiffViewer';

/**
 * Version metadata for display in the dialog
 */
export interface VersionMetadata {
  id: string;
  validFrom: string;
  comment: string | null;
  createdBy: string;
}

interface ComparisonDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback when dialog should be closed
   */
  onClose: () => void;

  /**
   * First version ID (Version A)
   */
  versionAId: string;

  /**
   * Second version ID (Version B)
   */
  versionBId: string;

  /**
   * Metadata for Version A
   */
  versionAMetadata: VersionMetadata;

  /**
   * Metadata for Version B
   */
  versionBMetadata: VersionMetadata;
}

/**
 * Format timestamp for display
 * Uses relative time for recent versions, absolute for older ones
 */
function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  // Use relative time for versions within 7 days, absolute date for older
  if (daysDiff < 7) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  return format(date, 'PPP'); // e.g., "June 1, 2024"
}

/**
 * ComparisonDialog component
 *
 * Displays diff between two versions with metadata labels.
 * Handles loading and error states gracefully.
 */
export const ComparisonDialog = memo(function ComparisonDialog({
  open,
  onClose,
  versionAId,
  versionBId,
  versionAMetadata,
  versionBMetadata,
}: ComparisonDialogProps) {
  // Fetch diff using hook from Stage 2
  const [compareVersions, { data: diffData, loading: diffLoading, error: diffError }] =
    useCompareVersions();
  const diff = diffData?.versionDiff ?? null;

  // Fetch diff when dialog opens or version IDs change
  useEffect(() => {
    if (open) {
      compareVersions({
        variables: {
          versionId1: versionAId,
          versionId2: versionBId,
        },
      });
    }
  }, [open, versionAId, versionBId, compareVersions]);

  // Handle retry on error
  const handleRetry = useCallback(() => {
    compareVersions({
      variables: {
        versionId1: versionAId,
        versionId2: versionBId,
      },
    });
  }, [compareVersions, versionAId, versionBId]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        aria-label="Compare versions"
      >
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
          <DialogDescription>View the differences between these two versions</DialogDescription>
        </DialogHeader>

        {/* Version labels */}
        <div className="grid grid-cols-2 gap-4 py-4 border-b">
          {/* Version A */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-900">Version A</h3>
            <p className="text-sm text-gray-700">{versionAMetadata.comment || 'No comment'}</p>
            <p className="text-xs text-gray-500">
              {formatTimestamp(versionAMetadata.validFrom)} by {versionAMetadata.createdBy}
            </p>
          </div>

          {/* Version B */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-900">Version B</h3>
            <p className="text-sm text-gray-700">{versionBMetadata.comment || 'No comment'}</p>
            <p className="text-xs text-gray-500">
              {formatTimestamp(versionBMetadata.validFrom)} by {versionBMetadata.createdBy}
            </p>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-y-auto py-4">
          {diffLoading && (
            <div
              className="flex flex-col items-center justify-center p-8"
              data-testid="comparison-loading"
              role="status"
              aria-live="polite"
              aria-label="Loading comparison"
            >
              <div
                className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"
                aria-hidden="true"
              />
              <p className="mt-4 text-gray-700 text-sm font-medium">Loading comparison...</p>
            </div>
          )}

          {diffError && (
            <div
              className="flex flex-col items-center justify-center p-8"
              data-testid="comparison-error"
              role="alert"
              aria-live="assertive"
            >
              <div className="max-w-md p-6 bg-white rounded-lg shadow-lg border border-red-200">
                <div className="flex flex-col items-center space-y-4 text-center">
                  {/* Error icon */}
                  <div
                    className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <svg
                      className="w-6 h-6 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900">Error Loading Data</h3>
                  <p className="text-sm text-gray-600">Failed to load comparison</p>

                  {/* Retry button */}
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {!diffLoading && !diffError && diff && <DiffViewer diff={diff} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
