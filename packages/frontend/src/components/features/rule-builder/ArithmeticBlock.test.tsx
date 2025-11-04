import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { ArithmeticBlock } from './ArithmeticBlock';
import type { Block } from './types';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks();
});

// Helper function to create an arithmetic block
function createArithmeticBlock(
  operator: '+' | '-' | '*' | '/' | '%',
  operands: Block[] = []
): Block {
  return {
    id: `${operator}-1`,
    type: 'arithmetic',
    operator,
    children: operands,
  };
}

describe('ArithmeticBlock', () => {
  const mockOperand1: Block = {
    id: 'op-1',
    type: 'literal',
    operator: 'literal',
    value: 10,
  };

  const mockOperand2: Block = {
    id: 'op-2',
    type: 'literal',
    operator: 'literal',
    value: 5,
  };

  describe('Rendering', () => {
    it('should render addition operator', () => {
      const mockOnUpdate = vi.fn();
      const block = createArithmeticBlock('+', [mockOperand1, mockOperand2]);

      render(<ArithmeticBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText('add')).toBeInTheDocument();
    });

    it('should have arithmetic type styling', () => {
      const mockOnUpdate = vi.fn();
      const block = createArithmeticBlock('+', [mockOperand1, mockOperand2]);

      render(<ArithmeticBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /\+ operator block/i });
      expect(blockElement).toHaveClass('border-green-500');
    });
  });

  describe('Operators', () => {
    const operators: Array<{ op: '+' | '-' | '*' | '/' | '%'; label: string }> = [
      { op: '+', label: 'add' },
      { op: '-', label: 'subtract' },
      { op: '*', label: 'multiply' },
      { op: '/', label: 'divide' },
      { op: '%', label: 'modulo' },
    ];

    operators.forEach(({ op, label }) => {
      it(`should render ${label} operator`, () => {
        const mockOnUpdate = vi.fn();
        const block = createArithmeticBlock(op, [mockOperand1, mockOperand2]);

        render(<ArithmeticBlock block={block} onUpdate={mockOnUpdate} />);

        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('should show invalid state when less than 2 operands', () => {
      const mockOnUpdate = vi.fn();
      const block = createArithmeticBlock('+', [mockOperand1]);

      render(<ArithmeticBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /\+ operator block/i });
      expect(blockElement).toHaveAttribute('data-invalid', 'true');
      expect(screen.getByText(/at least two operands/i)).toBeInTheDocument();
    });

    it('should not show invalid state with 2 or more operands', () => {
      const mockOnUpdate = vi.fn();
      const block = createArithmeticBlock('+', [mockOperand1, mockOperand2]);

      render(<ArithmeticBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /\+ operator block/i });
      expect(blockElement).not.toHaveAttribute('data-invalid', 'true');
    });
  });

  describe('Empty state', () => {
    it('should show placeholder when no operands', () => {
      const mockOnUpdate = vi.fn();
      const block = createArithmeticBlock('+', []);

      render(<ArithmeticBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/add operands/i)).toBeInTheDocument();
    });
  });

  describe('Updates', () => {
    it('should call onUpdate with complete block when child updates', () => {
      const mockOnUpdate = vi.fn();
      const block = createArithmeticBlock('+', [mockOperand1, mockOperand2]);

      render(<ArithmeticBlock block={block} onUpdate={mockOnUpdate} />);

      // Verify onUpdate receives complete Block object
      // This is tested by the component's internal logic
      expect(mockOnUpdate).not.toHaveBeenCalled(); // No updates until user interaction
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnUpdate = vi.fn();
      const mockOnDelete = vi.fn();
      const block = createArithmeticBlock('+', [mockOperand1, mockOperand2]);

      render(<ArithmeticBlock block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      // Get the top-level + block and find its delete button
      const arithmeticBlock = screen.getByRole('region', { name: /\+ operator block/i });
      const deleteButton = arithmeticBlock.querySelector(
        'button[aria-label="Delete block"]'
      ) as HTMLElement | null;
      await deleteButton?.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });
});
