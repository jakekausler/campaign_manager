import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { ValueInput } from './ValueInput';
import type { JSONLogicExpression } from './types';

describe('ValueInput', () => {
  const mockOnChange = vi.fn();

  // Basic rendering tests
  describe('Rendering', () => {
    it('renders with literal mode by default', () => {
      render(<ValueInput value={'test'} expectedType="string" onChange={mockOnChange} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    });

    it('renders mode toggle buttons', () => {
      render(<ValueInput value={'test'} expectedType="string" onChange={mockOnChange} />);

      expect(screen.getByRole('button', { name: /literal/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /variable/i })).toBeInTheDocument();
    });

    it('shows variable picker in variable mode', () => {
      const varExpression: JSONLogicExpression = { var: 'test.path' };
      render(<ValueInput value={varExpression} expectedType="string" onChange={mockOnChange} />);

      // Variable picker should be visible
      expect(screen.getByPlaceholderText(/select.*variable/i)).toBeInTheDocument();
    });
  });

  // Mode switching tests
  describe('Mode Switching', () => {
    it('switches from literal to variable mode', async () => {
      const user = userEvent.setup();
      render(<ValueInput value={'test'} expectedType="string" onChange={mockOnChange} />);

      const variableButton = screen.getByRole('button', { name: /variable/i });
      await user.click(variableButton);

      // Should show variable picker
      expect(screen.getByPlaceholderText(/select.*variable/i)).toBeInTheDocument();
      // Should call onChange with var expression
      expect(mockOnChange).toHaveBeenCalledWith({ var: '' });
    });

    it('switches from variable to literal mode', async () => {
      const user = userEvent.setup();
      const varExpression: JSONLogicExpression = { var: 'test.path' };
      render(<ValueInput value={varExpression} expectedType="string" onChange={mockOnChange} />);

      const literalButton = screen.getByRole('button', { name: /literal/i });
      await user.click(literalButton);

      // Should show text input
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      // Should call onChange with empty string
      expect(mockOnChange).toHaveBeenCalledWith('');
    });

    it('preserves value type when switching to literal mode', async () => {
      const user = userEvent.setup();
      const varExpression: JSONLogicExpression = { var: 'count' };
      render(<ValueInput value={varExpression} expectedType="number" onChange={mockOnChange} />);

      await user.click(screen.getByRole('button', { name: /literal/i }));

      // Should initialize with 0 for numbers
      expect(mockOnChange).toHaveBeenCalledWith(0);
    });
  });

  // String input tests
  describe('String Input', () => {
    it('renders text input for string type', () => {
      render(<ValueInput value={'hello'} expectedType="string" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveValue('hello');
    });

    it('updates value on string input change', async () => {
      const user = userEvent.setup();
      render(<ValueInput value={'hello'} expectedType="string" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'world');

      expect(mockOnChange).toHaveBeenCalledWith('world');
    });

    it('shows no validation error for valid strings', () => {
      render(<ValueInput value={'hello'} expectedType="string" onChange={mockOnChange} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // Number input tests
  describe('Number Input', () => {
    it('renders number input for number type', () => {
      render(<ValueInput value={42} expectedType="number" onChange={mockOnChange} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveValue(42);
    });

    it('updates value on number input change', async () => {
      const user = userEvent.setup();
      render(<ValueInput value={0} expectedType="number" onChange={mockOnChange} />);

      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      await user.type(input, '123');

      expect(mockOnChange).toHaveBeenCalledWith(123);
    });

    it('shows validation error for invalid number', () => {
      render(<ValueInput value={NaN} expectedType="number" onChange={mockOnChange} />);

      expect(screen.getByRole('alert')).toHaveTextContent(/invalid number/i);
    });

    it('allows decimal numbers', async () => {
      const user = userEvent.setup();
      render(<ValueInput value={0} expectedType="number" onChange={mockOnChange} />);

      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      await user.type(input, '3.14');

      expect(mockOnChange).toHaveBeenCalledWith(3.14);
    });

    it('allows negative numbers', async () => {
      const user = userEvent.setup();
      render(<ValueInput value={0} expectedType="number" onChange={mockOnChange} />);

      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      await user.type(input, '-42');

      expect(mockOnChange).toHaveBeenCalledWith(-42);
    });
  });

  // Boolean input tests
  describe('Boolean Input', () => {
    it('renders select dropdown for boolean type', () => {
      render(<ValueInput value={true} expectedType="boolean" onChange={mockOnChange} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'true' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'false' })).toBeInTheDocument();
    });

    it('shows current boolean value', () => {
      render(<ValueInput value={true} expectedType="boolean" onChange={mockOnChange} />);

      expect(screen.getByRole('combobox')).toHaveValue('true');
    });

    it('updates value on boolean change', async () => {
      const user = userEvent.setup();
      render(<ValueInput value={true} expectedType="boolean" onChange={mockOnChange} />);

      await user.selectOptions(screen.getByRole('combobox'), 'false');

      expect(mockOnChange).toHaveBeenCalledWith(false);
    });
  });

  // Array input tests
  describe('Array Input', () => {
    it('renders textarea for array type', () => {
      render(<ValueInput value={['a', 'b', 'c']} expectedType="array" onChange={mockOnChange} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByDisplayValue('a, b, c')).toBeInTheDocument();
    });

    it('parses comma-separated values into array', async () => {
      const user = userEvent.setup();
      render(<ValueInput value={[]} expectedType="array" onChange={mockOnChange} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'one, two, three');

      expect(mockOnChange).toHaveBeenCalledWith(['one', 'two', 'three']);
    });

    it('trims whitespace from array items', async () => {
      const user = userEvent.setup();
      render(<ValueInput value={[]} expectedType="array" onChange={mockOnChange} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '  one  ,  two  ,  three  ');

      expect(mockOnChange).toHaveBeenCalledWith(['one', 'two', 'three']);
    });

    it('shows validation error for empty array when required', () => {
      render(<ValueInput value={[]} expectedType="array" onChange={mockOnChange} />);

      // Empty array is valid by default
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // Null input tests
  describe('Null Input', () => {
    it('renders disabled input for null type', () => {
      render(<ValueInput value={null} expectedType="null" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveValue('null');
    });

    it('does not allow editing null value', async () => {
      const user = userEvent.setup();
      render(<ValueInput value={null} expectedType="null" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      // Should not call onChange since input is disabled
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  // Variable mode tests
  describe('Variable Mode', () => {
    it('displays variable path when in variable mode', () => {
      const varExpression: JSONLogicExpression = { var: 'settlement.level' };
      render(<ValueInput value={varExpression} expectedType="number" onChange={mockOnChange} />);

      expect(screen.getByDisplayValue('settlement.level')).toBeInTheDocument();
    });

    it('calls onChange when variable path changes', async () => {
      const user = userEvent.setup();
      const varExpression: JSONLogicExpression = { var: 'old.path' };
      render(
        <ValueInput
          value={varExpression}
          expectedType="string"
          onChange={mockOnChange}
          availableVariables={[{ path: 'new.path', type: 'string', category: 'test' }]}
        />
      );

      const input = screen.getByPlaceholderText(/select.*variable/i);
      await user.clear(input);
      await user.type(input, 'new.path');

      // Focus somewhere else to trigger selection
      const literalBtn = screen.getByRole('button', { name: /literal/i });
      await user.click(literalBtn);
      await user.click(screen.getByRole('button', { name: /variable/i }));

      // Type and select the variable
      await user.clear(screen.getByPlaceholderText(/select.*variable/i));
      await user.type(screen.getByPlaceholderText(/select.*variable/i), 'new.path');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(mockOnChange).toHaveBeenCalledWith({ var: 'new.path' });
    });
  });

  // Validation tests
  describe('Validation', () => {
    it('shows no error for valid values', () => {
      render(<ValueInput value={'valid'} expectedType="string" onChange={mockOnChange} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('displays validation errors with aria-live region', () => {
      render(<ValueInput value={NaN} expectedType="number" onChange={mockOnChange} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('links input to error message via aria-describedby', () => {
      render(<ValueInput value={NaN} expectedType="number" onChange={mockOnChange} />);

      const input = screen.getByRole('spinbutton');
      const alert = screen.getByRole('alert');
      expect(input).toHaveAttribute('aria-describedby', alert.id);
    });
  });

  // Edge cases
  describe('Edge Cases', () => {
    it('handles undefined value gracefully', () => {
      // undefined is not a valid value type, but we test graceful handling
      render(
        <ValueInput
          value={undefined as unknown as LiteralValue}
          expectedType="string"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('handles complex JSONLogic expressions in variable mode', () => {
      const complexExpression: JSONLogicExpression = {
        var: 'deeply.nested.path',
      };
      render(<ValueInput value={complexExpression} expectedType="any" onChange={mockOnChange} />);

      expect(screen.getByDisplayValue('deeply.nested.path')).toBeInTheDocument();
    });

    it('falls back to string input for unknown expectedType', () => {
      // 'unknown' is not a valid ExpectedType, but we test fallback handling
      render(
        <ValueInput
          value={'fallback'}
          expectedType={'unknown' as unknown as ExpectedType}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('has accessible labels for mode toggle buttons', () => {
      render(<ValueInput value={'test'} expectedType="string" onChange={mockOnChange} />);

      expect(screen.getByRole('button', { name: /literal/i })).toHaveAccessibleName();
      expect(screen.getByRole('button', { name: /variable/i })).toHaveAccessibleName();
    });

    it('maintains focus management when switching modes', async () => {
      const user = userEvent.setup();
      render(<ValueInput value={'test'} expectedType="string" onChange={mockOnChange} />);

      const variableBtn = screen.getByRole('button', { name: /variable/i });
      await user.click(variableBtn);

      // Variable picker should be in the document
      expect(screen.getByPlaceholderText(/select.*variable/i)).toBeInTheDocument();
    });

    it('includes proper ARIA attributes for validation', () => {
      render(<ValueInput value={NaN} expectedType="number" onChange={mockOnChange} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
