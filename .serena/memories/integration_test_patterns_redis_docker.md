# Integration Test Patterns for Redis + Docker-Compose

## Research Summary

This document consolidates integration test patterns for testing against real Redis in docker-compose, based on analysis of existing integration tests in the campaign_manager codebase.

---

## 1. Integration Test Location & Naming Convention

### Location

- **Pattern**: Colocated with source files OR in `/src` directories (not separate `__tests__` folder)
- **Naming**: `*.integration.test.ts` (NOT `.e2e.test.ts`)
- **Examples**:
  - `packages/api/src/graphql/resolvers/tile-caching.integration.test.ts`
  - `packages/api/src/common/services/spatial-queries.integration.test.ts`
  - `packages/rules-engine/src/services/redis-pub-sub.integration.test.ts`
  - `packages/rules-engine/src/services/cache-invalidation.integration.test.ts`

### Jest Configuration

- **File**: `packages/api/jest.config.js`
- **Relevant Settings**:
  ```javascript
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],  // *.integration.test.ts matched here
  testTimeout: 30000,  // 30 second timeout for integration tests
  maxWorkers: 1,  // Run serially to avoid database conflicts
  ```

---

## 2. Docker/Redis Integration Pattern

### Docker-Compose Configuration

**File**: `/storage/programs/campaign_manager/docker-compose.yml`

**Redis Service** (lines 44-60):

```yaml
redis:
  image: redis:7-alpine
  container_name: campaign_redis
  command: redis-server --appendonly yes
  volumes:
    - redis-data:/data
  ports:
    - '6379:6379'
  networks:
    - backend-network
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 10s
    timeout: 3s
    retries: 5
    start_period: 10s
```

### Environment-Based Connection

- **Variables Used**: `REDIS_HOST` and `REDIS_PORT`
- **Defaults**: `localhost:6379` (for local testing)
- **Docker**: Host is `redis` (docker-compose service name), port is `6379`
- **Pattern** (from existing code):
  ```typescript
  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
  ```

### Key Point About Services

**Integration tests do NOT assume services are pre-running.** Instead:

- Tests are **skipped by default** (`describe.skip()`) to avoid requiring Redis in CI
- Developers run tests locally with `docker-compose up` running
- Tests that need Docker services use `.skip()` and can be enabled for local testing

---

## 3. Test Setup Patterns

### BeforeAll/AfterAll for Real Services

**Example**: `redis-pub-sub.integration.test.ts`

```typescript
describe.skip('Redis Pub/Sub Integration', () => {
  let redisService: RedisService;
  let cacheService: CacheService;
  let publisherClient: Redis;

  // Connection setup
  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

  beforeAll(async () => {
    // Suppress logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    // Create publisher client (separate connection for testing)
    publisherClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
    });

    // Create real service instances
    cacheService = new CacheService();
    // ... other service setup

    // Initialize Redis subscriber
    await redisService.onModuleInit();

    // Wait for Redis to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Cleanup
    await redisService.onModuleDestroy();
    await publisherClient.quit();
  });

  beforeEach(() => {
    // Clear cache before each test
    cacheService.clear();
    jest.clearAllMocks();
  });
});
```

**Key Patterns**:

1. **Suppress Logger Output**: Mock Logger methods to reduce noise
2. **Separate Publisher Client**: Use separate Redis client for testing (not the service client)
3. **Initialize Services**: Call `onModuleInit()` after creating services
4. **Wait for Readiness**: Give Redis 100ms to be ready
5. **Clear Between Tests**: Reset cache state in `beforeEach()`
6. **Cleanup**: Properly disconnect in `afterAll()`

### Connection Pooling / Single Connection

**Pattern**: Single real Redis connection + separate test publisher

- CacheService uses its own injected Redis client
- Tests create a separate publisher client: `new Redis({ host, port })`
- This allows pub/sub testing (publish on test client, subscribe on service client)

### Database/Cache Cleanup

**Two-Level Cleanup**:

1. **Per-Test** (`beforeEach`): Clear cache: `cacheService.clear()`
2. **Final** (`afterAll`): Disconnect all connections

---

## 4. Environment Configuration

### Connection String Configuration

**No explicit connection strings for Redis** in this codebase. Instead:

1. Environment variables: `REDIS_HOST` and `REDIS_PORT`
2. Defaults: `localhost:6379`
3. Set via:
   - `.env` or `.env.local` files
   - Environment variables passed to tests
   - Docker-compose networking (service name `redis`)

### Test-Specific Configuration

**From existing patterns**:

```typescript
// Read from environment with defaults
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// Create client
const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
```

---

## 5. Integration Test Examples

### Example 1: Tile Caching Integration (PostgreSQL Focus)

**File**: `packages/api/src/graphql/resolvers/tile-caching.integration.test.ts`

```typescript
describe('Tile Caching Integration', () => {
  let prisma: PrismaService;
  let tileCacheService: TileCacheService;

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

  beforeEach(async () => {
    // Create test data
    const user = await prisma.user.create({ data: { ... } });
    const world = await prisma.world.create({ data: { ... } });

    // Clear cache
    tileCacheService.clear();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.branch.deleteMany({ where: { campaignId } });
    await prisma.campaign.deleteMany({ where: { worldId } });
    await prisma.world.delete({ where: { id: worldId } });
    await prisma.user.delete({ where: { id: userId } });

    // Clear cache
    tileCacheService.clear();
  });
});
```

**Pattern**: Uses NestJS TestingModule to inject dependencies

### Example 2: Redis Pub/Sub Integration

**File**: `packages/rules-engine/src/services/redis-pub-sub.integration.test.ts`

```typescript
describe.skip('Redis Pub/Sub Integration', () => {
  let publisherClient: Redis;

  beforeAll(async () => {
    publisherClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });

    // Initialize services
    await redisService.onModuleInit();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await redisService.onModuleDestroy();
    await publisherClient.quit();
  });

  it('should invalidate dependency graph when condition.created is published', async () => {
    const invalidateGraphSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

    const message = JSON.stringify({
      campaignId: 'campaign-123',
      branchId: 'main',
      entityId: 'condition-456',
      timestamp: new Date().toISOString(),
    });

    // Publish message
    await publisherClient.publish('condition.created', message);

    // Wait for message to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify dependency graph was invalidated
    expect(invalidateGraphSpy).toHaveBeenCalledWith('campaign-123', 'main');
  });
});
```

**Pattern**: Pub/Sub testing with real Redis publisher

### Example 3: Cache Invalidation Integration (In-Memory)

**File**: `packages/rules-engine/src/services/cache-invalidation.integration.test.ts`

```typescript
describe('Cache Invalidation Integration', () => {
  let cacheService: CacheService;
  let evaluationEngine: EvaluationEngineService;

  beforeEach(() => {
    // Create real service instances
    cacheService = new CacheService();
    graphBuilder = new DependencyGraphBuilderService();
    graphService = new DependencyGraphService(graphBuilder);
    evaluationEngine = new EvaluationEngineService(graphService, cacheService);
  });

  afterEach(async () => {
    // Clean up services
    cacheService.clear();
    cacheService.onModuleDestroy();
    graphService.clearAllCaches();
    await graphBuilder.onModuleDestroy();
    await evaluationEngine.onModuleDestroy();
  });

  it('should cache successful evaluation results', async () => {
    // Create condition
    const mockCondition = { ... };

    // First evaluation - caches result
    const result1 = await evaluationEngine.evaluateCondition(...);
    expect(result1.success).toBe(true);

    // Verify cache was populated
    const cached = cacheService.get({ campaignId, branchId, nodeId });
    expect(cached).toBeDefined();

    // Second evaluation - hits cache (no DB call)
    mockPrismaClient.fieldCondition.findUnique.mockClear();
    const result2 = await evaluationEngine.evaluateCondition(...);
    expect(mockPrismaClient.fieldCondition.findUnique).not.toHaveBeenCalled();
  });
});
```

**Pattern**: Real service instances with mocked dependencies

---

## 6. CI/CD Considerations

### Test Separation Strategy

**From jest.config.js**:

- Integration tests are **NOT run in CI by default**
- They're marked with `describe.skip()` to prevent failures when Docker is unavailable
- Developers enable them locally with `docker-compose up` running

### Running Integration Tests Locally

**Commands**:

```bash
# Start services in background
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Run integration tests (they'll be enabled)
# Option 1: Remove .skip() and run tests
pnpm --filter @campaign/api test -- --testNamePattern="Tile Caching Integration"

# Wait for cleanup
docker-compose down
```

### Why Tests Are Skipped by Default

1. **CI/CD Restrictions**: GitHub Actions runners may not have Docker
2. **Speed**: Unit tests run in < 1 second, integration tests take 10-30 seconds
3. **Clarity**: `.skip()` makes it explicit which tests need external services
4. **Safety**: Prevents test failures due to missing services

### Environment Variables for CI

Tests read from environment:

```typescript
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
```

This allows CI to set `REDIS_HOST=redis` when running in docker-compose context.

---

## 7. Concrete Example: What You Need for CacheService Integration Test

### File Location

**File**: `packages/api/src/common/cache/cache.service.integration.test.ts`

### Setup Pattern

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { REDIS_CACHE } from '../cache.module';

describe.skip('CacheService - Redis Integration', () => {
  let cacheService: CacheService;
  let redis: Redis;

  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
  const REDIS_DB = 1; // Cache uses DB 1 (same as production)

  beforeAll(async () => {
    // Create real Redis client for verification
    redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: REDIS_DB,
    });

    // Create NestJS test module with real Redis
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: REDIS_CACHE,
          useValue: redis, // Use real Redis client
        },
        CacheService,
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);

    // Wait for Redis connection
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Cleanup
    await redis.flushdb(); // Clear test database
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await redis.flushdb();
  });

  describe('basic operations', () => {
    it('should set and get a value', async () => {
      await cacheService.set('test-key', { data: 'value' }, { ttl: 300 });
      const result = await cacheService.get('test-key');
      expect(result).toEqual({ data: 'value' });
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete a key', async () => {
      await cacheService.set('test-key', 'value');
      const deleted = await cacheService.del('test-key');
      expect(deleted).toBe(1);

      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('should expire keys after TTL', async () => {
      await cacheService.set('expiring-key', 'value', { ttl: 1 });

      // Check immediately - should exist
      expect(await cacheService.get('expiring-key')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Check after TTL - should be gone
      expect(await cacheService.get('expiring-key')).toBeNull();
    });
  });

  describe('pattern deletion', () => {
    it('should delete keys matching pattern', async () => {
      await cacheService.set('computed-fields:settlement:1:main', 'data1');
      await cacheService.set('computed-fields:settlement:2:main', 'data2');
      await cacheService.set('computed-fields:kingdom:1:main', 'data3');
      await cacheService.set('other:key:value', 'data4');

      const result = await cacheService.delPattern('computed-fields:*');

      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(3);

      // Verify deletions
      expect(await cacheService.get('computed-fields:settlement:1:main')).toBeNull();
      expect(await cacheService.get('computed-fields:settlement:2:main')).toBeNull();
      expect(await cacheService.get('computed-fields:kingdom:1:main')).toBeNull();
      expect(await cacheService.get('other:key:value')).toBe('data4');
    });
  });

  describe('stats tracking', () => {
    it('should track hits and misses', async () => {
      await cacheService.set('tracked-key', 'value');

      // Hit
      await cacheService.get('tracked-key');

      // Miss
      await cacheService.get('non-existent-key');

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5, 1);
    });
  });
});
```

### Running the Test

```bash
# Start Redis
docker-compose up -d

# Remove .skip() from describe.skip() to enable the test

# Run the test
pnpm --filter @campaign/api test -- cache.service.integration.test.ts

# Cleanup
docker-compose down
```

---

## 8. Key Design Points for Your CacheService Integration Test

1. **Use Real Redis Client**
   - Create a separate Redis connection for assertions
   - Inject it into CacheService via `REDIS_CACHE` token

2. **Test Redis Database Specifically**
   - Use DB 1 (same as production cache)
   - Flush DB before/after tests: `redis.flushdb()`

3. **Verify TTL Actually Works**
   - Set key with short TTL (e.g., 1 second)
   - Wait for expiration
   - Verify key is gone (not just logically, but from Redis)

4. **Test Pattern Deletion**
   - Create keys with hierarchical names: `prefix:type:id:branch`
   - Verify correct number of keys deleted
   - Verify unrelated keys remain

5. **Track Stats Accurately**
   - Perform operations
   - Verify stats are incremented correctly
   - Check hit rate calculation

6. **Mark as .skip() for CI**
   - Keep test disabled by default: `describe.skip(...)`
   - Document prerequisites (Redis required)
   - Can be locally enabled by removing `.skip`

---

## Summary Table

| Aspect              | Pattern                               | Location              |
| ------------------- | ------------------------------------- | --------------------- |
| **Test Location**   | `*.integration.test.ts` in source dir | Colocated with source |
| **Jest Config**     | maxWorkers=1, testTimeout=30s         | jest.config.js        |
| **Docker Services** | Redis on localhost:6379               | docker-compose.yml    |
| **Env Variables**   | REDIS_HOST, REDIS_PORT                | .env.example          |
| **Test Isolation**  | describe.skip() by default            | Test file             |
| **Setup**           | beforeAll() with real connections     | Test suite            |
| **Cleanup**         | afterAll() with disconnect            | Test suite            |
| **Per-Test**        | beforeEach() clear cache              | Test suite            |
| **Pub/Sub**         | Separate publisher client             | Test setup            |
| **Database Clear**  | flushdb() for real Redis tests        | beforeEach/afterAll   |
| **Connection Wait** | setTimeout(resolve, 100ms)            | afterAll              |
