/**
 * Test utilities for rendering components with providers
 *
 * Provides wrappers for rendering React components with:
 * - Apollo Client (for GraphQL hooks)
 * - Zustand stores
 */

import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

/**
 * Creates a test Apollo Client with in-memory cache
 *
 * This client is configured to work with MSW for mocking GraphQL requests.
 * Each test should create a fresh client to ensure isolation.
 */
export function createTestApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: '/graphql',
      fetch,
    }),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            settlementsByKingdom: {
              keyArgs: ['kingdomId'],
            },
            structuresBySettlement: {
              keyArgs: ['settlementId'],
            },
          },
        },
        Settlement: {
          keyFields: ['id'],
        },
        Structure: {
          keyFields: ['id'],
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache', // Disable caching in tests for predictability
      },
      query: {
        fetchPolicy: 'no-cache',
      },
    },
  });
}

/**
 * Custom render function that wraps component with Apollo Provider
 *
 * @param ui - The React element to render
 * @param options - Render options including custom Apollo client
 * @returns Render result from @testing-library/react
 */
export function renderWithApollo(
  ui: ReactElement,
  {
    client = createTestApolloClient(),
    ...renderOptions
  }: RenderOptions & { client?: ReturnType<typeof createTestApolloClient> } = {}
): RenderResult & { client: ReturnType<typeof createTestApolloClient> } {
  function Wrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    client,
  };
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
