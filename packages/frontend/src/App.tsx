/**
 * Campaign Management Tool - Main App Component
 *
 * Root application component that provides the React Router configuration
 * for client-side routing and navigation, as well as the WebSocket connection
 * for real-time updates.
 */

import { ApolloProvider } from '@apollo/client/react';
import { RouterProvider } from 'react-router-dom';

import { Toaster } from '@/components/ui/toaster';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { useWebSocketCacheSync } from '@/hooks';
import { router } from '@/router';
import { graphqlClient } from '@/services/api/graphql-client';
import { useCurrentCampaignId } from '@/stores';

/**
 * AppWithCacheSync - Inner component that uses cache sync hook
 *
 * This component must be inside WebSocketProvider to have access to WebSocket context.
 * It subscribes to WebSocket events and syncs them with Apollo cache.
 */
function AppWithCacheSync() {
  const currentCampaignId = useCurrentCampaignId();

  // Sync WebSocket events with Apollo cache for current campaign
  useWebSocketCacheSync(currentCampaignId);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <ApolloProvider client={graphqlClient}>
      <WebSocketProvider>
        <AppWithCacheSync />
      </WebSocketProvider>
    </ApolloProvider>
  );
}

export default App;
