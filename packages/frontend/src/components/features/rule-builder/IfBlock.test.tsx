import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { IfBlock } from './IfBlock';
import type { Block } from './types';

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
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('if')).toBeInTheDocument();
      expect(screen.getByText(/condition/i)).toBeInTheDocument();
      expect(screen.getByText(/then/i)).toBeInTheDocument();
      expect(screen.getByText(/else/i)).toBeInTheDocument();
    });

    it('should render with conditional icon', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('🔀')).toBeInTheDocument();
    });

    it('should have conditional type styling', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).toHaveClass('border-yellow-500');
    });
  });

  describe('Structure', () => {
    it('should display condition, then, and else labels', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Condition:')).toBeInTheDocument();
      expect(screen.getByText('Then:')).toBeInTheDocument();
      expect(screen.getByText('Else:')).toBeInTheDocument();
    });

    it('should render nested blocks for each part', () => {
      const mockOnChange = vi.fn();
      const { container } = render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      // Should have nested block structure
      const articles = container.querySelectorAll('[role="region"]');
      expect(articles.length).toBeGreaterThan(1); // Parent + nested blocks
    });
  });

  describe('Validation', () => {
    it('should show invalid state when condition is missing', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={undefined}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('data-invalid', true);
      expect(screen.getByText(/condition is required/i)).toBeInTheDocument();
    });

    it('should show invalid state when thenValue is missing', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={undefined}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('data-invalid', true);
      expect(screen.getByText(/then value is required/i)).toBeInTheDocument();
    });

    it('should show invalid state when elseValue is missing', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={undefined}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('data-invalid', true);
      expect(screen.getByText(/else value is required/i)).toBeInTheDocument();
    });

    it('should not show invalid state when all parts are present', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).not.toHaveAttribute('data-invalid', true);
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnChange = vi.fn();
      const mockOnDelete = vi.fn();

      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await deleteButton.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Placeholder rendering', () => {
    it('should show placeholder for missing condition', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={undefined}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/add condition/i)).toBeInTheDocument();
    });

    it('should show placeholder for missing then value', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={undefined}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/add then value/i)).toBeInTheDocument();
    });

    it('should show placeholder for missing else value', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={undefined}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/add else value/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('aria-label', 'if operator block');
    });

    it('should be collapsible by default', () => {
      const mockOnChange = vi.fn();
      render(
        <IfBlock
          condition={mockConditionBlock}
          thenValue={mockThenBlock}
          elseValue={mockElseBlock}
          onChange={mockOnChange}
        />
      );

      const collapseButton = screen.getByRole('button', { name: /collapse/i });
      expect(collapseButton).toBeInTheDocument();
    });
  });
});
