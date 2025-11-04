import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach, afterAll } from 'vitest';

import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';

import { EncounterPanel } from './EncounterPanel';
import type { EncounterData } from './EncounterPanel';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('EncounterPanel', () => {
  // Phase 2 (Mitigation Plan) Task 2.3: Enable memory profiling for diagnostic visibility
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterAll(() => {
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });

  const mockEncounter: EncounterData = {
    id: 'encounter-1',
    name: 'Bandit Ambush',
    campaignId: 'campaign-1',
    locationId: 'location-1',
    description: 'A group of bandits attack the party on the road',
    difficulty: 3,
    scheduledAt: '2024-06-20T10:00:00.000Z',
    isResolved: true,
    resolvedAt: '2024-06-20T10:45:00.000Z',
    variables: {
      bandit_count: 5,
      loot_value: 250,
      party_victorious: true,
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    archivedAt: null,
  };

  describe('Encounter Attributes Section', () => {
    it('should render encounter attributes section header', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Encounter Attributes')).toBeInTheDocument();
    });

    it('should display campaign ID', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Campaign ID')).toBeInTheDocument();
      expect(screen.getByText('campaign-1')).toBeInTheDocument();
    });

    it('should display location ID when present', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Location ID')).toBeInTheDocument();
      expect(screen.getByText('location-1')).toBeInTheDocument();
    });

    it('should not display location ID when null', () => {
      const encounterNoLocation: EncounterData = {
        ...mockEncounter,
        locationId: null,
      };
      render(<EncounterPanel encounter={encounterNoLocation} />);
      expect(screen.queryByText('Location ID')).not.toBeInTheDocument();
    });

    it('should display description', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(
        screen.getByText('A group of bandits attack the party on the road')
      ).toBeInTheDocument();
    });

    it('should display "N/A" for null description', () => {
      const encounterNoDescription: EncounterData = {
        ...mockEncounter,
        description: null,
      };
      render(<EncounterPanel encounter={encounterNoDescription} />);
      expect(screen.getByText('Description')).toBeInTheDocument();
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should display difficulty', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Difficulty')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display "N/A" for null difficulty', () => {
      const encounterNoDifficulty: EncounterData = {
        ...mockEncounter,
        difficulty: null,
      };
      render(<EncounterPanel encounter={encounterNoDifficulty} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should handle difficulty of 0', () => {
      const encounterZeroDifficulty: EncounterData = {
        ...mockEncounter,
        difficulty: 0,
      };
      render(<EncounterPanel encounter={encounterZeroDifficulty} />);
      expect(screen.getByText('Difficulty')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display resolution status', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Is Resolved')).toBeInTheDocument();
      expect(screen.getByTestId('field-isResolved')).toHaveTextContent('true');
    });
  });

  describe('Resolution Information Section', () => {
    it('should render resolution information section header', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Resolution Information')).toBeInTheDocument();
    });

    it('should display formatted scheduledAt timestamp', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Scheduled At')).toBeInTheDocument();
      // Check for formatted date parts (locale-dependent, so we check for year at minimum)
      expect(screen.getByTestId('field-scheduledAt')).toHaveTextContent(/2024/);
    });

    it('should display formatted resolvedAt timestamp', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Resolved At')).toBeInTheDocument();
      // Check for formatted date parts (locale-dependent, so we check for year at minimum)
      const timeElements = screen.getAllByText(/2024/);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('should display "N/A" for null scheduledAt', () => {
      const encounterNoSchedule: EncounterData = {
        ...mockEncounter,
        scheduledAt: null,
      };
      render(<EncounterPanel encounter={encounterNoSchedule} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should display "N/A" for null resolvedAt', () => {
      const encounterNoResolved: EncounterData = {
        ...mockEncounter,
        resolvedAt: null,
      };
      render(<EncounterPanel encounter={encounterNoResolved} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should handle invalid timestamp gracefully', () => {
      const encounterInvalidTime: EncounterData = {
        ...mockEncounter,
        scheduledAt: 'invalid-date',
      };
      render(<EncounterPanel encounter={encounterInvalidTime} />);
      expect(screen.getByTestId('field-scheduledAt')).toHaveTextContent('invalid-date');
    });
  });

  describe('Typed Variables Section', () => {
    it('should render typed variables section header', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Typed Variables')).toBeInTheDocument();
    });

    it('should display number variables', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Bandit Count')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Loot Value')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
    });

    it('should display boolean variables', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Party Victorious')).toBeInTheDocument();
      // "true" appears in multiple places (encounter.isResolved and variable)
      const trueElements = screen.getAllByText('true');
      expect(trueElements.length).toBeGreaterThan(0);
    });

    it('should convert snake_case to Title Case', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Bandit Count')).toBeInTheDocument();
      expect(screen.getByText('Party Victorious')).toBeInTheDocument();
    });

    it('should display empty state when no variables exist', () => {
      const encounterNoVars: EncounterData = {
        ...mockEncounter,
        variables: {},
      };
      render(<EncounterPanel encounter={encounterNoVars} />);
      expect(
        screen.getByText('No typed variables available for this encounter')
      ).toBeInTheDocument();
    });

    it('should display empty state when variables is undefined', () => {
      const encounterNoVars: EncounterData = {
        ...mockEncounter,
        variables: undefined,
      };
      render(<EncounterPanel encounter={encounterNoVars} />);
      expect(
        screen.getByText('No typed variables available for this encounter')
      ).toBeInTheDocument();
    });

    it('should format object variables as JSON', () => {
      const encounterWithObject: EncounterData = {
        ...mockEncounter,
        variables: {
          enemies: {
            bandits: 3,
            archers: 2,
          },
        },
      };
      render(<EncounterPanel encounter={encounterWithObject} />);
      expect(screen.getByText('Enemies')).toBeInTheDocument();
      const jsonText = screen.getByText(/"bandits": 3/);
      expect(jsonText).toBeInTheDocument();
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy field value to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      render(<EncounterPanel encounter={mockEncounter} />);

      // Spy on clipboard AFTER render
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      expect(copyButtons.length).toBeGreaterThan(0);

      await user.click(copyButtons[0]); // Click first copy button (Campaign ID)

      // Wait for the clipboard API to be called
      await waitFor(
        () => {
          expect(writeTextSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
      expect(writeTextSpy).toHaveBeenCalledWith('campaign-1');

      writeTextSpy.mockRestore();
    });

    it('should show checkmark after successful copy', async () => {
      const user = userEvent.setup();
      render(<EncounterPanel encounter={mockEncounter} />);

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
        render(<EncounterPanel encounter={mockEncounter} />);

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
      render(<EncounterPanel encounter={mockEncounter} />);

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
      const encounterWithNull: EncounterData = {
        ...mockEncounter,
        variables: {
          empty_field: null,
        },
      };
      render(<EncounterPanel encounter={encounterWithNull} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should format undefined values as "N/A"', () => {
      const encounterWithUndefined: EncounterData = {
        ...mockEncounter,
        variables: {
          missing_field: undefined,
        },
      };
      render(<EncounterPanel encounter={encounterWithUndefined} />);
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should format boolean false correctly', () => {
      const encounterWithFalse: EncounterData = {
        ...mockEncounter,
        isResolved: false,
        variables: {
          is_active: false,
        },
      };
      render(<EncounterPanel encounter={encounterWithFalse} />);
      // Use getAllByText since "false" might appear in aria attributes
      const falseElements = screen.getAllByText('false');
      expect(falseElements.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all fields', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      expect(screen.getByText('Campaign ID')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Difficulty')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Is Resolved')).toHaveClass('text-xs', 'font-semibold');
    });

    it('should have title attribute on copy buttons', () => {
      render(<EncounterPanel encounter={mockEncounter} />);
      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      expect(copyButtons.length).toBeGreaterThan(0);
    });
  });
});
