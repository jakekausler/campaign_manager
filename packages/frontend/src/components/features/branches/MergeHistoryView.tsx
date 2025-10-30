import { AlertTriangle, Calendar, Check, GitMerge, GitPullRequest, User } from 'lucide-react';
import { useMemo } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetMergeHistory, type MergeHistoryEntry } from '@/services/api/hooks/merge';

/**
 * Props for the MergeHistoryView component
 */
export type MergeHistoryViewProps = {
  /** ID of the branch to display merge history for */
  branchId: string;
  /** Optional callback when user wants to view merge details */
  onViewDetails?: (entry: MergeHistoryEntry) => void;
  /** Optional className for styling */
  className?: string;
};

/**
 * Individual merge history entry card component.
 *
 * Displays information about a single merge operation including:
 * - Source and target branches
 * - Merge timestamp and world time
 * - Conflict and entity statistics
 * - User who performed the merge
 */
function MergeHistoryCard({
  entry,
  onViewDetails,
}: {
  entry: MergeHistoryEntry;
  onViewDetails?: (entry: MergeHistoryEntry) => void;
}) {
  const mergedDate = new Date(entry.mergedAt);
  const worldTimeDate = new Date(entry.worldTime);
  const hadConflicts = entry.conflictsCount > 0;

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <GitMerge className={`h-5 w-5 ${hadConflicts ? 'text-amber-500' : 'text-green-500'}`} />
            <CardTitle className="text-base">
              <span className="font-mono text-sm text-blue-600">{entry.sourceBranch.name}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="font-mono text-sm text-green-600">{entry.targetBranch.name}</span>
            </CardTitle>
          </div>
          <Badge
            variant={hadConflicts ? 'destructive' : 'default'}
            className={
              hadConflicts
                ? 'ml-2 bg-amber-500 hover:bg-amber-600'
                : 'ml-2 bg-green-600 hover:bg-green-700'
            }
          >
            {hadConflicts ? (
              <>
                <AlertTriangle className="mr-1 h-3 w-3" />
                {entry.conflictsCount} {entry.conflictsCount === 1 ? 'conflict' : 'conflicts'}
              </>
            ) : (
              <>
                <Check className="mr-1 h-3 w-3" />
                Clean merge
              </>
            )}
          </Badge>
        </div>
        <CardDescription className="mt-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                {mergedDate.toLocaleDateString()} at {mergedDate.toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>User ID: {entry.mergedBy}</span>
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Statistics */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="font-medium">{entry.entitiesMerged}</span>
              <span className="ml-1 text-gray-600">
                {entry.entitiesMerged === 1 ? 'entity' : 'entities'} merged
              </span>
            </div>
            {entry.conflictsCount > 0 && (
              <div>
                <span className="font-medium text-amber-600">{entry.conflictsCount}</span>
                <span className="ml-1 text-gray-600">
                  {entry.conflictsCount === 1 ? 'conflict' : 'conflicts'} resolved
                </span>
              </div>
            )}
          </div>

          {/* World time */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">World time:</span> {worldTimeDate.toLocaleDateString()}{' '}
            {worldTimeDate.toLocaleTimeString()}
          </div>

          {/* Actions */}
          {onViewDetails && (
            <div className="mt-3 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails(entry)}
                className="h-8 text-xs"
              >
                View Details
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for merge history entries.
 */
function MergeHistoryLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="mt-2 h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Merge History View Component
 *
 * Displays a timeline of merge operations for a specific branch,
 * showing when the branch was merged from or into other branches.
 *
 * Features:
 * - Chronological display of merge operations (most recent first)
 * - Visual indicators for clean merges vs. conflict resolutions
 * - Branch name display with direction arrow (source → target)
 * - Conflict and entity statistics
 * - Optional detailed view callback
 * - Loading and empty states
 * - Error handling with retry
 *
 * @example
 * ```typescript
 * function BranchDetailsPanel({ branch }: Props) {
 *   const [selectedEntry, setSelectedEntry] = useState<MergeHistoryEntry | null>(null);
 *
 *   return (
 *     <div>
 *       <h2>Merge History</h2>
 *       <MergeHistoryView
 *         branchId={branch.id}
 *         onViewDetails={(entry) => setSelectedEntry(entry)}
 *       />
 *       {selectedEntry && (
 *         <MergeDetailsDialog
 *           entry={selectedEntry}
 *           onClose={() => setSelectedEntry(null)}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function MergeHistoryView({ branchId, onViewDetails, className }: MergeHistoryViewProps) {
  const { data, loading, error, refetch } = useGetMergeHistory(branchId);

  const mergeHistory = useMemo(() => data?.getMergeHistory ?? [], [data]);

  // Empty state
  if (!loading && mergeHistory.length === 0) {
    return (
      <div className={className}>
        <Alert>
          <GitPullRequest className="h-4 w-4" />
          <AlertDescription>
            No merge operations yet. This branch has not been merged from or into any other
            branches.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="mb-2">Failed to load merge history: {error.message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={className}>
        <MergeHistoryLoadingSkeleton />
      </div>
    );
  }

  // Main content - timeline of merge operations
  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Merge History</h3>
        <Badge variant="secondary">
          {mergeHistory.length} {mergeHistory.length === 1 ? 'operation' : 'operations'}
        </Badge>
      </div>
      <div className="space-y-4">
        {mergeHistory.map((entry) => (
          <MergeHistoryCard key={entry.id} entry={entry} onViewDetails={onViewDetails} />
        ))}
      </div>
    </div>
  );
}

// Export types for convenience
export type { MergeHistoryEntry };
