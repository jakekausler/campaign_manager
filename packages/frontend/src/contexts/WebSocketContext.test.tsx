/**
 * Unit tests for WebSocketContext
 *
 * Tests WebSocket connection management including:
 * - Connection establishment with authentication
 * - Connection state transitions
 * - Automatic reconnection with exponential backoff
 * - Token refresh handling
 * - Cleanup on unmount
 */

import { render, renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { AuthSlice } from '@/stores/auth-slice';

import {
  WebSocketProvider,
  useWebSocket,
  useWebSocketConnection,
  ConnectionState,
} from './WebSocketContext';

// Mock socket.io-client
const mockSocket = {
  id: 'mock-socket-id',
  connected: false,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
};

const mockIo = vi.fn(() => mockSocket);

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

// Mock environment config
vi.mock('@/config/env', () => ({
  env: {
    api: {
      wsUrl: 'ws://localhost:9264',
    },
    features: {
      debug: false,
    },
  },
}));

// Mock useStore hook
const mockUseStore = vi.fn();

vi.mock('@/stores', () => ({
  useStore: (selector: (state: AuthSlice) => unknown) => mockUseStore(selector),
}));

describe('WebSocketContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.removeAllListeners.mockClear();
    mockIo.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('WebSocketProvider', () => {
    it('should render children', () => {
      // Setup mock store with no authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: null, isAuthenticated: false };
        return selector(mockState);
      });

      const { getByText } = render(
        <WebSocketProvider>
          <div>Test Child</div>
        </WebSocketProvider>
      );

      expect(getByText('Test Child')).toBeTruthy();
    });

    it('should not create connection when not authenticated', () => {
      // Setup mock store with no authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: null, isAuthenticated: false };
        return selector(mockState);
      });

      render(
        <WebSocketProvider>
          <div>Test</div>
        </WebSocketProvider>
      );

      expect(mockIo).not.toHaveBeenCalled();
    });

    it('should create connection when authenticated with token', () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      render(
        <WebSocketProvider>
          <div>Test</div>
        </WebSocketProvider>
      );

      expect(mockIo).toHaveBeenCalledWith('ws://localhost:9264', {
        auth: {
          token: mockToken,
        },
        autoConnect: true,
        reconnection: false,
        transports: ['websocket', 'polling'],
      });
    });

    it('should register socket event handlers', () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      render(
        <WebSocketProvider>
          <div>Test</div>
        </WebSocketProvider>
      );

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should cleanup on unmount', () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      const { unmount } = render(
        <WebSocketProvider>
          <div>Test</div>
        </WebSocketProvider>
      );

      unmount();

      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('useWebSocket hook', () => {
    function createWrapper({ children }: { children: ReactNode }) {
      return <WebSocketProvider>{children}</WebSocketProvider>;
    }

    it('should return socket and connection state', () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      const { result } = renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      expect(result.current).toHaveProperty('socket');
      expect(result.current).toHaveProperty('connectionState');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('reconnectAttempts');
    });

    it('should start with Disconnected state when not authenticated', () => {
      // Setup mock store with no authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: null, isAuthenticated: false };
        return selector(mockState);
      });

      const { result } = renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      expect(result.current.connectionState).toBe(ConnectionState.Disconnected);
    });

    it('should start with Connecting state when authenticated', () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      const { result } = renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      expect(result.current.connectionState).toBe(ConnectionState.Connecting);
    });

    it('should transition to Connected state on connect event', async () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      const { result } = renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      // Simulate connect event
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];

      await act(async () => {
        mockSocket.connected = true;
        connectHandler?.();
      });

      await waitFor(() => {
        expect(result.current.connectionState).toBe(ConnectionState.Connected);
      });
    });

    it('should transition to Error state on connect_error event', async () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      const { result } = renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      // Simulate connect_error event
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      )?.[1];

      const mockError = new Error('Connection failed');

      await act(async () => {
        errorHandler?.(mockError);
      });

      await waitFor(() => {
        expect(result.current.connectionState).toBe(ConnectionState.Error);
        expect(result.current.error).toBe('Connection failed');
      });
    });

    it('should reset reconnect attempts on successful connection', async () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      const { result } = renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      // Simulate error to increment reconnect attempts
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      )?.[1];

      await act(async () => {
        errorHandler?.(new Error('Test error'));
      });

      // Now simulate successful connection
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];

      await act(async () => {
        mockSocket.connected = true;
        connectHandler?.();
      });

      await waitFor(() => {
        expect(result.current.reconnectAttempts).toBe(0);
      });
    });

    it('should throw error when used outside provider', () => {
      // Mock console.error to avoid test output pollution
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWebSocket());
      }).toThrow('useWebSocket must be used within a WebSocketProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('useWebSocketConnection hook', () => {
    function createWrapper({ children }: { children: ReactNode }) {
      return <WebSocketProvider>{children}</WebSocketProvider>;
    }

    it('should return connection state', () => {
      // Setup mock store with no authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: null, isAuthenticated: false };
        return selector(mockState);
      });

      const { result } = renderHook(() => useWebSocketConnection(), {
        wrapper: createWrapper,
      });

      expect(result.current).toBe(ConnectionState.Disconnected);
    });

    it('should throw error when used outside provider', () => {
      // Mock console.error to avoid test output pollution
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWebSocketConnection());
      }).toThrow('useWebSocket must be used within a WebSocketProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Circuit Breaker & Error Resilience', () => {
    function createWrapper({ children }: { children: ReactNode }) {
      return <WebSocketProvider>{children}</WebSocketProvider>;
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should trigger circuit breaker after max reconnection attempts', async () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      // Get error handler
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      )?.[1];

      // Trigger 10 connection errors with timers
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          errorHandler?.(new Error('Connection failed'));
        });

        // Fast-forward timers to trigger reconnection
        await act(async () => {
          vi.runAllTimers();
        });
      }

      // Trigger one more error to exceed max attempts
      await act(async () => {
        errorHandler?.(new Error('Connection failed'));
      });

      // Fast-forward to trigger circuit breaker
      await act(async () => {
        vi.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.connectionState).toBe(ConnectionState.Error);
        expect(result.current.error).toContain('Unable to connect after multiple attempts');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Circuit breaker triggered')
        );
      });

      consoleSpy.mockRestore();
    });

    it('should reset reconnect attempts on successful connection', async () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      const { result } = renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      // Get handlers
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      )?.[1];
      const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];

      // Trigger some connection errors
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          errorHandler?.(new Error('Connection failed'));
        });

        await act(async () => {
          vi.runAllTimers();
        });
      }

      // Verify attempts were incremented
      expect(result.current.reconnectAttempts).toBeGreaterThan(0);

      // Simulate successful connection
      await act(async () => {
        mockSocket.connected = true;
        connectHandler?.();
      });

      // Verify attempts were reset
      await waitFor(() => {
        expect(result.current.reconnectAttempts).toBe(0);
        expect(result.current.connectionState).toBe(ConnectionState.Connected);
      });
    });

    it('should handle ping/pong events for health monitoring', async () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      // Verify ping handler was registered
      const pingHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'ping');
      expect(pingHandler).toBeDefined();

      // Verify pong handler was registered
      const pongHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'pong');
      expect(pongHandler).toBeDefined();
    });

    it('should handle token refresh by reconnecting with new token', async () => {
      let currentToken = 'old-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: currentToken, isAuthenticated: true };
        return selector(mockState);
      });

      const { rerender } = renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      // Simulate token change
      currentToken = 'new-token';

      // Trigger re-render with new token
      rerender();

      await waitFor(() => {
        // Verify disconnect was called on old socket
        expect(mockSocket.disconnect).toHaveBeenCalled();

        // Verify new connection was created with new token
        expect(mockIo).toHaveBeenCalledWith('ws://localhost:9264', {
          auth: {
            token: 'new-token',
          },
          autoConnect: true,
          reconnection: false,
          transports: ['websocket', 'polling'],
        });
      });
    });

    it('should use exponential backoff for reconnection delays', async () => {
      const mockToken = 'test-jwt-token';

      // Setup mock store with authentication
      mockUseStore.mockImplementation((selector) => {
        const mockState = { token: mockToken, isAuthenticated: true };
        return selector(mockState);
      });

      const { result } = renderHook(() => useWebSocket(), {
        wrapper: createWrapper,
      });

      // Get error handler
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      )?.[1];

      // Track reconnection attempts with their delays
      const delays: number[] = [];

      for (let i = 0; i < 5; i++) {
        const beforeAttempts = result.current.reconnectAttempts;

        await act(async () => {
          errorHandler?.(new Error('Connection failed'));
        });

        // Calculate expected delay: baseDelay * 2^attempt, capped at maxDelay
        const expectedDelay = Math.min(1000 * Math.pow(2, beforeAttempts), 32000);
        delays.push(expectedDelay);

        await act(async () => {
          vi.advanceTimersByTime(expectedDelay);
        });
      }

      // Verify exponential backoff pattern (1s, 2s, 4s, 8s, 16s)
      expect(delays).toEqual([1000, 2000, 4000, 8000, 16000]);
    });
  });

  describe('ConnectionState enum', () => {
    it('should have correct values', () => {
      expect(ConnectionState.Connecting).toBe('connecting');
      expect(ConnectionState.Connected).toBe('connected');
      expect(ConnectionState.Disconnected).toBe('disconnected');
      expect(ConnectionState.Error).toBe('error');
    });
  });
});
