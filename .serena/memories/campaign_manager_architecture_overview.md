# Campaign Manager System Architecture Overview

## 1. Monorepo Structure

### Workspace Organization

- **Manager**: pnpm workspaces
- **Root**: `/storage/programs/campaign_manager/`
- **Workspace Config**: `pnpm-workspace.yaml` defines `packages/*`

### Packages and Dependencies

```
packages/
├── shared/              (Base layer - no dependencies)
│   ├── Shared types and utilities
│   ├── GeoJSON types and interfaces
│   ├── WebSocket event definitions
│   └── Build: tsc → dist/
│
├── api/                 (Backend service - depends on shared)
│   ├── NestJS GraphQL API Server
│   ├── HTTP port: 3000
│   ├── Dependencies: shared
│   └── Build: tsc → dist/
│
├── rules-engine/        (Worker service - depends on shared)
│   ├── Rules evaluation microservice
│   ├── HTTP port: 9265, gRPC: 50051
│   ├── Dependencies: shared
│   └── Build: tsc → dist/
│
├── scheduler/          (Worker service - no shared dep)
│   ├── Event scheduling and async jobs
│   ├── HTTP port: 9266
│   ├── Dependencies: (Bull, Winston, Node modules)
│   └── Build: tsc → dist/
│
└── frontend/           (React SPA - depends on shared)
    ├── React 18 + Vite
    ├── Dev port: 5173, Production: 80 (via nginx)
    └── Build: tsc → vite build → dist/
```

### Build Order

1. `shared` (no dependencies)
2. `api`, `rules-engine`, `scheduler` (can parallel, no inter-deps)
3. `frontend` (after shared built)

---

## 2. Service Architecture

### API Service (@campaign/api)

**Technology Stack**: NestJS (10.3.0), GraphQL, Apollo Server
**Port**: 3000 (HTTP), WebSocket via GraphQL

**Core Modules**:

- **AuthModule**: JWT/Passport authentication, role-based access control
- **GraphQLConfigModule**: Apollo GraphQL setup, context factory, subscriptions
- **CacheModule**: Redis-based caching (DB 1), health indicators
- **WebSocketModule**: Socket.IO for real-time updates
- **GRpcModule**: gRPC client for rules-engine communication
- **RulesModule**: JSONLogic operators and sandbox execution

**Directory Structure**:

```
api/src/
├── auth/                    (Users, roles, permissions, JWT)
├── graphql/
│   ├── resolvers/          (One per domain entity)
│   ├── services/           (Business logic, data operations)
│   ├── types/              (GraphQL Object types)
│   ├── inputs/             (GraphQL Input types)
│   ├── scalars/            (Custom: DateTime, GeoJSON, JSON, Upload)
│   ├── dataloaders/        (N+1 prevention)
│   ├── pubsub/             (Redis pub/sub for subscriptions)
│   ├── cache/              (Redis cache provider)
│   ├── context/            (GraphQL context & auth)
│   ├── decorators/         (@CurrentUser, @RolesGuard)
│   └── utils/              (Helpers, pagination, dependency extraction)
├── database/               (Prisma service, soft-delete helpers)
├── common/
│   ├── cache/              (Cache service, cache-stats, health checks)
│   ├── services/           (Spatial queries, tile caching)
│   ├── health/             (Health check endpoints)
│   └── guards/             (Auth guards)
├── rules/                  (JSONLogic evaluation, operators)
├── grpc/                   (Rules engine gRPC client)
└── websocket/              (Socket.IO gateway & publisher)
```

**Key Services** (sample):

- `CampaignService`, `WorldService`, `LocationService`
- `SettlementService`, `StructureService`, `CharacterService`
- `EventService`, `EncounterService`, `EffectService`
- `BranchService`, `VersionService`, `MergeService`
- `AuditService`, `DependencyGraphService`, `ConditionService`
- `EffectExecutionService`, `EffectPatchService`

**Database**: PostgreSQL + PostGIS (via Prisma 6.17.1)

---

### Rules Engine Worker (@campaign/rules-engine)

**Technology Stack**: NestJS, gRPC, Redis
**Ports**: HTTP 9265 (health), gRPC 50051
**Protocol**: gRPC + HTTP hybrid

**Core Services**:

- `EvaluationEngineService`: JSONLogic expression evaluation
- `DependencyGraphService`: Per-campaign/branch dependency tracking
- `DependencyGraphBuilderService`: Graph construction from conditions
- `CacheService`: Expression result caching (in-memory + Redis)
- `RedisService`: Redis pub/sub for cache invalidation
- `HealthService`: Readiness & liveness probes
- `MetricsService`: Performance tracking

**Capabilities**:

- Stateless evaluation of JSONLogic expressions
- Incremental recomputation on state changes
- Result caching with TTL (configurable)
- Dependency graph maintenance for optimization
- Real-time cache invalidation via Redis

---

### Scheduler Worker (@campaign/scheduler)

**Technology Stack**: NestJS, Bull (job queue), Node-Cron, Winston logging
**Port**: 9266 (HTTP)

**Core Modules**:

- `QueueModule`: Bull job queue with Redis
- `ScheduleModule`: NestJS @Schedule decorators (cron)
- `SettlementModule`: Settlement growth & maintenance jobs
- `StructureModule`: Structure maintenance jobs
- `RedisSubscriberModule`: Real-time event reactivity
- `HealthModule`: Health check endpoints
- `MonitoringModule`: Bull Board UI (/admin/queues in dev)

**Capabilities**:

- Cron-based periodic operations (event expiration, growth, maintenance)
- Job queue with retries, backoff, and failure tracking
- Graceful shutdown handling
- Circuit breaker for API communication
- Winston-based structured logging

---

### Frontend (@campaign/frontend)

**Technology Stack**: React 18, Vite 5, TypeScript, Tailwind CSS, Apollo Client
**Dev Port**: 5173, Production: 80 (nginx reverse proxy)

**Core Architecture**:

```
frontend/src/
├── pages/              (Route pages, lazy-loaded)
├── components/         (UI components, domain-specific)
├── hooks/              (Custom React hooks)
├── stores/             (Zustand state slices)
├── services/           (API, utilities)
├── contexts/           (React contexts)
├── types/              (TypeScript types)
├── utils/              (Helper functions)
├── config/             (App configuration)
├── router/             (React Router v7 setup)
└── __generated__/      (GraphQL code-gen output)
```

**Key Libraries**:

- **State**: Zustand (localStorage persistence)
- **GraphQL**: Apollo Client 4 (caching, subscriptions)
- **Routing**: React Router 7 (lazy code splitting)
- **UI Components**: Radix UI + shadcn/ui (unstyled, accessible)
- **Visualization**: React Flow (flowchart), MapLibre GL (map), vis-timeline
- **Forms**: React Hook Form (implied by architecture)
- **Testing**: Vitest + MSW (mock service worker)
- **Styling**: Tailwind CSS 3 + PostCSS

---

## 3. Technology Stack Summary

### Backend

| Layer              | Technology      | Version | Purpose                        |
| ------------------ | --------------- | ------- | ------------------------------ |
| **Framework**      | NestJS          | 10.3+   | API, Workers, Microservices    |
| **API Protocol**   | GraphQL         | 16.8.1  | Main API (Apollo Server)       |
| **RPC Protocol**   | gRPC            | 1.14.0  | Rules engine communication     |
| **Database**       | PostgreSQL      | 16      | Primary data store             |
| **Spatial DB**     | PostGIS         | 3.4     | GIS queries and geometries     |
| **ORM**            | Prisma          | 6.17.1  | Database abstraction           |
| **Cache**          | Redis           | 7       | Caching, pub/sub, job queue    |
| **Job Queue**      | Bull            | 4.16.5  | Scheduler async jobs           |
| **Validation**     | Class Validator | 0.14.2  | DTO validation                 |
| **Logging**        | Winston         | 3.18.3  | Structured logging (scheduler) |
| **Authentication** | JWT + Passport  | 11.0.1  | Token-based auth               |
| **Rules**          | JSONLogic       | 2.0.5   | Conditional expressions        |
| **Storage**        | MinIO/S3        | -       | File uploads, S3 compatibility |

### Frontend

| Layer                 | Technology       | Version | Purpose                |
| --------------------- | ---------------- | ------- | ---------------------- |
| **Framework**         | React            | 18.2.0  | UI library             |
| **Build Tool**        | Vite             | 5.0.11  | Fast bundler with HMR  |
| **Language**          | TypeScript       | 5.3.3   | Type safety            |
| **Styling**           | Tailwind CSS     | 3.4.18  | Utility-first CSS      |
| **Component Library** | Radix UI         | Latest  | Accessible primitives  |
| **UI Components**     | shadcn/ui        | Latest  | Pre-built components   |
| **Routing**           | React Router     | 7.9.4   | Client-side routing    |
| **State**             | Zustand          | 5.0.8   | Lightweight state mgmt |
| **GraphQL Client**    | Apollo Client    | 4.0.7   | Data fetching, caching |
| **Visualization**     | React Flow       | 12.8.6  | Flowchart rendering    |
| **Map**               | MapLibre GL      | 5.9.0   | Interactive mapping    |
| **Map Draw**          | Maplibre-gl-draw | 1.6.9   | Drawing tools          |
| **Timeline**          | vis-timeline     | 8.3.1   | Timeline visualization |
| **Testing**           | Vitest           | 1.2.1   | Fast unit testing      |
| **API Mocking**       | MSW              | 2.11.5  | Network-level mocking  |

### DevOps & Infrastructure

| Component            | Technology     | Version                |
| -------------------- | -------------- | ---------------------- |
| **Containerization** | Docker         | 24.0.0+                |
| **Orchestration**    | Docker Compose | 2.20.0+                |
| **Package Manager**  | pnpm           | 8.0.0+                 |
| **Node Runtime**     | Node.js        | 18.0.0+                |
| **Web Server**       | Nginx          | Latest (frontend only) |
| **CI/CD**            | GitHub Actions | (in .github/workflows) |

---

## 4. Key Architectural Patterns

### Microservices Pattern

- **API Service** (NestJS): Handles GraphQL queries, mutations, subscriptions
- **Rules Engine Worker** (gRPC): Evaluates conditions, maintains dependency graphs
- **Scheduler Worker** (Bull Queue): Runs periodic and async tasks
- **Communication**: gRPC (API ↔ Rules), HTTP (Scheduler → API), Redis pub/sub

### Data Flow

```
Frontend (React)
    ↓ (GraphQL queries/mutations/subscriptions)
API Service (NestJS)
    ├→ Database (PostgreSQL + PostGIS)
    ├→ Redis Cache (caching, pub/sub)
    ├→ Rules Engine (gRPC for condition eval)
    └→ WebSocket (real-time updates)

Scheduler Worker
    ├→ Bull Job Queue (Redis-backed)
    ├→ API Service (HTTP calls)
    └→ Cron Tasks (periodic execution)

Rules Engine Worker
    ├→ Redis (pub/sub for cache invalidation)
    └→ Cache (in-memory + Redis)
```

### Caching Strategy

1. **API Service Cache** (Redis DB 1):
   - Entity lists, query results
   - Cache-manager with ioredis
   - Invalidation via dependency tracking

2. **Rules Engine Cache**:
   - Expression evaluation results
   - In-memory node-cache + Redis
   - TTL-based expiration (configurable)
   - Invalidation via Redis pub/sub

3. **Frontend Cache** (Zustand):
   - Local state with localStorage
   - Apollo Client cache for GraphQL

### Real-Time Updates

- **WebSocket/Socket.IO**: Direct connections for live updates
- **GraphQL Subscriptions**: Redis pub/sub backend
- **Redis Adapter**: Socket.IO Redis adapter for scaling
- **Pub/Sub Topics**: Entity-specific (e.g., `campaign:123:updated`)

### Authentication & Authorization

- **JWT Tokens**: Access (15 min) + Refresh (7 days)
- **Passport Strategies**: Local, JWT, API Key, Custom
- **Role-Based Access Control** (RBAC):
  - System roles (User, Admin, etc.)
  - Campaign-scoped roles (Owner, GM, Player, Viewer)
  - Permission matrix (resource + action)

### Database Design

- **Bitemporal Versioning**: Historical tracking of all changes
- **Soft Deletes**: `deletedAt` timestamp for GDPR compliance
- **PostGIS Geometries**: SRID 3857 for spatial queries
- **CUID Primary Keys**: Distributed-friendly IDs
- **Audit Trail**: Comprehensive change tracking with snapshots

---

## 5. Data Model Summary (Key Entities)

**Campaign Management**:

- Campaign, World, User, CampaignMembership

**Domain Entities**:

- Location (with PostGIS geometries), Party, Kingdom
- Settlement (with hierarchy), Structure (nested)
- Character, Link (entity relationships)

**Events & Scheduling**:

- Event, Encounter, Effect (with JSON Patch operations)

**Versioning & Branching**:

- Version, Branch (alternate timelines)
- MergeHistory (tracking merges with conflict resolution)

**Rules & Conditions**:

- FieldCondition (declarative rules), StateVariable
- Condition (condition definitions)

**Audit & Compliance**:

- Audit (comprehensive change log with snapshots and diffs)
- AuditLog (individual changes)

**Authentication**:

- User, Role, Permission, UserRole
- RefreshToken, ApiKey, CampaignMembership

---

## 6. Environment & Configuration

### Environment Variables (Key)

```
# Database
DATABASE_URL=postgres://user:pass@host:5432/campaign_db

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=<32+ character secret>

# Rules Engine (gRPC)
RULES_ENGINE_GRPC_HOST=rules-engine
RULES_ENGINE_GRPC_PORT=50051
RULES_ENGINE_TIMEOUT_MS=5000

# Scheduler
SCHEDULER_API_TOKEN=<JWT for API access>
CRON_EVENT_EXPIRATION=*/5 * * * *

# S3/MinIO
S3_ENDPOINT=http://minio:9000
MINIO_ROOT_USER/PASSWORD=...

# CORS
CORS_ORIGIN=http://localhost:9263

# Frontend
VITE_API_URL=http://localhost:3000
VITE_GRAPHQL_URL=http://localhost:3000/graphql
VITE_WS_URL=ws://localhost:3000/graphql
```

### Docker Compose Services

1. **postgres**: PostgreSQL + PostGIS (port 5432)
2. **redis**: Redis (port 6379)
3. **minio**: S3-compatible storage (ports 9000, 9001)
4. **api**: NestJS GraphQL (port 3000)
5. **rules-engine**: gRPC worker (ports 50051, 9265)
6. **scheduler**: Job scheduler (port 9266)
7. **frontend**: React + Nginx (port 8080)

---

## 7. Development Workflow

### Root-Level Commands

```bash
pnpm install          # Install all dependencies
pnpm run build        # Build all packages
pnpm run dev          # Run all in parallel (watch mode)
pnpm run test         # Run all tests
pnpm run lint         # Check linting
pnpm run format       # Auto-format code
pnpm run type-check   # TypeScript validation
```

### Package-Specific

```bash
pnpm --filter @campaign/api dev
pnpm --filter @campaign/frontend dev
pnpm --filter @campaign/rules-engine test
```

### TypeScript Configuration

- **Base Config**: `tsconfig.base.json` (ES2022, strict mode)
- **Path Aliases**:
  - `@campaign/shared` → `packages/shared/src`
  - `@campaign/api` → `packages/api/src`
  - `@campaign/rules-engine` → `packages/rules-engine/src`
  - `@campaign/scheduler` → `packages/scheduler/src`

---

## 8. Key Architectural Decisions

1. **Monorepo**: Single repo, multiple packages, shared types
2. **Microservices**: Separate workers (rules, scheduler) for scalability
3. **gRPC for Rules**: High-performance, stateless evaluation
4. **Redis Everywhere**: Caching, pub/sub, job queue
5. **Soft Deletes**: Data retention without hard deletes
6. **Bitemporal Schema**: Complete audit trail with versions
7. **PostGIS**: Native spatial queries, not client-side
8. **Frontend Framework**: React + TypeScript for type safety
9. **Zustand + Apollo**: Lightweight state mgmt + GraphQL
10. **Tailwind + Radix**: Utility-first + accessible primitives

---

## 9. Communication Patterns

### Synchronous

- **GraphQL (HTTP)**: Frontend → API (queries, mutations)
- **gRPC**: API → Rules Engine (condition evaluation)
- **HTTP**: Scheduler → API (job execution)

### Asynchronous

- **WebSocket/Socket.IO**: API → Frontend (real-time updates)
- **Redis Pub/Sub**:
  - API → Rules Engine (cache invalidation)
  - Scheduler → Components (job events)

---
