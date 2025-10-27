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
 * Props for LevelChangeConfirmationDialog component
 */
export interface LevelChangeConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when level change is confirmed */
  onConfirm: () => void;
  /** Entity type being modified (settlement or structure) */
  entityType: 'settlement' | 'structure';
  /** Entity name for display */
  entityName: string;
  /** Current level of the entity */
  currentLevel: number;
  /** Proposed new level */
  newLevel: number;
  /** Whether the confirmation action is loading */
  loading?: boolean;
}

/**
 * Confirmation dialog for level changes with rules engine impact warning.
 *
 * This dialog warns users that changing an entity's level may trigger
 * rules engine recalculation, affecting computed fields, conditions,
 * and effects for this entity and potentially related entities.
 *
 * @example
 * ```tsx
 * <LevelChangeConfirmationDialog
 *   open={showConfirmation}
 *   onClose={() => setShowConfirmation(false)}
 *   onConfirm={handleConfirmLevelChange}
 *   entityType="settlement"
 *   entityName="Westholm"
 *   currentLevel={2}
 *   newLevel={3}
 *   loading={updating}
 * />
 * ```
 */
export function LevelChangeConfirmationDialog({
  open,
  onClose,
  onConfirm,
  entityType,
  entityName,
  currentLevel,
  newLevel,
  loading = false,
}: LevelChangeConfirmationDialogProps) {
  const isIncreasing = newLevel > currentLevel;
  const levelChange = isIncreasing ? 'increase' : 'decrease';

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Level Change</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You are about to {levelChange} the level of <strong>{entityName}</strong> from{' '}
                {currentLevel} to {newLevel}.
              </p>
              <p className="pt-2 text-sm text-muted-foreground">
                <strong className="text-amber-600">⚠️ Important:</strong> Changing the level may
                trigger rules engine recalculation, which could affect:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                <li>Computed fields for this {entityType}</li>
                <li>Active conditions and their evaluation results</li>
                <li>Effects that depend on the level variable</li>
                {entityType === 'settlement' && <li>All structures within this settlement</li>}
              </ul>
              <p className="pt-2 text-sm font-medium">Do you want to continue?</p>
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
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? 'Updating...' : `Yes, ${levelChange} level`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
