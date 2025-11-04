import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { LiteralBlock } from './LiteralBlock';
import type { Block, LiteralValue } from './types';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks();
});

// Helper function to create a literal block
function createLiteralBlock(value: LiteralValue): Block {
  return {
    id: 'lit-1',
    type: 'literal',
    operator: 'literal',
    value,
  };
}

describe('LiteralBlock', () => {
  describe('Rendering', () => {
    it('should render string literal', () => {
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock('test');

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/literal \(string\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    });

    it('should render number literal', () => {
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock(42);

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/literal \(number\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('42')).toBeInTheDocument();
    });

    it('should render boolean literal', () => {
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock(true);

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/literal \(boolean\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('true')).toBeInTheDocument();
    });

    it('should render null literal', () => {
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock(null);

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.getByText(/literal \(null\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('null')).toBeInTheDocument();
    });

    it('should have literal type styling', () => {
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock('test');

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /literal operator block/i });
      expect(blockElement).toHaveClass('border-gray-500');
    });

    it('should not be collapsible', () => {
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock('test');

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      expect(screen.queryByRole('button', { name: /collapse/i })).not.toBeInTheDocument();
    });
  });

  describe('String value editing', () => {
    it('should call onUpdate when string value changes', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock('');

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      const input = screen.getByDisplayValue('') as HTMLInputElement;
      await user.type(input, 'test');

      // onUpdate should be called for each character typed
      expect(mockOnUpdate).toHaveBeenCalled();
      // Check that all calls have the correct structure
      mockOnUpdate.mock.calls.forEach((call) => {
        expect(call[0]).toHaveProperty('id');
        expect(call[0]).toHaveProperty('type', 'literal');
        expect(call[0]).toHaveProperty('operator', 'literal');
        expect(call[0]).toHaveProperty('value');
        expect(typeof call[0].value).toBe('string');
      });
    });
  });

  describe('Number value editing', () => {
    it('should call onUpdate when number value changes', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock(0);

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      const input = screen.getByDisplayValue('0') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '5');

      // onUpdate should be called at least once
      expect(mockOnUpdate).toHaveBeenCalled();
      // Check that all calls have the correct structure with number values
      mockOnUpdate.mock.calls.forEach((call) => {
        expect(call[0]).toHaveProperty('id');
        expect(call[0]).toHaveProperty('type', 'literal');
        expect(call[0]).toHaveProperty('operator', 'literal');
        expect(call[0]).toHaveProperty('value');
        expect(typeof call[0].value).toBe('number');
      });
    });
  });

  describe('Boolean value editing', () => {
    it('should toggle boolean value', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock(true);

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      const select = screen.getByDisplayValue('true');
      await user.selectOptions(select, 'false');

      expect(mockOnUpdate).toHaveBeenCalled();
      const lastCall = mockOnUpdate.mock.calls[mockOnUpdate.mock.calls.length - 1][0];
      expect(lastCall.value).toBe(false);
    });
  });

  describe('Updates', () => {
    it('should call onUpdate with complete block object', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock('test');

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      const input = screen.getByDisplayValue('test');
      await user.clear(input);
      await user.type(input, 'x');

      expect(mockOnUpdate).toHaveBeenCalled();
      const lastCall = mockOnUpdate.mock.calls[mockOnUpdate.mock.calls.length - 1][0];
      expect(lastCall).toHaveProperty('id');
      expect(lastCall).toHaveProperty('type');
      expect(lastCall).toHaveProperty('operator');
      expect(lastCall).toHaveProperty('value');
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnUpdate = vi.fn();
      const mockOnDelete = vi.fn();
      const block = createLiteralBlock('test');

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await deleteButton.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels', () => {
      const mockOnUpdate = vi.fn();
      const block = createLiteralBlock('test');

      render(<LiteralBlock block={block} onUpdate={mockOnUpdate} />);

      const blockElement = screen.getByRole('region', { name: /literal operator block/i });
      expect(blockElement).toHaveAttribute('aria-label', 'literal operator block');
    });
  });
});
