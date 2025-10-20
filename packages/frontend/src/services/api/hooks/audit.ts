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
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE';
  userId: string;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: string; // ISO 8601 date string
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
