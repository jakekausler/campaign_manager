import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { OperatorBlock } from './OperatorBlock';
import type { OperatorType } from './types';

describe('OperatorBlock', () => {
  describe('Rendering', () => {
    it('should render with basic props', () => {
      render(
        <OperatorBlock operator="and" type="logical">
          <div>Child content</div>
        </OperatorBlock>
      );

      expect(screen.getByText('and')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should render with custom label', () => {
      render(
        <OperatorBlock operator="==" type="comparison" label="equals">
          <div>Content</div>
        </OperatorBlock>
      );

      expect(screen.getByText('equals')).toBeInTheDocument();
    });

    it('should apply different styles based on operator type', () => {
      const { rerender } = render(
        <OperatorBlock operator="and" type="logical">
          <div>Content</div>
        </OperatorBlock>
      );

      const logicalBlock = screen.getByText('and').closest('div');
      expect(logicalBlock).toHaveClass('border-purple-500');

      rerender(
        <OperatorBlock operator="==" type="comparison">
          <div>Content</div>
        </OperatorBlock>
      );

      const comparisonBlock = screen.getByText('==').closest('div');
      expect(comparisonBlock).toHaveClass('border-blue-500');
    });

    it('should render with icon when provided', () => {
      render(
        <OperatorBlock operator="if" type="conditional" icon="🔀">
          <div>Content</div>
        </OperatorBlock>
      );

      expect(screen.getByText('🔀')).toBeInTheDocument();
    });
  });

  describe('Collapse/Expand', () => {
    it('should start expanded by default', () => {
      render(
        <OperatorBlock operator="and" type="logical">
          <div>Child content</div>
        </OperatorBlock>
      );

      expect(screen.getByText('Child content')).toBeVisible();
    });

    it('should toggle collapsed state when clicking collapse button', async () => {
      const user = userEvent.setup();
      render(
        <OperatorBlock operator="and" type="logical" collapsible>
          <div>Child content</div>
        </OperatorBlock>
      );

      const collapseButton = screen.getByRole('button', { name: /collapse/i });
      expect(screen.getByText('Child content')).toBeVisible();

      await user.click(collapseButton);
      expect(screen.queryByText('Child content')).not.toBeVisible();

      await user.click(collapseButton);
      expect(screen.getByText('Child content')).toBeVisible();
    });

    it('should not show collapse button when collapsible is false', () => {
      render(
        <OperatorBlock operator="and" type="logical" collapsible={false}>
          <div>Child content</div>
        </OperatorBlock>
      );

      expect(screen.queryByRole('button', { name: /collapse/i })).not.toBeInTheDocument();
    });

    it('should respect defaultCollapsed prop', () => {
      render(
        <OperatorBlock operator="and" type="logical" collapsible defaultCollapsed>
          <div>Child content</div>
        </OperatorBlock>
      );

      expect(screen.queryByText('Child content')).not.toBeVisible();
    });
  });

  describe('Validation', () => {
    it('should show error state when invalid', () => {
      render(
        <OperatorBlock operator="and" type="logical" invalid>
          <div>Content</div>
        </OperatorBlock>
      );

      const block = screen.getByText('and').closest('div');
      expect(block).toHaveClass('border-red-500');
    });

    it('should display error message when provided', () => {
      render(
        <OperatorBlock operator="and" type="logical" invalid errorMessage="Missing operand">
          <div>Content</div>
        </OperatorBlock>
      );

      expect(screen.getByText('Missing operand')).toBeInTheDocument();
    });

    it('should not show error message when invalid is false', () => {
      render(
        <OperatorBlock operator="and" type="logical" invalid={false} errorMessage="Should not show">
          <div>Content</div>
        </OperatorBlock>
      );

      expect(screen.queryByText('Should not show')).not.toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();

      render(
        <OperatorBlock operator="and" type="logical" onDelete={onDelete}>
          <div>Content</div>
        </OperatorBlock>
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('should not show delete button when onDelete is not provided', () => {
      render(
        <OperatorBlock operator="and" type="logical">
          <div>Content</div>
        </OperatorBlock>
      );

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should render custom actions when provided', () => {
      render(
        <OperatorBlock operator="and" type="logical" actions={<button>Custom Action</button>}>
          <div>Content</div>
        </OperatorBlock>
      );

      expect(screen.getByRole('button', { name: 'Custom Action' })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels', () => {
      render(
        <OperatorBlock operator="and" type="logical">
          <div>Content</div>
        </OperatorBlock>
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('aria-label', 'and operator block');
    });

    it('should mark invalid blocks with aria-invalid', () => {
      render(
        <OperatorBlock operator="and" type="logical" invalid>
          <div>Content</div>
        </OperatorBlock>
      );

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('data-invalid', true);
    });

    it('should have aria-expanded attribute when collapsible', () => {
      render(
        <OperatorBlock operator="and" type="logical" collapsible>
          <div>Content</div>
        </OperatorBlock>
      );

      const collapseButton = screen.getByRole('button', { name: /collapse/i });
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Type-specific styling', () => {
    const typeTestCases: Array<{ type: OperatorType; expectedClass: string }> = [
      { type: 'logical', expectedClass: 'border-purple-500' },
      { type: 'comparison', expectedClass: 'border-blue-500' },
      { type: 'arithmetic', expectedClass: 'border-green-500' },
      { type: 'conditional', expectedClass: 'border-yellow-500' },
      { type: 'variable', expectedClass: 'border-indigo-500' },
      { type: 'literal', expectedClass: 'border-gray-500' },
    ];

    typeTestCases.forEach(({ type, expectedClass }) => {
      it(`should apply ${expectedClass} for ${type} type`, () => {
        render(
          <OperatorBlock operator="test" type={type}>
            <div>Content</div>
          </OperatorBlock>
        );

        const block = screen.getByText('test').closest('div');
        expect(block).toHaveClass(expectedClass);
      });
    });
  });
});
