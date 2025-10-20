import type { TimelineItem } from 'vis-timeline/types';
import { describe, it, expect } from 'vitest';

import {
  DEFAULT_FILTERS,
  matchesEventTypeFilter,
  getEventStatus,
  getEncounterStatus,
  matchesEventStatusFilter,
  matchesEncounterStatusFilter,
  filterEvents,
  filterEncounters,
  assignGroupToItem,
  applyGrouping,
  parseFiltersFromURL,
  serializeFiltersToURL,
  type TimelineFilters,
} from './timeline-filters';
import type { Event, Encounter } from './timeline-transforms';

/**
 * Unit tests for timeline filtering and grouping utilities
 *
 * Part of TICKET-022 Stage 11 implementation.
 */

// Mock data
const mockEvent: Event = {
  id: 'event-1',
  name: 'Royal Festival',
  description: 'Annual celebration',
  eventType: 'kingdom',
  scheduledAt: '2024-06-15T12:00:00.000Z',
  occurredAt: null,
  isCompleted: false,
  locationId: 'location-1',
  campaignId: 'campaign-1',
};

const mockCompletedEvent: Event = {
  ...mockEvent,
  id: 'event-2',
  name: 'Harvest Festival',
  occurredAt: '2024-09-15T14:00:00.000Z',
  isCompleted: true,
};

const mockOverdueEvent: Event = {
  ...mockEvent,
  id: 'event-3',
  name: 'Overdue Event',
  eventType: 'story',
  scheduledAt: '2024-01-01T12:00:00.000Z', // Far in the past
  isCompleted: false,
};

const mockEncounter: Encounter = {
  id: 'encounter-1',
  name: 'Dragon Attack',
  description: 'A fearsome dragon appears',
  difficulty: 15,
  scheduledAt: '2024-06-20T10:00:00.000Z',
  isResolved: false,
  resolvedAt: null,
  locationId: 'location-2',
  campaignId: 'campaign-1',
};

const mockResolvedEncounter: Encounter = {
  ...mockEncounter,
  id: 'encounter-2',
  name: 'Bandit Ambush',
  difficulty: 5,
  isResolved: true,
  resolvedAt: '2024-05-10T16:30:00.000Z',
};

const currentWorldTime = new Date('2024-06-01T00:00:00.000Z');

describe('timeline-filters', () => {
  describe('DEFAULT_FILTERS', () => {
    it('should have all event types enabled', () => {
      expect(DEFAULT_FILTERS.eventTypes).toEqual(['story', 'kingdom', 'party', 'world']);
    });

    it('should have "all" status filter by default', () => {
      expect(DEFAULT_FILTERS.statusFilters).toEqual(['all']);
    });

    it('should have no grouping by default', () => {
      expect(DEFAULT_FILTERS.groupBy).toBe('none');
    });
  });

  describe('matchesEventTypeFilter', () => {
    it('should return true when event type matches filter', () => {
      expect(matchesEventTypeFilter(mockEvent, ['kingdom'])).toBe(true);
    });

    it('should return true when event type is in filter array', () => {
      expect(matchesEventTypeFilter(mockEvent, ['story', 'kingdom', 'world'])).toBe(true);
    });

    it('should return false when event type does not match', () => {
      expect(matchesEventTypeFilter(mockEvent, ['story'])).toBe(false);
    });

    it('should return false with empty filter array', () => {
      expect(matchesEventTypeFilter(mockEvent, [])).toBe(false);
    });
  });

  describe('getEventStatus', () => {
    it('should return "completed" for completed events', () => {
      expect(getEventStatus(mockCompletedEvent)).toBe('completed');
    });

    it('should return "scheduled" for future events', () => {
      expect(getEventStatus(mockEvent, currentWorldTime)).toBe('scheduled');
    });

    it('should return "overdue" for past scheduled events', () => {
      expect(getEventStatus(mockOverdueEvent, currentWorldTime)).toBe('overdue');
    });

    it('should return "scheduled" when currentWorldTime is not provided', () => {
      expect(getEventStatus(mockOverdueEvent)).toBe('scheduled');
    });
  });

  describe('getEncounterStatus', () => {
    it('should return "resolved" for resolved encounters', () => {
      expect(getEncounterStatus(mockResolvedEncounter)).toBe('resolved');
    });

    it('should return "unresolved" for unresolved encounters', () => {
      expect(getEncounterStatus(mockEncounter)).toBe('unresolved');
    });
  });

  describe('matchesEventStatusFilter', () => {
    it('should return true when "all" filter is included', () => {
      expect(matchesEventStatusFilter(mockEvent, ['all'], currentWorldTime)).toBe(true);
      expect(matchesEventStatusFilter(mockCompletedEvent, ['all'], currentWorldTime)).toBe(true);
      expect(matchesEventStatusFilter(mockOverdueEvent, ['all'], currentWorldTime)).toBe(true);
    });

    it('should return true when event status matches filter', () => {
      expect(matchesEventStatusFilter(mockCompletedEvent, ['completed'], currentWorldTime)).toBe(
        true
      );
      expect(matchesEventStatusFilter(mockEvent, ['scheduled'], currentWorldTime)).toBe(true);
      expect(matchesEventStatusFilter(mockOverdueEvent, ['overdue'], currentWorldTime)).toBe(true);
    });

    it('should return false when event status does not match', () => {
      expect(matchesEventStatusFilter(mockCompletedEvent, ['scheduled'], currentWorldTime)).toBe(
        false
      );
      expect(matchesEventStatusFilter(mockEvent, ['completed'], currentWorldTime)).toBe(false);
    });

    it('should handle multiple status filters', () => {
      expect(
        matchesEventStatusFilter(mockEvent, ['completed', 'scheduled'], currentWorldTime)
      ).toBe(true);
      expect(
        matchesEventStatusFilter(mockCompletedEvent, ['completed', 'overdue'], currentWorldTime)
      ).toBe(true);
    });
  });

  describe('matchesEncounterStatusFilter', () => {
    it('should return true when "all" filter is included', () => {
      expect(matchesEncounterStatusFilter(mockEncounter, ['all'])).toBe(true);
      expect(matchesEncounterStatusFilter(mockResolvedEncounter, ['all'])).toBe(true);
    });

    it('should return true when encounter status matches filter', () => {
      expect(matchesEncounterStatusFilter(mockResolvedEncounter, ['resolved'])).toBe(true);
      expect(matchesEncounterStatusFilter(mockEncounter, ['unresolved'])).toBe(true);
    });

    it('should return false when encounter status does not match', () => {
      expect(matchesEncounterStatusFilter(mockResolvedEncounter, ['unresolved'])).toBe(false);
      expect(matchesEncounterStatusFilter(mockEncounter, ['resolved'])).toBe(false);
    });
  });

  describe('filterEvents', () => {
    const events = [mockEvent, mockCompletedEvent, mockOverdueEvent];

    it('should filter by event type', () => {
      const filters: TimelineFilters = {
        eventTypes: ['kingdom'],
        statusFilters: ['all'],
        groupBy: 'none',
      };
      const result = filterEvents(events, filters, currentWorldTime);
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.eventType === 'kingdom')).toBe(true);
    });

    it('should filter by status', () => {
      const filters: TimelineFilters = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['completed'],
        groupBy: 'none',
      };
      const result = filterEvents(events, filters, currentWorldTime);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('event-2');
    });

    it('should filter by overdue status', () => {
      const filters: TimelineFilters = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['overdue'],
        groupBy: 'none',
      };
      const result = filterEvents(events, filters, currentWorldTime);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('event-3');
    });

    it('should combine event type and status filters', () => {
      const filters: TimelineFilters = {
        eventTypes: ['kingdom'],
        statusFilters: ['scheduled'],
        groupBy: 'none',
      };
      const result = filterEvents(events, filters, currentWorldTime);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('event-1');
    });

    it('should return all events with "all" status filter', () => {
      const filters: TimelineFilters = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['all'],
        groupBy: 'none',
      };
      const result = filterEvents(events, filters, currentWorldTime);
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no events match', () => {
      const filters: TimelineFilters = {
        eventTypes: ['party'],
        statusFilters: ['completed'],
        groupBy: 'none',
      };
      const result = filterEvents(events, filters, currentWorldTime);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterEncounters', () => {
    const encounters = [mockEncounter, mockResolvedEncounter];

    it('should filter by resolved status', () => {
      const filters: TimelineFilters = {
        eventTypes: [],
        statusFilters: ['resolved'],
        groupBy: 'none',
      };
      const result = filterEncounters(encounters, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('encounter-2');
    });

    it('should filter by unresolved status', () => {
      const filters: TimelineFilters = {
        eventTypes: [],
        statusFilters: ['unresolved'],
        groupBy: 'none',
      };
      const result = filterEncounters(encounters, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('encounter-1');
    });

    it('should return all encounters with "all" status filter', () => {
      const filters: TimelineFilters = {
        eventTypes: [],
        statusFilters: ['all'],
        groupBy: 'none',
      };
      const result = filterEncounters(encounters, filters);
      expect(result).toHaveLength(2);
    });
  });

  describe('assignGroupToItem', () => {
    const eventItem: TimelineItem = {
      id: 'event-event-1',
      content: 'Test Event',
      start: new Date(),
    };

    const encounterItem: TimelineItem = {
      id: 'encounter-encounter-1',
      content: 'Test Encounter',
      start: new Date(),
    };

    it('should return undefined for "none" grouping', () => {
      expect(assignGroupToItem(eventItem, 'none', mockEvent)).toBeUndefined();
    });

    it('should group events and encounters separately for "type" grouping', () => {
      expect(assignGroupToItem(eventItem, 'type', mockEvent)).toBe('Events');
      expect(assignGroupToItem(encounterItem, 'type', undefined, mockEncounter)).toBe('Encounters');
    });

    it('should group by location ID for "location" grouping', () => {
      expect(assignGroupToItem(eventItem, 'location', mockEvent)).toBe('location-1');
      expect(assignGroupToItem(encounterItem, 'location', undefined, mockEncounter)).toBe(
        'location-2'
      );
    });

    it('should use "No Location" group when location is null', () => {
      const eventWithoutLocation = { ...mockEvent, locationId: null };
      expect(assignGroupToItem(eventItem, 'location', eventWithoutLocation)).toBe('No Location');
    });
  });

  describe('applyGrouping', () => {
    const events = [mockEvent, mockCompletedEvent];
    const encounters = [mockEncounter];

    const items: TimelineItem[] = [
      { id: 'event-event-1', content: 'Event 1', start: new Date() },
      { id: 'event-event-2', content: 'Event 2', start: new Date() },
      { id: 'encounter-encounter-1', content: 'Encounter 1', start: new Date() },
    ];

    it('should remove group property for "none" grouping', () => {
      const itemsWithGroups = items.map((item) => ({ ...item, group: 'OldGroup' }));
      const result = applyGrouping(itemsWithGroups, 'none', events, encounters);
      expect(result.every((item) => !('group' in item))).toBe(true);
    });

    it('should assign "Events" and "Encounters" groups for "type" grouping', () => {
      const result = applyGrouping(items, 'type', events, encounters);
      expect(result[0].group).toBe('Events');
      expect(result[1].group).toBe('Events');
      expect(result[2].group).toBe('Encounters');
    });

    it('should assign location groups for "location" grouping', () => {
      const result = applyGrouping(items, 'location', events, encounters);
      expect(result[0].group).toBe('location-1');
      expect(result[1].group).toBe('location-1');
      expect(result[2].group).toBe('location-2');
    });

    it('should handle items without matching event/encounter data', () => {
      const orphanItems: TimelineItem[] = [
        { id: 'event-unknown', content: 'Unknown Event', start: new Date() },
      ];
      const result = applyGrouping(orphanItems, 'type', events, encounters);
      expect(result[0].group).toBe('Events'); // Falls back to ID-based detection
    });
  });

  describe('parseFiltersFromURL', () => {
    it('should parse event types from URL', () => {
      const params = new URLSearchParams('types=story,kingdom');
      const filters = parseFiltersFromURL(params);
      expect(filters.eventTypes).toEqual(['story', 'kingdom']);
    });

    it('should parse status filters from URL', () => {
      const params = new URLSearchParams('status=completed,overdue');
      const filters = parseFiltersFromURL(params);
      expect(filters.statusFilters).toEqual(['completed', 'overdue']);
    });

    it('should parse group strategy from URL', () => {
      const params = new URLSearchParams('group=type');
      const filters = parseFiltersFromURL(params);
      expect(filters.groupBy).toBe('type');
    });

    it('should parse all parameters together', () => {
      const params = new URLSearchParams('types=story&status=completed&group=location');
      const filters = parseFiltersFromURL(params);
      expect(filters).toEqual({
        eventTypes: ['story'],
        statusFilters: ['completed'],
        groupBy: 'location',
      });
    });

    it('should return defaults for empty URL', () => {
      const params = new URLSearchParams('');
      const filters = parseFiltersFromURL(params);
      expect(filters).toEqual(DEFAULT_FILTERS);
    });

    it('should filter out invalid event types', () => {
      const params = new URLSearchParams('types=story,invalid,kingdom');
      const filters = parseFiltersFromURL(params);
      expect(filters.eventTypes).toEqual(['story', 'kingdom']);
    });

    it('should filter out invalid status filters', () => {
      const params = new URLSearchParams('status=completed,invalid,overdue');
      const filters = parseFiltersFromURL(params);
      expect(filters.statusFilters).toEqual(['completed', 'overdue']);
    });

    it('should use default for invalid group strategy', () => {
      const params = new URLSearchParams('group=invalid');
      const filters = parseFiltersFromURL(params);
      expect(filters.groupBy).toBe('none');
    });

    it('should return defaults when all filters are invalid', () => {
      const params = new URLSearchParams('types=invalid&status=invalid&group=invalid');
      const filters = parseFiltersFromURL(params);
      expect(filters.eventTypes).toEqual(DEFAULT_FILTERS.eventTypes);
      expect(filters.statusFilters).toEqual(DEFAULT_FILTERS.statusFilters);
      expect(filters.groupBy).toBe(DEFAULT_FILTERS.groupBy);
    });
  });

  describe('serializeFiltersToURL', () => {
    it('should serialize event types to URL', () => {
      const filters: TimelineFilters = {
        eventTypes: ['story', 'kingdom'],
        statusFilters: ['all'],
        groupBy: 'none',
      };
      const params = serializeFiltersToURL(filters);
      expect(params.get('types')).toBe('story,kingdom');
    });

    it('should serialize status filters to URL', () => {
      const filters: TimelineFilters = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['completed', 'overdue'],
        groupBy: 'none',
      };
      const params = serializeFiltersToURL(filters);
      expect(params.get('status')).toBe('completed,overdue');
    });

    it('should serialize group strategy to URL', () => {
      const filters: TimelineFilters = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['all'],
        groupBy: 'type',
      };
      const params = serializeFiltersToURL(filters);
      expect(params.get('group')).toBe('type');
    });

    it('should not include parameters that match defaults', () => {
      const filters = DEFAULT_FILTERS;
      const params = serializeFiltersToURL(filters);
      expect(params.toString()).toBe('');
    });

    it('should round-trip with parseFiltersFromURL', () => {
      const original: TimelineFilters = {
        eventTypes: ['story'],
        statusFilters: ['completed', 'overdue'],
        groupBy: 'location',
      };
      const params = serializeFiltersToURL(original);
      const parsed = parseFiltersFromURL(params);
      expect(parsed).toEqual(original);
    });
  });
});
