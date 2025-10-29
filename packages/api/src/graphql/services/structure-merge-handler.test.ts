import { ConflictType } from './merge.service';
import { StructureMergeHandler } from './structure-merge-handler';

describe('StructureMergeHandler', () => {
  let handler: StructureMergeHandler;

  beforeEach(() => {
    handler = new StructureMergeHandler();
  });

  describe('detectConflicts', () => {
    it('should detect no conflicts when only source changed structure name', () => {
      const base = {
        id: 'structure-1',
        name: 'OldName',
        settlementId: 'settlement-1',
        type: 'temple',
        level: 1,
        variables: { defenseRating: 10 },
      };

      const source = {
        ...base,
        name: 'NewName',
      };

      const target = base;

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.mergedPayload).toEqual(source);
    });

    it('should detect conflict when both branches modified structure name differently', () => {
      const base = {
        id: 'structure-1',
        name: 'OldName',
        settlementId: 'settlement-1',
        type: 'barracks',
        level: 1,
        variables: {},
      };

      const source = {
        ...base,
        name: 'SourceName',
      };

      const target = {
        ...base,
        name: 'TargetName',
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        path: 'name',
        type: ConflictType.BOTH_MODIFIED,
        baseValue: 'OldName',
        sourceValue: 'SourceName',
        targetValue: 'TargetName',
      });
      expect(result.mergedPayload).toBeNull();
    });

    it('should detect conflict when both branches modified settlementId (association change)', () => {
      const base = {
        id: 'structure-1',
        name: 'Temple',
        settlementId: 'settlement-1',
        type: 'temple',
        level: 1,
        variables: {},
      };

      const source = {
        ...base,
        settlementId: 'settlement-2',
      };

      const target = {
        ...base,
        settlementId: 'settlement-3',
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        path: 'settlementId',
        type: ConflictType.BOTH_MODIFIED,
      });
    });

    it('should detect conflict when both branches modified structure type', () => {
      const base = {
        id: 'structure-1',
        name: 'Building',
        settlementId: 'settlement-1',
        type: 'market',
        level: 1,
        variables: {},
      };

      const source = {
        ...base,
        type: 'library',
      };

      const target = {
        ...base,
        type: 'temple',
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        path: 'type',
        type: ConflictType.BOTH_MODIFIED,
      });
    });

    it('should detect conflict when both branches modified nested variables', () => {
      const base = {
        id: 'structure-1',
        name: 'Barracks',
        settlementId: 'settlement-1',
        type: 'barracks',
        level: 1,
        variables: {
          defenseRating: 50,
          capacity: 100,
        },
      };

      const source = {
        ...base,
        variables: {
          defenseRating: 75,
          capacity: 100,
        },
      };

      const target = {
        ...base,
        variables: {
          defenseRating: 60,
          capacity: 100,
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        path: 'variables.defenseRating',
        type: ConflictType.BOTH_MODIFIED,
        baseValue: 50,
        sourceValue: 75,
        targetValue: 60,
      });
    });

    it('should auto-resolve when both branches changed capacity to same value', () => {
      const base = {
        id: 'structure-1',
        name: 'Storage',
        settlementId: 'settlement-1',
        type: 'warehouse',
        level: 1,
        variables: {
          capacity: 100,
        },
      };

      const source = {
        ...base,
        variables: {
          capacity: 200,
        },
      };

      const target = {
        ...base,
        variables: {
          capacity: 200,
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.mergedPayload).toEqual(source);
    });

    it('should handle multiple property changes with some conflicts and some auto-resolved', () => {
      const base = {
        id: 'structure-1',
        name: 'Temple',
        settlementId: 'settlement-1',
        type: 'temple',
        level: 1,
        variables: {
          capacity: 50,
          status: 'operational',
        },
      };

      const source = {
        ...base,
        level: 2, // Only source changed
        variables: {
          capacity: 75, // Both changed differently
          status: 'operational', // Neither changed
        },
      };

      const target = {
        ...base,
        level: 1, // Unchanged
        variables: {
          capacity: 60, // Both changed differently
          status: 'operational', // Neither changed
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].path).toBe('variables.capacity');
      expect(result.mergedPayload).toBeNull();
    });

    it('should handle entity deletion in source branch', () => {
      const base = {
        id: 'structure-1',
        name: 'Temple',
        settlementId: 'settlement-1',
        type: 'temple',
        level: 1,
        variables: {},
      };

      const source = null; // Deleted in source

      const target = {
        ...base,
        level: 2, // Modified in target
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].type).toBe(ConflictType.DELETED_MODIFIED);
    });

    it('should handle entity deletion in target branch', () => {
      const base = {
        id: 'structure-1',
        name: 'Temple',
        settlementId: 'settlement-1',
        type: 'temple',
        level: 1,
        variables: {},
      };

      const source = {
        ...base,
        level: 2, // Modified in source
      };

      const target = null; // Deleted in target

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].type).toBe(ConflictType.MODIFIED_DELETED);
    });

    it('should auto-resolve when both branches deleted entity', () => {
      const base = {
        id: 'structure-1',
        name: 'Temple',
        settlementId: 'settlement-1',
        type: 'temple',
        level: 1,
        variables: {},
      };

      const source = null;
      const target = null;

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.mergedPayload).toBeNull();
    });

    it('should handle entity created in both branches with different properties', () => {
      const base = null; // Didn't exist

      const source = {
        id: 'structure-1',
        name: 'SourceBuilding',
        settlementId: 'settlement-1',
        type: 'market',
        level: 1,
        variables: {},
      };

      const target = {
        id: 'structure-1',
        name: 'TargetBuilding',
        settlementId: 'settlement-1',
        type: 'library',
        level: 1,
        variables: {},
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.path === 'name' || c.path === 'type')).toBe(true);
    });

    it('should handle entity created only in source branch', () => {
      const base = null;

      const source = {
        id: 'structure-1',
        name: 'NewBuilding',
        settlementId: 'settlement-1',
        type: 'barracks',
        level: 1,
        variables: {},
      };

      const target = null;

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.mergedPayload).toEqual(source);
    });

    it('should handle deeply nested variable conflicts', () => {
      const base = {
        id: 'structure-1',
        name: 'Market',
        settlementId: 'settlement-1',
        type: 'market',
        level: 1,
        variables: {
          inventory: {
            weapons: {
              swords: 10,
              bows: 5,
            },
          },
        },
      };

      const source = {
        ...base,
        variables: {
          inventory: {
            weapons: {
              swords: 15,
              bows: 5,
            },
          },
        },
      };

      const target = {
        ...base,
        variables: {
          inventory: {
            weapons: {
              swords: 12,
              bows: 5,
            },
          },
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].path).toBe('variables.inventory.weapons.swords');
    });

    it('should handle status change conflict', () => {
      const base = {
        id: 'structure-1',
        name: 'Temple',
        settlementId: 'settlement-1',
        type: 'temple',
        level: 1,
        variables: {
          status: 'operational',
        },
      };

      const source = {
        ...base,
        variables: {
          status: 'damaged',
        },
      };

      const target = {
        ...base,
        variables: {
          status: 'destroyed',
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].path).toBe('variables.status');
    });

    it('should auto-resolve when only level changed in source', () => {
      const base = {
        id: 'structure-1',
        name: 'Temple',
        settlementId: 'settlement-1',
        type: 'temple',
        level: 1,
        variables: {},
      };

      const source = {
        ...base,
        level: 3,
      };

      const target = base;

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(false);
      expect(result.mergedPayload?.level).toBe(3);
    });

    it('should handle complex scenario with multiple conflicts across different property types', () => {
      const base = {
        id: 'structure-1',
        name: 'Fort',
        settlementId: 'settlement-1',
        type: 'military',
        level: 1,
        variables: {
          defenseRating: 100,
          garrison: {
            troops: 50,
            commander: 'OldCommander',
          },
        },
      };

      const source = {
        ...base,
        name: 'SourceFort', // Conflict
        settlementId: 'settlement-2', // Auto-resolve (only source changed)
        type: 'military', // No change
        level: 2, // Auto-resolve (only source changed)
        variables: {
          defenseRating: 150, // Conflict
          garrison: {
            troops: 75, // Auto-resolve (only source changed)
            commander: 'NewCommander', // Conflict
          },
        },
      };

      const target = {
        ...base,
        name: 'TargetFort', // Conflict
        settlementId: 'settlement-1', // No change
        type: 'military', // No change
        level: 1, // No change
        variables: {
          defenseRating: 120, // Conflict
          garrison: {
            troops: 50, // No change
            commander: 'DifferentCommander', // Conflict
          },
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBe(3); // name, defenseRating, commander
      expect(result.conflicts.some((c) => c.path === 'name')).toBe(true);
      expect(result.conflicts.some((c) => c.path === 'variables.defenseRating')).toBe(true);
      expect(result.conflicts.some((c) => c.path === 'variables.garrison.commander')).toBe(true);
    });
  });

  describe('getConflictDescription', () => {
    it('should provide human-readable description for name conflict', () => {
      const handler = new StructureMergeHandler();

      const description = handler.getConflictDescription({
        path: 'name',
        type: ConflictType.BOTH_MODIFIED,
        baseValue: 'OldName',
        sourceValue: 'SourceName',
        targetValue: 'TargetName',
      });

      expect(description).toContain('name');
      expect(description).toBeTruthy();
    });

    it('should provide human-readable description for settlement change', () => {
      const handler = new StructureMergeHandler();

      const description = handler.getConflictDescription({
        path: 'settlementId',
        type: ConflictType.BOTH_MODIFIED,
        baseValue: 'settlement-1',
        sourceValue: 'settlement-2',
        targetValue: 'settlement-3',
      });

      expect(description).toContain('settlement');
      expect(description).toBeTruthy();
    });

    it('should provide human-readable description for type change', () => {
      const handler = new StructureMergeHandler();

      const description = handler.getConflictDescription({
        path: 'type',
        type: ConflictType.BOTH_MODIFIED,
        baseValue: 'market',
        sourceValue: 'library',
        targetValue: 'temple',
      });

      expect(description).toContain('type');
      expect(description).toBeTruthy();
    });
  });
});
