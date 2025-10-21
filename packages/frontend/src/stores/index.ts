import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { createAuthSlice, type AuthSlice } from './auth-slice';
import { createCampaignSlice, type CampaignSlice } from './campaign-slice';
import { createSelectionSlice, type SelectionSlice } from './selection-slice';

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
export type RootStore = AuthSlice & CampaignSlice & SelectionSlice;

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
 *
 * NOT persisted (ephemeral session state):
 * - selection.selectedEntities (resets on page reload)
 */
export const useStore = create<RootStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createAuthSlice(...args),
        ...createCampaignSlice(...args),
        ...createSelectionSlice(...args),
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

/**
 * Hook to access selection state and actions
 *
 * Returns all selection state and actions for full control.
 * Use this hook when you need access to multiple selection actions
 * or need to perform complex selection operations.
 *
 * For better performance in components that only need to read the
 * selected entities, use useSelectedEntities() instead.
 *
 * @example
 * ```typescript
 * const { selectedEntities, selectEntity, toggleSelection } = useSelectionStore();
 *
 * // Handle entity click
 * const handleClick = (entity, isCtrlKey) => {
 *   if (isCtrlKey) {
 *     toggleSelection(entity);
 *   } else {
 *     selectEntity(entity);
 *   }
 * };
 * ```
 */
export const useSelectionStore = () =>
  useStore((state) => ({
    selectedEntities: state.selectedEntities,
    selectEntity: state.selectEntity,
    addToSelection: state.addToSelection,
    removeFromSelection: state.removeFromSelection,
    clearSelection: state.clearSelection,
    toggleSelection: state.toggleSelection,
  }));

/**
 * Selector hook for accessing selected entities only
 *
 * Optimized to only re-render when selectedEntities array changes.
 * Use this hook in components that only need to read the selection
 * state (e.g., for highlighting) and don't need the actions.
 *
 * @example
 * ```typescript
 * const selectedEntities = useSelectedEntities();
 *
 * // Highlight selected settlements on map
 * useEffect(() => {
 *   const settlementIds = selectedEntities
 *     .filter(e => e.type === EntityType.SETTLEMENT)
 *     .map(e => e.id);
 *   highlightSettlements(settlementIds);
 * }, [selectedEntities]);
 * ```
 */
export const useSelectedEntities = () => useStore((state) => state.selectedEntities);

/**
 * Selector hook for checking if a specific entity is selected
 *
 * Returns true if the entity with the given ID is in the selection.
 * Useful for conditional rendering or styling of selected entities.
 *
 * Note: This creates a new selector function on each call, so use
 * sparingly or memoize the entityId parameter.
 *
 * @param entityId - The ID of the entity to check
 *
 * @example
 * ```typescript
 * function SettlementMarker({ settlement }) {
 *   const isSelected = useIsEntitySelected(settlement.id);
 *   return (
 *     <Marker
 *       className={isSelected ? 'border-blue-500' : 'border-gray-300'}
 *     />
 *   );
 * }
 * ```
 */
export const useIsEntitySelected = (entityId: string) =>
  useStore((state) => state.selectedEntities.some((e) => e.id === entityId));

/**
 * Selector hook for getting selected entities by type
 *
 * Returns only the selected entities that match the given type.
 * Useful for view-specific filtering (e.g., only show selected
 * settlements on the map).
 *
 * Note: This creates a new filtered array on each call, so use
 * sparingly or consider memoization in the consuming component.
 *
 * @param entityType - The entity type to filter by
 *
 * @example
 * ```typescript
 * import { EntityType } from './selection-slice';
 *
 * function MapView() {
 *   const selectedSettlements = useSelectedEntitiesByType(EntityType.SETTLEMENT);
 *   const selectedStructures = useSelectedEntitiesByType(EntityType.STRUCTURE);
 *
 *   // Highlight settlements and structures on map
 * }
 * ```
 */
export const useSelectedEntitiesByType = (entityType: string) =>
  useStore((state) => state.selectedEntities.filter((e) => e.type === entityType));

// Re-export types for convenience
export type { AuthSlice, User } from './auth-slice';
export type { CampaignSlice, Campaign } from './campaign-slice';
// Export SelectionSlice types and EntityType enum (as value)
export type { SelectionSlice, SelectedEntity } from './selection-slice';
export { EntityType } from './selection-slice';
