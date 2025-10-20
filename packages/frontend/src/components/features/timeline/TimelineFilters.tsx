import { memo } from 'react';

import type {
  TimelineFilters as FilterConfig,
  EventType,
  StatusFilter,
  GroupStrategy,
} from '@/utils/timeline-filters';

/**
 * Timeline filter panel component
 *
 * Provides UI controls for filtering timeline items by event type and status,
 * plus controls for lane grouping. Filter changes are propagated via onChange callback.
 *
 * Part of TICKET-022 Stage 11 implementation.
 */

/**
 * Props for TimelineFilters component
 */
export interface TimelineFiltersProps {
  /**
   * Current filter configuration
   */
  filters: FilterConfig;

  /**
   * Callback fired when filters change
   */
  onChange: (filters: FilterConfig) => void;

  /**
   * Optional CSS class name for custom styling
   */
  className?: string;
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  story: 'Story',
  kingdom: 'Kingdom',
  party: 'Party',
  world: 'World',
};

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  completed: 'Completed',
  scheduled: 'Scheduled',
  overdue: 'Overdue',
  resolved: 'Resolved (Encounters)',
  unresolved: 'Unresolved (Encounters)',
};

const GROUP_STRATEGY_LABELS: Record<GroupStrategy, string> = {
  none: 'No Grouping',
  type: 'By Type',
  location: 'By Location',
};

/**
 * TimelineFilters component
 *
 * Renders filter controls for the timeline view. Allows users to filter by:
 * - Event type (story, kingdom, party, world)
 * - Status (all, completed, scheduled, overdue, resolved, unresolved)
 * - Grouping strategy (none, type, location)
 *
 * @example
 * ```tsx
 * <TimelineFilters
 *   filters={filters}
 *   onChange={(newFilters) => setFilters(newFilters)}
 * />
 * ```
 */
export const TimelineFilters = memo<TimelineFiltersProps>(({ filters, onChange, className }) => {
  const handleEventTypeToggle = (eventType: EventType) => {
    const newEventTypes = filters.eventTypes.includes(eventType)
      ? filters.eventTypes.filter((t) => t !== eventType)
      : [...filters.eventTypes, eventType];

    // Ensure at least one event type is selected
    if (newEventTypes.length === 0) {
      return;
    }

    onChange({
      ...filters,
      eventTypes: newEventTypes,
    });
  };

  const handleStatusFilterToggle = (statusFilter: StatusFilter) => {
    // Handle "all" special case
    if (statusFilter === 'all') {
      // If "all" was selected, deselect everything else
      if (filters.statusFilters.includes('all')) {
        return; // Can't deselect "all" when it's the only option
      }
      // Select "all" and deselect everything else
      onChange({
        ...filters,
        statusFilters: ['all'],
      });
      return;
    }

    // Handle specific status filters
    const currentFilters = filters.statusFilters.filter((f) => f !== 'all');
    const newFilters = currentFilters.includes(statusFilter)
      ? currentFilters.filter((f) => f !== statusFilter)
      : [...currentFilters, statusFilter];

    // If no specific filters remain, default to "all"
    if (newFilters.length === 0) {
      onChange({
        ...filters,
        statusFilters: ['all'],
      });
      return;
    }

    onChange({
      ...filters,
      statusFilters: newFilters,
    });
  };

  const handleGroupStrategyChange = (strategy: GroupStrategy) => {
    onChange({
      ...filters,
      groupBy: strategy,
    });
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Event Type Filters */}
        <div>
          <h3 className="text-sm font-medium mb-2">Event Types</h3>
          <div className="space-y-1">
            {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([type, label]) => (
              <label key={type} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.eventTypes.includes(type)}
                  onChange={() => handleEventTypeToggle(type)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Status Filters */}
        <div>
          <h3 className="text-sm font-medium mb-2">Status</h3>
          <div className="space-y-1">
            {(Object.entries(STATUS_FILTER_LABELS) as [StatusFilter, string][]).map(
              ([status, label]) => (
                <label key={status} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.statusFilters.includes(status)}
                    onChange={() => handleStatusFilterToggle(status)}
                    disabled={status === 'all' && filters.statusFilters.includes('all')}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              )
            )}
          </div>
        </div>

        {/* Lane Grouping */}
        <div>
          <h3 className="text-sm font-medium mb-2">Lane Grouping</h3>
          <div className="space-y-1">
            {(Object.entries(GROUP_STRATEGY_LABELS) as [GroupStrategy, string][]).map(
              ([strategy, label]) => (
                <label key={strategy} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="groupStrategy"
                    checked={filters.groupBy === strategy}
                    onChange={() => handleGroupStrategyChange(strategy)}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

TimelineFilters.displayName = 'TimelineFilters';
