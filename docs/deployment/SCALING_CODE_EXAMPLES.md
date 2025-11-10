# Campaign Manager - Scaling Implementation Examples

This document provides copy-paste code examples for implementing the scaling patterns described in the main Scaling Guide.

## 1. Cache Usage Examples

### 1.1 Basic Cache Operations

```typescript
// Import cache service
import { CacheService } from '@common/cache/cache.service';
import { buildComputedFieldsKey } from '@common/cache/cache-key.builder';

@Injectable()
export class SettlementService {
  constructor(
    private readonly cache: CacheService,
    private readonly prisma: PrismaService
  ) {}

  // Get with cache
  async getComputedFields(settlement: Settlement): Promise<Record<string, any>> {
    const cacheKey = buildComputedFieldsKey('settlement', settlement.id, 'main');

    // Check cache first
    const cached = await this.cache.get<Record<string, any>>(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache miss - compute
    const computed = await this.evaluateComputedFields(settlement);

    // Store in cache
    await this.cache.set(cacheKey, computed, { ttl: 300 });

    return computed;
  }

  // Update with invalidation
  async updateSettlement(
    id: string,
    input: UpdateSettlementInput,
    user: AuthenticatedUser
  ): Promise<Settlement> {
    // Update database
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: input,
    });

    // Invalidate caches
    await this.cache.invalidatePattern(`computed-fields:settlement:${id}:*`, 'Settlement updated');
    await this.cache.del(`settlements:kingdom:${updated.kingdomId}:main`);

    return updated;
  }

  private async evaluateComputedFields(settlement: Settlement): Promise<Record<string, any>> {
    // Implementation of field evaluation
    return {};
  }
}
```

### 1.2 Cascading Invalidation

```typescript
@Injectable()
export class StructureService {
  constructor(private readonly cache: CacheService) {}

  async deleteStructure(id: string, settlementId: string, branchId: string): Promise<void> {
    // Delete from database first
    await this.prisma.structure.delete({ where: { id } });

    // Cascade invalidation
    const result = await this.cache.invalidateStructureCascade(id, settlementId, branchId);

    this.logger.log(`Deleted structure ${id}, invalidated ${result.keysDeleted} cache keys`);
  }
}
```

### 1.3 Cache Key Building

```typescript
import {
  buildComputedFieldsKey,
  buildEntityListKey,
  buildSpatialQueryKey,
  normalizeSpatialParams,
} from '@common/cache/cache-key.builder';

// Computed fields
const key1 = buildComputedFieldsKey('settlement', 'settle_123', 'main');
// Result: 'computed-fields:settlement:settle_123:main'

// Entity lists
const key2 = buildEntityListKey('structures', 'settlement', 'settle_456', 'main');
// Result: 'structures:settlement:settle_456:main'

// Spatial queries with normalized parameters
const params = normalizeSpatialParams(48.8566, 2.3522, 5000, 3857, 'world_123');
const key3 = buildSpatialQueryKey('locations-within-bounds', params, 'main');
// Result: 'spatial:locations-within-bounds:48.856600:2.352200:5000:3857:world_123:main'
```

---

## 2. Health Check Implementation

### 2.1 Cache Health Indicator

```typescript
// File: packages/api/src/common/health/cache-health.indicator.ts

import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { CacheService } from '../cache/cache.service';
import { CacheStatsService } from '../cache/cache-stats.service';

@Injectable()
export class CacheHealthIndicator extends HealthIndicator {
  constructor(
    private readonly cacheService: CacheService,
    private readonly statsService: CacheStatsService,
    @Inject(REDIS_CACHE) private readonly redis: Redis
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();

      // Test Redis connection
      await this.redis.ping();
      const redisPingMs = Date.now() - startTime;

      // Get cache statistics
      const stats = this.cacheService.getStats();
      const hitRate = stats.hitRate;

      // Get Redis memory info
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.*)\r/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

      // Determine status based on thresholds
      const isUp = hitRate >= 0.5 && redisPingMs < 50;
      const isDegraded = hitRate < 0.5 || redisPingMs > 50;

      const result = {
        status: isUp ? 'up' : isDegraded ? 'degraded' : 'down',
        responseTime: redisPingMs,
        hitRate: hitRate,
        memoryUsage: memoryUsage,
        stats: {
          hits: stats.hits,
          misses: stats.misses,
          sets: stats.sets,
          deletes: stats.deletes,
        },
      };

      if (isUp) {
        return this.healthy(key, result);
      } else {
        return this.degraded(key, result);
      }
    } catch (error) {
      return this.down(key, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
```

### 2.2 Health Controller

```typescript
// File: packages/api/src/common/health/health.controller.ts

import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { CacheHealthIndicator } from './cache-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly cacheIndicator: CacheHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.cacheIndicator.isHealthy('cache')]);
  }

  @Get('cache')
  async cacheHealth() {
    return this.cacheIndicator.isHealthy('cache');
  }
}
```

### 2.3 Health Module Registration

```typescript
// File: packages/api/src/common/health/health.module.ts

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { CacheHealthIndicator } from './cache-health.indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [CacheHealthIndicator],
})
export class HealthModule {}
```

### 2.4 App Module Integration

```typescript
// File: packages/api/src/app.module.ts

import { Module } from '@nestjs/common';
import { HealthModule } from './common/health/health.module';
// ... other imports

@Module({
  imports: [
    // ... other imports
    HealthModule, // Add this
  ],
})
export class AppModule {}
```

---

## 3. DataLoader Implementation

### 3.1 Using Existing DataLoaders

```typescript
// In a resolver
import { SettlementDataLoader } from '../dataloaders/settlement.dataloader';

@Resolver()
export class KingdomResolver {
  constructor(private settlementLoader: SettlementDataLoader) {}

  @ResolveField(() => [Settlement])
  async settlements(@Parent() kingdom: Kingdom, @Context() context: GraphQLContext) {
    // Use DataLoader to batch load settlements
    // Multiple calls to this method will be batched into one query
    return context.loaders.settlementLoader.loadMany([kingdom.id]);
  }
}
```

### 3.2 Creating a New DataLoader

```typescript
// File: packages/api/src/graphql/dataloaders/character.dataloader.ts

import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PrismaService } from '@database/prisma.service';

@Injectable()
export class CharacterDataLoader {
  constructor(private readonly prisma: PrismaService) {}

  createLoader(): DataLoader<string, Character | null> {
    return new DataLoader<string, Character | null>(
      async (characterIds: readonly string[]) => {
        // Batch load: single query for all IDs
        const characters = await this.prisma.character.findMany({
          where: {
            id: { in: characterIds as string[] },
          },
        });

        // Return in same order as input (DataLoader requirement)
        return characterIds.map((id) => characters.find((c) => c.id === id) || null);
      },
      { cache: true } // Cache within single request
    );
  }
}
```

---

## 4. WebSocket Configuration Examples

### 4.1 Subscribing to Room Updates

```typescript
// Frontend - packages/frontend/src/hooks/useSettlementUpdates.ts

import { useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';

export function useSettlementUpdates(settlementId: string, onUpdate: (data: any) => void) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket?.connected) return;

    // Subscribe to settlement updates room
    const roomName = `settlement:${settlementId}`;
    socket.emit('subscribe', { room: roomName });

    // Handle updates
    socket.on(`entity.modified.${settlementId}`, (data) => {
      onUpdate(data);
    });

    // Cleanup
    return () => {
      socket.emit('unsubscribe', { room: roomName });
      socket.off(`entity.modified.${settlementId}`);
    };
  }, [socket, settlementId, onUpdate]);
}
```

### 4.2 Publishing Updates

```typescript
// Backend - WebSocket Publisher Service

async publishSettlementUpdated(settlement: Settlement, user: AuthenticatedUser) {
  // Format update
  const update = {
    entityId: settlement.id,
    entityType: 'settlement',
    changes: {
      name: settlement.name,
      level: settlement.level,
      updatedAt: settlement.updatedAt,
      updatedBy: user.id,
    }
  };

  // Publish to all API instances via Socket.IO
  this.server.to(`settlement:${settlement.id}`).emit(
    `entity.modified.${settlement.id}`,
    update
  );

  // Also publish via GraphQL subscription
  this.pubSub.publish(`entity.modified.${settlement.id}`, {
    entityModified: update
  });
}
```

---

## 5. Production Deployment Examples

### 5.1 Nginx Load Balancer Configuration

```nginx
# File: /etc/nginx/conf.d/campaign-api.conf

upstream api_upstream {
  least_conn;  # Load balancing strategy

  server api-1:3000 max_fails=3 fail_timeout=10s;
  server api-2:3000 max_fails=3 fail_timeout=10s;
  server api-3:3000 max_fails=3 fail_timeout=10s;
}

server {
  listen 3000;
  server_name _;

  # GraphQL endpoint
  location /graphql {
    proxy_pass http://api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Important for subscriptions
    proxy_buffering off;
    proxy_request_buffering off;
  }

  # WebSocket endpoint
  location /socket.io {
    proxy_pass http://api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # WebSocket settings
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
  }

  # Health check endpoint
  location /health {
    proxy_pass http://api_upstream;
  }
}
```

### 5.2 PgBouncer Configuration

```ini
# File: /etc/pgbouncer/pgbouncer.ini

[databases]
campaign_db = host=postgres port=5432 dbname=campaign_db user=campaign_user password=campaign_pass

[pgbouncer]
# Connection pooling
pool_mode = transaction
max_client_conn = 500
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3

# Timeouts
server_lifetime = 3600
server_idle_timeout = 600
client_idle_timeout = 600

# Performance
pkt_buf = 4096
max_db_connections = 100
max_user_connections = 100

# Logging
log_connections = 1
log_disconnections = 1
log_file = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid
```

### 5.3 Docker Compose Scaling

```yaml
# docker-compose.prod.yml (extended with scaling)

version: '3.8'

services:
  # API Replicas
  api-1:
    build: { context: ., dockerfile: packages/api/Dockerfile, target: production }
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://user:pass@pgbouncer:6432/campaign_db
      REDIS_HOST: redis
    depends_on:
      - postgres
      - redis
      - rules-engine
    deploy:
      replicas: 1
      resources: { limits: { cpus: '1.0', memory: 1024M } }

  api-2:
    extends: api-1

  api-3:
    extends: api-1

  # Connection Pooler
  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      DATABASE_URL: postgres://user:pass@postgres:5432/campaign_db
      PGBOUNCER_POOL_MODE: transaction
      PGBOUNCER_MAX_CLIENT_CONN: 500
      PGBOUNCER_DEFAULT_POOL_SIZE: 25
    depends_on:
      - postgres

  # Database
  postgres:
    image: postgis/postgis:16-3.4-alpine
    environment:
      POSTGRES_USER: campaign_user
      POSTGRES_PASSWORD: campaign_pass
      POSTGRES_DB: campaign_db
    volumes:
      - postgres-data:/var/lib/postgresql/data
    deploy:
      resources: { limits: { cpus: '2.0', memory: 2048M } }

  # Redis
  redis:
    image: redis:7-alpine
    command:
      - redis-server
      - --appendonly yes
      - --maxmemory 512mb
      - --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    deploy:
      resources: { limits: { cpus: '0.5', memory: 512M } }

  # Rules Engine
  rules-engine:
    build: { context: ., dockerfile: packages/rules-engine/Dockerfile, target: production }
    environment:
      NODE_ENV: production
      REDIS_HOST: redis
    depends_on:
      - redis

  # Scheduler
  scheduler:
    build: { context: ., dockerfile: packages/scheduler/Dockerfile, target: production }
    environment:
      NODE_ENV: production
      REDIS_HOST: redis
      API_URL: http://api-1:3000/graphql
    depends_on:
      - redis

volumes:
  postgres-data:
  redis-data:
```

---

## 6. Monitoring and Metrics Examples

### 6.1 Prometheus Metrics Export

```typescript
// File: packages/api/src/common/metrics/prometheus.service.ts

import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge } from 'prom-client';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class PrometheusService {
  // Cache metrics
  private cacheHits = new Counter({
    name: 'cache_hits_total',
    help: 'Total cache hits',
    labelNames: ['cache_type'],
  });

  private cacheMisses = new Counter({
    name: 'cache_misses_total',
    help: 'Total cache misses',
    labelNames: ['cache_type'],
  });

  private queryDuration = new Histogram({
    name: 'query_duration_seconds',
    help: 'GraphQL query duration',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });

  private redisPing = new Gauge({
    name: 'redis_ping_latency_ms',
    help: 'Redis ping latency in milliseconds',
  });

  recordCacheHit(cacheType: string) {
    this.cacheHits.inc({ cache_type: cacheType });
  }

  recordCacheMiss(cacheType: string) {
    this.cacheMisses.inc({ cache_type: cacheType });
  }

  recordQueryDuration(durationSeconds: number) {
    this.queryDuration.observe(durationSeconds);
  }

  recordRedisPing(latencyMs: number) {
    this.redisPing.set(latencyMs);
  }
}
```

### 6.2 Datadog Integration

```typescript
// packages/api/src/main.ts

import { tracer } from 'dd-trace';

// Initialize Datadog tracing
tracer.init({
  service: 'campaign-api',
  version: process.env.APP_VERSION || '1.0.0',
  env: process.env.NODE_ENV || 'development',
});

// Trace GraphQL resolvers
app.use(tracer.middleware.express());
```

---

## 7. Debugging and Troubleshooting

### 7.1 Cache Hit Rate Debugging

```typescript
// Log cache operations for debugging

@Injectable()
export class CacheService {
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const value = await this.redis.get(key);

      if (value === null) {
        if (this.loggingEnabled) {
          this.logger.debug(`Cache MISS: ${key}`);
        }
        return null;
      }

      if (this.loggingEnabled) {
        this.logger.debug(`Cache HIT: ${key}`);
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Cache get failed: ${error.message}`);
      return null;
    }
  }
}
```

### 7.2 Query Performance Analysis

```typescript
// Decorator for timing GraphQL queries

export function TimeQuery() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const result = await original.apply(this, args);
      const duration = Date.now() - startTime;

      if (duration > 100) {
        // Log if > 100ms
        this.logger.warn(`Slow query ${propertyKey} took ${duration}ms`);
      }

      return result;
    };

    return descriptor;
  };
}

// Usage
@Resolver()
export class SettlementResolver {
  @Query()
  @TimeQuery()
  async settlement(@Args('id') id: string): Promise<Settlement> {
    // Implementation
  }
}
```

---

These examples cover the most common scaling scenarios. Adapt them to your specific use cases and requirements.
