# TICKET-023: Entity Inspector Component

## Status

- [ ] Completed
- **Commits**:
  - 23e8919 - Stage 1: UI Component Setup
  - a943d89 - Stage 2: GraphQL Hooks for Conditions and Effects

## Implementation Notes

### Stage 2: GraphQL Hooks for Conditions and Effects (Commit: a943d89)

**Completed**: All GraphQL hooks for fetching conditions and effects with comprehensive testing.

**New Hooks Created**:

Conditions (`packages/frontend/src/services/api/hooks/conditions.ts`):

- `useConditionsForEntity`: Fetches field conditions for an entity
  - Supports both instance-level and type-level conditions
  - Optional field filtering parameter
  - Cache-first fetch policy for performance
  - Returns conditions with full metadata (expression, priority, active status, version)
- `useEvaluateCondition`: Evaluates a condition with custom context
  - Lazy query pattern (doesn't execute until called)
  - Network-only fetch policy (always fresh evaluation results)
  - Returns detailed evaluation trace for debugging/explanation

Effects (`packages/frontend/src/services/api/hooks/effects.ts`):

- `useEffectsForEntity`: Fetches effects for a specific timing phase
  - Filters by entityType, entityId, and timing (PRE/ON_RESOLVE/POST)
  - Cache-first fetch policy
  - Returns JSON Patch operations in payload field
- `useAllEffectsForEntity`: Fetches effects from all timing phases in single query
  - Uses GraphQL field aliases for efficiency
  - Returns effects grouped by phase (preEffects, onResolveEffects, postEffects)
  - Also provides allEffects array combining all phases

**Testing**:

- 25 integration tests using MSW for GraphQL mocking
- `conditions.test.tsx`: 11 tests covering fetch, filter, evaluate, error handling, trace structure
- `effects.test.tsx`: 14 tests covering timing phases, grouping, metadata, execution history
- All tests passing with >80% coverage
- Mock data includes realistic JSONLogic expressions and JSON Patch payloads

**Mock Data & Handlers**:

- Added `mockConditions` (4 conditions) to `packages/frontend/src/__tests__/mocks/data.ts`
- Added `mockEffects` (4 effects) to `packages/frontend/src/__tests__/mocks/data.ts`
- Added GraphQL handlers for `GetConditionsForEntity`, `EvaluateFieldCondition`, `GetEffectsForEntity`, `GetAllEffectsForEntity`
- Handlers properly filter by entity type/ID and support field filtering

**Type Safety**:

- Placeholder TypeScript types defined until code generation runs
- Proper nullability for optional fields
- `EffectTiming` enum exported to prevent invalid values
- All functions fully typed with comprehensive JSDoc documentation

**Quality Checks**:

- TypeScript compilation: ✅ PASSED (0 errors)
- ESLint: ✅ PASSED (0 errors, pre-existing warnings in other files only)
- Tests: ✅ PASSED (25/25 tests passing)
- Code Review: ✅ APPROVED (no critical issues)

### Stage 1: UI Component Setup (Commit: 23e8919)

**Completed**: All shadcn/ui components installed and basic EntityInspector structure created.

**Components Added**:

- `Sheet` component: Slide-out panel from right side with overlay, close button, and smooth animations
- `Tabs` component: Tabbed navigation with active state styling
- `Label` component: Form label with proper accessibility

**EntityInspector Structure**:

- Created in `packages/frontend/src/components/features/entity-inspector/`
- Accepts props: `entityType` ('settlement' | 'structure'), `entityId`, `isOpen`, `onClose`
- Five tab placeholders: Overview, Links, Conditions, Effects, Versions
- Sheet configured with `sm:max-w-xl` width (may need to increase to `sm:max-w-2xl` for complex data in later stages)

**Demo Infrastructure**:

- Created `EntityInspectorDemoPage` at `/inspector-demo` route
- Buttons to test both Settlement and Structure inspector types
- Allows manual testing of Sheet open/close behavior

**Dependencies Installed**:

- `@radix-ui/react-tabs@^1.1.1` - Required for Tabs component

**Quality Checks**:

- TypeScript compilation: ✅ PASSED
- ESLint: ✅ PASSED (0 errors, pre-existing warnings only)
- Code Review: ✅ APPROVED
- All components properly typed with forwardRef and displayName
- Accessibility features: ARIA labels, sr-only text, keyboard navigation

## Description

Create a comprehensive entity inspector drawer/panel with tabs for overview, links, conditions, effects, and version history.

## Scope of Work

1. Create EntityInspector component with tabs
2. Implement Overview tab (description, computed fields)
3. Implement Links tab (related entities)
4. Implement Conditions tab (rules display)
5. Implement Effects tab (effect list)
6. Implement Versions tab (history)
7. Add edit mode for each section
8. Create "explain" feature for condition evaluation
9. Settlement-specific inspector tab showing name, location, kingdom, level, typed variables
10. Structure-specific inspector tab showing type, settlement, level, typed variables

## Acceptance Criteria

- [ ] Inspector opens on entity selection
- [ ] All tabs display correct information
- [ ] Can edit entity fields inline
- [ ] Condition explanations show evaluation trace
- [ ] Version history is browsable
- [ ] Links are clickable and navigate
- [ ] Can inspect Settlement entities with all details
- [ ] Can inspect Structure entities with all details
- [ ] Settlement inspector shows typed variables correctly
- [ ] Structure inspector shows type and typed variables correctly

## Dependencies

- Requires: TICKET-006, TICKET-018

## Estimated Effort

4-5 days
