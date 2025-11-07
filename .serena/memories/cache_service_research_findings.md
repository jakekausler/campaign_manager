# Cache Service Implementation Research - Complete Findings

## 1. Existing Cache Implementations

### 1.1 ExpressionCache (`packages/api/src/rules/cache/expression-cache.ts`)

**Purpose**: LRU caching for parsed JSONLogic expressions  
**Location**: `/storage/programs/campaign_manager/packages/api/src/rules/cache/expression-cache.ts`

**Key Patterns**:

- **Decorator**: `@Injectable()` - NestJS service decorator
- **Constructor**: No dependencies injected (in-memory cache, no external services)
- **Factory Method**: Static `create(options)` method for testability
- **Memory Management**:
  - Uses JavaScript `Map` for O(1) operations
  - Manual LRU eviction by delete + re-insert to end
  - Bounded size with `maxSize` property (default 100)
- **Stats Tracking**: Tracks hits, misses, and hit rate
- **Error Handling**: Validates `maxSize > 0` in factory method

**Code Example**:

```typescript
@Injectable()
export class ExpressionCache {
  private cache: Map<string, Expression> = new Map();
  private maxSize: number = 100;
  private hits: number = 0;
  private misses: number = 0;

  static create(options: ExpressionCacheOptions = {}): ExpressionCache {
    const cache = new ExpressionCache();
    cache.maxSize = options.maxSize ?? 100;
    if (cache.maxSize <= 0) {
      throw new Error('maxSize must be positive');
    }
    return cache;
  }

  get(key: string): Expression | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hits++;
      this.cache.delete(key);
      this.cache.set(key, value); // Move to end
      return value;
    }
    this.misses++;
    return undefined;
  }

  getStats(): CacheStats {
    const totalAccesses = this.hits + this.misses;
    const hitRate = totalAccesses > 0 ? this.hits / totalAccesses : 0;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }
}
```

### 1.2 TileCacheService (`packages/api/src/common/services/tile-cache.service.ts`)

**Purpose**: In-memory caching for GeoJSON map tiles  
**Location**: `/storage/programs/campaign_manager/packages/api/src/common/services/tile-cache.service.ts`

**Key Patterns**:

- **Decorator**: `@Injectable()` for NestJS DI
- **Constructor**: No dependencies (in-memory only)
- **Simple Map-based Storage**: No size limits or TTL (noted as limitation)
- **Key Generation**: `generateTileKey()` method creates hierarchical keys
- **Namespace Invalidation**: `invalidateWorld()` prefix-based deletion
- **Stats**: Simple `CacheStats` with size and keys list

**Code Example**:

```typescript
@Injectable()
export class TileCacheService {
  private cache: Map<string, GeoJSONFeatureCollection> = new Map();

  generateTileKey(worldId: string, bbox: BoundingBox, filters?: MapFilters): string {
    const w = bbox.west.toFixed(6);
    const s = bbox.south.toFixed(6);
    const e = bbox.east.toFixed(6);
    const n = bbox.north.toFixed(6);

    let key = `world:${worldId}:bbox:${w},${s},${e},${n}`;
    if (filters) {
      const filterStr = JSON.stringify(filters);
      key += `:filters:${filterStr}`;
    }
    return key;
  }

  invalidateWorld(worldId: string): void {
    const prefix = `world:${worldId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): CacheStats {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
```

---

## 2. Redis Provider Pattern

### 2.1 Redis Cache Provider (`packages/api/src/graphql/cache/redis-cache.provider.ts`)

**Location**: `/storage/programs/campaign_manager/packages/api/src/graphql/cache/redis-cache.provider.ts`

**Key Patterns**:

- **Function-based Provider**: `createRedisCache()` factory function (not a class)
- **Configuration from Environment**:
  ```typescript
  const options: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_CACHE_DB || '1', 10), // DB 1 for cache, DB 0 for pubsub
    retryStrategy: (times: number) => Math.min(times * 50, 3000), // Exponential backoff
    connectTimeout: 10000,
    enableOfflineQueue: true, // Buffer commands when disconnected
    reconnectOnError: (err: Error) => err.message.includes('READONLY'),
    keyPrefix: 'cache:', // Namespace all cache keys
  };
  ```
- **Event Logging**: Listens to 'error', 'connect', 'ready' events
- **Injection Token**: Exported `REDIS_CACHE` constant for DI

**Code Example**:

```typescript
export function createRedisCache(): Redis {
  const options: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_CACHE_DB || '1', 10),
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 3000);
      return delay;
    },
    connectTimeout: 10000,
    enableOfflineQueue: true,
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true; // Reconnect on READONLY errors
      }
      return false;
    },
    keyPrefix: 'cache:',
  };

  const redis = new Redis(options);

  redis.on('error', (err) => {
    console.error('Redis Cache Error:', err.message);
  });
  redis.on('connect', () => {
    console.log('Redis Cache connected');
  });
  redis.on('ready', () => {
    console.log('Redis Cache ready');
  });

  return redis;
}

export const REDIS_CACHE = 'REDIS_CACHE';
```

---

## 3. Cache Type Definitions

### 3.1 Cache Types (`packages/api/src/common/cache/cache.types.ts`)

**Location**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.types.ts`

**Interfaces Defined**:

```typescript
export interface CacheOptions {
  ttl?: number; // Default: 300 seconds
  trackMetrics?: boolean; // Default: true
  enableLogging?: boolean; // Default: false
}

export interface CacheKeyParams {
  prefix: string; // Required - namespace (e.g., 'computed-fields')
  entityType?: string; // Optional - entity type
  entityId?: string; // Optional - entity ID
  branchId: string; // Required - branch identifier (for timeline support)
  additionalSegments?: string[]; // Optional - extra segments (spatial queries, etc.)
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  sets: number;
  deletes: number;
  patternDeletes: number;
  startTime: Date;
  enabled: boolean;
}

export interface CacheDeleteResult {
  success: boolean;
  keysDeleted: number;
  error?: string;
}
```

### 3.2 Cache Key Builder (`packages/api/src/common/cache/cache-key.builder.ts`)

**Location**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache-key.builder.ts`

**Helper Functions**:

- `buildCacheKey(params)` - Creates hierarchical keys: `prefix:entityType:entityId:additionalSegments:branchId`
- `buildPrefixPattern(prefix)` - Creates wildcard pattern: `prefix:*`
- `buildEntityPattern(entityType, entityId, branchId)` - Pattern: `*:entityType:entityId:branchId`
- `buildBranchPattern(branchId)` - Pattern: `*:branchId`
- `buildComputedFieldsKey()` - Convenience for most common use case
- `buildEntityListKey()` - For caching child entity lists
- `buildSpatialQueryKey()` - For spatial query result caching
- `parseCacheKey(key)` - Parses key back into components

**Key Insight**: Branch ID always comes LAST to enable branch-level invalidation

---

## 4. Service Pattern Structure

### 4.1 Service Constructor Injection (from `ConditionService`)

**Location**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/condition.service.ts`

**Pattern**:

```typescript
@Injectable()
export class ConditionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly evaluationService: ConditionEvaluationService,
    private readonly dependencyGraphService: DependencyGraphService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}
}
```

**Key Observations**:

- Using `@Inject()` decorator for token-based providers (like Redis)
- Using direct class injection for NestJS services
- All dependencies marked `readonly` to prevent reassignment
- Private access modifier for all injected dependencies

### 4.2 Module Provider Pattern (from `GraphQLCoreModule`)

**Location**: `/storage/programs/campaign_manager/packages/api/src/graphql/graphql-core.module.ts`

**Pattern for Token-based Providers**:

```typescript
@Module({
  providers: [
    {
      provide: REDIS_PUBSUB,
      useFactory: createRedisPubSub,
    },
    {
      provide: REDIS_CACHE,
      useFactory: createRedisCache,
    },
    // Regular service classes
    AuditService,
    BranchService,
    // ... more services
  ],
  exports: [
    // Export both tokens and services
    REDIS_PUBSUB,
    REDIS_CACHE,
    AuditService,
    // ... more services
  ],
})
export class GraphQLCoreModule {}
```

### 4.3 Rules Module Pattern

**Location**: `/storage/programs/campaign_manager/packages/api/src/rules/rules.module.ts`

```typescript
@Module({
  providers: [ExpressionParserService, OperatorRegistry, ExpressionCache],
  exports: [ExpressionParserService, OperatorRegistry, ExpressionCache],
})
export class RulesModule {}
```

---

## 5. Error Handling Patterns

### 5.1 Graceful Degradation (Redis)

From `redis-cache.provider.ts`:

```typescript
reconnectOnError: (err: Error) => {
  const targetError = 'READONLY';
  if (err.message.includes(targetError)) {
    return true; // Reconnect on READONLY errors
  }
  return false; // Don't reconnect for other errors
},
enableOfflineQueue: true, // Buffer commands when disconnected
```

### 5.2 Validation with Clear Messages

From `ExpressionCache.create()`:

```typescript
if (cache.maxSize <= 0) {
  throw new Error('maxSize must be positive');
}
```

### 5.3 Service-level Error Handling

From `ConditionService`:

```typescript
if (!validationResult.isValid) {
  throw new BadRequestException(`Invalid expression: ${validationResult.errors.join(', ')}`);
}
```

---

## 6. Testing Patterns

### 6.1 Unit Test Structure (ExpressionCache)

**File**: `/storage/programs/campaign_manager/packages/api/src/rules/cache/expression-cache.test.ts`

```typescript
describe('ExpressionCache', () => {
  let cache: ExpressionCache;

  beforeEach(() => {
    cache = ExpressionCache.create({ maxSize: 3 });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same expression', () => {
      const expr: Expression = { '==': [{ var: 'x' }, 10] };
      const key1 = cache.generateKey(expr);
      const key2 = cache.generateKey(expr);
      expect(key1).toBe(key2);
    });
  });

  describe('get and set', () => {
    it('should return undefined for non-existent key', () => {
      const expr: Expression = { '==': [{ var: 'x' }, 10] };
      const key = cache.generateKey(expr);
      const result = cache.get(key);
      expect(result).toBeUndefined();
    });

    it('should cache and retrieve expression', () => {
      const expr: Expression = { '==': [{ var: 'x' }, 10] };
      const key = cache.generateKey(expr);
      cache.set(key, expr);
      const cached = cache.get(key);
      expect(cached).toEqual(expr);
    });
  });
});
```

**Key Patterns**:

- Factory method used for test setup (`ExpressionCache.create()`)
- Separate test groups with `describe()` blocks
- Simple assertions using `expect()`
- One primary behavior per test

---

## 7. Key Design Decisions

### Cache Key Structure (Critical for Consistency)

**Pattern**: `prefix:entityType?:entityId?:additionalSegments:branchId`

- **Why this order?**: branchId comes last to enable prefix-based branch invalidation
- **Example**: `computed-fields:settlement:123:main`
- **Wildcard Support**: Redis SCAN patterns like `computed-fields:settlement:123:main:*` won't work but `*:settlement:123:main` will

### Separation of Concerns

- **Cache types** in `cache.types.ts` - Shared interfaces
- **Cache utilities** in `cache-key.builder.ts` - Key generation logic
- **Redis provider** in `redis-cache.provider.ts` - Connection management
- **Services** in `services/` - Business logic with injected cache

### Redis Configuration Highlights

- **Database Separation**: Cache uses DB 1, PubSub uses DB 0
- **Offline Queue**: Enabled to buffer commands during disconnection
- **Key Prefix**: All cache keys prefixed with `cache:` for Redis isolation
- **Exponential Backoff**: Retry strategy with 3-second max delay

---

## 8. Location Summary for Reference

| Component           | File Path                                                | Type                        |
| ------------------- | -------------------------------------------------------- | --------------------------- |
| ExpressionCache     | `packages/api/src/rules/cache/expression-cache.ts`       | In-memory LRU cache         |
| TileCacheService    | `packages/api/src/common/services/tile-cache.service.ts` | In-memory simple cache      |
| Redis Provider      | `packages/api/src/graphql/cache/redis-cache.provider.ts` | Redis client factory        |
| Cache Types         | `packages/api/src/common/cache/cache.types.ts`           | TypeScript interfaces       |
| Cache Key Builder   | `packages/api/src/common/cache/cache-key.builder.ts`     | Key generation utilities    |
| GraphQL Core Module | `packages/api/src/graphql/graphql-core.module.ts`        | Module with Redis providers |
| Rules Module        | `packages/api/src/rules/rules.module.ts`                 | Module with ExpressionCache |

---

## 9. Codebase Conventions Summary

### Naming

- Services: `*Service` suffix (e.g., `ConditionService`)
- Cache services: `*CacheService` or cache class without suffix (e.g., `ExpressionCache`)
- Providers: Factory function (e.g., `createRedisCache`) + injection token (e.g., `REDIS_CACHE`)
- Types/Interfaces: `*Options`, `*Params`, `*Stats`, `*Result` suffixes

### Structure

- Type definitions in dedicated `cache.types.ts` file or colocated with service
- Key generation utilities in separate builder file
- Redis connection management as factory function
- Service classes use `@Injectable()` decorator

### Error Handling

- Throw specific NestJS exceptions (BadRequestException, NotFoundException)
- Validate inputs with clear error messages
- Log connection events for debugging
- Enable graceful degradation with offline queue

### Testing

- Factory methods for flexible test setup
- Separate describe blocks for different features
- Clear, behavior-focused test names
- One assertion per test when possible
