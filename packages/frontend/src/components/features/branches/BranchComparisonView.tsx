import { AlertCircle, GitCompare, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGetBranchHierarchy } from '@/services/api/hooks';
import {
  useGetSettlementAsOf,
  useGetStructureAsOf,
  type VersionableEntityType,
} from '@/services/api/hooks/version-comparison';
import { useCampaignStore } from '@/stores';

/**
 * BranchComparisonView Component
 *
 * Allows users to compare entity states between two branches at a specific world time.
 * Displays side-by-side diff visualization highlighting differences between branches.
 *
 * Features:
 * - Select source and target branches from dropdowns
 * - Select entity type (settlement, structure, etc.)
 * - Enter entity ID to compare
 * - Specify world time for comparison (ISO 8601 format)
 * - Visual diff with added/modified/removed fields
 * - Loading and error states
 * - Default comparison with parent branch
 *
 * @example
 * ```tsx
 * function BranchesPage() {
 *   return (
 *     <div>
 *       <BranchHierarchyView />
 *       <BranchComparisonView />
 *     </div>
 *   );
 * }
 * ```
 */
export function BranchComparisonView() {
  const { currentCampaignId, currentBranchId } = useCampaignStore();

  // Fetch branch hierarchy for selection
  const { flatBranches, loading: branchesLoading } = useGetBranchHierarchy({
    variables: { campaignId: currentCampaignId ?? '' },
    skip: !currentCampaignId,
  });

  // Find current branch for default parent comparison
  const currentBranch = useMemo(() => {
    return flatBranches.find((b) => b.id === currentBranchId) ?? null;
  }, [flatBranches, currentBranchId]);

  // Comparison form state
  const [sourceBranchId, setSourceBranchId] = useState<string>('');
  const [targetBranchId, setTargetBranchId] = useState<string>('');
  const [entityType, setEntityType] = useState<VersionableEntityType>('settlement');
  const [entityId, setEntityId] = useState<string>('');
  const [comparisonTime, setComparisonTime] = useState<string>('');
  const [isComparing, setIsComparing] = useState(false);

  // Set defaults when current branch changes
  useEffect(() => {
    if (currentBranch) {
      setSourceBranchId(currentBranch.parentId ?? '');
      setTargetBranchId(currentBranch.id);
    }
  }, [currentBranch]);

  // Query entity versions from both branches
  const {
    data: sourceSettlement,
    loading: sourceSettlementLoading,
    error: sourceSettlementError,
  } = useGetSettlementAsOf({
    variables: {
      id: entityId,
      branchId: sourceBranchId,
      asOf: comparisonTime,
    },
    skip:
      !isComparing ||
      entityType !== 'settlement' ||
      !entityId ||
      !sourceBranchId ||
      !comparisonTime,
  });

  const {
    data: targetSettlement,
    loading: targetSettlementLoading,
    error: targetSettlementError,
  } = useGetSettlementAsOf({
    variables: {
      id: entityId,
      branchId: targetBranchId,
      asOf: comparisonTime,
    },
    skip:
      !isComparing ||
      entityType !== 'settlement' ||
      !entityId ||
      !targetBranchId ||
      !comparisonTime,
  });

  const {
    data: sourceStructure,
    loading: sourceStructureLoading,
    error: sourceStructureError,
  } = useGetStructureAsOf({
    variables: {
      id: entityId,
      branchId: sourceBranchId,
      asOf: comparisonTime,
    },
    skip:
      !isComparing || entityType !== 'structure' || !entityId || !sourceBranchId || !comparisonTime,
  });

  const {
    data: targetStructure,
    loading: targetStructureLoading,
    error: targetStructureError,
  } = useGetStructureAsOf({
    variables: {
      id: entityId,
      branchId: targetBranchId,
      asOf: comparisonTime,
    },
    skip:
      !isComparing || entityType !== 'structure' || !entityId || !targetBranchId || !comparisonTime,
  });

  // Determine which data to show based on entity type
  const sourceData =
    entityType === 'settlement' ? sourceSettlement?.settlementAsOf : sourceStructure?.structureAsOf;
  const targetData =
    entityType === 'settlement' ? targetSettlement?.settlementAsOf : targetStructure?.structureAsOf;
  const loading =
    entityType === 'settlement'
      ? sourceSettlementLoading || targetSettlementLoading
      : sourceStructureLoading || targetStructureLoading;
  const error =
    entityType === 'settlement'
      ? sourceSettlementError || targetSettlementError
      : sourceStructureError || targetStructureError;

  // Format data for diff viewer
  const sourceJson = useMemo(() => {
    return sourceData ? JSON.stringify(sourceData, null, 2) : '';
  }, [sourceData]);

  const targetJson = useMemo(() => {
    return targetData ? JSON.stringify(targetData, null, 2) : '';
  }, [targetData]);

  // Get branch names for display
  const sourceBranch = flatBranches.find((b) => b.id === sourceBranchId);
  const targetBranch = flatBranches.find((b) => b.id === targetBranchId);

  // Handle comparison submission
  const handleCompare = () => {
    if (!sourceBranchId || !targetBranchId || !entityId || !comparisonTime) {
      return;
    }
    setIsComparing(true);
  };

  // Handle clear/reset
  const handleClear = () => {
    setIsComparing(false);
    setEntityId('');
  };

  // Validation for compare button
  const canCompare =
    !!sourceBranchId && !!targetBranchId && !!entityId && !!comparisonTime && !loading;

  // If no campaign selected, don't render
  if (!currentCampaignId) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="h-5 w-5" />
          Branch Comparison
        </CardTitle>
        <CardDescription>
          Compare entity states between two branches at a specific world time. Select branches,
          entity type, and entity ID to see differences.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Comparison Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Branch */}
          <div className="space-y-2">
            <Label htmlFor="source-branch">Source Branch</Label>
            {branchesLoading ? (
              <div className="h-10 flex items-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading branches...
              </div>
            ) : (
              <Select value={sourceBranchId} onValueChange={setSourceBranchId}>
                <SelectTrigger id="source-branch" data-testid="source-branch-select">
                  <SelectValue placeholder="Select source branch" />
                </SelectTrigger>
                <SelectContent>
                  {flatBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Target Branch */}
          <div className="space-y-2">
            <Label htmlFor="target-branch">Target Branch</Label>
            {branchesLoading ? (
              <div className="h-10 flex items-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading branches...
              </div>
            ) : (
              <Select value={targetBranchId} onValueChange={setTargetBranchId}>
                <SelectTrigger id="target-branch" data-testid="target-branch-select">
                  <SelectValue placeholder="Select target branch" />
                </SelectTrigger>
                <SelectContent>
                  {flatBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Entity Type */}
          <div className="space-y-2">
            <Label htmlFor="entity-type">Entity Type</Label>
            <Select
              value={entityType}
              onValueChange={(value) => {
                // Validate entity type before setting
                if (value === 'settlement' || value === 'structure') {
                  setEntityType(value);
                }
              }}
            >
              <SelectTrigger id="entity-type" data-testid="entity-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="settlement">Settlement</SelectItem>
                <SelectItem value="structure">Structure</SelectItem>
                {/* Other entity types can be added when backend support exists */}
              </SelectContent>
            </Select>
          </div>

          {/* Entity ID */}
          <div className="space-y-2">
            <Label htmlFor="entity-id">Entity ID</Label>
            <Input
              id="entity-id"
              data-testid="entity-id-input"
              placeholder="Enter entity ID"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value.trim())}
            />
          </div>

          {/* Comparison Time */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="comparison-time">World Time (ISO 8601)</Label>
            <Input
              id="comparison-time"
              data-testid="comparison-time-input"
              placeholder="2024-01-15T00:00:00Z"
              value={comparisonTime}
              onChange={(e) => setComparisonTime(e.target.value.trim())}
            />
            <p className="text-sm text-muted-foreground">
              Enter time in ISO 8601 format (e.g., 2024-01-15T00:00:00Z)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleCompare} disabled={!canCompare} data-testid="compare-button">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <GitCompare className="h-4 w-4 mr-2" />
                Compare
              </>
            )}
          </Button>
          {isComparing && (
            <Button variant="outline" onClick={handleClear} data-testid="clear-button">
              Clear
            </Button>
          )}
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" data-testid="comparison-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load entity data: {error.message}</AlertDescription>
          </Alert>
        )}

        {/* Comparison Result */}
        {isComparing && !loading && !error && (
          <div className="space-y-4">
            {/* Branch Labels */}
            <div className="grid grid-cols-2 gap-4 text-sm font-medium">
              <div data-testid="source-branch-label">Source: {sourceBranch?.name ?? 'Unknown'}</div>
              <div data-testid="target-branch-label">Target: {targetBranch?.name ?? 'Unknown'}</div>
            </div>

            {/* No Data Warning */}
            {!sourceData && !targetData && (
              <Alert data-testid="no-data-alert">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No entity data found for the specified ID and time in either branch. The entity
                  may not exist or may not have versions at the specified world time.
                </AlertDescription>
              </Alert>
            )}

            {/* Diff Viewer */}
            {(sourceData || targetData) && (
              <div className="border rounded-lg overflow-hidden" data-testid="diff-viewer">
                <ReactDiffViewer
                  oldValue={sourceJson}
                  newValue={targetJson}
                  splitView={true}
                  compareMethod={DiffMethod.WORDS}
                  leftTitle={`${sourceBranch?.name ?? 'Source'} @ ${comparisonTime}`}
                  rightTitle={`${targetBranch?.name ?? 'Target'} @ ${comparisonTime}`}
                  styles={{
                    variables: {
                      light: {
                        diffViewerBackground: '#fff',
                        diffViewerColor: '#212529',
                        addedBackground: '#e6ffed',
                        addedColor: '#24292e',
                        removedBackground: '#ffeef0',
                        removedColor: '#24292e',
                        wordAddedBackground: '#acf2bd',
                        wordRemovedBackground: '#fdb8c0',
                        addedGutterBackground: '#cdffd8',
                        removedGutterBackground: '#ffdce0',
                        gutterBackground: '#f7f7f7',
                        gutterBackgroundDark: '#f3f1f1',
                        highlightBackground: '#fffbdd',
                        highlightGutterBackground: '#fff5b1',
                      },
                    },
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Helper Text */}
        {!isComparing && (
          <div className="text-sm text-muted-foreground" data-testid="help-text">
            <p>
              <strong>Default comparison:</strong> Current branch vs. parent branch at current world
              time.
            </p>
            <p className="mt-2">
              <strong>Tip:</strong> Entity ID can be found in the Entity Inspector or by hovering
              over entities in the Map/Flow/Timeline views.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
