import type { StateCreator } from 'zustand';

/**
 * Authentication state slice
 *
 * Manages user authentication state including:
 * - JWT token storage and persistence (via persist middleware)
 * - User profile information
 * - Login/logout actions
 * - Token refresh handling
 *
 * The token is automatically persisted to localStorage via the persist middleware
 * configured in the root store. On app initialization, the token is auto-loaded
 * from localStorage if it exists.
 *
 * Integration with Apollo Client:
 * - The GraphQL client reads the token from this store via getState()
 * - Token is automatically attached to all GraphQL requests
 * - Token changes immediately affect subsequent requests
 *
 * Implemented in Stage 4 of TICKET-018.
 */

/**
 * User profile information
 *
 * NOTE: This interface should be replaced with the generated GraphQL User type
 * once code generation is working (currently blocked by backend dependency issue).
 * For now, we define a minimal User type based on expected backend schema.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'player' | 'gm' | 'admin'; // User role for authorization
  createdAt?: string; // ISO 8601 timestamp
  updatedAt?: string; // ISO 8601 timestamp
}

export interface AuthSlice {
  // State
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;

  // Actions
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshToken: (token: string) => void;
  setToken: (token: string | null) => void;
}

/**
 * Creates the auth slice for the root store
 *
 * Provides authentication state management with automatic persistence.
 * The token is persisted to localStorage via the persist middleware,
 * enabling automatic re-authentication on app reload.
 *
 * @example Login flow
 * ```typescript
 * const { login } = useAuthStore();
 *
 * // After successful authentication API call
 * login(jwtToken, userData);
 * // Token is now persisted to localStorage
 * // Subsequent GraphQL requests include the token automatically
 * ```
 *
 * @example Logout flow
 * ```typescript
 * const { logout } = useAuthStore();
 *
 * logout();
 * // Token removed from store and localStorage
 * // Subsequent GraphQL requests will not include a token
 * ```
 *
 * @example Token refresh flow
 * ```typescript
 * const { refreshToken } = useAuthStore();
 *
 * // After successful token refresh API call
 * refreshToken(newJwtToken);
 * // New token persisted to localStorage
 * ```
 */
export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  // Initial state
  token: null,
  user: null,
  isAuthenticated: false,

  /**
   * Logs in a user by storing their token and profile information.
   *
   * Sets isAuthenticated to true, enabling protected routes and authenticated requests.
   * The token is automatically persisted to localStorage by the persist middleware.
   *
   * @param token - JWT authentication token from the backend
   * @param user - User profile information
   */
  login: (token, user) =>
    set({
      token,
      user,
      isAuthenticated: true,
    }),

  /**
   * Logs out the current user by clearing all authentication state.
   *
   * Clears the token, user profile, and authentication status.
   * The persist middleware automatically removes the token from localStorage.
   *
   * NOTE: This only clears local state. The calling code should also:
   * 1. Call a backend logout endpoint to invalidate the token (if applicable)
   * 2. Clear Apollo Client cache: client.clearStore() or client.resetStore()
   * 3. Redirect to the login page
   */
  logout: () =>
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    }),

  /**
   * Updates the current user's profile information.
   *
   * Useful after profile updates (name change, email change, etc.) without
   * requiring a full re-authentication. Does not affect token or auth status.
   *
   * @param user - Updated user profile information
   */
  updateUser: (user) =>
    set({
      user,
    }),

  /**
   * Refreshes the authentication token.
   *
   * Use this when the backend issues a new token (e.g., token refresh flow
   * before expiration). The new token is automatically persisted to localStorage.
   *
   * Does not change user profile or authentication status.
   *
   * @param token - New JWT token from the backend
   */
  refreshToken: (token) =>
    set({
      token,
    }),

  /**
   * Sets or clears the authentication token.
   *
   * Lower-level method for token management. Automatically updates
   * isAuthenticated based on token presence. Prefer using login/logout
   * for most use cases.
   *
   * @param token - JWT token or null to clear
   */
  setToken: (token) =>
    set({
      token,
      isAuthenticated: !!token,
    }),
});
