import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EventPanel } from './EventPanel';
import type { EventData } from './EventPanel';

describe('EventPanel', () => {
  const mockEvent: EventData = {
    id: 'event-1',
    name: 'The Great Festival',
    campaignId: 'campaign-1',
    locationId: 'location-1',
    description: 'A grand celebration in the capital city',
    eventType: 'STORY',
    scheduledAt: '2024-06-15T14:00:00.000Z',
    occurredAt: '2024-06-15T14:30:00.000Z',
    isCompleted: true,
    variables: {
      attendance: 500,
      weather: 'sunny',
      requires_preparation: true,
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    archivedAt: null,
  };

  describe('Event Attributes Section', () => {
    it('should render event attributes section header', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Event Attributes')).toBeInTheDocument();
    });

    it('should display event type', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Event Type')).toBeInTheDocument();
      expect(screen.getByText('STORY')).toBeInTheDocument();
    });

    it('should display campaign ID', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Campaign ID')).toBeInTheDocument();
      expect(screen.getByText('campaign-1')).toBeInTheDocument();
    });

    it('should display location ID when present', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Location ID')).toBeInTheDocument();
      expect(screen.getByText('location-1')).toBeInTheDocument();
    });

    it('should not display location ID when null', () => {
      const eventNoLocation: EventData = {
        ...mockEvent,
        locationId: null,
      };
      render(<EventPanel event={eventNoLocation} />);
      expect(screen.queryByText('Location ID')).not.toBeInTheDocument();
    });

    it('should display description', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('A grand celebration in the capital city')).toBeInTheDocument();
    });

    it('should display "N/A" for null description', () => {
      const eventNoDescription: EventData = {
        ...mockEvent,
        description: null,
      };
      render(<EventPanel event={eventNoDescription} />);
      expect(screen.getByText('Description')).toBeInTheDocument();
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should display completion status', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Is Completed')).toBeInTheDocument();
      expect(screen.getByTestId('field-isCompleted')).toHaveTextContent('true');
    });
  });

  describe('Scheduling Information Section', () => {
    it('should render scheduling information section header', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Scheduling Information')).toBeInTheDocument();
    });

    it('should display formatted scheduledAt timestamp', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Scheduled At')).toBeInTheDocument();
      // Check for formatted date parts (locale-dependent, so we check for year at minimum)
      expect(screen.getByTestId('field-scheduledAt')).toHaveTextContent(/2024/);
    });

    it('should display formatted occurredAt timestamp', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Occurred At')).toBeInTheDocument();
      // Check for formatted date parts (locale-dependent, so we check for year at minimum)
      const timeElements = screen.getAllByText(/2024/);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('should display "N/A" for null scheduledAt', () => {
      const eventNoSchedule: EventData = {
        ...mockEvent,
        scheduledAt: null,
      };
      render(<EventPanel event={eventNoSchedule} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should display "N/A" for null occurredAt', () => {
      const eventNoOccurred: EventData = {
        ...mockEvent,
        occurredAt: null,
      };
      render(<EventPanel event={eventNoOccurred} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should handle invalid timestamp gracefully', () => {
      const eventInvalidTime: EventData = {
        ...mockEvent,
        scheduledAt: 'invalid-date',
      };
      render(<EventPanel event={eventInvalidTime} />);
      expect(screen.getByTestId('field-scheduledAt')).toHaveTextContent('invalid-date');
    });
  });

  describe('Typed Variables Section', () => {
    it('should render typed variables section header', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Typed Variables')).toBeInTheDocument();
    });

    it('should display number variables', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Attendance')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('should display string variables', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Weather')).toBeInTheDocument();
      expect(screen.getByText('sunny')).toBeInTheDocument();
    });

    it('should display boolean variables', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Requires Preparation')).toBeInTheDocument();
      // "true" appears in multiple places (event.isCompleted and variable)
      const trueElements = screen.getAllByText('true');
      expect(trueElements.length).toBeGreaterThan(0);
    });

    it('should convert snake_case to Title Case', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Requires Preparation')).toBeInTheDocument();
    });

    it('should display empty state when no variables exist', () => {
      const eventNoVars: EventData = {
        ...mockEvent,
        variables: {},
      };
      render(<EventPanel event={eventNoVars} />);
      expect(screen.getByText('No typed variables available for this event')).toBeInTheDocument();
    });

    it('should display empty state when variables is undefined', () => {
      const eventNoVars: EventData = {
        ...mockEvent,
        variables: undefined,
      };
      render(<EventPanel event={eventNoVars} />);
      expect(screen.getByText('No typed variables available for this event')).toBeInTheDocument();
    });

    it('should format object variables as JSON', () => {
      const eventWithObject: EventData = {
        ...mockEvent,
        variables: {
          participants: {
            nobles: 25,
            commoners: 475,
          },
        },
      };
      render(<EventPanel event={eventWithObject} />);
      expect(screen.getByText('Participants')).toBeInTheDocument();
      const jsonText = screen.getByText(/"nobles": 25/);
      expect(jsonText).toBeInTheDocument();
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy field value to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      render(<EventPanel event={mockEvent} />);

      // Spy on clipboard AFTER render
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      expect(copyButtons.length).toBeGreaterThan(0);

      await user.click(copyButtons[0]); // Click first copy button (Event Type)

      // Wait for the clipboard API to be called
      await waitFor(
        () => {
          expect(writeTextSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
      expect(writeTextSpy).toHaveBeenCalledWith('STORY');

      writeTextSpy.mockRestore();
    });

    it('should show checkmark after successful copy', async () => {
      const user = userEvent.setup();
      render(<EventPanel event={mockEvent} />);

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      await user.click(copyButtons[0]);

      await waitFor(
        () => {
          expect(screen.getByText('✓')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it('should reset checkmark after 2 seconds', async () => {
      vi.useFakeTimers();
      try {
        render(<EventPanel event={mockEvent} />);

        const copyButtons = screen.getAllByTitle('Copy to clipboard');
        // Use fireEvent instead of userEvent with fake timers
        fireEvent.click(copyButtons[0]);

        // Wait for async state update
        await vi.waitFor(() => {
          expect(screen.getByText('✓')).toBeInTheDocument();
        });

        // Fast-forward 2 seconds and flush effects
        act(() => {
          vi.advanceTimersByTime(2000);
        });

        // Checkmark should be gone
        expect(screen.queryByText('✓')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should handle clipboard errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<EventPanel event={mockEvent} />);

      // Mock clipboard to reject AFTER render
      const writeTextSpy = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockRejectedValueOnce(new Error('Clipboard error'));

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      await user.click(copyButtons[0]);

      await waitFor(
        () => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to copy to clipboard:',
            expect.any(Error)
          );
        },
        { timeout: 1000 }
      );

      writeTextSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Value Formatting', () => {
    it('should format null values as "N/A"', () => {
      const eventWithNull: EventData = {
        ...mockEvent,
        variables: {
          empty_field: null,
        },
      };
      render(<EventPanel event={eventWithNull} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should format undefined values as "N/A"', () => {
      const eventWithUndefined: EventData = {
        ...mockEvent,
        variables: {
          missing_field: undefined,
        },
      };
      render(<EventPanel event={eventWithUndefined} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should format boolean false correctly', () => {
      const eventWithFalse: EventData = {
        ...mockEvent,
        isCompleted: false,
        variables: {
          is_active: false,
        },
      };
      render(<EventPanel event={eventWithFalse} />);
      // Use getAllByText since "false" might appear in aria attributes
      const falseElements = screen.getAllByText('false');
      expect(falseElements.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all fields', () => {
      render(<EventPanel event={mockEvent} />);
      expect(screen.getByText('Event Type')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Campaign ID')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Is Completed')).toHaveClass('text-xs', 'font-semibold');
    });

    it('should have title attribute on copy buttons', () => {
      render(<EventPanel event={mockEvent} />);
      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      expect(copyButtons.length).toBeGreaterThan(0);
    });
  });
});
