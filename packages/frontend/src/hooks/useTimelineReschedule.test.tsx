import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import { UPDATE_ENCOUNTER } from '@/services/api/mutations/encounters';
import { UPDATE_EVENT } from '@/services/api/mutations/events';

import { useTimelineReschedule } from './useTimelineReschedule';

// Mock console.error to avoid cluttering test output
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  console.error = originalError;
});

describe('useTimelineReschedule', () => {
  it('should return reschedule function and loading state', () => {
    function Wrapper({ children }: { children: ReactNode }) {
      return <MockedProvider>{children}</MockedProvider>;
    }

    const { result } = renderHook(
      () => useTimelineReschedule({ currentWorldTime: new Date('2024-06-15T00:00:00Z') }),
      { wrapper: Wrapper }
    );

    expect(result.current.reschedule).toBeInstanceOf(Function);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('should reschedule an event with valid date', async () => {
    const mocks = [
      {
        request: {
          query: UPDATE_EVENT,
          variables: {
            id: 'event-1',
            input: {
              scheduledAt: '2024-07-01T10:00:00.000Z',
            },
          },
        },
        result: {
          data: {
            updateEvent: {
              id: 'event-1',
              campaignId: 'campaign-1',
              name: 'Test Event',
              scheduledAt: '2024-07-01T10:00:00.000Z',
              updatedAt: '2024-06-15T12:00:00Z',
            },
          },
        },
      },
    ];

    function Wrapper({ children }: { children: ReactNode }) {
      return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
    }

    const { result } = renderHook(
      () => useTimelineReschedule({ currentWorldTime: new Date('2024-06-15T00:00:00Z') }),
      { wrapper: Wrapper }
    );

    const item = {
      id: 'event-1',
      content: 'Test Event',
      start: new Date('2024-06-20T10:00:00Z'),
      editable: true,
      type: 'event' as const,
      isCompleted: false,
    };

    let rescheduleResult: { success: boolean; error?: string };

    await act(async () => {
      rescheduleResult = await result.current.reschedule(item, new Date('2024-07-01T10:00:00Z'));
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(rescheduleResult!).toEqual({ success: true });
  });

  it('should reschedule an encounter with valid date', async () => {
    const mocks = [
      {
        request: {
          query: UPDATE_ENCOUNTER,
          variables: {
            id: 'encounter-1',
            input: {
              scheduledAt: '2024-07-05T14:00:00.000Z',
            },
          },
        },
        result: {
          data: {
            updateEncounter: {
              id: 'encounter-1',
              campaignId: 'campaign-1',
              name: 'Dragon Attack',
              scheduledAt: '2024-07-05T14:00:00.000Z',
              updatedAt: '2024-06-15T12:00:00Z',
            },
          },
        },
      },
    ];

    function Wrapper({ children }: { children: ReactNode }) {
      return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
    }

    const { result } = renderHook(
      () => useTimelineReschedule({ currentWorldTime: new Date('2024-06-15T00:00:00Z') }),
      { wrapper: Wrapper }
    );

    const item = {
      id: 'encounter-1',
      content: 'Dragon Attack',
      start: new Date('2024-06-20T14:00:00Z'),
      editable: true,
      type: 'encounter' as const,
      isResolved: false,
    };

    let rescheduleResult: { success: boolean; error?: string };

    await act(async () => {
      rescheduleResult = await result.current.reschedule(item, new Date('2024-07-05T14:00:00Z'));
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(rescheduleResult!).toEqual({ success: true });
  });

  it('should prevent rescheduling completed events', async () => {
    function Wrapper({ children }: { children: ReactNode }) {
      return <MockedProvider>{children}</MockedProvider>;
    }

    const { result } = renderHook(
      () => useTimelineReschedule({ currentWorldTime: new Date('2024-06-15T00:00:00Z') }),
      { wrapper: Wrapper }
    );

    const item = {
      id: 'event-1',
      content: 'Completed Event',
      start: new Date('2024-06-10T10:00:00Z'),
      editable: false,
      type: 'event' as const,
      isCompleted: true,
    };

    const rescheduleResult = await result.current.reschedule(
      item,
      new Date('2024-07-01T10:00:00Z')
    );

    expect(rescheduleResult.success).toBe(false);
    expect(rescheduleResult.error).toBe('Cannot reschedule completed events');
  });

  it('should prevent rescheduling resolved encounters', async () => {
    function Wrapper({ children }: { children: ReactNode }) {
      return <MockedProvider>{children}</MockedProvider>;
    }

    const { result } = renderHook(
      () => useTimelineReschedule({ currentWorldTime: new Date('2024-06-15T00:00:00Z') }),
      { wrapper: Wrapper }
    );

    const item = {
      id: 'encounter-1',
      content: 'Resolved Encounter',
      start: new Date('2024-06-10T14:00:00Z'),
      editable: false,
      type: 'encounter' as const,
      isResolved: true,
    };

    const rescheduleResult = await result.current.reschedule(
      item,
      new Date('2024-07-05T14:00:00Z')
    );

    expect(rescheduleResult.success).toBe(false);
    expect(rescheduleResult.error).toBe('Cannot reschedule resolved encounters');
  });

  it('should prevent scheduling in the past', async () => {
    function Wrapper({ children }: { children: ReactNode }) {
      return <MockedProvider>{children}</MockedProvider>;
    }

    const { result } = renderHook(
      () => useTimelineReschedule({ currentWorldTime: new Date('2024-06-15T00:00:00Z') }),
      { wrapper: Wrapper }
    );

    const item = {
      id: 'event-1',
      content: 'Test Event',
      start: new Date('2024-06-20T10:00:00Z'),
      editable: true,
      type: 'event' as const,
      isCompleted: false,
    };

    const rescheduleResult = await result.current.reschedule(
      item,
      new Date('2024-06-14T10:00:00Z') // Before current world time
    );

    expect(rescheduleResult.success).toBe(false);
    expect(rescheduleResult.error).toBe('Cannot schedule in the past');
  });

  it('should handle mutation errors gracefully', async () => {
    const mocks = [
      {
        request: {
          query: UPDATE_EVENT,
          variables: {
            id: 'event-1',
            input: {
              scheduledAt: '2024-07-01T10:00:00.000Z',
            },
          },
        },
        error: new Error('Network error'),
      },
    ];

    function Wrapper({ children }: { children: ReactNode }) {
      return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
    }

    const { result } = renderHook(
      () => useTimelineReschedule({ currentWorldTime: new Date('2024-06-15T00:00:00Z') }),
      { wrapper: Wrapper }
    );

    const item = {
      id: 'event-1',
      content: 'Test Event',
      start: new Date('2024-06-20T10:00:00Z'),
      editable: true,
      type: 'event' as const,
      isCompleted: false,
    };

    let rescheduleResult: { success: boolean; error?: string };

    await act(async () => {
      rescheduleResult = await result.current.reschedule(item, new Date('2024-07-01T10:00:00Z'));
    });

    expect(rescheduleResult!.success).toBe(false);
    expect(rescheduleResult!.error).toContain('Failed to reschedule');
  });

  it('should work without currentWorldTime (no past validation)', async () => {
    const mocks = [
      {
        request: {
          query: UPDATE_EVENT,
          variables: {
            id: 'event-1',
            input: {
              scheduledAt: '2020-01-01T00:00:00.000Z',
            },
          },
        },
        result: {
          data: {
            updateEvent: {
              id: 'event-1',
              campaignId: 'campaign-1',
              name: 'Test Event',
              scheduledAt: '2020-01-01T00:00:00.000Z',
              updatedAt: '2024-06-15T12:00:00Z',
            },
          },
        },
      },
    ];

    function Wrapper({ children }: { children: ReactNode }) {
      return <MockedProvider mocks={mocks}>{children}</MockedProvider>;
    }

    const { result } = renderHook(() => useTimelineReschedule({}), { wrapper: Wrapper });

    const item = {
      id: 'event-1',
      content: 'Test Event',
      start: new Date('2024-06-20T10:00:00Z'),
      editable: true,
      type: 'event' as const,
      isCompleted: false,
    };

    let rescheduleResult: { success: boolean; error?: string };

    await act(async () => {
      rescheduleResult = await result.current.reschedule(
        item,
        new Date('2020-01-01T00:00:00Z') // Far in past, but should be allowed
      );
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(rescheduleResult!.success).toBe(true);
  });
});
