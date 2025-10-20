import { useState, useCallback, useMemo, useRef } from 'react';

/**
 * Validation error for a field.
 */
export interface FieldError {
  /** The field name that has an error */
  field: string;
  /** The error message */
  message: string;
}

/**
 * Validation function for field values.
 *
 * @param field - The field name being validated
 * @param value - The value to validate
 * @returns Error message if invalid, undefined if valid
 */
export type FieldValidator = (field: string, value: unknown) => string | undefined;

/**
 * Options for the useEditMode hook.
 */
export interface UseEditModeOptions<T> {
  /** Initial data for the form */
  initialData: T;
  /** Callback when save is triggered */
  onSave: (data: T) => Promise<void> | void;
  /** Optional validation function */
  validate?: FieldValidator;
  /** Callback when cancel is triggered (optional) */
  onCancel?: () => void;
  /** Callback when edit mode changes (optional) */
  onEditModeChange?: (isEditing: boolean) => void;
}

/**
 * Result from the useEditMode hook.
 */
export interface UseEditModeResult<T> {
  /** Whether edit mode is active */
  isEditing: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Current form data (edited or initial) */
  data: T;
  /** Validation errors */
  errors: FieldError[];
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Enter edit mode */
  startEditing: () => void;
  /** Cancel edit mode and discard changes */
  cancelEditing: () => void;
  /** Save changes */
  save: () => Promise<boolean>;
  /** Update a field value */
  updateField: (field: keyof T, value: T[keyof T]) => void;
  /** Reset form to initial data */
  reset: () => void;
}

/**
 * Hook for managing inline edit mode with validation and dirty checking.
 *
 * Provides state management for toggling between view and edit modes,
 * tracking form changes, validation, and save/cancel operations.
 *
 * @param options - Configuration options
 * @returns Object with edit mode state and actions
 *
 * @example
 * ```tsx
 * function EntityEditor() {
 *   const { data: entity } = useSettlementDetails('settlement-1');
 *
 *   const {
 *     isEditing,
 *     isSaving,
 *     data,
 *     errors,
 *     isDirty,
 *     startEditing,
 *     cancelEditing,
 *     save,
 *     updateField,
 *   } = useEditMode({
 *     initialData: entity,
 *     onSave: async (updated) => {
 *       await updateSettlement(updated.id, updated);
 *     },
 *     validate: (field, value) => {
 *       if (field === 'name' && (!value || value === '')) {
 *         return 'Name is required';
 *       }
 *       return undefined;
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       {isEditing ? (
 *         <>
 *           <input
 *             value={data.name}
 *             onChange={(e) => updateField('name', e.target.value)}
 *           />
 *           <button onClick={save} disabled={isSaving || errors.length > 0}>
 *             Save
 *           </button>
 *           <button onClick={cancelEditing} disabled={isSaving}>
 *             Cancel
 *           </button>
 *         </>
 *       ) : (
 *         <>
 *           <span>{entity.name}</span>
 *           <button onClick={startEditing}>Edit</button>
 *         </>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useEditMode<T extends Record<string, unknown>>(
  options: UseEditModeOptions<T>
): UseEditModeResult<T> {
  const { initialData, onSave, validate, onCancel, onEditModeChange } = options;

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<T>(initialData);
  const [errors, setErrors] = useState<FieldError[]>([]);

  // Keep track of the initial data for dirty checking and reset
  const initialDataRef = useRef<T>(initialData);

  // Update initial data ref when initialData changes (e.g., from GraphQL refetch)
  // This allows the form to stay in sync with external data updates
  if (initialData !== initialDataRef.current) {
    initialDataRef.current = initialData;
    // If not editing, update the form data to match
    if (!isEditing) {
      setData(initialData);
    }
  }

  /**
   * Check if the current data differs from initial data (has unsaved changes).
   */
  const isDirty = useMemo(() => {
    return JSON.stringify(data) !== JSON.stringify(initialDataRef.current);
  }, [data]);

  /**
   * Enter edit mode.
   */
  const startEditing = useCallback(() => {
    setIsEditing(true);
    setErrors([]);
    onEditModeChange?.(true);
  }, [onEditModeChange]);

  /**
   * Cancel edit mode and discard changes.
   */
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setData(initialDataRef.current);
    setErrors([]);
    onCancel?.();
    onEditModeChange?.(false);
  }, [onCancel, onEditModeChange]);

  /**
   * Validate all fields and update error state.
   *
   * @returns True if validation passes, false otherwise
   */
  const validateForm = useCallback((): boolean => {
    if (!validate) {
      return true;
    }

    const fieldErrors: FieldError[] = [];

    Object.keys(data).forEach((field) => {
      const error = validate(field, data[field]);
      if (error) {
        fieldErrors.push({ field, message: error });
      }
    });

    setErrors(fieldErrors);
    return fieldErrors.length === 0;
  }, [data, validate]);

  /**
   * Save changes.
   *
   * Validates the form, calls onSave, and exits edit mode on success.
   *
   * @returns Promise resolving to true if save succeeded, false if validation failed
   */
  const save = useCallback(async (): Promise<boolean> => {
    // Validate before saving
    if (!validateForm()) {
      return false;
    }

    setIsSaving(true);

    try {
      await onSave(data);
      // Update initial data ref to the saved data
      initialDataRef.current = data;
      setIsEditing(false);
      setErrors([]);
      onEditModeChange?.(false);
      return true;
    } catch (error) {
      // Save failed - stay in edit mode
      const errorMessage = error instanceof Error ? error.message : 'Save failed';
      setErrors([{ field: '_form', message: errorMessage }]);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [data, onSave, validateForm, onEditModeChange]);

  /**
   * Update a field value.
   *
   * Automatically validates the field if a validator is provided.
   *
   * @param field - The field name to update
   * @param value - The new value
   */
  const updateField = useCallback(
    (field: keyof T, value: T[keyof T]) => {
      setData((prev) => ({ ...prev, [field]: value }));

      // Validate the field if validator is provided
      if (validate) {
        const error = validate(field as string, value);
        setErrors((prev) => {
          // Remove existing error for this field
          const filtered = prev.filter((e) => e.field !== field);
          // Add new error if validation failed
          if (error) {
            return [...filtered, { field: field as string, message: error }];
          }
          return filtered;
        });
      }
    },
    [validate]
  );

  /**
   * Reset form to initial data.
   */
  const reset = useCallback(() => {
    setData(initialDataRef.current);
    setErrors([]);
  }, []);

  // Return memoized result
  return useMemo(
    () => ({
      isEditing,
      isSaving,
      data,
      errors,
      isDirty,
      startEditing,
      cancelEditing,
      save,
      updateField,
      reset,
    }),
    [
      isEditing,
      isSaving,
      data,
      errors,
      isDirty,
      startEditing,
      cancelEditing,
      save,
      updateField,
      reset,
    ]
  );
}
