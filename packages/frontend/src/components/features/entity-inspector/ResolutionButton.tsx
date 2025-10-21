import { CheckCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Props for ResolutionButton component
 */
export interface ResolutionButtonProps {
  /** Type of entity ('event' or 'encounter') */
  entityType: 'event' | 'encounter';
  /** Whether the entity is already resolved/completed */
  isResolved: boolean;
  /** Whether the resolution mutation is currently loading */
  loading?: boolean;
  /** Callback when the button is clicked */
  onClick: () => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * ResolutionButton component displays a button to trigger the resolution workflow
 * for events or encounters.
 *
 * Features:
 * - Shows "Complete Event" or "Resolve Encounter" label based on entity type
 * - Disabled when entity is already completed/resolved
 * - Shows loading state during mutation
 * - Icon indicator (CheckCircle)
 *
 * @param props - Component props
 * @returns The ResolutionButton component
 *
 * @example
 * ```tsx
 * <ResolutionButton
 *   entityType="event"
 *   isResolved={event.isCompleted}
 *   loading={isMutationLoading}
 *   onClick={handleOpenDialog}
 * />
 * ```
 */
export function ResolutionButton({
  entityType,
  isResolved,
  loading = false,
  onClick,
  className,
}: ResolutionButtonProps): JSX.Element {
  const actionLabel = entityType === 'event' ? 'Complete Event' : 'Resolve Encounter';
  const resolvedLabel = entityType === 'event' ? 'Event Completed' : 'Encounter Resolved';

  // Determine button state
  const isDisabled = isResolved || loading;
  const buttonLabel = isResolved ? resolvedLabel : loading ? 'Processing...' : actionLabel;

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      variant={isResolved ? 'outline' : 'default'}
      size="sm"
      className={className}
      title={
        isResolved
          ? `This ${entityType} has already been ${entityType === 'event' ? 'completed' : 'resolved'}`
          : `${actionLabel} and execute associated effects`
      }
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle className="mr-2 h-4 w-4" />
      )}
      {buttonLabel}
    </Button>
  );
}
