import { describe, it, expect } from 'vitest';

import {
  transformEventToTimelineItem,
  transformEncounterToTimelineItem,
  transformToTimelineItems,
  type Event,
  type Encounter,
} from './timeline-transforms';

describe('timeline-transforms', () => {
  describe('transformEventToTimelineItem', () => {
    it('should transform a completed event with occurredAt', () => {
      const event: Event = {
        id: 'event-1',
        campaignId: 'campaign-1',
        name: 'Royal Festival',
        description: 'Annual celebration',
        eventType: 'kingdom',
        scheduledAt: '2024-06-15T12:00:00.000Z',
        occurredAt: '2024-06-15T14:00:00.000Z',
        isCompleted: true,
      };

      const result = transformEventToTimelineItem(event);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('event-event-1');
      expect(result?.content).toBe('Royal Festival');
      expect(result?.start).toEqual(new Date('2024-06-15T14:00:00.000Z'));
      expect(result?.type).toBe('point');
      expect(result?.className).toBe('timeline-item-event');
      expect(result?.style).toContain('#10b981'); // green-500 for completed
      expect(result?.title).toContain('Event: Royal Festival');
      expect(result?.title).toContain('Status: Completed');
      expect(result?.title).toContain('Type: kingdom');
      expect(result?.editable).toBe(false); // Completed events are not editable
    });

    it('should transform a scheduled event without occurredAt', () => {
      const event: Event = {
        id: 'event-2',
        campaignId: 'campaign-1',
        name: 'Harvest Moon',
        description: 'Scheduled harvest celebration',
        eventType: 'world',
        scheduledAt: '2024-09-21T18:00:00.000Z',
        occurredAt: null,
        isCompleted: false,
      };

      const result = transformEventToTimelineItem(event);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('event-event-2');
      expect(result?.content).toBe('Harvest Moon');
      expect(result?.start).toEqual(new Date('2024-09-21T18:00:00.000Z'));
      expect(result?.type).toBe('point');
      expect(result?.style).toContain('#3b82f6'); // blue-500 for scheduled
      expect(result?.title).toContain('Status: Scheduled');
      expect(result?.editable).toBe(true); // Scheduled events are editable
    });

    it('should transform an overdue event (past scheduledAt, not completed)', () => {
      const event: Event = {
        id: 'event-3',
        campaignId: 'campaign-1',
        name: 'Old Quest',
        eventType: 'party',
        scheduledAt: '2024-01-01T10:00:00.000Z',
        occurredAt: null,
        isCompleted: false,
      };

      const currentWorldTime = new Date('2024-06-01T00:00:00.000Z');
      const result = transformEventToTimelineItem(event, currentWorldTime);

      expect(result).not.toBeNull();
      expect(result?.style).toContain('#ef4444'); // red-500 for overdue
      expect(result?.title).toContain('Status: Overdue');
      expect(result?.editable).toBe(true); // Overdue events are still editable
    });

    it('should handle null dates gracefully by returning null', () => {
      const event: Event = {
        id: 'event-4',
        campaignId: 'campaign-1',
        name: 'Undated Event',
        eventType: 'story',
        scheduledAt: null,
        occurredAt: null,
        isCompleted: false,
      };

      const result = transformEventToTimelineItem(event);

      expect(result).toBeNull();
    });

    it('should handle undefined dates gracefully by returning null', () => {
      const event: Event = {
        id: 'event-5',
        campaignId: 'campaign-1',
        name: 'Undefined Event',
        eventType: 'world',
        isCompleted: false,
      };

      const result = transformEventToTimelineItem(event);

      expect(result).toBeNull();
    });

    it('should include description in tooltip if present', () => {
      const event: Event = {
        id: 'event-6',
        campaignId: 'campaign-1',
        name: 'Festival',
        description: 'A grand celebration',
        eventType: 'kingdom',
        scheduledAt: '2024-07-01T12:00:00.000Z',
        isCompleted: false,
      };

      const result = transformEventToTimelineItem(event);

      expect(result?.title).toContain('A grand celebration');
    });

    it('should not include description in tooltip if not present', () => {
      const event: Event = {
        id: 'event-7',
        campaignId: 'campaign-1',
        name: 'Festival',
        eventType: 'kingdom',
        scheduledAt: '2024-07-01T12:00:00.000Z',
        isCompleted: false,
      };

      const result = transformEventToTimelineItem(event);

      expect(result?.title).not.toContain('undefined');
      expect(result?.title).not.toContain('null');
    });
  });

  describe('transformEncounterToTimelineItem', () => {
    it('should transform a resolved encounter with resolvedAt', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        campaignId: 'campaign-1',
        name: 'Bandit Ambush',
        description: 'Group of bandits near the eastern road',
        difficulty: 5,
        isResolved: true,
        resolvedAt: '2024-05-10T16:30:00.000Z',
      };

      const result = transformEncounterToTimelineItem(encounter);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('encounter-encounter-1');
      expect(result?.content).toBe('Bandit Ambush');
      expect(result?.start).toEqual(new Date('2024-05-10T16:30:00.000Z'));
      expect(result?.type).toBe('point');
      expect(result?.className).toBe('timeline-item-encounter');
      expect(result?.style).toContain('#059669'); // green-600 for resolved
      expect(result?.title).toContain('Encounter: Bandit Ambush');
      expect(result?.title).toContain('Status: Resolved');
      expect(result?.title).toContain('Difficulty: 5');
      expect(result?.editable).toBe(false); // Resolved encounters are not editable
    });

    it('should handle unresolved encounter without resolvedAt by returning null', () => {
      const encounter: Encounter = {
        id: 'encounter-2',
        campaignId: 'campaign-1',
        name: 'Dragon Sighting',
        description: 'Ancient dragon spotted in the mountains',
        difficulty: 15,
        isResolved: false,
        resolvedAt: null,
      };

      // Until Stage 9 adds scheduledAt field, unresolved encounters have no date
      const result = transformEncounterToTimelineItem(encounter);

      expect(result).toBeNull();
    });

    it('should handle null dates gracefully by returning null', () => {
      const encounter: Encounter = {
        id: 'encounter-3',
        campaignId: 'campaign-1',
        name: 'Mystery',
        isResolved: false,
        resolvedAt: null,
      };

      const result = transformEncounterToTimelineItem(encounter);

      expect(result).toBeNull();
    });

    it('should handle undefined dates gracefully by returning null', () => {
      const encounter: Encounter = {
        id: 'encounter-4',
        campaignId: 'campaign-1',
        name: 'Mystery',
        isResolved: false,
      };

      const result = transformEncounterToTimelineItem(encounter);

      expect(result).toBeNull();
    });

    it('should include difficulty in tooltip if present', () => {
      const encounter: Encounter = {
        id: 'encounter-5',
        campaignId: 'campaign-1',
        name: 'Hard Fight',
        difficulty: 10,
        isResolved: true,
        resolvedAt: '2024-05-15T12:00:00.000Z',
      };

      const result = transformEncounterToTimelineItem(encounter);

      expect(result?.title).toContain('Difficulty: 10');
    });

    it('should not include difficulty in tooltip if not present', () => {
      const encounter: Encounter = {
        id: 'encounter-6',
        campaignId: 'campaign-1',
        name: 'Easy Fight',
        difficulty: null,
        isResolved: true,
        resolvedAt: '2024-05-16T12:00:00.000Z',
      };

      const result = transformEncounterToTimelineItem(encounter);

      expect(result?.title).not.toContain('Difficulty:');
    });

    it('should include description in tooltip if present', () => {
      const encounter: Encounter = {
        id: 'encounter-7',
        campaignId: 'campaign-1',
        name: 'Ambush',
        description: 'Surprise attack',
        isResolved: true,
        resolvedAt: '2024-05-17T12:00:00.000Z',
      };

      const result = transformEncounterToTimelineItem(encounter);

      expect(result?.title).toContain('Surprise attack');
    });

    it('should not include description in tooltip if not present', () => {
      const encounter: Encounter = {
        id: 'encounter-8',
        campaignId: 'campaign-1',
        name: 'Fight',
        isResolved: true,
        resolvedAt: '2024-05-18T12:00:00.000Z',
      };

      const result = transformEncounterToTimelineItem(encounter);

      expect(result?.title).not.toContain('undefined');
      expect(result?.title).not.toContain('null');
    });
  });

  describe('transformToTimelineItems', () => {
    it('should combine events and encounters into timeline items', () => {
      const events: Event[] = [
        {
          id: 'event-1',
          campaignId: 'campaign-1',
          name: 'Festival',
          eventType: 'kingdom',
          scheduledAt: '2024-06-15T12:00:00.000Z',
          occurredAt: '2024-06-15T14:00:00.000Z',
          isCompleted: true,
        },
        {
          id: 'event-2',
          campaignId: 'campaign-1',
          name: 'Quest',
          eventType: 'party',
          scheduledAt: '2024-07-01T10:00:00.000Z',
          isCompleted: false,
        },
      ];

      const encounters: Encounter[] = [
        {
          id: 'encounter-1',
          campaignId: 'campaign-1',
          name: 'Bandit Ambush',
          difficulty: 5,
          isResolved: true,
          resolvedAt: '2024-05-10T16:30:00.000Z',
        },
      ];

      const result = transformToTimelineItems(events, encounters);

      expect(result).toHaveLength(3);
      expect(result.some((item) => item.id === 'event-event-1')).toBe(true);
      expect(result.some((item) => item.id === 'event-event-2')).toBe(true);
      expect(result.some((item) => item.id === 'encounter-encounter-1')).toBe(true);
    });

    it('should filter out items without valid dates', () => {
      const events: Event[] = [
        {
          id: 'event-1',
          campaignId: 'campaign-1',
          name: 'Valid Event',
          eventType: 'kingdom',
          scheduledAt: '2024-06-15T12:00:00.000Z',
          isCompleted: false,
        },
        {
          id: 'event-2',
          campaignId: 'campaign-1',
          name: 'Invalid Event',
          eventType: 'party',
          scheduledAt: null,
          isCompleted: false,
        },
      ];

      const encounters: Encounter[] = [
        {
          id: 'encounter-1',
          campaignId: 'campaign-1',
          name: 'Valid Encounter',
          difficulty: 5,
          isResolved: true,
          resolvedAt: '2024-05-10T16:30:00.000Z',
        },
        {
          id: 'encounter-2',
          campaignId: 'campaign-1',
          name: 'Invalid Encounter',
          isResolved: false,
          resolvedAt: null,
        },
      ];

      const result = transformToTimelineItems(events, encounters);

      // Only the items with valid dates should be in the result
      expect(result).toHaveLength(2);
      expect(result.some((item) => item.id === 'event-event-1')).toBe(true);
      expect(result.some((item) => item.id === 'encounter-encounter-1')).toBe(true);
      expect(result.some((item) => item.id === 'event-event-2')).toBe(false);
      expect(result.some((item) => item.id === 'encounter-encounter-2')).toBe(false);
    });

    it('should handle empty arrays', () => {
      const result = transformToTimelineItems([], []);

      expect(result).toHaveLength(0);
    });

    it('should pass currentWorldTime for overdue detection', () => {
      const events: Event[] = [
        {
          id: 'event-1',
          campaignId: 'campaign-1',
          name: 'Overdue Event',
          eventType: 'party',
          scheduledAt: '2024-01-01T10:00:00.000Z',
          isCompleted: false,
        },
      ];

      const currentWorldTime = new Date('2024-06-01T00:00:00.000Z');
      const result = transformToTimelineItems(events, [], currentWorldTime);

      expect(result).toHaveLength(1);
      expect(result[0].style).toContain('#ef4444'); // red-500 for overdue
    });
  });
});
