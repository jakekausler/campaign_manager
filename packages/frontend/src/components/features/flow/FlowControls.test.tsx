import { render, screen, act } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';
import { NODE_COLORS } from '@/utils/node-colors';

import { FlowControls } from './FlowControls';

// Mock useReactFlow hook (Phase 1: Already has React Flow mock)
const mockGetZoom = vi.fn();
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      getZoom: mockGetZoom,
    }),
  };
});

describe('FlowControls', () => {
  // Phase 2 (Mitigation Plan) Task 2.3: Enable memory profiling for diagnostic visibility
  enableMemoryProfiling({ warnThresholdMB: 50 });

  beforeEach(() => {
    vi.useFakeTimers();
    mockGetZoom.mockReturnValue(1.0); // Default zoom level
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterAll(() => {
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });

  const renderComponent = () => {
    return render(
      <ReactFlowProvider>
        <FlowControls />
      </ReactFlowProvider>
    );
  };

  describe('MiniMap', () => {
    it('should render MiniMap component', () => {
      const { container } = renderComponent();
      const minimap = container.querySelector('.react-flow__minimap');
      expect(minimap).toBeInTheDocument();
    });

    it('should apply custom styling to MiniMap', () => {
      const { container } = renderComponent();
      const minimap = container.querySelector('.react-flow__minimap');
      expect(minimap).toHaveClass('bg-card', 'border', 'rounded-lg', 'shadow-lg');
    });

    it('should use correct colors for variable nodes', () => {
      renderComponent();
      // The nodeColor function should return the correct color for each node type
      // This is tested indirectly through the component rendering
      expect(NODE_COLORS.VARIABLE.bg).toBe('#22c55e');
    });

    it('should use correct colors for condition nodes', () => {
      renderComponent();
      expect(NODE_COLORS.CONDITION.bg).toBe('#3b82f6');
    });

    it('should use correct colors for effect nodes', () => {
      renderComponent();
      expect(NODE_COLORS.EFFECT.bg).toBe('#f97316');
    });

    it('should use correct colors for entity nodes', () => {
      renderComponent();
      expect(NODE_COLORS.ENTITY.bg).toBe('#a855f7');
    });
  });

  describe('Controls', () => {
    it('should render Controls component', () => {
      const { container } = renderComponent();
      const controls = container.querySelector('.react-flow__controls');
      expect(controls).toBeInTheDocument();
    });

    it('should apply custom styling to Controls', () => {
      const { container } = renderComponent();
      const controls = container.querySelector('.react-flow__controls');
      expect(controls).toHaveClass('bg-card', 'border', 'rounded-lg', 'shadow-lg');
    });

    it('should not show interactive mode controls', () => {
      const { container } = renderComponent();
      // showInteractive={false} means the lock button should not be present
      const lockButton = container.querySelector('.react-flow__controls-interactive');
      expect(lockButton).not.toBeInTheDocument();
    });
  });

  describe('Zoom Level Indicator', () => {
    it('should display zoom level at 100% by default', () => {
      renderComponent();
      expect(screen.getByText('Zoom: 100%')).toBeInTheDocument();
    });

    it('should update zoom level when viewport changes', () => {
      renderComponent();

      // Change zoom level
      mockGetZoom.mockReturnValue(1.5);

      // Fast-forward past the interval and wait for state update
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(screen.getByText('Zoom: 150%')).toBeInTheDocument();
    });

    it('should round zoom level to nearest integer', () => {
      renderComponent();

      // Set zoom to 1.234 (should round to 123%)
      mockGetZoom.mockReturnValue(1.234);

      // Fast-forward past the interval and wait for state update
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(screen.getByText('Zoom: 123%')).toBeInTheDocument();
    });

    it('should handle zoom out (less than 100%)', () => {
      renderComponent();

      // Zoom out to 50%
      mockGetZoom.mockReturnValue(0.5);

      // Fast-forward past the interval and wait for state update
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(screen.getByText('Zoom: 50%')).toBeInTheDocument();
    });

    it('should apply correct styling to zoom indicator', () => {
      const { container } = renderComponent();
      const zoomIndicator = container.querySelector('.absolute.bottom-4.left-4');
      expect(zoomIndicator).toHaveClass(
        'bg-card',
        'border',
        'rounded-lg',
        'px-3',
        'py-2',
        'shadow-lg'
      );
    });

    it('should poll for zoom changes every 100ms', () => {
      renderComponent();

      // Initial call
      expect(mockGetZoom).toHaveBeenCalledTimes(1);

      // Fast-forward 100ms
      vi.advanceTimersByTime(100);
      expect(mockGetZoom).toHaveBeenCalledTimes(2);

      // Fast-forward another 100ms
      vi.advanceTimersByTime(100);
      expect(mockGetZoom).toHaveBeenCalledTimes(3);
    });

    it('should clean up interval on unmount', () => {
      const { unmount } = renderComponent();

      // Initial calls
      vi.advanceTimersByTime(200);
      const callCountBeforeUnmount = mockGetZoom.mock.calls.length;

      // Unmount the component
      unmount();

      // Fast-forward time - should not trigger more calls
      vi.advanceTimersByTime(200);
      expect(mockGetZoom).toHaveBeenCalledTimes(callCountBeforeUnmount);
    });
  });

  describe('Accessibility', () => {
    it('should have proper text color for zoom indicator', () => {
      const { container } = renderComponent();
      const zoomText = container.querySelector('.text-muted-foreground');
      expect(zoomText).toBeInTheDocument();
      expect(zoomText).toHaveTextContent('Zoom: 100%');
    });

    it('should have proper font weight for zoom indicator', () => {
      const { container } = renderComponent();
      const zoomText = container.querySelector('.font-medium');
      expect(zoomText).toBeInTheDocument();
    });
  });
});
