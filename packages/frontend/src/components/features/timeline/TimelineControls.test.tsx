import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { TimelineHandle } from './Timeline';
import { TimelineControls } from './TimelineControls';

describe('TimelineControls', () => {
  let mockTimelineRef: React.RefObject<TimelineHandle>;

  beforeEach(() => {
    // Create a mock timeline handle with spy functions
    const mockHandle: TimelineHandle = {
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      fit: vi.fn(),
      moveTo: vi.fn(),
      setSelection: vi.fn(),
      getSelection: vi.fn(() => []),
    };

    mockTimelineRef = createRef<TimelineHandle>();
    // Manually set the current property since createRef doesn't support assignment
    (mockTimelineRef as { current: TimelineHandle | null }).current = mockHandle;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all control buttons without current time', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fit all items/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /jump to/i })).not.toBeInTheDocument();
    });

    it('should render jump to current time button when currentTime is provided', () => {
      const currentTime = new Date('2024-01-15T12:00:00Z');
      render(<TimelineControls timelineRef={mockTimelineRef} currentTime={currentTime} />);

      expect(
        screen.getByRole('button', { name: /jump to current world time/i })
      ).toBeInTheDocument();
    });

    it('should not render jump button when currentTime is null', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} currentTime={null} />);

      expect(screen.queryByRole('button', { name: /jump to/i })).not.toBeInTheDocument();
    });

    it('should render keyboard shortcut hints', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      // Shortcut text is visible on larger screens
      expect(screen.getByText(/Shortcuts:/)).toBeInTheDocument();
    });
  });

  describe('Button Interactions', () => {
    it('should call zoomIn when zoom in button is clicked', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      fireEvent.click(zoomInButton);

      expect(mockTimelineRef.current?.zoomIn).toHaveBeenCalledTimes(1);
    });

    it('should call zoomOut when zoom out button is clicked', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      fireEvent.click(zoomOutButton);

      expect(mockTimelineRef.current?.zoomOut).toHaveBeenCalledTimes(1);
    });

    it('should call fit when fit view button is clicked', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      const fitButton = screen.getByRole('button', { name: /fit all items/i });
      fireEvent.click(fitButton);

      expect(mockTimelineRef.current?.fit).toHaveBeenCalledTimes(1);
    });

    it('should call moveTo with currentTime when jump button is clicked', () => {
      const currentTime = new Date('2024-01-15T12:00:00Z');
      render(<TimelineControls timelineRef={mockTimelineRef} currentTime={currentTime} />);

      const jumpButton = screen.getByRole('button', { name: /jump to current world time/i });
      fireEvent.click(jumpButton);

      expect(mockTimelineRef.current?.moveTo).toHaveBeenCalledTimes(1);
      expect(mockTimelineRef.current?.moveTo).toHaveBeenCalledWith(currentTime);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should zoom in on + key press', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      fireEvent.keyDown(window, { key: '+' });

      expect(mockTimelineRef.current?.zoomIn).toHaveBeenCalledTimes(1);
    });

    it('should zoom in on = key press', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      fireEvent.keyDown(window, { key: '=' });

      expect(mockTimelineRef.current?.zoomIn).toHaveBeenCalledTimes(1);
    });

    it('should zoom out on - key press', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      fireEvent.keyDown(window, { key: '-' });

      expect(mockTimelineRef.current?.zoomOut).toHaveBeenCalledTimes(1);
    });

    it('should zoom out on _ key press', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      fireEvent.keyDown(window, { key: '_' });

      expect(mockTimelineRef.current?.zoomOut).toHaveBeenCalledTimes(1);
    });

    it('should fit view on 0 key press', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      fireEvent.keyDown(window, { key: '0' });

      expect(mockTimelineRef.current?.fit).toHaveBeenCalledTimes(1);
    });

    it('should jump to current time on t key press when currentTime is provided', () => {
      const currentTime = new Date('2024-01-15T12:00:00Z');
      render(<TimelineControls timelineRef={mockTimelineRef} currentTime={currentTime} />);

      fireEvent.keyDown(window, { key: 't' });

      expect(mockTimelineRef.current?.moveTo).toHaveBeenCalledTimes(1);
      expect(mockTimelineRef.current?.moveTo).toHaveBeenCalledWith(currentTime);
    });

    it('should jump to current time on T key press when currentTime is provided', () => {
      const currentTime = new Date('2024-01-15T12:00:00Z');
      render(<TimelineControls timelineRef={mockTimelineRef} currentTime={currentTime} />);

      fireEvent.keyDown(window, { key: 'T' });

      expect(mockTimelineRef.current?.moveTo).toHaveBeenCalledTimes(1);
      expect(mockTimelineRef.current?.moveTo).toHaveBeenCalledWith(currentTime);
    });

    it('should not jump to current time on t key press when currentTime is not provided', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      fireEvent.keyDown(window, { key: 't' });

      expect(mockTimelineRef.current?.moveTo).not.toHaveBeenCalled();
    });

    it('should not respond to keyboard shortcuts when typing in an input field', () => {
      render(
        <div>
          <input type="text" data-testid="text-input" />
          <TimelineControls timelineRef={mockTimelineRef} />
        </div>
      );

      const input = screen.getByTestId('text-input');
      input.focus();

      // Try keyboard shortcuts while focused on input
      fireEvent.keyDown(input, { key: '+' });
      fireEvent.keyDown(input, { key: '-' });
      fireEvent.keyDown(input, { key: '0' });

      // None of the timeline methods should be called
      expect(mockTimelineRef.current?.zoomIn).not.toHaveBeenCalled();
      expect(mockTimelineRef.current?.zoomOut).not.toHaveBeenCalled();
      expect(mockTimelineRef.current?.fit).not.toHaveBeenCalled();
    });

    it('should not respond to keyboard shortcuts when typing in a textarea', () => {
      render(
        <div>
          <textarea data-testid="textarea" />
          <TimelineControls timelineRef={mockTimelineRef} />
        </div>
      );

      const textarea = screen.getByTestId('textarea');
      textarea.focus();

      // Try keyboard shortcuts while focused on textarea
      fireEvent.keyDown(textarea, { key: '+' });
      fireEvent.keyDown(textarea, { key: '-' });
      fireEvent.keyDown(textarea, { key: '0' });

      // None of the timeline methods should be called
      expect(mockTimelineRef.current?.zoomIn).not.toHaveBeenCalled();
      expect(mockTimelineRef.current?.zoomOut).not.toHaveBeenCalled();
      expect(mockTimelineRef.current?.fit).not.toHaveBeenCalled();
    });

    it('should prevent default browser behavior for shortcut keys', () => {
      render(<TimelineControls timelineRef={mockTimelineRef} />);

      const plusEvent = new KeyboardEvent('keydown', { key: '+' });
      const preventDefaultSpy = vi.spyOn(plusEvent, 'preventDefault');

      window.dispatchEvent(plusEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels on all buttons', () => {
      const currentTime = new Date('2024-01-15T12:00:00Z');
      render(<TimelineControls timelineRef={mockTimelineRef} currentTime={currentTime} />);

      expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fit all items in view' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Jump to current world time' })
      ).toBeInTheDocument();
    });

    it('should have title attributes for tooltips', () => {
      const currentTime = new Date('2024-01-15T12:00:00Z');
      render(<TimelineControls timelineRef={mockTimelineRef} currentTime={currentTime} />);

      const zoomInButton = screen.getByRole('button', { name: 'Zoom in' });
      expect(zoomInButton).toHaveAttribute('title', 'Zoom in (+)');

      const zoomOutButton = screen.getByRole('button', { name: 'Zoom out' });
      expect(zoomOutButton).toHaveAttribute('title', 'Zoom out (-)');

      const fitButton = screen.getByRole('button', { name: 'Fit all items in view' });
      expect(fitButton).toHaveAttribute('title', 'Fit all items (0)');

      const jumpButton = screen.getByRole('button', { name: 'Jump to current world time' });
      expect(jumpButton).toHaveAttribute('title', 'Jump to current time (T)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null timeline ref gracefully', () => {
      const nullRef = createRef<TimelineHandle>();
      render(<TimelineControls timelineRef={nullRef} />);

      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });

      // Should not throw error when clicking
      expect(() => fireEvent.click(zoomInButton)).not.toThrow();
    });

    it('should handle unmounting during keyboard event', () => {
      const { unmount } = render(<TimelineControls timelineRef={mockTimelineRef} />);

      unmount();

      // Should not throw error after unmounting
      expect(() => fireEvent.keyDown(window, { key: '+' })).not.toThrow();
    });

    it('should apply custom className when provided', () => {
      const { container } = render(
        <TimelineControls timelineRef={mockTimelineRef} className="custom-controls" />
      );

      const controlsDiv = container.querySelector('.timeline-controls');
      expect(controlsDiv).toHaveClass('custom-controls');
    });
  });
});
