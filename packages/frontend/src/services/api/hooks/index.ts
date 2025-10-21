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

// World Time hooks
export { useCurrentWorldTime, GET_CURRENT_WORLD_TIME } from './world-time';

// Event hooks
export {
  useEventsByCampaign,
  useEventDetails,
  GET_EVENTS_BY_CAMPAIGN,
  GET_EVENT_BY_ID,
} from './events';

// Encounter hooks
export {
  useEncountersByCampaign,
  useEncounterDetails,
  GET_ENCOUNTERS_BY_CAMPAIGN,
  GET_ENCOUNTER_BY_ID,
} from './encounters';

// Dependency Graph hooks
export {
  useDependencyGraph,
  GET_DEPENDENCY_GRAPH,
  type DependencyNode,
  type DependencyEdge,
  type DependencyNodeType,
  type DependencyEdgeType,
  type DependencyGraphStats,
  type DependencyGraphResult,
} from './dependency-graph';

// Condition hooks
export {
  useConditionsForEntity,
  useEvaluateCondition,
  GET_CONDITIONS_FOR_ENTITY,
  EVALUATE_FIELD_CONDITION,
} from './conditions';

// Effect hooks
export {
  useEffectsForEntity,
  useAllEffectsForEntity,
  GET_EFFECTS_FOR_ENTITY,
  GET_ALL_EFFECTS_FOR_ENTITY,
  EffectTiming,
} from './effects';

// Audit hooks
export { useEntityAuditHistory, type AuditEntry } from './audit';

// Mutation hooks (Stage 8)
export * from '../mutations';
