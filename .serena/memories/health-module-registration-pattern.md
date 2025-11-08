# Health Module Registration Pattern for CacheHealthIndicator

## Current Health Check Implementation

The API currently has a **GraphQL-based health check** (NOT a REST endpoint):

### Current Health Check Location

- **File**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/health.resolver.ts`
- **Query**: `health()` → Returns `HealthCheck` object with `status: 'ok'`, `timestamp`, and `version`
- **Purpose**: Simple GraphQL endpoint testing

## CacheHealthIndicator - Already Created

**File**: `/storage/programs/campaign_manager/packages/api/src/common/health/cache-health.indicator.ts`

### Key Features

- Extends NestJS `HealthIndicator` base class
- Performs comprehensive cache health checks:
  1. Redis connection (critical) - via cache.set/get ping
  2. Cache hit rate - from CacheStatsService metrics
  3. Redis memory usage - from Redis INFO command
  4. Key count by cache type - from SCAN operations
- Returns `HealthIndicatorResult` with status ('up', 'degraded', 'down')
- Thresholds:
  - Min hit rate: 50% (for degraded status)
  - Max memory warning: 512MB
- Graceful degradation: All operations wrapped in try-catch

## NestJS Health Indicator Registration Pattern

### Standard NestJS Pattern (What You'll Need)

```typescript
// 1. Install TerminusModule
import { TerminusModule } from '@nestjs/terminus';

// 2. Create a health controller
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.cacheHealthIndicator.isHealthy('cache')]);
  }
}

// 3. Register in health.module.ts
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [CacheHealthIndicator],
})
export class HealthModule {}

// 4. Import in app.module.ts
@Module({
  imports: [HealthModule, ...otherModules],
})
export class AppModule {}
```

## Files Involved in Health Indicator Setup

### 1. CacheHealthIndicator (EXISTS - lines 1-155)

- Location: `packages/api/src/common/health/cache-health.indicator.ts`
- Status: ✅ Already implemented
- Dependencies: CacheService, CacheStatsService

### 2. Health Module (NEEDS CREATION)

- **Location**: `packages/api/src/common/health/health.module.ts` (NOT YET CREATED)
- **Purpose**: Register CacheHealthIndicator and provide health check endpoint
- **What to include**:
  ```typescript
  @Module({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [CacheHealthIndicator],
  })
  export class HealthModule {}
  ```

### 3. Health Controller (NEEDS CREATION)

- **Location**: `packages/api/src/common/health/health.controller.ts` (CONFLICT - exists in scheduler)
- **Purpose**: Expose REST health check endpoint
- **Note**: Scheduler package has its own health controller - API needs its own

### 4. App Module Integration (NEEDS UPDATE)

- **Location**: `packages/api/src/app.module.ts` (lines 1-39)
- **Current state**: No health module imported
- **What to add**: Import HealthModule and TerminusModule

## Key Design Decisions

### 1. Where to Register

- TerminusModule imported in health.module.ts (not app.module.ts directly)
- health.module.ts then imported in app.module.ts
- Follows project pattern of modular imports

### 2. Dependency Injection

- CacheHealthIndicator requires:
  - CacheService (already available via CacheModule)
  - CacheStatsService (already available)
- Both are exported from their modules for use in other modules

### 3. Endpoint Strategy

- Will create REST `/health` endpoint (complements existing GraphQL query)
- Uses NestJS `@HealthCheck()` decorator for consistent health check framework
- Returns standardized health check response format

### 4. Return Format (NestJS Standard)

```typescript
// Success response
{
  status: 'ok',
  details: {
    cache: {
      status: 'up' | 'degraded' | 'down',
      responseTime: 123,
      message: '...',
      metrics: {...}
    }
  }
}

// Degraded/Down response
{
  status: 'error',
  details: {
    cache: {
      status: 'degraded' | 'down',
      message: 'Issue description',
      issues: ['specific issue 1', 'specific issue 2']
    }
  }
}
```

## Implementation Checklist

- [ ] Create `packages/api/src/common/health/health.module.ts`
  - Import TerminusModule
  - Declare HealthController
  - Provide CacheHealthIndicator
- [ ] Create/Update `packages/api/src/common/health/health.controller.ts`
  - Inject HealthCheckService and CacheHealthIndicator
  - Create @Get() method with @HealthCheck() decorator
- [ ] Update `packages/api/src/app.module.ts`
  - Import HealthModule from './common/health/health.module'
  - Add to imports array
- [ ] (Optional) Consider adding other health indicators:
  - DatabaseHealthIndicator for Prisma connection
  - RedisHealthIndicator (standalone Redis connection check)
  - GrpcHealthIndicator for rules-engine connection

## Dependencies to Verify

```bash
# These should already be installed
pnpm list @nestjs/terminus
pnpm list @nestjs/common
pnpm list @nestjs/core

# If not installed, add:
pnpm add @nestjs/terminus
```

## Testing Considerations

- Unit tests for CacheHealthIndicator already exist (see Stage 6 implementation notes)
- Health controller should be tested with HealthCheckService mock
- Integration tests should verify endpoint responds correctly with real Redis

## References in Codebase

- **Scheduler Health Module**: `packages/scheduler/src/health/health.module.ts` (for comparison)
- **Scheduler Health Controller**: `packages/scheduler/src/health/health.controller.ts` (different pattern - REST only)
- **GraphQL Health Resolver**: `packages/api/src/graphql/resolvers/health.resolver.ts` (simple GraphQL health query)
- **TICKET-033 Stage 6**: `plan/TICKET-033-stage-6.md` (implementation context)
