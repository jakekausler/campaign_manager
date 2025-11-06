import type { AuditEntry } from '../services/api/hooks/audit';

/**
 * Converts audit log entries to CSV format and triggers browser download.
 *
 * CSV includes: Timestamp, User ID, Entity Type, Entity ID, Operation, Reason
 * Complex JSON fields (previousState, newState, diff) are stringified for CSV compatibility.
 *
 * @param entries - Array of audit log entries to export
 * @param filename - Optional custom filename (default: timestamp-based)
 */
export function exportToCSV(entries: AuditEntry[], filename?: string): void {
  if (entries.length === 0) {
    console.warn('No audit entries to export');
    return;
  }

  // CSV headers
  const headers = [
    'Timestamp',
    'User ID',
    'Entity Type',
    'Entity ID',
    'Operation',
    'Reason',
    'Previous State',
    'New State',
    'Diff',
  ];

  // Convert entries to CSV rows
  const rows = entries.map((entry) => {
    return [
      // Timestamp - ISO format for spreadsheet compatibility
      new Date(entry.timestamp).toISOString(),
      // User ID
      entry.userId || '',
      // Entity Type
      entry.entityType || '',
      // Entity ID
      entry.entityId || '',
      // Operation
      entry.operation || '',
      // Reason - escape quotes and wrap in quotes if contains comma
      escapeCSVField(entry.reason || ''),
      // Previous State - stringify JSON for CSV
      escapeCSVField(entry.previousState ? JSON.stringify(entry.previousState) : ''),
      // New State - stringify JSON for CSV
      escapeCSVField(entry.newState ? JSON.stringify(entry.newState) : ''),
      // Diff - stringify JSON for CSV
      escapeCSVField(entry.diff ? JSON.stringify(entry.diff) : ''),
    ];
  });

  // Combine headers and rows into CSV string
  const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

  // Generate filename with timestamp if not provided
  const finalFilename = filename || `audit-log-${new Date().toISOString().split('T')[0]}.csv`;

  // Trigger browser download
  downloadFile(csvContent, finalFilename, 'text/csv;charset=utf-8;');
}

/**
 * Escapes a CSV field value by wrapping in quotes if it contains special characters.
 * Doubles internal quotes to escape them per CSV standard (RFC 4180).
 *
 * @param value - The field value to escape
 * @returns Escaped CSV field value
 */
function escapeCSVField(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts audit log entries to JSON format and triggers browser download.
 *
 * JSON includes all fields with full fidelity (no stringification needed).
 * Output is pretty-printed with 2-space indentation for readability.
 *
 * @param entries - Array of audit log entries to export
 * @param filename - Optional custom filename (default: timestamp-based)
 */
export function exportToJSON(entries: AuditEntry[], filename?: string): void {
  if (entries.length === 0) {
    console.warn('No audit entries to export');
    return;
  }

  // Convert to JSON with pretty-printing (2-space indentation)
  const jsonContent = JSON.stringify(entries, null, 2);

  // Generate filename with timestamp if not provided
  const finalFilename = filename || `audit-log-${new Date().toISOString().split('T')[0]}.json`;

  // Trigger browser download
  downloadFile(jsonContent, finalFilename, 'application/json;charset=utf-8;');
}

/**
 * Creates a Blob and triggers browser download using URL.createObjectURL.
 *
 * @param content - The file content
 * @param filename - The filename for download
 * @param mimeType - The MIME type of the file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  // Create Blob with UTF-8 BOM for Excel compatibility (CSV only)
  const bom = mimeType.startsWith('text/csv') ? '\uFEFF' : ''; // UTF-8 BOM
  const blob = new Blob([bom + content], { type: mimeType });

  // Create temporary download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
