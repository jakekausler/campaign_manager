import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  GitMerge,
  Loader2,
  X,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useCallback, useEffect, useState, useMemo } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  useExecuteMerge,
  type Branch,
  type MergeConflict,
  type ConflictResolution,
  type EntityMergePreview,
} from '@/services/api/hooks';
import { useCampaignStore } from '@/stores';

/**
 * Props for ConflictResolutionDialog component
 */
export interface ConflictResolutionDialogProps {
  /** The source branch to merge from */
  sourceBranch: Branch | null;
  /** The target branch to merge into */
  targetBranch: Branch | null;
  /** Entity previews containing conflicts */
  entityPreviews: EntityMergePreview[];
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed or cancelled */
  onClose: () => void;
  /** Callback when merge is successfully completed */
  onMergeComplete?: () => void;
}

/**
 * Resolution choice: which value to use for the conflict
 */
type ResolutionChoice = 'source' | 'target' | 'custom';

/**
 * State for a single conflict resolution
 */
interface ConflictResolutionState {
  entityId: string;
  entityType: string;
  path: string;
  choice: ResolutionChoice | null;
  customValue: string; // JSON-stringified value for custom choice
  sourceValue: string; // JSON-stringified
  targetValue: string; // JSON-stringified
  isEditingCustom: boolean;
  customValueError: string | null;
}

/**
 * Component to display and resolve a single conflict
 */
function ResolutionItem({
  conflict,
  resolution,
  onUpdate,
}: {
  conflict: MergeConflict;
  entityId: string;
  entityType: string;
  resolution: ConflictResolutionState;
  onUpdate: (updated: Partial<ConflictResolutionState>) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse JSON values for display
  const parseValue = (value: string | null | undefined): unknown => {
    if (value === null || value === undefined) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const baseValue = parseValue(conflict.baseValue);
  const sourceValue = parseValue(conflict.sourceValue);
  const targetValue = parseValue(conflict.targetValue);

  // Handle choice selection
  const handleChooseSource = () => {
    onUpdate({
      choice: 'source',
      customValue: conflict.sourceValue || 'null',
      isEditingCustom: false,
      customValueError: null,
    });
  };

  const handleChooseTarget = () => {
    onUpdate({
      choice: 'target',
      customValue: conflict.targetValue || 'null',
      isEditingCustom: false,
      customValueError: null,
    });
  };

  const handleChooseCustom = () => {
    onUpdate({
      choice: 'custom',
      isEditingCustom: true,
    });
  };

  // Handle custom value changes
  const handleCustomValueChange = (value: string) => {
    // Try to parse to validate JSON
    let error: string | null = null;
    try {
      JSON.parse(value);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invalid JSON';
    }

    onUpdate({
      customValue: value,
      customValueError: error,
    });
  };

  const handleSaveCustom = () => {
    if (!resolution.customValueError) {
      onUpdate({
        isEditingCustom: false,
      });
    }
  };

  const handleCancelCustom = () => {
    onUpdate({
      choice: null,
      isEditingCustom: false,
      customValue: '',
      customValueError: null,
    });
  };

  const isResolved = resolution.choice !== null && !resolution.isEditingCustom;
  const borderColor = isResolved ? 'border-green-300' : 'border-red-200';
  const bgColor = isResolved ? 'bg-green-50' : 'bg-red-50';

  return (
    <Card className={`${borderColor} ${bgColor} p-3`}>
      <div className="space-y-3">
        {/* Conflict Header */}
        <div className="flex items-start gap-2">
          {isResolved ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm font-mono text-gray-900 bg-white px-1 rounded">
                {conflict.path}
              </code>
              <Badge variant={isResolved ? 'default' : 'destructive'} className="text-xs">
                {conflict.type}
              </Badge>
              {isResolved && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                  Resolved
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-800 mt-1">{conflict.description}</p>
            {conflict.suggestion && (
              <p className="text-xs text-gray-600 mt-1 italic">{conflict.suggestion}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Resolution Options */}
        <div className="ml-6 space-y-2">
          {/* Source / Target Choice Buttons */}
          {!resolution.isEditingCustom && (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={resolution.choice === 'source' ? 'default' : 'outline'}
                onClick={handleChooseSource}
                className="flex items-center gap-1"
                title="Use value from source branch"
              >
                {resolution.choice === 'source' && <Check className="h-3 w-3" />}
                Use Source
              </Button>
              <Button
                size="sm"
                variant={resolution.choice === 'target' ? 'default' : 'outline'}
                onClick={handleChooseTarget}
                className="flex items-center gap-1"
                title="Use value from target branch"
              >
                {resolution.choice === 'target' && <Check className="h-3 w-3" />}
                Use Target
              </Button>
              <Button
                size="sm"
                variant={resolution.choice === 'custom' ? 'default' : 'outline'}
                onClick={handleChooseCustom}
                className="flex items-center gap-1"
                title="Edit value manually"
              >
                {resolution.choice === 'custom' && <Check className="h-3 w-3" />}
                Edit Manually
              </Button>
            </div>
          )}

          {/* Custom Value Editor */}
          {resolution.isEditingCustom && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">
                Edit Custom Value (JSON format):
              </p>
              <Textarea
                value={resolution.customValue}
                onChange={(e) => handleCustomValueChange(e.target.value)}
                className="font-mono text-sm"
                rows={5}
                placeholder='{"example": "value"}'
              />
              {resolution.customValueError && (
                <p className="text-xs text-red-600">Error: {resolution.customValueError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveCustom}
                  disabled={!!resolution.customValueError}
                  title="Save custom value"
                >
                  <Check className="mr-1 h-3 w-3" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelCustom} title="Cancel">
                  <X className="mr-1 h-3 w-3" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Show resolved value preview */}
          {isResolved && (
            <div className="text-xs bg-white p-2 rounded border border-green-300">
              <p className="font-semibold text-green-700 mb-1">Resolved Value:</p>
              <pre className="overflow-x-auto">
                {JSON.stringify(parseValue(resolution.customValue), null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Expanded Details (3-way diff) */}
        {isExpanded && (
          <div className="ml-6 space-y-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              {/* Base Value */}
              <div className="space-y-1">
                <p className="font-semibold text-gray-700">Base (Ancestor)</p>
                <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                  {JSON.stringify(baseValue, null, 2)}
                </pre>
              </div>

              {/* Source Value */}
              <div className="space-y-1">
                <p className="font-semibold text-blue-700">Source Branch</p>
                <pre className="bg-blue-50 p-2 rounded border border-blue-200 overflow-x-auto">
                  {JSON.stringify(sourceValue, null, 2)}
                </pre>
              </div>

              {/* Target Value */}
              <div className="space-y-1">
                <p className="font-semibold text-green-700">Target Branch</p>
                <pre className="bg-green-50 p-2 rounded border border-green-200 overflow-x-auto">
                  {JSON.stringify(targetValue, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Component to display and resolve conflicts for a single entity
 */
function EntityResolutionCard({
  entity,
  resolutions,
  onUpdateResolution,
}: {
  entity: EntityMergePreview;
  resolutions: Map<string, ConflictResolutionState>;
  onUpdateResolution: (
    entityId: string,
    entityType: string,
    path: string,
    updated: Partial<ConflictResolutionState>
  ) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const entityConflicts = entity.conflicts;
  const resolvedCount = entityConflicts.filter((c) => {
    const key = `${entity.entityId}:${c.path}`;
    const res = resolutions.get(key);
    return res?.choice !== null && !res?.isEditingCustom;
  }).length;

  return (
    <Card className="p-4">
      {/* Entity Header */}
      <div className="flex items-center gap-2 mb-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {entity.entityType} #{entity.entityId}
            </span>
            <Badge variant="secondary" className="text-xs">
              {resolvedCount}/{entityConflicts.length} resolved
            </Badge>
            {resolvedCount === entityConflicts.length && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </div>
        </div>
      </div>

      {/* Entity Content */}
      {isExpanded && (
        <div className="space-y-3">
          {entityConflicts.map((conflict) => {
            const key = `${entity.entityId}:${conflict.path}`;
            const resolution = resolutions.get(key);
            if (!resolution) return null;

            return (
              <ResolutionItem
                key={key}
                conflict={conflict}
                entityId={entity.entityId}
                entityType={entity.entityType}
                resolution={resolution}
                onUpdate={(updated) =>
                  onUpdateResolution(entity.entityId, entity.entityType, conflict.path, updated)
                }
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

/**
 * ConflictResolutionDialog component provides a modal dialog for resolving
 * merge conflicts interactively.
 *
 * Features:
 * - Displays all conflicts that require manual resolution
 * - Three resolution options per conflict: Use Source, Use Target, Edit Manually
 * - Inline JSON editor with validation for custom values
 * - Progress tracking (X of Y conflicts resolved)
 * - Expandable entity cards with 3-way diff visualization
 * - Validation: all conflicts must be resolved before execution
 * - Execute merge button with loading state
 * - Success feedback with entity count
 *
 * @param props - Component props
 * @returns The ConflictResolutionDialog component
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const [entityPreviews, setEntityPreviews] = useState<EntityMergePreview[]>([]);
 *
 *   return (
 *     <>
 *       <MergePreviewDialog
 *         onProceedToResolve={(previews) => {
 *           setEntityPreviews(previews);
 *           setIsOpen(true);
 *         }}
 *       />
 *       <ConflictResolutionDialog
 *         sourceBranch={sourceBranch}
 *         targetBranch={targetBranch}
 *         entityPreviews={entityPreviews}
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         onMergeComplete={() => {
 *           console.log('Merge completed successfully!');
 *           setIsOpen(false);
 *         }}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function ConflictResolutionDialog({
  sourceBranch,
  targetBranch,
  entityPreviews,
  isOpen,
  onClose,
  onMergeComplete,
}: ConflictResolutionDialogProps): JSX.Element {
  const { campaign } = useCampaignStore();

  // Initialize resolution state for all conflicts
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolutionState>>(new Map());

  // Execute merge mutation
  const [executeMerge, { loading: executing, error: executeError }] = useExecuteMerge({
    onCompleted: (result) => {
      if (result.executeMerge.success && onMergeComplete) {
        onMergeComplete();
      }
    },
    refetchQueries: ['GetBranchHierarchy', 'GetBranch'],
    awaitRefetchQueries: true,
  });

  // Initialize resolutions when entity previews change
  useEffect(() => {
    if (!isOpen) return;

    const newResolutions = new Map<string, ConflictResolutionState>();

    entityPreviews.forEach((entity) => {
      entity.conflicts.forEach((conflict) => {
        const key = `${entity.entityId}:${conflict.path}`;
        newResolutions.set(key, {
          entityId: entity.entityId,
          entityType: entity.entityType,
          path: conflict.path,
          choice: null,
          customValue: '',
          sourceValue: conflict.sourceValue || 'null',
          targetValue: conflict.targetValue || 'null',
          isEditingCustom: false,
          customValueError: null,
        });
      });
    });

    setResolutions(newResolutions);
  }, [entityPreviews, isOpen]);

  // Update a specific resolution
  const handleUpdateResolution = useCallback(
    (
      entityId: string,
      _entityType: string,
      path: string,
      updated: Partial<ConflictResolutionState>
    ) => {
      setResolutions((prev) => {
        const key = `${entityId}:${path}`;
        const current = prev.get(key);
        if (!current) return prev;

        const newResolutions = new Map(prev);
        newResolutions.set(key, { ...current, ...updated });
        return newResolutions;
      });
    },
    []
  );

  // Calculate progress
  const { totalConflicts, resolvedConflicts, entitiesWithConflicts } = useMemo(() => {
    const entities = entityPreviews.filter((e) => e.conflicts.length > 0);
    const total = entities.reduce((sum, e) => sum + e.conflicts.length, 0);
    const resolved = Array.from(resolutions.values()).filter(
      (r) => r.choice !== null && !r.isEditingCustom
    ).length;

    return {
      totalConflicts: total,
      resolvedConflicts: resolved,
      entitiesWithConflicts: entities,
    };
  }, [entityPreviews, resolutions]);

  // Check if all conflicts are resolved
  const allResolved = totalConflicts > 0 && resolvedConflicts === totalConflicts;

  // Handle merge execution
  const handleExecuteMerge = useCallback(async () => {
    if (!allResolved || !sourceBranch || !targetBranch || !campaign?.currentWorldTime) {
      return;
    }

    // Build resolution array
    const resolutionArray: ConflictResolution[] = Array.from(resolutions.values())
      .filter((r) => r.choice !== null && !r.isEditingCustom)
      .map((r) => ({
        entityId: r.entityId,
        entityType: r.entityType,
        path: r.path,
        resolvedValue: r.customValue,
      }));

    // Execute merge
    await executeMerge({
      variables: {
        input: {
          sourceBranchId: sourceBranch.id,
          targetBranchId: targetBranch.id,
          worldTime: campaign.currentWorldTime,
          resolutions: resolutionArray,
        },
      },
    });
  }, [
    allResolved,
    sourceBranch,
    targetBranch,
    campaign?.currentWorldTime,
    resolutions,
    executeMerge,
  ]);

  // Keyboard shortcuts are handled by the Dialog component (Escape key via onOpenChange)

  // Handle dialog close
  const handleClose = () => {
    if (!executing) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col"
        data-testid="conflict-resolution-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Resolve Merge Conflicts
          </DialogTitle>
          <DialogDescription>
            Resolve conflicts to merge{' '}
            <span className="font-semibold">{sourceBranch?.name ?? 'unknown'}</span> into{' '}
            <span className="font-semibold">{targetBranch?.name ?? 'unknown'}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Branch Info */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-900">Source Branch</p>
              <p className="text-sm text-blue-700">{sourceBranch?.name ?? 'Unknown'}</p>
            </Card>
            <Card className="bg-green-50 p-3">
              <p className="text-xs font-semibold text-green-900">Target Branch</p>
              <p className="text-sm text-green-700">{targetBranch?.name ?? 'Unknown'}</p>
            </Card>
          </div>

          {/* Progress */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-900">
                    Progress: {resolvedConflicts} / {totalConflicts} conflicts resolved
                  </span>
                  {allResolved && <CheckCircle className="h-5 w-5 text-green-600" />}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${totalConflicts > 0 ? (resolvedConflicts / totalConflicts) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {!allResolved && (
              <Alert className="mt-3 bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  All conflicts must be resolved before executing the merge.
                </AlertDescription>
              </Alert>
            )}

            {allResolved && (
              <Alert className="mt-3 bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  All conflicts resolved! You can now execute the merge.
                </AlertDescription>
              </Alert>
            )}
          </Card>

          {/* Error State */}
          {executeError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Merge failed: {executeError.message || 'Unknown error occurred'}
              </AlertDescription>
            </Alert>
          )}

          {/* Executing State */}
          {executing && (
            <Card className="border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Executing merge...</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Creating versions in target branch and updating history.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Entity Resolution Cards */}
          {!executing && (
            <div className="space-y-3">
              {entitiesWithConflicts.map((entity) => (
                <EntityResolutionCard
                  key={`${entity.entityType}-${entity.entityId}`}
                  entity={entity}
                  resolutions={resolutions}
                  onUpdateResolution={handleUpdateResolution}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button
            type="button"
            onClick={handleClose}
            variant="outline"
            disabled={executing}
            title="Cancel and close dialog (Escape)"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleExecuteMerge}
            disabled={!allResolved || executing}
            title={
              allResolved ? 'Execute merge with resolved conflicts' : 'Resolve all conflicts first'
            }
            data-testid="conflict-resolution-execute"
          >
            {executing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge className="mr-2 h-4 w-4" />
                Execute Merge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
