import { describe, it, expect } from 'vitest';

import { validateScheduledTime, canRescheduleItem } from './timeline-validation';

describe('timeline-validation', () => {
  describe('validateScheduledTime', () => {
    it('should allow scheduling in the future when currentWorldTime is provided', () => {
      const currentTime = new Date('2024-06-15T10:00:00Z');
      const scheduledTime = new Date('2024-06-16T10:00:00Z'); // 1 day in future

      const result = validateScheduledTime(scheduledTime, currentTime);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject scheduling in the past when currentWorldTime is provided', () => {
      const currentTime = new Date('2024-06-15T10:00:00Z');
      const scheduledTime = new Date('2024-06-14T10:00:00Z'); // 1 day in past

      const result = validateScheduledTime(scheduledTime, currentTime);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot schedule in the past');
    });

    it('should allow any time when currentWorldTime is not provided', () => {
      const scheduledTime = new Date('2020-01-01T00:00:00Z'); // Far in past

      const result = validateScheduledTime(scheduledTime, undefined);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should allow scheduling at exactly currentWorldTime', () => {
      const currentTime = new Date('2024-06-15T10:00:00Z');
      const scheduledTime = new Date('2024-06-15T10:00:00Z'); // Exactly now

      const result = validateScheduledTime(scheduledTime, currentTime);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject scheduling at 1 second before currentWorldTime', () => {
      const currentTime = new Date('2024-06-15T10:00:00Z');
      const scheduledTime = new Date('2024-06-15T09:59:59Z'); // 1 second before

      const result = validateScheduledTime(scheduledTime, currentTime);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot schedule in the past');
    });
  });

  describe('canRescheduleItem', () => {
    it('should allow rescheduling scheduled event', () => {
      const item = {
        id: 'event-1',
        content: 'Test Event',
        start: new Date('2024-07-01T00:00:00Z'),
        editable: true,
        type: 'event' as const,
        isCompleted: false,
      };

      const result = canRescheduleItem(item);

      expect(result.canReschedule).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should prevent rescheduling completed event', () => {
      const item = {
        id: 'event-1',
        content: 'Completed Event',
        start: new Date('2024-07-01T00:00:00Z'),
        editable: false,
        type: 'event' as const,
        isCompleted: true,
      };

      const result = canRescheduleItem(item);

      expect(result.canReschedule).toBe(false);
      expect(result.reason).toBe('Cannot reschedule completed events');
    });

    it('should allow rescheduling unresolved encounter', () => {
      const item = {
        id: 'encounter-1',
        content: 'Goblin Attack',
        start: new Date('2024-07-05T00:00:00Z'),
        editable: true,
        type: 'encounter' as const,
        isResolved: false,
      };

      const result = canRescheduleItem(item);

      expect(result.canReschedule).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should prevent rescheduling resolved encounter', () => {
      const item = {
        id: 'encounter-1',
        content: 'Resolved Encounter',
        start: new Date('2024-07-05T00:00:00Z'),
        editable: false,
        type: 'encounter' as const,
        isResolved: true,
      };

      const result = canRescheduleItem(item);

      expect(result.canReschedule).toBe(false);
      expect(result.reason).toBe('Cannot reschedule resolved encounters');
    });

    it('should prevent rescheduling non-editable items', () => {
      const item = {
        id: 'event-1',
        content: 'Non-editable Event',
        start: new Date('2024-07-01T00:00:00Z'),
        editable: false,
        type: 'event' as const,
        isCompleted: false,
      };

      const result = canRescheduleItem(item);

      expect(result.canReschedule).toBe(false);
      expect(result.reason).toBe('This item cannot be rescheduled');
    });

    it('should handle items without type information', () => {
      const item = {
        id: 'unknown-1',
        content: 'Unknown Item',
        start: new Date('2024-07-01T00:00:00Z'),
        editable: true,
      };

      const result = canRescheduleItem(item);

      expect(result.canReschedule).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });
});
