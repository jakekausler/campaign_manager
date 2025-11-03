/**
 * Tests for WebSocket Subscription Hooks
 */

import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createContext } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type {
  EntityUpdatedEvent,
  SettlementUpdatedEvent,
  StructureUpdatedEvent,
  WorldTimeChangedEvent,
} from '@campaign/shared';

import type { WebSocketContextValue } from '../contexts/WebSocketContext';
import { ConnectionState } from '../contexts/WebSocketContext';

import {
  useCampaignSubscription,
  useSettlementSubscription,
  useStructureSubscription,
  useWebSocketSubscription,
} from './useWebSocketSubscription';

// Mock environment
vi.mock('@/config/env', () => ({
  env: {
    features: {
      debug: false,
    },
  },
}));

// Mock socket type that matches Socket.IO interface subset
type MockSocket = {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  simulateEvent: (event: string, data: unknown) => void;
  getListeners: (event: string) => Array<(...args: unknown[]) => void>;
};

// Create mock socket
function createMockSocket(): MockSocket {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const handlers = listeners.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }),
    emit: vi.fn((_event: string, _data: unknown, callback?: (response: unknown) => void) => {
      // Simulate successful subscription response
      if (callback) {
        setTimeout(() => {
          callback({ success: true });
        }, 0);
      }
    }),
    // Helper to simulate receiving an event
    simulateEvent: (event: string, data: unknown) => {
      const handlers = listeners.get(event);
      if (handlers) {
        handlers.forEach((handler) => handler(data));
      }
    },
    // Helper to get listeners for testing
    getListeners: (event: string) => listeners.get(event) || [],
  };
}

// Create mock WebSocket context for testing
const TestWebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

// Mock the useWebSocket hook to use our test context
vi.mock('../contexts/WebSocketContext', async () => {
  const actual = await vi.importActual<typeof import('../contexts/WebSocketContext')>(
    '../contexts/WebSocketContext'
  );
  const { useContext } = await import('react');
  return {
    ...actual,
    useWebSocket: () => {
      const context = useContext(TestWebSocketContext);
      if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
      }
      return context;
    },
  };
});

// Create test wrapper
function createWrapper(contextValue: WebSocketContextValue) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TestWebSocketContext.Provider value={contextValue}>{children}</TestWebSocketContext.Provider>
    );
  };
}

describe('useWebSocketSubscription', () => {
  let mockSocket: MockSocket;

  beforeEach(() => {
    mockSocket = createMockSocket();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Subscription', () => {
    it('should subscribe to events when socket is connected', async () => {
      const handler = vi.fn();

      const { unmount } = renderHook(
        () =>
          useWebSocketSubscription(
            'entity_updated',
            handler,
            { type: 'subscribe_campaign', campaignId: 'campaign-1' },
            { type: 'unsubscribe_campaign', campaignId: 'campaign-1' }
          ),
        {
          wrapper: createWrapper({
            socket: mockSocket as unknown as WebSocketContextValue['socket'],
            connectionState: ConnectionState.Connected,
            error: null,
            reconnectAttempts: 0,
          }),
        }
      );

      // Wait for subscription to complete
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('entity_updated', expect.any(Function));
      });

      // Verify subscription message was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'subscribe_campaign',
        { type: 'subscribe_campaign', campaignId: 'campaign-1' },
        expect.any(Function)
      );

      unmount();
    });

    it('should invoke handler when event is received', async () => {
      const handler = vi.fn();
      const event: EntityUpdatedEvent = {
        type: 'entity_updated',
        timestamp: new Date().toISOString(),
        payload: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          campaignId: 'campaign-1',
        },
      };

      renderHook(
        () =>
          useWebSocketSubscription(
            'entity_updated',
            handler,
            { type: 'subscribe_campaign', campaignId: 'campaign-1' },
            { type: 'unsubscribe_campaign', campaignId: 'campaign-1' }
          ),
        {
          wrapper: createWrapper({
            socket: mockSocket as unknown as WebSocketContextValue['socket'],
            connectionState: ConnectionState.Connected,
            error: null,
            reconnectAttempts: 0,
          }),
        }
      );

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      // Simulate receiving the event
      mockSocket.simulateEvent('entity_updated', event);

      // Verify handler was called
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should unsubscribe on unmount', async () => {
      const handler = vi.fn();

      const { unmount } = renderHook(
        () =>
          useWebSocketSubscription(
            'entity_updated',
            handler,
            { type: 'subscribe_campaign', campaignId: 'campaign-1' },
            { type: 'unsubscribe_campaign', campaignId: 'campaign-1' }
          ),
        {
          wrapper: createWrapper({
            socket: mockSocket as unknown as WebSocketContextValue['socket'],
            connectionState: ConnectionState.Connected,
            error: null,
            reconnectAttempts: 0,
          }),
        }
      );

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      // Unmount the hook
      unmount();

      // Verify unsubscribe message was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe_campaign', {
        type: 'unsubscribe_campaign',
        campaignId: 'campaign-1',
      });

      // Verify event listener was removed
      expect(mockSocket.off).toHaveBeenCalledWith('entity_updated', expect.any(Function));
    });

    it('should not subscribe when enabled is false', () => {
      const handler = vi.fn();

      renderHook(
        () =>
          useWebSocketSubscription(
            'entity_updated',
            handler,
            { type: 'subscribe_campaign', campaignId: 'campaign-1' },
            { type: 'unsubscribe_campaign', campaignId: 'campaign-1' },
            false // disabled
          ),
        {
          wrapper: createWrapper({
            socket: mockSocket as unknown as WebSocketContextValue['socket'],
            connectionState: ConnectionState.Connected,
            error: null,
            reconnectAttempts: 0,
          }),
        }
      );

      // Verify no subscription was made
      expect(mockSocket.on).not.toHaveBeenCalled();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should not subscribe when socket is null', () => {
      const handler = vi.fn();

      renderHook(
        () =>
          useWebSocketSubscription(
            'entity_updated',
            handler,
            { type: 'subscribe_campaign', campaignId: 'campaign-1' },
            { type: 'unsubscribe_campaign', campaignId: 'campaign-1' }
          ),
        {
          wrapper: createWrapper({
            socket: null,
            connectionState: ConnectionState.Disconnected,
            error: null,
            reconnectAttempts: 0,
          }),
        }
      );

      // Verify no subscription was made
      expect(mockSocket.on).not.toHaveBeenCalled();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should not subscribe when connection state is not Connected', () => {
      const handler = vi.fn();

      renderHook(
        () =>
          useWebSocketSubscription(
            'entity_updated',
            handler,
            { type: 'subscribe_campaign', campaignId: 'campaign-1' },
            { type: 'unsubscribe_campaign', campaignId: 'campaign-1' }
          ),
        {
          wrapper: createWrapper({
            socket: mockSocket as unknown as WebSocketContextValue['socket'],
            connectionState: ConnectionState.Connecting,
            error: null,
            reconnectAttempts: 0,
          }),
        }
      );

      // Verify event listener was added but subscription message was not sent
      expect(mockSocket.on).toHaveBeenCalled();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection Handling', () => {
    it('should re-subscribe after reconnection', async () => {
      const handler = vi.fn();

      // Create a stable wrapper that can be updated
      let contextValue: WebSocketContextValue = {
        socket: mockSocket as unknown as WebSocketContextValue['socket'],
        connectionState: ConnectionState.Connected,
        error: null,
        reconnectAttempts: 0,
      };

      function TestWrapper({ children }: { children: ReactNode }) {
        return (
          <TestWebSocketContext.Provider value={contextValue}>
            {children}
          </TestWebSocketContext.Provider>
        );
      }

      const { rerender } = renderHook(
        () =>
          useWebSocketSubscription(
            'entity_updated',
            handler,
            { type: 'subscribe_campaign', campaignId: 'campaign-1' },
            { type: 'unsubscribe_campaign', campaignId: 'campaign-1' }
          ),
        {
          wrapper: TestWrapper,
        }
      );

      // Wait for initial subscription (may be called more than once due to React StrictMode)
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalled();
      });

      // Record call count after initial subscription
      const callCountAfterInit = mockSocket.emit.mock.calls.length;

      // Simulate disconnection
      contextValue = {
        ...contextValue,
        connectionState: ConnectionState.Disconnected,
      };
      rerender();

      // Wait a bit for disconnection to process
      await waitFor(() => {
        expect(contextValue.connectionState).toBe(ConnectionState.Disconnected);
      });

      // Simulate reconnection
      contextValue = {
        ...contextValue,
        connectionState: ConnectionState.Connected,
      };
      rerender();

      // Verify re-subscription occurred (should have at least one more call)
      await waitFor(() => {
        expect(mockSocket.emit.mock.calls.length).toBeGreaterThan(callCountAfterInit);
      });

      // Verify the last call was subscribe_campaign
      const lastCall = mockSocket.emit.mock.calls[mockSocket.emit.mock.calls.length - 1];
      expect(lastCall[0]).toBe('subscribe_campaign');
      expect(lastCall[1]).toEqual({ type: 'subscribe_campaign', campaignId: 'campaign-1' });
    });
  });

  describe('Handler Updates', () => {
    it('should use latest handler without re-subscribing', async () => {
      let handler = vi.fn();

      const { rerender } = renderHook(
        ({ handlerFn }) =>
          useWebSocketSubscription(
            'entity_updated',
            handlerFn,
            { type: 'subscribe_campaign', campaignId: 'campaign-1' },
            { type: 'unsubscribe_campaign', campaignId: 'campaign-1' }
          ),
        {
          initialProps: { handlerFn: handler },
          wrapper: createWrapper({
            socket: mockSocket as unknown as WebSocketContextValue['socket'],
            connectionState: ConnectionState.Connected,
            error: null,
            reconnectAttempts: 0,
          }),
        }
      );

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      const initialEmitCount = mockSocket.emit.mock.calls.length;

      // Update handler
      const newHandler = vi.fn();
      handler = newHandler;
      rerender({ handlerFn: newHandler });

      // Verify no re-subscription occurred
      expect(mockSocket.emit.mock.calls.length).toBe(initialEmitCount);

      // Verify new handler is used
      const event: EntityUpdatedEvent = {
        type: 'entity_updated',
        timestamp: new Date().toISOString(),
        payload: {
          entityType: 'campaign',
          entityId: 'campaign-1',
          campaignId: 'campaign-1',
        },
      };

      mockSocket.simulateEvent('entity_updated', event);

      expect(newHandler).toHaveBeenCalledWith(event);
    });
  });
});

describe('useCampaignSubscription', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    vi.clearAllMocks();
  });

  it('should subscribe to campaign room and all event types', async () => {
    const handlers = {
      onEntityUpdated: vi.fn(),
      onStateInvalidated: vi.fn(),
      onWorldTimeChanged: vi.fn(),
      onSettlementUpdated: vi.fn(),
      onStructureUpdated: vi.fn(),
    };

    renderHook(() => useCampaignSubscription('campaign-1', handlers), {
      wrapper: createWrapper({
        socket: mockSocket as unknown as WebSocketContextValue['socket'],
        connectionState: ConnectionState.Connected,
        error: null,
        reconnectAttempts: 0,
      }),
    });

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('entity_updated', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('state_invalidated', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('world_time_changed', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('settlement_updated', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('structure_updated', expect.any(Function));
    });

    // Verify campaign subscription message was sent
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'subscribe_campaign',
      { type: 'subscribe_campaign', campaignId: 'campaign-1' },
      expect.any(Function)
    );
  });

  it('should invoke appropriate handlers for different event types', async () => {
    const handlers = {
      onEntityUpdated: vi.fn(),
      onWorldTimeChanged: vi.fn(),
    };

    renderHook(() => useCampaignSubscription('campaign-1', handlers), {
      wrapper: createWrapper({
        socket: mockSocket as unknown as WebSocketContextValue['socket'],
        connectionState: ConnectionState.Connected,
        error: null,
        reconnectAttempts: 0,
      }),
    });

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    // Simulate entity_updated event
    const entityEvent: EntityUpdatedEvent = {
      type: 'entity_updated',
      timestamp: new Date().toISOString(),
      payload: {
        entityType: 'campaign',
        entityId: 'campaign-1',
        campaignId: 'campaign-1',
      },
    };
    mockSocket.simulateEvent('entity_updated', entityEvent);
    expect(handlers.onEntityUpdated).toHaveBeenCalledWith(entityEvent);

    // Simulate world_time_changed event
    const timeEvent: WorldTimeChangedEvent = {
      type: 'world_time_changed',
      timestamp: new Date().toISOString(),
      payload: {
        campaignId: 'campaign-1',
        previousTime: '2024-01-01T00:00:00Z',
        newTime: '2024-01-01T01:00:00Z',
      },
    };
    mockSocket.simulateEvent('world_time_changed', timeEvent);
    expect(handlers.onWorldTimeChanged).toHaveBeenCalledWith(timeEvent);
  });

  it('should not subscribe when campaignId is undefined', () => {
    const handlers = {
      onEntityUpdated: vi.fn(),
    };

    renderHook(() => useCampaignSubscription(undefined, handlers), {
      wrapper: createWrapper({
        socket: mockSocket as unknown as WebSocketContextValue['socket'],
        connectionState: ConnectionState.Connected,
        error: null,
        reconnectAttempts: 0,
      }),
    });

    // Verify no subscription was made
    expect(mockSocket.on).not.toHaveBeenCalled();
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});

describe('useSettlementSubscription', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    vi.clearAllMocks();
  });

  it('should subscribe to settlement room and event types', async () => {
    const handlers = {
      onSettlementUpdated: vi.fn(),
      onStructureUpdated: vi.fn(),
    };

    renderHook(() => useSettlementSubscription('settlement-1', handlers), {
      wrapper: createWrapper({
        socket: mockSocket as unknown as WebSocketContextValue['socket'],
        connectionState: ConnectionState.Connected,
        error: null,
        reconnectAttempts: 0,
      }),
    });

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('settlement_updated', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('structure_updated', expect.any(Function));
    });

    // Verify settlement subscription message was sent
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'subscribe_settlement',
      { type: 'subscribe_settlement', settlementId: 'settlement-1' },
      expect.any(Function)
    );
  });

  it('should invoke appropriate handlers for settlement events', async () => {
    const handlers = {
      onSettlementUpdated: vi.fn(),
      onStructureUpdated: vi.fn(),
    };

    renderHook(() => useSettlementSubscription('settlement-1', handlers), {
      wrapper: createWrapper({
        socket: mockSocket as unknown as WebSocketContextValue['socket'],
        connectionState: ConnectionState.Connected,
        error: null,
        reconnectAttempts: 0,
      }),
    });

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    // Simulate settlement_updated event
    const settlementEvent: SettlementUpdatedEvent = {
      type: 'settlement_updated',
      timestamp: new Date().toISOString(),
      payload: {
        settlementId: 'settlement-1',
        campaignId: 'campaign-1',
        operation: 'update',
      },
    };
    mockSocket.simulateEvent('settlement_updated', settlementEvent);
    expect(handlers.onSettlementUpdated).toHaveBeenCalledWith(settlementEvent);

    // Simulate structure_updated event
    const structureEvent: StructureUpdatedEvent = {
      type: 'structure_updated',
      timestamp: new Date().toISOString(),
      payload: {
        structureId: 'structure-1',
        settlementId: 'settlement-1',
        campaignId: 'campaign-1',
        operation: 'create',
      },
    };
    mockSocket.simulateEvent('structure_updated', structureEvent);
    expect(handlers.onStructureUpdated).toHaveBeenCalledWith(structureEvent);
  });
});

describe('useStructureSubscription', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    vi.clearAllMocks();
  });

  it('should subscribe to structure room and event types', async () => {
    const handlers = {
      onStructureUpdated: vi.fn(),
    };

    renderHook(() => useStructureSubscription('structure-1', handlers), {
      wrapper: createWrapper({
        socket: mockSocket as unknown as WebSocketContextValue['socket'],
        connectionState: ConnectionState.Connected,
        error: null,
        reconnectAttempts: 0,
      }),
    });

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('structure_updated', expect.any(Function));
    });

    // Verify structure subscription message was sent
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'subscribe_structure',
      { type: 'subscribe_structure', structureId: 'structure-1' },
      expect.any(Function)
    );
  });

  it('should invoke handler for structure events', async () => {
    const handlers = {
      onStructureUpdated: vi.fn(),
    };

    renderHook(() => useStructureSubscription('structure-1', handlers), {
      wrapper: createWrapper({
        socket: mockSocket as unknown as WebSocketContextValue['socket'],
        connectionState: ConnectionState.Connected,
        error: null,
        reconnectAttempts: 0,
      }),
    });

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    // Simulate structure_updated event
    const event: StructureUpdatedEvent = {
      type: 'structure_updated',
      timestamp: new Date().toISOString(),
      payload: {
        structureId: 'structure-1',
        settlementId: 'settlement-1',
        campaignId: 'campaign-1',
        operation: 'delete',
      },
    };
    mockSocket.simulateEvent('structure_updated', event);
    expect(handlers.onStructureUpdated).toHaveBeenCalledWith(event);
  });
});
