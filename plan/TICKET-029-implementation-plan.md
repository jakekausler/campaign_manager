# TICKET-029 Implementation Plan: Real-time Updates via WebSocket/Redis

## Overview

This ticket implements real-time updates using Socket.IO and Redis pub/sub to push state changes and invalidations to connected clients. The implementation spans both backend (API service) and frontend (React client).

## Architecture Overview

```
Frontend Client → Socket.IO Client → API Gateway (WebSocket)
                                          ↓
                                     Socket.IO Gateway
                                          ↓
                                    Redis Pub/Sub Adapter
                                          ↓
                     ┌───────────────────┴───────────────────┐
                     ↓                                       ↓
            Rules Engine Worker                    Scheduler Worker
            (publishes events)                     (publishes events)
```

## Stages

### Stage 1: Backend Infrastructure Setup

**Goal**: Set up Socket.IO with Redis adapter in the API service

**Tasks**:

- [x] Add Socket.IO dependencies to `@campaign/api`
  - `@nestjs/platform-socket.io`
  - `socket.io`
  - `socket.io-redis`
  - `@socket.io/redis-adapter`
- [x] Create WebSocket gateway module structure
  - Create `packages/api/src/websocket/` directory
  - Create `websocket.module.ts`
  - Create `websocket.gateway.ts`
- [x] Configure Redis adapter for Socket.IO
  - Connect to Redis instance (already configured from TICKET-002)
  - Set up pub/sub channels
  - Configure adapter options (connection pooling, retry logic)
- [x] Integrate WebSocket module into main app module
  - Import WebSocketModule in AppModule
  - Configure CORS for WebSocket connections
- [x] Write unit tests for gateway initialization
  - Test Redis connection
  - Test gateway lifecycle hooks
  - Test basic connection/disconnection handling

**Success Criteria**:

- [x] Socket.IO server starts successfully with Redis adapter
- [x] Can connect to WebSocket endpoint from a test client
- [x] Redis pub/sub channels are created and functional
- [x] Unit tests pass

**Notes**:

- Use existing Redis configuration from `docker-compose.yml`
- Ensure proper error handling for Redis connection failures
- Configure WebSocket to run on same port as HTTP (using Socket.IO path)

**Stage 1 Status**: ✅ COMPLETED (Commit: cdc825c)

- All dependencies added and configured
- WebSocket gateway with Redis adapter created
- Module integrated into AppModule
- Comprehensive unit tests (10 tests, all passing)
- TypeScript compilation and linting passing
- Known limitations documented for future stages

---

### Stage 2: Room Subscription System

**Goal**: Implement room-based subscription logic with proper scoping

**Tasks**:

- [ ] Define subscription room naming conventions
  - Campaign rooms: `campaign:{campaignId}`
  - Settlement rooms: `settlement:{settlementId}`
  - Structure rooms: `structure:{structureId}`
- [ ] Implement connection authentication
  - Extract user/session info from WebSocket handshake
  - Validate JWT token from connection headers
  - Reject unauthenticated connections
- [ ] Create subscription handler methods
  - `handleSubscribeToCampaign(campaignId)`
  - `handleSubscribeToSettlement(settlementId)`
  - `handleSubscribeToStructure(structureId)`
  - `handleUnsubscribeFromCampaign(campaignId)`
  - `handleUnsubscribeFromSettlement(settlementId)`
  - `handleUnsubscribeFromStructure(structureId)`
- [ ] Add authorization checks for subscriptions
  - Verify user has access to requested campaign/settlement/structure
  - Use existing permission/auth services
- [ ] Handle automatic cleanup on disconnect
  - Remove client from all rooms on disconnect
  - Clean up any client-specific state
- [ ] Write tests for subscription logic
  - Test successful subscription to valid rooms
  - Test authorization failures
  - Test automatic cleanup on disconnect
  - Test multiple simultaneous subscriptions

**Success Criteria**:

- [ ] Clients can subscribe to campaign-specific rooms
- [ ] Clients can subscribe to settlement-specific rooms
- [ ] Clients can subscribe to structure-specific rooms
- [ ] Unauthorized subscription attempts are rejected
- [ ] Room cleanup happens automatically on disconnect
- [ ] Tests pass

**Notes**:

- Reuse existing AuthService/PermissionService for authorization
- Consider rate limiting for subscription requests
- Log subscription events for debugging

---

### Stage 3: Event Type Definitions & Publishing

**Goal**: Define event types and create publishing infrastructure

**Tasks**:

- [ ] Create shared event type definitions in `@campaign/shared`
  - `EntityUpdatedEvent` - for generic entity updates
  - `StateInvalidatedEvent` - for cache invalidation
  - `WorldTimeChangedEvent` - for world time updates
  - `SettlementUpdatedEvent` - for settlement changes
  - `StructureUpdatedEvent` - for structure changes
- [ ] Add TypeScript types/interfaces for each event
  - Include event name, payload schema, and metadata
  - Use discriminated unions for type safety
- [ ] Create WebSocket event publisher service
  - `WebSocketPublisher` class
  - Methods for each event type
  - Handle room targeting logic
  - Handle broadcast vs. targeted messages
- [ ] Integrate publisher with Redis pub/sub
  - Publish events to Redis channels
  - Ensure events are received by all API instances
- [ ] Add event publishing to relevant services
  - Campaign service → emit entity_updated on campaign changes
  - Settlement service → emit settlement_updated
  - Structure service → emit structure_updated
  - World time service → emit world_time_changed
  - Rules engine integration → emit state_invalidated
- [ ] Write tests for event publishing
  - Test each event type is published correctly
  - Test room targeting works
  - Test Redis pub/sub propagation
  - Mock Socket.IO to verify emission

**Success Criteria**:

- [ ] All event types are defined with TypeScript types
- [ ] WebSocketPublisher service is created and injectable
- [ ] Events are published to correct rooms
- [ ] Events propagate across multiple API instances via Redis
- [ ] Tests pass

**Notes**:

- Consider event versioning for future compatibility
- Include timestamps and metadata in all events
- Ensure event payloads don't expose sensitive data

---

### Stage 4: Frontend WebSocket Client Setup

**Goal**: Create React hooks and utilities for WebSocket connection

**Tasks**:

- [ ] Add Socket.IO client dependency to `@campaign/frontend`
  - `socket.io-client`
- [ ] Create WebSocket context provider
  - `packages/frontend/src/contexts/WebSocketContext.tsx`
  - Manage single global Socket.IO connection
  - Handle connection state (connecting, connected, disconnected)
- [ ] Implement connection logic
  - Connect with authentication token
  - Handle connection errors
  - Implement exponential backoff for reconnection
  - Auto-reconnect on network recovery
- [ ] Create connection state hook
  - `useWebSocketConnection()` - returns connection status
  - Export connection state enum (Connected, Connecting, Disconnected)
- [ ] Add connection status indicator to UI
  - Show connection state in app header or status bar
  - Display reconnection attempts
- [ ] Write tests for WebSocket context
  - Test connection establishment
  - Test reconnection logic
  - Test token refresh on reconnect
  - Mock Socket.IO client

**Success Criteria**:

- [ ] WebSocket connection established on app load
- [ ] Connection survives page navigation
- [ ] Auto-reconnection works after network interruption
- [ ] Connection state is visible in UI
- [ ] Tests pass

**Notes**:

- Store connection in React context to avoid multiple connections
- Clean up connection on app unmount
- Handle token expiration and refresh before reconnection

---

### Stage 5: Frontend Subscription Hooks

**Goal**: Create React hooks for subscribing to specific events and rooms

**Tasks**:

- [ ] Create generic subscription hook
  - `useWebSocketSubscription(eventType, handler)`
  - Manages subscription lifecycle
  - Automatically unsubscribes on unmount
- [ ] Create campaign subscription hook
  - `useCampaignSubscription(campaignId, handlers)`
  - Subscribe to campaign room on mount
  - Unsubscribe on unmount or campaignId change
- [ ] Create settlement subscription hook
  - `useSettlementSubscription(settlementId, handlers)`
- [ ] Create structure subscription hook
  - `useStructureSubscription(structureId, handlers)`
- [ ] Handle reconnection state in hooks
  - Re-subscribe to rooms after reconnection
  - Handle subscription errors gracefully
- [ ] Create event handler utilities
  - Type-safe event handlers for each event type
  - Helper for triggering Apollo cache updates
  - Helper for triggering UI refresh
- [ ] Write tests for subscription hooks
  - Test subscription lifecycle
  - Test handler invocation
  - Test automatic re-subscription on reconnect
  - Test cleanup on unmount
  - Use React Testing Library

**Success Criteria**:

- [ ] Hooks provide simple API for subscribing to events
- [ ] Subscriptions automatically clean up
- [ ] Re-subscription works after reconnection
- [ ] Type safety for event handlers
- [ ] Tests pass

**Notes**:

- Ensure hooks handle rapid mount/unmount cycles (React StrictMode)
- Debounce subscription requests if necessary
- Consider adding optimistic UI updates before event confirmation

---

### Stage 6: Integration & Cache Invalidation

**Goal**: Integrate WebSocket events with Apollo cache and UI state

**Tasks**:

- [ ] Create cache invalidation handlers
  - Handle `state_invalidated` events
  - Refetch affected queries from Apollo cache
  - Clear specific cache entries
- [ ] Create entity update handlers
  - Handle `entity_updated` events
  - Update Apollo cache with new entity data
  - Trigger re-renders for affected components
- [ ] Handle world time change events
  - Update world time state in Zustand store
  - Trigger dependent computations
- [ ] Handle settlement update events
  - Update settlement data in Apollo cache
  - Notify affected UI components
- [ ] Handle structure update events
  - Update structure data in Apollo cache
  - Notify affected UI components
- [ ] Add event handlers to key views
  - Campaign overview page
  - Settlement detail pages
  - Structure detail pages
  - Map view (if applicable)
- [ ] Write integration tests
  - Test cache updates on events
  - Test UI re-renders on events
  - Test multi-client synchronization (using multiple test clients)

**Success Criteria**:

- [ ] Cache invalidations trigger proper refetches
- [ ] Entity updates appear in UI without manual refresh
- [ ] Multiple clients stay in sync
- [ ] World time updates propagate correctly
- [ ] Settlement and structure updates are reflected immediately
- [ ] Tests pass

**Notes**:

- Use Apollo's `cache.evict()` and `cache.modify()` for cache updates
- Consider batching multiple rapid updates to avoid UI thrashing
- Add logging for debugging synchronization issues

---

### Stage 7: Error Handling & Resilience

**Goal**: Add comprehensive error handling and resilience features

**Tasks**:

- [ ] Add error logging for WebSocket events
  - Log connection errors
  - Log subscription errors
  - Log event handling errors
  - Send errors to monitoring service (if configured)
- [ ] Implement connection health checks
  - Periodic ping/pong with server
  - Detect stale connections
  - Force reconnect on health check failure
- [ ] Handle edge cases
  - Multiple tabs with same campaign open
  - Network switches (WiFi to mobile data)
  - Server restarts
  - Redis connection failures
- [ ] Add circuit breaker for subscriptions
  - Prevent infinite re-subscription loops
  - Implement exponential backoff with max retries
- [ ] Create user-facing error messages
  - Show notification on connection loss
  - Show notification on reconnection
  - Hide notification when stable
- [ ] Write tests for error scenarios
  - Test connection failure recovery
  - Test subscription failure handling
  - Test partial Redis failure
  - Test server restart recovery

**Success Criteria**:

- [ ] Connection recovers from all tested failure scenarios
- [ ] Users are notified of connection issues
- [ ] No infinite loops or resource leaks
- [ ] Errors are logged appropriately
- [ ] Tests pass

**Notes**:

- Use exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max)
- Consider using toast notifications for connection status
- Add metrics for monitoring connection health in production

---

### Stage 8: Documentation & Final Testing

**Goal**: Document the WebSocket system and perform end-to-end testing

**Tasks**:

- [ ] Create feature documentation
  - Document WebSocket architecture in `docs/features/realtime-updates.md`
  - Include event type reference
  - Include usage examples for hooks
  - Document troubleshooting steps
- [ ] Update API documentation
  - Document WebSocket endpoints
  - Document authentication requirements
  - Document event schemas
- [ ] Create developer guide
  - How to emit new event types
  - How to subscribe to events in new components
  - How to test WebSocket functionality locally
- [ ] Perform end-to-end testing
  - Test with multiple browser tabs
  - Test with multiple users
  - Test all event types
  - Test on different networks
  - Test with browser dev tools throttling
- [ ] Load testing (optional but recommended)
  - Test with many concurrent connections
  - Test with high event throughput
  - Identify performance bottlenecks
- [ ] Code review readiness
  - Clean up console logs
  - Remove debug code
  - Ensure code follows project conventions
  - Run linter and formatter

**Success Criteria**:

- [ ] Comprehensive documentation exists
- [ ] All manual testing scenarios pass
- [ ] Code is clean and follows conventions
- [ ] Ready for code review

**Notes**:

- Include sequence diagrams in documentation
- Document known limitations
- Add troubleshooting section for common issues

---

## Testing Strategy

### Unit Tests

- WebSocket gateway initialization and lifecycle
- Room subscription/unsubscription logic
- Event publishing logic
- Authentication and authorization checks
- Frontend hooks with mocked Socket.IO client

### Integration Tests

- End-to-end event flow from backend to frontend
- Multi-client synchronization
- Cache invalidation and updates
- Reconnection and recovery scenarios

### Manual Testing

- Multiple browser tabs/windows
- Network interruption scenarios
- Cross-browser compatibility
- Mobile device testing

## Rollout Plan

1. Deploy backend changes first (Stages 1-3)
2. Verify backend is stable with test clients
3. Deploy frontend changes (Stages 4-6)
4. Monitor connection metrics and error rates
5. Gradually enable for all users

## Risk Mitigation

- **Risk**: Redis connection failures break entire system
  - **Mitigation**: Add fallback to polling if WebSocket unavailable

- **Risk**: Too many connections overwhelm server
  - **Mitigation**: Implement connection limits per user, use load balancing

- **Risk**: Events cause cache thrashing
  - **Mitigation**: Implement event batching and debouncing

- **Risk**: Authentication token expires mid-connection
  - **Mitigation**: Implement token refresh mechanism in WebSocket middleware

## Success Metrics

- WebSocket connection success rate > 99%
- Average reconnection time < 5 seconds
- Event delivery latency < 100ms (p95)
- Zero infinite reconnection loops
- All acceptance criteria met

## Dependencies

- TICKET-002: Docker Compose Infrastructure (for Redis) ✓
- TICKET-015: Rules Engine Service Worker (for event publishing) ✓
- TICKET-026: Scheduler Service Worker (for event publishing) ✓

## Notes

- Socket.IO automatically handles WebSocket vs. long-polling fallback
- Redis pub/sub ensures events propagate across multiple API instances
- Consider adding message queue (Bull/BullMQ) for reliable event delivery in future
- May need to optimize event payload sizes for mobile connections
