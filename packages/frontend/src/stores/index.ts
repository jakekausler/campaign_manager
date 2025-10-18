import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { createAuthSlice, type AuthSlice } from './auth-slice';
import { createCampaignSlice, type CampaignSlice } from './campaign-slice';

/**
 * Root store combining all slices
 *
 * Uses Zustand's slice pattern with middleware:
 * - devtools: Redux DevTools integration (development only)
 * - persist: Persist auth token and campaign ID to localStorage
 *
 * Each slice is independent and can be imported separately via hooks.
 */

// Combined store type
export type RootStore = AuthSlice & CampaignSlice;

/**
 * Root store instance with middleware
 *
 * Middleware stack:
 * 1. devtools - Redux DevTools integration for debugging
 * 2. persist - Persist selected state to localStorage
 *
 * Persisted state:
 * - auth.token (for auto-login and attaching to GraphQL requests)
 * - auth.user (for immediate profile access on app reload)
 * - campaign.currentCampaignId (for restoring context)
 */
export const useStore = create<RootStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createAuthSlice(...args),
        ...createCampaignSlice(...args),
      }),
      {
        name: 'campaign-manager-storage', // localStorage key
        // Persist only necessary state (not entire store)
        // Auth: token + user for auto-login and immediate profile access
        // Campaign: currentCampaignId for restoring context
        partialize: (state) => ({
          token: state.token,
          user: state.user,
          currentCampaignId: state.currentCampaignId,
        }),
        // Restore isAuthenticated when hydrating from localStorage
        // This ensures the auth state is fully restored on app reload
        // NOTE: Direct state mutation is expected behavior for onRehydrateStorage callback
        // NOTE: This does not validate the token - validation happens on first GraphQL request
        //       If token is expired/invalid, Apollo Client error link should handle logout
        onRehydrateStorage: () => (state) => {
          if (state?.token) {
            state.isAuthenticated = true;
          }
        },
      }
    ),
    {
      name: 'CampaignManagerStore', // DevTools name
      enabled: import.meta.env.DEV, // Only in development
    }
  )
);

/**
 * Hook to access auth state and actions
 *
 * @example
 * ```typescript
 * const { user, isAuthenticated, login, logout } = useAuthStore();
 * ```
 */
export const useAuthStore = () =>
  useStore((state) => ({
    token: state.token,
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    login: state.login,
    logout: state.logout,
    updateUser: state.updateUser,
    refreshToken: state.refreshToken,
    setToken: state.setToken,
  }));

/**
 * Hook to access campaign context state and actions
 *
 * @example
 * ```typescript
 * const { currentCampaignId, campaign, setCurrentCampaign } = useCampaignStore();
 * ```
 */
export const useCampaignStore = () =>
  useStore((state) => ({
    currentCampaignId: state.currentCampaignId,
    currentBranchId: state.currentBranchId,
    asOfTime: state.asOfTime,
    campaign: state.campaign,
    setCurrentCampaign: state.setCurrentCampaign,
    setCurrentBranch: state.setCurrentBranch,
    setAsOfTime: state.setAsOfTime,
    clearCampaignContext: state.clearCampaignContext,
  }));

/**
 * Selector hook for accessing current campaign ID only
 * Useful for components that only need to know which campaign is selected
 *
 * @example
 * ```typescript
 * const campaignId = useCurrentCampaignId();
 * ```
 */
export const useCurrentCampaignId = () => useStore((state) => state.currentCampaignId);

/**
 * Selector hook for accessing current branch ID only
 *
 * @example
 * ```typescript
 * const branchId = useCurrentBranchId();
 * ```
 */
export const useCurrentBranchId = () => useStore((state) => state.currentBranchId);

/**
 * Selector hook for accessing asOf time only
 * Used for time-travel queries
 *
 * @example
 * ```typescript
 * const asOfTime = useAsOfTime();
 * ```
 */
export const useAsOfTime = () => useStore((state) => state.asOfTime);

/**
 * Selector hook for checking authentication status
 * Optimized to only re-render when authentication status changes
 *
 * @example
 * ```typescript
 * const isAuthenticated = useIsAuthenticated();
 * if (!isAuthenticated) {
 *   return <LoginPage />;
 * }
 * ```
 */
export const useIsAuthenticated = () => useStore((state) => state.isAuthenticated);

/**
 * Selector hook for accessing current user
 *
 * @example
 * ```typescript
 * const user = useCurrentUser();
 * return <div>Welcome, {user?.name}</div>;
 * ```
 */
export const useCurrentUser = () => useStore((state) => state.user);

// Re-export types for convenience
export type { AuthSlice, User } from './auth-slice';
export type { CampaignSlice, Campaign } from './campaign-slice';
