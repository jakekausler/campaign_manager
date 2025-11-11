import { describe, it, expect } from 'vitest';

import { generateShortId, generateUUID } from './uuid';

describe('uuid utilities', () => {
  describe('generateUUID', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        ids.add(generateUUID());
      }

      // All IDs should be unique
      expect(ids.size).toBe(iterations);
    });

    it('should generate IDs in valid format', () => {
      const result = generateUUID();

      // Should be a non-empty string
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(10);
    });

    it('should generate different IDs on consecutive calls', () => {
      const id1 = generateUUID();
      const id2 = generateUUID();
      const id3 = generateUUID();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should handle rapid consecutive calls', () => {
      const ids: string[] = [];
      // Generate 100 IDs as fast as possible
      for (let i = 0; i < 100; i++) {
        ids.push(generateUUID());
      }

      // All should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });

    it('should generate IDs of reasonable length', () => {
      const result = generateUUID();

      // Either crypto.randomUUID() format (36 chars) or fallback format (>15 chars)
      // Both should be under 100 chars for sanity
      expect(result.length).toBeGreaterThanOrEqual(15);
      expect(result.length).toBeLessThan(100);
    });
  });

  describe('generateShortId', () => {
    it('should generate short alphanumeric IDs', () => {
      const result = generateShortId();

      expect(result).toMatch(/^[a-z0-9]+$/);
      expect(result.length).toBe(9);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        ids.add(generateShortId());
      }

      // All IDs should be unique (very high probability)
      expect(ids.size).toBe(iterations);
    });

    it('should generate different IDs on each call', () => {
      const id1 = generateShortId();
      const id2 = generateShortId();
      const id3 = generateShortId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should only contain lowercase alphanumeric characters', () => {
      // Generate multiple IDs to increase confidence
      for (let i = 0; i < 100; i++) {
        const id = generateShortId();
        expect(id).toMatch(/^[a-z0-9]+$/);
        // Should not contain uppercase, special chars, or spaces
        expect(id).not.toMatch(/[A-Z\s\W]/);
      }
    });

    it('should be suitable for use as keys', () => {
      const ids = Array.from({ length: 50 }, () => generateShortId());
      const obj: Record<string, number> = {};

      // Use generated IDs as object keys
      ids.forEach((id, index) => {
        obj[id] = index;
      });

      // All keys should be present and unique
      expect(Object.keys(obj).length).toBe(50);
      ids.forEach((id, index) => {
        expect(obj[id]).toBe(index);
      });
    });
  });
});
