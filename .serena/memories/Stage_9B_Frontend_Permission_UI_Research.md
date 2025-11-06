# Stage 9B: Frontend Permission UI Research

## Current Implementation Status

### Backend (Stage 9A - COMPLETE)

- Permission enum: `AUDIT_READ`, `AUDIT_EXPORT` added to Permission enum
- Role mapping: Both permissions added to OWNER and GM roles
- Resolver checks: Permission checks implemented in `entityAuditHistory` and `userAuditHistory` resolvers
- Error handling: Using `UnauthorizedException` from `@nestjs/common`

### Frontend (Stage 9B - THIS STAGE)

Permission-based UI needs to be implemented to reflect backend authorization

---

## Frontend Auth Context & Permission Storage

### Current Auth Store Implementation

**Location**: `packages/frontend/src/stores/auth-slice.ts`

**User Interface** (lines 31-38):

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'player' | 'gm' | 'admin'; // User role for authorization
  createdAt?: string;
  updatedAt?: string;
}
```

**Current State**: User has role BUT NO explicit permissions array yet

### Auth Store Architecture

**File**: `packages/frontend/src/stores/index.ts`

- Uses **Zustand** for state management with middleware
- **Persistence**: Token + user persisted to localStorage via persist middleware
- **Selector hooks** for optimal performance:
  - `useAuthStore()` - full auth state
  - `useCurrentUser()` - current user object
  - `useIsAuthenticated()` - auth status only

**Key Hooks** (lines 83-172):

- `useAuthStore()` - access all auth state/actions
- `useCurrentUser()` - access user profile
- `useIsAuthenticated()` - check if authenticated

### Token Management

- Token read from store via `useStore.getState().token` in graphql-client.ts
- Attached to all GraphQL requests as Bearer header

---

## Current Permission Check Patterns

### No Existing Permission Checks in Frontend

- **Router**: ProtectedRoute only checks `isAuthenticated` (no permission checks)
- **Components**: No existing permission-based UI rendering found
- **GraphQL**: Apollo Client reads token but doesn't validate permissions

**File**: `packages/frontend/src/router/ProtectedRoute.tsx`

- Currently only checks authentication, not permissions
- Could be extended to check permissions from user object
- Redirects to `/auth/login` if not authenticated

---

## GraphQL Error Handling

**File**: `packages/frontend/src/services/api/graphql-client.ts`

### Error Link (lines 62-85)

```typescript
const errorLink = new ErrorLink(({ error, operation }) => {
  if (CombinedGraphQLErrors.is(error)) {
    error.errors.forEach(({ message, locations, path, extensions }) => {
      console.error(`[GraphQL error]: Message: ${message}, ...`, extensions);
    });
  }
  // ... handle other error types
});
```

**Current Behavior**:

- Logs all errors to console
- No special handling for UnauthorizedException
- No user-facing error display for permission errors

---

## Audit System Frontend

### Current Audit Data Fetching

**File**: `packages/frontend/src/services/api/hooks/audit.ts`

**Hooks**:

1. `useEntityAuditHistory()` - fetch audit for specific entity
2. `useUserAuditHistory()` - fetch audit for current user (used in AuditLogPage)

**Current Query** (lines 115-150):

```typescript
const GET_USER_AUDIT_HISTORY = gql`
  query GetUserAuditHistory(
    $userId: ID!
    $limit: Int
    $skip: Int
    $operations: [String!]
    $startDate: DateTime
    $endDate: DateTime
    $sortBy: String
    $sortOrder: String
  ) {
    userAuditHistory(...)
  }
`;
```

### AuditLogPage Component

**File**: `packages/frontend/src/pages/AuditLogPage.tsx`

**Current Implementation** (lines 1-82):

- Uses `useCurrentUser()` to get user
- Uses `useUserAuditHistory()` to fetch audit logs
- Early return if user not loaded yet
- No permission checks currently

**ExportButton** (lines 13):

- Already exists and handles export functionality
- Takes Apollo client for fetching all audit data
- Shows confirmation dialog for large exports

---

## Recommended Permission Check Implementation for Stage 9B

### 1. Update User Interface to Include Permissions

**Modify**: `packages/frontend/src/stores/auth-slice.ts`

Add permissions to User interface:

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'player' | 'gm' | 'admin';
  permissions?: string[]; // Add this - array of permission strings like 'audit:read', 'audit:export'
  createdAt?: string;
  updatedAt?: string;
}
```

### 2. Create Permission Check Hook

**Create**: `packages/frontend/src/hooks/useHasPermission.ts`

```typescript
import { useCurrentUser } from '@/stores';

export function useHasPermission(permission: string): boolean {
  const user = useCurrentUser();
  return user?.permissions?.includes(permission) ?? false;
}

export function useHasAllPermissions(permissions: string[]): boolean {
  const user = useCurrentUser();
  return permissions.every((p) => user?.permissions?.includes(p) ?? false);
}

export function useHasAnyPermission(permissions: string[]): boolean {
  const user = useCurrentUser();
  return permissions.some((p) => user?.permissions?.includes(p) ?? false);
}
```

### 3. Enhance Error Handling for Authorization Errors

**Modify**: `packages/frontend/src/services/api/graphql-client.ts`

Detect and handle UnauthorizedException:

```typescript
const errorLink = new ErrorLink(({ error, operation }) => {
  if (CombinedGraphQLErrors.is(error)) {
    error.errors.forEach(({ message, extensions, path }) => {
      // Check if it's an authorization error
      if (extensions?.code === 'FORBIDDEN' || message.includes('unauthorized')) {
        // Store as authorization error for components to handle
        console.warn(`[Auth Error]: ${message}`);
      } else {
        console.error(`[GraphQL error]: ${message}`, extensions);
      }
    });
  }
  // ... rest of error handling
});
```

### 4. Enhance ProtectedRoute with Permission Guards

**Modify**: `packages/frontend/src/router/ProtectedRoute.tsx`

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];  // Add this
  requireAll?: boolean;  // All permissions required? (default: true)
}

export function ProtectedRoute({
  children,
  requiredPermissions,
  requireAll = true
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Permission check if required
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasPermissions = requireAll
      ? requiredPermissions.every(p => user?.permissions?.includes(p))
      : requiredPermissions.some(p => user?.permissions?.includes(p));

    if (!hasPermissions) {
      return <PermissionDeniedPage />;
    }
  }

  return <>{children}</>;
}
```

### 5. Audit Route Protection

**Modify**: `packages/frontend/src/router/index.tsx`

```typescript
{
  path: 'audit',
  element: (
    <ProtectedRoute requiredPermissions={['audit:read']}>
      <LazyPage>
        <AuditLogPage />
      </LazyPage>
    </ProtectedRoute>
  ),
},
```

### 6. AuditLogPage Permission UI

**Modify**: `packages/frontend/src/pages/AuditLogPage.tsx`

```typescript
export default function AuditLogPage() {
  // ... existing hooks ...
  const user = useCurrentUser();
  const hasAuditRead = user?.permissions?.includes('audit:read') ?? false;
  const hasAuditExport = user?.permissions?.includes('audit:export') ?? false;

  if (!user) {
    return <LoadingState />;
  }

  if (!hasAuditRead) {
    return (
      <div className="h-screen flex flex-col bg-slate-50">
        <header className="bg-white border-b px-6 py-4">
          <h1>Audit Log</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-600" />
            <h2 className="text-lg font-semibold">Access Denied</h2>
            <p className="text-muted-foreground mt-2">
              You don't have permission to view audit logs.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Contact your campaign administrator to request access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ... existing audit log UI ...
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* ... existing header ... */}
      <ExportButton
        entries={filteredAudits}
        disabled={loading || !hasAuditExport}  // Disable export if no permission
        apolloClient={apolloClient}
        filterOptions={{ ... }}
      />
      {/* ... rest of page ... */}
    </div>
  );
}
```

### 7. ExportButton Permission Handling

**Modify**: `packages/frontend/src/components/features/audit/ExportButton.tsx`

```typescript
interface ExportButtonProps {
  entries: AuditEntry[];
  disabled?: boolean;
  apolloClient: ApolloClient;
  filterOptions: Omit<UseUserAuditHistoryOptions, 'limit' | 'skip'>;
  hasPermission?: boolean;  // Add this
  permissionTooltip?: string;  // Add this
}

export const ExportButton = ({
  entries,
  disabled = false,
  apolloClient,
  filterOptions,
  hasPermission = true,
  permissionTooltip = 'You don\'t have permission to export audit logs',
}: ExportButtonProps) => {
  // ... existing code ...

  const isDisabled = disabled || entries.length === 0 || isFetching || !hasPermission;

  // Wrap in tooltip if no permission
  if (!hasPermission) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="opacity-50 cursor-not-allowed">
            <Button disabled={true}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>{permissionTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  // ... rest of existing code ...
};
```

### 8. Add Permission Error Handling to Audit Hooks

**Modify**: `packages/frontend/src/services/api/hooks/audit.ts`

Hooks already handle errors gracefully via Apollo Client - no changes needed if backend returns proper errors. Just ensure error UI handles 403/authorization errors.

---

## Key File Paths Summary

### Files to Modify (Stage 9B)

1. `packages/frontend/src/stores/auth-slice.ts` - Add permissions to User interface
2. `packages/frontend/src/hooks/useHasPermission.ts` - CREATE (permission checking hooks)
3. `packages/frontend/src/router/ProtectedRoute.tsx` - Enhance with permission guards
4. `packages/frontend/src/router/index.tsx` - Add permission to audit route
5. `packages/frontend/src/pages/AuditLogPage.tsx` - Add permission UI checks
6. `packages/frontend/src/components/features/audit/ExportButton.tsx` - Add permission-based disabling
7. `packages/frontend/src/services/api/graphql-client.ts` - Enhance error handling for auth errors

### Components/Hooks to Create

- `packages/frontend/src/components/PermissionDeniedPage.tsx` - Reusable 403 page
- `packages/frontend/src/hooks/useHasPermission.ts` - Permission check hooks

---

## Important Notes

### 1. Permission Storage

- Backend returns permissions in user object
- Frontend must receive permissions when user is authenticated
- Need to ensure login mutation returns permissions

### 2. Apollo Client Integration

- Currently attaches token as Bearer header
- Backend validates permissions in resolver
- Frontend receives error if user lacks permission
- Frontend should display user-friendly error message

### 3. Error Messages

- Backend returns UnauthorizedException
- Frontend should detect and display appropriate UI
- Currently ErrorLink logs to console - need to propagate to components

### 4. Route Guard vs Component Guard

- Route-level: Prevent access to `/audit` page entirely
- Component-level: Hide/disable UI elements within page
- Should implement both for defense-in-depth

### 5. Future Enhancements (Post-Stage 9B)

- Permission error boundary component
- Toast notifications for permission denials
- Audit trail for permission-denied attempts
- Permission request workflow

---

## Testing Considerations

### User Roles for Testing

1. **Owner** - Has both `audit:read` and `audit:export`
2. **GM** - Has both `audit:read` and `audit:export`
3. **Player** - Has neither (should see permission denied page)
4. **Viewer** - Has neither (should see permission denied page)

### Test Scenarios

1. User without `audit:read` - route guard blocks access
2. User with `audit:read` but without `audit:export` - export button disabled
3. User with both permissions - full UI access
4. Backend returns 403 - error page displays properly
