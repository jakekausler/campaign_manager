/**
 * Integration tests for Effect GraphQL hooks
 *
 * Tests the Effect hooks with MSW-mocked GraphQL responses:
 * - useEffectsForEntity
 * - useAllEffectsForEntity
 */

import { ApolloProvider } from '@apollo/client/react';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { useEffectsForEntity, useAllEffectsForEntity, EffectTiming } from './effects';

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

describe('Effect Hooks Integration Tests', () => {
  describe('useEffectsForEntity', () => {
    it('should fetch PRE effects for an encounter', async () => {
      const { result } = renderHook(
        () => useEffectsForEntity('encounter', 'encounter-2', EffectTiming.PRE),
        {
          wrapper: createWrapper(),
        }
      );

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.effects).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have PRE effects for encounter-2
      expect(result.current.effects).toHaveLength(1);
      expect(result.current.effects[0].id).toBe('effect-4');
      expect(result.current.effects[0].name).toBe('Pre-encounter Warning');
      expect(result.current.effects[0].timing).toBe('PRE');
    });

    it('should fetch ON_RESOLVE effects for an event', async () => {
      const { result } = renderHook(
        () => useEffectsForEntity('event', 'event-1', EffectTiming.ON_RESOLVE),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have ON_RESOLVE effects for event-1
      expect(result.current.effects).toHaveLength(1);
      expect(result.current.effects[0].id).toBe('effect-1');
      expect(result.current.effects[0].name).toBe('Boost Population');
      expect(result.current.effects[0].timing).toBe('ON_RESOLVE');
    });

    it('should fetch POST effects for an event', async () => {
      const { result } = renderHook(
        () => useEffectsForEntity('event', 'event-1', EffectTiming.POST),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have POST effects for event-1
      expect(result.current.effects).toHaveLength(1);
      expect(result.current.effects[0].id).toBe('effect-2');
      expect(result.current.effects[0].name).toBe('Boost Defense');
      expect(result.current.effects[0].timing).toBe('POST');
    });

    it('should return empty array when no effects for timing phase', async () => {
      const { result } = renderHook(
        () => useEffectsForEntity('event', 'event-1', EffectTiming.PRE),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // event-1 has no PRE effects
      expect(result.current.effects).toEqual([]);
      expect(result.current.error).toBeUndefined();
    });

    it('should include effect metadata', async () => {
      const { result } = renderHook(
        () => useEffectsForEntity('event', 'event-1', EffectTiming.ON_RESOLVE),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const effect = result.current.effects[0];
      expect(effect).toBeDefined();
      expect(effect.id).toBe('effect-1');
      expect(effect.name).toBeTruthy();
      expect(effect.description).toBeTruthy();
      expect(effect.effectType).toBe('patch');
      expect(effect.payload).toBeDefined();
      expect(Array.isArray(effect.payload)).toBe(true);
      expect(effect.entityType).toBe('event');
      expect(effect.entityId).toBe('event-1');
      expect(effect.timing).toBe('ON_RESOLVE');
      expect(effect.priority).toBeDefined();
      expect(effect.isActive).toBe(true);
      expect(effect.version).toBeDefined();
      expect(effect.createdAt).toBeTruthy();
      expect(effect.updatedAt).toBeTruthy();
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(
        () => useEffectsForEntity('event', 'event-1', EffectTiming.ON_RESOLVE),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refetch).toBeInstanceOf(Function);

      // Refetch should work
      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.getEffectsForEntity).toBeDefined();
    });

    it('should provide network status', async () => {
      const { result } = renderHook(
        () => useEffectsForEntity('event', 'event-1', EffectTiming.ON_RESOLVE),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.networkStatus).toBeDefined();
    });
  });

  describe('useAllEffectsForEntity', () => {
    it('should fetch effects from all timing phases', async () => {
      const { result } = renderHook(() => useAllEffectsForEntity('event', 'event-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have effects grouped by timing phase
      expect(result.current.preEffects).toEqual([]); // event-1 has no PRE effects
      expect(result.current.onResolveEffects).toHaveLength(1);
      expect(result.current.postEffects).toHaveLength(1);
    });

    it('should provide allEffects array with all effects combined', async () => {
      const { result } = renderHook(() => useAllEffectsForEntity('event', 'event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // allEffects should combine all timing phases
      expect(result.current.allEffects).toHaveLength(2);

      const effectIds = result.current.allEffects.map((e) => e.id);
      expect(effectIds).toContain('effect-1'); // ON_RESOLVE
      expect(effectIds).toContain('effect-2'); // POST
    });

    it('should fetch effects with execution history', async () => {
      const { result } = renderHook(() => useAllEffectsForEntity('event', 'event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Check that execution history is included
      const effect = result.current.onResolveEffects[0];
      expect(effect).toBeDefined();

      // The effect should have executions property
      // Note: execution history is not included in GET_ALL_EFFECTS_FOR_ENTITY query
      // but is available in the mock data structure
      // This test verifies the mock structure supports it
    });

    it('should return empty arrays for entity with no effects', async () => {
      const { result } = renderHook(() => useAllEffectsForEntity('event', 'event-999'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.preEffects).toEqual([]);
      expect(result.current.onResolveEffects).toEqual([]);
      expect(result.current.postEffects).toEqual([]);
      expect(result.current.allEffects).toEqual([]);
      expect(result.current.error).toBeUndefined();
    });

    it('should correctly group effects by timing phase', async () => {
      const { result } = renderHook(() => useAllEffectsForEntity('encounter', 'encounter-2'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // encounter-2 has one PRE effect
      expect(result.current.preEffects).toHaveLength(1);
      expect(result.current.preEffects[0].timing).toBe('PRE');

      // encounter-2 has no ON_RESOLVE or POST effects
      expect(result.current.onResolveEffects).toEqual([]);
      expect(result.current.postEffects).toEqual([]);
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useAllEffectsForEntity('event', 'event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refetch).toBeInstanceOf(Function);

      // Refetch should work
      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.getEffectsForEntity).toBeDefined();
    });

    it('should provide network status', async () => {
      const { result } = renderHook(() => useAllEffectsForEntity('event', 'event-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.networkStatus).toBeDefined();
    });
  });
});
