/**
 * Unit tests for TypedVariableEditor component
 *
 * Tests the typed variable editor including:
 * - Form rendering with variable schemas
 * - Type-specific input controls (string, number, boolean, enum)
 * - Client-side validation with touch-tracking
 * - Validation error messages
 * - Unsaved changes warning
 * - Save/cancel operations
 * - Default value handling
 * - Loading states
 * - Empty state (no schemas)
 */

import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';

import type { VariableSchema } from '@/utils/variable-validation';

import { TypedVariableEditor } from './TypedVariableEditor';

afterEach(() => {
  cleanup(); // Unmount all React components
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('TypedVariableEditor', () => {
  const mockSchemas: VariableSchema[] = [
    {
      name: 'population',
      type: 'number',
      description: 'Current population count',
      defaultValue: 100,
    },
    {
      name: 'mayor_name',
      type: 'string',
      description: 'Name of the mayor',
      defaultValue: 'Unknown',
    },
    {
      name: 'has_walls',
      type: 'boolean',
      description: 'Whether the settlement has walls',
      defaultValue: false,
    },
    {
      name: 'climate',
      type: 'enum',
      enumValues: ['temperate', 'tropical', 'arctic', 'desert'],
      description: 'Climate type',
      defaultValue: 'temperate',
    },
  ];

  const defaultProps = {
    entityId: 'settlement-1',
    entityType: 'settlement' as const,
    variableSchemas: mockSchemas,
    currentVariables: {
      population: 500,
      mayor_name: 'Lord Blackwood',
      has_walls: true,
      climate: 'temperate',
    },
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  describe('Form Rendering', () => {
    it('should render form with all variable fields', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      // Check that all field labels are rendered with Title Case
      expect(screen.getByText('Population')).toBeInTheDocument();
      expect(screen.getByText('Mayor Name')).toBeInTheDocument();
      expect(screen.getByText('Has Walls')).toBeInTheDocument();
      expect(screen.getByText('Climate')).toBeInTheDocument();
    });

    it('should render field descriptions', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      expect(screen.getByText('(Current population count)')).toBeInTheDocument();
      expect(screen.getByText('(Name of the mayor)')).toBeInTheDocument();
      expect(screen.getByText('(Whether the settlement has walls)')).toBeInTheDocument();
      expect(screen.getByText('(Climate type)')).toBeInTheDocument();
    });

    it('should render Save and Cancel buttons', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Save Variables/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('should not render unsaved changes warning initially', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      expect(screen.queryByText(/You have unsaved changes/i)).not.toBeInTheDocument();
    });

    it('should render empty state when no schemas provided', () => {
      render(<TypedVariableEditor {...defaultProps} variableSchemas={[]} />);

      expect(
        screen.getByText('No variable schemas defined for this settlement.')
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save Variables/i })).not.toBeInTheDocument();
    });
  });

  describe('String Input Fields', () => {
    it('should render string input with current value', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      const input = screen.getByLabelText(/Mayor Name/i) as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.type).toBe('text');
      expect(input.value).toBe('Lord Blackwood');
    });

    it('should allow typing in string input', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const input = screen.getByLabelText(/Mayor Name/i);
      await user.clear(input);
      await user.type(input, 'Lady Winterbourne');

      expect(input).toHaveValue('Lady Winterbourne');
    });

    it('should show unsaved changes warning after typing', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const input = screen.getByLabelText(/Mayor Name/i);
      await user.type(input, ' III');

      await waitFor(() => {
        expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Number Input Fields', () => {
    it('should render number input with current value', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      const input = screen.getByLabelText(/Population/i) as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.type).toBe('number');
      expect(input.value).toBe('500');
    });

    it('should allow typing numbers', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const input = screen.getByLabelText(/Population/i);
      await user.clear(input);
      await user.type(input, '1250');

      expect(input).toHaveValue(1250);
    });

    it('should validate number input on blur', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const input = screen.getByLabelText(/Population/i);
      await user.clear(input);
      await user.type(input, 'not a number');
      await user.tab(); // Blur the input

      await waitFor(() => {
        expect(screen.getByText('Must be a valid number')).toBeInTheDocument();
      });
    });

    it('should not show error before blur (touch-tracking)', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const input = screen.getByLabelText(/Population/i);
      await user.clear(input);
      await user.type(input, 'not a number');

      // Error should not appear until blur
      expect(screen.queryByText('Must be a valid number')).not.toBeInTheDocument();
    });
  });

  describe('Boolean Input Fields', () => {
    it('should render checkbox with current value', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /Has Walls/i }) as HTMLInputElement;
      expect(checkbox).toBeInTheDocument();
      expect(checkbox.type).toBe('checkbox');
      expect(checkbox.checked).toBe(true);
    });

    it('should display "True" label when checked', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      expect(screen.getByText('True')).toBeInTheDocument();
    });

    it('should toggle checkbox value', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /Has Walls/i });
      await user.click(checkbox);

      expect(checkbox).not.toBeChecked();
      expect(screen.getByText('False')).toBeInTheDocument();
    });
  });

  describe('Enum Input Fields', () => {
    it('should render select dropdown with current value', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      const select = screen.getByLabelText(/Climate/i) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.tagName).toBe('SELECT');
      expect(select.value).toBe('temperate');
    });

    it('should render all enum options', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      const select = screen.getByLabelText(/Climate/i);
      const options = Array.from(select.querySelectorAll('option')).map((opt) => opt.value);

      expect(options).toEqual(['', 'temperate', 'tropical', 'arctic', 'desert']);
    });

    it('should allow selecting different enum value', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const select = screen.getByLabelText(/Climate/i);
      await user.selectOptions(select, 'tropical');

      expect(select).toHaveValue('tropical');
    });

    it('should show error for enum without enumValues', () => {
      const invalidSchema: VariableSchema[] = [
        {
          name: 'broken_enum',
          type: 'enum',
          // Missing enumValues
        },
      ];

      render(
        <TypedVariableEditor
          {...defaultProps}
          variableSchemas={invalidSchema}
          currentVariables={{}}
        />
      );

      expect(screen.getByText('Enum values not defined')).toBeInTheDocument();
    });
  });

  describe('Default Values', () => {
    it('should use default values when no current value provided', () => {
      render(
        <TypedVariableEditor
          {...defaultProps}
          currentVariables={{}} // Empty current variables
        />
      );

      const populationInput = screen.getByLabelText(/Population/i) as HTMLInputElement;
      const mayorInput = screen.getByLabelText(/Mayor Name/i) as HTMLInputElement;
      const wallsCheckbox = screen.getByRole('checkbox', {
        name: /Has Walls/i,
      }) as HTMLInputElement;
      const climateSelect = screen.getByLabelText(/Climate/i) as HTMLSelectElement;

      expect(populationInput.value).toBe('100'); // default value
      expect(mayorInput.value).toBe('Unknown'); // default value
      expect(wallsCheckbox.checked).toBe(false); // default value
      expect(climateSelect.value).toBe('temperate'); // default value
    });

    it('should show default value hint for untouched empty fields', () => {
      const schemasWithDefaults: VariableSchema[] = [
        {
          name: 'optional_field',
          type: 'string',
          defaultValue: 'default_value',
        },
      ];

      render(
        <TypedVariableEditor
          {...defaultProps}
          variableSchemas={schemasWithDefaults}
          currentVariables={{}}
        />
      );

      expect(screen.getByText('Default: default_value')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should validate all fields on submit', async () => {
      const user = userEvent.setup();
      const mockOnSave = vi.fn();
      render(<TypedVariableEditor {...defaultProps} onSave={mockOnSave} />);

      const populationInput = screen.getByLabelText(/Population/i);
      await user.clear(populationInput);
      await user.type(populationInput, 'invalid');

      const saveButton = screen.getByRole('button', { name: /Save Variables/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Must be a valid number')).toBeInTheDocument();
      });

      // Should not call onSave when there are errors
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should disable submit button when errors exist', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const populationInput = screen.getByLabelText(/Population/i);
      await user.clear(populationInput);
      await user.type(populationInput, 'invalid');
      await user.tab(); // Blur to trigger validation

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save Variables/i });
        expect(saveButton).toBeDisabled();
      });
    });

    it('should show ARIA attributes for invalid fields', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const populationInput = screen.getByLabelText(/Population/i);
      await user.clear(populationInput);
      await user.type(populationInput, 'invalid');
      await user.tab(); // Blur to trigger validation

      await waitFor(() => {
        expect(populationInput).toHaveAttribute('aria-invalid', 'true');
        expect(populationInput).toHaveAttribute('aria-describedby', 'population-error');
      });
    });
  });

  describe('Save Operation', () => {
    it('should call onSave with converted values', async () => {
      const user = userEvent.setup();
      const mockOnSave = vi.fn().mockResolvedValue(undefined);
      render(<TypedVariableEditor {...defaultProps} onSave={mockOnSave} />);

      const populationInput = screen.getByLabelText(/Population/i);
      await user.clear(populationInput);
      await user.type(populationInput, '2000');

      const saveButton = screen.getByRole('button', { name: /Save Variables/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          population: 2000, // Converted to number
          mayor_name: 'Lord Blackwood',
          has_walls: true,
          climate: 'temperate',
        });
      });
    });

    it('should show loading state during save', async () => {
      const user = userEvent.setup();
      let resolveSave: () => void;
      const mockOnSave = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve;
          })
      );

      render(<TypedVariableEditor {...defaultProps} onSave={mockOnSave} />);

      const saveButton = screen.getByRole('button', { name: /Save Variables/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Saving.../i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Saving.../i })).toBeDisabled();
      });

      // Resolve the save
      resolveSave!();
    });

    it('should clear unsaved changes flag after successful save', async () => {
      const user = userEvent.setup();
      const mockOnSave = vi.fn().mockResolvedValue(undefined);
      render(<TypedVariableEditor {...defaultProps} onSave={mockOnSave} />);

      const populationInput = screen.getByLabelText(/Population/i);
      await user.type(populationInput, '0');

      await waitFor(() => {
        expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save Variables/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByText(/You have unsaved changes/i)).not.toBeInTheDocument();
      });
    });

    it('should handle save errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockOnSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      render(<TypedVariableEditor {...defaultProps} onSave={mockOnSave} />);

      const saveButton = screen.getByRole('button', { name: /Save Variables/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to save variables:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Cancel Operation', () => {
    it('should call onCancel when Cancel button clicked', async () => {
      const user = userEvent.setup();
      const mockOnCancel = vi.fn();
      render(<TypedVariableEditor {...defaultProps} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should reset form values when Cancel clicked', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const populationInput = screen.getByLabelText(/Population/i);
      await user.clear(populationInput);
      await user.type(populationInput, '9999');

      expect(populationInput).toHaveValue(9999);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(populationInput).toHaveValue(500); // Reset to original
      });
    });

    it('should clear validation errors when Cancel clicked', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const populationInput = screen.getByLabelText(/Population/i);
      await user.clear(populationInput);
      await user.type(populationInput, 'invalid');
      await user.tab(); // Blur to trigger validation

      await waitFor(() => {
        expect(screen.getByText('Must be a valid number')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Must be a valid number')).not.toBeInTheDocument();
      });
    });

    it('should clear unsaved changes flag when Cancel clicked', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const populationInput = screen.getByLabelText(/Population/i);
      await user.type(populationInput, '0');

      await waitFor(() => {
        expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/You have unsaved changes/i)).not.toBeInTheDocument();
      });
    });

    it('should not render Cancel button when onCancel is not provided', () => {
      render(<TypedVariableEditor {...defaultProps} onCancel={undefined} />);

      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles for form', () => {
      const { container } = render(<TypedVariableEditor {...defaultProps} />);

      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('should have proper labels for all inputs', () => {
      render(<TypedVariableEditor {...defaultProps} />);

      expect(screen.getByLabelText(/Population/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Mayor Name/i)).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Has Walls/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Climate/i)).toBeInTheDocument();
    });

    it('should have proper ARIA attributes for error messages', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const populationInput = screen.getByLabelText(/Population/i);
      await user.clear(populationInput);
      await user.type(populationInput, 'invalid');
      await user.tab(); // Blur to trigger validation

      await waitFor(() => {
        const errorMessage = screen.getByText('Must be a valid number');
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveAttribute('aria-live', 'polite');
        expect(errorMessage).toHaveAttribute('id', 'population-error');
      });
    });

    it('should have proper role for unsaved changes warning', async () => {
      const user = userEvent.setup();
      render(<TypedVariableEditor {...defaultProps} />);

      const populationInput = screen.getByLabelText(/Population/i);
      await user.type(populationInput, '0');

      await waitFor(() => {
        const warning = screen.getByText(/You have unsaved changes/i).closest('div');
        expect(warning).toHaveAttribute('role', 'alert');
      });
    });
  });

  describe('Entity Type', () => {
    it('should display correct entity type in empty state message', () => {
      render(<TypedVariableEditor {...defaultProps} entityType="structure" variableSchemas={[]} />);

      expect(
        screen.getByText('No variable schemas defined for this structure.')
      ).toBeInTheDocument();
    });
  });

  describe('Title Case Conversion', () => {
    it('should convert snake_case field names to Title Case', () => {
      const schemasWithSnakeCase: VariableSchema[] = [
        { name: 'max_population', type: 'number' },
        { name: 'is_capital_city', type: 'boolean' },
        { name: 'trade_route_count', type: 'number' },
      ];

      render(
        <TypedVariableEditor
          {...defaultProps}
          variableSchemas={schemasWithSnakeCase}
          currentVariables={{}}
        />
      );

      expect(screen.getByText('Max Population')).toBeInTheDocument();
      expect(screen.getByText('Is Capital City')).toBeInTheDocument();
      expect(screen.getByText('Trade Route Count')).toBeInTheDocument();
    });
  });
});
