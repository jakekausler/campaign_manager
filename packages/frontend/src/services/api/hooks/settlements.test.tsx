/**
 * Integration tests for Settlement GraphQL hooks
 *
 * Tests the three Settlement hooks with MSW-mocked GraphQL responses:
 * - useSettlementsByKingdom
 * - useSettlementDetails
 * - useStructuresBySettlement
 */

import { ApolloProvider } from '@apollo/client/react';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, afterEach, vi } from 'vitest';

import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import {
  useSettlementDetails,
  useSettlementsByKingdom,
  useStructuresBySettlement,
} from './settlements';

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('Settlement Hooks Integration Tests', () => {
  describe('useSettlementsByKingdom', () => {
    it('should fetch settlements for a kingdom', async () => {
      const { result } = renderHook(() => useSettlementsByKingdom('kingdom-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.settlements).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have settlements from kingdom-1
      expect(result.current.settlements).toHaveLength(2);
      expect(result.current.settlements[0].id).toBe('settlement-1');
      expect(result.current.settlements[0].name).toBe('Ironhold');
      expect(result.current.settlements[1].id).toBe('settlement-2');
      expect(result.current.settlements[1].name).toBe('Silverkeep');
    });

    it('should return empty array for kingdom with no settlements', async () => {
      const { result } = renderHook(() => useSettlementsByKingdom('kingdom-999'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settlements).toEqual([]);
      expect(result.current.error).toBeUndefined();
    });

    it('should filter settlements by kingdom ID', async () => {
      const { result: result1 } = renderHook(() => useSettlementsByKingdom('kingdom-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
      });

      expect(result1.current.settlements).toHaveLength(2);
      expect(result1.current.settlements.every((s) => s.kingdomId === 'kingdom-1')).toBe(true);

      const { result: result2 } = renderHook(() => useSettlementsByKingdom('kingdom-2'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });

      expect(result2.current.settlements).toHaveLength(1);
      expect(result2.current.settlements[0].id).toBe('settlement-3');
      expect(result2.current.settlements[0].kingdomId).toBe('kingdom-2');
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useSettlementsByKingdom('kingdom-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refetch).toBeInstanceOf(Function);

      // Refetch should work
      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.settlementsByKingdom).toHaveLength(2);
    });

    it('should provide network status', async () => {
      const { result } = renderHook(() => useSettlementsByKingdom('kingdom-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.networkStatus).toBeDefined();
    });
  });

  describe('useSettlementDetails', () => {
    it('should fetch settlement details by ID', async () => {
      const { result } = renderHook(() => useSettlementDetails('settlement-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.settlement).toBeNull();

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have settlement details
      expect(result.current.settlement).not.toBeNull();
      expect(result.current.settlement?.id).toBe('settlement-1');
      expect(result.current.settlement?.name).toBe('Ironhold');
      expect(result.current.settlement?.level).toBe(3);
      expect(result.current.settlement?.kingdomId).toBe('kingdom-1');
    });

    it('should include computed fields', async () => {
      const { result } = renderHook(() => useSettlementDetails('settlement-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settlement?.computedFields).toBeDefined();
      expect(result.current.settlement?.computedFields).toEqual({
        population: 1500,
        defense: 25,
      });
    });

    it('should return null for non-existent settlement', async () => {
      const { result } = renderHook(() => useSettlementDetails('settlement-999'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settlement).toBeNull();
      expect(result.current.error).toBeDefined();
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useSettlementDetails('settlement-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refetch).toBeInstanceOf(Function);

      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.settlement?.id).toBe('settlement-1');
    });
  });

  describe('useStructuresBySettlement', () => {
    it('should fetch structures for a settlement', async () => {
      const { result } = renderHook(() => useStructuresBySettlement('settlement-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.structures).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have structures from settlement-1 (now has 3 structures)
      expect(result.current.structures).toHaveLength(3);
      expect(result.current.structures[0].id).toBe('structure-1');
      expect(result.current.structures[0].name).toBe('Main Barracks');
      expect(result.current.structures[1].id).toBe('structure-2');
      expect(result.current.structures[1].name).toBe('Central Market');
      expect(result.current.structures[2].id).toBe('structure-3');
      expect(result.current.structures[2].name).toBe('Grand Library');
    });

    it('should include settlement name', async () => {
      const { result } = renderHook(() => useStructuresBySettlement('settlement-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settlementName).toBe('Ironhold');
    });

    it('should return empty array for settlement with no structures', async () => {
      const { result } = renderHook(() => useStructuresBySettlement('settlement-empty'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // settlement-empty has no structures in mock data
      expect(result.current.structures).toHaveLength(0);
    });

    it('should filter structures by settlement ID', async () => {
      const { result } = renderHook(() => useStructuresBySettlement('settlement-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.structures).toHaveLength(3);
      expect(result.current.structures.every((s) => s.settlementId === 'settlement-1')).toBe(true);
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useStructuresBySettlement('settlement-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refetch).toBeInstanceOf(Function);

      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.settlement?.structures).toHaveLength(3);
    });

    it('should handle settlement not found', async () => {
      const { result } = renderHook(() => useStructuresBySettlement('settlement-999'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.structures).toEqual([]);
      expect(result.current.settlementName).toBeNull();
      expect(result.current.error).toBeDefined();
    });
  });
});
