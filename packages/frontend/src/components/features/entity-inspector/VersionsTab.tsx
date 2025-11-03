/**
 * VersionsTab Component
 * Displays audit history or version history for an entity with view toggle
 */

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui';
import { Card } from '@/components/ui/card';
import { useEntityAuditHistory, type AuditEntry } from '@/services/api/hooks';
import { useCurrentBranchId } from '@/stores';

import { VersionList } from '../versions/VersionList';

export interface VersionsTabProps {
  entityType: string;
  entityId: string;
}

type ViewMode = 'audit' | 'versions';

/**
 * VersionsTab - Displays audit history or version history for an entity
 *
 * Features two view modes:
 * - Audit History: Timeline of all operations (CREATE, UPDATE, DELETE, etc.)
 * - Version History: Full version control with comparison and restore
 *
 * Keyboard shortcuts:
 * - Ctrl+H: Toggle between audit and version history views
 *
 * @param props - Component props
 * @param props.entityType - Type of entity (e.g., "settlement", "structure")
 * @param props.entityId - ID of the entity
 */
export function VersionsTab({ entityType, entityId }: VersionsTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('audit');
  const branchId = useCurrentBranchId();

  // Capitalize entity type for GraphQL query (Settlement, Structure)
  const capitalizedEntityType =
    entityType.charAt(0).toUpperCase() + entityType.slice(1).toLowerCase();

  // Keyboard shortcut: Ctrl+H to toggle views
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'h') {
        event.preventDefault();
        setViewMode((prev) => (prev === 'audit' ? 'versions' : 'audit'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  return (
    <div className="p-4 space-y-4">
      {/* View Toggle */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <Button
          onClick={() => handleToggleView('audit')}
          size="sm"
          variant={viewMode === 'audit' ? 'default' : 'outline'}
          className={viewMode === 'audit' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          Audit History
        </Button>
        <Button
          onClick={() => handleToggleView('versions')}
          size="sm"
          variant={viewMode === 'versions' ? 'default' : 'outline'}
          className={viewMode === 'versions' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          Version History
        </Button>
        <span className="text-xs text-slate-500 ml-auto">Ctrl+H to toggle</span>
      </div>

      {/* Render appropriate view */}
      {viewMode === 'audit' ? (
        <AuditHistoryView
          capitalizedEntityType={capitalizedEntityType}
          entityType={entityType}
          entityId={entityId}
        />
      ) : (
        <VersionHistoryView
          capitalizedEntityType={capitalizedEntityType}
          entityId={entityId}
          branchId={branchId}
        />
      )}
    </div>
  );
}

/**
 * AuditHistoryView - Displays audit trail timeline
 */
interface AuditHistoryViewProps {
  capitalizedEntityType: string;
  entityType: string;
  entityId: string;
}

function AuditHistoryView({ capitalizedEntityType, entityType, entityId }: AuditHistoryViewProps) {
  const { audits, loading, error, refetch } = useEntityAuditHistory(
    capitalizedEntityType,
    entityId,
    50 // Fetch up to 50 audit entries
  );

  // Backend returns audits sorted by timestamp DESC (newest first)
  // No additional sorting needed in frontend

  if (loading) {
    return (
      <div>
        <p className="text-sm text-slate-500">Loading audit history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-4 bg-red-50 border-red-200">
        <p className="text-sm text-red-700 mb-2">Failed to load audit history</p>
        <p className="text-xs text-red-600 mb-3">{error.message}</p>
        <Button onClick={() => refetch()} size="sm" variant="outline">
          Retry
        </Button>
      </Card>
    );
  }

  if (audits.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-slate-500">No audit history available for this {entityType}.</p>
        <p className="text-xs text-slate-400 mt-1">
          Changes will appear here once this entity is modified.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Audit History</h3>
        <span className="text-xs text-slate-500">{audits.length} entries</span>
      </div>

      {audits.map((audit: AuditEntry, index: number) => (
        <AuditEntryCard key={audit.id} audit={audit} isFirst={index === 0} />
      ))}
    </div>
  );
}

/**
 * VersionHistoryView - Displays version control interface
 */
interface VersionHistoryViewProps {
  capitalizedEntityType: string;
  entityId: string;
  branchId: string | null;
}

function VersionHistoryView({
  capitalizedEntityType,
  entityId,
  branchId,
}: VersionHistoryViewProps) {
  if (!branchId) {
    return (
      <Card className="p-8 text-center bg-yellow-50 border-yellow-200">
        <p className="text-sm text-yellow-800 mb-1">No branch selected</p>
        <p className="text-xs text-yellow-600">Please select a branch to view version history.</p>
      </Card>
    );
  }

  return <VersionList entityType={capitalizedEntityType} entityId={entityId} branchId={branchId} />;
}

interface AuditEntryCardProps {
  audit: AuditEntry;
  isFirst: boolean;
}

/**
 * AuditEntryCard - Displays a single audit entry
 *
 * @param props - Component props
 * @param props.audit - Audit entry data
 * @param props.isFirst - Whether this is the most recent entry
 */
function AuditEntryCard({ audit, isFirst }: AuditEntryCardProps) {
  const isResolutionEntry = isResolutionOperation(audit);
  const operationColor = isResolutionEntry
    ? 'bg-green-100 text-green-800 border border-green-300'
    : getOperationColor(audit.operation);
  const timestamp = new Date(audit.timestamp);

  return (
    <Card
      className={`p-4 ${isFirst ? 'border-blue-200 bg-blue-50' : ''} ${isResolutionEntry ? 'border-l-4 border-l-green-500' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${operationColor}`}>
            {audit.operation}
          </span>
          {isResolutionEntry && (
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-200 text-green-900 border border-green-400">
              {getResolutionLabel(audit)}
            </span>
          )}
          {isFirst && (
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
              LATEST
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">{formatTimestamp(timestamp)}</span>
      </div>

      <div className="text-xs text-slate-600 mb-2">
        <span className="font-medium">User ID:</span> {audit.userId}
      </div>

      <ChangesSummary changes={audit.changes} operation={audit.operation} />

      {isResolutionEntry && audit.metadata && hasEffectExecutionMetadata(audit.metadata) && (
        <ResolutionEffectsSummary metadata={audit.metadata} />
      )}
    </Card>
  );
}

interface ChangesSummaryProps {
  changes: Record<string, unknown>;
  operation: string;
}

/**
 * ChangesSummary - Displays a summary of changes in an audit entry
 *
 * @param props - Component props
 * @param props.changes - Changes object from audit entry
 * @param props.operation - Operation type (CREATE, UPDATE, etc.)
 */
function ChangesSummary({ changes, operation }: ChangesSummaryProps) {
  const changeKeys = Object.keys(changes);

  if (changeKeys.length === 0) {
    return <p className="text-xs text-slate-400 italic">No detailed changes recorded</p>;
  }

  // For UPDATE operations, try to show before/after
  if (operation === 'UPDATE') {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600">Changes:</p>
        <div className="pl-3 space-y-1 max-h-40 overflow-y-auto">
          {changeKeys.slice(0, 10).map((key) => {
            const value = changes[key];
            const fieldName = toTitleCase(key);

            // Handle before/after structure
            if (
              typeof value === 'object' &&
              value !== null &&
              'before' in value &&
              'after' in value
            ) {
              const { before, after } = value as { before: unknown; after: unknown };
              return (
                <div key={key} className="text-xs">
                  <span className="font-medium text-slate-600">{fieldName}:</span>{' '}
                  <span className="text-red-600 line-through">{formatValue(before)}</span> →{' '}
                  <span className="text-green-600">{formatValue(after)}</span>
                </div>
              );
            }

            // Fallback for simple values
            return (
              <div key={key} className="text-xs">
                <span className="font-medium text-slate-600">{fieldName}:</span>{' '}
                {formatValue(value)}
              </div>
            );
          })}
          {changeKeys.length > 10 && (
            <p className="text-xs text-slate-400 italic">
              ...and {changeKeys.length - 10} more fields
            </p>
          )}
        </div>
      </div>
    );
  }

  // For CREATE/DELETE/ARCHIVE/RESTORE, just show the fields
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-600">
        {operation === 'CREATE' ? 'Initial values:' : 'Fields:'}
      </p>
      <div className="pl-3 space-y-1 max-h-40 overflow-y-auto">
        {changeKeys.slice(0, 10).map((key) => (
          <div key={key} className="text-xs">
            <span className="font-medium text-slate-600">{toTitleCase(key)}:</span>{' '}
            {formatValue(changes[key])}
          </div>
        ))}
        {changeKeys.length > 10 && (
          <p className="text-xs text-slate-400 italic">
            ...and {changeKeys.length - 10} more fields
          </p>
        )}
      </div>
    </div>
  );
}

// Helper functions

/**
 * Get color classes for operation badge
 */
function getOperationColor(operation: string): string {
  switch (operation) {
    case 'CREATE':
      return 'bg-green-100 text-green-700';
    case 'UPDATE':
      return 'bg-blue-100 text-blue-700';
    case 'DELETE':
      return 'bg-red-100 text-red-700';
    case 'ARCHIVE':
      return 'bg-yellow-100 text-yellow-700';
    case 'RESTORE':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

/**
 * Format a value for display (handle null, undefined, objects, etc.)
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Convert snake_case or camelCase to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1') // Split camelCase
    .replace(/_/g, ' ') // Split snake_case
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

/**
 * Check if an audit entry represents a resolution operation
 * (Event completion or Encounter resolution)
 */
function isResolutionOperation(audit: AuditEntry): boolean {
  if (audit.operation !== 'UPDATE') {
    return false;
  }

  const changes = audit.changes;

  // Check for Event completion (isCompleted: true)
  if ('isCompleted' in changes) {
    const value = changes.isCompleted;
    // Handle both direct value and before/after structure
    if (typeof value === 'boolean' && value === true) {
      return true;
    }
    if (typeof value === 'object' && value !== null && 'after' in value && value.after === true) {
      return true;
    }
  }

  // Check for Encounter resolution (isResolved: true)
  if ('isResolved' in changes) {
    const value = changes.isResolved;
    // Handle both direct value and before/after structure
    if (typeof value === 'boolean' && value === true) {
      return true;
    }
    if (typeof value === 'object' && value !== null && 'after' in value && value.after === true) {
      return true;
    }
  }

  return false;
}

/**
 * Get human-readable label for resolution type
 */
function getResolutionLabel(audit: AuditEntry): string {
  if ('isCompleted' in audit.changes) {
    return 'EVENT COMPLETED';
  }
  if ('isResolved' in audit.changes) {
    return 'ENCOUNTER RESOLVED';
  }
  return 'RESOLVED';
}

/**
 * Check if metadata contains effect execution information
 */
function hasEffectExecutionMetadata(metadata: Record<string, unknown>): boolean {
  return (
    'effectExecutionSummary' in metadata ||
    'effectsExecuted' in metadata ||
    'totalEffects' in metadata
  );
}

/**
 * ResolutionEffectsSummary component - displays effect execution summary
 */
interface ResolutionEffectsSummaryProps {
  metadata: Record<string, unknown>;
}

function ResolutionEffectsSummary({ metadata }: ResolutionEffectsSummaryProps) {
  // Extract effect execution data from metadata
  const effectsExecuted = metadata.effectsExecuted as number | undefined;
  const totalEffects = metadata.totalEffects as number | undefined;
  const effectExecutionSummary = metadata.effectExecutionSummary as
    | {
        pre?: { total: number; succeeded: number; failed: number };
        onResolve?: { total: number; succeeded: number; failed: number };
        post?: { total: number; succeeded: number; failed: number };
      }
    | undefined;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-green-800">Effect Execution Summary</p>
        {effectsExecuted !== undefined && totalEffects !== undefined && (
          <span className="text-xs text-slate-600">
            {effectsExecuted} of {totalEffects} effects executed
          </span>
        )}
      </div>

      {effectExecutionSummary && (
        <div className="space-y-1.5">
          {effectExecutionSummary.pre && effectExecutionSummary.pre.total > 0 && (
            <EffectPhaseSummary
              phase="PRE"
              label="Pre-Resolution"
              summary={effectExecutionSummary.pre}
              color="bg-blue-100 text-blue-800"
            />
          )}
          {effectExecutionSummary.onResolve && effectExecutionSummary.onResolve.total > 0 && (
            <EffectPhaseSummary
              phase="ON_RESOLVE"
              label="On Resolution"
              summary={effectExecutionSummary.onResolve}
              color="bg-green-100 text-green-800"
            />
          )}
          {effectExecutionSummary.post && effectExecutionSummary.post.total > 0 && (
            <EffectPhaseSummary
              phase="POST"
              label="Post-Resolution"
              summary={effectExecutionSummary.post}
              color="bg-purple-100 text-purple-800"
            />
          )}
        </div>
      )}

      {!effectExecutionSummary && effectsExecuted !== undefined && (
        <p className="text-xs text-slate-500 italic">
          {effectsExecuted === 0
            ? 'No effects were executed during resolution.'
            : 'Effect execution details not available.'}
        </p>
      )}
    </div>
  );
}

/**
 * EffectPhaseSummary component - displays summary for a single timing phase
 */
interface EffectPhaseSummaryProps {
  phase: string;
  label: string;
  summary: { total: number; succeeded: number; failed: number };
  color: string;
}

function EffectPhaseSummary({ label, summary, color }: EffectPhaseSummaryProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded font-medium ${color}`}>{label}</span>
        <span className="text-slate-600">
          {summary.total} effect{summary.total !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {summary.succeeded > 0 && <span className="text-green-700">✓ {summary.succeeded}</span>}
        {summary.failed > 0 && <span className="text-red-700">✗ {summary.failed}</span>}
      </div>
    </div>
  );
}
