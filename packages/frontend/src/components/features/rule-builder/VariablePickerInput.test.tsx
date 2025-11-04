import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { VariablePickerInput, type VariableOption } from './VariablePickerInput';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks();
});

describe('VariablePickerInput', () => {
  const mockSettlementVariables: VariableOption[] = [
    {
      path: 'settlement.name',
      type: 'string',
      category: 'Settlement',
      description: 'Settlement name',
    },
    {
      path: 'settlement.level',
      type: 'number',
      category: 'Settlement',
      description: 'Settlement level',
    },
    {
      path: 'settlement.population',
      type: 'number',
      category: 'Settlement',
      description: 'Population count',
    },
  ];

  const mockStructureVariables: VariableOption[] = [
    {
      path: 'structure.type',
      type: 'string',
      category: 'Structure',
      description: 'Structure type',
    },
    {
      path: 'structure.level',
      type: 'number',
      category: 'Structure',
      description: 'Structure level',
    },
    {
      path: 'structure.isOperational',
      type: 'boolean',
      category: 'Structure',
      description: 'Is operational',
    },
  ];

  const mockCommonVariables: VariableOption[] = [
    { path: 'worldTime.day', type: 'number', category: 'Common', description: 'Current day' },
    { path: 'worldTime.hour', type: 'number', category: 'Common', description: 'Current hour' },
  ];

  const allVariables = [
    ...mockSettlementVariables,
    ...mockStructureVariables,
    ...mockCommonVariables,
  ];

  describe('Rendering', () => {
    it('should render input with placeholder', () => {
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      expect(input).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      render(
        <VariablePickerInput
          variables={allVariables}
          value=""
          onChange={vi.fn()}
          placeholder="Choose variable"
        />
      );

      const input = screen.getByPlaceholderText('Choose variable');
      expect(input).toBeInTheDocument();
    });

    it('should display current value in input', () => {
      render(
        <VariablePickerInput variables={allVariables} value="settlement.name" onChange={vi.fn()} />
      );

      const input = screen.getByDisplayValue('settlement.name');
      expect(input).toBeInTheDocument();
    });

    it('should not show dropdown initially', () => {
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    it('should show dropdown when input is focused', async () => {
      const user = userEvent.setup();
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      const dropdown = await screen.findByRole('listbox');
      expect(dropdown).toBeInTheDocument();
    });

    it('should show all variables in dropdown when input is empty', async () => {
      const user = userEvent.setup();
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      // Check all variables are shown
      expect(await screen.findByText('settlement.name')).toBeInTheDocument();
      expect(screen.getByText('structure.type')).toBeInTheDocument();
      expect(screen.getByText('worldTime.day')).toBeInTheDocument();
    });

    it('should hide dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />
          <button>Outside</button>
        </div>
      );

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);
      expect(await screen.findByRole('listbox')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Outside' }));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('should filter variables by search text', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<VariablePickerInput variables={allVariables} value="" onChange={onChange} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.type(input, 'level');

      // Should show settlement.level and structure.level
      expect(await screen.findByText('settlement.level')).toBeInTheDocument();
      expect(screen.getByText('structure.level')).toBeInTheDocument();

      // Should not show unrelated variables
      expect(screen.queryByText('settlement.name')).not.toBeInTheDocument();
      expect(screen.queryByText('worldTime.day')).not.toBeInTheDocument();
    });

    it('should filter case-insensitively', async () => {
      const user = userEvent.setup();
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.type(input, 'STRUCTURE');

      expect(await screen.findByText('structure.type')).toBeInTheDocument();
      expect(screen.getByText('structure.level')).toBeInTheDocument();
    });

    it('should show no results message when no matches', async () => {
      const user = userEvent.setup();
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.type(input, 'nonexistent');

      expect(await screen.findByText('No variables found')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should call onChange when variable is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<VariablePickerInput variables={allVariables} value="" onChange={onChange} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      const option = await screen.findByText('settlement.name');
      await user.click(option);

      expect(onChange).toHaveBeenCalledWith('settlement.name');
    });

    it('should close dropdown after selection', async () => {
      const user = userEvent.setup();
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      const option = await screen.findByText('settlement.name');
      await user.click(option);

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should update input value after selection', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(
        <VariablePickerInput variables={allVariables} value="" onChange={onChange} />
      );

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      const option = await screen.findByText('settlement.name');
      await user.click(option);

      // Simulate parent component updating value prop
      rerender(
        <VariablePickerInput variables={allVariables} value="settlement.name" onChange={onChange} />
      );

      expect(screen.getByDisplayValue('settlement.name')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate options with arrow keys', async () => {
      const user = userEvent.setup();
      render(
        <VariablePickerInput variables={mockSettlementVariables} value="" onChange={vi.fn()} />
      );

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      // First option should be highlighted by default
      const firstOption = await screen.findByText('settlement.name');
      expect(firstOption.closest('[data-highlighted="true"]')).toBeInTheDocument();

      // Arrow down to second option
      await user.keyboard('{ArrowDown}');
      const secondOption = screen.getByText('settlement.level');
      expect(secondOption.closest('[data-highlighted="true"]')).toBeInTheDocument();
    });

    it('should select option with Enter key', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <VariablePickerInput variables={mockSettlementVariables} value="" onChange={onChange} />
      );

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);
      await screen.findByRole('listbox');

      // First option is highlighted by default, press Enter
      await user.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalledWith('settlement.name');
    });

    it('should close dropdown with Escape key', async () => {
      const user = userEvent.setup();
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);
      expect(await screen.findByRole('listbox')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Categorization', () => {
    it('should group variables by category', async () => {
      const user = userEvent.setup();
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      // Should show category headers
      expect(await screen.findByText('Settlement')).toBeInTheDocument();
      expect(screen.getByText('Structure')).toBeInTheDocument();
      expect(screen.getByText('Common')).toBeInTheDocument();
    });

    it('should display category headers above their variables', async () => {
      const user = userEvent.setup();
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      await screen.findByRole('listbox');

      // Get all text content in order
      const dropdown = screen.getByRole('listbox');
      const text = dropdown.textContent || '';

      // Settlement category should come before settlement variables
      const settlementIndex = text.indexOf('Settlement');
      const settlementNameIndex = text.indexOf('settlement.name');
      expect(settlementIndex).toBeLessThan(settlementNameIndex);

      // Structure category should come before structure variables
      const structureIndex = text.indexOf('Structure');
      const structureTypeIndex = text.indexOf('structure.type');
      expect(structureIndex).toBeLessThan(structureTypeIndex);
    });
  });

  describe('Type Hints', () => {
    it('should display variable type in dropdown', async () => {
      const user = userEvent.setup();
      render(
        <VariablePickerInput variables={mockSettlementVariables} value="" onChange={vi.fn()} />
      );

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      await screen.findByRole('listbox');

      // Check type badges
      const typeBadges = screen.getAllByText(/string|number/i);
      expect(typeBadges.length).toBeGreaterThan(0);
    });

    it('should display variable description when available', async () => {
      const user = userEvent.setup();
      render(
        <VariablePickerInput variables={mockSettlementVariables} value="" onChange={vi.fn()} />
      );

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      await screen.findByRole('listbox');

      expect(screen.getByText('Settlement name')).toBeInTheDocument();
      expect(screen.getByText('Population count')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty variables array', () => {
      render(<VariablePickerInput variables={[]} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      expect(input).toBeInTheDocument();
    });

    it('should show no results when no variables available', async () => {
      const user = userEvent.setup();
      render(<VariablePickerInput variables={[]} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      expect(await screen.findByText('No variables found')).toBeInTheDocument();
    });

    it('should handle manual text input for custom paths', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<VariablePickerInput variables={allVariables} value="" onChange={onChange} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.type(input, 'custom.path');

      // onChange should be called with the custom path as user types
      expect(onChange).toHaveBeenLastCalledWith('custom.path');
    });

    it('should allow clearing the input', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <VariablePickerInput variables={allVariables} value="settlement.name" onChange={onChange} />
      );

      const input = screen.getByDisplayValue('settlement.name');
      await user.clear(input);

      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on input', () => {
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when dropdown opens', async () => {
      const user = userEvent.setup();
      render(<VariablePickerInput variables={allVariables} value="" onChange={vi.fn()} />);

      const input = screen.getByPlaceholderText('Select a variable...');
      expect(input).toHaveAttribute('aria-expanded', 'false');

      await user.click(input);
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have accessible option elements', async () => {
      const user = userEvent.setup();
      render(
        <VariablePickerInput variables={mockSettlementVariables} value="" onChange={vi.fn()} />
      );

      const input = screen.getByPlaceholderText('Select a variable...');
      await user.click(input);

      const options = await screen.findAllByRole('option');
      expect(options).toHaveLength(3);

      options.forEach((option) => {
        expect(option).toHaveAttribute('role', 'option');
      });
    });
  });
});
