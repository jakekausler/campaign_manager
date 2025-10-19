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

// Location hooks
export {
  useLocationsByWorld,
  useLocationDetails,
  GET_LOCATIONS_BY_WORLD,
  GET_LOCATION_DETAILS,
} from './locations';

// Settlement hooks
export {
  useSettlementsByKingdom,
  useSettlementDetails,
  useSettlementsForMap,
  useStructuresBySettlement,
  GET_SETTLEMENTS_BY_KINGDOM,
  GET_SETTLEMENT_DETAILS,
  GET_SETTLEMENTS_FOR_MAP,
  GET_SETTLEMENT_STRUCTURES,
} from './settlements';

// Structure hooks
export {
  useStructureDetails,
  useStructureConditions,
  useStructuresForMap,
  GET_STRUCTURE_DETAILS,
  GET_STRUCTURE_CONDITIONS,
  GET_STRUCTURES_FOR_MAP,
} from './structures';

// Mutation hooks (Stage 8)
export * from '../mutations';
