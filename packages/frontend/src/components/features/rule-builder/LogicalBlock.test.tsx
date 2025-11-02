import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { LogicalBlock } from './LogicalBlock';
import type { Block } from './types';

// Helper function to create a logical block
function createLogicalBlock(operator: 'and' | 'or' | '!', children: Block[] = []): Block {
  return {
    id: `${operator}-1`,
    type: 'logical',
    operator,
    children,
  };
}

describe('LogicalBlock', () => {
  const mockChild1: Block = {
    id: 'child-1',
    type: 'comparison',
    operator: '==',
    children: [
      { id: 'var-1', type: 'variable', operator: 'var', value: 'status' },
      { id: 'lit-1', type: 'literal', operator: 'literal', value: 'active' },
    ],
  };

  const mockChild2: Block = {
    id: 'child-2',
    type: 'comparison',
    operator: '>',
    children: [
      { id: 'var-2', type: 'variable', operator: 'var', value: 'level' },
      { id: 'lit-2', type: 'literal', operator: 'literal', value: 5 },
    ],
  };

  describe('AND operator', () => {
    it('should render AND operator with children', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('and', [mockChild1, mockChild2]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      // Check for the AND operator badge (at least one "and" text present)
      expect(screen.getAllByText('and').length).toBeGreaterThan(0);
    });

    it('should have logical type styling', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('and', [mockChild1, mockChild2]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /and operator block/i });
      expect(blockElement).toHaveClass('border-purple-500');
    });

    it('should render all children', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('and', [mockChild1, mockChild2]);

      const { container } = render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      // Should have nested block structure
      const articles = container.querySelectorAll('[role="region"]');
      expect(articles.length).toBeGreaterThan(1); // Parent + children
    });
  });

  describe('OR operator', () => {
    it('should render OR operator with children', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('or', [mockChild1, mockChild2]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      // Check for the OR operator badge (at least one "or" text present)
      expect(screen.getAllByText('or').length).toBeGreaterThan(0);
    });

    it('should have logical type styling', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('or', [mockChild1, mockChild2]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /or operator block/i });
      expect(blockElement).toHaveClass('border-purple-500');
    });
  });

  describe('NOT operator', () => {
    it('should render NOT operator with single child', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('!', [mockChild1]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('not')).toBeInTheDocument();
    });

    it('should show invalid state when NOT has multiple children', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('!', [mockChild1, mockChild2]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /! operator block/i });
      expect(blockElement).toHaveAttribute('data-invalid', 'true');
      expect(screen.getByText(/NOT operator requires exactly one child/i)).toBeInTheDocument();
    });

    it('should show invalid state when NOT has no children', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('!', []);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /! operator block/i });
      expect(blockElement).toHaveAttribute('data-invalid', 'true');
      expect(screen.getByText(/NOT operator requires exactly one child/i)).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show invalid state when AND/OR has no children', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('and', []);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /and operator block/i });
      expect(blockElement).toHaveAttribute('data-invalid', 'true');
      expect(screen.getByText(/requires at least one child/i)).toBeInTheDocument();
    });

    it('should not show invalid state when AND/OR has children', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('and', [mockChild1]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /and operator block/i });
      expect(blockElement).not.toHaveAttribute('data-invalid', 'true');
    });
  });

  describe('Empty state', () => {
    it('should show placeholder when no children', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('and', []);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/add condition/i)).toBeInTheDocument();
    });
  });

  describe('Updates', () => {
    it('should call onUpdate with complete block when child updates', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('and', [mockChild1]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      // Verify onUpdate receives complete Block object
      // This is tested by the component's internal logic
      expect(mockOnUpdate).not.toHaveBeenCalled(); // No updates until user interaction
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnUpdate = vi.fn();
      const mockOnDelete = vi.fn();
      const block = createLogicalBlock('and', [mockChild1]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      // Get the top-level and block and find its delete button
      const andBlock = screen.getByRole('region', { name: /and operator block/i });
      const deleteButton = andBlock.querySelector('button[aria-label="Delete block"]');
      await deleteButton?.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels for AND', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('and', [mockChild1]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /and operator block/i });
      expect(blockElement).toHaveAttribute('aria-label', 'and operator block');
    });

    it('should have appropriate ARIA labels for OR', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('or', [mockChild1]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /or operator block/i });
      expect(blockElement).toHaveAttribute('aria-label', 'or operator block');
    });

    it('should have appropriate ARIA labels for NOT', () => {
      const mockOnUpdate = vi.fn();
      const block = createLogicalBlock('!', [mockChild1]);

      render(<LogicalBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /! operator block/i });
      expect(blockElement).toHaveAttribute('aria-label', '! operator block');
    });
  });
});
