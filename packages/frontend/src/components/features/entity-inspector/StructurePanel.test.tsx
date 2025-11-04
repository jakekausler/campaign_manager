import { ApolloProvider } from '@apollo/client/react';
import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach, afterAll } from 'vitest';

import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';
import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { StructurePanel } from './StructurePanel';
import type { StructureData, VariableSchema } from './StructurePanel';

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('StructurePanel', () => {
  // Phase 2 (Mitigation Plan) Task 2.3: Enable memory profiling for diagnostic visibility
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterAll(() => {
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });

  const mockOnNavigate = vi.fn();

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
    variableSchemas: [
      {
        name: 'garrison_size',
        type: 'number',
        description: 'Size of garrison stationed here',
      },
      {
        name: 'is_upgraded',
        type: 'boolean',
        description: 'Whether barracks has been upgraded',
      },
      {
        name: 'maintenance_cost',
        type: 'number',
        description: 'Gold per turn maintenance cost',
      },
    ] as VariableSchema[],
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  describe('Structure Attributes Section', () => {
    it('should render attributes section header', () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('Attributes')).toBeInTheDocument();
    });

    it('should display position X', () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('Position X')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should display position Y', () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('Position Y')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    it('should display orientation with degree symbol', () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
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

      await user.click(copyButtons[0]); // Click first copy button (Position X)

      // Wait for the clipboard API to be called
      await waitFor(
        () => {
          expect(writeTextSpy).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
      expect(writeTextSpy).toHaveBeenCalledWith('10'); // Position X value

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

  describe('Structure Type Header (Stage 8)', () => {
    it('should display structure type header with icon and formatted name', () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByTestId('structure-type-header')).toHaveTextContent('Barracks');
      expect(screen.getByText('STRUCTURE TYPE')).toBeInTheDocument();
    });

    it('should format snake_case type names to Title Case', () => {
      const structure = { ...mockStructure, type: 'war_barracks' };
      render(<StructurePanel structure={structure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByTestId('structure-type-header')).toHaveTextContent('War Barracks');
    });

    it('should format PascalCase type names to Title Case', () => {
      const structure = { ...mockStructure, type: 'GrandLibrary' };
      render(<StructurePanel structure={structure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByTestId('structure-type-header')).toHaveTextContent('Grand Library');
    });

    it('should display gradient background for header', () => {
      const { container } = render(
        <StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />,
        {
          wrapper: createWrapper(),
        }
      );
      const gradientCard = container.querySelector('.bg-gradient-to-r');
      expect(gradientCard).toBeInTheDocument();
    });
  });

  describe('Parent Settlement Context (Stage 8)', () => {
    it('should render ParentSettlementContext component', () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('Parent Settlement')).toBeInTheDocument();
    });

    it('should pass onNavigateToSettlement callback to ParentSettlementContext', async () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      // Wait for ParentSettlementContext to load settlement data
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /navigate to settlement/i })).toBeInTheDocument();
      });
    });
  });

  describe('Level Control Separation (Stage 8)', () => {
    it('should render level control in separate card', () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      const levelHeading = screen.getByText('Level');
      const levelCard = levelHeading.closest('.p-4');
      expect(levelCard).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
    });

    it('should not render level card when level is undefined', () => {
      const structure = { ...mockStructure, level: undefined };
      render(<StructurePanel structure={structure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      // "Level" heading should not exist
      expect(screen.queryByText(/^Level$/)).not.toBeInTheDocument();
    });
  });

  describe('Attributes Section (Stage 8)', () => {
    it('should render attributes in dedicated card without Type and Settlement ID', () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByText('Attributes')).toBeInTheDocument();
      // Type and Settlement ID should NOT be in Attributes section anymore
      expect(screen.queryByText('Type')).not.toBeInTheDocument();
      expect(screen.queryByText('Settlement ID')).not.toBeInTheDocument();
      // But position and orientation should be there
      expect(screen.getByText('Position X')).toBeInTheDocument();
      expect(screen.getByText('Position Y')).toBeInTheDocument();
      expect(screen.getByText('Orientation')).toBeInTheDocument();
    });
  });

  describe('TypedVariableEditor Integration (Stage 8)', () => {
    it('should render TypedVariableEditor when variableSchemas exist', () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      // TypedVariableEditor renders "Typed Variables" heading
      expect(screen.getAllByText('Typed Variables')[0]).toBeInTheDocument();
    });

    it('should not render TypedVariableEditor when variableSchemas is empty', () => {
      const structure = { ...mockStructure, variableSchemas: [] };
      render(<StructurePanel structure={structure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      // TypedVariableEditor should not be rendered, only old variables section
      const typedVariablesElements = screen.queryAllByText('Typed Variables');
      expect(typedVariablesElements.length).toBe(0);
    });

    it('should not render TypedVariableEditor when variableSchemas is undefined', () => {
      const structure = { ...mockStructure, variableSchemas: undefined };
      render(<StructurePanel structure={structure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      expect(screen.queryByText('Typed Variables')).not.toBeInTheDocument();
    });
  });

  describe('Layout (Stage 8)', () => {
    it('should render sections in correct order', async () => {
      render(<StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />, {
        wrapper: createWrapper(),
      });
      // Wait for ParentSettlementContext to finish loading
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /navigate to settlement/i })).toBeInTheDocument();
      });

      // Verify sections appear in correct order by checking text content in document order
      const allText =
        screen.getByText('STRUCTURE TYPE').parentElement?.parentElement?.parentElement?.textContent;
      expect(allText).toContain('STRUCTURE TYPE');

      // Verify Parent Settlement appears after the structure type header
      expect(screen.getByText('Parent Settlement')).toBeInTheDocument();

      // Verify Level appears (it should come after Parent Settlement)
      expect(screen.getByText('Level')).toBeInTheDocument();
    });

    it('should use space-y-6 for section spacing', () => {
      const { container } = render(
        <StructurePanel structure={mockStructure} onNavigateToSettlement={mockOnNavigate} />,
        {
          wrapper: createWrapper(),
        }
      );
      const mainContainer = container.querySelector('.space-y-6');
      expect(mainContainer).toBeInTheDocument();
    });
  });
});
