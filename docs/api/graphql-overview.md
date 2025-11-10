# GraphQL API Overview

## Introduction

The Campaign Manager GraphQL API is a comprehensive interface for managing tabletop RPG campaigns. Built with [TypeGraphQL](https://typegraphql.com/) and [NestJS](https://nestjs.com/), it provides a type-safe, code-first API for creating and managing worlds, locations, events, encounters, and complex game mechanics.

## Table of Contents

- [Schema Organization](#schema-organization)
- [Type System](#type-system)
- [Authentication & Authorization](#authentication--authorization)
- [Query Complexity & Performance](#query-complexity--performance)
- [Custom Scalars](#custom-scalars)
- [Common Patterns](#common-patterns)
- [Advanced Features](#advanced-features)
- [Getting Started](#getting-started)

---

## Schema Organization

### Code-First Architecture

The API uses a **code-first approach** with TypeGraphQL decorators. This means:

- GraphQL schema is generated from TypeScript classes
- Type safety is enforced at compile time
- Schema and implementation stay in sync automatically
- Generated schema is exported to `packages/api/src/schema.gql`

### Module Structure

The API is organized into domain-focused modules:

```
packages/api/src/
├── graphql/
│   ├── resolvers/        # Query & mutation resolvers (20+ files)
│   │   ├── campaign.resolver.ts
│   │   ├── world.resolver.ts
│   │   ├── location.resolver.ts
│   │   ├── settlement.resolver.ts
│   │   ├── event.resolver.ts
│   │   └── ...
│   ├── types/            # GraphQL object types (22+ files)
│   │   ├── campaign.type.ts
│   │   ├── location.type.ts
│   │   └── ...
│   ├── inputs/           # Input types for mutations (21+ files)
│   │   ├── campaign.input.ts
│   │   ├── create-location.input.ts
│   │   └── ...
│   ├── scalars/          # Custom scalar types
│   │   ├── datetime.scalar.ts
│   │   ├── geojson.scalar.ts
│   │   ├── json.scalar.ts
│   │   └── upload.scalar.ts
│   ├── dataloaders/      # N+1 query prevention
│   │   ├── location.dataloader.ts
│   │   ├── settlement.dataloader.ts
│   │   └── ...
│   ├── context/          # GraphQL context factory
│   │   └── graphql-context.ts
│   ├── graphql.module.ts      # Apollo Server configuration
│   └── graphql-core.module.ts # Core services (avoids circular deps)
└── auth/                 # Authentication & authorization
    ├── guards/
    │   ├── jwt-auth.guard.ts
    │   ├── roles.guard.ts
    │   └── api-key-auth.guard.ts
    └── strategies/
        ├── jwt.strategy.ts
        └── local.strategy.ts
```

### Entity Domains

The API organizes entities into logical domains:

#### Campaign Management

- **World**: Top-level container for campaign data
- **Campaign**: Player-facing campaign within a world
- **Branch**: Alternate timeline/scenario (git-like branching)
- **Version**: Optimistic locking for concurrent updates

#### Geographic Hierarchy

- **Location**: Hierarchical geographic entities (continents → cities)
- **Kingdom**: Political regions with evolving borders
- **Settlement**: Towns, cities, villages (typed variables)
- **Structure**: Buildings within settlements (typed variables)

#### Gameplay

- **Event**: Time-based events with conditions and effects
- **Encounter**: Combat/interaction scenarios with dependencies
- **Party**: Player groups
- **Character**: Player characters and NPCs

#### Advanced Systems

- **StateVariable**: Dynamic computed fields
- **FieldCondition**: JSONLogic-based conditional logic
- **Effect**: JSON Patch-based state mutations
- **DependencyGraph**: Event/encounter relationships
- **WorldTime**: Campaign-specific calendars and time tracking
- **AuditLog**: Comprehensive change tracking

---

## Type System

### Core GraphQL Types

The API exposes 22+ GraphQL object types. Key types include:

#### Campaign Type

```graphql
type Campaign {
  id: ID!
  name: String!
  description: String
  world: World!
  worldId: String!
  startDate: DateTime
  currentDate: DateTime
  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int!
}
```

#### Location Type

```graphql
type Location {
  id: ID!
  name: String!
  locationType: String!
  description: String
  geometry: GeoJSON
  parent: Location
  parentId: String
  children: [Location!]!
  world: World!
  worldId: String!
  metadata: JSON
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int!
}
```

#### Event Type

```graphql
type Event {
  id: ID!
  name: String!
  description: String
  eventType: String!
  scheduledDate: DateTime!
  resolvedDate: DateTime
  isResolved: Boolean!
  outcome: String
  conditions: [FieldCondition!]!
  effects: [Effect!]!
  location: Location
  world: World!
  metadata: JSON
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int!
}
```

### Input Types

Input types are used for creating and updating entities. Examples:

```graphql
input CreateCampaignInput {
  name: String!
  description: String
  worldId: String!
  startDate: DateTime
  currentDate: DateTime
}

input UpdateCampaignInput {
  id: String!
  name: String
  description: String
  currentDate: DateTime
  isActive: Boolean
  version: Int! # Required for optimistic locking
}

input CreateLocationInput {
  name: String!
  locationType: String!
  description: String
  geometry: GeoJSON
  parentId: String
  worldId: String!
  metadata: JSON
}
```

### Enums

Common enums used throughout the API:

```graphql
enum LocationType {
  CONTINENT
  REGION
  KINGDOM
  CITY
  TOWN
  VILLAGE
  POINT_OF_INTEREST
}

enum EventType {
  FESTIVAL
  BATTLE
  QUEST
  NATURAL_DISASTER
  POLITICAL
}

enum EncounterDifficulty {
  TRIVIAL
  EASY
  MODERATE
  HARD
  DEADLY
}
```

---

## Authentication & Authorization

### Authentication Mechanism

The API uses **JWT (JSON Web Token)** authentication:

- **Access Token**: 15-minute expiration
- **Refresh Token**: 7-day expiration (not yet implemented)
- **Token Format**: Bearer token in `Authorization` header

### Authentication Strategies

Three authentication strategies are supported:

1. **Local Strategy**: Email/password login
2. **JWT Strategy**: Token-based authentication
3. **API Key Strategy**: Service-to-service authentication

### Making Authenticated Requests

Include the JWT token in the `Authorization` header:

```http
POST /graphql
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "query": "query { campaigns { id name } }"
}
```

### User Context

Authenticated requests provide user context:

```typescript
interface AuthenticatedUser {
  id: string; // User ID
  email: string; // User email
  role: string; // User role (e.g., 'owner', 'gm', 'player')
}
```

Access the current user in resolvers:

```typescript
@Query(() => [Campaign])
@UseGuards(JwtAuthGuard)
async myCampaigns(@CurrentUser() user: AuthenticatedUser) {
  return this.campaignService.findByUser(user.id);
}
```

### Authorization Patterns

#### Query/Mutation Level Protection

Use `@UseGuards(JwtAuthGuard)` to require authentication:

```typescript
@Query(() => Campaign)
@UseGuards(JwtAuthGuard)
async campaign(@Args('id') id: string) {
  return this.campaignService.findOne(id);
}
```

#### Role-Based Access Control

Use `@UseGuards(JwtAuthGuard, RolesGuard)` with `@Roles()` decorator:

```typescript
@Mutation(() => Campaign)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'gm')  // Only owners and GMs can create campaigns
async createCampaign(@Args('input') input: CreateCampaignInput) {
  return this.campaignService.create(input);
}
```

#### Resource-Level Authorization

Services verify user ownership of resources:

```typescript
async findOne(id: string, userId: string): Promise<Campaign> {
  const campaign = await this.prisma.campaign.findUnique({ where: { id } });

  if (!campaign) {
    throw new NotFoundException('Campaign not found');
  }

  // Verify user has access to this campaign
  if (campaign.ownerId !== userId) {
    throw new ForbiddenException('Access denied');
  }

  return campaign;
}
```

### Available Roles

- **owner**: Full access to all resources
- **gm**: Game master with campaign management permissions
- **player**: Read-only access to campaign data
- **viewer**: Limited read-only access

---

## Query Complexity & Performance

### Complexity Limiting

The API enforces a **maximum query complexity of 1000** to prevent abuse and ensure performance. Complex queries with deep nesting or large result sets may be rejected.

Example of a complex query:

```graphql
# This query has high complexity due to nested relationships
query {
  world(id: "world-1") {
    campaigns {
      locations {
        settlements {
          structures {
            # Deep nesting increases complexity
          }
        }
      }
    }
  }
}
```

### N+1 Query Prevention with DataLoaders

The API uses **per-request DataLoaders** to prevent N+1 query problems and batch database queries efficiently.

Available DataLoaders:

- **LocationDataLoader**: Batch location lookups by ID
- **LocationGeometryDataLoader**: Batch geometry/WKB conversions
- **SettlementDataLoader**: Batch settlement lookups with locations
- **StructureDataLoader**: Batch structure lookups with hierarchies

DataLoaders are automatically injected into the GraphQL context and used by field resolvers.

Example field resolver using DataLoader:

```typescript
@ResolveField(() => Location, { nullable: true })
async location(
  @Parent() event: Event,
  @Context() context: GraphQLContext,
) {
  if (!event.locationId) return null;

  // Uses DataLoader to batch requests
  return context.loaders.locationLoader.load(event.locationId);
}
```

### Pagination

Most list queries support cursor-based pagination:

```graphql
query {
  locations(worldId: "world-1", first: 20, after: "cursor-abc123") {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

---

## Custom Scalars

The API defines four custom scalar types:

### DateTime

ISO 8601 date/time strings.

```graphql
scalar DateTime

# Example usage
type Event {
  scheduledDate: DateTime!
  resolvedDate: DateTime
  createdAt: DateTime!
}
```

JavaScript representation:

```javascript
// Input
'2024-11-09T22:30:00Z';

// Output
new Date('2024-11-09T22:30:00Z');
```

### GeoJSON

Spatial geometry data following the [GeoJSON specification](https://geojson.org/).

```graphql
scalar GeoJSON

# Example usage
type Location {
  geometry: GeoJSON # Point, Polygon, MultiPolygon, etc.
}
```

Supported geometry types:

- **Point**: `{ type: "Point", coordinates: [longitude, latitude] }`
- **Polygon**: `{ type: "Polygon", coordinates: [[[lon, lat], ...]] }`
- **MultiPolygon**: `{ type: "MultiPolygon", coordinates: [[[[lon, lat], ...]]] }`
- **LineString**: `{ type: "LineString", coordinates: [[lon, lat], ...] }`

Example:

```json
{
  "type": "Point",
  "coordinates": [-123.356, 48.407]
}
```

### JSON

Arbitrary JSON values (objects, arrays, primitives).

```graphql
scalar JSON

# Example usage
type Location {
  metadata: JSON # Any JSON value
}

type Settlement {
  variables: JSON # Typed variable schema
}
```

Example:

```json
{
  "population": 5000,
  "founded": "1654",
  "notable_features": ["harbor", "market"]
}
```

### Upload

File upload handling (for future use).

```graphql
scalar Upload

# Example usage (not yet implemented)
mutation {
  uploadMap(file: Upload!): Location
}
```

---

## Common Patterns

### Standard CRUD Operations

Most entities follow a consistent CRUD pattern:

#### Queries

```graphql
# Get single entity by ID
query {
  campaign(id: "campaign-1") {
    id
    name
  }
}

# Get entities by parent
query {
  locationsByParent(parentId: "location-1") {
    id
    name
  }
}

# Get entities by world/campaign
query {
  eventsByWorld(worldId: "world-1") {
    id
    name
  }
}
```

#### Mutations

```graphql
# Create
mutation {
  createCampaign(input: { name: "Rise of the Runelords", worldId: "world-1" }) {
    id
    name
  }
}

# Update
mutation {
  updateCampaign(
    input: {
      id: "campaign-1"
      name: "Updated Campaign Name"
      version: 1 # Optimistic locking
    }
  ) {
    id
    name
    version
  }
}

# Delete
mutation {
  deleteCampaign(id: "campaign-1") {
    id
  }
}

# Archive (soft delete)
mutation {
  archiveCampaign(id: "campaign-1") {
    id
    isArchived: true
  }
}

# Restore (unarchive)
mutation {
  restoreCampaign(id: "campaign-1") {
    id
    isArchived: false
  }
}
```

### Optimistic Locking

All entities include a `version` field for **optimistic concurrency control**. This prevents lost updates when multiple clients modify the same entity.

**How it works:**

1. Client reads entity (includes current version)
2. Client modifies entity locally
3. Client sends update mutation with original version
4. Server checks if version matches current database version
5. If versions match: update succeeds, version increments
6. If versions don't match: update fails with conflict error

**Example:**

```graphql
# Step 1: Read entity
query {
  campaign(id: "campaign-1") {
    id
    name
    version # Returns 1
  }
}

# Step 2: Update entity with version
mutation {
  updateCampaign(
    input: {
      id: "campaign-1"
      name: "New Name"
      version: 1 # Must match current version
    }
  ) {
    id
    name
    version # Returns 2 (incremented)
  }
}

# If another client updated it first, you'll get an error:
# "Version mismatch: expected 1, found 2"
```

### Field Resolvers & Lazy Loading

The API uses **field resolvers** to lazy-load related entities only when requested:

```graphql
query {
  event(id: "event-1") {
    id
    name
    # Location is NOT loaded unless explicitly requested
    location {
      id
      name
    }
  }
}
```

This improves performance by avoiding unnecessary database queries.

---

## Advanced Features

### Git-Like Branching System

The API supports **alternate timeline branches** for "what-if" scenarios:

```graphql
# Create a branch from current timeline
mutation {
  createBranch(
    input: {
      worldId: "world-1"
      name: "Peaceful Festival"
      description: "What if the goblin raid was prevented?"
      branchPoint: "2024-09-21T20:00:00Z"
    }
  ) {
    id
    name
    branchPoint
  }
}

# Query branch-specific data
query {
  branch(id: "branch-1") {
    id
    name
    customVariables # Branch-specific state
  }
}

# Merge branches (3-way merge with conflict resolution)
mutation {
  mergeBranches(input: { sourceBranchId: "branch-1", targetBranchId: "main", strategy: "MANUAL" }) {
    conflicts {
      path
      baseValue
      sourceValue
      targetValue
    }
  }
}
```

See [docs/features/branching-system.md](../features/branching-system.md) for details.

### Effects System (JSON Patch)

Events can mutate world state using **JSON Patch operations**:

```graphql
type Effect {
  id: ID!
  targetType: String!      # "Settlement", "Structure", etc.
  targetId: String!
  jsonPatch: JSON!         # JSON Patch operations
  description: String
}

# Example effect JSON
{
  "op": "replace",
  "path": "/variables/population",
  "value": 5500
}
```

See [docs/features/effect-system.md](../features/effect-system.md) for details.

### Condition System (JSONLogic)

Events can have conditional execution based on **JSONLogic expressions**:

```graphql
type FieldCondition {
  id: ID!
  field: String!           # Field to evaluate
  operator: String!        # JSONLogic operator
  value: JSON              # Expected value
  logic: JSON!             # Full JSONLogic expression
}

# Example condition logic
{
  ">=": [
    { "var": "settlement.variables.population" },
    5000
  ]
}
```

See [docs/features/condition-system.md](../features/condition-system.md) for details.

### Dependency Graph System

Events and encounters can have **dependency relationships**:

```graphql
type DependencyLink {
  id: ID!
  sourceType: String! # "Event" or "Encounter"
  sourceId: String!
  targetType: String!
  targetId: String!
  linkType: String! # "prerequisite", "triggers", "related"
}

# Query dependencies
query {
  encounter(id: "encounter-1") {
    id
    name
    dependencies {
      id
      linkType
      source {
        ... on Encounter {
          id
          name
        }
      }
    }
  }
}
```

See [docs/features/dependency-graph-system.md](../features/dependency-graph-system.md) for details.

### World Time System

Campaigns use **custom calendars** for time tracking:

```graphql
type WorldTime {
  id: ID!
  world: World!
  currentDate: DateTime!
  calendar: JSON!          # Custom calendar definition
  timeMultiplier: Float!   # Real-time to game-time ratio
}

# Example calendar JSON
{
  "monthsPerYear": 12,
  "daysPerMonth": 30,
  "hoursPerDay": 24,
  "monthNames": ["Calistril", "Pharast", ...]
}
```

See [docs/features/world-time-system.md](../features/world-time-system.md) for details.

---

## Getting Started

### 1. Obtain Authentication Token

```graphql
mutation {
  login(email: "user@example.com", password: "password") {
    accessToken
    user {
      id
      email
      role
    }
  }
}
```

### 2. Make Authenticated Requests

Include the token in the `Authorization` header:

```http
POST /graphql
Authorization: Bearer <your-access-token>
Content-Type: application/json
```

### 3. Create a World

```graphql
mutation {
  createWorld(input: { name: "Golarion", description: "Pathfinder campaign setting" }) {
    id
    name
  }
}
```

### 4. Create a Campaign

```graphql
mutation {
  createCampaign(
    input: { name: "Rise of the Runelords", worldId: "world-1", startDate: "4707-09-21T00:00:00Z" }
  ) {
    id
    name
  }
}
```

### 5. Query Your Data

```graphql
query {
  world(id: "world-1") {
    id
    name
    campaigns {
      id
      name
      locations {
        id
        name
        locationType
      }
    }
  }
}
```

---

## Next Steps

- **[Queries Reference](queries.md)**: Complete list of available queries with examples
- **[Mutations Reference](mutations.md)**: Complete list of mutations with input examples
- **[Subscriptions Reference](subscriptions.md)**: Real-time updates via WebSockets
- **[Error Handling Guide](error-handling.md)**: GraphQL errors, validation, and authorization errors

---

## Additional Resources

- **GraphQL Playground**: `http://localhost:3000/graphql` (development)
- **Generated Schema**: `packages/api/src/schema.gql`
- **TypeGraphQL Documentation**: https://typegraphql.com/
- **NestJS GraphQL Documentation**: https://docs.nestjs.com/graphql/quick-start
