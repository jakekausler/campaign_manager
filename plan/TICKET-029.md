# TICKET-029: Real-time Updates via WebSocket/Redis

## Status

- [ ] Completed (Stage 2 of 8 - implementation complete, tests pending)
- **Commits**:
  - cdc825c - feat(api): implement WebSocket infrastructure with Redis adapter (Stage 1)

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

**⚠️ Tests still need to be written** for:

- Connection authentication (valid/invalid/missing JWT tokens)
- Campaign subscription authorization (authorized vs unauthorized users)
- Settlement/structure subscription (basic functionality)
- Unsubscription operations
- Multiple simultaneous subscriptions
- Automatic room cleanup on disconnect

### Next Steps

1. Write comprehensive test suite for authentication and authorization
2. Run type-check and lint
3. Code review
4. Commit changes

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
