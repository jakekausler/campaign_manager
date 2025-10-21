import { gql } from '@apollo/client';
import { useQuery, type QueryHookOptions } from '@apollo/client/react';
import { useMemo } from 'react';

// TODO: Once codegen runs successfully, import generated types:
// import type {
//   GetEventsByCampaignQuery,
//   GetEventsByCampaignQueryVariables,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs
type Event = {
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
};

type GetEventsByCampaignQuery = {
  eventsByCampaign: Event[];
};

type GetEventsByCampaignQueryVariables = {
  campaignId: string;
};

type GetEventByIdQuery = {
  event: Event | null;
};

type GetEventByIdQueryVariables = {
  id: string;
};

/**
 * GraphQL query to get all events for a specific campaign.
 *
 * This query fetches a list of events with their scheduling information,
 * including scheduled and occurred timestamps, completion status, and event type.
 *
 * @param campaignId - The ID of the campaign to query events for
 * @returns Array of Event objects
 */
export const GET_EVENTS_BY_CAMPAIGN = gql`
  query GetEventsByCampaign($campaignId: ID!) {
    eventsByCampaign(campaignId: $campaignId) {
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
      createdAt
      updatedAt
      deletedAt
      archivedAt
    }
  }
`;

/**
 * GraphQL query to get detailed information about a single event.
 *
 * This query fetches an event with all its details, including
 * basic info, scheduling info (scheduledAt, occurredAt), completion status,
 * event type, and typed variables.
 *
 * @param id - The ID of the event to fetch
 * @returns Event object with full details, or null if not found
 */
export const GET_EVENT_BY_ID = gql`
  query GetEventById($id: ID!) {
    event(id: $id) {
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
      createdAt
      updatedAt
      deletedAt
      archivedAt
    }
  }
`;

/**
 * Hook to fetch all events for a specific campaign.
 *
 * Uses cache-and-network fetch policy to ensure fresh data while showing cached results immediately.
 * Returns events with scheduling information for timeline visualization.
 *
 * @param campaignId - The ID of the campaign to query events for
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with events data, loading state, and error state
 *
 * @example
 * ```tsx
 * function CampaignEventsList({ campaignId }: { campaignId: string }) {
 *   const { events, loading, error } = useEventsByCampaign(campaignId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!events || events.length === 0) return <EmptyState />;
 *
 *   return (
 *     <ul>
 *       {events.map(event => (
 *         <li key={event.id}>
 *           {event.name} - {event.isCompleted ? 'Completed' : 'Scheduled'}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useEventsByCampaign(
  campaignId: string,
  options?: Omit<
    QueryHookOptions<GetEventsByCampaignQuery, GetEventsByCampaignQueryVariables>,
    'variables'
  >
) {
  const result = useQuery<GetEventsByCampaignQuery, GetEventsByCampaignQueryVariables>(
    GET_EVENTS_BY_CAMPAIGN,
    {
      variables: { campaignId },
      fetchPolicy: 'cache-and-network', // Show cached data immediately, but fetch fresh data
      ...options,
    }
  );

  // Return a simplified data shape for easier consumption
  return useMemo(
    () => ({
      events: result.data?.eventsByCampaign ?? [],
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}

/**
 * Hook to fetch detailed information about a single event.
 *
 * Uses cache-first fetch policy for performance, with manual refetch available.
 * Includes all event fields including variables for typed data.
 *
 * @param eventId - The ID of the event to fetch
 * @param options - Additional Apollo query options (skip, onCompleted, onError, etc.)
 * @returns Query result with event data, loading state, and error state
 *
 * @example
 * ```tsx
 * function EventDetailsPage({ eventId }: { eventId: string }) {
 *   const { event, loading, error, refetch } = useEventDetails(eventId);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorAlert message={error.message} />;
 *   if (!event) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>{event.name}</h1>
 *       <p>Type: {event.eventType}</p>
 *       <p>Status: {event.isCompleted ? 'Completed' : 'Scheduled'}</p>
 *       <button onClick={() => refetch()}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useEventDetails(
  eventId: string,
  options?: Omit<QueryHookOptions<GetEventByIdQuery, GetEventByIdQueryVariables>, 'variables'>
) {
  const result = useQuery<GetEventByIdQuery, GetEventByIdQueryVariables>(GET_EVENT_BY_ID, {
    variables: { id: eventId },
    fetchPolicy: 'cache-first', // Use cache by default, manual refetch available
    ...options,
  });

  return useMemo(
    () => ({
      event: result.data?.event ?? null,
      loading: result.loading,
      error: result.error,
      refetch: result.refetch,
      networkStatus: result.networkStatus,
    }),
    [result.data, result.loading, result.error, result.refetch, result.networkStatus]
  );
}
