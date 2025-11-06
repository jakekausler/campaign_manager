/**
 * AuditDiffViewer component for displaying audit log state changes
 *
 * Shows before/after states and highlighted differences for audit log entries.
 * Designed to work with the enhanced audit fields (previousState, newState, diff).
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { memo, useState, useCallback } from 'react';

import { JsonHighlighter } from '@/components/shared/JsonHighlighter';

export interface AuditDiffViewerProps {
  /**
   * Full entity state before the operation (for CREATE operations, this may be null)
   */
  previousState?: Record<string, unknown> | null;

  /**
   * Full entity state after the operation (for DELETE operations, this may be null)
   */
  newState?: Record<string, unknown> | null;

  /**
   * Computed diff in VersionDiff format: { added: {}, modified: {}, removed: {} }
   */
  diff?: Record<string, unknown> | null;

  /**
   * Operation type for context
   */
  operation:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'ARCHIVE'
    | 'RESTORE'
    | 'FORK'
    | 'MERGE'
    | 'CHERRY_PICK';

  /**
   * CSS class name for container
   */
  className?: string;
}

type SectionType = 'previous' | 'new' | 'diff';

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value === '') return '(empty)';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * AuditDiffViewer component
 *
 * Displays state changes from audit log entries with collapsible sections.
 * Shows previousState, newState, and structured diff with color-coded change types.
 */
export const AuditDiffViewer = memo(function AuditDiffViewer({
  previousState,
  newState,
  diff,
  operation,
  className = '',
}: AuditDiffViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SectionType>>(
    () => new Set(['diff']) // Start with diff section expanded by default
  );

  // Toggle section expansion
  const toggleSection = useCallback((type: SectionType) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Check what data is available
  const hasPreviousState = previousState !== null && previousState !== undefined;
  const hasNewState = newState !== null && newState !== undefined;
  const hasDiff = diff !== null && diff !== undefined;

  // For CREATE operations, we typically only have newState
  // For DELETE operations, we typically only have previousState
  // For UPDATE operations, we have all three

  // Empty state - no data to show
  if (!hasPreviousState && !hasNewState && !hasDiff) {
    return (
      <div
        className={`p-6 text-center text-sm text-slate-500 ${className}`}
        data-testid="audit-diff-viewer-empty"
      >
        <p>No state changes recorded for this operation.</p>
        <p className="text-xs mt-1">
          (Enhanced audit tracking may not have been enabled when this entry was created)
        </p>
      </div>
    );
  }

  // Render a collapsible section
  const renderSection = (
    type: SectionType,
    label: string,
    content: React.ReactNode,
    colorClasses: string,
    available: boolean
  ) => {
    if (!available) return null;

    const isExpanded = expandedSections.has(type);

    return (
      <div
        key={type}
        className={`border rounded-md ${colorClasses}`}
        data-testid={`audit-diff-section-${type}`}
      >
        {/* Section Header */}
        <button
          className="w-full px-3 py-2 flex items-center justify-between hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded-md"
          onClick={() => toggleSection(type)}
          data-testid={`audit-diff-section-${type}-header`}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${label}`}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-600" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-600" aria-hidden="true" />
            )}
            <span className="text-sm font-semibold text-slate-900">{label}</span>
          </div>
        </button>

        {/* Section Content */}
        {isExpanded && (
          <div className="px-3 pb-3" data-testid={`audit-diff-section-${type}-content`}>
            {content}
          </div>
        )}
      </div>
    );
  };

  // Render diff changes (added, modified, removed)
  const renderDiffContent = () => {
    if (!diff) return null;

    const typedDiff = diff as {
      added?: Record<string, unknown>;
      modified?: Record<string, { old: unknown; new: unknown }>;
      removed?: Record<string, unknown>;
    };

    const hasAdded = typedDiff.added && Object.keys(typedDiff.added).length > 0;
    const hasModified = typedDiff.modified && Object.keys(typedDiff.modified).length > 0;
    const hasRemoved = typedDiff.removed && Object.keys(typedDiff.removed).length > 0;

    if (!hasAdded && !hasModified && !hasRemoved) {
      return <p className="text-xs text-slate-500 italic">No field-level changes detected</p>;
    }

    return (
      <div className="space-y-3">
        {/* Added Fields */}
        {hasAdded && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-green-800">Added Fields</div>
            <div className="space-y-2">
              {Object.entries(typedDiff.added!).map(([key, value]) => (
                <div
                  key={key}
                  className="p-2 bg-green-50 border border-green-200 rounded text-xs"
                  data-testid={`diff-added-${key}`}
                >
                  <div className="font-medium text-green-900 mb-1">{key}</div>
                  <div className="font-mono text-green-800 whitespace-pre-wrap break-all">
                    {formatValue(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modified Fields */}
        {hasModified && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-blue-800">Modified Fields</div>
            <div className="space-y-2">
              {Object.entries(typedDiff.modified!).map(([key, change]) => (
                <div
                  key={key}
                  className="p-2 bg-blue-50 border border-blue-200 rounded text-xs"
                  data-testid={`diff-modified-${key}`}
                >
                  <div className="font-medium text-blue-900 mb-1">{key}</div>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-slate-600 mb-0.5">Before:</div>
                      <div className="font-mono text-red-700 whitespace-pre-wrap break-all">
                        {formatValue(change.old)}
                      </div>
                    </div>
                    <div className="text-slate-400 mt-5">→</div>
                    <div className="flex-1">
                      <div className="text-xs text-slate-600 mb-0.5">After:</div>
                      <div className="font-mono text-green-700 whitespace-pre-wrap break-all">
                        {formatValue(change.new)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Removed Fields */}
        {hasRemoved && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-red-800">Removed Fields</div>
            <div className="space-y-2">
              {Object.entries(typedDiff.removed!).map(([key, value]) => (
                <div
                  key={key}
                  className="p-2 bg-red-50 border border-red-200 rounded text-xs"
                  data-testid={`diff-removed-${key}`}
                >
                  <div className="font-medium text-red-900 mb-1">{key}</div>
                  <div className="font-mono text-red-800 whitespace-pre-wrap break-all">
                    {formatValue(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`space-y-2 ${className}`}
      data-testid="audit-diff-viewer"
      role="region"
      aria-label="Audit state changes"
    >
      {/* Operation-specific guidance */}
      <div className="text-xs text-slate-600 mb-3">
        {operation === 'CREATE' && hasPreviousState && (
          <p className="italic">Showing state before and after creation</p>
        )}
        {operation === 'CREATE' && !hasPreviousState && (
          <p className="italic">Showing created entity state</p>
        )}
        {operation === 'DELETE' && hasNewState && (
          <p className="italic">Showing state before and after deletion</p>
        )}
        {operation === 'DELETE' && !hasNewState && (
          <p className="italic">Showing deleted entity state</p>
        )}
        {operation === 'UPDATE' && <p className="italic">Showing state changes</p>}
        {['ARCHIVE', 'RESTORE', 'FORK', 'MERGE', 'CHERRY_PICK'].includes(operation) && (
          <p className="italic">Showing state before and after operation</p>
        )}
      </div>

      {/* Structured Diff Section (Most important, shown first) */}
      {renderSection(
        'diff',
        'Changes',
        renderDiffContent(),
        'bg-blue-50/50 border-blue-200',
        hasDiff
      )}

      {/* Previous State Section */}
      {renderSection(
        'previous',
        `State Before ${operation}`,
        <JsonHighlighter json={JSON.stringify(previousState, null, 2)} className="text-xs" />,
        'bg-slate-50 border-slate-200',
        hasPreviousState
      )}

      {/* New State Section */}
      {renderSection(
        'new',
        `State After ${operation}`,
        <JsonHighlighter json={JSON.stringify(newState, null, 2)} className="text-xs" />,
        'bg-slate-50 border-slate-200',
        hasNewState
      )}
    </div>
  );
});
