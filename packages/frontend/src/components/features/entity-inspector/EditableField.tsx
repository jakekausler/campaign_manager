import { Check, Copy, Edit2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button, Input, Label } from '@/components/ui';

/**
 * Type of field for rendering different input types.
 */
export type FieldType = 'text' | 'number' | 'boolean' | 'json' | 'textarea';

/**
 * Props for the EditableField component.
 */
export interface EditableFieldProps {
  /** Field label */
  label: string;
  /** Current value */
  value: unknown;
  /** Whether the field is in edit mode */
  isEditing: boolean;
  /** Callback when value changes (only in edit mode) */
  onChange?: (value: unknown) => void;
  /** Field type for proper input rendering */
  type?: FieldType;
  /** Whether the field is read-only (cannot be edited) */
  readOnly?: boolean;
  /** Validation error message (if any) */
  error?: string;
  /** Whether to show copy-to-clipboard button (default: true) */
  showCopy?: boolean;
  /** Custom formatter for display value */
  formatter?: (value: unknown) => string;
}

/**
 * Format a value for display based on its type.
 *
 * @param value - The value to format
 * @param type - The field type
 * @param formatter - Optional custom formatter
 * @returns Formatted string representation
 */
function formatDisplayValue(
  value: unknown,
  type?: FieldType,
  formatter?: (value: unknown) => string
): string {
  if (formatter) {
    return formatter(value);
  }

  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (type === 'boolean') {
    return String(value);
  }

  if (type === 'json' || (typeof value === 'object' && value !== null)) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Parse a string input value based on field type.
 *
 * @param inputValue - The string input value
 * @param type - The field type
 * @returns Parsed value
 */
function parseInputValue(inputValue: string, type?: FieldType): unknown {
  if (type === 'number') {
    const num = Number(inputValue);
    return isNaN(num) ? inputValue : num;
  }

  if (type === 'boolean') {
    return inputValue === 'true';
  }

  if (type === 'json') {
    try {
      return JSON.parse(inputValue);
    } catch {
      return inputValue;
    }
  }

  return inputValue;
}

/**
 * Editable field component with inline editing and copy-to-clipboard.
 *
 * Displays a label and value, with optional edit mode for inline editing.
 * Supports different field types (text, number, boolean, JSON) and validation.
 *
 * @param props - Component props
 * @returns React element
 *
 * @example
 * ```tsx
 * <EditableField
 *   label="Name"
 *   value={entity.name}
 *   isEditing={isEditing}
 *   onChange={(newValue) => updateField('name', newValue)}
 *   error={errors.find(e => e.field === 'name')?.message}
 * />
 * ```
 */
export function EditableField({
  label,
  value,
  isEditing,
  onChange,
  type = 'text',
  readOnly = false,
  error,
  showCopy = true,
  formatter,
}: EditableFieldProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Copy the field value to clipboard.
   */
  const handleCopy = async () => {
    const displayValue = formatDisplayValue(value, type, formatter);
    try {
      await navigator.clipboard.writeText(displayValue);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  /**
   * Handle input change.
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!onChange) return;
    const parsedValue = parseInputValue(e.target.value, type);
    onChange(parsedValue);
  };

  const displayValue = formatDisplayValue(value, type, formatter);
  const inputValue = type === 'json' ? JSON.stringify(value) : String(value ?? '');

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-500">{label}</Label>
        {!isEditing && showCopy && !readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={handleCopy}
            title={`Copy ${label}`}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        )}
        {!isEditing && readOnly && <Edit2 className="h-3 w-3 text-slate-400" />}
      </div>

      {isEditing && !readOnly ? (
        <div className="space-y-1">
          {type === 'boolean' ? (
            <select
              value={String(value)}
              onChange={(e) => onChange?.(e.target.value === 'true')}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : type === 'textarea' ? (
            <textarea
              value={inputValue}
              onChange={handleInputChange}
              rows={4}
              className={`flex w-full rounded-md border ${error ? 'border-red-500' : 'border-slate-200'} bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 resize-y`}
            />
          ) : (
            <Input
              type={type === 'number' ? 'number' : 'text'}
              value={inputValue}
              onChange={handleInputChange}
              className={error ? 'border-red-500' : ''}
            />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ) : (
        <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">{displayValue}</p>
      )}
    </div>
  );
}
