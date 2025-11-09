# Campaign Manager - API

NestJS GraphQL API backend for the Campaign Manager tabletop RPG tool.

## Tech Stack

- **Framework**: NestJS 10
- **API Style**: GraphQL (Apollo Server v4)
- **Database**: PostgreSQL + PostGIS (via Prisma ORM)
- **Authentication**: Passport + JWT
- **Caching**: Redis + cache-manager
- **Real-time**: Socket.IO + Redis adapter
- **Microservices**: gRPC (rules-engine integration)
- **Rate Limiting**: @nestjs/throttler
- **Testing**: Jest + @nestjs/testing
- **Code Quality**: ESLint, Prettier

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+ with PostGIS extension
- Redis 6+

### Installation

From the project root:

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm --filter @campaign/api prisma:generate

# Start dev server (from root)
pnpm --filter @campaign/api dev

# Or use root script
pnpm run dev
```

The API server will start at http://localhost:9264 (configurable via PORT)

GraphQL Playground: http://localhost:9264/graphql

### Development Commands

**IMPORTANT**: Always run commands from the project root, never `cd` into this directory.

```bash
# Development server (with hot reload)
pnpm --filter @campaign/api dev

# Build for production
pnpm --filter @campaign/api build

# Run production build
pnpm --filter @campaign/api start

# Type checking
pnpm --filter @campaign/api type-check

# Linting
pnpm --filter @campaign/api lint
pnpm --filter @campaign/api lint -- --fix

# Testing
pnpm --filter @campaign/api test
pnpm --filter @campaign/api test:watch

# Database operations
pnpm --filter @campaign/api prisma:generate    # Generate Prisma client
pnpm --filter @campaign/api prisma:migrate     # Create migration
pnpm --filter @campaign/api prisma:studio      # Open Prisma Studio UI
pnpm --filter @campaign/api prisma:seed        # Seed demo data
pnpm --filter @campaign/api prisma:reset       # Reset database (WARNING: destructive)
```

## Environment Variables

### Setup

1. Copy `.env.example` to `.env`:

   ```bash
   cp packages/api/.env.example packages/api/.env
   ```

2. Update values as needed for your local environment

3. For local overrides, create `.env.local` (gitignored)

### Required Variables

```env
# Database Configuration
DATABASE_URL="postgresql://campaign_user:campaign_pass@localhost:5432/campaign_db?schema=public"

# Server Configuration
PORT=9264
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_REFRESH_EXPIRATION=7d

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# gRPC Configuration (rules-engine)
GRPC_RULES_ENGINE_URL=localhost:50051

# CORS Configuration
CORS_ORIGIN=http://localhost:9263
```

### Optional Variables

```env
# File Upload
MAX_FILE_SIZE_MB=10
UPLOAD_DESTINATION=./uploads

# AWS S3 (for production file storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# Cache Configuration
CACHE_TTL=300
CACHE_MAX_ITEMS=1000

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100

# Logging
LOG_LEVEL=info
```

See `.env.example` for complete list with descriptions.

## Database

### Prisma Schema

The database schema is defined in `prisma/schema.prisma`. It includes:

- **Users & Authentication**: User, Session, RefreshToken
- **Campaigns**: Campaign, Branch, WorldTime
- **Geography**: Kingdom, Location (with PostGIS geometry)
- **Settlements**: Settlement, SettlementType, SettlementVariable
- **Structures**: Structure, StructureType, StructureVariable
- **Events**: Event, EventTemplate, Encounter
- **Conditions**: FieldCondition (JSONLogic expressions)
- **Effects**: Effect (JSON Patch operations)
- **Dependencies**: DependencyLink, DependencyGraph
- **Audit**: AuditLog

### Migrations

```bash
# Create a new migration
pnpm --filter @campaign/api prisma:migrate

# Deploy migrations to production
pnpm --filter @campaign/api prisma:migrate:deploy

# Reset database (dev only - WARNING: destructive!)
pnpm --filter @campaign/api prisma:reset
```

### Seeding

Demo seed data is available in `prisma/seed.ts`:

```bash
# Seed database with demo data
pnpm --filter @campaign/api prisma:seed
```

The seed includes:

- Sample campaigns with world-time calendars
- Geographic regions, locations, settlements, and structures
- Events and encounters with conditions, effects, and dependencies
- Alternate timeline branches

### Prisma Studio

Interactive database GUI for viewing and editing data:

```bash
pnpm --filter @campaign/api prisma:studio
```

Opens at http://localhost:5555

## Project Structure

```
packages/api/
├── src/
│   ├── main.ts              # Application bootstrap
│   ├── app.module.ts        # Root module
│   ├── auth/                # Authentication & authorization
│   │   ├── auth.module.ts
│   │   ├── strategies/      # Passport strategies (JWT, Local)
│   │   └── guards/          # Auth guards
│   ├── users/               # User management
│   ├── graphql/             # GraphQL schema & resolvers
│   │   ├── schema/          # Type definitions (*.graphql)
│   │   ├── resolvers/       # Resolvers by domain
│   │   └── directives/      # Custom directives
│   ├── database/            # Prisma client & services
│   ├── grpc/                # gRPC client for rules-engine
│   ├── websocket/           # Socket.IO real-time updates
│   ├── rules/               # Condition & effect evaluation
│   ├── common/              # Shared utilities
│   │   ├── decorators/      # Custom decorators
│   │   ├── filters/         # Exception filters
│   │   ├── interceptors/    # Request/response interceptors
│   │   └── pipes/           # Validation pipes
│   └── __tests__/           # Test setup and utilities
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/          # Migration history
│   └── seed.ts              # Seed data script
├── .env.example             # Environment variable template
├── Dockerfile               # Container definition
├── jest.config.js           # Jest configuration
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## GraphQL API

### Playground

In development, GraphQL Playground is available at:

http://localhost:9264/graphql

### Schema

The GraphQL schema is code-first using NestJS decorators. Type definitions are in `src/graphql/schema/`.

**Example Query**:

```graphql
query GetCampaign($id: ID!) {
  campaign(id: $id) {
    id
    name
    currentBranch {
      id
      name
    }
    worldTime {
      currentDate
      calendar
    }
  }
}
```

**Example Mutation**:

```graphql
mutation CreateSettlement($input: CreateSettlementInput!) {
  createSettlement(input: $input) {
    id
    name
    level
    population
  }
}
```

**Example Subscription**:

```graphql
subscription OnCampaignUpdate($campaignId: ID!) {
  campaignUpdated(campaignId: $campaignId) {
    id
    worldTime {
      currentDate
    }
  }
}
```

### Query Complexity

GraphQL queries are limited by complexity (max 1000) to prevent expensive operations. Use query batching and pagination for large result sets.

### DataLoader

The API uses DataLoader for batching and caching database queries to prevent N+1 query problems.

## Authentication

### JWT Tokens

The API uses JWT tokens for authentication:

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

### Login Flow

1. **Login**: `mutation login(email, password)` → returns `{ accessToken, refreshToken, user }`
2. **Authenticated Requests**: Include `Authorization: Bearer <accessToken>` header
3. **Token Refresh**: `mutation refreshToken(refreshToken)` → returns new `accessToken`
4. **Logout**: `mutation logout` → invalidates refresh token

### GraphQL Authentication

Use the `@UseGuards(JwtAuthGuard)` decorator on resolvers:

```typescript
@Query(() => User)
@UseGuards(JwtAuthGuard)
async me(@CurrentUser() user: User) {
  return user;
}
```

### Roles & Permissions

Role-based access control (RBAC) using custom decorators:

```typescript
@Mutation(() => Campaign)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'game_master')
async deleteCampaign(@Args('id') id: string) {
  // Only admins and game masters can delete campaigns
}
```

## Caching

Redis-based caching with `cache-manager`:

```typescript
@Injectable()
export class MyService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getData(id: string) {
    const cacheKey = `data:${id}`;

    // Try cache first
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // Fetch and cache
    const data = await this.database.fetchData(id);
    await this.cacheManager.set(cacheKey, data, 300); // 5 min TTL
    return data;
  }
}
```

### Cache Invalidation

Redis pub/sub is used for cache invalidation across instances:

```typescript
// Publish invalidation event
await this.redis.publish(
  'cache:invalidate',
  JSON.stringify({
    pattern: 'campaign:123:*',
  })
);
```

## Real-time Updates

### WebSocket (Socket.IO)

Socket.IO provides real-time updates to connected clients:

**Connect**:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:9264', {
  auth: {
    token: '<JWT token>',
  },
});
```

**Subscribe to Campaign Updates**:

```typescript
socket.emit('subscribe:campaign', { campaignId: '123' });

socket.on('campaign:worldTimeAdvanced', (data) => {
  console.log('World time changed:', data);
});
```

**Available Events**:

- `campaign:worldTimeAdvanced` - World time progressed
- `campaign:entityModified` - Entity created/updated/deleted
- `cache:invalidated` - Cache invalidation notification

### GraphQL Subscriptions

GraphQL subscriptions use the same WebSocket connection:

```graphql
subscription {
  campaignUpdated(campaignId: "123") {
    id
    worldTime {
      currentDate
    }
  }
}
```

## Rules Engine Integration

The API integrates with the `@campaign/rules-engine` microservice via gRPC for condition evaluation.

### gRPC Client

```typescript
@Injectable()
export class RulesEngineClient {
  async evaluateCondition(conditionId: string, context: any) {
    // Calls rules-engine via gRPC
    const response = await this.grpcClient.evaluateCondition({
      conditionId,
      context,
    });

    return response.result;
  }
}
```

### Fallback Strategy

If the rules-engine is unavailable, the API falls back to direct evaluation using `json-logic-js`.

## Rate Limiting

The API uses `@nestjs/throttler` for rate limiting:

- **Default**: 100 requests per minute per IP
- **GraphQL**: Custom limits per resolver

Exceeded limits return `429 Too Many Requests`.

## Error Handling

### Standard Error Responses

GraphQL errors follow the standard format:

```json
{
  "errors": [
    {
      "message": "Campaign not found",
      "extensions": {
        "code": "NOT_FOUND",
        "statusCode": 404
      }
    }
  ]
}
```

### Custom Exception Filters

Exception filters transform NestJS exceptions to GraphQL errors:

- `NotFoundException` → `NOT_FOUND`
- `ForbiddenException` → `FORBIDDEN`
- `UnauthorizedException` → `UNAUTHENTICATED`

## Health Checks

The API provides health check endpoints using `@nestjs/terminus`:

**GET /health**

Returns health status of all dependencies:

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "rulesEngine": { "status": "up" }
  }
}
```

**GET /health/live**

Basic liveness probe (always returns 200 if app is running)

**GET /health/ready**

Readiness probe (returns 503 if dependencies are unhealthy)

## Testing

### Unit Tests

```bash
# Run all tests
pnpm --filter @campaign/api test

# Watch mode
pnpm --filter @campaign/api test:watch

# Coverage
pnpm --filter @campaign/api test -- --coverage
```

### Integration Tests

Integration tests use an in-memory database and mock external services:

```typescript
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';

describe('CampaignResolver (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should create a campaign', async () => {
    const response = await request(app.getHttpServer()).post('/graphql').send({
      query: 'mutation { createCampaign(input: { name: "Test" }) { id } }',
    });

    expect(response.status).toBe(200);
  });
});
```

## Docker Deployment

### Building the Docker Image

```bash
# From project root
docker build -t campaign-api -f packages/api/Dockerfile .
```

The Dockerfile uses a multi-stage build:

1. **Builder stage**: Installs dependencies and builds TypeScript
2. **Production stage**: Minimal image with production dependencies only

### Running with Docker Compose

The service is included in the root `docker-compose.yml`:

```bash
# Start all services
docker compose up

# Start only API and dependencies
docker compose up postgres redis api
```

**Environment Variables for Docker**:

See `.env.local.example` in the project root for Docker-specific configuration.

**Exposed Ports**:

- `9264` - HTTP/GraphQL API
- `9239` - Node.js debugger (development mode only)

**Health Checks**:

The container includes a health check that monitors the liveness endpoint:

```yaml
healthcheck:
  test:
    ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:9264/health/live']
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 20s
```

**Dependencies**:

The service depends on:

- `postgres` - Database with PostGIS
- `redis` - Caching and pub/sub
- `rules-engine` - Condition evaluation (optional, graceful fallback)

## Performance Considerations

### Database Query Optimization

- **DataLoader**: Batches and caches database queries
- **Indexes**: Critical fields indexed (see Prisma schema)
- **Connection Pooling**: Prisma Client manages connection pool (default: 10)

### Caching Strategy

- **Cache-First**: Static data (event templates, settlement types)
- **Cache-and-Network**: Frequently changing data (campaigns, settlements)
- **No Cache**: Real-time data (world time, active effects)

### GraphQL Optimization

- **Query Complexity**: Prevents expensive queries (max 1000)
- **Field-Level Caching**: Computed fields cached for 5 minutes
- **Pagination**: All list queries support cursor-based pagination

## Development Guidelines

1. **Never change directories** - Run all commands from project root
2. **Use dependency injection** - All services injected via NestJS DI
3. **Type everything** - Strict TypeScript mode enabled
4. **Follow NestJS patterns** - Use modules, controllers, services, guards
5. **Write tests** - Unit tests for services, integration tests for resolvers
6. **Document GraphQL schema** - Add descriptions to all types and fields

See `/storage/programs/campaign_manager/CLAUDE.md` for complete development guidelines.

## Troubleshooting

### Dev server won't start

1. Check PostgreSQL is running: `psql -h localhost -U campaign_user -d campaign_db`
2. Check Redis is running: `redis-cli ping`
3. Verify environment variables in `.env`
4. Run migrations: `pnpm --filter @campaign/api prisma:migrate`
5. Regenerate Prisma client: `pnpm --filter @campaign/api prisma:generate`

### TypeScript errors

Use the TypeScript Fixer subagent - never fix manually.

### Database migration errors

1. Check database connection string
2. Ensure PostgreSQL user has CREATE/ALTER permissions
3. Check for conflicts with existing schema
4. Review migration SQL in `prisma/migrations/`

### GraphQL schema errors

1. Restart dev server to regenerate schema
2. Check for circular dependencies in resolvers
3. Verify all types are properly decorated with `@ObjectType()`, `@Field()`
4. Check GraphQL Playground for schema introspection errors

### Redis connection failures

1. Verify Redis is running: `redis-cli ping`
2. Check `REDIS_HOST` and `REDIS_PORT` environment variables
3. Test connection: `redis-cli -h localhost -p 6379 ping`

## Related Documentation

- **Project Documentation**:
  - [Root README](../../README.md) - Project overview and setup guide
  - [CLAUDE.md](../../CLAUDE.md) - Development guidelines and workflow

- **Feature Documentation** (in `../../docs/features/`):
  - [Condition System](../../docs/features/condition-system.md) - JSONLogic condition evaluation
  - [Effect System](../../docs/features/effect-system.md) - JSON Patch state mutations
  - [Dependency Graph System](../../docs/features/dependency-graph-system.md) - Entity relationship tracking
  - [World Time System](../../docs/features/world-time-system.md) - Campaign time tracking
  - [Branching System](../../docs/features/branching-system.md) - Alternate timeline management
  - [Event & Encounter Resolution](../../docs/features/event-encounter-resolution.md) - Resolution workflow
  - [Real-time Updates](../../docs/features/realtime-updates.md) - WebSocket and GraphQL subscriptions
  - [Rules Engine Worker](../../docs/features/rules-engine-worker.md) - gRPC condition evaluation service
  - [Scheduler Service](../../docs/features/scheduler-service.md) - Time-based operations service
  - [Audit System](../../docs/features/audit-system.md) - Audit logging and export

- **Development Documentation** (in `../../docs/development/`):
  - [Subagent Guide](../../docs/development/subagent-guide.md) - Specialized development agents
  - [Frontend Guide](../../docs/development/frontend-guide.md) - Frontend development patterns

- **Database Documentation** (in `../../docs/database/`):
  - [Polymorphic Relationships](../../docs/database/polymorphic-relationships.md) - Database schema patterns

- **Package Documentation**:
  - [Frontend Package](../frontend/README.md) - React frontend application
  - [Shared Package](../shared/README.md) - Shared types and utilities
  - [Rules Engine](../rules-engine/README.md) - Condition evaluation worker
  - [Scheduler](../scheduler/README.md) - Time-based operations worker

- **External Documentation**:
  - [Prisma Docs](https://www.prisma.io/docs/) - Database ORM reference
  - [NestJS Docs](https://docs.nestjs.com/) - Framework documentation
  - [GraphQL Docs](https://graphql.org/learn/) - GraphQL specification
  - [Apollo Server Docs](https://www.apollographql.com/docs/apollo-server/) - GraphQL server implementation

## License

[To be determined]
