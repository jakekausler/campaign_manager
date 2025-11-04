import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach, afterAll } from 'vitest';

import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';
import { createEmptyFilters, type GraphFilters } from '@/utils';

import { FilterPanel } from './FilterPanel';

/**
 * Test suite for FilterPanel component
 *
 * Tests the filter controls panel that provides search and filtering capabilities
 * for the dependency graph visualization.
 * Part of TICKET-021 Stage 11: Add Filtering and Search
 */

describe('FilterPanel', () => {
  // Phase 2 (Mitigation Plan) Task 2.3: Enable memory profiling for diagnostic visibility
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterEach(() => {
    cleanup(); // Unmount all React components
    vi.clearAllMocks(); // Clear all mock function call history
  });

  afterAll(() => {
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });

  const mockNodeTypeCounts = {
    VARIABLE: 10,
    CONDITION: 5,
    EFFECT: 3,
    ENTITY: 2,
  };

  const mockEdgeTypeCounts = {
    READS: 15,
    WRITES: 8,
    DEPENDS_ON: 12,
  };

  describe('rendering', () => {
    it('should render filter panel with all sections', () => {
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      // Header
      expect(screen.getByText('Filters')).toBeInTheDocument();

      // Search input
      expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();

      // Node type filters
      expect(screen.getByText(/Variables \(10\)/)).toBeInTheDocument();
      expect(screen.getByText(/Conditions \(5\)/)).toBeInTheDocument();
      expect(screen.getByText(/Effects \(3\)/)).toBeInTheDocument();
      expect(screen.getByText(/Entities \(2\)/)).toBeInTheDocument();

      // Edge type filters
      expect(screen.getByText(/Reads \(15\)/)).toBeInTheDocument();
      expect(screen.getByText(/Writes \(8\)/)).toBeInTheDocument();
      expect(screen.getByText(/Dependencies \(12\)/)).toBeInTheDocument();

      // Special filters
      expect(screen.getByText('Show cycles only')).toBeInTheDocument();
      expect(screen.getByText('Show selected and connected')).toBeInTheDocument();
    });

    it('should show clear button when filters are active', () => {
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={true}
        />
      );

      expect(screen.getByLabelText('Clear all filters')).toBeInTheDocument();
    });

    it('should hide clear button when no filters are active', () => {
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      expect(screen.queryByLabelText('Clear all filters')).not.toBeInTheDocument();
    });
  });

  describe('search input', () => {
    it('should call onFiltersChange when search query changes', async () => {
      const user = userEvent.setup();
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search nodes...');

      // Type 't' into the search input
      await user.type(searchInput, 't');

      // Verify onFiltersChange was called with searchQuery: 't'
      expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ searchQuery: 't' }));
    });

    it('should display current search query', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        searchQuery: 'health',
      };
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={true}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search nodes...') as HTMLInputElement;
      expect(searchInput.value).toBe('health');
    });
  });

  describe('node type filters', () => {
    it('should toggle VARIABLE filter when clicked', async () => {
      const user = userEvent.setup();
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Variables/ });
      await user.click(checkbox);

      expect(onFiltersChange).toHaveBeenCalled();
      const updatedFilters = onFiltersChange.mock.calls[0][0];
      expect(updatedFilters.nodeTypes.has('VARIABLE')).toBe(true);
    });

    it('should toggle CONDITION filter when clicked', async () => {
      const user = userEvent.setup();
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Conditions/ });
      await user.click(checkbox);

      expect(onFiltersChange).toHaveBeenCalled();
      const updatedFilters = onFiltersChange.mock.calls[0][0];
      expect(updatedFilters.nodeTypes.has('CONDITION')).toBe(true);
    });

    it('should uncheck node type filter when clicked again', async () => {
      const user = userEvent.setup();
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        nodeTypes: new Set(['VARIABLE']),
      };
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={true}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Variables/ });
      expect(checkbox).toBeChecked();

      await user.click(checkbox);

      expect(onFiltersChange).toHaveBeenCalled();
      const updatedFilters = onFiltersChange.mock.calls[0][0];
      expect(updatedFilters.nodeTypes.has('VARIABLE')).toBe(false);
    });

    it('should show checked state for active node type filters', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        nodeTypes: new Set(['VARIABLE', 'EFFECT']),
      };
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={true}
        />
      );

      const variableCheckbox = screen.getByRole('checkbox', { name: /Variables/ });
      const conditionCheckbox = screen.getByRole('checkbox', { name: /Conditions/ });
      const effectCheckbox = screen.getByRole('checkbox', { name: /Effects/ });
      const entityCheckbox = screen.getByRole('checkbox', { name: /Entities/ });

      expect(variableCheckbox).toBeChecked();
      expect(conditionCheckbox).not.toBeChecked();
      expect(effectCheckbox).toBeChecked();
      expect(entityCheckbox).not.toBeChecked();
    });
  });

  describe('edge type filters', () => {
    it('should toggle READS filter when clicked', async () => {
      const user = userEvent.setup();
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Reads/ });
      await user.click(checkbox);

      expect(onFiltersChange).toHaveBeenCalled();
      const updatedFilters = onFiltersChange.mock.calls[0][0];
      expect(updatedFilters.edgeTypes.has('READS')).toBe(true);
    });

    it('should toggle WRITES filter when clicked', async () => {
      const user = userEvent.setup();
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Writes/ });
      await user.click(checkbox);

      expect(onFiltersChange).toHaveBeenCalled();
      const updatedFilters = onFiltersChange.mock.calls[0][0];
      expect(updatedFilters.edgeTypes.has('WRITES')).toBe(true);
    });

    it('should toggle DEPENDS_ON filter when clicked', async () => {
      const user = userEvent.setup();
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Dependencies/ });
      await user.click(checkbox);

      expect(onFiltersChange).toHaveBeenCalled();
      const updatedFilters = onFiltersChange.mock.calls[0][0];
      expect(updatedFilters.edgeTypes.has('DEPENDS_ON')).toBe(true);
    });

    it('should show checked state for active edge type filters', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        edgeTypes: new Set(['READS', 'DEPENDS_ON']),
      };
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={true}
        />
      );

      const readsCheckbox = screen.getByRole('checkbox', { name: /Reads/ });
      const writesCheckbox = screen.getByRole('checkbox', { name: /Writes/ });
      const dependsOnCheckbox = screen.getByRole('checkbox', { name: /Dependencies/ });

      expect(readsCheckbox).toBeChecked();
      expect(writesCheckbox).not.toBeChecked();
      expect(dependsOnCheckbox).toBeChecked();
    });
  });

  describe('special filters', () => {
    it('should toggle showCyclesOnly when clicked', async () => {
      const user = userEvent.setup();
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Show cycles only/ });
      await user.click(checkbox);

      expect(onFiltersChange).toHaveBeenCalled();
      const updatedFilters = onFiltersChange.mock.calls[0][0];
      expect(updatedFilters.showCyclesOnly).toBe(true);
    });

    it('should toggle showSelectedOnly when clicked', async () => {
      const user = userEvent.setup();
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Show selected and connected/ });
      await user.click(checkbox);

      expect(onFiltersChange).toHaveBeenCalled();
      const updatedFilters = onFiltersChange.mock.calls[0][0];
      expect(updatedFilters.showSelectedOnly).toBe(true);
    });

    it('should show checked state for active special filters', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        showCyclesOnly: true,
        showSelectedOnly: true,
      };
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={true}
        />
      );

      const cyclesCheckbox = screen.getByRole('checkbox', { name: /Show cycles only/ });
      const selectedCheckbox = screen.getByRole('checkbox', {
        name: /Show selected and connected/,
      });

      expect(cyclesCheckbox).toBeChecked();
      expect(selectedCheckbox).toBeChecked();
    });
  });

  describe('clear filters button', () => {
    it('should call onClearFilters when clicked', async () => {
      const user = userEvent.setup();
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        searchQuery: 'test',
      };
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={true}
        />
      );

      const clearButton = screen.getByLabelText('Clear all filters');
      await user.click(clearButton);

      expect(onClearFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels for search input', () => {
      const filters = createEmptyFilters();
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={false}
        />
      );

      const searchInput = screen.getByLabelText('Search nodes by label');
      expect(searchInput).toBeInTheDocument();
    });

    it('should have accessible labels for clear button', () => {
      const filters: GraphFilters = {
        ...createEmptyFilters(),
        searchQuery: 'test',
      };
      const onFiltersChange = vi.fn();
      const onClearFilters = vi.fn();

      render(
        <FilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
          nodeTypeCounts={mockNodeTypeCounts}
          edgeTypeCounts={mockEdgeTypeCounts}
          hasActiveFilters={true}
        />
      );

      const clearButton = screen.getByLabelText('Clear all filters');
      expect(clearButton).toHaveAttribute('title', 'Clear all filters');
    });
  });
});
