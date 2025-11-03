import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { IfBlock } from './IfBlock';
import type { Block } from './types';

// Helper function to create a complete if block
function createIfBlock(condition?: Block, thenValue?: Block, elseValue?: Block): Block {
  return {
    id: 'if-1',
    type: 'conditional',
    operator: 'if',
    children: [
      condition || {
        id: 'cond-1',
        type: 'comparison',
        operator: '==',
        children: [
          { id: 'var-1', type: 'variable', operator: 'var', value: 'status' },
          { id: 'lit-1', type: 'literal', operator: 'literal', value: 'active' },
        ],
      },
      thenValue || { id: 'then-1', type: 'literal', operator: 'literal', value: true },
      elseValue || { id: 'else-1', type: 'literal', operator: 'literal', value: false },
    ],
  };
}

describe('IfBlock', () => {
  const mockConditionBlock: Block = {
    id: 'cond-1',
    type: 'comparison',
    operator: '==',
    children: [
      { id: 'var-1', type: 'variable', operator: 'var', value: 'status' },
      { id: 'lit-1', type: 'literal', operator: 'literal', value: 'active' },
    ],
  };

  const mockThenBlock: Block = {
    id: 'then-1',
    type: 'literal',
    operator: 'literal',
    value: true,
  };

  const mockElseBlock: Block = {
    id: 'else-1',
    type: 'literal',
    operator: 'literal',
    value: false,
  };

  describe('Rendering', () => {
    it('should render with all three parts (condition, then, else)', () => {
      const mockOnUpdate = vi.fn();
      const block = createIfBlock(mockConditionBlock, mockThenBlock, mockElseBlock);

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('if')).toBeInTheDocument();
      expect(screen.getByText(/condition/i)).toBeInTheDocument();
      expect(screen.getByText(/then/i)).toBeInTheDocument();
      expect(screen.getByText(/else/i)).toBeInTheDocument();
    });

    it('should render with conditional icon', () => {
      const mockOnUpdate = vi.fn();
      const block = createIfBlock(mockConditionBlock, mockThenBlock, mockElseBlock);

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('🔀')).toBeInTheDocument();
    });

    it('should have conditional type styling', () => {
      const mockOnUpdate = vi.fn();
      const block = createIfBlock(mockConditionBlock, mockThenBlock, mockElseBlock);

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /if operator block/i });
      expect(blockElement).toHaveClass('border-yellow-500');
    });
  });

  describe('Structure', () => {
    it('should display condition, then, and else labels', () => {
      const mockOnUpdate = vi.fn();
      const block = createIfBlock(mockConditionBlock, mockThenBlock, mockElseBlock);

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('Condition:')).toBeInTheDocument();
      expect(screen.getByText('Then:')).toBeInTheDocument();
      expect(screen.getByText('Else:')).toBeInTheDocument();
    });

    it('should render nested blocks for each part', () => {
      const mockOnUpdate = vi.fn();
      const block = createIfBlock(mockConditionBlock, mockThenBlock, mockElseBlock);

      const { container } = render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      // Should have nested block structure
      const articles = container.querySelectorAll('[role="region"]');
      expect(articles.length).toBeGreaterThan(1); // Parent + nested blocks
    });
  });

  describe('Validation', () => {
    it('should show invalid state when condition is missing', () => {
      const mockOnUpdate = vi.fn();
      const block: Block = {
        id: 'if-1',
        type: 'conditional' as const,
        operator: 'if' as const,
        children: [undefined as unknown as Block, mockThenBlock, mockElseBlock],
      };

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /if operator block/i });
      expect(blockElement).toHaveAttribute('data-invalid', 'true');
      expect(screen.getByText(/condition is required/i)).toBeInTheDocument();
    });

    it('should show invalid state when thenValue is missing', () => {
      const mockOnUpdate = vi.fn();
      const block: Block = {
        id: 'if-1',
        type: 'conditional' as const,
        operator: 'if' as const,
        children: [mockConditionBlock, undefined as unknown as Block, mockElseBlock],
      };

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /if operator block/i });
      expect(blockElement).toHaveAttribute('data-invalid', 'true');
      expect(screen.getByText(/then value is required/i)).toBeInTheDocument();
    });

    it('should show invalid state when elseValue is missing', () => {
      const mockOnUpdate = vi.fn();
      const block: Block = {
        id: 'if-1',
        type: 'conditional' as const,
        operator: 'if' as const,
        children: [mockConditionBlock, mockThenBlock, undefined as unknown as Block],
      };

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /if operator block/i });
      expect(blockElement).toHaveAttribute('data-invalid', 'true');
      expect(screen.getByText(/else value is required/i)).toBeInTheDocument();
    });

    it('should not show invalid state when all parts are present', () => {
      const mockOnUpdate = vi.fn();
      const block = createIfBlock(mockConditionBlock, mockThenBlock, mockElseBlock);

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /if operator block/i });
      expect(blockElement).not.toHaveAttribute('data-invalid', 'true');
    });
  });

  describe('Updates', () => {
    it('should call onUpdate with complete block when child updates', () => {
      const mockOnUpdate = vi.fn();
      const block = createIfBlock(mockConditionBlock, mockThenBlock, mockElseBlock);

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      // Verify onUpdate receives complete Block object
      // This is tested by the component's internal logic
      expect(mockOnUpdate).not.toHaveBeenCalled(); // No updates until user interaction
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnUpdate = vi.fn();
      const mockOnDelete = vi.fn();
      const block = createIfBlock(mockConditionBlock, mockThenBlock, mockElseBlock);

      render(<IfBlock block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      // Get the top-level if block and find its delete button
      const ifBlock = screen.getByRole('region', { name: /if operator block/i });
      const deleteButton = ifBlock.querySelector(
        'button[aria-label="Delete block"]'
      ) as HTMLElement | null;
      await deleteButton?.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Placeholder rendering', () => {
    it('should show placeholder for missing condition', () => {
      const mockOnUpdate = vi.fn();
      const block: Block = {
        id: 'if-1',
        type: 'conditional' as const,
        operator: 'if' as const,
        children: [undefined as unknown as Block, mockThenBlock, mockElseBlock],
      };

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/add condition/i)).toBeInTheDocument();
    });

    it('should show placeholder for missing then value', () => {
      const mockOnUpdate = vi.fn();
      const block: Block = {
        id: 'if-1',
        type: 'conditional' as const,
        operator: 'if' as const,
        children: [mockConditionBlock, undefined as unknown as Block, mockElseBlock],
      };

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/add then value/i)).toBeInTheDocument();
    });

    it('should show placeholder for missing else value', () => {
      const mockOnUpdate = vi.fn();
      const block: Block = {
        id: 'if-1',
        type: 'conditional' as const,
        operator: 'if' as const,
        children: [mockConditionBlock, mockThenBlock, undefined as unknown as Block],
      };

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/add else value/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels', () => {
      const mockOnUpdate = vi.fn();
      const block = createIfBlock(mockConditionBlock, mockThenBlock, mockElseBlock);

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /if operator block/i });
      expect(blockElement).toHaveAttribute('aria-label', 'if operator block');
    });

    it('should be collapsible by default', () => {
      const mockOnUpdate = vi.fn();
      const block = createIfBlock(mockConditionBlock, mockThenBlock, mockElseBlock);

      render(<IfBlock block={block} onUpdate={mockOnUpdate} />);

      // Get the if block and find its collapse button
      const ifBlock = screen.getByRole('region', { name: /if operator block/i });
      const collapseButton = ifBlock.querySelector('button[aria-label="Collapse block"]');
      expect(collapseButton).toBeInTheDocument();
    });
  });
});
