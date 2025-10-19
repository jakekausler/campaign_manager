import { describe, it, expect, vi } from 'vitest';

import { render, screen } from '@/__tests__/utils/test-utils';

import { FlowToolbar } from './FlowToolbar';

describe('FlowToolbar', () => {
  it('renders re-layout button', () => {
    const mockOnReLayout = vi.fn();
    render(<FlowToolbar onReLayout={mockOnReLayout} />);

    const button = screen.getByRole('button', { name: /re-apply auto-layout/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Re-layout')).toBeInTheDocument();
  });

  it('calls onReLayout when button is clicked', () => {
    const mockOnReLayout = vi.fn();
    render(<FlowToolbar onReLayout={mockOnReLayout} />);

    const button = screen.getByRole('button', { name: /re-apply auto-layout/i });
    button.click();

    expect(mockOnReLayout).toHaveBeenCalledTimes(1);
  });

  it('disables button when isLayouting is true', () => {
    const mockOnReLayout = vi.fn();
    render(<FlowToolbar onReLayout={mockOnReLayout} isLayouting={true} />);

    const button = screen.getByRole('button', { name: /re-apply auto-layout/i });
    expect(button).toBeDisabled();
  });

  it('does not call onReLayout when button is disabled', () => {
    const mockOnReLayout = vi.fn();
    render(<FlowToolbar onReLayout={mockOnReLayout} isLayouting={true} />);

    const button = screen.getByRole('button', { name: /re-apply auto-layout/i });
    button.click();

    expect(mockOnReLayout).not.toHaveBeenCalled();
  });

  it('shows spinning icon when isLayouting is true', () => {
    const mockOnReLayout = vi.fn();
    const { container } = render(<FlowToolbar onReLayout={mockOnReLayout} isLayouting={true} />);

    // Check for animate-spin class on the icon
    const icon = container.querySelector('.animate-spin');
    expect(icon).toBeInTheDocument();
  });

  it('does not show spinning icon when isLayouting is false', () => {
    const mockOnReLayout = vi.fn();
    const { container } = render(<FlowToolbar onReLayout={mockOnReLayout} isLayouting={false} />);

    // Check that animate-spin class is not present
    const icon = container.querySelector('.animate-spin');
    expect(icon).not.toBeInTheDocument();
  });

  it('has correct aria-label for accessibility', () => {
    const mockOnReLayout = vi.fn();
    render(<FlowToolbar onReLayout={mockOnReLayout} />);

    const button = screen.getByRole('button', { name: /re-apply auto-layout/i });
    expect(button).toHaveAttribute('aria-label', 'Re-apply auto-layout');
  });

  it('has correct title for tooltip', () => {
    const mockOnReLayout = vi.fn();
    render(<FlowToolbar onReLayout={mockOnReLayout} />);

    const button = screen.getByRole('button', { name: /re-apply auto-layout/i });
    expect(button).toHaveAttribute('title', 'Re-apply auto-layout to reset node positions');
  });
});
