import { AlertCircle, CheckCircle, Loader2, PencilLine } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useGetBranchHierarchy, useUpdateBranch, type Branch } from '@/services/api/hooks';
import { useCampaignStore } from '@/stores';

/**
 * Props for RenameBranchDialog component
 */
export interface RenameBranchDialogProps {
  /** The branch to rename */
  branch: Branch | null;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed or cancelled */
  onClose: () => void;
  /** Callback when rename completes successfully */
  onSuccess?: (branchId: string) => void;
}

/**
 * RenameBranchDialog component provides a modal dialog for renaming branches.
 *
 * Features:
 * - Input for new branch name (required, validated for uniqueness)
 * - Input for branch description (optional)
 * - Frontend validation to prevent duplicate names within campaign
 * - Shows loading state during update operation
 * - Displays success message after successful rename
 * - Comprehensive error handling with validation
 * - Keyboard shortcuts (Enter to submit, Escape to cancel)
 * - Defense in depth: both frontend and backend validation
 *
 * @param props - Component props
 * @returns The RenameBranchDialog component
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const branch = useGetBranch(branchId);
 *
 *   return (
 *     <>
 *       <Button onClick={() => setIsOpen(true)}>Rename Branch</Button>
 *       <RenameBranchDialog
 *         branch={branch}
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         onSuccess={(branchId) => {
 *           console.log(`Branch ${branchId} renamed!`);
 *         }}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function RenameBranchDialog({
  branch,
  isOpen,
  onClose,
  onSuccess,
}: RenameBranchDialogProps): JSX.Element {
  const { campaign } = useCampaignStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get all branches for duplicate name validation
  const { data: hierarchyData } = useGetBranchHierarchy({
    variables: { campaignId: campaign?.id || '' },
    skip: !campaign?.id,
  });

  const [updateBranch, { loading, error, reset }] = useUpdateBranch({
    onCompleted: () => {
      // Set success message
      setSuccessMessage('Branch renamed successfully!');

      // Notify parent component
      onSuccess?.(branch?.id || '');
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen && branch) {
      setName(branch.name);
      setDescription(branch.description || '');
      setValidationError(null);
      setSuccessMessage(null);
      reset();
    }
  }, [isOpen, branch, reset]);

  /**
   * Check if the new name conflicts with an existing branch
   */
  const checkDuplicateName = useCallback(
    (newName: string): boolean => {
      if (!hierarchyData?.branchHierarchy || !branch) {
        return false;
      }

      // Get flat list of all branches
      const flattenHierarchy = (nodes: typeof hierarchyData.branchHierarchy): Branch[] => {
        const branches: Branch[] = [];
        for (const node of nodes) {
          branches.push(node.branch);
          if (node.children) {
            branches.push(...flattenHierarchy(node.children));
          }
        }
        return branches;
      };

      const allBranches = flattenHierarchy(hierarchyData.branchHierarchy);

      // Check if any other branch (excluding current branch) has this name
      return allBranches.some((b) => b.id !== branch.id && b.name === newName);
    },
    [hierarchyData, branch]
  );

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      // Reset previous validation errors
      setValidationError(null);

      // Validate inputs
      const trimmedName = name.trim();

      if (!trimmedName) {
        setValidationError('Branch name is required');
        return;
      }

      if (!branch) {
        setValidationError('No branch selected');
        return;
      }

      // Check for duplicate name
      if (checkDuplicateName(trimmedName)) {
        setValidationError(`A branch named "${trimmedName}" already exists in this campaign`);
        return;
      }

      // Execute mutation
      updateBranch({
        variables: {
          id: branch.id,
          input: {
            name: trimmedName,
            description: description.trim() || null,
          },
        },
        refetchQueries: ['GetBranchHierarchy', 'GetBranches'],
      });
    },
    [name, description, branch, checkDuplicateName, updateBranch]
  );

  /**
   * Handle dialog close
   */
  const handleClose = useCallback(() => {
    // Prevent closing during loading operation
    if (loading) {
      return;
    }

    onClose();
  }, [loading, onClose]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !loading && name.trim() && !successMessage) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        handleClose();
      }
    },
    [loading, name, successMessage, handleSubmit, handleClose]
  );

  // Check if form is valid and can be submitted
  const isFormValid = !loading && name.trim() && !successMessage;
  const hasChanges =
    branch && (name.trim() !== branch.name || description.trim() !== (branch.description || ''));

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="h-5 w-5" />
            Rename Branch
          </DialogTitle>
          <DialogDescription>
            Update the branch name and description. Branch names must be unique within the campaign.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="rename-branch-name">
              Branch Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rename-branch-name"
              type="text"
              placeholder="Enter branch name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoComplete="off"
              aria-required="true"
              aria-invalid={!!validationError}
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="rename-branch-description">Description (optional)</Label>
            <Textarea
              id="rename-branch-description"
              placeholder="Enter branch description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Validation Error */}
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* GraphQL Mutation Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error.message || 'Failed to rename branch. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loading && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Renaming branch...</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {successMessage && (
            <Alert className="border-green-500 bg-green-50 text-green-900">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            {successMessage ? (
              <Button type="button" onClick={handleClose}>
                Close
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isFormValid || !hasChanges}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Renaming...
                    </>
                  ) : (
                    'Rename Branch'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
