import { AlertCircle, CheckCircle, GitBranch, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForkBranch, type Branch } from '@/services/api/hooks';
import { useCampaignStore } from '@/stores';

/**
 * Props for ForkBranchDialog component
 */
export interface ForkBranchDialogProps {
  /** The source branch to fork from */
  sourceBranch: Branch | null;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed or cancelled */
  onClose: () => void;
  /** Callback when fork completes successfully */
  onSuccess?: (newBranchId: string, versionsCopied: number) => void;
}

/**
 * ForkBranchDialog component provides a modal dialog for forking branches
 * (creating alternate timeline branches).
 *
 * Features:
 * - Input for new branch name (required)
 * - Input for branch description (optional)
 * - Displays source branch name and current world time as divergence point
 * - Shows loading state with progress message during fork operation
 * - Displays success message with count of versions copied
 * - Comprehensive error handling with validation
 * - Automatically switches to new branch on successful fork
 * - Keyboard shortcuts (Enter to submit, Escape to cancel)
 *
 * @param props - Component props
 * @returns The ForkBranchDialog component
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const currentBranch = useGetBranch(branchId);
 *
 *   return (
 *     <>
 *       <Button onClick={() => setIsOpen(true)}>Fork Branch</Button>
 *       <ForkBranchDialog
 *         sourceBranch={currentBranch}
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         onSuccess={(newBranchId, versionsCopied) => {
 *           console.log(`Forked! ${versionsCopied} versions copied`);
 *         }}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function ForkBranchDialog({
  sourceBranch,
  isOpen,
  onClose,
  onSuccess,
}: ForkBranchDialogProps): JSX.Element {
  const { campaign, setCurrentBranch } = useCampaignStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [forkBranch, { loading, error, reset }] = useForkBranch({
    onCompleted: (result) => {
      const versionsCopied = result.forkBranch.versionsCopied;
      const newBranchId = result.forkBranch.branch.id;

      // Set success message
      setSuccessMessage(
        `Fork created successfully! ${versionsCopied} version${versionsCopied === 1 ? '' : 's'} copied.`
      );

      // Automatically switch to the new branch
      setCurrentBranch(newBranchId);

      // Notify parent component
      onSuccess?.(newBranchId, versionsCopied);
    },
    // Refetch branch hierarchy to show new branch in BranchSelector
    refetchQueries: ['GetBranchHierarchy'],
    awaitRefetchQueries: true,
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset form fields when dialog closes
      setName('');
      setDescription('');
      setValidationError(null);
      setSuccessMessage(null);
      reset();
    }
  }, [isOpen, reset]);

  // Handle form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Validate input
    if (!name.trim()) {
      setValidationError('Branch name is required');
      return;
    }

    if (!sourceBranch) {
      setValidationError('Source branch not found');
      return;
    }

    if (!campaign?.currentWorldTime) {
      setValidationError('Current world time not available');
      return;
    }

    setValidationError(null);

    // Execute fork mutation
    try {
      await forkBranch({
        variables: {
          input: {
            sourceBranchId: sourceBranch.id,
            name: name.trim(),
            description: description.trim() || null,
            worldTime: campaign.currentWorldTime,
          },
        },
      });
    } catch (err) {
      // Error is handled by Apollo's error state
      console.error('Fork branch error:', err);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen || loading || successMessage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to submit (only if name is filled)
      if (e.key === 'Enter' && name.trim()) {
        e.preventDefault();
        handleSubmit();
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, successMessage, name, handleSubmit, onClose]);

  // Handle dialog close
  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  // Format world time for display
  const worldTimeLabel = campaign?.currentWorldTime
    ? new Date(campaign.currentWorldTime).toLocaleString()
    : 'Unknown';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Fork Branch</DialogTitle>
          <DialogDescription>
            Create a new branch from{' '}
            <span className="font-semibold">{sourceBranch?.name ?? 'unknown'}</span> to explore an
            alternate timeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Source Branch Info */}
            <Card className="bg-slate-50 p-3">
              <div className="flex items-start gap-3">
                <GitBranch className="h-5 w-5 text-slate-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">Source Branch</p>
                  <p className="text-sm text-slate-600">{sourceBranch?.name ?? 'Unknown'}</p>
                  {sourceBranch?.description && (
                    <p className="mt-1 text-xs text-slate-500">{sourceBranch.description}</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Divergence Point */}
            <Card className="bg-blue-50 p-3">
              <div className="text-sm">
                <p className="font-semibold text-blue-900">Divergence Point</p>
                <p className="text-blue-700">{worldTimeLabel}</p>
                <p className="mt-1 text-xs text-blue-600">
                  All entity versions at this world time will be copied to the new branch.
                </p>
              </div>
            </Card>

            {/* Branch Name Input */}
            <div className="space-y-2">
              <Label htmlFor="branch-name">
                Branch Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="branch-name"
                type="text"
                placeholder="e.g., Alternate Timeline, What if...?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading || !!successMessage}
                data-testid="fork-branch-name-input"
              />
            </div>

            {/* Branch Description Input */}
            <div className="space-y-2">
              <Label htmlFor="branch-description">Description (optional)</Label>
              <Input
                id="branch-description"
                type="text"
                placeholder="Describe this alternate timeline..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading || !!successMessage}
                data-testid="fork-branch-description-input"
              />
            </div>

            {/* Validation Error */}
            {validationError && (
              <Alert variant="destructive" data-testid="fork-branch-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {/* GraphQL Error */}
            {error && (
              <Alert variant="destructive" data-testid="fork-branch-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Fork failed: {error.message || 'Unknown error occurred'}
                </AlertDescription>
              </Alert>
            )}

            {/* Loading State */}
            {loading && (
              <Card className="border-blue-200 bg-blue-50 p-3">
                <div className="flex items-start gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-800">Creating fork...</p>
                    <p className="mt-1 text-xs text-blue-600">
                      Copying entity versions to new branch. This may take a moment.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Success Message */}
            {successMessage && (
              <Card className="border-green-200 bg-green-50 p-3" data-testid="fork-branch-success">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800">{successMessage}</p>
                    <p className="mt-1 text-xs text-green-600">
                      You&apos;ve been automatically switched to the new branch.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <DialogFooter>
            {!successMessage && (
              <>
                <Button
                  type="button"
                  onClick={handleClose}
                  variant="outline"
                  disabled={loading}
                  title="Cancel and close dialog (Escape)"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !name.trim()}
                  title={name.trim() ? 'Create fork (Enter)' : 'Enter branch name first'}
                  data-testid="fork-branch-submit"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Creating Fork...' : 'Create Fork'}
                </Button>
              </>
            )}
            {successMessage && (
              <Button onClick={handleClose} variant="default" data-testid="fork-branch-close">
                Close
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
