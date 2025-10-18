import type { StateCreator } from 'zustand';

/**
 * Campaign context state slice
 *
 * Manages the current campaign context including:
 * - Current campaign ID and data
 * - Current branch ID for version control
 * - asOf time for time-travel queries
 *
 * This will be fully implemented in Stage 5 of TICKET-018.
 */

export interface Campaign {
  id: string;
  name: string;
  // Additional fields will be added based on generated GraphQL types
}

export interface CampaignSlice {
  // State
  currentCampaignId: string | null;
  currentBranchId: string | null;
  asOfTime: Date | null;
  campaign: Campaign | null;

  // Actions
  setCurrentCampaign: (campaignId: string, campaign: Campaign) => void;
  setCurrentBranch: (branchId: string) => void;
  setAsOfTime: (time: Date | null) => void;
  clearCampaignContext: () => void;
}

/**
 * Creates the campaign slice for the root store
 * NOTE: This is a placeholder implementation for Stage 1.
 * Full implementation will be done in Stage 5.
 */
export const createCampaignSlice: StateCreator<CampaignSlice> = (set) => ({
  // Initial state
  currentCampaignId: null,
  currentBranchId: null,
  asOfTime: null,
  campaign: null,

  // Actions (placeholder implementations)
  setCurrentCampaign: (campaignId, campaign) =>
    set({
      currentCampaignId: campaignId,
      campaign,
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
