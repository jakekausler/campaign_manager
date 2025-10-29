import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DeleteBranchDialog, type BranchInfo } from './DeleteBranchDialog';

describe('DeleteBranchDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockChildBranch: BranchInfo = {
    id: 'branch-child',
    name: 'Alternate Timeline',
    parentId: 'branch-main',
    children: [],
  };

  const mockRootBranch: BranchInfo = {
    id: 'branch-main',
    name: 'Main Timeline',
    parentId: null,
    children: [{ id: 'branch-child' }],
  };

  const mockBranchWithChildren: BranchInfo = {
    id: 'branch-parent',
    name: 'Parent Branch',
    parentId: 'branch-main',
    children: [{ id: 'child-1' }, { id: 'child-2' }, { id: 'child-3' }],
  };

  const mockLeafBranch: BranchInfo = {
    id: 'branch-leaf',
    name: 'Leaf Branch',
    parentId: 'branch-main',
    children: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Visibility', () => {
    it('should render when open is true', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockChildBranch}
        />
      );

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(
        <DeleteBranchDialog
          open={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockChildBranch}
        />
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('should not render when branch is null', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={null}
        />
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('Root Branch Protection', () => {
    it('should show protection message for root branch', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockRootBranch}
        />
      );

      expect(screen.getByText('Cannot Delete Branch')).toBeInTheDocument();
      expect(screen.getAllByText(/root branch/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Why can't I delete this branch?/i)).toBeInTheDocument();
    });

    it('should show only Close button for root branch', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockRootBranch}
        />
      );

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('should call onClose when Close button clicked for root branch', async () => {
      const user = userEvent.setup();
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockRootBranch}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should explain why root branches cannot be deleted', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockRootBranch}
        />
      );

      const explanation = screen.getByText(/Root branches.*serve as the foundation/i);
      expect(explanation).toBeInTheDocument();
      expect(explanation).toHaveTextContent(/orphan all child branches/i);
    });
  });

  describe('Branch with Children Protection', () => {
    it('should show protection message for branch with children', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockBranchWithChildren}
        />
      );

      expect(screen.getByText('Cannot Delete Branch')).toBeInTheDocument();
      expect(screen.getByText(/3 child branches/i)).toBeInTheDocument();
      expect(screen.getByText(/Delete child branches first/i)).toBeInTheDocument();
    });

    it('should show singular "branch" for one child', () => {
      const branchWithOneChild: BranchInfo = {
        ...mockBranchWithChildren,
        children: [{ id: 'child-1' }],
      };

      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={branchWithOneChild}
        />
      );

      expect(screen.getByText(/1 child branch/i)).toBeInTheDocument();
    });

    it('should show only Close button for branch with children', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockBranchWithChildren}
        />
      );

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('should explain why branches with children cannot be deleted', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockBranchWithChildren}
        />
      );

      expect(
        screen.getByText(/must delete all child branches before deleting this branch/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/prevents orphaned branches/i)).toBeInTheDocument();
    });
  });

  describe('Deletable Branch (Leaf Node)', () => {
    it('should show confirmation title for deletable branch', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
        />
      );

      expect(screen.getByText('Confirm Branch Deletion')).toBeInTheDocument();
      expect(screen.queryByText('Cannot Delete Branch')).not.toBeInTheDocument();
    });

    it('should show both Cancel and Delete buttons for deletable branch', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete branch/i })).toBeInTheDocument();
    });

    it('should show branch name in deletion message', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
        />
      );

      expect(screen.getByText(/Leaf Branch/)).toBeInTheDocument();
      expect(screen.getAllByText(/permanently delete/i).length).toBeGreaterThan(0);
    });

    it('should list what will be deleted', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
        />
      );

      expect(screen.getByText(/All versions specific to this branch/i)).toBeInTheDocument();
      expect(screen.getByText(/Branch metadata and history/i)).toBeInTheDocument();
      expect(screen.getByText(/Any unsaved changes in this branch/i)).toBeInTheDocument();
      expect(screen.getByText(/Ability to view this branch's timeline/i)).toBeInTheDocument();
    });

    it('should show "cannot be undone" warning', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
        />
      );

      expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument();
    });
  });

  describe('Current Branch Warning', () => {
    it('should show warning when deleting current branch', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
          isCurrentBranch={true}
        />
      );

      expect(screen.getByText(/Currently Selected Branch/i)).toBeInTheDocument();
      expect(screen.getByText(/you will be switched to the parent branch/i)).toBeInTheDocument();
    });

    it('should not show warning when not deleting current branch', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
          isCurrentBranch={false}
        />
      );

      expect(screen.queryByText(/Currently Selected Branch/i)).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when Cancel button clicked', async () => {
      const user = userEvent.setup();
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should call onConfirm when Delete button clicked', async () => {
      const user = userEvent.setup();
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete branch/i });
      await user.click(deleteButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should disable buttons during loading state', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
          loading={true}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const deleteButton = screen.getByRole('button', { name: /deleting\.\.\./i });

      expect(cancelButton).toBeDisabled();
      expect(deleteButton).toBeDisabled();
    });

    it('should show "Deleting..." text during loading', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
          loading={true}
        />
      );

      expect(screen.getByRole('button', { name: /deleting\.\.\./i })).toBeInTheDocument();
    });

    it('should not disable buttons when not loading', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
          loading={false}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const deleteButton = screen.getByRole('button', { name: /delete branch/i });

      expect(cancelButton).not.toBeDisabled();
      expect(deleteButton).not.toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle branch with undefined children array', () => {
      const branchNoChildren: BranchInfo = {
        id: 'branch-1',
        name: 'Branch',
        parentId: 'main',
        children: undefined,
      };

      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={branchNoChildren}
        />
      );

      // Should treat as deletable (no children)
      expect(screen.getByText('Confirm Branch Deletion')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete branch/i })).toBeInTheDocument();
    });

    it('should handle branch with empty children array', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockLeafBranch}
        />
      );

      // Should treat as deletable (no children)
      expect(screen.getByText('Confirm Branch Deletion')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete branch/i })).toBeInTheDocument();
    });

    it('should handle branch with null parentId (root)', () => {
      render(
        <DeleteBranchDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          branch={mockRootBranch}
        />
      );

      expect(screen.getByText('Cannot Delete Branch')).toBeInTheDocument();
      expect(screen.getAllByText(/root branch/i).length).toBeGreaterThan(0);
    });
  });
});
