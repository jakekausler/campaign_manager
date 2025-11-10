# GraphQL API - Subscriptions

This document covers the real-time subscription capabilities of the Campaign Manager GraphQL API, including GraphQL subscriptions for concurrent edit detection and WebSocket events for frontend state updates.

## Table of Contents

- [Overview](#overview)
- [Connection Setup](#connection-setup)
  - [GraphQL Subscriptions (graphql-ws)](#graphql-subscriptions-graphql-ws)
  - [WebSocket Events (Socket.IO)](#websocket-events-socketio)
- [GraphQL Subscriptions](#graphql-subscriptions)
  - [entityModified](#entitymodified)
- [WebSocket Events](#websocket-events)
  - [Event Types](#event-types)
  - [Room Organization](#room-organization)
  - [entity_updated](#entity_updated)
  - [state_invalidated](#state_invalidated)
  - [world_time_changed](#world_time_changed)
  - [settlement_updated](#settlement_updated)
  - [structure_updated](#structure_updated)
- [Authentication & Authorization](#authentication--authorization)
  - [GraphQL Subscription Auth](#graphql-subscription-auth)
  - [WebSocket Event Auth](#websocket-event-auth)
- [Frontend Integration](#frontend-integration)
  - [Apollo Client Setup](#apollo-client-setup)
  - [React Hooks](#react-hooks)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Campaign Manager API provides **two complementary real-time systems**:

1. **GraphQL Subscriptions** (via `graphql-ws` protocol)
   - For concurrent edit detection and optimistic locking
   - Standard GraphQL subscription protocol
   - Single subscription: `entityModified`

2. **WebSocket Events** (via Socket.IO)
   - For frontend state updates and cache invalidation
   - Room-based event broadcasting
   - Five event types covering entity updates, cache invalidation, and time progression

Both systems use **Redis PubSub** as the messaging backend, ensuring scalability across multiple API instances.

### When to Use Each System

| Use Case                 | System                | Why                                               |
| ------------------------ | --------------------- | ------------------------------------------------- |
| Detect concurrent edits  | GraphQL Subscriptions | Standard protocol, optimistic locking integration |
| Real-time UI updates     | WebSocket Events      | Efficient room-based broadcasting, typed events   |
| Cache invalidation       | WebSocket Events      | Scoped invalidation with granular control         |
| Third-party integrations | GraphQL Subscriptions | Standard GraphQL protocol                         |
| Frontend development     | WebSocket Events      | React hooks, type-safe, automatic reconnection    |

---

## Connection Setup

### GraphQL Subscriptions (graphql-ws)

GraphQL subscriptions use the WebSocket protocol at `/graphql` (same endpoint as queries/mutations).

**Connection URL:**

```
ws://localhost:3000/graphql
wss://api.yourdomain.com/graphql  # Production
```

**Protocol:** `graphql-ws` (modern protocol, replaces deprecated `subscriptions-transport-ws`)

**Example with Apollo Client:**

```typescript
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

const wsLink = new GraphQLWsLink(
  createClient({
    url: 'ws://localhost:3000/graphql',
    connectionParams: {
      authentication: `Bearer ${token}`, // JWT token
    },
  })
);
```

### WebSocket Events (Socket.IO)

WebSocket events use Socket.IO at `/events` endpoint.

**Connection URL:**

```
ws://localhost:3000/events
wss://api.yourdomain.com/events  # Production
```

**Protocol:** Socket.IO (custom protocol with fallback transport)

**Example with Socket.IO Client:**

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/events', {
  auth: {
    token: 'your-jwt-token',
  },
  transports: ['websocket'], // Force WebSocket transport
});

socket.on('connect', () => {
  console.log('Connected to WebSocket events');

  // Subscribe to campaign events
  socket.emit('subscribe_campaign', { campaignId: '123' });
});

socket.on('entity_updated', (data) => {
  console.log('Entity updated:', data);
});
```

---

## GraphQL Subscriptions

### entityModified

Detects when an entity has been modified by another user/process, enabling concurrent edit detection for optimistic locking.

**Signature:**

```graphql
subscription EntityModified($entityId: String!) {
  entityModified(entityId: $entityId) {
    entityId
    entityType
    version
    modifiedBy
    modifiedAt
  }
}
```

**Arguments:**

| Argument   | Type   | Required | Description                                   |
| ---------- | ------ | -------- | --------------------------------------------- |
| `entityId` | String | Yes      | UUID of the entity to watch for modifications |

**Return Type:** `EntityModified`

```typescript
type EntityModified {
  entityId: string;      // UUID of modified entity
  entityType: string;    // Type: "campaign", "settlement", "event", etc.
  version: number;       // New version number after modification
  modifiedBy: string;    // User ID who made the modification
  modifiedAt: Date;      // Timestamp of modification
}
```

**Usage Example:**

```typescript
import { useSubscription } from '@apollo/client';

const ENTITY_MODIFIED_SUBSCRIPTION = gql`
  subscription EntityModified($entityId: String!) {
    entityModified(entityId: $entityId) {
      entityId
      entityType
      version
      modifiedBy
      modifiedAt
    }
  }
`;

function SettlementEditor({ settlementId }: { settlementId: string }) {
  const { data } = useSubscription(ENTITY_MODIFIED_SUBSCRIPTION, {
    variables: { entityId: settlementId },
  });

  // When another user modifies the settlement
  useEffect(() => {
    if (data?.entityModified) {
      const { version, modifiedBy } = data.entityModified;

      // Show notification
      toast.warning(
        `Settlement was modified by another user. ` +
          `Current version is now ${version}. ` +
          `Please refresh to see changes.`
      );

      // Option 1: Auto-refresh the entity
      refetch();

      // Option 2: Lock the form to prevent conflicts
      setFormLocked(true);
    }
  }, [data]);

  // ... rest of component
}
```

**When Events Are Published:**

The `entity.modified.${entityId}` event is published by service methods whenever an entity is updated:

- `CampaignService.updateCampaign()`
- `SettlementService.updateSettlement()`, `setSettlementVariable()`, `setSettlementLevel()`
- `StructureService.updateStructure()`, `setStructureVariable()`, `setStructureLevel()`
- `LocationService.updateLocation()`
- `EventService.updateEvent()`, `completeEvent()`
- `EncounterService.updateEncounter()`, `resolveEncounter()`
- `CharacterService.updateCharacter()`
- `PartyService.updateParty()`, `setPartyLevel()`
- `KingdomService.updateKingdom()`
- All other entity update operations

**Best Practices:**

1. **Subscribe on mount, unsubscribe on unmount** - Apollo Client handles this automatically with `useSubscription`
2. **Handle stale data** - When you receive a modification event, either refetch the entity or lock the form
3. **Show user feedback** - Display notifications when concurrent edits are detected
4. **Retry failed updates** - If version conflict occurs, fetch latest version and retry update

**Example: Optimistic Locking with Subscription**

```typescript
function useOptimisticLocking(entityId: string) {
  const [localVersion, setLocalVersion] = useState<number>(1);
  const [isStale, setIsStale] = useState(false);

  // Subscribe to entity modifications
  useSubscription(ENTITY_MODIFIED_SUBSCRIPTION, {
    variables: { entityId },
    onData: ({ data }) => {
      const remoteVersion = data.data?.entityModified?.version;

      // If remote version is higher than local, data is stale
      if (remoteVersion && remoteVersion > localVersion) {
        setIsStale(true);
      }
    },
  });

  const updateEntity = async (input: UpdateInput) => {
    if (isStale) {
      throw new Error('Entity has been modified by another user. Please refresh.');
    }

    try {
      const result = await updateMutation({
        variables: {
          ...input,
          expectedVersion: localVersion, // Optimistic locking
        },
      });

      // Update local version on successful update
      setLocalVersion(result.data.updateEntity.version);
      setIsStale(false);

      return result;
    } catch (error) {
      if (error.extensions?.code === 'VERSION_CONFLICT') {
        setIsStale(true);
        throw new Error('Version conflict. Please refresh and try again.');
      }
      throw error;
    }
  };

  return {
    isStale,
    updateEntity,
    refresh: () => {
      // Refetch entity and update local version
      setIsStale(false);
    },
  };
}
```

---

## WebSocket Events

WebSocket events provide real-time updates for frontend applications. Events are organized into **rooms** based on entity scope (campaign, settlement, structure).

### Event Types

| Event                | Description                             | Triggered By                                  |
| -------------------- | --------------------------------------- | --------------------------------------------- |
| `entity_updated`     | Generic entity creation/update/deletion | All entity mutations                          |
| `state_invalidated`  | Cache invalidation trigger              | Variable changes, effect execution, mutations |
| `world_time_changed` | Campaign timeline progression           | Time advancement mutations                    |
| `settlement_updated` | Settlement CRUD operations              | Settlement mutations                          |
| `structure_updated`  | Structure CRUD operations               | Structure mutations                           |

### Room Organization

Clients subscribe to rooms to receive relevant events:

| Room Pattern                | Events Received               | Example                                           |
| --------------------------- | ----------------------------- | ------------------------------------------------- |
| `campaign:{campaignId}`     | All campaign-level events     | `campaign:550e8400-e29b-41d4-a716-446655440000`   |
| `settlement:{settlementId}` | Settlement and its structures | `settlement:660e8400-e29b-41d4-a716-446655440000` |
| `structure:{structureId}`   | Structure-specific events     | `structure:770e8400-e29b-41d4-a716-446655440000`  |

**Subscription Messages:**

```typescript
// Subscribe to campaign events
socket.emit('subscribe_campaign', { campaignId: '123' });

// Subscribe to settlement events (includes structures)
socket.emit('subscribe_settlement', { settlementId: '456' });

// Subscribe to structure events
socket.emit('subscribe_structure', { structureId: '789' });

// Unsubscribe
socket.emit('unsubscribe_campaign', { campaignId: '123' });
socket.emit('unsubscribe_settlement', { settlementId: '456' });
socket.emit('unsubscribe_structure', { structureId: '789' });
```

---

### entity_updated

Generic event for entity creation, update, or deletion.

**Event Name:** `entity_updated`

**Payload:**

```typescript
interface EntityUpdatedEvent {
  entityType: string; // "campaign" | "settlement" | "location" | "event" | etc.
  entityId: string; // UUID of the entity
  campaignId: string; // UUID of the parent campaign
  changedFields?: string[]; // Array of field names that changed (for updates)
  entityData: any; // Full entity data after change
}
```

**Example:**

```typescript
socket.on('entity_updated', (data: EntityUpdatedEvent) => {
  console.log(`${data.entityType} ${data.entityId} was updated`);

  if (data.changedFields) {
    console.log('Changed fields:', data.changedFields);
  }

  // Update local cache/state
  updateEntityInCache(data.entityType, data.entityId, data.entityData);
});
```

**Triggered By:**

- `createCampaign()`, `updateCampaign()`, `deleteCampaign()`
- `createSettlement()`, `updateSettlement()`, `deleteSettlement()`
- `createStructure()`, `updateStructure()`, `deleteStructure()`
- `createLocation()`, `updateLocation()`, `deleteLocation()`
- `createEvent()`, `updateEvent()`, `deleteEvent()`, `completeEvent()`
- `createEncounter()`, `updateEncounter()`, `deleteEncounter()`, `resolveEncounter()`
- `createCharacter()`, `updateCharacter()`, `deleteCharacter()`
- `createParty()`, `updateParty()`, `deleteParty()`
- All other entity CRUD operations

**Usage Pattern:**

```typescript
// React component listening for entity updates
function EntitySubscriber({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();

  useCampaignSubscription(campaignId, {
    onEntityUpdated: (event) => {
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries(['entity', event.entityType, event.entityId]);

      // Or optimistically update cache
      queryClient.setQueryData(['entity', event.entityType, event.entityId], event.entityData);
    },
  });

  return null; // This is a subscription-only component
}
```

---

### state_invalidated

Event indicating that cached state should be invalidated due to changes in variables, conditions, or effects.

**Event Name:** `state_invalidated`

**Payload:**

```typescript
interface StateInvalidatedEvent {
  campaignId: string; // UUID of the campaign
  scope: 'campaign' | 'entity'; // Scope of invalidation
  entityIds?: string[]; // Specific entities affected (if scope = 'entity')
  reason: string; // Human-readable reason for invalidation
}
```

**Example:**

```typescript
socket.on('state_invalidated', (data: StateInvalidatedEvent) => {
  if (data.scope === 'campaign') {
    // Invalidate all cached data for the campaign
    console.log(`Campaign ${data.campaignId} state invalidated: ${data.reason}`);
    invalidateCampaignCache(data.campaignId);
  } else if (data.scope === 'entity' && data.entityIds) {
    // Invalidate specific entities
    console.log(`Entities invalidated: ${data.entityIds.join(', ')}`);
    data.entityIds.forEach((id) => invalidateEntityCache(id));
  }
});
```

**Triggered By:**

- `setSettlementVariable()`, `setStructureVariable()` - Variable changes
- `executeEffect()`, `executeEffectsForEntity()` - Effect execution (state mutations)
- `createCondition()`, `updateCondition()`, `deleteCondition()` - Condition changes
- `completeEvent()`, `resolveEncounter()` - Workflow completion with effects
- `executeMerge()`, `cherryPickVersion()` - Branch operations affecting state

**Invalidation Scopes:**

| Scope      | When Used                            | Example                                      |
| ---------- | ------------------------------------ | -------------------------------------------- |
| `campaign` | Changes affect entire campaign state | Time progression, global variables           |
| `entity`   | Changes affect specific entities     | Settlement variable update, effect execution |

**Usage Pattern:**

```typescript
function CacheInvalidationHandler({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();

  useCampaignSubscription(campaignId, {
    onStateInvalidated: (event) => {
      if (event.scope === 'campaign') {
        // Invalidate all campaign queries
        queryClient.invalidateQueries(['campaign', campaignId]);
      } else if (event.entityIds) {
        // Invalidate specific entity queries
        event.entityIds.forEach((entityId) => {
          queryClient.invalidateQueries(['entity', entityId]);
        });
      }
    },
  });

  return null;
}
```

---

### world_time_changed

Event indicating that the campaign's world time has progressed.

**Event Name:** `world_time_changed`

**Payload:**

```typescript
interface WorldTimeChangedEvent {
  campaignId: string; // UUID of the campaign
  previousTime: string; // ISO 8601 date string (previous time)
  newTime: string; // ISO 8601 date string (new time)
  elapsed: {
    // Elapsed time breakdown
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
}
```

**Example:**

```typescript
socket.on('world_time_changed', (data: WorldTimeChangedEvent) => {
  console.log(`Time advanced from ${data.previousTime} to ${data.newTime}`);
  console.log(`Elapsed: ${data.elapsed.days} days, ${data.elapsed.hours} hours`);

  // Update UI to reflect new time
  updateWorldTimeClock(data.newTime);

  // Trigger time-dependent UI updates (e.g., scheduled events)
  refreshScheduledEvents(data.campaignId);
});
```

**Triggered By:**

- `advanceWorldTime()` - Manual time advancement
- Scheduler service - Periodic time progression (if enabled)
- Event completion - If event includes time advancement

**Usage Pattern:**

```typescript
function WorldTimeDisplay({ campaignId }: { campaignId: string }) {
  const [currentTime, setCurrentTime] = useState<string>('');

  useCampaignSubscription(campaignId, {
    onWorldTimeChanged: (event) => {
      setCurrentTime(event.newTime);

      // Show notification
      toast.info(
        `Time advanced by ${event.elapsed.days} days, ${event.elapsed.hours} hours`
      );
    },
  });

  return <div>Current Time: {currentTime}</div>;
}
```

---

### settlement_updated

Event for settlement creation, update, or deletion.

**Event Name:** `settlement_updated`

**Payload:**

```typescript
interface SettlementUpdatedEvent {
  settlementId: string; // UUID of the settlement
  campaignId: string; // UUID of the parent campaign
  operation: 'create' | 'update' | 'delete'; // CRUD operation
}
```

**Example:**

```typescript
socket.on('settlement_updated', (data: SettlementUpdatedEvent) => {
  console.log(`Settlement ${data.settlementId} was ${data.operation}d`);

  if (data.operation === 'create') {
    // Add settlement to list
    addSettlementToList(data.settlementId);
  } else if (data.operation === 'update') {
    // Refresh settlement data
    refetchSettlement(data.settlementId);
  } else if (data.operation === 'delete') {
    // Remove settlement from list
    removeSettlementFromList(data.settlementId);
  }
});
```

**Triggered By:**

- `createSettlement()` - Settlement creation
- `updateSettlement()`, `setSettlementVariable()`, `setSettlementLevel()` - Updates
- `deleteSettlement()`, `archiveSettlement()` - Deletion/archival

**Usage Pattern:**

```typescript
function SettlementList({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();

  useCampaignSubscription(campaignId, {
    onSettlementUpdated: (event) => {
      // Invalidate settlement list query
      queryClient.invalidateQueries(['settlements', campaignId]);

      if (event.operation !== 'delete') {
        // Also invalidate the specific settlement query
        queryClient.invalidateQueries(['settlement', event.settlementId]);
      }
    },
  });

  // ... render settlement list
}
```

---

### structure_updated

Event for structure creation, update, or deletion.

**Event Name:** `structure_updated`

**Payload:**

```typescript
interface StructureUpdatedEvent {
  structureId: string; // UUID of the structure
  settlementId: string; // UUID of the parent settlement
  campaignId: string; // UUID of the parent campaign
  operation: 'create' | 'update' | 'delete'; // CRUD operation
}
```

**Example:**

```typescript
socket.on('structure_updated', (data: StructureUpdatedEvent) => {
  console.log(
    `Structure ${data.structureId} in settlement ${data.settlementId} was ${data.operation}d`
  );

  if (data.operation === 'create') {
    addStructureToSettlement(data.settlementId, data.structureId);
  } else if (data.operation === 'update') {
    refetchStructure(data.structureId);
  } else if (data.operation === 'delete') {
    removeStructureFromSettlement(data.settlementId, data.structureId);
  }
});
```

**Triggered By:**

- `createStructure()` - Structure creation
- `updateStructure()`, `setStructureVariable()`, `setStructureLevel()` - Updates
- `deleteStructure()`, `archiveStructure()` - Deletion/archival

**Usage Pattern:**

```typescript
function SettlementStructures({ settlementId }: { settlementId: string }) {
  const queryClient = useQueryClient();

  useSettlementSubscription(settlementId, {
    onStructureUpdated: (event) => {
      // Invalidate structure list query
      queryClient.invalidateQueries(['structures', settlementId]);

      if (event.operation !== 'delete') {
        // Also invalidate the specific structure query
        queryClient.invalidateQueries(['structure', event.structureId]);
      }
    },
  });

  // ... render structure list
}
```

---

## Authentication & Authorization

### GraphQL Subscription Auth

GraphQL subscriptions require a valid JWT token passed during connection establishment.

**Connection with Token:**

```typescript
import { createClient } from 'graphql-ws';

const wsClient = createClient({
  url: 'ws://localhost:3000/graphql',
  connectionParams: {
    authentication: `Bearer ${jwtToken}`, // JWT token
  },
});
```

**Authorization:**

- All subscriptions require authentication
- User must have access to the entity being subscribed to
- Access is validated based on campaign membership

### WebSocket Event Auth

WebSocket events also require JWT authentication during connection.

**Connection with Token:**

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/events', {
  auth: {
    token: jwtToken, // JWT token
  },
});
```

**Room Authorization:**

When subscribing to rooms, authorization is checked:

| Room Type         | Authorization Check                                     |
| ----------------- | ------------------------------------------------------- |
| `campaign:{id}`   | `CampaignMembershipService.canView(campaignId, userId)` |
| `settlement:{id}` | Inherited from parent campaign                          |
| `structure:{id}`  | Inherited from parent settlement/campaign               |

**Unauthorized Subscription:**

```typescript
socket.emit('subscribe_campaign', { campaignId: 'unauthorized-id' });

// Server responds with error
socket.on('error', (error) => {
  console.error('Subscription error:', error);
  // error: { message: 'Not authorized to view campaign' }
});
```

---

## Frontend Integration

### Apollo Client Setup

Configure Apollo Client with split link to route subscriptions to WebSocket.

**Full Setup:**

```typescript
import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

// HTTP link for queries and mutations
const httpLink = new HttpLink({
  uri: 'http://localhost:3000/graphql',
  headers: {
    authorization: `Bearer ${token}`,
  },
});

// WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: 'ws://localhost:3000/graphql',
    connectionParams: {
      authentication: `Bearer ${token}`,
    },
    // Automatic reconnection
    retryAttempts: 5,
    shouldRetry: () => true,
  })
);

// Split link based on operation type
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
  },
  wsLink, // Use WebSocket for subscriptions
  httpLink // Use HTTP for queries/mutations
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
```

### React Hooks

The frontend provides specialized hooks for WebSocket subscriptions.

**useCampaignSubscription:**

```typescript
import { useCampaignSubscription } from '@/hooks/useWebSocketSubscription';

function CampaignView({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();

  useCampaignSubscription(campaignId, {
    onEntityUpdated: (event) => {
      // Invalidate entity queries
      queryClient.invalidateQueries(['entity', event.entityType, event.entityId]);
    },
    onStateInvalidated: (event) => {
      if (event.scope === 'campaign') {
        queryClient.invalidateQueries(['campaign', campaignId]);
      } else if (event.entityIds) {
        event.entityIds.forEach((id) => {
          queryClient.invalidateQueries(['entity', id]);
        });
      }
    },
    onWorldTimeChanged: (event) => {
      // Update world time display
      queryClient.setQueryData(['worldTime', campaignId], event.newTime);
    },
    onSettlementUpdated: (event) => {
      queryClient.invalidateQueries(['settlements', campaignId]);
    },
    onStructureUpdated: (event) => {
      queryClient.invalidateQueries(['structures', event.settlementId]);
    },
  });

  // ... render campaign view
}
```

**useSettlementSubscription:**

```typescript
import { useSettlementSubscription } from '@/hooks/useWebSocketSubscription';

function SettlementView({ settlementId }: { settlementId: string }) {
  const queryClient = useQueryClient();

  useSettlementSubscription(settlementId, {
    onSettlementUpdated: (event) => {
      queryClient.invalidateQueries(['settlement', settlementId]);
    },
    onStructureUpdated: (event) => {
      queryClient.invalidateQueries(['structure', event.structureId]);
    },
  });

  // ... render settlement view
}
```

**useStructureSubscription:**

```typescript
import { useStructureSubscription } from '@/hooks/useWebSocketSubscription';

function StructureView({ structureId }: { structureId: string }) {
  const queryClient = useQueryClient();

  useStructureSubscription(structureId, {
    onStructureUpdated: (event) => {
      queryClient.invalidateQueries(['structure', structureId]);
    },
  });

  // ... render structure view
}
```

**Generic Hook:**

For custom subscriptions, use the generic hook:

```typescript
import { useWebSocketSubscription } from '@/hooks/useWebSocketSubscription';

function CustomSubscriber({ campaignId }: { campaignId: string }) {
  useWebSocketSubscription(
    'entity_updated', // Event type
    (event: EntityUpdatedEvent) => {
      // Handler
      console.log('Entity updated:', event);
    },
    { type: 'subscribe_campaign', campaignId }, // Subscribe message
    { type: 'unsubscribe_campaign', campaignId }, // Unsubscribe message
    true // Enabled
  );

  return null;
}
```

---

## Best Practices

### 1. Use Room-Based Subscriptions Efficiently

**Good:**

```typescript
// Subscribe once at campaign level
useCampaignSubscription(campaignId, handlers);
```

**Bad:**

```typescript
// Don't subscribe to every entity individually
settlements.forEach((s) => useSettlementSubscription(s.id, handlers));
```

### 2. Invalidate Queries, Don't Fetch Directly

**Good:**

```typescript
onEntityUpdated: (event) => {
  // Let React Query handle refetching
  queryClient.invalidateQueries(['entity', event.entityId]);
};
```

**Bad:**

```typescript
onEntityUpdated: async (event) => {
  // Don't fetch manually
  const data = await fetchEntity(event.entityId);
  setEntity(data);
};
```

### 3. Handle Reconnection Gracefully

```typescript
socket.on('connect', () => {
  console.log('Connected');
  // Re-subscribe to rooms after reconnection
  socket.emit('subscribe_campaign', { campaignId });
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server disconnected, manually reconnect
    socket.connect();
  }
});
```

### 4. Clean Up Subscriptions

```typescript
useEffect(() => {
  socket.emit('subscribe_campaign', { campaignId });

  return () => {
    socket.emit('unsubscribe_campaign', { campaignId });
  };
}, [campaignId]);
```

### 5. Combine with Optimistic Updates

```typescript
const [updateSettlement] = useMutation(UPDATE_SETTLEMENT, {
  optimisticResponse: {
    updateSettlement: {
      __typename: 'Settlement',
      id: settlementId,
      name: newName,
      version: currentVersion + 1,
    },
  },
});

// When the subscription event arrives, it will overwrite the optimistic update
useCampaignSubscription(campaignId, {
  onEntityUpdated: (event) => {
    queryClient.setQueryData(['settlement', event.entityId], event.entityData);
  },
});
```

### 6. Debounce High-Frequency Events

```typescript
import { debounce } from 'lodash';

const handleStateInvalidated = debounce((event) => {
  queryClient.invalidateQueries(['campaign', event.campaignId]);
}, 300);

useCampaignSubscription(campaignId, {
  onStateInvalidated: handleStateInvalidated,
});
```

### 7. Log Subscription Events in Development

```typescript
if (process.env.NODE_ENV === 'development') {
  socket.onAny((eventName, ...args) => {
    console.log(`[WebSocket] ${eventName}:`, args);
  });
}
```

### 8. Handle Concurrent Edits with Subscriptions

```typescript
function useOptimisticLockingWithSubscription(entityId: string) {
  const [isStale, setIsStale] = useState(false);

  useSubscription(ENTITY_MODIFIED_SUBSCRIPTION, {
    variables: { entityId },
    onData: ({ data }) => {
      // Mark as stale when modified by another user
      setIsStale(true);
      toast.warning('Entity was modified by another user');
    },
  });

  return { isStale };
}
```

---

## Troubleshooting

### Connection Issues

**Symptom:** WebSocket connection fails or disconnects frequently

**Diagnosis:**

```typescript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

**Solutions:**

1. Check JWT token is valid and not expired
2. Verify WebSocket endpoint URL is correct
3. Check network/firewall settings allow WebSocket connections
4. For production, ensure TLS/WSS is properly configured

### Authorization Errors

**Symptom:** `error` events when subscribing to rooms

**Diagnosis:**

```typescript
socket.on('error', (error) => {
  console.error('Subscription error:', error);
});
```

**Solutions:**

1. Verify user has access to the campaign
2. Check JWT token includes correct user ID
3. Ensure campaign membership exists in database

### Missing Events

**Symptom:** Events not received even though entity is modified

**Diagnosis:**

```typescript
// Check if subscribed to the correct room
socket.emit('subscribe_campaign', { campaignId });

// Verify connection
console.log('Connected:', socket.connected);
```

**Solutions:**

1. Verify you're subscribed to the correct room (campaign/settlement/structure)
2. Check that the mutation is actually publishing events (check backend logs)
3. Ensure WebSocket connection is active (`socket.connected === true`)

### Duplicate Events

**Symptom:** Receiving the same event multiple times

**Diagnosis:**

```typescript
// Check for multiple subscriptions
socket.on('entity_updated', handler1);
socket.on('entity_updated', handler2); // Duplicate!
```

**Solutions:**

1. Use `socket.off(eventName)` before adding new listeners
2. Only subscribe once per room (use `useEffect` cleanup)
3. Avoid creating new socket instances unnecessarily

### Memory Leaks

**Symptom:** Application slows down over time, memory usage grows

**Diagnosis:**

```typescript
// Check for missing cleanup
useEffect(() => {
  socket.emit('subscribe_campaign', { campaignId });

  // Missing return function causes memory leak!
}, [campaignId]);
```

**Solutions:**

1. Always clean up subscriptions in `useEffect` return
2. Remove event listeners when component unmounts
3. Unsubscribe from rooms when no longer needed

**Correct Pattern:**

```typescript
useEffect(() => {
  socket.emit('subscribe_campaign', { campaignId });

  const handler = (event) => {
    // Handle event
  };

  socket.on('entity_updated', handler);

  return () => {
    socket.off('entity_updated', handler);
    socket.emit('unsubscribe_campaign', { campaignId });
  };
}, [campaignId]);
```

---

## Related Documentation

- **[GraphQL Overview](./graphql-overview.md)** - Schema organization, authentication, authorization
- **[Queries](./queries.md)** - All available GraphQL queries with examples
- **[Mutations](./mutations.md)** - All available GraphQL mutations with examples
- **[Error Handling](./error-handling.md)** - GraphQL error format, common error codes
- **[Real-time Updates Feature](../features/realtime-updates.md)** - Complete technical documentation of WebSocket implementation
- **[Frontend Guide](../development/frontend-guide.md)** - React hooks, Apollo Client setup, testing patterns

---

**Next Steps:**

1. Set up Apollo Client with subscription support
2. Implement `useWebSocketSubscription` hooks in your components
3. Subscribe to relevant rooms based on current view
4. Handle subscription events to invalidate queries or update cache
5. Test concurrent edit detection with multiple users
6. Monitor subscription connection in production
