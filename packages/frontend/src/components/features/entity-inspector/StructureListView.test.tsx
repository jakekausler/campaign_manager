import { MockedProvider } from '@apollo/client/testing/react';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as structureHooks from '@/services/api/hooks/structures';

import { StructureListView } from './StructureListView';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

// Mock the useStructuresForMap hook
vi.mock('@/services/api/hooks/structures', () => ({
  useStructuresForMap: vi.fn(),
}));

// Mock the useDeleteStructure hook
vi.mock('@/services/api/mutations/structures', () => ({
  useDeleteStructure: vi.fn(() => ({
    deleteStructure: vi.fn(),
    loading: false,
  })),
}));

describe('StructureListView', () => {
  const mockStructures = [
    {
      id: 'structure-1',
      name: 'Ancient Temple',
      typeId: 'temple-type',
      type: 'temple',
      settlementId: 'settlement-1',
      x: 100,
      y: 200,
      orientation: 0,
      isArchived: false,
      level: 3,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      archivedAt: null,
    },
    {
      id: 'structure-2',
      name: 'Royal Barracks',
      typeId: 'barracks-type',
      type: 'barracks',
      settlementId: 'settlement-1',
      x: 150,
      y: 250,
      orientation: 90,
      isArchived: false,
      level: 5,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      archivedAt: null,
    },
    {
      id: 'structure-3',
      name: 'Central Market',
      typeId: 'market-type',
      type: 'market',
      settlementId: 'settlement-1',
      x: 200,
      y: 300,
      orientation: 180,
      isArchived: false,
      level: 2,
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
      archivedAt: null,
    },
    {
      id: 'structure-4',
      name: 'Grand Library',
      typeId: 'library-type',
      type: 'library',
      settlementId: 'settlement-1',
      x: 250,
      y: 350,
      orientation: 270,
      isArchived: false,
      level: 4,
      createdAt: '2024-01-04T00:00:00Z',
      updatedAt: '2024-01-04T00:00:00Z',
      archivedAt: null,
    },
    {
      id: 'structure-5',
      name: 'Blacksmith Forge',
      typeId: 'forge-type',
      type: 'forge',
      settlementId: 'settlement-1',
      x: 300,
      y: 400,
      orientation: 45,
      isArchived: false,
      level: 3,
      createdAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-01-05T00:00:00Z',
      archivedAt: null,
    },
  ];

  const defaultProps = {
    settlementId: 'settlement-1',
    onStructureSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    vi.mocked(structureHooks.useStructuresForMap).mockReturnValue({
      structures: mockStructures,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      networkStatus: 7, // NetworkStatus.ready
    });
  });

  // Helper to render component with Apollo Client context
  const renderWithApollo = (ui: React.ReactElement) => {
    return render(<MockedProvider>{ui}</MockedProvider>);
  };

  describe('Rendering', () => {
    it('should render the component with header', () => {
      renderWithApollo(<StructureListView {...defaultProps} />);

      expect(screen.getByText('Structures')).toBeInTheDocument();
      expect(screen.getByText('5 of 5 structures')).toBeInTheDocument();
    });

    it('should render all structures when not filtered', () => {
      renderWithApollo(<StructureListView {...defaultProps} />);

      expect(screen.getByText('Ancient Temple')).toBeInTheDocument();
      expect(screen.getByText('Royal Barracks')).toBeInTheDocument();
      expect(screen.getByText('Central Market')).toBeInTheDocument();
      expect(screen.getByText('Grand Library')).toBeInTheDocument();
      expect(screen.getByText('Blacksmith Forge')).toBeInTheDocument();
    });

    it('should render structure types and levels', () => {
      renderWithApollo(<StructureListView {...defaultProps} />);

      // Check for type badges (using getAllByText since types appear in both dropdown and cards)
      expect(screen.getAllByText('temple').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('barracks').length).toBeGreaterThanOrEqual(1);

      // Check for level badges (using getAllByText since multiple structures can have same level)
      expect(screen.getAllByText('Level 3').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Level 5').length).toBeGreaterThanOrEqual(1);
    });

    it('should render loading skeletons when loading', () => {
      vi.mocked(structureHooks.useStructuresForMap).mockReturnValue({
        structures: [],
        loading: true,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 1, // NetworkStatus.loading
      });

      renderWithApollo(<StructureListView {...defaultProps} />);

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render error state when error occurs', () => {
      const error = new Error('Failed to fetch structures');
      vi.mocked(structureHooks.useStructuresForMap).mockReturnValue({
        structures: [],
        loading: false,
        error,
        refetch: vi.fn(),
        networkStatus: 8, // NetworkStatus.error
      });

      renderWithApollo(<StructureListView {...defaultProps} />);

      expect(screen.getByText('Failed to load structures')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch structures')).toBeInTheDocument();
    });

    it('should render empty state when no structures', () => {
      vi.mocked(structureHooks.useStructuresForMap).mockReturnValue({
        structures: [],
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7, // NetworkStatus.ready
      });

      renderWithApollo(<StructureListView {...defaultProps} />);

      expect(screen.getByText('No structures found')).toBeInTheDocument();
      expect(screen.getByText('This settlement has no structures')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter structures by search query', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name...');
      await user.type(searchInput, 'Temple');

      // Wait for debounce (300ms)
      await waitFor(
        () => {
          expect(screen.getByText('Ancient Temple')).toBeInTheDocument();
          expect(screen.queryByText('Royal Barracks')).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it('should debounce search input (300ms)', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name...');

      // Type quickly
      await user.type(searchInput, 'Temple');

      // Results should not filter immediately
      expect(screen.getByText('Royal Barracks')).toBeInTheDocument();

      // Wait for debounce
      await waitFor(
        () => {
          expect(screen.queryByText('Royal Barracks')).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it('should be case-insensitive', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name...');
      await user.type(searchInput, 'TEMPLE');

      await waitFor(
        () => {
          expect(screen.getByText('Ancient Temple')).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it('should show empty state when search has no results', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name...');
      await user.type(searchInput, 'NonexistentStructure');

      await waitFor(
        () => {
          expect(screen.getByText('No structures found')).toBeInTheDocument();
          expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it('should update result count when filtering', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name...');
      await user.type(searchInput, 'Temple');

      await waitFor(
        () => {
          expect(screen.getByText('1 of 5 structures')).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });
  });

  describe('Filter by Type', () => {
    it('should filter structures by type', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const filterSelect = screen.getByDisplayValue('All Types');
      await user.selectOptions(filterSelect, 'temple');

      expect(screen.getByText('Ancient Temple')).toBeInTheDocument();
      expect(screen.queryByText('Royal Barracks')).not.toBeInTheDocument();
      expect(screen.getByText('1 of 5 structures')).toBeInTheDocument();
    });

    it('should show all types in filter dropdown', () => {
      renderWithApollo(<StructureListView {...defaultProps} />);

      const filterSelect = screen.getByDisplayValue('All Types');
      const options = within(filterSelect as HTMLSelectElement).getAllByRole('option');

      expect(options).toHaveLength(6); // "All Types" + 5 unique types
      expect(options[0]).toHaveTextContent('All Types');
      expect(options[1]).toHaveTextContent('barracks');
      expect(options[2]).toHaveTextContent('forge');
      expect(options[3]).toHaveTextContent('library');
      expect(options[4]).toHaveTextContent('market');
      expect(options[5]).toHaveTextContent('temple');
    });

    it('should reset to all types when selecting "All Types"', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const filterSelect = screen.getByDisplayValue('All Types');

      // Filter to temple
      await user.selectOptions(filterSelect, 'temple');
      expect(screen.getByText('1 of 5 structures')).toBeInTheDocument();

      // Reset to all
      await user.selectOptions(filterSelect, 'all');
      expect(screen.getByText('5 of 5 structures')).toBeInTheDocument();
    });

    it('should combine search and filter', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name...');
      const filterSelect = screen.getByDisplayValue('All Types');

      // Search for "a" (matches Ancient Temple, Royal Barracks, Central Market, Grand Library)
      await user.type(searchInput, 'a');
      await user.selectOptions(filterSelect, 'temple');

      await waitFor(
        () => {
          expect(screen.getByText('Ancient Temple')).toBeInTheDocument();
          expect(screen.queryByText('Royal Barracks')).not.toBeInTheDocument();
          expect(screen.getByText('1 of 5 structures')).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });
  });

  describe('Sort Functionality', () => {
    it('should sort by name ascending by default', () => {
      renderWithApollo(<StructureListView {...defaultProps} />);

      const structures = screen.getAllByRole('button', { name: /Level \d+/ });
      expect(structures[0]).toHaveTextContent('Ancient Temple');
      expect(structures[1]).toHaveTextContent('Blacksmith Forge');
      expect(structures[2]).toHaveTextContent('Central Market');
      expect(structures[3]).toHaveTextContent('Grand Library');
      expect(structures[4]).toHaveTextContent('Royal Barracks');
    });

    it('should toggle sort order when clicking same sort button', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const nameButton = screen.getByRole('button', { name: /Name/ });

      // Click to reverse (descending)
      await user.click(nameButton);

      const structures = screen.getAllByRole('button', { name: /Level \d+/ });
      expect(structures[0]).toHaveTextContent('Royal Barracks');
      expect(structures[1]).toHaveTextContent('Grand Library');
      expect(structures[4]).toHaveTextContent('Ancient Temple');
    });

    it('should sort by type', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const typeButton = screen.getByRole('button', { name: /^Type/ });
      await user.click(typeButton);

      const structures = screen.getAllByRole('button', { name: /Level \d+/ });
      expect(structures[0]).toHaveTextContent('Royal Barracks'); // barracks
      expect(structures[1]).toHaveTextContent('Blacksmith Forge'); // forge
      expect(structures[2]).toHaveTextContent('Grand Library'); // library
      expect(structures[3]).toHaveTextContent('Central Market'); // market
      expect(structures[4]).toHaveTextContent('Ancient Temple'); // temple
    });

    it('should sort by level', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const levelButton = screen.getByRole('button', { name: /^Level/ });
      await user.click(levelButton);

      const structures = screen.getAllByRole('button', { name: /Level \d+/ });
      expect(structures[0]).toHaveTextContent('Level 2'); // Central Market
      expect(structures[1]).toHaveTextContent('Level 3'); // Ancient Temple
      expect(structures[2]).toHaveTextContent('Level 3'); // Blacksmith Forge
      expect(structures[3]).toHaveTextContent('Level 4'); // Grand Library
      expect(structures[4]).toHaveTextContent('Level 5'); // Royal Barracks
    });

    it('should show sort indicator on active sort button', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const nameButton = screen.getByRole('button', { name: /Name/ });
      expect(nameButton).toHaveTextContent('↑'); // Default ascending

      await user.click(nameButton);
      expect(nameButton).toHaveTextContent('↓'); // Descending

      const typeButton = screen.getByRole('button', { name: /^Type/ });
      await user.click(typeButton);
      expect(typeButton).toHaveTextContent('↑'); // Type now ascending
      expect(nameButton).not.toHaveTextContent(/[↑↓]/); // Name no longer active
    });
  });

  describe('Structure Selection', () => {
    it('should call onStructureSelect when clicking a structure', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      renderWithApollo(<StructureListView {...defaultProps} onStructureSelect={onSelect} />);

      const temple = screen.getByText('Ancient Temple');
      await user.click(temple.closest('button')!);

      expect(onSelect).toHaveBeenCalledWith('structure-1');
    });

    it('should not call onStructureSelect if callback not provided', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView settlementId="settlement-1" />);

      const temple = screen.getByText('Ancient Temple');
      await user.click(temple.closest('button')!);

      // Should not throw error
    });

    it('should call onStructureSelect with correct ID for different structures', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      renderWithApollo(<StructureListView {...defaultProps} onStructureSelect={onSelect} />);

      const barracks = screen.getByText('Royal Barracks');
      await user.click(barracks.closest('button')!);

      expect(onSelect).toHaveBeenCalledWith('structure-2');

      const market = screen.getByText('Central Market');
      await user.click(market.closest('button')!);

      expect(onSelect).toHaveBeenCalledWith('structure-3');
    });
  });

  describe('Icons', () => {
    it('should display correct icon for each structure type', () => {
      renderWithApollo(<StructureListView {...defaultProps} />);

      // We can't directly test SVG icons, but we can verify they render without errors
      const structureButtons = screen.getAllByRole('button', { name: /Level \d+/ });
      expect(structureButtons).toHaveLength(5);
    });

    it('should display default icon for unknown type', () => {
      const structuresWithUnknownType = [
        {
          id: 'structure-unknown',
          name: 'Unknown Structure',
          typeId: 'unknown-type-id',
          type: 'unknown-type',
          settlementId: 'settlement-1',
          x: 100,
          y: 200,
          orientation: 0,
          isArchived: false,
          level: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          archivedAt: null,
        },
      ];

      vi.mocked(structureHooks.useStructuresForMap).mockReturnValue({
        structures: structuresWithUnknownType,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7, // NetworkStatus.ready
      });

      renderWithApollo(<StructureListView {...defaultProps} />);

      expect(screen.getByText('Unknown Structure')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle structures without type', () => {
      const structuresWithoutType = [
        {
          id: 'structure-1',
          name: 'Unnamed Structure',
          typeId: 'some-type-id',
          type: undefined,
          settlementId: 'settlement-1',
          x: 100,
          y: 200,
          orientation: 0,
          isArchived: false,
          level: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          archivedAt: null,
        },
      ];

      vi.mocked(structureHooks.useStructuresForMap).mockReturnValue({
        structures: structuresWithoutType,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7, // NetworkStatus.ready
      });

      renderWithApollo(<StructureListView {...defaultProps} />);

      expect(screen.getByText('Unnamed Structure')).toBeInTheDocument();
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });

    it('should handle structures without level', () => {
      const structuresWithoutLevel = [
        {
          id: 'structure-1',
          name: 'Levelless Structure',
          typeId: 'temple-type',
          type: 'temple',
          settlementId: 'settlement-1',
          x: 100,
          y: 200,
          orientation: 0,
          isArchived: false,
          level: undefined,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          archivedAt: null,
        },
      ];

      vi.mocked(structureHooks.useStructuresForMap).mockReturnValue({
        structures: structuresWithoutLevel,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        networkStatus: 7, // NetworkStatus.ready
      });

      renderWithApollo(<StructureListView {...defaultProps} />);

      expect(screen.getByText('Levelless Structure')).toBeInTheDocument();
      expect(screen.queryByText(/Level \d+/)).not.toBeInTheDocument();
    });

    it('should handle empty search query gracefully', async () => {
      const user = userEvent.setup();
      renderWithApollo(<StructureListView {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name...');
      await user.type(searchInput, '   '); // Whitespace only

      await waitFor(
        () => {
          // Should show all structures (empty query after trim)
          expect(screen.getByText('5 of 5 structures')).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });
  });
});
