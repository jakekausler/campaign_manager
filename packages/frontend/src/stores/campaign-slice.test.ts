/**
 * Unit tests for campaign-slice.ts
 *
 * Tests campaign context state management including:
 * - Campaign selection and switching
 * - Branch management
 * - Time-travel state
 * - Context clearing
 * - State consistency
 */

import { describe, it, expect } from 'vitest';
import { create } from 'zustand';

import { createCampaignSlice, type CampaignSlice, type Campaign } from './campaign-slice';

// Create a test store for each test
function createTestStore() {
  return create<CampaignSlice>()(createCampaignSlice);
}

// Mock campaign data
const mockCampaign: Campaign = {
  id: 'campaign-123',
  name: 'The Dragon War',
  description: 'A campaign about dragons and war',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockCampaign2: Campaign = {
  id: 'campaign-456',
  name: 'The Underdark Expedition',
  description: 'Exploring the depths below',
  createdAt: '2024-02-01T00:00:00.000Z',
  updatedAt: '2024-02-01T00:00:00.000Z',
};

describe('CampaignSlice', () => {
  describe('Initial State', () => {
    it('should initialize with null currentCampaignId', () => {
      const store = createTestStore();
      expect(store.getState().currentCampaignId).toBeNull();
    });

    it('should initialize with null currentBranchId', () => {
      const store = createTestStore();
      expect(store.getState().currentBranchId).toBeNull();
    });

    it('should initialize with null asOfTime', () => {
      const store = createTestStore();
      expect(store.getState().asOfTime).toBeNull();
    });

    it('should initialize with null campaign', () => {
      const store = createTestStore();
      expect(store.getState().campaign).toBeNull();
    });
  });

  describe('setCurrentCampaign()', () => {
    it('should set currentCampaignId when campaign is selected', () => {
      const store = createTestStore();
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      expect(store.getState().currentCampaignId).toBe(mockCampaign.id);
    });

    it('should set campaign object when campaign is selected', () => {
      const store = createTestStore();
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      expect(store.getState().campaign).toEqual(mockCampaign);
    });

    it('should reset currentBranchId when switching campaigns', () => {
      const store = createTestStore();

      // Set initial campaign with branch
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      store.getState().setCurrentBranch('branch-1');
      expect(store.getState().currentBranchId).toBe('branch-1');

      // Switch campaign - should reset branch
      store.getState().setCurrentCampaign(mockCampaign2.id, mockCampaign2);
      expect(store.getState().currentBranchId).toBeNull();
    });

    it('should reset asOfTime when switching campaigns', () => {
      const store = createTestStore();

      // Set initial campaign with time-travel
      const pastTime = new Date('2024-01-01T00:00:00.000Z');
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      store.getState().setAsOfTime(pastTime);
      expect(store.getState().asOfTime).toEqual(pastTime);

      // Switch campaign - should reset time-travel
      store.getState().setCurrentCampaign(mockCampaign2.id, mockCampaign2);
      expect(store.getState().asOfTime).toBeNull();
    });

    it('should handle campaign with minimal fields', () => {
      const store = createTestStore();
      const minimalCampaign: Campaign = {
        id: 'campaign-minimal',
        name: 'Minimal Campaign',
      };
      store.getState().setCurrentCampaign(minimalCampaign.id, minimalCampaign);

      expect(store.getState().currentCampaignId).toBe(minimalCampaign.id);
      expect(store.getState().campaign).toEqual(minimalCampaign);
    });

    it('should handle campaign with all optional fields', () => {
      const store = createTestStore();
      const fullCampaign: Campaign = {
        id: 'campaign-full',
        name: 'Full Campaign',
        description: 'Campaign with all fields',
        createdAt: '2024-03-01T00:00:00.000Z',
        updatedAt: '2024-03-15T00:00:00.000Z',
      };
      store.getState().setCurrentCampaign(fullCampaign.id, fullCampaign);

      expect(store.getState().campaign).toEqual(fullCampaign);
    });
  });

  describe('setCurrentBranch()', () => {
    it('should set currentBranchId', () => {
      const store = createTestStore();
      store.getState().setCurrentBranch('branch-abc');
      expect(store.getState().currentBranchId).toBe('branch-abc');
    });

    it('should not affect currentCampaignId', () => {
      const store = createTestStore();
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      store.getState().setCurrentBranch('branch-xyz');

      expect(store.getState().currentCampaignId).toBe(mockCampaign.id);
    });

    it('should not affect asOfTime', () => {
      const store = createTestStore();
      const time = new Date('2024-01-01T00:00:00.000Z');
      store.getState().setAsOfTime(time);
      store.getState().setCurrentBranch('branch-123');

      expect(store.getState().asOfTime).toEqual(time);
    });

    it('should allow changing branch multiple times', () => {
      const store = createTestStore();
      store.getState().setCurrentBranch('branch-1');
      expect(store.getState().currentBranchId).toBe('branch-1');

      store.getState().setCurrentBranch('branch-2');
      expect(store.getState().currentBranchId).toBe('branch-2');

      store.getState().setCurrentBranch('main');
      expect(store.getState().currentBranchId).toBe('main');
    });
  });

  describe('setAsOfTime()', () => {
    it('should set asOfTime when Date is provided', () => {
      const store = createTestStore();
      const time = new Date('2024-01-01T00:00:00.000Z');
      store.getState().setAsOfTime(time);
      expect(store.getState().asOfTime).toEqual(time);
    });

    it('should set asOfTime to null when null is provided', () => {
      const store = createTestStore();
      const time = new Date('2024-01-01T00:00:00.000Z');
      store.getState().setAsOfTime(time);
      store.getState().setAsOfTime(null);
      expect(store.getState().asOfTime).toBeNull();
    });

    it('should not affect currentCampaignId', () => {
      const store = createTestStore();
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      const time = new Date('2024-01-01T00:00:00.000Z');
      store.getState().setAsOfTime(time);

      expect(store.getState().currentCampaignId).toBe(mockCampaign.id);
    });

    it('should not affect currentBranchId', () => {
      const store = createTestStore();
      store.getState().setCurrentBranch('branch-abc');
      const time = new Date('2024-01-01T00:00:00.000Z');
      store.getState().setAsOfTime(time);

      expect(store.getState().currentBranchId).toBe('branch-abc');
    });

    it('should allow changing time multiple times', () => {
      const store = createTestStore();

      const time1 = new Date('2024-01-01T00:00:00.000Z');
      store.getState().setAsOfTime(time1);
      expect(store.getState().asOfTime).toEqual(time1);

      const time2 = new Date('2024-02-01T00:00:00.000Z');
      store.getState().setAsOfTime(time2);
      expect(store.getState().asOfTime).toEqual(time2);

      store.getState().setAsOfTime(null);
      expect(store.getState().asOfTime).toBeNull();
    });
  });

  describe('clearCampaignContext()', () => {
    it('should clear currentCampaignId', () => {
      const store = createTestStore();
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      store.getState().clearCampaignContext();
      expect(store.getState().currentCampaignId).toBeNull();
    });

    it('should clear campaign object', () => {
      const store = createTestStore();
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      store.getState().clearCampaignContext();
      expect(store.getState().campaign).toBeNull();
    });

    it('should clear currentBranchId', () => {
      const store = createTestStore();
      store.getState().setCurrentBranch('branch-abc');
      store.getState().clearCampaignContext();
      expect(store.getState().currentBranchId).toBeNull();
    });

    it('should clear asOfTime', () => {
      const store = createTestStore();
      const time = new Date('2024-01-01T00:00:00.000Z');
      store.getState().setAsOfTime(time);
      store.getState().clearCampaignContext();
      expect(store.getState().asOfTime).toBeNull();
    });

    it('should handle clearing when already cleared', () => {
      const store = createTestStore();
      store.getState().clearCampaignContext();

      expect(store.getState().currentCampaignId).toBeNull();
      expect(store.getState().currentBranchId).toBeNull();
      expect(store.getState().asOfTime).toBeNull();
      expect(store.getState().campaign).toBeNull();
    });

    it('should clear all context even if only partially set', () => {
      const store = createTestStore();
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      // Don't set branch or time
      store.getState().clearCampaignContext();

      expect(store.getState().currentCampaignId).toBeNull();
      expect(store.getState().campaign).toBeNull();
      expect(store.getState().currentBranchId).toBeNull();
      expect(store.getState().asOfTime).toBeNull();
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state after setCurrentCampaign -> setCurrentBranch -> setAsOfTime', () => {
      const store = createTestStore();

      const time = new Date('2024-01-01T00:00:00.000Z');

      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      expect(store.getState().currentCampaignId).toBe(mockCampaign.id);
      expect(store.getState().campaign).toEqual(mockCampaign);

      store.getState().setCurrentBranch('feature-branch');
      expect(store.getState().currentBranchId).toBe('feature-branch');

      store.getState().setAsOfTime(time);
      expect(store.getState().asOfTime).toEqual(time);

      // All state should be preserved
      expect(store.getState().currentCampaignId).toBe(mockCampaign.id);
      expect(store.getState().campaign).toEqual(mockCampaign);
      expect(store.getState().currentBranchId).toBe('feature-branch');
      expect(store.getState().asOfTime).toEqual(time);
    });

    it('should maintain consistent state after campaign switch with branch and time', () => {
      const store = createTestStore();
      const time = new Date('2024-01-01T00:00:00.000Z');

      // Set up first campaign with branch and time
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      store.getState().setCurrentBranch('branch-1');
      store.getState().setAsOfTime(time);

      // Switch campaign - should reset branch and time
      store.getState().setCurrentCampaign(mockCampaign2.id, mockCampaign2);

      expect(store.getState().currentCampaignId).toBe(mockCampaign2.id);
      expect(store.getState().campaign).toEqual(mockCampaign2);
      expect(store.getState().currentBranchId).toBeNull();
      expect(store.getState().asOfTime).toBeNull();
    });

    it('should handle clear -> set campaign cycle correctly', () => {
      const store = createTestStore();

      // Set campaign
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      expect(store.getState().currentCampaignId).toBe(mockCampaign.id);

      // Clear
      store.getState().clearCampaignContext();
      expect(store.getState().currentCampaignId).toBeNull();

      // Set different campaign
      store.getState().setCurrentCampaign(mockCampaign2.id, mockCampaign2);
      expect(store.getState().currentCampaignId).toBe(mockCampaign2.id);
      expect(store.getState().campaign).toEqual(mockCampaign2);
    });
  });

  describe('Branch Workflow', () => {
    it('should support switching between branches', () => {
      const store = createTestStore();
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);

      // Switch to feature branch
      store.getState().setCurrentBranch('feature-branch');
      expect(store.getState().currentBranchId).toBe('feature-branch');

      // Switch to main branch
      store.getState().setCurrentBranch('main');
      expect(store.getState().currentBranchId).toBe('main');

      // Campaign should not change
      expect(store.getState().currentCampaignId).toBe(mockCampaign.id);
    });
  });

  describe('Time-Travel Workflow', () => {
    it('should support time-travel queries', () => {
      const store = createTestStore();
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);

      // View state yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      store.getState().setAsOfTime(yesterday);
      expect(store.getState().asOfTime).toEqual(yesterday);

      // Return to current time
      store.getState().setAsOfTime(null);
      expect(store.getState().asOfTime).toBeNull();

      // Campaign should not change
      expect(store.getState().currentCampaignId).toBe(mockCampaign.id);
    });

    it('should handle past, present, and future dates', () => {
      const store = createTestStore();

      const past = new Date('2023-01-01T00:00:00.000Z');
      store.getState().setAsOfTime(past);
      expect(store.getState().asOfTime).toEqual(past);

      const present = new Date();
      store.getState().setAsOfTime(present);
      expect(store.getState().asOfTime).toEqual(present);

      const future = new Date('2025-12-31T23:59:59.000Z');
      store.getState().setAsOfTime(future);
      expect(store.getState().asOfTime).toEqual(future);
    });
  });

  describe('Campaign Switching', () => {
    it('should prevent stale branch context when switching campaigns', () => {
      const store = createTestStore();

      // Campaign 1 with branch
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      store.getState().setCurrentBranch('campaign-1-branch');

      // Switch to campaign 2 - branch should reset
      store.getState().setCurrentCampaign(mockCampaign2.id, mockCampaign2);

      expect(store.getState().currentBranchId).toBeNull();
      expect(store.getState().currentCampaignId).toBe(mockCampaign2.id);
    });

    it('should prevent stale time context when switching campaigns', () => {
      const store = createTestStore();
      const time = new Date('2024-01-01T00:00:00.000Z');

      // Campaign 1 with time-travel
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      store.getState().setAsOfTime(time);

      // Switch to campaign 2 - time should reset
      store.getState().setCurrentCampaign(mockCampaign2.id, mockCampaign2);

      expect(store.getState().asOfTime).toBeNull();
      expect(store.getState().currentCampaignId).toBe(mockCampaign2.id);
    });

    it('should prevent stale context when switching campaigns with both branch and time set', () => {
      const store = createTestStore();
      const time = new Date('2024-01-01T00:00:00.000Z');

      // Campaign 1 with both branch and time-travel
      store.getState().setCurrentCampaign(mockCampaign.id, mockCampaign);
      store.getState().setCurrentBranch('old-branch');
      store.getState().setAsOfTime(time);

      // Switch to campaign 2 - both should reset
      store.getState().setCurrentCampaign(mockCampaign2.id, mockCampaign2);

      expect(store.getState().currentBranchId).toBeNull();
      expect(store.getState().asOfTime).toBeNull();
      expect(store.getState().currentCampaignId).toBe(mockCampaign2.id);
      expect(store.getState().campaign).toEqual(mockCampaign2);
    });
  });
});
