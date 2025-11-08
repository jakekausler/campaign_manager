# CacheService Test Patterns Research

## Overview

Comprehensive research of existing test patterns for CacheService and FieldConditionService in the campaign manager project. This covers unit test setup, mocking strategies, and cache invalidation testing patterns.

## Key Test Files

### API Package Cache Tests

- **Unit Tests**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.test.ts`
- **Integration Tests**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.integration.test.ts`
- **ConditionService Tests**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/condition.service.test.ts`

### Rules Engine Package Cache Tests

- **Unit Tests**: `/storage/programs/campaign_manager/packages/rules-engine/src/services/cache.service.test.ts`
- **Integration Tests**: `/storage/programs/campaign_manager/packages/rules-engine/src/services/cache-invalidation.integration.test.ts`

---

## Redis Mocking Pattern

### Mocking Strategy

The project uses **jest.fn() mocks** for Redis operations, NOT ioredis-mock. This provides fine-grained control over Redis behavior in unit tests.

### Mock Setup Code

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';
import { CacheService } from './cache.service';

let service: CacheService;
let redis: {
  get: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
  scan: jest.Mock;
};

beforeEach(async () => {
  process.env.CACHE_DEFAULT_TTL = '300';
  process.env.CACHE_METRICS_ENABLED = 'true';
  process.env.CACHE_LOGGING_ENABLED = 'false';

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CacheService,
      {
        provide: REDIS_CACHE,
        useValue: {
          get: jest.fn(),
          setex: jest.fn(),
          del: jest.fn(),
          scan: jest.fn(),
        },
      },
    ],
  }).compile();

  service = module.get<CacheService>(CacheService);
  redis = module.get(REDIS_CACHE);
});

afterEach(() => {
  jest.clearAllMocks();
});
```

---

## Cache Invalidation Test Patterns

### Pattern Deletion Testing

```typescript
describe('delPattern', () => {
  it('should delete all keys matching pattern', async () => {
    redis.scan.mockResolvedValue(['0', ['key1', 'key2', 'key3']]);
    redis.del.mockResolvedValue(3);

    const result = await service.delPattern('computed-fields:*');

    expect(result).toEqual({
      success: true,
      keysDeleted: 3,
    });
    expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'computed-fields:*', 'COUNT', 100);
    expect(redis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
  });

  it('should handle paginated SCAN results', async () => {
    redis.scan
      .mockResolvedValueOnce(['1', ['key1', 'key2']])
      .mockResolvedValueOnce(['2', ['key3', 'key4']])
      .mockResolvedValueOnce(['0', ['key5']]);
    redis.del.mockResolvedValueOnce(2).mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const result = await service.delPattern('*:main');

    expect(result).toEqual({
      success: true,
      keysDeleted: 5,
    });
    expect(redis.scan).toHaveBeenCalledTimes(3);
    expect(redis.del).toHaveBeenCalledTimes(3);
  });

  it('should return failure on Redis error', async () => {
    redis.scan.mockRejectedValue(new Error('Redis scan error'));

    const result = await service.delPattern('test-pattern:*');

    expect(result).toEqual({
      success: false,
      keysDeleted: 0,
      error: 'Redis scan error',
    });
  });
});
```

### Entity-Specific Invalidation

```typescript
it('should handle entity-specific patterns', async () => {
  redis.scan.mockResolvedValue([
    '0',
    ['computed-fields:settlement:123:main', 'spatial:settlement:123:main'],
  ]);
  redis.del.mockResolvedValue(2);

  const result = await service.delPattern('*:settlement:123:main');

  expect(result.success).toBe(true);
  expect(result.keysDeleted).toBe(2);
});
```

### Campaign-Wide Invalidation

```typescript
it('should invalidate all computed fields in campaign', async () => {
  // Set multiple computed fields
  redis.setex.mockResolvedValue('OK');
  await service.set('computed-fields:settlement:123:main', { value: 1 });
  await service.set('computed-fields:settlement:456:main', { value: 2 });
  await service.set('computed-fields:kingdom:789:main', { value: 3 });

  // Invalidate all computed fields
  redis.scan.mockResolvedValue([
    '0',
    [
      'computed-fields:settlement:123:main',
      'computed-fields:settlement:456:main',
      'computed-fields:kingdom:789:main',
    ],
  ]);
  redis.del.mockResolvedValue(3);

  const result = await service.delPattern('computed-fields:*');

  expect(result.success).toBe(true);
  expect(result.keysDeleted).toBe(3);
});
```

---

## FieldConditionService Dependency Injection Pattern

### Mock Dependencies

```typescript
const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'gm',
};

beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ConditionService,
      {
        provide: PrismaService,
        useValue: {
          fieldCondition: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
          },
          settlement: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
          },
          structure: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
          },
          kingdom: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
          },
          party: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
          },
          character: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
          },
        },
      },
      {
        provide: AuditService,
        useValue: {
          log: jest.fn(),
        },
      },
      {
        provide: ConditionEvaluationService,
        useValue: {
          validateExpression: jest.fn(),
          evaluateWithTrace: jest.fn(),
        },
      },
      {
        provide: DependencyGraphService,
        useValue: {
          invalidateCache: jest.fn(),
        },
      },
      {
        provide: 'REDIS_PUBSUB',
        useValue: {
          publish: jest.fn(),
        },
      },
    ],
  }).compile();

  service = module.get<ConditionService>(ConditionService);
  prisma = module.get<PrismaService>(PrismaService);
  audit = module.get<AuditService>(AuditService);
  evaluationService = module.get<ConditionEvaluationService>(ConditionEvaluationService);
});
```

---

## CacheService Method Patterns

### invalidateCampaignComputedFields

This is the key method for testing FieldCondition cache invalidation:

```typescript
async invalidateCampaignComputedFields(
  campaignId: string,
  branchId: string
): Promise<CacheDeleteResult> {
  try {
    let totalKeysDeleted = 0;

    // 1. Invalidate ALL settlement computed fields in the branch
    const settlementPattern = `computed-fields:settlement:*:${branchId}`;
    const settlementResult = await this.delPattern(settlementPattern);
    totalKeysDeleted += settlementResult.keysDeleted;

    // 2. Invalidate ALL structure computed fields in the branch
    const structurePattern = `computed-fields:structure:*:${branchId}`;
    const structureResult = await this.delPattern(structurePattern);
    totalKeysDeleted += structureResult.keysDeleted;

    this.logger.log(
      `Campaign computed fields invalidation: campaign=${campaignId}, branch=${branchId}, deleted=${totalKeysDeleted} keys`
    );

    return {
      success: true,
      keysDeleted: totalKeysDeleted,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Campaign computed fields invalidation failed for campaign=${campaignId}, branch=${branchId}: ${message}`
    );
    return {
      success: false,
      keysDeleted: 0,
      error: message,
    };
  }
}
```

---

## ConditionService Cache Integration

### Create Operation Cache Invalidation

In `condition.service.ts`, the `create()` method invalidates caches:

```typescript
async create(
  input: CreateFieldConditionInput,
  user: AuthenticatedUser
): Promise<PrismaFieldCondition> {
  // ... validation and creation logic ...

  // Invalidate dependency graph cache for this condition's campaign
  const campaignId = await this.getCampaignIdForCondition(condition);
  if (campaignId) {
    this.dependencyGraphService.invalidateGraph(campaignId);

    // Invalidate all computed fields in campaign (FieldCondition changes affect all entities)
    await this.cacheService.invalidateCampaignComputedFields(campaignId, 'main');

    // Publish Redis event for Rules Engine worker
    await this.pubSub.publish('condition.created', {
      conditionId: condition.id,
      campaignId,
      branchId: 'main',
    });
  }

  return condition;
}
```

---

## Test Structure Template

### Basic Unit Test Structure

```typescript
describe('ConditionService - Cache Invalidation', () => {
  let service: ConditionService;
  let prisma: PrismaService;
  let cacheService: CacheService;
  let dependencyGraphService: DependencyGraphService;
  let pubSub: RedisPubSub;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'gm',
  };

  const mockCondition = {
    id: 'condition-1',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    field: 'is_trade_hub',
    expression: { '>=': [{ var: 'settlement.population' }, 5000] },
    description: 'Check if settlement is a trade hub',
    isActive: true,
    priority: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: 'user-1',
    updatedBy: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionService,
        {
          provide: PrismaService,
          useValue: {
            fieldCondition: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            settlement: { findFirst: jest.fn() },
          },
        },
        {
          provide: CacheService,
          useValue: {
            invalidateCampaignComputedFields: jest.fn(),
          },
        },
        {
          provide: DependencyGraphService,
          useValue: {
            invalidateGraph: jest.fn(),
          },
        },
        {
          provide: 'REDIS_PUBSUB',
          useValue: { publish: jest.fn() },
        },
        // ... other services ...
      ],
    }).compile();

    service = module.get<ConditionService>(ConditionService);
    cacheService = module.get<CacheService>(CacheService);
    dependencyGraphService = module.get<DependencyGraphService>(DependencyGraphService);
    pubSub = module.get('REDIS_PUBSUB');
  });

  describe('create with cache invalidation', () => {
    it('should invalidate campaign computed fields when condition created', async () => {
      // Setup mocks
      (cacheService.invalidateCampaignComputedFields as jest.Mock).mockResolvedValue({
        success: true,
        keysDeleted: 10,
      });

      // Execute
      const result = await service.create(createInput, mockUser);

      // Assert
      expect(cacheService.invalidateCampaignComputedFields).toHaveBeenCalledWith(
        'campaign-1',
        'main'
      );
      expect(dependencyGraphService.invalidateGraph).toHaveBeenCalledWith('campaign-1');
    });
  });
});
```

---

## Graceful Degradation Patterns

CacheService implements graceful degradation - Redis failures don't break functionality:

```typescript
it('should continue operating after get failure', async () => {
  redis.get.mockRejectedValueOnce(new Error('Connection lost'));
  redis.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' }));

  const result1 = await service.get('key1');
  const result2 = await service.get('key2');

  expect(result1).toBeNull();
  expect(result2).toEqual({ data: 'test' });
});

it('should return failure result for delPattern errors', async () => {
  redis.scan.mockRejectedValue(new Error('Scan failed'));

  const result = await service.delPattern('pattern:*');

  expect(result.success).toBe(false);
  expect(result.keysDeleted).toBe(0);
  expect(result.error).toBe('Scan failed');
});
```

---

## Integration Test Patterns (Real Redis)

The project includes integration tests using real Redis. They're skipped by default but show real behavior:

```typescript
describe.skip('CacheService - Redis Integration', () => {
  // Tests use real Redis connections
  // Pattern deletion with real SCAN
  // TTL expiration testing
  // Concurrent operations
  // Bulk operations (250+ keys)
});
```

To run these tests:

```bash
docker-compose up -d redis
pnpm --filter @campaign/api test -- --testNamePattern="Redis Integration"
docker-compose down
```

---

## Key Metrics and Stats Tracking

```typescript
const stats = service.getStats();
// Returns:
{
  hits: number,
  misses: number,
  hitRate: number,        // Calculated: hits / (hits + misses)
  sets: number,
  deletes: number,
  patternDeletes: number,
  startTime: number,
  enabled: boolean
}
```

---

## Summary: Key Patterns for Your Test

When writing unit tests for "FieldCondition changes invalidating all computed fields":

1. **Mock CacheService** with `invalidateCampaignComputedFields` returning a success result
2. **Mock DependencyGraphService** with `invalidateGraph`
3. **Mock PubSub** with `publish`
4. **Test that ConditionService.create()** calls `cacheService.invalidateCampaignComputedFields(campaignId, 'main')`
5. **Test that the result** includes the invalidated key count
6. **Test error handling** when invalidation fails (graceful degradation)
7. **Test that cache invalidation happens** for CREATE, UPDATE, and DELETE operations on FieldCondition

### Cache Key Patterns to Test

- `computed-fields:settlement:*:${branchId}` - All settlement computed fields
- `computed-fields:structure:*:${branchId}` - All structure computed fields
- Verify both settlement AND structure fields are invalidated

### Error Scenarios

- Invalidation method throws error (should not break condition creation)
- Redis connection fails (graceful degradation)
- Partial failures (some patterns fail, others succeed)
