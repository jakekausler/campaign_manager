/**
 * VersionList component for displaying version history
 *
 * Shows chronological list of entity versions with selection support.
 * Supports single selection (for restore) and multiple selection (for comparison).
 */

import { formatDistanceToNow, format } from 'date-fns';
import { memo, useState, useCallback, useMemo } from 'react';

import { useEntityVersions } from '@/services/api/hooks/versions';

import { ComparisonDialog, type VersionMetadata } from './ComparisonDialog';
import { RestoreConfirmationDialog } from './RestoreConfirmationDialog';

interface VersionListProps {
  /**
   * Entity type (e.g., "settlement", "structure")
   */
  entityType: string;

  /**
   * Entity ID
   */
  entityId: string;

  /**
   * Branch ID to fetch versions from
   */
  branchId: string;

  /**
   * Callback when version selection changes
   */
  onSelectionChange?: (selectedIds: string[]) => void;

  /**
   * Maximum number of versions that can be selected
   * @default undefined (no limit)
   */
  maxSelection?: number;

  /**
   * CSS class name for container
   */
  className?: string;
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
 * VersionList component
 *
 * Displays version history with loading/error/empty states.
 * Supports single and multiple selection with keyboard navigation.
 */
export const VersionList = memo(function VersionList({
  entityType,
  entityId,
  branchId,
  onSelectionChange,
  maxSelection,
  className = '',
}: VersionListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);

  // Fetch version history using hook from Stage 2
  const { versions, loading, error, refetch } = useEntityVersions(entityType, entityId, branchId);

  // Handle version selection/deselection
  const handleVersionClick = useCallback(
    (versionId: string) => {
      setSelectedIds((prev) => {
        let newSelection: string[];

        if (prev.includes(versionId)) {
          // Deselect
          newSelection = prev.filter((id) => id !== versionId);
        } else {
          // Check max selection limit
          if (maxSelection && prev.length >= maxSelection) {
            // Already at limit, don't add more
            return prev;
          }

          // Select
          newSelection = [...prev, versionId];
        }

        // Notify parent of selection change
        onSelectionChange?.(newSelection);
        return newSelection;
      });
    },
    [maxSelection, onSelectionChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, versionId: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleVersionClick(versionId);
      }
    },
    [handleVersionClick]
  );

  // Sort versions by validFrom descending (newest first)
  const sortedVersions = useMemo(() => {
    if (!versions) return [];
    return [...versions].sort(
      (a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()
    );
  }, [versions]);

  // Find current version (validTo === null)
  const currentVersion = useMemo(() => {
    return sortedVersions.find((v) => v.validTo === null);
  }, [sortedVersions]);

  // Determine if restore button should be shown
  // Show when: exactly 1 version selected AND it's not the current version
  const canRestore = useMemo(() => {
    if (selectedIds.length !== 1) return false;
    const selectedId = selectedIds[0];
    if (!currentVersion) return false;
    return selectedId !== currentVersion.id;
  }, [selectedIds, currentVersion]);

  // Determine if compare button should be shown
  // Show when: exactly 2 versions selected
  const canCompare = useMemo(() => {
    return selectedIds.length === 2;
  }, [selectedIds]);

  // Helper function to safely extract version metadata
  const getVersionMetadata = useCallback(
    (versionId: string): VersionMetadata => {
      const version = sortedVersions.find((v) => v.id === versionId);
      if (!version) {
        console.error(`Version ${versionId} not found in sorted versions`);
        return {
          id: versionId,
          validFrom: new Date().toISOString(),
          comment: 'Version not found',
          createdBy: 'unknown',
        };
      }
      return {
        id: version.id,
        validFrom: version.validFrom,
        comment: version.comment,
        createdBy: version.createdBy,
      };
    },
    [sortedVersions]
  );

  // Handle restore button click
  const handleRestoreClick = useCallback(() => {
    setShowRestoreDialog(true);
  }, []);

  // Handle successful restore
  const handleRestoreSuccess = useCallback(() => {
    // Refetch version list to show new version
    refetch();
    // Clear selection
    setSelectedIds([]);
    onSelectionChange?.([]);
  }, [refetch, onSelectionChange]);

  // Handle compare button click
  const handleCompareClick = useCallback(() => {
    setShowComparisonDialog(true);
  }, []);

  // Handle comparison dialog close
  const handleComparisonClose = useCallback(() => {
    setShowComparisonDialog(false);
    // Clear selection after closing comparison
    setSelectedIds([]);
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  // Loading state
  if (loading) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 ${className}`}
        data-testid="version-list-loading"
        role="status"
        aria-live="polite"
        aria-label="Loading version history"
      >
        <div
          className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"
          aria-hidden="true"
        />
        <p className="mt-4 text-gray-700 text-sm font-medium">Loading version history...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 ${className}`}
        data-testid="version-list-error"
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
            <p className="text-sm text-gray-600">Failed to load version history</p>

            {/* Retry button */}
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              data-testid="retry-button"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!sortedVersions || sortedVersions.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 ${className}`}
        data-testid="version-list-empty"
        role="status"
        aria-live="polite"
      >
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="flex flex-col items-center space-y-4 text-center">
            {/* Empty state icon */}
            <div
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"
              aria-hidden="true"
            >
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>

            <h3 className="text-lg font-semibold text-gray-900">No Version History Available</h3>
            <p className="text-sm text-gray-600">
              Versions will appear here once this entity is modified.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Version list
  return (
    <>
      <div className="space-y-2">
        {/* Action buttons - shown based on selection */}
        {(canRestore || canCompare) && (
          <div className="flex justify-end gap-2 mb-2">
            {/* Compare button - shown when exactly two versions selected */}
            {canCompare && (
              <button
                onClick={handleCompareClick}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                data-testid="compare-button"
                aria-label="Compare selected versions"
              >
                Compare Versions
              </button>
            )}

            {/* Restore button - shown when single non-current version selected */}
            {canRestore && (
              <button
                onClick={handleRestoreClick}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                data-testid="restore-button"
                aria-label="Restore selected version"
              >
                Restore This Version
              </button>
            )}
          </div>
        )}

        {/* Version list */}
        <div
          className={`space-y-2 ${className}`}
          data-testid="version-list"
          role="list"
          aria-label="Version history"
        >
          {sortedVersions.map((version) => {
            const isSelected = selectedIds.includes(version.id);
            const isCurrent = version.validTo === null;

            return (
              <div
                key={version.id}
                className={`
                  p-4 border rounded-lg cursor-pointer transition-colors
                  ${isSelected ? 'bg-blue-50 border-blue-500 selected' : 'bg-white border-gray-200 hover:border-gray-300'}
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                `}
                data-testid={`version-item-${version.id}`}
                role="option"
                tabIndex={0}
                onClick={() => handleVersionClick(version.id)}
                onKeyDown={(e) => handleKeyDown(e, version.id)}
                aria-selected={isSelected}
                aria-label={`Version from ${formatTimestamp(version.validFrom)}${isCurrent ? ' (current)' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Comment */}
                    <p className="font-medium text-gray-900">{version.comment || 'No comment'}</p>

                    {/* Metadata */}
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                      <span data-testid={`version-timestamp-${version.id}`}>
                        {formatTimestamp(version.validFrom)}
                      </span>
                      <span>by {version.createdBy}</span>
                    </div>
                  </div>

                  {/* Current badge */}
                  {isCurrent && (
                    <span className="px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded">
                      CURRENT
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      {canRestore && currentVersion && (
        <RestoreConfirmationDialog
          open={showRestoreDialog}
          onClose={() => setShowRestoreDialog(false)}
          onRestore={handleRestoreSuccess}
          currentVersionId={currentVersion.id}
          restoreToVersionId={selectedIds[0]}
          branchId={branchId}
        />
      )}

      {/* Comparison Dialog */}
      {canCompare && (
        <ComparisonDialog
          open={showComparisonDialog}
          onClose={handleComparisonClose}
          versionAId={selectedIds[0]}
          versionBId={selectedIds[1]}
          versionAMetadata={getVersionMetadata(selectedIds[0])}
          versionBMetadata={getVersionMetadata(selectedIds[1])}
        />
      )}
    </>
  );
});
