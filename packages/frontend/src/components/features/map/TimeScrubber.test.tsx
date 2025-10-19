/**
 * Tests for TimeScrubber component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { TimeScrubber } from './TimeScrubber';

describe('TimeScrubber', () => {
  const mockCurrentTime = new Date('2024-10-19T12:00:00Z');
  const mockOnTimeChange = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render loading state', () => {
      render(
        <TimeScrubber
          currentTime={null}
          selectedTime={null}
          onTimeChange={mockOnTimeChange}
          loading={true}
        />
      );

      expect(screen.getByText('Loading world time...')).toBeInTheDocument();
    });

    it('should not render when currentTime is null and not loading', () => {
      const { container } = render(
        <TimeScrubber
          currentTime={null}
          selectedTime={null}
          onTimeChange={mockOnTimeChange}
          loading={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render time scrubber with current time', () => {
      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={mockCurrentTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      expect(screen.getByTestId('time-scrubber')).toBeInTheDocument();
      expect(screen.getByText('Time View')).toBeInTheDocument();
      expect(screen.getByLabelText('Time scrubber slider')).toBeInTheDocument();
      expect(screen.getByLabelText('Reset to current time')).toBeInTheDocument();
    });

    it('should show historical indicator when not at current time', () => {
      const historicalTime = new Date('2024-10-18T12:00:00Z');

      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={historicalTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      expect(screen.getByText('Viewing historical state')).toBeInTheDocument();
    });

    it('should not show historical indicator when at current time', () => {
      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={mockCurrentTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      expect(screen.queryByText('Viewing historical state')).not.toBeInTheDocument();
    });

    it('should show both viewing and current time when viewing historical state', () => {
      const historicalTime = new Date('2024-10-18T12:00:00Z');

      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={historicalTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      expect(screen.getByText(/Viewing:/)).toBeInTheDocument();
      expect(screen.getByText(/Current:/)).toBeInTheDocument();
    });
  });

  describe('Slider interaction', () => {
    it('should call onTimeChange when slider is moved', () => {
      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={mockCurrentTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      const slider = screen.getByLabelText('Time scrubber slider');

      // Move slider to 50% (middle of time range)
      // Note: Range inputs require fireEvent.change(), not user.type()
      fireEvent.change(slider, { target: { value: '50' } });

      // Should have called onTimeChange
      expect(mockOnTimeChange).toHaveBeenCalled();
    });

    it('should update slider value when selectedTime changes', () => {
      const { rerender } = render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={mockCurrentTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      const slider = screen.getByLabelText('Time scrubber slider') as HTMLInputElement;
      expect(slider.value).toBe('100'); // At current time = 100%

      // Change to historical time (50% back in the 1-year range)
      const historicalTime = new Date(mockCurrentTime.getTime() - (365 * 24 * 60 * 60 * 1000) / 2);

      rerender(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={historicalTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      // Slider should be around 50% (allowing for some floating point variance)
      const sliderValue = Number(slider.value);
      expect(sliderValue).toBeGreaterThan(45);
      expect(sliderValue).toBeLessThan(55);
    });
  });

  describe('Reset button', () => {
    it('should call onTimeChange with currentTime when reset button is clicked', async () => {
      const user = userEvent.setup();
      const historicalTime = new Date('2024-10-18T12:00:00Z');

      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={historicalTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      const resetButton = screen.getByLabelText('Reset to current time');
      await user.click(resetButton);

      expect(mockOnTimeChange).toHaveBeenCalledWith(mockCurrentTime);
    });

    it('should disable reset button when at current time', () => {
      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={mockCurrentTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      const resetButton = screen.getByLabelText('Reset to current time');
      expect(resetButton).toBeDisabled();
    });

    it('should enable reset button when viewing historical time', () => {
      const historicalTime = new Date('2024-10-18T12:00:00Z');

      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={historicalTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      const resetButton = screen.getByLabelText('Reset to current time');
      expect(resetButton).not.toBeDisabled();
    });
  });

  describe('Time display', () => {
    it('should format and display the selected time', () => {
      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={mockCurrentTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      // Check that the time is displayed (format will vary by locale, but should contain date parts)
      const timeDisplay = screen.getByText(/Viewing:/);
      expect(timeDisplay).toBeInTheDocument();
    });

    it('should handle null selectedTime gracefully', () => {
      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={null}
          onTimeChange={mockOnTimeChange}
        />
      );

      expect(screen.getByText(/N\/A/)).toBeInTheDocument();
    });
  });

  describe('Custom minTime', () => {
    it('should use custom minTime when provided', () => {
      const customMinTime = new Date('2024-01-01T00:00:00Z');

      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={mockCurrentTime}
          onTimeChange={mockOnTimeChange}
          minTime={customMinTime}
        />
      );

      const slider = screen.getByLabelText('Time scrubber slider');

      // Move slider to 0% (should be customMinTime)
      // Note: Range inputs require fireEvent.change(), not user.type()
      fireEvent.change(slider, { target: { value: '0' } });

      expect(mockOnTimeChange).toHaveBeenCalled();
      const calledTime = mockOnTimeChange.mock.calls[mockOnTimeChange.mock.calls.length - 1][0];

      // The called time should be close to customMinTime
      expect(Math.abs(calledTime.getTime() - customMinTime.getTime())).toBeLessThan(1000);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on slider', () => {
      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={mockCurrentTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      const slider = screen.getByLabelText('Time scrubber slider');
      expect(slider).toHaveAttribute('aria-valuemin', '0');
      expect(slider).toHaveAttribute('aria-valuemax', '100');
      expect(slider).toHaveAttribute('aria-valuenow');
    });

    it('should have proper ARIA label on reset button', () => {
      render(
        <TimeScrubber
          currentTime={mockCurrentTime}
          selectedTime={mockCurrentTime}
          onTimeChange={mockOnTimeChange}
        />
      );

      const resetButton = screen.getByLabelText('Reset to current time');
      expect(resetButton).toBeInTheDocument();
    });
  });
});
