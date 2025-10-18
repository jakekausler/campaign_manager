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
