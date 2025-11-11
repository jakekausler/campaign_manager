# ThrottlerGuard GraphQL Issue Investigation

## Summary

ThrottlerGuard is configured globally to apply to ALL requests (including GraphQL), but the standard NestJS ThrottlerGuard tries to extract the client IP from `request.ip`, which may be undefined or null in GraphQL contexts.

## Current Configuration

### app.module.ts (lines 14-35)

```typescript
ThrottlerModule.forRoot([
  {
    ttl: 60000,        // 60 seconds
    limit: 10,         // Max 10 requests per window
  },
]),
// ...
providers: [
  // Apply globally via APP_GUARD
  { provide: APP_GUARD, useClass: ThrottlerGuard },
]
```

### Key Issue

- **ThrottlerGuard is applied globally** via `APP_GUARD` provider
- **No custom configuration** for GraphQL context
- **No getTracker function** to handle GraphQL requests
- Apollo Server passes Express request to context factory
- ThrottlerGuard default behavior: tries to access `request.ip` for rate limiting key
- In GraphQL: `request.ip` may be `undefined` causing the error

## GraphQL Configuration

### graphql.module.ts (lines 102-103)

```typescript
context: ({ req, res }: { req: RequestWithUser; res: Response }) =>
  contextFactory.createContext({ req, res }),
```

- Standard Express request is passed to GraphQL context
- ThrottlerGuard still intercepts this request before context creation
- No special handling for GraphQL in ThrottlerGuard

## Solutions (in order of recommendation)

### Option 1: Skip Throttler on GraphQL Operations (RECOMMENDED)

Create custom guard that skips throttling for GraphQL:

- Apply `@SkipThrottle()` decorator to GraphQL resolvers
- Or create custom GraphQL-aware throttler that recognizes GraphQL endpoint
- Simpler, maintains security, avoids IP address issues

### Option 2: Custom Throttler with GraphQL Awareness

Create custom ThrottlerGuard that:

- Checks if request is GraphQL operation
- Uses alternative tracking (API key, JWT user ID, session)
- Falls back to IP for non-authenticated requests

### Option 3: Configure getTracker Function

Modify ThrottlerModule.forRoot to provide custom `getTracker`:

- Handles undefined `request.ip` gracefully
- Returns default value or alternative identifier
- Still subject to rate limiting

## Recommended Fix

**Option 1 with fallback to Option 2:**

1. Apply `@SkipThrottle()` decorator to GraphQL endpoint/resolvers
2. Implement custom guard that rate-limits based on API key or JWT user ID
3. This leverages the API key authentication that's already working

## Files to Check/Modify

- `/storage/programs/campaign_manager/packages/api/src/app.module.ts` - ThrottlerModule config
- `/storage/programs/campaign_manager/packages/api/src/graphql/graphql.module.ts` - GraphQL setup
- May need to create custom guard in `/storage/programs/campaign_manager/packages/api/src/auth/guards/`
