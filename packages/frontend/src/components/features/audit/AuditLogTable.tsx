/**
 * Audit Log Table Component
 * Displays a table of audit log entries with expandable detail views
 */

import { Clock, User, FileText, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { memo, useState, useCallback } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AuditEntry } from '@/services/api/hooks/audit';

import { AuditDiffViewer } from './AuditDiffViewer';

interface AuditLogTableProps {
  audits: AuditEntry[];
  loading?: boolean;
  error?: Error | null;
}

/**
 * Main table component for displaying audit logs
 */
export function AuditLogTable({ audits, loading, error }: AuditLogTableProps) {
  // Loading state
  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-3 px-4 rounded-md bg-red-50 border border-red-200">
            <p className="text-xs font-semibold text-red-800">Failed to load audit logs</p>
            <p className="text-xs text-red-600 mt-1">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (audits.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-700">No audit logs found</p>
            <p className="text-xs text-slate-500 mt-1">
              Audit entries will appear here as you make changes
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Main content
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
        <p className="text-sm text-muted-foreground">
          Showing {audits.length} {audits.length === 1 ? 'entry' : 'entries'}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {audits.map((audit) => (
            <AuditLogRow key={audit.id} audit={audit} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Individual row component for an audit log entry
 * Memoized to prevent unnecessary re-renders
 * Supports expanding to show diff viewer
 */
const AuditLogRow = memo(({ audit }: { audit: AuditEntry }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const timestamp = new Date(audit.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Determine operation color
  const operationColor = getOperationColor(audit.operation);

  // Check if audit has diff data to show
  const hasDiffData =
    (audit.previousState !== null && audit.previousState !== undefined) ||
    (audit.newState !== null && audit.newState !== undefined) ||
    (audit.diff !== null && audit.diff !== undefined);

  // Toggle expansion
  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Get entity navigation link (we'll create a helper function for this)
  const entityLink = getEntityLink(audit.entityType, audit.entityId);

  return (
    <div className="border rounded-md">
      {/* Main row - always visible */}
      <div className="p-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-start justify-between gap-4">
          {/* Left side: Operation and Entity Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${operationColor}`}
                title={getOperationTooltip(audit.operation)}
              >
                {audit.operation}
              </span>
              <span className="text-sm font-semibold text-slate-900">{audit.entityType}</span>
              {/* Expand/Collapse button - only show if diff data is available */}
              {hasDiffData && (
                <button
                  onClick={toggleExpand}
                  className="ml-2 p-1 hover:bg-slate-200 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Hide details' : 'Show details'}
                  data-testid="audit-row-expand-button"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-600" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-600 truncate" title={audit.entityId}>
                Entity ID: {audit.entityId}
              </p>
              {/* Entity navigation link */}
              {entityLink && (
                <a
                  href={entityLink}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  title="View entity details"
                  data-testid="audit-entity-link"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>View</span>
                </a>
              )}
            </div>
            {audit.reason && (
              <p className="text-xs text-slate-700 mt-1 italic">Reason: {audit.reason}</p>
            )}
          </div>

          {/* Right side: Metadata */}
          <div className="flex flex-col items-end gap-1 text-right shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Clock className="h-3 w-3" />
              <span>{timestamp}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[120px]" title={audit.userId}>
                {audit.userId}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded section - diff viewer */}
      {isExpanded && hasDiffData && (
        <div className="px-4 pb-4 border-t bg-slate-50/50" data-testid="audit-row-expanded-content">
          <div className="pt-3">
            <AuditDiffViewer
              previousState={audit.previousState}
              newState={audit.newState}
              diff={audit.diff}
              operation={audit.operation}
            />
          </div>
        </div>
      )}
    </div>
  );
});

AuditLogRow.displayName = 'AuditLogRow';

/**
 * Helper function to generate entity detail page links
 * Returns null if entity type doesn't have a detail page route
 */
function getEntityLink(entityType: string, entityId: string): string | null {
  // Map entity types to their detail page routes
  // These routes should match the actual routes defined in the app
  const routeMap: Record<string, string> = {
    Settlement: `/settlements/${entityId}`,
    Structure: `/structures/${entityId}`,
    Character: `/characters/${entityId}`,
    Event: `/events/${entityId}`,
    Encounter: `/encounters/${entityId}`,
    // Add more entity types as routes become available
  };

  return routeMap[entityType] || null;
}

/**
 * Helper function to determine operation badge color
 */
function getOperationColor(operation: AuditEntry['operation']): string {
  switch (operation) {
    case 'CREATE':
      return 'bg-green-100 text-green-800';
    case 'UPDATE':
      return 'bg-blue-100 text-blue-800';
    case 'DELETE':
      return 'bg-red-100 text-red-800';
    case 'ARCHIVE':
      return 'bg-orange-100 text-orange-800';
    case 'RESTORE':
      return 'bg-purple-100 text-purple-800';
    case 'FORK':
      return 'bg-cyan-100 text-cyan-800';
    case 'MERGE':
      return 'bg-indigo-100 text-indigo-800';
    case 'CHERRY_PICK':
      return 'bg-pink-100 text-pink-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Helper function to get tooltip text for operation types
 */
function getOperationTooltip(operation: AuditEntry['operation']): string {
  switch (operation) {
    case 'CREATE':
      return 'New entity was created';
    case 'UPDATE':
      return 'Entity was modified with state changes';
    case 'DELETE':
      return 'Entity was permanently deleted';
    case 'ARCHIVE':
      return 'Entity was archived but can be restored';
    case 'RESTORE':
      return 'Archived entity was restored to active state';
    case 'FORK':
      return 'New branch was created from this entity';
    case 'MERGE':
      return 'Changes from another branch were merged';
    case 'CHERRY_PICK':
      return 'Specific changes were applied from another branch';
    default:
      return 'Entity operation';
  }
}
