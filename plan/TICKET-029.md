# TICKET-029: Real-time Updates via WebSocket/Redis

## Status

- [ ] Completed
- **Commits**:

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
