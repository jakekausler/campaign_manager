import { ConflictDetector } from './conflict-detector';
import { ConflictType } from './merge.service';

describe('ConflictDetector', () => {
  let detector: ConflictDetector;

  beforeEach(() => {
    detector = new ConflictDetector();
  });

  describe('detectPropertyConflicts', () => {
    describe('no conflicts - auto-resolution', () => {
      it('should auto-resolve when only source branch modified a property', () => {
        const base = { name: 'Original', count: 10 };
        const source = { name: 'Modified by Source', count: 10 };
        const target = { name: 'Original', count: 10 };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          name: 'Modified by Source',
          count: 10,
        });
      });

      it('should auto-resolve when only target branch modified a property', () => {
        const base = { name: 'Original', count: 10 };
        const source = { name: 'Original', count: 10 };
        const target = { name: 'Modified by Target', count: 10 };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          name: 'Modified by Target',
          count: 10,
        });
      });

      it('should keep base value when neither branch modified property', () => {
        const base = { name: 'Original', count: 10 };
        const source = { name: 'Original', count: 10 };
        const target = { name: 'Original', count: 10 };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          name: 'Original',
          count: 10,
        });
      });

      it('should auto-resolve when both branches made identical changes', () => {
        const base = { name: 'Original', count: 10 };
        const source = { name: 'Same Change', count: 15 };
        const target = { name: 'Same Change', count: 15 };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          name: 'Same Change',
          count: 15,
        });
      });

      it('should auto-resolve when source adds new property', () => {
        const base = { name: 'Original' };
        const source = { name: 'Original', newField: 'added' };
        const target = { name: 'Original' };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          name: 'Original',
          newField: 'added',
        });
      });

      it('should auto-resolve when target adds new property', () => {
        const base = { name: 'Original' };
        const source = { name: 'Original' };
        const target = { name: 'Original', newField: 'added' };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          name: 'Original',
          newField: 'added',
        });
      });

      it('should auto-resolve when source deletes property', () => {
        const base = { name: 'Original', toDelete: 'value' };
        const source = { name: 'Original' };
        const target = { name: 'Original', toDelete: 'value' };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          name: 'Original',
        });
      });

      it('should auto-resolve when target deletes property', () => {
        const base = { name: 'Original', toDelete: 'value' };
        const source = { name: 'Original', toDelete: 'value' };
        const target = { name: 'Original' };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          name: 'Original',
        });
      });
    });

    describe('BOTH_MODIFIED conflicts', () => {
      it('should detect conflict when both branches modify same property differently', () => {
        const base = { name: 'Original', count: 10 };
        const source = { name: 'Source Change', count: 10 };
        const target = { name: 'Target Change', count: 10 };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(true);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0]).toMatchObject({
          path: 'name',
          type: ConflictType.BOTH_MODIFIED,
          baseValue: 'Original',
          sourceValue: 'Source Change',
          targetValue: 'Target Change',
        });
        expect(result.mergedPayload).toBeNull();
      });

      it('should detect multiple conflicts when both branches modify different properties', () => {
        const base = { name: 'Original', count: 10, status: 'active' };
        const source = { name: 'Source Change', count: 20, status: 'active' };
        const target = { name: 'Target Change', count: 30, status: 'active' };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(true);
        expect(result.conflicts).toHaveLength(2);

        const nameConflict = result.conflicts.find((c) => c.path === 'name');
        expect(nameConflict).toMatchObject({
          path: 'name',
          type: ConflictType.BOTH_MODIFIED,
          baseValue: 'Original',
          sourceValue: 'Source Change',
          targetValue: 'Target Change',
        });

        const countConflict = result.conflicts.find((c) => c.path === 'count');
        expect(countConflict).toMatchObject({
          path: 'count',
          type: ConflictType.BOTH_MODIFIED,
          baseValue: 10,
          sourceValue: 20,
          targetValue: 30,
        });
      });

      it('should detect conflict when both branches add same new property with different values', () => {
        const base = { name: 'Original' };
        const source = { name: 'Original', newField: 'source value' };
        const target = { name: 'Original', newField: 'target value' };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(true);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0]).toMatchObject({
          path: 'newField',
          type: ConflictType.BOTH_MODIFIED,
          baseValue: undefined,
          sourceValue: 'source value',
          targetValue: 'target value',
        });
      });
    });

    describe('BOTH_DELETED conflicts', () => {
      it('should auto-resolve when both branches delete same property', () => {
        const base = { name: 'Original', toDelete: 'value' };
        const source = { name: 'Original' };
        const target = { name: 'Original' };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          name: 'Original',
        });
      });
    });

    describe('MODIFIED_DELETED conflicts', () => {
      it('should detect conflict when source modifies property that target deleted', () => {
        const base = { name: 'Original', field: 'original value' };
        const source = { name: 'Original', field: 'modified by source' };
        const target = { name: 'Original' };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(true);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0]).toMatchObject({
          path: 'field',
          type: ConflictType.MODIFIED_DELETED,
          baseValue: 'original value',
          sourceValue: 'modified by source',
          targetValue: undefined,
        });
      });
    });

    describe('DELETED_MODIFIED conflicts', () => {
      it('should detect conflict when source deletes property that target modified', () => {
        const base = { name: 'Original', field: 'original value' };
        const source = { name: 'Original' };
        const target = { name: 'Original', field: 'modified by target' };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(true);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0]).toMatchObject({
          path: 'field',
          type: ConflictType.DELETED_MODIFIED,
          baseValue: 'original value',
          sourceValue: undefined,
          targetValue: 'modified by target',
        });
      });
    });

    describe('nested property conflicts', () => {
      it('should detect conflicts in nested objects', () => {
        const base = {
          name: 'Settlement',
          resources: { gold: 100, food: 50 },
        };
        const source = {
          name: 'Settlement',
          resources: { gold: 150, food: 50 },
        };
        const target = {
          name: 'Settlement',
          resources: { gold: 120, food: 50 },
        };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(true);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0]).toMatchObject({
          path: 'resources.gold',
          type: ConflictType.BOTH_MODIFIED,
          baseValue: 100,
          sourceValue: 150,
          targetValue: 120,
        });
      });

      it('should auto-resolve when only source modifies nested property', () => {
        const base = {
          name: 'Settlement',
          resources: { gold: 100, food: 50 },
        };
        const source = {
          name: 'Settlement',
          resources: { gold: 150, food: 50 },
        };
        const target = {
          name: 'Settlement',
          resources: { gold: 100, food: 50 },
        };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          name: 'Settlement',
          resources: { gold: 150, food: 50 },
        });
      });

      it('should handle deeply nested property conflicts', () => {
        const base = {
          config: { settings: { display: { theme: 'light' } } },
        };
        const source = {
          config: { settings: { display: { theme: 'dark' } } },
        };
        const target = {
          config: { settings: { display: { theme: 'auto' } } },
        };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(true);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0]).toMatchObject({
          path: 'config.settings.display.theme',
          type: ConflictType.BOTH_MODIFIED,
          baseValue: 'light',
          sourceValue: 'dark',
          targetValue: 'auto',
        });
      });

      it('should auto-resolve when source adds nested property and target modifies different property', () => {
        const base = {
          resources: { gold: 100 },
        };
        const source = {
          resources: { gold: 100, food: 50 },
        };
        const target = {
          resources: { gold: 150 },
        };

        const result = detector.detectPropertyConflicts(base, source, target);

        // Should auto-resolve: target modified gold (takes precedence), source added food (accepted)
        expect(result.hasConflicts).toBe(false);
        expect(result.mergedPayload).toEqual({
          resources: {
            gold: 150, // target's change
            food: 50, // source's addition
          },
        });
      });
    });

    describe('array handling', () => {
      it('should detect conflict when both branches modify array differently', () => {
        const base = { tags: ['a', 'b'] };
        const source = { tags: ['a', 'b', 'c'] };
        const target = { tags: ['a', 'b', 'd'] };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(true);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0]).toMatchObject({
          path: 'tags',
          type: ConflictType.BOTH_MODIFIED,
          baseValue: ['a', 'b'],
          sourceValue: ['a', 'b', 'c'],
          targetValue: ['a', 'b', 'd'],
        });
      });

      it('should auto-resolve when both branches make identical array changes', () => {
        const base = { tags: ['a', 'b'] };
        const source = { tags: ['a', 'b', 'c'] };
        const target = { tags: ['a', 'b', 'c'] };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({
          tags: ['a', 'b', 'c'],
        });
      });
    });

    describe('null and undefined handling', () => {
      it('should handle null base version (entity created in both branches)', () => {
        const base = null;
        const source = { name: 'Created in Source', count: 10 };
        const target = { name: 'Created in Target', count: 20 };

        const result = detector.detectPropertyConflicts(base, source, target);

        // If entity doesn't exist in base, both branches created it independently
        // This is a complex scenario - we'll treat all properties as conflicts
        expect(result.hasConflicts).toBe(true);
        expect(result.conflicts.length).toBeGreaterThan(0);
      });

      it('should handle null source version (entity deleted in source)', () => {
        const base = { name: 'Original', count: 10 };
        const source = null;
        const target = { name: 'Modified in Target', count: 10 };

        const result = detector.detectPropertyConflicts(base, source, target);

        // Source deleted entire entity, target modified it - major conflict
        expect(result.hasConflicts).toBe(true);
        expect(result.mergedPayload).toBeNull();
      });

      it('should handle null target version (entity deleted in target)', () => {
        const base = { name: 'Original', count: 10 };
        const source = { name: 'Modified in Source', count: 10 };
        const target = null;

        const result = detector.detectPropertyConflicts(base, source, target);

        // Target deleted entire entity, source modified it - major conflict
        expect(result.hasConflicts).toBe(true);
        expect(result.mergedPayload).toBeNull();
      });

      it('should auto-resolve when both branches deleted entity', () => {
        const base = { name: 'Original', count: 10 };
        const source = null;
        const target = null;

        const result = detector.detectPropertyConflicts(base, source, target);

        // Both deleted - auto-resolve to deletion
        expect(result.hasConflicts).toBe(false);
        expect(result.mergedPayload).toBeNull();
      });

      it('should handle undefined property values', () => {
        const base = { name: 'Original', field: undefined };
        const source = { name: 'Original', field: 'value' };
        const target = { name: 'Original', field: undefined };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.mergedPayload).toEqual({
          name: 'Original',
          field: 'value',
        });
      });
    });

    describe('edge cases', () => {
      it('should handle empty objects', () => {
        const base = {};
        const source = {};
        const target = {};

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(false);
        expect(result.conflicts).toHaveLength(0);
        expect(result.mergedPayload).toEqual({});
      });

      it('should handle complex scenario with mixed conflicts and auto-resolutions', () => {
        const base = {
          name: 'Settlement',
          population: 1000,
          resources: { gold: 100, food: 50 },
          buildings: ['house', 'farm'],
        };
        const source = {
          name: 'Settlement Renamed Source',
          population: 1000,
          resources: { gold: 150, food: 50, wood: 30 },
          buildings: ['house', 'farm'],
        };
        const target = {
          name: 'Settlement Renamed Target',
          population: 1200,
          resources: { gold: 100, food: 75 },
          buildings: ['house', 'farm', 'barracks'],
        };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(true);

        // Should have conflicts for: name (both branches renamed it differently)
        // Should auto-resolve: population (only target changed), resources.gold (only source changed),
        //                      resources.food (only target changed), resources.wood (only source added),
        //                      buildings (only target changed)
        expect(result.conflicts).toHaveLength(1);

        const nameConflict = result.conflicts.find((c) => c.path === 'name');
        expect(nameConflict).toBeDefined();
        expect(nameConflict?.type).toBe(ConflictType.BOTH_MODIFIED);
      });

      it('should handle type changes as conflicts', () => {
        const base = { value: 42 };
        const source = { value: '42' };
        const target = { value: 42 };

        const result = detector.detectPropertyConflicts(base, source, target);

        // Type change in source should be treated as a modification
        expect(result.hasConflicts).toBe(false);
        expect(result.mergedPayload).toEqual({ value: '42' });
      });

      it('should handle type changes in both branches as conflict', () => {
        const base = { value: 42 };
        const source = { value: '42' };
        const target = { value: [42] };

        const result = detector.detectPropertyConflicts(base, source, target);

        expect(result.hasConflicts).toBe(true);
        expect(result.conflicts[0]).toMatchObject({
          path: 'value',
          type: ConflictType.BOTH_MODIFIED,
          baseValue: 42,
          sourceValue: '42',
          targetValue: [42],
        });
      });
    });
  });
});
