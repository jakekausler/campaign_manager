# Cache Stats Service - Implementation Patterns

## Overview

Research findings for creating CacheStatsService to track cache hits, misses, and invalidations.

## Service Structure Patterns

### From cache.service.ts (Core Pattern)

```typescript
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;
  private readonly metricsEnabled: boolean;
  private readonly loggingEnabled: boolean;

  // Stats tracking
  private stats: CacheStats = {
    /* ... */
  };

  constructor(@Inject(REDIS_CACHE) private readonly redis: Redis) {
    // Load environment variables
    this.defaultTtl = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10);
    this.metricsEnabled = process.env.CACHE_METRICS_ENABLED !== 'false';
    this.loggingEnabled = process.env.CACHE_LOGGING_ENABLED === 'true';

    this.logger.log(`Service initialized...`);
  }
}
```

### From spatial.service.ts (Service Dependency Pattern)

```typescript
@Injectable()
export class SpatialService {
  private readonly logger = new Logger(SpatialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService
  ) {}
}
```

## Key Patterns to Follow

### 1. NestJS Decorators & Logging

- Use `@Injectable()` decorator for NestJS dependency injection
- Create logger with: `new Logger(ClassName.name)`
- Logger is used for info/debug/warn/error logging

### 2. Dependency Injection

- Inject dependencies in constructor with `private readonly` pattern
- Use `@Inject(TOKEN)` decorator for non-standard providers (like REDIS_CACHE)
- Follow: `constructor(private readonly serviceName: ServiceType) {}`

### 3. Configuration from Environment

- Load config in constructor from `process.env`
- Use fallback defaults with `||` operator
- Log configuration at service initialization time

### 4. Stats Structure (from cache.types.ts)

Current CacheStats interface tracks:

```typescript
export interface CacheStats {
  hits: number; // Cache hit operations
  misses: number; // Cache miss operations
  hitRate: number; // Calculated: hits / (hits + misses)
  sets: number; // Set operations
  deletes: number; // Individual key deletions
  patternDeletes: number; // Pattern-based invalidations
  startTime: number; // Timestamp when tracking started (ms)
  enabled: boolean; // Whether metrics are enabled
}
```

### 5. Private Stats Tracking Methods

Cache service uses private methods for atomic updates:

```typescript
private incrementHits(): void {
  if (this.metricsEnabled) {
    this.stats.hits++;
  }
}

private incrementMisses(): void {
  if (this.metricsEnabled) {
    this.stats.misses++;
  }
}
```

### 6. Stats Retrieval with Calculation

```typescript
getStats(): CacheStats {
  // Calculate current hit rate
  const total = this.stats.hits + this.stats.misses;
  const hitRate = total > 0 ? this.stats.hits / total : 0;

  return {
    ...this.stats,
    hitRate,
  };
}
```

### 7. Stats Reset Method

```typescript
resetStats(): void {
  this.stats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    sets: 0,
    deletes: 0,
    patternDeletes: 0,
    startTime: Date.now(),
    enabled: this.metricsEnabled,
  };

  if (this.loggingEnabled) {
    this.logger.debug('Cache stats reset');
  }
}
```

## CacheStatsService Specific Design

### Purpose

A dedicated service to:

1. Track invalidation metrics separately from cache operations
2. Provide detailed stats on cascade invalidations
3. Monitor cache performance and invalidation patterns
4. Support production monitoring and debugging

### Should Track

- Individual invalidations (cascade counts)
- Pattern-based invalidations (by pattern type)
- Invalidation success/failure rates
- Time-based statistics (uptime, operation rates)
- Per-entity type invalidation counts if needed

### Imports to Use

```typescript
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';
```

### Constructor Pattern

```typescript
@Injectable()
export class CacheStatsService {
  private readonly logger = new Logger(CacheStatsService.name);
  private readonly trackingEnabled: boolean;

  constructor(@Inject(REDIS_CACHE) private readonly redis: Redis) {
    this.trackingEnabled = process.env.CACHE_STATS_TRACKING_ENABLED !== 'false';
    this.logger.log(`CacheStatsService initialized (Tracking: ${this.trackingEnabled})`);
  }
}
```

## Module Integration Pattern

From cache.module.ts:

```typescript
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
```

For CacheStatsService:

- Add as provider in CacheModule
- Export from CacheModule for use by other services
- No separate module needed (extends existing CacheModule)

## Testing Patterns

From cache.service.test.ts:

```typescript
beforeEach(async () => {
  process.env.CACHE_METRICS_ENABLED = 'true';

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CacheStatsService,
      {
        provide: REDIS_CACHE,
        useValue: {
          // Mock Redis methods
        },
      },
    ],
  }).compile();

  service = module.get<CacheStatsService>(CacheStatsService);
});
```

## Naming Conventions

Based on codebase analysis:

- Service files: `<domain>.service.ts`
- Test files: `<domain>.service.test.ts`
- Integration tests: `<domain>.service.integration.test.ts`
- Service names: PascalCase with "Service" suffix (e.g., CacheStatsService)
- Methods: camelCase
- Constants/interfaces: PascalCase
- Private members: `private readonly` prefix

## Environment Variables Pattern

From cache.service.ts:

- `CACHE_DEFAULT_TTL` - Numeric with fallback
- `CACHE_METRICS_ENABLED` - Boolean (default true, check !== 'false')
- `CACHE_LOGGING_ENABLED` - Boolean (default false, check === 'true')

For CacheStatsService:

- `CACHE_STATS_TRACKING_ENABLED` - Boolean (default true)
- `CACHE_STATS_DETAILED_LOGGING` - Boolean (default false)

## Related Files

- cache.types.ts - Type definitions (CacheStats interface already exists)
- cache.service.ts - Main service using stats (at /storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.ts)
- cache.module.ts - Module configuration
- redis-cache.provider.ts - Redis injection token (REDIS_CACHE)

## Key Considerations

1. **Graceful Degradation** - Stats tracking failures should not break cache operations
2. **Memory Efficiency** - Aggregated stats, not per-key tracking
3. **Thread Safety** - In-memory stats updates (simple increments are atomic in JavaScript)
4. **Logging Levels** - Use debug for detailed, log for important invalidations
5. **Environment Configuration** - Allow disabling stats tracking for performance-critical scenarios
6. **Public Interface** - Methods to retrieve stats, reset stats, and update stats
7. **Private Methods** - Similar to cache.service, use private helpers for atomic updates
