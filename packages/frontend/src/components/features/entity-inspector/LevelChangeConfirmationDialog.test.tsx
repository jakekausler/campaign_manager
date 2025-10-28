import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { LevelChangeConfirmationDialog } from './LevelChangeConfirmationDialog';

describe('LevelChangeConfirmationDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    entityType: 'settlement' as const,
    entityName: 'Westholm',
    currentLevel: 2,
    newLevel: 3,
    loading: false,
  };

  describe('Rendering', () => {
    it('should render dialog when open is true', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} />);

      expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
    });

    it('should not render dialog when open is false', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Confirm Level Change')).not.toBeInTheDocument();
    });

    it('should display entity name and level change details', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} />);

      expect(screen.getByText(/Westholm/)).toBeInTheDocument();
      expect(screen.getByText(/from 2 to 3/)).toBeInTheDocument();
    });

    it('should display increase wording when level is increasing', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} currentLevel={2} newLevel={3} />);

      expect(screen.getByText(/You are about to increase the level/i)).toBeInTheDocument();
      expect(screen.getByText('Yes, increase level')).toBeInTheDocument();
    });

    it('should display decrease wording when level is decreasing', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} currentLevel={3} newLevel={2} />);

      expect(screen.getByText(/You are about to decrease the level/i)).toBeInTheDocument();
      expect(screen.getByText('Yes, decrease level')).toBeInTheDocument();
    });

    it('should show rules engine warning', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} />);

      expect(
        screen.getByText(/Changing the level may trigger rules engine recalculation/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Computed fields for this settlement/)).toBeInTheDocument();
      expect(
        screen.getByText(/Active conditions and their evaluation results/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Effects that depend on the level variable/)).toBeInTheDocument();
    });

    it('should show additional warning for settlements about structures', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} entityType="settlement" />);

      expect(screen.getByText(/All structures within this settlement/)).toBeInTheDocument();
    });

    it('should not show structures warning for structures', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} entityType="structure" />);

      expect(screen.queryByText(/All structures within this/)).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      render(<LevelChangeConfirmationDialog {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onConfirm when confirm button is clicked', () => {
      const onConfirm = vi.fn();
      render(<LevelChangeConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByText('Yes, increase level');
      fireEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalled();
    });

    it('should not call onConfirm when clicking cancel', () => {
      const onConfirm = vi.fn();
      render(<LevelChangeConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should disable cancel button when loading', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} loading={true} />);

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
    });

    it('should disable confirm button when loading', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} loading={true} />);

      const confirmButton = screen.getByText('Updating...');
      expect(confirmButton).toBeDisabled();
    });

    it('should show "Updating..." text when loading', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} loading={true} />);

      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });

    it('should show action text when not loading', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} loading={false} />);

      expect(screen.getByText('Yes, increase level')).toBeInTheDocument();
      expect(screen.queryByText('Updating...')).not.toBeInTheDocument();
    });
  });

  describe('Entity Type Labeling', () => {
    it('should capitalize Settlement in title', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} entityType="settlement" />);

      expect(screen.getByText(/Computed fields for this settlement/i)).toBeInTheDocument();
    });

    it('should capitalize Structure in title', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} entityType="structure" />);

      expect(screen.getByText(/structure/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog role', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} />);

      // AlertDialog from Radix UI automatically has proper roles
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('should have descriptive title', () => {
      render(<LevelChangeConfirmationDialog {...defaultProps} />);

      expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
    });
  });
});
