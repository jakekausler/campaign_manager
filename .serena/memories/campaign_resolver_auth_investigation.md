# Campaign Resolver Authentication Investigation

## Research Date

2025-11-11

## Key Findings

### 1. Current Guard Usage on Campaign Resolver

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/campaign.resolver.ts`

**Campaigns Query** (lines 58-65):

- Guard: `@UseGuards(JwtAuthGuard)` - JWT ONLY
- Read-only query, no role restrictions
- Takes authenticated user as parameter

**Other Queries Needing Scheduler Access**:

- `campaign` (line 38): `@UseGuards(JwtAuthGuard)` - Single campaign by ID
- `campaignsByWorld` (line 80): `@UseGuards(JwtAuthGuard)` - Campaigns filtered by world

**Mutations with Role Guards** (need GM/OWNER role):

- `createCampaign` (line 109): `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('owner', 'gm')`
- `updateCampaign` (line 140): Same guards
- `deleteCampaign` (line 178): Same guards
- `archiveCampaign` (line 211): Same guards
- `restoreCampaign` (line 241): Same guards

**Pattern**: All resolvers follow the same pattern - `@UseGuards(JwtAuthGuard)` for reads, `@UseGuards(JwtAuthGuard, RolesGuard)` with `@Roles()` for mutations.

### 2. API Key Authentication Setup

**API Key Strategy** (`/storage/programs/campaign_manager/packages/api/src/auth/strategies/api-key.strategy.ts`):

- Extends `PassportStrategy` with strategy name `'api-key'`
- Looks for `x-api-key` header
- Calls `apiKeyService.validate(apiKey)`
- Returns result which becomes `req.user`

**API Key Service** (`/storage/programs/campaign_manager/packages/api/src/auth/services/api-key.service.ts`):

- `validate()` returns:
  ```typescript
  {
    user: { id: string; email: string; name: string },
    apiKey: { id: string; scopes: unknown; campaignId: string | null }
  }
  ```
- This object is what gets attached to `req.user` by the strategy

**API Key Auth Guard** (`/storage/programs/campaign_manager/packages/api/src/auth/guards/api-key-auth.guard.ts`):

- Extends `AuthGuard('api-key')`
- Already handles GraphQL context properly via `GqlExecutionContext.create(context)`
- Properly extracts request from GraphQL context

### 3. GraphQL Context Issue

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/context/graphql-context.ts`

**Critical Section** (lines 86-94):

```typescript
private createDataLoaders(user?: AuthenticatedUser): DataLoaders {
  if (!user) {
    throw new Error('User context required for DataLoaders');
  }
  // ... creates dataloaders with user context ...
}
```

**Problem**: The context factory expects `req.user` to match `AuthenticatedUser` interface:

```typescript
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}
```

**API Key Return Value Issue**: The API key service returns:

- `user.id` ✓
- `user.email` ✓
- Missing `user.role` ✗

The returned object from API key validation has shape `{ user: {...}, apiKey: {...} }` which is **different** from JWT's shape `{ id, email, role }`.

### 4. Guard Pattern Observations

**Current Patterns in Codebase**:

- No combined JWT/API-key guards found
- All resolvers use single authentication strategy
- Multiple guards shown: `@UseGuards(JwtAuthGuard, RolesGuard)` - but RolesGuard is for authorization, not authentication

**How Multiple Guards Work**:

- When multiple guards are provided, Passport runs them in order
- Request succeeds if all guards pass
- First authentication guard that passes wins
- Can't easily combine "JWT OR API-key" at the guard level

### 5. Type Structure Mismatch

**JWT Flow**:

1. JwtStrategy.validate() returns `UserFromJwt { id, email }`
2. Passport attaches to `req.user`
3. At resolver, `@CurrentUser()` extracts it
4. Gets resolved to `AuthenticatedUser { id, email, role }`

**API Key Flow** (currently broken):

1. ApiKeyStrategy.validate() returns `{ user: {id, email, name}, apiKey: {...} }`
2. Passport attaches to `req.user`
3. This object doesn't match `AuthenticatedUser` shape
4. Missing `role` field for context factory

## Recommendations

### Option 1: Normalize API Key Response (RECOMMENDED)

Modify `api-key.strategy.ts` to return flattened user object matching `AuthenticatedUser`:

```typescript
async validate(req: { headers: Record<string, string | undefined> }): Promise<AuthenticatedUser> {
  const result = await this.apiKeyService.validate(apiKey);
  return {
    id: result.user.id,
    email: result.user.email,
    role: 'service', // or derive from scopes
  };
}
```

Pros:

- Minimal changes to existing code
- API key metadata (scopes, campaignId) available elsewhere if needed
- Works with existing context factory
- Simple approach

Cons:

- API key metadata not in req.user context
- Would need separate mechanism for scope-based authorization

### Option 2: Create Combined Guard

Create new `OptionalAuthGuard` that tries JWT first, then API key:

```typescript
export class OptionalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Try JwtAuthGuard first
    if (jwtGuard passes) return true;
    // Try ApiKeyAuthGuard
    if (apiKeyGuard passes) return true;
    // Fail
    return false;
  }
}
```

Cons:

- More complex implementation
- Would need to handle both types of req.user
- Not needed if we normalize API key response

### Option 3: Modify Context Factory

Make context factory more flexible to handle different auth types:

- Check if user exists before creating dataloaders
- Create different context for API key vs JWT

Cons:

- More invasive changes
- Still doesn't solve the role mismatch
- Complicates authorization logic

## Scheduler-Specific Needs

Based on context, scheduler needs to:

1. Call `campaigns` query (read-only, no role requirement)
2. Possibly call `campaign` or `campaignsByWorld` queries
3. NOT need mutation access (no create/update/delete)
4. Should NOT need role-based authorization

**API Key Scope Suggestion**: `"read:campaigns"`

## Next Steps

1. Decide on approach (Option 1 recommended)
2. Modify API key strategy to normalize response
3. Consider adding role field or creating "service" role for API keys
4. Add/update API key scopes for authorization checks
5. Update resolvers to accept API key for read operations
6. Test scheduler calls with API key authentication
