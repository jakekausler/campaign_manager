# TICKET-018: State Management & GraphQL Client

## Status

- [ ] In Progress
- **Commits**: afcd587, 0b0c13e

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
