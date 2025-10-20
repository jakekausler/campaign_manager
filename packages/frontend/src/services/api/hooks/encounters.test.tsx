/**
 * Integration tests for Encounter GraphQL hooks
 *
 * Tests the Encounter hooks with MSW-mocked GraphQL responses:
 * - useEncountersByCampaign
 */

import { ApolloProvider } from '@apollo/client/react';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { useEncountersByCampaign } from './encounters';

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

describe('Encounter Hooks Integration Tests', () => {
  describe('useEncountersByCampaign', () => {
    it('should fetch encounters for a campaign', async () => {
      const { result } = renderHook(() => useEncountersByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.encounters).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have encounters from campaign-1
      expect(result.current.encounters).toHaveLength(3);
      expect(result.current.encounters[0].id).toBe('encounter-1');
      expect(result.current.encounters[0].name).toBe('Dragon Attack');
      expect(result.current.encounters[1].id).toBe('encounter-2');
      expect(result.current.encounters[1].name).toBe('Dragon Sighting');
      expect(result.current.encounters[2].id).toBe('encounter-3');
      expect(result.current.encounters[2].name).toBe('Mysterious Stranger');
    });

    it('should return empty array for campaign with no encounters', async () => {
      const { result } = renderHook(() => useEncountersByCampaign('campaign-999'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.encounters).toEqual([]);
      expect(result.current.error).toBeUndefined();
    });

    it('should filter encounters by campaign ID', async () => {
      const { result: result1 } = renderHook(() => useEncountersByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
      });

      expect(result1.current.encounters).toHaveLength(3);
      expect(result1.current.encounters.every((e) => e.campaignId === 'campaign-1')).toBe(true);

      const { result: result2 } = renderHook(() => useEncountersByCampaign('campaign-2'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });

      expect(result2.current.encounters).toHaveLength(1);
      expect(result2.current.encounters[0].id).toBe('encounter-4');
      expect(result2.current.encounters[0].campaignId).toBe('campaign-2');
    });

    it('should include resolution information', async () => {
      const { result } = renderHook(() => useEncountersByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const resolvedEncounter = result.current.encounters.find((e) => e.id === 'encounter-1');
      expect(resolvedEncounter?.isResolved).toBe(true);
      expect(resolvedEncounter?.resolvedAt).toBe('2024-05-10T16:30:00.000Z');

      const unresolvedEncounter = result.current.encounters.find((e) => e.id === 'encounter-2');
      expect(unresolvedEncounter?.isResolved).toBe(false);
      expect(unresolvedEncounter?.resolvedAt).toBeNull();
    });

    it('should include difficulty information', async () => {
      const { result } = renderHook(() => useEncountersByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const easyEncounter = result.current.encounters.find((e) => e.id === 'encounter-3');
      expect(easyEncounter?.difficulty).toBe(3);

      const hardEncounter1 = result.current.encounters.find((e) => e.id === 'encounter-1');
      expect(hardEncounter1?.difficulty).toBe(15);

      const hardEncounter2 = result.current.encounters.find((e) => e.id === 'encounter-2');
      expect(hardEncounter2?.difficulty).toBe(15);
    });

    it('should include location information', async () => {
      const { result } = renderHook(() => useEncountersByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const locationEncounter = result.current.encounters.find((e) => e.id === 'encounter-1');
      expect(locationEncounter?.locationId).toBe('location-1');

      const noLocationEncounter = result.current.encounters.find((e) => e.id === 'encounter-3');
      expect(noLocationEncounter?.locationId).toBeNull();
    });

    it('should include custom variables', async () => {
      const { result } = renderHook(() => useEncountersByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const dragonEncounter = result.current.encounters.find((e) => e.id === 'encounter-1');
      expect(dragonEncounter?.variables).toEqual({ casualties: 12, goldLost: 5000 });

      const threatEncounter = result.current.encounters.find((e) => e.id === 'encounter-2');
      expect(threatEncounter?.variables).toEqual({ threatLevel: 'high' });
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useEncountersByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refetch).toBeInstanceOf(Function);

      // Refetch should work
      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.encountersByCampaign).toHaveLength(3);
    });

    it('should provide network status', async () => {
      const { result } = renderHook(() => useEncountersByCampaign('campaign-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.networkStatus).toBeDefined();
    });
  });
});
