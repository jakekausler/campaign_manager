# State Management

This directory contains the global state management setup using [Zustand](https://github.com/pmndrs/zustand).

## Table of Contents

- [Architecture](#architecture)
- [State Slices](#state-slices)
- [Usage](#usage)
- [Optimized Selectors](#optimized-selectors)
- [Persistence Strategy](#persistence-strategy)
- [Integration with Apollo Client](#integration-with-apollo-client)
- [Why Zustand?](#why-zustand)
- [Store Structure](#store-structure)
- [Middleware](#middleware)
- [Best Practices](#best-practices)
- [Testing](#testing)

## Architecture

We use Zustand's **slice pattern** to organize state into logical domains. This pattern:

- Provides clear separation of concerns
- Enables independent development and testing of slices
- Scales well as the application grows
- Supports TypeScript type inference

### Directory Structure

```
stores/
├── auth-slice.ts         # Authentication state and actions
├── campaign-slice.ts     # Campaign context state and actions
├── index.ts              # Root store combining all slices
├── README.md             # This file
├── auth-slice.test.ts    # Unit tests for auth slice
└── campaign-slice.test.ts # Unit tests for campaign slice
```

## State Slices

### Auth Slice (`auth-slice.ts`)

Manages authentication state including:

- **JWT token storage** - Auto-persisted to localStorage
- **User profile** - Including id, email, name, role (player/gm/admin)
- **Authentication status** - Boolean flag for route protection

**Key features:**

- Token automatically attached to GraphQL requests via Apollo Client integration
- Auto-login on app reload via localStorage persistence
- Comprehensive actions: login, logout, updateUser, refreshToken, setToken

**State:**

```typescript
{
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
}
```

**Actions:**

- `login(token, user)` - Set token and user, mark as authenticated
- `logout()` - Clear token and user, mark as unauthenticated
- `updateUser(user)` - Update user profile
- `refreshToken(token)` - Replace token without changing user
- `setToken(token)` - Set token directly (clears user if token is null)

### Campaign Slice (`campaign-slice.ts`)

Manages campaign context state including:

- **Current campaign ID** - Auto-persisted to localStorage
- **Campaign object** - Full campaign data (not persisted, refetched on reload)
- **Branch ID** - For version control workflows (ephemeral)
- **AsOf time** - For time-travel queries (ephemeral)

**Key features:**

- Smart state transitions (changing campaigns resets branch/time context)
- Selective persistence (only campaign ID persisted, not full object)
- Integration with GraphQL for campaign-scoped queries

**State:**

```typescript
{
  currentCampaignId: string | null;
  currentBranchId: string | null;
  asOfTime: Date | null;
  campaign: Campaign | null;
}
```

**Actions:**

- `setCurrentCampaign(campaignId, campaign)` - Set campaign (resets branch/time)
- `setCurrentBranch(branchId)` - Set current branch for version control
- `setAsOfTime(time)` - Set time-travel timestamp
- `clearCampaignContext()` - Clear all campaign context

## Usage

### Basic Usage

Import hooks from the root store:

```typescript
import { useAuthStore, useCampaignStore } from '@/stores';

function MyComponent() {
  const { user, isAuthenticated, login } = useAuthStore();
  const { currentCampaignId, setCurrentCampaign } = useCampaignStore();

  // Use state and actions
}
```

### Authentication Flow

```typescript
import { useAuthStore } from '@/stores';

function LoginPage() {
  const { login } = useAuthStore();

  const handleLogin = async (email: string, password: string) => {
    // Call authentication API
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const { token, user } = await response.json();

    // Update store (token auto-persists to localStorage)
    login(token, user);

    // Token now automatically attached to all GraphQL requests
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleLogin(formData.get('email'), formData.get('password'));
    }}>
      {/* form fields */}
    </form>
  );
}
```

### Campaign Context

```typescript
import { useCampaignStore } from '@/stores';

function CampaignSwitcher() {
  const { currentCampaignId, campaign, setCurrentCampaign } = useCampaignStore();

  const switchCampaign = (newCampaign) => {
    // Campaign ID persists to localStorage
    // Branch and time context automatically cleared
    setCurrentCampaign(newCampaign.id, newCampaign);
  };

  return (
    <div>
      <h2>Current: {campaign?.name}</h2>
      <CampaignList onSelect={switchCampaign} />
    </div>
  );
}
```

### Time-Travel Queries

```typescript
import { useCampaignStore } from '@/stores';

function TimeTravelControls() {
  const { asOfTime, setAsOfTime } = useCampaignStore();

  const viewPastState = (timestamp: Date) => {
    setAsOfTime(timestamp);
    // All subsequent GraphQL queries will use this timestamp
  };

  const viewCurrentState = () => {
    setAsOfTime(null);
    // Queries return current state
  };

  return (
    <div>
      <button onClick={() => viewPastState(new Date('2024-01-01'))}>
        View Jan 1, 2024
      </button>
      <button onClick={viewCurrentState}>View Current</button>
    </div>
  );
}
```

## Optimized Selectors

The root store provides optimized selector hooks to prevent unnecessary re-renders:

```typescript
import {
  useCurrentCampaignId,  // Returns only campaign ID
  useCurrentBranchId,    // Returns only branch ID
  useAsOfTime,           // Returns only asOf time
  useIsAuthenticated,    // Returns only auth status
  useCurrentUser,        // Returns only user object
} from '@/stores';

function Header() {
  // Component only re-renders when campaign ID changes
  // (not when other campaign state changes)
  const campaignId = useCurrentCampaignId();

  return <div>Campaign: {campaignId}</div>;
}
```

**Why use selectors?**

- Prevents unnecessary re-renders when unrelated state changes
- Improves performance in large component trees
- Provides cleaner component code

## Persistence Strategy

The store uses Zustand's `persist` middleware with selective state persistence:

### What is Persisted (localStorage)

- `auth.token` - For auto-login and attaching to GraphQL requests
- `auth.user` - For immediate profile access on app reload
- `campaign.currentCampaignId` - For restoring campaign context

### What is NOT Persisted (ephemeral)

- `auth.isAuthenticated` - Restored from token presence on rehydration
- `campaign.campaign` - Refetched on app reload for freshness
- `campaign.currentBranchId` - Session-specific state
- `campaign.asOfTime` - Session-specific state

### Rehydration Behavior

On app initialization:

1. Store reads persisted state from localStorage
2. `onRehydrateStorage` callback runs:
   - If `token` exists → `isAuthenticated = true`
   - Token validation happens on first GraphQL request (not during rehydration)
3. If token is invalid/expired:
   - Apollo Client error link should trigger `logout()`
   - App prompts user to log in again

## Integration with Apollo Client

The auth store is tightly integrated with Apollo Client for automatic token management:

### Authentication Link

In `src/services/api/graphql-client.ts`:

```typescript
import { useStore } from '@/stores';

const authLink = setContext((_, { headers }) => {
  // Get fresh token from Zustand (not closure over initial state)
  const token = useStore.getState().token;

  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});
```

**Why `useStore.getState()` instead of hooks?**

- Runs outside React component lifecycle
- Always gets fresh state (not stale closure)
- Called for every GraphQL request
- Immediately reflects token changes (login, logout, refresh)

### WebSocket Authentication

For GraphQL subscriptions:

```typescript
const wsLink = new GraphQLWsLink(
  createClient({
    url: config.API_WS_URL,
    connectionParams: () => {
      // Get fresh token on WebSocket connection
      const token = useStore.getState().token;
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  })
);
```

### Token Lifecycle

1. **Login**: `login(token, user)` → Token stored → Apollo Client uses it immediately
2. **Refresh**: `refreshToken(newToken)` → New token stored → Apollo Client uses it immediately
3. **Logout**: `logout()` → Token cleared → Apollo Client stops sending it
4. **Expired token**: Apollo Client error → Should trigger `logout()`

## Why Zustand?

Zustand was chosen over Redux and Context API for several reasons:

| Feature            | Zustand      | Redux        | Context API         |
| ------------------ | ------------ | ------------ | ------------------- |
| **Boilerplate**    | Minimal      | Heavy        | Medium              |
| **Bundle size**    | ~1KB         | ~3KB         | 0KB (built-in)      |
| **DevTools**       | ✅ Yes       | ✅ Yes       | ❌ No               |
| **TypeScript**     | ✅ Excellent | ✅ Good      | ⚠️ Manual           |
| **Middleware**     | ✅ Built-in  | ✅ Extensive | ❌ None             |
| **Performance**    | ✅ Excellent | ✅ Good      | ⚠️ Re-render issues |
| **Learning curve** | ✅ Low       | ❌ High      | ✅ Low              |

**Key advantages:**

- **Simple API** - Minimal boilerplate compared to Redux
- **TypeScript-first** - Excellent type inference without manual typing
- **No providers** - Works anywhere in the app (no Provider wrappers)
- **DevTools support** - Redux DevTools integration for debugging
- **Middleware** - Built-in persist, devtools, immer support
- **Small bundle** - ~1KB gzipped

## Store Structure

Each slice follows the slice pattern:

```typescript
import type { StateCreator } from 'zustand';

// Define the slice interface
export interface MySlice {
  // State
  value: string;
  count: number;

  // Actions
  setValue: (value: string) => void;
  increment: () => void;
  reset: () => void;
}

// Create the slice factory function
export const createMySlice: StateCreator<MySlice> = (set) => ({
  // Initial state
  value: '',
  count: 0,

  // Actions using set() to update state
  setValue: (value) => set({ value }),
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ value: '', count: 0 }),
});
```

**Pattern benefits:**

- Clear separation between state and actions
- TypeScript inference for free
- Testable in isolation
- Composable with other slices

## Middleware

The root store uses the following middleware (applied in order):

### 1. DevTools Middleware

```typescript
import { devtools } from 'zustand/middleware';

devtools(
  /* store creator */,
  {
    name: 'CampaignManagerStore',
    enabled: import.meta.env.DEV, // Only in development
  }
)
```

**Features:**

- Integrates with Redux DevTools browser extension
- Shows state changes, actions, time-travel debugging
- Only enabled in development (excluded from production bundle)

### 2. Persist Middleware

```typescript
import { persist } from 'zustand/middleware';

persist(
  /* store creator */,
  {
    name: 'campaign-manager-storage', // localStorage key
    partialize: (state) => ({
      token: state.token,
      user: state.user,
      currentCampaignId: state.currentCampaignId,
    }),
    onRehydrateStorage: () => (state) => {
      if (state?.token) {
        state.isAuthenticated = true;
      }
    },
  }
)
```

**Features:**

- Persists state to localStorage
- Selective persistence via `partialize`
- Rehydration callback for restoring derived state
- Automatic serialization/deserialization

## Best Practices

### 1. Keep Slices Focused

Each slice should manage a single domain:

✅ **Good:**

```typescript
// auth-slice.ts - Only authentication
// campaign-slice.ts - Only campaign context
```

❌ **Bad:**

```typescript
// app-slice.ts - Everything mixed together
```

### 2. Use Immutable Updates

Always use `set()` with new object references:

✅ **Good:**

```typescript
increment: () => set((state) => ({ count: state.count + 1 }));
```

❌ **Bad:**

```typescript
increment: () => {
  state.count++; // Direct mutation - breaks reactivity
  set(state);
};
```

### 3. Avoid Deep Nesting

Keep state flat when possible:

✅ **Good:**

```typescript
{
  userId: '123',
  userName: 'Alice',
  userEmail: 'alice@example.com',
}
```

❌ **Bad:**

```typescript
{
  user: {
    profile: {
      details: {
        name: 'Alice',
      },
    },
  },
}
```

### 4. Use Optimized Selectors

Extract only needed state to prevent unnecessary re-renders:

✅ **Good:**

```typescript
const campaignId = useCurrentCampaignId(); // Only re-renders when ID changes
```

❌ **Bad:**

```typescript
const { currentCampaignId } = useCampaignStore(); // Re-renders on ANY campaign state change
```

### 5. Actions are Synchronous

For async operations, use services/hooks:

✅ **Good:**

```typescript
// In component
const { login } = useAuthStore();

const handleLogin = async () => {
  const { token, user } = await authApi.login(email, password);
  login(token, user); // Sync action
};
```

❌ **Bad:**

```typescript
// In slice
login: async (email, password) => {
  const { token, user } = await fetch(...); // Async in action
  set({ token, user });
}
```

### 6. Type Safety

Let TypeScript infer types automatically:

✅ **Good:**

```typescript
export const useAuthStore = () =>
  useStore((state) => ({
    token: state.token, // Type inferred from AuthSlice
    login: state.login,
  }));
```

❌ **Bad:**

```typescript
export const useAuthStore = () =>
  useStore((state): any => ({
    // Lost type safety
    token: state.token,
    login: state.login,
  }));
```

## Testing

Zustand stores can be tested by creating isolated store instances:

### Unit Testing Slices

```typescript
import { create } from 'zustand';
import { createAuthSlice } from './auth-slice';

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

    store.getState().login('token-123', { id: '1', email: 'test@example.com', name: 'Test' });
    store.getState().logout();

    expect(store.getState().isAuthenticated).toBe(false);
    expect(store.getState().token).toBeNull();
  });
});
```

### Integration Testing with Components

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from './index';

describe('AuthStore Integration', () => {
  it('should manage login flow', () => {
    const { result } = renderHook(() => useAuthStore());

    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      result.current.login('token-123', mockUser);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });
});
```

### Test Utilities

For integration tests, create a test store factory:

```typescript
// __tests__/utils/test-store.ts
import { create } from 'zustand';
import { createAuthSlice } from '@/stores/auth-slice';
import { createCampaignSlice } from '@/stores/campaign-slice';

export const createTestStore = () => {
  return create(() => ({
    ...createAuthSlice(() => {}),
    ...createCampaignSlice(() => {}),
  }));
};
```

### Running Tests

```bash
# From project root
pnpm --filter @campaign/frontend test

# Watch mode (for TDD)
pnpm --filter @campaign/frontend test:watch

# With coverage
pnpm --filter @campaign/frontend test -- --coverage
```

See `auth-slice.test.ts` and `campaign-slice.test.ts` for comprehensive test examples.
