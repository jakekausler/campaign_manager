# TICKET-035 - Stage 4: Developer Documentation

## Goal

Create comprehensive developer-facing documentation including architecture overview, deployment guide, and contributing guidelines.

## Context

Developer documentation should help new contributors understand the system architecture, set up their development environment, and contribute effectively. This includes:

- **Architecture Overview**: System design, technology choices, data flow
- **Deployment Guide**: Production deployment, environment configuration, scaling considerations
- **Contributing Guidelines**: Code standards, PR process, testing requirements
- **Settlement/Structure Technical Guide**: Deep dive into the hierarchy system

**Existing Documentation:**

- Feature docs in `docs/features/` are already comprehensive
- Development guide in `docs/development/frontend-guide.md` exists
- Subagent guide in `docs/development/subagent-guide.md` exists
- CLAUDE.md has development patterns for AI agents

**Files to Create:**

- `docs/architecture/system-overview.md`
- `docs/architecture/data-model.md`
- `docs/architecture/settlement-structure-deep-dive.md`
- `docs/deployment/production-deployment.md`
- `docs/deployment/environment-variables.md`
- `docs/deployment/scaling-guide.md`
- `CONTRIBUTING.md` (in root)

## Tasks

### Development Tasks

- [x] Create `docs/architecture/` directory
- [x] Write system overview covering monorepo structure, service architecture, technology stack
- [x] Write data model documentation covering Prisma schema, relationships, key entities
- [x] Write settlement/structure deep dive covering hierarchical design, typed variables, level progression
- [x] Create `docs/deployment/` directory
- [x] Write production deployment guide covering Docker setup, database migrations, service orchestration
- [x] Write environment variables reference documenting all configuration options
- [x] Write scaling guide covering horizontal scaling, caching strategy, performance optimization
- [x] Write CONTRIBUTING.md covering code standards, branch strategy, PR requirements, testing expectations
- [x] Add architecture diagrams where helpful (ASCII art or Mermaid diagrams)

### Review and Commit Tasks

- [x] Run code review (use Code Reviewer subagent - MANDATORY)
- [x] Address code review feedback (if any exists from previous task)
- [ ] Commit stage changes with detailed conventional commit message

### Code Review Task - Implementation Notes

**Code Review Findings:**

Used Code Reviewer subagent to review all Stage 4 documentation changes:

- **1 Critical Issue Fixed**: Replaced `TICKET-XXX` placeholder with `TICKET-035` in CONTRIBUTING.md:734
- **Security Enhancement**: Added security warning callouts to 3 deployment docs (environment-variables.md, production-deployment.md, SCALING_GUIDE.md) warning about example passwords being for demonstration only
- **Documentation Quality**: Reviewer confirmed 17,490+ lines across 16 files with 511+ code examples, 9 Mermaid diagrams, excellent cross-referencing, and technical accuracy

**Positive Findings from Code Review:**

- ✅ Comprehensive coverage and well-structured
- ✅ Code examples with proper syntax highlighting
- ✅ Mermaid diagrams for visual learning
- ✅ Excellent cross-references between docs
- ✅ Technical accuracy verified against actual codebase
- ✅ Consistent formatting and structure

**Changes Made to Address Review:**

1. Fixed CONTRIBUTING.md:734 - Changed `TICKET-XXX` to `TICKET-035`
2. Added security warning callout to `docs/deployment/environment-variables.md` (after line 3)
3. Added security warning callout to `docs/deployment/production-deployment.md` (after line 3)
4. Added security warning callout to `docs/deployment/SCALING_GUIDE.md` (after line 7)

All critical issues resolved. Documentation ready for commit.

## Implementation Notes

**Task 1 - Create architecture directory:**

- Created `docs/architecture/` directory to house developer-facing system documentation
- This directory will contain system overview, data model docs, and settlement/structure deep dive

**Task 2 - Write system overview:**

- Created comprehensive `docs/architecture/system-overview.md` (775 lines)
- Used Explore subagent to research codebase architecture, technology stack, and patterns
- Document covers:
  - Monorepo structure with pnpm workspaces and dependency graph
  - Detailed architecture of all 3 backend services (API, rules-engine, scheduler) and frontend
  - Complete technology stack tables (backend, frontend, DevOps)
  - Data flow patterns (synchronous: GraphQL/gRPC/HTTP, asynchronous: WebSocket/Redis pub-sub/Bull)
  - Key architectural patterns (microservices, multi-layer caching, real-time updates, auth/authz, database design)
  - Deployment architecture with Docker Compose and environment configuration
  - Development workflow with common commands
  - Architecture Decision Records (ADRs) explaining key choices
  - Performance characteristics for each service
- Includes code examples, diagrams (ASCII art), and cross-references to related docs
- Saved research findings to memory for future reference

**Task 3 - Write data model documentation:**

- Created comprehensive `docs/architecture/data-model.md` (1700+ lines)
- Used Explore subagent to research Prisma schema, relationships, and patterns
- Document covers:
  - Complete Prisma schema structure with all models and fields
  - Detailed documentation of all key entities across 8 categories (Auth, Campaign, Geography, Actors, Events, State, Versioning, Audit)
  - Relationship mappings: one-to-many, many-to-many, self-referential hierarchies, polymorphic (both with and without FK constraints)
  - Six key design patterns: polymorphic relationships, typed variable systems, bitemporal tracking, soft delete, hierarchical trees, event sourcing
  - Special features: PostGIS spatial data, JSON/JSONB fields, enums, compression, cascade deletion
  - Query patterns with TypeScript examples for common operations
  - Schema evolution guidance and migration best practices
- Provides code examples for all concepts (Prisma queries, spatial queries, JSONLogic conditions, JSON Patch effects)
- Includes detailed explanations of polymorphic patterns (weak FK for StateVariable scope, no FK for Condition/Effect/Dependency)
- Documents bitemporal versioning (world time vs system time)
- Cross-references to related docs and external resources

**Task 4 - Write settlement/structure deep dive:**

- Created comprehensive `docs/architecture/settlement-structure-deep-dive.md` (1750+ lines)
- Used Explore subagent to research settlement/structure system implementation
- Document covers:
  - System architecture: 3-tier political hierarchy (Campaign → Kingdom → Settlement → Structure) with separate geographic hierarchy
  - Hierarchical design: Current flat settlement list, nested structure support, future nested settlement plans
  - Typed variable system: Runtime-configurable fields with JSON Schema validation (4 types: string, number, boolean, enum)
  - Level progression system: 1-20 scale with guidelines, side effects (version increment, audit, cache invalidation, WebSocket broadcast)
  - Complete implementation details: Service layer, GraphQL schema/resolvers, cache strategy
  - Integration patterns with 6 other systems: Conditions, Effects, StateVariable, Dependency Graph, Rules Engine, Real-time updates
  - Six major design decisions with rationale (JSON variables, 1:1 location mapping, separate hierarchies, optimistic locking, etc.)
  - Performance considerations: Indexes, batch loading, virtual scrolling, debounced search, cache warming
  - Five detailed examples & use cases (creating settlements, leveling up, event effects, condition checking, hierarchical queries)
  - Five future extensions: Nested settlements, structure prerequisites, variable templates, computed formulas, change history
- Provides extensive code examples from actual implementation (Prisma models, TypeScript services, GraphQL resolvers, React components)
- Includes seed data examples from TICKET-035 Stage 1 (Sandpoint, Magnimar, Korvosa with variables)
- Documents the unique typed variable pattern that enables custom settlement types without migrations
- Explains optimistic locking pattern with version field for concurrent update prevention
- Cross-references to system overview, data model, and feature docs

**Task 5 - Create deployment directory:**

- Created `docs/deployment/` directory to house production deployment documentation
- This directory will contain deployment guide, environment variables reference, and scaling guide

**Task 6 - Write production deployment guide:**

- Created comprehensive `docs/deployment/production-deployment.md` (2500+ lines)
- Used Explore subagent to research Docker configuration, deployment architecture, and orchestration patterns
- Document covers:
  - Complete deployment overview with system requirements, prerequisites, quick start
  - Docker setup: Multi-stage builds for all services (API, Rules Engine, Scheduler, Frontend), image sizes, registry patterns
  - Database migrations: Prisma workflow, production procedures, zero-downtime strategies, PostGIS initialization, seed data
  - Service orchestration: Docker Compose layered configuration, dependency graphs, health checks, replicas/resource limits
  - Environment configuration: Required/optional variables, secret generation, Docker secrets (Swarm mode)
  - Security hardening: Container security (non-root, read-only FS, resource limits), application security (CORS, rate limiting, SQL injection prevention), database security, secrets management, SSL/TLS
  - Health checks & monitoring: Built-in endpoints, logging strategy (JSON logs), log aggregation (ELK, Loki, Datadog), application metrics (Prometheus), alerting, monitoring dashboards
  - Scaling strategy: Horizontal scaling (API, Frontend, Rules Engine), vertical scaling, database scaling (read replicas, pooling, partitioning), Redis scaling (cluster, sentinel), auto-scaling (Kubernetes HPA)
  - Troubleshooting: 7 common issues with diagnosis/solutions, debugging tools for containers/databases/Redis
  - Disaster recovery: Backup strategy (PostgreSQL, MinIO, Redis, volumes), restore procedures, point-in-time recovery, backup testing, recovery plan (RTO/RPO)
  - Reverse proxy configuration: Nginx and Traefik examples with SSL/TLS, rate limiting, load balancing
- Provides extensive code examples: bash commands, YAML configs, TypeScript snippets, Nginx configs, Docker commands
- Documents production-specific patterns: health checks (all 7 services), replica configuration, resource limits, logging formats
- Includes troubleshooting decision trees and debugging workflows
- Cross-references to related docs (architecture, environment variables, scaling guide)
- Comprehensive enough to enable DevOps teams to deploy and operate production systems confidently

**Task 7 - Write environment variables reference:**

- Created comprehensive `docs/deployment/environment-variables.md` (856 lines)
- Used Explore subagent to research all environment variables across codebase
- Discovered 70+ environment variables across 15 categories by analyzing:
  - Root and package `.env.example` files
  - Docker Compose configurations (base, dev, prod)
  - Source code using `process.env` (50+ files)
  - Configuration patterns (NestJS ConfigService, direct env access, Vite environment)
- Document covers:
  - Overview: Configuration sources, loading patterns, file locations
  - Quick Start: Development and production setup with minimal/full configurations
  - 15 Variable Categories: Node environment, Database (PostgreSQL+PostGIS), Redis (multi-DB strategy), API, Frontend (Vite), Authentication/Security, CORS, Cache, Rules Engine, Scheduler, MinIO/S3, Logging, Rate Limiting, File Upload, Testing
  - Each variable documented with: name, required/optional status, default value, type, description, usage examples, constraints
  - Required vs Optional: Clear distinction between absolutely required, highly recommended, and optional variables
  - Service-Specific Variables: What each service needs (API, Frontend, Scheduler, Rules Engine)
  - Validation & Constraints: Type validation patterns, range constraints, format constraints
  - Environment Examples: Local development, Production (Docker Compose), Production (Kubernetes), CI/CD
  - Migration Guide: Adding/updating/deprecating variables with examples
  - Security Best Practices: 10 security recommendations (never commit secrets, strong passwords, rotation, etc.)
  - Troubleshooting: Common issues and solutions
- Key findings documented:
  - Multi-database Redis strategy (DB 0 for pub/sub, DB 1 for cache)
  - Service account authentication (scheduler uses JWT, not API key)
  - Validation inconsistency across services (NestJS ConfigService vs direct process.env)
  - Time unit inconsistency (mix of milliseconds, seconds, cron formats)
- Provides complete configuration templates for all deployment scenarios
- Cross-references to production deployment guide, architecture docs, and feature docs

**Task 8 - Write scaling guide:**

- Created comprehensive scaling documentation (4 files, 95.5 KB total):
  - `docs/deployment/SCALING_GUIDE.md` (2,040 lines) - Main comprehensive guide
  - `docs/deployment/SCALING_RESEARCH_SUMMARY.md` (555 lines) - Evidence verification with source citations
  - `docs/deployment/SCALING_CODE_EXAMPLES.md` (725 lines) - Copy-paste ready implementation examples
  - `docs/deployment/README.md` (324 lines) - Navigation hub for deployment docs
- Used Explore subagent to research scaling patterns, caching architecture, and performance optimization
- Document covers:
  - **Part 1: Horizontal Scaling Patterns**
    - Service statelessness analysis (API: fully stateless, Rules Engine: per-instance cache, Scheduler: needs locking)
    - Load balancing configurations for Nginx (frontend, API, gRPC)
    - Session/state management (JWT, WebSocket via Redis adapter, GraphQL subscriptions)
    - Connection pooling (PostgreSQL: PgBouncer, Redis: ioredis pools)
  - **Part 2: Multi-Layer Caching Architecture**
    - 4-tier caching strategy: Browser (Apollo Client), Request (DataLoader), Cross-Request (Redis), Rules Engine (NodeCache)
    - Cache key patterns (entity-based, query-based, list-based, stats)
    - Cache invalidation patterns (single entity, cascading, pattern-based, Redis pub/sub coordination)
    - Cache warming strategies (proactive vs lazy)
    - Cache statistics and monitoring (hit rates, memory usage, invalidation tracking)
  - **Part 3: Performance Optimization**
    - Database query optimization (production indexes, N+1 prevention with DataLoader)
    - GraphQL optimization (field-level caching, query complexity limits, depth limits)
    - Frontend performance (Vite code splitting, Apollo normalized cache, lazy loading)
    - Real-time update performance (WebSocket batching, Redis pub/sub coordination)
    - Rules Engine performance (0.5-20ms evaluation, 600K evals/sec with caching)
  - **Part 4: Monitoring and Observability**
    - Health check endpoints (REST + GraphQL, cache health indicators)
    - Performance metrics collection (Prometheus, custom metrics)
    - Logging strategy (JSON logs, correlation IDs)
  - **Part 5: Scaling Tiers and Recommendations**
    - Small (1-100 users), Medium (100-1K), Large (1K-10K), Extreme (10K+)
    - Resource allocations, replica counts, infrastructure requirements
  - **Part 6: Common Bottlenecks and Optimization**
    - Database bottlenecks (connection exhaustion, slow queries, lock contention)
    - Redis bottlenecks (memory limits, connection exhaustion, slow commands)
    - API bottlenecks (CPU-bound resolvers, N+1 queries, slow external calls)
    - Troubleshooting procedures and optimization strategies
- Key findings documented:
  - API service scales linearly (2-10+ replicas) due to stateless design
  - WebSocket coordination via Socket.IO Redis adapter (no sticky sessions needed)
  - DataLoader provides 5-20x query improvement for N+1 patterns
  - Redis cache invalidation uses pattern-based matching for cascading updates
  - Production indexes verified for spatial queries (GIST) and soft-delete patterns
  - Rules Engine best at 1 replica (cache efficiency) unless CPU-bound
- Provides 50+ code examples from actual codebase with file paths
- Includes performance metrics, latency targets, and throughput benchmarks
- Cross-references to production deployment guide, environment variables, and architecture docs

**Task 9 - Write CONTRIBUTING.md:**

- Created comprehensive `CONTRIBUTING.md` in project root (870 lines)
- Used Explore subagent to research code standards, testing patterns, Git workflow, and development processes
- Document covers:
  - Code of Conduct: Guidelines for respectful collaboration
  - Getting Started: Prerequisites, first-time setup with 5-step guide (fork/clone, install, env setup, start services, verify)
  - Development Setup: Running dev servers, common commands (all from project root with `pnpm --filter`), adding dependencies
  - Project Structure: Monorepo layout, package overview table, build order dependencies
  - Code Standards: TypeScript strict mode, ESLint rules, Prettier config (100 char width), naming conventions, path aliases, documentation style, error handling patterns, async code patterns, type safety
  - Testing Requirements: Frameworks (Jest for backend, Vitest for frontend), test file organization, naming conventions, test structure (arrange-act-assert), writing tests (unit/integration examples), test requirements (all contributions must include tests), TDD workflow (red-green-refactor)
  - Git Workflow: Branch strategy (main + feature branches), commit message format (Conventional Commits with types/scopes), pre-commit hooks (Husky: format check, lint, lint-staged)
  - Pull Request Process: Before opening PR (quality checks, documentation, tests, commits), opening PR (push, PR template with checklist), PR review process (automated checks, code review, feedback, merge), after PR merge
  - Documentation: Requirements, style guidelines, documentation locations table (9 doc types with locations and audiences)
  - Getting Help: Resources (README, CLAUDE, feature docs, architecture docs, deployment docs), questions/discussions (GitHub Issues/Discussions), common issues (build, test, type, lint failures with solutions)
  - Additional Notes: Monorepo best practices, performance considerations, security considerations
- Key patterns documented:
  - All commands run from project root (never `cd` into packages)
  - Use `pnpm --filter` for package-specific commands
  - Conventional Commits format with detailed body explaining WHY
  - Pre-commit hooks enforce formatting and linting
  - TDD encouraged: write failing test first, implement, refactor
  - Path aliases required (never relative imports between packages)
  - TypeScript strict mode non-negotiable
  - All PRs require tests, documentation, quality checks
- Provides extensive code examples:
  - Development commands for all scenarios
  - Test structure patterns (describe blocks, arrange-act-assert)
  - Backend unit test with NestJS TestingModule
  - Frontend test with Vitest
  - Commit message examples (feature, bug fix, documentation)
  - Error handling patterns
  - Type safety patterns
- Includes complete PR template with checklist (description, type, related issues, testing, checklist, screenshots, breaking changes)
- Documents CI pipeline requirements: type-check, lint, all tests, build, performance benchmarks
- Cross-references to README, CLAUDE.md, feature docs, architecture docs, deployment docs
- Comprehensive enough to onboard new contributors with zero prior project knowledge

**Task 10 - Add architecture diagrams:**

- Added 7 comprehensive Mermaid diagrams across architecture and deployment documentation
- **docs/architecture/data-model.md**:
  - Entity Relationship Diagram (ERD): Complete visualization of 30+ Prisma models with all relationships
  - Polymorphic Relationship Pattern diagram: Shows entityType/entityId pattern with no FK constraints
- **docs/architecture/settlement-structure-deep-dive.md**:
  - Settlement/Structure Hierarchy diagram: Visualizes political hierarchy vs geographic hierarchy with 1:1 mapping
  - Typed Variable System flow diagram: Shows 4-stage flow (schema definition, storage, validation, integration)
- **docs/architecture/system-overview.md**:
  - Authentication Flow sequence diagram: Complete JWT + refresh token flow with 3 scenarios (login, authenticated request, token refresh)
  - Multi-Layer Cache Hierarchy diagram: 4-tier caching (browser, request scope, Redis, Rules Engine) with data flow
  - Cache Invalidation Flow sequence diagram: End-to-end invalidation from mutation to WebSocket update
- **docs/deployment/production-deployment.md**:
  - Docker Multi-Stage Build diagram: Visual representation of builder → production stages with layer details
- **CONTRIBUTING.md**:
  - Git Workflow diagram: Visual gitGraph showing feature branches, merges, and tagging
- All diagrams use color-coding for clarity and include detailed annotations
- Diagrams enhance understanding of complex architectural patterns without requiring codebase exploration
- Mermaid diagrams render natively on GitHub and in most Markdown viewers

## Commit Hash

_Added when final commit task is complete_
