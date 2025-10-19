/**
 * Mock Service Worker (MSW) server setup
 *
 * This configures MSW to intercept HTTP requests during tests and
 * return mock GraphQL responses.
 */

import { setupServer } from 'msw/node';

import { graphqlHandlers } from './graphql-handlers';

// Create MSW server with GraphQL handlers
export const server = setupServer(...graphqlHandlers);
