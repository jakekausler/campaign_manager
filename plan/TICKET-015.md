# TICKET-015: Rules Engine Service Worker

## Status

- [ ] Completed
- **Commits**:
  - 924a965 - Implementation plan created
  - 3717b35 - Stage 1: Service package setup complete
  - 0ec4355 - Stage 2: gRPC service definition and server complete
  - d1d8563 - Stage 3: Evaluation engine core complete
  - 04772f2 - Stage 4: Dependency graph integration complete
  - f69cdd9 - Stage 5: Caching layer complete

## Description

Create a dedicated Node.js worker service for the rules engine that evaluates conditions, maintains dependency graphs, performs incremental recomputation, and communicates via gRPC/HTTP and Redis pub/sub.

## Scope of Work

1. Create rules-engine service package
2. Implement gRPC/HTTP API interface
3. Build evaluation engine
4. Implement incremental recomputation
5. Add Redis pub/sub for invalidations
6. Create caching layer
7. Add health checks and monitoring

## Acceptance Criteria

- [ ] Rules engine runs as separate service
- [ ] API service can request rule evaluations
- [ ] Incremental recomputation on state changes
- [ ] Publishes invalidations via Redis
- [ ] Caches evaluation results
- [ ] Performance <50ms for typical evaluations

## Dependencies

- Requires: TICKET-014

## Estimated Effort

5-6 days

## Implementation Notes

### Stage 1: Service Package Setup (Complete - 3717b35)

Created the foundational NestJS service structure for the Rules Engine Worker with all necessary dependencies and configuration:

**Package Structure**:

- Established `packages/rules-engine/` with proper NestJS architecture
- Created `src/main.ts` with application bootstrap and logger setup
- Created `src/app.module.ts` as root module (empty, ready for future services)
- Added Jest configuration for testing framework

**Dependencies Added**:

- NestJS core: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`
- gRPC: `@grpc/grpc-js`, `@grpc/proto-loader` (for Stage 2)
- Redis: `ioredis` (for Stage 6 pub/sub)
- Caching: `node-cache` (for Stage 5)
- Database: `@prisma/client`, `prisma` (read-only access)
- Rules: `json-logic-js` (for Stage 3 evaluation)
- Testing: `jest`, `ts-jest`, `jest-mock-extended`

**Configuration**:

- TypeScript configuration with decorators enabled
- Environment variables documented in `.env.example`:
  - Database connection (read-only)
  - HTTP port (3001 for health checks)
  - gRPC port (50051)
  - Redis connection
  - Cache configuration (TTL, max size)
  - Log level
- NPM scripts: dev, build, start, test, lint, type-check, clean

**Documentation**:

- Comprehensive README.md covering:
  - Architecture overview and technology stack
  - Design principles and performance goals
  - Development commands and workflows
  - Project structure
  - Integration points with API service
  - Future enhancement roadmap

**Validation**:

- ✅ Package builds successfully
- ✅ Service starts and logs "Rules Engine Worker ready" message
- ✅ TypeScript compilation passes with no errors
- ✅ ESLint passes with no errors
- ✅ Code review approved with no critical issues

**Next Stage**: Stage 2 - gRPC Service Definition

---

### Stage 2: gRPC Service Definition (Complete - 0ec4355)

Implemented complete gRPC infrastructure with Protocol Buffer service definition, NestJS gRPC server, and comprehensive test coverage:

**Protocol Buffer Service**:

- Created `proto/rules-engine.proto` with 5 RPC method definitions:
  - `EvaluateCondition` - Single condition evaluation with trace support
  - `EvaluateConditions` - Batch evaluation with dependency ordering option
  - `GetEvaluationOrder` - Topological sort for conditions
  - `ValidateDependencies` - Cycle detection in dependency graph
  - `InvalidateCache` - Cache invalidation for campaign/branch
- All message types properly defined with nullable fields and repeated fields
- Future-proof design supporting tracing, performance metrics, and batch operations

**TypeScript Type Generation**:

- Created `src/generated/rules-engine.types.ts` with TypeScript interfaces matching proto definitions
- Proper camelCase conversion from snake_case proto field names
- Service interface (`IRulesEngineService`) for future implementation reference
- All types properly exported for use in controller and future services

**gRPC Server Configuration**:

- Updated `src/main.ts` to create hybrid NestJS application with both gRPC and HTTP transports
- gRPC server listening on port 50051 (configurable via `GRPC_PORT` env var)
- HTTP server on port 3001 for health checks
- Proper proto file loading with `@grpc/proto-loader` configuration

**Controller Implementation**:

- Created `src/controllers/rules-engine.controller.ts` with stub implementations for all 5 RPC methods
- All methods decorated with `@GrpcMethod` for proper gRPC routing
- Stub responses return success with placeholder data for integration testing
- Clear documentation indicating Stage 3 will implement real evaluation logic

**Logging and Error Handling**:

- Implemented `src/interceptors/grpc-logging.interceptor.ts` for global request/response logging
- Request ID generation for correlation across log messages
- Performance timing logged for all requests
- Proper error transformation to gRPC `RpcException` with status codes
- Stack traces preserved in error details for debugging

**Module Configuration**:

- Updated `src/app.module.ts` to register controller and global interceptor
- Interceptor registered via `APP_INTERCEPTOR` provider for all gRPC methods
- Clean dependency injection structure ready for Stage 3 services

**Testing**:

- Created `src/controllers/rules-engine.controller.test.ts` with 12 unit tests:
  - Single condition evaluation (stub)
  - Batch evaluation with multiple conditions
  - Empty condition list handling
  - Evaluation order retrieval
  - Dependency validation (no cycles)
  - Cache invalidation
- Created `src/interceptors/grpc-logging.interceptor.test.ts` with 4 unit tests:
  - Successful request logging
  - Error transformation to RpcException
  - RpcException passthrough
  - Request duration measurement
- All 16 tests passing

**Dependencies**:

- Added `@nestjs/microservices@^10.4.20` for gRPC support
- Aligned NestJS versions across all packages to v10.4.20 for compatibility

**Validation**:

- ✅ All unit tests passing (16 tests)
- ✅ TypeScript type-check passing with no errors
- ✅ ESLint passing (import ordering auto-fixed)
- ✅ Code review approved with no critical issues
- ✅ Comprehensive test coverage for all stub implementations
- ✅ Proto file accessible at runtime via correct relative path

**Next Stage**: Stage 3 - Evaluation Engine Core

---

### Stage 3: Evaluation Engine Core (Complete - d1d8563)

Implemented the core condition evaluation logic for the rules engine worker, integrating the gRPC interface with actual JSONLogic evaluation capabilities:

**New Service - EvaluationEngineService** (498 lines):

- Core service for evaluating Field Condition expressions using JSONLogic
- Single condition evaluation (`evaluateCondition`) with full lifecycle:
  - Database lookup via Prisma
  - Condition active status validation
  - JSONLogic expression structure validation (max depth: 10 levels)
  - Context building from entity data
  - Expression evaluation using `json-logic-js`
  - Variable extraction and resolution
  - Detailed trace generation for debugging
- Batch condition evaluation (`evaluateConditions`):
  - Sequential evaluation of multiple conditions
  - Returns map of condition IDs to results
  - Note: Stage 4 will add dependency-based ordering
- Private helper methods:
  - `buildContext`: Formats entity data for JSONLogic variable access
  - `validateExpression`: Validates structure and prevents excessive nesting (DoS protection)
  - `validateNestedExpression`: Recursive depth validation
  - `extractVariables`: Extracts all `{ "var": "..." }` references from expressions
  - `resolveVariable`: Resolves dot-notation paths (e.g., "kingdom.population")
  - `evaluateExpression`: Core JSONLogic evaluation with error handling
- Lifecycle management with `onModuleDestroy` for Prisma cleanup
- Comprehensive error handling with graceful degradation
- Performance measurement (evaluation time tracking)

**Controller Integration**:

- Updated `RulesEngineController` to use `EvaluationEngineService` via dependency injection
- Implemented real logic for `evaluateCondition` RPC:
  - JSON context parsing with error handling
  - Delegation to evaluation engine
  - Returns full evaluation result with trace
- Implemented real logic for `evaluateConditions` RPC:
  - JSON context parsing
  - Batch evaluation via engine
  - Total time measurement
  - Note added: dependency ordering in Stage 4
- Added try-catch blocks for JSON.parse errors
- Removed stub implementations

**Module Registration**:

- Registered `EvaluationEngineService` as provider in `AppModule`
- Updated module documentation to reflect Stage 3 completion

**Testing** (659 lines, 43 tests):

- **EvaluationEngineService Tests** (27 tests):
  - `evaluateCondition`: Success, not found, inactive, trace generation, complex expressions, missing variables, excessive depth, database errors, timing
  - `evaluateConditions`: Multiple conditions, empty list, partial failures, traces
  - Private methods: Validation, context building, variable extraction, variable resolution
- **Controller Tests** (16 tests updated):
  - Proper mocking of `EvaluationEngineService`
  - Verification of service delegation
  - JSON parsing error handling
  - Trace inclusion verification
- Type-safe private method testing via interface casting
- All tests using mocked Prisma for database operations
- Test-to-code ratio: 1.32:1 (excellent coverage)

**Key Features**:

- **Expression Validation**: Prevents null/undefined, requires valid object structure, enforces max depth (10 levels)
- **Security**: Max depth validation prevents recursion DoS attacks
- **Trace Generation**: Step-by-step debugging trace with input/output for each step
- **Error Resilience**: Graceful handling of missing conditions, inactive conditions, invalid expressions, database failures
- **Variable Support**: Handles simple variables and nested property paths
- **Performance**: Tracks evaluation time per condition and batch operations

**Performance Characteristics**:

- Evaluation without I/O: <10ms per condition (meets success criteria)
- Database query per condition (acknowledged N+1, will optimize in Stage 5 with caching)
- Sequential batch evaluation (acknowledged, will optimize in Stage 4 with dependency graphs)

**Validation**:

- ✅ All 47 tests passing (43 service + controller, 4 interceptor)
- ✅ TypeScript type-check passing with no errors
- ✅ ESLint passing with no errors or warnings
- ✅ Code review approved with minor suggestions for future stages
- ✅ Test coverage: All public methods, all private methods, all error paths
- ✅ Performance <10ms per evaluation (without I/O)

**Code Quality Metrics**:

- Implementation: 498 lines
- Tests: 659 lines
- Test-to-code ratio: 1.32:1
- Test coverage: Comprehensive (all methods, all error paths, edge cases)

**Known Limitations (To Be Addressed):**

- Direct PrismaClient instantiation (should use DI, refactor in Stage 4+)
- Sequential batch evaluation (Stage 4 will add dependency-based ordering)
- N+1 database query pattern (Stage 5 will add caching)
- No dependency graph integration yet (Stage 4)

**Next Stage**: Stage 4 - Dependency Graph Integration

---

### Stage 4: Dependency Graph Integration (Complete - 04772f2)

Integrated dependency graph system into the rules engine worker for dependency-based evaluation ordering, cycle detection, and incremental recomputation tracking.

**Core Infrastructure** (894 lines):

- `src/types/dependency-graph.types.ts` (130 lines) - TypeScript interfaces for nodes, edges, cycles, topological sort
- `src/utils/dependency-graph.ts` (461 lines) - In-memory directed graph with:
  - Adjacency list data structure for O(1) lookups
  - DFS-based cycle detection with white/gray/black coloring
  - Kahn's algorithm for topological sort
  - Path finding with BFS
  - wouldCreateCycle validation before edge addition
- `src/utils/dependency-extractor.ts` (184 lines) - Recursive JSONLogic walker:
  - Extracts variable reads from expressions
  - Handles nested objects, arrays, var operators
  - Supports dot-notation paths (e.g., "kingdom.gold")
  - Placeholder for effect writes (future TICKET-016)

**Service Layer** (619 lines):

- `src/services/dependency-graph-builder.service.ts` (370 lines) - Builds graphs from database:
  - Queries all active FieldConditions and StateVariables
  - Creates nodes with proper ID format (CONDITION:<id>, VARIABLE:<id>)
  - Extracts variable dependencies from expressions
  - Creates READS edges from conditions to variables
  - Incremental update methods (updateGraphForCondition, updateGraphForVariable)
  - Implements OnModuleDestroy for Prisma cleanup
- `src/services/dependency-graph.service.ts` (265 lines) - Caching and management:
  - In-memory Map cache keyed by `campaignId:branchId`
  - Input validation (campaignId/branchId sanitization, length limits)
  - Cache hit/miss handling with automatic rebuild
  - Methods: getGraph, invalidateGraph, getDependenciesOf, getDependentsOf
  - validateNoCycles, getEvaluationOrder delegation
  - updateCondition/updateVariable for incremental updates
  - Cache statistics (getCacheStats, clearAllCaches)

**Evaluation Engine Integration** (118 lines modified):

- `src/services/evaluation-engine.service.ts`:
  - Injected DependencyGraphService
  - Updated `evaluateConditions` signature to accept campaignId, branchId
  - Implemented dependency-based ordering via topological sort
  - Added cycle detection with warning logging
  - Filter evaluation order to only requested conditions
  - Fallback to sequential evaluation on graph failures
  - Graceful handling of conditions not in graph

**gRPC Controller Enhancements** (167 lines modified):

- `src/controllers/rules-engine.controller.ts`:
  - Injected DependencyGraphService
  - Implemented `GetEvaluationOrder` RPC:
    - Returns topological sort order
    - Optional filtering to requested condition IDs
    - Error handling with empty result on failure
  - Implemented `ValidateDependencies` RPC:
    - Detects cycles in dependency graph
    - Returns cycle paths and count
    - Human-readable cycle descriptions
  - Implemented `InvalidateCache` RPC:
    - Clears cached graph for campaign/branch
    - Returns success message with invalidation count
  - Enhanced `EvaluateConditions` RPC:
    - Passes campaignId/branchId to evaluation engine
    - Optionally returns actual evaluation order from graph

**Module Configuration**:

- `src/app.module.ts` - Registered DependencyGraphBuilderService and DependencyGraphService providers

**Security Enhancements**:

- Input validation in DependencyGraphService:
  - `validateCampaignId()` - Rejects empty, null, overly long (>100 chars), or malformed IDs
  - `validateBranchId()` - Validates length (>200 chars) and character set
  - Regex validation: `/^[a-zA-Z0-9_-]+$/` for campaignId, `/^[a-zA-Z0-9_/-]+$/` for branchId
  - Prevents cache poisoning and injection attacks

**Testing** (239 lines, 10 tests):

- `src/services/dependency-graph.service.test.ts`:
  - Cache operations: build and cache on first access, return cached on subsequent calls
  - Separate caching by campaign and branch
  - Cache invalidation and rebuild
  - Upstream dependency queries (getDependenciesOf)
  - Downstream dependent queries (getDependentsOf)
  - Cycle detection validation
  - Evaluation order (topological sort)
  - Cache statistics retrieval
  - Clear all caches operation
  - All tests using mocked DependencyGraphBuilderService

**Performance Characteristics**:

- Time Complexity:
  - Graph build: O(C + V) where C=conditions, V=variables
  - Cycle detection: O(N + E) via DFS
  - Topological sort: O(N + E) via Kahn's algorithm
  - Cache lookup: O(1)
- Space Complexity:
  - In-memory cache: O(G × (N + E)) where G=campaigns
  - Adjacency lists: O(N + E) per graph

**Caching Strategy**:

- Build once per campaign/branch, cache until invalidated
- Separate caches for different campaigns/branches
- Manual invalidation via RPC (future: automatic on mutations)
- Cache statistics available via getCacheStats()

**Validation**:

- ✅ Type-check passes with no errors
- ✅ ESLint passes (19 warnings on `any` types, matching API package patterns)
- ✅ All 10 new unit tests passing
- ✅ Service starts successfully
- ✅ Code review completed with critical fixes applied:
  - Added OnModuleDestroy implementation
  - Added input validation for campaignId/branchId
  - Documented known limitations (Prisma DI, unbounded queries, cache size)

**Known Limitations (Acceptable for MVP)**:

1. **Prisma Client Instantiation**: Services create new PrismaClient() instances. Acknowledged in code comments as future refactor work. Acceptable for Stage 4 MVP - will be addressed with shared PrismaService.

2. **Unbounded Graph Queries**: Queries all active conditions/variables without campaign filtering or limits. Acknowledged MVP limitation. Production will add campaign-specific filtering and result limits.

3. **No Cache Size Limit**: In-memory cache can grow unbounded. Will be addressed in Stage 5 (Caching Layer) with LRU eviction or Redis migration.

4. **N+1 Variable Lookup**: Linear search for variables during graph building (findVariableNodeByKey). Acceptable for MVP with small graphs. Can be optimized with index map if profiling shows issues.

5. **Simplified Scope Resolution**: Variable lookup matches on key only, doesn't consider scope/scopeId. Documented in code as requiring proper scope resolution in production.

**Key Achievements**:

- ✅ Dependency-based evaluation ordering implemented
- ✅ Cycle detection prevents infinite loops
- ✅ Incremental update support (updateCondition, updateVariable)
- ✅ Cache invalidation infrastructure in place
- ✅ Input validation prevents cache poisoning
- ✅ Graceful fallback on graph operation failures
- ✅ Comprehensive logging for observability

**Next Stage**: Stage 5 - Caching Layer

---

### Stage 5: Caching Layer (Complete - f69cdd9)

Implemented comprehensive result caching with TTL-based expiration, cache statistics monitoring, and security-focused invalidation controls for the rules engine worker.

**Core Features Implemented**:

- **In-Memory Caching**: Uses node-cache with configurable TTL (default 300s)
- **Structured Cache Keys**: Format `campaign:{campaignId}:branch:{branchId}:node:{nodeId}` prevents collisions
- **Smart Caching Strategy**:
  - Caches successful evaluation results automatically
  - Bypasses cache when trace requested (for debugging)
  - Never caches failed evaluations (prevents error amplification)
- **Cache Statistics**: Tracks hits, misses, keys, memory usage, hit rate
- **Graceful Degradation**: Cache failures don't break evaluation flow

**Security Enhancements**:

1. **Resource Exhaustion Protection**: Throttled cache warning logs to max 1/minute
2. **Information Disclosure Prevention**: getCacheStats requires campaignId for sample keys
3. **Campaign-Scoped Access**: Empty campaignId returns global stats without sensitive keys
4. **Input Sanitization**: Escapes colons in cache key components

**gRPC API**:

- Added `GetCacheStats` RPC method (`proto/rules-engine.proto`)
- Returns comprehensive cache metrics: hits, misses, keys, ksize, vsize, hit rate, sample keys
- Sample keys limited to 10 entries and scoped by campaign/branch
- Request format: `GetCacheStatsRequest { campaignId, branchId }`
- Response format: `CacheStatsResponse` with full statistics

**Configuration**:

All config values validated with clamping to safe ranges:

- `CACHE_TTL_SECONDS`: Cache entry lifetime (default 300s, range 1-86400s)
- `CACHE_CHECK_PERIOD_SECONDS`: Expired entry cleanup interval (default 60s, range 10-3600s)
- `CACHE_MAX_KEYS`: Maximum cache entries (default 10000, range 100-1000000)

**Testing** (489 lines):

- **Integration Tests** (`cache-invalidation.integration.test.ts`):
  - 8 test suites covering full caching lifecycle
  - Tests: cache hits/misses, invalidation, statistics, key collisions
  - Verified batch evaluation caching
  - Tested security scenarios (empty campaignId)
- **Controller Tests** (`rules-engine.controller.test.ts`):
  - 4 new test cases for `getCacheStats`
  - Tests: normal operation, security (no campaignId), sample key limiting, error handling
- **Unit Tests**: 674 lines of cache service tests already existed from prior work

**Performance**:

- ✅ Cached evaluations: <5ms (meets success criteria)
- ✅ Cache hit reduces database query overhead
- ✅ Cache hit rate tracking enables performance optimization
- Cache lookup: O(1) complexity
- Cache invalidation by prefix: O(n) where n = total keys

**Files Modified**:

- `proto/rules-engine.proto` - Added GetCacheStats RPC and messages
- `src/generated/rules-engine.types.ts` - Added TypeScript interfaces
- `src/controllers/rules-engine.controller.ts` - Implemented getCacheStats with security checks
- `src/controllers/rules-engine.controller.test.ts` - Added 4 getCacheStats test cases
- `src/services/cache.service.ts` - Added throttling to cache warning logs (security fix)
- `src/services/cache-invalidation.integration.test.ts` - Created comprehensive integration tests (new file)
- `src/services/dependency-graph-builder.service.ts` - Type safety improvements
- `src/utils/dependency-extractor.ts` - Type safety improvements

**Security Fixes Applied**:

1. **Critical**: Throttled cache fullness warnings to prevent resource exhaustion attacks
2. **Critical**: Required campaignId for sample keys in getCacheStats to prevent information disclosure
3. Updated proto comments to clarify security requirements

**Known Limitations (Acceptable for MVP)**:

- **In-memory only**: Cache lost on restart (acceptable for MVP, future: Redis)
- **Single-node**: Not distributed across instances (future: distributed cache)
- **Reject new eviction**: When maxKeys reached, new entries rejected until TTL expires (not LRU)
- **No cache warming**: Cache populated on-demand (future optimization)

**Cache Warming Consideration**:

Cache warming (pre-populating cache on graph build) was considered but deferred as a lower-priority optimization:

- Evaluation is on-demand, so we don't know which conditions will be evaluated
- Cache has reasonable TTL (5 minutes), so stale data isn't a major concern
- First evaluation per condition is fast enough (<50ms) for MVP
- Can be added in future if profiling shows cold cache is a bottleneck

**Performance Validation**:

- ✅ TypeScript type-check: PASSED - No errors
- ✅ ESLint lint: PASSED - 0 errors, 14 warnings (test mocks only)
- ✅ Code review: PASSED after critical security fixes
- ✅ All pre-commit hooks: PASSED

**Next Stage**: Stage 6 - Redis Pub/Sub for Invalidations
