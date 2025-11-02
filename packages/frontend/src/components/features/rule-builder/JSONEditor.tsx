import { useState, useEffect, useId } from 'react';

import type { JSONLogicExpression } from './types';

/**
 * Props for the JSONEditor component
 */
export interface JSONEditorProps {
  /** JSONLogic expression as a JavaScript object */
  expression?: JSONLogicExpression;
  /** Callback when the JSON is modified */
  onChange?: (expression: JSONLogicExpression) => void;
  /** Whether the editor is in read-only mode */
  readOnly?: boolean;
}

/**
 * Raw JSON editing interface for JSONLogic expressions.
 * Provides validation for manual JSON editing.
 */
export const JSONEditor = ({ expression, onChange, readOnly = false }: JSONEditorProps) => {
  const [jsonText, setJsonText] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLocalEdit, setIsLocalEdit] = useState(false);
  const errorId = useId();

  // Initialize and sync jsonText with expression prop
  // Only update from prop if the change didn't originate from this component
  useEffect(() => {
    if (!isLocalEdit) {
      if (expression !== undefined) {
        setJsonText(JSON.stringify(expression, null, 2));
      } else {
        setJsonText('');
      }
    }
    setIsLocalEdit(false);
  }, [expression, isLocalEdit]);

  // Handle textarea changes
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonText(e.target.value);
    // Clear error when user starts typing after an error
    if (error) {
      setError('');
    }
  };

  // Validate JSON on blur
  const handleBlur = () => {
    // Allow empty input
    if (jsonText.trim() === '') {
      setError('');
      return;
    }

    try {
      const parsed = JSON.parse(jsonText) as JSONLogicExpression;
      setError('');
      // Mark as local edit to prevent useEffect from overwriting on next render
      setIsLocalEdit(true);
      if (onChange) {
        onChange(parsed);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Invalid JSON: ${errorMessage}`);
    }
  };

  return (
    <div className="json-editor space-y-2" data-testid="json-editor">
      <h3 className="text-lg font-semibold">JSON Editor</h3>

      <textarea
        className="w-full min-h-[300px] font-mono text-sm p-3 border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={jsonText}
        onChange={handleTextChange}
        onBlur={handleBlur}
        disabled={readOnly}
        spellCheck={false}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      />

      {error && (
        <div
          id={errorId}
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
};
