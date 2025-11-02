import { useState, useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';

import { BlockEditor } from './BlockEditor';
import { JSONEditor } from './JSONEditor';
import type { JSONLogicExpression } from './types';

/**
 * View mode for the rule builder
 */
type ViewMode = 'visual' | 'json';

/**
 * Props for the RuleBuilder component
 */
export interface RuleBuilderProps {
  /** Initial JSONLogic expression to edit (optional) */
  initialExpression?: JSONLogicExpression;
  /** Callback when the expression changes */
  onChange?: (expression: JSONLogicExpression) => void;
  /** Entity type for variable context (e.g., 'Settlement', 'Structure') */
  entityType?: string;
  /** Entity ID for loading current values in live preview */
  entityId?: string;
}

/**
 * Main container component for the visual rule builder.
 * Provides a toggle between visual block-based editing and raw JSON editing.
 */
export const RuleBuilder = ({
  initialExpression,
  onChange,
  entityType,
  entityId: _entityId,
}: RuleBuilderProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [expression, setExpression] = useState<JSONLogicExpression | undefined>(initialExpression);

  // Sync expression state when initialExpression prop changes
  // This handles cases where parent loads data asynchronously
  useEffect(() => {
    setExpression(initialExpression);
  }, [initialExpression]);

  // Handle expression changes from either editor
  const handleExpressionChange = useCallback(
    (newExpression: JSONLogicExpression) => {
      setExpression(newExpression);
      if (onChange) {
        onChange(newExpression);
      }
    },
    [onChange]
  );

  return (
    <div className="rule-builder space-y-4" data-testid="rule-builder">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Button
          variant={viewMode === 'visual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('visual')}
          data-active={viewMode === 'visual'}
          aria-label="Visual mode"
        >
          Visual
        </Button>
        <Button
          variant={viewMode === 'json' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('json')}
          data-active={viewMode === 'json'}
          aria-label="JSON mode"
        >
          JSON
        </Button>
      </div>

      {/* Editor Content */}
      {viewMode === 'visual' ? (
        <BlockEditor
          expression={expression}
          onChange={handleExpressionChange}
          entityType={entityType}
        />
      ) : (
        <JSONEditor expression={expression} onChange={handleExpressionChange} />
      )}
    </div>
  );
};
