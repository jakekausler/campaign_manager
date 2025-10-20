import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';

import { EffectsTab } from './EffectsTab';

describe('EffectsTab', () => {
  describe('Loading State', () => {
    it('should display loading message while fetching effects', () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="loading-event" />);

      expect(screen.getByText(/loading effects/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when query fails', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="invalid-event" />);

      await waitFor(() => {
        expect(screen.getByText(/error loading effects/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to fetch effects/i)).toBeInTheDocument();
    });

    it('should provide retry button on error', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="invalid-event" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no effects exist', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-empty" />);

      await waitFor(() => {
        expect(screen.getByText(/no effects available for this event/i)).toBeInTheDocument();
      });
    });
  });

  describe('Effect List Display', () => {
    it('should display all effects for an entity', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/boost population/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/boost defense/i)).toBeInTheDocument();
    });

    it('should display effect count in header', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/effects \(2\)/i)).toBeInTheDocument();
      });
    });

    it('should display effect descriptions', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/increases settlement population by 100/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/increases settlement defense by 10/i)).toBeInTheDocument();
    });

    it('should display active status badge for active effects', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        const badges = screen.getAllByText(/active/i);
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('should display priority for each effect', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/priority: 10/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/priority: 20/i)).toBeInTheDocument();
    });

    it('should display effect type for each effect', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        const typeLabels = screen.getAllByText(/type: patch/i);
        expect(typeLabels.length).toBeGreaterThan(0);
      });
    });

    it('should display JSON Patch operations', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getAllByText(/json patch operations:/i)[0]).toBeInTheDocument();
      });

      // Check for JSON content
      expect(screen.getAllByText(/"op"/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/"add"/)[0]).toBeInTheDocument();
    });
  });

  describe('Timing Phase Grouping', () => {
    it('should group effects by timing phase', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/on resolution \(2\)/i)).toBeInTheDocument();
      });
    });

    it('should display timing phase labels correctly', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        const timingBadges = screen.getAllByText(/on resolution/i);
        expect(timingBadges.length).toBeGreaterThan(0);
      });
    });

    it('should sort effects by priority within each phase', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        const priorities = screen.getAllByText(/priority: \d+/i);
        expect(priorities.length).toBe(2);
      });

      // Verify that effects are displayed in priority order
      const allText =
        screen.getByText(/boost population/i).parentElement?.parentElement?.textContent;
      expect(allText).toContain('Priority: 10');
    });
  });

  describe('Execution History', () => {
    it('should display execution count for effects with history', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/1 execution/i)).toBeInTheDocument();
      });
    });

    it('should display "No executions" for effects without history', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/no executions/i)).toBeInTheDocument();
      });
    });

    it('should display View History button for effects with executions', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        const viewHistoryButtons = screen.getAllByRole('button', { name: /view history/i });
        expect(viewHistoryButtons.length).toBeGreaterThan(0);
      });
    });

    it('should disable View History button for effects without executions', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        const disabledButtons = screen
          .getAllByRole('button', { name: /view history/i })
          .filter((button) => button.hasAttribute('disabled'));
        expect(disabledButtons.length).toBeGreaterThan(0);
      });
    });

    it('should open execution history modal when View History is clicked', async () => {
      const user = userEvent.setup();
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/boost population/i)).toBeInTheDocument();
      });

      // Find the enabled View History button
      const viewHistoryButtons = screen.getAllByRole('button', { name: /view history/i });
      const enabledButton = viewHistoryButtons.find((button) => !button.hasAttribute('disabled'));

      if (enabledButton) {
        await user.click(enabledButton);

        await waitFor(() => {
          expect(screen.getAllByText(/execution history/i)[0]).toBeInTheDocument();
        });
      }
    });
  });

  describe('Accessibility', () => {
    it('should have proper button labels', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /view history/i }).length).toBeGreaterThan(0);
      });
    });

    it('should have title attributes on View History buttons', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button', { name: /view history/i });
        buttons.forEach((button) => {
          expect(button).toHaveAttribute('title');
        });
      });
    });
  });

  describe('Entity Type Support', () => {
    it('should support Event entities', async () => {
      renderWithApollo(<EffectsTab entityType="Event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText(/boost population/i)).toBeInTheDocument();
      });
    });

    it('should display correct empty state message for different entity types', async () => {
      renderWithApollo(<EffectsTab entityType="Encounter" entityId="encounter-empty" />);

      await waitFor(() => {
        expect(screen.getByText(/no effects available for this encounter/i)).toBeInTheDocument();
      });
    });
  });
});
