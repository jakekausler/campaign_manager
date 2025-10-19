# Testing Infrastructure

This directory contains test utilities, mocks, and setup for the frontend test suite.

## Table of Contents

- [Overview](#overview)
- [Test Stack](#test-stack)
- [Directory Structure](#directory-structure)
- [Test Setup](#test-setup)
- [Mock Service Worker (MSW)](#mock-service-worker-msw)
- [Test Utilities](#test-utilities)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [Running Tests](#running-tests)
- [Troubleshooting](#troubleshooting)

## Overview

The frontend uses a comprehensive testing strategy:

- **Unit tests** - Test individual components, hooks, and utilities in isolation
- **Integration tests** - Test GraphQL hooks with mocked API responses
- **Component tests** - Test React components with user interactions

All tests use **Vitest** (Vite-native test runner) and **Mock Service Worker** (MSW) for API mocking.

## Test Stack

| Library                         | Purpose                                | Version |
| ------------------------------- | -------------------------------------- | ------- |
| **Vitest**                      | Test runner (Vite-native, fast)        | 1.x     |
| **@testing-library/react**      | React component testing utilities      | 14.x    |
| **@testing-library/jest-dom**   | Custom matchers for DOM assertions     | 6.x     |
| **@testing-library/user-event** | Simulates user interactions            | 14.x    |
| **MSW (Mock Service Worker)**   | API mocking for GraphQL/REST           | 2.x     |
| **happy-dom**                   | DOM implementation (faster than jsdom) | 20.x    |

## Directory Structure

```
__tests__/
├── README.md              # This file
├── setup.ts              # Global test setup (MSW lifecycle, matchers)
├── mocks/                # Mock data and handlers
│   ├── server.ts         # MSW server instance
│   ├── graphql-handlers.ts # GraphQL request handlers
│   ├── data.ts           # Mock Settlement/Structure data
│   └── index.ts          # Centralized exports
└── utils/                # Test utilities
    └── test-utils.tsx    # Apollo Client wrapper, custom render functions
```

## Test Setup

### Global Setup (`setup.ts`)

Runs before all tests to configure:

1. **@testing-library/jest-dom** - Custom matchers (toBeInTheDocument, toHaveTextContent, etc.)
2. **MSW Server** - Lifecycle management (start, reset, stop)
3. **Cleanup** - Automatic component cleanup after each test

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset handlers and cleanup after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Stop MSW server after all tests
afterAll(() => {
  server.close();
});
```

**Key points:**

- `onUnhandledRequest: 'error'` - Fails tests if unmocked requests are made
- `server.resetHandlers()` - Ensures test isolation (no handler bleed-over)
- `cleanup()` - Unmounts components and clears Testing Library state

### Vitest Configuration

In `vite.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        'src/__generated__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
    },
  },
});
```

**Why happy-dom?**

- Faster than jsdom (30-50% faster test execution)
- Sufficient for most React component tests
- Smaller bundle size

## Mock Service Worker (MSW)

MSW intercepts HTTP/GraphQL requests during tests and returns mock responses.

### Server Setup (`mocks/server.ts`)

```typescript
import { setupServer } from 'msw/node';
import { graphqlHandlers } from './graphql-handlers';

export const server = setupServer(...graphqlHandlers);
```

### GraphQL Handlers (`mocks/graphql-handlers.ts`)

Handlers define mock responses for GraphQL operations:

```typescript
import { graphql, HttpResponse } from 'msw';
import { mockSettlements, mockStructures } from './data';

export const graphqlHandlers = [
  // Settlement queries
  graphql.query('GetSettlementsByKingdom', ({ variables }) => {
    const settlements = mockSettlements.filter((s) => s.kingdomId === variables.kingdomId);
    return HttpResponse.json({ data: { settlementsByKingdom: settlements } });
  }),

  graphql.query('GetSettlementDetails', ({ variables }) => {
    const settlement = mockSettlements.find((s) => s.id === variables.id);
    if (!settlement) {
      return HttpResponse.json({
        data: { settlement: null },
        errors: [{ message: 'Settlement not found' }],
      });
    }
    return HttpResponse.json({ data: { settlement } });
  }),

  // Structure queries
  graphql.query('GetStructuresBySettlement', ({ variables }) => {
    const structures = mockStructures.filter((s) => s.settlementId === variables.settlementId);
    const settlement = mockSettlements.find((s) => s.id === variables.settlementId);
    return HttpResponse.json({
      data: {
        settlement: {
          ...settlement,
          structures,
        },
      },
    });
  }),

  // Mutations
  graphql.mutation('CreateSettlement', ({ variables }) => {
    const newSettlement = {
      __typename: 'Settlement',
      id: `settlement-${Date.now()}`,
      ...variables.input,
      computedFields: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    return HttpResponse.json({ data: { createSettlement: newSettlement } });
  }),
];
```

**MSW v2 Syntax Notes:**

- Use `graphql.query()` and `graphql.mutation()` (not `graphql.operation()`)
- Return `HttpResponse.json()` (not `res(ctx.json())` from v1)
- Variables available via `{ variables }` parameter
- Supports GraphQL errors in response

### Mock Data (`mocks/data.ts`)

Centralized mock data for reuse across tests:

```typescript
export const mockSettlements = [
  {
    __typename: 'Settlement',
    id: 'settlement-1',
    kingdomId: 'kingdom-1',
    name: 'Capital City',
    level: 5,
    locationId: 'loc-1',
    computedFields: { population: 10000 },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1,
    deletedAt: null,
  },
  // ... more mock settlements
];

export const mockStructures = [
  {
    __typename: 'Structure',
    id: 'structure-1',
    settlementId: 'settlement-1',
    typeId: 'barracks',
    name: 'Main Barracks',
    x: 10,
    y: 20,
    orientation: 0,
    computedFields: { capacity: 100 },
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1,
    deletedAt: null,
  },
  // ... more mock structures
];
```

**Best practices:**

- Include `__typename` for Apollo Client cache normalization
- Match backend GraphQL schema field names
- Use realistic IDs (e.g., `settlement-1`, not `1`)
- Include timestamps and version numbers
- Set `deletedAt: null` for non-deleted entities

## Test Utilities

### Apollo Client Wrapper (`utils/test-utils.tsx`)

Provides Apollo Client setup for integration tests:

**`createTestApolloClient()`**

Creates fresh Apollo Client instance with:

- No-cache fetch policy (predictable test behavior)
- HttpLink pointing to `/graphql` (intercepted by MSW)
- Same type policies as production client
- Isolated cache per test

```typescript
import { createTestApolloClient } from '@/__tests__/utils/test-utils';

const client = createTestApolloClient();
```

**`renderWithApollo(component, options)`**

Renders React components with Apollo Provider:

```typescript
import { renderWithApollo } from '@/__tests__/utils/test-utils';

const { result, client } = renderWithApollo(<MyComponent />);
```

**Usage in tests:**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { ApolloProvider } from '@apollo/client';
import { createTestApolloClient } from '@/__tests__/utils/test-utils';
import { useSettlementDetails } from '../settlements';

test('fetches settlement details', async () => {
  const { result } = renderHook(() => useSettlementDetails('settlement-1'), {
    wrapper: ({ children }) => (
      <ApolloProvider client={createTestApolloClient()}>
        {children}
      </ApolloProvider>
    ),
  });

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.settlement?.id).toBe('settlement-1');
});
```

## Writing Tests

### Unit Tests (Zustand Stores)

Test store actions and state transitions:

```typescript
import { create } from 'zustand';
import { createAuthSlice } from './auth-slice';
import { describe, it, expect } from 'vitest';

describe('AuthSlice', () => {
  it('should login user', () => {
    const store = create(createAuthSlice);

    store.getState().login('token-123', {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(store.getState().isAuthenticated).toBe(true);
    expect(store.getState().token).toBe('token-123');
  });

  it('should logout user', () => {
    const store = create(createAuthSlice);

    store.getState().login('token-123', mockUser);
    store.getState().logout();

    expect(store.getState().isAuthenticated).toBe(false);
    expect(store.getState().token).toBeNull();
  });
});
```

**Key points:**

- Create fresh store per test with `create(createAuthSlice)`
- Use `store.getState()` to access state and actions
- Test state transitions (login → logout, etc.)
- Verify derived state (e.g., `isAuthenticated` from `token`)

### Integration Tests (GraphQL Hooks)

Test hooks with MSW-mocked API responses:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { ApolloProvider } from '@apollo/client';
import { describe, it, expect } from 'vitest';
import { createTestApolloClient } from '@/__tests__/utils/test-utils';
import { useSettlementsByKingdom } from '../settlements';

describe('useSettlementsByKingdom', () => {
  it('fetches settlements by kingdom', async () => {
    const { result } = renderHook(
      () => useSettlementsByKingdom('kingdom-1'),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={createTestApolloClient()}>
            {children}
          </ApolloProvider>
        ),
      }
    );

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.settlements).toBeUndefined();

    // Wait for data
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify data
    expect(result.current.settlements).toBeDefined();
    expect(result.current.settlements?.length).toBeGreaterThan(0);
  });

  it('handles errors gracefully', async () => {
    // Override handler to return error
    server.use(
      graphql.query('GetSettlementsByKingdom', () => {
        return HttpResponse.json({
          errors: [{ message: 'Internal server error' }],
        });
      })
    );

    const { result } = renderHook(
      () => useSettlementsByKingdom('kingdom-1'),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={createTestApolloClient()}>
            {children}
          </ApolloProvider>
        ),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
  });
});
```

**Key points:**

- Wrap hooks with Apollo Provider
- Create fresh Apollo Client per test for isolation
- Test loading state → data loaded transition
- Test error scenarios with `server.use()` overrides
- Use `waitFor()` for async state changes

### Component Tests

Test React components with user interactions:

```typescript
import { renderWithApollo, screen, fireEvent, waitFor } from '@/__tests__/utils/test-utils';
import { describe, it, expect } from 'vitest';
import SettlementList from './SettlementList';

describe('SettlementList', () => {
  it('displays settlements from API', async () => {
    renderWithApollo(<SettlementList kingdomId="kingdom-1" />);

    // Initially shows loading
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Verify settlements displayed
    expect(screen.getByText('Capital City')).toBeInTheDocument();
  });

  it('refetches on button click', async () => {
    renderWithApollo(<SettlementList kingdomId="kingdom-1" />);

    await waitFor(() => {
      expect(screen.getByText('Capital City')).toBeInTheDocument();
    });

    // Click refresh button
    fireEvent.click(screen.getByText(/refresh/i));

    // Verify loading state
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
```

**Key points:**

- Use `renderWithApollo()` for components that use GraphQL hooks
- Use `screen.getByText()`, `screen.getByRole()` for querying
- Use `fireEvent` or `userEvent` for interactions
- Test loading, success, and error states
- Use `waitFor()` for async state changes

## Best Practices

### 1. Test Isolation

✅ **Good:**

```typescript
describe('MyHook', () => {
  it('test 1', () => {
    const client = createTestApolloClient(); // Fresh client
    // Test with client
  });

  it('test 2', () => {
    const client = createTestApolloClient(); // Fresh client
    // Test with client
  });
});
```

❌ **Bad:**

```typescript
const client = createTestApolloClient(); // Shared across tests

describe('MyHook', () => {
  it('test 1', () => {
    // Uses shared client - cache pollution!
  });

  it('test 2', () => {
    // Uses shared client - test interdependence!
  });
});
```

### 2. Descriptive Test Names

✅ **Good:**

```typescript
it('fetches settlements by kingdom and filters by kingdom ID', () => {
  // Clear what is being tested
});
```

❌ **Bad:**

```typescript
it('works', () => {
  // Vague - what works?
});
```

### 3. Arrange-Act-Assert Pattern

✅ **Good:**

```typescript
it('should update settlement name', async () => {
  // Arrange
  const { result } = renderHook(() => useUpdateSettlement(), { wrapper });
  const settlementId = 'settlement-1';
  const newName = 'New Name';

  // Act
  await result.current.updateSettlement(settlementId, { name: newName });

  // Assert
  expect(result.current.data?.name).toBe(newName);
});
```

❌ **Bad:**

```typescript
it('should update settlement name', async () => {
  const { result } = renderHook(() => useUpdateSettlement(), { wrapper });
  await result.current.updateSettlement('settlement-1', { name: 'New Name' });
  expect(result.current.data?.name).toBe('New Name');
  // All mixed together - hard to read
});
```

### 4. Test One Thing Per Test

✅ **Good:**

```typescript
it('fetches settlement details by ID', async () => {
  // Only tests fetching
});

it('handles non-existent settlement with error', async () => {
  // Only tests error handling
});
```

❌ **Bad:**

```typescript
it('fetches settlement and handles errors and refetches', async () => {
  // Tests too many things - hard to debug failures
});
```

### 5. Use Realistic Mock Data

✅ **Good:**

```typescript
const mockSettlement = {
  __typename: 'Settlement',
  id: 'settlement-123',
  name: 'Capital City',
  level: 5,
  // ... all required fields
};
```

❌ **Bad:**

```typescript
const mockSettlement = {
  id: 1, // Wrong type (should be string)
  name: 'Test', // Too generic
  // Missing fields - causes cache warnings
};
```

### 6. Clean Up Side Effects

✅ **Good:**

```typescript
it('subscribes to updates', () => {
  const unsubscribe = subscribe();

  // Test logic

  unsubscribe(); // Clean up
});
```

❌ **Bad:**

```typescript
it('subscribes to updates', () => {
  subscribe();
  // No cleanup - may affect other tests
});
```

### 7. Use `waitFor()` for Async Assertions

✅ **Good:**

```typescript
await waitFor(() => {
  expect(result.current.loading).toBe(false);
});

expect(result.current.data).toBeDefined();
```

❌ **Bad:**

```typescript
expect(result.current.loading).toBe(false); // May fail - async not awaited
```

## Running Tests

```bash
# Run all tests
pnpm --filter @campaign/frontend test

# Watch mode (for TDD)
pnpm --filter @campaign/frontend test:watch

# With coverage
pnpm --filter @campaign/frontend test -- --coverage

# Run specific test file
pnpm --filter @campaign/frontend test settlements.test.tsx

# Run tests matching pattern
pnpm --filter @campaign/frontend test -- --grep "Settlement"

# Run in UI mode (Vitest UI)
pnpm --filter @campaign/frontend test -- --ui
```

**CI/CD:**

Tests run automatically on every commit via pre-push hook. All tests must pass before pushing.

## Troubleshooting

### Tests Fail with "Unhandled Request"

**Cause:** MSW doesn't have a handler for the GraphQL operation.

**Solution:**

1. Check operation name matches handler:

   ```typescript
   // Handler
   graphql.query('GetSettlementDetails', ...)

   // Query
   query GetSettlementDetails { ... }
   ```

2. Add missing handler to `graphql-handlers.ts`
3. Verify MSW server is running (`beforeAll` in `setup.ts`)

### Tests Fail with Cache Warnings

**Cause:** Apollo Client cache is missing fields.

**Solution:**

1. Add `__typename` to mock data
2. Include all queried fields in mock responses
3. Verify mock data structure matches GraphQL schema

### Tests Pass Locally but Fail in CI

**Cause:** Timing issues or environment differences.

**Solution:**

1. Use `waitFor()` instead of fixed timeouts
2. Increase `waitFor` timeout if needed:

   ```typescript
   await waitFor(
     () => {
       expect(condition).toBe(true);
     },
     { timeout: 5000 }
   );
   ```

3. Ensure tests don't depend on execution order

### Hook State Not Updating

**Cause:** Missing `await waitFor()` for async state changes.

**Solution:**

```typescript
// ✅ Good
await waitFor(() => {
  expect(result.current.loading).toBe(false);
});

// ❌ Bad
expect(result.current.loading).toBe(false); // May still be true
```

### Mock Data Not Being Used

**Cause:** MSW handler not matching request or returning wrong shape.

**Solution:**

1. Check handler operation name and type (query vs mutation)
2. Verify handler returns `HttpResponse.json({ data: { ... } })`
3. Inspect network in Vitest UI to see actual requests
4. Add logging to handler:

   ```typescript
   graphql.query('GetSettlement', ({ variables }) => {
     console.log('Handler called with:', variables);
     return HttpResponse.json({ data: { ... } });
   });
   ```

### Type Errors in Tests

**Cause:** Placeholder types don't match mock data.

**Solution:**

1. Use type assertions for test data:

   ```typescript
   const settlement = mockSettlements[0] as Settlement;
   ```

2. Update mock data to match placeholder types
3. Use optional chaining for nullable fields:

   ```typescript
   expect(result.current.settlement?.name).toBe('Capital City');
   ```

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
