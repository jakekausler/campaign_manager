import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { DeleteStructureConfirmationDialog } from './DeleteStructureConfirmationDialog';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('DeleteStructureConfirmationDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    structureName: 'Grand Temple',
    structureType: 'temple',
    loading: false,
  };

  describe('Rendering', () => {
    it('should render dialog when open is true', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} />);

      expect(screen.getByText('Confirm Structure Deletion')).toBeInTheDocument();
    });

    it('should not render dialog when open is false', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Confirm Structure Deletion')).not.toBeInTheDocument();
    });

    it('should display structure name', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} />);

      expect(screen.getByText(/Grand Temple/)).toBeInTheDocument();
    });

    it('should display structure type when provided', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} structureType="temple" />);

      expect(screen.getByText(/\(temple\)/)).toBeInTheDocument();
    });

    it('should not display structure type when not provided', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} structureType={undefined} />);

      expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
    });

    it('should show permanent deletion warning', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} />);

      expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
      expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument();
    });

    it('should show impact warnings', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} />);

      expect(screen.getByText(/Active conditions referencing/)).toBeInTheDocument();
      expect(screen.getByText(/Effects targeting/)).toBeInTheDocument();
      expect(
        screen.getByText(/Rules engine calculations for the parent settlement/)
      ).toBeInTheDocument();
    });

    it('should show custom impact warning when provided', () => {
      render(
        <DeleteStructureConfirmationDialog
          {...defaultProps}
          impactWarning="This structure is referenced by 3 conditions"
        />
      );

      expect(screen.getByText(/This structure is referenced by 3 conditions/)).toBeInTheDocument();
      expect(screen.getByText('Impact Warning')).toBeInTheDocument();
    });

    it('should not show custom impact warning section when not provided', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} impactWarning={undefined} />);

      expect(screen.queryByText('Impact Warning')).not.toBeInTheDocument();
    });
  });

  describe('Bulk Deletion', () => {
    it('should display singular structure name when count is 1', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} count={1} />);

      expect(screen.getByText(/Grand Temple/)).toBeInTheDocument();
      // Should say "this structure" not "structures" for count=1
      // Multiple elements contain "this structure" so use getAllByText
      const elements = screen.getAllByText(/this structure/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should display plural count when count > 1', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} structureName="" count={5} />);

      expect(screen.getByText(/5 structures/)).toBeInTheDocument();
    });

    it('should use plural wording in impact warnings for bulk deletion', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} count={5} />);

      // Multiple elements contain "these structures" so use getAllByText
      const elements = screen.getAllByText(/these structures/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should use singular wording in impact warnings for single deletion', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} count={1} />);

      // Multiple elements contain "this structure" so use getAllByText
      const elements = screen.getAllByText(/this structure/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should show correct button text for bulk deletion', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} count={5} />);

      expect(screen.getByText('Delete 5 Structures')).toBeInTheDocument();
    });

    it('should show correct button text for single deletion', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} count={1} />);

      expect(screen.getByText('Delete Structure')).toBeInTheDocument();
    });

    it('should not show child entities warning for bulk deletion', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} count={5} />);

      expect(screen.queryByText(/child entities/)).not.toBeInTheDocument();
    });

    it('should show child entities warning for single deletion', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} count={1} />);

      expect(screen.getByText(/Any child entities or dependencies/)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      render(<DeleteStructureConfirmationDialog {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onConfirm when Delete button is clicked', () => {
      const onConfirm = vi.fn();
      render(<DeleteStructureConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByText('Delete Structure');
      fireEvent.click(confirmButton);

      expect(onConfirm).toHaveBeenCalled();
    });

    it('should not call onConfirm when clicking cancel', () => {
      const onConfirm = vi.fn();
      render(<DeleteStructureConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('should prevent default on confirm button click', () => {
      const onConfirm = vi.fn();
      render(<DeleteStructureConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByText('Delete Structure');
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

      confirmButton.dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should disable cancel button when loading', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} loading={true} />);

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
    });

    it('should disable confirm button when loading', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} loading={true} />);

      const confirmButton = screen.getByText(/Deleting.../);
      expect(confirmButton).toBeDisabled();
    });

    it('should show "Deleting..." text when loading', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} loading={true} />);

      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });

    it('should show action text when not loading', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} loading={false} />);

      expect(screen.getByText('Delete Structure')).toBeInTheDocument();
      expect(screen.queryByText('Deleting...')).not.toBeInTheDocument();
    });

    it('should show correct loading text for bulk deletion', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} count={5} loading={true} />);

      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });
  });

  describe('Styling and Appearance', () => {
    it('should have destructive styling on confirm button', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} />);

      const confirmButton = screen.getByText('Delete Structure');
      expect(confirmButton.className).toContain('bg-destructive');
    });

    it('should render AlertCircle icon in title', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} />);

      // lucide-react icons are rendered as SVGs with specific classes
      const titleElement = screen.getByText('Confirm Structure Deletion').closest('h2');
      expect(titleElement).toBeInTheDocument();

      // Check that the SVG icon is rendered inside the title element
      const svgIcon = titleElement?.querySelector('svg');
      expect(svgIcon).toBeInTheDocument();
      expect(svgIcon?.classList.contains('lucide-circle-alert')).toBe(true);
    });

    it('should display impact warning with amber styling', () => {
      render(
        <DeleteStructureConfirmationDialog {...defaultProps} impactWarning="Custom warning" />
      );

      const warningBox = screen.getByText('Custom warning').closest('div');
      expect(warningBox?.className).toContain('amber');
    });

    it('should display general warnings with slate styling', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} />);

      const warningText = screen.getByText(/Active conditions referencing/);
      const warningBox = warningText.closest('div');
      expect(warningBox?.className).toContain('slate');
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog role', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} />);

      // AlertDialog from Radix UI automatically has proper roles
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('should have descriptive title', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} />);

      expect(screen.getByText('Confirm Structure Deletion')).toBeInTheDocument();
    });

    it('should have descriptive button labels', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Delete Structure')).toBeInTheDocument();
    });

    it('should maintain button labels during loading', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} loading={true} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty structure name gracefully', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} structureName="" />);

      // Should still render dialog
      expect(screen.getByText('Confirm Structure Deletion')).toBeInTheDocument();
    });

    it('should handle count of 0 gracefully', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} count={0} />);

      // Count of 0 should be treated as 1 (single deletion)
      expect(screen.getByText(/Grand Temple/)).toBeInTheDocument();
    });

    it('should handle undefined count gracefully', () => {
      render(<DeleteStructureConfirmationDialog {...defaultProps} count={undefined} />);

      // Undefined count defaults to 1
      expect(screen.getByText('Delete Structure')).toBeInTheDocument();
    });

    it('should handle very long structure names', () => {
      const longName = 'A'.repeat(100);
      render(<DeleteStructureConfirmationDialog {...defaultProps} structureName={longName} />);

      expect(screen.getByText(new RegExp(longName))).toBeInTheDocument();
    });

    it('should handle special characters in structure name', () => {
      render(
        <DeleteStructureConfirmationDialog
          {...defaultProps}
          structureName="Temple <of> & 'Light'"
        />
      );

      expect(screen.getByText(/Temple <of> & 'Light'/)).toBeInTheDocument();
    });
  });
});
