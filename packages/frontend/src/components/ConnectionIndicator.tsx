/**
 * Connection Status Indicator
 *
 * Displays the current WebSocket connection status in the UI.
 * Shows different states: connecting, connected, disconnected, error.
 *
 * Features:
 * - Color-coded status indicator
 * - Tooltip with connection details
 * - Reconnection attempt counter
 * - Auto-hides when connected (after brief delay)
 *
 * Usage:
 * ```tsx
 * <ConnectionIndicator />
 * ```
 */

import { useEffect, useState } from 'react';

import { ConnectionState, useWebSocket } from '@/contexts/WebSocketContext';

/**
 * Connection indicator component
 *
 * Shows a colored dot with connection status.
 * Only visible when not connected (or briefly after connection).
 */
export function ConnectionIndicator() {
  const { connectionState, error, reconnectAttempts } = useWebSocket();
  const [isVisible, setIsVisible] = useState(true);

  /**
   * Auto-hide the indicator after successful connection
   * (after 3 seconds)
   */
  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      // Show indicator when not connected
      setIsVisible(true);
      return undefined;
    }
  }, [connectionState]);

  // Don't render if hidden and connected
  if (!isVisible && connectionState === ConnectionState.Connected) {
    return null;
  }

  /**
   * Get status color based on connection state
   */
  const getStatusColor = () => {
    switch (connectionState) {
      case ConnectionState.Connected:
        return 'bg-green-500';
      case ConnectionState.Connecting:
        return 'bg-yellow-500';
      case ConnectionState.Disconnected:
        return 'bg-gray-400';
      case ConnectionState.Error:
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  /**
   * Get status text for tooltip
   */
  const getStatusText = () => {
    switch (connectionState) {
      case ConnectionState.Connected:
        return 'Connected to server';
      case ConnectionState.Connecting:
        return 'Connecting to server...';
      case ConnectionState.Disconnected:
        return 'Disconnected from server';
      case ConnectionState.Error:
        return `Connection error: ${error || 'Unknown error'}`;
      default:
        return 'Unknown status';
    }
  };

  /**
   * Get additional status details
   */
  const getStatusDetails = () => {
    // Check if circuit breaker triggered (error with message about max attempts)
    if (
      connectionState === ConnectionState.Error &&
      error?.includes('Unable to connect after multiple attempts')
    ) {
      return '(Max retries reached)';
    }
    if (connectionState === ConnectionState.Error && reconnectAttempts > 0) {
      return `(Reconnect attempt ${reconnectAttempts})`;
    }
    if (connectionState === ConnectionState.Disconnected && reconnectAttempts > 0) {
      return `(Reconnecting... attempt ${reconnectAttempts})`;
    }
    return null;
  };

  const statusDetails = getStatusDetails();

  return (
    <div
      className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm"
      title={getStatusText()}
    >
      {/* Status dot */}
      <div
        className={`h-2 w-2 rounded-full ${getStatusColor()} ${
          connectionState === ConnectionState.Connecting ? 'animate-pulse' : ''
        }`}
      />

      {/* Status text */}
      <span className="text-muted-foreground">
        {connectionState === ConnectionState.Connected
          ? 'Live'
          : connectionState === ConnectionState.Connecting
            ? 'Connecting'
            : connectionState === ConnectionState.Disconnected
              ? 'Offline'
              : 'Error'}
      </span>

      {/* Reconnection attempts */}
      {statusDetails && <span className="text-xs text-muted-foreground">{statusDetails}</span>}
    </div>
  );
}
