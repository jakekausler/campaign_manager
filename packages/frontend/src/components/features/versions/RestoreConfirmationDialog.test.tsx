/**
 * Tests for RestoreConfirmationDialog component
 *
 * Tests cover:
 * - Dialog open/close behavior
 * - Diff preview loading and display
 * - Restore confirmation and cancellation
 * - Success and error handling
 * - Loading states during restore operation
 * - Toast notifications
 * - Accessibility
 */

import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';
import { useCompareVersions, useRestoreVersion } from '@/services/api/hooks/versions';

import { RestoreConfirmationDialog } from './RestoreConfirmationDialog';

// Mock the version hooks
vi.mock('@/services/api/hooks/versions', () => ({
  useCompareVersions: vi.fn(),
  useRestoreVersion: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Type-cast for mocked hooks
const mockUseCompareVersions = useCompareVersions as ReturnType<typeof vi.fn>;
const mockUseRestoreVersion = useRestoreVersion as ReturnType<typeof vi.fn>;
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

// Mock diff data
const mockDiff = {
  added: {
    newField: 'new value',
  },
  modified: {
    level: { old: 2, new: 3 },
    'variables.prosperity': { old: 50, new: 75 },
  },
  removed: {
    oldField: 'removed value',
  },
};

// Mock version data
const mockCurrentVersion = {
  id: 'version-current',
  entityType: 'settlement',
  entityId: 'settlement-1',
  branchId: 'branch-1',
  validFrom: new Date('2024-06-15T14:00:00Z').toISOString(),
  validTo: null,
  payload: { name: 'Ironhold', level: 3 },
  version: 3,
  comment: 'Current version',
  createdBy: 'user-1',
  createdAt: new Date('2024-06-15T14:00:00Z').toISOString(),
};

const mockRestoreToVersion = {
  id: 'version-2',
  entityType: 'settlement',
  entityId: 'settlement-1',
  branchId: 'branch-1',
  validFrom: new Date('2024-06-10T10:00:00Z').toISOString(),
  validTo: new Date('2024-06-15T14:00:00Z').toISOString(),
  payload: { name: 'Ironhold', level: 2 },
  version: 2,
  comment: 'Previous version',
  createdBy: 'user-1',
  createdAt: new Date('2024-06-10T10:00:00Z').toISOString(),
};

describe('RestoreConfirmationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup(); // Unmount all React components and hooks
    vi.restoreAllMocks();
  });

  describe('Dialog Behavior', () => {
    it('should not render when closed', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: null, loading: false, error: undefined },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: undefined }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={false}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/Restore Previous Version/i)).toBeInTheDocument();
    });

    it('should call onClose when Cancel button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const onClose = vi.fn();

      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={onClose}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Act
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Assert
      // Note: onClose is called twice - once from AlertDialogCancel's onClick
      // and once from AlertDialog's onOpenChange
      expect(onClose).toHaveBeenCalled();
    });

    it('should fetch diff when dialog opens', () => {
      // Arrange
      const compareVersions = vi.fn();
      mockUseCompareVersions.mockReturnValue([
        compareVersions,
        { data: null, loading: true, error: undefined },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: undefined }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      expect(compareVersions).toHaveBeenCalledWith({
        variables: {
          versionId1: mockRestoreToVersion.id,
          versionId2: mockCurrentVersion.id,
        },
      });
    });
  });

  describe('Diff Preview', () => {
    it('should show loading state while fetching diff', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([vi.fn(), { data: null, loading: true, error: null }]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      expect(screen.getByText(/Loading changes/i)).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should display diff when loaded', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert - DiffViewer should be rendered with diff prop
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    });

    it('should show error state when diff fetch fails', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: null, loading: false, error: new Error('Failed to load diff') },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      expect(screen.getByText(/Failed to load changes/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Restore Operation', () => {
    it('should call restoreVersion mutation when Restore button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      const restoreVersion = vi
        .fn()
        .mockResolvedValue({ data: { restoreVersion: { id: 'new-version' } } });
      const onRestore = vi.fn();

      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([restoreVersion, { loading: false, error: null }]);

      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={onRestore}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Act
      const restoreButton = screen.getByRole('button', { name: /restore/i });
      await user.click(restoreButton);

      // Assert
      await waitFor(() => {
        expect(restoreVersion).toHaveBeenCalledWith({
          variables: {
            input: {
              versionId: mockRestoreToVersion.id,
              branchId: 'branch-1',
            },
          },
        });
      });
    });

    it('should show loading state during restore operation', async () => {
      // Arrange
      const restoreVersion = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([restoreVersion, { loading: true, error: undefined }]);

      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      const restoreButton = screen.getByRole('button', { name: /restore|restoring/i });
      expect(restoreButton).toBeDisabled();
    });

    it('should disable Cancel button during restore operation', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: true, error: null }]);

      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });

    it('should show success toast and call onRestore callback on successful restore', async () => {
      // Arrange
      const user = userEvent.setup();
      const restoreVersion = vi.fn().mockResolvedValue({
        data: { restoreVersion: { id: 'new-version' } },
      });
      const onRestore = vi.fn();
      const onClose = vi.fn();

      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);

      // Simulate changing loading state
      let isRestoring = false;
      mockUseRestoreVersion.mockImplementation(() => [
        async (...args: unknown[]) => {
          isRestoring = true;
          const result = await restoreVersion(...args);
          isRestoring = false;
          return result;
        },
        { loading: isRestoring, error: undefined },
      ]);

      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={onClose}
          onRestore={onRestore}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Act
      const restoreButton = screen.getByRole('button', { name: /restore/i });
      await user.click(restoreButton);

      // Assert
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining('Version restored successfully')
        );
        expect(onRestore).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should show error toast on failed restore', async () => {
      // Arrange
      const user = userEvent.setup();
      const restoreVersion = vi.fn().mockRejectedValue(new Error('Restore failed'));
      const onRestore = vi.fn();
      const onClose = vi.fn();

      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);

      mockUseRestoreVersion.mockImplementation(() => [
        restoreVersion,
        { loading: false, error: undefined },
      ]);

      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={onClose}
          onRestore={onRestore}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Act
      const restoreButton = screen.getByRole('button', { name: /restore/i });
      await user.click(restoreButton);

      // Assert
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to restore version')
        );
        expect(onRestore).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    it('should keep dialog open on restore error', async () => {
      // Arrange
      const user = userEvent.setup();
      const restoreVersion = vi.fn().mockRejectedValue(new Error('Network error'));

      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);

      mockUseRestoreVersion.mockReturnValue([restoreVersion, { loading: false, error: null }]);

      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Act
      const restoreButton = screen.getByRole('button', { name: /restore/i });
      await user.click(restoreButton);

      // Assert
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-describedby');
    });

    it('should support keyboard navigation', async () => {
      // Arrange
      const user = userEvent.setup();
      const onClose = vi.fn();

      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={onClose}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Act - Tab to Cancel button and press Enter
      await user.keyboard('{Tab}'); // Focus first interactive element
      await user.keyboard('{Enter}');

      // Assert
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Warning Message', () => {
    it('should display warning about creating new version', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      expect(screen.getByText(/This will create a new version/i)).toBeInTheDocument();
    });

    it('should display information about version history preservation', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: { versionDiff: mockDiff }, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      expect(screen.getByText(/history will be preserved/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing diff data gracefully', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: null, loading: false, error: null },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      expect(screen.getByText(/No changes detected/i)).toBeInTheDocument();
    });

    it('should disable Restore button when diff is loading', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([vi.fn(), { data: null, loading: true, error: null }]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      const restoreButton = screen.getByRole('button', { name: /restore/i });
      expect(restoreButton).toBeDisabled();
    });

    it('should disable Restore button when diff failed to load', () => {
      // Arrange
      mockUseCompareVersions.mockReturnValue([
        vi.fn(),
        { data: null, loading: false, error: new Error('Diff error') },
      ]);
      mockUseRestoreVersion.mockReturnValue([vi.fn(), { loading: false, error: null }]);

      // Act
      renderWithApollo(
        <RestoreConfirmationDialog
          open={true}
          onClose={vi.fn()}
          onRestore={vi.fn()}
          currentVersionId={mockCurrentVersion.id}
          restoreToVersionId={mockRestoreToVersion.id}
          branchId="branch-1"
        />
      );

      // Assert
      const restoreButton = screen.getByRole('button', { name: /restore/i });
      expect(restoreButton).toBeDisabled();
    });
  });
});
