/**
 * Audit GraphQL Hooks
 * Hooks for fetching audit history for entities
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// GraphQL query for entity audit history
const GET_ENTITY_AUDIT_HISTORY = gql`
  query GetEntityAuditHistory($entityType: String!, $entityId: ID!, $limit: Int) {
    entityAuditHistory(entityType: $entityType, entityId: $entityId, limit: $limit) {
      id
      entityType
      entityId
      operation
      userId
      changes
      metadata
      timestamp
    }
  }
`;

// TypeScript interfaces
// TODO: Replace with generated types from GraphQL Code Generator after running codegen

/**
 * Audit entry representing a single change to an entity
 */
export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  operation:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'ARCHIVE'
    | 'RESTORE'
    | 'FORK'
    | 'MERGE'
    | 'CHERRY_PICK';
  userId: string;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: string; // ISO 8601 date string
  // Enhanced audit fields (added in Stage 1C)
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  diff?: Record<string, unknown> | null;
  reason?: string | null;
}

interface EntityAuditHistoryData {
  entityAuditHistory: AuditEntry[];
}

interface EntityAuditHistoryVariables {
  entityType: string;
  entityId: string;
  limit?: number;
}

/**
 * Hook to fetch audit history for a specific entity
 *
 * @param entityType - Type of entity (e.g., "Settlement", "Structure")
 * @param entityId - ID of the entity
 * @param limit - Maximum number of audit entries to fetch (default: 50, max: 100)
 * @returns Object with audit entries, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { audits, loading, error, refetch } = useEntityAuditHistory('Settlement', 'settlement-1', 20);
 *
 * if (loading) return <div>Loading audit history...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return (
 *   <ul>
 *     {audits.map(audit => (
 *       <li key={audit.id}>
 *         {audit.operation} at {new Date(audit.timestamp).toLocaleString()}
 *       </li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useEntityAuditHistory(entityType: string, entityId: string, limit: number = 50) {
  const { data, loading, error, refetch } = useQuery<
    EntityAuditHistoryData,
    EntityAuditHistoryVariables
  >(GET_ENTITY_AUDIT_HISTORY, {
    variables: {
      entityType,
      entityId,
      limit,
    },
    fetchPolicy: 'cache-first', // Use cache first, then fetch from network if needed
    notifyOnNetworkStatusChange: true, // Show loading state during refetches
    skip: !entityType || !entityId, // Don't run query if required params are missing
  });

  return {
    audits: data?.entityAuditHistory || [],
    loading,
    error,
    refetch,
  };
}

// GraphQL query for user audit history (with advanced filtering)
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

interface UserAuditHistoryData {
  userAuditHistory: AuditEntry[];
}

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
 * Options for filtering and sorting user audit history
 */
export interface UseUserAuditHistoryOptions {
  /**
   * User ID to fetch audit history for (required for authorization)
   */
  userId: string;

  /**
   * Maximum number of audit entries to fetch (default: 50, max: 100)
   */
  limit?: number;

  /**
   * Number of audit entries to skip (for pagination, default: 0)
   */
  skip?: number;

  /**
   * Filter by operation types (e.g., ['CREATE', 'UPDATE', 'DELETE'])
   * Omit or pass empty array to show all operations
   */
  operations?: AuditEntry['operation'][];

  /**
   * Filter by start date (ISO 8601 date string, YYYY-MM-DD)
   * Only entries on or after this date will be included
   */
  startDate?: string;

  /**
   * Filter by end date (ISO 8601 date string, YYYY-MM-DD)
   * Only entries on or before this date will be included
   */
  endDate?: string;

  /**
   * Field to sort by (default: 'timestamp')
   */
  sortBy?: 'timestamp' | 'operation' | 'entityType';

  /**
   * Sort order (default: 'desc')
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Hook to fetch audit history for the currently authenticated user with advanced filtering
 *
 * @param options - Filtering and sorting options (including required userId)
 * @returns Object with audit entries, loading state, error, refetch, and fetchMore functions
 *
 * @example
 * ```tsx
 * // Basic usage
 * const user = useCurrentUser();
 * const { audits, loading, error } = useUserAuditHistory({ userId: user?.id || '' });
 *
 * // With filters
 * const { audits, loading, error, fetchMore } = useUserAuditHistory({
 *   userId: user?.id || '',
 *   operations: ['CREATE', 'UPDATE'],
 *   startDate: '2025-01-01',
 *   sortBy: 'timestamp',
 *   sortOrder: 'desc',
 *   limit: 50
 * });
 *
 * // Load more results
 * const handleLoadMore = () => {
 *   fetchMore({
 *     variables: {
 *       limit: 50 // Load next 50 entries
 *     }
 *   });
 * };
 * ```
 */
export function useUserAuditHistory(options: UseUserAuditHistoryOptions) {
  const {
    userId,
    limit = 50,
    skip = 0,
    operations,
    startDate,
    endDate,
    sortBy = 'timestamp',
    sortOrder = 'desc',
  } = options;

  // Convert date strings to Date objects if provided
  // Note: Using UTC (Z suffix) for consistency in audit logs across all timezones
  // User selects local date, we convert to UTC midnight/end-of-day
  // CRITICAL: End date must use .999Z (end of day) not .000Z (start of day)
  const startDateObj = startDate ? new Date(startDate + 'T00:00:00.000Z') : undefined;
  const endDateObj = endDate ? new Date(endDate + 'T23:59:59.999Z') : undefined;

  const { data, loading, error, refetch, fetchMore } = useQuery<
    UserAuditHistoryData,
    UserAuditHistoryVariables
  >(GET_USER_AUDIT_HISTORY, {
    variables: {
      userId,
      limit,
      skip,
      operations: operations && operations.length > 0 ? operations : undefined,
      startDate: startDateObj,
      endDate: endDateObj,
      sortBy,
      sortOrder,
    },
    fetchPolicy: 'cache-and-network', // Always fetch fresh data for audit logs
    notifyOnNetworkStatusChange: true, // Show loading state during refetches
    skip: !userId, // Don't run query if userId is missing
  });

  return {
    audits: data?.userAuditHistory || [],
    loading,
    error,
    refetch,
    fetchMore,
  };
}
