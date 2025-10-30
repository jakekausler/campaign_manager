import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderWithApollo as render } from '@/__tests__/utils/test-utils';
import * as hooks from '@/services/api/hooks';
import * as stores from '@/stores';

import { BranchSelector } from './BranchSelector';

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

describe('BranchSelector', () => {
  const mockSetCurrentBranch = vi.fn();

  const mockBranches = [
    {
      id: 'branch-main',
      name: 'Main Timeline',
      description: 'The primary campaign timeline',
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
      id: 'branch-alt1',
      name: 'Alternate Path',
      description: 'What if the party took the western road?',
      campaignId: 'campaign-1',
      parentId: 'branch-main',
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:00.000Z',
      divergedAt: '2024-01-15T12:00:00.000Z',
      isPinned: false,
      tags: [],
      depth: 1,
    },
    {
      id: 'branch-alt2',
      name: 'Dark Timeline',
      description: null,
      campaignId: 'campaign-1',
      parentId: 'branch-alt1',
      createdAt: '2024-03-01T00:00:00.000Z',
      updatedAt: '2024-03-01T00:00:00.000Z',
      divergedAt: '2024-02-10T15:30:00.000Z',
      isPinned: false,
      tags: [],
      depth: 2,
    },
  ];

  beforeEach(() => {
    vi.mocked(stores.useCampaignStore).mockReturnValue({
      currentCampaignId: 'campaign-1',
      currentBranchId: 'branch-main',
      campaign: null,
      asOfTime: null,
      campaignBranchMap: {},
      setCurrentCampaign: vi.fn(),
      setCurrentBranch: mockSetCurrentBranch,
      setAsOfTime: vi.fn(),
      clearCampaignContext: vi.fn(),
    });

    vi.mocked(hooks.useGetBranchHierarchy).mockReturnValue({
      flatBranches: mockBranches,
      hierarchy: [],
      loading: false,
      error: undefined,
      data: undefined,
      refetch: vi.fn(),
      networkStatus: 7,
      previousData: undefined,
      client: {} as never,
      observable: {} as never,
      variables: { campaignId: 'campaign-1' },
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      subscribeToMore: vi.fn(),
      updateQuery: vi.fn(),
      fetchMore: vi.fn(),
      dataState: 'empty' as const,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when no campaign is selected', () => {
      vi.mocked(stores.useCampaignStore).mockReturnValue({
        currentCampaignId: null,
        currentBranchId: null,
        campaign: null,
        asOfTime: null,
        campaignBranchMap: {},
        setCurrentCampaign: vi.fn(),
        setCurrentBranch: mockSetCurrentBranch,
        setAsOfTime: vi.fn(),
        clearCampaignContext: vi.fn(),
      });

      const { container } = render(<BranchSelector />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when campaign is selected', () => {
      render(<BranchSelector />);
      expect(screen.getByTestId('branch-selector-trigger')).toBeInTheDocument();
    });
  });

  describe('Trigger Button', () => {
    it('should display current branch name', () => {
      render(<BranchSelector />);
      const trigger = screen.getByTestId('branch-selector-trigger');
      expect(trigger).toHaveTextContent('Main Timeline');
    });

    it('should display "Select Branch" when no branch is selected', () => {
      vi.mocked(stores.useCampaignStore).mockReturnValue({
        currentCampaignId: 'campaign-1',
        currentBranchId: null,
        campaign: null,
        asOfTime: null,
        campaignBranchMap: {},
        setCurrentCampaign: vi.fn(),
        setCurrentBranch: mockSetCurrentBranch,
        setAsOfTime: vi.fn(),
        clearCampaignContext: vi.fn(),
      });

      render(<BranchSelector />);
      const trigger = screen.getByTestId('branch-selector-trigger');
      expect(trigger).toHaveTextContent('Select Branch');
    });

    it('should open sheet when trigger is clicked', async () => {
      const user = userEvent.setup();
      render(<BranchSelector />);

      const trigger = screen.getByTestId('branch-selector-trigger');
      await user.click(trigger);

      // Sheet title should be visible
      expect(screen.getByText('Select Branch')).toBeInTheDocument();
    });
  });

  describe('Branch List', () => {
    it('should display all branches', async () => {
      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));

      expect(screen.getByTestId('branch-item-branch-main')).toBeInTheDocument();
      expect(screen.getByTestId('branch-item-branch-alt1')).toBeInTheDocument();
      expect(screen.getByTestId('branch-item-branch-alt2')).toBeInTheDocument();
    });

    it('should display branch names', async () => {
      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));

      const branchList = screen.getByTestId('branch-list');
      expect(within(branchList).getByText('Main Timeline')).toBeInTheDocument();
      expect(within(branchList).getByText('Alternate Path')).toBeInTheDocument();
      expect(within(branchList).getByText('Dark Timeline')).toBeInTheDocument();
    });

    it('should display branch descriptions when present', async () => {
      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));

      expect(screen.getByText('The primary campaign timeline')).toBeInTheDocument();
      expect(screen.getByText('What if the party took the western road?')).toBeInTheDocument();
    });

    it('should not display description for branches without description', async () => {
      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));

      const darkBranch = screen.getByTestId('branch-item-branch-alt2');
      expect(darkBranch.querySelector('p.text-muted-foreground')).toBeNull();
    });

    it('should display divergedAt badge for forked branches', async () => {
      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));

      // Main branch has no divergedAt (not forked)
      const mainBranch = screen.getByTestId('branch-item-branch-main');
      expect(within(mainBranch).queryByText(/^\d{1,2}\/\d{1,2}\/\d{4}$/)).toBeNull();

      // Alt branches have divergedAt badges
      const alt1Branch = screen.getByTestId('branch-item-branch-alt1');
      expect(within(alt1Branch).getByText(/^\d{1,2}\/\d{1,2}\/\d{4}$/)).toBeInTheDocument();
    });

    it('should highlight selected branch', async () => {
      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));

      const mainBranch = screen.getByTestId('branch-item-branch-main');
      expect(mainBranch).toHaveAttribute('aria-current', 'true');

      const alt1Branch = screen.getByTestId('branch-item-branch-alt1');
      expect(alt1Branch).toHaveAttribute('aria-current', 'false');
    });

    it('should indent child branches based on hierarchy depth', async () => {
      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));

      // Main branch (depth 0): 12px padding
      const mainBranch = screen.getByTestId('branch-item-branch-main');
      expect(mainBranch).toHaveStyle({ paddingLeft: '12px' });

      // Alt1 branch (depth 1): 12 + 24 = 36px padding
      const alt1Branch = screen.getByTestId('branch-item-branch-alt1');
      expect(alt1Branch).toHaveStyle({ paddingLeft: '36px' });

      // Alt2 branch (depth 2): 12 + 48 = 60px padding
      const alt2Branch = screen.getByTestId('branch-item-branch-alt2');
      expect(alt2Branch).toHaveStyle({ paddingLeft: '60px' });
    });
  });

  describe('Branch Selection', () => {
    it('should call setCurrentBranch when branch is clicked', async () => {
      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));
      await user.click(screen.getByTestId('branch-item-branch-alt1'));

      expect(mockSetCurrentBranch).toHaveBeenCalledWith('branch-alt1');
    });

    it('should close sheet after selecting branch', async () => {
      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));
      expect(screen.getByText('Select Branch')).toBeInTheDocument();

      await user.click(screen.getByTestId('branch-item-branch-alt1'));

      // Sheet should be closed (title no longer visible)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading skeletons when loading', async () => {
      vi.mocked(hooks.useGetBranchHierarchy).mockReturnValue({
        flatBranches: [],
        hierarchy: [],
        loading: true,
        error: undefined,
        data: undefined,
        refetch: vi.fn(),
        networkStatus: 1,
        previousData: undefined,
        client: {} as never,
        observable: {} as never,
        variables: { campaignId: 'campaign-1' },
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'empty' as const,
      });

      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));

      // Should show skeleton loaders
      const skeletons = document.querySelectorAll('.h-12');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('should display error message when query fails', async () => {
      vi.mocked(hooks.useGetBranchHierarchy).mockReturnValue({
        flatBranches: [],
        hierarchy: [],
        loading: false,
        error: new Error('Failed to fetch branches'),
        data: undefined,
        refetch: vi.fn(),
        networkStatus: 8,
        previousData: undefined,
        client: {} as never,
        observable: {} as never,
        variables: { campaignId: 'campaign-1' },
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'empty' as const,
      });

      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));

      expect(screen.getByText(/Failed to load branches/)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch branches/)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display message when no branches exist', async () => {
      vi.mocked(hooks.useGetBranchHierarchy).mockReturnValue({
        flatBranches: [],
        hierarchy: [],
        loading: false,
        error: undefined,
        data: { branchHierarchy: [] },
        refetch: vi.fn(),
        networkStatus: 7,
        previousData: undefined,
        client: {} as never,
        observable: {} as never,
        variables: { campaignId: 'campaign-1' },
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'complete' as const,
      });

      const user = userEvent.setup();
      render(<BranchSelector />);

      await user.click(screen.getByTestId('branch-selector-trigger'));

      expect(
        screen.getByText(/No branches found for this campaign. Create a branch to get started./)
      ).toBeInTheDocument();
    });
  });

  describe('Query Skip Logic', () => {
    it('should skip query when no campaign is selected', () => {
      vi.mocked(stores.useCampaignStore).mockReturnValue({
        currentCampaignId: null,
        currentBranchId: null,
        campaign: null,
        asOfTime: null,
        campaignBranchMap: {},
        setCurrentCampaign: vi.fn(),
        setCurrentBranch: mockSetCurrentBranch,
        setAsOfTime: vi.fn(),
        clearCampaignContext: vi.fn(),
      });

      render(<BranchSelector />);

      expect(hooks.useGetBranchHierarchy).toHaveBeenCalledWith({
        variables: { campaignId: '' },
        skip: true,
      });
    });

    it('should query branches when campaign is selected', () => {
      render(<BranchSelector />);

      expect(hooks.useGetBranchHierarchy).toHaveBeenCalledWith({
        variables: { campaignId: 'campaign-1' },
        skip: false,
      });
    });
  });
});
