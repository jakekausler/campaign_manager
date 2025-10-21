import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useMemo, useCallback } from 'react';

/**
 * Placeholder types for Event mutations until code generation runs.
 * TODO: Replace with generated types from @/__generated__/graphql once backend is fixed.
 */

export interface UpdateEventInput {
  name?: string;
  description?: string;
  scheduledAt?: string;
  occurredAt?: string;
  isCompleted?: boolean;
  eventType?: string;
  variables?: Record<string, unknown>;
}

export interface Event {
  id: string;
  campaignId: string;
  locationId?: string | null;
  name: string;
  description?: string | null;
  eventType: string;
  scheduledAt?: string | null;
  occurredAt?: string | null;
  isCompleted: boolean;
  variables: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  archivedAt?: string | null;
}

/**
 * GraphQL mutation to update an existing event.
 *
 * Supports updating event fields including scheduledAt for drag-to-reschedule functionality.
 */
export const UPDATE_EVENT = gql`
  mutation UpdateEvent($id: ID!, $input: UpdateEventInput!) {
    updateEvent(id: $id, input: $input) {
      id
      campaignId
      locationId
      name
      description
      eventType
      scheduledAt
      occurredAt
      isCompleted
      variables
      updatedAt
    }
  }
`;

/**
 * Hook to update an event with optimistic UI updates.
 *
 * Provides a mutation function to update event fields, including scheduledAt
 * for drag-to-reschedule operations on the timeline.
 *
 * @returns Object with updateEvent mutation function, loading state, and error state
 *
 * @example
 * ```tsx
 * function EventReschedule({ eventId }: { eventId: string }) {
 *   const { updateEvent, loading, error } = useUpdateEvent();
 *
 *   const handleReschedule = async (newDate: Date) => {
 *     try {
 *       await updateEvent(eventId, {
 *         scheduledAt: newDate.toISOString(),
 *       });
 *       toast.success('Event rescheduled');
 *     } catch (err) {
 *       toast.error('Failed to reschedule event');
 *     }
 *   };
 *
 *   return (
 *     <button onClick={() => handleReschedule(new Date())} disabled={loading}>
 *       Reschedule Event
 *     </button>
 *   );
 * }
 * ```
 */
export function useUpdateEvent() {
  const [mutate, { loading, error, data }] = useMutation<
    { updateEvent: Event },
    { id: string; input: UpdateEventInput }
  >(UPDATE_EVENT, {
    // Refetch queries that display events after mutation
    refetchQueries: ['GetEventsByCampaign'],
    // Use cache-and-network to ensure fresh data
    fetchPolicy: 'network-only',
  });

  // Wrap mutation in a more convenient API
  const updateEvent = useCallback(
    async (id: string, input: UpdateEventInput): Promise<Event> => {
      const result = await mutate({
        variables: { id, input },
      });

      if (!result.data) {
        throw new Error('Failed to update event');
      }

      return result.data.updateEvent;
    },
    [mutate]
  );

  // Return memoized result
  return useMemo(
    () => ({
      updateEvent,
      loading,
      error,
      data: data?.updateEvent,
    }),
    [updateEvent, loading, error, data]
  );
}

/**
 * EffectExecutionSummary - Summary of effects executed during a phase
 */
export interface EffectExecutionSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    effectId: string;
    success: boolean;
    error?: string | null;
  }>;
  executionOrder?: string[] | null;
}

/**
 * EventCompletionResult - Result of completing an event with effect execution
 */
export interface EventCompletionResult {
  event: Event;
  pre: EffectExecutionSummary;
  onResolve: EffectExecutionSummary;
  post: EffectExecutionSummary;
}

/**
 * GraphQL mutation to complete an event with 3-phase effect execution.
 *
 * Executes effects in order: PRE → ON_RESOLVE → POST
 * Marks the event as completed and sets occurredAt timestamp.
 */
export const COMPLETE_EVENT = gql`
  mutation CompleteEvent($id: ID!) {
    completeEvent(id: $id) {
      event {
        id
        campaignId
        locationId
        name
        description
        eventType
        scheduledAt
        occurredAt
        isCompleted
        variables
        updatedAt
      }
      pre {
        total
        succeeded
        failed
        results {
          effectId
          success
          error
        }
        executionOrder
      }
      onResolve {
        total
        succeeded
        failed
        results {
          effectId
          success
          error
        }
        executionOrder
      }
      post {
        total
        succeeded
        failed
        results {
          effectId
          success
          error
        }
        executionOrder
      }
    }
  }
`;

/**
 * Hook to complete an event with automatic effect execution.
 *
 * Provides a mutation function to complete an event, which triggers
 * 3-phase effect execution (PRE → ON_RESOLVE → POST). The event is
 * marked as completed and the occurredAt timestamp is set.
 *
 * @returns Object with completeEvent mutation function, loading state, error state, and result data
 *
 * @example
 * ```tsx
 * function EventResolution({ eventId }: { eventId: string }) {
 *   const { completeEvent, loading, error, data } = useCompleteEvent();
 *
 *   const handleComplete = async () => {
 *     try {
 *       const result = await completeEvent(eventId);
 *       console.log(`Completed event ${result.event.id}`);
 *       console.log(`PRE: ${result.pre.succeeded}/${result.pre.total} effects succeeded`);
 *       console.log(`ON_RESOLVE: ${result.onResolve.succeeded}/${result.onResolve.total} effects succeeded`);
 *       console.log(`POST: ${result.post.succeeded}/${result.post.total} effects succeeded`);
 *       toast.success('Event completed successfully');
 *     } catch (err) {
 *       toast.error('Failed to complete event');
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleComplete} disabled={loading}>
 *       {loading ? 'Completing...' : 'Complete Event'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useCompleteEvent() {
  const [mutate, { loading, error, data }] = useMutation<
    { completeEvent: EventCompletionResult },
    { id: string }
  >(COMPLETE_EVENT, {
    // Refetch queries that display events after completion
    refetchQueries: ['GetEventsByCampaign', 'GetEventById'],
    // Use network-only to ensure fresh data
    fetchPolicy: 'network-only',
  });

  // Wrap mutation in a more convenient API
  const completeEvent = useCallback(
    async (id: string): Promise<EventCompletionResult> => {
      const result = await mutate({
        variables: { id },
      });

      if (!result.data) {
        throw new Error('Failed to complete event');
      }

      return result.data.completeEvent;
    },
    [mutate]
  );

  // Return memoized result
  return useMemo(
    () => ({
      completeEvent,
      loading,
      error,
      data: data?.completeEvent,
    }),
    [completeEvent, loading, error, data]
  );
}
