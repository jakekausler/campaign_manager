import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ArithmeticBlock } from './ArithmeticBlock';
import type { Block } from './types';

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
      const mockOnChange = vi.fn();
      render(
        <ArithmeticBlock
          operator="+"
          operands={[mockOperand1, mockOperand2]}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('add')).toBeInTheDocument();
    });

    it('should have arithmetic type styling', () => {
      const mockOnChange = vi.fn();
      render(
        <ArithmeticBlock
          operator="+"
          operands={[mockOperand1, mockOperand2]}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).toHaveClass('border-green-500');
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
        const mockOnChange = vi.fn();
        render(
          <ArithmeticBlock
            operator={op}
            operands={[mockOperand1, mockOperand2]}
            onChange={mockOnChange}
          />
        );

        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('should show invalid state when less than 2 operands', () => {
      const mockOnChange = vi.fn();
      render(<ArithmeticBlock operator="+" operands={[mockOperand1]} onChange={mockOnChange} />);

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('data-invalid', true);
      expect(screen.getByText(/at least two operands/i)).toBeInTheDocument();
    });

    it('should not show invalid state with 2 or more operands', () => {
      const mockOnChange = vi.fn();
      render(
        <ArithmeticBlock
          operator="+"
          operands={[mockOperand1, mockOperand2]}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).not.toHaveAttribute('data-invalid', true);
    });
  });

  describe('Empty state', () => {
    it('should show placeholder when no operands', () => {
      const mockOnChange = vi.fn();
      render(<ArithmeticBlock operator="+" operands={[]} onChange={mockOnChange} />);

      expect(screen.getByText(/add operands/i)).toBeInTheDocument();
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnChange = vi.fn();
      const mockOnDelete = vi.fn();

      render(
        <ArithmeticBlock
          operator="+"
          operands={[mockOperand1, mockOperand2]}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await deleteButton.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });
});
