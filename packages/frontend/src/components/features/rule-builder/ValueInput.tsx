import { useState, useId, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { VariablePickerInput, type VariableOption } from './VariablePickerInput';
import { isVarExpression } from './typeGuards';
import type { JSONLogicExpression, LiteralValue } from './types';

export type ExpectedType = 'string' | 'number' | 'boolean' | 'array' | 'null' | 'any';

export interface ValueInputProps {
  /** Current value (literal or variable expression) */
  value: LiteralValue | JSONLogicExpression;
  /** Expected type for validation and input rendering */
  expectedType: ExpectedType;
  /** Callback when value changes */
  onChange: (value: LiteralValue | JSONLogicExpression) => void;
  /** Available variables for picker (optional) */
  availableVariables?: VariableOption[];
}

/**
 * Type-aware value input component that supports both literal values and variable references
 */
export function ValueInput({
  value,
  expectedType,
  onChange,
  availableVariables = [],
}: ValueInputProps) {
  const errorId = useId();

  // Local state for controlled input behavior in tests
  const [localValue, setLocalValue] = useState<LiteralValue | JSONLogicExpression>(value);

  // Track raw array text separately to preserve commas during typing
  const [arrayText, setArrayText] = useState<string>(Array.isArray(value) ? value.join(', ') : '');

  // Track raw number text to handle negative signs and decimals during typing
  const [numberText, setNumberText] = useState<string>(
    typeof value === 'number' ? String(value) : '0'
  );

  // Sync local state with prop changes
  useEffect(() => {
    setLocalValue(value);
    // Sync array text when value changes externally
    if (Array.isArray(value)) {
      setArrayText(value.join(', '));
    }
    // Sync number text when value changes externally
    if (typeof value === 'number') {
      setNumberText(String(value));
    }
  }, [value]);

  // Determine current mode based on local value
  const isVariableMode = isVarExpression(localValue);

  // State for validation errors
  const [error, setError] = useState<string | null>(null);

  // Validate initial value
  useEffect(() => {
    if (expectedType === 'number' && typeof localValue === 'number' && isNaN(localValue)) {
      setError('Invalid number');
    } else {
      setError(null);
    }
  }, [localValue, expectedType]);

  // Switch to literal mode
  const switchToLiteral = () => {
    // Initialize with type-appropriate default
    let defaultValue: LiteralValue;
    switch (expectedType) {
      case 'number':
        defaultValue = 0;
        setNumberText('0');
        break;
      case 'boolean':
        defaultValue = false;
        break;
      case 'array':
        defaultValue = [];
        setArrayText('');
        break;
      case 'null':
        defaultValue = null;
        break;
      case 'string':
      case 'any':
      default:
        defaultValue = '';
    }
    setLocalValue(defaultValue);
    onChange(defaultValue);
    setError(null);
  };

  // Switch to variable mode
  const switchToVariable = () => {
    const varValue = { var: '' };
    setLocalValue(varValue);
    onChange(varValue);
    setError(null);
  };

  // Handle variable path change
  const handleVariableChange = (path: string) => {
    const varValue = { var: path };
    setLocalValue(varValue);
    onChange(varValue);
  };

  // Handle literal value change with validation
  const handleLiteralChange = (newValue: string | number | boolean | null | string[]) => {
    let validatedValue: LiteralValue = newValue;
    let validationError: string | null = null;

    // Validate based on expected type
    switch (expectedType) {
      case 'number':
        if (typeof newValue === 'number') {
          if (isNaN(newValue)) {
            validationError = 'Invalid number';
          }
          validatedValue = newValue;
        }
        break;
      case 'string':
        validatedValue = String(newValue);
        break;
      case 'boolean':
        validatedValue = Boolean(newValue);
        break;
      case 'array':
        if (Array.isArray(newValue)) {
          validatedValue = newValue;
        }
        break;
      case 'null':
        validatedValue = null;
        break;
      case 'any':
      default:
        validatedValue = newValue;
    }

    setError(validationError);
    setLocalValue(validatedValue);
    onChange(validatedValue);
  };

  // Render mode toggle buttons
  const renderModeToggle = () => (
    <div className="flex gap-1 mb-2">
      <Button
        variant={!isVariableMode ? 'default' : 'outline'}
        size="sm"
        onClick={switchToLiteral}
        type="button"
      >
        Literal
      </Button>
      <Button
        variant={isVariableMode ? 'default' : 'outline'}
        size="sm"
        onClick={switchToVariable}
        type="button"
      >
        Variable
      </Button>
    </div>
  );

  // Render variable input
  const renderVariableInput = () => {
    const varPath =
      typeof localValue === 'object' && localValue !== null && 'var' in localValue
        ? String(localValue.var)
        : '';

    return (
      <VariablePickerInput
        value={varPath}
        onChange={handleVariableChange}
        variables={availableVariables}
        placeholder="Select a variable..."
      />
    );
  };

  // Render literal input based on type
  const renderLiteralInput = () => {
    // Handle null type
    if (expectedType === 'null') {
      return <Input type="text" value="null" disabled className="w-full" />;
    }

    // Handle boolean type
    if (expectedType === 'boolean') {
      return (
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={String(localValue)}
          onChange={(e) => handleLiteralChange(e.target.value === 'true')}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    // Handle array type
    if (expectedType === 'array') {
      return (
        <Input
          type="text"
          value={arrayText}
          onChange={(e) => {
            const rawText = e.target.value;
            setArrayText(rawText);

            const items = rawText
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item !== '');
            handleLiteralChange(items);
          }}
          placeholder="Enter comma-separated values"
          className="w-full"
        />
      );
    }

    // Handle number type
    if (expectedType === 'number') {
      return (
        <Input
          type="number"
          value={numberText}
          onChange={(e) => {
            const rawText = e.target.value;
            setNumberText(rawText);

            const parsed = parseFloat(rawText);
            handleLiteralChange(parsed);
          }}
          step="any"
          className="w-full"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
        />
      );
    }

    // Default to string input
    const stringValue = localValue !== null && localValue !== undefined ? String(localValue) : '';
    return (
      <Input
        type="text"
        value={stringValue}
        onChange={(e) => handleLiteralChange(e.target.value)}
        className="w-full"
      />
    );
  };

  // Render validation error
  const renderError = () => {
    if (!error) return null;

    return (
      <div id={errorId} role="alert" aria-live="polite" className="text-sm text-red-600 mt-1">
        {error}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {renderModeToggle()}
      {isVariableMode ? renderVariableInput() : renderLiteralInput()}
      {renderError()}
    </div>
  );
}
