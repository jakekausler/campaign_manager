import { type ApolloClient, gql } from '@apollo/client';

import type { AuditEntry, UseUserAuditHistoryOptions } from '../services/api/hooks/audit';

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

// GraphQL query for fetching all audit history with pagination
const GET_USER_AUDIT_HISTORY = gql`
  query GetUserAuditHistory(
    $userId: ID!
    $limit: Int
    $skip: Int
    $operations: [String!]
    $startDate: DateTime
    $endDate: DateTime
    $sortBy: String
    $sortOrder: String
  ) {
    userAuditHistory(
      userId: $userId
      limit: $limit
      skip: $skip
      operations: $operations
      startDate: $startDate
      endDate: $endDate
      sortBy: $sortBy
      sortOrder: $sortOrder
    ) {
      id
      entityType
      entityId
      operation
      userId
      changes
      metadata
      timestamp
      previousState
      newState
      diff
      reason
    }
  }
`;

/**
 * Interface for query result from GraphQL
 */
interface UserAuditHistoryData {
  userAuditHistory: AuditEntry[];
}

/**
 * Interface for GraphQL query variables
 */
interface UserAuditHistoryVariables {
  userId: string;
  limit?: number;
  skip?: number;
  operations?: string[];
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  sortOrder?: string;
}

/**
 * Fetches all audit data from the server with pagination.
 * Makes repeated GraphQL queries until all matching records are fetched.
 *
 * @param client - Apollo Client instance for making GraphQL queries
 * @param options - Filter options matching the current user's filter state
 * @param onProgress - Optional callback for progress updates (current count)
 * @param signal - Optional AbortSignal for cancelling the fetch operation
 * @returns Promise resolving to array of all matching audit entries
 * @throws {Error} If the operation is aborted or if there's a network error
 */
export async function fetchAllAuditData(
  client: ApolloClient,
  options: Omit<UseUserAuditHistoryOptions, 'limit'>,
  onProgress?: (count: number) => void,
  signal?: AbortSignal
): Promise<AuditEntry[]> {
  const BATCH_SIZE = 100; // Fetch 100 records per request (max allowed by API)
  const allEntries: AuditEntry[] = [];
  let hasMore = true;
  let skip = 0;

  // Check if already aborted before starting
  if (signal?.aborted) {
    throw new Error('Export cancelled');
  }

  // Convert date strings to Date objects if provided
  const startDateObj = options.startDate
    ? new Date(options.startDate + 'T00:00:00.000Z')
    : undefined;
  const endDateObj = options.endDate ? new Date(options.endDate + 'T23:59:59.999Z') : undefined;

  while (hasMore) {
    // Check for abort before each batch
    if (signal?.aborted) {
      throw new Error('Export cancelled');
    }

    try {
      const { data } = await client.query<UserAuditHistoryData, UserAuditHistoryVariables>({
        query: GET_USER_AUDIT_HISTORY,
        variables: {
          userId: options.userId,
          limit: BATCH_SIZE,
          skip,
          operations:
            options.operations && options.operations.length > 0 ? options.operations : undefined,
          startDate: startDateObj,
          endDate: endDateObj,
          sortBy: options.sortBy || 'timestamp',
          sortOrder: options.sortOrder || 'desc',
        },
        fetchPolicy: 'network-only', // Always fetch fresh data for export
        context: {
          fetchOptions: {
            signal, // Pass abort signal to fetch
          },
        },
      });

      const batch = data?.userAuditHistory || [];
      allEntries.push(...batch);

      // Call progress callback if provided
      if (onProgress) {
        onProgress(allEntries.length);
      }

      // Check if we should continue fetching
      if (batch.length < BATCH_SIZE) {
        // Received fewer results than requested, we've fetched all available data
        hasMore = false;
      } else {
        // Move to next batch
        skip += BATCH_SIZE;
      }
    } catch (error) {
      // Check if error is due to abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Export cancelled');
      }
      console.error('Error fetching audit data batch:', error);
      throw new Error(
        `Failed to fetch audit data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return allEntries;
}
