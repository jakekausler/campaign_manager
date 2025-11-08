# GraphQL Integration Test with Admin Authentication Patterns

## Summary

This document provides comprehensive patterns for writing GraphQL integration tests that require admin authentication, using the cache-stats.resolver integration test as an example.

---

## 1. Existing Integration Test Pattern Location

### Files to Study:

- **Primary Example**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/branch.resolver.integration.test.ts`
  - Shows complete integration test setup with NestJS Testing
  - Demonstrates how to test authorization and ForbiddenException
  - Tests both authorized and unauthorized user scenarios
- **Other Examples**:
  - `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/state-variable.resolver.integration.test.ts`
  - `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/merge.resolver.integration.test.ts`
  - `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/spatial.resolver.integration.test.ts`

---

## 2. Authentication/Authorization Testing Patterns

### Key Pattern: Testing with Different User Roles

```typescript
// AUTHORIZED user with correct role
const adminUser: AuthenticatedUser = {
  id: 'admin-user-id',
  email: 'admin@example.com',
  role: 'admin', // ← Must match @Roles('admin') decorator
};

// UNAUTHORIZED user without required role
const unauthorizedUser: AuthenticatedUser = {
  id: 'regular-user-id',
  email: 'user@example.com',
  role: 'player', // ← Does NOT have admin role
};

// UNAUTHORIZED user with no authentication
const unauthenticatedUser: AuthenticatedUser = {
  id: 'fake-user',
  email: 'fake@example.com',
  role: 'unknown',
};
```

### How Authorization Works in This Codebase

1. **JwtAuthGuard**: Validates JWT token and extracts user into context
2. **RolesGuard**: Checks if user's role matches `@Roles()` decorator metadata
3. **@Roles() decorator**: Specifies required roles for endpoint
4. **@CurrentUser() decorator**: Injects authenticated user into resolver method

**Pattern in cache-stats.resolver.ts**:

```typescript
@Query(() => CacheStats)
@UseGuards(JwtAuthGuard, RolesGuard)  // ← Apply both guards
@Roles('admin')                        // ← Specify required role
async getCacheStats(@CurrentUser() user: AuthenticatedUser): Promise<CacheStats> {
  // Implementation
}
```

### Testing Authorization

**Test Success Case** (authorized user):

```typescript
it('should return cache stats for admin user', async () => {
  const result = await resolver.getCacheStats(adminUser);

  expect(result).toBeDefined();
  expect(result.totalHits).toBeGreaterThanOrEqual(0);
});
```

**Test Failure Case** (unauthorized user):

```typescript
it('should throw ForbiddenException for non-admin user', async () => {
  await expect(resolver.getCacheStats(unauthorizedUser)).rejects.toThrow(ForbiddenException);
});
```

---

## 3. Complete Integration Test Setup

### Module Setup Pattern (from branch.resolver.integration.test.ts)

```typescript
describe('CacheStatsResolver Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolver: CacheStatsResolver;

  let adminUser: AuthenticatedUser;
  let regularUser: AuthenticatedUser;

  beforeAll(async () => {
    // 1. Create test module with all required providers
    const moduleRef = await Test.createTestingModule({
      providers: [
        CacheStatsResolver,
        CacheStatsService,
        CacheService,
        PrismaService,
        {
          provide: REDIS_CACHE,
          useValue: mockRedisClient, // Can mock or use real Redis
        },
        {
          provide: CampaignMembershipService,
          useValue: {
            canEdit: jest.fn().mockResolvedValue(true),
            // Add other mocked methods as needed
          },
        },
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    // 2. Initialize the app
    app = moduleRef.createNestApplication();
    await app.init();

    // 3. Get instances
    prisma = moduleRef.get<PrismaService>(PrismaService);
    resolver = moduleRef.get<CacheStatsResolver>(CacheStatsResolver);

    // 4. Setup test users
    adminUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    };

    regularUser = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'player',
    };

    // 5. Clean up any existing test data
    // (Optional, depends on whether you're using real DB)
  });

  afterAll(async () => {
    // Clean up: close connections and clear test data
    await app.close();
  });

  beforeEach(async () => {
    // Reset state before each test
    // E.g., clear Redis cache, reset mocks, etc.
  });
});
```

---

## 4. Admin-Only Endpoint Testing

### Key Import Statements

```typescript
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CacheStatsResolver } from './cache-stats.resolver';
import { CacheStatsService } from '../services/cache-stats.service';
import { CacheService } from '../../common/cache/cache.service';
```

### Test Pattern for Admin-Only Queries

```typescript
describe('getCacheStats Query', () => {
  // SUCCESS: Admin can access
  it('should return cache stats for admin user', async () => {
    const result = await resolver.getCacheStats(adminUser);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('totalHits');
    expect(result).toHaveProperty('totalMisses');
    expect(result).toHaveProperty('hitRate');
    expect(result).toHaveProperty('totalSets');
  });

  // FAILURE: Regular user cannot access
  it('should throw ForbiddenException for non-admin user', async () => {
    await expect(resolver.getCacheStats(regularUser)).rejects.toThrow(ForbiddenException);
  });

  // FAILURE: Other admin-lacking role cannot access
  it('should throw ForbiddenException for player role', async () => {
    const playerUser: AuthenticatedUser = {
      id: 'player-1',
      email: 'player@example.com',
      role: 'player',
    };

    await expect(resolver.getCacheStats(playerUser)).rejects.toThrow(ForbiddenException);
  });

  // VALIDATION: Check returned stats structure
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
      })
    );
  });

  // OPTIONAL: Check per-type stats if available
  it('should include per-type cache statistics', async () => {
    const result = await resolver.getCacheStats(adminUser);

    if (result.computedFields) {
      expect(result.computedFields).toEqual(
        expect.objectContaining({
          hits: expect.any(Number),
          misses: expect.any(Number),
          sets: expect.any(Number),
          invalidations: expect.any(Number),
          cascadeInvalidations: expect.any(Number),
          hitRate: expect.any(Number),
        })
      );
    }
  });
});
```

---

## 5. CacheStatsService Integration

### What the Service Provides

The `CacheStatsService` (located at `/storage/programs/campaign_manager/packages/api/src/common/cache/cache-stats.service.ts`) tracks:

```typescript
// Basic stats
- totalHits: number
- totalMisses: number
- hitRate: number (calculated as hits / (hits + misses))
- totalSets: number
- totalInvalidations: number (single-key deletes)
- totalCascadeInvalidations: number (pattern-based deletes)

// Per-type stats (keyed by cache type prefix like 'computed-fields', 'settlements')
- byType: {
    'computed-fields': { hits, misses, sets, invalidations, cascadeInvalidations, hitRate },
    'settlements': { ... },
    // etc.
  }

// Memory info (from Redis INFO command)
- memoryInfo: { usedMemory, usedMemoryHuman, usedMemoryPeak, ... }

// Key counts per type
- keyCountByType: { 'computed-fields': N, 'settlements': M, ... }
```

### Service Methods Used in Resolver

```typescript
// In CacheStatsResolver.getCacheStats():
const stats = this.cacheStatsService.getStats(); // Get aggregated stats
const memoryInfo = await this.cacheStatsService.getRedisMemoryInfo(); // Redis memory
const keyCounts = await this.cacheStatsService.getKeyCountByType(); // Key counts
const timeSaved = this.cacheStatsService.estimateTimeSaved(); // Time estimate
```

---

## 6. Mock User Patterns from Codebase

### Simple Mock (from branch.service.test.ts)

```typescript
const mockAdminUser: AuthenticatedUser = {
  id: 'admin-user-1',
  email: 'admin@example.com',
  role: 'admin',
};

const mockRegularUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'player',
};

const mockOwnerUser: AuthenticatedUser = {
  id: 'owner-1',
  email: 'owner@example.com',
  role: 'owner',
};

const mockGMUser: AuthenticatedUser = {
  id: 'gm-1',
  email: 'gm@example.com',
  role: 'gm',
};
```

### With Database User (from branch.resolver.integration.test.ts)

```typescript
// Create in database
const dbUser = await prisma.user.create({
  data: {
    email: 'cache-test@example.com',
    name: 'Cache Test Admin',
    password: 'hash',
  },
});

// Convert to AuthenticatedUser for resolver
const adminUser: AuthenticatedUser = {
  id: dbUser.id,
  email: dbUser.email,
  role: 'admin',
};
```

---

## 7. Exception Types for Authorization Testing

From `/storage/programs/campaign_manager/packages/api/src/auth/guards/`:

### ForbiddenException

- Thrown by `RolesGuard` when user lacks required role
- Used in tests: `expect(...).rejects.toThrow(ForbiddenException)`

### UnauthorizedException

- Thrown when JWT validation fails (no token or invalid token)
- Used when testing unauthenticated access

---

## 8. GraphQL Type Definitions

The cache stats query returns the `CacheStats` type:

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/types/cache-stats.type.ts`

```typescript
@ObjectType()
export class CacheStats {
  @Field(() => Int)
  totalHits!: number;

  @Field(() => Int)
  totalMisses!: number;

  @Field(() => Float)
  hitRate!: number;

  @Field(() => Int)
  totalSets!: number;

  @Field(() => Int)
  totalInvalidations!: number;

  @Field(() => Int)
  totalCascadeInvalidations!: number;

  @Field(() => Float)
  estimatedTimeSavedMs!: number;

  @Field()
  startTime!: Date;

  @Field(() => Boolean)
  enabled!: boolean;

  // Per-type stats (optional)
  @Field(() => CacheTypeStats, { nullable: true })
  computedFields?: CacheTypeStats;

  @Field(() => CacheTypeStats, { nullable: true })
  settlements?: CacheTypeStats;

  // Memory info (optional)
  @Field(() => RedisMemoryInfo, { nullable: true })
  memoryInfo?: RedisMemoryInfo;

  // Key counts
  @Field(() => Int, { nullable: true })
  computedFieldsKeyCount?: number;
  // ... other key counts
}
```

---

## 9. Testing Strategy Summary

### What to Test

1. **Admin Access** - Admin user can call getCacheStats
2. **Non-Admin Access Denied** - Regular users get ForbiddenException
3. **Response Structure** - Stats have correct fields and types
4. **Stats Accuracy** - Values match expected ranges/types
5. **Per-Type Stats** - If populated, have correct structure
6. **Memory Info** - Redis memory metrics included (if available)
7. **Key Counts** - Per-type key counts returned

### Test Organization

```typescript
describe('CacheStatsResolver Integration Tests', () => {
  // Setup (beforeAll, beforeEach)

  describe('getCacheStats Query', () => {
    describe('Authorization', () => {
      it('should allow admin users');
      it('should deny non-admin users');
    });

    describe('Response Validation', () => {
      it('should return valid stats structure');
      it('should include per-type stats');
    });

    describe('Stats Correctness', () => {
      it('should return non-negative numbers');
      it('should calculate hitRate correctly');
    });
  });
});
```

---

## 10. Key Files Reference

| File                                                                                                        | Purpose                     |
| ----------------------------------------------------------------------------------------------------------- | --------------------------- |
| `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/cache-stats.resolver.ts`             | The resolver being tested   |
| `/storage/programs/campaign_manager/packages/api/src/graphql/types/cache-stats.type.ts`                     | Response type definition    |
| `/storage/programs/campaign_manager/packages/api/src/common/cache/cache-stats.service.ts`                   | Service providing stats     |
| `/storage/programs/campaign_manager/packages/api/src/auth/guards/roles.guard.ts`                            | Guard enforcing @Roles()    |
| `/storage/programs/campaign_manager/packages/api/src/auth/decorators/roles.decorator.ts`                    | @Roles() decorator          |
| `/storage/programs/campaign_manager/packages/api/src/graphql/context/graphql-context.ts`                    | AuthenticatedUser interface |
| `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/branch.resolver.integration.test.ts` | Template for test structure |

---

## 11. Notes

- **No GraphQL HTTP Testing Needed**: Tests call resolver methods directly, not via HTTP
- **Guards Not Tested**: Guards (JwtAuthGuard, RolesGuard) are assumed to work; tests only verify they throw when appropriate
- **Real or Mocked Redis**: Can use real Redis or mock - depends on test complexity
- **Test Isolation**: Each test should be independent; use beforeEach() to reset state
- **Async/Await**: All resolver methods are async; always await results
