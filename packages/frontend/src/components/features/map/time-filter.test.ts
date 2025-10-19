/**
 * Tests for time filtering utilities
 */

import { describe, it, expect } from 'vitest';

import { filterByTime } from './time-filter';

describe('filterByTime', () => {
  // Sample entities with temporal fields
  const entities = [
    {
      id: '1',
      name: 'Entity 1',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      deletedAt: null,
      archivedAt: null,
    },
    {
      id: '2',
      name: 'Entity 2',
      createdAt: new Date('2024-02-01T00:00:00Z'),
      deletedAt: new Date('2024-06-01T00:00:00Z'),
      archivedAt: null,
    },
    {
      id: '3',
      name: 'Entity 3',
      createdAt: new Date('2024-03-01T00:00:00Z'),
      deletedAt: null,
      archivedAt: new Date('2024-08-01T00:00:00Z'),
    },
    {
      id: '4',
      name: 'Entity 4',
      createdAt: new Date('2024-04-01T00:00:00Z'),
      deletedAt: null,
      archivedAt: null,
    },
    {
      id: '5',
      name: 'Entity 5 (future)',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      deletedAt: null,
      archivedAt: null,
    },
  ];

  describe('null time (current active entities)', () => {
    it('should return only active entities (not deleted/archived)', () => {
      const result = filterByTime(entities, null);

      // Should include entities 1, 4, and 5 (active)
      // Should exclude entity 2 (deleted) and entity 3 (archived)
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.id)).toEqual(['1', '4', '5']);
    });

    it('should exclude entities with deletedAt', () => {
      const result = filterByTime(entities, null);
      expect(result.every((e) => !e.deletedAt)).toBe(true);
    });

    it('should exclude entities with archivedAt', () => {
      const result = filterByTime(entities, null);
      expect(result.every((e) => !e.archivedAt)).toBe(true);
    });
  });

  describe('historical time filtering', () => {
    it('should include entities created before the specified time', () => {
      const time = new Date('2024-05-01T00:00:00Z');
      const result = filterByTime(entities, time);

      // Entities 1, 2, 3, 4 created before May 1
      // Entity 5 created in 2025 (future) should be excluded
      const ids = result.map((e) => e.id);
      expect(ids).not.toContain('5');
    });

    it('should exclude entities created after the specified time', () => {
      const time = new Date('2024-05-01T00:00:00Z');
      const result = filterByTime(entities, time);

      // Entity 5 created in 2025 should not be included
      expect(result.find((e) => e.id === '5')).toBeUndefined();
    });

    it('should include entities deleted after the specified time', () => {
      const time = new Date('2024-05-01T00:00:00Z');
      const result = filterByTime(entities, time);

      // Entity 2 deleted on June 1, so it should be visible on May 1
      expect(result.find((e) => e.id === '2')).toBeDefined();
    });

    it('should exclude entities deleted before or at the specified time', () => {
      const time = new Date('2024-06-01T00:00:00Z');
      const result = filterByTime(entities, time);

      // Entity 2 deleted on June 1, so it should NOT be visible on June 1
      expect(result.find((e) => e.id === '2')).toBeUndefined();
    });

    it('should include entities archived after the specified time', () => {
      const time = new Date('2024-07-01T00:00:00Z');
      const result = filterByTime(entities, time);

      // Entity 3 archived on Aug 1, so it should be visible on July 1
      expect(result.find((e) => e.id === '3')).toBeDefined();
    });

    it('should exclude entities archived before or at the specified time', () => {
      const time = new Date('2024-08-01T00:00:00Z');
      const result = filterByTime(entities, time);

      // Entity 3 archived on Aug 1, so it should NOT be visible on Aug 1
      expect(result.find((e) => e.id === '3')).toBeUndefined();
    });
  });

  describe('specific time scenarios', () => {
    it('should show entity 2 as of April 1, 2024', () => {
      const time = new Date('2024-04-01T00:00:00Z');
      const result = filterByTime(entities, time);

      // Entity 2 created Feb 1, deleted June 1, so visible on April 1
      expect(result.find((e) => e.id === '2')).toBeDefined();
    });

    it('should show entity 3 as of May 1, 2024', () => {
      const time = new Date('2024-05-01T00:00:00Z');
      const result = filterByTime(entities, time);

      // Entity 3 created March 1, archived Aug 1, so visible on May 1
      expect(result.find((e) => e.id === '3')).toBeDefined();
    });

    it('should return correct entities as of March 15, 2024', () => {
      const time = new Date('2024-03-15T00:00:00Z');
      const result = filterByTime(entities, time);

      // Entity 1: created Jan 1, active -> visible
      // Entity 2: created Feb 1, deleted June 1 -> visible
      // Entity 3: created March 1, archived Aug 1 -> visible
      // Entity 4: created April 1 -> NOT YET CREATED
      // Entity 5: created 2025 -> NOT YET CREATED
      const ids = result.map((e) => e.id);
      expect(ids).toEqual(['1', '2', '3']);
    });

    it('should return correct entities as of September 1, 2024', () => {
      const time = new Date('2024-09-01T00:00:00Z');
      const result = filterByTime(entities, time);

      // Entity 1: created Jan 1, active -> visible
      // Entity 2: created Feb 1, deleted June 1 -> NOT visible (deleted)
      // Entity 3: created March 1, archived Aug 1 -> NOT visible (archived)
      // Entity 4: created April 1, active -> visible
      // Entity 5: created 2025 -> NOT YET CREATED
      const ids = result.map((e) => e.id);
      expect(ids).toEqual(['1', '4']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const result = filterByTime([], new Date('2024-01-01'));
      expect(result).toEqual([]);
    });

    it('should handle entities without createdAt', () => {
      const entitiesWithoutCreatedAt = [
        { id: '1', name: 'No created date', deletedAt: null, archivedAt: null },
      ];

      const result = filterByTime(entitiesWithoutCreatedAt, new Date('2024-01-01'));
      expect(result).toHaveLength(0);
    });

    it('should handle entities with string date values', () => {
      const entitiesWithStringDates = [
        {
          id: '1',
          name: 'String dates',
          createdAt: '2024-01-01T00:00:00Z',
          deletedAt: null,
          archivedAt: null,
        },
      ];

      const result = filterByTime(entitiesWithStringDates, new Date('2024-06-01'));
      expect(result).toHaveLength(1);
    });

    it('should handle exact time matches (boundary conditions)', () => {
      const exactTime = new Date('2024-02-01T00:00:00Z');
      const result = filterByTime(entities, exactTime);

      // Entity 2 created at exactly this time, should be included
      expect(result.find((e) => e.id === '2')).toBeDefined();
    });

    it('should handle time at creation boundary (created at exactly the filter time)', () => {
      const exactCreationTime = new Date('2024-01-01T00:00:00Z');
      const result = filterByTime(entities, exactCreationTime);

      // Entity 1 created at exactly this time, should be included
      expect(result.find((e) => e.id === '1')).toBeDefined();
    });
  });

  describe('deletion and archival boundary conditions', () => {
    it('should exclude entity at exact deletion time', () => {
      const exactDeletionTime = new Date('2024-06-01T00:00:00Z');
      const result = filterByTime(entities, exactDeletionTime);

      // Entity 2 deleted at exactly this time, should NOT be included (deleted <= time)
      expect(result.find((e) => e.id === '2')).toBeUndefined();
    });

    it('should exclude entity at exact archival time', () => {
      const exactArchivalTime = new Date('2024-08-01T00:00:00Z');
      const result = filterByTime(entities, exactArchivalTime);

      // Entity 3 archived at exactly this time, should NOT be included (archived <= time)
      expect(result.find((e) => e.id === '3')).toBeUndefined();
    });

    it('should include entity one millisecond before deletion', () => {
      const oneMillisecondBeforeDeletion = new Date('2024-05-31T23:59:59.999Z');
      const result = filterByTime(entities, oneMillisecondBeforeDeletion);

      // Entity 2 deleted on June 1, so visible one ms before
      expect(result.find((e) => e.id === '2')).toBeDefined();
    });

    it('should include entity one millisecond before archival', () => {
      const oneMillisecondBeforeArchival = new Date('2024-07-31T23:59:59.999Z');
      const result = filterByTime(entities, oneMillisecondBeforeArchival);

      // Entity 3 archived on Aug 1, so visible one ms before
      expect(result.find((e) => e.id === '3')).toBeDefined();
    });
  });
});
