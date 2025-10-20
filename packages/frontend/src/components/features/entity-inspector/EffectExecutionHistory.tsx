import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Effect } from './EffectsTab';

/**
 * Props for EffectExecutionHistory component
 */
export interface EffectExecutionHistoryProps {
  /** The effect whose execution history to display */
  effect: Effect;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed */
  onClose: () => void;
}

/**
 * Returns a color scheme for an execution status badge.
 *
 * @param status - The execution status (SUCCESS, FAILURE, PARTIAL, etc.)
 * @returns The Tailwind CSS classes for background and text color
 */
function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
      return 'bg-green-100 text-green-800';
    case 'FAILURE':
    case 'ERROR':
      return 'bg-red-100 text-red-800';
    case 'PARTIAL':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

/**
 * Formats a date string to a more readable format.
 *
 * @param dateString - ISO 8601 date string
 * @returns Formatted date string
 *
 * @example
 * ```ts
 * formatDate('2024-06-15T14:00:00.000Z');
 * // "June 15, 2024 at 2:00 PM"
 * ```
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * EffectExecutionHistory component displays the execution history for an effect.
 *
 * Shows a chronological list of all times the effect was executed with:
 * - Execution timestamp
 * - Execution status (SUCCESS, FAILURE, etc.)
 * - JSON Patch that was applied
 * - Error message (if execution failed)
 *
 * Displayed in a modal dialog using the shadcn/ui Dialog component.
 *
 * @param props - Component props
 * @returns The EffectExecutionHistory component
 *
 * @example
 * ```tsx
 * <EffectExecutionHistory
 *   effect={selectedEffect}
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 * />
 * ```
 */
export function EffectExecutionHistory({
  effect,
  isOpen,
  onClose,
}: EffectExecutionHistoryProps): JSX.Element {
  const executions = effect.executions || [];

  // Sort executions by timestamp (most recent first)
  const sortedExecutions = [...executions].sort(
    (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Execution History</DialogTitle>
          <DialogDescription>
            History of executions for effect &ldquo;{effect.name}&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Effect Details */}
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Effect Details</h3>
            <div className="space-y-1 text-xs text-slate-600">
              <div>
                <span className="font-semibold">Name:</span> {effect.name}
              </div>
              {effect.description && (
                <div>
                  <span className="font-semibold">Description:</span> {effect.description}
                </div>
              )}
              <div>
                <span className="font-semibold">Type:</span> {effect.effectType}
              </div>
              <div>
                <span className="font-semibold">Priority:</span> {effect.priority}
              </div>
              <div>
                <span className="font-semibold">Timing:</span> {effect.timing}
              </div>
            </div>
          </Card>

          {/* Execution History */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Execution History ({sortedExecutions.length})
            </h3>

            {sortedExecutions.length === 0 ? (
              <Card className="bg-slate-50 p-8">
                <p className="text-center text-sm text-slate-500">
                  No execution history available for this effect
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {sortedExecutions.map((execution) => (
                  <Card key={execution.id} className="p-4">
                    {/* Header: Status and timestamp */}
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <div className="text-xs text-slate-500">Executed At</div>
                        <div className="mt-0.5 text-sm font-semibold text-slate-900">
                          {formatDate(execution.executedAt)}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(execution.status)}`}
                      >
                        {execution.status}
                      </span>
                    </div>

                    {/* Patch Applied */}
                    <div className="mb-3">
                      <div className="mb-1 block text-xs font-semibold text-slate-700">
                        Patch Applied:
                      </div>
                      <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800">
                        {JSON.stringify(execution.patchApplied, null, 2)}
                      </pre>
                    </div>

                    {/* Error (if present) */}
                    {execution.error && (
                      <div className="rounded border border-red-200 bg-red-50 p-3">
                        <div className="mb-1 text-xs font-semibold text-red-800">Error:</div>
                        <p className="text-xs text-red-700">{execution.error}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Close button */}
        <div className="mt-4 flex justify-end">
          <Button onClick={onClose} variant="default">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
