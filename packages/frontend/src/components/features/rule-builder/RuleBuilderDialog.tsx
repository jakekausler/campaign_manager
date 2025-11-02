import { useCallback, useEffect, useState } from 'react';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateFieldCondition,
  useUpdateFieldCondition,
  type FieldCondition,
} from '@/services/api/mutations/conditions';

import { RuleBuilder } from './RuleBuilder';
import type { JSONLogicExpression } from './types';

/**
 * Props for RuleBuilderDialog component
 */
export interface RuleBuilderDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Entity type (e.g., 'Settlement', 'Structure') */
  entityType: string;
  /** Entity ID */
  entityId: string;
  /** Existing condition to edit (optional, null for creating new) */
  existingCondition?: FieldCondition | null;
  /** Callback when save succeeds (optional) */
  onSaveSuccess?: () => void;
}

/**
 * RuleBuilderDialog component integrates the visual rule builder
 * into a dialog for creating and editing field conditions.
 *
 * Features:
 * - Create new field conditions with field name, expression, description, priority
 * - Edit existing field conditions (expression, description, priority only)
 * - Field name input disabled when editing existing condition
 * - Success/error toasts for user feedback
 * - Unsaved changes confirmation (future enhancement)
 *
 * @example
 * ```tsx
 * <RuleBuilderDialog
 *   isOpen={isDialogOpen}
 *   onClose={() => setIsDialogOpen(false)}
 *   entityType="Settlement"
 *   entityId="settlement-123"
 *   existingCondition={selectedCondition}
 * />
 * ```
 */
export function RuleBuilderDialog({
  isOpen,
  onClose,
  entityType,
  entityId,
  existingCondition,
  onSaveSuccess,
}: RuleBuilderDialogProps): JSX.Element {
  // Mode: 'create' or 'edit'
  const isEditMode = !!existingCondition;

  // Form state
  const [fieldName, setFieldName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(0);
  const [expression, setExpression] = useState<JSONLogicExpression | undefined>(undefined);

  // Validation state
  const [fieldNameError, setFieldNameError] = useState('');

  // Mutation hooks
  const { createCondition, loading: creating, error: createError } = useCreateFieldCondition();
  const { updateCondition, loading: updating, error: updateError } = useUpdateFieldCondition();

  const loading = creating || updating;
  const error = createError || updateError;

  // Initialize form state when dialog opens or condition changes
  useEffect(() => {
    if (isOpen) {
      if (existingCondition) {
        // Edit mode: populate form with existing condition data
        setFieldName(existingCondition.field);
        setDescription(existingCondition.description || '');
        setPriority(existingCondition.priority);
        setExpression(existingCondition.expression as JSONLogicExpression);
      } else {
        // Create mode: reset form
        setFieldName('');
        setDescription('');
        setPriority(0);
        setExpression(undefined);
      }
      setFieldNameError('');
    }
  }, [isOpen, existingCondition]);

  // Handle expression changes from RuleBuilder
  const handleExpressionChange = useCallback((newExpression: JSONLogicExpression) => {
    setExpression(newExpression);
  }, []);

  // Validate field name
  const validateFieldName = useCallback((value: string): boolean => {
    if (!value.trim()) {
      setFieldNameError('Field name is required');
      return false;
    }
    // Field name should be snake_case
    if (!/^[a-z][a-z0-9_]*$/.test(value)) {
      setFieldNameError('Field name must be snake_case (e.g., is_trade_hub)');
      return false;
    }
    setFieldNameError('');
    return true;
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    // Validate inputs
    if (!isEditMode && !validateFieldName(fieldName)) {
      return;
    }

    if (!expression || Object.keys(expression).length === 0) {
      // TODO: Show error toast - expression is required
      return;
    }

    try {
      if (isEditMode && existingCondition) {
        // Update existing condition
        await updateCondition(existingCondition.id, {
          expression: expression as Record<string, unknown>,
          description: description.trim() || null,
          priority,
        });
        // TODO: Show success toast: "Rule updated successfully"
      } else {
        // Create new condition
        await createCondition({
          entityType,
          entityId,
          field: fieldName.trim(),
          expression: expression as Record<string, unknown>,
          description: description.trim() || null,
          priority,
        });
        // TODO: Show success toast: "Rule created successfully"
      }

      // Call success callback
      if (onSaveSuccess) {
        onSaveSuccess();
      }

      // Close dialog on success
      onClose();
    } catch (err) {
      // Error is handled by error state from mutation hook
      // TODO: Show error toast: "Failed to save rule: {error.message}"
      console.error('Failed to save rule:', err);
    }
  }, [
    isEditMode,
    existingCondition,
    fieldName,
    description,
    priority,
    expression,
    entityType,
    entityId,
    validateFieldName,
    createCondition,
    updateCondition,
    onSaveSuccess,
    onClose,
  ]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    // TODO: Show unsaved changes confirmation if form is dirty
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the rule expression, description, and priority'
              : 'Create a new field condition using the visual rule builder'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Field Name Input (only for create mode) */}
          {!isEditMode && (
            <div className="space-y-2">
              <Label htmlFor="field-name">
                Field Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="field-name"
                type="text"
                placeholder="e.g., is_trade_hub"
                value={fieldName}
                onChange={(e) => {
                  setFieldName(e.target.value);
                  if (fieldNameError) {
                    validateFieldName(e.target.value);
                  }
                }}
                onBlur={() => validateFieldName(fieldName)}
                disabled={loading}
                className={fieldNameError ? 'border-red-500' : ''}
                aria-invalid={!!fieldNameError}
                aria-describedby={fieldNameError ? 'field-name-error' : undefined}
              />
              {fieldNameError && (
                <p id="field-name-error" className="text-sm text-red-600">
                  {fieldNameError}
                </p>
              )}
              <p className="text-xs text-slate-500">
                Use snake_case format (lowercase letters, numbers, underscores)
              </p>
            </div>
          )}

          {/* Field Name Display (edit mode only) */}
          {isEditMode && existingCondition && (
            <div className="space-y-2">
              <Label>Field Name</Label>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {existingCondition.field}
              </div>
              <p className="text-xs text-slate-500">Field name cannot be changed after creation</p>
            </div>
          )}

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              type="text"
              placeholder="Optional description of what this rule does"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Priority Input */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
              disabled={loading}
              min={0}
            />
            <p className="text-xs text-slate-500">
              Higher priority rules are evaluated first (default: 0)
            </p>
          </div>

          {/* Rule Builder */}
          <div className="space-y-2">
            <Label>
              Rule Expression <span className="text-red-500">*</span>
            </Label>
            <Card className="p-4">
              <RuleBuilder
                initialExpression={expression}
                onChange={handleExpressionChange}
                entityType={entityType}
                entityId={entityId}
              />
            </Card>
          </div>

          {/* Error Display */}
          {error && (
            <Card className="bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">Error saving rule</p>
              <p className="mt-1 text-sm text-red-600">{error.message}</p>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleCancel} variant="outline" disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : isEditMode ? 'Update Rule' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
