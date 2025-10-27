import { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type VariableSchema,
  validateVariableValue,
  validateAllVariables,
  convertFormValues,
} from '@/utils/variable-validation';

export interface TypedVariableEditorProps {
  /** Entity ID (settlement or structure) */
  entityId: string;
  /** Entity type ('settlement' or 'structure') */
  entityType: 'settlement' | 'structure';
  /** Variable schema definitions */
  variableSchemas: VariableSchema[];
  /** Current variable values */
  currentVariables: Record<string, unknown>;
  /** Callback when variables are saved */
  onSave: (variables: Record<string, unknown>) => Promise<void>;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
}

/**
 * TypedVariableEditor provides dynamic form generation for typed variables
 *
 * Features:
 * - Type-specific input controls (string, number, boolean, enum)
 * - Client-side validation with immediate feedback
 * - Unsaved changes warning
 * - Save/cancel operations
 * - Default value handling
 *
 * @example
 * ```tsx
 * <TypedVariableEditor
 *   entityId="settlement-1"
 *   entityType="settlement"
 *   variableSchemas={schemas}
 *   currentVariables={variables}
 *   onSave={handleSave}
 * />
 * ```
 */
export function TypedVariableEditor({
  entityId,
  entityType,
  variableSchemas,
  currentVariables,
  onSave,
  onCancel,
}: TypedVariableEditorProps) {
  // Form state: track values and errors
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Ref to track latest form values synchronously (prevents race conditions in blur handler)
  const formValuesRef = useRef<Record<string, unknown>>({});

  // Initialize form values from current variables or defaults
  useEffect(() => {
    const initialValues: Record<string, unknown> = {};
    for (const schema of variableSchemas) {
      const currentValue = currentVariables[schema.name];
      if (currentValue !== undefined && currentValue !== null) {
        initialValues[schema.name] = currentValue;
      } else if (schema.defaultValue !== undefined) {
        initialValues[schema.name] = schema.defaultValue;
      } else {
        // Set empty initial value based on type
        switch (schema.type) {
          case 'string':
          case 'enum':
            initialValues[schema.name] = '';
            break;
          case 'number':
            initialValues[schema.name] = '';
            break;
          case 'boolean':
            initialValues[schema.name] = false;
            break;
        }
      }
    }
    formValuesRef.current = initialValues;
    setFormValues(initialValues);
    setHasUnsavedChanges(false);
  }, [variableSchemas, currentVariables, entityId]);

  /**
   * Handle field value change
   */
  const handleChange = (name: string, value: unknown) => {
    const schema = variableSchemas.find((s) => s.name === name);
    if (!schema) return;

    // Update form values (both state and ref)
    const newValues = { ...formValuesRef.current, [name]: value };
    formValuesRef.current = newValues;
    setFormValues(newValues);
    setHasUnsavedChanges(true);

    // Validate if field has been touched
    if (touched[name]) {
      const error = validateVariableValue(schema, value);
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[name] = error;
        } else {
          delete newErrors[name];
        }
        return newErrors;
      });
    }
  };

  /**
   * Handle field blur (mark as touched for validation)
   */
  const handleBlur = (name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));

    // Validate on blur
    const schema = variableSchemas.find((s) => s.name === name);
    if (schema) {
      // Read from ref instead of state to avoid race conditions
      const value = formValuesRef.current[name];
      const error = validateVariableValue(schema, value);
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[name] = error;
        } else {
          delete newErrors[name];
        }
        return newErrors;
      });
    }
  };

  /**
   * Handle form submit
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    for (const schema of variableSchemas) {
      allTouched[schema.name] = true;
    }
    setTouched(allTouched);

    // Validate all fields
    const validationErrors = validateAllVariables(variableSchemas, formValues);
    setErrors(validationErrors);

    // If there are errors, don't submit
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    // Convert form values to correct types
    const typedValues = convertFormValues(variableSchemas, formValues);

    // Save
    setIsSaving(true);
    try {
      await onSave(typedValues);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save variables:', error);
      // Note: Error handling should be done in the parent component via toast
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    // Reset to current values
    const resetValues: Record<string, unknown> = {};
    for (const schema of variableSchemas) {
      const currentValue = currentVariables[schema.name];
      if (currentValue !== undefined && currentValue !== null) {
        resetValues[schema.name] = currentValue;
      } else if (schema.defaultValue !== undefined) {
        resetValues[schema.name] = schema.defaultValue;
      } else {
        switch (schema.type) {
          case 'string':
          case 'enum':
            resetValues[schema.name] = '';
            break;
          case 'number':
            resetValues[schema.name] = '';
            break;
          case 'boolean':
            resetValues[schema.name] = false;
            break;
        }
      }
    }
    formValuesRef.current = resetValues;
    setFormValues(resetValues);
    setErrors({});
    setTouched({});
    setHasUnsavedChanges(false);
    onCancel?.();
  };

  /**
   * Render input field based on variable type
   */
  const renderInputField = (schema: VariableSchema) => {
    const value = formValues[schema.name];
    const error = touched[schema.name] ? errors[schema.name] : null;
    const hasError = Boolean(error);

    const commonClasses = `w-full p-2 rounded-md border ${
      hasError
        ? 'border-red-500 focus:border-red-600 focus:ring-red-500'
        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
    } focus:outline-none focus:ring-2`;

    switch (schema.type) {
      case 'string':
        return (
          <Input
            id={schema.name}
            type="text"
            value={String(value || '')}
            onChange={(e) => handleChange(schema.name, e.target.value)}
            onBlur={() => handleBlur(schema.name)}
            className={commonClasses}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${schema.name}-error` : undefined}
          />
        );

      case 'number':
        return (
          <Input
            id={schema.name}
            type="text"
            inputMode="decimal"
            value={value !== '' && value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => {
              const val = e.target.value;
              handleChange(schema.name, val === '' ? '' : val);
            }}
            onBlur={() => handleBlur(schema.name)}
            className={commonClasses}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${schema.name}-error` : undefined}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <input
              id={schema.name}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleChange(schema.name, e.target.checked)}
              onBlur={() => handleBlur(schema.name)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              aria-invalid={hasError}
              aria-describedby={hasError ? `${schema.name}-error` : undefined}
            />
            <span className="text-sm text-slate-600">{value ? 'True' : 'False'}</span>
          </div>
        );

      case 'enum':
        if (!schema.enumValues || schema.enumValues.length === 0) {
          return <div className="text-sm text-red-600">Enum values not defined</div>;
        }
        return (
          <select
            id={schema.name}
            value={String(value || '')}
            onChange={(e) => handleChange(schema.name, e.target.value)}
            onBlur={() => handleBlur(schema.name)}
            className={commonClasses}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${schema.name}-error` : undefined}
          >
            <option value="">-- Select --</option>
            {schema.enumValues.map((enumValue) => (
              <option key={enumValue} value={enumValue}>
                {enumValue}
              </option>
            ))}
          </select>
        );

      default:
        return <div className="text-sm text-red-600">Unknown type: {schema.type}</div>;
    }
  };

  /**
   * Convert snake_case to Title Case
   */
  const toTitleCase = (str: string): string => {
    return str
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (variableSchemas.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No variable schemas defined for this {entityType}.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Unsaved changes warning */}
      {hasUnsavedChanges && (
        <div
          className="p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-900"
          role="alert"
        >
          You have unsaved changes. Click &quot;Save Variables&quot; to save your changes or
          &quot;Cancel&quot; to discard them.
        </div>
      )}

      {/* Variable fields */}
      {variableSchemas.map((schema) => {
        const error = touched[schema.name] ? errors[schema.name] : null;
        const hasError = Boolean(error);

        return (
          <div key={schema.name} className="space-y-1">
            <Label htmlFor={schema.name} className="text-xs font-semibold text-slate-700">
              {toTitleCase(schema.name)}
              {schema.description && (
                <span className="ml-2 font-normal text-slate-500">({schema.description})</span>
              )}
            </Label>

            {renderInputField(schema)}

            {/* Error message */}
            {hasError && (
              <div
                id={`${schema.name}-error`}
                className="text-xs text-red-600"
                role="alert"
                aria-live="polite"
              >
                {error}
              </div>
            )}

            {/* Default value hint */}
            {!hasError &&
              schema.defaultValue !== undefined &&
              formValues[schema.name] === schema.defaultValue &&
              !touched[schema.name] && (
                <div className="text-xs text-slate-500">Default: {String(schema.defaultValue)}</div>
              )}
          </div>
        );
      })}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isSaving || Object.keys(errors).length > 0}>
          {isSaving ? 'Saving...' : 'Save Variables'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
