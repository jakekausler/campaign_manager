/**
 * Tests for ComparisonDialog component
 *
 * Tests cover:
 * - Dialog open/close behavior
 * - Diff loading states
 * - Diff display with version labels
 * - Error handling for diff fetch failures
 * - Clear selection button
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Edge cases (missing diff, identical versions)
 */

import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';
import { useCompareVersions } from '@/services/api/hooks/versions';

import { ComparisonDialog } from './ComparisonDialog';

// Mock the useCompareVersions hook
vi.mock('@/services/api/hooks/versions', () => ({
  useCompareVersions: vi.fn(),
}));

// Mock the DiffViewer component
vi.mock('./DiffViewer', () => ({
  DiffViewer: ({ diff }: { diff: unknown }) => (
    <div data-testid="diff-viewer">{diff ? JSON.stringify(diff) : 'No diff'}</div>
  ),
}));

// Type-cast for mocked hook
const mockUseCompareVersions = useCompareVersions as ReturnType<typeof vi.fn>;

// Mock diff data
const mockDiff = {
  added: { level: 3 },
  modified: { name: { old: 'Old Name', new: 'New Name' } },
  removed: { deprecated_field: 'value' },
};

// Mock version metadata for display
const mockVersionA = {
  id: 'version-1',
  validFrom: new Date('2024-06-15T14:00:00Z').toISOString(),
  comment: 'Upgraded to level 3',
  createdBy: 'user-1',
};

const mockVersionB = {
  id: 'version-2',
  validFrom: new Date('2024-06-10T10:00:00Z').toISOString(),
  comment: 'Upgraded to level 2',
  createdBy: 'user-2',
};

describe('ComparisonDialog', () => {
  afterEach(() => {
    cleanup(); // Unmount all React components and hooks
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Behavior', () => {
    it('should not render when open is false', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: null,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={false}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('should render when open is true', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={mockOnClose}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button clicked', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={mockOnClose}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Diff Loading', () => {
    it('should fetch diff when dialog opens', () => {
      const mockCompareVersions = vi.fn();

      mockUseCompareVersions.mockReturnValue({
        compareVersions: mockCompareVersions,
        diff: null,
        loading: true,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(mockCompareVersions).toHaveBeenCalledWith({
        variables: {
          versionId1: 'version-1',
          versionId2: 'version-2',
        },
      });
    });

    it('should show loading state while fetching diff', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: null,
        loading: true,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(screen.getByTestId('comparison-loading')).toBeInTheDocument();
      expect(screen.getByText(/loading comparison/i)).toBeInTheDocument();
    });

    it('should display diff when loaded', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
      expect(screen.queryByTestId('comparison-loading')).not.toBeInTheDocument();
    });
  });

  describe('Version Labels', () => {
    it('should display version A metadata', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(screen.getByText(/version a/i)).toBeInTheDocument();
      expect(screen.getByText(mockVersionA.comment)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(mockVersionA.createdBy))).toBeInTheDocument();
    });

    it('should display version B metadata', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(screen.getByText(/version b/i)).toBeInTheDocument();
      expect(screen.getByText(mockVersionB.comment)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(mockVersionB.createdBy))).toBeInTheDocument();
    });

    it('should format timestamps correctly', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      // Should display formatted dates (format depends on formatTimestamp implementation)
      // Just verify dates are present in some form
      expect(screen.getByText(/june/i)).toBeInTheDocument();
    });

    it('should handle versions without comments', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={{ ...mockVersionA, comment: null }}
          versionBMetadata={{ ...mockVersionB, comment: null }}
        />
      );

      expect(screen.getAllByText(/no comment/i).length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should display error message when diff fetch fails', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: null,
        loading: false,
        error: new Error('Failed to fetch diff'),
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(screen.getByTestId('comparison-error')).toBeInTheDocument();
      expect(screen.getByText(/failed to load comparison/i)).toBeInTheDocument();
    });

    it('should show retry button on error', async () => {
      const user = userEvent.setup();
      const mockCompareVersions = vi.fn();

      mockUseCompareVersions.mockReturnValue({
        compareVersions: mockCompareVersions,
        diff: null,
        loading: false,
        error: new Error('Failed to fetch diff'),
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should call compareVersions again
      expect(mockCompareVersions).toHaveBeenCalledTimes(2); // Initial + retry
    });

    it('should not display DiffViewer when error occurs', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: null,
        loading: false,
        error: new Error('Failed to fetch diff'),
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty diff (no changes)', () => {
      const emptyDiff = {
        added: {},
        modified: {},
        removed: {},
      };

      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: emptyDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      // Should still display DiffViewer (which will show "No Changes Detected")
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    });

    it('should handle null diff', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: null,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      // Should show loading or empty state, not DiffViewer
      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
    });

    it('should re-fetch diff when version IDs change', () => {
      const mockCompareVersions = vi.fn();

      mockUseCompareVersions.mockReturnValue({
        compareVersions: mockCompareVersions,
        diff: mockDiff,
        loading: false,
        error: null,
      });

      const { rerender } = renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(mockCompareVersions).toHaveBeenCalledTimes(1);

      // Change version IDs
      rerender(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-3"
          versionBId="version-4"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(mockCompareVersions).toHaveBeenCalledTimes(2);
      expect(mockCompareVersions).toHaveBeenLastCalledWith({
        variables: {
          versionId1: 'version-3',
          versionId2: 'version-4',
        },
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(screen.getByRole('alertdialog')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/compare versions/i)
      );
    });

    it('should announce loading state to screen readers', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: null,
        loading: true,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      const loadingElement = screen.getByTestId('comparison-loading');
      expect(loadingElement).toHaveAttribute('role', 'status');
      expect(loadingElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce errors to screen readers', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: null,
        loading: false,
        error: new Error('Failed to fetch diff'),
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      const errorElement = screen.getByTestId('comparison-error');
      expect(errorElement).toHaveAttribute('role', 'alert');
      expect(errorElement).toHaveAttribute('aria-live', 'assertive');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={mockOnClose}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      // Should be able to tab to close button and activate with Enter
      const closeButton = screen.getByRole('button', { name: /close/i });
      closeButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Dialog Title', () => {
    it('should display descriptive title', () => {
      mockUseCompareVersions.mockReturnValue({
        compareVersions: vi.fn(),
        diff: mockDiff,
        loading: false,
        error: null,
      });

      renderWithApollo(
        <ComparisonDialog
          open={true}
          onClose={vi.fn()}
          versionAId="version-1"
          versionBId="version-2"
          versionAMetadata={mockVersionA}
          versionBMetadata={mockVersionB}
        />
      );

      expect(screen.getByText(/compare versions/i)).toBeInTheDocument();
    });
  });
});
