# GraphQL API Structure Research - Campaign Manager

## Document Purpose

Comprehensive research findings on the Campaign Manager GraphQL API structure, including schema organization, type system, authentication/authorization, and architecture patterns.

---

## 1. SCHEMA ORGANIZATION

### Directory Structure

```
packages/api/src/graphql/
├── graphql.module.ts              # Main GraphQL configuration and resolver registration
├── graphql-core.module.ts         # Core services and dataloaders (avoids circular deps)
├── context/
│   └── graphql-context.ts         # Context factory, interfaces, and dataloader setup
├── resolvers/                     # 20+ resolvers for different entities
│   ├── campaign.resolver.ts
│   ├── world.resolver.ts
│   ├── settlement.resolver.ts
│   ├── location.resolver.ts
│   ├── kingdom.resolver.ts
│   ├── event.resolver.ts
│   ├── encounter.resolver.ts
│   ├── party.resolver.ts
│   ├── character.resolver.ts
│   ├── structure.resolver.ts
│   ├── branch.resolver.ts
│   ├── merge.resolver.ts
│   ├── effect.resolver.ts
│   ├── state-variable.resolver.ts
│   ├── field-condition.resolver.ts
│   ├── world-time.resolver.ts
│   ├── link.resolver.ts
│   ├── spatial.resolver.ts
│   ├── audit.resolver.ts
│   ├── dependency-graph.resolver.ts
│   └── cache-stats.resolver.ts
├── types/                         # 22+ ObjectType definitions
│   ├── campaign.type.ts
│   ├── world.type.ts
│   ├── settlement.type.ts
│   ├── location.type.ts
│   ├── kingdom.type.ts
│   ├── event.type.ts
│   ├── encounter.type.ts
│   ├── party.type.ts
│   ├── character.type.ts
│   ├── structure.type.ts
│   ├── branch.type.ts
│   ├── effect.type.ts
│   ├── state-variable.type.ts
│   ├── field-condition.type.ts
│   ├── world-time.type.ts
│   ├── link.type.ts
│   ├── spatial.type.ts
│   ├── version.type.ts
│   ├── audit.type.ts
│   ├── cache-stats.type.ts
│   ├── pagination.type.ts
│   └── dependency-graph.type.ts
├── inputs/                        # 21+ InputType definitions
│   ├── campaign.input.ts
│   ├── world.input.ts
│   ├── settlement.input.ts
│   ├── location.input.ts
│   ├── kingdom.input.ts
│   ├── event.input.ts
│   ├── encounter.input.ts
│   ├── party.input.ts
│   ├── character.input.ts
│   ├── structure.input.ts
│   ├── branch.input.ts
│   ├── effect.input.ts
│   ├── state-variable.input.ts
│   ├── field-condition.input.ts
│   ├── world-time.input.ts
│   ├── link.input.ts
│   ├── spatial.input.ts
│   ├── version.input.ts
│   ├── variable.input.ts
│   └── filter.input.ts
├── scalars/                       # Custom scalar types
│   ├── datetime.scalar.ts         # ISO 8601 date handling
│   ├── geojson.scalar.ts          # GeoJSON geometry objects
│   ├── json.scalar.ts             # Arbitrary JSON values
│   └── upload.scalar.ts           # File upload handling
├── services/                      # 30+ business logic services
│   ├── campaign.service.ts
│   ├── world.service.ts
│   ├── settlement.service.ts
│   ├── location.service.ts
│   ├── kingdom.service.ts
│   ├── event.service.ts
│   ├── encounter.service.ts
│   ├── effect.service.ts
│   ├── effect-execution.service.ts
│   ├── effect-patch.service.ts
│   ├── state-variable.service.ts
│   ├── condition.service.ts
│   ├── condition-evaluation.service.ts
│   ├── dependency-graph.service.ts
│   ├── dependency-graph-builder.service.ts
│   ├── branch.service.ts
│   ├── merge.service.ts
│   ├── version.service.ts
│   ├── world-time.service.ts
│   ├── variable-evaluation.service.ts
│   ├── variable-schema.service.ts
│   ├── level-history.service.ts
│   ├── link.service.ts
│   ├── party.service.ts
│   ├── character.service.ts
│   ├── structure.service.ts
│   └── audit.service.ts
├── dataloaders/                   # DataLoader implementations for N+1 prevention
│   ├── location.dataloader.ts
│   ├── location-geometry.dataloader.ts
│   ├── settlement.dataloader.ts
│   └── structure.dataloader.ts
├── exceptions/                    # Custom GraphQL exceptions
│   └── optimistic-lock.exception.ts
├── decorators/                    # GraphQL decorators
│   └── current-user.decorator.ts
├── directives/                    # GraphQL directives
├── cache/                         # Redis caching infrastructure
│   └── redis-cache.provider.ts
├── pubsub/                        # Redis Pub/Sub for subscriptions
│   └── redis-pubsub.provider.ts
├── utils/                         # Utility functions
│   ├── pagination.util.ts
│   ├── dependency-extractor.ts
│   ├── dependency-graph.ts
│   ├── version.utils.ts
│   └── calendar.utils.ts
└── cache/
    └── cache-stats.resolver.ts
```

### Module Organization Pattern

- **GraphQLModule**: Main Apollo Server configuration with all resolvers
- **GraphQLCoreModule**: Core infrastructure (context factory, services, dataloaders)
  - Keeps dependencies separate to avoid circular dependency issues
  - Provides all services that resolvers depend on
  - Exports context factory, Redis pubsub, and Redis cache providers

---

## 2. TYPE SYSTEM

### Core GraphQL Types

#### World & Campaign Management

- **World**: Top-level campaign world with metadata
- **Campaign**: Campaign instance within a world (active/archived)
- **Branch**: Git-like branching for alternate timelines
- **Version**: Version tracking for optimistic locking

#### Geographic & Settlement Hierarchy

- **Location**: Geographic points or regions (parent-child hierarchy)
- **Kingdom**: Political/territorial entity
- **Settlement**: Town/city within a kingdom
- **Structure**: Buildings/structures within settlements (hierarchical)

#### Gameplay Elements

- **Event**: Story events or occurrences in campaigns
- **Encounter**: Combat encounters or challenges
- **Party**: Group of characters/adventurers
- **Character**: Individual character/NPC

#### Advanced Features

- **StateVariable**: Dynamic typed variables with schema validation
- **FieldCondition**: Conditional logic using JSONLogic
- **Effect**: World state mutations using JSON Patch
- **DependencyGraph**: Entity relationship tracking
- **WorldTime**: Campaign-specific time tracking
- **Audit**: Activity logging for audit trails

#### System Types

- **Link**: Relationships/dependencies between entities
- **Spatial**: Geographic querying and boundaries
- **Pagination**: Cursor-based pagination support
- **CacheStats**: Cache statistics and performance metrics

### Custom Scalars

1. **DateTime** (ISO 8601)
   - Serializes Date → ISO string
   - Parses ISO string → Date
   - File: `packages/api/src/graphql/scalars/datetime.scalar.ts`

2. **GeoJSON** (Spatial Geometry)
   - Supports Point, LineString, Polygon, Multi\* types
   - Validates geometry structure
   - File: `packages/api/src/graphql/scalars/geojson.scalar.ts`

3. **JSON** (Arbitrary JSON)
   - Handles complex nested structures
   - Used for variables and custom data
   - File: `packages/api/src/graphql/scalars/json.scalar.ts`

4. **Upload** (File Upload)
   - GraphQL Upload scalar for file handling

### Input Types Pattern

Each entity typically has:

- `CreateXInput`: For mutations creating new entities
- `UpdateXInput`: For mutations updating entities
- Optional filters and options for queries

Examples:

- `CreateCampaignInput` / `UpdateCampaignInput`
- `CreateLocationInput` / `UpdateLocationInput`
- `CreateSettlementInput` / `UpdateSettlementInput`

---

## 3. AUTHENTICATION & AUTHORIZATION

### Authentication Mechanism: JWT (JSON Web Tokens)

**File**: `packages/api/src/auth/auth.module.ts`

**Configuration**:

- JWT secret from environment variable (required)
- Access tokens expire in 15 minutes
- Refresh token strategy for longer sessions
- Multiple authentication strategies supported:
  - Local (username/password)
  - JWT (bearer tokens)
  - API Key

### Auth Guards

1. **JwtAuthGuard** (`packages/api/src/auth/guards/jwt-auth.guard.ts`)
   - Validates JWT tokens in GraphQL context
   - Supports public/unauthenticated routes via @Public() decorator
   - Handles both HTTP and GraphQL execution contexts

2. **RolesGuard** (`packages/api/src/auth/guards/roles.guard.ts`)
   - Checks user roles against required roles
   - Works with @Roles() decorator
   - Used for role-based access control (RBAC)

3. **ApiKeyAuthGuard**
   - API key authentication for service-to-service communication

### Authorization Patterns

**Type-Level Authorization**:

```typescript
@Query(() => Campaign)
@UseGuards(JwtAuthGuard)
async campaign(@Args('id') id: string, @CurrentUser() user: AuthenticatedUser)
```

**Role-Based Authorization**:

```typescript
@Mutation(() => Campaign)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'gm')
async createCampaign(...)
```

**User Context Injection**:

```typescript
@CurrentUser() user: AuthenticatedUser
```

### User Context

**Interface**: `AuthenticatedUser`

```typescript
interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}
```

**Current User Decorator**: `packages/api/src/graphql/decorators/current-user.decorator.ts`

### Services Supporting Auth

1. **AuthService**: Core authentication logic
2. **UsersService**: User management
3. **CampaignMembershipService**: Campaign user membership and permissions
4. **PermissionsService**: Permission checking logic
5. **ApiKeyService**: API key management

**File**: `packages/api/src/auth/services/`

---

## 4. GRAPHQL CONTEXT

**File**: `packages/api/src/graphql/context/graphql-context.ts`

### GraphQLContext Interface

```typescript
interface GraphQLContext {
  req: RequestWithUser; // Express request with user
  res: Response; // Express response
  user?: AuthenticatedUser; // Authenticated user (optional)
  dataloaders: DataLoaders; // Per-request dataloaders
}
```

### DataLoaders (N+1 Prevention)

**DataLoaders Interface**:

```typescript
interface DataLoaders {
  locationLoader: DataLoader<string, LocationWithGeometry | null>;
  locationGeometryLoader: DataLoader<string, Buffer | null>;
  settlementLoader: DataLoader<string, SettlementWithLocation | null>;
  structureLoader: DataLoader<string, Structure[]>;
}
```

**Purpose**:

- Batch and cache database queries within a single GraphQL request
- Prevent N+1 query problems
- User context is required for authorization in loaders

**Implementations**:

- `packages/api/src/graphql/dataloaders/location.dataloader.ts`
- `packages/api/src/graphql/dataloaders/location-geometry.dataloader.ts`
- `packages/api/src/graphql/dataloaders/settlement.dataloader.ts`
- `packages/api/src/graphql/dataloaders/structure.dataloader.ts`

### Context Creation

- Fresh DataLoaders created per request
- User context required for DataLoader authorization
- Fails if no authenticated user

---

## 5. RESOLVER PATTERNS

### Standard CRUD Resolver Pattern

**Query Operations**:

- `singleEntity(id: ID!)`: Fetch single entity by ID
- `entitiesByParent(parentId: ID!)`: Fetch related entities
- `entitiesByWorld/Campaign/Kingdom`: Filter by parent entity

**Mutation Operations**:

- `create<Entity>(input: Create<Entity>Input!): <Entity>`
- `update<Entity>(id: ID!, input: Update<Entity>Input!): <Entity>`
- `delete<Entity>(id: ID!): <Entity>` (soft delete)
- `archive<Entity>(id: ID!): <Entity>` (archive/soft delete)
- `restore<Entity>(id: ID!): <Entity>` (restore from archive)

### Guard & Role Decorators Pattern

```typescript
@Query(() => Campaign)
@UseGuards(JwtAuthGuard)
async campaign(
  @Args('id', { type: () => ID }) id: string,
  @CurrentUser() user: AuthenticatedUser
): Promise<Campaign | null>

@Mutation(() => Campaign)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'gm')
async createCampaign(
  @Args('input') input: CreateCampaignInput,
  @CurrentUser() user: AuthenticatedUser
): Promise<Campaign>
```

### Field Resolver Pattern (ResolveField)

Used in complex types where computed fields need custom loading:

```typescript
@ResolveField(() => GeoJSONScalar, { nullable: true })
async geojson(
  @Parent() location: Location,
  @Context() context: GraphQLContext
): Promise<unknown | null> {
  // Use DataLoader for batch loading
  const geom = await context.dataloaders.locationGeometryLoader.load(location.id);
  // Transform and return
  return this.spatialService.wkbToGeoJSON(geom);
}
```

### Example Resolver: CampaignResolver

**File**: `packages/api/src/graphql/resolvers/campaign.resolver.ts`

Queries:

- `campaign(id)`: Get single campaign
- `campaigns()`: Get all campaigns for user
- `campaignsByWorld(worldId)`: Get campaigns in world

Mutations:

- `createCampaign(input)`
- `updateCampaign(id, input)`
- `deleteCampaign(id)`
- `archiveCampaign(id)`
- `restoreCampaign(id)`

---

## 6. SCHEMA CONFIGURATION

**File**: `packages/api/src/graphql/graphql.module.ts`

### Apollo Server Setup

- **Driver**: ApolloDriver (NestJS Apollo integration)
- **Approach**: Code-first (schema generated from TypeScript classes)
- **Schema Output**: `packages/api/src/schema.gql` (auto-generated)

### Key Configurations

- **Query Complexity Plugin**: Limits query complexity to 1000
- **Authentication**: JWT strategy via Passport
- **Introspection**: Enabled in all environments
- **Error Formatting**: Consistent error responses
- **Subscriptions**: GraphQL WebSocket subscriptions enabled
- **Persisted Queries**: Enabled in production

### Resolver Registration

All 20+ resolvers registered in GraphQLModule providers array:

```typescript
providers: [
  HealthResolver,
  VersionResolver,
  AuditResolver,
  BranchResolver,
  MergeResolver,
  CacheStatsResolver,
  WorldResolver,
  CampaignResolver,
  CharacterResolver,
  PartyResolver,
  KingdomResolver,
  SettlementResolver,
  StructureResolver,
  LocationResolver,
  EncounterResolver,
  EventResolver,
  LinkResolver,
  SpatialResolver,
  WorldTimeResolver,
  StateVariableResolver,
  FieldConditionResolver,
  DependencyGraphResolver,
  EffectResolver,
  DateTimeScalar,
  GeoJSONScalar,
  UploadScalar,
];
```

---

## 7. SERVICE LAYER ARCHITECTURE

### Services Pattern

Each entity domain has dedicated services:

- `CampaignService`: Campaign CRUD and business logic
- `WorldService`: World management
- `SettlementService`: Settlement logic
- `LocationService`: Location and spatial operations
- etc.

### Advanced Services

- **EffectService**: JSON Patch-based world state mutations
- **EffectExecutionService**: Executes effects and tracks results
- **BranchService**: Git-like branching for alternate timelines
- **VersionService**: Optimistic locking and version management
- **ConditionEvaluationService**: Evaluates JSONLogic conditions
- **DependencyGraphService**: Tracks entity relationships
- **MergeService**: 3-way merge conflict resolution

### Service Location

`packages/api/src/graphql/services/`

---

## 8. INPUT TYPES

### Common Input Pattern

**Create Inputs**: For mutation inputs when creating entities

- Example: `CreateCampaignInput`, `CreateWorldInput`

**Update Inputs**: Extended create inputs with ID and optional versioning

- May include `branchId` and `expectedVersion` for branching/versioning
- Example: `UpdateCampaignInput`

**Common Fields Across Inputs**:

- `branchId`: Optional branch context
- `expectedVersion`: For optimistic locking
- `worldTime`: For world time operations

### Files

`packages/api/src/graphql/inputs/`

---

## 9. EXCEPTION HANDLING

### Custom Exceptions

- **OptimisticLockException**: Version mismatch during updates
- File: `packages/api/src/graphql/exceptions/optimistic-lock.exception.ts`

### Error Formatting

Apollo Server formatError plugin provides consistent error responses with:

- Message
- Extensions (detailed error info in non-production)

---

## 10. CACHING & PERFORMANCE

### Redis Integration

- **Redis Cache Provider**: `packages/api/src/graphql/cache/redis-cache.provider.ts`
- **Redis PubSub**: `packages/api/src/graphql/pubsub/redis-pubsub.provider.ts`

### Query Complexity Limiting

- Default complexity: 1 per field
- Max allowed complexity: 1000 per query
- Prevents expensive queries from overloading system

### DataLoader Batching

- Per-request DataLoaders for N+1 prevention
- Location, Settlement, Structure batching
- Geometry loading for spatial data

---

## 11. KEY FILE PATHS FOR DOCUMENTATION

### Essential Files

- **Main Setup**: `/storage/programs/campaign_manager/packages/api/src/graphql/graphql.module.ts`
- **Core Module**: `/storage/programs/campaign_manager/packages/api/src/graphql/graphql-core.module.ts`
- **Context Factory**: `/storage/programs/campaign_manager/packages/api/src/graphql/context/graphql-context.ts`

### Resolver Examples

- **Campaign**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/campaign.resolver.ts`
- **World**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/world.resolver.ts`
- **Location**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/location.resolver.ts`
- **Event**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/event.resolver.ts`

### Type Examples

- **Campaign**: `/storage/programs/campaign_manager/packages/api/src/graphql/types/campaign.type.ts`
- **Location**: `/storage/programs/campaign_manager/packages/api/src/graphql/types/location.type.ts`
- **Settlement**: `/storage/programs/campaign_manager/packages/api/src/graphql/types/settlement.type.ts`
- **Event**: `/storage/programs/campaign_manager/packages/api/src/graphql/types/event.type.ts`

### Scalar Types

- **DateTime**: `/storage/programs/campaign_manager/packages/api/src/graphql/scalars/datetime.scalar.ts`
- **GeoJSON**: `/storage/programs/campaign_manager/packages/api/src/graphql/scalars/geojson.scalar.ts`
- **JSON**: `/storage/programs/campaign_manager/packages/api/src/graphql/scalars/json.scalar.ts`

### Auth/Security

- **Auth Module**: `/storage/programs/campaign_manager/packages/api/src/auth/auth.module.ts`
- **JWT Guard**: `/storage/programs/campaign_manager/packages/api/src/auth/guards/jwt-auth.guard.ts`
- **Roles Guard**: `/storage/programs/campaign_manager/packages/api/src/auth/guards/roles.guard.ts`

---

## 12. ARCHITECTURAL HIGHLIGHTS

### Code-First GraphQL

- Schema generated from TypeScript classes using TypeGraphQL decorators
- Type-safe development with shared TS types
- Schema auto-exports to `schema.gql` for static analysis tools

### Modular Service Layer

- Each domain entity has dedicated service
- Services encapsulate business logic
- Resolvers are thin - mainly delegate to services

### N+1 Prevention

- DataLoader pattern for all relationships
- Per-request DataLoader instances
- Automatic batching within single GraphQL request

### Security

- JWT-based authentication
- Role-based access control (RBAC)
- User context required for all operations
- Public routes marked with @Public() decorator

### Performance

- Query complexity limiting
- Redis caching infrastructure
- Geometry batching for spatial queries
- Optimistic locking for concurrent updates

### Advanced Features

- Git-like branching for alternate timelines
- 3-way merge conflict resolution
- Optimistic locking for version control
- Dependency graph tracking
- Effect system for world state mutations
- JSONLogic conditions for dynamic rules
- Custom scalars for domain-specific types

---

## 13. QUERY EXAMPLES FROM CODE

### Campaign CRUD

```
Query campaigns: Get all campaigns accessible to user
Query campaign(id): Get single campaign
Mutation createCampaign(input): Create new campaign
Mutation updateCampaign(id, input): Update campaign
Mutation deleteCampaign(id): Soft delete campaign
Mutation archiveCampaign(id): Archive campaign
Mutation restoreCampaign(id): Restore archived campaign
```

### Location Management

```
Query location(id): Get location
Query locationsByWorld(worldId): Get all locations in world
Query locationsByParent(parentLocationId): Get child locations
Mutation createLocation(input): Create location
Mutation updateLocation(id, input): Update location
ResolveField geojson: Lazy-load spatial geometry
```

### Event System

```
Query event(id): Get event
Query eventsByCampaign(campaignId): Get campaign events
Query eventsByLocation(locationId): Get location events
Mutation createEvent(input): Create event
Mutation updateEvent(id, input): Update event
Mutation markEventComplete(id): Mark event as completed
```

---

## Summary Statistics

- **Total Resolvers**: 20+
- **Total Types**: 22+
- **Total Input Types**: 21+
- **Custom Scalars**: 4 (DateTime, GeoJSON, JSON, Upload)
- **Services**: 30+
- **DataLoaders**: 4
- **Auth Strategies**: 3 (Local, JWT, API Key)
- **Guards**: 3 (JWT, Roles, API Key)

---

## Recommended Documentation Sections

1. **Schema Overview**: Entity relationships and hierarchy
2. **Authentication Guide**: JWT setup, user context, roles
3. **API Endpoints**: Query and mutation reference
4. **Type System**: Core types, custom scalars, inputs
5. **Best Practices**: DataLoader usage, complexity limits, error handling
6. **Examples**: Common queries and mutations
7. **Advanced Features**: Branching, merging, effects, conditions
8. **Performance**: Caching, DataLoaders, complexity limits
9. **Error Handling**: Custom exceptions, error formatting
10. **Development**: Adding new resolvers, types, services
