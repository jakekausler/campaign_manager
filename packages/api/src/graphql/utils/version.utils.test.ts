import { compressPayload, decompressPayload, calculateDiff } from './version.utils';

describe('Version Utilities', () => {
  describe('compressPayload', () => {
    it('should compress a simple object', async () => {
      const payload = { name: 'Test Campaign', level: 5 };
      const compressed = await compressPayload(payload);

      expect(compressed).toBeInstanceOf(Buffer);
      expect(compressed.length).toBeGreaterThan(0);
    });

    it('should reduce payload size significantly for large objects', async () => {
      const largePayload = {
        name: 'Large Campaign',
        description: 'A'.repeat(1000), // Repetitive data compresses well
        settings: { theme: 'dark', language: 'en' },
        metadata: Array.from({ length: 100 }, (_, i) => ({
          key: `item${i}`,
          value: 'repeated value',
        })),
      };

      const jsonString = JSON.stringify(largePayload);
      const compressed = await compressPayload(largePayload);

      // Gzip should significantly reduce repetitive data
      expect(compressed.length).toBeLessThan(jsonString.length);
    });

    it('should handle empty objects', async () => {
      const payload = {};
      const compressed = await compressPayload(payload);

      expect(compressed).toBeInstanceOf(Buffer);
      expect(compressed.length).toBeGreaterThan(0);
    });

    it('should handle objects with null values', async () => {
      const payload = { name: 'Campaign', description: null };
      const compressed = await compressPayload(payload);

      expect(compressed).toBeInstanceOf(Buffer);
    });

    it('should handle nested objects', async () => {
      const payload = {
        campaign: {
          name: 'Nested',
          world: {
            name: 'World',
            settings: {
              calendar: 'gregorian',
            },
          },
        },
      };

      const compressed = await compressPayload(payload);
      expect(compressed).toBeInstanceOf(Buffer);
    });

    it('should handle arrays', async () => {
      const payload = {
        items: [1, 2, 3, 4, 5],
        names: ['Alice', 'Bob', 'Charlie'],
      };

      const compressed = await compressPayload(payload);
      expect(compressed).toBeInstanceOf(Buffer);
    });
  });

  describe('decompressPayload', () => {
    it('should decompress a compressed payload', async () => {
      const original = { name: 'Test Campaign', level: 5 };
      const compressed = await compressPayload(original);
      const decompressed = await decompressPayload(compressed);

      expect(decompressed).toEqual(original);
    });

    it('should handle complex nested structures', async () => {
      const original = {
        campaign: {
          name: 'Complex Campaign',
          parties: [
            { name: 'Party A', members: ['Alice', 'Bob'] },
            { name: 'Party B', members: ['Charlie', 'David'] },
          ],
          settings: {
            difficulty: 'hard',
            options: {
              allowPvP: false,
              maxLevel: 20,
            },
          },
        },
      };

      const compressed = await compressPayload(original);
      const decompressed = await decompressPayload(compressed);

      expect(decompressed).toEqual(original);
    });

    it('should handle empty objects', async () => {
      const original = {};
      const compressed = await compressPayload(original);
      const decompressed = await decompressPayload(compressed);

      expect(decompressed).toEqual(original);
    });

    it('should handle null values', async () => {
      const original = { name: 'Campaign', description: null };
      const compressed = await compressPayload(original);
      const decompressed = await decompressPayload(compressed);

      expect(decompressed).toEqual(original);
    });
  });

  describe('compression round-trip', () => {
    it('should preserve data integrity through compress/decompress cycle', async () => {
      const testCases = [
        { name: 'Simple', data: { a: 1, b: 2 } },
        { name: 'Nested', data: { x: { y: { z: 'deep' } } } },
        { name: 'Array', data: { items: [1, 2, 3, 4, 5] } },
        { name: 'Mixed', data: { str: 'text', num: 42, bool: true, nil: null } },
        {
          name: 'Complex',
          data: {
            campaign: {
              id: 'abc123',
              name: 'Test',
              world: { name: 'World', calendar: ['month1', 'month2'] },
            },
          },
        },
      ];

      for (const testCase of testCases) {
        const compressed = await compressPayload(testCase.data);
        const decompressed = await decompressPayload(compressed);
        expect(decompressed).toEqual(testCase.data);
      }
    });

    it('should handle large payloads without data loss', async () => {
      const largePayload = {
        entities: Array.from({ length: 1000 }, (_, i) => ({
          id: `entity-${i}`,
          name: `Entity ${i}`,
          type: i % 3 === 0 ? 'character' : i % 3 === 1 ? 'location' : 'event',
          data: {
            value: i,
            description: `Description for entity ${i}`,
          },
        })),
      };

      const compressed = await compressPayload(largePayload);
      const decompressed = await decompressPayload(compressed);

      expect(decompressed).toEqual(largePayload);
    });
  });

  describe('calculateDiff', () => {
    describe('added fields', () => {
      it('should detect newly added fields', () => {
        const oldPayload = { name: 'Campaign' };
        const newPayload = { name: 'Campaign', level: 5 };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.added).toEqual({ level: 5 });
        expect(diff.modified).toEqual({});
        expect(diff.removed).toEqual({});
      });

      it('should detect multiple added fields', () => {
        const oldPayload = { name: 'Campaign' };
        const newPayload = { name: 'Campaign', level: 5, difficulty: 'hard' };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.added).toEqual({ level: 5, difficulty: 'hard' });
      });

      it('should handle added nested objects', () => {
        const oldPayload = { name: 'Campaign' };
        const newPayload = {
          name: 'Campaign',
          settings: { theme: 'dark' },
        };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.added).toEqual({ settings: { theme: 'dark' } });
      });
    });

    describe('modified fields', () => {
      it('should detect modified string values', () => {
        const oldPayload = { name: 'Old Name' };
        const newPayload = { name: 'New Name' };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.added).toEqual({});
        expect(diff.modified).toEqual({
          name: { old: 'Old Name', new: 'New Name' },
        });
        expect(diff.removed).toEqual({});
      });

      it('should detect modified number values', () => {
        const oldPayload = { level: 5 };
        const newPayload = { level: 10 };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({
          level: { old: 5, new: 10 },
        });
      });

      it('should detect modified boolean values', () => {
        const oldPayload = { isActive: true };
        const newPayload = { isActive: false };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({
          isActive: { old: true, new: false },
        });
      });

      it('should detect multiple modified fields', () => {
        const oldPayload = { name: 'Old', level: 5 };
        const newPayload = { name: 'New', level: 10 };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({
          name: { old: 'Old', new: 'New' },
          level: { old: 5, new: 10 },
        });
      });

      it('should detect modified nested objects', () => {
        const oldPayload = { settings: { theme: 'dark' } };
        const newPayload = { settings: { theme: 'light' } };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({
          settings: {
            old: { theme: 'dark' },
            new: { theme: 'light' },
          },
        });
      });

      it('should not report unchanged fields as modified', () => {
        const oldPayload = { name: 'Campaign', level: 5 };
        const newPayload = { name: 'Campaign', level: 5 };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({});
      });
    });

    describe('removed fields', () => {
      it('should detect removed fields', () => {
        const oldPayload = { name: 'Campaign', level: 5 };
        const newPayload = { name: 'Campaign' };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.added).toEqual({});
        expect(diff.modified).toEqual({});
        expect(diff.removed).toEqual({ level: 5 });
      });

      it('should detect multiple removed fields', () => {
        const oldPayload = { name: 'Campaign', level: 5, difficulty: 'hard' };
        const newPayload = { name: 'Campaign' };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.removed).toEqual({ level: 5, difficulty: 'hard' });
      });

      it('should handle removed nested objects', () => {
        const oldPayload = {
          name: 'Campaign',
          settings: { theme: 'dark' },
        };
        const newPayload = { name: 'Campaign' };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.removed).toEqual({ settings: { theme: 'dark' } });
      });
    });

    describe('combined changes', () => {
      it('should detect added, modified, and removed fields together', () => {
        const oldPayload = {
          name: 'Old Name',
          level: 5,
          toRemove: 'value',
        };
        const newPayload = {
          name: 'New Name',
          level: 5,
          newField: 'added',
        };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.added).toEqual({ newField: 'added' });
        expect(diff.modified).toEqual({
          name: { old: 'Old Name', new: 'New Name' },
        });
        expect(diff.removed).toEqual({ toRemove: 'value' });
      });

      it('should handle complex nested changes', () => {
        const oldPayload = {
          campaign: {
            name: 'Old',
            settings: { theme: 'dark' },
          },
          level: 5,
        };
        const newPayload = {
          campaign: {
            name: 'New',
            settings: { theme: 'dark' },
          },
          difficulty: 'hard',
        };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.added).toEqual({ difficulty: 'hard' });
        expect(diff.modified).toEqual({
          campaign: {
            old: { name: 'Old', settings: { theme: 'dark' } },
            new: { name: 'New', settings: { theme: 'dark' } },
          },
        });
        expect(diff.removed).toEqual({ level: 5 });
      });
    });

    describe('array handling', () => {
      it('should detect modified arrays', () => {
        const oldPayload = { items: [1, 2, 3] };
        const newPayload = { items: [1, 2, 3, 4] };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({
          items: {
            old: [1, 2, 3],
            new: [1, 2, 3, 4],
          },
        });
      });

      it('should not report identical arrays as modified', () => {
        const oldPayload = { items: [1, 2, 3] };
        const newPayload = { items: [1, 2, 3] };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({});
      });

      it('should detect reordered arrays as modified', () => {
        const oldPayload = { items: [1, 2, 3] };
        const newPayload = { items: [3, 2, 1] };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({
          items: {
            old: [1, 2, 3],
            new: [3, 2, 1],
          },
        });
      });
    });

    describe('edge cases', () => {
      it('should handle empty objects', () => {
        const diff = calculateDiff({}, {});

        expect(diff.added).toEqual({});
        expect(diff.modified).toEqual({});
        expect(diff.removed).toEqual({});
      });

      it('should handle null values', () => {
        const oldPayload = { value: null };
        const newPayload = { value: null };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({});
      });

      it('should detect change from null to value', () => {
        const oldPayload = { value: null };
        const newPayload = { value: 'something' };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({
          value: { old: null, new: 'something' },
        });
      });

      it('should detect change from value to null', () => {
        const oldPayload = { value: 'something' };
        const newPayload = { value: null };

        const diff = calculateDiff(oldPayload, newPayload);

        expect(diff.modified).toEqual({
          value: { old: 'something', new: null },
        });
      });

      it('should handle undefined by treating it as absent', () => {
        const oldPayload = { name: 'Campaign', value: undefined };
        const newPayload = { name: 'Campaign' };

        const diff = calculateDiff(oldPayload, newPayload);

        // undefined is treated as a field that exists with undefined value
        expect(diff.removed).toEqual({ value: undefined });
      });
    });
  });
});
