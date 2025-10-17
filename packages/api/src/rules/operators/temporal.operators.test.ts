/**
 * Temporal Operators Tests
 */

import { MockTemporalService } from './__mocks__/temporal.service.mock';
import { createDaysSinceOperator } from './temporal.operators';

describe('Temporal Operators', () => {
  let mockTemporalService: MockTemporalService;

  beforeEach(() => {
    mockTemporalService = new MockTemporalService();
  });

  afterEach(() => {
    mockTemporalService.clear();
  });

  describe('createDaysSinceOperator', () => {
    it('should create an operator with correct name and description', () => {
      const operator = createDaysSinceOperator(mockTemporalService);

      expect(operator.name).toBe('daysSince');
      expect(operator.description).toBe('Calculate the number of days since an event occurred');
      expect(typeof operator.implementation).toBe('function');
    });

    describe('implementation', () => {
      it('should return number of days since event', () => {
        const operator = createDaysSinceOperator(mockTemporalService);

        // Set current time to Jan 10, 2024
        const currentTime = new Date('2024-01-10T00:00:00Z');
        mockTemporalService.setCurrentWorldTime(currentTime);

        // Add event that occurred on Jan 1, 2024 (9 days ago)
        const eventTime = new Date('2024-01-01T00:00:00Z');
        mockTemporalService.addEvent('lastVisit', eventTime);

        const result = operator.implementation('lastVisit');

        expect(result).toBe(9);
      });

      it('should return 0 for same-day events', () => {
        const operator = createDaysSinceOperator(mockTemporalService);

        const now = new Date('2024-01-10T12:00:00Z');
        mockTemporalService.setCurrentWorldTime(now);
        mockTemporalService.addEvent('todayEvent', now);

        const result = operator.implementation('todayEvent');

        expect(result).toBe(0);
      });

      it('should handle events from different years', () => {
        const operator = createDaysSinceOperator(mockTemporalService);

        // Current time: Jan 1, 2024
        const currentTime = new Date('2024-01-01T00:00:00Z');
        mockTemporalService.setCurrentWorldTime(currentTime);

        // Event: Jan 1, 2023 (365 days ago)
        const eventTime = new Date('2023-01-01T00:00:00Z');
        mockTemporalService.addEvent('yearAgo', eventTime);

        const result = operator.implementation('yearAgo');

        expect(result).toBe(365);
      });

      it('should return null for non-existent events', () => {
        const operator = createDaysSinceOperator(mockTemporalService);

        mockTemporalService.setCurrentWorldTime(new Date());

        const result = operator.implementation('nonExistentEvent');

        expect(result).toBeNull();
      });

      it('should return null for invalid event path (non-string)', () => {
        const operator = createDaysSinceOperator(mockTemporalService);

        mockTemporalService.setCurrentWorldTime(new Date());

        expect(operator.implementation(123)).toBeNull();
        expect(operator.implementation(null)).toBeNull();
        expect(operator.implementation(undefined)).toBeNull();
        expect(operator.implementation({})).toBeNull();
        expect(operator.implementation([])).toBeNull();
        expect(operator.implementation(true)).toBeNull();
      });

      it('should return null for empty string event path', () => {
        const operator = createDaysSinceOperator(mockTemporalService);

        mockTemporalService.setCurrentWorldTime(new Date());

        const result = operator.implementation('');

        expect(result).toBeNull();
      });

      it('should handle multiple events independently', () => {
        const operator = createDaysSinceOperator(mockTemporalService);

        const currentTime = new Date('2024-01-15T00:00:00Z');
        mockTemporalService.setCurrentWorldTime(currentTime);

        mockTemporalService.addEvent('event1', new Date('2024-01-10T00:00:00Z')); // 5 days ago
        mockTemporalService.addEvent('event2', new Date('2024-01-01T00:00:00Z')); // 14 days ago
        mockTemporalService.addEvent('event3', new Date('2024-01-14T00:00:00Z')); // 1 day ago

        expect(operator.implementation('event1')).toBe(5);
        expect(operator.implementation('event2')).toBe(14);
        expect(operator.implementation('event3')).toBe(1);
      });

      it('should work with nested event paths', () => {
        const operator = createDaysSinceOperator(mockTemporalService);

        const currentTime = new Date('2024-01-10T00:00:00Z');
        mockTemporalService.setCurrentWorldTime(currentTime);

        mockTemporalService.addEvent('character.lastRest', new Date('2024-01-08T00:00:00Z'));

        const result = operator.implementation('character.lastRest');

        expect(result).toBe(2);
      });
    });
  });

  describe('MockTemporalService', () => {
    it('should allow setting and getting current world time', () => {
      const testDate = new Date('2024-06-15T00:00:00Z');
      mockTemporalService.setCurrentWorldTime(testDate);

      // Add an event at the same time
      mockTemporalService.addEvent('now', testDate);

      const result = mockTemporalService.daysSince('now');

      expect(result).toBe(0);
    });

    it('should clear all events and reset time', () => {
      mockTemporalService.setCurrentWorldTime(new Date('2024-01-10T00:00:00Z'));
      mockTemporalService.addEvent('event1', new Date('2024-01-01T00:00:00Z'));
      mockTemporalService.addEvent('event2', new Date('2024-01-05T00:00:00Z'));

      mockTemporalService.clear();

      expect(mockTemporalService.daysSince('event1')).toBeNull();
      expect(mockTemporalService.daysSince('event2')).toBeNull();
    });

    it('should handle fractional days correctly (floor)', () => {
      const currentTime = new Date('2024-01-10T18:00:00Z'); // 6 PM on Jan 10
      mockTemporalService.setCurrentWorldTime(currentTime);

      const eventTime = new Date('2024-01-09T06:00:00Z'); // 6 AM on Jan 9
      mockTemporalService.addEvent('event', eventTime);

      // 36 hours = 1.5 days, should floor to 1
      const result = mockTemporalService.daysSince('event');

      expect(result).toBe(1);
    });
  });
});
