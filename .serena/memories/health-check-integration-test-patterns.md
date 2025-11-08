# Health Check Integration Test Patterns - Research Summary

## Overview

This document provides patterns for writing integration tests for health check endpoints with cache status in the campaign_manager API.

## Key Files & Patterns Found

### 1. Health Check Module Structure

**File**: `/storage/programs/campaign_manager/packages/api/src/common/health/health.module.ts`

```typescript
@Module({
  imports: [
    TerminusModule, // NestJS Terminus for standardized health checks
    CacheModule, // Required for CacheService and CacheStatsService
  ],
  providers: [CacheHealthIndicator],
  exports: [CacheHealthIndicator], // Export for use in health check controllers
})
export class HealthModule {}
```

**Key Pattern**:

- Health module exports the `CacheHealthIndicator` for use in controllers
- Imports `TerminusModule` from `@nestjs/terminus` for health check support
- Imports `CacheModule` to get access to cache services

### 2. Cache Health Indicator Implementation

**File**: `/storage/programs/campaign_manager/packages/api/src/common/health/cache-health.indicator.ts`

**Important Class**: `CacheHealthIndicator extends HealthIndicator`

```typescript
async isHealthy(key: string): Promise<HealthIndicatorResult> {
  // Checks:
  // 1. Redis connection (critical)
  // 2. Cache statistics (performance metrics)
  // 3. Memory usage (resource monitoring)
  // 4. Key counts (capacity monitoring)

  // Returns:
  return this.getStatus(key, true, {
    status: 'up' | 'degraded' | 'down',
    message: string,
    responseTime: number,
    metrics: {
      hitRate: number,
      totalHits: number,
      totalMisses: number,
      totalKeys: number,
      memoryUsedMB: number,
      statsEnabled: boolean,
    },
    issues?: string[],
  });
}
```

**Key Patterns**:

- Extends `HealthIndicator` from `@nestjs/terminus`
- Uses `getStatus()` method from parent class to format response
- Performs three types of checks: connection, performance metrics, resource monitoring
- Returns detailed metrics including hit rate, memory usage, and key counts
- Uses thresholds for determining health status (MIN_HEALTHY_HIT_RATE = 0.5, MAX_MEMORY_WARNING_MB = 512)

### 3. GraphQL Health Resolver (Simple Pattern)

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/health.resolver.ts`

```typescript
@ObjectType()
export class HealthCheck {
  @Field()
  status!: string;

  @Field()
  timestamp!: Date;

  @Field({ nullable: true })
  version?: string;
}

@Resolver()
export class HealthResolver {
  @Query(() => HealthCheck)
  health(): HealthCheck {
    return {
      status: 'ok',
      timestamp: new Date(),
      version: process.env.npm_package_version || '0.1.0',
    };
  }
}
```

**Key Pattern**:

- Basic GraphQL resolver for health checks (no dependencies)
- Note: This is a simple resolver, not using NestJS Terminus health checks

### 4. HTTP Health Controller Pattern (From Rules Engine)

**File**: `/storage/programs/campaign_manager/packages/rules-engine/src/controllers/health.controller.ts`

```typescript
@Controller()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService
  ) {}

  @Get('health/live')
  async checkLiveness(@Res() res: Response): Promise<void> {
    try {
      const result = await this.healthService.checkLiveness();
      res.status(HttpStatus.OK).json(result);
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'dead',
        error: error instanceof Error ? error.message : 'Liveness check failed',
      });
    }
  }

  @Get('health/ready')
  async checkReadiness(@Res() res: Response): Promise<void> {
    try {
      const health = await this.healthService.checkReadiness();
      const statusCode =
        health.status === 'unhealthy' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Readiness check failed',
      });
    }
  }

  @Get('health')
  async checkHealth(@Res() res: Response): Promise<void> {
    try {
      const health: HealthStatus = await this.healthService.checkHealth();
      let statusCode = HttpStatus.OK;
      if (health.status === 'unhealthy') {
        statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      }
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  }
}
```

**Key Patterns**:

- Use `@Res() res: Response` for custom response control
- Return HTTP status codes based on health status:
  - 200 OK for healthy/degraded (still operational)
  - 503 SERVICE_UNAVAILABLE for unhealthy
- Use try-catch to handle errors gracefully
- Always include error messages in response

### 5. HealthStatus Interface

**File**: `/storage/programs/campaign_manager/packages/rules-engine/src/services/health.service.ts`

```typescript
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    cache: HealthCheckResult;
    dependencyGraph: HealthCheckResult;
  };
}

export interface HealthCheckResult {
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  responseTime?: number;
}
```

### 6. Integration Test Pattern for Resolvers with Auth

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/cache-stats.resolver.integration.test.ts`

This shows the pattern for testing GraphQL resolvers with authentication:

```typescript
describe('CacheStatsResolver Integration Tests', () => {
  let app: INestApplication;
  let resolver: CacheStatsResolver;
  let cacheService: CacheService;
  let cacheStatsService: CacheStatsService;
  let redisClient: Redis;

  // Mock authenticated users with different roles
  let adminUser: AuthenticatedUser;
  let gmUser: AuthenticatedUser;
  let playerUser: AuthenticatedUser;

  // Read from environment (for docker-compose networking)
  const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

  beforeAll(async () => {
    // Set up test users
    adminUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    };

    // Set environment variables for services
    process.env.CACHE_DEFAULT_TTL = '300';
    process.env.CACHE_METRICS_ENABLED = 'true';
    process.env.CACHE_STATS_TRACKING_ENABLED = 'true';
    process.env.CACHE_STATS_RESET_PERIOD_MS = '0';
    process.env.CACHE_LOGGING_ENABLED = 'false';

    // Create REAL Redis connection for integration testing
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: 1,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 50, 2000);
      },
    });

    // Create test module with all required providers
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CacheStatsResolver,
        CacheService,
        CacheStatsService,
        {
          provide: REDIS_CACHE,
          useValue: redisClient,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    resolver = moduleRef.get<CacheStatsResolver>(CacheStatsResolver);
    cacheService = moduleRef.get<CacheService>(CacheService);
    cacheStatsService = moduleRef.get<CacheStatsService>(CacheStatsService);

    // Wait for Redis to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await redisClient.flushdb();
    await redisClient.quit();
    await app.close();
  });

  beforeEach(async () => {
    await redisClient.flushdb();
    cacheService.resetStats();
    cacheStatsService.resetStats();
  });

  describe('Authorization', () => {
    it('should return cache stats for admin user', async () => {
      const result = await resolver.getCacheStats(adminUser);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalHits');
    });

    it('should throw ForbiddenException for non-admin role', async () => {
      await expect(resolver.getCacheStats(gmUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Response Structure', () => {
    it('should return valid cache statistics structure', async () => {
      const result = await resolver.getCacheStats(adminUser);
      expect(result).toEqual(
        expect.objectContaining({
          totalHits: expect.any(Number),
          totalMisses: expect.any(Number),
          hitRate: expect.any(Number),
          totalSets: expect.any(Number),
          totalInvalidations: expect.any(Number),
          totalCascadeInvalidations: expect.any(Number),
          enabled: expect.any(Boolean),
          startTime: expect.any(Date),
          estimatedTimeSavedMs: expect.any(Number),
        })
      );
    });
  });

  describe('Statistics Validation', () => {
    it('should return accurate stats after cache operations', async () => {
      // Perform cache operations
      await cacheService.set('computed-fields:settlement:1:main', { id: 1 });
      await cacheService.get('computed-fields:settlement:1:main'); // hit
      await cacheService.get('computed-fields:settlement:999:main'); // miss
      await cacheService.del('computed-fields:settlement:1:main'); // invalidation

      const result = await resolver.getCacheStats(adminUser);
      expect(result.totalSets).toBe(1);
      expect(result.totalHits).toBe(1);
      expect(result.totalMisses).toBe(1);
      expect(result.totalInvalidations).toBe(1);
    });
  });
});
```

**Key Patterns**:

- Create real Redis connections for integration testing
- Read Redis config from environment variables
- Use `beforeAll` to set up test module and initialize app
- Use `afterAll` to clean up Redis and close app
- Use `beforeEach` to reset state between tests
- Mock authenticated users with different roles for authorization testing
- Test authorization by passing users as parameters to resolver methods
- Verify response structure with `expect.objectContaining()`
- Test with actual cache operations
- Test different user roles and authorization scenarios

### 7. HTTP Controller Test Pattern (Unit Tests)

**File**: `/storage/programs/campaign_manager/packages/rules-engine/src/controllers/health.controller.test.ts`

```typescript
describe('HealthController', () => {
  let controller: HealthController;
  let healthService: MockProxy<HealthService>;
  let mockResponse: MockProxy<Response>;

  beforeEach(async () => {
    healthService = mock<HealthService>();
    mockResponse = mock<Response>();

    // Mock response chaining
    mockResponse.status.mockReturnValue(mockResponse);
    mockResponse.json.mockReturnValue(mockResponse as Response);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
        {
          provide: MetricsService,
          useValue: mock<MetricsService>(),
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('checkReadiness', () => {
    it('should return 200 when status is healthy', async () => {
      const healthStatus: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'pass', message: 'OK' },
          redis: { status: 'pass', message: 'OK' },
          cache: { status: 'pass', message: 'OK' },
          dependencyGraph: { status: 'pass', message: 'OK' },
        },
      };
      healthService.checkReadiness.mockResolvedValue(healthStatus);

      await controller.checkReadiness(mockResponse);

      expect(healthService.checkReadiness).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(healthStatus);
    });

    it('should return 503 when status is unhealthy', async () => {
      const healthStatus: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 10000,
        checks: {
          database: { status: 'fail', message: 'Connection refused' },
          redis: { status: 'pass', message: 'OK' },
          cache: { status: 'pass', message: 'OK' },
          dependencyGraph: { status: 'pass', message: 'OK' },
        },
      };
      healthService.checkReadiness.mockResolvedValue(healthStatus);

      await controller.checkReadiness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith(healthStatus);
    });

    it('should return 503 when check throws error', async () => {
      healthService.checkReadiness.mockRejectedValue(new Error('Check failed'));

      await controller.checkReadiness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'unhealthy',
        error: 'Check failed',
      });
    });
  });
});
```

**Key Patterns**:

- Use `jest-mock-extended` for mocking (`mock<T>()`)
- Mock Response object and chain methods properly
- `mockResponse.status.mockReturnValue(mockResponse)` for method chaining
- Test HTTP status codes explicitly
- Test error scenarios with `mockRejectedValue`
- Test response body content with `expect().toHaveBeenCalledWith()`

## Health Status Response Structure

### Basic Health Response

```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  timestamp: string,
  uptime: number,
  checks: {
    database: { status: 'pass' | 'warn' | 'fail', message?: string, responseTime?: number },
    redis: { status: 'pass' | 'warn' | 'fail', message?: string, responseTime?: number },
    cache: { status: 'pass' | 'warn' | 'fail', message?: string, responseTime?: number },
    dependencyGraph: { status: 'pass' | 'warn' | 'fail', message?: string, responseTime?: number }
  }
}
```

### Cache Health Indicator Response

```typescript
{
  status: 'up' | 'degraded' | 'down',
  message: string,
  responseTime: number,
  metrics: {
    hitRate: number,
    totalHits: number,
    totalMisses: number,
    totalKeys: number,
    memoryUsedMB: number,
    statsEnabled: boolean,
  },
  issues?: string[]
}
```

## HTTP Status Code Mapping

| Health Status | HTTP Status Code        | Meaning                           |
| ------------- | ----------------------- | --------------------------------- |
| healthy       | 200 OK                  | All systems operational           |
| degraded      | 200 OK                  | Still operational but some issues |
| unhealthy     | 503 Service Unavailable | Critical failure                  |

## Authentication in API

**Global Configuration** from `/storage/programs/campaign_manager/packages/api/src/app.module.ts`:

```typescript
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 10, // Max 10 requests per window
      },
    ]),
    CacheModule,
    AuthModule,
    GraphQLConfigModule,
    WebSocketModule,
  ],
  providers: [
    // Global JWT auth guard (applies to all routes unless @Public() decorator)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

**Key Points**:

- JWT auth guard is applied globally
- Use `@Public()` decorator to bypass JWT auth
- Throttling is applied globally (10 requests per 60 seconds)
- Health endpoints typically use `@Public()` decorator

## Environment Variables for Testing

From cache stats integration test:

```
CACHE_DEFAULT_TTL=300
CACHE_METRICS_ENABLED=true
CACHE_STATS_TRACKING_ENABLED=true
CACHE_STATS_RESET_PERIOD_MS=0
CACHE_LOGGING_ENABLED=false
REDIS_HOST=localhost (or from env)
REDIS_PORT=6379 (or from env)
```

## Summary of Key Patterns

1. **Health Module Structure**: Import TerminusModule, CacheModule; export CacheHealthIndicator
2. **Health Indicator**: Extend HealthIndicator, implement isHealthy() method
3. **Controller Pattern**: Use @Get() decorators, @Res() for custom response, handle errors with try-catch
4. **HTTP Status Codes**: 200 for healthy/degraded, 503 for unhealthy
5. **Integration Tests**: Create real Redis connection, set up environment variables, use beforeEach to reset state
6. **Unit Tests**: Mock services with jest-mock-extended, verify service calls and response structure
7. **Authentication**: Use @Public() decorator on health endpoints, pass authenticated user to resolver methods
8. **Response Structure**: Include status, timestamp, uptime, detailed checks with individual health indicators

## Files to Reference When Writing Tests

1. `/storage/programs/campaign_manager/packages/api/src/common/health/health.module.ts` - Module setup
2. `/storage/programs/campaign_manager/packages/api/src/common/health/cache-health.indicator.ts` - Health indicator implementation
3. `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/cache-stats.resolver.integration.test.ts` - Integration test pattern
4. `/storage/programs/campaign_manager/packages/rules-engine/src/controllers/health.controller.ts` - HTTP controller example
5. `/storage/programs/campaign_manager/packages/rules-engine/src/controllers/health.controller.test.ts` - Unit test pattern
