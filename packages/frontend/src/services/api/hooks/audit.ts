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

// GraphQL query for user audit history
const GET_USER_AUDIT_HISTORY = gql`
  query GetUserAuditHistory($limit: Int) {
    userAuditHistory(limit: $limit) {
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
  limit?: number;
}

/**
 * Hook to fetch audit history for the currently authenticated user
 *
 * @param limit - Maximum number of audit entries to fetch (default: 50, max: 100)
 * @returns Object with audit entries, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { audits, loading, error, refetch } = useUserAuditHistory(100);
 *
 * if (loading) return <div>Loading audit history...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return (
 *   <div>
 *     <h2>My Recent Actions</h2>
 *     <ul>
 *       {audits.map(audit => (
 *         <li key={audit.id}>
 *           {audit.operation} on {audit.entityType} at {new Date(audit.timestamp).toLocaleString()}
 *         </li>
 *       ))}
 *     </ul>
 *   </div>
 * );
 * ```
 */
export function useUserAuditHistory(limit: number = 50) {
  const { data, loading, error, refetch } = useQuery<
    UserAuditHistoryData,
    UserAuditHistoryVariables
  >(GET_USER_AUDIT_HISTORY, {
    variables: { limit },
    fetchPolicy: 'cache-and-network', // Always fetch fresh data for audit logs
    notifyOnNetworkStatusChange: true, // Show loading state during refetches
  });

  return {
    audits: data?.userAuditHistory || [],
    loading,
    error,
    refetch,
  };
}
