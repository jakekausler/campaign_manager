import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { VariableBlock } from './VariableBlock';

describe('VariableBlock', () => {
  describe('Rendering', () => {
    it('should render variable path', () => {
      const mockOnChange = vi.fn();
      render(<VariableBlock variablePath="settlement.level" onChange={mockOnChange} />);

      expect(screen.getByText('variable')).toBeInTheDocument();
      expect(screen.getByText('settlement.level')).toBeInTheDocument();
    });

    it('should have variable type styling', () => {
      const mockOnChange = vi.fn();
      render(<VariableBlock variablePath="status" onChange={mockOnChange} />);

      const block = screen.getByRole('region');
      expect(block).toHaveClass('border-indigo-500');
    });

    it('should display variable path in a badge', () => {
      const mockOnChange = vi.fn();
      render(<VariableBlock variablePath="settlement.level" onChange={mockOnChange} />);

      const badge = screen.getByText('settlement.level');
      expect(badge.className).toContain('font-mono');
    });

    it('should not be collapsible', () => {
      const mockOnChange = vi.fn();
      render(<VariableBlock variablePath="status" onChange={mockOnChange} />);

      expect(screen.queryByRole('button', { name: /collapse/i })).not.toBeInTheDocument();
    });

    it('should display icon', () => {
      const mockOnChange = vi.fn();
      render(<VariableBlock variablePath="status" onChange={mockOnChange} />);

      expect(screen.getByText('🔢')).toBeInTheDocument();
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnChange = vi.fn();
      const mockOnDelete = vi.fn();

      render(
        <VariableBlock
          variablePath="settlement.level"
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await deleteButton.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should not show delete button when onDelete is not provided', () => {
      const mockOnChange = vi.fn();
      render(<VariableBlock variablePath="status" onChange={mockOnChange} />);

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels', () => {
      const mockOnChange = vi.fn();
      render(<VariableBlock variablePath="status" onChange={mockOnChange} />);

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('aria-label', 'var operator block');
    });
  });

  describe('Different variable paths', () => {
    it('should render simple variable path', () => {
      const mockOnChange = vi.fn();
      render(<VariableBlock variablePath="status" onChange={mockOnChange} />);

      expect(screen.getByText('status')).toBeInTheDocument();
    });

    it('should render nested variable path', () => {
      const mockOnChange = vi.fn();
      render(<VariableBlock variablePath="settlement.owner.name" onChange={mockOnChange} />);

      expect(screen.getByText('settlement.owner.name')).toBeInTheDocument();
    });
  });
});
