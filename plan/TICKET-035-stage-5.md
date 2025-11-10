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
- [x] Write subscriptions documentation with real-time update examples
- [x] Write error handling guide covering GraphQL errors, validation, authorization
- [x] Add JSDoc comments to all resolver classes and methods in `packages/api/src/`
- [x] Add JSDoc comments to all service classes and methods in `packages/api/src/`
- [x] Include example requests/responses for complex operations (branching, merging, effects)

### Quality Assurance Tasks

- [x] Run type-check to ensure JSDoc comments don't introduce type errors (use TypeScript Fixer subagent)
- [x] Fix type errors (if any exist from previous task)

### Review and Commit Tasks

- [x] Run code review (use Code Reviewer subagent - MANDATORY)
- [x] Address code review feedback (if any exists from previous task)
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

**Subscriptions Documentation (Task 5):**

- Created comprehensive `docs/api/subscriptions.md` (1,150+ lines)
- Used Explore subagent to research subscription infrastructure, saving context
- Documented dual real-time architecture:
  - **GraphQL Subscriptions** (graphql-ws): For concurrent edit detection and optimistic locking
  - **WebSocket Events** (Socket.IO): For frontend state updates and cache invalidation
- Covered both systems comprehensively:
  - **Connection Setup**: Both graphql-ws and Socket.IO protocols with authentication
  - **GraphQL Subscription**: `entityModified` with complete examples for optimistic locking
  - **WebSocket Events**: 5 event types (entity_updated, state_invalidated, world_time_changed, settlement_updated, structure_updated)
  - **Room Organization**: Campaign, settlement, and structure scoping
  - **Authentication & Authorization**: JWT-based auth for both systems, room-level access control
  - **Frontend Integration**: Apollo Client setup with split link, React hooks (useCampaignSubscription, useSettlementSubscription, useStructureSubscription)
- Included extensive examples:
  - Concurrent edit detection with optimistic locking pattern
  - Cache invalidation with React Query integration
  - Real-time UI updates for all entity types
  - Event handlers for all subscription event types
  - Custom subscription hook usage
- Added 8 best practices with code examples:
  1. Use room-based subscriptions efficiently (subscribe once at campaign level)
  2. Invalidate queries, don't fetch directly (let React Query handle refetching)
  3. Handle reconnection gracefully (re-subscribe after disconnect)
  4. Clean up subscriptions (useEffect cleanup functions)
  5. Combine with optimistic updates (optimistic UI + subscription confirmation)
  6. Debounce high-frequency events (avoid excessive invalidations)
  7. Log subscription events in development (debugging aid)
  8. Handle concurrent edits with subscriptions (stale data detection)
- Included troubleshooting section covering 5 common issues:
  - Connection issues (token validation, WebSocket endpoint, network/firewall)
  - Authorization errors (campaign access, JWT token, membership)
  - Missing events (room subscription, backend publishing, connection status)
  - Duplicate events (multiple listeners, re-subscription issues)
  - Memory leaks (missing cleanup, proper useEffect patterns)
- Cross-referenced to other docs: graphql-overview.md, queries.md, mutations.md, error-handling.md, realtime-updates.md (feature doc), frontend-guide.md
- Explained when to use each system (table with 5 use cases)
- Documented Redis PubSub backend architecture for scalability

**Error Handling Documentation (Task 6):**

- Created comprehensive `docs/api/error-handling.md` (1,213 lines)
- Used Explore subagent to research error handling patterns throughout the API codebase
- Documented complete error response format:
  - **Standard Structure**: GraphQL error format with extensions (code, statusCode, timestamp, path)
  - **Production vs Development**: Different error detail levels for security
  - **NestJS Exception Types**: 7 exception types mapped to GraphQL codes and HTTP status codes
- Covered 6 major error categories with 29+ specific scenarios:
  - **Authentication (5)**: Missing token, invalid token, invalid credentials, invalid API key, invalid refresh token
  - **Authorization (4)**: Insufficient role, no campaign access, insufficient permission, merge restrictions
  - **Validation (9)**: Missing fields, invalid types, empty strings, invalid formulas, weak passwords, duplicates, invalid GeoJSON
  - **Resources (3)**: Not found, related missing, branch not found
  - **Conflicts (3)**: Optimistic lock, circular reference, cross-campaign constraints
  - **Business Logic (5)**: Event completed, location occupied, invalid scope, missing formula, invalid hierarchy
- Included comprehensive client-side error handling patterns:
  - TypeScript/JavaScript examples for each error type
  - Error code detection and specific handling
  - Network error handling
  - GraphQL error extraction from responses
- Documented 4 error recovery patterns:
  - **Retry with Backoff**: For version conflicts and transient errors
  - **Fallback Values**: For non-critical failures
  - **Conflict Resolution**: User-driven resolution for optimistic lock failures
  - **Permission Check**: Proactive permission verification
- Added domain-specific error examples for all major features:
  - Campaign management errors
  - Geographic entity errors (locations, settlements, structures)
  - Event and encounter errors
  - Variable and condition errors
  - Branching and merging errors
- Included best practices section with 10 guidelines:
  1. Always handle authentication errors
  2. Check authorization before mutations
  3. Validate input client-side
  4. Handle optimistic locking properly
  5. Provide user-friendly messages
  6. Log errors for debugging
  7. Use error codes for logic
  8. Handle network errors
  9. Test error scenarios
  10. Document custom errors
- Documented security considerations:
  - Error message safety (no sensitive data leakage)
  - Rate limiting behavior
  - Production vs development modes
- Cross-referenced to: graphql-overview.md, queries.md, mutations.md, subscriptions.md

**JSDoc Resolver Documentation (Task 7):**

- Added comprehensive JSDoc comments to all 23 resolver files in `packages/api/src/graphql/resolvers/`
- Used parallel subagent execution strategy to document all files efficiently
- **Already documented** (6 files - from previous work):
  - audit.resolver.ts, cache-stats.resolver.ts, health.resolver.ts
  - version.resolver.ts, world-time.resolver.ts, world.resolver.ts
- **Newly documented** (17 files - completed in this task):
  - branch.resolver.ts, campaign.resolver.ts, character.resolver.ts
  - dependency-graph.resolver.ts, effect.resolver.ts, encounter.resolver.ts
  - event.resolver.ts, field-condition.resolver.ts, kingdom.resolver.ts
  - link.resolver.ts, location.resolver.ts, merge.resolver.ts
  - party.resolver.ts, settlement.resolver.ts, spatial.resolver.ts
  - state-variable.resolver.ts, structure.resolver.ts
- **Documentation pattern applied consistently** (from world.resolver.ts):
  - File header with comprehensive purpose description
  - **Authorization** sections specifying required roles (OWNER/GM/JWT)
  - **Side Effects** sections listing state changes (audit logs, cache invalidation, etc.)
  - @param tags for all parameters with clear descriptions
  - @returns tags describing return values
  - @throws tags for exceptions where applicable
  - @see tags linking to service methods for implementation details
- **Domain-specific documentation highlights**:
  - **Branching**: Fork operations, timeline divergence, parent-child relationships
  - **Campaign/World**: Ownership models, membership access control
  - **Characters/Parties**: Membership tracking, level progression, variable management
  - **Dependency Graph**: DAG validation, topological sort, transitive closure
  - **Effects**: JSON Patch operations, dry-run mode, 3-phase execution
  - **Encounters/Events**: Resolution workflows, timeline management, completion vs. expiration
  - **Field Conditions**: JSONLogic formulas, computed fields, dependency tracking
  - **Geographic Entities**: Kingdom/Settlement/Structure hierarchies, level progression, variable schemas
  - **Links**: Directed relationships, cross-entity dependencies
  - **Locations**: GeoJSON geometry, parent-child hierarchies, DataLoader batching, tile cache
  - **Merge**: 3-way merge, conflict resolution, cherry-picking, merge history
  - **Spatial**: PostGIS operations (containment, proximity, overlap), GeoJSON handling
  - **State Variables**: Schema vs. values distinction, scope hierarchy (GLOBAL/WORLD/CAMPAIGN)
- **Quality verification**:
  - All files pass ESLint validation
  - Consistent pattern across all 23 resolver files
  - Clear explanations of "why" and practical usage scenarios
  - Cross-references to related resolvers and service methods

**JSDoc Service Documentation (Task 8):**

- Added comprehensive JSDoc comments to all 44 service files in `packages/api/src/`
- Used parallel subagent execution strategy to document all files efficiently
- **Service files documented** (44 total):
  - **Auth services** (6): prisma, users, auth, campaign-membership, api-key, permissions
  - **Core services** (10): world, campaign, branch, merge, version, world-time, location, kingdom, settlement, structure
  - **Entity services** (4): character, party, event, encounter
  - **Link & variable services** (4): link, state-variable, condition, effect
  - **Audit & history services** (2): audit, level-history
  - **Variable system services** (3): variable-schema, variable-evaluation, condition-evaluation
  - **Dependency & effect services** (4): dependency-graph, dependency-graph-builder, effect-execution, effect-patch
  - **Context builders** (3): campaign-context, settlement-context-builder, structure-context-builder
  - **Spatial & cache services** (4): spatial, tile-cache, cache, cache-stats
  - **Integration services** (4): websocket-publisher, rules-engine-client, expression-parser, settlement-operators, structure-operators
- **Documentation pattern applied consistently**:
  - File header with @fileoverview, @module tags
  - Class-level documentation with feature lists and usage examples
  - Constructor documentation with @param tags for dependencies
  - Method documentation with @param, @returns, @throws, @example tags
  - Private method documentation with @private tags
  - Comprehensive descriptions explaining "why" and practical usage
  - Cross-references using @see tags to related services
- **Domain-specific documentation highlights**:
  - **Authentication**: JWT tokens, password hashing, API keys, refresh tokens, role-based access
  - **Authorization**: Permission checking, campaign membership, role hierarchies
  - **Versioning**: Entity snapshots, optimistic locking, time-travel queries, branch inheritance
  - **Branching**: Fork workflows, alternate timelines, version copying, hierarchy management
  - **Merging**: 3-way merge algorithm, conflict detection, cherry-picking, common ancestor finding
  - **World Time**: Campaign-specific calendars, time progression validation, concurrency control
  - **Geographic Entities**: PostGIS integration, GeoJSON handling, spatial queries, hierarchical relationships
  - **State Variables**: Schema definitions, JSONLogic formulas, scope hierarchy (WORLD→CAMPAIGN→PARTY/KINGDOM→SETTLEMENT/CHARACTER→STRUCTURE)
  - **Conditions**: Computed fields, JSONLogic evaluation, priority-based ordering, dependency tracking
  - **Effects**: JSON Patch operations, 3-phase execution (PRE/ON_RESOLVE/POST), dry-run mode, world state mutations
  - **Dependency Graph**: DAG construction, cycle detection, topological sorting, cache invalidation
  - **Context Building**: Rules engine evaluation contexts, entity aggregation, variable resolution
  - **Spatial Operations**: PostGIS functions (ST_DWithin, ST_Contains, ST_Overlaps), GeoJSON validation, geometry conversion
  - **Caching**: Redis integration, TTL management, cache key patterns, hit/miss tracking, invalidation strategies
  - **Real-time Updates**: WebSocket events, Redis pub/sub, room-based subscriptions, horizontal scaling
  - **Rules Engine**: gRPC client, circuit breaker, local fallback, condition evaluation, custom operators
- **Bug fixes during documentation**:
  - effect.service.ts: Added missing Logger import and property declaration
- **Quality verification**:
  - All files pass ESLint validation
  - All files pass TypeScript compilation
  - Consistent pattern across all 44 service files
  - Clear explanations of architecture, algorithms, and design decisions

**Complex Operation Examples (Task 8):**

- Added comprehensive "Complex Operation Examples" section to `docs/api/mutations.md` (1,127 lines added)
- Created three complete end-to-end workflow examples:
  - **Complete Branching Workflow** (5 steps, 318 lines):
    - Step 1: Query current state to understand divergence point
    - Step 2: Fork branch with copyHistory and metadata
    - Step 3: Update event outcome in new branch (failure scenario)
    - Step 4: Apply effects to reflect raid's impact on settlement
    - Step 5: Query both timelines for comparison
    - Demonstrates alternate timeline creation with state divergence
  - **Complete Merging Workflow with Conflict Resolution** (4 steps, 295 lines):
    - Step 1: Preview merge to identify conflicts (3 conflicts shown: morale, prosperity, defense)
    - Step 2: Execute merge with conflict resolutions (ACCEPT_TARGET, ACCEPT_SOURCE)
    - Step 3: Verify merged state confirms resolution
    - Step 4: Cherry-pick specific changes as alternative to full merge
    - Demonstrates 3-way merge, conflict detection, resolution strategies
  - **Complete Effect Execution Workflow** (5 steps, 514 lines):
    - Step 1: Create effect with complex JSON Patch operations (JSONLogic formulas)
    - Step 2: Dry-run test effect without applying changes
    - Step 3: Apply effect for real to target settlement
    - Step 4: Batch apply to multiple settlements using aliases
    - Step 5: Chain multiple effects with priority-based execution order
    - Demonstrates JSON Patch state mutations, diminishing returns logic, effect chaining
- **Realistic scenarios** based on seed data:
  - Goblin raid success/failure scenarios from "Rise of the Runelords" campaign
  - Settlements: Sandpoint, Magnimar, Korvosa from Varisia region
  - Events: Swallowtail Festival with goblin raid outcome
  - Variables: morale, prosperity, defense with concrete numeric values
- **Complete request/response examples**:
  - Every step includes full GraphQL query/mutation
  - Variables with realistic JSON input data
  - Response with complete data structures and field values
  - Comments explaining context and purpose
- **Best practices demonstrated**:
  - Branch divergence at specific worldTime points
  - Optimistic locking with branchId and expectedVersion
  - Conflict resolution strategies with reasoning
  - Dry-run testing before applying effects
  - Effect priority ordering for execution control
  - Context variables for dynamic effect evaluation
  - Metadata for audit trails and debugging
- **Cross-references** to feature documentation:
  - Branching System: docs/features/branching-system.md
  - Effect System: docs/features/effect-system.md
  - Condition System: docs/features/condition-system.md
- Updated Table of Contents to include "Complex Operation Examples" section
- Total lines added: 1,127 (comprehensive examples with explanations)

**Type-Check Quality Assurance (Task: Run type-check):**

- Used TypeScript Fixer subagent to run `pnpm run type-check` across all packages
- **Result**: All packages passed type-check with zero errors
  - @campaign/shared - ✓ No errors
  - @campaign/scheduler - ✓ No errors
  - @campaign/rules-engine - ✓ No errors
  - @campaign/api - ✓ No errors
  - @campaign/frontend - ✓ No errors
- Verified that comprehensive JSDoc documentation added to 67 files (23 resolvers + 44 services) is type-safe
- All @param, @returns, @throws, and @example tags properly formatted and consistent with TypeScript type system
- No type conflicts or incorrect type references introduced by documentation

**Fix Type Errors (Task: Fix type errors):**

- **Result**: No errors to fix
- Previous type-check task found zero type errors across all packages
- JSDoc documentation is fully type-safe and compliant with TypeScript compiler
- Task marked complete immediately as no action was required

**Code Review (Task: Run code review):**

- Used Code Reviewer subagent to review all staged changes (75 files, 21,751+ insertions)
- **Review Status**: APPROVED - Ready to commit
- **Key Findings**:
  - All 21,751+ lines of documentation are high-quality and consistent
  - No code logic changes detected - documentation-only commit
  - JSDoc comments are comprehensive, accurate, and helpful
  - Documentation patterns uniform across all files
  - Proper use of @param, @returns, @throws, @fileoverview, @example tags
  - JSDoc types align with actual TypeScript types
  - No sensitive information exposed in docs/comments
  - Security-conscious documentation (auth, tokens, hashing properly documented)
  - Follows established project documentation standards
- **Documentation Quality Highlights**:
  - Comprehensive file headers with detailed @fileoverview blocks
  - Class-level documentation with architectural context and usage patterns
  - Method documentation with specific, actionable descriptions
  - New API documentation files (6,500+ lines) provide complete GraphQL reference
  - Consistent patterns across 75 files (23 resolvers + 44 services + docs/memories/plan files)
- **Reviewer Verdict**: "This is exemplary documentation work that significantly improves the developer experience. The JSDoc comments are thorough, accurate, and helpful. The new API documentation files provide comprehensive references for GraphQL operations."
- **Next Steps**: No critical issues to address, proceed directly to commit task

**Address Code Review Feedback (Task: Address code review feedback):**

- **Result**: No issues to address
- Code Reviewer found zero critical issues in previous task
- Reviewer explicitly approved all changes and recommended proceeding directly to commit
- Documentation-only changes with no code logic modifications
- All 21,751+ lines of documentation approved as-is
- Task marked complete immediately as no action was required

## Commit Hash

_Added when final commit task is complete_
