import type { StateCreator } from 'zustand';

/**
 * Selection state slice
 *
 * Manages cross-view selection state for synchronized entity highlighting including:
 * - Currently selected entities across all views (Map, Flow, Timeline)
 * - Multi-select support with add/remove/toggle operations
 * - Entity type tracking (Settlement, Structure, Event, Encounter)
 * - Optional metadata for view-specific optimizations
 *
 * This state is ephemeral (not persisted) and enables:
 * - Synchronized highlighting across Map, Flow, and Timeline views
 * - Auto-scroll/pan to selected entities in all views
 * - Multi-select with Ctrl+click modifier
 * - Showing parent Settlement when Structure is selected
 *
 * State persistence:
 * - NOT persisted to localStorage (ephemeral session state)
 * - Selection state resets on page reload
 *
 * Integration with views:
 * - MapPage: Click handlers update selection, subscribe for highlighting
 * - FlowViewPage: Node click updates selection, subscribe for highlighting
 * - TimelinePage: Item click updates selection, subscribe for highlighting
 *
 * Implemented in Stage 1 of TICKET-024.
 */

/**
 * Entity types that can be selected across views
 */
export enum EntityType {
  SETTLEMENT = 'SETTLEMENT',
  STRUCTURE = 'STRUCTURE',
  EVENT = 'EVENT',
  ENCOUNTER = 'ENCOUNTER',
}

/**
 * Represents a selected entity with type and optional metadata
 *
 * The metadata field allows view-specific data to be stored for optimization:
 * - settlementId: For Structures, stores parent Settlement ID for map highlighting
 * - locationId: For map panning to entity location
 * - scheduledAt: For timeline scrolling to event/encounter time
 */
export interface SelectedEntity {
  /** Unique identifier for the entity */
  id: string;

  /** Type of entity (Settlement, Structure, Event, or Encounter) */
  type: EntityType;

  /** Optional display name for the entity */
  name?: string;

  /** Optional metadata for view-specific optimization */
  metadata?: {
    /** Parent Settlement ID (for Structures) */
    settlementId?: string;
    /** Location ID for map panning */
    locationId?: string;
    /** Scheduled time for timeline scrolling (ISO 8601 string) */
    scheduledAt?: string;
  };
}

/**
 * Selection slice state and actions
 */
export interface SelectionSlice {
  // ==================== State ====================

  /**
   * Array of currently selected entities
   * Empty array means no selection
   * Single item means single selection
   * Multiple items means multi-select (Ctrl+click)
   */
  selectedEntities: SelectedEntity[];

  // ==================== Actions ====================

  /**
   * Select a single entity, replacing current selection
   *
   * This is the primary selection action triggered by single-click
   * in any view. It clears any existing selection and selects only
   * the specified entity.
   *
   * Use cases:
   * - User clicks Settlement on map (no modifier key)
   * - User clicks node in Flow view (no modifier key)
   * - User clicks item in Timeline (no modifier key)
   *
   * @param entity - The entity to select
   *
   * @example
   * ```typescript
   * const { selectEntity } = useSelectionStore();
   *
   * // User clicks a settlement on the map
   * selectEntity({
   *   id: 'settlement-123',
   *   type: EntityType.SETTLEMENT,
   *   name: 'Waterdeep',
   *   metadata: { locationId: 'location-456' }
   * });
   * ```
   */
  selectEntity: (entity: SelectedEntity) => void;

  /**
   * Add an entity to the current selection (multi-select)
   *
   * This action is triggered by Ctrl+click in views. It adds the
   * entity to the selection without clearing existing selections.
   * If the entity is already selected, this action does nothing.
   *
   * Use cases:
   * - User Ctrl+clicks Settlement to add to selection
   * - User Ctrl+clicks multiple nodes in Flow view
   * - User Ctrl+clicks multiple items in Timeline
   *
   * @param entity - The entity to add to selection
   *
   * @example
   * ```typescript
   * const { addToSelection } = useSelectionStore();
   *
   * // User Ctrl+clicks a structure to add it to selection
   * addToSelection({
   *   id: 'structure-789',
   *   type: EntityType.STRUCTURE,
   *   name: 'Blacksmith',
   *   metadata: { settlementId: 'settlement-123' }
   * });
   * ```
   */
  addToSelection: (entity: SelectedEntity) => void;

  /**
   * Remove an entity from the selection
   *
   * Removes the specified entity from the selection by ID.
   * If the entity is not in the selection, this action does nothing.
   *
   * Use cases:
   * - User Ctrl+clicks already-selected entity to deselect
   * - User removes entity from selection UI
   * - Programmatic removal (e.g., entity deleted)
   *
   * @param entityId - The ID of the entity to remove
   *
   * @example
   * ```typescript
   * const { removeFromSelection } = useSelectionStore();
   *
   * // Remove a settlement from selection
   * removeFromSelection('settlement-123');
   * ```
   */
  removeFromSelection: (entityId: string) => void;

  /**
   * Clear all selections
   *
   * Clears all selected entities, returning to empty selection state.
   * This is triggered by clicking empty space in views, pressing Escape,
   * or clicking a "Clear Selection" button.
   *
   * Use cases:
   * - User clicks empty space on map
   * - User presses Escape key
   * - User clicks "Clear Selection" button
   * - View unmounts (optional cleanup)
   *
   * @example
   * ```typescript
   * const { clearSelection } = useSelectionStore();
   *
   * // User presses Escape key
   * useEffect(() => {
   *   const handleEscape = (e: KeyboardEvent) => {
   *     if (e.key === 'Escape') {
   *       clearSelection();
   *     }
   *   };
   *   window.addEventListener('keydown', handleEscape);
   *   return () => window.removeEventListener('keydown', handleEscape);
   * }, [clearSelection]);
   * ```
   */
  clearSelection: () => void;

  /**
   * Toggle an entity in the selection
   *
   * If the entity is already selected, remove it from selection.
   * If the entity is not selected, add it to selection.
   * This is a convenience action for Ctrl+click behavior.
   *
   * Use cases:
   * - User Ctrl+clicks entity (toggle in/out of selection)
   * - Checkbox UI for entity selection
   *
   * @param entity - The entity to toggle
   *
   * @example
   * ```typescript
   * const { toggleSelection } = useSelectionStore();
   *
   * // User Ctrl+clicks an event in timeline
   * toggleSelection({
   *   id: 'event-456',
   *   type: EntityType.EVENT,
   *   name: 'Festival of Swords',
   *   metadata: { scheduledAt: '2024-12-25T00:00:00.000Z' }
   * });
   * ```
   */
  toggleSelection: (entity: SelectedEntity) => void;
}

/**
 * Creates the selection slice for the root store
 *
 * Implements cross-view selection state management with multi-select support.
 * All selection state is ephemeral and not persisted to localStorage.
 *
 * Performance considerations:
 * - Selection state updates should be debounced in consuming components (100-200ms)
 * - Use optimized selectors in views to prevent unnecessary re-renders
 * - Consider limiting max selection to 50-100 entities for performance
 *
 * @example Integration in a view
 * ```typescript
 * function MapPage() {
 *   const { selectedEntities, selectEntity } = useSelectionStore();
 *
 *   // Handle map click
 *   const handleSettlementClick = (settlement: Settlement) => {
 *     selectEntity({
 *       id: settlement.id,
 *       type: EntityType.SETTLEMENT,
 *       name: settlement.name,
 *       metadata: { locationId: settlement.locationId }
 *     });
 *   };
 *
 *   // Subscribe to selection changes for highlighting
 *   useEffect(() => {
 *     // Update map highlighting based on selectedEntities
 *   }, [selectedEntities]);
 * }
 * ```
 */
export const createSelectionSlice: StateCreator<SelectionSlice> = (set, get) => ({
  // ==================== Initial State ====================
  selectedEntities: [],

  // ==================== Actions ====================

  selectEntity: (entity) =>
    set({
      selectedEntities: [entity],
    }),

  addToSelection: (entity) => {
    const current = get().selectedEntities;
    // Don't add if already selected (check by ID)
    const alreadySelected = current.some((e) => e.id === entity.id);
    if (alreadySelected) {
      return;
    }

    set({
      selectedEntities: [...current, entity],
    });
  },

  removeFromSelection: (entityId) => {
    const current = get().selectedEntities;
    set({
      selectedEntities: current.filter((e) => e.id !== entityId),
    });
  },

  clearSelection: () =>
    set({
      selectedEntities: [],
    }),

  toggleSelection: (entity) => {
    const current = get().selectedEntities;
    const isSelected = current.some((e) => e.id === entity.id);

    if (isSelected) {
      // Remove from selection
      set({
        selectedEntities: current.filter((e) => e.id !== entity.id),
      });
    } else {
      // Add to selection
      set({
        selectedEntities: [...current, entity],
      });
    }
  },
});
