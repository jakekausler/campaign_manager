import { RotateCw } from 'lucide-react';
import { memo } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Props for FlowToolbar component
 */
export interface FlowToolbarProps {
  /**
   * Callback when re-layout button is clicked.
   * Should trigger the auto-layout algorithm to re-position nodes.
   */
  onReLayout: () => void;

  /**
   * Whether the re-layout operation is in progress
   */
  isLayouting?: boolean;
}

/**
 * FlowToolbar - Custom toolbar for Flow View with layout controls
 *
 * Provides controls for managing the dependency graph layout:
 * - Re-layout button: Resets node positions using auto-layout algorithm
 *
 * This toolbar appears at the top-left of the flow canvas, above React Flow's
 * built-in Controls component.
 *
 * Part of TICKET-021 Stage 6 implementation.
 */
export const FlowToolbar = memo<FlowToolbarProps>(({ onReLayout, isLayouting = false }) => {
  return (
    <div className="absolute top-4 left-4 z-10 bg-card border rounded-lg shadow-lg p-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onReLayout}
        disabled={isLayouting}
        className="flex items-center gap-2"
        title="Re-apply auto-layout to reset node positions"
        aria-label="Re-apply auto-layout"
      >
        <RotateCw className={`h-4 w-4 ${isLayouting ? 'animate-spin' : ''}`} />
        <span>Re-layout</span>
      </Button>
    </div>
  );
});

FlowToolbar.displayName = 'FlowToolbar';
