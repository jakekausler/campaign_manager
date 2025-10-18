import type { StateCreator } from 'zustand';

/**
 * Authentication state slice
 *
 * Manages user authentication state including:
 * - JWT token storage and persistence
 * - User profile information
 * - Login/logout actions
 *
 * This will be fully implemented in Stage 4 of TICKET-018.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  // Additional fields will be added based on generated GraphQL types
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
 * NOTE: This is a placeholder implementation for Stage 1.
 * Full implementation will be done in Stage 4.
 */
export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  // Initial state
  token: null,
  user: null,
  isAuthenticated: false,

  // Actions (placeholder implementations)
  login: (token, user) =>
    set({
      token,
      user,
      isAuthenticated: true,
    }),

  logout: () =>
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    }),

  updateUser: (user) =>
    set({
      user,
    }),

  refreshToken: (token) =>
    set({
      token,
    }),

  setToken: (token) =>
    set({
      token,
      isAuthenticated: !!token,
    }),
});
