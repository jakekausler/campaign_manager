/**
 * Campaign Management Tool - Main App Component
 *
 * Root application component that provides the React Router configuration
 * for client-side routing and navigation, as well as the WebSocket connection
 * for real-time updates.
 */

import { RouterProvider } from 'react-router-dom';

import { Toaster } from '@/components/ui/toaster';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { router } from '@/router';

function App() {
  return (
    <WebSocketProvider>
      <RouterProvider router={router} />
      <Toaster />
    </WebSocketProvider>
  );
}

export default App;
