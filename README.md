# Campaign Management Tool

A full-stack campaign management tool for tabletop RPGs that unifies map, flowchart, and timeline views around shared domain objects (locations, encounters, events, characters). The system supports temporal versioning (history), branching (what-if scenarios), and conditional availability via a rules engine.

## Features

- **Multi-View System**: Integrated map, flowchart, and timeline views
- **Interactive Map**: MapLibre GL-based map rendering with drawing and editing tools for points and polygons
- **Dependency Graph Visualization**: React Flow-powered flowchart view with auto-layout, filtering, and interactive selection
- **Timeline View**: vis-timeline-powered event and encounter visualization with drag-to-reschedule, color-coded status, filtering, and zoom/pan controls
- **Spatial Data**: PostGIS-powered location and geography management
- **Party & Kingdom Management**: Support for multiple parties, kingdoms, settlements, and structures with level tracking
- **Typed Variables**: Define custom typed variables (string, number, boolean, enum) for all entity types
- **Level History**: Track level changes across all entities with comprehensive audit trail
- **Campaign Context**: Aggregate party, kingdom, settlement, and structure state for rules engine
- **Rules Engine**: JSONLogic-based conditional system for dynamic content
- **Effect System**: JSON Patch-based state mutations when events/encounters resolve with 3-phase execution
- **Versioning**: Full history tracking and branching support
- **Real-time Updates**: WebSocket-based synchronization
- **Event Scheduling**: Cron-based automated event processing

## Tech Stack

### Backend

- **NestJS** - GraphQL API framework
- **Node Workers** - Rules engine and scheduler services
- **PostgreSQL** - Primary database
- **PostGIS** - Spatial data extension
- **Redis** - Caching and pub/sub
- **MinIO** - S3-compatible object storage

### Frontend

- **React 18** - UI framework with concurrent features
- **TypeScript** - Type-safe development with strict mode
- **Vite 5** - Lightning-fast build tool and dev server with HMR
- **Tailwind CSS 3** - Utility-first CSS framework with JIT compilation
- **Radix UI** - Accessible, unstyled component primitives (Dialog, Slot, Label)
- **shadcn/ui** - Beautiful, customizable component library built on Radix UI
- **React Router 7** - Client-side routing with lazy loading and code splitting
- **Zustand** - State management with slice pattern and localStorage persistence
- **Apollo Client 4** - GraphQL client with caching, subscriptions, and error handling
- **GraphQL Code Generator** - TypeScript types and React hooks from schema
- **Vitest + MSW** - Testing infrastructure with API mocking at network level
- **MapLibre GL JS** - Interactive map rendering with point and polygon editing
- **React Flow** - Interactive flowchart visualization with auto-layout and filtering
- **vis-timeline** - Timeline visualization for events and encounters with drag-to-reschedule

### DevOps

- **Docker Compose** - Local development and deployment
- **pnpm** - Fast, efficient package manager
- **GitHub Actions** - CI/CD pipeline

## Project Structure

```
campaign_manager/
├── packages/
│   ├── api/              # NestJS GraphQL API
│   ├── rules-engine/     # Rules evaluation worker
│   ├── scheduler/        # Event scheduling worker
│   ├── frontend/         # React web application
│   └── shared/           # Shared types and utilities
├── .github/
│   └── workflows/        # CI/CD workflows
├── plan/                 # Project planning documents
├── pnpm-workspace.yaml   # Workspace configuration
└── package.json          # Root package configuration
```

## Getting Started

### Prerequisites

#### Option 1: Docker (Recommended)

- **Docker** >= 24.0.0
- **Docker Compose** >= 2.20.0

#### Option 2: Local Development

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **PostgreSQL** >= 14 with PostGIS extension
- **Redis** >= 7.0
- **MinIO** or S3-compatible storage

Install pnpm if you don't have it:

```bash
npm install -g pnpm
```

### Installation (Docker - Recommended)

1. Clone the repository:

```bash
git clone <repository-url>
cd campaign_manager
```

2. Copy the environment file:

```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your configuration (optional for local development)

4. Start all services:

```bash
# Development mode with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production mode
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

5. Access the application:

- **Frontend**: http://localhost:3000 (dev) or http://localhost:8080 (prod)
- **API/GraphQL**: http://localhost:4000
- **GraphQL Playground**: http://localhost:4000/graphql (dev only)
- **MinIO Console**: http://localhost:9001

6. Stop all services:

```bash
docker-compose down
```

7. Clean up volumes (removes all data):

```bash
docker-compose down -v
```

### Installation (Local Development)

1. Clone the repository:

```bash
git clone <repository-url>
cd campaign_manager
```

2. Install dependencies:

```bash
pnpm install
```

3. Initialize Husky git hooks:

```bash
pnpm run prepare
```

### Development

Run all services in development mode:

```bash
pnpm run dev
```

Run a specific package:

```bash
pnpm --filter @campaign/api dev
pnpm --filter @campaign/frontend dev
```

### Frontend Setup

The frontend requires environment variables to be configured before running:

1. Copy the environment template:

```bash
cp packages/frontend/.env.example packages/frontend/.env
```

2. Update environment variables in `packages/frontend/.env`:

```bash
# API Configuration (proxied in development)
VITE_API_URL=/graphql
VITE_API_WS_URL=ws://localhost:3000/graphql

# Application Configuration
VITE_APP_NAME=Campaign Manager
VITE_ENVIRONMENT=development

# Feature Flags
VITE_ENABLE_DEBUG=true
VITE_ENABLE_MOCK_AUTH=true
```

3. Start the frontend dev server:

```bash
pnpm --filter @campaign/frontend dev
```

The frontend will be available at http://localhost:3000 with:

- Hot module replacement (HMR) for instant updates
- Vite proxy forwarding `/graphql` to backend on port 4000
- Mock authentication for development (login with any email/password)
- Route-based code splitting for optimal performance

For production builds, update environment variables to use absolute HTTPS URLs:

```bash
VITE_API_URL=https://api.yourdomain.com/graphql
VITE_API_WS_URL=wss://api.yourdomain.com/graphql
VITE_ENVIRONMENT=production
VITE_ENABLE_DEBUG=false
VITE_ENABLE_MOCK_AUTH=false
```

See `packages/frontend/README.md` for detailed frontend documentation.

### Building

Build all packages:

```bash
pnpm run build
```

Build a specific package:

```bash
pnpm --filter @campaign/api build
```

### Testing

Run all tests:

```bash
pnpm run test
```

Run tests in watch mode:

```bash
pnpm run test:watch
```

### Code Quality

Run linters:

```bash
pnpm run lint
```

Format code:

```bash
pnpm run format
```

Check formatting:

```bash
pnpm run format:check
```

Type checking:

```bash
pnpm run type-check
```

### Clean Build Artifacts

Remove all build artifacts and dependencies:

```bash
pnpm run clean
```

## Development Workflow

### Git Hooks

This project uses Husky to enforce code quality:

- **pre-commit**: Runs lint-staged to lint and format changed files
- **pre-push**: Runs type checking and tests before pushing

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Recommended rules with TypeScript support
- **Prettier**: Consistent code formatting
- **Import ordering**: Alphabetically sorted with grouping

### Commit Messages

Follow conventional commit format:

```
type(scope): subject

body

footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Monorepo Structure

This project uses pnpm workspaces for monorepo management.

### Workspace Commands

Install a dependency in a specific package:

```bash
pnpm --filter @campaign/api add <package>
```

Run a command in all packages:

```bash
pnpm -r <command>
```

Run a command in all packages in parallel:

```bash
pnpm -r --parallel <command>
```

### Path Aliases

TypeScript path aliases are configured for easy imports:

- `@campaign/shared` - Shared types and utilities
- `@campaign/api` - API package
- `@campaign/rules-engine` - Rules engine package
- `@campaign/scheduler` - Scheduler package

## CI/CD

GitHub Actions workflow runs on every push and pull request:

1. **Lint and Type Check** - Ensures code quality
2. **Tests** - Runs all test suites
3. **Build** - Verifies all packages build successfully

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend (React)                      │
│                    http://localhost:3000                     │
└────────────────────────┬────────────────────────────────────┘
                         │ GraphQL / WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Server (NestJS)                       │
│                    http://localhost:4000                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • GraphQL API • Authentication • Business Logic     │   │
│  │ • Versioning  • Audit Logging  • Real-time Events   │   │
│  └─────────────────────────────────────────────────────┘   │
└───┬─────────────────┬─────────────────┬─────────────────┬───┘
    │                 │                 │                 │
    │ PostgreSQL      │ Redis Pub/Sub   │ gRPC (eval)    │ MinIO
    ▼                 ▼                 ▼                 ▼
┌───────────┐   ┌──────────┐   ┌────────────────┐   ┌──────────┐
│PostgreSQL │   │  Redis   │   │ Rules Engine   │   │  MinIO   │
│+ PostGIS  │   │          │   │    Worker      │   │ (S3 API) │
│           │   │          │   │ :50051 (gRPC)  │   │          │
│:5432      │   │:6379     │   │ :3001 (HTTP)   │   │:9000     │
└───────────┘   └────┬─────┘   └────────┬───────┘   └──────────┘
                     │                  │
                     │ Redis Pub/Sub    │ PostgreSQL (read-only)
                     ▼                  ▼
            ┌──────────────────────────────────┐
            │     Scheduler Worker (Future)    │
            │         :3002 (HTTP)             │
            └──────────────────────────────────┘
```

### Service Communication

**API Server → Rules Engine Worker**:

- **gRPC** (`:50051`) - Synchronous evaluation requests
  - `EvaluateCondition` - Single condition evaluation with trace support
  - `EvaluateConditions` - Batch evaluation with dependency ordering
  - `GetEvaluationOrder` - Topological sort for safe evaluation order
  - `ValidateDependencies` - Cycle detection in dependency graph
  - `InvalidateCache` - Manual cache invalidation
  - `GetCacheStats` - Performance metrics
- **Redis Pub/Sub** - Asynchronous invalidation notifications
  - API publishes: `condition.created`, `condition.updated`, `condition.deleted`
  - API publishes: `variable.created`, `variable.updated`, `variable.deleted`
  - Worker subscribes and invalidates cache/dependency graphs accordingly

**Rules Engine Worker**:

- **Evaluates Conditions**: JSONLogic expressions for dynamic content availability
- **Dependency Graphs**: Tracks relationships between conditions and variables per campaign/branch
- **Caching**: In-memory result caching with TTL (default 300s)
- **Incremental Recomputation**: Only recalculates affected nodes on state changes
- **Health Checks**: HTTP endpoint (`:3001/health/*`) for liveness and readiness probes

**Fallback Strategy**:

- API service includes circuit breaker pattern (5 failures → open for 30s)
- Falls back to local `ConditionEvaluationService` if worker unavailable
- Graceful degradation ensures system availability even if worker is down

### Docker Compose Services

| Service      | Port(s)        | Description                      |
| ------------ | -------------- | -------------------------------- |
| frontend     | 3000 (dev)     | React + Vite development server  |
|              | 8080 (prod)    | Nginx serving production build   |
| api          | 4000           | NestJS GraphQL API + WebSocket   |
|              | 9229 (dev)     | Node.js debugger                 |
| rules-engine | 3001           | HTTP health checks               |
|              | 50051          | gRPC evaluation server           |
|              | 9230 (dev)     | Node.js debugger                 |
| postgres     | 5432           | PostgreSQL 16 + PostGIS 3.4      |
| redis        | 6379           | Redis 7 (caching + pub/sub)      |
| minio        | 9000           | S3-compatible object storage     |
|              | 9001           | MinIO web console                |
| scheduler    | 3002 (planned) | Event scheduling worker (future) |

### Data Flow Examples

**1. Computed Field Evaluation**:

```
GraphQL Query → API Service → Rules Engine Worker (gRPC)
                              ├─ Check cache (hit: <5ms)
                              └─ Evaluate (miss: <50ms)
                                 ├─ Build dependency graph
                                 ├─ Topological sort
                                 ├─ Evaluate in order
                                 └─ Cache results
```

**2. Cache Invalidation Flow**:

```
GraphQL Mutation → API Service
                   ├─ Update database
                   ├─ Publish to Redis
                   └─ Return response

Redis Pub/Sub → Rules Engine Worker
                 ├─ Receive invalidation event
                 ├─ Invalidate cache entries
                 └─ Rebuild dependency graph (if needed)
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass and code is formatted
4. Submit a pull request

## License

MIT

## Project Status

This project is currently in active development. See the `plan/` directory for detailed tickets and roadmap.

### Completed Features

**Core Entity Management**

- [x] TICKET-001: Project Scaffolding & Repository Setup
- [x] TICKET-002: Docker Compose Infrastructure
- [x] TICKET-003: Database Schema Design & Prisma Setup
- [x] TICKET-004: Authentication & Authorization System
- [x] TICKET-005: Basic GraphQL API with NestJS
- [x] TICKET-006: Entity CRUD Operations (Campaigns, Locations, Characters, Encounters, Events)
- [x] TICKET-007: Audit System & Event Publishing
- [x] TICKET-008: Versioning System
- [x] TICKET-009: Party & Kingdom Management
- [x] TICKET-010: World Time System
- [x] TICKET-011: JSONLogic Expression Parser
- [x] TICKET-012: Condition System
- [x] TICKET-013: State Variable System
- [x] TICKET-014: Dependency Graph System
- [x] TICKET-015: Rules Engine Service Worker
- [x] TICKET-016: Effect System Implementation
- [x] TICKET-017: Frontend Project Setup (React + Vite)
- [x] TICKET-018: State Management & GraphQL Client

**Party & Kingdom Management (TICKET-009)**

- Support for multiple parties per campaign
- Kingdom, Settlement, and Structure hierarchies
- Level tracking with validation and history
- Typed custom variables (string, number, boolean, enum)
- Campaign context aggregation for rules engine
- Comprehensive GraphQL API for all operations

**World Time System (TICKET-010)**

- Campaign-specific world time tracking with `currentWorldTime` field
- Time advancement via `advanceWorldTime` GraphQL mutation
- Custom calendar system support (parse, format, validate dates)
- Calendar-aware time utilities for world-specific date formats
- Integration with versioning system for time-travel queries
- Transaction-safe time advancement with audit logging and optimistic locking
- Rules engine integration hook for future recalculation (TICKET-015+)

**Rules Engine System (TICKETS 011-015)**

The Rules Engine provides a comprehensive system for dynamic content evaluation using JSONLogic expressions:

- **JSONLogic Parser** (TICKET-011): Secure expression evaluation with depth validation and error handling
- **Condition System** (TICKET-012): Bind JSONLogic expressions to entity fields for computed values
  - Instance-level and type-level conditions with priority-based evaluation
  - Full evaluation traces for debugging
  - Integration with Settlement and Structure entities via `computedFields` resolver
- **State Variable System** (TICKET-013): Campaign and world-scoped variables with versioning support
  - Typed variables (string, number, boolean, enum) with validation
  - Integration with bitemporal versioning for time-travel queries
  - GraphQL API for variable CRUD operations
- **Dependency Graph System** (TICKET-014): Track relationships between conditions and variables
  - Cycle detection to prevent infinite loops
  - Topological sorting for safe evaluation order
  - Automatic cache invalidation on condition/variable changes
- **Rules Engine Worker** (TICKET-015): Dedicated NestJS microservice for high-performance evaluation
  - **gRPC Server** (`:50051`) for synchronous evaluation requests (<50ms p95 latency)
  - **HTTP Health Checks** (`:3001`) for container orchestration
  - **Redis Pub/Sub** for asynchronous cache invalidation
  - **In-Memory Caching** with TTL (default 300s, <5ms p95 for cached results)
  - **Circuit Breaker** pattern in API service for graceful degradation
  - **Docker Deployment** with health checks and hot reload support

The Rules Engine enables dynamic game mechanics like:

- Conditional structure availability based on entity state
- Computed properties (e.g., "is_trade_hub" for settlements)
- Event triggers based on complex conditions
- Dynamic status indicators and validation rules

See `packages/rules-engine/README.md` for detailed worker documentation and `CLAUDE.md` for system integration details.

**Effect System (TICKET-016)**

The Effect System allows events and encounters to mutate world state when they resolve using JSON Patch (RFC 6902) operations:

- **3-Phase Execution**: Effects execute in PRE → ON_RESOLVE → POST timing phases for cascading mutations
- **JSON Patch Operations**: Apply precise state changes using RFC 6902 operations (add, remove, replace, copy, move, test)
- **Priority-Based Ordering**: Effects execute in deterministic priority order within each timing phase
- **Security Validation**: Path whitelisting protects sensitive fields (id, timestamps, ownership) from modification
- **Comprehensive Audit Trail**: All effect executions recorded in `EffectExecution` model with context and results
- **Dependency Graph Integration**: Effect write dependencies tracked for circular dependency detection
- **Dry-Run Mode**: Preview effect results without applying changes
- **Encounter/Event Integration**:
  - `EncounterService.resolve()` - Execute effects when resolving encounters
  - `EventService.complete()` - Execute effects when completing events
  - Both return comprehensive result summaries showing execution counts per phase
- **GraphQL API**: Full CRUD operations, manual execution, and bulk execution via `EffectResolver`

The Effect System enables dynamic game mechanics like:

- Resource modifications when events complete (harvest seasons, raids, trade)
- Status changes during encounter resolution (structure damage, character injuries)
- Cascading effects across multiple entities
- Complex multi-field updates with single atomic operation

See `docs/features/effect-system.md` for detailed documentation including examples, security model, and integration details.

**Frontend (TICKETS 017-018)**

The React frontend is built with modern tooling for optimal developer experience and performance:

**Infrastructure (TICKET-017)**:

- **Vite 5**: Lightning-fast HMR and optimized production builds with code splitting
- **React 18 + TypeScript**: Type-safe component development with strict mode enabled
- **Tailwind CSS 3**: Utility-first styling with JIT compilation and HSL color system
- **Radix UI + shadcn/ui**: Accessible component primitives (Button, Card, Dialog) with beautiful styling
- **React Router 7**: Client-side routing with lazy loading and protected routes
- **Environment Configuration**: Validated env vars with separate dev/prod configurations
- **Development Proxy**: Vite proxy forwards `/graphql` requests to backend, eliminating CORS issues
- **Organized Structure**: Clean folder organization (components, pages, hooks, utils, services, types)
- **Code Quality**: ESLint with jsx-a11y for accessibility, Prettier formatting, pre-commit hooks

**State Management & GraphQL (TICKET-018)**:

- **Zustand**: State management with slice pattern (auth, campaign) and localStorage persistence
- **Apollo Client 4**: GraphQL integration with custom cache policies and optimized fetching strategies
  - Cache-first for entity details (efficient, manual refetch available)
  - Cache-and-network for lists (show cached immediately, fetch fresh data)
  - Computed fields disabled from caching (merge: false for dynamic calculations)
  - Automatic auth token injection from Zustand store
- **GraphQL Code Generator**: TypeScript types and React hooks from backend schema
- **Specialized Hooks**: Domain-specific hooks for Settlement and Structure entities
  - Query hooks: `useSettlementsByKingdom`, `useSettlementDetails`, `useStructuresBySettlement`, `useStructureDetails`, `useStructureConditions`
  - Mutation hooks: `useCreateSettlement`, `useUpdateSettlement`, `useDeleteSettlement` (with archive/restore support)
  - Cache update strategies: refetchQueries for creates, cache eviction for deletes, field modifications for archives
- **Testing Infrastructure**: Vitest + Testing Library + MSW v2 (128 tests)
  - Unit tests for Zustand stores (auth, campaign state)
  - Integration tests for GraphQL hooks (queries, mutations)
  - MSW intercepts GraphQL at network level for realistic testing
  - Test utilities: `createTestApolloClient`, `renderWithApollo`, mock data factories

Key Features:

- Hot module replacement for instant feedback during development
- Route-based code splitting reduces initial bundle size (<150KB gzipped)
- Mock authentication with Zustand store (persisted to localStorage)
- Type-safe GraphQL operations with code-generated hooks
- Responsive design with Tailwind CSS utilities
- Accessible components following WAI-ARIA patterns
- Comprehensive test coverage with fast, isolated tests

See `packages/frontend/README.md` for detailed frontend documentation and development guide.

See `plan/EPIC.md` for the complete project roadmap and upcoming features.
