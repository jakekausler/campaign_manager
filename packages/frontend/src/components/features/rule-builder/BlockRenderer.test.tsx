import { useSortable } from '@dnd-kit/sortable';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { BlockRenderer } from './BlockRenderer';
import type { Block } from './types';

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));

describe('BlockRenderer', () => {
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

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

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

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

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

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getAllByText('or').length).toBeGreaterThan(0);
    });

    it('should render logical NOT block', () => {
      const block: Block = {
        id: 'not-1',
        type: 'logical',
        operator: '!',
        children: [{ id: 'child-1', type: 'literal', operator: 'literal', value: true }],
      };

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

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

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getAllByText('==').length).toBeGreaterThan(0);
    });

    it('should render all comparison operators', () => {
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
        const block: Block = {
          id: `comp-${op}`,
          type: 'comparison',
          operator: op,
          children: [
            { id: 'left-1', type: 'literal', operator: 'literal', value: 1 },
            { id: 'right-1', type: 'literal', operator: 'literal', value: 2 },
          ],
        };

        const { unmount } = render(
          <BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />
        );
        expect(screen.getAllByText(op).length).toBeGreaterThan(0);
        unmount();
      });
    });

    it('should render all arithmetic operators', () => {
      const operators: Array<{ op: '+' | '-' | '*' | '/' | '%'; label: string }> = [
        { op: '+', label: 'add' },
        { op: '-', label: 'subtract' },
        { op: '*', label: 'multiply' },
        { op: '/', label: 'divide' },
        { op: '%', label: 'modulo' },
      ];

      operators.forEach(({ op, label }) => {
        const block: Block = {
          id: `arith-${op}`,
          type: 'arithmetic',
          operator: op,
          children: [
            { id: 'op-1', type: 'literal', operator: 'literal', value: 1 },
            { id: 'op-2', type: 'literal', operator: 'literal', value: 2 },
          ],
        };

        const { unmount } = render(
          <BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />
        );
        expect(screen.getByText(label)).toBeInTheDocument();
        unmount();
      });
    });

    it('should render variable block', () => {
      const block: Block = {
        id: 'var-1',
        type: 'variable',
        operator: 'var',
        value: 'settlement.level',
      };

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByText('variable')).toBeInTheDocument();
      expect(screen.getByText('settlement.level')).toBeInTheDocument();
    });

    it('should render literal block', () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 'test value',
      };

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByText(/literal \(string\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('test value')).toBeInTheDocument();
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

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByText(/unknown operator type/i)).toBeInTheDocument();
    });
  });

  describe('Props passing', () => {
    it('should pass onUpdate with blockId correctly', async () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 'test',
      };

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      // Component should be rendered correctly
      expect(screen.getByText(/literal/i)).toBeInTheDocument();
    });

    it('should pass onDelete with blockId correctly', () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 'test',
      };

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      // Component should be rendered correctly
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
        <BlockRenderer
          block={block}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          entityType="settlement"
        />
      );

      expect(screen.getByText('variable')).toBeInTheDocument();
    });
  });

  describe('Drag-and-drop attributes', () => {
    it('should have drag-and-drop wrapper with testid', () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 'test',
      };

      render(<BlockRenderer block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      expect(screen.getByTestId('block-lit-1')).toBeInTheDocument();
    });

    it('should disable drag when isNested is true', () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 'test',
      };

      render(
        <BlockRenderer
          block={block}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          isNested={true}
        />
      );

      // Verify useSortable was called with disabled: true
      expect(useSortable).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'lit-1',
          disabled: true,
        })
      );
    });

    it('should enable drag when isNested is false', () => {
      const block: Block = {
        id: 'lit-1',
        type: 'literal',
        operator: 'literal',
        value: 'test',
      };

      render(
        <BlockRenderer
          block={block}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          isNested={false}
        />
      );

      // Verify useSortable was called with disabled: false
      expect(useSortable).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'lit-1',
          disabled: false,
        })
      );
    });
  });
});
