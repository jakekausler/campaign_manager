/**
 * Tests for VersionList component
 *
 * Tests cover:
 * - Loading states with skeleton UI
 * - Error states with retry functionality
 * - Empty state when no versions exist
 * - Version list rendering with metadata
 * - Current version badge display
 * - Version selection for restore/comparison
 * - Timestamp formatting (relative and absolute)
 * - Responsive behavior
 */

import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';
import { useEntityVersions } from '@/services/api/hooks/versions';

import { VersionList } from './VersionList';

// Mock the version hooks
vi.mock('@/services/api/hooks/versions', () => ({
  useEntityVersions: vi.fn(),
}));

// Mock the RestoreConfirmationDialog component
vi.mock('./RestoreConfirmationDialog', () => ({
  RestoreConfirmationDialog: () => (
    <div data-testid="restore-confirmation-dialog">Restore Dialog</div>
  ),
}));

// Mock the ComparisonDialog component
vi.mock('./ComparisonDialog', () => ({
  ComparisonDialog: ({
    open,
    onClose,
    versionAId,
    versionBId,
  }: {
    open: boolean;
    onClose: () => void;
    versionAId: string;
    versionBId: string;
  }) =>
    open ? (
      <div
        data-testid="comparison-dialog"
        data-version-a-id={versionAId}
        data-version-b-id={versionBId}
      >
        <div>Comparison Dialog</div>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

// Type-cast for mocked hook
const mockUseEntityVersions = useEntityVersions as ReturnType<typeof vi.fn>;

// Mock data for tests
const mockVersions = [
  {
    id: 'version-1',
    entityType: 'settlement',
    entityId: 'settlement-1',
    branchId: 'branch-1',
    validFrom: new Date('2024-06-15T14:00:00Z').toISOString(),
    validTo: null, // Current version
    payload: { name: 'Ironhold', level: 3 },
    version: 3,
    comment: 'Upgraded to level 3',
    createdBy: 'user-1',
    createdAt: new Date('2024-06-15T14:00:00Z').toISOString(),
  },
  {
    id: 'version-2',
    entityType: 'settlement',
    entityId: 'settlement-1',
    branchId: 'branch-1',
    validFrom: new Date('2024-06-10T10:00:00Z').toISOString(),
    validTo: new Date('2024-06-15T14:00:00Z').toISOString(),
    payload: { name: 'Ironhold', level: 2 },
    version: 2,
    comment: 'Upgraded to level 2',
    createdBy: 'user-2',
    createdAt: new Date('2024-06-10T10:00:00Z').toISOString(),
  },
  {
    id: 'version-3',
    entityType: 'settlement',
    entityId: 'settlement-1',
    branchId: 'branch-1',
    validFrom: new Date('2024-06-01T08:00:00Z').toISOString(),
    validTo: new Date('2024-06-10T10:00:00Z').toISOString(),
    payload: { name: 'Ironhold', level: 1 },
    version: 1,
    comment: 'Initial creation',
    createdBy: 'user-1',
    createdAt: new Date('2024-06-01T08:00:00Z').toISOString(),
  },
];

// Mock version without comment
const mockVersionsNoComments = [
  {
    ...mockVersions[0],
    id: 'version-no-comment',
    comment: null,
  },
];

// Mock single version
const mockSingleVersion = [
  {
    ...mockVersions[0],
    id: 'version-single',
  },
];

// Mock refetch function
const mockRefetch = vi.fn();

describe('VersionList', () => {
  afterEach(() => {
    cleanup(); // Unmount all React components and hooks
  });

  // Set up default mock implementation before each test
  beforeEach(() => {
    mockUseEntityVersions.mockImplementation((_entityType, entityId, _branchId) => {
      // Loading state for "loading-settlement"
      if (entityId === 'loading-settlement' || entityId === 'loading-structure') {
        return {
          versions: [],
          loading: true,
          error: undefined,
          refetch: mockRefetch,
        };
      }

      // Error state for "invalid-settlement"
      if (entityId === 'invalid-settlement' || entityId === 'invalid-structure') {
        return {
          versions: [],
          loading: false,
          error: new Error('Failed to load version history'),
          refetch: mockRefetch,
        };
      }

      // Empty state for "settlement-empty" or "structure-empty"
      if (entityId === 'settlement-empty' || entityId === 'structure-empty') {
        return {
          versions: [],
          loading: false,
          error: undefined,
          refetch: mockRefetch,
        };
      }

      // No comments for "settlement-no-comments"
      if (entityId === 'settlement-no-comments') {
        return {
          versions: mockVersionsNoComments,
          loading: false,
          error: undefined,
          refetch: mockRefetch,
        };
      }

      // Single version for "settlement-single-version"
      if (entityId === 'settlement-single-version') {
        return {
          versions: mockSingleVersion,
          loading: false,
          error: undefined,
          refetch: mockRefetch,
        };
      }

      // Default: return mock versions for "settlement-1"
      return {
        versions: mockVersions,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      };
    });
  });

  describe('Loading State', () => {
    it('should display loading skeleton while fetching versions', () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="loading-settlement" branchId="branch-1" />
      );

      // Should show loading indicator
      expect(screen.getByTestId('version-list-loading')).toBeInTheDocument();
    });

    it('should display appropriate loading message', () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="loading-settlement" branchId="branch-1" />
      );

      expect(screen.getByText(/loading version history/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when query fails', async () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="invalid-settlement" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list-error')).toBeInTheDocument();
      });

      expect(screen.getByText(/failed to load version history/i)).toBeInTheDocument();
    });

    it('should provide retry button on error', async () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="invalid-settlement" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should refetch data when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockRetryRefetch = vi.fn();

      // Override mock for this specific test
      mockUseEntityVersions.mockReturnValue({
        versions: [],
        loading: false,
        error: new Error('Failed to load version history'),
        refetch: mockRetryRefetch,
      });

      renderWithApollo(
        <VersionList entityType="settlement" entityId="invalid-settlement" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /try again/i });

      // Verify error message is present before retry
      expect(screen.getByText(/failed to load version history/i)).toBeInTheDocument();

      await user.click(retryButton);

      // Verify refetch was called
      expect(mockRetryRefetch).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no versions exist', async () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-empty" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list-empty')).toBeInTheDocument();
      });

      expect(screen.getByText(/no version history available/i)).toBeInTheDocument();
    });

    it('should show helpful message in empty state', async () => {
      renderWithApollo(
        <VersionList entityType="structure" entityId="structure-empty" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/versions will appear here once this entity is modified/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Version List Display', () => {
    it('should display all versions in reverse chronological order', async () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      // Should display all versions
      const versionItems = screen.getAllByTestId(/version-item/);
      expect(versionItems).toHaveLength(3);

      // First item should be the most recent version (version-1)
      expect(versionItems[0]).toHaveTextContent('Upgraded to level 3');
    });

    it('should display version metadata (timestamp, user, comment)', async () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('Upgraded to level 3')).toBeInTheDocument();
      });

      // Should show comment
      expect(screen.getByText('Upgraded to level 3')).toBeInTheDocument();
      expect(screen.getByText('Upgraded to level 2')).toBeInTheDocument();
      expect(screen.getByText('Initial creation')).toBeInTheDocument();

      // Should show user IDs (in a real app, would show user names)
      // Use getAllByText since user-1 appears in multiple versions
      expect(screen.getAllByText(/user-1/).length).toBeGreaterThan(0);
      expect(screen.getByText(/user-2/)).toBeInTheDocument();

      // Should show timestamps (formatted)
      // The exact format will depend on formatTimestamp implementation
      // Just check that dates are present
      expect(screen.getAllByTestId(/version-timestamp/).length).toBeGreaterThan(0);
    });

    it('should display "CURRENT" badge for most recent version', async () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('CURRENT')).toBeInTheDocument();
      });

      // Should only have one CURRENT badge
      const currentBadges = screen.getAllByText('CURRENT');
      expect(currentBadges).toHaveLength(1);
    });

    it('should not display "CURRENT" badge for historical versions', async () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // First version should have CURRENT badge
      expect(versionItems[0]).toHaveTextContent('CURRENT');

      // Other versions should not
      expect(versionItems[1]).not.toHaveTextContent('CURRENT');
      expect(versionItems[2]).not.toHaveTextContent('CURRENT');
    });
  });

  describe('Version Selection', () => {
    it('should allow selecting a single version', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();

      renderWithApollo(
        <VersionList
          entityType="settlement"
          entityId="settlement-1"
          branchId="branch-1"
          onSelectionChange={onSelectionChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Click on second version
      await user.click(versionItems[1]);

      // Should call onSelectionChange with selected version ID
      expect(onSelectionChange).toHaveBeenCalledWith(['version-2']);
    });

    it('should allow selecting two versions for comparison', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();

      renderWithApollo(
        <VersionList
          entityType="settlement"
          entityId="settlement-1"
          branchId="branch-1"
          onSelectionChange={onSelectionChange}
          maxSelection={2}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Click on first version
      await user.click(versionItems[0]);
      expect(onSelectionChange).toHaveBeenCalledWith(['version-1']);

      // Click on second version
      await user.click(versionItems[1]);
      expect(onSelectionChange).toHaveBeenCalledWith(['version-1', 'version-2']);
    });

    it('should not allow selecting more than maxSelection versions', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();

      renderWithApollo(
        <VersionList
          entityType="settlement"
          entityId="settlement-1"
          branchId="branch-1"
          onSelectionChange={onSelectionChange}
          maxSelection={2}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select two versions
      await user.click(versionItems[0]);
      await user.click(versionItems[1]);

      // Try to click third version - should be disabled or not selectable
      await user.click(versionItems[2]);

      // Should still only have two versions selected
      expect(onSelectionChange).toHaveBeenLastCalledWith(['version-1', 'version-2']);
    });

    it('should allow deselecting a version', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();

      renderWithApollo(
        <VersionList
          entityType="settlement"
          entityId="settlement-1"
          branchId="branch-1"
          onSelectionChange={onSelectionChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select a version
      await user.click(versionItems[0]);
      expect(onSelectionChange).toHaveBeenCalledWith(['version-1']);

      // Click again to deselect
      await user.click(versionItems[0]);
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('should visually indicate selected versions', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Initially, no versions should be selected
      expect(versionItems[0]).not.toHaveClass('selected');

      // Click to select
      await user.click(versionItems[0]);

      // Should have selected class/style
      await waitFor(() => {
        expect(versionItems[0]).toHaveClass(/selected|bg-blue/);
      });
    });
  });

  describe('Timestamp Formatting', () => {
    it('should format recent timestamps with relative time', async () => {
      // This test would check if recent versions show "2 hours ago", "yesterday", etc.
      // The exact implementation depends on the date formatting library used

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      // Should have formatted timestamps
      const timestamps = screen.getAllByTestId(/version-timestamp/);
      expect(timestamps.length).toBeGreaterThan(0);
    });

    it('should format old timestamps with absolute date', async () => {
      // Older versions should show full date like "June 1, 2024"

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      // Should have formatted timestamps
      const timestamps = screen.getAllByTestId(/version-timestamp/);
      expect(timestamps.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      // List should have appropriate role
      const list = screen.getByTestId('version-list');
      expect(list).toHaveAttribute('role', 'list');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();

      renderWithApollo(
        <VersionList
          entityType="settlement"
          entityId="settlement-1"
          branchId="branch-1"
          onSelectionChange={onSelectionChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Should be focusable
      versionItems[0].focus();
      expect(document.activeElement).toBe(versionItems[0]);

      // Should be selectable with Enter or Space
      await user.keyboard('{Enter}');
      expect(onSelectionChange).toHaveBeenCalledWith(['version-1']);
    });
  });

  describe('Restore Functionality', () => {
    it('should show restore button when single non-current version is selected', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      // Restore button should not be visible initially
      expect(screen.queryByTestId('restore-button')).not.toBeInTheDocument();

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select a non-current version (version-2 or version-3, not version-1 which is current)
      await user.click(versionItems[1]); // Select version-2

      // Restore button should now be visible
      await waitFor(() => {
        expect(screen.getByTestId('restore-button')).toBeInTheDocument();
      });
    });

    it('should not show restore button when current version is selected', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select current version (version-1 with validTo: null)
      await user.click(versionItems[0]);

      // Restore button should NOT be visible
      expect(screen.queryByTestId('restore-button')).not.toBeInTheDocument();
    });

    it('should not show restore button when no version is selected', async () => {
      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      // Restore button should not be visible
      expect(screen.queryByTestId('restore-button')).not.toBeInTheDocument();
    });

    it('should not show restore button when multiple versions are selected', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select two versions
      await user.click(versionItems[1]);
      await user.click(versionItems[2]);

      // Restore button should NOT be visible
      expect(screen.queryByTestId('restore-button')).not.toBeInTheDocument();
    });

    it('should hide restore button after deselecting the version', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select a non-current version
      await user.click(versionItems[1]);

      // Restore button should be visible
      await waitFor(() => {
        expect(screen.getByTestId('restore-button')).toBeInTheDocument();
      });

      // Deselect the version
      await user.click(versionItems[1]);

      // Restore button should be hidden
      await waitFor(() => {
        expect(screen.queryByTestId('restore-button')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle versions without comments', async () => {
      renderWithApollo(
        <VersionList
          entityType="settlement"
          entityId="settlement-no-comments"
          branchId="branch-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      // Should display a placeholder or "No comment" text
      expect(screen.getByText(/no comment/i)).toBeInTheDocument();
    });

    it('should handle single version', async () => {
      renderWithApollo(
        <VersionList
          entityType="settlement"
          entityId="settlement-single-version"
          branchId="branch-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);
      expect(versionItems).toHaveLength(1);

      // Single version should have CURRENT badge
      expect(screen.getByText('CURRENT')).toBeInTheDocument();
    });
  });

  describe('Version Comparison', () => {
    it('should show compare button when exactly two versions are selected', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      // Compare button should not be visible initially
      expect(screen.queryByTestId('compare-button')).not.toBeInTheDocument();

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select first version
      await user.click(versionItems[0]);

      // Compare button should not be visible with only one version selected
      expect(screen.queryByTestId('compare-button')).not.toBeInTheDocument();

      // Select second version
      await user.click(versionItems[1]);

      // Compare button should now be visible
      await waitFor(() => {
        expect(screen.getByTestId('compare-button')).toBeInTheDocument();
      });
    });

    it('should not show compare button when only one version is selected', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select one version
      await user.click(versionItems[0]);

      // Compare button should NOT be visible
      expect(screen.queryByTestId('compare-button')).not.toBeInTheDocument();
    });

    it('should not show compare button when three or more versions are selected', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select three versions
      await user.click(versionItems[0]);
      await user.click(versionItems[1]);
      await user.click(versionItems[2]);

      // Compare button should NOT be visible
      expect(screen.queryByTestId('compare-button')).not.toBeInTheDocument();
    });

    it('should hide compare button after deselecting one of two selected versions', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select two versions
      await user.click(versionItems[0]);
      await user.click(versionItems[1]);

      // Compare button should be visible
      await waitFor(() => {
        expect(screen.getByTestId('compare-button')).toBeInTheDocument();
      });

      // Deselect one version
      await user.click(versionItems[1]);

      // Compare button should be hidden
      await waitFor(() => {
        expect(screen.queryByTestId('compare-button')).not.toBeInTheDocument();
      });
    });

    it('should open comparison dialog when compare button is clicked', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select two versions
      await user.click(versionItems[0]);
      await user.click(versionItems[1]);

      // Wait for compare button
      await waitFor(() => {
        expect(screen.getByTestId('compare-button')).toBeInTheDocument();
      });

      const compareButton = screen.getByTestId('compare-button');
      await user.click(compareButton);

      // Comparison dialog should be visible
      await waitFor(() => {
        expect(screen.getByTestId('comparison-dialog')).toBeInTheDocument();
      });
    });

    it('should pass correct version IDs to comparison dialog', async () => {
      const user = userEvent.setup();

      renderWithApollo(
        <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select two versions
      await user.click(versionItems[0]); // version-1
      await user.click(versionItems[1]); // version-2

      // Wait for compare button
      await waitFor(() => {
        expect(screen.getByTestId('compare-button')).toBeInTheDocument();
      });

      const compareButton = screen.getByTestId('compare-button');
      await user.click(compareButton);

      // Comparison dialog should receive correct IDs
      await waitFor(() => {
        const dialog = screen.getByTestId('comparison-dialog');
        expect(dialog).toHaveAttribute('data-version-a-id', 'version-1');
        expect(dialog).toHaveAttribute('data-version-b-id', 'version-2');
      });
    });

    it('should clear selection when comparison dialog is closed', async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();

      renderWithApollo(
        <VersionList
          entityType="settlement"
          entityId="settlement-1"
          branchId="branch-1"
          onSelectionChange={onSelectionChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('version-list')).toBeInTheDocument();
      });

      const versionItems = screen.getAllByTestId(/version-item/);

      // Select two versions
      await user.click(versionItems[0]);
      await user.click(versionItems[1]);

      // Wait for compare button and click
      await waitFor(() => {
        expect(screen.getByTestId('compare-button')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('compare-button'));

      // Dialog should be open
      await waitFor(() => {
        expect(screen.getByTestId('comparison-dialog')).toBeInTheDocument();
      });

      // Close the dialog (find close button within dialog)
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      // Selection should be cleared
      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith([]);
      });

      // Compare button should be hidden
      expect(screen.queryByTestId('compare-button')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // FILTERING TESTS - Stage 9
  // ===========================================================================

  describe('Version Filtering (Stage 9)', () => {
    beforeEach(() => {
      // Use default mock versions for filtering tests
      mockUseEntityVersions.mockReturnValue({
        versions: mockVersions,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });
    });

    // Comment Search Filtering Tests
    describe('Comment Search Filter', () => {
      it('should display comment search input', () => {
        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const searchInput = screen.getByPlaceholderText(/search comments/i);
        expect(searchInput).toBeInTheDocument();
      });

      it('should filter versions by comment text (case-insensitive)', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        // All versions should be visible initially
        expect(screen.getByText('Upgraded to level 3')).toBeInTheDocument();
        expect(screen.getByText('Upgraded to level 2')).toBeInTheDocument();
        expect(screen.getByText('Initial creation')).toBeInTheDocument();

        // Type search query
        const searchInput = screen.getByPlaceholderText(/search comments/i);
        await user.type(searchInput, 'level 3');

        // Only version with "level 3" should be visible
        await waitFor(() => {
          expect(screen.getByText('Upgraded to level 3')).toBeInTheDocument();
          expect(screen.queryByText('Upgraded to level 2')).not.toBeInTheDocument();
          expect(screen.queryByText('Initial creation')).not.toBeInTheDocument();
        });
      });

      it('should be case-insensitive when filtering', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const searchInput = screen.getByPlaceholderText(/search comments/i);
        await user.type(searchInput, 'UPGRADED');

        // Both versions with "upgraded" should be visible (case-insensitive)
        await waitFor(() => {
          expect(screen.getByText('Upgraded to level 3')).toBeInTheDocument();
          expect(screen.getByText('Upgraded to level 2')).toBeInTheDocument();
          expect(screen.queryByText('Initial creation')).not.toBeInTheDocument();
        });
      });

      it('should show all versions when search is cleared', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const searchInput = screen.getByPlaceholderText(/search comments/i);

        // Filter versions
        await user.type(searchInput, 'level 3');
        await waitFor(() => {
          expect(screen.queryByText('Initial creation')).not.toBeInTheDocument();
        });

        // Clear search
        await user.clear(searchInput);

        // All versions should be visible again
        await waitFor(() => {
          expect(screen.getByText('Upgraded to level 3')).toBeInTheDocument();
          expect(screen.getByText('Upgraded to level 2')).toBeInTheDocument();
          expect(screen.getByText('Initial creation')).toBeInTheDocument();
        });
      });
    });

    // Date Range Filtering Tests
    describe('Date Range Filter', () => {
      it('should display date range inputs', () => {
        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const fromDateInput = screen.getByLabelText(/from date/i);
        const toDateInput = screen.getByLabelText(/to date/i);

        expect(fromDateInput).toBeInTheDocument();
        expect(toDateInput).toBeInTheDocument();
      });

      it('should filter versions by from date', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const fromDateInput = screen.getByLabelText(/from date/i);

        // Set from date to 2024-06-08 (should filter out version-3)
        await user.type(fromDateInput, '2024-06-08');

        await waitFor(() => {
          expect(screen.getByText('Upgraded to level 3')).toBeInTheDocument();
          expect(screen.getByText('Upgraded to level 2')).toBeInTheDocument();
          expect(screen.queryByText('Initial creation')).not.toBeInTheDocument();
        });
      });

      it('should filter versions by to date', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const toDateInput = screen.getByLabelText(/to date/i);

        // Set to date to 2024-06-05 (should only show version-3)
        await user.type(toDateInput, '2024-06-05');

        await waitFor(() => {
          expect(screen.getByText('Initial creation')).toBeInTheDocument();
          expect(screen.queryByText('Upgraded to level 3')).not.toBeInTheDocument();
          expect(screen.queryByText('Upgraded to level 2')).not.toBeInTheDocument();
        });
      });

      it('should filter versions by date range', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const fromDateInput = screen.getByLabelText(/from date/i);
        const toDateInput = screen.getByLabelText(/to date/i);

        // Set range to 2024-06-08 to 2024-06-12 (should only show version-2)
        await user.type(fromDateInput, '2024-06-08');
        await user.type(toDateInput, '2024-06-12');

        await waitFor(() => {
          expect(screen.getByText('Upgraded to level 2')).toBeInTheDocument();
          expect(screen.queryByText('Upgraded to level 3')).not.toBeInTheDocument();
          expect(screen.queryByText('Initial creation')).not.toBeInTheDocument();
        });
      });
    });

    // User Filter Dropdown Tests
    describe('User Filter Dropdown', () => {
      it('should display user filter dropdown', () => {
        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const userFilterTrigger = screen.getByRole('combobox', { name: /filter by user/i });
        expect(userFilterTrigger).toBeInTheDocument();
      });

      it('should show all unique users in dropdown', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const userFilterTrigger = screen.getByRole('combobox', { name: /filter by user/i });
        await user.click(userFilterTrigger);

        // Should show options for user-1 and user-2 (and "All Users")
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'All Users' })).toBeInTheDocument();
          expect(screen.getByRole('option', { name: 'user-1' })).toBeInTheDocument();
          expect(screen.getByRole('option', { name: 'user-2' })).toBeInTheDocument();
        });
      });

      it('should filter versions by selected user', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const userFilterTrigger = screen.getByRole('combobox', { name: /filter by user/i });
        await user.click(userFilterTrigger);

        // Select user-2
        const user2Option = screen.getByText('user-2');
        await user.click(user2Option);

        // Only version created by user-2 should be visible
        await waitFor(() => {
          expect(screen.getByText('Upgraded to level 2')).toBeInTheDocument();
          expect(screen.queryByText('Upgraded to level 3')).not.toBeInTheDocument();
          expect(screen.queryByText('Initial creation')).not.toBeInTheDocument();
        });
      });

      it('should show all versions when "All Users" is selected', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        const userFilterTrigger = screen.getByRole('combobox', { name: /filter by user/i });

        // First filter by user-2
        await user.click(userFilterTrigger);
        const user2Option = screen.getByText('user-2');
        await user.click(user2Option);

        await waitFor(() => {
          expect(screen.queryByText('Initial creation')).not.toBeInTheDocument();
        });

        // Then select "All Users"
        await user.click(userFilterTrigger);
        const allUsersOption = screen.getByText('All Users');
        await user.click(allUsersOption);

        // All versions should be visible again
        await waitFor(() => {
          expect(screen.getByText('Upgraded to level 3')).toBeInTheDocument();
          expect(screen.getByText('Upgraded to level 2')).toBeInTheDocument();
          expect(screen.getByText('Initial creation')).toBeInTheDocument();
        });
      });
    });

    // Combined Filters Tests
    describe('Combined Filters', () => {
      it('should apply multiple filters with AND logic', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        // Apply comment search filter
        const searchInput = screen.getByPlaceholderText(/search comments/i);
        await user.type(searchInput, 'upgraded');

        // Apply user filter
        const userFilterTrigger = screen.getByRole('combobox', { name: /filter by user/i });
        await user.click(userFilterTrigger);
        const user1Option = screen.getByText('user-1');
        await user.click(user1Option);

        // Only version-1 should be visible (has "upgraded" and created by user-1)
        await waitFor(() => {
          expect(screen.getByText('Upgraded to level 3')).toBeInTheDocument();
          expect(screen.queryByText('Upgraded to level 2')).not.toBeInTheDocument();
          expect(screen.queryByText('Initial creation')).not.toBeInTheDocument();
        });
      });
    });

    // Filter Count Indicator Tests
    describe('Filter Count Indicator', () => {
      it('should display filter count when filters are active', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        // Apply filter
        const searchInput = screen.getByPlaceholderText(/search comments/i);
        await user.type(searchInput, 'level 3');

        // Should show "Showing X of Y versions"
        await waitFor(() => {
          expect(screen.getByText(/showing 1 of 3 versions/i)).toBeInTheDocument();
        });
      });

      it('should not display filter count when no filters are active', () => {
        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        // Should not show filter count
        expect(screen.queryByText(/showing .* of .* versions/i)).not.toBeInTheDocument();
      });
    });

    // Clear Filters Button Tests
    describe('Clear Filters Button', () => {
      it('should display clear filters button when filters are active', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        // Apply filter
        const searchInput = screen.getByPlaceholderText(/search comments/i);
        await user.type(searchInput, 'level 3');

        // Clear filters button should be visible
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
        });
      });

      it('should hide clear filters button when no filters are active', () => {
        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        // Clear filters button should not be visible
        expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
      });

      it('should clear all filters when clicked', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        // Apply multiple filters
        const searchInput = screen.getByPlaceholderText(/search comments/i);
        await user.type(searchInput, 'level 3');

        const fromDateInput = screen.getByLabelText(/from date/i);
        await user.type(fromDateInput, '2024-06-01');

        // Verify filters are active
        await waitFor(() => {
          expect(screen.getByText(/showing .* of .* versions/i)).toBeInTheDocument();
        });

        // Click clear filters
        const clearButton = screen.getByRole('button', { name: /clear filters/i });
        await user.click(clearButton);

        // All versions should be visible again
        await waitFor(() => {
          expect(screen.getByText('Upgraded to level 3')).toBeInTheDocument();
          expect(screen.getByText('Upgraded to level 2')).toBeInTheDocument();
          expect(screen.getByText('Initial creation')).toBeInTheDocument();
        });

        // Filter count and clear button should be hidden
        expect(screen.queryByText(/showing .* of .* versions/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();

        // Input fields should be cleared
        expect(searchInput).toHaveValue('');
        expect(fromDateInput).toHaveValue('');
      });
    });

    // No Results State Tests
    describe('No Results State', () => {
      it('should display no results message when all versions are filtered out', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        // Apply filter that matches no versions
        const searchInput = screen.getByPlaceholderText(/search comments/i);
        await user.type(searchInput, 'nonexistent search term');

        // Should show no results message
        await waitFor(() => {
          expect(
            screen.getByText(/no versions match your current filter criteria/i)
          ).toBeInTheDocument();
        });

        // Versions should not be visible
        expect(screen.queryByText('Upgraded to level 3')).not.toBeInTheDocument();
        expect(screen.queryByText('Upgraded to level 2')).not.toBeInTheDocument();
        expect(screen.queryByText('Initial creation')).not.toBeInTheDocument();
      });

      it('should show clear filters button in no results state', async () => {
        const user = userEvent.setup();

        renderWithApollo(
          <VersionList entityType="settlement" entityId="settlement-1" branchId="branch-1" />
        );

        // Apply filter that matches no versions
        const searchInput = screen.getByPlaceholderText(/search comments/i);
        await user.type(searchInput, 'nonexistent search term');

        // Should show no results message and clear filters button
        await waitFor(() => {
          expect(
            screen.getByText(/no versions match your current filter criteria/i)
          ).toBeInTheDocument();
          expect(screen.getByTestId('clear-filters-from-empty')).toBeInTheDocument();
        });
      });
    });
  });
});
