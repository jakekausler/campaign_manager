# API Key Authentication

**Status:** ✅ Implemented (2025-11-11)

## Overview

The Campaign Manager API supports **dual authentication**: JWT tokens for web clients and API keys for service accounts. This enables both interactive user sessions and programmatic access for microservices like the scheduler.

## Authentication Methods

### 1. JWT Token Authentication (Web Clients)

**Use Case:** Interactive web applications, mobile apps, user-facing clients

**How it Works:**

1. User logs in with email/password via `/auth/login`
2. API returns access token (15 min expiry) and refresh token (7 days)
3. Client includes token in `Authorization: Bearer <token>` header
4. API validates token signature and expiration
5. User object is attached to GraphQL context for resolvers

**Example:**

```bash
# Login
curl -X POST http://localhost:9264/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Use token
curl -X POST http://localhost:9264/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR..." \
  -d '{"query":"{ campaigns { id name } }"}'
```

### 2. API Key Authentication (Service Accounts)

**Use Case:** Microservices, scheduled jobs, CI/CD pipelines, server-to-server communication

**How it Works:**

1. API key is generated via seed file or admin API
2. Key is hashed with bcrypt before storage (like passwords)
3. Service includes plaintext key in `x-api-key` header
4. API verifies key against stored hash
5. User object (service account) is attached to GraphQL context

**Example:**

```bash
curl -X POST http://localhost:9264/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: camp_sk_oEW4TQ09TTpTirmak_XLHITHocAUEfmT" \
  -d '{"query":"{ campaigns { id name } }"}'
```

## Implementation Details

### Guard Architecture

**File:** `packages/api/src/auth/guards/jwt-or-api-key-auth.guard.ts`

The `JwtOrApiKeyAuthGuard` implements **OR logic** for authentication:

```typescript
@Injectable()
export class JwtOrApiKeyAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);

    // Try JWT first
    try {
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const payload = this.jwtService.verify(token);
        const user = await this.jwtStrategy.validate(payload);
        if (user) {
          request.user = user;
          return true;
        }
      }
    } catch (jwtError) {
      // Fall through to API key
    }

    // Try API key as fallback
    try {
      const apiKey = request.headers?.['x-api-key'];
      if (apiKey) {
        const user = await this.apiKeyStrategy.validate(request);
        if (user) {
          request.user = user;
          return true;
        }
      }
    } catch (apiKeyError) {
      // Fall through
    }

    // Both failed
    throw new UnauthorizedException('Invalid credentials');
  }
}
```

### Key Design Decisions

#### 1. Strategy-Based Composition

**Problem:** NestJS guards don't compose well via dependency injection. Injecting `JwtAuthGuard` and `ApiKeyAuthGuard` causes circular dependencies.

**Solution:** Inject Passport strategies directly and call their `validate()` methods manually.

```typescript
constructor(
  private readonly jwtStrategy: JwtStrategy,        // ✅ Works
  private readonly apiKeyStrategy: ApiKeyStrategy,  // ✅ Works
  private readonly jwtService: JwtService           // ✅ Works
) {}
```

#### 2. Removed Global Guard

**Problem:** `JwtAuthGuard` was registered as a global guard in `app.module.ts`, running before route-level guards and throwing exceptions before API key fallback could be attempted.

**Solution:** Removed global guard. All GraphQL resolvers already have explicit `@UseGuards(JwtOrApiKeyAuthGuard)` decorators.

**Security Impact:** None - all endpoints remain protected since:

- GraphQL resolvers have explicit guards
- Auth endpoints use `@Public()` decorator
- Health/metrics endpoints don't need protection

#### 3. GraphQL Context Timing Issue

**Problem:** GraphQL context is created BEFORE guards run, so `context.user` is frozen as `undefined`.

**Solution:** `@CurrentUser()` decorator reads from `gqlContext.req.user` directly, which is set by guards AFTER context creation.

```typescript
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const ctx = GqlExecutionContext.create(context);
  const gqlContext = ctx.getContext<GraphQLContext>();

  // CRITICAL: Read from req.user, not context.user
  return gqlContext.req.user;
});
```

## API Key Management

### Creating API Keys

API keys are created automatically during seed:

**File:** `packages/api/prisma/seed.ts`

```typescript
// Create scheduler service account
const schedulerUser = await prisma.user.upsert({
  where: { email: 'scheduler@campaign.local' },
  create: {
    email: 'scheduler@campaign.local',
    name: 'Scheduler Service',
    password: await bcrypt.hash('unused', 10),
    roles: { create: { roleId: userRole.id } },
  },
});

// Create API key
const apiKeyService = new ApiKeyService(prisma as any);
const { key, id } = await apiKeyService.create({
  userId: schedulerUser.id,
  name: 'Scheduler Service Account Key',
  scopes: ['read:campaigns', 'read:events', 'write:events'],
  expiresAt: null, // Never expires
});

console.log(`API Key: ${key}`);
console.log(`Key ID:  ${id}`);
```

### API Key Security

1. **Hashing:** Keys are hashed with bcrypt (cost factor 10) before storage
2. **Plaintext Return:** Plaintext key is returned ONCE during creation, then lost forever
3. **Revocation:** Keys can be revoked by setting `revokedAt` timestamp
4. **Expiration:** Keys can have optional `expiresAt` date
5. **Scopes:** Keys have scopes array for fine-grained permissions
6. **Last Used:** `lastUsedAt` is updated on each use for auditing

### Standalone Script

For creating additional service account keys:

**File:** `packages/api/scripts/create-service-api-key.ts`

```bash
pnpm --filter @campaign/api ts-node scripts/create-service-api-key.ts
```

## Using with Microservices

### Scheduler Service Example

**File:** `packages/scheduler/.env.local`

```env
API_KEY=camp_sk_oEW4TQ09TTpTirmak_XLHITHocAUEfmT
API_URL=http://localhost:9264/graphql
```

**File:** `packages/scheduler/src/graphql-client.ts`

```typescript
const client = new GraphQLClient(process.env.API_URL, {
  headers: {
    'x-api-key': process.env.API_KEY,
  },
});
```

## Testing

### Test API Key Authentication

```bash
# Start API server
pnpm --filter @campaign/api dev

# Test with API key
curl -X POST http://localhost:9264/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: camp_sk_oEW4TQ09TTpTirmak_XLHITHocAUEfmT" \
  -d '{"query":"{ campaigns { id name } }"}'

# Expected: {"data":{"campaigns":[...]}}
```

### Test JWT Authentication

```bash
# Login to get JWT
curl -X POST http://localhost:9264/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Use JWT token
curl -X POST http://localhost:9264/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"query":"{ campaigns { id name } }"}'

# Expected: {"data":{"campaigns":[...]}}
```

## Troubleshooting

### "Unauthorized" Error

**Symptoms:**

```json
{ "errors": [{ "message": "Unauthorized", "statusCode": 401 }] }
```

**Possible Causes:**

1. API key not in database (run seed or creation script)
2. API key revoked (`revokedAt` is not null)
3. API key expired (`expiresAt` is in the past)
4. Wrong header name (use `x-api-key`, not `Authorization`)
5. Key hash mismatch (key was rotated but environment variable not updated)

**Solution:**

```bash
# Re-run seed to create fresh API key
pnpm --filter @campaign/api prisma db seed

# Copy the printed API key to scheduler/.env.local
```

### User Object is Undefined

**Symptoms:**

```
Cannot read properties of undefined (reading 'id')
```

**Cause:** `@CurrentUser()` decorator is reading from wrong location

**Solution:** Ensure decorator reads from `gqlContext.req.user`, not `gqlContext.user`:

```typescript
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const ctx = GqlExecutionContext.create(context);
  const gqlContext = ctx.getContext<GraphQLContext>();
  return gqlContext.req.user; // ✅ Correct
  // return gqlContext.user;   // ❌ Wrong - frozen as undefined
});
```

## Architecture Diagram

```
┌─────────────────┐
│  Web Client     │
│  (React App)    │
└────────┬────────┘
         │ Authorization: Bearer <jwt>
         ▼
┌─────────────────────────────────────┐
│  NestJS API (Port 9264)             │
│  ┌───────────────────────────────┐  │
│  │  JwtOrApiKeyAuthGuard         │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ 1. Try JWT              │  │  │
│  │  │    ├─ Verify signature  │  │  │
│  │  │    ├─ Check expiration  │  │  │
│  │  │    └─ Set request.user  │  │  │
│  │  ├─────────────────────────┤  │  │
│  │  │ 2. Try API Key          │  │  │
│  │  │    ├─ Hash & compare    │  │  │
│  │  │    ├─ Check revocation  │  │  │
│  │  │    └─ Set request.user  │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
│                                      │
│  GraphQL Context Factory             │
│  ┌───────────────────────────────┐  │
│  │ context.req → contains user   │  │
│  │ (set by guard before          │  │
│  │  resolvers run)               │  │
│  └───────────────────────────────┘  │
│                                      │
│  @CurrentUser() Decorator            │
│  ┌───────────────────────────────┐  │
│  │ return gqlContext.req.user    │  │
│  │ (read current value)          │  │
│  └───────────────────────────────┘  │
│                                      │
│  GraphQL Resolvers                   │
│  ┌───────────────────────────────┐  │
│  │ campaigns(@CurrentUser() user)│  │
│  │ ← user is populated           │  │
│  └───────────────────────────────┘  │
└──────────────────┬───────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│  Scheduler       │  │  Future Services │
│  (Microservice)  │  │  (CI/CD, etc)    │
└──────────────────┘  └──────────────────┘
    │ x-api-key: camp_sk_...
    └─────────────────────┘
```

## Related Documentation

- **Scheduler Service:** [docs/features/scheduler-service.md](./scheduler-service.md)
- **GraphQL API:** [docs/api/graphql-overview.md](../api/graphql-overview.md)
- **Error Handling:** [docs/api/error-handling.md](../api/error-handling.md)
- **Environment Variables:** [docs/deployment/environment-variables.md](../deployment/environment-variables.md)

## Implementation History

- **2025-11-11 Session 1-3:** Initial API key strategy and guard implementation
- **2025-11-11 Session 4:** Removed global JwtAuthGuard, refactored to strategy-based composition
- **2025-11-11 Session 5:** Fixed GraphQL context timing issue
- **2025-11-11 Session 6:** Fixed `@CurrentUser()` decorator to read from `req.user`
- **2025-11-11:** Removed debug logging, verified production-ready

See `API_UPDATE.md` for detailed implementation notes and debugging history.
