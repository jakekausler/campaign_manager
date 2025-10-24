import { ApolloProvider } from '@apollo/client/react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import { createTestApolloClient } from '@/__tests__/utils/test-utils';
import * as settlements from '@/services/api/mutations/settlements';
import * as structures from '@/services/api/mutations/structures';

import { LevelControl } from './LevelControl';

// Mock settlement and structure mutations
const mockUpdateSettlement = vi.fn();
const mockUpdateStructure = vi.fn();

// Mock toast from sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the mutation hooks
vi.mock('@/services/api/mutations/settlements');
vi.mock('@/services/api/mutations/structures');

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

beforeEach(() => {
  // Setup default mock implementations
  vi.mocked(settlements.useUpdateSettlement).mockReturnValue({
    updateSettlement: mockUpdateSettlement,
    loading: false,
    error: undefined,
    data: undefined,
    reset: vi.fn(),
  });

  vi.mocked(structures.useUpdateStructure).mockReturnValue({
    updateStructure: mockUpdateStructure,
    loading: false,
    error: undefined,
    data: undefined,
    reset: vi.fn(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LevelControl', () => {
  describe('Rendering', () => {
    it('should render with current level badge', () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('level-badge')).toHaveTextContent('Level 3');
    });

    it('should render increment and decrement buttons', () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('level-increase')).toBeInTheDocument();
      expect(screen.getByTestId('level-decrease')).toBeInTheDocument();
    });

    it('should have proper accessibility labels', () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByLabelText('Increase level')).toBeInTheDocument();
      expect(screen.getByLabelText('Decrease level')).toBeInTheDocument();
    });
  });

  describe('Button State Management', () => {
    it('should disable decrease button at minimum level', () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={1}
          minLevel={1}
        />,
        { wrapper: createWrapper() }
      );

      const decreaseButton = screen.getByTestId('level-decrease');
      expect(decreaseButton).toBeDisabled();
    });

    it('should enable decrease button above minimum level', () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
          minLevel={1}
        />,
        { wrapper: createWrapper() }
      );

      const decreaseButton = screen.getByTestId('level-decrease');
      expect(decreaseButton).not.toBeDisabled();
    });

    it('should disable increase button at maximum level', () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={10}
          maxLevel={10}
        />,
        { wrapper: createWrapper() }
      );

      const increaseButton = screen.getByTestId('level-increase');
      expect(increaseButton).toBeDisabled();
    });

    it('should enable increase button below maximum level', () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={5}
          maxLevel={10}
        />,
        { wrapper: createWrapper() }
      );

      const increaseButton = screen.getByTestId('level-increase');
      expect(increaseButton).not.toBeDisabled();
    });

    it('should disable both buttons when loading', () => {
      vi.mocked(settlements.useUpdateSettlement).mockReturnValue({
        updateSettlement: mockUpdateSettlement,
        loading: true,
        error: undefined,
        data: undefined,
        reset: vi.fn(),
      });

      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={5}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('level-increase')).toBeDisabled();
      expect(screen.getByTestId('level-decrease')).toBeDisabled();
    });
  });

  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog when increasing level', async () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
        />,
        { wrapper: createWrapper() }
      );

      const increaseButton = screen.getByTestId('level-increase');
      fireEvent.click(increaseButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
        // Text is split across multiple span elements in a paragraph
        // Look for the specific <p> element containing all the text parts
        const dialog = screen.getByRole('alertdialog');
        expect(dialog).toHaveTextContent(/You are about to increase the level of/i);
        expect(dialog).toHaveTextContent('Westholm');
        expect(dialog).toHaveTextContent('from');
        expect(dialog).toHaveTextContent('3');
        expect(dialog).toHaveTextContent('to');
        expect(dialog).toHaveTextContent('4');
      });
    });

    it('should show confirmation dialog when decreasing level', async () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
        />,
        { wrapper: createWrapper() }
      );

      const decreaseButton = screen.getByTestId('level-decrease');
      fireEvent.click(decreaseButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
        // Text is split across multiple span elements in a paragraph
        // Look for the specific <p> element containing all the text parts
        const dialog = screen.getByRole('alertdialog');
        expect(dialog).toHaveTextContent(/You are about to decrease the level of/i);
        expect(dialog).toHaveTextContent('Westholm');
        expect(dialog).toHaveTextContent('from');
        expect(dialog).toHaveTextContent('3');
        expect(dialog).toHaveTextContent('to');
        expect(dialog).toHaveTextContent('2');
      });
    });

    it('should close dialog when cancel is clicked', async () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
        />,
        { wrapper: createWrapper() }
      );

      const increaseButton = screen.getByTestId('level-increase');
      fireEvent.click(increaseButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Level Change')).not.toBeInTheDocument();
      });

      expect(mockUpdateSettlement).not.toHaveBeenCalled();
    });
  });

  describe('Level Update - Settlement', () => {
    it('should call updateSettlement when confirmed for increase', async () => {
      mockUpdateSettlement.mockResolvedValue({ id: 'settlement-1', level: 4 });

      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
          version={5}
        />,
        { wrapper: createWrapper() }
      );

      const increaseButton = screen.getByTestId('level-increase');
      fireEvent.click(increaseButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText(/Yes, increase level/i);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockUpdateSettlement).toHaveBeenCalledWith('settlement-1', {
          level: 4,
          expectedVersion: 5,
        });
      });
    });

    it('should call updateSettlement when confirmed for decrease', async () => {
      mockUpdateSettlement.mockResolvedValue({ id: 'settlement-1', level: 2 });

      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
          version={5}
        />,
        { wrapper: createWrapper() }
      );

      const decreaseButton = screen.getByTestId('level-decrease');
      fireEvent.click(decreaseButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText(/Yes, decrease level/i);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockUpdateSettlement).toHaveBeenCalledWith('settlement-1', {
          level: 2,
          expectedVersion: 5,
        });
      });
    });

    it('should show success toast after successful update', async () => {
      mockUpdateSettlement.mockResolvedValue({ id: 'settlement-1', level: 4 });

      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
        />,
        { wrapper: createWrapper() }
      );

      const increaseButton = screen.getByTestId('level-increase');
      fireEvent.click(increaseButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText(/Yes, increase level/i);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Level updated', {
          description: 'Westholm level changed from 3 to 4.',
        });
      });
    });

    it('should call onLevelChanged callback after successful update', async () => {
      const onLevelChanged = vi.fn();
      mockUpdateSettlement.mockResolvedValue({ id: 'settlement-1', level: 4 });

      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
          onLevelChanged={onLevelChanged}
        />,
        { wrapper: createWrapper() }
      );

      const increaseButton = screen.getByTestId('level-increase');
      fireEvent.click(increaseButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText(/Yes, increase level/i);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(onLevelChanged).toHaveBeenCalledWith(4);
      });
    });

    it('should show error toast on failed update', async () => {
      const error = new Error('Version conflict');
      mockUpdateSettlement.mockRejectedValue(error);

      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={3}
        />,
        { wrapper: createWrapper() }
      );

      const increaseButton = screen.getByTestId('level-increase');
      fireEvent.click(increaseButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText(/Yes, increase level/i);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update level', {
          description: 'Version conflict',
        });
      });
    });
  });

  describe('Level Update - Structure', () => {
    it('should call updateStructure when confirmed', async () => {
      mockUpdateStructure.mockResolvedValue({ id: 'structure-1', level: 3 });

      render(
        <LevelControl
          entityId="structure-1"
          entityType="structure"
          entityName="Grand Temple"
          currentLevel={2}
          version={3}
        />,
        { wrapper: createWrapper() }
      );

      const increaseButton = screen.getByTestId('level-increase');
      fireEvent.click(increaseButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Level Change')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText(/Yes, increase level/i);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockUpdateStructure).toHaveBeenCalledWith('structure-1', {
          level: 3,
          expectedVersion: 3,
        });
      });
    });
  });

  describe('Custom Level Bounds', () => {
    it('should respect custom minLevel', () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={5}
          minLevel={5}
        />,
        { wrapper: createWrapper() }
      );

      const decreaseButton = screen.getByTestId('level-decrease');
      expect(decreaseButton).toBeDisabled();
    });

    it('should respect custom maxLevel', () => {
      render(
        <LevelControl
          entityId="settlement-1"
          entityType="settlement"
          entityName="Westholm"
          currentLevel={5}
          maxLevel={5}
        />,
        { wrapper: createWrapper() }
      );

      const increaseButton = screen.getByTestId('level-increase');
      expect(increaseButton).toBeDisabled();
    });
  });
});
