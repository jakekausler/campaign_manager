import { Minus, Plus, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUpdateSettlement } from '@/services/api/mutations/settlements';
import { useUpdateStructure } from '@/services/api/mutations/structures';

import { LevelChangeConfirmationDialog } from './LevelChangeConfirmationDialog';

/**
 * Props for LevelControl component
 */
export interface LevelControlProps {
  /** Entity ID to update */
  entityId: string;
  /** Entity type (settlement or structure) */
  entityType: 'settlement' | 'structure';
  /** Entity name for display in confirmation dialog */
  entityName: string;
  /** Current level of the entity */
  currentLevel: number;
  /** Minimum allowed level (default: 1) */
  minLevel?: number;
  /** Maximum allowed level (default: 10) */
  maxLevel?: number;
  /** Optional current version for optimistic locking */
  version?: number;
  /** Callback when level changes successfully */
  onLevelChanged?: (newLevel: number) => void;
}

/**
 * Level control component with increment/decrement buttons and confirmation dialog.
 *
 * Provides UI for changing entity level with:
 * - Visual level display with badge
 * - Increment (+) and decrement (-) buttons
 * - Confirmation dialog with rules engine warning
 * - Optimistic updates with rollback on error
 * - Loading state during mutation
 * - Toast notifications for success/error
 *
 * @example
 * ```tsx
 * <LevelControl
 *   entityId="settlement-1"
 *   entityType="settlement"
 *   entityName="Westholm"
 *   currentLevel={2}
 *   version={5}
 *   onLevelChanged={(newLevel) => console.log('Level changed to', newLevel)}
 * />
 * ```
 */
export function LevelControl({
  entityId,
  entityType,
  entityName,
  currentLevel,
  minLevel = 1,
  maxLevel = 10,
  version,
  onLevelChanged,
}: LevelControlProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);

  // Mutation hooks
  const { updateSettlement, loading: settlementLoading } = useUpdateSettlement();
  const { updateStructure, loading: structureLoading } = useUpdateStructure();

  const loading = entityType === 'settlement' ? settlementLoading : structureLoading;

  /**
   * Handles level increment/decrement button clicks.
   * Shows confirmation dialog with pending level.
   */
  const handleLevelChange = (delta: number) => {
    const newLevel = currentLevel + delta;

    // Validate level bounds
    if (newLevel < minLevel || newLevel > maxLevel) {
      return;
    }

    setPendingLevel(newLevel);
    setShowConfirmation(true);
  };

  /**
   * Confirms level change and executes mutation.
   * Updates cache optimistically and shows toast on completion.
   */
  const confirmLevelChange = async () => {
    if (pendingLevel === null) return;

    try {
      if (entityType === 'settlement') {
        await updateSettlement(entityId, {
          level: pendingLevel,
          expectedVersion: version,
        });
      } else {
        await updateStructure(entityId, {
          level: pendingLevel,
          expectedVersion: version,
        });
      }

      toast.success('Level updated', {
        description: `${entityName} level changed from ${currentLevel} to ${pendingLevel}.`,
      });

      // Notify parent component
      if (onLevelChanged) {
        onLevelChanged(pendingLevel);
      }
    } catch (error) {
      console.error('Failed to update level:', error);
      toast.error('Failed to update level', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setShowConfirmation(false);
      setPendingLevel(null);
    }
  };

  const canDecrease = currentLevel > minLevel && !loading;
  const canIncrease = currentLevel < maxLevel && !loading;

  return (
    <div className="flex items-center gap-2" data-testid="level-control">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleLevelChange(-1)}
        disabled={!canDecrease}
        aria-label="Decrease level"
        data-testid="level-decrease"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
      </Button>

      <Badge
        variant="secondary"
        className="min-w-[80px] justify-center px-3 py-1 text-sm font-semibold"
        data-testid="level-badge"
      >
        Level {currentLevel}
      </Badge>

      <Button
        size="sm"
        variant="outline"
        onClick={() => handleLevelChange(1)}
        disabled={!canIncrease}
        aria-label="Increase level"
        data-testid="level-increase"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </Button>

      <LevelChangeConfirmationDialog
        open={showConfirmation}
        onClose={() => {
          setShowConfirmation(false);
          setPendingLevel(null);
        }}
        onConfirm={confirmLevelChange}
        entityType={entityType}
        entityName={entityName}
        currentLevel={currentLevel}
        newLevel={pendingLevel ?? currentLevel}
        loading={loading}
      />
    </div>
  );
}
