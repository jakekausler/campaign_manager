import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as mergeHooks from '@/services/api/hooks/merge';

import { MergeHistoryView, type MergeHistoryViewProps } from './MergeHistoryView';

// Mock the GraphQL hook
vi.mock('@/services/api/hooks/merge', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof mergeHooks;
  return {
    ...actual,
    useGetMergeHistory: vi.fn(),
  };
});

describe('MergeHistoryView', () => {
  const mockRefetch = vi.fn();
  const mockOnViewDetails = vi.fn();

  const mockBranchInfo: mergeHooks.BranchInfo = {
    id: 'branch-feature',
    name: 'Feature Branch',
    description: 'A feature branch',
    campaignId: 'campaign-1',
    parentId: 'branch-main',
    divergedAt: '2024-01-02T00:00:00.000Z',
    color: '#3b82f6',
    createdAt: '2024-01-02T00:00:00.000Z',
    deletedAt: undefined,
  };

  const mockTargetBranchInfo: mergeHooks.BranchInfo = {
    id: 'branch-main',
    name: 'Main Timeline',
    description: 'The main timeline',
    campaignId: 'campaign-1',
    parentId: undefined,
    divergedAt: undefined,
    color: '#10b981',
    createdAt: '2024-01-01T00:00:00.000Z',
    deletedAt: undefined,
  };

  const mockMergeEntry: mergeHooks.MergeHistoryEntry = {
    id: 'merge-1',
    sourceBranchId: 'branch-feature',
    sourceBranch: mockBranchInfo,
    targetBranchId: 'branch-main',
    targetBranch: mockTargetBranchInfo,
    commonAncestorId: 'branch-main',
    worldTime: '2024-06-15T14:30:00.000Z',
    mergedBy: 'user-123',
    mergedAt: '2024-06-15T15:00:00.000Z',
    conflictsCount: 2,
    entitiesMerged: 5,
    resolutionsData: { 'settlement-1': { population: 1200 } },
    metadata: {},
  };

  const mockMergeEntryNoConflicts: mergeHooks.MergeHistoryEntry = {
    id: 'merge-2',
    sourceBranchId: 'branch-feature',
    sourceBranch: mockBranchInfo,
    targetBranchId: 'branch-main',
    targetBranch: mockTargetBranchInfo,
    commonAncestorId: 'branch-main',
    worldTime: '2024-06-10T10:00:00.000Z',
    mergedBy: 'user-456',
    mergedAt: '2024-06-10T10:30:00.000Z',
    conflictsCount: 0,
    entitiesMerged: 3,
    resolutionsData: {},
    metadata: {},
  };

  const defaultProps: MergeHistoryViewProps = {
    branchId: 'branch-feature',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading skeletons when data is loading', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: undefined,
        loading: true,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      // Skeleton should be present (we render 3 skeleton cards)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should not display skeletons when not loading', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(0);
    });
  });

  describe('Empty State', () => {
    it('should display empty state message when no merge history exists', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/no merge operations yet/i)).toBeInTheDocument();
      expect(
        screen.getByText(/this branch has not been merged from or into any other branches/i)
      ).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when query fails', () => {
      const mockError = new Error('Network error');
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: undefined,
        loading: false,
        error: mockError,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/failed to load merge history/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    it('should display retry button in error state', () => {
      const mockError = new Error('Network error');
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: undefined,
        loading: false,
        error: mockError,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should call refetch when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockError = new Error('Network error');
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: undefined,
        loading: false,
        error: mockError,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Content Display', () => {
    it('should display merge history title and count', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry, mockMergeEntryNoConflicts] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/merge history/i)).toBeInTheDocument();
      expect(screen.getByText(/2 operations/i)).toBeInTheDocument();
    });

    it('should display singular "operation" for single entry', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/1 operation$/i)).toBeInTheDocument();
    });

    it('should display source and target branch names', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText('Feature Branch')).toBeInTheDocument();
      expect(screen.getByText('Main Timeline')).toBeInTheDocument();
    });

    it('should display merge timestamp', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      // Check that the date is rendered (format depends on locale)
      const mergedDate = new Date(mockMergeEntry.mergedAt);
      expect(screen.getByText(new RegExp(mergedDate.toLocaleDateString()))).toBeInTheDocument();
    });

    it('should display user who performed the merge', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/user id: user-123/i)).toBeInTheDocument();
    });

    it('should display entities merged count', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/5.*entities merged/i)).toBeInTheDocument();
    });

    it('should display singular "entity" for single entity', () => {
      const singleEntityMerge = { ...mockMergeEntry, entitiesMerged: 1 };
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [singleEntityMerge] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/1.*entity merged/i)).toBeInTheDocument();
    });

    it('should display world time', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      const worldTimeDate = new Date(mockMergeEntry.worldTime);
      expect(screen.getByText(/world time:/i)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(worldTimeDate.toLocaleDateString()))).toBeInTheDocument();
    });
  });

  describe('Conflict Display', () => {
    it('should display conflict count badge for entries with conflicts', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/2 conflicts/i)).toBeInTheDocument();
    });

    it('should display singular "conflict" for single conflict', () => {
      const singleConflictMerge = { ...mockMergeEntry, conflictsCount: 1 };
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [singleConflictMerge] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/1 conflict$/i)).toBeInTheDocument();
    });

    it('should display "Clean merge" badge for entries without conflicts', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntryNoConflicts] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/clean merge/i)).toBeInTheDocument();
    });

    it('should display conflicts resolved count in entry details', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.getByText(/2.*conflicts resolved/i)).toBeInTheDocument();
    });

    it('should not display conflicts resolved for clean merges', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntryNoConflicts] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.queryByText(/conflicts resolved/i)).not.toBeInTheDocument();
    });
  });

  describe('View Details Button', () => {
    it('should display "View Details" button when onViewDetails callback is provided', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} onViewDetails={mockOnViewDetails} />);

      expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    });

    it('should not display "View Details" button when onViewDetails is not provided', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /view details/i })).not.toBeInTheDocument();
    });

    it('should call onViewDetails with correct entry when button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} onViewDetails={mockOnViewDetails} />);

      const viewDetailsButton = screen.getByRole('button', { name: /view details/i });
      await user.click(viewDetailsButton);

      expect(mockOnViewDetails).toHaveBeenCalledTimes(1);
      expect(mockOnViewDetails).toHaveBeenCalledWith(mockMergeEntry);
    });
  });

  describe('Multiple Entries', () => {
    it('should render all merge history entries', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry, mockMergeEntryNoConflicts] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} onViewDetails={mockOnViewDetails} />);

      const viewDetailsButtons = screen.getAllByRole('button', { name: /view details/i });
      expect(viewDetailsButtons).toHaveLength(2);
    });

    it('should call onViewDetails with correct entry for each button', async () => {
      const user = userEvent.setup();
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [mockMergeEntry, mockMergeEntryNoConflicts] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} onViewDetails={mockOnViewDetails} />);

      const viewDetailsButtons = screen.getAllByRole('button', { name: /view details/i });

      // Click first button
      await user.click(viewDetailsButtons[0]);
      expect(mockOnViewDetails).toHaveBeenCalledWith(mockMergeEntry);

      // Click second button
      await user.click(viewDetailsButtons[1]);
      expect(mockOnViewDetails).toHaveBeenCalledWith(mockMergeEntryNoConflicts);

      expect(mockOnViewDetails).toHaveBeenCalledTimes(2);
    });
  });

  describe('className prop', () => {
    it('should apply custom className to wrapper', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      const { container } = render(<MergeHistoryView {...defaultProps} className="custom-class" />);

      // The outermost div should have the custom class
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('custom-class');
    });
  });

  describe('Hook Integration', () => {
    it('should call useGetMergeHistory with correct branchId', () => {
      vi.mocked(mergeHooks.useGetMergeHistory).mockReturnValue({
        data: { getMergeHistory: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      } as Partial<ReturnType<typeof mergeHooks.useGetMergeHistory>> as ReturnType<
        typeof mergeHooks.useGetMergeHistory
      >);

      render(<MergeHistoryView {...defaultProps} />);

      expect(mergeHooks.useGetMergeHistory).toHaveBeenCalledWith(
        defaultProps.branchId,
        expect.any(Object)
      );
    });
  });
});
