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
