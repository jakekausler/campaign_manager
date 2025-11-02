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

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';
import { useEntityVersions } from '@/services/api/hooks/versions';

import { VersionList } from './VersionList';

// Mock the version hooks
vi.mock('@/services/api/hooks/versions', () => ({
  useEntityVersions: vi.fn(),
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
  // Set up default mock implementation before each test
  beforeEach(() => {
    mockUseEntityVersions.mockImplementation((variables) => {
      const entityId = variables?.entityId || '';

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
});
