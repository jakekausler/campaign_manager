import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { VariableBlock } from './VariableBlock';
import type { Block } from './types';

// Helper function to create a variable block
function createVariableBlock(variablePath: string): Block {
  return {
    id: 'var-1',
    type: 'variable',
    operator: 'var',
    value: variablePath,
  };
}

describe('VariableBlock', () => {
  describe('Rendering', () => {
    it('should render variable path', () => {
      const mockOnUpdate = vi.fn();
      const block = createVariableBlock('settlement.level');

      render(<VariableBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('variable')).toBeInTheDocument();
      expect(screen.getByText('settlement.level')).toBeInTheDocument();
    });

    it('should have variable type styling', () => {
      const mockOnUpdate = vi.fn();
      const block = createVariableBlock('status');

      render(<VariableBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region');
      expect(blockElement).toHaveClass('border-indigo-500');
    });

    it('should display variable path in a badge', () => {
      const mockOnUpdate = vi.fn();
      const block = createVariableBlock('settlement.level');

      render(<VariableBlock block={block} onUpdate={mockOnUpdate} />);

      const badge = screen.getByText('settlement.level');
      expect(badge.className).toContain('font-mono');
    });

    it('should not be collapsible', () => {
      const mockOnUpdate = vi.fn();
      const block = createVariableBlock('status');

      render(<VariableBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.queryByRole('button', { name: /collapse/i })).not.toBeInTheDocument();
    });

    it('should display icon', () => {
      const mockOnUpdate = vi.fn();
      const block = createVariableBlock('status');

      render(<VariableBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('🔢')).toBeInTheDocument();
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnUpdate = vi.fn();
      const mockOnDelete = vi.fn();
      const block = createVariableBlock('settlement.level');

      render(<VariableBlock block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await deleteButton.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should not show delete button when onDelete is not provided', () => {
      const mockOnUpdate = vi.fn();
      const block = createVariableBlock('status');

      render(<VariableBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels', () => {
      const mockOnUpdate = vi.fn();
      const block = createVariableBlock('status');

      render(<VariableBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region');
      expect(blockElement).toHaveAttribute('aria-label', 'var operator block');
    });
  });

  describe('Different variable paths', () => {
    it('should render simple variable path', () => {
      const mockOnUpdate = vi.fn();
      const block = createVariableBlock('status');

      render(<VariableBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('status')).toBeInTheDocument();
    });

    it('should render nested variable path', () => {
      const mockOnUpdate = vi.fn();
      const block = createVariableBlock('settlement.owner.name');

      render(<VariableBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('settlement.owner.name')).toBeInTheDocument();
    });
  });
});
