/**
 * GraphQL Mutations for Campaign Management
 *
 * This module exports all mutation hooks and GraphQL mutation documents.
 * Mutations are organized by domain entity (settlements, structures).
 *
 * @example
 * ```tsx
 * import { useCreateSettlement, useUpdateStructure } from '@/services/api/mutations';
 *
 * function MyComponent() {
 *   const { createSettlement, loading } = useCreateSettlement();
 *   const { updateStructure } = useUpdateStructure();
 *
 *   // Use the mutation hooks...
 * }
 * ```
 */

// Settlement mutations
export {
  CREATE_SETTLEMENT,
  UPDATE_SETTLEMENT,
  DELETE_SETTLEMENT,
  ARCHIVE_SETTLEMENT,
  RESTORE_SETTLEMENT,
  useCreateSettlement,
  useUpdateSettlement,
  useDeleteSettlement,
  useArchiveSettlement,
  useRestoreSettlement,
} from './settlements';

export type { CreateSettlementInput, UpdateSettlementInput, Settlement } from './settlements';

// Structure mutations
export {
  CREATE_STRUCTURE,
  UPDATE_STRUCTURE,
  DELETE_STRUCTURE,
  ARCHIVE_STRUCTURE,
  RESTORE_STRUCTURE,
  useCreateStructure,
  useUpdateStructure,
  useDeleteStructure,
  useArchiveStructure,
  useRestoreStructure,
} from './structures';

export type { CreateStructureInput, UpdateStructureInput, Structure } from './structures';

// Location mutations
export { UPDATE_LOCATION_GEOMETRY, useUpdateLocationGeometry } from './locations';

export type { UpdateLocationGeometryInput, Location } from './locations';

// Event mutations
export { UPDATE_EVENT, COMPLETE_EVENT, useUpdateEvent, useCompleteEvent } from './events';

export type {
  UpdateEventInput,
  Event,
  EventCompletionResult,
  EffectExecutionSummary as EventEffectExecutionSummary,
} from './events';

// Encounter mutations
export {
  UPDATE_ENCOUNTER,
  RESOLVE_ENCOUNTER,
  useUpdateEncounter,
  useResolveEncounter,
} from './encounters';

export type {
  UpdateEncounterInput,
  Encounter,
  EncounterResolutionResult,
  EffectExecutionSummary as EncounterEffectExecutionSummary,
} from './encounters';

// Condition mutations
export {
  CREATE_FIELD_CONDITION,
  UPDATE_FIELD_CONDITION,
  DELETE_FIELD_CONDITION,
  useCreateFieldCondition,
  useUpdateFieldCondition,
  useDeleteFieldCondition,
} from './conditions';

export type {
  CreateFieldConditionInput,
  UpdateFieldConditionInput,
  FieldCondition,
} from './conditions';
