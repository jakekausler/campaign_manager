# Real-time Updates - WebSocket/Redis Integration

Bidirectional WebSocket communication system for pushing state changes and cache invalidations to connected clients in real-time.

## Overview

The Real-time Updates system uses Socket.IO with Redis pub/sub to synchronize application state across multiple users and browser tabs. When any user modifies data (campaigns, settlements, structures, world time, etc.), all connected clients receive immediate updates without manual refresh.

**Implementation**: TICKET-029 (8 stages, commits: cdc825c - [current])

## Features

### Core Infrastructure

- **WebSocket Gateway**: Socket.IO server with JWT authentication
- **Redis Pub/Sub Adapter**: Multi-instance event distribution across API servers
- **Room-Based Subscriptions**: Campaign, settlement, and structure-scoped event rooms
- **Event Type System**: Type-safe event definitions with discriminated unions
- **Auto-Reconnection**: Exponential backoff with circuit breaker
- **Health Monitoring**: Built-in ping/pong monitoring
- **Cache Synchronization**: Apollo Client cache invalidation on events

### Backend Components

#### WebSocket Gateway (`packages/api/src/websocket/`)

**Purpose**: Manages WebSocket connections, authentication, and room subscriptions.

**Key Files**:

- `websocket.gateway.ts` - Socket.IO gateway with connection handlers
- `websocket.module.ts` - NestJS module configuration
- `websocket-publisher.service.ts` - Service for publishing events to rooms
- `types.ts` - Room naming conventions and TypeScript interfaces

**Connection Flow**:

1. Client connects with JWT token in handshake (`auth.token` or `query.token`)
2. Gateway validates token using `JwtService.verify()`
3. Authenticated user data stored in `socket.data`
4. Client can now subscribe to rooms (campaign, settlement, structure)

**Room Naming Conventions**:

- Campaign rooms: `campaign:{campaignId}`
- Settlement rooms: `settlement:{settlementId}`
- Structure rooms: `structure:{structureId}`

**Authorization**:

- Campaign subscriptions: `CampaignMembershipService.canView(campaignId, userId)`
- Settlement subscriptions: Inherits campaign authorization via parent lookup
- Structure subscriptions: Inherits settlement authorization via parent lookup

**Redis Integration**:

- Socket.IO Redis adapter automatically synchronizes events across all API instances
- Events emitted on one server reach all connected clients on all servers
- No manual pub/sub code required - Socket.IO handles it transparently

#### Event Publisher Service (`websocket-publisher.service.ts`)

**Purpose**: Provides type-safe API for domain services to publish events.

**Methods**:

- `publishEntityUpdated(event)` - Generic entity updates
- `publishStateInvalidated(event)` - Cache invalidation triggers
- `publishWorldTimeChanged(event)` - World time progression
- `publishSettlementUpdated(event)` - Settlement changes
- `publishStructureUpdated(event)` - Structure changes

**Room Targeting Logic**:

- Entity updates → campaign room + entity-specific room (if applicable)
- State invalidation → campaign room
- World time → campaign room
- Settlement updates → campaign + settlement rooms
- Structure updates → campaign + settlement + structure rooms

#### Domain Service Integration

**Modified Services**:

- `CampaignService` - Emits `entity_updated` on CRUD operations
- `SettlementService` - Emits `settlement_updated` with operation type
- `StructureService` - Emits `structure_updated` with operation type
- `WorldTimeService` - Emits `world_time_changed` when time advances

**Integration Pattern**:

```typescript
// Inject publisher service
constructor(
  private readonly wsPublisher: WebSocketPublisherService,
  // ...other services
) {}

// Emit events after successful operations
async updateSettlement(id: string, data: UpdateSettlementInput) {
  const updated = await this.prisma.settlement.update({...});

  // Publish WebSocket event
  await this.wsPublisher.publishSettlementUpdated(
    createSettlementUpdatedEvent({
      settlementId: id,
      operation: 'update',
      changedFields: ['name', 'level'],
      campaignId: settlement.kingdom.campaignId,
      userId: context.userId,
      source: 'api',
    })
  );

  return updated;
}
```

### Frontend Components

#### WebSocket Context (`packages/frontend/src/contexts/WebSocketContext.tsx`)

**Purpose**: Manages single global Socket.IO connection for entire application.

**Features**:

- **Connection Management**: Connects only when user is authenticated
- **JWT Authentication**: Passes token via `auth.token` handshake parameter
- **Connection States**: Connecting, Connected, Disconnected, Error
- **Exponential Backoff**: 1s → 2s → 4s → 8s → 16s → 32s (max delay)
- **Circuit Breaker**: Stops after 10 failed attempts (~17 minutes)
- **Token Refresh**: Automatically reconnects when auth token changes
- **Health Monitoring**: Ping/pong event handlers for debugging
- **Cleanup**: Proper listener removal and timeout clearing on unmount

**React Hooks**:

- `useWebSocket()` - Full access to socket, connection state, error, reconnect attempts
- `useWebSocketConnection()` - Convenience hook for connection state only

**Connection State Enum**:

```typescript
enum ConnectionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Error = 'Error',
}
```

**Usage**:

```typescript
// In App.tsx
<WebSocketProvider>
  <YourAppComponents />
</WebSocketProvider>

// In components
const { socket, connectionState } = useWebSocket();
const { connectionState } = useWebSocketConnection(); // Simpler API
```

#### Connection Indicator (`packages/frontend/src/components/ConnectionIndicator.tsx`)

**Purpose**: Visual indicator of WebSocket connection status in UI header.

**Features**:

- **Color-Coded Status**:
  - Green: Connected
  - Yellow: Connecting
  - Red: Error
  - Gray: Disconnected
- **Auto-Hide**: Hides 3 seconds after successful connection (reduces UI clutter)
- **Reconnection Counter**: Shows attempt number during reconnection
- **Circuit Breaker Notification**: Shows "(Max retries reached)" when circuit trips
- **Authenticated Users Only**: Only visible when user is logged in

**Location**: Positioned in `MainLayout` header next to branch selector

#### Subscription Hooks (`packages/frontend/src/hooks/useWebSocketSubscription.ts`)

**Purpose**: React hooks for subscribing to WebSocket events with automatic lifecycle management.

**Generic Hook - `useWebSocketSubscription`**:

```typescript
useWebSocketSubscription<T extends WebSocketEvent>({
  eventType: 'entity_updated',
  room: `campaign:${campaignId}`,
  handler: (event: T) => {
    // Handle event
  },
  enabled: true, // Optional: disable subscription conditionally
});
```

**Features**:

- Subscribes to room on mount
- Automatically re-subscribes after reconnection
- Unsubscribes on unmount or when room/handler changes
- Type-safe event handlers via generics
- Race condition prevention (sets subscription flag before emit)
- Debug logging controlled by `env.features.debug`

**Specialized Hooks**:

- `useCampaignSubscription(campaignId, handlers)` - All campaign events
- `useSettlementSubscription(settlementId, handlers)` - Settlement events
- `useStructureSubscription(structureId, handlers)` - Structure events

**Event Handler Types**:

```typescript
type CampaignEventHandlers = {
  onEntityUpdated?: (event: EntityUpdatedEvent) => void;
  onStateInvalidated?: (event: StateInvalidatedEvent) => void;
  onWorldTimeChanged?: (event: WorldTimeChangedEvent) => void;
  onSettlementUpdated?: (event: SettlementUpdatedEvent) => void;
  onStructureUpdated?: (event: StructureUpdatedEvent) => void;
};
```

#### Cache Sync Hook (`packages/frontend/src/hooks/useWebSocketCacheSync.ts`)

**Purpose**: Centralized hook for synchronizing Apollo cache and Zustand state with WebSocket events.

**Features**:

- Subscribes to campaign WebSocket events
- Routes events to specialized handlers based on event type
- Updates Apollo cache via `cache.evict()` + `cache.gc()` pattern
- Updates Zustand store for world time
- Mounted once at app level in `App.tsx`

**Event Handling Strategies**:

| Event Type           | Strategy                                  | Impact                           |
| -------------------- | ----------------------------------------- | -------------------------------- |
| `entity_updated`     | Evict specific entity by typename + ID    | Forces refetch on next query     |
| `state_invalidated`  | Evict computed fields by scope            | Campaign-wide or entity-specific |
| `world_time_changed` | Update Zustand store + evict time queries | Immediate UI feedback            |
| `settlement_updated` | Evict entity + parent queries             | Handles create/update/delete     |
| `structure_updated`  | Evict entity + parent queries             | Handles create/update/delete     |

**Cache Eviction Pattern**:

```typescript
// Evict specific entity
cache.evict({
  id: cache.identify({ __typename: 'Settlement', id: settlementId }),
});

// Evict list queries
cache.evict({ fieldName: 'settlementsByKingdom' });

// Clean up dangling references
cache.gc();
```

**Integration**:

```typescript
// In App.tsx
function AppWithCacheSync() {
  const activeCampaignId = useActiveCampaignId();

  // Enable cache sync for active campaign
  useWebSocketCacheSync({
    campaignId: activeCampaignId,
    enabled: !!activeCampaignId,
  });

  return <YourApp />;
}
```

### Event Type System (`packages/shared/src/types/websocket-events.ts`)

**Purpose**: Type-safe event definitions shared between backend and frontend.

**Event Types** (Discriminated Union):

#### 1. EntityUpdatedEvent

Generic entity updates (campaign, location, encounter, etc.)

```typescript
{
  type: 'entity_updated';
  payload: {
    entityType: string;        // 'campaign', 'location', 'encounter', etc.
    entityId: string;
    campaignId: string;
    changedFields: string[];   // ['name', 'description']
  };
  metadata: {
    timestamp: string;
    userId: string;
    source: 'api' | 'rules-engine' | 'scheduler';
    correlationId?: string;
  };
}
```

#### 2. StateInvalidatedEvent

Cache invalidation triggers for computed state

```typescript
{
  type: 'state_invalidated';
  payload: {
    scope: 'campaign' | 'entity';
    campaignId: string;
    entityType?: string;       // Present when scope = 'entity'
    entityId?: string;         // Present when scope = 'entity'
    affectedFields: string[];  // ['condition_result', 'computed_value']
  };
  metadata: { ... };
}
```

#### 3. WorldTimeChangedEvent

World time progression notifications

```typescript
{
  type: 'world_time_changed';
  payload: {
    campaignId: string;
    previousTime: string;      // ISO 8601 timestamp
    newTime: string;           // ISO 8601 timestamp
    elapsedSeconds: number;
  };
  metadata: { ... };
}
```

#### 4. SettlementUpdatedEvent

Settlement-specific updates with operation type

```typescript
{
  type: 'settlement_updated';
  payload: {
    settlementId: string;
    operation: 'create' | 'update' | 'delete';
    campaignId: string;
    changedFields: string[];   // ['name', 'level', 'variables']
  };
  metadata: { ... };
}
```

#### 5. StructureUpdatedEvent

Structure-specific updates with operation type

```typescript
{
  type: 'structure_updated';
  payload: {
    structureId: string;
    settlementId: string;      // Parent settlement
    operation: 'create' | 'update' | 'delete';
    campaignId: string;
    changedFields: string[];   // ['name', 'type', 'level']
  };
  metadata: { ... };
}
```

**Helper Functions**:

- `createEntityUpdatedEvent(payload)` - Factory for EntityUpdatedEvent
- `createStateInvalidatedEvent(payload)` - Factory for StateInvalidatedEvent
- `createWorldTimeChangedEvent(payload)` - Factory for WorldTimeChangedEvent
- `createSettlementUpdatedEvent(payload)` - Factory for SettlementUpdatedEvent
- `createStructureUpdatedEvent(payload)` - Factory for StructureUpdatedEvent
- `isWebSocketEvent(data)` - Type guard for validating events

### Error Handling & Resilience

#### Circuit Breaker

- **Max Attempts**: 10 failed reconnections (~17 minutes total with exponential backoff)
- **Behavior**: After max attempts, connection state set to Error, user must refresh page
- **Purpose**: Prevents infinite reconnection loops and battery drain on mobile devices
- **Error Message**: "Unable to connect after multiple attempts. Please refresh the page."

#### Exponential Backoff

- **Pattern**: baseDelay × 2^attempt, capped at maxDelay
- **Delays**: 1s, 2s, 4s, 8s, 16s, 32s (max)
- **Reset**: Reconnect attempt counter resets on successful connection

#### Health Monitoring

- **Socket.IO Built-in**: 25s ping interval, 5s timeout
- **Explicit Handlers**: Ping/pong event handlers for debugging
- **Auto-Reconnection**: Automatic reconnection on health check failure

#### Edge Case Handling

| Scenario             | Behavior                                                 |
| -------------------- | -------------------------------------------------------- |
| **Multiple Tabs**    | Each tab has independent connection, all receive updates |
| **Network Switches** | Auto-reconnect with exponential backoff                  |
| **Server Restarts**  | Clients auto-reconnect when server returns               |
| **Redis Failures**   | Backend handles gracefully, connections maintained       |
| **Token Expiration** | Seamless reconnection with new token (no error states)   |
| **Circuit Breaker**  | Stops after 10 attempts, user must refresh               |

#### Error Logging

- Connection errors: `console.error()` with structured messages
- Subscription errors: Logged in hooks with context
- Event handling errors: Logged in cache sync with event details
- Debug mode: Controlled by `env.features.debug` flag

## Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend Clients                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  Browser 1 │  │  Browser 2 │  │  Browser 3 │             │
│  │   (Tab A)  │  │   (Tab A)  │  │   (Tab B)  │             │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘             │
│         │                │                │                   │
│         │  Socket.IO     │  Socket.IO     │  Socket.IO       │
│         │  Connection    │  Connection    │  Connection      │
└─────────┼────────────────┼────────────────┼───────────────────┘
          │                │                │
          ↓                ↓                ↓
┌──────────────────────────────────────────────────────────────┐
│                    API Load Balancer                         │
└──────────────────────────────────────────────────────────────┘
          │                │                │
          ↓                ↓                ↓
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  API Instance 1 │  │  API Instance 2 │  │  API Instance 3 │
│                 │  │                 │  │                 │
│  WebSocket      │  │  WebSocket      │  │  WebSocket      │
│  Gateway        │  │  Gateway        │  │  Gateway        │
│                 │  │                 │  │                 │
│  Publisher      │  │  Publisher      │  │  Publisher      │
│  Service        │  │  Service        │  │  Service        │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │
         │   Socket.IO Redis Adapter (Pub/Sub)     │
         └────────────────────┼─────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  Redis Server   │
                    │                 │
                    │  Pub/Sub        │
                    │  Channels       │
                    └─────────────────┘
```

### Event Flow

```
1. User A edits settlement in Browser 1
   ↓
2. Frontend calls GraphQL mutation
   ↓
3. SettlementService.updateSettlement() executes
   ↓
4. After DB update, SettlementService emits event:
   wsPublisher.publishSettlementUpdated(...)
   ↓
5. WebSocketPublisherService publishes to rooms:
   - campaign:{campaignId}
   - settlement:{settlementId}
   ↓
6. Socket.IO Redis adapter propagates event to ALL API instances
   ↓
7. All WebSocket gateways receive event from Redis
   ↓
8. Each gateway broadcasts to subscribed clients in rooms
   ↓
9. Frontend clients receive event via Socket.IO
   ↓
10. useCampaignSubscription hook invokes event handler
   ↓
11. useWebSocketCacheSync evicts Apollo cache entries
   ↓
12. UI components re-render with fresh data
   ↓
13. User B sees settlement update in real-time (no refresh!)
```

### Multi-Instance Synchronization

The Socket.IO Redis adapter ensures events propagate across all API instances:

```
API Instance 1                Redis Pub/Sub               API Instance 2
─────────────────────────────────────────────────────────────────────

Publisher emits event   ──────────────┐
  ↓                                   │
Socket.IO server        ──────────────┤
  ↓                                   ├───► Redis Pub
Socket.IO Redis adapter ──────────────┘      channel
                                             "socket.io"
                                                 │
                                                 │
                                                 ↓
                                             Redis Sub
                                             channel
                                             "socket.io"
                                                 │
         ┌───────────────────────────────────────┘
         │
         ├───────────────┐
         │               │
         ↓               ↓
Socket.IO Redis adapter receives
         ↓
Socket.IO server broadcasts to clients
         ↓
Clients connected to Instance 2 receive event
```

## Usage Guide

### For Backend Developers

#### Adding a New Event Type

1. **Define Event Type** in `packages/shared/src/types/websocket-events.ts`:

```typescript
export interface MyNewEvent {
  type: 'my_new_event';
  payload: {
    // Your payload fields
  };
  metadata: EventMetadata;
}

// Add to discriminated union
export type WebSocketEvent = EntityUpdatedEvent | StateInvalidatedEvent | MyNewEvent; // Add here

// Create helper function
export function createMyNewEvent(data: MyNewEventPayload): MyNewEvent {
  return {
    type: 'my_new_event',
    payload: data,
    metadata: {
      timestamp: new Date().toISOString(),
      userId: data.userId,
      source: data.source,
      correlationId: data.correlationId,
    },
  };
}
```

2. **Add Publisher Method** in `websocket-publisher.service.ts`:

```typescript
async publishMyNewEvent(event: MyNewEvent): Promise<void> {
  const room = getRoomName(RoomType.CAMPAIGN, event.payload.campaignId);
  this.server.to(room).emit('my_new_event', event);

  if (env.features.debug) {
    console.log(`[WebSocket] Published my_new_event to ${room}`, event);
  }
}
```

3. **Emit from Domain Service**:

```typescript
async myOperation(id: string) {
  // Do your operation
  const result = await this.prisma.myEntity.update({...});

  // Emit event
  await this.wsPublisher.publishMyNewEvent(
    createMyNewEvent({
      campaignId: result.campaignId,
      // ...other fields
      userId: context.userId,
      source: 'api',
    })
  );

  return result;
}
```

### For Frontend Developers

#### Subscribing to Events in a Component

```typescript
import { useCampaignSubscription } from '@/hooks/useWebSocketSubscription';

function MyCampaignComponent() {
  const { activeCampaignId } = useActiveCampaign();

  useCampaignSubscription(activeCampaignId, {
    onEntityUpdated: (event) => {
      console.log('Entity updated:', event.payload);
      // Handle entity update
    },
    onWorldTimeChanged: (event) => {
      console.log('World time changed:', event.payload);
      // Handle time change
    },
    // Add other handlers as needed
  });

  return <div>Your component</div>;
}
```

#### Subscribing to Settlement Events

```typescript
import { useSettlementSubscription } from '@/hooks/useWebSocketSubscription';

function SettlementDetailPage() {
  const { settlementId } = useParams();

  useSettlementSubscription(settlementId, {
    onSettlementUpdated: (event) => {
      if (event.payload.operation === 'delete') {
        // Navigate away or show deleted message
      } else {
        // Refresh settlement data
      }
    },
    onStructureUpdated: (event) => {
      // Handle structure changes within this settlement
    },
  });

  return <div>Settlement details</div>;
}
```

#### Manual Cache Invalidation

If you need to manually invalidate cache (beyond the automatic sync):

```typescript
import { useApolloClient } from '@apollo/client';

function MyComponent() {
  const client = useApolloClient();

  const handleEvent = (event: WebSocketEvent) => {
    // Evict specific entity
    client.cache.evict({
      id: client.cache.identify({
        __typename: 'Settlement',
        id: event.payload.settlementId,
      }),
    });

    // Evict list queries
    client.cache.evict({ fieldName: 'settlementsByKingdom' });

    // Clean up dangling references
    client.cache.gc();
  };

  return <div>Your component</div>;
}
```

## Testing

### Backend Tests

**Location**: `packages/api/src/websocket/*.test.ts`

**Test Suites**:

- Gateway initialization (10 tests)
- Connection authentication (6 tests)
- Subscription authorization (9 tests)
- Room management (6 tests)
- Event publishing (32 tests)

**Total**: 63 backend WebSocket tests

**Running Tests**:

```bash
# Run all WebSocket tests
pnpm --filter @campaign/api test -- websocket

# Run specific test file
pnpm --filter @campaign/api test -- websocket.gateway.test.ts
```

### Frontend Tests

**Location**: `packages/frontend/src/contexts/*.test.tsx`, `packages/frontend/src/hooks/*.test.tsx`

**Test Suites**:

- WebSocketContext (36 tests)
  - Connection management
  - Authentication
  - Reconnection logic
  - Circuit breaker
  - Token refresh
  - Health monitoring
- useWebSocketSubscription (15 tests)
  - Subscription lifecycle
  - Event handling
  - Reconnection behavior
  - Race condition prevention
- useWebSocketCacheSync (16 tests)
  - Cache eviction strategies
  - Event routing
  - Zustand integration

**Total**: 67 frontend WebSocket tests

**Running Tests**:

```bash
# Run all WebSocket tests
pnpm --filter @campaign/frontend test -- WebSocket

# Run specific test file
pnpm --filter @campaign/frontend test -- WebSocketContext.test.tsx
```

### Integration Testing

**Manual Test Scenarios**:

1. **Multi-User Sync**:
   - Open two browsers with different users
   - Edit settlement in Browser 1
   - Verify Browser 2 sees update without refresh

2. **Multi-Tab Sync**:
   - Open two tabs with same user
   - Edit settlement in Tab 1
   - Verify Tab 2 sees update without refresh

3. **Reconnection**:
   - Connect to app
   - Use browser dev tools to simulate offline (Network tab → Offline)
   - Wait 5-10 seconds
   - Re-enable network
   - Verify connection recovers and events resume

4. **Circuit Breaker**:
   - Stop backend server
   - Connect frontend client
   - Observe reconnection attempts in ConnectionIndicator
   - After 10 attempts (~17 minutes), verify Error state
   - Restart server
   - Refresh browser, verify connection resumes

5. **Token Refresh**:
   - Connect to app
   - Wait for token to be near expiration
   - Trigger token refresh (implementation-specific)
   - Verify WebSocket reconnects automatically with new token
   - No error states or disruption to user

6. **Network Switch**:
   - Connect to app on WiFi
   - Switch to mobile data (or vice versa)
   - Verify connection recovers automatically

## Troubleshooting

### Connection Issues

**Problem**: Frontend can't connect to WebSocket

**Solutions**:

- Check JWT token is valid and not expired
- Verify `VITE_WEBSOCKET_URL` environment variable is set correctly
- Check CORS settings in backend allow WebSocket connections
- Inspect browser console for connection errors
- Check ConnectionIndicator for current status

### Events Not Received

**Problem**: Frontend doesn't receive events after mutation

**Solutions**:

- Verify subscription is active (check subscription hook enabled state)
- Check room names match (campaign ID must be correct)
- Verify event is being emitted in backend service
- Check Redis is running and connected
- Enable debug mode (`env.features.debug = true`) to see event logs

### High Reconnection Rate

**Problem**: Client keeps disconnecting and reconnecting

**Solutions**:

- Check network stability
- Verify backend servers are healthy
- Check Redis connection is stable
- Inspect circuit breaker status (may be tripping)
- Review health check timeouts (25s ping interval)

### Cache Not Updating

**Problem**: UI doesn't refresh after receiving event

**Solutions**:

- Verify `useWebSocketCacheSync` is mounted in App.tsx
- Check Apollo cache eviction logic for event type
- Enable debug mode to see cache operations
- Verify event payload contains required IDs (campaignId, entityId)
- Check TypeScript types match between event and cache operations

### Performance Issues

**Problem**: Too many events causing lag

**Solutions**:

- Implement event batching (debounce events on backend)
- Reduce event frequency (e.g., don't emit on every keystroke)
- Use more specific event types instead of generic entity_updated
- Consider implementing event filtering on client-side
- Review cache eviction strategy (evicting too much causes thrashing)

## Known Limitations

1. **No Message Persistence**: Events are transient. Clients disconnected during event emission miss the update (mitigated by cache refetch on reconnect).

2. **No Event Ordering Guarantees**: Redis pub/sub doesn't guarantee message order across multiple API instances. Unlikely to cause issues in practice, but conflicts possible under high load.

3. **No Automatic Conflict Resolution**: If two users edit same entity simultaneously, last write wins. Future enhancement: Operational Transform (OT) or CRDTs.

4. **Limited Retry Logic**: Circuit breaker stops after 10 attempts. User must manually refresh. Future enhancement: Fallback to polling.

5. **Binary Data Not Supported**: Event payloads are JSON. Large binary data (images, files) should use separate upload mechanism.

6. **No Offline Queue**: Events emitted while client is offline are lost. Future enhancement: Queue events in Redis with expiration.

## Future Enhancements

1. **Optimistic UI Updates**: Apply changes locally before server confirmation, rollback on error
2. **Event Compression**: Batch multiple events into single WebSocket frame
3. **Selective Sync**: Fine-grained subscriptions (e.g., only settlement:123, not entire campaign)
4. **Presence System**: Show which users are currently online and viewing same entities
5. **Operational Transform**: Resolve concurrent edits with CRDTs or OT algorithms
6. **Polling Fallback**: Auto-switch to polling if WebSocket unavailable
7. **Event Replay**: Store events in Redis with expiration, replay on reconnect
8. **Rate Limiting**: Per-user connection limits and event throttling
9. **Toast Notifications**: User-facing notifications for important events
10. **Metrics & Monitoring**: Track connection success rate, latency, event throughput

## Related Documentation

- [Cross-View Selection](cross-view-selection.md) - Uses WebSocket for synchronized selection
- [World Time System](world-time-system.md) - Emits world_time_changed events
- [Settlement & Structure Hierarchy](settlement-structure-hierarchy-ui.md) - Uses settlement/structure events
- [Effect System](effect-system.md) - May trigger state invalidation events
- [Rules Engine Worker](rules-engine-worker.md) - Can publish events after condition evaluation

## References

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [Apollo Client Cache API](https://www.apollographql.com/docs/react/caching/cache-interaction/)
- [React Context API](https://react.dev/reference/react/createContext)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
