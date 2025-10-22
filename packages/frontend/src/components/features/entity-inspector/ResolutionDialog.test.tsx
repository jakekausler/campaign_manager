import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Effect, EffectTiming } from './EffectsTab';
import { ResolutionDialog, ValidationResult } from './ResolutionDialog';

// Mock effects for testing
const mockPreEffect: Effect = {
  id: 'effect-1',
  name: 'Pre-Resolution Effect',
  description: 'This effect runs before resolution',
  effectType: 'JSON_PATCH',
  payload: { op: 'replace', path: '/status', value: 'starting' },
  entityType: 'Event',
  entityId: 'event-1',
  timing: EffectTiming.PRE,
  priority: 1,
  isActive: true,
  version: 1,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockOnResolveEffect: Effect = {
  id: 'effect-2',
  name: 'On Resolution Effect',
  description: 'This effect runs during resolution',
  effectType: 'JSON_PATCH',
  payload: { op: 'replace', path: '/status', value: 'processing' },
  entityType: 'Event',
  entityId: 'event-1',
  timing: EffectTiming.ON_RESOLVE,
  priority: 10,
  isActive: true,
  version: 1,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockPostEffect: Effect = {
  id: 'effect-3',
  name: 'Post-Resolution Effect',
  description: 'This effect runs after resolution',
  effectType: 'JSON_PATCH',
  payload: { op: 'replace', path: '/status', value: 'completed' },
  entityType: 'Event',
  entityId: 'event-1',
  timing: EffectTiming.POST,
  priority: 20,
  isActive: true,
  version: 1,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const defaultValidation: ValidationResult = {
  isValid: true,
  errors: [],
  warnings: [],
};

describe('ResolutionDialog', () => {
  let mockOnConfirm: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnConfirm = vi.fn();
    mockOnCancel = vi.fn();
  });

  describe('Rendering', () => {
    it('renders with event entity type', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Festival of the Harvest"
          effects={[mockPreEffect, mockOnResolveEffect, mockPostEffect]}
          validation={defaultValidation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('heading', { name: 'Complete Event' })).toBeInTheDocument();
      expect(screen.getByText(/Festival of the Harvest/)).toBeInTheDocument();
    });

    it('renders with encounter entity type', () => {
      render(
        <ResolutionDialog
          entityType="encounter"
          entityName="Goblin Ambush"
          effects={[mockPreEffect, mockOnResolveEffect, mockPostEffect]}
          validation={defaultValidation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('heading', { name: 'Resolve Encounter' })).toBeInTheDocument();
      expect(screen.getByText(/Goblin Ambush/)).toBeInTheDocument();
    });

    it('renders effect groups correctly', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect, mockOnResolveEffect, mockPostEffect]}
          validation={defaultValidation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Pre-Resolution \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/On Resolution \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Post-Resolution \(1\)/)).toBeInTheDocument();

      expect(screen.getByText('Pre-Resolution Effect')).toBeInTheDocument();
      expect(screen.getByText('On Resolution Effect')).toBeInTheDocument();
      expect(screen.getByText('Post-Resolution Effect')).toBeInTheDocument();
    });

    it('displays effect priority and type', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockOnResolveEffect]}
          validation={defaultValidation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Priority:/)).toBeInTheDocument();
      expect(screen.getByText(/10/)).toBeInTheDocument();
      expect(screen.getByText(/Type:/)).toBeInTheDocument();
      expect(screen.getByText(/JSON_PATCH/)).toBeInTheDocument();
    });

    it('renders empty state when no effects', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[]}
          validation={defaultValidation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/No effects configured for this event/)).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('displays validation errors', () => {
      const validation: ValidationResult = {
        isValid: false,
        errors: ['Event is already completed', 'Invalid state'],
        warnings: [],
      };

      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={validation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Cannot proceed with resolution:/)).toBeInTheDocument();
      expect(screen.getByText('Event is already completed')).toBeInTheDocument();
      expect(screen.getByText('Invalid state')).toBeInTheDocument();
    });

    it('displays validation warnings', () => {
      const validation: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['This event is in the past', 'Low confidence prediction'],
      };

      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={validation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Warning:/)).toBeInTheDocument();
      expect(screen.getByText('This event is in the past')).toBeInTheDocument();
      expect(screen.getByText('Low confidence prediction')).toBeInTheDocument();
    });

    it('disables confirm button when validation fails', () => {
      const validation: ValidationResult = {
        isValid: false,
        errors: ['Event is already completed'],
        warnings: [],
      };

      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={validation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /Complete Event/ });
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Loading and States', () => {
    it('shows loading state', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          loading={true}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Processing...')).toBeInTheDocument();
      const confirmButton = screen.getByRole('button', { name: /Processing.../ });
      expect(confirmButton).toBeDisabled();
    });

    it('shows error message', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          error="Network error: Failed to complete event"
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Resolution failed:/)).toBeInTheDocument();
      expect(screen.getByText('Network error: Failed to complete event')).toBeInTheDocument();
    });

    it('shows success message for event', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          success={true}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Event completed successfully!')).toBeInTheDocument();
      // Both the Dialog's X button and the footer's Close button have "Close" label
      const closeButtons = screen.getAllByRole('button', { name: /Close/ });
      expect(closeButtons.length).toBe(2); // X button + footer Close button
    });

    it('shows success message for encounter', () => {
      render(
        <ResolutionDialog
          entityType="encounter"
          entityName="Test Encounter"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          success={true}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Encounter resolved successfully!')).toBeInTheDocument();
    });

    it('hides effects preview when success is true', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          success={true}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText('Pre-Resolution Effect')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onConfirm when confirm button clicked', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /Complete Event/ });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button clicked', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm when Enter key pressed (validation passes)', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('does not call onConfirm when Enter key pressed (validation fails)', () => {
      const validation: ValidationResult = {
        isValid: false,
        errors: ['Validation error'],
        warnings: [],
      };

      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={validation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('calls onCancel when Escape key pressed', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('does not respond to keyboard shortcuts when loading', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          loading={true}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.keyDown(window, { key: 'Enter' });
      fireEvent.keyDown(window, { key: 'Escape' });

      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('does not respond to keyboard shortcuts when success', () => {
      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[mockPreEffect]}
          validation={defaultValidation}
          success={true}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Effect Ordering', () => {
    it('sorts effects by priority within each timing group', () => {
      const lowPriorityPre: Effect = {
        ...mockPreEffect,
        id: 'pre-low',
        priority: 10,
        name: 'Low Priority',
      };
      const highPriorityPre: Effect = {
        ...mockPreEffect,
        id: 'pre-high',
        priority: 1,
        name: 'High Priority',
      };

      render(
        <ResolutionDialog
          entityType="event"
          entityName="Test Event"
          effects={[lowPriorityPre, highPriorityPre]}
          validation={defaultValidation}
          isOpen={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const effectNames = screen.getAllByText(/Priority/);
      const container = effectNames[0].closest('.space-y-2');
      const effectCards = container?.querySelectorAll('.text-xs.font-semibold.text-slate-900');

      // High priority (priority=1) should appear before low priority (priority=10)
      expect(effectCards?.[0]?.textContent).toBe('High Priority');
      expect(effectCards?.[1]?.textContent).toBe('Low Priority');
    });
  });
});
