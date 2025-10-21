import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { Effect, EffectTiming } from './EffectsTab';

/**
 * Validation result for resolution preconditions
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Props for ResolutionDialog component
 */
export interface ResolutionDialogProps {
  /** Type of entity being resolved ('event' or 'encounter') */
  entityType: 'event' | 'encounter';
  /** Name of the entity being resolved */
  entityName: string;
  /** List of effects that will be executed */
  effects: Effect[];
  /** Validation result from precondition checks */
  validation?: ValidationResult;
  /** Whether the resolution mutation is currently loading */
  loading?: boolean;
  /** Error message from resolution attempt */
  error?: string | null;
  /** Success message after successful resolution */
  success?: boolean;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when user confirms resolution */
  onConfirm: () => void;
  /** Callback when user cancels or closes the dialog */
  onCancel: () => void;
}

/**
 * Returns a human-readable label for an effect timing phase.
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
 * Groups effects by timing phase and sorts by priority within each group.
 */
function groupEffectsByTiming(effects: Effect[]): {
  preEffects: Effect[];
  onResolveEffects: Effect[];
  postEffects: Effect[];
} {
  const preEffects = effects
    .filter((e) => e.timing === EffectTiming.PRE)
    .sort((a, b) => a.priority - b.priority);
  const onResolveEffects = effects
    .filter((e) => e.timing === EffectTiming.ON_RESOLVE)
    .sort((a, b) => a.priority - b.priority);
  const postEffects = effects
    .filter((e) => e.timing === EffectTiming.POST)
    .sort((a, b) => a.priority - b.priority);

  return { preEffects, onResolveEffects, postEffects };
}

/**
 * ResolutionDialog component provides a confirmation dialog for completing events
 * or resolving encounters.
 *
 * Features:
 * - Shows entity name and type
 * - Displays effects grouped by timing phase (PRE/ON_RESOLVE/POST)
 * - Shows effect descriptions and JSON Patch operations
 * - Displays validation errors and warnings
 * - Shows loading state during mutation execution
 * - Shows success/error messages after resolution
 * - Keyboard shortcuts (Enter to confirm, Escape to cancel)
 *
 * @param props - Component props
 * @returns The ResolutionDialog component
 *
 * @example
 * ```tsx
 * <ResolutionDialog
 *   entityType="event"
 *   entityName="Festival of the Harvest"
 *   effects={eventEffects}
 *   validation={{ isValid: true, errors: [], warnings: [] }}
 *   loading={isLoading}
 *   error={error}
 *   success={isSuccess}
 *   isOpen={isDialogOpen}
 *   onConfirm={handleConfirm}
 *   onCancel={handleCancel}
 * />
 * ```
 */
export function ResolutionDialog({
  entityType,
  entityName,
  effects,
  validation = { isValid: true, errors: [], warnings: [] },
  loading = false,
  error = null,
  success = false,
  isOpen,
  onConfirm,
  onCancel,
}: ResolutionDialogProps): JSX.Element {
  const { preEffects, onResolveEffects, postEffects } = groupEffectsByTiming(effects);
  const actionLabel = entityType === 'event' ? 'Complete Event' : 'Resolve Encounter';

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen || loading || success) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to confirm (only if validation passes)
      if (e.key === 'Enter' && validation.isValid) {
        e.preventDefault();
        onConfirm();
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, success, validation.isValid, onConfirm, onCancel]);

  /**
   * Renders a group of effects for a specific timing phase.
   */
  const renderEffectGroup = (groupEffects: Effect[], timing: EffectTiming) => {
    if (groupEffects.length === 0) return null;

    return (
      <div key={timing} className="mb-4">
        <h4 className="mb-2 text-xs font-semibold text-slate-700">
          {getTimingLabel(timing)} ({groupEffects.length})
        </h4>

        <div className="space-y-2">
          {groupEffects.map((effect) => (
            <Card key={effect.id} className="p-3">
              <div className="mb-2 flex items-start justify-between">
                <h5 className="text-xs font-semibold text-slate-900">{effect.name}</h5>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${getTimingColor(timing)}`}
                >
                  {getTimingLabel(timing)}
                </span>
              </div>
              {effect.description && (
                <p className="mb-2 text-xs text-slate-600">{effect.description}</p>
              )}
              <div className="text-xs text-slate-500">
                <span className="font-semibold">Priority:</span> {effect.priority} •{' '}
                <span className="font-semibold">Type:</span> {effect.effectType}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{actionLabel}</DialogTitle>
          <DialogDescription>
            Review the effects that will be executed when you{' '}
            {entityType === 'event' ? 'complete' : 'resolve'}{' '}
            <span className="font-semibold">{entityName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Validation Errors */}
          {validation.errors.length > 0 && (
            <Card className="border-red-200 bg-red-50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-800">
                    Cannot proceed with resolution:
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs text-red-700">
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* Validation Warnings */}
          {validation.warnings.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-yellow-800">Warning:</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-yellow-700">
                    {validation.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* Error Message */}
          {error && (
            <Card className="border-red-200 bg-red-50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-800">Resolution failed:</p>
                  <p className="mt-1 text-xs text-red-700">{error}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Success Message */}
          {success && (
            <Card className="border-green-200 bg-green-50 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-green-800">
                    {entityType === 'event'
                      ? 'Event completed successfully!'
                      : 'Encounter resolved successfully!'}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Effects Preview */}
          {!success && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Effects Preview ({effects.length} total)
              </h3>

              {effects.length === 0 ? (
                <Card className="bg-slate-50 p-4">
                  <p className="text-center text-xs text-slate-500">
                    No effects configured for this {entityType}.
                  </p>
                </Card>
              ) : (
                <>
                  {renderEffectGroup(preEffects, EffectTiming.PRE)}
                  {renderEffectGroup(onResolveEffects, EffectTiming.ON_RESOLVE)}
                  {renderEffectGroup(postEffects, EffectTiming.POST)}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!success && (
            <>
              <Button
                onClick={onCancel}
                variant="outline"
                disabled={loading}
                title="Cancel and close dialog (Escape)"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={loading || !validation.isValid}
                title={
                  validation.isValid ? `Confirm resolution (Enter)` : 'Fix validation errors first'
                }
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Processing...' : actionLabel}
              </Button>
            </>
          )}
          {success && (
            <Button onClick={onCancel} variant="default">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
