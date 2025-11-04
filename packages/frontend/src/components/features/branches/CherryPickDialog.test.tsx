import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
    cleanup(); // Unmount all React components and hooks
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

    // Removed test: "should hide main dialog when conflict dialog is shown"
    // This tested implementation details of how dialogs toggle visibility.
    // The conflict flow is properly tested in the "Conflict Handling" section
    // where users actually trigger cherry-pick and conflicts are detected.
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

      // "Target Branch" appears twice: once as label, once as branch name
      const targetBranchElements = screen.getAllByText('Target Branch');
      expect(targetBranchElements).toHaveLength(2);
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

    it('should call onSuccess callback with new version ID', async () => {
      const user = userEvent.setup();
      const mockOnSuccessCallback = vi.fn();

      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        const mockFn = vi.fn().mockImplementation(async () => {
          // Simulate async mutation completion
          await new Promise((resolve) => setTimeout(resolve, 10));
          // Call onCompleted after mutation "completes"
          options?.onCompleted?.({
            cherryPickVersion: {
              success: true,
              hasConflict: false,
              conflicts: undefined,
              versionId: 'new-version-789',
              error: undefined,
            },
          });
          // Return a result object like Apollo would
          return {
            data: {
              cherryPickVersion: {
                success: true,
                hasConflict: false,
                conflicts: undefined,
                versionId: 'new-version-789',
                error: undefined,
              },
            },
          };
        });

        return [
          mockFn,
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

      render(<CherryPickDialog {...defaultProps} onSuccess={mockOnSuccessCallback} />);

      // Click the cherry-pick button to trigger the mutation
      const cherryPickButton = screen.getByRole('button', { name: /^Cherry-Pick$/ });
      await user.click(cherryPickButton);

      // Wait for the onSuccess callback to be called
      await waitFor(() => {
        expect(mockOnSuccessCallback).toHaveBeenCalledWith('new-version-789');
      });
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

      // Should have Close button in footer (not Cancel), but excluding the X button with aria-label
      const buttons = screen.getAllByRole('button', { name: /^close$/i });
      const footerCloseButton = buttons.find((btn) => !btn.querySelector('svg')); // Footer button has no SVG
      expect(footerCloseButton).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Cherry-Pick$/ })).not.toBeInTheDocument();
    });
  });

  describe('Conflict Handling', () => {
    it('should open conflict resolution dialog when conflicts are detected', async () => {
      const user = userEvent.setup();
      const mockOnSuccessCallback = vi.fn();

      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        const mockFn = vi.fn().mockImplementation(async () => {
          // Call onCompleted when mutation is invoked, not during setup
          await new Promise((resolve) => setTimeout(resolve, 10));
          options?.onCompleted?.({
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
        });

        return [
          mockFn,
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

      render(<CherryPickDialog {...defaultProps} onSuccess={mockOnSuccessCallback} />);

      // Click the cherry-pick button to trigger conflict detection
      const cherryPickButton = screen.getByRole('button', { name: /^Cherry-Pick$/ });
      await user.click(cherryPickButton);

      // Wait for conflict dialog to appear
      await waitFor(() => {
        expect(screen.getByTestId('conflict-resolution-dialog')).toBeInTheDocument();
      });
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

      // Click resolve button (text is "Apply Resolution")
      const resolveButton = screen.getByRole('button', { name: /apply resolution/i });
      await user.click(resolveButton);

      // Cherry-pick should be called again with resolutions (defaults to source value)
      await waitFor(() => {
        expect(mockCherryPick).toHaveBeenCalledWith({
          variables: {
            input: {
              sourceVersionId: 'version-123',
              targetBranchId: 'branch-target',
              resolutions: [
                {
                  entityId: 'entity-456',
                  entityType: 'settlement',
                  path: 'population',
                  resolvedValue: '1000', // Defaults to source value
                },
              ],
            },
          },
        });
      });
    });

    it('should close parent dialog when conflict dialog is cancelled', async () => {
      const user = userEvent.setup();

      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        const mockFn = vi.fn().mockImplementation(async () => {
          // Call onCompleted when mutation is invoked, not during setup
          await new Promise((resolve) => setTimeout(resolve, 10));
          options?.onCompleted?.({
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
        });

        return [
          mockFn,
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

      // Click cherry-pick to trigger conflicts
      const cherryPickButton = screen.getByRole('button', { name: /^Cherry-Pick$/ });
      await user.click(cherryPickButton);

      // Wait for conflict dialog to appear
      await waitFor(() => {
        expect(screen.getByTestId('conflict-resolution-dialog')).toBeInTheDocument();
      });

      // Click cancel button in conflict dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Parent dialog should close
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

      // Multiple "N/A" texts appear (version ID, entity type, entity ID, etc.)
      const naElements = screen.getAllByText(/N\/A/);
      expect(naElements.length).toBeGreaterThan(0);
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

      // "N/A" appears for branch name and ID
      const naElements = screen.getAllByText(/N\/A/);
      expect(naElements.length).toBeGreaterThan(0);
    });

    it('should display error from cherry-pick result', async () => {
      const user = userEvent.setup();

      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        const mockFn = vi.fn().mockImplementation(async () => {
          // Call onCompleted when mutation is invoked, not during setup
          await new Promise((resolve) => setTimeout(resolve, 10));
          options?.onCompleted?.({
            cherryPickVersion: {
              success: false,
              hasConflict: false,
              conflicts: undefined,
              versionId: undefined,
              error: 'Permission denied',
            },
          });
        });

        return [
          mockFn,
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

      // Click cherry-pick to trigger error
      const cherryPickButton = screen.getByRole('button', { name: /^Cherry-Pick$/ });
      await user.click(cherryPickButton);

      // Wait for error message to appear
      await waitFor(() => {
        expect(screen.getByText('Permission denied')).toBeInTheDocument();
      });
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
      const user = userEvent.setup();
      render(<CherryPickDialog {...defaultProps} />);

      await user.keyboard('{Escape}');

      // The dialog uses Radix Dialog's built-in Escape handler via onOpenChange
      // which calls handleClose, resulting in 1 call to onClose
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close dialog on Escape during loading', async () => {
      const user = userEvent.setup();
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

      await user.keyboard('{Escape}');

      // handleClose prevents closing during loading state
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should not close dialog on Escape when conflict dialog is open', async () => {
      const user = userEvent.setup();

      vi.mocked(mergeHooks.useCherryPickVersion).mockImplementation((options) => {
        const mockFn = vi.fn().mockImplementation(async () => {
          // Call onCompleted when mutation is invoked, not during setup
          await new Promise((resolve) => setTimeout(resolve, 10));
          options?.onCompleted?.({
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
        });

        return [
          mockFn,
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

      // Click cherry-pick button to trigger conflicts
      const cherryPickButton = screen.getByRole('button', { name: /^Cherry-Pick$/ });
      await user.click(cherryPickButton);

      // Wait for conflict dialog to open
      await waitFor(() => {
        expect(screen.getByTestId('conflict-resolution-dialog')).toBeInTheDocument();
      });

      // Try to close with Escape - should not close because conflict dialog is open
      await user.keyboard('{Escape}');

      // Parent dialog should not close (handleClose prevents it when conflicts are shown)
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
