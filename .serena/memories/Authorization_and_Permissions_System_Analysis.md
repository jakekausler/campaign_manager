# Authorization and Permissions System Analysis

## Overview

The campaign manager uses a **role-based permission system** (RBAC) that maps `CampaignRole` enums to specific permissions. The system is integrated into NestJS with GraphQL support.

---

## Permission Infrastructure

### 1. Permission Enum Definition

**File**: `/storage/programs/campaign_manager/packages/api/src/auth/services/permissions.service.ts`

```typescript
export enum Permission {
  // Campaign permissions
  CAMPAIGN_READ = 'campaign:read',
  CAMPAIGN_WRITE = 'campaign:write',
  CAMPAIGN_DELETE = 'campaign:delete',
  CAMPAIGN_MANAGE_MEMBERS = 'campaign:manage_members',

  // Character permissions
  CHARACTER_READ = 'character:read',
  CHARACTER_WRITE = 'character:write',
  CHARACTER_DELETE = 'character:delete',

  // Event permissions
  EVENT_READ = 'event:read',
  EVENT_WRITE = 'event:write',
  EVENT_DELETE = 'event:delete',

  // Kingdom permissions
  KINGDOM_READ = 'kingdom:read',
  KINGDOM_WRITE = 'kingdom:write',
  KINGDOM_DELETE = 'kingdom:delete',

  // Encounter permissions
  ENCOUNTER_READ = 'encounter:read',
  ENCOUNTER_WRITE = 'encounter:write',
  ENCOUNTER_DELETE = 'encounter:delete',

  // Branch permissions
  BRANCH_READ = 'branch:read',
  BRANCH_CREATE = 'branch:create',
  BRANCH_WRITE = 'branch:write',
  BRANCH_DELETE = 'branch:delete',
}
```

### 2. Permission Format Convention

- **Pattern**: `{resource}:{action}`
- **Resource**: Lowercase entity name (e.g., `campaign`, `character`, `audit`)
- **Action**: Lowercase action verb (e.g., `read`, `write`, `delete`, `manage_members`, `export`)

### 3. Role-to-Permission Mapping

**File**: `/storage/programs/campaign_manager/packages/api/src/auth/services/permissions.service.ts`

The system uses `ROLE_PERMISSIONS` constant (lines 41-97) that maps each `CampaignRole` to an array of `Permission`:

- **OWNER**: Full access (all permissions)
- **GM**: Read/write, no delete or member management
- **PLAYER**: Read-only + edit own character (limited)
- **VIEWER**: Read-only access to public content

---

## PermissionsService API

**File**: `/storage/programs/campaign_manager/packages/api/src/auth/services/permissions.service.ts`

The service provides these methods:

```typescript
// Get all permissions for a user in a campaign
async getUserPermissions(campaignId: string, userId: string): Promise<Permission[]>

// Check if user has a specific permission
async hasPermission(
  campaignId: string,
  userId: string,
  permission: Permission
): Promise<boolean>

// Check if user has ALL specified permissions
async hasAllPermissions(
  campaignId: string,
  userId: string,
  permissions: Permission[]
): Promise<boolean>

// Check if user has ANY of the specified permissions
async hasAnyPermission(
  campaignId: string,
  userId: string,
  permissions: Permission[]
): Promise<boolean>
```

---

## GraphQL Authorization Patterns

### 1. User Context

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/context/graphql-context.ts`

```typescript
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string; // Global role (not campaign-specific)
}
```

### 2. Decorator for Getting Current User

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/decorators/current-user.decorator.ts`

Used to inject the authenticated user:

```typescript
@Query()
async someQuery(@CurrentUser() user: AuthenticatedUser) {
  // user is available here
}
```

### 3. Authentication Guard

**File**: `/storage/programs/campaign_manager/packages/api/src/auth/guards/jwt-auth.guard.ts`

Used with `@UseGuards(JwtAuthGuard)` on resolvers to enforce authentication.

### 4. Roles Decorator

**File**: `/storage/programs/campaign_manager/packages/api/src/auth/decorators/roles.decorator.ts`

```typescript
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

Usage: `@Roles('OWNER', 'GM')` (though this is less commonly used than permission checks)

---

## Current Authorization Patterns in Resolvers

### Pattern 1: Campaign Membership Check (Most Common)

Used in services like `campaign.service.ts`, `character.service.ts`, `party.service.ts`:

```typescript
private async hasEditPermission(campaignId: string, user: AuthenticatedUser): Promise<boolean> {
  const campaign = await this.prisma.campaign.findFirst({
    where: {
      id: campaignId,
      OR: [
        { ownerId: user.id },
        {
          memberships: {
            some: {
              userId: user.id,
              role: {
                in: ['OWNER', 'GM'],  // Check for specific roles
              },
            },
          },
        },
      ],
    },
  });

  return campaign !== null;
}
```

**Key Points**:

- Verifies user is campaign owner OR has OWNER/GM role
- Returns boolean
- Called before mutations to authorize user

### Pattern 2: Entity-Based Authorization

Used in `settlement.service.ts`, `structure.service.ts`:

Similar pattern checking Prisma relations to verify campaign access before allowing edits.

### Pattern 3: Direct Permission Checks in GraphQL

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/audit.resolver.ts`

Current audit resolver uses manual authorization:

1. Verifies user has access to entity's campaign (lines 86-104)
2. Uses `campaign.findFirst()` with membership checks
3. Does NOT use the Permission enum

---

## Campaign Role System

**Source**: Prisma schema

- Enum: `CampaignRole` (OWNER, GM, PLAYER, VIEWER)
- Used in: `CampaignMembership` model
- Accessed via: `CampaignMembershipService.getUserRole()`

---

## How to Implement Audit Log Permissions

### Step 1: Add Permissions to Enum

Add to `Permission` enum in `permissions.service.ts`:

```typescript
// Audit permissions
AUDIT_READ = 'audit:read',
AUDIT_EXPORT = 'audit:export',
```

### Step 2: Map Permissions to Roles

Add to `ROLE_PERMISSIONS` mapping in `permissions.service.ts`:

```typescript
[CampaignRole.OWNER]: [
  // ... existing permissions ...
  Permission.AUDIT_READ,
  Permission.AUDIT_EXPORT,
],
[CampaignRole.GM]: [
  // ... existing permissions ...
  Permission.AUDIT_READ,
  Permission.AUDIT_EXPORT,
],
[CampaignRole.PLAYER]: [
  // ... existing permissions ...
  // PLAYER typically would not have audit access
],
[CampaignRole.VIEWER]: [
  // ... existing permissions ...
  // VIEWER typically would not have audit access
],
```

### Step 3: Create Permission Check in Audit Resolver

Pattern to follow (using `PermissionsService`):

```typescript
import { PermissionsService, Permission } from '../../auth/services/permissions.service';

@Resolver(() => Audit)
export class AuditResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService
  ) {}

  @Query(() => [Audit])
  @UseGuards(JwtAuthGuard)
  async entityAuditHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Args('entityType') entityType: string,
    @Args('entityId', { type: () => ID }) entityId: string
    // ... other args ...
  ): Promise<Audit[]> {
    // 1. Find the campaign ID for this entity
    const campaignId = await this.findCampaignId(entityType, entityId);

    if (!campaignId) {
      throw new Error('Entity not found');
    }

    // 2. Check if user has audit:read permission
    const hasPermission = await this.permissionsService.hasPermission(
      campaignId,
      user.id,
      Permission.AUDIT_READ
    );

    if (!hasPermission) {
      throw new Error('Access denied: insufficient permissions to view audit logs');
    }

    // 3. Proceed with query
    // ... existing query logic ...
  }

  async exportAuditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Args('campaignId') campaignId: string
  ): Promise<string> {
    // Check for audit:export permission
    const hasPermission = await this.permissionsService.hasPermission(
      campaignId,
      user.id,
      Permission.AUDIT_EXPORT
    );

    if (!hasPermission) {
      throw new Error('Access denied: insufficient permissions to export audit logs');
    }

    // ... existing export logic ...
  }
}
```

---

## Important Implementation Notes

### 1. Authentication vs Authorization

- **Authentication**: `@UseGuards(JwtAuthGuard)` - verifies user is logged in
- **Authorization**: `PermissionsService.hasPermission()` - verifies user has required permissions

### 2. Campaign-Scoped Permissions

- All permissions in this system are **campaign-scoped**
- Methods require: `campaignId`, `userId`, and `Permission`
- Users can have different roles/permissions in different campaigns

### 3. No Decorator Yet (as of current code)

- There is NO `@RequirePermission()` decorator yet
- Permission checks are done manually in resolvers/services
- Could be created for cleaner code, but current pattern is functional

### 4. PermissionsService is Injectable

- Currently only imported in `audit.resolver.ts` need
- Need to inject it in resolver via constructor
- Already provided by auth module

### 5. Error Handling

- Current pattern throws generic `Error` for access denied
- Could be improved with more specific GraphQL exceptions
- Example: `UnauthorizedException` from `@nestjs/common`

---

## Files Involved

### Core Permission System

- `/storage/programs/campaign_manager/packages/api/src/auth/services/permissions.service.ts` - **Main file**
- `/storage/programs/campaign_manager/packages/api/src/auth/services/campaign-membership.service.ts` - Role management
- `/storage/programs/campaign_manager/packages/api/src/auth/decorators/roles.decorator.ts` - Role decorator (less used)
- `/storage/programs/campaign_manager/packages/api/src/auth/guards/roles.guard.ts` - Role guard

### GraphQL Integration

- `/storage/programs/campaign_manager/packages/api/src/graphql/decorators/current-user.decorator.ts` - User injection
- `/storage/programs/campaign_manager/packages/api/src/graphql/context/graphql-context.ts` - Context creation
- `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/audit.resolver.ts` - Where to add permission checks

### Related

- `/storage/programs/campaign_manager/packages/api/src/auth/guards/jwt-auth.guard.ts` - Authentication
- `/storage/programs/campaign_manager/packages/api/src/auth/auth.module.ts` - Auth module

---

## Naming Conventions Summary

**Permission Names**:

- Format: `{resource}:{action}`
- Examples: `campaign:read`, `character:write`, `audit:export`
- Actions: `read`, `write`, `delete`, `create`, `manage_members`, `export`

**Resource Names**:

- Lowercase entity names: `campaign`, `character`, `audit`, `event`, `kingdom`, `encounter`, `branch`

**Future Audit Permissions**:

- `audit:read` - can view audit logs
- `audit:export` - can export audit logs
