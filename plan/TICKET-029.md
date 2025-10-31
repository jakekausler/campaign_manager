# TICKET-029: Real-time Updates via WebSocket/Redis

## Status

- [ ] Completed (Stage 3 of 8 - COMPLETE)
- **Commits**:
  - cdc825c - feat(api): implement WebSocket infrastructure with Redis adapter (Stage 1)
  - 699fcd6 - test(api): add comprehensive tests for WebSocket subscription system (Stage 2)
  - 9a59f4c - feat(api,shared): add WebSocket event publisher with type-safe event system (Stage 3)

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
