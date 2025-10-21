/**
 * Unit tests for selection-slice.ts
 *
 * Tests cross-view selection state management including:
 * - Single entity selection
 * - Multi-select (add/remove/toggle)
 * - Entity type support (Settlement, Structure, Event, Encounter)
 * - Clear selection
 * - State consistency and edge cases
 */

import { describe, it, expect } from 'vitest';
import { create } from 'zustand';

import {
  createSelectionSlice,
  EntityType,
  type SelectionSlice,
  type SelectedEntity,
} from './selection-slice';

// Create a test store for each test
function createTestStore() {
  return create<SelectionSlice>()(createSelectionSlice);
}

// Mock entity data for different types
const mockSettlement: SelectedEntity = {
  id: 'settlement-123',
  type: EntityType.SETTLEMENT,
  name: 'Waterdeep',
  metadata: {
    locationId: 'location-456',
  },
};

const mockStructure: SelectedEntity = {
  id: 'structure-789',
  type: EntityType.STRUCTURE,
  name: 'Blacksmith',
  metadata: {
    settlementId: 'settlement-123',
    locationId: 'location-111',
  },
};

const mockEvent: SelectedEntity = {
  id: 'event-456',
  type: EntityType.EVENT,
  name: 'Festival of Swords',
  metadata: {
    scheduledAt: '2024-12-25T00:00:00.000Z',
  },
};

const mockEncounter: SelectedEntity = {
  id: 'encounter-999',
  type: EntityType.ENCOUNTER,
  name: 'Goblin Ambush',
  metadata: {
    scheduledAt: '2024-11-15T14:30:00.000Z',
    locationId: 'location-789',
  },
};

const mockMinimalEntity: SelectedEntity = {
  id: 'minimal-001',
  type: EntityType.SETTLEMENT,
  // No name or metadata
};

describe('SelectionSlice', () => {
  describe('Initial State', () => {
    it('should initialize with empty selectedEntities array', () => {
      const store = createTestStore();
      expect(store.getState().selectedEntities).toEqual([]);
    });
  });

  describe('selectEntity()', () => {
    it('should select a single settlement', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockSettlement);
      expect(store.getState().selectedEntities).toEqual([mockSettlement]);
    });

    it('should select a single structure', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockStructure);
      expect(store.getState().selectedEntities).toEqual([mockStructure]);
    });

    it('should select a single event', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockEvent);
      expect(store.getState().selectedEntities).toEqual([mockEvent]);
    });

    it('should select a single encounter', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockEncounter);
      expect(store.getState().selectedEntities).toEqual([mockEncounter]);
    });

    it('should replace existing selection with new entity', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockSettlement);
      store.getState().selectEntity(mockStructure);
      expect(store.getState().selectedEntities).toEqual([mockStructure]);
    });

    it('should replace multiple selections with single entity', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockStructure);
      store.getState().addToSelection(mockEvent);
      store.getState().selectEntity(mockEncounter);
      expect(store.getState().selectedEntities).toEqual([mockEncounter]);
    });

    it('should support entity with minimal fields', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockMinimalEntity);
      expect(store.getState().selectedEntities).toEqual([mockMinimalEntity]);
    });

    it('should preserve entity metadata when selecting', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockStructure);
      expect(store.getState().selectedEntities[0].metadata).toEqual({
        settlementId: 'settlement-123',
        locationId: 'location-111',
      });
    });
  });

  describe('addToSelection()', () => {
    it('should add entity to empty selection', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      expect(store.getState().selectedEntities).toEqual([mockSettlement]);
    });

    it('should add second entity to selection (multi-select)', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockStructure);
      expect(store.getState().selectedEntities).toEqual([mockSettlement, mockStructure]);
    });

    it('should add multiple different entity types to selection', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockStructure);
      store.getState().addToSelection(mockEvent);
      store.getState().addToSelection(mockEncounter);
      expect(store.getState().selectedEntities).toEqual([
        mockSettlement,
        mockStructure,
        mockEvent,
        mockEncounter,
      ]);
    });

    it('should not add duplicate entity (same ID)', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockSettlement);
      expect(store.getState().selectedEntities).toEqual([mockSettlement]);
    });

    it('should not add entity that is already selected (by ID check)', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);

      // Create a new object with same ID but different metadata
      const duplicateSettlement: SelectedEntity = {
        id: 'settlement-123',
        type: EntityType.SETTLEMENT,
        name: 'Waterdeep Updated',
        metadata: { locationId: 'different-location' },
      };
      store.getState().addToSelection(duplicateSettlement);

      expect(store.getState().selectedEntities.length).toBe(1);
      expect(store.getState().selectedEntities).toEqual([mockSettlement]);
    });

    it('should preserve existing selections when adding new entity', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockEvent);

      expect(store.getState().selectedEntities).toContainEqual(mockSettlement);
      expect(store.getState().selectedEntities).toContainEqual(mockEvent);
    });
  });

  describe('removeFromSelection()', () => {
    it('should remove entity from selection by ID', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().removeFromSelection('settlement-123');
      expect(store.getState().selectedEntities).toEqual([]);
    });

    it('should remove correct entity from multi-select', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockStructure);
      store.getState().addToSelection(mockEvent);

      store.getState().removeFromSelection('structure-789');

      expect(store.getState().selectedEntities).toEqual([mockSettlement, mockEvent]);
    });

    it('should handle removing non-existent entity (no error)', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().removeFromSelection('non-existent-id');
      expect(store.getState().selectedEntities).toEqual([mockSettlement]);
    });

    it('should handle removing from empty selection (no error)', () => {
      const store = createTestStore();
      store.getState().removeFromSelection('settlement-123');
      expect(store.getState().selectedEntities).toEqual([]);
    });

    it('should preserve other entities when removing one', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockStructure);
      store.getState().addToSelection(mockEvent);
      store.getState().addToSelection(mockEncounter);

      store.getState().removeFromSelection('event-456');

      expect(store.getState().selectedEntities).toHaveLength(3);
      expect(store.getState().selectedEntities).toContainEqual(mockSettlement);
      expect(store.getState().selectedEntities).toContainEqual(mockStructure);
      expect(store.getState().selectedEntities).toContainEqual(mockEncounter);
      expect(store.getState().selectedEntities).not.toContainEqual(mockEvent);
    });
  });

  describe('clearSelection()', () => {
    it('should clear empty selection (no error)', () => {
      const store = createTestStore();
      store.getState().clearSelection();
      expect(store.getState().selectedEntities).toEqual([]);
    });

    it('should clear single entity selection', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockSettlement);
      store.getState().clearSelection();
      expect(store.getState().selectedEntities).toEqual([]);
    });

    it('should clear multi-select', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockStructure);
      store.getState().addToSelection(mockEvent);
      store.getState().clearSelection();
      expect(store.getState().selectedEntities).toEqual([]);
    });

    it('should allow re-selection after clearing', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockSettlement);
      store.getState().clearSelection();
      store.getState().selectEntity(mockStructure);
      expect(store.getState().selectedEntities).toEqual([mockStructure]);
    });
  });

  describe('toggleSelection()', () => {
    it('should add entity if not selected', () => {
      const store = createTestStore();
      store.getState().toggleSelection(mockSettlement);
      expect(store.getState().selectedEntities).toEqual([mockSettlement]);
    });

    it('should remove entity if already selected', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().toggleSelection(mockSettlement);
      expect(store.getState().selectedEntities).toEqual([]);
    });

    it('should toggle entity in multi-select (add)', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().toggleSelection(mockStructure);
      expect(store.getState().selectedEntities).toEqual([mockSettlement, mockStructure]);
    });

    it('should toggle entity in multi-select (remove)', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockStructure);
      store.getState().toggleSelection(mockStructure);
      expect(store.getState().selectedEntities).toEqual([mockSettlement]);
    });

    it('should toggle based on ID match', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);

      // Create new object with same ID
      const duplicateSettlement: SelectedEntity = {
        id: 'settlement-123',
        type: EntityType.SETTLEMENT,
        name: 'Different Name',
      };

      // Should remove because ID matches
      store.getState().toggleSelection(duplicateSettlement);
      expect(store.getState().selectedEntities).toEqual([]);
    });

    it('should support rapid toggling', () => {
      const store = createTestStore();

      // Toggle on
      store.getState().toggleSelection(mockSettlement);
      expect(store.getState().selectedEntities).toHaveLength(1);

      // Toggle off
      store.getState().toggleSelection(mockSettlement);
      expect(store.getState().selectedEntities).toHaveLength(0);

      // Toggle on again
      store.getState().toggleSelection(mockSettlement);
      expect(store.getState().selectedEntities).toHaveLength(1);
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state after select -> add -> remove', () => {
      const store = createTestStore();

      // Select
      store.getState().selectEntity(mockSettlement);
      expect(store.getState().selectedEntities).toEqual([mockSettlement]);

      // Add
      store.getState().addToSelection(mockStructure);
      expect(store.getState().selectedEntities).toEqual([mockSettlement, mockStructure]);

      // Remove
      store.getState().removeFromSelection('settlement-123');
      expect(store.getState().selectedEntities).toEqual([mockStructure]);
    });

    it('should maintain consistent state after toggle sequence', () => {
      const store = createTestStore();

      // Toggle on settlement
      store.getState().toggleSelection(mockSettlement);
      expect(store.getState().selectedEntities).toHaveLength(1);

      // Toggle on structure
      store.getState().toggleSelection(mockStructure);
      expect(store.getState().selectedEntities).toHaveLength(2);

      // Toggle off settlement
      store.getState().toggleSelection(mockSettlement);
      expect(store.getState().selectedEntities).toEqual([mockStructure]);

      // Toggle on event
      store.getState().toggleSelection(mockEvent);
      expect(store.getState().selectedEntities).toEqual([mockStructure, mockEvent]);
    });

    it('should maintain consistent state after clear -> select -> add', () => {
      const store = createTestStore();

      store.getState().clearSelection();
      expect(store.getState().selectedEntities).toEqual([]);

      store.getState().selectEntity(mockSettlement);
      expect(store.getState().selectedEntities).toEqual([mockSettlement]);

      store.getState().addToSelection(mockStructure);
      expect(store.getState().selectedEntities).toEqual([mockSettlement, mockStructure]);
    });

    it('should prevent duplicate entities in selection', () => {
      const store = createTestStore();

      // Try multiple ways to create duplicates
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockSettlement);
      store.getState().toggleSelection(mockSettlement);
      store.getState().toggleSelection(mockSettlement);

      expect(store.getState().selectedEntities).toEqual([mockSettlement]);
    });
  });

  describe('Entity Types', () => {
    it('should support SETTLEMENT type', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockSettlement);
      expect(store.getState().selectedEntities[0].type).toBe(EntityType.SETTLEMENT);
    });

    it('should support STRUCTURE type', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockStructure);
      expect(store.getState().selectedEntities[0].type).toBe(EntityType.STRUCTURE);
    });

    it('should support EVENT type', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockEvent);
      expect(store.getState().selectedEntities[0].type).toBe(EntityType.EVENT);
    });

    it('should support ENCOUNTER type', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockEncounter);
      expect(store.getState().selectedEntities[0].type).toBe(EntityType.ENCOUNTER);
    });

    it('should support mixed entity types in multi-select', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockSettlement);
      store.getState().addToSelection(mockStructure);
      store.getState().addToSelection(mockEvent);
      store.getState().addToSelection(mockEncounter);

      const types = store.getState().selectedEntities.map((e) => e.type);
      expect(types).toContain(EntityType.SETTLEMENT);
      expect(types).toContain(EntityType.STRUCTURE);
      expect(types).toContain(EntityType.EVENT);
      expect(types).toContain(EntityType.ENCOUNTER);
    });
  });

  describe('Entity Metadata', () => {
    it('should preserve settlementId metadata for structures', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockStructure);
      expect(store.getState().selectedEntities[0].metadata?.settlementId).toBe('settlement-123');
    });

    it('should preserve locationId metadata', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockSettlement);
      expect(store.getState().selectedEntities[0].metadata?.locationId).toBe('location-456');
    });

    it('should preserve scheduledAt metadata for events', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockEvent);
      expect(store.getState().selectedEntities[0].metadata?.scheduledAt).toBe(
        '2024-12-25T00:00:00.000Z'
      );
    });

    it('should support entities without metadata', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockMinimalEntity);
      expect(store.getState().selectedEntities[0].metadata).toBeUndefined();
    });

    it('should support entities without name', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockMinimalEntity);
      expect(store.getState().selectedEntities[0].name).toBeUndefined();
    });

    it('should preserve all metadata fields when adding to multi-select', () => {
      const store = createTestStore();
      store.getState().addToSelection(mockEncounter);
      const selected = store.getState().selectedEntities[0];

      expect(selected.metadata?.scheduledAt).toBe('2024-11-15T14:30:00.000Z');
      expect(selected.metadata?.locationId).toBe('location-789');
    });
  });

  describe('Edge Cases', () => {
    it('should handle selecting same entity twice (via selectEntity)', () => {
      const store = createTestStore();
      store.getState().selectEntity(mockSettlement);
      store.getState().selectEntity(mockSettlement);
      expect(store.getState().selectedEntities).toEqual([mockSettlement]);
    });

    it('should handle large multi-select (50 entities)', () => {
      const store = createTestStore();

      // Add 50 entities
      for (let i = 0; i < 50; i++) {
        store.getState().addToSelection({
          id: `entity-${i}`,
          type: EntityType.SETTLEMENT,
          name: `Settlement ${i}`,
        });
      }

      expect(store.getState().selectedEntities).toHaveLength(50);
    });

    it('should handle removing all entities one by one', () => {
      const store = createTestStore();
      const entities = [mockSettlement, mockStructure, mockEvent, mockEncounter];

      // Add all
      entities.forEach((e) => store.getState().addToSelection(e));
      expect(store.getState().selectedEntities).toHaveLength(4);

      // Remove all
      entities.forEach((e) => store.getState().removeFromSelection(e.id));
      expect(store.getState().selectedEntities).toEqual([]);
    });

    it('should handle interleaved add/remove/toggle operations', () => {
      const store = createTestStore();

      store.getState().addToSelection(mockSettlement);
      store.getState().toggleSelection(mockStructure);
      store.getState().removeFromSelection('settlement-123');
      store.getState().addToSelection(mockEvent);
      store.getState().toggleSelection(mockStructure);
      store.getState().selectEntity(mockEncounter);

      // selectEntity should replace all previous selections
      expect(store.getState().selectedEntities).toEqual([mockEncounter]);
    });
  });
});
