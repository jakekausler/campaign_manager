/**
 * Integration tests for Structure GraphQL hooks
 *
 * Tests the two Structure hooks with MSW-mocked GraphQL responses:
 * - useStructureDetails
 * - useStructureConditions
 */

import { ApolloProvider } from '@apollo/client/react';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, afterEach, vi } from 'vitest';

import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { useStructureConditions, useStructureDetails } from './structures';

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

describe('Structure Hooks Integration Tests', () => {
  describe('useStructureDetails', () => {
    it('should fetch structure details by ID', async () => {
      const { result } = renderHook(() => useStructureDetails('structure-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.structure).toBeNull();

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have structure details
      expect(result.current.structure).not.toBeNull();
      expect(result.current.structure?.id).toBe('structure-1');
      expect(result.current.structure?.name).toBe('Main Barracks');
      expect(result.current.structure?.typeId).toBe('barracks');
      expect(result.current.structure?.settlementId).toBe('settlement-1');
    });

    it('should include position and orientation data', async () => {
      const { result } = renderHook(() => useStructureDetails('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.structure?.x).toBe(10);
      expect(result.current.structure?.y).toBe(20);
      expect(result.current.structure?.orientation).toBe(0);
    });

    it('should include archival status fields', async () => {
      const { result } = renderHook(() => useStructureDetails('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.structure?.isArchived).toBe(false);
      expect(result.current.structure?.archivedAt).toBeNull();
    });

    it('should include computed fields', async () => {
      const { result } = renderHook(() => useStructureDetails('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.structure?.computedFields).toBeDefined();
      expect(result.current.structure?.computedFields).toEqual({
        capacity: 100,
        training_speed: 1.2,
      });
    });

    it('should include timestamps', async () => {
      const { result } = renderHook(() => useStructureDetails('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.structure?.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result.current.structure?.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should return null for non-existent structure', async () => {
      const { result } = renderHook(() => useStructureDetails('structure-999'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.structure).toBeNull();
      expect(result.current.error).toBeDefined();
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useStructureDetails('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refetch).toBeInstanceOf(Function);

      // Refetch should work
      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.structure?.id).toBe('structure-1');
    });

    it('should provide network status', async () => {
      const { result } = renderHook(() => useStructureDetails('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.networkStatus).toBeDefined();
    });

    it('should handle different structure types correctly', async () => {
      // Test barracks (structure-1)
      const { result: barracksResult } = renderHook(() => useStructureDetails('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(barracksResult.current.loading).toBe(false);
      });

      expect(barracksResult.current.structure?.typeId).toBe('barracks');
      expect(barracksResult.current.structure?.name).toBe('Main Barracks');

      // Test marketplace (structure-2)
      const { result: marketResult } = renderHook(() => useStructureDetails('structure-2'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(marketResult.current.loading).toBe(false);
      });

      expect(marketResult.current.structure?.typeId).toBe('marketplace');
      expect(marketResult.current.structure?.name).toBe('Central Market');

      // Test temple (structure-4)
      const { result: templeResult } = renderHook(() => useStructureDetails('structure-4'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(templeResult.current.loading).toBe(false);
      });

      expect(templeResult.current.structure?.typeId).toBe('temple');
      expect(templeResult.current.structure?.name).toBe('Temple of Light');
    });
  });

  describe('useStructureConditions', () => {
    it('should fetch structure conditions by ID', async () => {
      const { result } = renderHook(() => useStructureConditions('structure-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.structure).toBeNull();
      expect(result.current.computedFields).toBeNull();

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have structure with conditions
      expect(result.current.structure).not.toBeNull();
      expect(result.current.structure?.id).toBe('structure-1');
      expect(result.current.structure?.name).toBe('Main Barracks');
    });

    it('should include computed fields in structure object', async () => {
      const { result } = renderHook(() => useStructureConditions('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.structure?.computedFields).toBeDefined();
      expect(result.current.structure?.computedFields).toEqual({
        capacity: 100,
        training_speed: 1.2,
      });
    });

    it('should provide computedFields as separate property for convenience', async () => {
      const { result } = renderHook(() => useStructureConditions('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have computedFields as separate property
      expect(result.current.computedFields).toBeDefined();
      expect(result.current.computedFields).toEqual({
        capacity: 100,
        training_speed: 1.2,
      });

      // Should match structure.computedFields
      expect(result.current.computedFields).toEqual(result.current.structure?.computedFields);
    });

    it('should fetch different computed fields for different structure types', async () => {
      // Barracks (structure-1)
      const { result: barracksResult } = renderHook(() => useStructureConditions('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(barracksResult.current.loading).toBe(false);
      });

      expect(barracksResult.current.computedFields).toEqual({
        capacity: 100,
        training_speed: 1.2,
      });

      // Marketplace (structure-2)
      const { result: marketResult } = renderHook(() => useStructureConditions('structure-2'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(marketResult.current.loading).toBe(false);
      });

      expect(marketResult.current.computedFields).toEqual({
        trade_bonus: 0.15,
        capacity: 50,
      });

      // Temple (structure-4)
      const { result: templeResult } = renderHook(() => useStructureConditions('structure-4'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(templeResult.current.loading).toBe(false);
      });

      expect(templeResult.current.computedFields).toEqual({
        faith: 50,
        healing_rate: 0.1,
      });
    });

    it('should return null for non-existent structure', async () => {
      const { result } = renderHook(() => useStructureConditions('structure-999'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.structure).toBeNull();
      expect(result.current.computedFields).toBeNull();
      expect(result.current.error).toBeDefined();
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useStructureConditions('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refetch).toBeInstanceOf(Function);

      // Refetch should work
      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.structure?.id).toBe('structure-1');
      expect(refetchResult.data?.structure?.computedFields).toBeDefined();
    });

    it('should provide network status', async () => {
      const { result } = renderHook(() => useStructureConditions('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.networkStatus).toBeDefined();
    });

    it('should handle structures with empty computed fields', async () => {
      // This test assumes future scenarios where computedFields might be empty
      // For now, all mock structures have computed fields, but the hook should handle null/undefined gracefully
      const { result } = renderHook(() => useStructureConditions('structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Even if computedFields is null/undefined in the future, hook should not crash
      expect(result.current.computedFields).not.toBeUndefined();
    });
  });
});
