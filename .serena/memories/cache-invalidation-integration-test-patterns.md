# Cache Invalidation Integration Test Patterns

## Overview

This document captures patterns for writing integration tests with real Redis and real Prisma database entities.

## File Locations & Patterns

### Integration Test Naming & Location

- **Pattern**: `*.integration.test.ts`
- **Location**: Colocated in source tree (e.g., `packages/api/src/graphql/services/settlement-structure-cache-invalidation.integration.test.ts`)
- **Not in separate directory**: Tests live alongside source code, not in `__tests__` directory

### Example Integration Test Files

1. `/storage/programs/campaign_manager/packages/api/src/graphql/services/settlement-structure-cache-invalidation.integration.test.ts` - Mocked services test
2. `/storage/programs/campaign_manager/packages/api/src/graphql/services/dependency-graph-cache-invalidation.integration.test.ts` - Mocked services test
3. `/storage/programs/campaign_manager/packages/api/src/graphql/services/entity-list-cache.integration.test.ts` - Real Redis test (currently skipped)
4. `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/tile-caching.integration.test.ts` - Real database + services test

## Test Pattern: Real Redis + Real Database

### Setup (from tile-caching.integration.test.ts)

```typescript
beforeAll(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [TileCacheService, PrismaService],
  }).compile();

  tileCacheService = module.get<TileCacheService>(TileCacheService);
  prisma = module.get<PrismaService>(PrismaService);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### Pre-Test Data Cleanup (beforeEach)

```typescript
beforeEach(async () => {
  // Create test user
  const user = await prisma.user.create({
    data: {
      email: 'cache-test@example.com',
      name: 'Cache Test User',
      password: 'hash',
    },
  });
  userId = user.id;

  // Create test world, campaign, branch
  const world = await prisma.world.create({
    data: {
      name: 'Cache Test World',
      calendars: {},
    },
  });

  // Clear cache before test
  tileCacheService.clear();
});
```

### Post-Test Cleanup (afterEach)

```typescript
afterEach(async () => {
  // Delete in dependency order (reverse of creation)
  await prisma.branch.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { worldId } });
  await prisma.location.deleteMany({ where: { worldId } });
  await prisma.world.delete({ where: { id: worldId } });
  await prisma.user.delete({ where: { id: userId } });

  // Clear cache after test
  tileCacheService.clear();
});
```

## Test Pattern: Real Redis Only

### Setup (from entity-list-cache.integration.test.ts)

```typescript
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

beforeAll(async () => {
  // Create Redis client for CacheService
  redisClient = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: 1, // Cache database (separate from DB 0 for pubsub)
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 50, 2000);
    },
  });

  // Create separate Redis client for test assertions
  testRedis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: 1,
  });

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      {
        provide: REDIS_CACHE,
        useValue: redisClient,
      },
      CacheService,
    ],
  }).compile();

  cacheService = module.get<CacheService>(CacheService);

  // Wait for Redis ready
  await redisClient.ping();
});
```

### Pre-Test Data Cleanup

```typescript
beforeEach(async () => {
  // Clear database before test for isolation
  await testRedis.flushdb();

  // Reset stats if testing metrics
  if ('resetStats' in cacheService) {
    cacheService.resetStats();
  }
});
```

### Post-Test Cleanup

```typescript
afterAll(async () => {
  await testRedis.flushdb();
  await redisClient.quit();
  await testRedis.quit();
});
```

## Test Pattern: Mocked Services (Unit-Level)

### Setup

- Create TestingModule with service and mocked dependencies
- Use `jest.spyOn()` on Prisma mocks to verify calls
- Don't use real Redis or database

Example:

```typescript
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SettlementService,
      {
        provide: PrismaService,
        useValue: {
          settlement: {
            findUnique: jest.fn(),
            update: jest.fn(),
          },
          // ... other mocked methods
        },
      },
      {
        provide: CacheService,
        useValue: {
          get: jest.fn(),
          set: jest.fn(),
          del: jest.fn(),
          delPattern: jest.fn(),
        },
      },
    ],
  }).compile();
});
```

## Redis Configuration

### Redis Provider (redis-cache.provider.ts)

- **Host**: `process.env.REDIS_HOST || 'localhost'`
- **Port**: `process.env.REDIS_PORT || '6379'`
- **Database**: `process.env.REDIS_CACHE_DB || '1'` (Cache uses DB 1, PubSub uses DB 0)
- **Key Prefix**: `'cache:'` (automatically added to all keys)
- **Connection Timeout**: 10000ms
- **Retry Strategy**: Exponential backoff, max 3 seconds

### Docker Compose Setup

Redis is configured in `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  ports:
    - '6379:6379'
  volumes:
    - redis-data:/data
```

### Running Redis for Tests

```bash
# Start Redis
docker-compose up -d redis

# Run integration tests (skipped by default)
pnpm --filter @campaign/api test

# Stop Redis
docker-compose down
```

## Database Configuration

### Prisma Setup

- **ORM**: Prisma
- **Database**: PostgreSQL with PostGIS
- **Configuration**: `DATABASE_URL` from `.env`
- **Service**: `PrismaService` handles connection

### Test Database Isolation

- Tests run serially (Jest maxWorkers: 1) to avoid conflicts
- Each test creates isolated test data
- Cleanup is critical: delete in reverse dependency order

## Cache Service API

### Key Methods for Testing

```typescript
// Get cached value
const value = await cache.get<T>(key);

// Set with optional TTL
await cache.set(key, value, { ttl: 300 });

// Delete single key
await cache.del(key);

// Delete by pattern
await cache.delPattern('pattern:*');

// Cascade invalidation (entity-specific)
await cache.invalidateSettlementCascade(settlementId, branchId);
await cache.invalidateStructureCascade(structureId, settlementId, branchId);
await cache.invalidateCampaignComputedFields(campaignId, branchId);

// Get statistics
const stats = cache.getStats();
```

## Key Patterns & Best Practices

### 1. Test Isolation

- Use `.skip` decorator to prevent auto-execution: `describe.skip('...', () => { ... })`
- Clear data before AND after each test
- Use separate Redis clients for operations and assertions

### 2. Cleanup Order

- Delete children before parents (foreign key constraints)
- Example order: structure → settlement → kingdom → campaign → world → user

### 3. Redis Database Selection

- DB 0: PubSub/messaging
- DB 1: Cache (with key prefix 'cache:')
- Configure via `REDIS_CACHE_DB` env var

### 4. Cache Key Patterns

```
computed-fields:{entity-type}:{id}:{branch}
settlements:kingdom:{kingdom-id}:{branch}
structures:settlement:{settlement-id}:{branch}
spatial:settlements-in-region:*:{branch}
```

### 5. TTL Testing

```typescript
// Test TTL expiration
const ttl = 2; // 2 seconds
await cache.set(key, value, ttl);
expect(await cache.get(key)).toEqual(value);
await new Promise((resolve) => setTimeout(resolve, 2100));
expect(await cache.get(key)).toBeNull();
```

### 6. Pattern Deletion Testing

```typescript
// Create multiple cache entries
await cache.set('computed-fields:settlement:1:main', data1, 600);
await cache.set('computed-fields:settlement:2:main', data2, 600);
await cache.set('computed-fields:structure:1:main', data3, 600);

// Delete by pattern
const result = await cache.delPattern('computed-fields:*:main');
expect(result.keysDeleted).toBeGreaterThan(0);
```

## Running Integration Tests

### Prerequisites

```bash
# Install dependencies
pnpm install

# Start Docker services
docker-compose up -d postgres redis

# (Optional) Create test database
pnpm --filter @campaign/api prisma migrate dev
```

### Running Tests

```bash
# All tests (skips marked with .skip)
pnpm run test

# Specific package
pnpm --filter @campaign/api test

# Watch mode for development
pnpm --filter @campaign/api test:watch

# With coverage
pnpm --filter @campaign/api test -- --coverage
```

### Cleanup

```bash
docker-compose down
```

## Jest Configuration (jest.config.js)

Key settings for integration tests:

```javascript
{
  testTimeout: 30000,  // 30s timeout for long-running tests
  maxWorkers: 1,       // Serial execution for database isolation
  testMatch: ['**/*.test.ts', '**/*.spec.ts']
}
```

## Conditional Test Skipping

For tests requiring Redis, use `.skip`:

```typescript
describe.skip('Entity List Cache Integration (Real Redis)', () => {
  // Test setup instructions in comment:
  // 1. Start Redis: docker-compose up -d redis
  // 2. Remove .skip from describe block
  // 3. Run: pnpm --filter @campaign/api test
  // 4. Cleanup: docker-compose down
});
```

Or check for Redis availability:

```typescript
beforeAll(async () => {
  const redis = new Redis({ host: 'localhost', port: 6379 });
  try {
    await redis.ping();
  } catch (e) {
    skip(); // Skip test if Redis unavailable
  }
});
```
