import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  GitMerge,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  usePreviewMerge,
  type Branch,
  type MergeConflict,
  type AutoResolvedChange,
  type EntityMergePreview,
} from '@/services/api/hooks';
import { useCampaignStore } from '@/stores';

/**
 * Props for MergePreviewDialog component
 */
export interface MergePreviewDialogProps {
  /** The source branch to merge from */
  sourceBranch: Branch | null;
  /** The target branch to merge into */
  targetBranch: Branch | null;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed or cancelled */
  onClose: () => void;
  /** Callback when user wants to proceed with merge */
  onProceedToResolve?: (entityPreviews: EntityMergePreview[]) => void;
}

/**
 * Component to display a single conflict
 */
function ConflictItem({ conflict }: { conflict: MergeConflict }) {
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

  return (
    <Card className="border-red-200 bg-red-50 p-3">
      <div className="space-y-2">
        {/* Conflict Header */}
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm font-mono text-red-900 bg-red-100 px-1 rounded">
                {conflict.path}
              </code>
              <Badge variant="destructive" className="text-xs">
                {conflict.type}
              </Badge>
            </div>
            <p className="text-sm text-red-800 mt-1">{conflict.description}</p>
            {conflict.suggestion && (
              <p className="text-xs text-red-600 mt-1 italic">{conflict.suggestion}</p>
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

        {/* Expanded Details */}
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
 * Component to display a single auto-resolved change
 */
function AutoResolvedItem({ change }: { change: AutoResolvedChange }) {
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

  const baseValue = parseValue(change.baseValue);
  const sourceValue = parseValue(change.sourceValue);
  const targetValue = parseValue(change.targetValue);
  const resolvedValue = parseValue(change.resolvedValue);

  // Determine badge color based on resolution
  const getBadgeVariant = () => {
    switch (change.resolvedTo) {
      case 'source':
        return 'default'; // Blue
      case 'target':
        return 'secondary'; // Gray
      case 'both':
        return 'outline'; // Outlined
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="border-green-200 bg-green-50 p-3">
      <div className="space-y-2">
        {/* Change Header */}
        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm font-mono text-green-900 bg-green-100 px-1 rounded">
                {change.path}
              </code>
              <Badge variant={getBadgeVariant()} className="text-xs">
                → {change.resolvedTo}
              </Badge>
            </div>
            <p className="text-xs text-green-700 mt-1">
              Resolved to <span className="font-semibold">{change.resolvedTo}</span> value
            </p>
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

        {/* Expanded Details */}
        {isExpanded && (
          <div className="ml-6 space-y-2 text-xs">
            <div className="grid grid-cols-4 gap-2">
              {/* Base Value */}
              <div className="space-y-1">
                <p className="font-semibold text-gray-700">Base</p>
                <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                  {JSON.stringify(baseValue, null, 2)}
                </pre>
              </div>

              {/* Source Value */}
              <div className="space-y-1">
                <p className="font-semibold text-blue-700">Source</p>
                <pre className="bg-blue-50 p-2 rounded border border-blue-200 overflow-x-auto">
                  {JSON.stringify(sourceValue, null, 2)}
                </pre>
              </div>

              {/* Target Value */}
              <div className="space-y-1">
                <p className="font-semibold text-green-700">Target</p>
                <pre className="bg-green-50 p-2 rounded border border-green-200 overflow-x-auto">
                  {JSON.stringify(targetValue, null, 2)}
                </pre>
              </div>

              {/* Resolved Value */}
              <div className="space-y-1">
                <p className="font-semibold text-emerald-700">Resolved</p>
                <pre className="bg-emerald-50 p-2 rounded border border-emerald-200 overflow-x-auto">
                  {JSON.stringify(resolvedValue, null, 2)}
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
 * Component to display merge preview for a single entity
 */
function EntityPreviewCard({ entity }: { entity: EntityMergePreview }) {
  const [isExpanded, setIsExpanded] = useState(true);

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
            {entity.conflicts.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {entity.conflicts.length} conflict{entity.conflicts.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {entity.autoResolvedChanges.length > 0 && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                {entity.autoResolvedChanges.length} auto-resolved
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Entity Content */}
      {isExpanded && (
        <div className="space-y-3">
          {/* Conflicts */}
          {entity.conflicts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700">Conflicts:</p>
              {entity.conflicts.map((conflict, idx) => (
                <ConflictItem
                  key={`${entity.entityId}-${conflict.path}-${idx}`}
                  conflict={conflict}
                />
              ))}
            </div>
          )}

          {/* Auto-Resolved Changes */}
          {entity.autoResolvedChanges.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-green-700">Auto-Resolved Changes:</p>
              {entity.autoResolvedChanges.map((change, idx) => (
                <AutoResolvedItem
                  key={`${entity.entityId}-${change.path}-${idx}`}
                  change={change}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * MergePreviewDialog component provides a modal dialog for previewing merge operations
 * before execution.
 *
 * Features:
 * - Displays source and target branch information
 * - Shows total conflicts and auto-resolved changes count
 * - Tabs to organize conflicts and auto-resolved changes
 * - Expandable entity cards with detailed conflict/change information
 * - Visual indicators (red for conflicts, green for auto-resolved)
 * - Syntax-highlighted JSON values in expanded details
 * - Keyboard shortcuts (Escape to cancel)
 * - Integration with merge resolution workflow
 *
 * @param props - Component props
 * @returns The MergePreviewDialog component
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const sourceBranch = useGetBranch(sourceBranchId);
 *   const targetBranch = useGetBranch(targetBranchId);
 *
 *   return (
 *     <>
 *       <Button onClick={() => setIsOpen(true)}>Preview Merge</Button>
 *       <MergePreviewDialog
 *         sourceBranch={sourceBranch.data?.branch}
 *         targetBranch={targetBranch.data?.branch}
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         onProceedToResolve={(entityPreviews) => {
 *           // Open conflict resolution dialog
 *           console.log('Proceeding to resolve', entityPreviews);
 *         }}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function MergePreviewDialog({
  sourceBranch,
  targetBranch,
  isOpen,
  onClose,
  onProceedToResolve,
}: MergePreviewDialogProps): JSX.Element {
  const { campaign } = useCampaignStore();
  const [activeTab, setActiveTab] = useState<'conflicts' | 'resolved'>('conflicts');

  // Fetch merge preview
  const { data, loading, error } = usePreviewMerge(
    {
      sourceBranchId: sourceBranch?.id ?? '',
      targetBranchId: targetBranch?.id ?? '',
      worldTime: campaign?.currentWorldTime ?? '',
    },
    {
      skip: !isOpen || !sourceBranch || !targetBranch || !campaign?.currentWorldTime,
    }
  );

  // Reset active tab when dialog opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('conflicts');
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle dialog close
  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  // Handle proceed to resolution
  const handleProceed = useCallback(() => {
    if (data?.previewMerge && onProceedToResolve) {
      onProceedToResolve(data.previewMerge.entities);
    }
  }, [data, onProceedToResolve]);

  const preview = data?.previewMerge;

  // Count entities with conflicts vs auto-resolved only
  const entitiesWithConflicts = preview?.entities.filter((e) => e.conflicts.length > 0) ?? [];
  const entitiesAutoResolvedOnly =
    preview?.entities.filter((e) => e.conflicts.length === 0 && e.autoResolvedChanges.length > 0) ??
    [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Merge Preview
          </DialogTitle>
          <DialogDescription>
            Review changes and conflicts before merging{' '}
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

          {/* Loading State */}
          {loading && (
            <Card className="border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Analyzing merge...</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Comparing entity versions and detecting conflicts.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Preview failed: {error.message || 'Unknown error occurred'}
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Results */}
          {preview && !loading && (
            <>
              {/* Summary */}
              <Card className="p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{preview.entities.length}</p>
                    <p className="text-xs text-gray-600">Total Entities</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{preview.totalConflicts}</p>
                    <p className="text-xs text-gray-600">Conflicts</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{preview.totalAutoResolved}</p>
                    <p className="text-xs text-gray-600">Auto-Resolved</p>
                  </div>
                </div>

                {preview.requiresManualResolution && (
                  <Alert className="mt-3 bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      This merge requires manual conflict resolution before it can be executed.
                    </AlertDescription>
                  </Alert>
                )}

                {!preview.requiresManualResolution && preview.totalAutoResolved > 0 && (
                  <Alert className="mt-3 bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      All changes can be auto-resolved. No conflicts detected!
                    </AlertDescription>
                  </Alert>
                )}

                {preview.entities.length === 0 && (
                  <Alert className="mt-3 bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      No entity changes detected between these branches.
                    </AlertDescription>
                  </Alert>
                )}
              </Card>

              {/* Tabs for Conflicts vs Auto-Resolved */}
              {preview.entities.length > 0 && (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="conflicts" className="gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Conflicts ({entitiesWithConflicts.length})
                    </TabsTrigger>
                    <TabsTrigger value="resolved" className="gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Auto-Resolved ({entitiesAutoResolvedOnly.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Conflicts Tab */}
                  <TabsContent value="conflicts" className="space-y-3 mt-4">
                    {entitiesWithConflicts.length > 0 ? (
                      entitiesWithConflicts.map((entity) => (
                        <EntityPreviewCard
                          key={`${entity.entityType}-${entity.entityId}`}
                          entity={entity}
                        />
                      ))
                    ) : (
                      <Card className="p-4 text-center text-gray-600">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                        <p className="text-sm">No conflicts detected!</p>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Auto-Resolved Tab */}
                  <TabsContent value="resolved" className="space-y-3 mt-4">
                    {entitiesAutoResolvedOnly.length > 0 ? (
                      entitiesAutoResolvedOnly.map((entity) => (
                        <EntityPreviewCard
                          key={`${entity.entityType}-${entity.entityId}`}
                          entity={entity}
                        />
                      ))
                    ) : (
                      <Card className="p-4 text-center text-gray-600">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No auto-resolved changes without conflicts.</p>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button
            type="button"
            onClick={handleClose}
            variant="outline"
            disabled={loading}
            title="Cancel and close dialog (Escape)"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          {preview && preview.requiresManualResolution && (
            <Button
              onClick={handleProceed}
              disabled={loading}
              title="Proceed to conflict resolution"
              data-testid="merge-preview-proceed"
            >
              Proceed to Resolve Conflicts
            </Button>
          )}
          {preview && !preview.requiresManualResolution && preview.totalAutoResolved > 0 && (
            <Button
              onClick={handleProceed}
              disabled={loading}
              title="Proceed to execute merge"
              data-testid="merge-preview-execute"
            >
              <GitMerge className="mr-2 h-4 w-4" />
              Execute Merge
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
