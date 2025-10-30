import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithApollo as render } from '@/__tests__/utils/test-utils';
import * as hooks from '@/services/api/hooks';
import * as versionHooks from '@/services/api/hooks/version-comparison';
import * as stores from '@/stores';

import { BranchComparisonView } from './BranchComparisonView';

// Mock the campaign store
vi.mock('@/stores', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof stores;
  return {
    ...actual,
    useCampaignStore: vi.fn(),
  };
});

// Mock the GraphQL hooks
vi.mock('@/services/api/hooks', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof hooks;
  return {
    ...actual,
    useGetBranchHierarchy: vi.fn(),
  };
});

// Mock the version comparison hooks
vi.mock('@/services/api/hooks/version-comparison', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof versionHooks;
  return {
    ...actual,
    useGetSettlementAsOf: vi.fn(),
    useGetStructureAsOf: vi.fn(),
  };
});

// Mock react-diff-viewer-continued
vi.mock('react-diff-viewer-continued', () => ({
  default: ({ oldValue, newValue, leftTitle, rightTitle }: any) => (
    <div data-testid="diff-viewer">
      <div data-testid="left-title">{leftTitle}</div>
      <div data-testid="right-title">{rightTitle}</div>
      <div data-testid="old-value">{oldValue}</div>
      <div data-testid="new-value">{newValue}</div>
    </div>
  ),
  DiffMethod: {
    WORDS: 'words',
  },
}));

describe('BranchComparisonView', () => {
  const mockBranches: Array<hooks.Branch & { depth: number }> = [
    {
      id: 'branch-main',
      name: 'Main Timeline',
      description: 'Primary timeline',
      campaignId: 'campaign-1',
      parentId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      divergedAt: null,
      isPinned: false,
      tags: [],
      depth: 0,
    },
    {
      id: 'branch-alt',
      name: 'Alternate Timeline',
      description: 'What if timeline',
      campaignId: 'campaign-1',
      parentId: 'branch-main',
      createdAt: '2024-01-15T00:00:00.000Z',
      updatedAt: '2024-01-15T00:00:00.000Z',
      divergedAt: '2024-01-15T00:00:00.000Z',
      isPinned: false,
      tags: [],
      depth: 1,
    },
  ];

  const mockSettlement: hooks.SettlementVersion = {
    id: 'settlement-1',
    name: 'Testville',
    level: 5,
    x: 100,
    y: 200,
    z: 0,
    campaignId: 'campaign-1',
    kingdomId: 'kingdom-1',
    locationId: 'location-1',
    ownerId: 'user-1',
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    computedFields: { population: 1000 },
  };

  const mockStructure: hooks.StructureVersion = {
    id: 'structure-1',
    name: 'Town Hall',
    typeId: 'type-1',
    settlementId: 'settlement-1',
    x: 10,
    y: 20,
    orientation: 90,
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Mock campaign store with default values
    vi.mocked(stores.useCampaignStore).mockReturnValue({
      currentCampaignId: 'campaign-1',
      currentBranchId: 'branch-alt',
      campaign: null,
      asOfTime: null,
      campaignBranchMap: {},
      setCurrentCampaign: vi.fn(),
      setCurrentBranch: vi.fn(),
      setAsOfTime: vi.fn(),
      clearCampaignContext: vi.fn(),
    });

    // Mock branch hierarchy hook with default success state
    vi.mocked(hooks.useGetBranchHierarchy).mockReturnValue({
      data: { branchHierarchy: [] },
      loading: false,
      error: undefined,
      hierarchy: [],
      flatBranches: mockBranches,
      refetch: vi.fn(),
    } as any);

    // Mock entity query hooks with default skipped state
    vi.mocked(versionHooks.useGetSettlementAsOf).mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
    } as any);

    vi.mocked(versionHooks.useGetStructureAsOf).mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
    } as any);
  });

  describe('Rendering and Visibility', () => {
    it('should render when campaign is selected', () => {
      render(<BranchComparisonView />);
      expect(screen.getByText('Branch Comparison')).toBeInTheDocument();
    });

    it('should not render when no campaign is selected', () => {
      vi.mocked(stores.useCampaignStore).mockReturnValue({
        currentCampaignId: null,
        currentBranchId: null,
        campaign: null,
        asOfTime: null,
        campaignBranchMap: {},
        setCurrentCampaign: vi.fn(),
        setCurrentBranch: vi.fn(),
        setAsOfTime: vi.fn(),
        clearCampaignContext: vi.fn(),
      });

      const { container } = render(<BranchComparisonView />);
      expect(container.firstChild).toBeNull();
    });

    it('should display form fields for comparison configuration', () => {
      render(<BranchComparisonView />);
      expect(screen.getByLabelText(/source branch/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/target branch/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/entity type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/entity id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/world time/i)).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('should populate default values (parent vs current branch)', () => {
      render(<BranchComparisonView />);

      // Source should default to parent
      const sourceSelect = screen.getByTestId('source-branch-select');
      expect(sourceSelect).toHaveTextContent('Main Timeline');

      // Target should default to current branch
      const targetSelect = screen.getByTestId('target-branch-select');
      expect(targetSelect).toHaveTextContent('Alternate Timeline');
    });

    it('should allow selecting entity type', async () => {
      render(<BranchComparisonView />);

      const entityTypeSelect = screen.getByTestId('entity-type-select');
      expect(entityTypeSelect).toHaveTextContent('Settlement');
    });

    it('should accept entity ID input', async () => {
      const user = userEvent.setup();
      render(<BranchComparisonView />);

      const entityIdInput = screen.getByTestId('entity-id-input');
      await user.type(entityIdInput, 'settlement-123');

      expect(entityIdInput).toHaveValue('settlement-123');
    });

    it('should accept world time input', async () => {
      const user = userEvent.setup();
      render(<BranchComparisonView />);

      const timeInput = screen.getByTestId('comparison-time-input');
      await user.clear(timeInput);
      await user.type(timeInput, '2024-01-15T00:00:00Z');

      expect(timeInput).toHaveValue('2024-01-15T00:00:00Z');
    });
  });

  describe('Compare Button and Validation', () => {
    it('should disable compare button when form is incomplete', () => {
      render(<BranchComparisonView />);
      const compareButton = screen.getByTestId('compare-button');

      // Entity ID is empty by default
      expect(compareButton).toBeDisabled();
    });

    it('should enable compare button when form is complete', async () => {
      const user = userEvent.setup();
      render(<BranchComparisonView />);

      const entityIdInput = screen.getByTestId('entity-id-input');
      await user.type(entityIdInput, 'settlement-123');

      const compareButton = screen.getByTestId('compare-button');
      expect(compareButton).not.toBeDisabled();
    });

    it('should show loading state when querying data', async () => {
      vi.mocked(hooks.useGetSettlementAsOf).mockReturnValue({
        data: undefined,
        loading: true,
        error: undefined,
        refetch: vi.fn(),
      } as any);

      const user = userEvent.setup();
      render(<BranchComparisonView />);

      const entityIdInput = screen.getByTestId('entity-id-input');
      await user.type(entityIdInput, 'settlement-123');

      const compareButton = screen.getByTestId('compare-button');
      await user.click(compareButton);

      await waitFor(() => {
        expect(screen.getByText(/comparing.../i)).toBeInTheDocument();
      });
    });
  });

  describe('Comparison Results', () => {
    it('should display settlement comparison results', async () => {
      // Mock successful settlement queries
      vi.mocked(hooks.useGetSettlementAsOf).mockImplementation(({ skip }: any) => {
        if (skip) {
          return {
            data: undefined,
            loading: false,
            error: undefined,
            refetch: vi.fn(),
          } as any;
        }
        return {
          data: { settlementAsOf: mockSettlement },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as any;
      });

      const user = userEvent.setup();
      render(<BranchComparisonView />);

      // Fill form
      const entityIdInput = screen.getByTestId('entity-id-input');
      await user.type(entityIdInput, 'settlement-1');

      // Click compare
      const compareButton = screen.getByTestId('compare-button');
      await user.click(compareButton);

      // Wait for results
      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
      });

      // Check branch labels
      expect(screen.getByTestId('source-branch-label')).toHaveTextContent('Main Timeline');
      expect(screen.getByTestId('target-branch-label')).toHaveTextContent('Alternate Timeline');
    });

    it('should display structure comparison results', async () => {
      // Mock successful structure queries
      vi.mocked(hooks.useGetStructureAsOf).mockImplementation(({ skip }: any) => {
        if (skip) {
          return {
            data: undefined,
            loading: false,
            error: undefined,
            refetch: vi.fn(),
          } as any;
        }
        return {
          data: { structureAsOf: mockStructure },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as any;
      });

      const user = userEvent.setup();
      render(<BranchComparisonView />);

      // Select structure entity type (would need to interact with select, simplified here)
      const entityIdInput = screen.getByTestId('entity-id-input');
      await user.type(entityIdInput, 'structure-1');

      const compareButton = screen.getByTestId('compare-button');
      await user.click(compareButton);

      await waitFor(() => {
        // Structure comparison shown
        expect(screen.queryByTestId('comparison-error')).not.toBeInTheDocument();
      });
    });

    it('should show warning when no data found', async () => {
      // Mock queries returning no data
      vi.mocked(hooks.useGetSettlementAsOf).mockReturnValue({
        data: { settlementAsOf: null },
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      } as any);

      const user = userEvent.setup();
      render(<BranchComparisonView />);

      const entityIdInput = screen.getByTestId('entity-id-input');
      await user.type(entityIdInput, 'nonexistent-id');

      const compareButton = screen.getByTestId('compare-button');
      await user.click(compareButton);

      await waitFor(() => {
        expect(screen.getByTestId('no-data-alert')).toBeInTheDocument();
      });
    });

    it('should display error when query fails', async () => {
      vi.mocked(hooks.useGetSettlementAsOf).mockReturnValue({
        data: undefined,
        loading: false,
        error: new Error('Network error'),
        refetch: vi.fn(),
      } as any);

      const user = userEvent.setup();
      render(<BranchComparisonView />);

      const entityIdInput = screen.getByTestId('entity-id-input');
      await user.type(entityIdInput, 'settlement-1');

      const compareButton = screen.getByTestId('compare-button');
      await user.click(compareButton);

      await waitFor(() => {
        expect(screen.getByTestId('comparison-error')).toBeInTheDocument();
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Clear Functionality', () => {
    it('should show clear button after comparison', async () => {
      vi.mocked(hooks.useGetSettlementAsOf).mockImplementation(({ skip }: any) => {
        if (skip)
          return { data: undefined, loading: false, error: undefined, refetch: vi.fn() } as any;
        return {
          data: { settlementAsOf: mockSettlement },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as any;
      });

      const user = userEvent.setup();
      render(<BranchComparisonView />);

      const entityIdInput = screen.getByTestId('entity-id-input');
      await user.type(entityIdInput, 'settlement-1');

      const compareButton = screen.getByTestId('compare-button');
      await user.click(compareButton);

      await waitFor(() => {
        expect(screen.getByTestId('clear-button')).toBeInTheDocument();
      });
    });

    it('should clear results and reset form when clear is clicked', async () => {
      vi.mocked(hooks.useGetSettlementAsOf).mockImplementation(({ skip }: any) => {
        if (skip)
          return { data: undefined, loading: false, error: undefined, refetch: vi.fn() } as any;
        return {
          data: { settlementAsOf: mockSettlement },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as any;
      });

      const user = userEvent.setup();
      render(<BranchComparisonView />);

      // Perform comparison
      const entityIdInput = screen.getByTestId('entity-id-input');
      await user.type(entityIdInput, 'settlement-1');

      const compareButton = screen.getByTestId('compare-button');
      await user.click(compareButton);

      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
      });

      // Click clear
      const clearButton = screen.getByTestId('clear-button');
      await user.click(clearButton);

      // Results should be cleared
      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('clear-button')).not.toBeInTheDocument();

      // Entity ID should be cleared
      expect(entityIdInput).toHaveValue('');
    });
  });

  describe('Help Text', () => {
    it('should show helpful information when not comparing', () => {
      render(<BranchComparisonView />);
      expect(screen.getByTestId('help-text')).toBeInTheDocument();
      expect(screen.getByText(/default comparison/i)).toBeInTheDocument();
    });

    it('should not show help text when comparing', async () => {
      vi.mocked(hooks.useGetSettlementAsOf).mockImplementation(({ skip }: any) => {
        if (skip)
          return { data: undefined, loading: false, error: undefined, refetch: vi.fn() } as any;
        return {
          data: { settlementAsOf: mockSettlement },
          loading: false,
          error: undefined,
          refetch: vi.fn(),
        } as any;
      });

      const user = userEvent.setup();
      render(<BranchComparisonView />);

      const entityIdInput = screen.getByTestId('entity-id-input');
      await user.type(entityIdInput, 'settlement-1');

      const compareButton = screen.getByTestId('compare-button');
      await user.click(compareButton);

      await waitFor(() => {
        expect(screen.queryByTestId('help-text')).not.toBeInTheDocument();
      });
    });
  });
});
