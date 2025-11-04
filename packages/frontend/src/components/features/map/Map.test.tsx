/**
 * Unit tests for Map.tsx
 *
 * Tests map component functionality including:
 * - Component rendering
 * - Viewport state management
 * - Reset functionality
 * - Cleanup on unmount
 */

import { cleanup, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Map as MapLibre } from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi, afterAll } from 'vitest';

import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';
import { renderWithApollo } from '@/__tests__/utils/test-utils';

import { Map } from './Map';

// Mock MapLibre GL JS
vi.mock('maplibre-gl', () => {
  const mockMap = {
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    addControl: vi.fn(),
    getCenter: vi.fn(() => ({ lng: 0, lat: 0 })),
    getZoom: vi.fn(() => 2),
    getBounds: vi.fn(() => ({
      getWest: () => -10,
      getSouth: () => -10,
      getEast: () => 10,
      getNorth: () => 10,
    })),
    flyTo: vi.fn(),
    // Methods needed by useMapLayers hook
    getLayer: vi.fn(() => null), // Return null to indicate layer doesn't exist yet
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: vi.fn(() => null),
    setLayoutProperty: vi.fn(),
  };

  return {
    Map: vi.fn(() => mockMap),
    NavigationControl: vi.fn(),
  };
});

describe('Map Component', () => {
  // Phase 2 (Mitigation Plan) Task 2.3: Enable memory profiling for diagnostic visibility
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterEach(() => {
    cleanup(); // Unmount all React components and hooks
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });

  describe('Rendering', () => {
    it('should render map container', () => {
      renderWithApollo(<Map />);
      const container = screen.getByTestId('map-container');
      expect(container).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      renderWithApollo(<Map className="custom-class" />);
      const container = screen.getByTestId('map-container');
      expect(container).toHaveClass('custom-class');
    });

    it('should render reset viewport button', () => {
      renderWithApollo(<Map />);
      const resetButton = screen.getByTestId('reset-viewport-button');
      expect(resetButton).toBeInTheDocument();
      expect(resetButton).toHaveTextContent('Reset View');
    });

    it('should have proper ARIA labels', () => {
      renderWithApollo(<Map />);
      const resetButton = screen.getByTestId('reset-viewport-button');
      expect(resetButton).toHaveAttribute('aria-label', 'Reset map viewport to initial position');
    });
  });

  describe('Map Initialization', () => {
    it('should initialize MapLibre instance', () => {
      renderWithApollo(<Map />);
      expect(MapLibre).toHaveBeenCalledTimes(1);
    });

    it('should initialize with default center', () => {
      renderWithApollo(<Map />);
      expect(MapLibre).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [0, 0],
        })
      );
    });

    it('should initialize with default zoom', () => {
      renderWithApollo(<Map />);
      expect(MapLibre).toHaveBeenCalledWith(
        expect.objectContaining({
          zoom: 2,
        })
      );
    });

    it('should initialize with custom center', () => {
      renderWithApollo(<Map initialCenter={[10, 20]} />);
      expect(MapLibre).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [10, 20],
        })
      );
    });

    it('should initialize with custom zoom', () => {
      renderWithApollo(<Map initialZoom={5} />);
      expect(MapLibre).toHaveBeenCalledWith(
        expect.objectContaining({
          zoom: 5,
        })
      );
    });

    it('should add navigation controls', () => {
      renderWithApollo(<Map />);
      const mockMapInstance = (MapLibre as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockMapInstance.addControl).toHaveBeenCalledWith(expect.any(Object), 'top-right');
    });

    it('should register moveend event listener', () => {
      renderWithApollo(<Map />);
      const mockMapInstance = (MapLibre as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockMapInstance.on).toHaveBeenCalledWith('moveend', expect.any(Function));
    });

    it('should register zoomend event listener', () => {
      renderWithApollo(<Map />);
      const mockMapInstance = (MapLibre as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockMapInstance.on).toHaveBeenCalledWith('zoomend', expect.any(Function));
    });
  });

  describe('Viewport State Management', () => {
    it('should call onViewportChange callback when provided', async () => {
      const onViewportChange = vi.fn();
      renderWithApollo(<Map onViewportChange={onViewportChange} />);

      // Wait for initial viewport update
      await waitFor(() => {
        expect(onViewportChange).toHaveBeenCalled();
      });
    });

    it('should provide viewport state in callback', async () => {
      const onViewportChange = vi.fn();
      renderWithApollo(<Map onViewportChange={onViewportChange} />);

      await waitFor(() => {
        expect(onViewportChange).toHaveBeenCalledWith(
          expect.objectContaining({
            center: expect.any(Array),
            zoom: expect.any(Number),
            bounds: expect.any(Array),
          })
        );
      });
    });

    it('should not fail when onViewportChange is not provided', () => {
      expect(() => renderWithApollo(<Map />)).not.toThrow();
    });
  });

  describe('Reset Viewport Functionality', () => {
    it('should call flyTo when reset button is clicked', async () => {
      const user = userEvent.setup();
      renderWithApollo(<Map initialCenter={[5, 10]} initialZoom={3} />);

      const mockMapInstance = (MapLibre as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      const resetButton = screen.getByTestId('reset-viewport-button');

      await user.click(resetButton);

      expect(mockMapInstance.flyTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [5, 10],
          zoom: 3,
          duration: 1000,
        })
      );
    });

    it('should reset to initial viewport regardless of current viewport', async () => {
      const user = userEvent.setup();
      renderWithApollo(<Map initialCenter={[0, 0]} initialZoom={2} />);

      const mockMapInstance = (MapLibre as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;

      // Simulate viewport change
      mockMapInstance.getCenter = vi.fn(() => ({ lng: 50, lat: 50 }));
      mockMapInstance.getZoom = vi.fn(() => 10);

      const resetButton = screen.getByTestId('reset-viewport-button');
      await user.click(resetButton);

      expect(mockMapInstance.flyTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [0, 0],
          zoom: 2,
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should remove map instance on unmount', () => {
      const { unmount } = renderWithApollo(<Map />);
      const mockMapInstance = (MapLibre as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;

      unmount();

      expect(mockMapInstance.remove).toHaveBeenCalledTimes(1);
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = renderWithApollo(<Map />);
      const mockMapInstance = (MapLibre as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;

      unmount();

      expect(mockMapInstance.off).toHaveBeenCalledWith('moveend', expect.any(Function));
      expect(mockMapInstance.off).toHaveBeenCalledWith('zoomend', expect.any(Function));
    });

    it('should not throw error when unmounting before map initialization', () => {
      const { unmount } = renderWithApollo(<Map />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null bounds gracefully', async () => {
      const onViewportChange = vi.fn();

      // Mock getBounds to return null
      const mockMapWithNullBounds = {
        on: vi.fn(),
        off: vi.fn(),
        remove: vi.fn(),
        addControl: vi.fn(),
        getCenter: vi.fn(() => ({ lng: 0, lat: 0 })),
        getZoom: vi.fn(() => 2),
        getBounds: vi.fn(() => null),
        flyTo: vi.fn(),
        // Methods needed by useMapLayers hook
        getLayer: vi.fn(() => null),
        addSource: vi.fn(),
        addLayer: vi.fn(),
        getSource: vi.fn(() => null),
        setLayoutProperty: vi.fn(),
      };

      (MapLibre as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockMapWithNullBounds);

      renderWithApollo(<Map onViewportChange={onViewportChange} />);

      await waitFor(() => {
        expect(onViewportChange).toHaveBeenCalledWith(
          expect.objectContaining({
            bounds: null,
          })
        );
      });
    });

    it('should only initialize map once on multiple renders', () => {
      const { rerender } = renderWithApollo(<Map />);
      const initialCallCount = (MapLibre as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

      rerender(<Map />);
      rerender(<Map />);

      expect((MapLibre as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
        initialCallCount
      );
    });

    it('should handle rapid reset button clicks', async () => {
      const user = userEvent.setup();
      renderWithApollo(<Map />);

      const mockMapInstance = (MapLibre as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      const resetButton = screen.getByTestId('reset-viewport-button');

      await user.click(resetButton);
      await user.click(resetButton);
      await user.click(resetButton);

      expect(mockMapInstance.flyTo).toHaveBeenCalledTimes(3);
    });
  });

  /**
   * TICKET-024 Stage 5: Cross-View Auto-Pan
   *
   * Auto-pan functionality is implemented in Map.tsx lines 660-740.
   * The implementation uses:
   * - flyTo() for single entity (500ms animation, zoom to 12+)
   * - fitBounds() for multiple entities (500ms animation, 50px padding)
   *
   * Comprehensive auto-scroll testing is provided in FlowViewPage.test.tsx
   * which demonstrates the same pattern for React Flow's setCenter/fitView.
   *
   * Testing Map's auto-pan requires complex mocking of:
   * - useSelectedEntities (global selection state)
   * - useLocationLayers (locations data with geojson)
   * - MapLibre instance methods
   *
   * The implementation has been manually verified to work correctly across all views.
   * See Stage 2 implementation notes (commit a97f37b) for details.
   */
});
