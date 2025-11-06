/**
 * Audit Log Page
 * Displays all audit log entries for the current user's campaign
 */

import { ScrollText } from 'lucide-react';

import { AuditLogTable } from '@/components/features/audit/AuditLogTable';
import { useUserAuditHistory } from '@/services/api/hooks/audit';

/**
 * Main audit log page component
 * Displays a table of all audit log entries for the authenticated user
 */
export default function AuditLogPage() {
  // Fetch audit logs for the current user (limit 100 entries)
  const { audits, loading, error } = useUserAuditHistory(100);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Page Header */}
      <header className="bg-white border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            <ScrollText className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">
              Track all changes made to your campaign entities
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <AuditLogTable audits={audits} loading={loading} error={error || null} />
        </div>
      </main>
    </div>
  );
}
