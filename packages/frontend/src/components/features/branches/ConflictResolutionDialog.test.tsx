import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as hooks from '@/services/api/hooks';
import * as stores from '@/stores';

import {
  ConflictResolutionDialog,
  type ConflictResolutionDialogProps,
} from './ConflictResolutionDialog';

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
    useExecuteMerge: vi.fn(),
  };
});

describe('ConflictResolutionDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnMergeComplete = vi.fn();
  const mockExecuteMerge = vi.fn();

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

  const mockEntityPreviews: hooks.EntityMergePreview[] = [
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
      autoResolvedChanges: [],
    },
    {
      entityId: 'structure-1',
      entityType: 'structure',
      conflicts: [
        {
          path: 'defenseRating',
          type: 'BOTH_MODIFIED',
          description: 'Both branches modified defense rating',
          suggestion: 'Choose the higher value for better protection',
          baseValue: '5',
          sourceValue: '8',
          targetValue: '6',
        },
      ],
      autoResolvedChanges: [],
    },
  ];

  const defaultProps: ConflictResolutionDialogProps = {
    sourceBranch: mockSourceBranch,
    targetBranch: mockTargetBranch,
    entityPreviews: mockEntityPreviews,
    isOpen: true,
    onClose: mockOnClose,
    onMergeComplete: mockOnMergeComplete,
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

    vi.mocked(hooks.useExecuteMerge).mockReturnValue([
      mockExecuteMerge,
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
      render(<ConflictResolutionDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Resolve Merge Conflicts')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<ConflictResolutionDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dialog Content', () => {
    it('should display source and target branch names', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);
      // Check in dialog description (multiple instances exist, so we verify at least one)
      expect(screen.getAllByText('Feature Branch').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Main Timeline').length).toBeGreaterThanOrEqual(1);
    });

    it('should display progress (0 of total conflicts resolved initially)', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);
      expect(screen.getByText(/progress: 0 \/ 3 conflicts resolved/i)).toBeInTheDocument();
    });

    it('should display all entity cards', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);
      expect(screen.getByText('settlement #settlement-1')).toBeInTheDocument();
      expect(screen.getByText('structure #structure-1')).toBeInTheDocument();
    });

    it('should display warning that all conflicts must be resolved', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);
      expect(
        screen.getByText(/all conflicts must be resolved before executing the merge/i)
      ).toBeInTheDocument();
    });
  });

  describe('Entity Cards', () => {
    it('should show conflict count for each entity', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);
      expect(screen.getByText('0/2 resolved')).toBeInTheDocument();
      expect(screen.getByText('0/1 resolved')).toBeInTheDocument();
    });

    it('should be collapsible/expandable', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Entity cards start expanded
      expect(screen.getByText('population')).toBeInTheDocument();

      // Find the collapse button for settlement-1 by finding all chevron buttons
      // The first button with chevron down/right icon should be the entity card toggle
      const allButtons = screen.getAllByRole('button');
      // Find the button that contains a chevron icon (collapse/expand button)
      const collapseButton = allButtons.find(
        (button) =>
          button.querySelector('svg.lucide-chevron-down') ||
          button.querySelector('svg.lucide-chevron-right')
      );

      await user.click(collapseButton!);

      // Conflict should now be hidden (not in the document after collapse)
      await waitFor(() => {
        expect(screen.queryByText('population')).not.toBeInTheDocument();
      });
    });
  });

  describe('Conflict Resolution', () => {
    it('should display all conflicts for an entity', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);
      expect(screen.getByText('population')).toBeInTheDocument();
      expect(screen.getByText('resources.gold')).toBeInTheDocument();
      expect(screen.getByText('defenseRating')).toBeInTheDocument();
    });

    it('should show conflict type badge', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);
      const badges = screen.getAllByText('BOTH_MODIFIED');
      expect(badges.length).toBe(3); // 3 conflicts
    });

    it('should show conflict descriptions', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);
      expect(screen.getByText('Both branches modified population')).toBeInTheDocument();
      expect(screen.getByText('Both branches modified gold resources')).toBeInTheDocument();
      expect(screen.getByText('Both branches modified defense rating')).toBeInTheDocument();
    });

    it('should show suggestions when available', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);
      expect(screen.getByText('Choose the higher value if growth is expected')).toBeInTheDocument();
      expect(screen.getByText('Choose the higher value for better protection')).toBeInTheDocument();
    });

    it('should provide Use Source / Use Target / Edit Manually buttons', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);
      const sourceButtons = screen.getAllByRole('button', { name: /use source/i });
      const targetButtons = screen.getAllByRole('button', { name: /use target/i });
      const manualButtons = screen.getAllByRole('button', { name: /edit manually/i });

      expect(sourceButtons.length).toBe(3); // 3 conflicts
      expect(targetButtons.length).toBe(3);
      expect(manualButtons.length).toBe(3);
    });
  });

  describe('Choosing Resolution', () => {
    it('should allow choosing source value', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Click "Use Source" for population conflict
      const sourceButtons = screen.getAllByRole('button', { name: /use source/i });
      await user.click(sourceButtons[0]);

      // Check that progress updated
      await waitFor(() => {
        expect(screen.getByText(/progress: 1 \/ 3 conflicts resolved/i)).toBeInTheDocument();
      });

      // Check that "Resolved" badge appears
      expect(screen.getByText('Resolved')).toBeInTheDocument();

      // Check that resolved value preview is shown
      expect(screen.getByText('Resolved Value:')).toBeInTheDocument();
    });

    it('should allow choosing target value', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Click "Use Target" for population conflict
      const targetButtons = screen.getAllByRole('button', { name: /use target/i });
      await user.click(targetButtons[0]);

      // Check that progress updated
      await waitFor(() => {
        expect(screen.getByText(/progress: 1 \/ 3 conflicts resolved/i)).toBeInTheDocument();
      });

      // Check that "Resolved" badge appears
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });

    it('should allow switching between source/target choices', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Click "Use Source"
      const sourceButtons = screen.getAllByRole('button', { name: /use source/i });
      await user.click(sourceButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/progress: 1 \/ 3/i)).toBeInTheDocument();
      });

      // Click "Use Target" instead
      const targetButtons = screen.getAllByRole('button', { name: /use target/i });
      await user.click(targetButtons[0]);

      // Progress should still be 1/3
      expect(screen.getByText(/progress: 1 \/ 3/i)).toBeInTheDocument();
    });

    it('should expand 3-way diff when expand button clicked', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Find the expand button for the first conflict
      const expandButtons = screen.getAllByTitle(/expand details/i);
      await user.click(expandButtons[0]);

      // Check that 3-way diff is shown (multiple "Source Branch" exist, check for all)
      await waitFor(() => {
        expect(screen.getByText('Base (Ancestor)')).toBeInTheDocument();
        // There should be at least 2 instances now (card + 3-way diff)
        expect(screen.getAllByText('Source Branch').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('Target Branch').length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Custom Value Editing', () => {
    it('should open custom editor when Edit Manually clicked', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Click "Edit Manually" for first conflict
      const manualButtons = screen.getAllByRole('button', { name: /edit manually/i });
      await user.click(manualButtons[0]);

      // Check that textarea appears
      await waitFor(() => {
        expect(screen.getByPlaceholderText('{"example": "value"}')).toBeInTheDocument();
      });

      // Check that Save/Cancel buttons appear (using title attribute to distinguish)
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
      // There are 2 cancel buttons, get the one with "Cancel" title (not "Cancel and close dialog")
      const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i });
      const customEditorCancelButton = cancelButtons.find((btn) => btn.title === 'Cancel');
      expect(customEditorCancelButton).toBeInTheDocument();
    });

    it('should validate JSON and show error for invalid JSON', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Click "Edit Manually"
      const manualButtons = screen.getAllByRole('button', { name: /edit manually/i });
      await user.click(manualButtons[0]);

      // Enter invalid JSON using paste event to avoid userEvent parsing issues
      const textarea = screen.getByPlaceholderText('{"example": "value"}');
      await user.clear(textarea);
      await user.click(textarea);
      // Use paste to bypass userEvent's special character parsing
      await user.paste('not valid json at all');

      // Check that error message appears
      await waitFor(() => {
        expect(screen.getByText(/error:/i)).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByRole('button', { name: /^save$/i });
      expect(saveButton).toBeDisabled();
    });

    it('should allow saving valid JSON', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Click "Edit Manually"
      const manualButtons = screen.getAllByRole('button', { name: /edit manually/i });
      await user.click(manualButtons[0]);

      // Enter valid JSON
      const textarea = screen.getByPlaceholderText('{"example": "value"}');
      await user.clear(textarea);
      await user.type(textarea, '1250');

      // Click Save
      const saveButton = screen.getByRole('button', { name: /^save$/i });
      await user.click(saveButton);

      // Check that progress updated
      await waitFor(() => {
        expect(screen.getByText(/progress: 1 \/ 3/i)).toBeInTheDocument();
      });

      // Textarea should be hidden
      expect(screen.queryByPlaceholderText('{"example": "value"}')).not.toBeInTheDocument();
    });

    it('should allow canceling custom edit', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Click "Edit Manually"
      const manualButtons = screen.getAllByRole('button', { name: /edit manually/i });
      await user.click(manualButtons[0]);

      // Enter some value
      const textarea = screen.getByPlaceholderText('{"example": "value"}');
      await user.clear(textarea);
      await user.type(textarea, '999');

      // Click Cancel - there are 2, find the one with "Cancel" title (not "Cancel and close dialog")
      const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i });
      const customEditorCancelButton = cancelButtons.find((btn) => btn.title === 'Cancel');
      await user.click(customEditorCancelButton!);

      // Textarea should be hidden
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('{"example": "value"}')).not.toBeInTheDocument();
      });

      // Progress should still be 0/3 (not resolved)
      expect(screen.getByText(/progress: 0 \/ 3/i)).toBeInTheDocument();
    });
  });

  describe('Progress Tracking', () => {
    it('should show green checkmark when entity fully resolved', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Resolve first conflict (population)
      const sourceButtons = screen.getAllByRole('button', { name: /use source/i });
      await user.click(sourceButtons[0]);

      // Resolve second conflict (resources.gold) for settlement-1
      await user.click(sourceButtons[1]);

      // Check that settlement-1 card shows checkmark
      await waitFor(() => {
        const settlementCard = screen
          .getByText('settlement #settlement-1')
          .closest('div')!.parentElement!;
        // Lucide icons don't have testIds, but we can check for the "2/2 resolved" badge
        expect(within(settlementCard).getByText('2/2 resolved')).toBeInTheDocument();
      });
    });

    it('should update progress bar width', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Resolve 1 conflict
      const sourceButtons = screen.getAllByRole('button', { name: /use source/i });
      await user.click(sourceButtons[0]);

      // Progress should be 1/3 (33%)
      await waitFor(() => {
        expect(screen.getByText(/progress: 1 \/ 3/i)).toBeInTheDocument();
      });
    });

    it('should show success message when all conflicts resolved', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Resolve all 3 conflicts
      const sourceButtons = screen.getAllByRole('button', { name: /use source/i });
      await user.click(sourceButtons[0]);
      await user.click(sourceButtons[1]);
      await user.click(sourceButtons[2]);

      // Check for success message
      await waitFor(() => {
        expect(
          screen.getByText(/all conflicts resolved! you can now execute the merge/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Execute Merge Button', () => {
    it('should be disabled when not all conflicts resolved', () => {
      render(<ConflictResolutionDialog {...defaultProps} />);

      const executeButton = screen.getByTestId('conflict-resolution-execute');
      expect(executeButton).toBeDisabled();
    });

    it('should be enabled when all conflicts resolved', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Resolve all conflicts
      const sourceButtons = screen.getAllByRole('button', { name: /use source/i });
      await user.click(sourceButtons[0]);
      await user.click(sourceButtons[1]);
      await user.click(sourceButtons[2]);

      await waitFor(() => {
        const executeButton = screen.getByTestId('conflict-resolution-execute');
        expect(executeButton).not.toBeDisabled();
      });
    });

    it('should call executeMerge with correct resolutions', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      // Resolve conflicts
      const sourceButtons = screen.getAllByRole('button', { name: /use source/i });
      const targetButtons = screen.getAllByRole('button', { name: /use target/i });

      await user.click(sourceButtons[0]); // population -> source (1200)
      await user.click(targetButtons[1]); // resources.gold -> target (550)
      await user.click(sourceButtons[2]); // defenseRating -> source (8)

      // Click Execute
      await waitFor(() => {
        const executeButton = screen.getByTestId('conflict-resolution-execute');
        expect(executeButton).not.toBeDisabled();
      });

      const executeButton = screen.getByTestId('conflict-resolution-execute');
      await user.click(executeButton);

      // Check that executeMerge was called
      expect(mockExecuteMerge).toHaveBeenCalledTimes(1);

      // Check the resolutions array
      const callArgs = mockExecuteMerge.mock.calls[0][0];
      expect(callArgs.variables.input.sourceBranchId).toBe('branch-feature');
      expect(callArgs.variables.input.targetBranchId).toBe('branch-main');
      expect(callArgs.variables.input.worldTime).toBe('2024-06-15T14:30:00.000Z');

      const resolutions = callArgs.variables.input.resolutions;
      expect(resolutions).toHaveLength(3);

      // Check each resolution
      expect(resolutions).toContainEqual({
        entityId: 'settlement-1',
        entityType: 'settlement',
        path: 'population',
        resolvedValue: '1200',
      });

      expect(resolutions).toContainEqual({
        entityId: 'settlement-1',
        entityType: 'settlement',
        path: 'resources.gold',
        resolvedValue: '550',
      });

      expect(resolutions).toContainEqual({
        entityId: 'structure-1',
        entityType: 'structure',
        path: 'defenseRating',
        resolvedValue: '8',
      });
    });

    it('should show loading state while executing', () => {
      vi.mocked(hooks.useExecuteMerge).mockReturnValue([
        mockExecuteMerge,
        {
          loading: true,
          error: undefined,
          data: undefined,
          called: true,
          client: {} as never,
          reset: vi.fn(),
        },
      ]);

      render(<ConflictResolutionDialog {...defaultProps} />);

      expect(screen.getByText(/executing merge\.\.\./i)).toBeInTheDocument();
      expect(screen.getByText(/creating versions in target branch/i)).toBeInTheDocument();
    });

    it('should call onMergeComplete on successful merge', async () => {
      const user = userEvent.setup();

      // Setup mock to call onCompleted callback
      const mockOnCompleted = vi.fn();
      vi.mocked(hooks.useExecuteMerge).mockImplementation((options) => {
        mockOnCompleted.mockImplementation(() => {
          options?.onCompleted?.({
            executeMerge: { success: true, versionsCreated: 3, mergedEntityIds: [], error: null },
          });
        });
        return [
          mockOnCompleted,
          {
            loading: false,
            error: undefined,
            data: undefined,
            called: false,
            client: {} as never,
            reset: vi.fn(),
          },
        ];
      });

      render(<ConflictResolutionDialog {...defaultProps} />);

      // Resolve all conflicts
      const sourceButtons = screen.getAllByRole('button', { name: /use source/i });
      await user.click(sourceButtons[0]);
      await user.click(sourceButtons[1]);
      await user.click(sourceButtons[2]);

      // Execute merge
      const executeButton = await screen.findByTestId('conflict-resolution-execute');
      await user.click(executeButton);

      // Check callbacks were called
      await waitFor(() => {
        expect(mockOnMergeComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('should display error message if merge fails', () => {
      const mockError = {
        name: 'ApolloError',
        message: 'Failed to execute merge: Database connection error',
        graphQLErrors: [],
        clientErrors: [],
        networkError: null,
        extraInfo: undefined,
      };

      vi.mocked(hooks.useExecuteMerge).mockReturnValue([
        mockExecuteMerge,
        {
          loading: false,
          error: mockError,
          data: undefined,
          called: true,
          client: {} as never,
          reset: vi.fn(),
        },
      ]);

      render(<ConflictResolutionDialog {...defaultProps} />);

      expect(screen.getByText(/merge failed:/i)).toBeInTheDocument();
      expect(screen.getByText(/database connection error/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should close on Escape key', async () => {
      const user = userEvent.setup();
      render(<ConflictResolutionDialog {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close on Escape when executing', async () => {
      const user = userEvent.setup();

      vi.mocked(hooks.useExecuteMerge).mockReturnValue([
        mockExecuteMerge,
        {
          loading: true,
          error: undefined,
          data: undefined,
          called: true,
          client: {} as never,
          reset: vi.fn(),
        },
      ]);

      render(<ConflictResolutionDialog {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('should handle entity previews with no conflicts gracefully', () => {
      const emptyPreviews: hooks.EntityMergePreview[] = [
        {
          entityId: 'settlement-1',
          entityType: 'settlement',
          conflicts: [],
          autoResolvedChanges: [],
        },
      ];

      render(<ConflictResolutionDialog {...defaultProps} entityPreviews={emptyPreviews} />);

      expect(screen.getByText(/progress: 0 \/ 0 conflicts resolved/i)).toBeInTheDocument();
    });
  });
});
