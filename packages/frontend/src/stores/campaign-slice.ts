import type { StateCreator } from 'zustand';

/**
 * Campaign context state slice
 *
 * Manages the current campaign context including:
 * - Current campaign ID and data
 * - Current branch ID for version control
 * - asOf time for time-travel queries
 *
 * This state is critical for:
 * - Ensuring all GraphQL queries are scoped to the correct campaign
 * - Supporting version control/branching workflows
 * - Enabling time-travel queries (viewing past states)
 * - Maintaining context across page reloads (via localStorage persistence)
 *
 * State persistence:
 * - currentCampaignId is persisted to localStorage (restore context on reload)
 * - Other fields (campaign, branchId, asOfTime) are ephemeral (not persisted)
 * - Campaign data should be refetched on app reload
 *
 * Integration with GraphQL:
 * - Campaign context variables can be passed to queries via Apollo Client context
 * - Time-travel queries use asOfTime parameter
 * - Branch-specific queries use currentBranchId parameter
 */

/**
 * Campaign type definition
 *
 * NOTE: This is a placeholder type. Once the backend GraphQL API is fixed
 * (RulesEngineClientService dependency injection issue), this should be
 * replaced with the generated Campaign type from @/__generated__/graphql.ts
 *
 * TODO: Replace with generated type once backend is running:
 * import type { Campaign } from '@/__generated__/graphql';
 */
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  // Additional fields will be added based on generated GraphQL types
  // Expected fields: ownerId, settings, branches, etc.
}

/**
 * Campaign slice state and actions
 */
export interface CampaignSlice {
  // ==================== State ====================

  /**
   * ID of the currently selected campaign
   * Persisted to localStorage for context restoration on app reload
   */
  currentCampaignId: string | null;

  /**
   * ID of the currently selected branch
   * Used for version control and branching workflows
   * NOT persisted (ephemeral session state)
   */
  currentBranchId: string | null;

  /**
   * Timestamp for time-travel queries
   * When set, queries will return data as it existed at this point in time
   * NOT persisted (ephemeral session state)
   */
  asOfTime: Date | null;

  /**
   * Full campaign object
   * NOT persisted (refetched on app reload)
   */
  campaign: Campaign | null;

  // ==================== Actions ====================

  /**
   * Set the current campaign context
   *
   * Sets both the campaign ID and full campaign object. The campaign ID
   * will be persisted to localStorage, while the full campaign object
   * will not be persisted and should be refetched on app reload.
   *
   * This action should be called:
   * - After user selects a campaign from campaign list
   * - After creating a new campaign
   * - After successful login (if user has a default campaign)
   *
   * Side effects:
   * - Updates currentCampaignId (persisted)
   * - Updates campaign object (not persisted)
   * - All subsequent GraphQL queries should use this campaign context
   *
   * @param campaignId - The campaign ID to set as current
   * @param campaign - The full campaign object
   *
   * @example
   * ```typescript
   * const { setCurrentCampaign } = useCampaignStore();
   *
   * // After fetching campaign from API
   * const campaign = await fetchCampaign(campaignId);
   * setCurrentCampaign(campaignId, campaign);
   * ```
   */
  setCurrentCampaign: (campaignId: string, campaign: Campaign) => void;

  /**
   * Set the current branch ID
   *
   * Changes the active branch for version control workflows.
   * This affects which version of data is queried from the backend.
   *
   * NOT persisted to localStorage (ephemeral session state).
   *
   * @param branchId - The branch ID to set as current
   *
   * @example
   * ```typescript
   * const { setCurrentBranch } = useCampaignStore();
   *
   * // Switch to a different branch
   * setCurrentBranch('branch-xyz');
   *
   * // Switch to main branch
   * setCurrentBranch('main');
   * ```
   */
  setCurrentBranch: (branchId: string) => void;

  /**
   * Set the asOf time for time-travel queries
   *
   * When set to a Date, all queries will return data as it existed at that
   * point in time. When set to null, queries return current data.
   *
   * NOT persisted to localStorage (ephemeral session state).
   *
   * Use cases:
   * - Viewing historical campaign state
   * - Auditing changes over time
   * - Comparing current vs past state
   *
   * @param time - The timestamp for time-travel, or null for current time
   *
   * @example
   * ```typescript
   * const { setAsOfTime } = useCampaignStore();
   *
   * // View state as it was yesterday
   * const yesterday = new Date();
   * yesterday.setDate(yesterday.getDate() - 1);
   * setAsOfTime(yesterday);
   *
   * // Return to current time
   * setAsOfTime(null);
   * ```
   */
  setAsOfTime: (time: Date | null) => void;

  /**
   * Clear all campaign context state
   *
   * Resets all campaign-related state to initial values. This should be
   * called when:
   * - User logs out
   * - User navigates away from campaign view
   * - Campaign is deleted
   *
   * This will clear the persisted currentCampaignId from localStorage.
   *
   * @example
   * ```typescript
   * const { clearCampaignContext } = useCampaignStore();
   *
   * // On logout
   * clearCampaignContext();
   * ```
   */
  clearCampaignContext: () => void;
}

/**
 * Creates the campaign slice for the root store
 *
 * Implements campaign context management with proper state transitions
 * and side effect handling. Integrates with Zustand middleware for
 * persistence and devtools.
 */
export const createCampaignSlice: StateCreator<CampaignSlice> = (set) => ({
  // ==================== Initial State ====================
  currentCampaignId: null,
  currentBranchId: null,
  asOfTime: null,
  campaign: null,

  // ==================== Actions ====================

  setCurrentCampaign: (campaignId, campaign) =>
    set({
      currentCampaignId: campaignId,
      campaign,
      // Reset branch and time-travel when switching campaigns
      // This prevents stale branch/time context from previous campaign
      currentBranchId: null,
      asOfTime: null,
    }),

  setCurrentBranch: (branchId) =>
    set({
      currentBranchId: branchId,
    }),

  setAsOfTime: (time) =>
    set({
      asOfTime: time,
    }),

  clearCampaignContext: () =>
    set({
      currentCampaignId: null,
      currentBranchId: null,
      asOfTime: null,
      campaign: null,
    }),
});
