/**
 * VersionsTab Component
 * Displays audit history for an entity with timeline view
 */

import { Button } from '@/components/ui';
import { Card } from '@/components/ui/card';
import { useEntityAuditHistory, type AuditEntry } from '@/services/api/hooks';

export interface VersionsTabProps {
  entityType: string;
  entityId: string;
}

/**
 * VersionsTab - Displays audit history timeline for an entity
 *
 * Shows a chronological list of changes made to the entity including:
 * - Operation type (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE)
 * - Timestamp of change
 * - User who made the change
 * - Summary of what changed
 *
 * @param props - Component props
 * @param props.entityType - Type of entity (e.g., "settlement", "structure")
 * @param props.entityId - ID of the entity
 */
export function VersionsTab({ entityType, entityId }: VersionsTabProps) {
  // Capitalize entity type for GraphQL query (Settlement, Structure)
  const capitalizedEntityType =
    entityType.charAt(0).toUpperCase() + entityType.slice(1).toLowerCase();

  const { audits, loading, error, refetch } = useEntityAuditHistory(
    capitalizedEntityType,
    entityId,
    50 // Fetch up to 50 audit entries
  );

  // Backend returns audits sorted by timestamp DESC (newest first)
  // No additional sorting needed in frontend

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-500">Loading audit history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-700 mb-2">Failed to load audit history</p>
          <p className="text-xs text-red-600 mb-3">{error.message}</p>
          <Button onClick={() => refetch()} size="sm" variant="outline">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <div className="p-4">
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">
            No audit history available for this {entityType}.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Changes will appear here once this entity is modified.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
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
  const operationColor = getOperationColor(audit.operation);
  const timestamp = new Date(audit.timestamp);

  return (
    <Card className={`p-4 ${isFirst ? 'border-blue-200 bg-blue-50' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${operationColor}`}>
            {audit.operation}
          </span>
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
