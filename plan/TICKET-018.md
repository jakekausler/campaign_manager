# TICKET-018: State Management & GraphQL Client

## Status

- [ ] In Progress
- **Commits**: afcd587, 0b0c13e, 276dd98, 682acc3

## Description

Set up global state management with Zustand and GraphQL client (Apollo Client or urql) with code generation from schema.

## Scope of Work

1. Install and configure Zustand for state management
2. Set up Apollo Client / urql with GraphQL endpoint
3. Configure GraphQL Code Generator
4. Create auth state management (token storage, user context)
5. Create campaign context state (current campaign, branch, asOf time)
6. Implement query hooks and mutation helpers
7. GraphQL hooks for Settlement and Structure types (useSettlementsByKingdom, useStructuresBySettlement, useSettlementDetails, useStructureDetails)
8. Add optimistic updates
9. Set up cache policies

## Acceptance Criteria

- [ ] GraphQL client connects to API
- [ ] Generated types match schema
- [ ] Auth token persists and auto-attaches
- [ ] Campaign context is globally accessible
- [ ] Queries use generated hooks
- [ ] Mutations update cache correctly
- [ ] Optimistic updates work
- [ ] Settlement GraphQL hooks work correctly
- [ ] Structure GraphQL hooks work correctly
- [ ] Can query Settlements by Kingdom via hooks
- [ ] Can query Structures by Settlement via hooks

## Dependencies

- Requires: TICKET-005, TICKET-017

## Technical Notes

**Cache Policies for Settlement/Structure Relationships:**

- Settlement queries should be cached by Kingdom ID and settlement ID
- Structure queries should be cached by Settlement ID and structure ID
- Implement proper cache normalization for nested relationships
- Use cache-and-network policy for Settlement/Structure lists to ensure fresh data
- Configure cache eviction policies for paginated Settlement/Structure results

## Estimated Effort

2-3 days

## Implementation Notes

### Stage 1: Install Dependencies and Configure Zustand (Complete - afcd587)

**What was implemented:**

- Installed Zustand state management library
- Created `packages/frontend/src/stores/` directory structure
- Implemented slice pattern with separate concerns:
  - `auth-slice.ts`: Authentication state (placeholder for Stage 4)
  - `campaign-slice.ts`: Campaign context state (placeholder for Stage 5)
  - `index.ts`: Root store combining slices with middleware
- Added middleware:
  - devtools: Redux DevTools integration (development only)
  - persist: localStorage persistence for token and currentCampaignId
- Created optimized selector hooks for fine-grained reactivity
- Comprehensive documentation in `stores/README.md`

**Technical decisions:**

- Used Zustand slice pattern for scalability and separation of concerns
- Persist only essential state (token, currentCampaignId) to localStorage
- Enable devtools only in development to reduce production bundle size
- Created granular selector hooks to prevent unnecessary re-renders
- Auth and campaign slices are placeholders with basic structure

**Code review outcome:** Approved with minor optional suggestions for future stages

**Quality checks:** All type-check, lint, and build checks passed

---

### Stage 2: Configure GraphQL Code Generator (Complete - 0b0c13e)

**What was implemented:**

- Installed GraphQL Code Generator packages (cli, typescript, typescript-operations, typescript-react-apollo, introspection)
- Created `codegen.ts` TypeScript configuration file
- Configured schema introspection from `http://localhost:4000/graphql` (configurable via GRAPHQL_SCHEMA_URL)
- Single-file output approach: generates `src/__generated__/graphql.ts` and `introspection.json`
- Added npm scripts: `codegen` and `codegen:watch`
- Updated `.gitignore`: excludes `__generated__/*` but tracks `README.md`
- Created comprehensive documentation:
  - `src/__generated__/README.md` with usage guide and troubleshooting
  - Updated `frontend/README.md` with code generation section
  - Added `GRAPHQL_SCHEMA_URL` to `.env.example`

**Technical decisions:**

- Single-file output instead of near-operation-file preset for simplicity
- Schema URL configurable via environment variable for CI/CD flexibility
- Custom scalar mappings: DateTime→string, JSON→Record<string, unknown>, UUID→string
- TypeScript strict mode compatible (enumsAsTypes: true, skipTypename: false)
- Prettier formatting with error handling (continues on failure)
- Generated files gitignored but README tracked for documentation

**Code review changes:**

- Removed unused `@graphql-codegen/near-operation-file-preset` dependency
- Made schema URL configurable via GRAPHQL_SCHEMA_URL environment variable
- Added error handling to Prettier formatting hook
- Improved README example with explanatory comments

**Known issue:**

Backend API has a dependency injection issue (RulesEngineClientService not available in GraphQLConfigModule) preventing it from starting. Code generation setup is complete but cannot be executed until backend is fixed. This is tracked separately and not blocking for Stage 2 completion.

**Quality checks:** All type-check, lint, and build checks passed

---

### Stage 3: Set Up GraphQL Client (Apollo Client) (Complete - 276dd98)

**What was implemented:**

- Integrated Apollo Client with Zustand store for authentication
- Configured comprehensive cache policies for Settlement and Structure types
- Set up cache normalization with proper keyFields and merge strategies
- Added JSDoc documentation explaining authentication and caching behavior

**Technical decisions:**

- **Zustand Integration**: Replaced direct localStorage access with `useStore.getState()`
  - Auth link retrieves fresh token from Zustand on each request
  - WebSocket connectionParams function gets fresh token on connection
  - Documented that getState() ensures fresh state (not closure over initial state)
- **Cache Policies**:
  - Settlement queries cached by kingdomId with separate cache entries
  - Structure queries cached by settlementId with separate cache entries
  - Both types use keyFields: ['id'] for proper normalization
  - Replace-all merge strategy chosen for simplicity (appropriate for current use case)
- **Computed Fields**: Changed to `merge: false` to disable caching entirely
  - Ensures dynamic computed fields are always fetched fresh from backend
  - Prevents stale cached values for time-sensitive calculated data
- **Removed Code**: Eliminated unnecessary read() functions that duplicated Apollo's default behavior
- **Documentation**: Added comments warning that keyArgs must match GraphQL parameter names

**Code review outcome:**

Initial review requested improvements:

- Remove unnecessary read() functions (done)
- Change computedFields to merge: false (done)
- Add documentation about keyArgs and authentication freshness (done)
- All suggestions implemented successfully

**Known limitation:**

Backend API dependency injection issue prevents integration testing of actual GraphQL queries. Client configuration is complete and passes all static checks (type-check, lint, build) but cannot be verified with live backend until the RulesEngineClientService issue is resolved.

**Future testing needed:**

Once backend is fixed, verify:

1. Login flow: token correctly sent on subsequent requests
2. WebSocket auth: subscriptions include Bearer token after login
3. Logout flow: requests no longer include token after logout
4. Token refresh: new token used immediately after refresh
5. Cache invalidation: settlements/structures cache correctly by IDs

**Quality checks:** All type-check, lint, and build checks passed

---

### Stage 4: Create Auth State Management (Complete - 682acc3)

**What was implemented:**

Auth Slice Enhancements (`packages/frontend/src/stores/auth-slice.ts`):

- Enhanced User interface with role ('player' | 'gm' | 'admin') and timestamp fields (createdAt, updatedAt)
- Added comprehensive JSDoc documentation for all actions with usage examples
- Implemented proper state consistency in `setToken` (clears user when token is null)
- Documented integration with Apollo Client (token auto-attached via getState())
- Documented persistence behavior (token + user persisted to localStorage)
- All actions properly manage state transitions (token, user, isAuthenticated)

Store Persistence (`packages/frontend/src/stores/index.ts`):

- Updated persist configuration to persist both `token` and `user` objects
- Added `onRehydrateStorage` handler to automatically restore `isAuthenticated` on app reload
- Added clarifying comments about token validation strategy and mutation behavior
- Token validation delegated to Apollo Client error link (happens on first GraphQL request)
- User object persistence improves UX (immediate profile access without additional fetch)

**Technical decisions:**

- Persist both token and user for better UX (no flash of missing user data on reload)
- Auto-restore isAuthenticated from token presence during app initialization
- `setToken(null)` clears both token and user to prevent inconsistent state
- Token validation is NOT done during rehydration (would slow app startup)
- Validation happens in Apollo Client when first GraphQL request is made
- If token is invalid/expired, Apollo Client error link should trigger logout
- Comprehensive JSDoc with usage examples for all public APIs

**Code review outcome:**

Approved with suggested improvements implemented:

- Fixed `setToken` to clear user when token is set to null (prevents inconsistent state)
- Added clarifying comments about token validation strategy (delegated to Apollo Client)
- Added note about direct mutation in `onRehydrateStorage` callback (expected behavior)
- All suggestions from Code Reviewer were addressed before commit

**Quality checks:** All type-check, lint, and build checks passed

**Integration notes:**

The auth state is now fully integrated with:

1. **Apollo Client** (Stage 3): `graphql-client.ts` reads token via `useStore.getState()`
2. **Zustand Store**: Combines auth + campaign slices with devtools + persist middleware
3. **localStorage**: Token + user automatically persisted and restored on app reload

**Future work (deferred to Stage 9):**

- Unit tests for auth slice actions
- Unit tests for persistence and rehydration
- Integration tests with Apollo Client
- Tests for edge cases (expired tokens, invalid tokens, etc.)
