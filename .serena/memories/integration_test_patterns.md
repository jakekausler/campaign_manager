# Integration Test Patterns - Campaign Manager

## Overview

This document captures integration test patterns found in the campaign_manager codebase, with focus on:

1. Redis-based integration tests
2. NestJS testing module setup
3. Cache service testing
4. Database integration patterns

---

## File Locations

### Integration Tests with Real Redis

- `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.integration.test.ts` - Core Redis cache integration tests
- `/storage/programs/campaign_manager/packages/rules-engine/src/services/cache-invalidation.integration.test.ts` - Cache invalidation tests (in-memory mock)
- `/storage/programs/campaign_manager/packages/api/src/graphql/services/settlement-structure-cache-invalidation.integration.test.ts` - Settlement/Structure cache tests (mocked)
- `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/tile-caching.integration.test.ts` - Tile cache integration with real DB

### Cache-Related Files

- Provider: `/storage/programs/campaign_manager/packages/api/src/graphql/cache/redis-cache.provider.ts`
- Service: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.ts`

### Docker Configuration

- Base: `/storage/programs/campaign_manager/docker-compose.yml`
- Dev Overrides: `/storage/programs/campaign_manager/docker-compose.dev.yml`

---

## Redis Setup for Integration Tests

### Docker Configuration (docker-compose.yml)

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
  restart: unless-stopped
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 10s
    timeout: 3s
    retries: 5
    start_period: 10s
```

### Development Setup Steps

1. Start Redis: `docker-compose up -d redis`
2. Remove `.skip` from test describe block
3. Run tests: `pnpm --filter @campaign/api test`
4. Cleanup: `docker-compose down`

### Environment Variables for Tests

```typescript
CACHE_DEFAULT_TTL = '300'
CACHE_METRICS_ENABLED = 'true'
CACHE_LOGGING_ENABLED = 'false'
REDIS_HOST = 'localhost' (from env or default)
REDIS_PORT = '6379' (from env or default)
REDIS_CACHE_DB = '1'  // Uses DB 1 for cache (DB 0 for pub/sub)
```

---

## Real Redis Integration Test Pattern

### From: cache.service.integration.test.ts

#### Setup Pattern

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';
import { CacheService } from './cache.service';

describe.skip('CacheService - Redis Integration', () => {
  let cacheService: CacheService;
  let redisClient: Redis;
  let testRedis: Redis; // Separate client for test assertions

  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

  beforeAll(async () => {
    // Set environment variables for CacheService
    process.env.CACHE_DEFAULT_TTL = '300';
    process.env.CACHE_METRICS_ENABLED = 'true';
    process.env.CACHE_LOGGING_ENABLED = 'false';

    // Create REAL Redis connection (used by CacheService)
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: 1, // Use DB 1 for cache
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 50, 2000);
      },
    });

    // Create separate Redis client for test assertions
    testRedis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: 1,
    });

    // Create test module with real Redis client
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

    // Wait for Redis to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Clean up all test data
    await testRedis.flushdb();

    // Disconnect both clients
    await redisClient.quit();
    await testRedis.quit();
  });

  beforeEach(async () => {
    // Clear database before each test for isolation
    await testRedis.flushdb();

    // Reset stats
    cacheService.resetStats();
  });
});
```

---

## Test Patterns

### Basic Operations

```typescript
describe('Basic Operations', () => {
  it('should set and get a value', async () => {
    const testData = { id: 123, name: 'Test Settlement' };

    await cacheService.set('test-key', testData);
    const result = await cacheService.get<typeof testData>('test-key');

    expect(result).toEqual(testData);
  });

  it('should return null for non-existent key', async () => {
    const result = await cacheService.get('non-existent-key');
    expect(result).toBeNull();
  });

  it('should delete a key', async () => {
    await cacheService.set('test-key', { data: 'value' });
    const deleteCount = await cacheService.del('test-key');
    expect(deleteCount).toBe(1);

    const result = await cacheService.get('test-key');
    expect(result).toBeNull();
  });

  it('should handle complex nested objects', async () => {
    const complexData = {
      settlement: {
        id: 456,
        name: 'Complex Settlement',
        structures: [{ id: 1, type: 'building', coordinates: { x: 10, y: 20 } }],
      },
      metadata: {
        computed: true,
        timestamp: new Date().toISOString(),
        tags: ['test', 'integration'],
      },
    };

    await cacheService.set('complex-key', complexData);
    const result = await cacheService.get('complex-key');
    expect(result).toEqual(complexData);
  });
});
```

### TTL Expiration Tests

```typescript
describe('TTL Expiration', () => {
  it('should expire key after TTL seconds', async () => {
    await cacheService.set('expiring-key', { data: 'will expire' }, { ttl: 1 });

    let result = await cacheService.get('expiring-key');
    expect(result).toEqual({ data: 'will expire' });

    // Wait for expiration (1 second + buffer)
    await new Promise((resolve) => setTimeout(resolve, 1200));

    result = await cacheService.get('expiring-key');
    expect(result).toBeNull();
  });

  it('should use default TTL when not specified', async () => {
    await cacheService.set('default-ttl-key', { data: 'test' });

    // Verify TTL is set on key in Redis
    const ttl = await testRedis.ttl('default-ttl-key');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300); // Default TTL from env
  });
});
```

### Pattern Deletion Tests

```typescript
describe('Pattern Deletion', () => {
  it('should delete all keys matching a pattern', async () => {
    // Set multiple keys with same prefix
    await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
    await cacheService.set('computed-fields:settlement:2:main', { id: 2 });
    await cacheService.set('computed-fields:kingdom:3:main', { id: 3 });
    await cacheService.set('other:settlement:4:main', { id: 4 });

    // Delete all computed-fields keys
    const result = await cacheService.delPattern('computed-fields:*');

    expect(result.success).toBe(true);
    expect(result.keysDeleted).toBe(3);

    // Verify computed-fields keys are gone
    expect(await cacheService.get('computed-fields:settlement:1:main')).toBeNull();
    expect(await cacheService.get('other:settlement:4:main')).toEqual({ id: 4 });
  });

  it('should handle large pattern deletion (pagination)', async () => {
    // Create 250 keys (more than SCAN COUNT=100)
    const promises = [];
    for (let i = 0; i < 250; i++) {
      promises.push(cacheService.set(`bulk:key:${i}:main`, { index: i }));
    }
    await Promise.all(promises);

    // Delete all with pattern
    const result = await cacheService.delPattern('bulk:*');

    expect(result.success).toBe(true);
    expect(result.keysDeleted).toBe(250);
  });
});
```

### Stats Tracking Tests

```typescript
describe('Stats Tracking', () => {
  it('should track cache hits and misses', async () => {
    await cacheService.set('key1', { data: 'value1' });
    await cacheService.set('key2', { data: 'value2' });

    // 2 hits
    await cacheService.get('key1');
    await cacheService.get('key2');

    // 1 miss
    await cacheService.get('non-existent');

    const stats = cacheService.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.667, 2); // 2/3
  });

  it('should reset stats correctly', async () => {
    await cacheService.set('key1', { data: 'value' });
    await cacheService.get('key1');
    await cacheService.del('key1');

    cacheService.resetStats();

    const stats = cacheService.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.sets).toBe(0);
    expect(stats.deletes).toBe(0);
    expect(stats.hitRate).toBe(0);
  });
});
```

---

## In-Memory Cache Testing Pattern (for unit tests)

### From: cache-invalidation.integration.test.ts

This pattern uses an in-memory cache with mocked dependencies:

```typescript
describe('Cache Invalidation Integration', () => {
  let cacheService: CacheService;
  let evaluationEngine: EvaluationEngineService;

  beforeEach(() => {
    // Reset environment variables for consistent test behavior
    delete process.env.CACHE_TTL_SECONDS;
    delete process.env.CACHE_CHECK_PERIOD_SECONDS;
    delete process.env.CACHE_MAX_KEYS;

    // Create service instances (no NestJS module needed for unit tests)
    cacheService = new CacheService();
    evaluationEngine = new EvaluationEngineService(graphService, cacheService);
  });

  afterEach(async () => {
    // Clean up services
    cacheService.clear();
    cacheService.onModuleDestroy();
    await evaluationEngine.onModuleDestroy();
  });
});
```

---

## Database Integration Test Pattern

### From: tile-caching.integration.test.ts

Pattern for tests that use real database:

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
    // Create test user (needed for campaign ownerId)
    const user = await prisma.user.create({
      data: {
        email: 'cache-test@example.com',
        name: 'Cache Test User',
        password: 'hash',
      },
    });
    userId = user.id;

    // Create test world, campaign, and branch
    const world = await prisma.world.create({
      data: {
        name: 'Cache Test World',
        calendars: {},
      },
    });
    worldId = world.id;

    const campaign = await prisma.campaign.create({
      data: {
        worldId,
        name: 'Cache Test Campaign',
        ownerId: userId,
        srid: 3857,
      },
    });
    campaignId = campaign.id;

    await prisma.branch.create({
      data: {
        campaignId,
        name: 'main',
      },
    });

    // Clear cache before each test
    tileCacheService.clear();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.branch.deleteMany({ where: { campaignId } });
    await prisma.campaign.deleteMany({ where: { worldId } });
    await prisma.location.deleteMany({ where: { worldId } });
    await prisma.world.delete({ where: { id: worldId } });
    await prisma.user.delete({ where: { id: userId } });

    // Clear cache after each test
    tileCacheService.clear();
  });
});
```

---

## NestJS Mocked Service Pattern

### From: settlement-structure-cache-invalidation.integration.test.ts

Pattern for testing with mocked services:

```typescript
describe('Settlement & Structure Cache Invalidation Integration Tests', () => {
  let settlementService: SettlementService;
  let structureService: StructureService;
  let dependencyGraphService: DependencyGraphService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        StructureService,
        DependencyGraphService,
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: VersionService,
          useValue: {
            createVersion: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            settlement: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            structure: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            kingdom: {
              findUnique: jest.fn(),
            },
            campaign: {
              findFirst: jest.fn(),
            },
            branch: {
              findFirst: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prismaService)),
          },
        },
      ],
    }).compile();

    settlementService = module.get<SettlementService>(SettlementService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should invalidate dependency graph cache when updating a settlement', async () => {
    // Arrange - mock data setup
    const settlementWithKingdom: SettlementWithKingdom = {
      ...existingSettlement,
      kingdom: {
        id: kingdomId,
        campaignId,
      },
    };

    jest.spyOn(prismaService.settlement, 'findFirst').mockResolvedValue(existingSettlement);
    jest.spyOn(prismaService.settlement, 'findUnique').mockResolvedValue(settlementWithKingdom);
    jest.spyOn(prismaService.settlement, 'update').mockResolvedValue(updatedSettlement);

    const invalidateSpy = jest.spyOn(dependencyGraphService, 'invalidateGraph');

    // Act
    await settlementService.update(
      settlementId,
      { level: 4 },
      mockUser,
      0, // expectedVersion
      branchId
    );

    // Assert
    expect(invalidateSpy).toHaveBeenCalledWith(campaignId, branchId);
  });
});
```

---

## Key Patterns Summary

### Test Structure

1. **describe.skip()** - Skip by default (requires manual Redis setup)
2. **beforeAll()** - Module setup, Redis clients
3. **afterAll()** - Cleanup and disconnection
4. **beforeEach()** - Clear database/cache for isolation
5. **afterEach()** - Cleanup

### Redis Client Management

- **redisClient** - Used by service under test
- **testRedis** - Separate client for assertions/cleanup
- Both use same DB (typically DB 1 for cache)

### Cleanup Strategy

- `flushdb()` - Clear entire database
- `quit()` - Gracefully disconnect
- Reset stats with `resetStats()`

### Key Naming Pattern

```
cache:computed-fields:settlement:123:main
cache:settlements:kingdom:456:main
cache:spatial:settlement:123:main
```

### Real-World Scenarios Tested

- Cache miss, fetch, set, hit workflow
- Bulk invalidation workflow
- Concurrent operations
- Persistence between service instances
- TTL expiration behavior
- Pattern-based deletion with pagination

---

## Important Notes

1. **Tests are .skip by default** - Tests with real Redis are disabled by default to avoid CI complexity
2. **Docker required** - Must have docker-compose running with Redis service
3. **Database isolation** - Tests clear cache and database before/after each test
4. **Separate clients** - One for service, one for assertions (prevents test interference)
5. **Graceful degradation** - Cache service logs errors but doesn't throw (fail-open pattern)
6. **Pattern deletion uses SCAN** - For large key sets, pagination with SCAN COUNT=100
7. **Environment-based config** - TTL, metrics, logging all configurable via env vars
