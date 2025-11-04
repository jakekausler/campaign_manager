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

// Polyfill for Radix UI components that use pointer capture
// jsdom doesn't implement hasPointerCapture/setPointerCapture
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function () {
    return false;
  };
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function () {
    // noop
  };
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = function () {
    // noop
  };
}

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset handlers after each test to ensure test isolation
afterEach(async () => {
  // Unmount all React components and hooks to release references
  cleanup();

  // Reset MSW handlers to default state
  server.resetHandlers();

  // Clear any accumulated event listeners to prevent memory leaks
  // MSW uses event emitters internally which can accumulate listeners
  if (server.events && typeof server.events.removeAllListeners === 'function') {
    server.events.removeAllListeners();
  }

  // Wait a tick to allow async cleanup to complete
  // This ensures all pending promises and callbacks are resolved
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Force garbage collection hint (if --expose-gc is enabled)
  // This helps prevent memory accumulation in large test suites
  // Note: Only works if Node.js is started with --expose-gc flag
  if (global.gc) {
    global.gc();
  }
});

// Stop MSW server after all tests
afterAll(() => {
  server.close();
});
