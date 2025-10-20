import { MockedProvider } from '@apollo/client/testing/react';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { UPDATE_ENCOUNTER, useUpdateEncounter } from './encounters';

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
});
