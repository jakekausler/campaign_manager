/**
 * Audit Log Table Component
 * Displays a table of audit log entries with basic information
 */

import { Clock, User, FileText } from 'lucide-react';
import { memo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AuditEntry } from '@/services/api/hooks/audit';

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
 */
const AuditLogRow = memo(({ audit }: { audit: AuditEntry }) => {
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

  return (
    <div className="p-4 border rounded-md hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* Left side: Operation and Entity Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${operationColor}`}
            >
              {audit.operation}
            </span>
            <span className="text-sm font-semibold text-slate-900">{audit.entityType}</span>
          </div>
          <p className="text-xs text-slate-600 truncate" title={audit.entityId}>
            Entity ID: {audit.entityId}
          </p>
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
  );
});

AuditLogRow.displayName = 'AuditLogRow';

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
