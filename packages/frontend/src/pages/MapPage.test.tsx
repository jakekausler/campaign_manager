import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';
import { useSelectionStore } from '@/stores';

import MapPage from './MapPage';

// Mock the stores
vi.mock('@/stores', async () => {
  const actual = await vi.importActual('@/stores');
  return {
    ...actual,
    useSelectionStore: vi.fn(),
  };
});

// Mock the EntityInspector component
vi.mock('@/components/features/entity-inspector', () => ({
  EntityInspector: vi.fn(() => <div data-testid="entity-inspector">Entity Inspector</div>),
}));

// Store the onEntitySelect callback for testing
let mockOnEntitySelect:
  | ((type: string, id: string, event?: unknown, metadata?: unknown) => void)
  | undefined;

// Mock the Map component
vi.mock('@/components/features/map', () => ({
  Map: vi.fn(({ initialCenter, initialZoom, worldId, kingdomId, campaignId, onEntitySelect }) => {
    // Capture the onEntitySelect callback
    mockOnEntitySelect = onEntitySelect;

    return (
      <div data-testid="map-component">
        Map Component
        <div data-testid="map-initial-center">{JSON.stringify(initialCenter)}</div>
        <div data-testid="map-initial-zoom">{initialZoom}</div>
        <div data-testid="map-world-id">{worldId}</div>
        <div data-testid="map-kingdom-id">{kingdomId}</div>
        <div data-testid="map-campaign-id">{campaignId}</div>
      </div>
    );
  }),
  ViewportState: {} as unknown,
}));

describe('MapPage', () => {
  // Mock selection store functions
  const mockSelectEntity = vi.fn();
  const mockToggleSelection = vi.fn();

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockOnEntitySelect = undefined;

    // Setup default mock for useSelectionStore
    vi.mocked(useSelectionStore).mockReturnValue({
      selectedEntities: [],
      selectEntity: mockSelectEntity,
      addToSelection: vi.fn(),
      removeFromSelection: vi.fn(),
      clearSelection: vi.fn(),
      toggleSelection: mockToggleSelection,
    });
  });
  it('should render page header with title', () => {
    renderWithApollo(<MapPage />);

    expect(screen.getByRole('heading', { name: /campaign map/i })).toBeInTheDocument();
    expect(screen.getByText(/interactive view of your campaign world/i)).toBeInTheDocument();
  });

  it('should render Map component', () => {
    renderWithApollo(<MapPage />);

    expect(screen.getByTestId('map-component')).toBeInTheDocument();
  });

  it('should pass initial center [0, 0] to Map', () => {
    renderWithApollo(<MapPage />);

    expect(screen.getByTestId('map-initial-center')).toHaveTextContent('[0,0]');
  });

  it('should pass initial zoom 2 to Map', () => {
    renderWithApollo(<MapPage />);

    expect(screen.getByTestId('map-initial-zoom')).toHaveTextContent('2');
  });

  it('should pass placeholder worldId to Map', () => {
    renderWithApollo(<MapPage />);

    expect(screen.getByTestId('map-world-id')).toHaveTextContent('world-placeholder-id');
  });

  it('should pass placeholder kingdomId to Map', () => {
    renderWithApollo(<MapPage />);

    expect(screen.getByTestId('map-kingdom-id')).toHaveTextContent('kingdom-placeholder-id');
  });

  it('should pass placeholder campaignId to Map', () => {
    renderWithApollo(<MapPage />);

    expect(screen.getByTestId('map-campaign-id')).toHaveTextContent('campaign-placeholder-id');
  });

  it('should render footer with viewport info', () => {
    renderWithApollo(<MapPage />);

    // Footer contains initial viewport info (from state initialization)
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent(/viewing/i);
    expect(footer).toHaveTextContent(/zoom/i);
    expect(footer).toHaveTextContent(/center/i);
  });

  it('should have full-screen flex layout', () => {
    const { container } = renderWithApollo(<MapPage />);

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass('h-screen', 'flex', 'flex-col');
  });

  it('should have header with proper styling', () => {
    renderWithApollo(<MapPage />);

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('bg-white', 'border-b', 'border-gray-200');
  });

  it('should have main content area with flex-1', () => {
    const { container } = renderWithApollo(<MapPage />);

    const main = container.querySelector('main');
    expect(main).toHaveClass('flex-1', 'relative');
  });

  it('should have footer with proper styling', () => {
    renderWithApollo(<MapPage />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('bg-white', 'border-t', 'border-gray-200');
  });

  describe('Selection Integration (TICKET-024)', () => {
    it('should call selectEntity when settlement clicked without modifier keys', async () => {
      renderWithApollo(<MapPage />);

      // Simulate settlement click (no modifier keys)
      if (mockOnEntitySelect) {
        mockOnEntitySelect(
          'settlement',
          'settlement-123',
          { ctrlKey: false, metaKey: false },
          { locationId: 'loc-456' }
        );
      }

      await waitFor(() => {
        expect(mockSelectEntity).toHaveBeenCalledWith({
          id: 'settlement-123',
          type: 'SETTLEMENT',
          metadata: { locationId: 'loc-456' },
        });
      });
      expect(mockToggleSelection).not.toHaveBeenCalled();
    });

    it('should call toggleSelection when settlement clicked with Ctrl key', async () => {
      renderWithApollo(<MapPage />);

      // Simulate settlement Ctrl+click
      if (mockOnEntitySelect) {
        mockOnEntitySelect(
          'settlement',
          'settlement-123',
          { ctrlKey: true, metaKey: false },
          { locationId: 'loc-456' }
        );
      }

      await waitFor(() => {
        expect(mockToggleSelection).toHaveBeenCalledWith({
          id: 'settlement-123',
          type: 'SETTLEMENT',
          metadata: { locationId: 'loc-456' },
        });
      });
      expect(mockSelectEntity).not.toHaveBeenCalled();
    });

    it('should call toggleSelection when settlement clicked with Cmd key (Mac)', async () => {
      renderWithApollo(<MapPage />);

      // Simulate settlement Cmd+click (Mac)
      if (mockOnEntitySelect) {
        mockOnEntitySelect(
          'settlement',
          'settlement-123',
          { ctrlKey: false, metaKey: true },
          { locationId: 'loc-456' }
        );
      }

      await waitFor(() => {
        expect(mockToggleSelection).toHaveBeenCalledWith({
          id: 'settlement-123',
          type: 'SETTLEMENT',
          metadata: { locationId: 'loc-456' },
        });
      });
      expect(mockSelectEntity).not.toHaveBeenCalled();
    });

    it('should call selectEntity when structure clicked without modifier keys', async () => {
      renderWithApollo(<MapPage />);

      // Simulate structure click (no modifier keys)
      if (mockOnEntitySelect) {
        mockOnEntitySelect(
          'structure',
          'structure-789',
          { ctrlKey: false, metaKey: false },
          { settlementId: 'settlement-123' }
        );
      }

      await waitFor(() => {
        expect(mockSelectEntity).toHaveBeenCalledWith({
          id: 'structure-789',
          type: 'STRUCTURE',
          metadata: { settlementId: 'settlement-123' },
        });
      });
      expect(mockToggleSelection).not.toHaveBeenCalled();
    });

    it('should call toggleSelection when structure clicked with Ctrl key', async () => {
      renderWithApollo(<MapPage />);

      // Simulate structure Ctrl+click
      if (mockOnEntitySelect) {
        mockOnEntitySelect(
          'structure',
          'structure-789',
          { ctrlKey: true, metaKey: false },
          { settlementId: 'settlement-123' }
        );
      }

      await waitFor(() => {
        expect(mockToggleSelection).toHaveBeenCalledWith({
          id: 'structure-789',
          type: 'STRUCTURE',
          metadata: { settlementId: 'settlement-123' },
        });
      });
      expect(mockSelectEntity).not.toHaveBeenCalled();
    });

    it('should pass onEntitySelect callback to Map component', () => {
      renderWithApollo(<MapPage />);

      // Verify the callback was captured
      expect(mockOnEntitySelect).toBeDefined();
      expect(typeof mockOnEntitySelect).toBe('function');
    });
  });
});
