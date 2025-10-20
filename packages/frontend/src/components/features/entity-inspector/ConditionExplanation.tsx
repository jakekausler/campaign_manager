import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEvaluateCondition } from '@/services/api/hooks/conditions';
import { useSettlementDetails } from '@/services/api/hooks/settlements';
import { useStructureDetails } from '@/services/api/hooks/structures';

import type { FieldCondition } from './ConditionsTab';

/**
 * Evaluation trace step structure
 */
interface EvaluationTrace {
  step: number;
  operation: string;
  input: unknown;
  output: unknown;
  description?: string | null;
}

/**
 * Evaluation result structure
 */
interface EvaluationResult {
  value: unknown;
  success: boolean;
  trace: EvaluationTrace[];
  error?: string | null;
}

/**
 * Settlement data with variables field
 * TODO: Replace with generated GraphQL types once codegen runs
 */
interface SettlementWithVariables {
  variables?: Record<string, unknown>;
  computedFields: Record<string, unknown>;
  level: number;
  kingdomId: string;
  campaignId: string;
  ownerId: string;
  isArchived: boolean;
}

/**
 * Structure data with variables field
 * TODO: Replace with generated GraphQL types once codegen runs
 */
interface StructureWithVariables {
  variables?: Record<string, unknown>;
  computedFields: Record<string, unknown>;
  level?: number | null;
  type?: string | null;
  typeId: string;
  settlementId: string;
  positionX: number;
  positionY: number;
  orientation: number;
}

/**
 * Props for ConditionExplanation component
 */
export interface ConditionExplanationProps {
  /** The condition to explain */
  condition: FieldCondition;
  /** Type of entity (e.g., "Settlement", "Structure") */
  entityType: string;
  /** ID of the entity instance */
  entityId: string;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog closes */
  onClose: () => void;
}

/**
 * Converts snake_case field names to Title Case for display.
 */
function toTitleCase(text: string): string {
  return text
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formats a value for display in the evaluation trace.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * ConditionExplanation component displays the evaluation trace for a condition.
 *
 * This modal component:
 * - Fetches the entity's current state (variables and computed fields)
 * - Evaluates the condition with that context
 * - Displays the JSONLogic expression
 * - Shows step-by-step evaluation trace
 * - Displays the final result
 *
 * @param props - Component props
 * @returns The ConditionExplanation component
 *
 * @example
 * ```tsx
 * <ConditionExplanation
 *   condition={condition}
 *   entityType="Settlement"
 *   entityId="settlement-1"
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function ConditionExplanation({
  condition,
  entityType,
  entityId,
  isOpen,
  onClose,
}: ConditionExplanationProps): JSX.Element {
  const [evaluate, { data, loading, error }] = useEvaluateCondition();
  const [context, setContext] = useState<Record<string, unknown>>({});

  // Fetch entity data based on type
  const settlementQuery = useSettlementDetails(entityId, {
    skip: entityType !== 'Settlement',
  });
  const structureQuery = useStructureDetails(entityId, {
    skip: entityType !== 'Structure',
  });

  // Build context from entity data
  useEffect(() => {
    if (entityType === 'Settlement' && settlementQuery.settlement) {
      const entity = settlementQuery.settlement as unknown as SettlementWithVariables;
      setContext({
        ...(entity.variables ?? {}),
        ...entity.computedFields,
        level: entity.level,
        kingdomId: entity.kingdomId,
        campaignId: entity.campaignId,
        ownerId: entity.ownerId,
        isArchived: entity.isArchived,
      });
    } else if (entityType === 'Structure' && structureQuery.structure) {
      const entity = structureQuery.structure as unknown as StructureWithVariables;
      setContext({
        ...(entity.variables ?? {}),
        ...entity.computedFields,
        level: entity.level ?? 0,
        type: entity.type ?? entity.typeId,
        settlementId: entity.settlementId,
        positionX: entity.positionX,
        positionY: entity.positionY,
        orientation: entity.orientation,
      });
    }
  }, [entityType, settlementQuery.settlement, structureQuery.structure]);

  // Evaluate condition when context is ready
  useEffect(() => {
    if (isOpen && Object.keys(context).length > 0) {
      evaluate({
        variables: {
          input: {
            conditionId: condition.id,
            context,
          },
        },
      });
    }
  }, [isOpen, condition.id, context, evaluate]);

  const result: EvaluationResult | null = data?.evaluateFieldCondition ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Condition Explanation</DialogTitle>
          <DialogDescription>
            Evaluation trace for <strong>{toTitleCase(condition.field)}</strong> field condition
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Condition Info */}
          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Condition Details</h4>
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold text-slate-700">Field:</span>{' '}
                <span className="text-slate-600">{toTitleCase(condition.field)}</span>
              </div>
              {condition.description && (
                <div>
                  <span className="font-semibold text-slate-700">Description:</span>{' '}
                  <span className="text-slate-600">{condition.description}</span>
                </div>
              )}
              <div>
                <span className="font-semibold text-slate-700">Priority:</span>{' '}
                <span className="text-slate-600">{condition.priority}</span>
              </div>
            </div>
          </Card>

          {/* JSONLogic Expression */}
          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">JSONLogic Expression</h4>
            <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
              {JSON.stringify(condition.expression, null, 2)}
            </pre>
          </Card>

          {/* Evaluation Context */}
          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Evaluation Context</h4>
            <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
              {JSON.stringify(context, null, 2)}
            </pre>
          </Card>

          {/* Loading State */}
          {loading && (
            <Card className="bg-blue-50 p-4">
              <p className="text-sm text-blue-800">Evaluating condition...</p>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Card className="bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">Evaluation Error</p>
              <p className="mt-1 text-sm text-red-600">{error.message}</p>
            </Card>
          )}

          {/* Evaluation Result */}
          {result && (
            <>
              {/* Result Value */}
              <Card className="p-4">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">Evaluation Result</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">Success:</span>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {result.success ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Value:</span>{' '}
                    <span className="font-mono text-xs text-slate-600">
                      {formatValue(result.value)}
                    </span>
                  </div>
                  {result.error && (
                    <div>
                      <span className="text-xs font-semibold text-red-700">Error:</span>{' '}
                      <span className="text-xs text-red-600">{result.error}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Evaluation Trace */}
              {result.trace && result.trace.length > 0 && (
                <Card className="p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-700">
                    Evaluation Trace ({result.trace.length} steps)
                  </h4>
                  <div className="space-y-3">
                    {result.trace.map((step, index) => (
                      <div key={index} className="rounded border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex items-start justify-between">
                          <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                            Step {step.step}
                          </span>
                          <span className="text-xs font-medium text-slate-700">
                            {step.operation}
                          </span>
                        </div>
                        {step.description && (
                          <p className="mb-2 text-xs text-slate-600">{step.description}</p>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="font-semibold text-slate-700">Input:</span>
                            <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs text-slate-800">
                              {formatValue(step.input)}
                            </pre>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">Output:</span>
                            <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs text-slate-800">
                              {formatValue(step.output)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Done Button */}
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
