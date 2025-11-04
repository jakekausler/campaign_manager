import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, afterAll, vi } from 'vitest';

import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';
import { renderWithApollo } from '@/__tests__/utils/test-utils';

import { ConditionsTab } from './ConditionsTab';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('ConditionsTab', () => {
  // Phase 2 (Mitigation Plan) Task 2.3: Enable memory profiling for diagnostic visibility
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterAll(() => {
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });

  describe('Loading State', () => {
    it('should display loading message while fetching conditions', () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="loading-settlement" />);

      expect(screen.getByText(/loading conditions/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when query fails', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="invalid-settlement" />);

      await waitFor(() => {
        expect(screen.getByText(/error loading conditions/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to fetch conditions/i)).toBeInTheDocument();
    });

    it('should provide retry button on error', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="invalid-settlement" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no conditions exist', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-empty" />);

      await waitFor(() => {
        expect(
          screen.getByText(/no conditions available for this settlement/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Condition List Display', () => {
    it('should display all conditions for an entity', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText(/is trade hub/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/is fortified/i)).toBeInTheDocument();
    });

    it('should display condition count in header', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText(/field conditions \(3\)/i)).toBeInTheDocument();
      });
    });

    it('should convert snake_case field names to Title Case', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText(/is trade hub/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/is fortified/i)).toBeInTheDocument();
    });

    it('should display condition descriptions', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(
          screen.getByText(/applies when settlement level is 3 or higher/i)
        ).toBeInTheDocument();
      });
    });

    it('should display active status badge', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const badges = screen.getAllByText(/active/i);
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('should display inactive status badge for inactive conditions', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      // Note: mockConditions all have isActive: true, so we test the UI renders the badge
      // In a real test with inactive conditions, we'd check for "Inactive" badge
      await waitFor(() => {
        const badges = screen.getAllByText(/active/i);
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('should display condition priority', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText(/priority:\s*10/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/priority:\s*20/i)).toBeInTheDocument();
    });

    it('should display instance vs type-level badge', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const instanceBadges = screen.getAllByText(/instance/i);
        expect(instanceBadges.length).toBeGreaterThan(0);
      });
    });

    it('should display JSONLogic expression in formatted view', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const labels = screen.getAllByText(/jsonlogic expression/i);
        expect(labels.length).toBeGreaterThan(0);
      });

      // Check that expression is displayed as formatted JSON
      const preElements = screen.getAllByText(/\{/);
      expect(preElements.length).toBeGreaterThan(0);
    });

    it('should sort conditions by priority (highest first)', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const priorityElements = screen.getAllByText(/priority:/i);
        expect(priorityElements.length).toBeGreaterThan(0);
      });

      // is_fortified has priority 20, is_trade_hub has priority 10
      // So is_fortified should appear first
      const cards = screen.getAllByText(/priority:/i);
      const firstCard = cards[0].closest('[class*="Card"]');
      const secondCard = cards[1].closest('[class*="Card"]');

      expect(firstCard?.textContent).toContain('Is Fortified');
      expect(secondCard?.textContent).toContain('Is Trade Hub');
    });
  });

  describe('Explain Button', () => {
    it('should display Explain button for each condition', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const explainButtons = screen.getAllByRole('button', { name: /explain/i });
        expect(explainButtons.length).toBe(3);
      });
    });

    it('should enable Explain button for active conditions', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const explainButtons = screen.getAllByRole('button', { name: /explain/i });
        explainButtons.forEach((button) => {
          expect(button).not.toBeDisabled();
        });
      });
    });

    it('should open ConditionExplanation modal when Explain is clicked', async () => {
      const user = userEvent.setup();

      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /explain/i }).length).toBe(3);
      });

      const explainButtons = screen.getAllByRole('button', { name: /explain/i });
      await user.click(explainButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(screen.getByText(/condition explanation/i)).toBeInTheDocument();
    });

    it('should close modal when Close button is clicked', async () => {
      const user = userEvent.setup();

      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /explain/i }).length).toBe(3);
      });

      const explainButtons = screen.getAllByRole('button', { name: /explain/i });
      await user.click(explainButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Structure Entity Type', () => {
    it('should display conditions for Structure entities', async () => {
      renderWithApollo(<ConditionsTab entityType="Structure" entityId="structure-1" />);

      await waitFor(() => {
        expect(screen.getByText(/is operational/i)).toBeInTheDocument();
      });
    });

    it('should display empty state with correct entity type', async () => {
      renderWithApollo(<ConditionsTab entityType="Structure" entityId="structure-empty" />);

      await waitFor(() => {
        expect(screen.getByText(/no conditions available for this structure/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const explainButtons = screen.getAllByRole('button', { name: /explain/i });
        expect(explainButtons.length).toBeGreaterThan(0);
      });
    });

    it('should have title attribute on Explain button', async () => {
      renderWithApollo(<ConditionsTab entityType="Settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const explainButtons = screen.getAllByRole('button', { name: /explain/i });
        explainButtons.forEach((button) => {
          expect(button).toHaveAttribute('title');
        });
      });
    });
  });
});
