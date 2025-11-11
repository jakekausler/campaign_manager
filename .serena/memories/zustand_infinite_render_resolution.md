# Zustand Infinite Re-render Resolution

**Status:** ✅ RESOLVED (2025-11-11)

## Problem

React application experiencing infinite re-render loop with "Maximum update depth exceeded" error due to unstable Zustand store subscriptions causing `useSyncExternalStore` to see new subscriptions on every render.

## Root Causes Identified

### 1. Over-subscription Pattern

**Anti-pattern:**

```typescript
// ❌ BAD: Subscribes to ALL campaign store fields
const { currentCampaignId } = useCampaignStore();
```

**Solution:**

```typescript
// ✅ GOOD: Only subscribes to specific field
const currentCampaignId = useCurrentCampaignId();
```

**Impact:** Using `useCampaignStore()` caused component to re-render on ANY campaign store change, creating cascading re-renders.

### 2. Closure Dependencies in Event Handlers

**Anti-pattern:**

```typescript
// ❌ BAD: Destructures store at hook level
const { setCurrentCampaign } = useCampaignStore();

const handler = useCallback(() => {
  setCurrentCampaign(...); // Uses closure value
}, [setCurrentCampaign]); // Unstable dependency
```

**Solution:**

```typescript
// ✅ GOOD: No store destructuring at hook level
const handler = useCallback(() => {
  useStore.getState().setCurrentCampaign(...); // Gets fresh reference
}, []); // Only stable dependencies
```

**Impact:** Destructuring store actions created unstable dependencies in useCallback, causing handler recreation and re-subscription.

### 3. Timing of getState() Calls

**Anti-pattern:**

```typescript
// ❌ BAD: Calls getState() at callback creation time
const handler = useCallback((event) => {
  const { campaign, setCurrentCampaign } = useStore.getState(); // Evaluated during creation

  if (campaign) {
    setCurrentCampaign(...); // Uses stale state
  }
}, [client]);
```

**Solution:**

```typescript
// ✅ GOOD: Calls getState() inside event handler logic
const handler = useCallback((event) => {
  const { newTime } = event.payload;

  // Get state when event fires, not when callback is created
  const state = useStore.getState();

  if (state.campaign) {
    state.setCurrentCampaign(...); // Uses current state
  }
}, [client]);
```

**Impact:** Calling `getState()` at wrong time captured stale state, causing incorrect updates and re-render loops.

### 4. Inline Handler Functions

**Anti-pattern:**

```typescript
// ❌ BAD: Creates new function on every render
handlers.onStructureUpdated ?? (() => {});
```

**Solution:**

```typescript
// ✅ GOOD: Stable module-level constant
const NOOP_HANDLER = () => {};

handlers.onStructureUpdated ?? NOOP_HANDLER;
```

**Impact:** Every inline `(() => {})` created new function reference, causing Zustand to see it as a new subscription.

## Files Modified

1. **packages/frontend/src/stores/index.ts**
   - Added useMemo to `useIsEntitySelected` and `useSelectedEntitiesByType`

2. **packages/frontend/src/contexts/WebSocketContext.tsx**
   - Moved inline selectors to module-level constants

3. **packages/frontend/src/components/layout/MainLayout.tsx**
   - Changed from `useCampaignStore()` to `useCurrentCampaignId()`
   - Memoized keyboard shortcuts array

4. **packages/frontend/src/hooks/useWebSocketSubscription.ts**
   - Added module-level `NOOP_HANDLER`
   - Replaced ALL `(() => {})` with `NOOP_HANDLER`

5. **packages/frontend/src/hooks/useWebSocketCacheSync.ts**
   - Fixed `handleWorldTimeChanged` getState() timing
   - Removed `useCampaignStore()` destructuring
   - Changed to call actions directly from `getState()`

## Prevention Guidelines

### Always:

1. Use **precise selectors** (e.g., `useCurrentCampaignId()` not `useCampaignStore()`)
2. Define **stable constants at module level** (selectors, NOOP handlers)
3. Call **`getState()` inside event handlers**, not at callback creation
4. **Memoize** objects/arrays passed to hooks with proper dependencies

### Never:

1. Destructure store actions at hook level with Zustand
2. Use inline arrow functions as hook parameters
3. Call `getState()` at callback creation time if you need current state later
4. Subscribe to entire stores when you only need one field

## Debugging Process

When encountering similar issues:

1. **Check console warnings**: "The result of getSnapshot should be cached" indicates unstable subscriptions
2. **Search for inline functions**: `grep -n "(() => {})"` in subscription chains
3. **Verify selector stability**: Check if selectors are module-level or memoized
4. **Check store subscriptions**: Ensure components only subscribe to needed fields
5. **Verify getState() timing**: Ensure it's called when needed, not at creation time
6. **Use Explore subagent**: For comprehensive pattern analysis across codebase

## Related Issues

- Zustand uses React's `useSyncExternalStore` internally
- Any unstable reference in subscription chain triggers re-subscription
- Multiple small issues can compound into infinite loop
- HMR can mask issues - always test with full restart
