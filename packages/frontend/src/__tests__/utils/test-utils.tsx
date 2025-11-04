/**
 * Test utilities for rendering components with providers
 *
 * Provides wrappers for rendering React components with:
 * - Apollo Client (for GraphQL hooks)
 * - Zustand stores
 * - React Flow (for node components)
 * - React Router (for navigation hooks)
 */

import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { type ReactElement, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Creates a test Apollo Client with in-memory cache
 *
 * This client is configured to work with MSW for mocking GraphQL requests.
 * Each test should create a fresh client to ensure isolation.
 *
 * IMPORTANT: Always cleanup Apollo clients after tests using `cleanupApolloClient()`
 * or use `renderWithApollo()` which handles cleanup automatically.
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
 * Cleans up an Apollo Client instance
 *
 * Stops the client and clears all cached data. Use this in afterEach
 * when creating Apollo clients manually with `createTestApolloClient()`.
 *
 * @param client - The Apollo Client instance to cleanup
 */
export async function cleanupApolloClient(client: ReturnType<typeof createTestApolloClient>) {
  // Stop the client (halts all active queries/subscriptions)
  await client.stop();

  // Clear the cache to release memory
  await client.clearStore();
}

/**
 * Custom render function that wraps component with Apollo Provider and Router
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
    return (
      <BrowserRouter>
        <ApolloProvider client={client}>{children}</ApolloProvider>
      </BrowserRouter>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    client,
  };
}

/**
 * Custom render function that wraps component with React Flow Provider
 *
 * This is required for testing React Flow node and edge components.
 * For edge components with labels, it creates a full ReactFlow instance
 * to properly initialize the EdgeLabelRenderer portal.
 *
 * @param ui - The React element to render
 * @param options - Render options with optional edges flag
 * @returns Render result from @testing-library/react
 */
export function renderWithReactFlow(
  ui: ReactElement,
  renderOptions: RenderOptions & { forEdges?: boolean } = {}
): RenderResult {
  const { forEdges = false, ...restOptions } = renderOptions;

  function Wrapper({ children }: { children: ReactNode }) {
    // For edge components, render within a full ReactFlow instance
    // This properly initializes EdgeLabelRenderer portals
    if (forEdges) {
      return (
        <ReactFlowProvider>
          <div style={{ width: '500px', height: '500px' }}>
            <ReactFlow nodes={[]} edges={[]}>
              <svg>
                <g>{children}</g>
              </svg>
            </ReactFlow>
          </div>
        </ReactFlowProvider>
      );
    }

    // For node components, just the provider is sufficient
    return <ReactFlowProvider>{children}</ReactFlowProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...restOptions });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
