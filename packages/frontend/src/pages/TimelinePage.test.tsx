import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';
import { Timeline } from '@/components/features/timeline';
import { useTimelineData } from '@/hooks';
import { useCurrentWorldTime } from '@/services/api/hooks/world-time';
import { useCurrentCampaignId } from '@/stores';

import TimelinePage from './TimelinePage';

/**
 * Test suite for TimelinePage component
 *
 * Tests TICKET-022 Stage 5 and Stage 6 implementation:
 * - Timeline renders with event/encounter data
 * - Current world time marker integration
 * - Loading state displays during data fetch
 * - Error state displays on fetch failure
 * - Empty states for no campaign or no data
 * - Page structure and layout
 */

// Mock Zustand store
vi.mock('@/stores', () => ({
  useCurrentCampaignId: vi.fn(),
}));

// Mock useTimelineData hook
vi.mock('@/hooks', () => ({
  useTimelineData: vi.fn(),
}));

// Mock useCurrentWorldTime hook
vi.mock('@/services/api/hooks/world-time', () => ({
  useCurrentWorldTime: vi.fn(),
}));

// Mock Timeline component and TimelineControls
vi.mock('@/components/features/timeline', () => ({
  Timeline: vi.fn(({ items }) => (
    <div data-testid="timeline-component">
      <div>Timeline items: {items.length}</div>
    </div>
  )),
  TimelineControls: vi.fn(() => <div data-testid="timeline-controls" />),
}));

describe('TimelinePage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Set default campaign ID
    vi.mocked(useCurrentCampaignId).mockReturnValue('test-campaign-123');
    // Set default current world time (null)
    vi.mocked(useCurrentWorldTime).mockReturnValue({
      currentTime: null,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      networkStatus: 7,
    });
  });

  describe('Loading State', () => {
    it('should render loading state while fetching data', () => {
      vi.mocked(useTimelineData).mockReturnValue({
        items: [],
        loading: true,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('Loading timeline...')).toBeInTheDocument();
      expect(screen.getByText('Fetching events and encounters')).toBeInTheDocument();
    });

    it('should not render timeline component while loading', () => {
      vi.mocked(useTimelineData).mockReturnValue({
        items: [],
        loading: true,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.queryByTestId('timeline-component')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should render error message when fetch fails', () => {
      const errorMessage = 'Network error: Failed to fetch';
      vi.mocked(useTimelineData).mockReturnValue({
        items: [],
        loading: false,
        error: new Error(errorMessage),
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('Failed to load timeline')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should render retry button on error', () => {
      const mockRefetch = vi.fn();
      vi.mocked(useTimelineData).mockReturnValue({
        items: [],
        loading: false,
        error: new Error('Test error'),
        refetch: mockRefetch,
      });

      renderWithApollo(<TimelinePage />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should call refetch when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockRefetch = vi.fn();
      vi.mocked(useTimelineData).mockReturnValue({
        items: [],
        loading: false,
        error: new Error('Test error'),
        refetch: mockRefetch,
      });

      renderWithApollo(<TimelinePage />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Empty States', () => {
    it('should render empty state when no campaign selected', () => {
      // Mock no campaign selected
      vi.mocked(useCurrentCampaignId).mockReturnValueOnce(null);

      vi.mocked(useTimelineData).mockReturnValue({
        items: [],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('No campaign selected')).toBeInTheDocument();
      expect(screen.getByText('Please select a campaign to view its timeline')).toBeInTheDocument();
    });

    it('should render empty state when no timeline items exist', () => {
      vi.mocked(useTimelineData).mockReturnValue({
        items: [],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('No timeline items found')).toBeInTheDocument();
      expect(
        screen.getByText(/This campaign doesn't have any events or encounters yet/i)
      ).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('should render timeline with items when data is loaded', () => {
      const mockItems = [
        {
          id: 'event-1',
          content: 'Festival',
          start: new Date('2024-06-15'),
          type: 'point' as const,
          className: 'timeline-event-completed',
          title: 'Festival\nCompleted',
          editable: false,
        },
        {
          id: 'encounter-1',
          content: 'Dragon Attack',
          start: new Date('2024-07-01'),
          type: 'point' as const,
          className: 'timeline-encounter-resolved',
          title: 'Dragon Attack\nResolved',
          editable: false,
        },
      ];

      vi.mocked(useTimelineData).mockReturnValue({
        items: mockItems,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByTestId('timeline-component')).toBeInTheDocument();
      expect(screen.getByText('Timeline items: 2')).toBeInTheDocument();
    });

    it('should render header with item count', () => {
      const mockItems = [
        {
          id: 'event-1',
          content: 'Festival',
          start: new Date('2024-06-15'),
          type: 'point' as const,
          className: 'timeline-event-completed',
          title: 'Festival',
          editable: false,
        },
      ];

      vi.mocked(useTimelineData).mockReturnValue({
        items: mockItems,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('Campaign Timeline')).toBeInTheDocument();
      expect(screen.getByText('1 item')).toBeInTheDocument();
    });

    it('should render plural item count correctly', () => {
      const mockItems = [
        {
          id: 'event-1',
          content: 'Festival',
          start: new Date('2024-06-15'),
          type: 'point' as const,
          className: 'timeline-event-completed',
          title: 'Festival',
          editable: false,
        },
        {
          id: 'event-2',
          content: 'Battle',
          start: new Date('2024-06-20'),
          type: 'point' as const,
          className: 'timeline-event-scheduled',
          title: 'Battle',
          editable: true,
        },
      ];

      vi.mocked(useTimelineData).mockReturnValue({
        items: mockItems,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('2 items')).toBeInTheDocument();
    });

    it('should pass transformed items to Timeline component', () => {
      const mockItems = [
        {
          id: 'event-1',
          content: 'Festival',
          start: new Date('2024-06-15'),
          end: undefined,
          type: 'point' as const,
          className: 'timeline-event-completed',
          title: 'Festival\nCompleted',
          editable: false,
        },
      ];

      vi.mocked(useTimelineData).mockReturnValue({
        items: mockItems,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(Timeline).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: 'event-1',
              content: 'Festival',
              start: mockItems[0].start,
              type: 'point',
              className: 'timeline-event-completed',
              title: 'Festival\nCompleted',
              editable: false,
            }),
          ]),
        }),
        expect.anything()
      );
    });
  });

  describe('Data Fetching', () => {
    it('should call useTimelineData with campaign ID and currentTime', () => {
      const currentTime = new Date('2024-01-15T12:00:00Z');
      vi.mocked(useCurrentWorldTime).mockReturnValue({
        currentTime,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      vi.mocked(useTimelineData).mockReturnValue({
        items: [],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(useTimelineData).toHaveBeenCalledWith('test-campaign-123', currentTime);
    });

    it('should call useTimelineData with undefined when currentTime is null', () => {
      vi.mocked(useCurrentWorldTime).mockReturnValue({
        currentTime: null,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      vi.mocked(useTimelineData).mockReturnValue({
        items: [],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(useTimelineData).toHaveBeenCalledWith('test-campaign-123', undefined);
    });

    it('should handle empty string campaign ID gracefully', () => {
      vi.mocked(useCurrentCampaignId).mockReturnValueOnce(null);

      vi.mocked(useTimelineData).mockReturnValue({
        items: [],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(useTimelineData).toHaveBeenCalledWith('', undefined);
    });
  });

  describe('Current World Time Display', () => {
    it('should display current world time in header when available', () => {
      const currentTime = new Date('2024-01-15T12:00:00Z');
      vi.mocked(useCurrentWorldTime).mockReturnValue({
        currentTime,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      const mockItems = [
        {
          id: 'event-1',
          content: 'Festival',
          start: new Date('2024-06-15'),
          type: 'point' as const,
          className: 'timeline-event-completed',
          title: 'Festival',
          editable: false,
        },
      ];

      vi.mocked(useTimelineData).mockReturnValue({
        items: mockItems,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText(/Current Time:/)).toBeInTheDocument();
      expect(screen.getByText(/Current Time:/)).toHaveTextContent(
        `Current Time: ${currentTime.toLocaleDateString()}`
      );
    });

    it('should not display current time when null', () => {
      vi.mocked(useCurrentWorldTime).mockReturnValue({
        currentTime: null,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      const mockItems = [
        {
          id: 'event-1',
          content: 'Festival',
          start: new Date('2024-06-15'),
          type: 'point' as const,
          className: 'timeline-event-completed',
          title: 'Festival',
          editable: false,
        },
      ];

      vi.mocked(useTimelineData).mockReturnValue({
        items: mockItems,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.queryByText(/Current Time:/)).not.toBeInTheDocument();
    });

    it('should pass currentTime to Timeline component', () => {
      const currentTime = new Date('2024-01-15T12:00:00Z');
      vi.mocked(useCurrentWorldTime).mockReturnValue({
        currentTime,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      const mockItems = [
        {
          id: 'event-1',
          content: 'Festival',
          start: new Date('2024-06-15'),
          type: 'point' as const,
          className: 'timeline-event-completed',
          title: 'Festival',
          editable: false,
        },
      ];

      vi.mocked(useTimelineData).mockReturnValue({
        items: mockItems,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(<TimelinePage />);

      expect(Timeline).toHaveBeenCalledWith(
        expect.objectContaining({
          currentTime,
        }),
        expect.anything()
      );
    });
  });

  describe('Responsive Layout', () => {
    it('should render with full-height layout', () => {
      const mockItems = [
        {
          id: 'event-1',
          content: 'Festival',
          start: new Date('2024-06-15'),
          type: 'point' as const,
          className: 'timeline-event-completed',
          title: 'Festival',
          editable: false,
        },
      ];

      vi.mocked(useTimelineData).mockReturnValue({
        items: mockItems,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      const { container } = renderWithApollo(<TimelinePage />);

      // Check for h-screen class on main container
      const mainContainer = container.querySelector('.h-screen');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should render header with border', () => {
      const mockItems = [
        {
          id: 'event-1',
          content: 'Festival',
          start: new Date('2024-06-15'),
          type: 'point' as const,
          className: 'timeline-event-completed',
          title: 'Festival',
          editable: false,
        },
      ];

      vi.mocked(useTimelineData).mockReturnValue({
        items: mockItems,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      const { container } = renderWithApollo(<TimelinePage />);

      // Check for border-b class on header
      const header = container.querySelector('.border-b');
      expect(header).toBeInTheDocument();
    });
  });
});
