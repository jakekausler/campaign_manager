import { apply as applyJsonLogic } from 'json-logic-js';
import { useState, useEffect, useCallback, useMemo, useId, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import type { JSONLogicExpression } from './types';

export interface RulePreviewProps {
  expression: JSONLogicExpression;
  testContext: Record<string, unknown>;
  onContextChange: (context: Record<string, unknown>) => void;
}

interface EvaluationResult {
  value: unknown;
  error?: string;
}

/**
 * RulePreview - Live preview and testing component for JSONLogic rules
 *
 * Provides real-time evaluation of JSONLogic expressions with user-provided test context.
 * Features:
 * - Test context editor with JSON validation
 * - Manual evaluation via button
 * - Auto-evaluation mode with debouncing
 * - Accessible error messages and result display
 */
export function RulePreview({ expression, testContext, onContextChange }: RulePreviewProps) {
  const [contextText, setContextText] = useState('{}');
  const [contextError, setContextError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [autoEvaluate, setAutoEvaluate] = useState(false);
  const [isLocalEdit, setIsLocalEdit] = useState(false);

  const errorId = useId();
  const debounceTimerRef = useRef<number | null>(null);

  // Sync testContext prop to contextText (formatted JSON)
  useEffect(() => {
    if (!isLocalEdit) {
      setContextText(JSON.stringify(testContext, null, 2));
    }
  }, [testContext, isLocalEdit]);

  // Evaluate JSONLogic expression
  const evaluate = useCallback(() => {
    try {
      // Check if expression is empty (null, primitive, or empty object)
      if (
        expression === null ||
        typeof expression !== 'object' ||
        Array.isArray(expression) ||
        Object.keys(expression).length === 0
      ) {
        setResult(null);
        return;
      }

      // Evaluate using json-logic-js (cast to unknown then to expected type)
      const value = applyJsonLogic(
        expression as unknown as Parameters<typeof applyJsonLogic>[0],
        testContext
      );

      setResult({ value });
    } catch (error) {
      setResult({
        value: null,
        error: error instanceof Error ? error.message : 'Evaluation failed',
      });
    }
  }, [expression, testContext]);

  // Auto-evaluate when expression or testContext changes (if enabled)
  useEffect(() => {
    if (autoEvaluate) {
      // Debounce auto-evaluation
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        evaluate();
      }, 300); // 300ms debounce

      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }
    return undefined;
  }, [expression, testContext, autoEvaluate, evaluate]);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle context text change
  const handleContextChange = useCallback((newText: string) => {
    setContextText(newText);
    setIsLocalEdit(true);
    setContextError(null); // Clear error while typing
  }, []);

  // Handle context blur (validation)
  const handleContextBlur = useCallback(() => {
    try {
      const parsed = JSON.parse(contextText);
      setContextError(null);
      onContextChange(parsed);
      setIsLocalEdit(false);
    } catch (error) {
      // Use generic error message to avoid reflecting user input (security)
      setContextError('Syntax error in JSON');
    }
  }, [contextText, onContextChange]);

  // Check if expression is empty
  const hasExpression = useMemo(() => {
    if (expression === null || typeof expression !== 'object' || Array.isArray(expression)) {
      return false;
    }
    return Object.keys(expression).length > 0;
  }, [expression]);

  return (
    <div
      role="region"
      aria-label="Rule Preview"
      className="space-y-4 rounded-lg border border-gray-300 bg-white p-4"
    >
      <h3 className="text-lg font-semibold">Live Preview</h3>

      {/* Empty state */}
      {!hasExpression && (
        <div className="text-sm text-gray-500">
          No expression to evaluate. Add blocks to the rule builder to get started.
        </div>
      )}

      {/* Test Context Editor */}
      <div>
        <label htmlFor="test-context-editor" className="block text-sm font-medium text-gray-700">
          Test Context
        </label>
        <textarea
          id="test-context-editor"
          className="mt-1 block w-full rounded-md border border-gray-300 p-2 font-mono text-sm"
          rows={8}
          value={contextText}
          onChange={(e) => handleContextChange(e.target.value)}
          onBlur={handleContextBlur}
          aria-invalid={contextError !== null}
          aria-describedby={contextError ? errorId : undefined}
        />
        {contextError && (
          <div id={errorId} role="alert" className="mt-1 text-sm text-red-600">
            {contextError}
          </div>
        )}
      </div>

      {/* Auto-evaluate toggle */}
      <div className="flex items-center space-x-2">
        <Checkbox id="auto-evaluate" checked={autoEvaluate} onCheckedChange={setAutoEvaluate} />
        <label
          htmlFor="auto-evaluate"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Auto-evaluate on changes
        </label>
      </div>

      {/* Evaluate button */}
      <Button onClick={evaluate} disabled={!hasExpression}>
        Evaluate Rule
      </Button>

      {/* Result display */}
      {result !== null && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-gray-200 bg-gray-50 p-4"
        >
          <h4 className="mb-2 text-sm font-semibold">Result:</h4>
          <div className="font-mono text-sm">
            {result.error ? (
              <span className="text-red-600">Error: {result.error}</span>
            ) : (
              <span className="text-green-700">{JSON.stringify(result.value)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
