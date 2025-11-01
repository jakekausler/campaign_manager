import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { LogicalBlock } from './LogicalBlock';
import type { Block } from './types';

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
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="and" onChange={mockOnChange}>
          {[mockChild1, mockChild2]}
        </LogicalBlock>
      );

      expect(screen.getByText('and')).toBeInTheDocument();
    });

    it('should have logical type styling', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="and" onChange={mockOnChange}>
          {[mockChild1, mockChild2]}
        </LogicalBlock>
      );

      const block = screen.getByRole('region');
      expect(block).toHaveClass('border-purple-500');
    });

    it('should render all children', () => {
      const mockOnChange = vi.fn();
      const { container } = render(
        <LogicalBlock operator="and" onChange={mockOnChange}>
          {[mockChild1, mockChild2]}
        </LogicalBlock>
      );

      // Should have nested block structure
      const articles = container.querySelectorAll('[role="region"]');
      expect(articles.length).toBeGreaterThan(1); // Parent + children
    });
  });

  describe('OR operator', () => {
    it('should render OR operator with children', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="or" onChange={mockOnChange}>
          {[mockChild1, mockChild2]}
        </LogicalBlock>
      );

      expect(screen.getByText('or')).toBeInTheDocument();
    });

    it('should have logical type styling', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="or" onChange={mockOnChange}>
          {[mockChild1, mockChild2]}
        </LogicalBlock>
      );

      const block = screen.getByRole('region');
      expect(block).toHaveClass('border-purple-500');
    });
  });

  describe('NOT operator', () => {
    it('should render NOT operator with single child', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="!" onChange={mockOnChange}>
          {[mockChild1]}
        </LogicalBlock>
      );

      expect(screen.getByText('not')).toBeInTheDocument();
    });

    it('should show invalid state when NOT has multiple children', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="!" onChange={mockOnChange}>
          {[mockChild1, mockChild2]}
        </LogicalBlock>
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('data-invalid', true);
      expect(screen.getByText(/NOT operator requires exactly one child/i)).toBeInTheDocument();
    });

    it('should show invalid state when NOT has no children', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="!" onChange={mockOnChange}>
          {[]}
        </LogicalBlock>
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('data-invalid', true);
      expect(screen.getByText(/NOT operator requires exactly one child/i)).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show invalid state when AND/OR has no children', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="and" onChange={mockOnChange}>
          {[]}
        </LogicalBlock>
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('data-invalid', true);
      expect(screen.getByText(/requires at least one child/i)).toBeInTheDocument();
    });

    it('should not show invalid state when AND/OR has children', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="and" onChange={mockOnChange}>
          {[mockChild1]}
        </LogicalBlock>
      );

      const block = screen.getByRole('region');
      expect(block).not.toHaveAttribute('data-invalid', true);
    });
  });

  describe('Empty state', () => {
    it('should show placeholder when no children', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="and" onChange={mockOnChange}>
          {[]}
        </LogicalBlock>
      );

      expect(screen.getByText(/add condition/i)).toBeInTheDocument();
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnChange = vi.fn();
      const mockOnDelete = vi.fn();

      render(
        <LogicalBlock operator="and" onChange={mockOnChange} onDelete={mockOnDelete}>
          {[mockChild1]}
        </LogicalBlock>
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await deleteButton.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels for AND', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="and" onChange={mockOnChange}>
          {[mockChild1]}
        </LogicalBlock>
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('aria-label', 'and operator block');
    });

    it('should have appropriate ARIA labels for OR', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="or" onChange={mockOnChange}>
          {[mockChild1]}
        </LogicalBlock>
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('aria-label', 'or operator block');
    });

    it('should have appropriate ARIA labels for NOT', () => {
      const mockOnChange = vi.fn();
      render(
        <LogicalBlock operator="!" onChange={mockOnChange}>
          {[mockChild1]}
        </LogicalBlock>
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('aria-label', 'not operator block');
    });
  });
});
