import type { TimelineItem } from 'vis-timeline/types';

/**
 * Timeline transformation utilities
 *
 * Transforms GraphQL event and encounter data into vis-timeline item format.
 * Handles date conversion, type-based styling, and null/undefined date handling.
 *
 * Part of TICKET-022 Stage 3 implementation.
 */

/**
 * Event type as returned from GraphQL (placeholder until codegen runs)
 */
export interface Event {
  id: string;
  name: string;
  description?: string | null;
  eventType: string;
  scheduledAt?: string | null;
  occurredAt?: string | null;
  isCompleted: boolean;
  locationId?: string | null;
  campaignId: string;
}

/**
 * Encounter type as returned from GraphQL (placeholder until codegen runs)
 */
export interface Encounter {
  id: string;
  name: string;
  description?: string | null;
  difficulty?: number | null;
  scheduledAt?: string | null;
  isResolved: boolean;
  resolvedAt?: string | null;
  locationId?: string | null;
  campaignId: string;
}

/**
 * Color scheme for timeline items based on status
 *
 * Matches the color scheme documented in implementation plan:
 * - Completed events: green
 * - Scheduled events: blue
 * - Overdue events: red
 * - Resolved encounters: green
 * - Unresolved encounters: orange
 */
const COLORS = {
  EVENT_COMPLETED: '#10b981', // green-500
  EVENT_SCHEDULED: '#3b82f6', // blue-500
  EVENT_OVERDUE: '#ef4444', // red-500
  ENCOUNTER_RESOLVED: '#059669', // green-600
  ENCOUNTER_UNRESOLVED: '#f97316', // orange-500
} as const;

/**
 * Determine event color based on completion status and scheduling
 *
 * @param event - The event to determine color for
 * @param currentWorldTime - Optional current world time for overdue detection
 * @returns CSS color string
 */
function getEventColor(event: Event, currentWorldTime?: Date): string {
  if (event.isCompleted) {
    return COLORS.EVENT_COMPLETED;
  }

  // Check if event is overdue (scheduled in past but not completed)
  if (event.scheduledAt && currentWorldTime) {
    const scheduledDate = new Date(event.scheduledAt);
    if (scheduledDate < currentWorldTime) {
      return COLORS.EVENT_OVERDUE;
    }
  }

  return COLORS.EVENT_SCHEDULED;
}

/**
 * Determine encounter color based on resolution status
 *
 * @param encounter - The encounter to determine color for
 * @returns CSS color string
 */
function getEncounterColor(encounter: Encounter): string {
  return encounter.isResolved ? COLORS.ENCOUNTER_RESOLVED : COLORS.ENCOUNTER_UNRESOLVED;
}

/**
 * Transform a GraphQL Event into a vis-timeline TimelineItem
 *
 * Handles both completed and scheduled events:
 * - Completed events use occurredAt as the timeline point
 * - Scheduled events use scheduledAt as the timeline point
 * - If neither date is available, the item is not created (returns null)
 *
 * @param event - The event from GraphQL
 * @param currentWorldTime - Optional current world time for overdue detection
 * @returns TimelineItem or null if event has no valid dates
 *
 * @example
 * ```ts
 * const event = {
 *   id: 'event-1',
 *   name: 'Royal Festival',
 *   scheduledAt: '2024-06-15T12:00:00.000Z',
 *   occurredAt: '2024-06-15T14:00:00.000Z',
 *   isCompleted: true,
 *   eventType: 'kingdom',
 * };
 * const item = transformEventToTimelineItem(event);
 * // Returns: { id: 'event-event-1', content: 'Royal Festival', start: Date(...), ... }
 * ```
 */
export function transformEventToTimelineItem(
  event: Event,
  currentWorldTime?: Date
): TimelineItem | null {
  // Determine which date to use for the timeline
  // Priority: occurredAt (if completed) > scheduledAt
  let start: Date | null = null;

  if (event.isCompleted && event.occurredAt) {
    start = new Date(event.occurredAt);
  } else if (event.scheduledAt) {
    start = new Date(event.scheduledAt);
  }

  // If no valid date, cannot create timeline item
  if (!start) {
    return null;
  }

  const color = getEventColor(event, currentWorldTime);
  const status = event.isCompleted
    ? 'Completed'
    : currentWorldTime && event.scheduledAt && new Date(event.scheduledAt) < currentWorldTime
      ? 'Overdue'
      : 'Scheduled';

  return {
    id: `event-${event.id}`,
    content: event.name,
    start,
    // Metadata for drag-to-reschedule validation (must come BEFORE type: 'point')
    ...({
      type: 'event',
      isCompleted: event.isCompleted,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any satisfies Record<string, unknown>),
    type: 'point', // vis-timeline type (must come AFTER metadata to avoid being overwritten)
    className: 'timeline-item-event',
    style: `background-color: ${color}; border-color: ${color};`,
    title: `Event: ${event.name}\nType: ${event.eventType}\nStatus: ${status}${event.description ? `\n${event.description}` : ''}`,
    editable: !event.isCompleted, // Can't reschedule completed events
  };
}

/**
 * Transform a GraphQL Encounter into a vis-timeline TimelineItem
 *
 * Handles both resolved and unresolved encounters:
 * - Resolved encounters use resolvedAt as the timeline point
 * - Scheduled encounters use scheduledAt as the timeline point
 * - If no valid date is available, the item is not created (returns null)
 *
 * @param encounter - The encounter from GraphQL
 * @returns TimelineItem or null if encounter has no valid dates
 *
 * @example
 * ```ts
 * const encounter = {
 *   id: 'encounter-1',
 *   name: 'Bandit Ambush',
 *   difficulty: 5,
 *   isResolved: true,
 *   resolvedAt: '2024-05-10T16:30:00.000Z',
 * };
 * const item = transformEncounterToTimelineItem(encounter);
 * // Returns: { id: 'encounter-encounter-1', content: 'Bandit Ambush', start: Date(...), ... }
 * ```
 */
export function transformEncounterToTimelineItem(encounter: Encounter): TimelineItem | null {
  let start: Date | null = null;

  // Prioritize resolvedAt for resolved encounters, otherwise use scheduledAt
  if (encounter.isResolved && encounter.resolvedAt) {
    start = new Date(encounter.resolvedAt);
  } else if (encounter.scheduledAt) {
    start = new Date(encounter.scheduledAt);
  }

  // If no valid date, cannot create timeline item
  if (!start) {
    return null;
  }

  const color = getEncounterColor(encounter);
  const status = encounter.isResolved ? 'Resolved' : 'Unresolved';
  const difficultyLabel = encounter.difficulty ? ` (Difficulty: ${encounter.difficulty})` : '';

  return {
    id: `encounter-${encounter.id}`,
    content: encounter.name,
    start,
    // Metadata for drag-to-reschedule validation (must come BEFORE type: 'point')
    ...({
      type: 'encounter',
      isResolved: encounter.isResolved,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any satisfies Record<string, unknown>),
    type: 'point', // vis-timeline type (must come AFTER metadata to avoid being overwritten)
    className: 'timeline-item-encounter',
    style: `background-color: ${color}; border-color: ${color};`,
    title: `Encounter: ${encounter.name}\nStatus: ${status}${difficultyLabel}${encounter.description ? `\n${encounter.description}` : ''}`,
    editable: !encounter.isResolved, // Can't reschedule resolved encounters
  };
}

/**
 * Transform an array of Events and Encounters into vis-timeline TimelineItems
 *
 * Combines both event and encounter transformations, filtering out items
 * that don't have valid dates.
 *
 * @param events - Array of events from GraphQL
 * @param encounters - Array of encounters from GraphQL
 * @param currentWorldTime - Optional current world time for overdue detection
 * @returns Array of TimelineItems
 *
 * @example
 * ```ts
 * const items = transformToTimelineItems(events, encounters, currentTime);
 * <Timeline items={items} />
 * ```
 */
export function transformToTimelineItems(
  events: Event[],
  encounters: Encounter[],
  currentWorldTime?: Date
): TimelineItem[] {
  const eventItems = events
    .map((event) => transformEventToTimelineItem(event, currentWorldTime))
    .filter((item): item is TimelineItem => item !== null);

  const encounterItems = encounters
    .map((encounter) => transformEncounterToTimelineItem(encounter))
    .filter((item): item is TimelineItem => item !== null);

  return [...eventItems, ...encounterItems];
}
