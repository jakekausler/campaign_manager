/**
 * @vitest-environment happy-dom
 */

import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import type { Branch } from '@/services/api/hooks';
import { UPDATE_BRANCH, GET_BRANCH_HIERARCHY } from '@/services/api/hooks/branches';
import { useCampaignStore } from '@/stores';

import { RenameBranchDialog } from './RenameBranchDialog';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks();
});

// Mock the campaign store
vi.mock('@/stores', () => ({
  useCampaignStore: vi.fn(),
}));

// Mock toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RenameBranchDialog', () => {
  const mockBranch: Branch = {
    id: 'branch-1',
    name: 'Main Branch',
    description: 'Main timeline',
    campaignId: 'campaign-1',
    parentId: null,
    divergedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isPinned: false,
    tags: [],
    color: null,
  };

  const mockHierarchy = [
    {
      branch: mockBranch,
      children: [
        {
          branch: {
            id: 'branch-2',
            name: 'Alternate Timeline',
            description: 'What if scenario',
            campaignId: 'campaign-1',
            parentId: 'branch-1',
            divergedAt: '2024-01-15T00:00:00Z',
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
            isPinned: false,
            tags: [],
            color: null,
          },
          children: [],
        },
      ],
    },
  ];

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCampaignStore).mockReturnValue({
      campaign: { id: 'campaign-1', name: 'Test Campaign' },
    } as ReturnType<typeof useCampaignStore>);
  });

  it('should render when open with branch data', () => {
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // "Rename Branch" appears twice - in title and button - so use getAllByText
    expect(screen.getAllByText('Rename Branch').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Branch Name/i)).toHaveValue('Main Branch');
    expect(screen.getByLabelText(/Description/i)).toHaveValue('Main timeline');
  });

  it('should not render when closed', () => {
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should populate form with branch data when opened', () => {
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    const nameInput = screen.getByLabelText(/Branch Name/i);
    const descriptionInput = screen.getByLabelText(/Description/i);

    expect(nameInput).toHaveValue('Main Branch');
    expect(descriptionInput).toHaveValue('Main timeline');
  });

  it('should update name input when user types', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Branch Name');

    expect(nameInput).toHaveValue('New Branch Name');
  });

  it('should update description input when user types', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    const descriptionInput = screen.getByLabelText(/Description/i);
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'New description');

    expect(descriptionInput).toHaveValue('New description');
  });

  it('should disable submit button when name is empty', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });

    // Button should be disabled when name is empty
    expect(submitButton).toBeDisabled();
  });

  it('should show validation error when branch name is duplicate', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Alternate Timeline'); // Name that exists in hierarchy

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    expect(
      await screen.findByText('A branch named "Alternate Timeline" already exists in this campaign')
    ).toBeInTheDocument();
  });

  it('should allow renaming to same name (no change)', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'Main Branch',
              description: 'Updated description',
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              description: 'Updated description',
            },
          },
        },
      },
      // Refetch after mutation
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    // Change only description, keep same name
    const descriptionInput = screen.getByLabelText(/Description/i);
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Updated description');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    // Should not show duplicate name error
    await waitFor(() => {
      expect(screen.queryByText(/already exists in this campaign/)).not.toBeInTheDocument();
    });

    // Should show success
    await waitFor(() => {
      expect(screen.getByText('Branch renamed successfully!')).toBeInTheDocument();
    });
  });

  it('should call updateBranch mutation with correct variables', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'Updated Branch Name',
              description: 'Updated description',
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              name: 'Updated Branch Name',
              description: 'Updated description',
            },
          },
        },
      },
      // Refetch after mutation
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    const descriptionInput = screen.getByLabelText(/Description/i);

    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Branch Name');

    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Updated description');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    // Verify success message appears
    await waitFor(() => {
      expect(screen.getByText('Branch renamed successfully!')).toBeInTheDocument();
    });
  });

  it('should trim whitespace from inputs before submission', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'Trimmed Name',
              description: 'Trimmed Description',
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              name: 'Trimmed Name',
              description: 'Trimmed Description',
            },
          },
        },
      },
      // Refetch after mutation
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    const descriptionInput = screen.getByLabelText(/Description/i);

    await user.clear(nameInput);
    await user.type(nameInput, '  Trimmed Name  ');

    await user.clear(descriptionInput);
    await user.type(descriptionInput, '  Trimmed Description  ');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    // Verify success
    await waitFor(() => {
      expect(screen.getByText('Branch renamed successfully!')).toBeInTheDocument();
    });
  });

  it('should send null for empty description', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'Updated Name',
              description: null,
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              name: 'Updated Name',
              description: null,
            },
          },
        },
      },
      // Refetch after mutation
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    const descriptionInput = screen.getByLabelText(/Description/i);

    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');

    await user.clear(descriptionInput); // Leave description empty

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    // Verify success
    await waitFor(() => {
      expect(screen.getByText('Branch renamed successfully!')).toBeInTheDocument();
    });
  });

  it('should show loading state during mutation', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'New Name',
              description: 'Main timeline',
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              name: 'New Name',
            },
          },
        },
        delay: 100, // Delay to allow checking loading state
      },
      // Refetch after mutation
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    // Check for loading state
    expect(await screen.findByText('Renaming branch...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Renaming.../i })).toBeDisabled();

    // Wait for mutation to complete
    await waitFor(() => {
      expect(screen.getByText('Branch renamed successfully!')).toBeInTheDocument();
    });
  });

  it('should display error message when mutation fails', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'New Name',
              description: 'Main timeline',
            },
          },
        },
        error: new Error('Failed to rename branch'),
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    // Check for error message
    expect(await screen.findByText('Failed to rename branch')).toBeInTheDocument();
  });

  it('should call onSuccess when mutation succeeds', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'New Name',
              description: 'Main timeline',
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              name: 'New Name',
            },
          },
        },
      },
      // Refetch after mutation
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('branch-1');
    });
  });

  it('should show success message after successful rename', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'New Name',
              description: 'Main timeline',
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              name: 'New Name',
            },
          },
        },
      },
      // Refetch after mutation
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    expect(await screen.findByText('Branch renamed successfully!')).toBeInTheDocument();
  });

  it('should show Close button after successful rename', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'New Name',
              description: 'Main timeline',
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              name: 'New Name',
            },
          },
        },
      },
      // Refetch after mutation
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Branch renamed successfully!')).toBeInTheDocument();
    });

    // Should show Close button instead of Cancel/Rename
    // There are two "Close" buttons: the dialog X button and the footer Close button
    // We want to verify the footer Close button is visible
    const closeButtons = screen.getAllByRole('button', { name: /Close/i });
    expect(closeButtons.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
  });

  it('should close dialog when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close dialog when Close button is clicked after success', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'New Name',
              description: 'Main timeline',
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              name: 'New Name',
            },
          },
        },
      },
      // Refetch after mutation
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    // Wait for success state
    await waitFor(() => {
      expect(screen.getByText('Branch renamed successfully!')).toBeInTheDocument();
    });

    // There are two "Close" buttons: the dialog X button and the footer Close button
    // We need to click the footer Close button (which is NOT the sr-only one)
    const closeButtons = screen.getAllByRole('button', { name: /Close/i });
    // Filter out the X button (which has sr-only text) by checking for the one in the footer
    const footerCloseButton = closeButtons.find((btn) => !btn.querySelector('.sr-only'));
    expect(footerCloseButton).toBeDefined();

    await user.click(footerCloseButton!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should prevent closing during loading operation', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'New Name',
              description: 'Main timeline',
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              name: 'New Name',
            },
          },
        },
        delay: 100,
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    await user.click(submitButton);

    // Try to click Cancel during loading
    await waitFor(() => {
      expect(screen.getByText('Renaming branch...')).toBeInTheDocument();
    });

    // Cancel button should be disabled during loading
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    expect(cancelButton).toBeDisabled();
  });

  it('should reset form when dialog is closed and reopened', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    const { rerender } = render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Modified Name');

    // Close dialog
    rerender(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Reopen dialog
    rerender(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Form should be reset to original values
    const nameInputReopened = screen.getByLabelText(/Branch Name/i);
    expect(nameInputReopened).toHaveValue('Main Branch');
  });

  it('should submit form when Enter key is pressed', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
      {
        request: {
          query: UPDATE_BRANCH,
          variables: {
            id: 'branch-1',
            input: {
              name: 'New Name',
              description: 'Main timeline',
            },
          },
        },
        result: {
          data: {
            updateBranch: {
              ...mockBranch,
              name: 'New Name',
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Wait for hierarchy data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Branch Name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    // Press Enter
    await user.keyboard('{Enter}');

    // Should show success
    await waitFor(() => {
      expect(screen.getByText('Branch renamed successfully!')).toBeInTheDocument();
    });
  });

  it('should close dialog when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    // Press Escape
    await user.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should disable submit button when no changes are made', () => {
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when name is changed', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    const nameInput = screen.getByLabelText(/Branch Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Changed Name');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('should enable submit button when description is changed', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: GET_BRANCH_HIERARCHY,
          variables: { campaignId: 'campaign-1' },
        },
        result: {
          data: {
            branchHierarchy: mockHierarchy,
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RenameBranchDialog
          branch={mockBranch}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MockedProvider>
    );

    const descriptionInput = screen.getByLabelText(/Description/i);
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Changed description');

    const submitButton = screen.getByRole('button', { name: /Rename Branch/i });
    expect(submitButton).not.toBeDisabled();
  });
});
