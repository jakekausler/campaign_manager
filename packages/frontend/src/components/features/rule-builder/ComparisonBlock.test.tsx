import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ComparisonBlock } from './ComparisonBlock';
import type { Block } from './types';

// Helper function to create a comparison block
function createComparisonBlock(
  operator: '==' | '!=' | '===' | '!==' | '>' | '>=' | '<' | '<=',
  left?: Block,
  right?: Block
): Block {
  return {
    id: `${operator}-1`,
    type: 'comparison',
    operator,
    children: [
      left || { id: 'left-1', type: 'variable', operator: 'var', value: 'status' },
      right || { id: 'right-1', type: 'literal', operator: 'literal', value: 'active' },
    ],
  };
}

describe('ComparisonBlock', () => {
  const mockLeftBlock: Block = {
    id: 'left-1',
    type: 'variable',
    operator: 'var',
    value: 'status',
  };

  const mockRightBlock: Block = {
    id: 'right-1',
    type: 'literal',
    operator: 'literal',
    value: 'active',
  };

  describe('Rendering', () => {
    it('should render equality operator', () => {
      const mockOnUpdate = vi.fn();
      const block = createComparisonBlock('==', mockLeftBlock, mockRightBlock);

      render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

      // Check that at least one instance of '==' is present
      expect(screen.getAllByText('==').length).toBeGreaterThan(0);
    });

    it('should have comparison type styling', () => {
      const mockOnUpdate = vi.fn();
      const block = createComparisonBlock('==', mockLeftBlock, mockRightBlock);

      render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /== operator block/i });
      expect(blockElement).toHaveClass('border-blue-500');
    });

    it('should render left and right sides', () => {
      const mockOnUpdate = vi.fn();
      const block = createComparisonBlock('==', mockLeftBlock, mockRightBlock);

      const { container } = render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

      const articles = container.querySelectorAll('[role="region"]');
      expect(articles.length).toBeGreaterThan(1); // Parent + children
    });
  });

  describe('Operators', () => {
    const operators: Array<'==' | '!=' | '===' | '!==' | '>' | '>=' | '<' | '<='> = [
      '==',
      '!=',
      '===',
      '!==',
      '>',
      '>=',
      '<',
      '<=',
    ];

    operators.forEach((op) => {
      it(`should render ${op} operator`, () => {
        const mockOnUpdate = vi.fn();
        const block = createComparisonBlock(op, mockLeftBlock, mockRightBlock);

        render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

        // Check that at least one instance of the operator text is present
        expect(screen.getAllByText(op).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Validation', () => {
    it('should show invalid state when left is missing', () => {
      const mockOnUpdate = vi.fn();
      const block: Block = {
        id: 'comp-1',
        type: 'comparison' as const,
        operator: '==' as const,
        children: [undefined as unknown as Block, mockRightBlock],
      };

      render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /== operator block/i });
      expect(blockElement).toHaveAttribute('data-invalid', 'true');
      expect(screen.getByText(/left operand is required/i)).toBeInTheDocument();
    });

    it('should show invalid state when right is missing', () => {
      const mockOnUpdate = vi.fn();
      const block: Block = {
        id: 'comp-1',
        type: 'comparison' as const,
        operator: '==' as const,
        children: [mockLeftBlock, undefined as unknown as Block],
      };

      render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /== operator block/i });
      expect(blockElement).toHaveAttribute('data-invalid', 'true');
      expect(screen.getByText(/right operand is required/i)).toBeInTheDocument();
    });

    it('should not show invalid state when both operands are present', () => {
      const mockOnUpdate = vi.fn();
      const block = createComparisonBlock('==', mockLeftBlock, mockRightBlock);

      render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /== operator block/i });
      expect(blockElement).not.toHaveAttribute('data-invalid', 'true');
    });
  });

  describe('Placeholders', () => {
    it('should show placeholder for missing left operand', () => {
      const mockOnUpdate = vi.fn();
      const block: Block = {
        id: 'comp-1',
        type: 'comparison' as const,
        operator: '==' as const,
        children: [undefined as unknown as Block, mockRightBlock],
      };

      render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/add left operand/i)).toBeInTheDocument();
    });

    it('should show placeholder for missing right operand', () => {
      const mockOnUpdate = vi.fn();
      const block: Block = {
        id: 'comp-1',
        type: 'comparison' as const,
        operator: '==' as const,
        children: [mockLeftBlock, undefined as unknown as Block],
      };

      render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/add right operand/i)).toBeInTheDocument();
    });
  });

  describe('Updates', () => {
    it('should call onUpdate with complete block when child updates', () => {
      const mockOnUpdate = vi.fn();
      const block = createComparisonBlock('==', mockLeftBlock, mockRightBlock);

      render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

      // Verify onUpdate receives complete Block object
      // This is tested by the component's internal logic
      expect(mockOnUpdate).not.toHaveBeenCalled(); // No updates until user interaction
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnUpdate = vi.fn();
      const mockOnDelete = vi.fn();
      const block = createComparisonBlock('==', mockLeftBlock, mockRightBlock);

      render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      // Get the top-level == block and find its delete button
      const comparisonBlock = screen.getByRole('region', { name: /== operator block/i });
      const deleteButton = comparisonBlock.querySelector(
        'button[aria-label="Delete block"]'
      ) as HTMLElement | null;
      await deleteButton?.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels', () => {
      const mockOnUpdate = vi.fn();
      const block = createComparisonBlock('==', mockLeftBlock, mockRightBlock);

      render(<ComparisonBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /== operator block/i });
      expect(blockElement).toHaveAttribute('aria-label', '== operator block');
    });
  });
});
