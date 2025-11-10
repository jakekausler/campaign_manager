# TICKET-035 - Stage 5: API Documentation

## Goal

Create comprehensive GraphQL API documentation with examples, including inline code documentation (JSDoc/TSDoc) for resolvers and services.

## Context

API documentation should help both frontend developers and third-party integrators understand how to interact with the GraphQL API. This includes:

- **GraphQL Schema Documentation**: Complete schema reference with field descriptions
- **Query Examples**: Common queries with variables and expected responses
- **Mutation Examples**: State-changing operations with input validation
- **Inline Documentation**: JSDoc/TSDoc comments on resolvers and services

**Existing Code to Document:**

- GraphQL resolvers in `packages/api/src/*/resolvers/`
- Services in `packages/api/src/*/services/`
- GraphQL schema files (TypeGraphQL decorators)

**Files to Create:**

- `docs/api/graphql-overview.md`
- `docs/api/queries.md`
- `docs/api/mutations.md`
- `docs/api/subscriptions.md`
- `docs/api/error-handling.md`

**Files to Enhance:**

- Add JSDoc/TSDoc comments to resolver files
- Add JSDoc/TSDoc comments to service files

## Tasks

### Development Tasks

- [x] Create `docs/api/` directory
- [x] Write GraphQL overview covering schema organization, type system, authentication
- [x] Write queries documentation with examples for each major entity (campaigns, locations, events, etc.)
- [x] Write mutations documentation with examples for CRUD operations
- [ ] Write subscriptions documentation with real-time update examples
- [ ] Write error handling guide covering GraphQL errors, validation, authorization
- [ ] Add JSDoc comments to all resolver classes and methods in `packages/api/src/`
- [ ] Add JSDoc comments to all service classes and methods in `packages/api/src/`
- [ ] Include example requests/responses for complex operations (branching, merging, effects)

### Quality Assurance Tasks

- [ ] Run type-check to ensure JSDoc comments don't introduce type errors (use TypeScript Fixer subagent)
- [ ] Fix type errors (if any exist from previous task)

### Review and Commit Tasks

- [ ] Run code review (use Code Reviewer subagent - MANDATORY)
- [ ] Address code review feedback (if any exists from previous task)
- [ ] Commit stage changes with detailed conventional commit message

## Implementation Notes

**GraphQL Overview Documentation (Task 2):**

- Created comprehensive `docs/api/graphql-overview.md` (920+ lines)
- Used Explore subagent to research API structure, saving context
- Documented all major aspects:
  - **Schema Organization**: Code-first architecture with TypeGraphQL, 20+ resolvers, 22+ types, 21+ inputs
  - **Type System**: Core types (Campaign, Location, Event, etc.) with complete field listings and examples
  - **Authentication**: JWT-based auth (15-min expiration), three strategies (Local, JWT, API Key)
  - **Authorization**: Three patterns (query-level, role-based, resource-level) with code examples
  - **Performance**: Query complexity limiting (max 1000), DataLoaders for N+1 prevention, pagination
  - **Custom Scalars**: DateTime, GeoJSON, JSON, Upload with detailed usage examples
  - **Common Patterns**: Standard CRUD, optimistic locking (version field), field resolvers
  - **Advanced Features**: Branching, Effects (JSON Patch), Conditions (JSONLogic), Dependencies, WorldTime
  - **Getting Started**: Step-by-step guide from authentication to querying data
- Included code examples throughout (GraphQL queries/mutations, TypeScript resolver examples)
- Cross-referenced to feature documentation in `docs/features/`
- Formatted with clear TOC, sections, and consistent styling

**Queries Documentation (Task 3):**

- Created comprehensive `docs/api/queries.md` (1,840+ lines)
- Used Explore subagent to research all 75+ query methods across 23 resolvers
- Organized by entity type with 11 major sections:
  - **Campaign Management**: World, Campaign queries (7 queries)
  - **Geographic Entities**: Location, Kingdom, Settlement, Structure queries (21 queries)
  - **Gameplay Entities**: Event, Encounter, Party, Character queries (13 queries)
  - **Advanced Features**: Branch, Merge, State Variable, Field Condition, Dependency Graph, Effect, Spatial queries (34+ queries)
  - **Utility Queries**: World Time, Health Check, Cache Stats
- Each query includes:
  - Complete GraphQL query with field selections
  - Variables example with JSON
  - Response example with actual data structure
  - Description of parameters and return types
- Documented all query patterns: pagination, filtering, sorting, field selection, aliases, fragments
- Included 8 best practices with code examples (DataLoader usage, avoiding over-fetching, query complexity)
- Covered advanced features: time-travel queries (asOf), spatial queries (PostGIS), 3-way merge preview
- Cross-referenced to mutations, subscriptions, error handling docs

**Mutations Documentation (Task 4):**

- Created comprehensive `docs/api/mutations.md` (2,500+ lines)
- Used Explore subagent to research all 100+ mutation methods across 20+ resolvers
- Organized by entity type with 8 major sections:
  - **Campaign Management**: World, Campaign mutations (10 mutations)
  - **Geographic Entities**: Location, Kingdom, Settlement, Structure mutations (40+ mutations including variable ops)
  - **Gameplay Entities**: Event, Encounter, Party, Character mutations (35+ mutations including workflow ops)
  - **Dynamic Variables & Conditions**: State Variable, Field Condition mutations (10 mutations)
  - **Advanced Features**: Effect, Branch, Merge, Link mutations (20+ mutations)
- Documented common patterns:
  - **Optimistic Locking**: branchId + expectedVersion pattern for all updates
  - **Soft Deletes**: archive/restore pattern with archivedAt timestamps
  - **Standard CRUD**: create, update, delete, archive, restore for most entities
  - **Variable Management**: setXVariable mutations returning { name, value }
  - **Level Progression**: setXLevel mutations for Settlement, Kingdom, Structure, Party
  - **Workflow Completion**: completeEvent, resolveEncounter with resolution data
  - **Effect Execution**: executeEffect with dry-run support, executeEffectsForEntity for batch ops
  - **Branching Operations**: forkBranch with history copying, divergence tracking
  - **Merge Operations**: executeMerge with 3-way merge + conflict resolution, cherryPickVersion
- Each mutation includes:
  - Complete GraphQL mutation with typed variables
  - Input example with JSON showing required/optional fields
  - Response example with actual return type structure
  - Description of operation and side effects
- Included comprehensive error handling section:
  - GraphQL error format with extensions
  - Common error codes (UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, BAD_USER_INPUT, VERSION_CONFLICT)
  - Validation errors with field-specific details
  - Version conflict errors with retry patterns
  - Authorization errors with role requirements
- Added 10 best practices with code examples:
  1. Always use optimistic locking for updates
  2. Handle version conflicts gracefully with retry logic
  3. Use soft deletes (archive) by default
  4. Validate input client-side to reduce round trips
  5. Use batch operations when available (executeEffectsForEntity)
  6. Request only needed fields to keep mutations efficient
  7. Use dry run for effects before applying
  8. Include context in mutations for audit logs
  9. Handle partial failures in batch operations
  10. Use transactions for related mutations
- Cross-referenced to other docs: graphql-overview.md, queries.md, subscriptions.md, error-handling.md, feature docs

## Commit Hash

_Added when final commit task is complete_
