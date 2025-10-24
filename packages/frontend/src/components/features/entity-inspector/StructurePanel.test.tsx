import { ApolloProvider } from '@apollo/client/react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';

import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { StructurePanel } from './StructurePanel';
import type { StructureData } from './StructurePanel';

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('StructurePanel', () => {
  const mockStructure: StructureData = {
    id: 'structure-1',
    name: 'Main Barracks',
    typeId: 'barracks',
    type: 'barracks',
    settlementId: 'settlement-1',
    level: 2,
    x: 10,
    y: 20,
    orientation: 90,
    isArchived: false,
    archivedAt: null,
    variables: {
      garrison_size: 50,
      is_upgraded: false,
      maintenance_cost: 25,
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  describe('Structure Attributes Section', () => {
    it('should render structure attributes section header', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Structure Attributes')).toBeInTheDocument();
    });

    it('should display structure type', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('barracks')).toBeInTheDocument();
    });

    it('should use type field if available', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('barracks')).toBeInTheDocument();
    });

    it('should fallback to typeId if type is not available', () => {
      const structureNoType: StructureData = {
        ...mockStructure,
        type: undefined,
      };
      render(<StructurePanel structure={structureNoType} />, { wrapper: createWrapper() });
      expect(screen.getByText('barracks')).toBeInTheDocument(); // typeId is 'barracks'
    });

    it('should display settlement ID', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Settlement ID')).toBeInTheDocument();
      expect(screen.getByText('settlement-1')).toBeInTheDocument();
    });

    it('should display level', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Level')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
    });

    it('should display position X', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Position X')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should display position Y', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Position Y')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('should display orientation with degree symbol', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Orientation')).toBeInTheDocument();
      expect(screen.getByText('90°')).toBeInTheDocument();
    });
  });

  describe('Typed Variables Section', () => {
    it('should render typed variables section header', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Typed Variables')).toBeInTheDocument();
    });

    it('should display number variables', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Garrison Size')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('Maintenance Cost')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('should display boolean variables', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Is Upgraded')).toBeInTheDocument();
      expect(screen.getByText('false')).toBeInTheDocument();
    });

    it('should convert snake_case to Title Case', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Garrison Size')).toBeInTheDocument();
      expect(screen.getByText('Maintenance Cost')).toBeInTheDocument();
      expect(screen.getByText('Is Upgraded')).toBeInTheDocument();
    });

    it('should display empty state when no variables exist', () => {
      const structureNoVars: StructureData = {
        ...mockStructure,
        variables: {},
      };
      render(<StructurePanel structure={structureNoVars} />, { wrapper: createWrapper() });
      expect(
        screen.getByText('No typed variables available for this structure')
      ).toBeInTheDocument();
    });

    it('should display empty state when variables is undefined', () => {
      const structureNoVars: StructureData = {
        ...mockStructure,
        variables: undefined,
      };
      render(<StructurePanel structure={structureNoVars} />, { wrapper: createWrapper() });
      expect(
        screen.getByText('No typed variables available for this structure')
      ).toBeInTheDocument();
    });

    it('should format object variables as JSON', () => {
      const structureWithObject: StructureData = {
        ...mockStructure,
        variables: {
          equipment: {
            swords: 100,
            shields: 80,
          },
        },
      };
      render(<StructurePanel structure={structureWithObject} />, { wrapper: createWrapper() });
      expect(screen.getByText('Equipment')).toBeInTheDocument();
      const jsonText = screen.getByText(/"swords": 100/);
      expect(jsonText).toBeInTheDocument();
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy field value to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });

      // Spy on clipboard AFTER render
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      expect(copyButtons.length).toBeGreaterThan(0);

      await user.click(copyButtons[0]); // Click first copy button (Type)

      // Wait for the clipboard API to be called
      await waitFor(
        () => {
          expect(writeTextSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
      expect(writeTextSpy).toHaveBeenCalledWith('barracks');

      writeTextSpy.mockRestore();
    });

    it('should show checkmark after successful copy', async () => {
      const user = userEvent.setup();
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      await user.click(copyButtons[0]);

      await waitFor(
        () => {
          expect(screen.getByText('✓')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it('should reset checkmark after 2 seconds', async () => {
      vi.useFakeTimers();
      try {
        render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });

        const copyButtons = screen.getAllByTitle('Copy to clipboard');
        // Use fireEvent instead of userEvent with fake timers
        fireEvent.click(copyButtons[0]);

        // Wait for async state update
        await vi.waitFor(() => {
          expect(screen.getByText('✓')).toBeInTheDocument();
        });

        // Fast-forward 2 seconds and flush effects
        act(() => {
          vi.advanceTimersByTime(2000);
        });

        // Checkmark should be gone
        expect(screen.queryByText('✓')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should handle clipboard errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });

      // Mock clipboard to reject AFTER render
      const writeTextSpy = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockRejectedValueOnce(new Error('Clipboard error'));

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      await user.click(copyButtons[0]);

      await waitFor(
        () => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to copy to clipboard:',
            expect.any(Error)
          );
        },
        { timeout: 1000 }
      );

      writeTextSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Value Formatting', () => {
    it('should format null values as "N/A"', () => {
      const structureWithNull: StructureData = {
        ...mockStructure,
        variables: {
          empty_field: null,
        },
      };
      render(<StructurePanel structure={structureWithNull} />, { wrapper: createWrapper() });
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('should format undefined values as "N/A"', () => {
      const structureWithUndefined: StructureData = {
        ...mockStructure,
        variables: {
          missing_field: undefined,
        },
      };
      render(<StructurePanel structure={structureWithUndefined} />, { wrapper: createWrapper() });
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('should format boolean true correctly', () => {
      const structureWithTrue: StructureData = {
        ...mockStructure,
        variables: {
          is_active: true,
        },
      };
      render(<StructurePanel structure={structureWithTrue} />, { wrapper: createWrapper() });
      expect(screen.getByText('true')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all fields', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      expect(screen.getByText('Type')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Settlement ID')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Level')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Position X')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Position Y')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Orientation')).toHaveClass('text-xs', 'font-semibold');
    });

    it('should have title attribute on copy buttons', () => {
      render(<StructurePanel structure={mockStructure} />, { wrapper: createWrapper() });
      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      expect(copyButtons.length).toBeGreaterThan(0);
    });
  });
});
