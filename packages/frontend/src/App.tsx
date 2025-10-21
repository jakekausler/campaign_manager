/**
 * Campaign Management Tool - Main App Component
 *
 * Root application component that provides the React Router configuration
 * for client-side routing and navigation.
 */

import { RouterProvider } from 'react-router-dom';

import { Toaster } from '@/components/ui/toaster';
import { router } from '@/router';

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

export default App;
