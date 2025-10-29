import { ConflictType } from './merge.service';
import { SettlementMergeHandler } from './settlement-merge-handler';

describe('SettlementMergeHandler', () => {
  let handler: SettlementMergeHandler;

  beforeEach(() => {
    handler = new SettlementMergeHandler();
  });

  describe('detectConflicts', () => {
    it('should detect no conflicts when only source changed settlement name', () => {
      const base = {
        id: 'settlement-1',
        name: 'OldName',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: { population: 1000 },
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

    it('should detect conflict when both branches modified settlement name differently', () => {
      const base = {
        id: 'settlement-1',
        name: 'OldName',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: { population: 1000 },
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

    it('should detect conflict when both branches modified kingdomId (association change)', () => {
      const base = {
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: {},
      };

      const source = {
        ...base,
        kingdomId: 'kingdom-2',
      };

      const target = {
        ...base,
        kingdomId: 'kingdom-3',
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        path: 'kingdomId',
        type: ConflictType.BOTH_MODIFIED,
      });
    });

    it('should detect conflict when both branches modified nested variables', () => {
      const base = {
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: {
          population: 1000,
          resources: {
            gold: 500,
            food: 200,
          },
        },
      };

      const source = {
        ...base,
        variables: {
          population: 1000,
          resources: {
            gold: 800,
            food: 200,
          },
        },
      };

      const target = {
        ...base,
        variables: {
          population: 1000,
          resources: {
            gold: 600,
            food: 200,
          },
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        path: 'variables.resources.gold',
        type: ConflictType.BOTH_MODIFIED,
        baseValue: 500,
        sourceValue: 800,
        targetValue: 600,
      });
    });

    it('should auto-resolve when both branches changed population to same value', () => {
      const base = {
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: {
          population: 1000,
        },
      };

      const source = {
        ...base,
        variables: {
          population: 1500,
        },
      };

      const target = {
        ...base,
        variables: {
          population: 1500,
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.mergedPayload).toEqual(source);
    });

    it('should handle multiple property changes with some conflicts and some auto-resolved', () => {
      const base = {
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: {
          population: 1000,
          leaderName: 'OldLeader',
        },
      };

      const source = {
        ...base,
        level: 2, // Only source changed
        variables: {
          population: 1500, // Both changed differently
          leaderName: 'OldLeader', // Neither changed
        },
      };

      const target = {
        ...base,
        level: 1, // Unchanged
        variables: {
          population: 1200, // Both changed differently
          leaderName: 'OldLeader', // Neither changed
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].path).toBe('variables.population');
      expect(result.mergedPayload).toBeNull();
    });

    it('should handle entity deletion in source branch', () => {
      const base = {
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
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
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
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
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
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
        id: 'settlement-1',
        name: 'SourceSettlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: {},
      };

      const target = {
        id: 'settlement-1',
        name: 'TargetSettlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: {},
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some((c) => c.path === 'name')).toBe(true);
    });

    it('should handle entity created only in source branch', () => {
      const base = null;

      const source = {
        id: 'settlement-1',
        name: 'NewSettlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
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
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: {
          buildings: {
            residential: {
              houses: 10,
              apartments: 5,
            },
          },
        },
      };

      const source = {
        ...base,
        variables: {
          buildings: {
            residential: {
              houses: 15,
              apartments: 5,
            },
          },
        },
      };

      const target = {
        ...base,
        variables: {
          buildings: {
            residential: {
              houses: 12,
              apartments: 5,
            },
          },
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].path).toBe('variables.buildings.residential.houses');
    });

    it('should handle array conflicts in variables', () => {
      const base = {
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: {
          tags: ['trade', 'coastal'],
        },
      };

      const source = {
        ...base,
        variables: {
          tags: ['trade', 'coastal', 'fortified'],
        },
      };

      const target = {
        ...base,
        variables: {
          tags: ['trade', 'port'],
        },
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].path).toBe('variables.tags');
    });

    it('should auto-resolve when only level changed in source', () => {
      const base = {
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
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

    it('should handle locationId change conflict', () => {
      const base = {
        id: 'settlement-1',
        name: 'Settlement',
        kingdomId: 'kingdom-1',
        locationId: 'loc-1',
        level: 1,
        variables: {},
      };

      const source = {
        ...base,
        locationId: 'loc-2',
      };

      const target = {
        ...base,
        locationId: 'loc-3',
      };

      const result = handler.detectConflicts(base, source, target);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        path: 'locationId',
        type: ConflictType.BOTH_MODIFIED,
      });
    });
  });

  describe('getConflictDescription', () => {
    it('should provide human-readable description for name conflict', () => {
      const handler = new SettlementMergeHandler();

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

    it('should provide human-readable description for kingdom change', () => {
      const handler = new SettlementMergeHandler();

      const description = handler.getConflictDescription({
        path: 'kingdomId',
        type: ConflictType.BOTH_MODIFIED,
        baseValue: 'kingdom-1',
        sourceValue: 'kingdom-2',
        targetValue: 'kingdom-3',
      });

      expect(description).toContain('kingdom');
      expect(description).toBeTruthy();
    });
  });
});
