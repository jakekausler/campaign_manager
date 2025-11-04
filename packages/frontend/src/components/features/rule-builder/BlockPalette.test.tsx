import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import { BlockPalette } from './BlockPalette';
import type { Block } from './types';

describe('BlockPalette', () => {
  const mockOnAddBlock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup(); // Unmount all React components and hooks
  });

  describe('Rendering', () => {
    it('should render all block categories', () => {
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      expect(screen.getByText('Conditional')).toBeInTheDocument();
      expect(screen.getByText('Logical')).toBeInTheDocument();
      expect(screen.getByText('Comparison')).toBeInTheDocument();
      expect(screen.getByText('Arithmetic')).toBeInTheDocument();
      expect(screen.getByText('Values')).toBeInTheDocument();
    });

    it('should have accessible region role', () => {
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      expect(screen.getByRole('region', { name: /block palette/i })).toBeInTheDocument();
    });

    it('should have test id', () => {
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      expect(screen.getByTestId('block-palette')).toBeInTheDocument();
    });
  });

  describe('Conditional category', () => {
    it('should render If-Then-Else button', () => {
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      expect(screen.getByText('If-Then-Else')).toBeInTheDocument();
    });

    it('should create if block with correct structure when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('If-Then-Else'));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('if');
      expect(block.type).toBe('conditional');
      expect(block.children).toHaveLength(3);
    });
  });

  describe('Logical category', () => {
    it('should render all logical operators', () => {
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      expect(screen.getByText('AND')).toBeInTheDocument();
      expect(screen.getByText('OR')).toBeInTheDocument();
      expect(screen.getByText('NOT')).toBeInTheDocument();
    });

    it('should create AND block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('AND'));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('and');
      expect(block.type).toBe('logical');
      expect(block.children).toHaveLength(2);
    });

    it('should create OR block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('OR'));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('or');
      expect(block.type).toBe('logical');
      expect(block.children).toHaveLength(2);
    });

    it('should create NOT block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('NOT'));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('!');
      expect(block.type).toBe('logical');
      expect(block.children).toHaveLength(1);
    });
  });

  describe('Comparison category', () => {
    it('should render all comparison operators', () => {
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      expect(screen.getByText(/equal \(==\)/i)).toBeInTheDocument();
      expect(screen.getByText(/not equal \(!=\)/i)).toBeInTheDocument();
      expect(screen.getByText(/greater than \(>\)/i)).toBeInTheDocument();
      expect(screen.getByText(/greater or equal \(>=\)/i)).toBeInTheDocument();
      expect(screen.getByText(/less than \(<\)/i)).toBeInTheDocument();
      expect(screen.getByText(/less or equal \(<=\)/i)).toBeInTheDocument();
    });

    it('should create equality block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText(/equal \(==\)/i));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('==');
      expect(block.type).toBe('comparison');
      expect(block.children).toHaveLength(2);
    });

    it('should create greater than block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText(/greater than \(>\)/i));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('>');
      expect(block.type).toBe('comparison');
    });
  });

  describe('Arithmetic category', () => {
    it('should render all arithmetic operators', () => {
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      expect(screen.getByText(/add \(\+\)/i)).toBeInTheDocument();
      expect(screen.getByText(/subtract \(-\)/i)).toBeInTheDocument();
      expect(screen.getByText(/multiply \(\*\)/i)).toBeInTheDocument();
      expect(screen.getByText(/divide \(\/\)/i)).toBeInTheDocument();
      expect(screen.getByText(/modulo \(%\)/i)).toBeInTheDocument();
    });

    it('should create addition block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText(/add \(\+\)/i));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('+');
      expect(block.type).toBe('arithmetic');
      expect(block.children).toHaveLength(2);
    });

    it('should create multiplication block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText(/multiply \(\*\)/i));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('*');
      expect(block.type).toBe('arithmetic');
    });
  });

  describe('Values category', () => {
    it('should render all value types', () => {
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      expect(screen.getByText('Variable')).toBeInTheDocument();
      expect(screen.getByText('Number')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('Boolean')).toBeInTheDocument();
      expect(screen.getByText('Null')).toBeInTheDocument();
    });

    it('should create variable block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('Variable'));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('var');
      expect(block.type).toBe('variable');
      expect(block.value).toBe('path.to.variable');
    });

    it('should create number literal block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('Number'));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('literal');
      expect(block.type).toBe('literal');
      expect(block.value).toBe(0);
    });

    it('should create text literal block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('Text'));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('literal');
      expect(block.type).toBe('literal');
      expect(block.value).toBe('');
    });

    it('should create boolean literal block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('Boolean'));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('literal');
      expect(block.type).toBe('literal');
      expect(block.value).toBe(true);
    });

    it('should create null literal block when clicked', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('Null'));

      expect(mockOnAddBlock).toHaveBeenCalledTimes(1);
      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.operator).toBe('literal');
      expect(block.type).toBe('literal');
      expect(block.value).toBe(null);
    });
  });

  describe('Block structure validation', () => {
    it('should create blocks with valid IDs', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('Number'));

      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block.id).toBeDefined();
      expect(typeof block.id).toBe('string');
      expect(block.id.length).toBeGreaterThan(0);
    });

    it('should create blocks with required fields', async () => {
      const user = userEvent.setup();
      render(<BlockPalette onAddBlock={mockOnAddBlock} />);

      await user.click(screen.getByText('Number'));

      const block: Block = mockOnAddBlock.mock.calls[0][0];
      expect(block).toHaveProperty('id');
      expect(block).toHaveProperty('type');
      expect(block).toHaveProperty('operator');
    });
  });
});
