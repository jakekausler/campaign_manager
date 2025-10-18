# TICKET-018 Implementation Plan: State Management & GraphQL Client

## Overview

Set up global state management with Zustand and configure GraphQL Code Generator to generate TypeScript types and hooks from the backend schema. Implement auth and campaign context state management, and create specialized Settlement/Structure GraphQL hooks.

## Stage 1: Install Dependencies and Configure Zustand

**Goal**: Install Zustand and set up basic store structure

**Tasks**:

- [ ] Install Zustand: `pnpm --filter @campaign/frontend add zustand`
- [ ] Create store structure in `src/stores/`
- [ ] Create root store with combine pattern
- [ ] Create store hooks file with proper TypeScript types
- [ ] Add store provider (if needed) or export hooks

**Success Criteria**:

- Zustand installed without errors
- Store structure follows best practices (slice pattern)
- TypeScript types are fully inferred
- No build or type-check errors

**Tests**:

- Basic store functionality works
- Store can be imported and used in components

**Status**: Not Started

---

## Stage 2: Configure GraphQL Code Generator

**Goal**: Set up GraphQL Code Generator to generate types and hooks from backend schema

**Tasks**:

- [ ] Install GraphQL Code Generator and plugins:
  - `@graphql-codegen/cli`
  - `@graphql-codegen/typescript`
  - `@graphql-codegen/typescript-operations`
  - `@graphql-codegen/typescript-react-apollo` (if using Apollo) OR `@graphql-codegen/typescript-urql` (if using urql)
  - `@graphql-codegen/introspection`
- [ ] Create `codegen.yml` or `codegen.ts` configuration file
- [ ] Configure schema URL to point to backend GraphQL endpoint
- [ ] Configure output paths for generated files
- [ ] Add npm scripts to `package.json`: `codegen`, `codegen:watch`
- [ ] Generate initial types and hooks
- [ ] Add generated files to `.gitignore` (generated files should be ignored)
- [ ] Document code generation process in frontend README

**Success Criteria**:

- Code generator runs successfully
- Generated types match backend schema
- Generated hooks are properly typed
- No TypeScript errors in generated files
- Code generation script can be run from root via `pnpm --filter @campaign/frontend codegen`

**Tests**:

- Run `pnpm --filter @campaign/frontend codegen` successfully
- Verify generated files exist in expected locations
- Import generated types in a test file

**Status**: Not Started

---

## Stage 3: Set Up GraphQL Client (Apollo Client or urql)

**Goal**: Configure GraphQL client with proper links and cache policies

**Decision Point**: Choose between Apollo Client (already installed) or urql based on:

- Apollo Client: More features, larger bundle, battle-tested
- urql: Smaller bundle, simpler API, extensible with exchanges

**Tasks** (assuming Apollo Client based on TICKET-017):

- [ ] Verify Apollo Client is already installed (from TICKET-017)
- [ ] Review existing Apollo Client configuration in `src/services/api/graphql-client.ts`
- [ ] Ensure HTTP link is properly configured
- [ ] Ensure WebSocket link is properly configured for subscriptions
- [ ] Verify auth link attaches tokens correctly
- [ ] Configure cache with proper type policies
- [ ] Set up cache normalization for Settlement and Structure types
- [ ] Configure cache policies:
  - Settlement queries: cache-and-network policy
  - Structure queries: cache-and-network policy
  - Cache eviction for paginated results
- [ ] Test client connection to backend API

**Success Criteria**:

- GraphQL client connects to backend successfully
- Queries and mutations work
- WebSocket subscriptions work (if applicable)
- Cache policies are correctly configured
- Auth tokens are automatically attached to requests

**Tests**:

- Manual test: Execute a simple query against backend
- Verify auth token is included in request headers
- Verify cache stores and retrieves data correctly

**Status**: Not Started

---

## Stage 4: Create Auth State Management

**Goal**: Implement authentication state with Zustand store

**Tasks**:

- [ ] Create `src/stores/auth-store.ts` with Zustand
- [ ] Implement state:
  - `token: string | null`
  - `user: User | null` (use generated User type from codegen)
  - `isAuthenticated: boolean`
- [ ] Implement actions:
  - `login(token: string, user: User): void`
  - `logout(): void`
  - `updateUser(user: User): void`
  - `refreshToken(token: string): void`
- [ ] Implement token persistence to localStorage
- [ ] Implement token auto-loading on app initialization
- [ ] Add middleware for logging state changes (development only)
- [ ] Integrate with Apollo Client auth link
- [ ] Update Apollo Client to read token from Zustand store

**Success Criteria**:

- Auth state persists across page refreshes
- Token is automatically loaded on app start
- Token is automatically attached to GraphQL requests
- Login/logout flows work correctly
- TypeScript types are fully inferred

**Tests**:

- Unit tests for auth store actions
- Test token persistence to localStorage
- Test token auto-loading
- Test integration with Apollo Client

**Status**: Not Started

---

## Stage 5: Create Campaign Context State

**Goal**: Implement campaign context state for current campaign, branch, and asOf time

**Tasks**:

- [ ] Create `src/stores/campaign-store.ts` with Zustand
- [ ] Implement state:
  - `currentCampaignId: string | null`
  - `currentBranchId: string | null`
  - `asOfTime: Date | null` (for time-travel queries)
  - `campaign: Campaign | null` (use generated Campaign type)
- [ ] Implement actions:
  - `setCurrentCampaign(campaignId: string, campaign: Campaign): void`
  - `setCurrentBranch(branchId: string): void`
  - `setAsOfTime(time: Date | null): void`
  - `clearCampaignContext(): void`
- [ ] Implement state persistence to localStorage (campaign ID only)
- [ ] Add middleware for logging state changes (development only)
- [ ] Create hooks for accessing campaign context:
  - `useCurrentCampaign()`
  - `useCurrentBranch()`
  - `useAsOfTime()`

**Success Criteria**:

- Campaign context persists across page refreshes
- Campaign context is globally accessible
- Changing campaign context updates all dependent components
- TypeScript types are fully inferred

**Tests**:

- Unit tests for campaign store actions
- Test state persistence to localStorage
- Test hooks return correct values

**Status**: Not Started

---

## Stage 6: Create Settlement GraphQL Hooks

**Goal**: Implement specialized GraphQL hooks for Settlement queries

**Tasks**:

- [ ] Create `src/services/api/hooks/settlements.ts`
- [ ] Write GraphQL queries for Settlement operations:
  - `GetSettlementsByKingdom` - List settlements by kingdom ID
  - `GetSettlementDetails` - Get single settlement with full details
  - `GetSettlementStructures` - Get structures in a settlement
- [ ] Run code generator to generate hooks
- [ ] Wrap generated hooks with custom logic:
  - `useSettlementsByKingdom(kingdomId: string)`
  - `useSettlementDetails(settlementId: string)`
  - `useStructuresBySettlement(settlementId: string)`
- [ ] Implement cache policies:
  - Use cache-and-network for lists
  - Use cache-first for details with refetch option
- [ ] Add error handling and loading states
- [ ] Add optimistic updates for mutations (if any)
- [ ] Export hooks from `src/services/api/hooks/index.ts`

**Success Criteria**:

- Settlement hooks work correctly
- Hooks use generated types
- Cache policies are correctly applied
- Error and loading states are handled
- Hooks can be imported and used in components

**Tests**:

- Integration tests for each hook (using MSW or similar)
- Test cache behavior
- Test error handling

**Status**: Not Started

---

## Stage 7: Create Structure GraphQL Hooks

**Goal**: Implement specialized GraphQL hooks for Structure queries

**Tasks**:

- [ ] Create `src/services/api/hooks/structures.ts`
- [ ] Write GraphQL queries for Structure operations:
  - `GetStructuresBySettlement` - List structures by settlement ID
  - `GetStructureDetails` - Get single structure with full details
  - `GetStructureConditions` - Get computed fields/conditions for structure
- [ ] Run code generator to generate hooks
- [ ] Wrap generated hooks with custom logic:
  - `useStructuresBySettlement(settlementId: string)`
  - `useStructureDetails(structureId: string)`
  - `useStructureConditions(structureId: string)`
- [ ] Implement cache policies:
  - Use cache-and-network for lists
  - Use cache-first for details with refetch option
- [ ] Add error handling and loading states
- [ ] Add optimistic updates for mutations (if any)
- [ ] Export hooks from `src/services/api/hooks/index.ts`

**Success Criteria**:

- Structure hooks work correctly
- Hooks use generated types
- Cache policies are correctly applied
- Error and loading states are handled
- Hooks can be imported and used in components

**Tests**:

- Integration tests for each hook (using MSW or similar)
- Test cache behavior
- Test error handling

**Status**: Not Started

---

## Stage 8: Implement Mutation Helpers and Optimistic Updates

**Goal**: Create mutation helpers with optimistic updates and proper cache invalidation

**Tasks**:

- [ ] Create `src/services/api/mutations/` directory
- [ ] Implement Settlement mutations (if any in scope):
  - Create, update, delete Settlement
  - Optimistic updates for each mutation
  - Cache invalidation/update logic
- [ ] Implement Structure mutations (if any in scope):
  - Create, update, delete Structure
  - Optimistic updates for each mutation
  - Cache invalidation/update logic
- [ ] Create custom hooks wrapping mutations:
  - `useCreateSettlement()`
  - `useUpdateSettlement()`
  - `useDeleteSettlement()`
  - `useCreateStructure()`
  - `useUpdateStructure()`
  - `useDeleteStructure()`
- [ ] Implement error rollback for failed optimistic updates
- [ ] Add toast notifications for mutation success/failure
- [ ] Export mutation hooks from `src/services/api/mutations/index.ts`

**Success Criteria**:

- Mutations update cache correctly
- Optimistic updates provide instant UI feedback
- Failed mutations roll back optimistic updates
- Cache is properly invalidated/updated
- Toast notifications show success/error states

**Tests**:

- Integration tests for each mutation
- Test optimistic updates
- Test error rollback
- Test cache invalidation

**Status**: Not Started

---

## Stage 9: Testing and Documentation

**Goal**: Write comprehensive tests and documentation for state management and GraphQL client

**Tasks**:

- [ ] Write unit tests for auth store
- [ ] Write unit tests for campaign store
- [ ] Write integration tests for Settlement hooks
- [ ] Write integration tests for Structure hooks
- [ ] Write integration tests for mutations
- [ ] Set up Mock Service Worker (MSW) for GraphQL mocking
- [ ] Create test utilities for mocking GraphQL responses
- [ ] Document state management architecture in `src/stores/README.md`
- [ ] Document GraphQL client setup in `src/services/api/README.md`
- [ ] Document code generation process
- [ ] Document cache policies and strategies
- [ ] Add examples of using hooks in components
- [ ] Update frontend README with state management section
- [ ] Run all tests and ensure they pass
- [ ] Run type-check and lint

**Success Criteria**:

- All tests pass
- Test coverage is adequate (>80% for critical paths)
- Documentation is clear and comprehensive
- No type-check or lint errors
- Code is ready for review

**Tests**:

- All unit and integration tests pass
- Test coverage meets standards

**Status**: Not Started

---

## Notes

- This implementation uses Zustand for state management (simpler than Redux, better than Context API for complex state)
- Apollo Client is already configured from TICKET-017, so we'll use it instead of urql
- GraphQL Code Generator will generate TypeScript types and React hooks from the backend schema
- Settlement and Structure are key domain entities with complex relationships, so they get specialized hooks
- Optimistic updates are critical for good UX when mutating data
- Cache policies must balance freshness with performance

## Implementation Order

1. Stage 1: Zustand setup (foundation)
2. Stage 2: Code generation (types/hooks)
3. Stage 3: GraphQL client configuration (connection)
4. Stage 4: Auth state (authentication)
5. Stage 5: Campaign state (domain context)
6. Stage 6: Settlement hooks (domain queries)
7. Stage 7: Structure hooks (domain queries)
8. Stage 8: Mutations (domain writes)
9. Stage 9: Testing and documentation (quality assurance)

## Completion Checklist

- [ ] Stage 1: Zustand setup
- [ ] Stage 2: Code generation
- [ ] Stage 3: GraphQL client
- [ ] Stage 4: Auth state
- [ ] Stage 5: Campaign state
- [ ] Stage 6: Settlement hooks
- [ ] Stage 7: Structure hooks
- [ ] Stage 8: Mutations
- [ ] Stage 9: Testing and documentation
- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] TICKET-018.md updated with commit hashes
- [ ] EPIC.md updated to mark ticket complete
