# State Management

This directory contains the global state management setup using [Zustand](https://github.com/pmndrs/zustand).

## Architecture

We use Zustand's **slice pattern** to organize state into logical domains:

- **auth-slice.ts** - Authentication state (token, user, login/logout)
- **campaign-slice.ts** - Campaign context (current campaign, branch, asOf time)
- **index.ts** - Root store combining all slices

## Usage

Import hooks from the root store:

```typescript
import { useAuthStore, useCampaignStore } from '@/stores';

function MyComponent() {
  const { user, isAuthenticated } = useAuthStore();
  const { currentCampaignId, setCurrentCampaign } = useCampaignStore();

  // Use state and actions
}
```

## Why Zustand?

- **Simple API** - Minimal boilerplate compared to Redux
- **TypeScript-first** - Excellent type inference
- **No providers** - Works anywhere in the app
- **DevTools support** - Redux DevTools integration
- **Middleware** - Built-in persist, devtools, immer support
- **Small bundle** - ~1KB gzipped

## Store Structure

Each slice follows this pattern:

```typescript
export interface MySlice {
  // State
  value: string;
  count: number;

  // Actions
  setValue: (value: string) => void;
  increment: () => void;
  reset: () => void;
}

export const createMySlice: StateCreator<MySlice> = (set) => ({
  // Initial state
  value: '',
  count: 0,

  // Actions
  setValue: (value) => set({ value }),
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ value: '', count: 0 }),
});
```

## Middleware

The root store uses the following middleware:

- **devtools** - Redux DevTools integration (development only)
- **persist** - Persist auth token and campaign ID to localStorage

## Best Practices

1. **Keep slices focused** - Each slice should manage a single domain
2. **Immutable updates** - Use `set((state) => ({ ...state }))` for updates
3. **Avoid deep nesting** - Keep state flat when possible
4. **Use selectors** - Extract only needed state to avoid re-renders
5. **Actions are synchronous** - For async operations, use services/hooks

## Testing

Zustand stores can be tested by creating isolated store instances:

```typescript
import { create } from 'zustand';
import { createAuthSlice } from './auth-slice';

describe('AuthStore', () => {
  it('should login user', () => {
    const store = create(createAuthSlice);
    store.getState().login('token', mockUser);
    expect(store.getState().isAuthenticated).toBe(true);
  });
});
```
