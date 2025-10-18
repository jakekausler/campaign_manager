import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { MainLayout, AuthLayout } from '@/components/layout';

import { ProtectedRoute } from './ProtectedRoute';

// Lazy-loaded page components for code splitting
const HomePage = lazy(() => import('@/pages/HomePage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="text-center" role="status" aria-label="Loading page">
      <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Wrapper component for lazy-loaded pages
const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

/**
 * Application router configuration using React Router v6
 *
 * Features:
 * - Code splitting via lazy loading for optimal bundle size
 * - Protected routes for authenticated pages
 * - Nested layouts (MainLayout for public, AuthLayout for auth pages)
 * - 404 error handling
 * - Type-safe routing with TypeScript
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: (
          <LazyPage>
            <HomePage />
          </LazyPage>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <LazyPage>
              <DashboardPage />
            </LazyPage>
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/auth/login" replace />,
      },
      {
        path: 'login',
        element: (
          <LazyPage>
            <LoginPage />
          </LazyPage>
        ),
      },
    ],
  },
  {
    path: '*',
    element: (
      <LazyPage>
        <NotFoundPage />
      </LazyPage>
    ),
  },
]);
