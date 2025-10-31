/**
 * WebSocket Context Provider
 *
 * Manages a single global Socket.IO connection for real-time updates.
 * Handles authentication, connection lifecycle, and automatic reconnection.
 *
 * Features:
 * - Automatic authentication with JWT token from auth store
 * - Exponential backoff reconnection strategy
 * - Connection state management (connecting, connected, disconnected, error)
 * - Automatic cleanup on unmount
 * - Token refresh on reconnection
 *
 * Usage:
 * ```tsx
 * // In App.tsx or main.tsx
 * <WebSocketProvider>
 *   <YourApp />
 * </WebSocketProvider>
 *
 * // In components
 * const { socket, connectionState } = useWebSocket();
 * ```
 */

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { env } from '@/config/env';
import { useStore } from '@/stores';

/**
 * Connection state enum
 */
export enum ConnectionState {
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
}

/**
 * WebSocket context value
 */
export interface WebSocketContextValue {
  /**
   * Socket.IO client instance (null if not connected)
   */
  socket: Socket | null;

  /**
   * Current connection state
   */
  connectionState: ConnectionState;

  /**
   * Error message (if connectionState is Error)
   */
  error: string | null;

  /**
   * Number of reconnection attempts made
   */
  reconnectAttempts: number;
}

/**
 * WebSocket context
 */
const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

/**
 * WebSocket provider props
 */
export interface WebSocketProviderProps {
  children: ReactNode;
}

/**
 * Exponential backoff configuration
 */
const RECONNECT_CONFIG = {
  baseDelay: 1000, // 1 second
  maxDelay: 32000, // 32 seconds
  maxAttempts: Infinity, // Keep trying forever
};

/**
 * Calculates exponential backoff delay
 */
function calculateBackoff(attempt: number): number {
  const delay = RECONNECT_CONFIG.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, RECONNECT_CONFIG.maxDelay);
}

/**
 * WebSocket provider component
 *
 * Creates and manages a single Socket.IO connection for the entire application.
 * Automatically connects on mount and cleans up on unmount.
 *
 * The connection is authenticated using the JWT token from the auth store.
 * On reconnection, the token is automatically refreshed from the store.
 */
export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected
  );
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Use ref to track if we're intentionally disconnecting
  const intentionalDisconnect = useRef(false);

  // Use ref to track reconnection timeout
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get auth token from store
  const token = useStore((state) => state.token);
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  /**
   * Creates a new Socket.IO connection with authentication
   */
  const createConnection = (authToken: string) => {
    if (env.features.debug) {
      console.log('[WebSocket] Creating connection with token');
    }

    // Create Socket.IO client with authentication
    const newSocket = io(env.api.wsUrl, {
      auth: {
        token: authToken,
      },
      autoConnect: true,
      reconnection: false, // We handle reconnection manually
      transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      if (env.features.debug) {
        console.log('[WebSocket] Connected successfully', {
          socketId: newSocket.id,
        });
      }
      setConnectionState(ConnectionState.Connected);
      setError(null);
      setReconnectAttempts(0); // Reset attempts on successful connection
    });

    newSocket.on('disconnect', (reason) => {
      if (env.features.debug) {
        console.log('[WebSocket] Disconnected', { reason });
      }

      // Don't attempt reconnection if disconnect was intentional
      if (intentionalDisconnect.current) {
        setConnectionState(ConnectionState.Disconnected);
        return;
      }

      // Attempt reconnection with exponential backoff
      setConnectionState(ConnectionState.Disconnected);
      scheduleReconnection();
    });

    newSocket.on('connect_error', (err) => {
      console.error('[WebSocket] Connection error', err);
      setConnectionState(ConnectionState.Error);
      setError(err.message || 'Connection failed');

      // Attempt reconnection with exponential backoff
      scheduleReconnection();
    });

    newSocket.on('error', (err) => {
      console.error('[WebSocket] Socket error', err);
      setError(err.message || 'Socket error occurred');
    });

    setSocket(newSocket);
    setConnectionState(ConnectionState.Connecting);
  };

  /**
   * Schedules a reconnection attempt with exponential backoff
   */
  const scheduleReconnection = () => {
    // Clear any existing reconnection timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }

    // Check if we have a token to reconnect with
    if (!token || !isAuthenticated) {
      if (env.features.debug) {
        console.log('[WebSocket] No token available for reconnection');
      }
      return;
    }

    // Calculate backoff delay
    const delay = calculateBackoff(reconnectAttempts);

    if (env.features.debug) {
      console.log(
        `[WebSocket] Scheduling reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`
      );
    }

    reconnectTimeout.current = setTimeout(() => {
      setReconnectAttempts((prev) => prev + 1);

      // Disconnect old socket if it exists
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }

      // Create new connection
      createConnection(token);
    }, delay);
  };

  /**
   * Effect: Create connection when authenticated
   */
  useEffect(() => {
    // Only connect if authenticated and have a token
    if (!isAuthenticated || !token) {
      if (env.features.debug) {
        console.log('[WebSocket] Not authenticated, skipping connection');
      }
      return;
    }

    // Don't create a new connection if one already exists
    if (socket && socket.connected) {
      if (env.features.debug) {
        console.log('[WebSocket] Already connected, skipping');
      }
      return;
    }

    // Reset intentional disconnect flag
    intentionalDisconnect.current = false;

    // Create connection
    createConnection(token);

    // Cleanup function
    return () => {
      if (env.features.debug) {
        console.log('[WebSocket] Cleaning up connection');
      }

      // Mark as intentional disconnect
      intentionalDisconnect.current = true;

      // Clear reconnection timeout
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      // Disconnect socket
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }

      setSocket(null);
      setConnectionState(ConnectionState.Disconnected);
      setReconnectAttempts(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  /**
   * Effect: Handle token refresh (reconnect with new token)
   */
  useEffect(() => {
    // If token changes and we have an existing connection, reconnect with new token
    if (socket && token && isAuthenticated) {
      if (env.features.debug) {
        console.log('[WebSocket] Token changed, reconnecting with new token');
      }

      // Disconnect old socket
      intentionalDisconnect.current = true;
      socket.removeAllListeners();
      socket.disconnect();

      // Reconnect with new token
      intentionalDisconnect.current = false;
      createConnection(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const contextValue: WebSocketContextValue = {
    socket,
    connectionState,
    error,
    reconnectAttempts,
  };

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
}

/**
 * Hook to access WebSocket context
 *
 * @throws Error if used outside WebSocketProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { socket, connectionState } = useWebSocket();
 *
 *   if (connectionState === ConnectionState.Connected && socket) {
 *     // Subscribe to events, emit messages, etc.
 *   }
 * }
 * ```
 */
export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

/**
 * Hook to get just the connection state
 *
 * Convenience hook for components that only need to display connection status.
 *
 * @example
 * ```tsx
 * function ConnectionIndicator() {
 *   const connectionState = useWebSocketConnection();
 *   return <div>Status: {connectionState}</div>;
 * }
 * ```
 */
export function useWebSocketConnection(): ConnectionState {
  const { connectionState } = useWebSocket();
  return connectionState;
}
