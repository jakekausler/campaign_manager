/**
 * Unit tests for auth-slice.ts
 *
 * Tests authentication state management including:
 * - Login/logout flows
 * - Token management
 * - User profile updates
 * - State consistency
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';

import { createAuthSlice, type AuthSlice, type User } from './auth-slice';

// Create a test store for each test
function createTestStore() {
  return create<AuthSlice>()(createAuthSlice);
}

// Mock user data
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'player',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockToken = 'mock-jwt-token-123456789';

describe('AuthSlice', () => {
  describe('Initial State', () => {
    it('should initialize with null token', () => {
      const store = createTestStore();
      expect(store.getState().token).toBeNull();
    });

    it('should initialize with null user', () => {
      const store = createTestStore();
      expect(store.getState().user).toBeNull();
    });

    it('should initialize with isAuthenticated false', () => {
      const store = createTestStore();
      expect(store.getState().isAuthenticated).toBe(false);
    });
  });

  describe('login()', () => {
    it('should set token when user logs in', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);
      expect(store.getState().token).toBe(mockToken);
    });

    it('should set user when user logs in', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);
      expect(store.getState().user).toEqual(mockUser);
    });

    it('should set isAuthenticated to true when user logs in', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);
      expect(store.getState().isAuthenticated).toBe(true);
    });

    it('should store user with all optional fields', () => {
      const store = createTestStore();
      const userWithAllFields: User = {
        id: 'user-456',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        createdAt: '2024-02-01T00:00:00.000Z',
        updatedAt: '2024-02-01T00:00:00.000Z',
      };
      store.getState().login(mockToken, userWithAllFields);
      expect(store.getState().user).toEqual(userWithAllFields);
    });

    it('should store user with minimal fields', () => {
      const store = createTestStore();
      const minimalUser: User = {
        id: 'user-789',
        email: 'minimal@example.com',
        name: 'Minimal User',
      };
      store.getState().login(mockToken, minimalUser);
      expect(store.getState().user).toEqual(minimalUser);
    });
  });

  describe('logout()', () => {
    beforeEach(() => {
      // Helper to setup authenticated state before each logout test
    });

    it('should clear token when user logs out', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);
      store.getState().logout();
      expect(store.getState().token).toBeNull();
    });

    it('should clear user when user logs out', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);
      store.getState().logout();
      expect(store.getState().user).toBeNull();
    });

    it('should set isAuthenticated to false when user logs out', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);
      store.getState().logout();
      expect(store.getState().isAuthenticated).toBe(false);
    });

    it('should handle logout when already logged out', () => {
      const store = createTestStore();
      store.getState().logout();
      expect(store.getState().token).toBeNull();
      expect(store.getState().user).toBeNull();
      expect(store.getState().isAuthenticated).toBe(false);
    });
  });

  describe('updateUser()', () => {
    it('should update user profile without changing token', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);

      const updatedUser: User = {
        ...mockUser,
        name: 'Updated Name',
      };
      store.getState().updateUser(updatedUser);

      expect(store.getState().user).toEqual(updatedUser);
      expect(store.getState().token).toBe(mockToken);
    });

    it('should update user profile without changing isAuthenticated', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);

      const updatedUser: User = {
        ...mockUser,
        email: 'newemail@example.com',
      };
      store.getState().updateUser(updatedUser);

      expect(store.getState().user).toEqual(updatedUser);
      expect(store.getState().isAuthenticated).toBe(true);
    });

    it('should allow changing user role', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);

      const updatedUser: User = {
        ...mockUser,
        role: 'gm',
      };
      store.getState().updateUser(updatedUser);

      expect(store.getState().user?.role).toBe('gm');
    });

    it('should allow removing optional fields', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);

      const updatedUser: User = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        // role, createdAt, updatedAt omitted
      };
      store.getState().updateUser(updatedUser);

      expect(store.getState().user).toEqual(updatedUser);
      expect(store.getState().user?.role).toBeUndefined();
    });
  });

  describe('refreshToken()', () => {
    it('should update token without changing user', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);

      const newToken = 'new-refreshed-token-987654321';
      store.getState().refreshToken(newToken);

      expect(store.getState().token).toBe(newToken);
      expect(store.getState().user).toEqual(mockUser);
    });

    it('should update token without changing isAuthenticated', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);

      const newToken = 'new-refreshed-token-987654321';
      store.getState().refreshToken(newToken);

      expect(store.getState().token).toBe(newToken);
      expect(store.getState().isAuthenticated).toBe(true);
    });

    it('should handle token refresh when not logged in', () => {
      const store = createTestStore();
      const newToken = 'unexpected-token-111222333';
      store.getState().refreshToken(newToken);

      expect(store.getState().token).toBe(newToken);
      // Note: This is edge case behavior - refreshToken doesn't update isAuthenticated
      // Prefer using login() for full authentication or setToken() for token management
      expect(store.getState().isAuthenticated).toBe(false);
      expect(store.getState().user).toBeNull();
    });
  });

  describe('setToken()', () => {
    it('should set token and update isAuthenticated when token provided', () => {
      const store = createTestStore();
      store.getState().setToken(mockToken);

      expect(store.getState().token).toBe(mockToken);
      expect(store.getState().isAuthenticated).toBe(true);
    });

    it('should clear token and update isAuthenticated when token is null', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);
      store.getState().setToken(null);

      expect(store.getState().token).toBeNull();
      expect(store.getState().isAuthenticated).toBe(false);
    });

    it('should clear user when setting token to null', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);
      store.getState().setToken(null);

      expect(store.getState().user).toBeNull();
    });

    it('should not clear user when setting token to non-null value', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);

      const newToken = 'another-token-555666777';
      store.getState().setToken(newToken);

      expect(store.getState().token).toBe(newToken);
      expect(store.getState().user).toEqual(mockUser);
      expect(store.getState().isAuthenticated).toBe(true);
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state after login -> updateUser -> refreshToken', () => {
      const store = createTestStore();

      // Login
      store.getState().login(mockToken, mockUser);
      expect(store.getState().isAuthenticated).toBe(true);

      // Update user
      const updatedUser: User = { ...mockUser, name: 'New Name' };
      store.getState().updateUser(updatedUser);
      expect(store.getState().user?.name).toBe('New Name');
      expect(store.getState().isAuthenticated).toBe(true);

      // Refresh token
      const newToken = 'refreshed-token-123';
      store.getState().refreshToken(newToken);
      expect(store.getState().token).toBe(newToken);
      expect(store.getState().user?.name).toBe('New Name');
      expect(store.getState().isAuthenticated).toBe(true);
    });

    it('should maintain consistent state after login -> logout -> login', () => {
      const store = createTestStore();

      // First login
      store.getState().login(mockToken, mockUser);
      expect(store.getState().isAuthenticated).toBe(true);

      // Logout
      store.getState().logout();
      expect(store.getState().isAuthenticated).toBe(false);
      expect(store.getState().token).toBeNull();
      expect(store.getState().user).toBeNull();

      // Second login with different user
      const newUser: User = {
        id: 'user-999',
        email: 'newuser@example.com',
        name: 'New User',
      };
      const newToken = 'new-token-999888777';
      store.getState().login(newToken, newUser);

      expect(store.getState().token).toBe(newToken);
      expect(store.getState().user).toEqual(newUser);
      expect(store.getState().isAuthenticated).toBe(true);
    });

    it('should prevent inconsistent state when using setToken(null)', () => {
      const store = createTestStore();
      store.getState().login(mockToken, mockUser);

      // setToken(null) should clear user to prevent having user without token
      store.getState().setToken(null);

      expect(store.getState().token).toBeNull();
      expect(store.getState().user).toBeNull();
      expect(store.getState().isAuthenticated).toBe(false);
    });
  });

  describe('User Roles', () => {
    it('should support player role', () => {
      const store = createTestStore();
      const player: User = { ...mockUser, role: 'player' };
      store.getState().login(mockToken, player);
      expect(store.getState().user?.role).toBe('player');
    });

    it('should support gm role', () => {
      const store = createTestStore();
      const gm: User = { ...mockUser, role: 'gm' };
      store.getState().login(mockToken, gm);
      expect(store.getState().user?.role).toBe('gm');
    });

    it('should support admin role', () => {
      const store = createTestStore();
      const admin: User = { ...mockUser, role: 'admin' };
      store.getState().login(mockToken, admin);
      expect(store.getState().user?.role).toBe('admin');
    });

    it('should support undefined role', () => {
      const store = createTestStore();
      const userWithoutRole: User = {
        id: 'user-no-role',
        email: 'norole@example.com',
        name: 'No Role User',
      };
      store.getState().login(mockToken, userWithoutRole);
      expect(store.getState().user?.role).toBeUndefined();
    });
  });
});
