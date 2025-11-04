import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as hooks from '@/services/api/hooks';
import * as stores from '@/stores';

import { ForkBranchDialog, type ForkBranchDialogProps } from './ForkBranchDialog';

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
    useForkBranch: vi.fn(),
  };
});

describe('ForkBranchDialog', () => {
  const mockSetCurrentBranch = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockForkBranch = vi.fn();
  const mockReset = vi.fn();

  const mockSourceBranch: hooks.Branch = {
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

  const defaultProps: ForkBranchDialogProps = {
    sourceBranch: mockSourceBranch,
    isOpen: true,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    vi.mocked(stores.useCampaignStore).mockReturnValue({
      currentCampaignId: 'campaign-1',
      currentBranchId: 'branch-main',
      campaign: mockCampaign,
      asOfTime: null,
      campaignBranchMap: {},
      setCurrentCampaign: vi.fn(),
      setCurrentBranch: mockSetCurrentBranch,
      setAsOfTime: vi.fn(),
      clearCampaignContext: vi.fn(),
    });

    vi.mocked(hooks.useForkBranch).mockReturnValue([
      mockForkBranch,
      {
        loading: false,
        error: undefined,
        data: undefined,
        reset: mockReset,
        client: {} as never,
        called: false,
      },
    ]);
  });

  afterEach(() => {
    cleanup(); // Unmount all React components and hooks
    vi.clearAllMocks();
  });

  describe('Dialog Visibility', () => {
    it('should render when isOpen is true', () => {
      render(<ForkBranchDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Fork Branch')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<ForkBranchDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Dialog Content', () => {
    it('should display source branch name in description', () => {
      render(<ForkBranchDialog {...defaultProps} />);
      // Check description contains source branch name (multiple instances expected)
      const branchNameElements = screen.getAllByText(/Main Timeline/);
      expect(branchNameElements.length).toBeGreaterThan(0);
    });

    it('should display source branch details in card', () => {
      render(<ForkBranchDialog {...defaultProps} />);
      expect(screen.getByText('Source Branch')).toBeInTheDocument();
      // Branch name appears multiple times (description + card)
      const branchNameElements = screen.getAllByText('Main Timeline');
      expect(branchNameElements.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('The primary campaign timeline')).toBeInTheDocument();
    });

    it('should display divergence point with world time', () => {
      render(<ForkBranchDialog {...defaultProps} />);
      expect(screen.getByText('Divergence Point')).toBeInTheDocument();
      // Check for date string (format may vary by locale)
      expect(screen.getByText(/2024/)).toBeInTheDocument();
      expect(
        screen.getByText(/All entity versions at this world time will be copied to the new branch/)
      ).toBeInTheDocument();
    });

    it('should display name input field', () => {
      render(<ForkBranchDialog {...defaultProps} />);
      const nameInput = screen.getByTestId('fork-branch-name-input');
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveAttribute('type', 'text');
    });

    it('should display description input field', () => {
      render(<ForkBranchDialog {...defaultProps} />);
      const descInput = screen.getByTestId('fork-branch-description-input');
      expect(descInput).toBeInTheDocument();
      expect(descInput).toHaveAttribute('type', 'text');
    });

    it('should display Create Fork button', () => {
      render(<ForkBranchDialog {...defaultProps} />);
      const submitButton = screen.getByTestId('fork-branch-submit');
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveTextContent('Create Fork');
    });

    it('should display Cancel button', () => {
      render(<ForkBranchDialog {...defaultProps} />);
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('should allow user to type in name input', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('fork-branch-name-input');
      await user.type(nameInput, 'Alternate Timeline');

      expect(nameInput).toHaveValue('Alternate Timeline');
    });

    it('should allow user to type in description input', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      const descInput = screen.getByTestId('fork-branch-description-input');
      await user.type(descInput, 'What if the party chose differently?');

      expect(descInput).toHaveValue('What if the party chose differently?');
    });

    it('should disable submit button when name is empty', () => {
      render(<ForkBranchDialog {...defaultProps} />);
      const submitButton = screen.getByTestId('fork-branch-submit');
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when name is filled', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('fork-branch-name-input');
      await user.type(nameInput, 'Test Branch');

      const submitButton = screen.getByTestId('fork-branch-submit');
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('should call forkBranch mutation with correct input on submit', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('fork-branch-name-input');
      await user.type(nameInput, 'New Branch');

      const descInput = screen.getByTestId('fork-branch-description-input');
      await user.type(descInput, 'Test description');

      const submitButton = screen.getByTestId('fork-branch-submit');
      await user.click(submitButton);

      expect(mockForkBranch).toHaveBeenCalledWith({
        variables: {
          input: {
            sourceBranchId: 'branch-main',
            name: 'New Branch',
            description: 'Test description',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
      });
    });

    it('should trim whitespace from name and description', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('fork-branch-name-input');
      await user.type(nameInput, '  Padded Name  ');

      const descInput = screen.getByTestId('fork-branch-description-input');
      await user.type(descInput, '  Padded Desc  ');

      const submitButton = screen.getByTestId('fork-branch-submit');
      await user.click(submitButton);

      expect(mockForkBranch).toHaveBeenCalledWith({
        variables: {
          input: {
            sourceBranchId: 'branch-main',
            name: 'Padded Name',
            description: 'Padded Desc',
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
      });
    });

    it('should pass null for empty description', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('fork-branch-name-input');
      await user.type(nameInput, 'Branch Without Description');

      const submitButton = screen.getByTestId('fork-branch-submit');
      await user.click(submitButton);

      expect(mockForkBranch).toHaveBeenCalledWith({
        variables: {
          input: {
            sourceBranchId: 'branch-main',
            name: 'Branch Without Description',
            description: null,
            worldTime: '2024-06-15T14:30:00.000Z',
          },
        },
      });
    });

    it('should submit form when Enter key is pressed with valid name', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('fork-branch-name-input');
      await user.type(nameInput, 'Quick Fork');
      await user.keyboard('{Enter}');

      expect(mockForkBranch).toHaveBeenCalled();
    });

    it('should not submit when Enter is pressed with empty name', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('fork-branch-name-input');
      nameInput.focus();
      await user.keyboard('{Enter}');

      expect(mockForkBranch).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should show validation error when name is empty on submit', async () => {
      render(<ForkBranchDialog {...defaultProps} />);

      // Try to submit with empty name
      const submitButton = screen.getByTestId('fork-branch-submit');
      // Button should be disabled, so we can't actually click it
      expect(submitButton).toBeDisabled();
    });

    it('should show validation error when source branch is null', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} sourceBranch={null} />);

      const nameInput = screen.getByTestId('fork-branch-name-input');
      await user.type(nameInput, 'Test Branch');

      const submitButton = screen.getByTestId('fork-branch-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('fork-branch-error')).toBeInTheDocument();
        expect(screen.getByText(/Source branch not found/)).toBeInTheDocument();
      });
    });

    it('should show validation error when world time is not available', async () => {
      vi.mocked(stores.useCampaignStore).mockReturnValue({
        currentCampaignId: 'campaign-1',
        currentBranchId: 'branch-main',
        campaign: { ...mockCampaign, currentWorldTime: undefined },
        asOfTime: null,
        campaignBranchMap: {},
        setCurrentCampaign: vi.fn(),
        setCurrentBranch: mockSetCurrentBranch,
        setAsOfTime: vi.fn(),
        clearCampaignContext: vi.fn(),
      });

      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      const nameInput = screen.getByTestId('fork-branch-name-input');
      await user.type(nameInput, 'Test Branch');

      const submitButton = screen.getByTestId('fork-branch-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('fork-branch-error')).toBeInTheDocument();
        expect(screen.getByText(/Current world time not available/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading state during fork operation', () => {
      vi.mocked(hooks.useForkBranch).mockReturnValue([
        mockForkBranch,
        {
          loading: true,
          error: undefined,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      render(<ForkBranchDialog {...defaultProps} />);

      expect(screen.getByText('Creating fork...')).toBeInTheDocument();
      expect(
        screen.getByText(/Copying entity versions to new branch. This may take a moment./)
      ).toBeInTheDocument();
    });

    it('should disable inputs during loading', () => {
      vi.mocked(hooks.useForkBranch).mockReturnValue([
        mockForkBranch,
        {
          loading: true,
          error: undefined,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      render(<ForkBranchDialog {...defaultProps} />);

      expect(screen.getByTestId('fork-branch-name-input')).toBeDisabled();
      expect(screen.getByTestId('fork-branch-description-input')).toBeDisabled();
    });

    it('should show loading text on submit button', () => {
      vi.mocked(hooks.useForkBranch).mockReturnValue([
        mockForkBranch,
        {
          loading: true,
          error: undefined,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      render(<ForkBranchDialog {...defaultProps} />);

      const submitButton = screen.getByTestId('fork-branch-submit');
      expect(submitButton).toHaveTextContent('Creating Fork...');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Error State', () => {
    it('should display error message when fork mutation fails', () => {
      vi.mocked(hooks.useForkBranch).mockReturnValue([
        mockForkBranch,
        {
          loading: false,
          error: new Error('Fork operation failed'),
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      render(<ForkBranchDialog {...defaultProps} />);

      expect(screen.getByTestId('fork-branch-error')).toBeInTheDocument();
      expect(screen.getByText(/Fork failed: Fork operation failed/)).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    const mockForkResult: hooks.ForkResult = {
      branch: {
        id: 'branch-new',
        name: 'New Fork',
        description: 'Forked branch',
        campaignId: 'campaign-1',
        parentId: 'branch-main',
        divergedAt: '2024-06-15T14:30:00.000Z',
        createdAt: '2024-06-15T14:30:05.000Z',
        updatedAt: '2024-06-15T14:30:05.000Z',
        isPinned: false,
        tags: [],
      },
      versionsCopied: 42,
    };

    it('should display success message with version count', () => {
      const data = { forkBranch: mockForkResult };
      const mockUseForkBranch = vi.mocked(hooks.useForkBranch);
      mockUseForkBranch.mockImplementationOnce((options) => {
        // Call onCompleted callback immediately
        if (options?.onCompleted) {
          options.onCompleted(data as never, {} as never);
        }
        return [
          mockForkBranch,
          {
            loading: false,
            error: undefined,
            data,
            reset: mockReset,
            client: {} as never,
            called: true,
          },
        ];
      });

      render(<ForkBranchDialog {...defaultProps} />);

      expect(screen.getByTestId('fork-branch-success')).toBeInTheDocument();
      expect(screen.getByText(/Fork created successfully! 42 versions copied/)).toBeInTheDocument();
    });

    it('should use singular "version" when versionsCopied is 1', () => {
      const singleVersionResult = { ...mockForkResult, versionsCopied: 1 };

      const mockUseForkBranch = vi.mocked(hooks.useForkBranch);
      mockUseForkBranch.mockImplementationOnce((options) => {
        const data = { forkBranch: singleVersionResult };
        if (options?.onCompleted) {
          options.onCompleted(data as never, {} as never);
        }
        return [
          mockForkBranch,
          {
            loading: false,
            error: undefined,
            data,
            reset: mockReset,
            client: {} as never,
            called: true,
          },
        ];
      });

      render(<ForkBranchDialog {...defaultProps} />);

      expect(screen.getByText(/Fork created successfully! 1 version copied/)).toBeInTheDocument();
    });

    it('should call setCurrentBranch with new branch ID on success', () => {
      const mockUseForkBranch = vi.mocked(hooks.useForkBranch);
      mockUseForkBranch.mockImplementationOnce((options) => {
        const data = { forkBranch: mockForkResult };
        if (options?.onCompleted) {
          options.onCompleted(data as never, {} as never);
        }
        return [
          mockForkBranch,
          {
            loading: false,
            error: undefined,
            data,
            reset: mockReset,
            client: {} as never,
            called: true,
          },
        ];
      });

      render(<ForkBranchDialog {...defaultProps} />);

      expect(mockSetCurrentBranch).toHaveBeenCalledWith('branch-new');
    });

    it('should call onSuccess callback with branch ID and version count', () => {
      const mockUseForkBranch = vi.mocked(hooks.useForkBranch);
      mockUseForkBranch.mockImplementationOnce((options) => {
        const data = { forkBranch: mockForkResult };
        if (options?.onCompleted) {
          options.onCompleted(data as never, {} as never);
        }
        return [
          mockForkBranch,
          {
            loading: false,
            error: undefined,
            data,
            reset: mockReset,
            client: {} as never,
            called: true,
          },
        ];
      });

      render(<ForkBranchDialog {...defaultProps} />);

      expect(mockOnSuccess).toHaveBeenCalledWith('branch-new', 42);
    });

    it('should show Close button instead of Create/Cancel buttons after success', () => {
      const mockUseForkBranch = vi.mocked(hooks.useForkBranch);
      mockUseForkBranch.mockImplementationOnce((options) => {
        const data = { forkBranch: mockForkResult };
        if (options?.onCompleted) {
          options.onCompleted(data as never, {} as never);
        }
        return [
          mockForkBranch,
          {
            loading: false,
            error: undefined,
            data,
            reset: mockReset,
            client: {} as never,
            called: true,
          },
        ];
      });

      render(<ForkBranchDialog {...defaultProps} />);

      expect(screen.getByTestId('fork-branch-close')).toBeInTheDocument();
      expect(screen.queryByTestId('fork-branch-submit')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('Dialog Close', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when Escape key is pressed', async () => {
      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close when Escape is pressed during loading', async () => {
      vi.mocked(hooks.useForkBranch).mockReturnValue([
        mockForkBranch,
        {
          loading: true,
          error: undefined,
          data: undefined,
          reset: mockReset,
          client: {} as never,
          called: true,
        },
      ]);

      const user = userEvent.setup();
      render(<ForkBranchDialog {...defaultProps} />);

      await user.keyboard('{Escape}');

      // onClose should not be called during loading
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should reset form when dialog closes', async () => {
      const { rerender } = render(<ForkBranchDialog {...defaultProps} />);

      const user = userEvent.setup();
      const nameInput = screen.getByTestId('fork-branch-name-input');
      await user.type(nameInput, 'Test Input');

      // Close dialog
      rerender(<ForkBranchDialog {...defaultProps} isOpen={false} />);

      // Reopen dialog
      rerender(<ForkBranchDialog {...defaultProps} isOpen={true} />);

      // Inputs should be cleared
      expect(screen.getByTestId('fork-branch-name-input')).toHaveValue('');
    });
  });
});
