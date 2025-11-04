import { MockedProvider } from '@apollo/client/testing/react';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { UPDATE_EVENT, COMPLETE_EVENT, useUpdateEvent, useCompleteEvent } from './events';

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
    cleanup(); // Unmount all React components and hooks
    vi.clearAllMocks(); // Clear all mock function call history
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

  describe('useCompleteEvent', () => {
    it('should return mutation function and loading state', () => {
      const { result } = renderHook(() => useCompleteEvent(), {
        wrapper: createWrapper(),
      });

      expect(result.current.completeEvent).toBeInstanceOf(Function);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it('should complete event and return effect execution summaries', async () => {
      const mocks = [
        {
          request: {
            query: COMPLETE_EVENT,
            variables: {
              id: 'event-1',
            },
          },
          result: {
            data: {
              completeEvent: {
                event: {
                  id: 'event-1',
                  campaignId: 'campaign-1',
                  locationId: null,
                  name: 'Test Event',
                  description: 'A test event',
                  eventType: 'story',
                  scheduledAt: '2024-07-10T10:00:00Z',
                  occurredAt: '2024-07-10T10:00:00Z',
                  isCompleted: true,
                  variables: {},
                  updatedAt: '2024-07-10T10:00:00Z',
                },
                pre: {
                  total: 2,
                  succeeded: 2,
                  failed: 0,
                  results: [
                    { effectId: 'effect-1', success: true, error: null },
                    { effectId: 'effect-2', success: true, error: null },
                  ],
                  executionOrder: ['effect-1', 'effect-2'],
                },
                onResolve: {
                  total: 1,
                  succeeded: 1,
                  failed: 0,
                  results: [{ effectId: 'effect-3', success: true, error: null }],
                  executionOrder: ['effect-3'],
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

      const { result } = renderHook(() => useCompleteEvent(), {
        wrapper: Wrapper,
      });

      const completionResult = await result.current.completeEvent('event-1');

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(completionResult.event.id).toBe('event-1');
      expect(completionResult.event.isCompleted).toBe(true);
      expect(completionResult.event.occurredAt).toBe('2024-07-10T10:00:00Z');
      expect(completionResult.pre.total).toBe(2);
      expect(completionResult.pre.succeeded).toBe(2);
      expect(completionResult.onResolve.total).toBe(1);
      expect(completionResult.post.total).toBe(1);
    });

    it('should handle completion errors', async () => {
      const mocks = [
        {
          request: {
            query: COMPLETE_EVENT,
            variables: {
              id: 'invalid-id',
            },
          },
          error: new Error('Event not found'),
        },
      ];

      function Wrapper({ children }: { children: ReactNode }) {
        return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
      }

      const { result } = renderHook(() => useCompleteEvent(), {
        wrapper: Wrapper,
      });

      await expect(result.current.completeEvent('invalid-id')).rejects.toThrow('Event not found');
    });

    it('should handle partial effect failures', async () => {
      const mocks = [
        {
          request: {
            query: COMPLETE_EVENT,
            variables: {
              id: 'event-2',
            },
          },
          result: {
            data: {
              completeEvent: {
                event: {
                  id: 'event-2',
                  campaignId: 'campaign-1',
                  locationId: null,
                  name: 'Partial Failure Event',
                  description: 'Event with failed effects',
                  eventType: 'story',
                  scheduledAt: '2024-07-11T10:00:00Z',
                  occurredAt: '2024-07-11T10:00:00Z',
                  isCompleted: true,
                  variables: {},
                  updatedAt: '2024-07-11T10:00:00Z',
                },
                pre: {
                  total: 2,
                  succeeded: 1,
                  failed: 1,
                  results: [
                    { effectId: 'effect-1', success: true, error: null },
                    { effectId: 'effect-2', success: false, error: 'Effect failed' },
                  ],
                  executionOrder: ['effect-1', 'effect-2'],
                },
                onResolve: {
                  total: 1,
                  succeeded: 1,
                  failed: 0,
                  results: [{ effectId: 'effect-3', success: true, error: null }],
                  executionOrder: ['effect-3'],
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

      const { result } = renderHook(() => useCompleteEvent(), {
        wrapper: Wrapper,
      });

      const completionResult = await result.current.completeEvent('event-2');

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(completionResult.event.isCompleted).toBe(true);
      expect(completionResult.pre.succeeded).toBe(1);
      expect(completionResult.pre.failed).toBe(1);
      expect(completionResult.pre.results[1].error).toBe('Effect failed');
    });
  });
});
