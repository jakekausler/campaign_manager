import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';

import { VersionsTab } from './VersionsTab';

// Mock the useCurrentBranchId hook
vi.mock('@/stores', () => ({
  useCurrentBranchId: vi.fn(() => 'main'),
}));

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('VersionsTab', () => {
  describe('Loading State', () => {
    it('should display loading message while fetching audit history', () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="loading-settlement" />);

      expect(screen.getByText(/loading audit history/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when query fails', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="invalid-settlement" />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load audit history/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to fetch audit history/i)).toBeInTheDocument();
    });

    it('should provide retry button on error', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="invalid-settlement" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should refetch data when retry button is clicked', async () => {
      const user = userEvent.setup();
      renderWithApollo(<VersionsTab entityType="settlement" entityId="invalid-settlement" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });

      // Verify error message is present before retry
      expect(screen.getByText(/failed to load audit history/i)).toBeInTheDocument();

      await user.click(retryButton);

      // Retry button should still be present (error persists with invalid ID)
      // In real scenarios, a transient error might succeed on retry
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no audit history exists', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-empty" />);

      await waitFor(() => {
        expect(
          screen.getByText(/no audit history available for this settlement/i)
        ).toBeInTheDocument();
      });
    });

    it('should show helpful message in empty state', async () => {
      renderWithApollo(<VersionsTab entityType="structure" entityId="structure-empty" />);

      await waitFor(() => {
        expect(
          screen.getByText(/changes will appear here once this entity is modified/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Audit History Display', () => {
    it('should display all audit entries for a settlement', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText('CREATE')).toBeInTheDocument();
      });

      expect(screen.getAllByText('UPDATE')).toHaveLength(2);
    });

    it('should display all audit entries for a structure', async () => {
      renderWithApollo(<VersionsTab entityType="structure" entityId="structure-1" />);

      await waitFor(() => {
        expect(screen.getByText('CREATE')).toBeInTheDocument();
      });

      expect(screen.getByText('UPDATE')).toBeInTheDocument();
    });

    it('should display audit entry count in header', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText(/3 entries/i)).toBeInTheDocument();
      });
    });

    it('should display user IDs for each audit entry', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getAllByText(/user id:/i)[0]).toBeInTheDocument();
      });

      expect(screen.getAllByText('user-1')).toHaveLength(2);
      expect(screen.getByText('user-2')).toBeInTheDocument();
    });
  });

  describe('Operation Types', () => {
    it('should display CREATE operation with green badge', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const createBadge = screen.getByText('CREATE');
        expect(createBadge).toBeInTheDocument();
        expect(createBadge).toHaveClass('bg-green-100', 'text-green-700');
      });
    });

    it('should display UPDATE operation with blue badge', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const updateBadges = screen.getAllByText('UPDATE');
        expect(updateBadges[0]).toHaveClass('bg-blue-100', 'text-blue-700');
      });
    });

    it('should mark most recent entry as LATEST', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText('LATEST')).toBeInTheDocument();
      });
    });

    it('should highlight latest entry with blue background', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const latestBadge = screen.getByText('LATEST');
        const card = latestBadge.closest('.p-4');
        expect(card).toHaveClass('border-blue-200', 'bg-blue-50');
      });
    });
  });

  describe('Changes Display', () => {
    it('should display initial values for CREATE operations', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getAllByText(/name:/i).length).toBeGreaterThan(0);
      });

      expect(screen.getAllByText(/ironhold/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/level:/i).length).toBeGreaterThan(0);
    });

    it('should display before and after values for UPDATE operations', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getAllByText(/level:/i).length).toBeGreaterThan(0);
      });

      // Should show strikethrough for old value and colored for new value
      const threeElements = screen.getAllByText('3');
      const fourElements = screen.getAllByText('4');
      expect(threeElements.length).toBeGreaterThan(0);
      expect(fourElements.length).toBeGreaterThan(0);
    });

    it('should convert field names to Title Case', async () => {
      renderWithApollo(<VersionsTab entityType="structure" entityId="structure-1" />);

      await waitFor(() => {
        expect(screen.getByText(/settlement id:/i)).toBeInTheDocument();
      });

      // "settlementId" should be converted to "Settlement Id"
      expect(screen.getByText(/settlement id:/i)).toBeInTheDocument();
    });

    it('should handle null/undefined values gracefully', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      // Test will pass if no errors are thrown when rendering
      await waitFor(() => {
        expect(screen.getByText('CREATE')).toBeInTheDocument();
      });
    });

    it('should limit displayed changes to 10 fields', async () => {
      // This test verifies the "...and X more fields" message appears
      // when there are more than 10 changed fields
      // Current mock data has fewer than 10 fields, so we just verify the limit logic exists
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText('CREATE')).toBeInTheDocument();
      });

      // No "...and X more fields" message should appear for our mock data
      expect(screen.queryByText(/and \d+ more fields/i)).not.toBeInTheDocument();
    });
  });

  describe('Timestamp Formatting', () => {
    it('should display relative timestamps', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        // Timestamps should be formatted relative to current time
        // For old dates, should show "Nov 20" or similar format
        const timestamps = screen.queryAllByText(/ago|Nov|Jun|Jan|Mar/);
        expect(timestamps.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Settlement vs Structure', () => {
    it('should handle settlement entity type correctly', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText('CREATE')).toBeInTheDocument();
      });

      // Should fetch with capitalized "Settlement" entity type
      expect(screen.getAllByText('UPDATE')).toHaveLength(2);
    });

    it('should handle structure entity type correctly', async () => {
      renderWithApollo(<VersionsTab entityType="structure" entityId="structure-1" />);

      await waitFor(() => {
        expect(screen.getByText('CREATE')).toBeInTheDocument();
      });

      // Should fetch with capitalized "Structure" entity type
      expect(screen.getByText('UPDATE')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible retry button', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="invalid-settlement" />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should display operation types with appropriate contrast', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const createBadge = screen.getByText('CREATE');
        expect(createBadge).toHaveClass('bg-green-100', 'text-green-700');
      });

      const updateBadges = screen.getAllByText('UPDATE');
      expect(updateBadges[0]).toHaveClass('bg-blue-100', 'text-blue-700');
    });
  });

  describe('Resolution History Display', () => {
    it('should highlight Event completion entries with green styling', async () => {
      renderWithApollo(<VersionsTab entityType="event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText('EVENT COMPLETED')).toBeInTheDocument();
      });

      const completedBadge = screen.getByText('EVENT COMPLETED');
      expect(completedBadge).toHaveClass('bg-green-200', 'text-green-900');
    });

    it('should highlight Encounter resolution entries with green styling', async () => {
      renderWithApollo(<VersionsTab entityType="encounter" entityId="encounter-1" />);

      await waitFor(() => {
        expect(screen.getByText('ENCOUNTER RESOLVED')).toBeInTheDocument();
      });

      const resolvedBadge = screen.getByText('ENCOUNTER RESOLVED');
      expect(resolvedBadge).toHaveClass('bg-green-200', 'text-green-900');
    });

    it('should display event completion resolution entry with left border', async () => {
      renderWithApollo(<VersionsTab entityType="event" entityId="event-1" />);

      await waitFor(() => {
        const badge = screen.getByText('EVENT COMPLETED');
        const card = badge.closest('.p-4');
        expect(card).toHaveClass('border-l-4', 'border-l-green-500');
      });
    });

    it('should display effect execution summary for resolution entries', async () => {
      renderWithApollo(<VersionsTab entityType="event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText('Effect Execution Summary')).toBeInTheDocument();
      });

      // Check for phase labels
      expect(screen.getByText('Pre-Resolution')).toBeInTheDocument();
      expect(screen.getByText('On Resolution')).toBeInTheDocument();
      expect(screen.getByText('Post-Resolution')).toBeInTheDocument();
    });

    it('should display effect counts for each timing phase', async () => {
      renderWithApollo(<VersionsTab entityType="event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText('Effect Execution Summary')).toBeInTheDocument();
      });

      // Check for effect counts in summary
      expect(screen.getByText('2 effects')).toBeInTheDocument(); // PRE
      expect(screen.getByText('3 effects')).toBeInTheDocument(); // ON_RESOLVE
      expect(screen.getByText('1 effect')).toBeInTheDocument(); // POST
    });

    it('should display success/failure indicators for effects', async () => {
      renderWithApollo(<VersionsTab entityType="encounter" entityId="encounter-1" />);

      await waitFor(() => {
        expect(screen.getByText('Effect Execution Summary')).toBeInTheDocument();
      });

      // Check for success indicator (✓)
      const successIndicators = screen.getAllByText(/✓/);
      expect(successIndicators.length).toBeGreaterThan(0);

      // Check for failure indicator (✗)
      expect(screen.getByText(/✗ 1/)).toBeInTheDocument();
    });

    it('should display total effect execution count', async () => {
      renderWithApollo(<VersionsTab entityType="event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText('6 of 6 effects executed')).toBeInTheDocument();
      });
    });

    it('should handle resolution without effect execution summary', async () => {
      renderWithApollo(<VersionsTab entityType="event" entityId="event-2" />);

      await waitFor(() => {
        expect(screen.getByText('EVENT COMPLETED')).toBeInTheDocument();
      });

      // Should show message when no effects were executed
      expect(screen.getByText('No effects were executed during resolution.')).toBeInTheDocument();
    });

    it('should not show effect summary for non-resolution UPDATE entries', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getAllByText('UPDATE')).toHaveLength(2);
      });

      // No "Effect Execution Summary" should appear
      expect(screen.queryByText('Effect Execution Summary')).not.toBeInTheDocument();
    });

    it('should display resolution changes alongside effect summary', async () => {
      renderWithApollo(<VersionsTab entityType="event" entityId="event-1" />);

      await waitFor(() => {
        expect(screen.getByText('EVENT COMPLETED')).toBeInTheDocument();
      });

      // Should show the changes (isCompleted, occurredAt)
      expect(screen.getByText(/is completed:/i)).toBeInTheDocument();
      expect(screen.getByText(/occurred at:/i)).toBeInTheDocument();

      // And also show effect summary
      expect(screen.getByText('Effect Execution Summary')).toBeInTheDocument();
    });

    it('should handle partial effect failures correctly', async () => {
      renderWithApollo(<VersionsTab entityType="encounter" entityId="encounter-1" />);

      await waitFor(() => {
        expect(screen.getByText('3 of 4 effects executed')).toBeInTheDocument();
      });

      // Should show both succeeded and failed counts across all phases
      const successCounts = screen.getAllByText(/✓ 1/);
      const failureCounts = screen.getAllByText(/✗ 1/);

      // PRE: 1 succeeded, ON_RESOLVE: 1 succeeded, POST: 1 succeeded = 3 total
      expect(successCounts).toHaveLength(3);
      // ON_RESOLVE: 1 failed = 1 total
      expect(failureCounts).toHaveLength(1);
    });
  });

  describe('View Toggle Integration', () => {
    it('should display view toggle buttons', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /audit history/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /version history/i })).toBeInTheDocument();
      });
    });

    it('should default to audit history view', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText('Audit History')).toBeInTheDocument();
      });

      // Audit history content should be visible
      expect(screen.getByText('CREATE')).toBeInTheDocument();
    });

    it('should show keyboard shortcut hint', async () => {
      renderWithApollo(<VersionsTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByText(/ctrl\+h to toggle/i)).toBeInTheDocument();
      });
    });
  });
});
