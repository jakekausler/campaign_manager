# Resolver Integration Test Authentication & Authorization Patterns

## Overview

This document details how authentication and authorization guards are tested in resolver integration tests in this codebase.

## Key Finding: Authorization Enforcement Pattern

The authorization for cache-stats is enforced through a dedicated method in the resolver that checks the user's role:

### Pattern Used in Cache-Stats Integration Test

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/cache-stats.resolver.integration.test.ts`

The test directly calls the resolver method and handles authorization checking within the method itself:

```typescript
// Method on resolver is decorated with guards and roles:
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
async getCacheStats(@CurrentUser() _user: AuthenticatedUser): Promise<CacheStats>

// Integration test calls it directly:
const result = await resolver.getCacheStats(adminUser);

// Authorization test expects ForbiddenException from the service/resolver:
it('should throw ForbiddenException for non-admin user', async () => {
  const regularUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'user',
  };

  await expect(resolver.getCacheStats(regularUser)).rejects.toThrow(ForbiddenException);
});
```

## Authorization Checking Implementation

### Current Pattern: Manual Role Check in Resolver Method

The CacheStatsResolver uses a simple pattern where:

1. The resolver method receives an `AuthenticatedUser` parameter via `@CurrentUser()`
2. The method implementation should check the user's role and throw `ForbiddenException` if not authorized

However, reviewing the actual cache-stats.resolver.ts, the role checking is NOT implemented in the method body. Instead:

- The `@UseGuards(JwtAuthGuard, RolesGuard)` decorators are applied
- The `@Roles('admin')` decorator specifies required role
- The RolesGuard intercepts requests and enforces this at runtime

### How Integration Tests Bypass Guards

Integration tests can call resolver methods directly because:

1. They instantiate the resolver in the test module without guards middleware
2. The guards are decorators that only apply when the method is called through the NestJS HTTP/GraphQL server
3. Direct method invocation (like `resolver.getCacheStats(user)`) skips the guard pipeline

## Authorization Check Patterns Across Resolvers

### Pattern 1: Campaign Membership Check (Branch & Merge Resolvers)

**Files**:

- `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/branch.resolver.ts`
- `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/merge.resolver.ts`

Implementation:

```typescript
import { ForbiddenException } from '@nestjs/common';
import { CampaignMembershipService } from '../../auth/services/campaign-membership.service';

// In resolver method:
async branch(branchId: string, @CurrentUser() user: AuthenticatedUser) {
  const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });

  // Check campaign membership via injected service
  const hasAccess = await this.campaignMembershipService.canEdit(
    user.id,
    branch.campaignId
  );

  if (!hasAccess) {
    throw new ForbiddenException(`User does not have access to campaign ${branch.campaignId}`);
  }

  return branch;
}
```

### Pattern 2: Role-Based Access via Decorators (Cache Stats Resolver)

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/cache-stats.resolver.ts`

```typescript
import { UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Resolver()
export class CacheStatsResolver {
  @Query(() => CacheStats)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getCacheStats(@CurrentUser() user: AuthenticatedUser): Promise<CacheStats> {
    // No explicit role check needed - guards enforce it
    return this.cacheStatsService.getStats();
  }
}
```

### Pattern 3: Role Check in Authorization Section (Merge Resolver)

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/merge.resolver.ts`

```typescript
async executeMerge(
  input: ExecuteMergeInput,
  @CurrentUser() user: AuthenticatedUser
): Promise<MergeResult> {
  // ... validation ...

  // Authorization: Check campaign membership
  const hasAccess = await this.campaignMembershipService.canEdit(
    user.id,
    campaign.id
  );
  if (!hasAccess) {
    throw new ForbiddenException(`User does not have access to campaign ${campaign.id}`);
  }

  // Additional role check for specific operations
  if (user.role !== 'owner' && user.role !== 'gm') {
    throw new ForbiddenException('Only campaign OWNER and GM roles can execute merges');
  }

  return this.mergeService.executeMerge(...);
}
```

## Guard Implementations

### JwtAuthGuard

**File**: `/storage/programs/campaign_manager/packages/api/src/auth/guards/jwt-auth.guard.ts`

- Extends `AuthGuard('jwt')`
- Checks if route is marked as `@Public()`
- Handles both HTTP and GraphQL contexts
- Extracts user from `req.user` or GraphQL context

### RolesGuard

**File**: `/storage/programs/campaign_manager/packages/api/src/auth/guards/roles.guard.ts`

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get roles from @Roles decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    // Extract user from HTTP or GraphQL context
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req || context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Check if user has any required role
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

## Integration Test Module Setup

### Module Creation Pattern

```typescript
const moduleRef = await Test.createTestingModule({
  providers: [
    // Real services
    CacheStatsResolver,
    CacheStatsService,

    // Real external services
    PrismaService,

    // Mocked provider dependencies
    {
      provide: CampaignMembershipService,
      useValue: {
        canEdit: jest.fn().mockResolvedValue(true),
      },
    },

    // Mocked infrastructure
    {
      provide: REDIS_CACHE,
      useValue: redisClient, // Real Redis for integration testing
    },
  ],
}).compile();

app = moduleRef.createNestApplication();
resolver = moduleRef.get<CacheStatsResolver>(CacheStatsResolver);
```

### Key Points:

1. **Guards are NOT registered** in test module - method is called directly
2. **Services are real** or mocked based on need
3. **Dependencies are injected** the same way as production
4. **Method invocation is direct** - bypasses guard pipeline

## Testing Authorization: Expected Patterns

### Test 1: Successful Authorization

```typescript
it('should return cache stats for admin user', async () => {
  const adminUser: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
  };

  const result = await resolver.getCacheStats(adminUser);
  expect(result).toBeDefined();
  expect(result).toHaveProperty('totalHits');
});
```

### Test 2: Failed Authorization - Missing Role

```typescript
it('should throw ForbiddenException for non-admin user', async () => {
  const regularUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'user', // Wrong role
  };

  // Expect ForbiddenException to be thrown
  await expect(resolver.getCacheStats(regularUser)).rejects.toThrow(ForbiddenException);
});
```

### Test 3: Campaign Membership Check

```typescript
it('should throw ForbiddenException for user without campaign access', async () => {
  const otherUser: AuthenticatedUser = {
    id: 'other-1',
    email: 'other@example.com',
    role: 'owner', // Has role, but no campaign access
  };

  // canEdit is mocked to return false for users without access
  await expect(resolver.branch(branchId, otherUser)).rejects.toThrow(ForbiddenException);
});
```

## Where Authorization Checks Should Happen

### Option 1: In Resolver Method (Current Pattern for Campaign Access)

**Pros:**

- Transparent and explicit
- Easy to test with direct method calls
- Can be complex with multiple conditions

**Cons:**

- Repeated code across resolvers
- Not enforced at GraphQL level

**Example:**

```typescript
async branch(id: string, @CurrentUser() user: AuthenticatedUser) {
  const branch = await this.prisma.branch.findUnique({ where: { id } });

  if (!branch) return null;

  const hasAccess = await this.campaignMembershipService.canEdit(user.id, branch.campaignId);
  if (!hasAccess) {
    throw new ForbiddenException(`User does not have access to campaign`);
  }

  return branch;
}
```

### Option 2: Via Decorators & Guards (Current Pattern for Role-Based)

**Pros:**

- Centralized enforcement
- Cleaner resolver code
- Automatic for all marked methods

**Cons:**

- Guards don't work with direct method calls (must mock or bypass)
- Role information must match what RolesGuard expects

**Example:**

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
async getCacheStats(@CurrentUser() user: AuthenticatedUser) {
  return this.service.getStats();
}
```

### Option 3: In Service Layer

Could move authorization logic to service methods, but this is NOT done in current codebase.

## Cache Stats Integration Test Authorization Pattern

The cache-stats integration test implements authorization check directly in the resolver method:

```typescript
// In cache-stats.resolver.ts - authorization check needed:
async getCacheStats(@CurrentUser() user: AuthenticatedUser): Promise<CacheStats> {
  // Authorization check (CURRENTLY MISSING - relies on guards)
  if (user.role !== 'admin') {
    throw new ForbiddenException('Only admin users can access cache statistics');
  }

  return this.cacheStatsService.getStats();
}
```

However, the current implementation relies entirely on the RolesGuard decorator which is NOT executed during integration tests!

## Recommendation for Cache Stats Tests

To properly test authorization without implementing it in the resolver, add explicit authorization check:

```typescript
// Minimal implementation for testing
async getCacheStats(@CurrentUser() user: AuthenticatedUser): Promise<CacheStats> {
  if (user.role !== 'admin') {
    throw new ForbiddenException('Only admin users can access cache statistics');
  }
  // ... rest of implementation
}
```

This allows both:

1. Direct method calls in integration tests to properly test authorization
2. Guards to enforce the same rules at runtime via GraphQL
