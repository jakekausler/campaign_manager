import { useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { OperatorType } from './types';

export interface OperatorBlockProps {
  /** The operator symbol or identifier */
  operator: string;
  /** The category of operator for styling */
  type: OperatorType;
  /** Optional custom display label (overrides operator) */
  label?: string;
  /** Optional icon to display */
  icon?: string;
  /** Whether the block can be collapsed */
  collapsible?: boolean;
  /** Whether the block starts collapsed */
  defaultCollapsed?: boolean;
  /** Whether the block is in an invalid state */
  invalid?: boolean;
  /** Error message to display when invalid */
  errorMessage?: string;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
  /** Custom action buttons to render */
  actions?: ReactNode;
  /** Child content to render inside the block */
  children: ReactNode;
}

/**
 * Base component for all operator blocks in the visual rule builder
 * Provides consistent styling, collapse/expand, validation, and actions
 */
export function OperatorBlock({
  operator,
  type,
  label,
  icon,
  collapsible = true,
  defaultCollapsed = false,
  invalid = false,
  errorMessage,
  onDelete,
  actions,
  children,
}: OperatorBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Type-specific styling
  const typeColorClasses: Record<OperatorType, string> = {
    logical: 'border-purple-500 bg-purple-50',
    comparison: 'border-blue-500 bg-blue-50',
    arithmetic: 'border-green-500 bg-green-50',
    conditional: 'border-yellow-500 bg-yellow-50',
    variable: 'border-indigo-500 bg-indigo-50',
    literal: 'border-gray-500 bg-gray-50',
  };

  const typeColors = typeColorClasses[type];
  const invalidStyles = invalid ? 'border-red-500 bg-red-50' : '';
  const errorId = invalid && errorMessage ? `${operator}-error` : undefined;

  return (
    <div
      className={`border-l-4 rounded-md p-3 space-y-2 ${invalidStyles || typeColors}`}
      role="region"
      aria-label={`${operator} operator block`}
      aria-describedby={errorId}
      data-invalid={invalid || undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <Badge variant="outline" className="font-mono">
            {label || operator}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {actions}
          {collapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? 'Expand block' : 'Collapse block'}
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? '▶' : '▼'}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              aria-label="Delete block"
              className="text-red-600 hover:text-red-700 hover:bg-red-100"
            >
              ✕
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {invalid && errorMessage && (
        <div id={errorId} className="text-sm text-red-600 font-medium" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Content */}
      {!isCollapsed && <div className="pl-4">{children}</div>}
    </div>
  );
}
