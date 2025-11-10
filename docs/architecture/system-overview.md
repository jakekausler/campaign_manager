# System Overview

This document provides a high-level overview of the Campaign Manager system architecture, including the monorepo structure, service architecture, technology stack, and key architectural patterns.

## Table of Contents

1. [Monorepo Structure](#monorepo-structure)
2. [Service Architecture](#service-architecture)
3. [Technology Stack](#technology-stack)
4. [Data Flow](#data-flow)
5. [Key Architectural Patterns](#key-architectural-patterns)
6. [Deployment Architecture](#deployment-architecture)

---

## Monorepo Structure

The Campaign Manager is built as a **pnpm workspace monorepo** with 5 packages organized in a clear dependency hierarchy.

### Package Organization

```
campaign_manager/
├── packages/
│   ├── shared/           # Shared types and utilities (no dependencies)
│   ├── api/              # NestJS GraphQL API (depends on shared)
│   ├── rules-engine/     # JSONLogic evaluation microservice (depends on shared)
│   ├── scheduler/        # Job scheduling worker (no inter-package deps)
│   └── frontend/         # React SPA (depends on shared)
├── plan/                 # Project planning and tickets
├── docs/                 # Documentation
└── .github/workflows/    # CI/CD
```

### Dependency Graph

```
@campaign/shared (foundation)
       ↑
       ├─── @campaign/api
       ├─── @campaign/rules-engine
       └─── @campaign/frontend

@campaign/scheduler (standalone)
```

### Path Aliases

TypeScript path aliases are configured in `tsconfig.base.json` for clean imports:

```typescript
import { BaseEntity } from '@campaign/shared';
import { CampaignService } from '@campaign/api';
```

Available aliases:

- `@campaign/shared` → `packages/shared/src`
- `@campaign/api` → `packages/api/src`
- `@campaign/rules-engine` → `packages/rules-engine/src`
- `@campaign/scheduler` → `packages/scheduler/src`

### Build Process

The root-level build command orchestrates compilation across all packages:

```bash
pnpm run build  # Builds all packages in dependency order
```

pnpm automatically manages build ordering based on workspace dependencies, ensuring `@campaign/shared` builds before packages that depend on it.

---

## Service Architecture

The system follows a **microservices-inspired architecture** with three main backend services and a frontend application.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  Port: 5173 (dev) / 80 (prod)                           │
│  React 18 + Zustand + Apollo Client                     │
└────────────┬────────────────────────────────────────────┘
             │
             │ GraphQL over HTTP/WebSocket
             │ Port 3000
             ▼
┌─────────────────────────────────────────────────────────┐
│              API Service (NestJS)                        │
│  GraphQL API + WebSocket + Business Logic               │
│  Authentication + Authorization                          │
│  Database Orchestration (Prisma)                        │
└──────┬──────────────────────┬────────────────────┬──────┘
       │                      │                    │
       │ gRPC                 │ Redis Pub/Sub      │ GraphQL
       │ Port 50051           │                    │ HTTP
       ▼                      ▼                    ▼
┌─────────────────┐   ┌────────────┐   ┌──────────────────┐
│  Rules Engine   │   │   Redis    │   │   Scheduler      │
│  (Worker)       │   │  (Cache/   │   │   (Worker)       │
│  JSONLogic eval │   │   Pub/Sub/ │   │   Bull Queue     │
│  Port: 9265     │   │   Queue)   │   │   Cron Jobs      │
│  gRPC: 50051    │   │  Port 6379 │   │   Port: 9266     │
└─────────────────┘   └────────────┘   └──────────────────┘
                             │
                             │ (shared infrastructure)
                             ▼
                   ┌──────────────────┐
                   │   PostgreSQL     │
                   │   + PostGIS      │
                   │   Port: 5432     │
                   └──────────────────┘
```

### API Service (@campaign/api)

**Purpose**: Main GraphQL API server providing business logic, authentication, and database orchestration.

**Technology**: NestJS 10.3, Apollo Server 4.10, Prisma 6.17, TypeScript
**Port**: 3000 (HTTP + WebSocket)

**Core Modules**:

- **AuthModule**: JWT/Passport authentication with role-based access control
- **GraphQLConfigModule**: Apollo Server setup with subscriptions (Redis pub/sub backend)
- **CacheModule**: Redis caching (DB 1) with health monitoring
- **WebSocketModule**: Socket.IO gateway for real-time updates
- **GRpcModule**: Client connection to rules-engine microservice
- **RulesModule**: JSONLogic operator registry and sandboxed execution
- **DatabaseModule**: Prisma service with soft-delete helpers

**Directory Structure**:

```
packages/api/src/
├── graphql/
│   ├── resolvers/        # Domain entity resolvers (Campaign, World, Location, etc.)
│   ├── services/         # Business logic layer (50+ service classes)
│   ├── types/            # GraphQL Object type definitions
│   ├── inputs/           # GraphQL Input types for mutations
│   ├── scalars/          # Custom scalars (DateTime, GeoJSON, JSON, Upload)
│   ├── dataloaders/      # DataLoader instances for N+1 query prevention
│   ├── pubsub/           # Redis pub/sub for GraphQL subscriptions
│   └── decorators/       # Custom decorators (@CurrentUser, @Roles, etc.)
├── auth/                 # Authentication strategies, guards, DTOs
├── common/               # Cache service, spatial service, health checks
├── rules/                # JSONLogic evaluation, expression parser
├── grpc/                 # gRPC client for rules-engine communication
└── websocket/            # Socket.IO gateway and event publisher
```

**Key Services** (sample):

- **Entity Management**: CampaignService, WorldService, LocationService, SettlementService, StructureService, CharacterService, PartyService, KingdomService
- **Event System**: EventService, EncounterService, EffectService, EffectExecutionService, EffectPatchService
- **Versioning**: VersionService, BranchService, MergeService
- **Data Integrity**: AuditService, DependencyGraphService, ConditionService
- **Utilities**: CampaignContextService, SettlementContextBuilderService, StructureContextBuilderService, VariableEvaluationService

**Database**: PostgreSQL 16 + PostGIS 3.4 via Prisma ORM

---

### Rules Engine Worker (@campaign/rules-engine)

**Purpose**: High-performance JSONLogic condition evaluation with dependency tracking and multi-layer caching.

**Technology**: NestJS, gRPC, Redis, node-cache
**Ports**:

- HTTP 9265 (health checks)
- gRPC 50051 (evaluation requests)

**Service Architecture**:

- **EvaluationEngineService**: JSONLogic expression parser and evaluator
- **DependencyGraphService**: Maintains condition dependency graphs per campaign/branch
- **DependencyGraphBuilderService**: Constructs dependency graphs from condition definitions
- **CacheService**: Dual-layer caching (in-memory node-cache + Redis fallback)
- **RedisService**: Pub/sub subscriber for real-time cache invalidation events
- **HealthService**: Kubernetes-style readiness and liveness probes
- **MetricsService**: Performance metrics and cache statistics

**Communication**:

- **Inbound**: gRPC requests from API service (condition evaluations)
- **Outbound**: Redis pub/sub subscriber (cache invalidation events)
- **Health**: HTTP endpoints (`/health/live`, `/health/ready`)

**Caching Strategy**:

1. **In-Memory Cache**: node-cache with 10k max keys for ultra-fast lookups
2. **Redis Fallback**: Distributed cache for multi-instance deployments
3. **TTL-based Expiration**: Default 300s (configurable)
4. **Real-time Invalidation**: Redis pub/sub for immediate cache clearing

**Design Philosophy**: Stateless design enables horizontal scaling for high evaluation throughput.

---

### Scheduler Worker (@campaign/scheduler)

**Purpose**: Periodic and asynchronous task execution for events, settlement growth, structure maintenance, and data cleanup.

**Technology**: NestJS, Bull (Redis job queue), Node-Cron, Winston logging
**Port**: 9266 (HTTP)

**Module Organization**:

- **QueueModule**: Bull queue setup with Redis backend
- **ScheduleModule**: NestJS @Schedule decorators for cron-based tasks
- **SettlementModule**: Settlement growth and expansion jobs
- **StructureModule**: Structure maintenance and upkeep jobs
- **RedisSubscriberModule**: Real-time event subscription for reactive processing
- **HealthModule**: Health check endpoints
- **MonitoringModule**: Bull Board UI (`/admin/queues` in development)
- **ConfigModule**: Environment-based configuration
- **LoggerModule**: Winston structured logging

**Capabilities**:

- **Cron Tasks**: Periodic execution (event expiration every 5 min, settlement growth hourly)
- **Job Queue**: Configurable retries (max 3) with exponential backoff (5s default)
- **Graceful Shutdown**: SIGTERM/SIGINT handling
- **Circuit Breaker**: API communication fault tolerance (5 failures, 30s cooldown)
- **Concurrency Control**: Max 5 parallel jobs (configurable)
- **Monitoring**: Bull Board UI for job queue inspection

---

### Frontend (@campaign/frontend)

**Purpose**: Single-page React application with map editing, flowchart visualization, and timeline views.

**Technology**: React 18, Vite 5, TypeScript, Apollo Client 4, Zustand
**Dev Port**: 5173 (Vite dev server)
**Production Port**: 80 (Nginx reverse proxy)

**Core Architecture**:

```
packages/frontend/src/
├── pages/              # Route-level components with lazy loading
├── components/         # Reusable UI components (domain + general)
├── hooks/              # Custom React hooks
├── stores/             # Zustand state slices (localStorage persistence)
├── services/           # API client utilities, business logic
├── contexts/           # React Context for shared state
├── types/              # TypeScript interfaces
├── utils/              # Helper functions
├── router/             # React Router v7 configuration
└── __generated__/      # Auto-generated GraphQL types and hooks
```

**Key Libraries**:

- **UI Framework**: React 18 with concurrent features
- **State Management**: Zustand 5.0 (slice pattern, localStorage persistence)
- **Data Fetching**: Apollo Client 4 (caching, subscriptions, error handling)
- **Routing**: React Router 7 (lazy code splitting, nested routes)
- **UI Components**: Radix UI (unstyled primitives) + shadcn/ui (pre-built components)
- **Visualization**:
  - React Flow 12.8 (flowchart/dependency graphs)
  - MapLibre GL 5.9 (vector maps)
  - vis-timeline 8.3 (timeline view)
- **Styling**: Tailwind CSS 3
- **Forms**: class-validator integration
- **Testing**: Vitest 1.2 + MSW 2.11 (API mocking)
- **Code Generation**: @graphql-codegen (TypeScript types + React hooks)

---

## Technology Stack

### Backend Stack

| Layer              | Technology        | Version | Purpose                                  |
| ------------------ | ----------------- | ------- | ---------------------------------------- |
| **Framework**      | NestJS            | 10.3+   | API, microservices, dependency injection |
| **API Protocol**   | GraphQL           | 16.8.1  | Primary API layer                        |
| **RPC Protocol**   | gRPC              | 1.14.0  | Microservice communication               |
| **Database**       | PostgreSQL        | 16      | Relational data store                    |
| **Spatial DB**     | PostGIS           | 3.4     | GIS operations, geometry queries         |
| **ORM**            | Prisma            | 6.17.1  | Database abstraction and migrations      |
| **Cache**          | Redis             | 7       | Caching, pub/sub, job queue              |
| **Job Queue**      | Bull              | 4.16.5  | Task scheduling and async processing     |
| **Validation**     | class-validator   | 0.14.2  | DTO/input validation                     |
| **Transformation** | class-transformer | 0.5.1   | Object serialization/deserialization     |
| **Authentication** | JWT + Passport    | 11.0.1  | Token-based authentication               |
| **Logging**        | Winston           | 3.18.3  | Structured logging (scheduler)           |
| **Rules Engine**   | JSONLogic         | 2.0.5   | Conditional expression evaluation        |
| **Storage**        | MinIO             | latest  | S3-compatible file storage               |
| **Type Safety**    | TypeScript        | 5.3.3   | Static type checking                     |

### Frontend Stack

| Layer             | Technology       | Version | Purpose                               |
| ----------------- | ---------------- | ------- | ------------------------------------- |
| **Framework**     | React            | 18.2.0  | UI library with concurrent features   |
| **Build Tool**    | Vite             | 5.0.11  | Fast bundler with HMR                 |
| **Language**      | TypeScript       | 5.3.3   | Type safety                           |
| **Styling**       | Tailwind CSS     | 3.4.18  | Utility-first CSS framework           |
| **UI Primitives** | Radix UI         | Latest  | Accessible, headless components       |
| **UI Components** | shadcn/ui        | Latest  | Pre-built components on Radix         |
| **Routing**       | React Router     | 7.9.4   | Client-side navigation                |
| **State Mgmt**    | Zustand          | 5.0.8   | Lightweight state with persistence    |
| **GraphQL**       | Apollo Client    | 4.0.7   | Data fetching, caching, subscriptions |
| **Code Gen**      | @graphql-codegen | 6.0.0   | Generate TS types and hooks           |
| **Flowchart**     | React Flow       | 12.8.6  | Interactive DAG visualization         |
| **Map**           | MapLibre GL      | 5.9.0   | Vector mapping library                |
| **Drawing**       | maplibre-gl-draw | 1.6.9   | Geometry editing on maps              |
| **Timeline**      | vis-timeline     | 8.3.1   | Timeline visualization                |
| **Testing**       | Vitest           | 1.2.1   | Unit testing framework                |
| **Mocking**       | MSW              | 2.11.5  | Network-level API mocking             |
| **Icons**         | Lucide React     | 0.546.0 | Icon library                          |
| **Notifications** | Sonner           | 2.0.7   | Toast notifications                   |
| **Date Utils**    | date-fns         | 4.1.0   | Date manipulation                     |
| **Geo Utils**     | @turf/turf       | 7.2.0   | GIS calculations                      |

### DevOps & Infrastructure

| Component            | Technology     | Version                |
| -------------------- | -------------- | ---------------------- |
| **Containerization** | Docker         | 24.0.0+                |
| **Orchestration**    | Docker Compose | 2.20.0+                |
| **Package Manager**  | pnpm           | 8.0.0+                 |
| **Node Runtime**     | Node.js        | 18.0.0+                |
| **Web Server**       | Nginx          | Latest (frontend)      |
| **CI/CD**            | GitHub Actions | (in .github/workflows) |

---

## Data Flow

### Synchronous Communication

#### 1. GraphQL (HTTP/WebSocket)

**Frontend → API**:

- Queries, mutations, subscriptions
- Default port: 3000
- Apollo DevTools support in development

```typescript
// Frontend query example
const { data } = useQuery(GET_CAMPAIGNS);

// Frontend subscription example
useSubscription(CAMPAIGN_UPDATED, {
  variables: { campaignId },
  onData: ({ data }) => updateLocalState(data),
});
```

#### 2. gRPC

**API → Rules Engine**:

- Condition evaluations
- Protocol Buffer format (.proto files)
- Port: 50051
- Timeout: 5000ms (configurable)

```typescript
// API calling rules engine
const result = await this.rulesEngineClient.evaluate({
  campaignId,
  branchId,
  expression: condition.expression,
  context: entityContext,
});
```

#### 3. HTTP REST

**Scheduler → API**:

- Job execution callbacks (GraphQL queries over HTTP)
- Health checks: `/health` endpoints
- Timeout: 10000ms with circuit breaker pattern

### Asynchronous Communication

#### 1. WebSocket/Socket.IO

**API → Frontend**:

- Real-time entity updates
- Live notifications
- Graceful reconnection handling
- Room-based message routing (campaign-scoped)

```typescript
// API emitting update
this.websocketGateway.emitToRoom(`campaign:${campaignId}`, 'settlement:updated', settlement);
```

#### 2. Redis Pub/Sub

**API → Rules Engine**:

- Cache invalidation signals
- Topic-based subscription model

**Topics**:

- `cache:invalidate:campaign:{id}`
- `cache:invalidate:settlement:{id}`
- `cache:invalidate:structure:{id}`

```typescript
// API publishing invalidation
await this.redisPublisher.publish(
  'cache:invalidate:settlement:123',
  JSON.stringify({ settlementId: '123', timestamp: Date.now() })
);
```

#### 3. Job Queue System (Bull)

**Redis-backed job storage**:

- **Producers**: API/Scheduler create jobs
- **Consumers**: Scheduler workers process jobs
- **Retries**: 3 attempts with 5s exponential backoff
- **Monitoring**: Bull Board UI in development

```typescript
// Scheduler adding job
await this.settlementGrowthQueue.add(
  'process-growth',
  {
    settlementId,
    campaignId,
    worldTime,
  },
  {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  }
);
```

---

## Key Architectural Patterns

### 1. Microservices Pattern

**Three Distinct Services**:

1. **API Service**: Monolithic backend serving GraphQL
2. **Rules Engine**: Stateless evaluation microservice
3. **Scheduler**: Async job processor

**Benefits**:

- Rules engine can scale independently for heavy evaluation loads
- Scheduler processes async tasks without blocking API requests
- Loose coupling via gRPC and message queues enables fault isolation

**Trade-offs**:

- Increased operational complexity (3 services to deploy/monitor)
- Network latency for inter-service communication
- Distributed tracing required for debugging

### 2. Multi-Layer Caching Strategy

#### Frontend Cache

- **Zustand Store**: Application state with localStorage persistence
- **Apollo Client**: GraphQL query cache with normalized entities

#### API Cache (Redis DB 1)

- **Entity Lists**: Query results for campaigns, settlements, locations
- **Computed Values**: Expensive calculations (settlement stats, dependency graphs)
- **Cache-Manager**: Abstraction layer with ioredis backend
- **Invalidation**: Dependency tracking for targeted cache clearing

#### Rules Engine Cache

- **Expression Results**: Evaluated condition outcomes
- **In-Memory (node-cache)**: 10k max keys for ultra-fast reads
- **Redis Fallback**: Distributed cache for multi-instance deployments
- **TTL**: 300s default with configurable expiration
- **Real-time Invalidation**: Redis pub/sub for immediate cache clearing

**Cache Hierarchy Diagram**:

```mermaid
graph TB
    subgraph "Cache Layer 1: Browser"
        Apollo[Apollo Client Cache<br/>Normalized entity store<br/>Field-level caching]
        Zustand[Zustand Store<br/>App state + localStorage<br/>Cross-tab sync]
    end

    subgraph "Cache Layer 2: API Request Scope"
        DataLoader[DataLoader<br/>Per-request batch loading<br/>N+1 query prevention<br/>100ms window]
    end

    subgraph "Cache Layer 3: API Cross-Request (Redis DB 1)"
        RedisCache[Redis Cache Service<br/>Entity lists + computed values<br/>TTL: 60-600s<br/>Key patterns: entity:{id}, list:{type}:*, stats:*]
    end

    subgraph "Cache Layer 4: Rules Engine"
        NodeCache[NodeCache (In-Memory)<br/>Condition evaluation results<br/>10k max keys<br/>TTL: 300s]
        RulesRedis[Redis Fallback<br/>Multi-instance deployments<br/>Distributed consistency]
    end

    User[User Request] --> Apollo
    Apollo -->|Cache miss| API
    API --> DataLoader
    DataLoader -->|Batch lookup| RedisCache
    RedisCache -->|Cache miss| Database[(PostgreSQL<br/>Source of truth)]

    API -->|Condition eval| RulesEngine[Rules Engine gRPC]
    RulesEngine --> NodeCache
    NodeCache -->|Cache miss| RulesRedis
    RulesRedis -->|Cache miss| Evaluation[JSONLogic Evaluation]

    Database -->|Write result| RedisCache
    RedisCache -->|Return data| DataLoader
    DataLoader -->|Return data| API
    API -->|Return data| Apollo
    Apollo -->|Render| User

    style Apollo fill:#e1f5ff
    style Zustand fill:#e1f5ff
    style DataLoader fill:#fff4e6
    style RedisCache fill:#e8f5e9
    style NodeCache fill:#fce4ec
    style RulesRedis fill:#fce4ec
    style Database fill:#f3e5f5
```

**Cache Invalidation Flow**:

```mermaid
sequenceDiagram
    participant GraphQL as GraphQL Mutation
    participant Service as Entity Service
    participant DepGraph as Dependency Graph
    participant RedisCache as Redis Cache
    participant RedisPubSub as Redis Pub/Sub
    participant RulesEngine as Rules Engine
    participant WebSocket as WebSocket Gateway
    participant Frontend as Frontend Clients

    Note over GraphQL,Frontend: Settlement Update Example

    GraphQL->>Service: updateSettlement(id, data)
    Service->>Service: Apply optimistic locking<br/>(check version)
    Service->>DepGraph: Find dependent entities<br/>(events, conditions, variables)

    Service->>RedisCache: Invalidate settlement:{id}
    Service->>RedisCache: Invalidate list:settlements:*
    Service->>RedisCache: Invalidate stats:settlement:{id}

    loop For each dependent entity
        Service->>RedisCache: Invalidate dependent entity
    end

    Service->>RedisPubSub: Publish cache.invalidate<br/>{pattern: "settlement:{id}"}

    RedisPubSub->>RulesEngine: Invalidation event
    RulesEngine->>RulesEngine: Clear NodeCache entries<br/>matching pattern
    RulesEngine->>RulesEngine: Clear Redis fallback<br/>matching pattern

    Service->>WebSocket: Emit settlement.updated<br/>to campaign:{campaignId} room

    WebSocket->>Frontend: WebSocket message<br/>{type: "settlement.updated", id}
    Frontend->>Frontend: Refetch GraphQL query<br/>OR optimistically update<br/>Apollo Cache

    Service-->>GraphQL: Updated settlement
```

**Key Performance Characteristics**:

- **L1 (Browser)**: Instant (0ms) - No network roundtrip
- **L2 (DataLoader)**: 1-5ms - In-memory batching
- **L3 (Redis)**: 5-20ms - Network + Redis lookup
- **L4 (Rules Engine)**: 0.5-20ms - Ultra-fast in-memory (NodeCache) or Redis
- **Database**: 50-500ms - Full query execution

**Cache Hit Rate Targets**:

- **Apollo Client**: 70-90% (depends on user navigation patterns)
- **Redis Cache**: 80-95% (entity lists, computed values)
- **Rules Engine**: 95-99% (repeated condition evaluations)

### 3. Real-Time Updates

**Transport**: Socket.IO over WebSocket
**Backend**: Redis Pub/Sub for GraphQL subscriptions
**Scaling**: Socket.IO Redis adapter for multi-instance horizontal scaling

**Topics** (examples):

- `campaign:{id}:updated`
- `settlement:{id}:updated`
- `event:{id}:resolved`
- `encounter:{id}:completed`

**Room-Based Routing**:

- Users join campaign-specific rooms
- Updates scoped to campaign participants only
- Reduces unnecessary network traffic

### 4. Authentication & Authorization

#### Authentication Flow

The system implements JWT-based authentication with refresh tokens for extended sessions:

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Database
    participant Redis

    Note over User,Redis: Login Flow
    User->>Frontend: Enter credentials
    Frontend->>API: POST /auth/login<br/>{email, password}
    API->>Database: Verify credentials
    Database-->>API: User record
    API->>API: Generate JWT + Refresh Token
    API->>Database: Store refresh token
    API->>Redis: Cache user permissions
    API-->>Frontend: {accessToken, refreshToken}
    Frontend->>Frontend: Store tokens (localStorage)

    Note over User,Redis: Authenticated Request Flow
    User->>Frontend: Access protected resource
    Frontend->>API: GraphQL query<br/>Authorization: Bearer {JWT}
    API->>API: Validate JWT signature
    API->>Redis: Check cached permissions
    Redis-->>API: Permission data
    API->>API: Authorize request
    API->>Database: Execute query
    Database-->>API: Data
    API-->>Frontend: Response

    Note over User,Redis: Token Refresh Flow (after 15min)
    Frontend->>API: POST /auth/refresh<br/>{refreshToken}
    API->>Database: Validate refresh token
    Database-->>API: Token record + User
    API->>API: Generate new JWT
    API-->>Frontend: {accessToken}
    Frontend->>Frontend: Update stored access token
```

#### Token Strategy

- **JWT**: Access tokens (15 min expiration)
- **Refresh Tokens**: 7 days expiration for extended sessions
- **Passport Strategies**: Local, JWT, API Key, Custom

#### Authorization Layers

**System-Level Roles**:

- User, Admin, SuperAdmin (global permissions)

**Campaign-Scoped Roles**:

- Owner, GameMaster (GM), Player, Viewer
- Defined per-campaign for multi-tenancy

**Permission Matrix**:

- Resource + Action pairs (e.g., `settlement:edit`, `event:create`)
- Attribute-based access control (ABAC) with JSON permission definitions
- Fine-grained control over entity operations

**Example Permission Check**:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('campaign:gm', 'campaign:owner')
@Mutation(() => Settlement)
async updateSettlement(
  @Args('id') id: string,
  @Args('input') input: UpdateSettlementInput,
  @CurrentUser() user: User
) {
  // Business logic
}
```

### 5. Database Design Patterns

#### Bitemporal Versioning

All mutable entities track two time dimensions:

- **Transaction Time**: When the data was recorded in the database
- **Valid Time**: When the data was/is/will be true in the world

This enables:

- Complete audit history
- Point-in-time queries ("What did we know about X at time T?")
- Temporal data analysis

#### Soft Deletes

- `deletedAt` timestamp instead of hard deletes
- Regulatory compliance (data retention requirements)
- Accidental deletion recovery
- Historical data integrity

#### PostGIS Geometries

- **SRID 3857**: Web Mercator projection for map rendering
- **Spatial Indexes**: Fast proximity and intersection queries
- **GeoJSON**: Standard format for frontend/backend interchange

#### CUID Primary Keys

- Collision-resistant unique identifiers
- Better performance than UUIDs in distributed systems
- More human-readable than UUIDs

#### Comprehensive Audit Trail

- **Entity Snapshots**: Full JSON snapshots of entity state
- **Change Diffs**: JSON Patch operations for incremental changes
- **User Attribution**: Who made each change
- **Temporal Context**: When changes occurred in world time

#### Polymorphic Relationships

- Flexible schema for variable-structure data
- `effectableType` + `effectableId` pattern for effects
- Supports multiple entity types without schema changes

---

## Deployment Architecture

### Docker Compose Services

```yaml
services:
  postgres: # PostgreSQL 16 + PostGIS (port 5432)
  redis: # Redis 7 (port 6379)
  minio: # MinIO S3-compatible storage (ports 9000, 9001)
  api: # NestJS GraphQL API (port 3000)
  rules-engine: # Rules evaluation worker (ports 50051, 9265)
  scheduler: # Job scheduler (port 9266)
  frontend: # React app + Nginx (port 8080)
```

### Environment Configuration

**Critical Variables**:

```bash
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/campaign_db

# Redis
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=<32+ character cryptographic key>
JWT_REFRESH_SECRET=<different 32+ char key>

# Microservices
RULES_ENGINE_GRPC_HOST=rules-engine
RULES_ENGINE_GRPC_PORT=50051
RULES_ENGINE_ENABLED=true

# CORS
CORS_ORIGIN=http://localhost:8080,https://yourdomain.com

# Feature Flags
NODE_ENV=production
LOG_LEVEL=info
```

### Health Checks

All services expose health check endpoints for monitoring:

- **API**: `GET /health` (HTTP 3000)
- **Rules Engine**: `GET /health/live`, `GET /health/ready` (HTTP 9265)
- **Scheduler**: `GET /health` (HTTP 9266)
- **Frontend**: Nginx status (HTTP 80)

### Scaling Considerations

**Horizontal Scaling**:

- API: Multiple instances behind load balancer (Socket.IO Redis adapter required)
- Rules Engine: Stateless design enables unlimited horizontal scaling
- Scheduler: Single instance recommended (cron jobs), or use distributed locking

**Vertical Scaling**:

- PostgreSQL: Primary bottleneck for high write loads
- Redis: Memory-bound, scale with more RAM or use clustering

**Performance Optimization**:

- Enable Prisma query caching
- Use PgBouncer for PostgreSQL connection pooling
- Configure Redis maxmemory policies (LRU eviction)
- Enable gzip compression in Nginx for frontend assets

---

## Development Workflow

### Common Commands

```bash
# Install dependencies
pnpm install

# Run all services in development mode (parallel)
pnpm run dev

# Build all packages
pnpm run build

# Run tests across all packages
pnpm run test

# Type-check all packages
pnpm run type-check

# Lint all code
pnpm run lint

# Format all code
pnpm run format
```

### Package-Specific Commands

```bash
# Run specific package in dev mode
pnpm --filter @campaign/api dev
pnpm --filter @campaign/frontend dev

# Test specific package
pnpm --filter @campaign/api test

# Build specific package
pnpm --filter @campaign/rules-engine build
```

### TypeScript Configuration

- **Base Config**: `tsconfig.base.json` (ES2022 target, strict mode enabled)
- **Path Aliases**: Configured for clean cross-package imports
- **Incremental Compilation**: Enabled for faster rebuilds
- **Declaration Maps**: Source maps for `.d.ts` files (better IDE support)

---

## Related Documentation

- **[Data Model](./data-model.md)**: Prisma schema, entity relationships, database design
- **[Settlement/Structure Deep Dive](./settlement-structure-deep-dive.md)**: Hierarchical design, typed variables, level progression
- **[Production Deployment](../deployment/production-deployment.md)**: Docker setup, database migrations, service orchestration
- **[Environment Variables](../deployment/environment-variables.md)**: Complete configuration reference
- **[Scaling Guide](../deployment/scaling-guide.md)**: Horizontal scaling, caching strategy, performance optimization
- **[Frontend Guide](../development/frontend-guide.md)**: React development, component patterns, testing
- **[Feature Documentation](../features/)**: Detailed docs for each major feature

---

## Architecture Decision Records (ADRs)

Key architectural decisions and their rationale:

1. **Monorepo with pnpm**: Single source of truth, shared tooling, workspace dependencies
2. **Microservices for Workers**: Independent scaling of rules engine and scheduler
3. **gRPC for Inter-Service**: Type-safe, high-performance communication
4. **Redis Everywhere**: Single system for caching, pub/sub, and job queuing
5. **Soft Deletes**: Data retention without hard deletes (regulatory compliance)
6. **Bitemporal Schema**: Complete audit trail with temporal data access
7. **PostGIS for Spatial**: Native spatial queries (not client-side calculations)
8. **React + TypeScript**: Type-safe frontend development
9. **Zustand + Apollo**: Lightweight, flexible state management
10. **Tailwind + Radix**: Performance-optimized, accessible component styling

---

## Performance Characteristics

### API Service

- **GraphQL Query Latency**: < 100ms (p95) for simple queries
- **Database Queries**: DataLoaders prevent N+1, < 50ms average
- **Cache Hit Rate**: ~80% for entity lists with proper invalidation
- **WebSocket Connections**: Supports 1000+ concurrent connections per instance

### Rules Engine

- **Evaluation Throughput**: 10,000+ evaluations/sec (in-memory cache hits)
- **gRPC Latency**: < 5ms for cached results, < 20ms for uncached
- **Cache Hit Rate**: ~90% in typical workloads
- **Horizontal Scaling**: Linear scaling with instance count

### Scheduler

- **Job Processing Rate**: 100+ jobs/min (varies by job type)
- **Cron Accuracy**: ±5 seconds for scheduled tasks
- **Retry Success Rate**: ~95% of failed jobs succeed on retry
- **Concurrent Jobs**: 5 default (configurable)

### Frontend

- **Initial Load**: < 2s (code splitting + lazy loading)
- **GraphQL Query**: < 200ms (includes network + rendering)
- **Map Rendering**: < 500ms for 1000 features
- **Flowchart Rendering**: < 300ms for 100 nodes
- **Timeline Rendering**: < 400ms for 500 events

---

_Last Updated: 2025-11-09_
