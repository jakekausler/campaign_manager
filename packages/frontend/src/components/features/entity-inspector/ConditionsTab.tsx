import { useState } from 'react';

import { RuleBuilderDialog } from '@/components/features/rule-builder/RuleBuilderDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useConditionsForEntity } from '@/services/api/hooks/conditions';

import { ConditionExplanation } from './ConditionExplanation';

/**
 * Field condition data structure
 */
export interface FieldCondition {
  id: string;
  entityType: string;
  entityId?: string | null;
  field: string;
  expression: Record<string, unknown>;
  description?: string | null;
  isActive: boolean;
  priority: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  createdBy: string;
  updatedBy?: string | null;
}

/**
 * Props for ConditionsTab component
 */
export interface ConditionsTabProps {
  /** Type of entity (e.g., "Settlement", "Structure") */
  entityType: string;
  /** ID of the entity instance */
  entityId: string;
}

/**
 * Converts snake_case field names to Title Case for display.
 *
 * @param text - The snake_case string to convert
 * @returns The converted Title Case string
 *
 * @example
 * ```ts
 * toTitleCase('is_trade_hub'); // "Is Trade Hub"
 * toTitleCase('has_walls'); // "Has Walls"
 * ```
 */
function toTitleCase(text: string): string {
  return text
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * ConditionsTab component displays all field conditions for an entity.
 *
 * Shows a list of conditions with:
 * - Field name (converted to Title Case)
 * - Description
 * - Active/Inactive status
 * - Priority
 * - JSONLogic expression
 * - "Explain" button to show evaluation trace
 *
 * @param props - Component props
 * @returns The ConditionsTab component
 *
 * @example
 * ```tsx
 * <ConditionsTab entityType="Settlement" entityId="settlement-1" />
 * ```
 */
export function ConditionsTab({ entityType, entityId }: ConditionsTabProps): JSX.Element {
  const { conditions, loading, error, refetch } = useConditionsForEntity(entityType, entityId);
  const [selectedCondition, setSelectedCondition] = useState<FieldCondition | null>(null);

  // Rule builder dialog state
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [conditionToEdit, setConditionToEdit] = useState<FieldCondition | null>(null);

  // Handle opening rule builder for new rule
  const handleNewRule = () => {
    setConditionToEdit(null);
    setIsRuleBuilderOpen(true);
  };

  // Handle opening rule builder for editing
  const handleEditRule = (condition: FieldCondition) => {
    setConditionToEdit(condition);
    setIsRuleBuilderOpen(true);
  };

  // Handle closing rule builder
  const handleCloseRuleBuilder = () => {
    setIsRuleBuilderOpen(false);
    setConditionToEdit(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-slate-500">Loading conditions...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4 p-4">
        <Card className="bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Error loading conditions</p>
          <p className="mt-1 text-sm text-red-600">{error.message}</p>
          <Button onClick={() => refetch()} className="mt-3" variant="outline" size="sm">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  // Empty state
  if (conditions.length === 0) {
    return (
      <>
        <div className="space-y-4 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Field Conditions (0)</h3>
            <Button onClick={handleNewRule} size="sm" variant="default">
              New Rule
            </Button>
          </div>
          <Card className="bg-slate-50 p-8">
            <p className="text-center text-sm text-slate-500">
              No conditions available for this {entityType.toLowerCase()}
            </p>
            <p className="mt-2 text-center text-xs text-slate-400">
              Click &quot;New Rule&quot; to create your first condition
            </p>
          </Card>
        </div>

        {/* Rule Builder Dialog */}
        <RuleBuilderDialog
          isOpen={isRuleBuilderOpen}
          onClose={handleCloseRuleBuilder}
          entityType={entityType}
          entityId={entityId}
          existingCondition={conditionToEdit}
          onSaveSuccess={refetch}
        />
      </>
    );
  }

  // Sort conditions by priority (higher priority first)
  const sortedConditions = [...conditions].sort((a, b) => b.priority - a.priority);

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Field Conditions ({conditions.length})
          </h3>
          <Button onClick={handleNewRule} size="sm" variant="default">
            New Rule
          </Button>
        </div>

        {sortedConditions.map((condition) => (
          <Card key={condition.id} className="Card p-4">
            {/* Header: Field name and status */}
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {toTitleCase(condition.field)}
                </h4>
                {condition.description && (
                  <p className="mt-1 text-xs text-slate-600">{condition.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    condition.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {condition.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Metadata: Priority */}
            <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
              <span className="font-semibold">Priority: {condition.priority}</span>
              {condition.entityId ? (
                <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">Instance</span>
              ) : (
                <span className="rounded bg-purple-50 px-2 py-0.5 text-purple-700">Type</span>
              )}
            </div>

            {/* Expression */}
            <div className="mb-3">
              <div className="mb-1 block text-xs font-semibold text-slate-700">
                JSONLogic Expression:
              </div>
              <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800">
                {JSON.stringify(condition.expression, null, 2)}
              </pre>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => handleEditRule(condition)}
                variant="outline"
                size="sm"
                title="Edit this rule"
              >
                Edit
              </Button>
              <Button
                onClick={() => setSelectedCondition(condition)}
                variant="outline"
                size="sm"
                disabled={!condition.isActive}
                title={
                  condition.isActive
                    ? 'Show evaluation trace'
                    : 'Cannot evaluate inactive condition'
                }
              >
                Explain
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Condition Explanation Modal */}
      {selectedCondition && (
        <ConditionExplanation
          condition={selectedCondition}
          entityType={entityType}
          entityId={entityId}
          isOpen={!!selectedCondition}
          onClose={() => setSelectedCondition(null)}
        />
      )}

      {/* Rule Builder Dialog */}
      <RuleBuilderDialog
        isOpen={isRuleBuilderOpen}
        onClose={handleCloseRuleBuilder}
        entityType={entityType}
        entityId={entityId}
        existingCondition={conditionToEdit}
        onSaveSuccess={refetch}
      />
    </>
  );
}
