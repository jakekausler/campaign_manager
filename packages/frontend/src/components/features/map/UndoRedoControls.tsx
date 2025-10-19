import { Undo2, Redo2 } from 'lucide-react';

import { Button } from '../../ui/button';

/**
 * Props for UndoRedoControls component
 */
export interface UndoRedoControlsProps {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Callback when undo button is clicked */
  onUndo: () => void;
  /** Callback when redo button is clicked */
  onRedo: () => void;
}

/**
 * Undo/Redo controls for map geometry editing
 *
 * Displays undo and redo buttons with appropriate enabled/disabled states.
 * Typically rendered alongside DrawToolbar when editing geometry.
 *
 * @example
 * ```tsx
 * <UndoRedoControls
 *   canUndo={drawState.canUndo}
 *   canRedo={drawState.canRedo}
 *   onUndo={drawActions.undo}
 *   onRedo={drawActions.redo}
 * />
 * ```
 */
export function UndoRedoControls({ canUndo, canRedo, onUndo, onRedo }: UndoRedoControlsProps) {
  return (
    <div
      className="absolute left-4 bottom-4 flex items-center gap-2 bg-white rounded-md shadow-md p-2"
      data-testid="undo-redo-controls"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo last change (Ctrl+Z)"
        data-testid="undo-button"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4 mr-1" />
        Undo
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo last change (Ctrl+Shift+Z)"
        data-testid="redo-button"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-4 w-4 mr-1" />
        Redo
      </Button>
    </div>
  );
}
