# GraphQL Subscriptions & Real-time Updates Comprehensive Research

## Document Purpose

Comprehensive research findings on GraphQL subscription implementation and real-time update patterns in the Campaign Manager API, including subscription resolvers, infrastructure, event types, and frontend integration.

---

## 1. SUBSCRIPTION RESOLVERS

### Overview

**Single Active GraphQL Subscription Resolver**: `VersionResolver`

Located at: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/version.resolver.ts`

### VersionResolver Subscription

#### Method: `entityModified`

**Signature**:

```typescript
@Subscription(() => EntityModified, {
  description: 'Subscribe to entity modification events for concurrent edit detection',
})
entityModified(@Args('entityId', { type: () => ID }) entityId: string)
```

**Purpose**: Detects concurrent modifications to entities for optimistic locking

**Parameters**:

- `entityId` (ID, required) - The entity ID to monitor for modifications

**Returns**: `EntityModified` type

**Topic Pattern**: `entity.modified.${entityId}`

**Implementation Details**:

- Uses Redis PubSub async iterator pattern
- Subscribes to entity-specific topic channel
- Returns stream of modification events from Redis

---

## 2. SUBSCRIPTION PAYLOAD STRUCTURES

### EntityModified Type

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/types/version.type.ts`

**GraphQL ObjectType Definition**:

```typescript
@ObjectType()
export class EntityModified {
  @Field(() => ID, { description: 'ID of the entity that was modified' })
  entityId!: string;

  @Field(() => String, { description: 'Type of entity that was modified' })
  entityType!: string;

  @Field(() => Int, { description: 'New version number after modification' })
  version!: number;

  @Field(() => ID, { description: 'User who made the modification' })
  modifiedBy!: string;

  @Field({ description: 'When the modification occurred' })
  modifiedAt!: Date;
}
```

**Example Payload**:

```json
{
  "entityModified": {
    "entityId": "campaign-123",
    "entityType": "campaign",
    "version": 5,
    "modifiedBy": "user-456",
    "modifiedAt": "2024-11-10T15:30:45.000Z"
  }
}
```

---

## 3. SUBSCRIPTION INFRASTRUCTURE

### Redis PubSub Setup

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/pubsub/redis-pubsub.provider.ts`

#### Configuration

```typescript
function createRedisPubSub(): RedisPubSub {
  const options: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times: number) => {
      // Exponential backoff with max delay of 3 seconds
      const delay = Math.min(times * 50, 3000);
      return delay;
    },
    connectTimeout: 10000,
    enableOfflineQueue: true,
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true; // Reconnect on READONLY errors
      }
      return false;
    },
  };

  const pubsub = new RedisPubSub({ connection: options });

  // Error logging
  pubsub.getPublisher().on('error', (err) => {
    console.error('Redis Publisher Error:', err);
  });
  pubsub.getSubscriber().on('error', (err) => {
    console.error('Redis Subscriber Error:', err);
  });

  return pubsub;
}
```

#### Key Features

- **Exponential Backoff**: Retry strategy with max 3-second delay
- **Offline Queue**: Buffers commands when disconnected
- **READONLY Recovery**: Automatic reconnection on READONLY errors
- **Error Logging**: Built-in error handlers for debugging

#### Injection Token

```typescript
export const REDIS_PUBSUB = 'REDIS_PUBSUB';
```

**Resolver Injection Pattern**:

```typescript
constructor(
  @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
) {}
```

### GraphQL Module Subscription Configuration

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/graphql.module.ts`

**Apollo Server Settings** (lines 115-119):

```typescript
subscriptions: {
  'graphql-ws': true,              // WebSocket GraphQL protocol (modern)
  'subscriptions-transport-ws': false, // Deprecated protocol (disabled)
},
```

**Transport Protocol**: `graphql-ws` (GraphQL over WebSocket specification)

---

## 4. REAL-TIME UPDATE PATTERNS - Redis Pub/Sub Events

### Overview

The API implements a dual-stream real-time update architecture:

1. **GraphQL Subscriptions** (via Redis PubSub) - Client-initiated, event-driven
2. **WebSocket Events** (via Socket.IO) - Server-initiated, room-based

### Entity Modification Events (entity.modified.\*)

**Triggered By**: All entity mutations

**Services Publishing**:

- `CampaignService.updateCampaign()`
- `SettlementService.updateSettlement()`
- `StructureService.updateStructure()`
- `LocationService.updateLocation()`
- `CharacterService.updateCharacter()`
- `PartyService.updateParty()`
- `EventService.updateEvent()`
- `EncounterService.updateEncounter()`
- `KingdomService.updateKingdom()`

**Topic Pattern**: `entity.modified.${entityId}`

**Payload Structure**:

```typescript
await this.pubSub.publish(`entity.modified.${id}`, {
  entityModified: {
    entityId: id,
    entityType: 'campaign', // campaign|settlement|structure|etc
    version: updated.version,
    modifiedBy: user.id,
    modifiedAt: updated.updatedAt,
  },
});
```

**Use Case**: Concurrent edit detection, version conflicts

### State Variable Events (variable.\*)

**Triggered By**: StateVariable CRUD operations

**Topics**:

- `variable.created` - When state variable is created
- `variable.updated` - When state variable is modified
- `variable.deleted` - When state variable is deleted

**Services Publishing**: `StateVariableService`

**Payload Structure**:

```typescript
await this.pubSub.publish('variable.created', {
  variableId: variable.id,
  campaignId: campaignId,
  branchId: 'main',
});
```

**Target Subscribers**: Rules Engine Worker

### Condition Events (condition.\*)

**Triggered By**: FieldCondition CRUD operations

**Topics**:

- `condition.created`
- `condition.updated`
- `condition.deleted`

**Services Publishing**: `ConditionService`

**Use Case**: Triggers condition re-evaluation

### Effect Events (effect.\*)

**Triggered By**: Effect CRUD operations

**Topics**:

- `effect.created`
- `effect.updated`
- `effect.deleted`

**Services Publishing**: `EffectService`

**Use Case**: Effect execution and dependency graph updates

---

## 5. WEBSOCKET REAL-TIME EVENTS (Socket.IO)

### WebSocket Event Types

**File**: `/storage/programs/campaign_manager/packages/shared/src/types/websocket-events.ts`

#### 1. EntityUpdatedEvent

**Type**: `entity_updated`

**Payload Structure**:

```typescript
{
  type: 'entity_updated',
  timestamp: string,  // ISO 8601
  payload: {
    entityType: 'campaign' | 'settlement' | 'structure' |
               'location' | 'encounter' | 'event' | 'character' | 'item',
    entityId: string,
    campaignId: string,
    changedFields?: string[],  // Optional: specific fields changed
    entityData?: Record<string, unknown>,  // Optional: include full entity
  },
  metadata?: {
    userId?: string,
    source?: string,
    correlationId?: string,
  }
}
```

**Use Case**: Any entity creation/update/deletion

#### 2. StateInvalidatedEvent

**Type**: `state_invalidated`

**Payload Structure**:

```typescript
{
  type: 'state_invalidated',
  timestamp: string,  // ISO 8601
  payload: {
    campaignId: string,
    scope: 'campaign' | 'entity',  // Entire campaign or specific entities
    entityIds?: string[],  // If scope is 'entity'
    reason?: string,  // For debugging (e.g., 'condition.created')
  },
  metadata?: {
    userId?: string,
    source?: string,
    correlationId?: string,
  }
}
```

**Use Case**: Apollo Client cache invalidation

#### 3. WorldTimeChangedEvent

**Type**: `world_time_changed`

**Payload Structure**:

```typescript
{
  type: 'world_time_changed',
  timestamp: string,  // ISO 8601
  payload: {
    campaignId: string,
    previousTime: string,  // ISO 8601 or custom format
    newTime: string,       // ISO 8601 or custom format
    elapsed?: {
      value: number,       // E.g., 1
      unit: string,        // E.g., 'days', 'hours', 'seconds'
    },
  },
  metadata?: {
    userId?: string,
    source?: string,
    correlationId?: string,
  }
}
```

**Use Case**: Campaign timeline progression updates

#### 4. SettlementUpdatedEvent

**Type**: `settlement_updated`

**Payload Structure**:

```typescript
{
  type: 'settlement_updated',
  timestamp: string,  // ISO 8601
  payload: {
    settlementId: string,
    campaignId: string,
    operation: 'create' | 'update' | 'delete',
    changedFields?: string[],
    settlementData?: Record<string, unknown>,
  },
  metadata?: {
    userId?: string,
    source?: string,
    correlationId?: string,
  }
}
```

**Use Case**: Settlement-specific updates

#### 5. StructureUpdatedEvent

**Type**: `structure_updated`

**Payload Structure**:

```typescript
{
  type: 'structure_updated',
  timestamp: string,  // ISO 8601
  payload: {
    structureId: string,
    settlementId: string,
    campaignId: string,
    operation: 'create' | 'update' | 'delete',
    changedFields?: string[],
    structureData?: Record<string, unknown>,
  },
  metadata?: {
    userId?: string,
    source?: string,
    correlationId?: string,
  }
}
```

**Use Case**: Structure-specific updates

### WebSocket Room Subscriptions

**Room Naming Conventions** (from `websocket-publisher.service.ts`):

- `campaign:{campaignId}` - All campaign-level events
- `settlement:{settlementId}` - Settlement-specific events
- `structure:{structureId}` - Structure-specific events

**Authorization**:

- Campaign: `CampaignMembershipService.canView(campaignId, userId)`
- Settlement: Inherits campaign authorization
- Structure: Inherits settlement authorization

---

## 6. FRONTEND INTEGRATION

### WebSocket Subscription Hooks

**File**: `/storage/programs/campaign_manager/packages/frontend/src/hooks/useWebSocketSubscription.ts`

#### Generic Hook: `useWebSocketSubscription`

**Signature**:

```typescript
export function useWebSocketSubscription<TEvent extends WebSocketEvent = WebSocketEvent>(
  eventType: TEvent['type'],
  handler: WebSocketEventHandler<TEvent>,
  subscribeMessage?: { type: string; [key: string]: unknown },
  unsubscribeMessage?: { type: string; [key: string]: unknown },
  enabled = true
): void;
```

**Features**:

- Generic event handler typing
- Automatic re-subscription on reconnection
- Proper cleanup on unmount
- Race condition prevention

#### Specialized Hook: `useCampaignSubscription`

**Signature**:

```typescript
export function useCampaignSubscription(
  campaignId: string | undefined,
  handlers: CampaignEventHandlers,
  enabled?: boolean
): void;
```

**Supported Events**:

- `onEntityUpdated` - EntityUpdatedEvent
- `onStateInvalidated` - StateInvalidatedEvent
- `onWorldTimeChanged` - WorldTimeChangedEvent
- `onSettlementUpdated` - SettlementUpdatedEvent
- `onStructureUpdated` - StructureUpdatedEvent

**Room Subscription**: `subscribe_campaign` / `unsubscribe_campaign`

#### Specialized Hook: `useSettlementSubscription`

**Signature**:

```typescript
export function useSettlementSubscription(
  settlementId: string | undefined,
  handlers: SettlementEventHandlers,
  enabled?: boolean
): void;
```

**Supported Events**:

- `onSettlementUpdated`
- `onStructureUpdated`

**Room Subscription**: `subscribe_settlement` / `unsubscribe_settlement`

#### Specialized Hook: `useStructureSubscription`

**Signature**:

```typescript
export function useStructureSubscription(
  structureId: string | undefined,
  handlers: StructureEventHandlers,
  enabled?: boolean
): void;
```

**Supported Events**:

- `onStructureUpdated`

**Room Subscription**: `subscribe_structure` / `unsubscribe_structure`

### Apollo Client Setup

**File**: `/storage/programs/campaign_manager/packages/frontend/src/services/api/graphql-client.ts`

**Transport Configuration**:

```typescript
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';

// WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(/* WebSocket connection config */);

// Split link: HTTP for queries/mutations, WebSocket for subscriptions
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
  },
  wsLink, // subscriptions
  httpLink // queries/mutations
);
```

### Example Usage

**Campaign-level Subscription Example**:

```tsx
function CampaignView({ campaignId }: { campaignId: string }) {
  useCampaignSubscription(campaignId, {
    onEntityUpdated: (event) => {
      // Entity was modified, refetch from Apollo cache
      refetch();
    },
    onWorldTimeChanged: (event) => {
      // World time advanced
      updateWorldTime(event.payload.newTime);
    },
    onStateInvalidated: (event) => {
      // Computed state invalidated, clear caches
      invalidateComputedFields(event.payload.entityIds);
    },
  });

  return <div>Campaign content...</div>;
}
```

---

## 7. REAL-TIME ARCHITECTURE OVERVIEW

### Dual Real-time System

The Campaign Manager implements TWO complementary real-time systems:

#### System 1: GraphQL Subscriptions (Redis PubSub)

**When to Use**:

- Server-push of structured data
- Strongly-typed event payloads
- Client-initiated subscriptions
- Concurrent edit detection

**Components**:

- Redis PubSub backend
- GraphQL `@Subscription` resolvers
- Topic-based channels (entity.modified.\*)

**Protocol**: GraphQL over WebSocket (graphql-ws)

**Current Usage**: Version tracking (entityModified subscription)

#### System 2: WebSocket Events (Socket.IO)

**When to Use**:

- Lightweight event notifications
- Room-based broadcasting
- Server-initiated pushes
- Application-level events

**Components**:

- Socket.IO gateway
- WebSocket publisher service
- Room-based subscriptions

**Protocol**: WebSocket (Socket.IO)

**Current Usage**: Campaign, settlement, structure, and state updates

### Event Flow

1. **Backend Service** performs mutation → calls pubSub.publish()
2. **Redis PubSub** receives and broadcasts event
3. **All Connected Clients** (via subscriptions/rooms) receive event
4. **Frontend Handler** processes event (refetch, cache invalidation, state update)

### Authentication & Authorization

**GraphQL Subscriptions**:

- Token validation required for connection
- Per-entity authorization in subscription arguments

**WebSocket Subscriptions**:

- JWT authentication in handshake
- Room authorization based on campaign membership
- Inherited permissions for settlements and structures

---

## 8. SUBSCRIPTION TESTING PATTERNS

### Unit Test Example (VersionResolver)

**File**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/version.resolver.test.ts`

**Test Pattern**:

```typescript
describe('VersionResolver', () => {
  describe('entityModified subscription', () => {
    it('should return async iterator for entity', () => {
      const entityId = 'entity-123';
      const mockAsyncIterator = Symbol('asyncIterator');

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator as any);

      const result = resolver.entityModified(entityId);

      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith('entity.modified.entity-123');
      expect(result).toBe(mockAsyncIterator);
    });
  });
});
```

### Integration Test Pattern

**Test Files**:

- `packages/api/src/graphql/services/*.integration.test.ts`

**Pattern**: Mock pubSub in test setup, verify `publish()` calls with correct topics/payloads

---

## 9. PUBLISHING SERVICES

### Services Publishing entity.modified Events

Services that publish `entity.modified.${id}` events when entities are modified:

1. **CampaignService** - Campaign updates
2. **SettlementService** - Settlement updates
3. **StructureService** - Structure updates
4. **LocationService** - Location updates
5. **CharacterService** - Character updates
6. **PartyService** - Party updates
7. **EventService** - Event updates
8. **EncounterService** - Encounter updates
9. **KingdomService** - Kingdom updates

### Services Publishing Specialized Events

1. **StateVariableService** - variable.created/updated/deleted
2. **ConditionService** - condition.created/updated/deleted
3. **EffectService** - effect.created/updated/deleted

### Services Publishing WebSocket Events

1. **CampaignService** - entity_updated
2. **SettlementService** - settlement_updated, entity_updated
3. **StructureService** - structure_updated, entity_updated
4. **WorldTimeService** - world_time_changed
5. **WebSocketPublisherService** - Coordinates all WebSocket events

---

## 10. KEY FILES SUMMARY

### Backend Subscription Infrastructure

- **PubSub Setup**: `/storage/programs/campaign_manager/packages/api/src/graphql/pubsub/redis-pubsub.provider.ts`
- **Subscription Resolver**: `/storage/programs/campaign_manager/packages/api/src/graphql/resolvers/version.resolver.ts`
- **Subscription Type**: `/storage/programs/campaign_manager/packages/api/src/graphql/types/version.type.ts`
- **GraphQL Config**: `/storage/programs/campaign_manager/packages/api/src/graphql/graphql.module.ts` (lines 115-119)

### WebSocket Infrastructure

- **WebSocket Gateway**: `/storage/programs/campaign_manager/packages/api/src/websocket/websocket.gateway.ts`
- **Event Publisher**: `/storage/programs/campaign_manager/packages/api/src/websocket/websocket-publisher.service.ts`
- **Event Types**: `/storage/programs/campaign_manager/packages/shared/src/types/websocket-events.ts`

### Frontend Integration

- **Subscription Hooks**: `/storage/programs/campaign_manager/packages/frontend/src/hooks/useWebSocketSubscription.ts`
- **Apollo Setup**: `/storage/programs/campaign_manager/packages/frontend/src/services/api/graphql-client.ts`
- **WebSocket Context**: `/storage/programs/campaign_manager/packages/frontend/src/contexts/WebSocketContext.tsx`

### Documentation

- **Real-time Features**: `/storage/programs/campaign_manager/docs/features/realtime-updates.md`
- **System Architecture**: `/storage/programs/campaign_manager/docs/architecture/system-overview.md`

---

## 11. SUMMARY STATISTICS

### Subscription Coverage

- **GraphQL Subscriptions**: 1 active resolver (VersionResolver.entityModified)
- **WebSocket Event Types**: 5 types (entity_updated, state_invalidated, world_time_changed, settlement_updated, structure_updated)
- **Redis PubSub Topics**: 10+ topic patterns (entity.modified._, variable._, condition._, effect._)
- **Services Publishing Events**: 9+ services
- **Frontend Hooks**: 4 specialized + 1 generic

### Authentication & Authorization

- **Subscription Auth**: JWT token in connection handshake
- **Room Authorization**: Campaign membership check
- **Inherited Permissions**: Settlement/structure via parent entity

### Real-time Infrastructure

- **Backend**: Redis PubSub + Socket.IO
- **Protocol**: graphql-ws (GraphQL subscriptions) + WebSocket (Socket.IO)
- **Connection Handling**: Exponential backoff retry, offline queue, error recovery
- **Scalability**: Redis adapter enables multi-instance deployments

---

## Recommended Documentation Sections

1. **GraphQL Subscriptions Guide**: entityModified subscription, topic patterns, payload structures
2. **WebSocket Events Reference**: All 5 event types with examples
3. **Frontend Integration Guide**: Hook usage, room subscriptions, error handling
4. **Real-time Architecture**: Dual-system design, authentication flow, event routing
5. **Publishing Patterns**: Which services publish which events, when to publish
6. **Testing Subscriptions**: Unit and integration test patterns
7. **Troubleshooting**: Common subscription issues, reconnection behavior, room authorization
