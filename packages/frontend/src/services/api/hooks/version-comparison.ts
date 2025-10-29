import { gql } from '@apollo/client';
import { useQuery, type QueryHookOptions } from '@apollo/client/react';

/**
 * Entity types that support versioning and branch comparison
 */
export type VersionableEntityType =
  | 'campaign'
  | 'world'
  | 'location'
  | 'character'
  | 'party'
  | 'kingdom'
  | 'settlement'
  | 'structure'
  | 'encounter'
  | 'event';

/**
 * Generic entity version data structure
 */
export type EntityVersion = {
  id: string;
  name?: string;
  [key: string]: unknown;
};

// Settlement types
type SettlementVersion = {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
  z: number;
  campaignId: string;
  kingdomId: string;
  locationId: string;
  ownerId: string;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  computedFields?: Record<string, unknown>;
};

// Structure types
type StructureVersion = {
  id: string;
  name: string;
  typeId: string;
  settlementId: string;
  x: number;
  y: number;
  orientation: number;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type GetSettlementAsOfQuery = {
  settlementAsOf: SettlementVersion | null;
};

type GetSettlementAsOfQueryVariables = {
  id: string;
  branchId: string;
  asOf: string;
};

type GetStructureAsOfQuery = {
  structureAsOf: StructureVersion | null;
};

type GetStructureAsOfQueryVariables = {
  id: string;
  branchId: string;
  asOf: string;
};

/**
 * GraphQL query to get settlement state at a specific time in a specific branch.
 *
 * Uses the version resolution algorithm to walk branch ancestry and find the
 * correct version of the settlement at the specified world time.
 *
 * @example
 * Query:
 * ```graphql
 * query GetSettlementAsOf($id: ID!, $branchId: ID!, $asOf: Date!) {
 *   settlementAsOf(id: $id, branchId: $branchId, asOf: $asOf) {
 *     id
 *     name
 *     level
 *     x
 *     y
 *     z
 *     campaignId
 *     kingdomId
 *     locationId
 *     ownerId
 *     isArchived
 *     archivedAt
 *     createdAt
 *     updatedAt
 *     computedFields
 *   }
 * }
 * ```
 */
export const GET_SETTLEMENT_AS_OF = gql`
  query GetSettlementAsOf($id: ID!, $branchId: ID!, $asOf: Date!) {
    settlementAsOf(id: $id, branchId: $branchId, asOf: $asOf) {
      id
      name
      level
      x
      y
      z
      campaignId
      kingdomId
      locationId
      ownerId
      isArchived
      archivedAt
      createdAt
      updatedAt
      computedFields
    }
  }
`;

/**
 * GraphQL query to get structure state at a specific time in a specific branch.
 *
 * Uses the version resolution algorithm to walk branch ancestry and find the
 * correct version of the structure at the specified world time.
 *
 * @example
 * Query:
 * ```graphql
 * query GetStructureAsOf($id: ID!, $branchId: ID!, $asOf: Date!) {
 *   structureAsOf(id: $id, branchId: $branchId, asOf: $asOf) {
 *     id
 *     name
 *     typeId
 *     settlementId
 *     x
 *     y
 *     orientation
 *     isArchived
 *     archivedAt
 *     createdAt
 *     updatedAt
 *   }
 * }
 * ```
 */
export const GET_STRUCTURE_AS_OF = gql`
  query GetStructureAsOf($id: ID!, $branchId: ID!, $asOf: Date!) {
    structureAsOf(id: $id, branchId: $branchId, asOf: $asOf) {
      id
      name
      typeId
      settlementId
      x
      y
      orientation
      isArchived
      archivedAt
      createdAt
      updatedAt
    }
  }
`;

/**
 * React hook to fetch settlement state at a specific world time in a specific branch.
 *
 * This enables time-travel queries across branches for comparing settlement state
 * between different timelines.
 *
 * @param variables - Query variables (id, branchId, asOf)
 * @param options - Additional Apollo query options
 * @returns Query result with settlement data, loading state, and error
 *
 * @example
 * ```typescript
 * function SettlementComparison() {
 *   const { data: branch1Data, loading: loading1 } = useGetSettlementAsOf({
 *     variables: {
 *       id: 'settlement-123',
 *       branchId: 'branch-main',
 *       asOf: '2024-01-15T00:00:00Z'
 *     }
 *   });
 *
 *   const { data: branch2Data, loading: loading2 } = useGetSettlementAsOf({
 *     variables: {
 *       id: 'settlement-123',
 *       branchId: 'branch-alternate',
 *       asOf: '2024-01-15T00:00:00Z'
 *     }
 *   });
 *
 *   if (loading1 || loading2) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h3>Main Branch:</h3>
 *       <pre>{JSON.stringify(branch1Data?.settlementAsOf, null, 2)}</pre>
 *       <h3>Alternate Branch:</h3>
 *       <pre>{JSON.stringify(branch2Data?.settlementAsOf, null, 2)}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export function useGetSettlementAsOf(
  options: QueryHookOptions<GetSettlementAsOfQuery, GetSettlementAsOfQueryVariables>
) {
  return useQuery<GetSettlementAsOfQuery, GetSettlementAsOfQueryVariables>(GET_SETTLEMENT_AS_OF, {
    ...options,
    skip:
      !options?.variables?.id ||
      !options?.variables?.branchId ||
      !options?.variables?.asOf ||
      options?.skip,
  });
}

/**
 * React hook to fetch structure state at a specific world time in a specific branch.
 *
 * This enables time-travel queries across branches for comparing structure state
 * between different timelines.
 *
 * @param variables - Query variables (id, branchId, asOf)
 * @param options - Additional Apollo query options
 * @returns Query result with structure data, loading state, and error
 *
 * @example
 * ```typescript
 * function StructureComparison() {
 *   const { data: branch1Data, loading: loading1 } = useGetStructureAsOf({
 *     variables: {
 *       id: 'structure-456',
 *       branchId: 'branch-main',
 *       asOf: '2024-01-15T00:00:00Z'
 *     }
 *   });
 *
 *   const { data: branch2Data, loading: loading2 } = useGetStructureAsOf({
 *     variables: {
 *       id: 'structure-456',
 *       branchId: 'branch-alternate',
 *       asOf: '2024-01-15T00:00:00Z'
 *     }
 *   });
 *
 *   if (loading1 || loading2) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h3>Main Branch:</h3>
 *       <pre>{JSON.stringify(branch1Data?.structureAsOf, null, 2)}</pre>
 *       <h3>Alternate Branch:</h3>
 *       <pre>{JSON.stringify(branch2Data?.structureAsOf, null, 2)}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export function useGetStructureAsOf(
  options: QueryHookOptions<GetStructureAsOfQuery, GetStructureAsOfQueryVariables>
) {
  return useQuery<GetStructureAsOfQuery, GetStructureAsOfQueryVariables>(GET_STRUCTURE_AS_OF, {
    ...options,
    skip:
      !options?.variables?.id ||
      !options?.variables?.branchId ||
      !options?.variables?.asOf ||
      options?.skip,
  });
}

// Export types for convenience
export type {
  SettlementVersion,
  StructureVersion,
  GetSettlementAsOfQuery,
  GetSettlementAsOfQueryVariables,
  GetStructureAsOfQuery,
  GetStructureAsOfQueryVariables,
};
