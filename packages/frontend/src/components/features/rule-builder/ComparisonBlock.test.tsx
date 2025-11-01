import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ComparisonBlock } from './ComparisonBlock';
import type { Block } from './types';

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
      const mockOnChange = vi.fn();
      render(
        <ComparisonBlock
          operator="=="
          left={mockLeftBlock}
          right={mockRightBlock}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('==')).toBeInTheDocument();
    });

    it('should have comparison type styling', () => {
      const mockOnChange = vi.fn();
      render(
        <ComparisonBlock
          operator="=="
          left={mockLeftBlock}
          right={mockRightBlock}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).toHaveClass('border-blue-500');
    });

    it('should render left and right sides', () => {
      const mockOnChange = vi.fn();
      const { container } = render(
        <ComparisonBlock
          operator="=="
          left={mockLeftBlock}
          right={mockRightBlock}
          onChange={mockOnChange}
        />
      );

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
        const mockOnChange = vi.fn();
        render(
          <ComparisonBlock
            operator={op}
            left={mockLeftBlock}
            right={mockRightBlock}
            onChange={mockOnChange}
          />
        );

        expect(screen.getByText(op)).toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('should show invalid state when left is missing', () => {
      const mockOnChange = vi.fn();
      render(
        <ComparisonBlock
          operator="=="
          left={undefined}
          right={mockRightBlock}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('data-invalid', true);
      expect(screen.getByText(/left operand is required/i)).toBeInTheDocument();
    });

    it('should show invalid state when right is missing', () => {
      const mockOnChange = vi.fn();
      render(
        <ComparisonBlock
          operator="=="
          left={mockLeftBlock}
          right={undefined}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('data-invalid', true);
      expect(screen.getByText(/right operand is required/i)).toBeInTheDocument();
    });

    it('should not show invalid state when both operands are present', () => {
      const mockOnChange = vi.fn();
      render(
        <ComparisonBlock
          operator="=="
          left={mockLeftBlock}
          right={mockRightBlock}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).not.toHaveAttribute('data-invalid', true);
    });
  });

  describe('Placeholders', () => {
    it('should show placeholder for missing left operand', () => {
      const mockOnChange = vi.fn();
      render(
        <ComparisonBlock
          operator="=="
          left={undefined}
          right={mockRightBlock}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/add left operand/i)).toBeInTheDocument();
    });

    it('should show placeholder for missing right operand', () => {
      const mockOnChange = vi.fn();
      render(
        <ComparisonBlock
          operator="=="
          left={mockLeftBlock}
          right={undefined}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/add right operand/i)).toBeInTheDocument();
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnChange = vi.fn();
      const mockOnDelete = vi.fn();

      render(
        <ComparisonBlock
          operator="=="
          left={mockLeftBlock}
          right={mockRightBlock}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await deleteButton.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels', () => {
      const mockOnChange = vi.fn();
      render(
        <ComparisonBlock
          operator="=="
          left={mockLeftBlock}
          right={mockRightBlock}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('aria-label', '== operator block');
    });
  });
});
