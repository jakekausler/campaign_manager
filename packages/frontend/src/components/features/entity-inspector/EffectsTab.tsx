import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAllEffectsForEntity } from '@/services/api/hooks/effects';

import { EffectExecutionHistory } from './EffectExecutionHistory';

/**
 * Effect timing phase enum
 */
export enum EffectTiming {
  PRE = 'PRE',
  ON_RESOLVE = 'ON_RESOLVE',
  POST = 'POST',
}

/**
 * Effect execution data structure
 */
export interface EffectExecution {
  id: string;
  effectId: string;
  executedAt: string;
  status: string;
  patchApplied: unknown;
  error?: string | null;
}

/**
 * Effect data structure
 */
export interface Effect {
  id: string;
  name: string;
  description?: string | null;
  effectType: string;
  payload: Record<string, unknown>;
  entityType: string;
  entityId: string;
  timing: EffectTiming;
  priority: number;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  executions?: EffectExecution[];
}

/**
 * Props for EffectsTab component
 */
export interface EffectsTabProps {
  /** Type of entity (e.g., "Settlement", "Structure", "Event", "Encounter") */
  entityType: string;
  /** ID of the entity instance */
  entityId: string;
}

/**
 * Returns a human-readable label for an effect timing phase.
 *
 * @param timing - The effect timing phase
 * @returns The display label for the timing phase
 *
 * @example
 * ```ts
 * getTimingLabel(EffectTiming.PRE); // "Pre-Resolution"
 * getTimingLabel(EffectTiming.ON_RESOLVE); // "On Resolution"
 * getTimingLabel(EffectTiming.POST); // "Post-Resolution"
 * ```
 */
function getTimingLabel(timing: EffectTiming): string {
  switch (timing) {
    case EffectTiming.PRE:
      return 'Pre-Resolution';
    case EffectTiming.ON_RESOLVE:
      return 'On Resolution';
    case EffectTiming.POST:
      return 'Post-Resolution';
    default:
      return timing;
  }
}

/**
 * Returns a color scheme for an effect timing phase badge.
 *
 * @param timing - The effect timing phase
 * @returns The Tailwind CSS classes for background and text color
 */
function getTimingColor(timing: EffectTiming): string {
  switch (timing) {
    case EffectTiming.PRE:
      return 'bg-blue-100 text-blue-800';
    case EffectTiming.ON_RESOLVE:
      return 'bg-green-100 text-green-800';
    case EffectTiming.POST:
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

/**
 * EffectsTab component displays all effects for an entity grouped by timing phase.
 *
 * Shows a list of effects with:
 * - Name and description
 * - Timing phase (PRE/ON_RESOLVE/POST)
 * - Effect type
 * - Priority
 * - Active/Inactive status
 * - JSON Patch operations
 * - "View History" button to show execution history
 *
 * Effects are grouped by timing phase and sorted by priority within each group.
 *
 * @param props - Component props
 * @returns The EffectsTab component
 *
 * @example
 * ```tsx
 * <EffectsTab entityType="Event" entityId="event-1" />
 * ```
 */
export function EffectsTab({ entityType, entityId }: EffectsTabProps): JSX.Element {
  const { preEffects, onResolveEffects, postEffects, allEffects, loading, error, refetch } =
    useAllEffectsForEntity(entityType, entityId);
  const [selectedEffect, setSelectedEffect] = useState<Effect | null>(null);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-slate-500">Loading effects...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4 p-4">
        <Card className="bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Error loading effects</p>
          <p className="mt-1 text-sm text-red-600">{error.message}</p>
          <Button onClick={() => refetch()} className="mt-3" variant="outline" size="sm">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  // Empty state
  if (allEffects.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <Card className="bg-slate-50 p-8">
          <p className="text-center text-sm text-slate-500">
            No effects available for this {entityType.toLowerCase()}
          </p>
        </Card>
      </div>
    );
  }

  /**
   * Renders a group of effects for a specific timing phase.
   *
   * @param effects - Array of effects to render
   * @param timing - The timing phase for this group
   * @returns JSX elements for the effect group
   */
  const renderEffectGroup = (effects: Effect[], timing: EffectTiming) => {
    if (effects.length === 0) return null;

    // Sort effects by priority (lower values execute first)
    const sortedEffects = [...effects].sort((a, b) => a.priority - b.priority);

    return (
      <div key={timing} className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          {getTimingLabel(timing)} ({effects.length})
        </h3>

        <div className="space-y-3">
          {sortedEffects.map((effect) => (
            <Card key={effect.id} className="p-4">
              {/* Header: Name, status, and metadata */}
              <div className="mb-3 space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">{effect.name}</h4>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      effect.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {effect.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {effect.description && (
                  <p className="text-xs text-slate-600">{effect.description}</p>
                )}

                {/* Metadata: Priority, Timing, Type */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="font-semibold">Priority: {effect.priority}</span>
                  <span className={`rounded px-2 py-0.5 font-medium ${getTimingColor(timing)}`}>
                    {getTimingLabel(timing)}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                    Type: {effect.effectType}
                  </span>
                </div>
              </div>

              {/* JSON Patch Operations */}
              <div className="mb-3">
                <div className="mb-1 block text-xs font-semibold text-slate-700">
                  JSON Patch Operations:
                </div>
                <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800">
                  {JSON.stringify(effect.payload, null, 2)}
                </pre>
              </div>

              {/* View History button */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {effect.executions && effect.executions.length > 0
                    ? `${effect.executions.length} execution${effect.executions.length > 1 ? 's' : ''}`
                    : 'No executions'}
                </span>
                <Button
                  onClick={() => setSelectedEffect(effect)}
                  variant="outline"
                  size="sm"
                  disabled={!effect.executions || effect.executions.length === 0}
                  title={
                    effect.executions && effect.executions.length > 0
                      ? 'View execution history'
                      : 'No execution history available'
                  }
                >
                  View History
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Effects ({allEffects.length})</h3>
        </div>

        {/* Render effects grouped by timing phase */}
        {renderEffectGroup(preEffects, EffectTiming.PRE)}
        {renderEffectGroup(onResolveEffects, EffectTiming.ON_RESOLVE)}
        {renderEffectGroup(postEffects, EffectTiming.POST)}
      </div>

      {/* Effect Execution History Modal */}
      {selectedEffect && (
        <EffectExecutionHistory
          effect={selectedEffect}
          isOpen={!!selectedEffect}
          onClose={() => setSelectedEffect(null)}
        />
      )}
    </>
  );
}
