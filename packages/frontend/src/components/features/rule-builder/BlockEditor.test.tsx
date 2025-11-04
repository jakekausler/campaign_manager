import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import { BlockEditor } from './BlockEditor';
import type { JSONLogicExpression } from './types';

// Mock @dnd-kit modules
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn((arr, oldIndex, newIndex) => {
    const newArr = [...arr];
    const [removed] = newArr.splice(oldIndex, 1);
    newArr.splice(newIndex, 0, removed);
    return newArr;
  }),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));

// Mock helper functions
vi.mock('./helpers', () => ({
  parseExpression: vi.fn((expr) => {
    // Simple mock implementation
    if (!expr) return [];
    if (typeof expr === 'object' && 'var' in expr) {
      return [
        {
          id: 'parsed-1',
          type: 'variable',
          operator: 'var',
          value: expr.var,
        },
      ];
    }
    if (typeof expr !== 'object') {
      return [
        {
          id: 'parsed-1',
          type: 'literal',
          operator: 'literal',
          value: expr,
        },
      ];
    }
    return [];
  }),
  serializeBlocks: vi.fn((blocks) => {
    // Simple mock serialization
    if (blocks.length === 0) return null;
    if (blocks.length === 1) {
      const block = blocks[0];
      if (block.operator === 'var') return { var: block.value };
      if (block.operator === 'literal') return block.value;
    }
    return { blocks: blocks.length };
  }),
  generateId: vi.fn(() => 'test-id-' + Math.random().toString(36).substring(2, 11)),
}));

describe('BlockEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup(); // Unmount all React components and hooks
  });

  describe('Rendering', () => {
    it('should render with header', () => {
      render(<BlockEditor />);

      expect(screen.getByText('Visual Rule Builder')).toBeInTheDocument();
    });

    it('should render add block button', () => {
      render(<BlockEditor />);

      expect(screen.getByTestId('add-block-button')).toBeInTheDocument();
      expect(screen.getByText('+ Add Block')).toBeInTheDocument();
    });

    it('should have main container with test id', () => {
      render(<BlockEditor />);

      expect(screen.getByTestId('block-editor')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no blocks', () => {
      render(<BlockEditor />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/no blocks yet/i)).toBeInTheDocument();
    });

    it('should not show blocks container when empty', () => {
      render(<BlockEditor />);

      expect(screen.queryByTestId('blocks-container')).not.toBeInTheDocument();
    });
  });

  describe('Initial expression parsing', () => {
    it('should parse initial expression into blocks', () => {
      const expression: JSONLogicExpression = { var: 'status' };

      render(<BlockEditor expression={expression} />);

      // Should not show empty state
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
      // Should show blocks container
      expect(screen.getByTestId('blocks-container')).toBeInTheDocument();
    });

    it('should render blocks from initial expression', () => {
      const expression: JSONLogicExpression = { var: 'settlement.level' };

      render(<BlockEditor expression={expression} />);

      // Should render variable block
      expect(screen.getByText('variable')).toBeInTheDocument();
      expect(screen.getByText('settlement.level')).toBeInTheDocument();
    });
  });

  describe('Block Palette', () => {
    it('should not show palette by default', () => {
      render(<BlockEditor />);

      expect(screen.queryByTestId('block-palette')).not.toBeInTheDocument();
    });

    it('should toggle palette when button clicked', async () => {
      const user = userEvent.setup();
      render(<BlockEditor />);

      const addButton = screen.getByTestId('add-block-button');
      await user.click(addButton);

      expect(screen.getByTestId('block-palette')).toBeInTheDocument();
      expect(screen.getByText('Close Palette')).toBeInTheDocument();
    });

    it('should close palette when clicked again', async () => {
      const user = userEvent.setup();
      render(<BlockEditor />);

      const addButton = screen.getByTestId('add-block-button');
      await user.click(addButton);
      expect(screen.getByTestId('block-palette')).toBeInTheDocument();

      await user.click(addButton);
      expect(screen.queryByTestId('block-palette')).not.toBeInTheDocument();
    });
  });

  describe('Adding blocks', () => {
    it('should add block from palette', async () => {
      const user = userEvent.setup();
      render(<BlockEditor onChange={mockOnChange} />);

      // Open palette
      await user.click(screen.getByTestId('add-block-button'));

      // Add a number block
      await user.click(screen.getByText('Number'));

      // Should show blocks container
      expect(screen.getByTestId('blocks-container')).toBeInTheDocument();
      // Should not show empty state
      expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    });

    it('should close palette after adding block', async () => {
      const user = userEvent.setup();
      render(<BlockEditor onChange={mockOnChange} />);

      // Open palette
      await user.click(screen.getByTestId('add-block-button'));
      expect(screen.getByTestId('block-palette')).toBeInTheDocument();

      // Add a block
      await user.click(screen.getByText('Number'));

      // Palette should be closed
      expect(screen.queryByTestId('block-palette')).not.toBeInTheDocument();
    });

    it('should call onChange after adding block', async () => {
      const user = userEvent.setup();
      render(<BlockEditor onChange={mockOnChange} />);

      // Open palette and add block
      await user.click(screen.getByTestId('add-block-button'));
      await user.click(screen.getByText('Number'));

      // onChange should be called with serialized blocks
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Deleting blocks', () => {
    it('should remove block when deleted', async () => {
      const user = userEvent.setup();
      render(<BlockEditor onChange={mockOnChange} />);

      // Add a block
      await user.click(screen.getByTestId('add-block-button'));
      await user.click(screen.getByText('Number'));

      // Find and click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Should show empty state again
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('should call onChange after deleting block', async () => {
      const user = userEvent.setup();
      render(<BlockEditor onChange={mockOnChange} />);

      mockOnChange.mockClear();

      // Add a block
      await user.click(screen.getByTestId('add-block-button'));
      await user.click(screen.getByText('Number'));

      mockOnChange.mockClear();

      // Delete the block
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // onChange should be called with empty serialization
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Updating blocks', () => {
    it('should update block when modified', async () => {
      const user = userEvent.setup();
      render(<BlockEditor onChange={mockOnChange} />);

      // Add a number block
      await user.click(screen.getByTestId('add-block-button'));
      await user.click(screen.getByText('Number'));

      mockOnChange.mockClear();

      // Find the input and change value
      const input = screen.getByDisplayValue('0');
      await user.clear(input);
      await user.type(input, '42');

      // onChange should be called
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('onChange callback', () => {
    it('should call onChange with serialized JSONLogic', async () => {
      const user = userEvent.setup();
      render(<BlockEditor onChange={mockOnChange} />);

      // Add a block
      await user.click(screen.getByTestId('add-block-button'));
      await user.click(screen.getByText('Number'));

      // Should serialize and call onChange
      expect(mockOnChange).toHaveBeenCalled();
      // Verify it's called with a value (mocked serialization)
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(lastCall).toBeDefined();
    });

    it('should not call onChange when not provided', async () => {
      const user = userEvent.setup();
      render(<BlockEditor />);

      // Should render without errors
      expect(screen.getByTestId('block-editor')).toBeInTheDocument();

      // Add a block - should not throw
      await user.click(screen.getByTestId('add-block-button'));
      await user.click(screen.getByText('Number'));

      expect(screen.getByTestId('blocks-container')).toBeInTheDocument();
    });
  });

  describe('Entity type', () => {
    it('should pass entityType to child components', () => {
      const expression: JSONLogicExpression = { var: 'status' };
      render(<BlockEditor expression={expression} entityType="settlement" />);

      // Component should render without errors
      expect(screen.getByText('variable')).toBeInTheDocument();
    });

    it('should use default entityType when not provided', () => {
      const expression: JSONLogicExpression = { var: 'status' };
      render(<BlockEditor expression={expression} />);

      // Component should render without errors
      expect(screen.getByText('variable')).toBeInTheDocument();
    });
  });

  describe('Drag-and-drop', () => {
    it('should render blocks in sortable context', () => {
      const expression: JSONLogicExpression = { var: 'status' };
      render(<BlockEditor expression={expression} />);

      // Blocks should be rendered
      expect(screen.getByTestId('blocks-container')).toBeInTheDocument();
    });

    it('should have DndContext wrapping blocks', () => {
      const expression: JSONLogicExpression = { var: 'status' };
      render(<BlockEditor expression={expression} />);

      // Should render blocks container
      expect(screen.getByTestId('blocks-container')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible add button', () => {
      render(<BlockEditor />);

      const button = screen.getByRole('button', { name: /add new block/i });
      expect(button).toBeInTheDocument();
    });

    it('should have descriptive empty state', () => {
      render(<BlockEditor />);

      const emptyState = screen.getByTestId('empty-state');
      expect(within(emptyState).getByText(/click.*add block.*to get started/i)).toBeInTheDocument();
    });
  });
});
