import { Navigate, useLocation } from 'react-router-dom';

/**
 * Props for the ProtectedRoute component
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Higher-order component that protects routes requiring authentication
 *
 * Features:
 * - Checks if user is authenticated
 * - Redirects to login page if not authenticated
 * - Preserves intended destination for redirect after login
 * - TODO: Integrate with actual authentication context/hook
 *
 * @example
 * ```tsx
 * <ProtectedRoute>
 *   <DashboardPage />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  // TODO: Replace with actual authentication check from useAuth hook
  // For now, we'll use a placeholder that checks localStorage
  const isAuthenticated = checkAuth();

  if (!isAuthenticated) {
    // Redirect to login page, preserving the intended destination
    // After login, user will be redirected back to this location
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/**
 * Placeholder authentication check
 * TODO: Replace with actual authentication logic from auth context/service
 *
 * Implementation notes for future auth integration:
 * 1. Create useAuth hook in src/hooks/useAuth.ts
 * 2. Implement AuthContext in src/contexts/AuthContext.tsx
 * 3. Parse and validate JWT token structure
 * 4. Verify token signature (if implementing local validation)
 * 5. Check token expiry timestamp (exp claim) and reject expired tokens
 * 6. Optionally verify token with backend for revocation check
 * 7. Handle token refresh flow when nearing expiry
 *
 * SECURITY: Never rely solely on token existence. Must validate:
 * - Token format and signature
 * - Expiration timestamp
 * - Issuer and audience claims
 */
function checkAuth(): boolean {
  // Placeholder: Check if token exists in localStorage
  // WARNING: This is insecure and only for development. Production must validate JWT properly.
  const token = localStorage.getItem('auth_token');
  return !!token;

  // Future implementation:
  // const { isAuthenticated, isLoading } = useAuth();
  // if (isLoading) return <PageLoader />;
  // return isAuthenticated;
}
