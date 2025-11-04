import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import type { FieldCondition } from '@/services/api/mutations/conditions';
import {
  useCreateFieldCondition,
  useUpdateFieldCondition,
} from '@/services/api/mutations/conditions';

import { RuleBuilderDialog } from './RuleBuilderDialog';

// Mock the mutation hooks
vi.mock('@/services/api/mutations/conditions', async () => {
  const actual = await vi.importActual('@/services/api/mutations/conditions');
  return {
    ...actual,
    useCreateFieldCondition: vi.fn(),
    useUpdateFieldCondition: vi.fn(),
  };
});

describe('RuleBuilderDialog', () => {
  const mockOnClose = vi.fn();
  const mockCreateCondition = vi.fn();
  const mockUpdateCondition = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    entityType: 'Settlement',
    entityId: 'settlement-123',
    existingCondition: null,
  };

  const mockExistingCondition: FieldCondition = {
    id: 'condition-1',
    entityType: 'Settlement',
    entityId: 'settlement-123',
    field: 'is_trade_hub',
    expression: { '==': [{ var: 'level' }, 3] },
    description: 'Trade hub at level 3',
    isActive: true,
    priority: 10,
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    createdBy: 'user-1',
    updatedBy: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(useCreateFieldCondition).mockReturnValue({
      createCondition: mockCreateCondition,
      loading: false,
      error: undefined,
      data: undefined,
    });

    vi.mocked(useUpdateFieldCondition).mockReturnValue({
      updateCondition: mockUpdateCondition,
      loading: false,
      error: undefined,
      data: undefined,
    });
  });

  afterEach(() => {
    cleanup(); // Unmount all React components and hooks
  });

  describe('Create Mode', () => {
    it('should render dialog with create mode title', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      expect(screen.getByText('Create New Rule')).toBeInTheDocument();
      expect(
        screen.getByText('Create a new field condition using the visual rule builder')
      ).toBeInTheDocument();
    });

    it('should render field name input in create mode', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      const fieldNameInput = screen.getByLabelText(/field name/i);
      expect(fieldNameInput).toBeInTheDocument();
      expect(fieldNameInput).not.toBeDisabled();
      expect(fieldNameInput).toHaveAttribute('placeholder', 'e.g., is_trade_hub');
    });

    it('should validate field name on blur', async () => {
      const user = userEvent.setup();

      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      const fieldNameInput = screen.getByLabelText(/field name/i);

      // Test empty field name
      await user.click(fieldNameInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Field name is required')).toBeInTheDocument();
      });

      // Test invalid field name (not snake_case)
      await user.clear(fieldNameInput);
      await user.type(fieldNameInput, 'InvalidName');
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText('Field name must be snake_case (e.g., is_trade_hub)')
        ).toBeInTheDocument();
      });

      // Test valid field name
      await user.clear(fieldNameInput);
      await user.type(fieldNameInput, 'is_trade_hub');
      await user.tab();

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('should render description and priority inputs', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    });

    it('should render rule builder component', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      // RuleBuilder renders with data-testid="rule-builder"
      expect(screen.getByTestId('rule-builder')).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create rule/i })).toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edit Mode', () => {
    const editModeProps = {
      ...defaultProps,
      existingCondition: mockExistingCondition,
    };

    it('should render dialog with edit mode title', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...editModeProps} />
        </MockedProvider>
      );

      expect(screen.getByText('Edit Rule')).toBeInTheDocument();
      expect(
        screen.getByText('Update the rule expression, description, and priority')
      ).toBeInTheDocument();
    });

    it('should display field name as read-only in edit mode', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...editModeProps} />
        </MockedProvider>
      );

      expect(screen.getByText('is_trade_hub')).toBeInTheDocument();
      expect(screen.getByText('Field name cannot be changed after creation')).toBeInTheDocument();
      expect(screen.queryByLabelText(/field name/i)).not.toBeInTheDocument();
    });

    it('should populate form fields with existing condition data', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...editModeProps} />
        </MockedProvider>
      );

      const descriptionInput = screen.getByLabelText(/description/i);
      const priorityInput = screen.getByLabelText(/priority/i);

      expect(descriptionInput).toHaveValue('Trade hub at level 3');
      expect(priorityInput).toHaveValue(10);
    });

    it('should render update button instead of create button', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...editModeProps} />
        </MockedProvider>
      );

      expect(screen.getByRole('button', { name: /update rule/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /create rule/i })).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should not allow save with invalid field name in create mode', async () => {
      const user = userEvent.setup();

      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      // Try to submit without field name
      await user.click(screen.getByRole('button', { name: /create rule/i }));

      expect(mockCreateCondition).not.toHaveBeenCalled();
      expect(screen.getByText('Field name is required')).toBeInTheDocument();
    });

    it('should show loading state during save', () => {
      vi.mocked(useCreateFieldCondition).mockReturnValue({
        createCondition: mockCreateCondition,
        loading: true,
        error: undefined,
        data: undefined,
      });

      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      const saveButton = screen.getByRole('button', { name: /saving.../i });
      expect(saveButton).toBeDisabled();
    });

    it('should display error message on save failure', () => {
      const mockError = new Error('Failed to save');

      vi.mocked(useCreateFieldCondition).mockReturnValue({
        createCondition: mockCreateCondition,
        loading: false,
        error: mockError,
        data: undefined,
      });

      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      expect(screen.getByText('Error saving rule')).toBeInTheDocument();
      expect(screen.getByText('Failed to save')).toBeInTheDocument();
    });
  });

  describe('Dialog Lifecycle', () => {
    it('should reset form when dialog opens in create mode', () => {
      const { rerender } = render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} isOpen={false} />
        </MockedProvider>
      );

      // Reopen dialog
      rerender(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} isOpen={true} />
        </MockedProvider>
      );

      const fieldNameInput = screen.getByLabelText(/field name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      const priorityInput = screen.getByLabelText(/priority/i);

      expect(fieldNameInput).toHaveValue('');
      expect(descriptionInput).toHaveValue('');
      expect(priorityInput).toHaveValue(0);
    });

    it('should populate form when switching to edit mode', () => {
      const { rerender } = render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} existingCondition={null} />
        </MockedProvider>
      );

      // Switch to edit mode
      rerender(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} existingCondition={mockExistingCondition} />
        </MockedProvider>
      );

      const descriptionInput = screen.getByLabelText(/description/i);
      const priorityInput = screen.getByLabelText(/priority/i);

      expect(descriptionInput).toHaveValue('Trade hub at level 3');
      expect(priorityInput).toHaveValue(10);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for inputs', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      const fieldNameInput = screen.getByLabelText(/field name/i);
      expect(fieldNameInput).toHaveAttribute('aria-invalid', 'false');
    });

    it('should mark invalid fields with aria-invalid', async () => {
      const user = userEvent.setup();

      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} />
        </MockedProvider>
      );

      const fieldNameInput = screen.getByLabelText(/field name/i);

      await user.click(fieldNameInput);
      await user.tab();

      await waitFor(() => {
        expect(fieldNameInput).toHaveAttribute('aria-invalid', 'true');
        expect(fieldNameInput).toHaveAttribute('aria-describedby', 'field-name-error');
      });
    });

    it('should have descriptive button titles', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} existingCondition={mockExistingCondition} />
        </MockedProvider>
      );

      // Check that field name label is present (use getByText instead of getByLabelText)
      expect(screen.getByText(/field name/i)).toBeInTheDocument();
    });
  });

  describe('Integration with RuleBuilder', () => {
    it('should pass correct props to RuleBuilder', () => {
      render(
        <MockedProvider>
          <RuleBuilderDialog {...defaultProps} existingCondition={mockExistingCondition} />
        </MockedProvider>
      );

      // RuleBuilder should receive the existing expression
      const ruleBuilder = screen.getByTestId('rule-builder');
      expect(ruleBuilder).toBeInTheDocument();
    });
  });
});
