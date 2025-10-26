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
 * Props for DeleteStructureConfirmationDialog component
 */
export interface DeleteStructureConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when deletion is confirmed */
  onConfirm: () => void;
  /** Structure name for display */
  structureName: string;
  /** Structure type for context */
  structureType?: string;
  /** Number of structures to delete (for bulk operations) */
  count?: number;
  /** Whether the deletion action is loading */
  loading?: boolean;
  /** Warning message about impact (optional) */
  impactWarning?: string;
}

/**
 * Confirmation dialog for structure deletion with impact warnings.
 *
 * This dialog warns users that deleting a structure may affect:
 * - Active conditions that reference this structure
 * - Effects that target this structure
 * - Rules engine calculations for the parent settlement
 *
 * Supports both single and bulk deletion operations.
 *
 * @example
 * ```tsx
 * <DeleteStructureConfirmationDialog
 *   open={showDeleteDialog}
 *   onClose={() => setShowDeleteDialog(false)}
 *   onConfirm={handleConfirmDelete}
 *   structureName="Grand Library"
 *   structureType="library"
 *   loading={deleting}
 *   impactWarning="This structure is referenced by 3 conditions"
 * />
 * ```
 *
 * @example Bulk deletion
 * ```tsx
 * <DeleteStructureConfirmationDialog
 *   open={showBulkDelete}
 *   onClose={() => setShowBulkDelete(false)}
 *   onConfirm={handleBulkDelete}
 *   structureName="Multiple Structures"
 *   count={5}
 *   loading={deleting}
 * />
 * ```
 */
export function DeleteStructureConfirmationDialog({
  open,
  onClose,
  onConfirm,
  structureName,
  structureType,
  count = 1,
  loading = false,
  impactWarning,
}: DeleteStructureConfirmationDialogProps) {
  const isBulk = count > 1;
  const displayName = isBulk ? `${count} structures` : structureName;
  const typeDisplay = structureType ? ` (${structureType})` : '';

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Confirm Structure Deletion
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                You are about to{' '}
                <span className="font-semibold text-destructive">permanently delete</span>{' '}
                <span className="font-semibold text-foreground">
                  {displayName}
                  {!isBulk && typeDisplay}
                </span>
                .
              </p>

              {impactWarning && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-800">
                    <AlertCircle className="mr-1 inline-block h-4 w-4" />
                    Impact Warning
                  </p>
                  <p className="mt-1 text-sm text-amber-700">{impactWarning}</p>
                </div>
              )}

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">⚠️ This action will affect:</p>
                <ul className="mt-2 list-inside list-disc space-y-1 pl-4 text-sm text-slate-600">
                  <li>
                    Active conditions referencing {isBulk ? 'these structures' : 'this structure'}
                  </li>
                  <li>Effects targeting {isBulk ? 'these structures' : 'this structure'}</li>
                  <li>Rules engine calculations for the parent settlement</li>
                  {!isBulk && <li>Any child entities or dependencies</li>}
                </ul>
              </div>

              <p className="pt-2 text-sm font-semibold text-destructive">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Deleting...' : isBulk ? `Delete ${count} Structures` : 'Delete Structure'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
