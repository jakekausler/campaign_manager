# Admin Permission Checks in GraphQL Resolvers - Research Summary

## Overview

This codebase uses a **decorator-based role and permission system** for GraphQL resolver authorization. The pattern is consistent across resolvers and is sufficient without additional manual permission checks for simple role-based access.

## Pattern Analysis

### 1. Two-Tier Authorization System

The codebase uses TWO complementary systems:

#### A. Decorator-Based Role Checking (Simpler - Used by most resolvers)

- **For**: Admin-only or simple role-based endpoints
- **Pattern**:
  ```typescript
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')  // or @Roles('owner', 'gm')
  async getCacheStats(@CurrentUser() user: AuthenticatedUser): Promise<CacheStats> {
    // Implementation
  }
  ```
- **How it works**:
  1. `JwtAuthGuard` validates JWT token and extracts user from request
  2. `RolesGuard` checks if user has required role(s)
  3. `RolesGuard` reads metadata set by `@Roles()` decorator
  4. Guard throws 403 Forbidden if user lacks required role

#### B. Service-Based Permission Checking (Complex - Used for campaign-scoped permissions)

- **For**: Fine-grained, campaign-scoped permissions
- **Pattern**: Manual permission checks in resolver method

  ```typescript
  @UseGuards(JwtAuthGuard)
  async entityAuditHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Args('entityId') entityId: string
  ): Promise<Audit[]> {
    // Manual permission check
    const hasPermission = await this.permissionsService.hasPermission(
      campaignId,
      user.id,
      Permission.AUDIT_READ
    );

    if (!hasPermission) {
      throw new UnauthorizedException('Access denied');
    }
  }
  ```

### 2. Role vs Permission Distinction

**Roles** (User-level - Global):

- Part of user JWT payload
- Used by `@Roles()` decorator via `RolesGuard`
- Simple string matching: `user.roles?.includes(role)`
- Examples: 'admin', 'owner', 'gm', 'player', 'viewer'

**Permissions** (Campaign-scoped):

- Derived from campaign membership role via `PermissionsService`
- Used for fine-grained access control within campaigns
- Checked manually using `PermissionsService.hasPermission()`
- Examples: CAMPAIGN_READ, CAMPAIGN_WRITE, AUDIT_READ, CHARACTER_WRITE

### 3. Role-Permission Mapping

**ROLE_PERMISSIONS** in `permissions.service.ts`:

- `OWNER`: Full access (all permissions)
- `GM`: Read/write access, no delete or member management
- `PLAYER`: Read access + own character edit
- `VIEWER`: Read-only access to public content

## Key Files

### 1. `/storage/programs/campaign_manager/packages/api/src/auth/guards/roles.guard.ts`

- Implements `CanActivate` guard interface
- Reads `@Roles()` metadata using Reflector
- Extracts user from GraphQL/HTTP context
- Performs simple string matching: `user.roles?.includes(role)`
- Returns true/false to allow/deny access

### 2. `/storage/programs/campaign_manager/packages/api/src/auth/decorators/roles.decorator.ts`

- Simple metadata setter using `SetMetadata(ROLES_KEY, roles)`
- Stores required roles for a resolver method
- Read by RolesGuard at runtime

### 3. `/storage/programs/campaign_manager/packages/api/src/auth/services/permissions.service.ts`

- `getUserPermissions(campaignId, userId)`: Get all permissions
- `hasPermission(campaignId, userId, permission)`: Check single permission
- `hasAllPermissions(...)`: Check multiple permissions (AND)
- `hasAnyPermission(...)`: Check multiple permissions (OR)
- Maps CampaignRole to Permission[] using ROLE_PERMISSIONS constant

### 4. `/storage/programs/campaign_manager/packages/api/src/graphql/context/graphql-context.ts`

- `AuthenticatedUser` interface: { id, email, role }
- User populated by JwtAuthGuard from JWT token
- Passed to resolvers via `@CurrentUser()` decorator

## Real-World Examples

### Example 1: Admin-Only Endpoint (cache-stats.resolver.ts)

```typescript
@Query(() => CacheStats)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')  // ← Decorator handles all authorization
async getCacheStats(@CurrentUser() user: AuthenticatedUser): Promise<CacheStats> {
  // No manual checks needed - guard ensures user.role === 'admin'
  const stats = this.cacheStatsService.getStats();
  return stats;
}
```

**Status**: COMPLETE - Decorators are sufficient

### Example 2: Campaign-Scoped Permission Check (audit.resolver.ts)

```typescript
@Query(() => [Audit])
@UseGuards(JwtAuthGuard)  // No RolesGuard or @Roles - need manual check
async entityAuditHistory(
  @CurrentUser() user: AuthenticatedUser,
  @Args('entityId') entityId: string
): Promise<Audit[]> {
  // Manual step 1: Find the campaign for this entity
  let campaignId: string | null = null;
  const settlement = await this.prisma.settlement.findUnique({
    where: { id: entityId },
    select: { kingdom: { select: { campaignId: true } } },
  });
  campaignId = settlement?.kingdom.campaignId ?? null;

  // Manual step 2: Verify user is campaign member
  if (campaignId) {
    const hasAccess = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        OR: [
          { ownerId: user.id },
          { memberships: { some: { userId: user.id } } },
        ],
      },
    });
    if (!hasAccess) {
      throw new UnauthorizedException('Access denied');
    }
  }

  // Manual step 3: Check campaign-scoped permission
  const hasPermission = await this.permissionsService.hasPermission(
    campaignId,
    user.id,
    Permission.AUDIT_READ
  );
  if (!hasPermission) {
    throw new UnauthorizedException('Access denied');
  }
}
```

**Status**: COMPLETE - Manual checks required for campaign-scoped access

### Example 3: Campaign Resolver (campaign.resolver.ts)

```typescript
@Mutation(() => Campaign)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'gm')  // Guard ensures user is owner or gm
async createCampaign(
  @Args('input') input: CreateCampaignInput,
  @CurrentUser() user: AuthenticatedUser
): Promise<Campaign> {
  // No manual permission check needed
  // Guard ensures user role is 'owner' or 'gm'
  return this.campaignService.create(input, user);
}
```

**Status**: COMPLETE - Decorators are sufficient

## Permission Checking Rules

1. **If endpoint requires global roles** (admin, owner, gm, etc.):
   - Use: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`
   - No manual checks needed

2. **If endpoint requires campaign-scoped permissions**:
   - Use: `@UseGuards(JwtAuthGuard)` only
   - Manually check campaign membership
   - Use `PermissionsService.hasPermission()` for fine-grained checks
   - Examples: AUDIT_READ, CHARACTER_WRITE, CAMPAIGN_DELETE, etc.

3. **If endpoint combines both**:
   - Use both guards and decorators
   - Also include manual permission service checks
   - Applies to complex scenarios

## AuthenticatedUser Interface

```typescript
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string; // Global role: 'admin', 'owner', 'gm', 'player', 'viewer'
}
```

**Note**: User.role is a GLOBAL role, not campaign-scoped. Campaign-scoped roles come from CampaignMembership table and are accessed via PermissionsService.

## Module Registration (HealthModule example)

For modules that provide health indicators or other services:

```typescript
@Module({
  imports: [TerminusModule, CacheModule],
  providers: [CacheHealthIndicator],
  exports: [CacheHealthIndicator], // Export for other modules
})
export class HealthModule {}
```

## Summary for cache-stats.resolver.ts

The current pattern in cache-stats.resolver.ts is **CORRECT and COMPLETE**:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
async getCacheStats(@CurrentUser() user: AuthenticatedUser): Promise<CacheStats> {
  // No additional manual checks needed
  // Guards ensure user is authenticated and has 'admin' role
  return this.cacheStatsService.getStats();
}
```

This is the standard pattern used throughout the codebase for role-based access control. Additional permission service checks are only needed for campaign-scoped or fine-grained permissions.
