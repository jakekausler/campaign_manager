import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { LiteralBlock } from './LiteralBlock';

describe('LiteralBlock', () => {
  describe('Rendering', () => {
    it('should render string literal', () => {
      const mockOnChange = vi.fn();
      render(<LiteralBlock value="test" onChange={mockOnChange} />);

      expect(screen.getByText(/literal \(string\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    });

    it('should render number literal', () => {
      const mockOnChange = vi.fn();
      render(<LiteralBlock value={42} onChange={mockOnChange} />);

      expect(screen.getByText(/literal \(number\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('42')).toBeInTheDocument();
    });

    it('should render boolean literal', () => {
      const mockOnChange = vi.fn();
      render(<LiteralBlock value={true} onChange={mockOnChange} />);

      expect(screen.getByText(/literal \(boolean\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('true')).toBeInTheDocument();
    });

    it('should render null literal', () => {
      const mockOnChange = vi.fn();
      render(<LiteralBlock value={null} onChange={mockOnChange} />);

      expect(screen.getByText(/literal \(null\)/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('null')).toBeInTheDocument();
    });

    it('should have literal type styling', () => {
      const mockOnChange = vi.fn();
      render(<LiteralBlock value="test" onChange={mockOnChange} />);

      const block = screen.getByRole('region');
      expect(block).toHaveClass('border-gray-500');
    });

    it('should not be collapsible', () => {
      const mockOnChange = vi.fn();
      render(<LiteralBlock value="test" onChange={mockOnChange} />);

      expect(screen.queryByRole('button', { name: /collapse/i })).not.toBeInTheDocument();
    });
  });

  describe('String value editing', () => {
    it('should call onChange when string value changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      render(<LiteralBlock value="test" onChange={mockOnChange} />);

      const input = screen.getByDisplayValue('test');
      await user.clear(input);
      await user.type(input, 'new value');

      expect(mockOnChange).toHaveBeenCalledWith('new value');
    });
  });

  describe('Number value editing', () => {
    it('should call onChange when number value changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      render(<LiteralBlock value={42} onChange={mockOnChange} />);

      const input = screen.getByDisplayValue('42');
      await user.clear(input);
      await user.type(input, '100');

      expect(mockOnChange).toHaveBeenCalledWith(100);
    });
  });

  describe('Boolean value editing', () => {
    it('should toggle boolean value', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      render(<LiteralBlock value={true} onChange={mockOnChange} />);

      const select = screen.getByDisplayValue('true');
      await user.selectOptions(select, 'false');

      expect(mockOnChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Deletion', () => {
    it('should call onDelete when provided', async () => {
      const mockOnChange = vi.fn();
      const mockOnDelete = vi.fn();

      render(<LiteralBlock value="test" onChange={mockOnChange} onDelete={mockOnDelete} />);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await deleteButton.click();

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels', () => {
      const mockOnChange = vi.fn();
      render(<LiteralBlock value="test" onChange={mockOnChange} />);

      const block = screen.getByRole('region');
      expect(block).toHaveAttribute('aria-label', 'literal operator block');
    });
  });
});
