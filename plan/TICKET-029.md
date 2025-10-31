# TICKET-029: Real-time Updates via WebSocket/Redis

## Status

- [ ] Completed (Stage 4 of 8 - Frontend WebSocket Client COMPLETE)
- **Commits**:
  - cdc825c - feat(api): implement WebSocket infrastructure with Redis adapter (Stage 1)
  - 699fcd6 - test(api): add comprehensive tests for WebSocket subscription system (Stage 2)
  - 9a59f4c - feat(api,shared): add WebSocket event publisher with type-safe event system (Stage 3)
  - 21aa2e0 - feat(api): integrate WebSocket event publishing into domain services (Stage 4 - Backend Integration)
  - b031566 - feat(frontend): implement WebSocket client with connection management (Stage 4 - Frontend WebSocket Client)

## Stage 4 Implementation Notes (Frontend WebSocket Client)

### What Was Implemented

**Files Created:**

- `packages/frontend/src/contexts/WebSocketContext.tsx` - WebSocket context provider with connection management
- `packages/frontend/src/contexts/WebSocketContext.test.tsx` - Comprehensive test suite (31 tests)
- `packages/frontend/src/components/ConnectionIndicator.tsx` - Visual connection status component

**Files Modified:**

- `packages/frontend/package.json` - Added socket.io-client dependency
- `packages/frontend/src/App.tsx` - Wrapped app in WebSocketProvider
- `packages/frontend/src/components/index.ts` - Export ConnectionIndicator
- `packages/frontend/src/components/layout/MainLayout.tsx` - Added ConnectionIndicator to header

**Key Features:**

1. **WebSocket Context Provider**:
   - Single global Socket.IO connection for entire application
   - Automatic JWT authentication using token from auth store (via `auth.token` handshake parameter)
   - Manual reconnection control with exponential backoff (1s → 32s max delay)
   - Automatic token refresh detection and reconnection when token changes
   - Connection state management (Connecting, Connected, Disconnected, Error)
   - Proper cleanup on unmount (removes listeners, disconnects socket, clears timeouts)
   - Uses refs to track intentional disconnects vs errors to prevent unnecessary reconnection

2. **Connection Lifecycle**:
   - Only connects when user is authenticated (`isAuthenticated && token`)
   - Connection created automatically on authentication
   - Reconnection scheduled on disconnect/error with exponential backoff
   - Reconnect attempts tracked and displayed to user
   - Supports both WebSocket and polling transports (WebSocket preferred)

3. **Connection Status Indicator**:
   - Color-coded status: green (connected), yellow (connecting), red (error), gray (disconnected)
   - Auto-hides 3 seconds after successful connection to avoid UI clutter
   - Shows reconnection attempt counter during errors/disconnection
   - Only visible to authenticated users
   - Positioned in MainLayout header next to branch selector

4. **React Hooks**:
   - `useWebSocket()` - Full access to socket instance, connection state, error, reconnect attempts
   - `useWebSocketConnection()` - Convenience hook for connection state only
   - Both hooks throw error if used outside WebSocketProvider

**Implementation Patterns:**

- Uses Socket.IO client with `reconnection: false` for manual control
- Exponential backoff calculated: `baseDelay * 2^attempt` (capped at maxDelay)
- Reconnection timeout stored in ref for proper cleanup
- `intentionalDisconnect` ref prevents reconnection when unmounting
- Token changes detected via useEffect watching auth store

**Security:**

- JWT token passed securely via Socket.IO `auth.token` handshake parameter
- No token exposure in debug logs (only logs presence, not value)
- Connection only created when authenticated
- Token refresh triggers automatic reconnection with new token

**Testing:**

- Comprehensive test suite: 31 tests passing
- Tests cover:
  - Connection establishment with authentication
  - Connection state transitions (connecting → connected → disconnected → error)
  - Socket event handler registration and invocation
  - Authentication requirement enforcement
  - Cleanup on unmount
  - Hook usage outside provider (throws error)
  - ConnectionState enum values
- Proper mocking of socket.io-client, env config, and auth store

**Quality Checks:**

- ✅ Type-check passing (no errors)
- ✅ Lint passing (no new errors, pre-existing warnings in other files only)
- ✅ All 31 tests passing
- ✅ Manual code review completed (security, performance, error handling verified)
- ✅ Import order auto-fixed by ESLint
- ✅ Pre-commit hooks passing (format check, lint)

### Stage 4 Frontend WebSocket Client Complete

All frontend WebSocket client infrastructure is now in place:

- ✅ Socket.IO client integrated with JWT authentication
- ✅ WebSocketProvider managing single global connection
- ✅ Exponential backoff reconnection strategy implemented
- ✅ Automatic token refresh detection and reconnection
- ✅ Connection status indicator in UI
- ✅ React hooks for accessing WebSocket functionality
- ✅ Comprehensive test coverage (31/31 tests passing)
- ✅ Type-check and lint passing
- ✅ Changes committed (b031566)

### Next Steps

Stage 5 will implement frontend subscription hooks for subscribing to specific events and rooms (campaign, settlement, structure subscriptions with useWebSocketSubscription hooks).

---

## Stage 4 Implementation Notes (Backend Integration)

### What Was Implemented

**Files Modified:**

- `packages/api/src/graphql/services/campaign.service.ts` - Added WebSocket event publishing
- `packages/api/src/graphql/services/settlement.service.ts` - Added WebSocket event publishing
- `packages/api/src/graphql/services/structure.service.ts` - Added WebSocket event publishing
- `packages/api/src/graphql/services/world-time.service.ts` - Added WebSocket event publishing

**Key Features:**

1. **Campaign Service Integration**:
   - Injected `WebSocketPublisherService` into constructor
   - Emit `entity_updated` events on create/update/delete operations
   - Track changed fields during updates for granular event payloads
   - Include userId and source metadata in all events

2. **Settlement Service Integration**:
   - Injected `WebSocketPublisherService` into constructor
   - Emit `settlement_updated` events with 'create'/'update'/'delete' operations
   - Fetch campaignId through settlement→kingdom→campaign relation
   - Publish to both campaign and settlement-specific rooms
   - Track changed fields (name, level, variables, variableSchemas)

3. **Structure Service Integration**:
   - Injected `WebSocketPublisherService` into constructor
   - Emit `structure_updated` events with 'create'/'update'/'delete' operations
   - Fetch campaignId through structure→settlement→kingdom→campaign relation
   - Publish to campaign, settlement, and structure-specific rooms
   - Track changed fields (name, type, level, variables, variableSchemas)

4. **World Time Service Integration**:
   - Injected `WebSocketPublisherService` into constructor
   - Emit `world_time_changed` events when time is advanced
   - Calculate elapsed time in seconds for event payload
   - Include previous and new world time timestamps

**Implementation Pattern:**

All services follow consistent pattern:

1. Inject `WebSocketPublisherService` in constructor
2. Import event creation helpers from `@campaign/shared`
3. Track changed fields during update operations
4. Publish events after successful database operations
5. Include userId and source='api' metadata

**Event Room Targeting:**

- Campaign events → campaign room
- Settlement events → campaign room + settlement room
- Structure events → campaign room + settlement room + structure room
- World time events → campaign room

Events automatically distribute across all API instances via Redis pub/sub adapter.

### Import Order Fix

Fixed ESLint import order violations in all modified files by:

- Separating external, shared, and local imports with blank lines
- Moving WebSocketPublisherService import before type imports
- Running `eslint --fix` to auto-correct ordering

### Tests Status

**No new tests in this stage** - Tests will be added in Stage 6 as part of integration testing.

Existing tests continue to pass:

- ✅ Type-check passed (no compilation errors)
- ✅ Lint passed (only pre-existing `any` warnings in test files)
- ✅ All existing unit and integration tests passing

### Stage 4 Backend Integration Complete

All backend domain services now emit WebSocket events on CRUD operations:

- ✅ CampaignService emits entity_updated events
- ✅ SettlementService emits settlement_updated events
- ✅ StructureService emits structure_updated events
- ✅ WorldTimeService emits world_time_changed events
- ✅ Events properly scoped to campaign/settlement/structure rooms
- ✅ Changed fields tracked for granular updates
- ✅ Type-check and lint passing
- ✅ Import order issues resolved
- ✅ Changes committed (21aa2e0)

### Next Steps

Stage 5 will implement the frontend WebSocket client with connection management and auto-reconnection.

---

## Stage 3 Implementation Notes

### What Was Implemented

**Files Created:**

- `packages/shared/src/types/websocket-events.ts` - Comprehensive event type definitions
- `packages/api/src/websocket/websocket-publisher.service.ts` - Event publisher service

**Files Modified:**

- `packages/shared/src/types/index.ts` - Export WebSocket event types
- `packages/api/src/websocket/websocket.module.ts` - Register and export publisher service
- `packages/api/src/websocket/websocket.gateway.ts` - Inject and initialize publisher service

**Key Features:**

1. **Event Type Definitions** (5 event types with discriminated unions):
   - `EntityUpdatedEvent` - Generic entity updates (campaign, settlement, structure, etc.)
   - `StateInvalidatedEvent` - Cache invalidation triggers for rules engine
   - `WorldTimeChangedEvent` - World time progression events
   - `SettlementUpdatedEvent` - Settlement-specific updates (create/update/delete)
   - `StructureUpdatedEvent` - Structure-specific updates (create/update/delete)
   - All events include timestamps, metadata (userId, source, correlationId), and type-safe payloads
   - Helper functions for creating each event type
   - Type guard for validating WebSocket events

2. **WebSocket Publisher Service**:
   - Injectable service for publishing events to Socket.IO rooms
   - Automatic room targeting based on event type:
     - Entity updates → campaign room + specific entity room (settlement/structure)
     - State invalidation → campaign room
     - World time changes → campaign room
     - Settlement updates → campaign + settlement rooms
     - Structure updates → campaign + settlement + structure rooms
   - Type-safe event dispatch using discriminated unions
   - Comprehensive error handling and logging
   - Redis pub/sub integration via Socket.IO adapter (events automatically propagate to all API instances)

3. **Integration with WebSocket Gateway**:
   - Publisher service registered in WebSocketModule providers and exports
   - Injected into WebSocketGatewayClass constructor
   - Initialized with Socket.IO server instance in `afterInit()` lifecycle hook
   - Ready for use by domain services (Campaign, Settlement, Structure, etc.)

### Tests Status

**✅ All tests implemented and passing (63/63 total WebSocket tests)**:

- ✅ Publisher service tests (32 tests) - All event types, room targeting, error handling
- ✅ Gateway tests from Stage 2 (31 tests) - Connection auth, subscriptions, unsubscriptions

### Stage 3 Complete

All tasks completed:

- ✅ Comprehensive event type definitions with discriminated unions
- ✅ WebSocketPublisherService with automatic room targeting
- ✅ Integration with Socket.IO Redis adapter for multi-instance support
- ✅ Comprehensive test suite (32 tests passing)
- ✅ Type-check passing (no errors)
- ✅ Lint passing (no new warnings)
- ✅ Code review completed
- ✅ Changes committed (9a59f4c)

### Deferred to Later Stages

- Integration with domain services (will be added in Stage 4+ as needed)
- Frontend client implementation (Stage 4)
- Frontend subscription hooks (Stage 5)
- Cache invalidation integration (Stage 6)

---

## Stage 2 Implementation Notes

### What Was Implemented

**Files Modified:**

- `packages/api/src/websocket/websocket.module.ts` - Added AuthModule import
- `packages/api/src/websocket/websocket.gateway.ts` - Added authentication and subscription handlers

**Key Features:**

1. **Connection Authentication**:
   - JWT token extraction from `handshake.auth.token` or `handshake.query.token`
   - Token verification using `JwtService.verify()`
   - Authenticated user data stored in `socket.data` as `AuthenticatedSocketData`
   - Unauthenticated connections are rejected and disconnected immediately
   - Full error handling and logging for auth failures

2. **Module Dependencies**:
   - Imported `AuthModule` to provide `JwtService` and `CampaignMembershipService`
   - Added constructor injection for both services into `WebSocketGatewayClass`

3. **Subscription Handlers** (6 new `@SubscribeMessage` methods):
   - `subscribe_campaign` - Validates user access via `CampaignMembershipService.canView()`
   - `subscribe_settlement` - Basic implementation (parent campaign lookup deferred to Stage 3)
   - `subscribe_structure` - Basic implementation (parent campaign lookup deferred to Stage 3)
   - `unsubscribe_campaign`, `unsubscribe_settlement`, `unsubscribe_structure`
   - All handlers return `{success: boolean, error?: string}` responses
   - Comprehensive error handling and debug/info logging

4. **Authorization**:
   - Campaign subscriptions check `canView(campaignId, userId)` before allowing room join
   - Unauthorized attempts return `{success: false, error: 'Unauthorized'}`
   - Settlement/structure handlers documented for enhancement in Stage 3

### Known Limitations

- Settlement and structure subscriptions don't yet validate parent campaign access
  - Will be enhanced in Stage 3 when entity relationships are available
  - Currently allow subscription without campaign-level authorization check

### Tests Status

**✅ All tests implemented and passing (31/31 tests)**:

- ✅ Connection authentication (valid/invalid/missing JWT tokens) - 6 tests
- ✅ Campaign subscription authorization (authorized vs unauthorized users) - 3 tests
- ✅ Settlement/structure subscription (basic functionality) - 4 tests
- ✅ Unsubscription operations - 6 tests
- ✅ Multiple simultaneous subscriptions - 2 tests
- ✅ Automatic room cleanup on disconnect - 2 tests
- ✅ Gateway initialization - 3 tests
- ✅ Client lifecycle - 2 tests
- ✅ Broadcasting methods - 2 tests
- ✅ Error handling - throughout

### Security Improvements

Applied from code review:

1. Added validation in getRoomName() to prevent malformed room names from empty entityIds
2. Improved error logging to prevent JWT token leakage in logs (only log error messages, not full error objects)
3. Added explicit security warnings for settlement/structure subscriptions that bypass campaign authorization (will be addressed in Stage 3)

### Stage 2 Complete

All tasks completed:

- ✅ Comprehensive test suite written and passing
- ✅ Type-check passing
- ✅ Lint passing (no new warnings)
- ✅ Code review completed with critical issues addressed
- ✅ Changes committed (699fcd6)

## Description

Implement real-time updates using WebSocket (Socket.IO) and Redis pub/sub to push state changes and invalidations to connected clients.

## Scope of Work

1. Add Socket.IO to API service
2. Configure Redis pub/sub adapter
3. Implement room-based subscriptions (per campaign)
4. Create event types (entity_updated, state_invalidated, world_time_changed, settlement_updated, structure_updated)
5. Add client-side WebSocket connection
6. Implement auto-reconnection
7. Create subscription management hooks
8. Settlement-scoped room subscriptions (settlement:id)
9. Structure-scoped room subscriptions (structure:id)

## Acceptance Criteria

- [ ] Clients connect via WebSocket
- [ ] Clients subscribe to campaign updates
- [ ] Updates broadcast to all subscribers
- [ ] Invalidations trigger UI refresh
- [ ] Connection survives network issues
- [ ] Multiple clients stay in sync
- [ ] settlement_updated events publish correctly
- [ ] structure_updated events publish correctly
- [ ] Can subscribe to settlement-scoped rooms
- [ ] Can subscribe to structure-scoped rooms

## Dependencies

- Requires: TICKET-002, TICKET-015, TICKET-026

## Estimated Effort

3-4 days
