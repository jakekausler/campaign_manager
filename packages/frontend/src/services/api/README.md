# GraphQL API Client

This directory contains the Apollo Client configuration and GraphQL query/mutation hooks for interacting with the backend API.

## Table of Contents

- [Architecture](#architecture)
- [Apollo Client Configuration](#apollo-client-configuration)
- [Directory Structure](#directory-structure)
- [GraphQL Hooks](#graphql-hooks)
- [Mutation Hooks](#mutation-hooks)
- [Cache Policies](#cache-policies)
- [Error Handling](#error-handling)
- [Authentication Integration](#authentication-integration)
- [Usage Examples](#usage-examples)
- [Testing](#testing)
- [Best Practices](#best-practices)

## Architecture

The GraphQL client layer follows a layered architecture:

1. **Apollo Client** (`graphql-client.ts`) - Configured Apollo Client instance with links and cache
2. **Query Hooks** (`hooks/`) - Custom React hooks for GraphQL queries
3. **Mutation Hooks** (`mutations/`) - Custom React hooks for GraphQL mutations
4. **Generated Types** (`__generated__/graphql.ts`) - TypeScript types from schema

```
API Request Flow:
Component → Hook → Apollo Client → Auth Link → HTTP/WS Link → Backend API
                        ↓
                  InMemory Cache
```

## Apollo Client Configuration

### Links (in order)

1. **Error Link** - Logs GraphQL, protocol, and network errors
2. **Auth Link** - Injects Bearer token from Zustand store
3. **Split Link** - Routes queries/mutations to HTTP, subscriptions to WebSocket

### Cache Configuration

Apollo Client uses normalized caching with custom type policies:

```typescript
{
  typePolicies: {
    Query: {
      fields: {
        settlementsByKingdom: { keyArgs: ['kingdomId'], merge: replace },
        structuresBySettlement: { keyArgs: ['settlementId'], merge: replace },
      }
    },
    Settlement: {
      keyFields: ['id'],
      fields: {
        structures: { merge: replace },
        computedFields: { merge: false }, // No caching for dynamic fields
      }
    },
    Structure: {
      keyFields: ['id'],
      fields: {
        computedFields: { merge: false }, // No caching for dynamic fields
      }
    }
  }
}
```

**Key features:**

- Normalized cache by entity ID
- Separate cache entries per kingdom/settlement
- No caching for computed fields (always fresh)
- Replace-all merge strategy for simplicity

### Default Fetch Policies

- **watchQuery**: `cache-and-network` (show cached, fetch fresh in background)
- **query**: `cache-first` (use cache if available, fallback to network)
- **mutate**: Default behavior (update cache based on mutation response)

Override policies per-hook as needed.

## Directory Structure

```
services/api/
├── graphql-client.ts        # Apollo Client configuration
├── hooks/                   # Query hooks
│   ├── index.ts            # Centralized exports
│   ├── settlements.ts      # Settlement query hooks
│   ├── settlements.test.tsx # Settlement hook tests
│   ├── structures.ts       # Structure query hooks
│   └── structures.test.tsx # Structure hook tests
└── mutations/              # Mutation hooks
    ├── index.ts            # Centralized exports
    ├── settlements.ts      # Settlement mutation hooks
    ├── settlements.test.tsx # Settlement mutation tests
    ├── structures.ts       # Structure mutation hooks
    └── structures.test.tsx # Structure mutation tests
```

## GraphQL Hooks

Custom hooks wrap Apollo Client's `useQuery` with simplified APIs and caching strategies.

### Settlement Hooks

**`useSettlementsByKingdom(kingdomId, options?)`**

Lists all settlements in a kingdom.

```typescript
import { useSettlementsByKingdom } from '@/services/api/hooks';

function SettlementsList({ kingdomId }: { kingdomId: string }) {
  const { settlements, loading, error, refetch } = useSettlementsByKingdom(kingdomId);

  if (loading) return <Spinner />;
  if (error) return <ErrorAlert message={error.message} />;

  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>
      <ul>
        {settlements?.map(s => <li key={s.id}>{s.name}</li>)}
      </ul>
    </div>
  );
}
```

**Features:**

- Cache policy: `cache-and-network` (show cached immediately, fetch fresh)
- Cached by kingdom ID (changing kingdoms uses separate cache)
- Returns: `{ settlements, loading, error, refetch, networkStatus }`

**`useSettlementDetails(settlementId, options?)`**

Fetches full details for a single settlement including computed fields.

```typescript
import { useSettlementDetails } from '@/services/api/hooks';

function SettlementDetailsPage({ id }: { id: string }) {
  const { settlement, loading, error, refetch } = useSettlementDetails(id);

  if (loading) return <Spinner />;
  if (error) return <ErrorAlert message={error.message} />;
  if (!settlement) return <NotFound />;

  return (
    <div>
      <h1>{settlement.name}</h1>
      <p>Level: {settlement.level}</p>
      <pre>{JSON.stringify(settlement.computedFields, null, 2)}</pre>
    </div>
  );
}
```

**Features:**

- Cache policy: `cache-first` (fast initial render, manual refetch available)
- Includes computed fields (always fetched fresh despite cache)
- Returns: `{ settlement, loading, error, refetch, networkStatus }`

**`useStructuresBySettlement(settlementId, options?)`**

Fetches all structures in a settlement.

```typescript
import { useStructuresBySettlement } from '@/services/api/hooks';

function StructuresGrid({ settlementId }: { settlementId: string }) {
  const { structures, loading, error, settlement } = useStructuresBySettlement(settlementId);

  if (loading) return <Spinner />;
  if (error) return <ErrorAlert message={error.message} />;

  return (
    <div>
      <h2>Structures in {settlement?.name}</h2>
      <div className="grid">
        {structures?.map(s => <StructureCard key={s.id} structure={s} />)}
      </div>
    </div>
  );
}
```

**Features:**

- Cache policy: `cache-and-network`
- Returns: `{ structures, settlement, loading, error, refetch, networkStatus }`

### Structure Hooks

**`useStructureDetails(structureId, options?)`**

Fetches full details for a single structure.

```typescript
import { useStructureDetails } from '@/services/api/hooks';

function StructureDetailsPage({ id }: { id: string }) {
  const { structure, loading, error, refetch } = useStructureDetails(id);

  if (loading) return <Spinner />;
  if (error) return <ErrorAlert message={error.message} />;
  if (!structure) return <NotFound />;

  return (
    <div>
      <h1>{structure.name}</h1>
      <p>Type: {structure.typeId}</p>
      <p>Position: ({structure.x}, {structure.y})</p>
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

**Features:**

- Cache policy: `cache-first`
- Includes all fields including computed fields
- Returns: `{ structure, loading, error, refetch, networkStatus }`

**`useStructureConditions(structureId, options?)`**

Optimized query for fetching only structure conditions/computed fields.

```typescript
import { useStructureConditions } from '@/services/api/hooks';

function ConditionsPanel({ structureId }: { structureId: string }) {
  const { computedFields, loading, error } = useStructureConditions(structureId);

  if (loading) return <Spinner />;
  if (error) return <ErrorAlert message={error.message} />;

  return <pre>{JSON.stringify(computedFields, null, 2)}</pre>;
}
```

**Features:**

- Cache policy: `cache-and-network` (ensures freshness for dynamic fields)
- Minimal query (only id, name, computedFields)
- Returns: `{ structure, computedFields, loading, error, refetch, networkStatus }`

## Mutation Hooks

Custom hooks wrap Apollo Client's `useMutation` with simplified APIs and automatic cache updates.

### Settlement Mutations

All settlement mutation hooks follow a consistent pattern:

**`useCreateSettlement()`**

```typescript
import { useCreateSettlement } from '@/services/api/hooks';

function CreateSettlementForm({ kingdomId }: { kingdomId: string }) {
  const { createSettlement, loading, error } = useCreateSettlement();

  const handleSubmit = async (data) => {
    try {
      const settlement = await createSettlement({
        kingdomId,
        locationId: data.locationId,
        name: data.name,
        level: 1,
      });
      console.log('Created:', settlement);
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**`useUpdateSettlement()`**

```typescript
import { useUpdateSettlement } from '@/services/api/hooks';

function EditSettlementForm({ settlementId }: { settlementId: string }) {
  const { updateSettlement, loading } = useUpdateSettlement();

  const handleSubmit = async (data) => {
    const updated = await updateSettlement(settlementId, { name: data.name });
    console.log('Updated:', updated);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**`useDeleteSettlement()`**

Soft delete (sets deletedAt timestamp).

```typescript
import { useDeleteSettlement } from '@/services/api/hooks';

function DeleteButton({ settlementId }: { settlementId: string }) {
  const { deleteSettlement, loading } = useDeleteSettlement();

  const handleDelete = async () => {
    if (!confirm('Are you sure?')) return;
    await deleteSettlement(settlementId);
  };

  return <button onClick={handleDelete} disabled={loading}>Delete</button>;
}
```

**`useArchiveSettlement()`** and **`useRestoreSettlement()`**

Similar to delete/restore but with explicit archival semantics.

### Structure Mutations

Structure mutations mirror settlement mutations:

- `useCreateStructure()` - Create new structure
- `useUpdateStructure()` - Update structure fields
- `useDeleteStructure()` - Soft delete structure
- `useArchiveStructure()` - Archive structure
- `useRestoreStructure()` - Restore archived structure

```typescript
import { useCreateStructure } from '@/services/api/hooks';

function AddStructureButton({ settlementId }: { settlementId: string }) {
  const { createStructure, loading } = useCreateStructure();

  const handleAdd = async () => {
    const structure = await createStructure({
      settlementId,
      typeId: 'barracks',
      name: 'Main Barracks',
      x: 10,
      y: 20,
    });
    console.log('Created:', structure);
  };

  return <button onClick={handleAdd} disabled={loading}>Add Structure</button>;
}
```

### Mutation Return Values

All mutation hooks return:

```typescript
{
  mutationFn: (args) => Promise<Entity>,  // Execute mutation
  loading: boolean,                       // Mutation in progress
  error: ApolloError | undefined,         // Mutation error
  data: Entity | undefined,               // Last mutation result
  reset: () => void,                      // Reset mutation state
}
```

## Cache Policies

### Query-Level Caching

**Settlement Queries:**

- `settlementsByKingdom` - Cached by `kingdomId`
  - Changing kingdoms fetches new data
  - Same kingdom uses cached data
  - Merge strategy: replace-all

**Structure Queries:**

- `structuresBySettlement` - Cached by `settlementId`
  - Changing settlements fetches new data
  - Same settlement uses cached data
  - Merge strategy: replace-all

### Entity-Level Caching

**Normalization:**

- Settlements: Normalized by `id`
- Structures: Normalized by `id`

**Computed Fields:**

- `merge: false` - No caching
- Always fetched fresh from backend
- Ensures dynamic calculations are current

### Mutation Cache Updates

**Create mutations:**

- Use `refetchQueries` to update list queries
- Simple and reliable approach

**Update mutations:**

- Rely on Apollo's automatic normalized cache updates
- Entity updates propagate to all references

**Delete mutations:**

- Three-step cleanup:
  1. Read entity to get parent IDs
  2. Remove from parent reference fields
  3. Evict entity and run garbage collection
- Add `refetchQueries` for safety

**Archive/Restore mutations:**

- Modify `deletedAt` and `version` fields in cache
- No eviction needed (entity still exists)

## Error Handling

### Error Link

All errors are logged to console with context:

```typescript
// GraphQL errors (e.g., validation failures, auth errors)
[GraphQL error]: Message: Unauthorized, Location: {...}, Path: user.profile

// Protocol errors (e.g., malformed responses)
[Protocol error]: Message: Invalid JSON, Extensions: {...}

// Network errors (e.g., connection failures)
[Network error]: NetworkError: Failed to fetch
  Operation: GetSettlementDetails
  Variables: { id: '123' }
```

### Hook-Level Error Handling

All hooks return `error` object for handling in components:

```typescript
const { settlements, loading, error } = useSettlementsByKingdom(kingdomId);

if (error) {
  // Handle error in UI
  return <ErrorAlert message={error.message} />;
}
```

### Error Policies

All operations use `errorPolicy: 'all'`:

- Returns both data and errors
- Allows partial success handling
- Enables better error UX

## Authentication Integration

### Token Management

Authentication is handled via Zustand store integration:

1. **Auth Link** reads token from `useStore.getState().token`
2. Token is attached to every GraphQL request as `Bearer` header
3. WebSocket connections include token in `connectionParams`

### Token Lifecycle

```
Login Flow:
  login(token, user) → Token stored in Zustand → Apollo Client reads it → Attached to requests

Refresh Flow:
  refreshToken(newToken) → New token stored → Apollo Client uses new token immediately

Logout Flow:
  logout() → Token cleared → Apollo Client stops sending token
```

### Why `useStore.getState()`?

- Runs outside React component lifecycle
- Always gets fresh state (not stale closure)
- Called for every GraphQL request
- Immediately reflects token changes

**Example:**

```typescript
// In graphql-client.ts
const authLink = new ApolloLink((operation, forward) => {
  // Get fresh token on each request
  const token = useStore.getState().token;

  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  }));

  return forward(operation);
});
```

## Usage Examples

### Basic Query

```typescript
import { useSettlementDetails } from '@/services/api/hooks';

function SettlementPage({ id }: { id: string }) {
  const { settlement, loading, error, refetch } = useSettlementDetails(id);

  if (loading) return <Spinner />;
  if (error) return <ErrorAlert message={error.message} />;
  if (!settlement) return <NotFound />;

  return (
    <div>
      <h1>{settlement.name}</h1>
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

### Query with Polling

```typescript
import { useSettlementDetails } from '@/services/api/hooks';

function LiveSettlementView({ id }: { id: string }) {
  const { settlement, loading } = useSettlementDetails(id, {
    pollInterval: 5000, // Poll every 5 seconds
  });

  return <SettlementDisplay settlement={settlement} loading={loading} />;
}
```

### Query with Variables

```typescript
import { useSettlementsByKingdom } from '@/services/api/hooks';

function FilteredSettlements({ kingdomId, minLevel }: { kingdomId: string; minLevel: number }) {
  const { settlements, loading } = useSettlementsByKingdom(kingdomId, {
    variables: { minLevel }, // Pass additional variables
  });

  return <SettlementsList settlements={settlements?.filter(s => s.level >= minLevel)} />;
}
```

### Create Mutation

```typescript
import { useState } from 'react';
import { useCreateSettlement } from '@/services/api/hooks';

function CreateSettlementDialog({ kingdomId }: { kingdomId: string }) {
  const [name, setName] = useState('');
  const { createSettlement, loading, error } = useCreateSettlement();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const settlement = await createSettlement({
        kingdomId,
        locationId: 'loc-123',
        name,
        level: 1,
      });
      console.log('Created:', settlement);
      setName(''); // Clear form
    } catch (err) {
      console.error('Failed to create:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit" disabled={loading}>
        Create
      </button>
      {error && <ErrorMessage error={error} />}
    </form>
  );
}
```

### Update Mutation

```typescript
import { useUpdateStructure } from '@/services/api/hooks';

function EditStructureName({ structure }: { structure: Structure }) {
  const [name, setName] = useState(structure.name);
  const { updateStructure, loading } = useUpdateStructure();

  const handleSave = async () => {
    const updated = await updateStructure(structure.id, { name });
    console.log('Updated:', updated);
  };

  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSave} disabled={loading}>
        Save
      </button>
    </div>
  );
}
```

### Delete with Confirmation

```typescript
import { useDeleteSettlement } from '@/services/api/hooks';
import { useNavigate } from 'react-router-dom';

function DeleteSettlementButton({ settlementId }: { settlementId: string }) {
  const navigate = useNavigate();
  const { deleteSettlement, loading } = useDeleteSettlement();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this settlement?')) {
      return;
    }

    try {
      await deleteSettlement(settlementId);
      navigate('/settlements'); // Navigate away after delete
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  return (
    <button onClick={handleDelete} disabled={loading} className="danger">
      {loading ? 'Deleting...' : 'Delete Settlement'}
    </button>
  );
}
```

## Testing

### Integration Tests with MSW

All hooks are tested with Mock Service Worker (MSW) v2 for realistic GraphQL mocking.

**Setup:**

```typescript
// __tests__/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Example Test:**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useSettlementDetails } from '../settlements';
import { createTestApolloClient } from '@/__tests__/utils/test-utils';

describe('useSettlementDetails', () => {
  it('fetches settlement details by ID', async () => {
    const { result } = renderHook(() => useSettlementDetails('settlement-1'), {
      wrapper: ({ children }) => (
        <ApolloProvider client={createTestApolloClient()}>
          {children}
        </ApolloProvider>
      ),
    });

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.settlement).toBeUndefined();

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify data
    expect(result.current.settlement).toBeDefined();
    expect(result.current.settlement?.id).toBe('settlement-1');
  });
});
```

**Running Tests:**

```bash
# From project root
pnpm --filter @campaign/frontend test

# Watch mode
pnpm --filter @campaign/frontend test:watch

# With coverage
pnpm --filter @campaign/frontend test -- --coverage
```

See test files (`*.test.tsx`) for comprehensive examples.

## Best Practices

### 1. Use Custom Hooks

✅ **Good:**

```typescript
import { useSettlementDetails } from '@/services/api/hooks';

const { settlement, loading } = useSettlementDetails(id);
```

❌ **Bad:**

```typescript
import { useQuery, gql } from '@apollo/client';

const { data, loading } = useQuery(gql`...`);
```

**Why:** Custom hooks provide:

- Simplified API with useMemo optimization
- Consistent error handling
- Type safety with placeholder types
- Cache policies already configured

### 2. Handle Loading and Error States

✅ **Good:**

```typescript
const { settlement, loading, error } = useSettlementDetails(id);

if (loading) return <Spinner />;
if (error) return <ErrorAlert message={error.message} />;
if (!settlement) return <NotFound />;

return <SettlementDisplay settlement={settlement} />;
```

❌ **Bad:**

```typescript
const { settlement } = useSettlementDetails(id);

return <SettlementDisplay settlement={settlement} />; // Crashes if loading/error
```

### 3. Use Optimized Selectors

For components that only need specific fields:

✅ **Good:**

```typescript
const { settlement, loading } = useSettlementDetails(id);
const settlementName = settlement?.name; // Extract what you need
```

❌ **Bad:**

```typescript
const { settlement } = useSettlementDetails(id);
// Re-renders when any settlement field changes, even if component only uses name
```

### 4. Avoid Fetching in Loops

✅ **Good:**

```typescript
// Fetch all settlements in one query
const { settlements } = useSettlementsByKingdom(kingdomId);
```

❌ **Bad:**

```typescript
// N+1 query problem
settlementIds.map((id) => {
  const { settlement } = useSettlementDetails(id); // Separate query per settlement!
});
```

### 5. Use Refetch Sparingly

✅ **Good:**

```typescript
const { settlement, refetch } = useSettlementDetails(id);

<button onClick={() => refetch()}>Refresh</button>
```

❌ **Bad:**

```typescript
// Don't refetch in useEffect or on every render
useEffect(() => {
  refetch(); // Infinite loop!
}, [refetch]);
```

### 6. Handle Mutations Optimistically (When Appropriate)

For better UX, consider optimistic updates for predictable mutations:

```typescript
const { updateSettlement } = useUpdateSettlement({
  optimisticResponse: (id, data) => ({
    __typename: 'Settlement',
    id,
    ...data,
    version: settlement.version + 1,
  }),
});
```

**Note:** Current implementation uses `refetchQueries` instead of optimistic updates for simplicity. Optimistic updates are optional enhancements.

### 7. Provide User Feedback

✅ **Good:**

```typescript
const { createSettlement, loading, error } = useCreateSettlement();

const handleCreate = async () => {
  try {
    await createSettlement(data);
    toast.success('Settlement created!');
  } catch (err) {
    toast.error('Failed to create settlement');
  }
};

return <button disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>;
```

❌ **Bad:**

```typescript
const { createSettlement } = useCreateSettlement();

const handleCreate = () => {
  createSettlement(data); // No feedback, no error handling
};
```

### 8. Clean Up Subscriptions

If using WebSocket subscriptions (not yet implemented):

```typescript
useEffect(() => {
  const subscription = client.subscribe({...}).subscribe({
    next: (data) => console.log(data),
  });

  return () => subscription.unsubscribe(); // Clean up on unmount
}, []);
```

## References

- [Apollo Client Documentation](https://www.apollographql.com/docs/react/)
- [GraphQL Code Generator](https://the-guild.dev/graphql/codegen/docs/getting-started)
- [Mock Service Worker](https://mswjs.io/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
