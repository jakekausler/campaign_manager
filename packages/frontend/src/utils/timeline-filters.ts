import type { TimelineItem } from 'vis-timeline/types';

import type { Event, Encounter } from './timeline-transforms';

/**
 * Timeline filtering and grouping utilities
 *
 * Provides filtering by event type, completion status, and lane grouping
 * functionality for the timeline view.
 *
 * Part of TICKET-022 Stage 11 implementation.
 */

/**
 * Event types available for filtering
 */
export type EventType = 'story' | 'kingdom' | 'party' | 'world';

/**
 * Status filters for events and encounters
 */
export type StatusFilter =
  | 'all'
  | 'completed'
  | 'scheduled'
  | 'overdue'
  | 'resolved'
  | 'unresolved';

/**
 * Grouping strategy for timeline lanes
 */
export type GroupStrategy = 'none' | 'type' | 'location';

/**
 * Filter configuration
 */
export interface TimelineFilters {
  eventTypes: EventType[];
  statusFilters: StatusFilter[];
  groupBy: GroupStrategy;
}

/**
 * Default filter configuration (show everything, no grouping)
 */
export const DEFAULT_FILTERS: TimelineFilters = {
  eventTypes: ['story', 'kingdom', 'party', 'world'],
  statusFilters: ['all'],
  groupBy: 'none',
};

/**
 * Check if an event matches the given event type filters
 *
 * @param event - The event to check
 * @param eventTypes - Array of event types to allow
 * @returns True if event matches any of the allowed types
 */
export function matchesEventTypeFilter(event: Event, eventTypes: EventType[]): boolean {
  return eventTypes.some((type) => event.eventType === type);
}

/**
 * Determine the status of an event for filtering purposes
 *
 * @param event - The event to determine status for
 * @param currentWorldTime - Optional current world time for overdue detection
 * @returns Status of the event ('completed', 'scheduled', or 'overdue')
 */
export function getEventStatus(event: Event, currentWorldTime?: Date): StatusFilter {
  if (event.isCompleted) {
    return 'completed';
  }

  // Check if event is overdue (scheduled in past but not completed)
  if (event.scheduledAt && currentWorldTime) {
    const scheduledDate = new Date(event.scheduledAt);
    if (scheduledDate < currentWorldTime) {
      return 'overdue';
    }
  }

  return 'scheduled';
}

/**
 * Determine the status of an encounter for filtering purposes
 *
 * @param encounter - The encounter to determine status for
 * @returns Status of the encounter ('resolved' or 'unresolved')
 */
export function getEncounterStatus(encounter: Encounter): StatusFilter {
  return encounter.isResolved ? 'resolved' : 'unresolved';
}

/**
 * Check if an event matches the given status filters
 *
 * @param event - The event to check
 * @param statusFilters - Array of statuses to allow
 * @param currentWorldTime - Optional current world time for overdue detection
 * @returns True if event matches any of the allowed statuses or 'all' is included
 */
export function matchesEventStatusFilter(
  event: Event,
  statusFilters: StatusFilter[],
  currentWorldTime?: Date
): boolean {
  // 'all' filter shows everything
  if (statusFilters.includes('all')) {
    return true;
  }

  const status = getEventStatus(event, currentWorldTime);
  return statusFilters.includes(status);
}

/**
 * Check if an encounter matches the given status filters
 *
 * @param encounter - The encounter to check
 * @param statusFilters - Array of statuses to allow
 * @returns True if encounter matches any of the allowed statuses or 'all' is included
 */
export function matchesEncounterStatusFilter(
  encounter: Encounter,
  statusFilters: StatusFilter[]
): boolean {
  // 'all' filter shows everything
  if (statusFilters.includes('all')) {
    return true;
  }

  const status = getEncounterStatus(encounter);
  return statusFilters.includes(status);
}

/**
 * Filter events based on type and status filters
 *
 * @param events - Array of events to filter
 * @param filters - Filter configuration
 * @param currentWorldTime - Optional current world time for overdue detection
 * @returns Filtered array of events
 */
export function filterEvents(
  events: Event[],
  filters: TimelineFilters,
  currentWorldTime?: Date
): Event[] {
  return events.filter(
    (event) =>
      matchesEventTypeFilter(event, filters.eventTypes) &&
      matchesEventStatusFilter(event, filters.statusFilters, currentWorldTime)
  );
}

/**
 * Filter encounters based on status filters
 *
 * @param encounters - Array of encounters to filter
 * @param filters - Filter configuration
 * @returns Filtered array of encounters
 */
export function filterEncounters(encounters: Encounter[], filters: TimelineFilters): Encounter[] {
  return encounters.filter((encounter) =>
    matchesEncounterStatusFilter(encounter, filters.statusFilters)
  );
}

/**
 * Assign group ID to a timeline item based on grouping strategy
 *
 * @param item - Timeline item (with extended metadata)
 * @param groupBy - Grouping strategy
 * @param event - Original event data (if item is an event)
 * @param encounter - Original encounter data (if item is an encounter)
 * @returns Group ID string or undefined for no grouping
 */
export function assignGroupToItem(
  item: TimelineItem,
  groupBy: GroupStrategy,
  event?: Event,
  encounter?: Encounter
): string | undefined {
  if (groupBy === 'none') {
    return undefined;
  }

  if (groupBy === 'type') {
    // Group by event vs encounter
    return String(item.id).startsWith('event-') ? 'Events' : 'Encounters';
  }

  if (groupBy === 'location') {
    // Group by location ID (or 'No Location' if none)
    const locationId = event?.locationId || encounter?.locationId;
    return locationId || 'No Location';
  }

  return undefined;
}

/**
 * Apply grouping to timeline items
 *
 * Mutates the items array by adding group property to each item.
 *
 * @param items - Array of timeline items
 * @param groupBy - Grouping strategy
 * @param events - Original events data
 * @param encounters - Original encounters data
 * @returns Modified items array with group property assigned
 */
export function applyGrouping(
  items: TimelineItem[],
  groupBy: GroupStrategy,
  events: Event[],
  encounters: Encounter[]
): TimelineItem[] {
  if (groupBy === 'none') {
    // Remove group property if present
    return items.map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { group: _, ...rest } = item as TimelineItem & { group?: string };
      return rest;
    });
  }

  // Build lookup maps for fast access
  const eventMap = new Map(events.map((e) => [`event-${e.id}`, e]));
  const encounterMap = new Map(encounters.map((e) => [`encounter-${e.id}`, e]));

  return items.map((item) => {
    const event = eventMap.get(String(item.id));
    const encounter = encounterMap.get(String(item.id));
    const group = assignGroupToItem(item, groupBy, event, encounter);

    return {
      ...item,
      group,
    };
  });
}

/**
 * Parse filter configuration from URL query params
 *
 * @param searchParams - URLSearchParams object
 * @returns Parsed filter configuration
 *
 * @example
 * ```ts
 * const params = new URLSearchParams('?types=story,kingdom&status=completed&group=type');
 * const filters = parseFiltersFromURL(params);
 * // Returns: { eventTypes: ['story', 'kingdom'], statusFilters: ['completed'], groupBy: 'type' }
 * ```
 */
export function parseFiltersFromURL(searchParams: URLSearchParams): TimelineFilters {
  const typesParam = searchParams.get('types');
  const statusParam = searchParams.get('status');
  const groupParam = searchParams.get('group');

  const eventTypes = typesParam
    ? (typesParam
        .split(',')
        .filter((t) => ['story', 'kingdom', 'party', 'world'].includes(t)) as EventType[])
    : DEFAULT_FILTERS.eventTypes;

  const statusFilters = statusParam
    ? (statusParam
        .split(',')
        .filter((s) =>
          ['all', 'completed', 'scheduled', 'overdue', 'resolved', 'unresolved'].includes(s)
        ) as StatusFilter[])
    : DEFAULT_FILTERS.statusFilters;

  const groupBy = (
    ['none', 'type', 'location'].includes(groupParam || '') ? groupParam : DEFAULT_FILTERS.groupBy
  ) as GroupStrategy;

  return {
    eventTypes: eventTypes.length > 0 ? eventTypes : DEFAULT_FILTERS.eventTypes,
    statusFilters: statusFilters.length > 0 ? statusFilters : DEFAULT_FILTERS.statusFilters,
    groupBy,
  };
}

/**
 * Serialize filter configuration to URL query params
 *
 * @param filters - Filter configuration
 * @returns URLSearchParams object
 *
 * @example
 * ```ts
 * const filters = { eventTypes: ['story'], statusFilters: ['completed'], groupBy: 'type' };
 * const params = serializeFiltersToURL(filters);
 * // Returns: URLSearchParams with '?types=story&status=completed&group=type'
 * ```
 */
export function serializeFiltersToURL(filters: TimelineFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Only add params if they differ from defaults
  const typesChanged =
    filters.eventTypes.length !== DEFAULT_FILTERS.eventTypes.length ||
    !filters.eventTypes.every((t) => DEFAULT_FILTERS.eventTypes.includes(t));

  const statusChanged =
    filters.statusFilters.length !== DEFAULT_FILTERS.statusFilters.length ||
    !filters.statusFilters.every((s) => DEFAULT_FILTERS.statusFilters.includes(s));

  const groupChanged = filters.groupBy !== DEFAULT_FILTERS.groupBy;

  if (typesChanged) {
    params.set('types', filters.eventTypes.join(','));
  }

  if (statusChanged) {
    params.set('status', filters.statusFilters.join(','));
  }

  if (groupChanged) {
    params.set('group', filters.groupBy);
  }

  return params;
}
