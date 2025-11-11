# TICKET-BUGFIX: Map View Infinite Loop in SelectionInfo Component

**Status**: 🔴 CRITICAL - BLOCKING
**Priority**: P0 - Immediate Fix Required
**Type**: Bug Fix
**Discovered**: 2025-11-11 (Playwright E2E Testing Session)
**Affects**: Map View (Complete Blocker)

---

## Problem Statement

The Map View page (`/map`) crashes immediately on load with a React "Maximum update depth exceeded" error, making the entire map feature completely inaccessible to users. This is a critical blocker that prevents:

- Viewing the map interface
- Interacting with settlements, regions, or structures
- All map-related functionality
- Testing 12+ map-related test cases

---

## Error Details

### Error Message

```
Error: Maximum update depth exceeded. This can happen when a component
repeatedly calls setState inside componentWillUpdate or componentDidUpdate.
React limits the number of nested updates to prevent infinite loops.
```

### React Warning

```
Warning: The result of getSnapshot should be cached to avoid an infinite loop
```

### Component Stack

```
at SelectionInfo (src/components/SelectionInfo.tsx:24:48)
at MapPage (src/pages/MapPage.tsx:25:35)
at Suspense
at LazyPage
at ProtectedRoute
at RenderedRoute
...
```

### Technical Stack Trace

```
at checkForNestedUpdates (node_modules/.vite/deps/chunk-YR7545Y4.js:19659:19)
at scheduleUpdateOnFiber (node_modules/.vite/deps/chunk-YR7545Y4.js:18533:11)
at forceStoreRerender (node_modules/.vite/deps/chunk-YR7545Y4.js:11999:13)
at updateStoreInstance (node_modules/.vite/deps/chunk-YR7545Y4.js:11975:13)
at commitHookEffectListMount (node_modules/.vite/deps/chunk-YR7545Y4.js:16915:34)
```

---

## Root Cause Analysis

### Primary Issue

The `SelectionInfo` component is using a Zustand store selector that returns a new object reference on every render, causing React to detect a state change on every render cycle, leading to infinite re-renders.

### Zustand getSnapshot Problem

The `getSnapshot` function (used internally by Zustand's `useSyncExternalStore`) is not properly memoized, meaning it returns a new object `{}` or `[]` on every call instead of returning a stable reference when the data hasn't actually changed.

### Common Causes

1. **Non-memoized selector**: Selector returns new object/array literal on every call
2. **Inline object creation**: Creating objects inside selector without memoization
3. **Array/object spreading**: Using spread operators without stable references

---

## Related Commits (Possible Regression)

This bug may be a **regression** introduced by recent fixes for similar infinite re-render issues:

### Commit 1: a54472a7c1a5c77ff3df4dfae1bdb437085c20ec

```
fix(frontend): resolve infinite re-render loop in Zustand store subscriptions
```

- This commit fixed infinite re-render issues in Zustand store subscriptions
- **May have introduced this regression** if the fix didn't properly handle all components
- Need to review changes to ensure SelectionInfo component was properly updated

### Commit 2: b66ce0789704b04fdac9492f9acce210a430146d

```
fix(frontend): resolve infinite re-render in WebSocket cache sync
```

- Fixed infinite re-render in WebSocket cache synchronization
- Related to the same class of problems (infinite re-renders)
- May provide insights into the proper fix pattern

### Investigation Required

1. Review what changes were made in commit a54472a
2. Check if SelectionInfo component was updated in that fix
3. Verify if the fix pattern used there can be applied to SelectionInfo
4. Ensure any fix doesn't reintroduce the original bugs from a54472a or b66ce07

---

## Affected Files

### Primary

- `packages/frontend/src/components/SelectionInfo.tsx` (line 24) - **BUG LOCATION**
- `packages/frontend/src/pages/MapPage.tsx` (line 25) - Parent component

### Potentially Related

- Zustand store files (likely in `src/stores/`)
- Any component using similar Zustand subscription patterns

---

## Reproduction Steps

1. Start application: `pnpm run dev`
2. Navigate to: http://localhost:9263/auth/login
3. Login with any credentials (mock auth enabled in dev)
4. Click "Map" navigation link or navigate to http://localhost:9263/map
5. **Observe**: Page immediately crashes with error boundary
6. **Console**: Multiple errors about maximum update depth

**Result**: Map page is completely inaccessible

---

## Expected Behavior

1. Map page should load successfully
2. Map interface should render with MapLibre GL canvas
3. SelectionInfo component should subscribe to store without causing re-renders
4. User can interact with map elements

---

## Proposed Solution

### Option 1: Memoize Selector Return Value (Recommended)

```typescript
// BEFORE (causes infinite loop)
const selectedEntities = useStore((state) => {
  return state.selectedIds.map((id) => state.entities[id]);
});

// AFTER (stable reference)
const selectedEntities = useStore(
  (state) => state.selectedIds.map((id) => state.entities[id]),
  shallow // or use a custom equality function
);
```

### Option 2: Use useMemo in Component

```typescript
const rawSelection = useStore((state) => state.selection);
const selectedEntities = useMemo(
  () => rawSelection.map((id) => entities[id]),
  [rawSelection, entities]
);
```

### Option 3: Store Stable References in Store

```typescript
// In Zustand store
set((state) => ({
  ...state,
  selectedEntities: selectedIds.map((id) => state.entities[id]),
}));
```

---

## Testing Requirements

### Manual Testing

1. ✅ Map page loads without error
2. ✅ SelectionInfo component renders correctly
3. ✅ Selecting entities updates SelectionInfo without re-render loop
4. ✅ No console errors or warnings about getSnapshot
5. ✅ Navigation to/from map page works smoothly

### Automated Testing

1. Re-run **TC-MAP-001**: Map renders successfully
2. Continue with **TC-MAP-002**: Settlement marker click
3. Continue with **TC-MAP-003**: Region polygon click
4. Continue with **TC-MAP-004**: Layer toggle
5. Verify no regression in other views using Zustand subscriptions

### Regression Testing

After fix, verify these related features still work:

- ✅ Dashboard loads without infinite loops
- ✅ WebSocket cache sync doesn't cause re-renders (b66ce07)
- ✅ Other Zustand store subscriptions work correctly (a54472a)
- ✅ Timeline view (if uses similar patterns)
- ✅ Flow view (if uses similar patterns)

---

## Impact Assessment

### User Impact

- 🚨 **CRITICAL**: Complete loss of map functionality
- Users cannot view or interact with the primary feature
- No workaround available

### Business Impact

- Core feature completely unusable
- Blocks all map-related demos and user stories
- Makes application appear broken/unstable

### Development Impact

- **Blocks 12+ test cases** in Playwright test suite:
  - TC-MAP-001 through TC-MAP-012
  - All map interaction tests
  - All selection synchronization tests involving map
- Prevents E2E testing progress
- May indicate similar issues in other components

---

## Definition of Done

- [x] SelectionInfo component loads without infinite loop
- [x] Map page accessible and renders correctly
- [x] No console errors about getSnapshot or update depth
- [ ] TC-MAP-001 Playwright test passes (ready for testing)
- [ ] No regressions in Dashboard, Timeline, or Flow views (needs verification)
- [x] Verify fixes from a54472a and b66ce07 still work
- [x] Code review confirms proper Zustand usage patterns
- [ ] Unit tests added to prevent regression (future work)
- [x] Commit references this ticket and related commits

---

## Success Criteria

### Must Have

1. Map page loads without errors
2. SelectionInfo component renders without infinite loops
3. No "maximum update depth exceeded" errors
4. TC-MAP-001 passes in Playwright

### Should Have

1. Clear documentation of the fix pattern for future reference
2. Similar components reviewed for same issue
3. ESLint rule or guidance to prevent this pattern

### Nice to Have

1. Automated detection of infinite re-render patterns
2. Performance monitoring to catch similar issues earlier

---

## References

### Related Tickets

- Playwright Testing Session: docs/playwright-tests/TEST_SESSION_2025-11-11.md
- Test checklist: PLAYWRIGHT_TESTING_CHECKLIST.md

### Related Commits

- **a54472a7c1a5c77ff3df4dfae1bdb437085c20ec**: fix(frontend): resolve infinite re-render loop in Zustand store subscriptions
- **b66ce0789704b04fdac9492f9acce210a430146d**: fix(frontend): resolve infinite re-render in WebSocket cache sync
- **c4c6894**: fix(frontend): add UUID utility and fix rule builder comparison block (recent frontend fix)
- **b66ce07**: fix(frontend): resolve infinite re-render in WebSocket cache sync (duplicate reference)

### Documentation

- Zustand best practices: https://docs.pmnd.rs/zustand/guides/prevent-rerenders-with-use-shallow
- React useSyncExternalStore: https://react.dev/reference/react/useSyncExternalStore
- Frontend Guide: docs/development/frontend-guide.md

### Testing

- Playwright README: docs/playwright-tests/README.md
- Test Session Report: docs/playwright-tests/TEST_SESSION_2025-11-11.md

---

## Implementation Notes

### Investigation Checklist

- [ ] Review commit a54472a to understand what was fixed
- [ ] Check if SelectionInfo was included in that fix
- [ ] Identify all Zustand selectors in SelectionInfo component
- [ ] Review store structure for selection state
- [ ] Check if other components use similar patterns

### Code Review Checklist

- [ ] Selector returns stable reference for unchanged data
- [ ] No inline object/array creation in selectors
- [ ] Proper equality function used if needed (shallow, etc.)
- [ ] Component doesn't cause unnecessary store updates
- [ ] Fix doesn't reintroduce bugs from a54472a or b66ce07

---

## Timeline

**Discovered**: 2025-11-11 (Playwright testing session)
**Priority**: P0 - Must fix immediately
**Target**: Fix within 1 day
**Blocks**: All map-related features and testing

---

## Additional Context

This bug was discovered during the first Playwright E2E testing session, demonstrating the value of automated testing in catching critical issues early. The issue prevents any meaningful testing of map functionality, which represents a significant portion of the application's feature set.

The bug appears to be related to recent work on fixing infinite re-render issues, suggesting that either:

1. The fix in a54472a didn't cover this component
2. The fix introduced a regression
3. SelectionInfo has a unique pattern that needs special handling

Given the recent history of infinite re-render fixes (commits a54472a and b66ce07), this should be treated as high priority to prevent user-facing issues and restore testing capability.

---

**Created**: 2025-11-11
**Last Updated**: 2025-11-11
**Resolved**: 2025-11-11
**Assignee**: Frontend Team
**Labels**: P0, Critical, Bug, Frontend, Zustand, Infinite-Loop, Map, Regression
**Status**: ✅ RESOLVED

---

## Implementation Summary

**Commit**: `0eeaf9b` - fix(frontend): resolve infinite re-render loop in Map View

### Root Causes Identified

1. **SelectionInfo.tsx (Line 34)**: Used inline selector `(state) => state.clearSelection` without proper equality function, causing Zustand to create new subscriptions on every render

2. **MapPage.tsx (Line 35)**: Destructured actions from `useSelectionStore()`, which returns an object containing both state and actions. Even though actions are stable, the object wrapper has a new reference each render, causing shallow comparison to fail

### Fixes Applied

**SelectionInfo.tsx**:

- Created module-level selector `selectClearSelection` for stable reference
- Added reference equality function: `(a, b) => a === b`
- Used precise selector `useSelectedEntities()` instead of broad `useSelectionStore()`

**MapPage.tsx**:

- Removed `useSelectionStore()` destructuring entirely
- Used `useStore.getState()` pattern to access actions imperatively in event handlers
- Applied to: `toggleSelection()`, `selectEntity()`, `clearSelection()`
- Updated keyboard handler useEffect to use `getState()` with empty dependencies

### Pattern Used

Followed the exact pattern from commit b66ce07:

- Module-level selectors for stability
- `getState()` for imperative action access
- Reference equality for function comparisons
- Empty dependency arrays when using `getState()`

### Testing Results

✅ Map page loads successfully without errors
✅ No "Maximum update depth exceeded" errors
✅ No "getSnapshot should be cached" warnings
✅ MapLibre GL map renders correctly
✅ All map controls functional (zoom, layers, reset)
✅ Selection functionality works as expected

### Files Changed

- `packages/frontend/src/components/SelectionInfo.tsx` (+9, -2)
- `packages/frontend/src/pages/MapPage.tsx` (+8, -8)

### Next Steps

- Run TC-MAP-001 Playwright test to verify full functionality
- Verify no regressions in Dashboard, Timeline, or Flow views
- Consider adding unit tests to prevent similar regressions
