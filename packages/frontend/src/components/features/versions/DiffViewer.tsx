/**
 * DiffViewer component for displaying version differences
 *
 * Shows side-by-side comparison of changes between two version payloads.
 * Color codes: Green (added), Blue (modified), Red (removed)
 */

import { memo, useState, useCallback, useMemo } from 'react';

import type { VersionDiff } from '@/services/api/hooks/versions';

export interface DiffViewerProps {
  /**
   * The computed diff between two versions
   */
  diff: VersionDiff;

  /**
   * CSS class name for container
   */
  className?: string;
}

type ChangeType = 'added' | 'modified' | 'removed';

interface Change {
  type: ChangeType;
  key: string;
  value?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (value === '') {
    return '(empty)';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    // Custom replacer to format booleans as Yes/No in JSON
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === 'boolean') {
          return val ? 'Yes' : 'No';
        }
        return val;
      },
      2
    );
  }
  return String(value);
}

/**
 * DiffViewer component
 *
 * Displays version differences with color-coded change types, collapsible sections,
 * and field navigation for easy comparison.
 */
export const DiffViewer = memo(function DiffViewer({ diff, className = '' }: DiffViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<ChangeType>>(
    new Set(['added', 'modified', 'removed'])
  );
  const [currentChangeIndex, setCurrentChangeIndex] = useState<number>(0);

  // Flatten all changes into a single array for navigation
  const allChanges = useMemo((): Change[] => {
    const changes: Change[] = [];

    // Added fields
    Object.entries(diff.added).forEach(([key, value]) => {
      changes.push({ type: 'added', key, value });
    });

    // Modified fields
    Object.entries(diff.modified).forEach(([key, { old, new: newVal }]) => {
      changes.push({ type: 'modified', key, oldValue: old, newValue: newVal });
    });

    // Removed fields
    Object.entries(diff.removed).forEach(([key, value]) => {
      changes.push({ type: 'removed', key, value });
    });

    return changes;
  }, [diff]);

  const hasChanges = allChanges.length > 0;
  const hasMultipleChanges = allChanges.length > 1;

  // Toggle section expansion
  const toggleSection = useCallback((type: ChangeType) => {
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

  // Expand all sections
  const expandAll = useCallback(() => {
    setExpandedSections(new Set(['added', 'modified', 'removed']));
  }, []);

  // Collapse all sections
  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  // Navigate to next change
  const goToNextChange = useCallback(() => {
    setCurrentChangeIndex((prev) => Math.min(prev + 1, allChanges.length - 1));
  }, [allChanges.length]);

  // Navigate to previous change
  const goToPrevChange = useCallback(() => {
    setCurrentChangeIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Empty state
  if (!hasChanges) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 ${className}`}
        data-testid="diff-viewer"
        role="status"
        aria-live="polite"
      >
        <div
          className="max-w-md p-6 bg-white rounded-lg shadow-lg border border-gray-200"
          data-testid="diff-viewer-empty"
        >
          <div className="flex flex-col items-center space-y-4 text-center">
            <div
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"
              aria-hidden="true"
            >
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h3 className="text-lg font-semibold text-gray-900">No Changes Detected</h3>
            <p className="text-sm text-gray-600">These versions are identical.</p>
          </div>
        </div>
      </div>
    );
  }

  // Render a change section (added, modified, or removed)
  const renderSection = (
    type: ChangeType,
    entries: [string, unknown][] | [string, { old: unknown; new: unknown }][],
    colorClasses: string,
    icon: string,
    label: string
  ) => {
    if (entries.length === 0) return null;

    const isExpanded = expandedSections.has(type);
    const testId = `diff-section-${type}`;

    return (
      <div
        key={type}
        className={`border rounded-lg ${colorClasses}`}
        data-testid={testId}
        aria-label={`${label} fields`}
      >
        {/* Section Header */}
        <button
          className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={() => toggleSection(type)}
          data-testid={`diff-section-${type}-header`}
          aria-expanded={isExpanded}
        >
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-gray-900">
              {icon} {label} ({entries.length})
            </span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Section Content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-2">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="p-3 bg-white rounded border border-gray-200"
                data-testid={`diff-field-${type}-${key}`}
              >
                <div className="font-medium text-gray-900 mb-1">{key}</div>
                {type === 'modified' ? (
                  <div className="text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-red-700 font-mono">
                        {formatValue((value as { old: unknown; new: unknown }).old)}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className="text-green-700 font-mono">
                        {formatValue((value as { old: unknown; new: unknown }).new)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm font-mono text-gray-700 whitespace-pre-wrap break-all">
                    {formatValue(value)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}
      data-testid="diff-viewer"
      role="region"
      aria-label="Version diff viewer"
    >
      {/* Controls - spans both columns */}
      <div className="flex items-center justify-between md:col-span-2">
        {/* Expand/Collapse Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={expandAll}
            className="px-3 py-1 text-sm font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="diff-expand-all"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1 text-sm font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="diff-collapse-all"
          >
            Collapse All
          </button>
        </div>

        {/* Navigation Controls */}
        {hasMultipleChanges && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              Change {currentChangeIndex + 1} of {allChanges.length}
            </span>
            <button
              onClick={goToPrevChange}
              disabled={currentChangeIndex === 0}
              className="px-2 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              data-testid="diff-nav-prev"
              tabIndex={0}
              aria-label="Previous change"
            >
              ← Prev
            </button>
            <button
              onClick={goToNextChange}
              disabled={currentChangeIndex === allChanges.length - 1}
              className="px-2 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              data-testid="diff-nav-next"
              tabIndex={0}
              aria-label="Next change"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Diff Sections - spans both columns, Desktop: Side-by-side, Mobile: Stacked */}
      <div className="space-y-4 md:col-span-2">
        {/* Added Section */}
        {renderSection(
          'added',
          Object.entries(diff.added),
          'bg-green-50 border-green-200',
          '+',
          'Added'
        )}

        {/* Modified Section */}
        {renderSection(
          'modified',
          Object.entries(diff.modified),
          'bg-blue-50 border-blue-200',
          '~',
          'Modified'
        )}

        {/* Removed Section */}
        {renderSection(
          'removed',
          Object.entries(diff.removed),
          'bg-red-50 border-red-200',
          '-',
          'Removed'
        )}
      </div>
    </div>
  );
});
