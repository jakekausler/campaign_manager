# Zustand Store Implementation Analysis

## Overview

Campaign Manager Frontend uses Zustand for state management with three slices: AuthSlice, CampaignSlice, and SelectionSlice. The store is created with `devtools` and `persist` middleware.

## Key Findings

### Store Architecture (packages/frontend/src/stores/index.ts)

**Store Creation (lines 38-74):**

- Uses `create<RootStore>()` with nested middleware: `devtools(persist(...))`
- Combines three slices via `createAuthSlice`, `createCampaignSlice`, `createSelectionSlice`
- Clean architecture with minimal circular dependencies

**Middleware Stack:**

1. `persist` middleware (lines 40-68):
   - Persists: `token`, `user`, `currentCampaignId`, `campaignBranchMap`
   - Has `onRehydrateStorage` callback that mutates state to set `isAuthenticated`
   - Uses `partialize` to exclude ephemeral state (selection, asOfTime, campaign object)

2. `devtools` middleware (lines 69-73):
   - Redux DevTools integration (dev only)
   - Configuration looks clean

### Selector Functions Analysis

**EXCELLENT - Already Fixed:**

1. **Single-value selectors** (lines 126-177): All properly defined as stable constants
   - `selectCurrentCampaignId`, `selectCurrentBranchId`, `selectAsOfTime`
   - `selectIsAuthenticated`, `selectCurrentUser`, `selectSelectedEntities`
   - All use single return values (not recreated objects)
   - No equality comparison needed

2. **Object-returning selectors** (lines 84-94, 104-115, 203-211): All use `shallow` comparison
   - `selectAuthStore` → `useAuthStore()` with `shallow`
   - `selectCampaignStore` → `useCampaignStore()` with `shallow`
   - `selectSelectionStore` → `useSelectionStore()` with `shallow`
   - Properly handles object equality

3. **Problematic selectors** (lines 259-287):
   - `useIsEntitySelected(entityId)`: Creates inline selector function on every call
   - `useSelectedEntitiesByType(entityType)`: Creates inline filtered array on every call
   - Both documented as creating new results but still problematic

### Store Usage Analysis

**WebSocketContext (packages/frontend/src/contexts/WebSocketContext.tsx):**

- Uses `useStore()` twice:
  - Line 122: `useStore((state) => state.token)` - inline selector
  - Line 123: `useStore((state) => state.isAuthenticated)` - inline selector
- **ISSUE**: Inline selectors created on every render of WebSocketProvider
- Context value IS properly memoized (lines 329-337)

**App.tsx (packages/frontend/src/App.tsx):**

- Line 26: `useCurrentCampaignId()` - properly using stable selector hook
- Line 29: `useWebSocketCacheSync()` - hook with memoized handlers ✓

**useWebSocketCacheSync (packages/frontend/src/hooks/useWebSocketCacheSync.ts):**

- Line 57: `useCampaignStore()` - using stable hook ✓
- Line 292-308: Handlers properly memoized with `useMemo` ✓
- Line 170: Uses `useStore.getState()` - stable, correct usage ✓

## Issues Found

### CRITICAL ISSUE #1: Inline Selectors in WebSocketProvider

**File**: `packages/frontend/src/contexts/WebSocketContext.tsx` lines 122-123

```typescript
const token = useStore((state) => state.token); // ← UNSTABLE
const isAuthenticated = useStore((state) => state.isAuthenticated); // ← UNSTABLE
```

Every render creates new selector functions, causing `useSyncExternalStore` to see new subscriptions.

**Fix**: Create stable selectors at module level:

```typescript
const selectToken = (state: RootStore) => state.token;
const selectIsAuthenticated = (state: RootStore) => state.isAuthenticated;

// In component:
const token = useStore(selectToken);
const isAuthenticated = useStore(selectIsAuthenticated);
```

### ISSUE #2: Inline Selectors in Module Exports

**File**: `packages/frontend/src/stores/index.ts` lines 259-287

```typescript
export const useIsEntitySelected = (entityId: string) =>
  useStore((state) => state.selectedEntities.some((e) => e.id === entityId));

export const useSelectedEntitiesByType = (entityType: string) =>
  useStore((state) => state.selectedEntities.filter((e) => e.type === entityType));
```

Creates new selector on every call. While documented as having this behavior, it can cause unnecessary re-renders in consuming components.

**Note**: These are lower priority since components using them are typically already tracking entityId/entityType as dependencies.

### POTENTIAL ISSUE #3: onRehydrateStorage Mutation

**File**: `packages/frontend/src/stores/index.ts` lines 62-66

```typescript
onRehydrateStorage: () => (state) => {
  if (state?.token) {
    state.isAuthenticated = true;
  }
},
```

Direct state mutation in middleware callback. While documented as expected behavior, this is a hydration-time operation and unlikely to cause render loops (only happens once on app startup).

## State Structure Analysis

### No Circular Dependencies

- AuthSlice: Standalone auth state (token, user, isAuthenticated)
- CampaignSlice: Campaign context (id, branch, time)
- SelectionSlice: Independent selection state (entities array)
- No slices depend on other slices for initialization

### Persist Middleware Configuration

- `partialize` function is clean and safe
- Correctly excludes ephemeral state
- `onRehydrateStorage` only runs once during initialization
- Should NOT cause render loops

## Recommendations

### Priority 1 (Critical - Fix Immediately)

1. **Fix WebSocketContext inline selectors** (lines 122-123)
   - Move selector functions to module level
   - This is likely the primary cause of infinite re-renders
   - Would prevent new subscriptions on every WebSocketProvider render

### Priority 2 (Medium - Improve)

2. **Optimize useIsEntitySelected and useSelectedEntitiesByType**
   - Make them more stable by passing stable selector references
   - Or add caching/memoization in consuming components
   - Current implementation creates new arrays/checks on every call

### Priority 3 (Low - Optional)

3. **Consider using `useShallow` hook** (Zustand v4+)
   - Instead of manually using `shallow` comparator
   - More idiomatic but not critical

## Conclusion

The store implementation is generally well-designed:

- Middleware properly configured
- Slice pattern clean and maintainable
- Most selectors are stable
- Context value is memoized

**Main Problem**: WebSocketContext's inline selectors on lines 122-123 cause unstable subscriptions that trigger re-renders on every render cycle. This is likely the root cause of the infinite loop.
