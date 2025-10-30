import { AlertCircle, CheckCircle, Cherry, Loader2, X } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useCherryPickVersion,
  type MergeConflict,
  type ConflictResolution,
} from '@/services/api/hooks/merge';

/**
 * Version information structure
 */
export interface VersionInfo {
  /** Version ID */
  id: string;
  /** Entity ID this version belongs to */
  entityId: string;
  /** Entity type (e.g., "settlement", "structure") */
  entityType: string;
  /** Branch ID this version is from */
  branchId: string;
  /** Human-readable version description (optional) */
  description?: string;
}

/**
 * Branch information structure
 */
export interface BranchInfo {
  /** Branch ID */
  id: string;
  /** Branch name */
  name: string;
}

/**
 * Props for CherryPickDialog component
 */
export interface CherryPickDialogProps {
  /** The version to cherry-pick */
  version: VersionInfo | null;
  /** The target branch to apply the version to */
  targetBranch: BranchInfo | null;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed or cancelled */
  onClose: () => void;
  /** Callback when cherry-pick completes successfully */
  onSuccess?: (newVersionId: string) => void;
}

/**
 * Props for simple cherry-pick conflict resolution dialog
 */
interface CherryPickConflictDialogProps {
  conflicts: MergeConflict[];
  entityId: string;
  entityType: string;
  isOpen: boolean;
  onClose: () => void;
  onResolve: (resolutions: ConflictResolution[]) => Promise<void>;
}

/**
 * Simple conflict resolution dialog for cherry-pick operations
 * Shows conflicts and allows manual resolution
 */
function CherryPickConflictDialog({
  conflicts,
  entityId,
  entityType,
  isOpen,
  onClose,
  onResolve,
}: CherryPickConflictDialogProps): JSX.Element {
  const [resolutions, setResolutions] = useState<Map<string, string>>(new Map());
  const [resolving, setResolving] = useState(false);

  // Initialize resolutions when conflicts change
  useEffect(() => {
    const newResolutions = new Map<string, string>();
    conflicts.forEach((conflict) => {
      // Default to source value
      newResolutions.set(conflict.path, conflict.sourceValue || 'null');
    });
    setResolutions(newResolutions);
  }, [conflicts]);

  const handleResolve = async () => {
    setResolving(true);
    try {
      const resolutionArray: ConflictResolution[] = conflicts.map((conflict) => ({
        entityId,
        entityType,
        path: conflict.path,
        resolvedValue: resolutions.get(conflict.path) || 'null',
      }));
      await onResolve(resolutionArray);
    } finally {
      setResolving(false);
    }
  };

  const allResolved = conflicts.every((c) => resolutions.has(c.path));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Cherry-Pick Conflicts Detected
          </DialogTitle>
          <DialogDescription>
            Resolve conflicts to apply this version to {entityType}: {entityId}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3">
          {conflicts.map((conflict) => (
            <Card key={conflict.path} className="p-3">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                    {conflict.path}
                  </code>
                  <Badge variant="secondary" className="text-xs">
                    {conflict.type}
                  </Badge>
                </div>
                <p className="text-sm text-gray-700">{conflict.description}</p>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Resolved Value (JSON):</Label>
                  <Textarea
                    value={resolutions.get(conflict.path) || ''}
                    onChange={(e) => {
                      const newResolutions = new Map(resolutions);
                      newResolutions.set(conflict.path, e.target.value);
                      setResolutions(newResolutions);
                    }}
                    className="font-mono text-sm"
                    rows={3}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose} variant="outline" disabled={resolving}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleResolve} disabled={!allResolved || resolving}>
            {resolving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resolving...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Apply Resolution
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * CherryPickDialog component provides a modal dialog for cherry-picking versions
 * (selectively applying a specific version from one branch to another).
 *
 * Features:
 * - Displays source version and target branch information
 * - Shows loading state with progress message during cherry-pick operation
 * - Displays success message with new version ID
 * - Comprehensive error handling
 * - Conflict detection and resolution UI
 * - Two-phase operation: try cherry-pick → detect conflicts → resolve → retry
 * - Keyboard shortcuts (Escape to cancel)
 *
 * @param props - Component props
 * @returns The CherryPickDialog component
 *
 * @example
 * ```tsx
 * function VersionHistoryItem() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const version = { id: 'v-123', entityId: 'e-456', entityType: 'settlement', branchId: 'b-789' };
 *   const targetBranch = { id: 'b-999', name: 'Main Branch' };
 *
 *   return (
 *     <>
 *       <Button onClick={() => setIsOpen(true)}>Cherry-Pick Version</Button>
 *       <CherryPickDialog
 *         version={version}
 *         targetBranch={targetBranch}
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         onSuccess={(newVersionId) => {
 *           console.log(`Cherry-picked! New version: ${newVersionId}`);
 *         }}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function CherryPickDialog({
  version,
  targetBranch,
  isOpen,
  onClose,
  onSuccess,
}: CherryPickDialogProps): JSX.Element {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  const [cherryPick, { loading, error, reset }] = useCherryPickVersion({
    onCompleted: (result) => {
      if (result.cherryPickVersion.success && !result.cherryPickVersion.hasConflict) {
        // Success - no conflicts
        const versionId = result.cherryPickVersion.versionId;
        setSuccessMessage(`Cherry-pick completed successfully! New version created: ${versionId}`);
        onSuccess?.(versionId ?? '');
      } else if (result.cherryPickVersion.hasConflict && result.cherryPickVersion.conflicts) {
        // Conflicts detected - show resolution dialog
        setConflicts(result.cherryPickVersion.conflicts);
        setShowConflictDialog(true);
      } else if (result.cherryPickVersion.error) {
        // Error occurred
        setValidationError(result.cherryPickVersion.error);
      }
    },
    // Refetch branch data to show new version
    refetchQueries: ['GetBranch', 'GetBranchVersions'],
    awaitRefetchQueries: true,
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setValidationError(null);
      setSuccessMessage(null);
      setConflicts([]);
      setShowConflictDialog(false);
      reset();
    }
  }, [isOpen, reset]);

  // Handle cherry-pick submission
  const handleCherryPick = useCallback(
    async (resolutions?: ConflictResolution[]) => {
      // Validate input
      if (!version) {
        setValidationError('Source version not found');
        return;
      }

      if (!targetBranch) {
        setValidationError('Target branch not found');
        return;
      }

      setValidationError(null);
      setSuccessMessage(null);

      // Execute cherry-pick mutation
      try {
        await cherryPick({
          variables: {
            input: {
              sourceVersionId: version.id,
              targetBranchId: targetBranch.id,
              resolutions: resolutions ?? [],
            },
          },
        });
      } catch (err) {
        // Error will be handled by onCompleted callback
        console.error('Cherry-pick error:', err);
      }
    },
    [version, targetBranch, cherryPick]
  );

  // Handle conflict resolution
  const handleConflictResolution = useCallback(
    async (resolutions: ConflictResolution[]) => {
      setShowConflictDialog(false);
      setConflicts([]);
      // Retry cherry-pick with resolutions
      await handleCherryPick(resolutions);
    },
    [handleCherryPick]
  );

  // Handle close
  const handleClose = useCallback(() => {
    if (!loading) {
      onClose();
    }
  }, [loading, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape' && !loading && !showConflictDialog) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, showConflictDialog, handleClose]);

  return (
    <>
      <Dialog open={isOpen && !showConflictDialog} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cherry className="w-5 h-5 text-purple-600" />
              Cherry-Pick Version
            </DialogTitle>
            <DialogDescription>
              Selectively apply this version to the target branch
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Version Information */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Source Version</Label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                <div className="text-xs">
                  <span className="font-medium">Version ID:</span>{' '}
                  <span className="font-mono text-slate-600">{version?.id ?? 'N/A'}</span>
                </div>
                <div className="text-xs">
                  <span className="font-medium">Entity:</span>{' '}
                  <span className="text-slate-600">
                    {version?.entityType ?? 'N/A'} ({version?.entityId ?? 'N/A'})
                  </span>
                </div>
                {version?.description && (
                  <div className="text-xs">
                    <span className="font-medium">Description:</span>{' '}
                    <span className="text-slate-600">{version.description}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Target Branch Information */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Target Branch</Label>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-sm font-medium text-blue-900">
                  {targetBranch?.name ?? 'N/A'}
                </div>
                <div className="text-xs text-blue-700 font-mono mt-1">
                  {targetBranch?.id ?? 'N/A'}
                </div>
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {/* GraphQL Error */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Cherry-pick failed</div>
                  <div className="text-xs">{error.message}</div>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {successMessage && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
              </Alert>
            )}

            {/* Info Message */}
            {!successMessage && !error && !validationError && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  This will apply the selected version to the target branch. If conflicts are
                  detected, you will be prompted to resolve them.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              {successMessage ? 'Close' : 'Cancel'}
            </Button>
            {!successMessage && (
              <Button
                onClick={() => handleCherryPick()}
                disabled={loading || !version || !targetBranch}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cherry-picking...
                  </>
                ) : (
                  'Cherry-Pick'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict Resolution Dialog - Cherry-Pick Version */}
      {showConflictDialog && version && (
        <CherryPickConflictDialog
          conflicts={conflicts}
          entityId={version.entityId}
          entityType={version.entityType}
          isOpen={showConflictDialog}
          onClose={() => {
            setShowConflictDialog(false);
            setConflicts([]);
            onClose(); // Close parent dialog too
          }}
          onResolve={handleConflictResolution}
        />
      )}
    </>
  );
}
