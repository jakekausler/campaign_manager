import { AlertCircle } from 'lucide-react';

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

/**
 * Branch information needed for deletion dialog
 */
export interface BranchInfo {
  id: string;
  name: string;
  parentId?: string | null;
  children?: { id: string }[];
}

/**
 * Props for DeleteBranchDialog component
 */
export interface DeleteBranchDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when deletion is confirmed */
  onConfirm: () => void;
  /** Branch to delete */
  branch: BranchInfo | null;
  /** Whether the deletion action is loading */
  loading?: boolean;
  /** Whether this is the currently selected branch */
  isCurrentBranch?: boolean;
}

/**
 * Confirmation dialog for branch deletion with comprehensive safety checks.
 *
 * This dialog enforces branch deletion safeguards:
 * - Prevents deletion of root/main branch (no parentId)
 * - Prevents deletion of branches with children (must delete children first)
 * - Warns when deleting currently selected branch
 * - Shows impact warnings about versions and data loss
 *
 * Backend enforces these rules, but frontend provides better UX with clear messaging.
 *
 * @example
 * ```tsx
 * <DeleteBranchDialog
 *   open={showDeleteDialog}
 *   onClose={() => setShowDeleteDialog(false)}
 *   onConfirm={handleConfirmDelete}
 *   branch={selectedBranch}
 *   loading={deleting}
 *   isCurrentBranch={selectedBranch.id === currentBranchId}
 * />
 * ```
 */
export function DeleteBranchDialog({
  open,
  onClose,
  onConfirm,
  branch,
  loading = false,
  isCurrentBranch = false,
}: DeleteBranchDialogProps) {
  if (!branch) {
    return null;
  }

  const isRootBranch = !branch.parentId;
  const hasChildren = branch.children && branch.children.length > 0;
  const childCount = branch.children?.length || 0;

  // Determine if deletion should be blocked
  const isBlocked = isRootBranch || hasChildren;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {isBlocked ? 'Cannot Delete Branch' : 'Confirm Branch Deletion'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isRootBranch ? (
                // Root branch protection
                <>
                  <p>
                    <span className="font-semibold text-foreground">{branch.name}</span> is a{' '}
                    <span className="font-semibold text-destructive">root branch</span> and cannot
                    be deleted.
                  </p>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-800">
                      <AlertCircle className="mr-1 inline-block h-4 w-4" />
                      Why can&apos;t I delete this branch?
                    </p>
                    <p className="mt-1 text-sm text-amber-700">
                      Root branches (branches without a parent) serve as the foundation of your
                      campaign&apos;s timeline. Deleting them would orphan all child branches and
                      cause data loss.
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    If you need to reorganize your branches, consider creating a new branch and
                    migrating your data instead.
                  </p>
                </>
              ) : hasChildren ? (
                // Has children protection
                <>
                  <p>
                    <span className="font-semibold text-foreground">{branch.name}</span> has{' '}
                    <span className="font-semibold text-destructive">
                      {childCount} child {childCount === 1 ? 'branch' : 'branches'}
                    </span>{' '}
                    and cannot be deleted.
                  </p>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-800">
                      <AlertCircle className="mr-1 inline-block h-4 w-4" />
                      Delete child branches first
                    </p>
                    <p className="mt-1 text-sm text-amber-700">
                      To maintain data integrity, you must delete all child branches before deleting
                      this branch. This <strong>prevents orphaned branches</strong> (branches
                      without a parent) and ensures your campaign hierarchy remains valid.
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Navigate to each child branch and delete them first, then return to delete this
                    branch.
                  </p>
                </>
              ) : (
                // Can delete - show warnings
                <>
                  <p>
                    You are about to{' '}
                    <span className="font-semibold text-destructive">permanently delete</span>{' '}
                    <span className="font-semibold text-foreground">{branch.name}</span>.
                  </p>

                  {isCurrentBranch && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-800">
                        <AlertCircle className="mr-1 inline-block h-4 w-4" />
                        Currently Selected Branch
                      </p>
                      <p className="mt-1 text-sm text-amber-700">
                        This is your currently active branch. After deletion, you will be switched
                        to the parent branch.
                      </p>
                    </div>
                  )}

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-700">
                      ⚠️ This action will permanently delete:
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 pl-4 text-sm text-slate-600">
                      <li>All versions specific to this branch</li>
                      <li>Branch metadata and history</li>
                      <li>Any unsaved changes in this branch</li>
                      <li>Ability to view this branch&apos;s timeline</li>
                    </ul>
                  </div>

                  <p className="pt-2 text-sm font-semibold text-destructive">
                    This action cannot be undone.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isBlocked ? (
            // Only show close button when blocked
            <AlertDialogCancel>Close</AlertDialogCancel>
          ) : (
            // Show cancel and delete when not blocked
            <>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={loading}
                onClick={(e) => {
                  e.preventDefault();
                  onConfirm();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loading ? 'Deleting...' : 'Delete Branch'}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
