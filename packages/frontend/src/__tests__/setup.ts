/**
 * Vitest test setup file
 *
 * This file runs before all tests and configures:
 * - @testing-library/jest-dom matchers
 * - Mock Service Worker (MSW) for API mocking
 * - Global test utilities
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset handlers after each test to ensure test isolation
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Stop MSW server after all tests
afterAll(() => {
  server.close();
});
