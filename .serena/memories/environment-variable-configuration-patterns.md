# Environment Variable Configuration Patterns

## Project Structure

The campaign manager project uses multiple configuration approaches depending on the package:

### 1. **API Package** (`/packages/api`)

- **Location**: `/packages/api/.env` and `/packages/api/.env.example`
- **Reading Pattern**: Direct `process.env` access in services
- **Validation**: Bootstrap validation in `main.ts` and service constructors

### 2. **Scheduler Package** (`/packages/scheduler`)

- **Location**: `/packages/scheduler/.env.example`
- **Reading Pattern**: Typed ConfigService class using NestJS `@nestjs/config`
- **Validation**: ConfigService validates required variables in constructor

### 3. **Frontend Package** (`/packages/frontend`)

- **Location**: `/packages/frontend/.env.example`
- **Reading Pattern**: Vite environment variables (`import.meta.env`)
- **Validation**: Helper functions with type-safe access

### 4. **Root Configuration** (`/`)

- **Location**: `/.env.example` and `/.env.local.example`
- **Purpose**: Central configuration reference for all packages

---

## Pattern 1: Direct Environment Variable Reading (API Package)

### File Structure

```
/packages/api/.env.example          # Template with all variables
/packages/api/.env                   # Local development values
/packages/api/src/main.ts            # Bootstrap validation
/packages/api/src/common/cache/      # Services reading env vars
```

### Reading Pattern in Services

From `/packages/api/src/common/cache/cache.service.ts`:

```typescript
@Injectable()
export class CacheService {
  private readonly defaultTtl: number;
  private readonly metricsEnabled: boolean;
  private readonly loggingEnabled: boolean;

  constructor(@Inject(REDIS_CACHE) private readonly redis: Redis) {
    // Load configuration from environment variables
    this.defaultTtl = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10);
    this.metricsEnabled = process.env.CACHE_METRICS_ENABLED !== 'false';
    this.loggingEnabled = process.env.CACHE_LOGGING_ENABLED === 'true';

    this.logger.log(
      `CacheService initialized (TTL: ${this.defaultTtl}s, Metrics: ${this.metricsEnabled}, Logging: ${this.loggingEnabled})`
    );
  }
}
```

### Bootstrap Validation in main.ts

From `/packages/api/src/main.ts`:

```typescript
async function bootstrap() {
  // Validate required environment variables
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET environment variable is required for security. Please set it in your .env file.'
    );
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security.');
  }

  // Use environment variables with defaults
  const port = process.env.PORT || 9264;
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:9263'];

  // ... rest of bootstrap
}
```

### .env.example Structure

From `/packages/api/.env.example`:

```env
# Database
DATABASE_URL="postgresql://campaign_user:campaign_pass@localhost:5432/campaign_db?schema=public"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-minimum-256-bits"

# Server
PORT=9264
NODE_ENV=development

# Redis (for token blacklist/caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS
# Frontend dev server runs on port 9263
CORS_ORIGIN=http://localhost:9263
```

---

## Pattern 2: Typed ConfigService with NestJS (Scheduler Package)

### File Structure

```
/packages/scheduler/src/config/
  └── config.service.ts         # Central configuration class with typed getters
/packages/scheduler/.env.example  # Configuration template
/packages/scheduler/src/config/config.module.ts  # NestJS module setup
```

### ConfigService Implementation

From `/packages/scheduler/src/config/config.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {
    this.validateConfig();
  }

  /**
   * Get the service port
   */
  get port(): number {
    return parseInt(this.nestConfigService.get<string>('PORT', '9266'), 10);
  }

  /**
   * Get the log level (debug, info, warn, error)
   */
  get logLevel(): string {
    return this.nestConfigService.get<string>('LOG_LEVEL', 'info');
  }

  /**
   * Get the Redis URL
   */
  get redisUrl(): string {
    const url = this.nestConfigService.get<string>('REDIS_URL');
    if (!url) {
      throw new Error('REDIS_URL environment variable is required');
    }
    return url;
  }

  /**
   * Get cron schedule for event expiration checks
   */
  get cronEventExpiration(): string {
    return this.nestConfigService.get<string>('CRON_EVENT_EXPIRATION', '*/5 * * * *');
  }

  /**
   * Generic getter for config values (type-safe access)
   */
  get(key: string): string | number {
    switch (key) {
      case 'PORT':
        return this.port;
      case 'LOG_LEVEL':
        return this.logLevel;
      case 'REDIS_URL':
        return this.redisUrl;
      case 'CRON_EVENT_EXPIRATION':
        return this.cronEventExpiration;
      default:
        throw new Error(`Unknown configuration key: ${key}`);
    }
  }

  /**
   * Validate that all required configuration is present
   */
  private validateConfig(): void {
    const requiredVars = ['REDIS_URL', 'API_URL', 'API_SERVICE_ACCOUNT_TOKEN'];

    const missing = requiredVars.filter((varName) => !this.nestConfigService.get(varName));

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}
```

### ConfigService Module Setup

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModuleSetup {}
```

### .env.example Structure with Defaults

From `/packages/scheduler/.env.example`:

```env
# Service Configuration
NODE_ENV=development
PORT=9266
LOG_LEVEL=info

# Redis Configuration (required)
REDIS_URL=redis://localhost:6379

# API Configuration (required)
API_URL=http://localhost:9264/graphql
API_SERVICE_ACCOUNT_TOKEN=your-jwt-token-here

# Cron Schedules (optional, defaults shown)
CRON_EVENT_EXPIRATION=*/5 * * * *  # Every 5 minutes
CRON_SETTLEMENT_GROWTH=0 * * * *   # Every hour
CRON_STRUCTURE_MAINTENANCE=0 * * * * # Every hour

# Job Queue Configuration (optional, defaults shown)
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_BACKOFF_MS=5000
QUEUE_CONCURRENCY=5

# API Client Configuration (optional, defaults shown)
API_REQUEST_TIMEOUT_MS=10000
API_CIRCUIT_BREAKER_THRESHOLD=5
API_CIRCUIT_BREAKER_DURATION_MS=30000
```

---

## Pattern 3: Vite Environment Variables (Frontend Package)

### File Structure

```
/packages/frontend/src/config/
  └── env.ts                    # Central environment configuration
/packages/frontend/.env.example   # Configuration template
```

### Environment Configuration with Validation

From `/packages/frontend/src/config/env.ts`:

```typescript
/**
 * Validates that a required environment variable is present.
 * Throws an error if the variable is missing or empty.
 */
function requireEnv(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Please ensure ${key} is set in your .env file.\n` +
        `See .env.example for required variables.`
    );
  }
  return value;
}

/**
 * Converts string environment variable to boolean.
 * Accepts: 'true', '1', 'yes' (case-insensitive) as true.
 */
function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

/**
 * Validates WebSocket URL protocol based on environment.
 */
function validateWebSocketUrl(url: string, environment: string): string {
  const isProd = environment === 'production';
  const isSecure = url.startsWith('wss://');
  const isInsecure = url.startsWith('ws://');

  if (isProd && isInsecure) {
    throw new Error(
      `Insecure WebSocket URL detected in production environment.\n` +
        `URL: ${url}\n` +
        `Production environments must use secure WebSocket protocol (wss://).`
    );
  }

  if (!isSecure && !isInsecure) {
    throw new Error(
      `Invalid WebSocket URL protocol: ${url}\n` + `WebSocket URLs must start with ws:// or wss://`
    );
  }

  return url;
}

// Validate environment first
const environment = requireEnv('VITE_ENVIRONMENT', import.meta.env.VITE_ENVIRONMENT);

/**
 * Environment configuration object (frozen to prevent modifications).
 */
export const env = Object.freeze({
  // API Configuration
  api: {
    url: validateApiUrl(requireEnv('VITE_API_URL', import.meta.env.VITE_API_URL), environment),
    wsUrl: validateWebSocketUrl(
      requireEnv('VITE_API_WS_URL', import.meta.env.VITE_API_WS_URL),
      environment
    ),
  },

  // Application Configuration
  app: {
    name: requireEnv('VITE_APP_NAME', import.meta.env.VITE_APP_NAME),
    environment: environment as 'development' | 'staging' | 'production',
  },

  // Feature Flags (optional, defaults to false)
  features: {
    debug: parseBoolean(import.meta.env.VITE_ENABLE_DEBUG),
    mockAuth: parseBoolean(import.meta.env.VITE_ENABLE_MOCK_AUTH),
  },

  // Optional Configuration
  analytics: {
    id: import.meta.env.VITE_ANALYTICS_ID,
  },

  monitoring: {
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  },

  // Built-in Vite variables
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  baseUrl: import.meta.env.BASE_URL,
});
```

---

## Pattern 4: Cache-Specific Configuration (Current Example)

### Current Cache Configuration Variables

From `/packages/api/.env` and cache module documentation:

```env
# Cache Service (API - Redis DB 1)
# Default TTL for cached items (seconds)
CACHE_DEFAULT_TTL=300

# Enable cache metrics tracking (hit/miss rates, operation counts)
CACHE_METRICS_ENABLED=true

# Enable debug logging for cache operations
CACHE_LOGGING_ENABLED=false
```

### How Cache Service Uses These Variables

From `/packages/api/src/common/cache/cache.service.ts`:

```typescript
constructor(@Inject(REDIS_CACHE) private readonly redis: Redis) {
  // Load configuration from environment variables
  this.defaultTtl = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10);
  this.metricsEnabled = process.env.CACHE_METRICS_ENABLED !== 'false';
  this.loggingEnabled = process.env.CACHE_LOGGING_ENABLED === 'true';
}
```

### Cache Stats Service Configuration

From `/packages/api/src/common/cache/cache-stats.service.ts`:

```typescript
constructor(@Inject(REDIS_CACHE) private readonly redis: Redis) {
  // Check environment variable to enable/disable tracking
  this.trackingEnabled = process.env.CACHE_STATS_TRACKING_ENABLED !== 'false';

  this.logger.log(`CacheStatsService initialized (Tracking: ${this.trackingEnabled})`);
}
```

---

## Root .env.example - Cache Configuration Section

From `/.env.example`:

```env
# -----------------------------------------------------------------
# Cache Service (API - Redis DB 1)
# -----------------------------------------------------------------
# Default TTL for cached items (seconds)
CACHE_DEFAULT_TTL=300
# Enable cache metrics tracking (hit/miss rates, operation counts)
CACHE_METRICS_ENABLED=true
# Enable debug logging for cache operations
CACHE_LOGGING_ENABLED=false
```

---

## How to Add a New Environment Variable

### For Direct Environment Variable Reading (API Package Style)

1. **Add to `.env.example`:**

```env
# Cache Statistics Reset Period
CACHE_STATS_RESET_PERIOD_MS=3600000  # 1 hour in milliseconds
```

2. **Add to service constructor:**

```typescript
@Injectable()
export class CacheStatsService {
  private readonly statsResetPeriodMs: number;

  constructor(@Inject(REDIS_CACHE) private readonly redis: Redis) {
    // Load configuration from environment variables
    this.statsResetPeriodMs = parseInt(process.env.CACHE_STATS_RESET_PERIOD_MS || '3600000', 10);

    this.logger.log(`CacheStatsService initialized (Reset Period: ${this.statsResetPeriodMs}ms)`);
  }
}
```

3. **Add to root `.env.example` section:**

```env
# -----------------------------------------------------------------
# Cache Statistics
# -----------------------------------------------------------------
# Period to automatically reset cache statistics (milliseconds)
CACHE_STATS_RESET_PERIOD_MS=3600000
```

### For Typed ConfigService (Scheduler Package Style)

1. **Add to `.env.example`:**

```env
# Cache Statistics Reset Period
CACHE_STATS_RESET_PERIOD_MS=3600000  # 1 hour in milliseconds
```

2. **Add getter to ConfigService:**

```typescript
/**
 * Get cache statistics reset period in milliseconds
 */
get cacheStatsResetPeriodMs(): number {
  return parseInt(
    this.nestConfigService.get<string>('CACHE_STATS_RESET_PERIOD_MS', '3600000'),
    10
  );
}
```

3. **Add to generic getter switch:**

```typescript
get(key: string): string | number {
  switch (key) {
    // ... existing cases ...
    case 'CACHE_STATS_RESET_PERIOD_MS':
      return this.cacheStatsResetPeriodMs;
    default:
      throw new Error(`Unknown configuration key: ${key}`);
  }
}
```

4. **Use in service:**

```typescript
constructor(private configService: ConfigService) {
  this.statsResetPeriodMs = this.configService.cacheStatsResetPeriodMs;
}
```

---

## Naming Conventions

### Variable Names

- Use `SCREAMING_SNAKE_CASE` for all environment variables
- Group related variables with a common prefix: `CACHE_*`, `REDIS_*`, `CRON_*`, etc.

### Time-Related Variables

- Use `_MS` suffix for milliseconds: `API_REQUEST_TIMEOUT_MS`
- Use `_SECONDS` suffix for seconds: `CACHE_TTL_SECONDS`
- Use cron format for schedules: `CRON_EVENT_EXPIRATION='*/5 * * * *'`

### Boolean Variables

- Accept: `'true'`, `'1'`, `'yes'` (case-insensitive)
- Default to false if not set
- Pattern: `!== 'false'` (default true) or `=== 'true'` (default false)

### Numeric Variables

- Use `parseInt(..., 10)` with base 10 for base conversion safety
- Always provide sensible defaults

---

## Configuration Best Practices

1. **Validation Layer**: Always validate in constructor/bootstrap
2. **Defaults**: Provide sensible defaults with `||` operator
3. **Documentation**: Include comments in `.env.example` explaining purpose and format
4. **Type Safety**: Use typed getters in ConfigService pattern
5. **Error Messages**: Provide helpful error messages when required variables missing
6. **Grouping**: Group related configuration in `.env.example` with section headers
7. **Security**: Never commit `.env` files, only `.env.example` templates
