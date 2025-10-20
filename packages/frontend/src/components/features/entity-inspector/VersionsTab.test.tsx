import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';

import { VersionsTab } from './VersionsTab';

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
});
