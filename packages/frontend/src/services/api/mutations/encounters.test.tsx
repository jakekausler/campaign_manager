import { MockedProvider } from '@apollo/client/testing/react';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  UPDATE_ENCOUNTER,
  RESOLVE_ENCOUNTER,
  useUpdateEncounter,
  useResolveEncounter,
} from './encounters';

// Wrapper component for testing hooks with Apollo Client
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MockedProvider>{children}</MockedProvider>;
  };
}

describe('Encounter Mutations', () => {
  beforeEach(() => {
    // Reset any test state before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('useUpdateEncounter', () => {
    it('should return mutation function and loading state', () => {
      const { result } = renderHook(() => useUpdateEncounter(), {
        wrapper: createWrapper(),
      });

      expect(result.current.updateEncounter).toBeInstanceOf(Function);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it('should call updateEncounter mutation with correct variables', async () => {
      const mocks = [
        {
          request: {
            query: UPDATE_ENCOUNTER,
            variables: {
              id: 'encounter-1',
              input: {
                scheduledAt: '2024-07-20T14:00:00Z',
              },
            },
          },
          result: {
            data: {
              updateEncounter: {
                id: 'encounter-1',
                campaignId: 'campaign-1',
                name: 'Dragon Attack',
                scheduledAt: '2024-07-20T14:00:00Z',
                updatedAt: '2024-06-15T12:00:00Z',
              },
            },
          },
        },
      ];

      function Wrapper({ children }: { children: ReactNode }) {
        return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      }

      const { result } = renderHook(() => useUpdateEncounter(), {
        wrapper: Wrapper,
      });

      const updatedEncounter = await result.current.updateEncounter('encounter-1', {
        scheduledAt: '2024-07-20T14:00:00Z',
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(updatedEncounter).toEqual({
        id: 'encounter-1',
        campaignId: 'campaign-1',
        name: 'Dragon Attack',
        scheduledAt: '2024-07-20T14:00:00Z',
        updatedAt: '2024-06-15T12:00:00Z',
      });
    });

    it('should handle mutation errors', async () => {
      const mocks = [
        {
          request: {
            query: UPDATE_ENCOUNTER,
            variables: {
              id: 'invalid-id',
              input: {
                scheduledAt: '2024-07-20T14:00:00Z',
              },
            },
          },
          error: new Error('Encounter not found'),
        },
      ];

      function Wrapper({ children }: { children: ReactNode }) {
        return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      }

      const { result } = renderHook(() => useUpdateEncounter(), {
        wrapper: Wrapper,
      });

      await expect(
        result.current.updateEncounter('invalid-id', {
          scheduledAt: '2024-07-20T14:00:00Z',
        })
      ).rejects.toThrow('Encounter not found');
    });

    it('should update multiple fields at once', async () => {
      const mocks = [
        {
          request: {
            query: UPDATE_ENCOUNTER,
            variables: {
              id: 'encounter-1',
              input: {
                scheduledAt: '2024-07-20T14:00:00Z',
                name: 'Updated Encounter',
                difficulty: 12,
              },
            },
          },
          result: {
            data: {
              updateEncounter: {
                id: 'encounter-1',
                campaignId: 'campaign-1',
                name: 'Updated Encounter',
                scheduledAt: '2024-07-20T14:00:00Z',
                updatedAt: '2024-06-15T12:00:00Z',
              },
            },
          },
        },
      ];

      function Wrapper({ children }: { children: ReactNode }) {
        return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      }

      const { result } = renderHook(() => useUpdateEncounter(), {
        wrapper: Wrapper,
      });

      const updatedEncounter = await result.current.updateEncounter('encounter-1', {
        scheduledAt: '2024-07-20T14:00:00Z',
        name: 'Updated Encounter',
        difficulty: 12,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(updatedEncounter.name).toBe('Updated Encounter');
      expect(updatedEncounter.scheduledAt).toBe('2024-07-20T14:00:00Z');
    });
  });

  describe('useResolveEncounter', () => {
    it('should return mutation function and loading state', () => {
      const { result } = renderHook(() => useResolveEncounter(), {
        wrapper: createWrapper(),
      });

      expect(result.current.resolveEncounter).toBeInstanceOf(Function);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it('should resolve encounter and return effect execution summaries', async () => {
      const mocks = [
        {
          request: {
            query: RESOLVE_ENCOUNTER,
            variables: {
              id: 'encounter-1',
            },
          },
          result: {
            data: {
              resolveEncounter: {
                encounter: {
                  id: 'encounter-1',
                  campaignId: 'campaign-1',
                  locationId: 'location-1',
                  name: 'Test Encounter',
                  description: 'A test encounter',
                  difficulty: 8,
                  scheduledAt: '2024-07-12T14:00:00Z',
                  isResolved: true,
                  resolvedAt: '2024-07-12T14:30:00Z',
                  variables: {},
                  updatedAt: '2024-07-12T14:30:00Z',
                },
                pre: {
                  total: 1,
                  succeeded: 1,
                  failed: 0,
                  results: [{ effectId: 'effect-1', success: true, error: null }],
                  executionOrder: ['effect-1'],
                },
                onResolve: {
                  total: 2,
                  succeeded: 2,
                  failed: 0,
                  results: [
                    { effectId: 'effect-2', success: true, error: null },
                    { effectId: 'effect-3', success: true, error: null },
                  ],
                  executionOrder: ['effect-2', 'effect-3'],
                },
                post: {
                  total: 1,
                  succeeded: 1,
                  failed: 0,
                  results: [{ effectId: 'effect-4', success: true, error: null }],
                  executionOrder: ['effect-4'],
                },
              },
            },
          },
        },
      ];

      function Wrapper({ children }: { children: ReactNode }) {
        return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      }

      const { result } = renderHook(() => useResolveEncounter(), {
        wrapper: Wrapper,
      });

      const resolutionResult = await result.current.resolveEncounter('encounter-1');

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(resolutionResult.encounter.id).toBe('encounter-1');
      expect(resolutionResult.encounter.isResolved).toBe(true);
      expect(resolutionResult.encounter.resolvedAt).toBe('2024-07-12T14:30:00Z');
      expect(resolutionResult.pre.total).toBe(1);
      expect(resolutionResult.onResolve.total).toBe(2);
      expect(resolutionResult.onResolve.succeeded).toBe(2);
      expect(resolutionResult.post.total).toBe(1);
    });

    it('should handle resolution errors', async () => {
      const mocks = [
        {
          request: {
            query: RESOLVE_ENCOUNTER,
            variables: {
              id: 'invalid-id',
            },
          },
          error: new Error('Encounter not found'),
        },
      ];

      function Wrapper({ children }: { children: ReactNode }) {
        return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      }

      const { result } = renderHook(() => useResolveEncounter(), {
        wrapper: Wrapper,
      });

      await expect(result.current.resolveEncounter('invalid-id')).rejects.toThrow(
        'Encounter not found'
      );
    });

    it('should handle partial effect failures during resolution', async () => {
      const mocks = [
        {
          request: {
            query: RESOLVE_ENCOUNTER,
            variables: {
              id: 'encounter-2',
            },
          },
          result: {
            data: {
              resolveEncounter: {
                encounter: {
                  id: 'encounter-2',
                  campaignId: 'campaign-1',
                  locationId: 'location-2',
                  name: 'Partial Failure Encounter',
                  description: 'Encounter with failed effects',
                  difficulty: 10,
                  scheduledAt: '2024-07-13T14:00:00Z',
                  isResolved: true,
                  resolvedAt: '2024-07-13T14:30:00Z',
                  variables: {},
                  updatedAt: '2024-07-13T14:30:00Z',
                },
                pre: {
                  total: 1,
                  succeeded: 1,
                  failed: 0,
                  results: [{ effectId: 'effect-1', success: true, error: null }],
                  executionOrder: ['effect-1'],
                },
                onResolve: {
                  total: 3,
                  succeeded: 2,
                  failed: 1,
                  results: [
                    { effectId: 'effect-2', success: true, error: null },
                    { effectId: 'effect-3', success: false, error: 'Effect execution failed' },
                    { effectId: 'effect-4', success: true, error: null },
                  ],
                  executionOrder: ['effect-2', 'effect-3', 'effect-4'],
                },
                post: {
                  total: 0,
                  succeeded: 0,
                  failed: 0,
                  results: [],
                  executionOrder: [],
                },
              },
            },
          },
        },
      ];

      function Wrapper({ children }: { children: ReactNode }) {
        return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      }

      const { result } = renderHook(() => useResolveEncounter(), {
        wrapper: Wrapper,
      });

      const resolutionResult = await result.current.resolveEncounter('encounter-2');

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(resolutionResult.encounter.isResolved).toBe(true);
      expect(resolutionResult.onResolve.succeeded).toBe(2);
      expect(resolutionResult.onResolve.failed).toBe(1);
      expect(resolutionResult.onResolve.results[1].error).toBe('Effect execution failed');
    });
  });
});
