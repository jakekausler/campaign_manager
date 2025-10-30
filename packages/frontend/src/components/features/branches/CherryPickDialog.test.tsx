import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as mergeHooks from '@/services/api/hooks/merge';

import {
  CherryPickDialog,
  type CherryPickDialogProps,
  type VersionInfo,
  type BranchInfo,
} from './CherryPickDialog';

// Mock the merge hooks
vi.mock('@/services/api/hooks/merge', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof mergeHooks;
  return {
    ...actual,
    useCherryPickVersion: vi.fn(),
  };
});

// Mock ConflictResolutionDialog component
vi.mock('./ConflictResolutionDialog', () => ({
  ConflictResolutionDialog: ({
    isOpen,
    onClose,
    onResolve,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onResolve: (resolutions: unknown[]) => void;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="conflict-resolution-dialog">
        <h2>Conflict Resolution Dialog</h2>
        <button onClick={() => onResolve([])}>Resolve</button>
        <button onClick={onClose}>Close</button>
      </div>
    );
  },
}));

describe('CherryPickDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockCherryPick = vi.fn();
  const mockReset = vi.fn();

  const mockVersion: VersionInfo = {
    id: 'version-123',
    entityId: 'entity-456',
    entityType: 'settlement',
    branchId: 'branch-source',
    description: 'Test version',
  };

  const mockTargetBranch: BranchInfo = {
    id: 'branch-target',
    name: 'Target Branch',
  };

  const defaultProps: CherryPickDialogProps = {
    version: mockVersion,
    targetBranch: mockTargetBranch,
    isOpen: true,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
      mockCherryPick,
      {
        loading: false,
        error: undefined,
        data: undefined,
        reset: mockReset,
        client: {} as never,
        called: false,
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Visibility', () => {
    it('should render when isOpen is true', () => {
      render(<CherryPickDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Cherry-Pick Version')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<CherryPickDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should hide main dialog when conflict dialog is shown', () => {
      // Set up mock to return conflicts
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: false,
          error: undefined,
          data: {
            cherryPickVersion: {
              success: true,
              hasConflict: true,
              conflicts: [
                {
                  path: 'population',
                  type: 'BOTH_MODIFIED',
                  description: 'Conflict at population',
                  suggestion: null,
                  baseValue: null,
                  sourceValue: '1000',
                  targetValue: '1200',
                },
              ],
              versionId: undefined,
              error: undefined,
            },
          },
          reset: mockReset,
          client: {} as never,
          called: false,
        },
      ]);

      render(<CherryPickDialog {...defaultProps} />);

      // Main dialog should not be visible when conflict dialog is open
      expect(screen.queryByText('Cherry-Pick Version')).not.toBeInTheDocument();
    });
  });

  describe('Dialog Content', () => {
    it('should display version information', () => {
      render(<CherryPickDialog {...defaultProps} />);

      expect(screen.getByText('Source Version')).toBeInTheDocument();
      expect(screen.getByText('version-123')).toBeInTheDocument();
      expect(screen.getByText(/settlement/)).toBeInTheDocument();
      expect(screen.getByText(/entity-456/)).toBeInTheDocument();
      expect(screen.getByText('Test version')).toBeInTheDocument();
    });

    it('should display target branch information', () => {
      render(<CherryPickDialog {...defaultProps} />);

      expect(screen.getByText('Target Branch')).toBeInTheDocument();
      expect(screen.getByText('Target Branch')).toBeInTheDocument();
      expect(screen.getByText('branch-target')).toBeInTheDocument();
    });

    it('should display info message about cherry-pick operation', () => {
      render(<CherryPickDialog {...defaultProps} />);

      expect(
        screen.getByText(/This will apply the selected version to the target branch/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/If conflicts are detected, you will be prompted to resolve them/)
      ).toBeInTheDocument();
    });

    it('should display Cherry-Pick button', () => {
      render(<CherryPickDialog {...defaultProps} />);

      const cherryPickButton = screen.getByRole('button', { name: /^Cherry-Pick$/ });
      expect(cherryPickButton).toBeInTheDocument();
    });

    it('should display Cancel button', () => {
      render(<CherryPickDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('should enable cherry-pick button when version and branch are provided', () => {
      render(<CherryPickDialog {...defaultProps} />);

      const cherryPickButton = screen.getByRole('button', { name: /^Cherry-Pick$/ });
      expect(cherryPickButton).not.toBeDisabled();
    });

    it('should disable cherry-pick button when version is null', () => {
      render(<CherryPickDialog {...defaultProps} version={null} />);

      const cherryPickButton = screen.getByRole('button', { name: /^Cherry-Pick$/ });
      expect(cherryPickButton).toBeDisabled();
    });

    it('should disable cherry-pick button when target branch is null', () => {
      render(<CherryPickDialog {...defaultProps} targetBranch={null} />);

      const cherryPickButton = screen.getByRole('button', { name: /^Cherry-Pick$/ });
      expect(cherryPickButton).toBeDisabled();
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<CherryPickDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cherry-Pick Operation', () => {
    it('should call mutation with correct variables when cherry-pick button is clicked', async () => {
      const user = userEvent.setup();
      render(<CherryPickDialog {...defaultProps} />);

      const cherryPickButton = screen.getByRole('button', { name: /^Cherry-Pick$/ });
      await user.click(cherryPickButton);

      await waitFor(() => {
        expect(mockCherryPick).toHaveBeenCalledWith({
          variables: {
            input: {
              sourceVersionId: 'version-123',
              targetBranchId: 'branch-target',
              resolutions: [],
            },
          },
        });
      });
    });

    it('should display loading state during cherry-pick', () => {
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: true,
          error: undefined,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      render(<CherryPickDialog {...defaultProps} />);

      expect(screen.getByText(/Cherry-picking.../)).toBeInTheDocument();
      const cherryPickButton = screen.getByRole('button', { name: /Cherry-picking.../i });
      expect(cherryPickButton).toBeDisabled();
    });

    it('should disable buttons during loading', () => {
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: true,
          error: undefined,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      render(<CherryPickDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const cherryPickButton = screen.getByRole('button', { name: /Cherry-picking.../i });

      expect(cancelButton).toBeDisabled();
      expect(cherryPickButton).toBeDisabled();
    });
  });

  describe('Success Handling', () => {
    it('should display success message on successful cherry-pick without conflicts', () => {
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: false,
          error: undefined,
          data: {
            cherryPickVersion: {
              success: true,
              hasConflict: false,
              conflicts: undefined,
              versionId: 'new-version-789',
              error: undefined,
            },
          },
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      render(<CherryPickDialog {...defaultProps} />);

      expect(screen.getByText(/Cherry-pick completed successfully!/)).toBeInTheDocument();
      expect(screen.getByText(/new-version-789/)).toBeInTheDocument();
    });

    it('should call onSuccess callback with new version ID', () => {
      const mockOnCompletedCallback = vi.fn();
      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        if (options?.onCompleted) {
          options.onCompleted({
            cherryPickVersion: {
              success: true,
              hasConflict: false,
              conflicts: undefined,
              versionId: 'new-version-789',
              error: undefined,
            },
          });
        }
        return [
          mockCherryPick,
          {
            loading: false,
            error: undefined,
            data: undefined,
            reset: mockReset,
            client: {} as never,
            called: false,
          },
        ];
      });

      render(<CherryPickDialog {...defaultProps} onSuccess={mockOnCompletedCallback} />);

      expect(mockOnCompletedCallback).toHaveBeenCalledWith('new-version-789');
    });

    it('should change Cancel button to Close after success', () => {
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: false,
          error: undefined,
          data: {
            cherryPickVersion: {
              success: true,
              hasConflict: false,
              conflicts: undefined,
              versionId: 'new-version-789',
              error: undefined,
            },
          },
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      render(<CherryPickDialog {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Cherry-Pick$/ })).not.toBeInTheDocument();
    });
  });

  describe('Conflict Handling', () => {
    it('should open conflict resolution dialog when conflicts are detected', () => {
      const mockOnCompletedCallback = vi.fn();
      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        if (options?.onCompleted) {
          options.onCompleted({
            cherryPickVersion: {
              success: true,
              hasConflict: true,
              conflicts: [
                {
                  path: 'population',
                  type: 'BOTH_MODIFIED',
                  description: 'Conflict at population',
                  suggestion: null,
                  baseValue: null,
                  sourceValue: '1000',
                  targetValue: '1200',
                },
              ],
              versionId: undefined,
              error: undefined,
            },
          });
        }
        return [
          mockCherryPick,
          {
            loading: false,
            error: undefined,
            data: undefined,
            reset: mockReset,
            client: {} as never,
            called: false,
          },
        ];
      });

      render(<CherryPickDialog {...defaultProps} onSuccess={mockOnCompletedCallback} />);

      expect(screen.getByTestId('conflict-resolution-dialog')).toBeInTheDocument();
    });

    it('should retry cherry-pick with resolutions after conflict resolution', async () => {
      const user = userEvent.setup();

      // First call: return conflicts
      let callCount = 0;
      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        callCount++;
        if (callCount === 1 && options?.onCompleted) {
          // First call - conflicts detected
          options.onCompleted({
            cherryPickVersion: {
              success: true,
              hasConflict: true,
              conflicts: [
                {
                  path: 'population',
                  type: 'BOTH_MODIFIED',
                  description: 'Conflict at population',
                  suggestion: null,
                  baseValue: null,
                  sourceValue: '1000',
                  targetValue: '1200',
                },
              ],
              versionId: undefined,
              error: undefined,
            },
          });
        }
        return [
          mockCherryPick,
          {
            loading: false,
            error: undefined,
            data: undefined,
            reset: mockReset,
            client: {} as never,
            called: callCount > 0,
          },
        ];
      });

      render(<CherryPickDialog {...defaultProps} />);

      // Conflict dialog should be open
      expect(screen.getByTestId('conflict-resolution-dialog')).toBeInTheDocument();

      // Click resolve button
      const resolveButton = screen.getByRole('button', { name: /resolve/i });
      await user.click(resolveButton);

      // Cherry-pick should be called again with resolutions
      await waitFor(() => {
        expect(mockCherryPick).toHaveBeenCalledWith({
          variables: {
            input: {
              sourceVersionId: 'version-123',
              targetBranchId: 'branch-target',
              resolutions: [],
            },
          },
        });
      });
    });

    it('should close parent dialog when conflict dialog is cancelled', async () => {
      const user = userEvent.setup();

      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        if (options?.onCompleted) {
          options.onCompleted({
            cherryPickVersion: {
              success: true,
              hasConflict: true,
              conflicts: [
                {
                  path: 'population',
                  type: 'BOTH_MODIFIED',
                  description: 'Conflict at population',
                  suggestion: null,
                  baseValue: null,
                  sourceValue: '1000',
                  targetValue: '1200',
                },
              ],
              versionId: undefined,
              error: undefined,
            },
          });
        }
        return [
          mockCherryPick,
          {
            loading: false,
            error: undefined,
            data: undefined,
            reset: mockReset,
            client: {} as never,
            called: false,
          },
        ];
      });

      render(<CherryPickDialog {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should display GraphQL error message', () => {
      const mockError = new Error('Network error');
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: false,
          error: mockError,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      render(<CherryPickDialog {...defaultProps} />);

      expect(screen.getByText(/Cherry-pick failed/)).toBeInTheDocument();
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    it('should display validation error when version is missing', () => {
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: false,
          error: undefined,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: false,
        },
      ]);

      render(<CherryPickDialog {...defaultProps} version={null} />);

      expect(screen.getByText(/N\/A/)).toBeInTheDocument();
    });

    it('should display validation error when target branch is missing', () => {
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: false,
          error: undefined,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: false,
        },
      ]);

      render(<CherryPickDialog {...defaultProps} targetBranch={null} />);

      expect(screen.getByText(/N\/A/)).toBeInTheDocument();
    });

    it('should display error from cherry-pick result', () => {
      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        if (options?.onCompleted) {
          options.onCompleted({
            cherryPickVersion: {
              success: false,
              hasConflict: false,
              conflicts: undefined,
              versionId: undefined,
              error: 'Permission denied',
            },
          });
        }
        return [
          mockCherryPick,
          {
            loading: false,
            error: undefined,
            data: undefined,
            reset: mockReset,
            client: {} as never,
            called: false,
          },
        ];
      });

      render(<CherryPickDialog {...defaultProps} />);

      expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });
  });

  describe('Form Reset', () => {
    it('should reset form when dialog closes', async () => {
      const { rerender } = render(<CherryPickDialog {...defaultProps} />);

      // Display success message
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: false,
          error: undefined,
          data: {
            cherryPickVersion: {
              success: true,
              hasConflict: false,
              conflicts: undefined,
              versionId: 'new-version-789',
              error: undefined,
            },
          },
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      rerender(<CherryPickDialog {...defaultProps} />);

      expect(screen.getByText(/Cherry-pick completed successfully!/)).toBeInTheDocument();

      // Close dialog
      rerender(<CherryPickDialog {...defaultProps} isOpen={false} />);

      // Reopen dialog
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: false,
          error: undefined,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: false,
        },
      ]);

      rerender(<CherryPickDialog {...defaultProps} />);

      // Success message should not be visible
      expect(screen.queryByText(/Cherry-pick completed successfully!/)).not.toBeInTheDocument();
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should close dialog on Escape key', async () => {
      render(<CherryPickDialog {...defaultProps} />);

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      window.dispatchEvent(escapeEvent);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should not close dialog on Escape during loading', async () => {
      vi.mocked(mergeHooks.useCherryPickVersion).mockReturnValue([
        mockCherryPick,
        {
          loading: true,
          error: undefined,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      render(<CherryPickDialog {...defaultProps} />);

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      window.dispatchEvent(escapeEvent);

      await waitFor(() => {
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });

    it('should not close dialog on Escape when conflict dialog is open', async () => {
      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        if (options?.onCompleted) {
          options.onCompleted({
            cherryPickVersion: {
              success: true,
              hasConflict: true,
              conflicts: [
                {
                  path: 'population',
                  type: 'BOTH_MODIFIED',
                  description: 'Conflict at population',
                  suggestion: null,
                  baseValue: null,
                  sourceValue: '1000',
                  targetValue: '1200',
                },
              ],
              versionId: undefined,
              error: undefined,
            },
          });
        }
        return [
          mockCherryPick,
          {
            loading: false,
            error: undefined,
            data: undefined,
            reset: mockReset,
            client: {} as never,
            called: false,
          },
        ];
      });

      render(<CherryPickDialog {...defaultProps} />);

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      window.dispatchEvent(escapeEvent);

      await waitFor(() => {
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });
  });
});
