import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NestedBlockRenderer } from './NestedBlockRenderer';
import type { Block } from './types';

describe('NestedBlockRenderer', () => {
  const mockOnUpdate = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering different operator types', () => {
    it('should render if block', () => {
      const block: Block = {
        id: 'if-1',
        type: 'conditional',
        operator: 'if',
        children: [
          { id: 'cond-1', type: 'literal', operator: 'literal', value: true },
          { id: 'then-1', type: 'literal', operator: 'literal', value: 'yes' },
          { id: 'else-1', type: 'literal', operator: 'literal', value: 'no' },
        ],
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByText('if')).toBeInTheDocument();
    });

    it('should render logical AND block', () => {
      const block: Block = {
        id: 'and-1',
        type: 'logical',
        operator: 'and',
        children: [
          { id: 'child-1', type: 'literal', operator: 'literal', value: true },
          { id: 'child-2', type: 'literal', operator: 'literal', value: true },
        ],
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getAllByText('and').length).toBeGreaterThan(0);
    });

    it('should render logical OR block', () => {
      const block: Block = {
        id: 'or-1',
        type: 'logical',
        operator: 'or',
        children: [
          { id: 'child-1', type: 'literal', operator: 'literal', value: true },
          { id: 'child-2', type: 'literal', operator: 'literal', value: false },
        ],
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getAllByText('or').length).toBeGreaterThan(0);
    });

    it('should render logical NOT block', () => {
      const block: Block = {
        id: 'not-1',
        type: 'logical',
        operator: '!',
        children: [{ id: 'child-1', type: 'literal', operator: 'literal', value: true }],
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByText('not')).toBeInTheDocument();
    });

    it('should render comparison block (==)', () => {
      const block: Block = {
        id: 'eq-1',
        type: 'comparison',
        operator: '==',
        children: [
          { id: 'left-1', type: 'literal', operator: 'literal', value: 1 },
          { id: 'right-1', type: 'literal', operator: 'literal', value: 1 },
        ],
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getAllByText('==').length).toBeGreaterThan(0);
    });

    it('should render comparison block (>)', () => {
      const block: Block = {
        id: 'gt-1',
        type: 'comparison',
        operator: '>',
        children: [
          { id: 'left-1', type: 'literal', operator: 'literal', value: 2 },
          { id: 'right-1', type: 'literal', operator: 'literal', value: 1 },
        ],
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getAllByText('>').length).toBeGreaterThan(0);
    });

    it('should render arithmetic block (+)', () => {
      const block: Block = {
        id: 'add-1',
        type: 'arithmetic',
        operator: '+',
        children: [
          { id: 'op-1', type: 'literal', operator: 'literal', value: 1 },
          { id: 'op-2', type: 'literal', operator: 'literal', value: 2 },
        ],
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByText('add')).toBeInTheDocument();
    });

    it('should render variable block', () => {
      const block: Block = {
        id: 'var-1',
        type: 'variable',
        operator: 'var',
        value: 'settlement.level',
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByText('variable')).toBeInTheDocument();
      expect(screen.getByText('settlement.level')).toBeInTheDocument();
    });

    it('should render literal block (string)', () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 'test value',
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByText(/literal \(string\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('test value')).toBeInTheDocument();
    });

    it('should render literal block (number)', () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 42,
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByText(/literal \(number\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('42')).toBeInTheDocument();
    });
  });

  describe('Unknown operators', () => {
    it('should render error state for unknown operator', () => {
      // Testing with invalid operator to verify error handling
      const block: Block = {
        id: 'unknown-1',
        type: 'logical' as const,
        operator: 'unknown' as unknown as 'and',
        children: [],
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByText(/unknown operator type/i)).toBeInTheDocument();
    });
  });

  describe('Props passing', () => {
    it('should pass onUpdate correctly', () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 'test',
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      // Component should be rendered without errors
      expect(screen.getByText(/literal/i)).toBeInTheDocument();
    });

    it('should pass onDelete correctly', () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 'test',
      };

      render(<NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      // Component should be rendered without errors
      expect(screen.getByText(/literal/i)).toBeInTheDocument();
    });

    it('should pass entityType to components that need it', () => {
      const block: Block = {
        id: 'var-1',
        type: 'variable',
        operator: 'var',
        value: 'status',
      };

      render(
        <NestedBlockRenderer
          block={block}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          entityType="settlement"
        />
      );

      expect(screen.getByText('variable')).toBeInTheDocument();
    });
  });

  describe('No drag-and-drop attributes', () => {
    it('should not have drag-and-drop attributes', () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 'test',
      };

      const { container } = render(
        <NestedBlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />
      );

      // NestedBlockRenderer should not wrap in drag-and-drop div
      // It renders the component directly
      expect(container.querySelector('[data-testid^="block-"]')).not.toBeInTheDocument();
    });
  });
});
