/**
 * GraphQL Hooks
 *
 * This module exports custom GraphQL hooks for querying and mutating data.
 * All hooks are built on top of Apollo Client and follow consistent patterns:
 *
 * - Query hooks use cache-and-network or cache-first fetch policies
 * - Mutation hooks include optimistic updates where appropriate
 * - All hooks return simplified data shapes with loading/error states
 * - Type safety is provided through TypeScript (generated types when available)
 *
 * @module services/api/hooks
 */

// Settlement hooks
export {
  useSettlementsByKingdom,
  useSettlementDetails,
  useStructuresBySettlement,
  GET_SETTLEMENTS_BY_KINGDOM,
  GET_SETTLEMENT_DETAILS,
  GET_SETTLEMENT_STRUCTURES,
} from './settlements';

// Structure hooks will be added in Stage 7
// export { ... } from './structures';

// Mutation hooks will be added in Stage 8
// export { ... } from './mutations';
