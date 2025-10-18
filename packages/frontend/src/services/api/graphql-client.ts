import { ApolloClient, InMemoryCache, HttpLink, split, from, ApolloLink } from '@apollo/client';
import { CombinedGraphQLErrors, CombinedProtocolErrors } from '@apollo/client/errors';
import { ErrorLink } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

import { env } from '@/config';

/**
 * Authentication token key in localStorage
 * Centralized constant to prevent typos and enable easy key rotation
 */
const AUTH_TOKEN_KEY = 'auth_token';

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
 */
const wsLink =
  typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: env.api.wsUrl,
          connectionParams: () => {
            // Add authentication token to WebSocket connection
            const token = localStorage.getItem(AUTH_TOKEN_KEY);
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
 * Adds authentication token to all requests
 */
const authLink = new ApolloLink((operation, forward) => {
  // Get the authentication token from local storage
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

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
      // Add type policies for cache normalization
      // Example:
      // Query: {
      //   fields: {
      //     campaigns: {
      //       merge(existing, incoming) {
      //         return incoming;
      //       },
      //     },
      //   },
      // },
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
