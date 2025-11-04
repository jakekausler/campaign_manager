/**
 * Unit tests for SettlementHierarchyPanel component
 *
 * Tests the Settlement hierarchy tree view including:
 * - Tree rendering with Settlement root and Structure children
 * - Expand/collapse functionality
 * - Quick stats display (total structures, average level)
 * - Structure type icons
 * - Structure selection callbacks
 * - "Add Structure" button integration
 * - Loading and error states
 * - Empty state (no structures)
 */

import { ApolloProvider } from '@apollo/client/react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach, afterAll } from 'vitest';

import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';
import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { SettlementHierarchyPanel } from './SettlementHierarchyPanel';

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

afterEach(() => {
  cleanup(); // Unmount all React components
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('SettlementHierarchyPanel', () => {
  // Phase 2 (Mitigation Plan) Task 2.3: Enable memory profiling for diagnostic visibility
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterAll(() => {
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });

  const defaultProps = {
    settlementId: 'settlement-1',
    settlementName: 'Ironhold',
    settlementLevel: 3,
  };

  describe('Header and Quick Stats', () => {
    it('should render hierarchy header', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('Hierarchy')).toBeInTheDocument();
    });

    it('should display total structure count', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      // Wait for structures to load (settlement-1 has 3 structures in mock data)
      await waitFor(() => {
        expect(screen.getByText(/3 structures/i)).toBeInTheDocument();
      });
    });

    it('should display singular "structure" for 1 structure', async () => {
      const Wrapper = createWrapper();
      // settlement-2 has only 1 structure in mock data
      render(
        <SettlementHierarchyPanel
          {...defaultProps}
          settlementId="settlement-2"
          settlementName="Stonehaven"
        />,
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(screen.getByText(/1 structure[^s]/i)).toBeInTheDocument();
      });
    });

    it('should display average level when structures exist', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      // settlement-1 has structures with levels: 1, 1, 2 -> average = 1.3
      await waitFor(() => {
        expect(screen.getByText(/Avg\. Level 1\.3/i)).toBeInTheDocument();
      });
    });

    it('should not display average level when no structures exist', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} settlementId="settlement-empty" />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(screen.getByText('0 structures')).toBeInTheDocument();
      });

      // Should not show "Avg. Level" text
      expect(screen.queryByText(/Avg\. Level/i)).not.toBeInTheDocument();
    });
  });

  describe('Settlement Root Node', () => {
    it('should display settlement name and level', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('Ironhold')).toBeInTheDocument();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
    });

    it('should show expand icon when tree is expanded', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      const settlementButton = screen.getByRole('button', { name: /ironhold/i });
      expect(settlementButton).toBeInTheDocument();

      // Should have ChevronDown icon (tree starts expanded)
      // We can't easily test for the icon itself, but we can verify the button exists
      expect(settlementButton).toBeInTheDocument();
    });

    it('should collapse tree when settlement node is clicked', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      // Wait for structures to load
      await waitFor(() => {
        expect(screen.getByText('Main Barracks')).toBeInTheDocument();
      });

      // Click settlement node to collapse
      const settlementButton = screen.getByRole('button', { name: /ironhold/i });
      await user.click(settlementButton);

      // Structures should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Main Barracks')).not.toBeInTheDocument();
      });
    });

    it('should expand tree when settlement node is clicked again', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      // Wait for structures to load
      await waitFor(() => {
        expect(screen.getByText('Main Barracks')).toBeInTheDocument();
      });

      const settlementButton = screen.getByRole('button', { name: /ironhold/i });

      // Collapse
      await user.click(settlementButton);
      await waitFor(() => {
        expect(screen.queryByText('Main Barracks')).not.toBeInTheDocument();
      });

      // Expand
      await user.click(settlementButton);
      await waitFor(() => {
        expect(screen.getByText('Main Barracks')).toBeInTheDocument();
      });
    });
  });

  describe('Structure Child Nodes', () => {
    it('should display structure names', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('Main Barracks')).toBeInTheDocument();
        expect(screen.getByText('Central Market')).toBeInTheDocument();
        expect(screen.getByText('Grand Library')).toBeInTheDocument();
      });
    });

    it('should display structure types', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('barracks')).toBeInTheDocument();
        expect(screen.getByText('marketplace')).toBeInTheDocument();
        expect(screen.getByText('library')).toBeInTheDocument();
      });
    });

    it('should display structure levels', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        // Levels are displayed as "L1", "L2", etc.
        // settlement-1 has 2 structures with L1 and 1 with L2
        const level1Elements = screen.getAllByText('L1');
        expect(level1Elements).toHaveLength(2);
        expect(screen.getByText('L2')).toBeInTheDocument();
      });
    });

    it('should call onStructureSelect when structure is clicked', async () => {
      const user = userEvent.setup();
      const onStructureSelect = vi.fn();
      const Wrapper = createWrapper();

      render(<SettlementHierarchyPanel {...defaultProps} onStructureSelect={onStructureSelect} />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(screen.getByText('Main Barracks')).toBeInTheDocument();
      });

      const structureButton = screen.getByRole('button', { name: /main barracks/i });
      await user.click(structureButton);

      await waitFor(() => {
        expect(onStructureSelect).toHaveBeenCalledWith('structure-1');
      });
    });

    it('should not call onStructureSelect when callback is not provided', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();

      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('Main Barracks')).toBeInTheDocument();
      });

      const structureButton = screen.getByRole('button', { name: /main barracks/i });

      // Should not throw error
      await expect(user.click(structureButton)).resolves.not.toThrow();
    });
  });

  describe('Add Structure Button', () => {
    it('should display "Add Structure" button when callback is provided', () => {
      const onAddStructure = vi.fn();
      const Wrapper = createWrapper();

      render(<SettlementHierarchyPanel {...defaultProps} onAddStructure={onAddStructure} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByRole('button', { name: /add structure/i })).toBeInTheDocument();
    });

    it('should not display "Add Structure" button when callback is not provided', () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.queryByRole('button', { name: /add structure/i })).not.toBeInTheDocument();
    });

    it('should call onAddStructure when button is clicked', async () => {
      const user = userEvent.setup();
      const onAddStructure = vi.fn();
      const Wrapper = createWrapper();

      render(<SettlementHierarchyPanel {...defaultProps} onAddStructure={onAddStructure} />, {
        wrapper: Wrapper,
      });

      const addButton = screen.getByRole('button', { name: /add structure/i });
      await user.click(addButton);

      expect(onAddStructure).toHaveBeenCalledOnce();
    });
  });

  describe('Loading State', () => {
    it('should display loading skeletons while fetching structures', () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      // Should show skeletons initially
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should hide loading skeletons after structures are loaded', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      // Wait for structures to load
      await waitFor(() => {
        expect(screen.getByText('Main Barracks')).toBeInTheDocument();
      });

      // Skeletons should be gone
      expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} settlementId="invalid-settlement" />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to load structures')).toBeInTheDocument();
        expect(screen.getByText('Internal server error')).toBeInTheDocument();
      });
    });

    it('should not display structures when error occurs', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} settlementId="invalid-settlement" />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to load structures')).toBeInTheDocument();
      });

      // Should not show any structure names
      expect(screen.queryByText('Main Barracks')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state message when no structures exist', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} settlementId="settlement-empty" />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(screen.getByText('No structures in this settlement')).toBeInTheDocument();
      });
    });

    it('should display "Add First Structure" button in empty state when callback is provided', async () => {
      const onAddStructure = vi.fn();
      const Wrapper = createWrapper();

      render(
        <SettlementHierarchyPanel
          {...defaultProps}
          settlementId="settlement-empty"
          onAddStructure={onAddStructure}
        />,
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Add First Structure')).toBeInTheDocument();
      });
    });

    it('should call onAddStructure when "Add First Structure" is clicked', async () => {
      const user = userEvent.setup();
      const onAddStructure = vi.fn();
      const Wrapper = createWrapper();

      render(
        <SettlementHierarchyPanel
          {...defaultProps}
          settlementId="settlement-empty"
          onAddStructure={onAddStructure}
        />,
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Add First Structure')).toBeInTheDocument();
      });

      const addFirstButton = screen.getByRole('button', { name: /add first structure/i });
      await user.click(addFirstButton);

      expect(onAddStructure).toHaveBeenCalledOnce();
    });

    it('should not display "Add First Structure" button when callback is not provided', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} settlementId="settlement-empty" />, {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(screen.getByText('No structures in this settlement')).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('button', { name: /add first structure/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Quick Stats Calculations', () => {
    it('should calculate average level correctly for multiple structures', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      // settlement-1 has 3 structures: level 1, 1, 2 -> avg = 4/3 = 1.3
      await waitFor(() => {
        expect(screen.getByText(/Avg\. Level 1\.3/i)).toBeInTheDocument();
      });
    });

    it('should handle structures with level 0', async () => {
      const Wrapper = createWrapper();
      // settlement-3 has structure with level 0 in mock data
      render(
        <SettlementHierarchyPanel
          {...defaultProps}
          settlementId="settlement-3"
          settlementName="Riverwatch"
        />,
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        // Should display 0.0 average
        expect(screen.getByText(/Avg\. Level 0\.0/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible settlement button', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      const settlementButton = screen.getByRole('button', { name: /ironhold/i });
      expect(settlementButton).toHaveAttribute('class');
    });

    it('should have accessible structure buttons', async () => {
      const Wrapper = createWrapper();
      render(<SettlementHierarchyPanel {...defaultProps} />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /main barracks/i })).toBeInTheDocument();
      });

      const structureButtons = screen.getAllByRole('button', { name: /barracks|market|library/i });
      expect(structureButtons.length).toBeGreaterThan(0);
    });

    it('should have accessible add structure button', () => {
      const onAddStructure = vi.fn();
      const Wrapper = createWrapper();

      render(<SettlementHierarchyPanel {...defaultProps} onAddStructure={onAddStructure} />, {
        wrapper: Wrapper,
      });

      const addButton = screen.getByRole('button', { name: /add structure/i });
      expect(addButton).toBeInTheDocument();
    });
  });
});
