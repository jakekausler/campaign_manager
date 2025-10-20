import { MockedProvider } from '@apollo/client/testing/react';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { UPDATE_EVENT, useUpdateEvent } from './events';

// Wrapper component for testing hooks with Apollo Client
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MockedProvider>{children}</MockedProvider>;
  };
}

describe('Event Mutations', () => {
  beforeEach(() => {
    // Reset any test state before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('useUpdateEvent', () => {
    it('should return mutation function and loading state', () => {
      const { result } = renderHook(() => useUpdateEvent(), {
        wrapper: createWrapper(),
      });

      expect(result.current.updateEvent).toBeInstanceOf(Function);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it('should call updateEvent mutation with correct variables', async () => {
      const mocks = [
        {
          request: {
            query: UPDATE_EVENT,
            variables: {
              id: 'event-1',
              input: {
                scheduledAt: '2024-07-15T10:00:00Z',
              },
            },
          },
          result: {
            data: {
              updateEvent: {
                id: 'event-1',
                campaignId: 'campaign-1',
                name: 'Test Event',
                scheduledAt: '2024-07-15T10:00:00Z',
                updatedAt: '2024-06-15T12:00:00Z',
              },
            },
          },
        },
      ];

      function Wrapper({ children }: { children: ReactNode }) {
        return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      }

      const { result } = renderHook(() => useUpdateEvent(), {
        wrapper: Wrapper,
      });

      const updatedEvent = await result.current.updateEvent('event-1', {
        scheduledAt: '2024-07-15T10:00:00Z',
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(updatedEvent).toEqual({
        id: 'event-1',
        campaignId: 'campaign-1',
        name: 'Test Event',
        scheduledAt: '2024-07-15T10:00:00Z',
        updatedAt: '2024-06-15T12:00:00Z',
      });
    });

    it('should handle mutation errors', async () => {
      const mocks = [
        {
          request: {
            query: UPDATE_EVENT,
            variables: {
              id: 'invalid-id',
              input: {
                scheduledAt: '2024-07-15T10:00:00Z',
              },
            },
          },
          error: new Error('Event not found'),
        },
      ];

      function Wrapper({ children }: { children: ReactNode }) {
        return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      }

      const { result } = renderHook(() => useUpdateEvent(), {
        wrapper: Wrapper,
      });

      await expect(
        result.current.updateEvent('invalid-id', {
          scheduledAt: '2024-07-15T10:00:00Z',
        })
      ).rejects.toThrow('Event not found');
    });

    it('should update multiple fields at once', async () => {
      const mocks = [
        {
          request: {
            query: UPDATE_EVENT,
            variables: {
              id: 'event-1',
              input: {
                scheduledAt: '2024-07-15T10:00:00Z',
                name: 'Updated Event Name',
              },
            },
          },
          result: {
            data: {
              updateEvent: {
                id: 'event-1',
                campaignId: 'campaign-1',
                name: 'Updated Event Name',
                scheduledAt: '2024-07-15T10:00:00Z',
                updatedAt: '2024-06-15T12:00:00Z',
              },
            },
          },
        },
      ];

      function Wrapper({ children }: { children: ReactNode }) {
        return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      }

      const { result } = renderHook(() => useUpdateEvent(), {
        wrapper: Wrapper,
      });

      const updatedEvent = await result.current.updateEvent('event-1', {
        scheduledAt: '2024-07-15T10:00:00Z',
        name: 'Updated Event Name',
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(updatedEvent.name).toBe('Updated Event Name');
      expect(updatedEvent.scheduledAt).toBe('2024-07-15T10:00:00Z');
    });
  });
});
