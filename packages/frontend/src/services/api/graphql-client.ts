import { ApolloClient, InMemoryCache, HttpLink, split, from, ApolloLink } from '@apollo/client';
import { CombinedGraphQLErrors, CombinedProtocolErrors } from '@apollo/client/errors';
import { ErrorLink } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

import { env } from '@/config';
import { useStore } from '@/stores';

/**
 * GraphQL HTTP link for queries and mutations
 */
const httpLink = new HttpLink({
  uri: env.api.url,
  // Include credentials for cookie-based auth (if needed)
  credentials: 'include',
});

/**
 * GraphQL WebSocket link for subscriptions
 *
 * NOTE: connectionParams is a function called when establishing connections,
 * so getState() returns fresh token value. Verify with login flow testing.
 */
const wsLink =
  typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: env.api.wsUrl,
          connectionParams: () => {
            // Add authentication token to WebSocket connection from Zustand store (fresh)
            const token = useStore.getState().token;
            return token
              ? {
                  authorization: `Bearer ${token}`,
                }
              : {};
          },
          // Retry connection on error (up to 5 attempts)
          retryAttempts: 5,
          // Only retry on transient errors (5xx), not on auth errors (4xx)
          shouldRetry: (error) => {
            // If error is a CloseEvent with code 1000-1999, it's a transient error
            if (error instanceof CloseEvent) {
              const code = error.code;
              // 1000: Normal closure, 1001-1015: Protocol errors (retry)
              // 4000+: Application errors (don't retry auth failures)
              return code >= 1000 && code < 4000;
            }
            // Retry on other errors (network failures, etc.)
            return true;
          },
        })
      )
    : null;

/**
 * Error handling link
 * Logs GraphQL errors, protocol errors, and network errors to console
 */
const errorLink = new ErrorLink(({ error, operation }) => {
  if (CombinedGraphQLErrors.is(error)) {
    // Handle GraphQL errors (errors in the GraphQL response)
    error.errors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path}`,
        extensions
      );
    });
  } else if (CombinedProtocolErrors.is(error)) {
    // Handle protocol errors (malformed responses, parse errors)
    error.errors.forEach(({ message, extensions }) => {
      console.error(
        `[Protocol error]: Message: ${message}, Extensions: ${JSON.stringify(extensions)}`
      );
    });
  } else {
    // Handle network errors (connection failures, timeouts)
    console.error(`[Network error]: ${error}`, {
      operation: operation.operationName,
      variables: operation.variables,
    });
  }
});

/**
 * Authentication link
 * Adds authentication token to all requests from Zustand store
 *
 * NOTE: useStore.getState() is called on each operation, ensuring fresh token
 * is used after login/logout/refresh. This is safe because getState() fetches
 * current state, not a closure over initial state.
 */
const authLink = new ApolloLink((operation, forward) => {
  // Get the authentication token from Zustand store (fresh on each request)
  const token = useStore.getState().token;

  // Add the authorization header to the request
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  }));

  return forward(operation);
});

/**
 * Split link to route queries/mutations to HTTP and subscriptions to WebSocket
 */
const splitLink =
  typeof window !== 'undefined' && wsLink
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
          );
        },
        wsLink,
        httpLink
      )
    : httpLink;

/**
 * Apollo Client instance
 * Configured for queries, mutations, and subscriptions
 */
export const graphqlClient = new ApolloClient({
  link: from([errorLink, authLink, splitLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Settlement queries: cache by kingdom ID
          // NOTE: keyArgs must match GraphQL query parameter names exactly
          settlementsByKingdom: {
            // Key by kingdom ID to separate caches
            keyArgs: ['kingdomId'],
            // Merge strategy: replace existing with incoming
            merge(_existing, incoming) {
              return incoming;
            },
          },
          // Structure queries: cache by settlement ID
          // NOTE: keyArgs must match GraphQL query parameter names exactly
          structuresBySettlement: {
            // Key by settlement ID to separate caches
            keyArgs: ['settlementId'],
            // Merge strategy: replace existing with incoming
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
      // Settlement type: normalize by ID
      Settlement: {
        keyFields: ['id'],
        fields: {
          // Structures field: merge incoming structures
          structures: {
            merge(_existing = [], incoming) {
              return incoming;
            },
          },
          // Computed fields: disable caching (always fetch fresh)
          computedFields: {
            merge: false,
          },
        },
      },
      // Structure type: normalize by ID
      Structure: {
        keyFields: ['id'],
        fields: {
          // Computed fields: disable caching (always fetch fresh)
          computedFields: {
            merge: false,
          },
        },
      },
    },
  }),
  // Apollo Client v4 automatically connects to dev tools in development mode
  // Default options for queries and mutations
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      // Use cache-first for better performance (uses cache first, fetches from network if not cached)
      // Override to 'network-only' for specific queries that must always be fresh
      // Note: 'cache-and-network' is only available for watchQuery, not regular query
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});
