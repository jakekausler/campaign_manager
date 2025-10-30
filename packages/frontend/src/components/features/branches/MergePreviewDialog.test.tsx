import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as hooks from '@/services/api/hooks';
import * as stores from '@/stores';

import { MergePreviewDialog, type MergePreviewDialogProps } from './MergePreviewDialog';

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
    usePreviewMerge: vi.fn(),
    useExecuteMerge: vi.fn(),
  };
});

describe('MergePreviewDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnProceedToResolve = vi.fn();

  const mockSourceBranch: hooks.Branch = {
    id: 'branch-feature',
    name: 'Feature Branch',
    description: 'A feature branch with changes',
    campaignId: 'campaign-1',
    parentId: 'branch-main',
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    divergedAt: '2024-01-01T00:00:00.000Z',
    isPinned: false,
    tags: [],
  };

  const mockTargetBranch: hooks.Branch = {
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
  };

  const mockCampaign: stores.Campaign = {
    id: 'campaign-1',
    name: 'Test Campaign',
    description: 'A test campaign',
    currentWorldTime: '2024-06-15T14:30:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockMergePreview: hooks.MergePreview = {
    sourceBranchId: 'branch-feature',
    targetBranchId: 'branch-main',
    commonAncestorId: 'branch-main',
    totalConflicts: 2,
    totalAutoResolved: 3,
    requiresManualResolution: true,
    entities: [
      {
        entityId: 'settlement-1',
        entityType: 'settlement',
        conflicts: [
          {
            path: 'population',
            type: 'BOTH_MODIFIED',
            description: 'Both branches modified population',
            suggestion: 'Choose the higher value if growth is expected',
            baseValue: '1000',
            sourceValue: '1200',
            targetValue: '1100',
          },
          {
            path: 'resources.gold',
            type: 'BOTH_MODIFIED',
            description: 'Both branches modified gold resources',
            suggestion: null,
            baseValue: '500',
            sourceValue: '600',
            targetValue: '550',
          },
        ],
        autoResolvedChanges: [
          {
            path: 'name',
            resolvedTo: 'source',
            baseValue: '"Old Name"',
            sourceValue: '"New Name"',
            targetValue: '"Old Name"',
            resolvedValue: '"New Name"',
          },
        ],
      },
      {
        entityId: 'structure-1',
        entityType: 'structure',
        conflicts: [],
        autoResolvedChanges: [
          {
            path: 'defenseRating',
            resolvedTo: 'target',
            baseValue: '5',
            sourceValue: '5',
            targetValue: '7',
            resolvedValue: '7',
          },
          {
            path: 'status',
            resolvedTo: 'source',
            baseValue: '"active"',
            sourceValue: '"upgraded"',
            targetValue: '"active"',
            resolvedValue: '"upgraded"',
          },
        ],
      },
    ],
  };

  const defaultProps: MergePreviewDialogProps = {
    sourceBranch: mockSourceBranch,
    targetBranch: mockTargetBranch,
    isOpen: true,
    onClose: mockOnClose,
    onMergeComplete: mockOnProceedToResolve,
  };

  beforeEach(() => {
    vi.mocked(stores.useCampaignStore).mockReturnValue({
      currentCampaignId: 'campaign-1',
      currentBranchId: 'branch-main',
      campaign: mockCampaign,
      asOfTime: null,
      campaignBranchMap: {},
      setCurrentCampaign: vi.fn(),
      setCurrentBranch: vi.fn(),
      setAsOfTime: vi.fn(),
      clearCampaignContext: vi.fn(),
    });

    vi.mocked(hooks.usePreviewMerge).mockReturnValue({
      loading: false,
      error: undefined,
      data: { previewMerge: mockMergePreview },
      refetch: vi.fn(),
      networkStatus: 7,
      client: {} as never,
      previousData: undefined,
      variables: {
        input: {
          sourceBranchId: 'branch-feature',
          targetBranchId: 'branch-main',
          worldTime: '2024-06-15T14:30:00.000Z',
        },
      },
      observable: {} as never,
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      subscribeToMore: vi.fn(),
      updateQuery: vi.fn(),
      fetchMore: vi.fn(),
      dataState: 'complete' as const,
    });

    vi.mocked(hooks.useExecuteMerge).mockReturnValue([
      vi.fn(),
      {
        loading: false,
        error: undefined,
        data: undefined,
        called: false,
        client: {} as never,
        reset: vi.fn(),
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Visibility', () => {
    it('should render when isOpen is true', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Merge Preview')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<MergePreviewDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dialog Content', () => {
    it('should display source and target branch names', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      const sourceBranchCards = screen.getAllByText('Feature Branch');
      expect(sourceBranchCards.length).toBeGreaterThan(0);
      const targetBranchCards = screen.getAllByText('Main Timeline');
      expect(targetBranchCards.length).toBeGreaterThan(0);
    });

    it('should display source and target branch labels', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByText('Source Branch')).toBeInTheDocument();
      expect(screen.getByText('Target Branch')).toBeInTheDocument();
    });

    it('should display merge direction in description', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      const description = screen.getByText(/Review changes and conflicts before merging/);
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent('Feature Branch');
      expect(description).toHaveTextContent('Main Timeline');
    });
  });

  describe('Loading State', () => {
    it('should display loading indicator when fetching preview', () => {
      vi.mocked(hooks.usePreviewMerge).mockReturnValue({
        loading: true,
        error: undefined,
        data: undefined,
        refetch: vi.fn(),
        networkStatus: 1,
        client: {} as never,
        previousData: undefined,
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
        observable: {} as never,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'empty' as const,
      });

      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByText('Analyzing merge...')).toBeInTheDocument();
      expect(
        screen.getByText(/Comparing entity versions and detecting conflicts/)
      ).toBeInTheDocument();
    });

    it('should disable buttons when loading', () => {
      vi.mocked(hooks.usePreviewMerge).mockReturnValue({
        loading: true,
        error: undefined,
        data: undefined,
        refetch: vi.fn(),
        networkStatus: 1,
        client: {} as never,
        previousData: undefined,
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
        observable: {} as never,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'empty' as const,
      });

      render(<MergePreviewDialog {...defaultProps} />);
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Error State', () => {
    it('should display error message when preview fails', () => {
      const errorMessage = 'Cannot merge branches with no common ancestor';
      vi.mocked(hooks.usePreviewMerge).mockReturnValue({
        loading: false,
        error: new Error(errorMessage),
        data: undefined,
        refetch: vi.fn(),
        networkStatus: 8,
        client: {} as never,
        previousData: undefined,
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
        observable: {} as never,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'empty' as const,
      });

      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByText(/Preview failed/)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(errorMessage))).toBeInTheDocument();
    });
  });

  describe('Merge Preview Summary', () => {
    it('should display total entities count', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      const totalEntitiesLabel = screen.getByText('Total Entities');
      expect(totalEntitiesLabel).toBeInTheDocument();
      // Find the stat value in the same container
      const statsContainer = totalEntitiesLabel.closest('div');
      expect(within(statsContainer!).getByText('2')).toBeInTheDocument();
    });

    it('should display total conflicts count', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      const conflictsLabel = screen.getByText('Conflicts');
      expect(conflictsLabel).toBeInTheDocument();
      // Find the stat value in the same container
      const statsContainer = conflictsLabel.closest('div');
      expect(within(statsContainer!).getByText('2')).toBeInTheDocument();
    });

    it('should display total auto-resolved count', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      const autoResolvedLabel = screen.getByText('Auto-Resolved');
      expect(autoResolvedLabel).toBeInTheDocument();
      // Find the stat value in the same container
      const statsContainer = autoResolvedLabel.closest('div');
      expect(within(statsContainer!).getByText('3')).toBeInTheDocument();
    });

    it('should display manual resolution warning when conflicts exist', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(
        screen.getByText(/This merge requires manual conflict resolution/)
      ).toBeInTheDocument();
    });

    it('should display success message when no conflicts exist', () => {
      const noConflictsPreview: hooks.MergePreview = {
        ...mockMergePreview,
        totalConflicts: 0,
        requiresManualResolution: false,
        entities: mockMergePreview.entities.map((e) => ({ ...e, conflicts: [] })),
      };

      vi.mocked(hooks.usePreviewMerge).mockReturnValue({
        loading: false,
        error: undefined,
        data: { previewMerge: noConflictsPreview },
        refetch: vi.fn(),
        networkStatus: 7,
        client: {} as never,
        previousData: undefined,
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
        observable: {} as never,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'complete' as const,
      });

      render(<MergePreviewDialog {...defaultProps} />);
      // Check for the full success message text
      expect(
        screen.getByText(/All changes can be auto-resolved\. No conflicts detected!/)
      ).toBeInTheDocument();
    });

    it('should display empty state when no entity changes detected', () => {
      const emptyPreview: hooks.MergePreview = {
        ...mockMergePreview,
        totalConflicts: 0,
        totalAutoResolved: 0,
        requiresManualResolution: false,
        entities: [],
      };

      vi.mocked(hooks.usePreviewMerge).mockReturnValue({
        loading: false,
        error: undefined,
        data: { previewMerge: emptyPreview },
        refetch: vi.fn(),
        networkStatus: 7,
        client: {} as never,
        previousData: undefined,
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
        observable: {} as never,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'complete' as const,
      });

      render(<MergePreviewDialog {...defaultProps} />);
      expect(
        screen.getByText(/No entity changes detected between these branches/)
      ).toBeInTheDocument();
    });
  });

  describe('Tabs', () => {
    it('should display conflicts tab by default', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      const conflictsTab = screen.getByRole('tab', { name: /Conflicts/ });
      expect(conflictsTab).toHaveAttribute('data-state', 'active');
    });

    it('should display correct conflict count in tab', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByRole('tab', { name: /Conflicts \(1\)/ })).toBeInTheDocument();
    });

    it('should display correct auto-resolved count in tab', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByRole('tab', { name: /Auto-Resolved \(1\)/ })).toBeInTheDocument();
    });

    it('should switch to auto-resolved tab when clicked', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      const resolvedTab = screen.getByRole('tab', { name: /Auto-Resolved/ });
      await user.click(resolvedTab);

      expect(resolvedTab).toHaveAttribute('data-state', 'active');
    });
  });

  describe('Conflict Display', () => {
    it('should display entity with conflicts', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByText('settlement #settlement-1')).toBeInTheDocument();
    });

    it('should display conflict count badge', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByText('2 conflicts')).toBeInTheDocument();
    });

    it('should display conflict path', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByText('population')).toBeInTheDocument();
      expect(screen.getByText('resources.gold')).toBeInTheDocument();
    });

    it('should display conflict type', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      const bothModifiedBadges = screen.getAllByText('BOTH_MODIFIED');
      expect(bothModifiedBadges.length).toBe(2);
    });

    it('should display conflict description', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByText('Both branches modified population')).toBeInTheDocument();
      expect(screen.getByText('Both branches modified gold resources')).toBeInTheDocument();
    });

    it('should display conflict suggestion when available', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByText('Choose the higher value if growth is expected')).toBeInTheDocument();
    });

    it('should expand conflict details when chevron is clicked', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      // Find the first chevron button for expanding conflict details
      const expandButtons = screen.getAllByRole('button', { name: /expand details/i });
      await user.click(expandButtons[0]);

      // Should now show base/source/target value labels
      await waitFor(() => {
        expect(screen.getByText('Base (Ancestor)')).toBeInTheDocument();
      });
      // Check for labels in the conflict details section (will appear multiple times)
      const sourceBranchLabels = screen.getAllByText('Source Branch');
      expect(sourceBranchLabels.length).toBeGreaterThan(0);
      const targetBranchLabels = screen.getAllByText('Target Branch');
      expect(targetBranchLabels.length).toBeGreaterThan(0);
    });

    it('should collapse conflict details when chevron is clicked again', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      // Expand first
      const expandButtons = screen.getAllByRole('button', { name: /expand details/i });
      await user.click(expandButtons[0]);
      await waitFor(() => {
        expect(screen.getByText('Base (Ancestor)')).toBeInTheDocument();
      });

      // Collapse
      const collapseButtons = screen.getAllByRole('button', { name: /collapse details/i });
      await user.click(collapseButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('Base (Ancestor)')).not.toBeInTheDocument();
      });
    });
  });

  describe('Auto-Resolved Display', () => {
    it('should display auto-resolved changes on auto-resolved tab', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      // Switch to auto-resolved tab
      const resolvedTab = screen.getByRole('tab', { name: /Auto-Resolved/ });
      await user.click(resolvedTab);

      // Should show entity with only auto-resolved changes (structure-1)
      expect(screen.getByText('structure #structure-1')).toBeInTheDocument();
    });

    it('should display auto-resolved count badge', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      const resolvedTab = screen.getByRole('tab', { name: /Auto-Resolved/ });
      await user.click(resolvedTab);

      expect(screen.getByText('2 auto-resolved')).toBeInTheDocument();
    });

    it('should display auto-resolved path', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      const resolvedTab = screen.getByRole('tab', { name: /Auto-Resolved/ });
      await user.click(resolvedTab);

      expect(screen.getByText('defenseRating')).toBeInTheDocument();
      expect(screen.getByText('status')).toBeInTheDocument();
    });

    it('should display resolved-to indicator', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      const resolvedTab = screen.getByRole('tab', { name: /Auto-Resolved/ });
      await user.click(resolvedTab);

      expect(screen.getByText('→ target')).toBeInTheDocument();
      expect(screen.getByText('→ source')).toBeInTheDocument();
    });

    it('should expand auto-resolved details when chevron is clicked', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      // Switch to auto-resolved tab
      const resolvedTab = screen.getByRole('tab', { name: /Auto-Resolved/ });
      await user.click(resolvedTab);

      // Find the first chevron button
      const expandButtons = screen.getAllByRole('button', { name: /expand details/i });
      await user.click(expandButtons[0]);

      // Should now show base/source/target/resolved value labels
      await waitFor(() => {
        expect(screen.getAllByText('Base').length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText('Source').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Target').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
    });
  });

  describe('Entity Card Expansion', () => {
    it('should start with entity cards expanded by default', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      // Conflicts should be visible
      expect(screen.getByText('Conflicts:')).toBeInTheDocument();
    });

    it('should collapse entity card when chevron is clicked', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      // Entity cards start expanded by default, verify content is visible
      expect(screen.getByText('Conflicts:')).toBeInTheDocument();

      // Find the entity card by finding the Card component containing the entity header
      // The entity header contains both the text and badges, and the chevron button
      // is a sibling at the same level within the Card
      const entityHeader = screen.getByText('settlement #settlement-1');
      const card = entityHeader.closest('[class*="p-4"]'); // Card has p-4 className
      expect(card).toBeInTheDocument();

      // Find the chevron button within the card - it's the first button in the entity header section
      const chevronButton = within(card!).getAllByRole('button')[0];
      await user.click(chevronButton);

      // Conflicts label should be hidden after collapse
      await waitFor(() => {
        expect(screen.queryByText('Conflicts:')).not.toBeInTheDocument();
      });
    });
  });

  describe('Action Buttons', () => {
    it('should display "Proceed to Resolve Conflicts" button when conflicts exist', () => {
      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByTestId('merge-preview-proceed')).toBeInTheDocument();
      expect(screen.getByText('Proceed to Resolve Conflicts')).toBeInTheDocument();
    });

    it('should display "Execute Merge" button when no conflicts exist', () => {
      const noConflictsPreview: hooks.MergePreview = {
        ...mockMergePreview,
        totalConflicts: 0,
        requiresManualResolution: false,
        entities: mockMergePreview.entities.map((e) => ({ ...e, conflicts: [] })),
      };

      vi.mocked(hooks.usePreviewMerge).mockReturnValue({
        loading: false,
        error: undefined,
        data: { previewMerge: noConflictsPreview },
        refetch: vi.fn(),
        networkStatus: 7,
        client: {} as never,
        previousData: undefined,
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
        observable: {} as never,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'complete' as const,
      });

      render(<MergePreviewDialog {...defaultProps} />);
      expect(screen.getByTestId('merge-preview-execute')).toBeInTheDocument();
      expect(screen.getByText('Execute Merge')).toBeInTheDocument();
    });

    it('should open ConflictResolutionDialog when Proceed button is clicked', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      const proceedButton = screen.getByTestId('merge-preview-proceed');
      await user.click(proceedButton);

      // ConflictResolutionDialog should be rendered after clicking Proceed
      await waitFor(() => {
        expect(screen.getByTestId('conflict-resolution-dialog')).toBeInTheDocument();
      });
    });

    it('should call executeMerge when Execute button is clicked (no conflicts)', async () => {
      const user = userEvent.setup();
      const mockExecuteMergeFn = vi.fn();
      const noConflictsPreview: hooks.MergePreview = {
        ...mockMergePreview,
        totalConflicts: 0,
        requiresManualResolution: false,
        entities: mockMergePreview.entities.map((e) => ({ ...e, conflicts: [] })),
      };

      vi.mocked(hooks.usePreviewMerge).mockReturnValue({
        loading: false,
        error: undefined,
        data: { previewMerge: noConflictsPreview },
        refetch: vi.fn(),
        networkStatus: 7,
        client: {} as never,
        previousData: undefined,
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
        observable: {} as never,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'complete' as const,
      });

      vi.mocked(hooks.useExecuteMerge).mockReturnValue([
        mockExecuteMergeFn,
        {
          loading: false,
          error: undefined,
          data: undefined,
          called: false,
          client: {} as never,
          reset: vi.fn(),
        },
      ]);

      render(<MergePreviewDialog {...defaultProps} />);

      const executeButton = screen.getByTestId('merge-preview-execute');
      await user.click(executeButton);

      expect(mockExecuteMergeFn).toHaveBeenCalledTimes(1);
      expect(mockExecuteMergeFn).toHaveBeenCalledWith({
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
            resolutions: [],
          },
        },
      });
    });
  });

  describe('Empty States', () => {
    it('should display empty state for conflicts tab when no conflicts', async () => {
      const noConflictsPreview: hooks.MergePreview = {
        ...mockMergePreview,
        totalConflicts: 0,
        requiresManualResolution: false,
        entities: mockMergePreview.entities.map((e) => ({ ...e, conflicts: [] })),
      };

      vi.mocked(hooks.usePreviewMerge).mockReturnValue({
        loading: false,
        error: undefined,
        data: { previewMerge: noConflictsPreview },
        refetch: vi.fn(),
        networkStatus: 7,
        client: {} as never,
        previousData: undefined,
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
        observable: {} as never,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'complete' as const,
      });

      render(<MergePreviewDialog {...defaultProps} />);

      // Conflicts tab should show empty state (as opposed to the success alert)
      // Find the standalone "No conflicts detected!" text (not part of longer message)
      const noConflictsTexts = screen.getAllByText('No conflicts detected!');
      // Should find it in the empty state card (not in the alert which has more text)
      expect(noConflictsTexts.length).toBeGreaterThan(0);
    });

    it('should display empty state for auto-resolved tab when none exist', async () => {
      const user = userEvent.setup();
      const noAutoResolvedPreview: hooks.MergePreview = {
        ...mockMergePreview,
        totalAutoResolved: 0,
        entities: mockMergePreview.entities.map((e) => ({ ...e, autoResolvedChanges: [] })),
      };

      vi.mocked(hooks.usePreviewMerge).mockReturnValue({
        loading: false,
        error: undefined,
        data: { previewMerge: noAutoResolvedPreview },
        refetch: vi.fn(),
        networkStatus: 7,
        client: {} as never,
        previousData: undefined,
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
        observable: {} as never,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'complete' as const,
      });

      render(<MergePreviewDialog {...defaultProps} />);

      // Switch to auto-resolved tab
      const resolvedTab = screen.getByRole('tab', { name: /Auto-Resolved/ });
      await user.click(resolvedTab);

      expect(screen.getByText(/No auto-resolved changes without conflicts/)).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should close dialog when Escape key is pressed', async () => {
      const user = userEvent.setup();
      render(<MergePreviewDialog {...defaultProps} />);

      await user.keyboard('{Escape}');

      // The dialog uses Radix Dialog's built-in Escape handler via onOpenChange
      // which calls handleClose, resulting in 1 call to onClose
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close dialog when Escape is pressed during loading', async () => {
      const user = userEvent.setup();
      vi.mocked(hooks.usePreviewMerge).mockReturnValue({
        loading: true,
        error: undefined,
        data: undefined,
        refetch: vi.fn(),
        networkStatus: 1,
        client: {} as never,
        previousData: undefined,
        variables: {
          input: {
            sourceBranchId: 'branch-feature',
            targetBranchId: 'branch-main',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
        observable: {} as never,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
        subscribeToMore: vi.fn(),
        updateQuery: vi.fn(),
        fetchMore: vi.fn(),
        dataState: 'empty' as const,
      });

      render(<MergePreviewDialog {...defaultProps} />);

      await user.keyboard('{Escape}');

      // handleClose checks loading state and prevents onClose call when loading
      expect(mockOnClose).toHaveBeenCalledTimes(0);
    });
  });

  describe('GraphQL Hook Integration', () => {
    it('should skip query when dialog is closed', () => {
      render(<MergePreviewDialog {...defaultProps} isOpen={false} />);

      expect(hooks.usePreviewMerge).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true })
      );
    });

    it('should skip query when branches are missing', () => {
      render(<MergePreviewDialog {...defaultProps} sourceBranch={null} />);

      expect(hooks.usePreviewMerge).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true })
      );
    });

    it('should pass correct variables to usePreviewMerge', () => {
      render(<MergePreviewDialog {...defaultProps} />);

      expect(hooks.usePreviewMerge).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceBranchId: 'branch-feature',
          targetBranchId: 'branch-main',
          worldTime: '2024-06-15T14:30:00.000Z',
        }),
        expect.any(Object)
      );
    });
  });
});
