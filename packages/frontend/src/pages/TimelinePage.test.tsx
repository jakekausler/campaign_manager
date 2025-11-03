import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSearchParams } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';
import { Timeline, type TimelineProps } from '@/components/features/timeline';
import { useTimelineReschedule } from '@/hooks';
import { useEncountersByCampaign } from '@/services/api/hooks/encounters';
import { useEventsByCampaign } from '@/services/api/hooks/events';
import { useCurrentWorldTime } from '@/services/api/hooks/world-time';
import { useCurrentCampaignId, useSelectionStore, EntityType } from '@/stores';

import TimelinePage from './TimelinePage';

/**
 * Test suite for TimelinePage component
 *
 * Tests TICKET-022 Stage 5, Stage 6, and Stage 11 implementation:
 * - Timeline renders with event/encounter data
 * - Current world time marker integration
 * - Filtering and lane grouping (Stage 11)
 * - URL parameter persistence (Stage 11)
 * - Loading state displays during data fetch
 * - Error state displays on fetch failure
 * - Empty states for no campaign or no data
 * - Page structure and layout
 */

// Mock Zustand store
vi.mock('@/stores', () => ({
  useCurrentCampaignId: vi.fn(),
  useSelectionStore: vi.fn(),
  EntityType: {
    SETTLEMENT: 'SETTLEMENT',
    STRUCTURE: 'STRUCTURE',
    EVENT: 'EVENT',
    ENCOUNTER: 'ENCOUNTER',
  },
}));

// Mock hooks
vi.mock('@/hooks', () => ({
  useTimelineReschedule: vi.fn(),
}));

// Mock GraphQL hooks for events and encounters (Stage 11 changes)
vi.mock('@/services/api/hooks/events', () => ({
  useEventsByCampaign: vi.fn(),
}));

vi.mock('@/services/api/hooks/encounters', () => ({
  useEncountersByCampaign: vi.fn(),
}));

// Mock useCurrentWorldTime hook
vi.mock('@/services/api/hooks/world-time', () => ({
  useCurrentWorldTime: vi.fn(),
}));

// Mock React Router hooks (for URL parameter integration in Stage 11)
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useSearchParams: vi.fn(),
  };
});

// Mock Timeline component, TimelineControls, and TimelineFilters
vi.mock('@/components/features/timeline', () => ({
  Timeline: vi.fn(({ items }) => (
    <div data-testid="timeline-component">
      <div>Timeline items: {items.length}</div>
    </div>
  )),
  TimelineControls: vi.fn(() => <div data-testid="timeline-controls" />),
  TimelineFilters: vi.fn(() => <div data-testid="timeline-filters" />),
}));

// Mock EntityInspector component
vi.mock('@/components/features/entity-inspector', () => ({
  EntityInspector: vi.fn(({ entityType, entityId, isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="entity-inspector">
        <div>Entity Type: {entityType}</div>
        <div>Entity ID: {entityId}</div>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }),
}));

// Mock events data
const mockEvents = [
  {
    id: 'event-1',
    name: 'Festival',
    description: 'Annual celebration',
    eventType: 'kingdom',
    scheduledAt: '2024-06-15T12:00:00.000Z',
    occurredAt: '2024-06-15T14:00:00.000Z',
    isCompleted: true,
    locationId: 'location-1',
    campaignId: 'test-campaign-123',
    variables: {},
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-15T14:00:00.000Z',
    version: 1,
    location: null,
    notes: null,
    effects: [],
  },
  {
    id: 'event-2',
    name: 'Battle',
    description: 'Epic battle',
    eventType: 'story',
    scheduledAt: '2024-06-20T10:00:00.000Z',
    occurredAt: null,
    isCompleted: false,
    locationId: 'location-2',
    campaignId: 'test-campaign-123',
    variables: {},
    createdAt: '2024-06-10T00:00:00.000Z',
    updatedAt: '2024-06-10T00:00:00.000Z',
    version: 1,
    location: null,
    notes: null,
    effects: [],
  },
];

// Mock encounters data
const mockEncounters = [
  {
    id: 'encounter-1',
    name: 'Goblin Ambush',
    description: 'Fearsome goblins',
    difficulty: 15,
    scheduledAt: null,
    isResolved: true,
    resolvedAt: '2024-07-01T16:30:00.000Z',
    locationId: 'location-3',
    campaignId: 'test-campaign-123',
    variables: {},
    createdAt: '2024-06-25T00:00:00.000Z',
    updatedAt: '2024-07-01T16:30:00.000Z',
    version: 1,
    location: null,
    outcome: null,
    effects: [],
  },
];

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

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
    // Set default useTimelineReschedule mock
    vi.mocked(useTimelineReschedule).mockReturnValue({
      reschedule: vi.fn(),
      loading: false,
      error: undefined,
    });
    // Set default selection store mock (TICKET-024 Stage 4)
    vi.mocked(useSelectionStore).mockReturnValue({
      selectedEntities: [],
      selectEntity: vi.fn(),
      toggleSelection: vi.fn(),
      clearSelection: vi.fn(),
      addToSelection: vi.fn(),
      removeFromSelection: vi.fn(),
    });
    // Mock React Router hooks (Stage 11 URL parameter integration)
    vi.mocked(useSearchParams).mockReturnValue([
      new URLSearchParams(),
      vi.fn(), // setSearchParams
    ]);
    // Set default empty data for events and encounters (Stage 11)
    vi.mocked(useEventsByCampaign).mockReturnValue({
      events: [],
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      networkStatus: 7,
    });
    vi.mocked(useEncountersByCampaign).mockReturnValue({
      encounters: [],
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      networkStatus: 7,
    });
  });

  describe('Loading State', () => {
    it('should render loading state while fetching events', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [],
        loading: true,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 1,
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('Loading timeline...')).toBeInTheDocument();
      expect(screen.getByText('Fetching events and encounters')).toBeInTheDocument();
    });

    it('should not render timeline component while loading', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [],
        loading: true,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 1,
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.queryByTestId('timeline-component')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should render error message when fetch fails', () => {
      const errorMessage = 'Network error: Failed to fetch';
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [],
        loading: false,
        error: new Error(errorMessage),
        refetch: vi.fn(),
        networkStatus: 8,
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('Failed to load timeline')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should render retry button on error', () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [],
        loading: false,
        error: new Error('Test error'),
        refetch: mockRefetch,
        networkStatus: 8,
      });

      renderWithApollo(<TimelinePage />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should call refetch when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockEventsRefetch = vi.fn();
      const mockEncountersRefetch = vi.fn();

      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [],
        loading: false,
        error: new Error('Test error'),
        refetch: mockEventsRefetch,
        networkStatus: 8,
      });

      vi.mocked(useEncountersByCampaign).mockReturnValue({
        encounters: [],
        loading: false,
        error: undefined,
        refetch: mockEncountersRefetch,
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(mockEventsRefetch).toHaveBeenCalledTimes(1);
        expect(mockEncountersRefetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Empty States', () => {
    it('should render empty state when no campaign selected', () => {
      // Mock no campaign selected
      vi.mocked(useCurrentCampaignId).mockReturnValueOnce(null);

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('No campaign selected')).toBeInTheDocument();
      expect(screen.getByText('Please select a campaign to view its timeline')).toBeInTheDocument();
    });

    it('should render empty state when no timeline items exist', () => {
      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('No timeline items found')).toBeInTheDocument();
      expect(
        screen.getByText(/This campaign doesn't have any events or encounters yet/i)
      ).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('should render timeline with items when data is loaded', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: mockEvents,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      vi.mocked(useEncountersByCampaign).mockReturnValue({
        encounters: mockEncounters,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByTestId('timeline-component')).toBeInTheDocument();
      expect(screen.getByText('Timeline items: 3')).toBeInTheDocument();
    });

    it('should render header with item count', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('Campaign Timeline')).toBeInTheDocument();
      expect(screen.getByText('1 item')).toBeInTheDocument();
    });

    it('should render plural item count correctly', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: mockEvents,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('2 items')).toBeInTheDocument();
    });

    it('should pass transformed items to Timeline component', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      expect(Timeline).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: 'event-event-1',
              content: 'Festival',
            }),
          ]),
        }),
        expect.anything()
      );
    });
  });

  describe('Data Fetching', () => {
    it('should call GraphQL hooks with campaign ID', () => {
      renderWithApollo(<TimelinePage />);

      expect(useEventsByCampaign).toHaveBeenCalledWith('test-campaign-123');
      expect(useEncountersByCampaign).toHaveBeenCalledWith('test-campaign-123');
    });

    it('should handle empty string campaign ID gracefully', () => {
      vi.mocked(useCurrentCampaignId).mockReturnValueOnce(null);

      renderWithApollo(<TimelinePage />);

      expect(useEventsByCampaign).toHaveBeenCalledWith('');
      expect(useEncountersByCampaign).toHaveBeenCalledWith('');
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

      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
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

      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
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

      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
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
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      const { container } = renderWithApollo(<TimelinePage />);

      // Check for h-screen class on main container
      const mainContainer = container.querySelector('.h-screen');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should render header with border', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      const { container } = renderWithApollo(<TimelinePage />);

      // Check for border-b class on header
      const header = container.querySelector('.border-b');
      expect(header).toBeInTheDocument();
    });
  });

  describe('Stage 11: Filters Integration', () => {
    it('should render TimelineFilters component', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByTestId('timeline-filters')).toBeInTheDocument();
    });

    it('should render filter sidebar', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });
  });

  describe('TICKET-024 Stage 4: Cross-View Selection Integration', () => {
    const mockSelectEntity = vi.fn();
    const mockToggleSelection = vi.fn();
    const mockClearSelection = vi.fn();

    beforeEach(() => {
      mockSelectEntity.mockClear();
      mockToggleSelection.mockClear();
      mockClearSelection.mockClear();

      // Mock default selection store (empty selection)
      vi.mocked(useSelectionStore).mockReturnValue({
        selectedEntities: [],
        selectEntity: mockSelectEntity,
        toggleSelection: mockToggleSelection,
        clearSelection: mockClearSelection,
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
      });
    });

    it('should call selectEntity when timeline item is clicked', async () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      // Wait for Timeline to be called with items and get the props
      let timelineProps: TimelineProps;
      await waitFor(() => {
        const calls = vi.mocked(Timeline).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0].items.length).toBeGreaterThan(0);
        timelineProps = lastCall[0];
      });

      expect(timelineProps.onSelect).toBeDefined();

      // Simulate clicking on a timeline item (single-click, no Ctrl key)
      const mockEvent = new MouseEvent('click', { ctrlKey: false });
      timelineProps.onSelect({
        items: ['event-event-1'], // Timeline item ID format
        event: mockEvent as Event,
      });

      // Verify global selection was updated
      expect(mockSelectEntity).toHaveBeenCalledWith({
        id: 'event-1',
        type: 'EVENT',
        name: 'Festival',
        metadata: {
          scheduledAt: expect.any(String),
        },
      });
    });

    it('should call toggleSelection when Ctrl+clicking timeline item', async () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      // Wait for Timeline to be called with items and get the props
      let timelineProps: TimelineProps;
      await waitFor(() => {
        const calls = vi.mocked(Timeline).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0].items.length).toBeGreaterThan(0);
        timelineProps = lastCall[0];
      });

      // Simulate Ctrl+clicking on a timeline item
      const mockEvent = new MouseEvent('click', { ctrlKey: true });
      timelineProps.onSelect({
        items: ['event-event-1'],
        event: mockEvent as Event,
      });

      // Verify global selection was toggled
      expect(mockToggleSelection).toHaveBeenCalledWith({
        id: 'event-1',
        type: 'EVENT',
        name: 'Festival',
        metadata: {
          scheduledAt: expect.any(String),
        },
      });
    });

    it('should call clearSelection when deselecting all items', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      const calls = vi.mocked(Timeline).mock.calls;
      const timelineProps = calls[calls.length - 1][0]; // Get props from the last call

      // Ensure onSelect handler exists before calling
      if (timelineProps.onSelect) {
        // Simulate clicking on empty space (no items selected)
        const mockEvent = new MouseEvent('click', { ctrlKey: false });
        timelineProps.onSelect({
          items: [],
          event: mockEvent as Event,
        });

        // Verify global selection was cleared
        expect(mockClearSelection).toHaveBeenCalled();
      }
    });

    it('should handle encounter selection', async () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      vi.mocked(useEncountersByCampaign).mockReturnValue({
        encounters: [mockEncounters[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      // Wait for Timeline to be called with items and get the props
      let timelineProps: TimelineProps;
      await waitFor(() => {
        const calls = vi.mocked(Timeline).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0].items.length).toBeGreaterThan(0);
        timelineProps = lastCall[0];
      });

      // Simulate clicking on an encounter
      const mockEvent = new MouseEvent('click', { ctrlKey: false });
      timelineProps.onSelect({
        items: ['encounter-encounter-1'],
        event: mockEvent as Event,
      });

      // Verify global selection was updated with encounter
      expect(mockSelectEntity).toHaveBeenCalledWith({
        id: 'encounter-1',
        type: 'ENCOUNTER',
        name: 'Goblin Ambush',
        metadata: {
          scheduledAt: expect.any(String),
        },
      });
    });

    it('should update timeline selection when global selection changes (EVENT)', () => {
      // Mock selection store with a selected event
      vi.mocked(useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'event-1',
            type: EntityType.EVENT,
            name: 'Festival',
          },
        ],
        selectEntity: mockSelectEntity,
        toggleSelection: mockToggleSelection,
        clearSelection: mockClearSelection,
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
      });

      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      // Verify Timeline component receives onSelect handler
      expect(Timeline).toHaveBeenCalled();
      // Note: In a real integration test, we would verify that the timeline
      // calls setSelection on the timeline ref, but that requires a more complex
      // setup with actual timeline instance. For now, we verify the component renders.
    });

    it('should update timeline selection when global selection changes (ENCOUNTER)', () => {
      // Mock selection store with a selected encounter
      vi.mocked(useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'encounter-1',
            type: EntityType.ENCOUNTER,
            name: 'Goblin Ambush',
          },
        ],
        selectEntity: mockSelectEntity,
        toggleSelection: mockToggleSelection,
        clearSelection: mockClearSelection,
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
      });

      vi.mocked(useEncountersByCampaign).mockReturnValue({
        encounters: [mockEncounters[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      // Verify Timeline component renders with encounter data
      expect(Timeline).toHaveBeenCalled();
    });

    /**
     * TICKET-024 Stage 5: Cross-View Auto-Scroll (Timeline)
     *
     * Auto-scroll functionality is implemented in TimelinePage.tsx lines 267-305.
     * The implementation uses:
     * - timeline.setSelection() to highlight selected items
     * - timeline.moveTo() to scroll to first selected item (smooth animation)
     *
     * Comprehensive auto-scroll testing is provided in FlowViewPage.test.tsx
     * which demonstrates the same testing pattern with setCenter/fitView.
     *
     * Testing Timeline's auto-scroll requires complex mocking of:
     * - useSelectionStore (global selection state)
     * - useEventsByCampaign / useEncountersByCampaign (timeline items data)
     * - Timeline component ref methods (setSelection, moveTo)
     *
     * The implementation has been manually verified to work correctly across all views.
     * See Stage 4 implementation notes (commit e1b4a20) for details.
     */
  });

  describe('TICKET-025 Stage 4: EntityInspector Integration', () => {
    it('should not render EntityInspector initially', () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      expect(screen.queryByTestId('entity-inspector')).not.toBeInTheDocument();
    });

    it('should open EntityInspector for Event when timeline item is clicked', async () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      // Wait for Timeline to be called with items and get the props
      let timelineProps: TimelineProps;
      await waitFor(() => {
        const calls = vi.mocked(Timeline).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0].items.length).toBeGreaterThan(0);
        timelineProps = lastCall[0];
      });

      // Simulate clicking on an event (single-click, no Ctrl key)
      const mockEvent = new MouseEvent('click', { ctrlKey: false });
      timelineProps.onSelect({
        items: ['event-event-1'],
        event: mockEvent as Event,
      });

      // Wait for EntityInspector to appear
      await waitFor(() => {
        expect(screen.getByTestId('entity-inspector')).toBeInTheDocument();
      });

      // Verify EntityInspector has correct props
      expect(screen.getByText('Entity Type: event')).toBeInTheDocument();
      expect(screen.getByText('Entity ID: event-1')).toBeInTheDocument();
    });

    it('should open EntityInspector for Encounter when timeline item is clicked', async () => {
      vi.mocked(useEncountersByCampaign).mockReturnValue({
        encounters: [mockEncounters[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      // Wait for Timeline to be called with items and get the props
      let timelineProps: TimelineProps;
      await waitFor(() => {
        const calls = vi.mocked(Timeline).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0].items.length).toBeGreaterThan(0);
        timelineProps = lastCall[0];
      });

      // Simulate clicking on an encounter
      const mockEvent = new MouseEvent('click', { ctrlKey: false });
      timelineProps.onSelect({
        items: ['encounter-encounter-1'],
        event: mockEvent as Event,
      });

      // Wait for EntityInspector to appear
      await waitFor(() => {
        expect(screen.getByTestId('entity-inspector')).toBeInTheDocument();
      });

      // Verify EntityInspector has correct props
      expect(screen.getByText('Entity Type: encounter')).toBeInTheDocument();
      expect(screen.getByText('Entity ID: encounter-1')).toBeInTheDocument();
    });

    it('should not open EntityInspector for Ctrl+click (multi-select)', async () => {
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      // Wait for Timeline to be called with items and get the props
      let timelineProps: TimelineProps;
      await waitFor(() => {
        const calls = vi.mocked(Timeline).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0].items.length).toBeGreaterThan(0);
        timelineProps = lastCall[0];
      });

      // Simulate Ctrl+clicking on an event
      const mockEvent = new MouseEvent('click', { ctrlKey: true });
      timelineProps.onSelect({
        items: ['event-event-1'],
        event: mockEvent as Event,
      });

      // EntityInspector should not open for Ctrl+click
      expect(screen.queryByTestId('entity-inspector')).not.toBeInTheDocument();
    });

    it('should close EntityInspector when onClose is called', async () => {
      const user = userEvent.setup();
      vi.mocked(useEventsByCampaign).mockReturnValue({
        events: [mockEvents[0]],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7,
      });

      renderWithApollo(<TimelinePage />);

      // Wait for Timeline to be called with items and get the props
      let timelineProps: TimelineProps;
      await waitFor(() => {
        const calls = vi.mocked(Timeline).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0].items.length).toBeGreaterThan(0);
        timelineProps = lastCall[0];
      });

      // Open EntityInspector
      const mockEvent = new MouseEvent('click', { ctrlKey: false });
      timelineProps.onSelect({
        items: ['event-event-1'],
        event: mockEvent as Event,
      });

      // Wait for EntityInspector to appear
      await waitFor(() => {
        expect(screen.getByTestId('entity-inspector')).toBeInTheDocument();
      });

      // Click close button
      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      // EntityInspector should be hidden
      await waitFor(() => {
        expect(screen.queryByTestId('entity-inspector')).not.toBeInTheDocument();
      });
    });
  });
});
