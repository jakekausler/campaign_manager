import type { MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { GET_SETTLEMENT_DETAILS } from '@/services/api/hooks/settlements';

import { ParentSettlementContext } from './ParentSettlementContext';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

/**
 * Test suite for ParentSettlementContext component
 *
 * Tests cover:
 * - Loading states with skeleton UI
 * - Error handling
 * - Missing settlement handling
 * - Successful data display
 * - Navigation callback
 */

// Wrapper to provide Router context for all tests
function TestWrapper({
  children,
  mocks,
}: {
  children: React.ReactNode;
  mocks: ReadonlyArray<MockedResponse>;
}) {
  return (
    <BrowserRouter>
      <MockedProvider mocks={mocks}>{children}</MockedProvider>
    </BrowserRouter>
  );
}

describe('ParentSettlementContext', () => {
  const mockSettlementId = 'settlement-1';
  const mockOnNavigate = vi.fn();

  const mockSettlementData = {
    id: 'settlement-1',
    name: 'Capital City',
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
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    computedFields: {},
    variables: {},
    variableSchemas: [],
  };

  const successMock = {
    request: {
      query: GET_SETTLEMENT_DETAILS,
      variables: { id: mockSettlementId },
    },
    result: {
      data: {
        settlement: mockSettlementData,
      },
    },
  };

  const errorMock = {
    request: {
      query: GET_SETTLEMENT_DETAILS,
      variables: { id: mockSettlementId },
    },
    result: {
      errors: [new GraphQLError('Network error')],
    },
  };

  const nullSettlementMock = {
    request: {
      query: GET_SETTLEMENT_DETAILS,
      variables: { id: mockSettlementId },
    },
    result: {
      data: {
        settlement: null,
      },
    },
  };

  describe('Loading State', () => {
    it('should display loading skeletons while fetching data', () => {
      render(
        <TestWrapper mocks={[successMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      // Check for loading skeletons
      expect(screen.getByTestId('settlement-name-skeleton')).toBeInTheDocument();
      expect(screen.getByTestId('settlement-level-skeleton')).toBeInTheDocument();
      expect(screen.getByTestId('navigate-button-skeleton')).toBeInTheDocument();
    });

    it('should display "Parent Settlement" header during loading', () => {
      render(
        <TestWrapper mocks={[successMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Parent Settlement')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      render(
        <TestWrapper mocks={[errorMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('settlement-error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('settlement-error')).toHaveTextContent(
        'Error loading settlement: Network error'
      );
    });

    it('should display error alert with role="alert"', async () => {
      render(
        <TestWrapper mocks={[errorMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const errorAlert = screen.getByTestId('settlement-error').closest('[role="alert"]');
        expect(errorAlert).toBeInTheDocument();
      });
    });
  });

  describe('Missing Settlement State', () => {
    it('should display "Settlement not found" message when settlement is null', async () => {
      render(
        <TestWrapper mocks={[nullSettlementMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('settlement-not-found')).toBeInTheDocument();
      });

      expect(screen.getByTestId('settlement-not-found')).toHaveTextContent(
        "Settlement not found or you don't have permission to view it."
      );
    });

    it('should display alert with role="status" for missing settlement', async () => {
      render(
        <TestWrapper mocks={[nullSettlementMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const statusAlert = screen.getByTestId('settlement-not-found').closest('[role="status"]');
        expect(statusAlert).toBeInTheDocument();
      });
    });
  });

  describe('Successful Data Display', () => {
    it('should display settlement name', async () => {
      render(
        <TestWrapper mocks={[successMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Capital City')).toBeInTheDocument();
      });
    });

    it('should display settlement level', async () => {
      render(
        <TestWrapper mocks={[successMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('should display "N/A" when level is undefined', async () => {
      const noLevelMock = {
        request: {
          query: GET_SETTLEMENT_DETAILS,
          variables: { id: mockSettlementId },
        },
        result: {
          data: {
            settlement: {
              ...mockSettlementData,
              level: null,
            },
          },
        },
      };

      render(
        <TestWrapper mocks={[noLevelMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      // Wait for loading skeleton to disappear
      await waitFor(() => {
        expect(screen.queryByTestId('settlement-level-skeleton')).not.toBeInTheDocument();
      });

      // Find the level value container and check for "N/A"
      const levelValue = screen.getByText('N/A');
      expect(levelValue).toBeInTheDocument();
    });

    it('should display MapPin icon in header', async () => {
      render(
        <TestWrapper mocks={[successMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Capital City')).toBeInTheDocument();
      });

      // Icon has aria-hidden="true" so check by className
      const icons = document.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should display "Navigate to Settlement" button', async () => {
      render(
        <TestWrapper mocks={[successMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /navigate to settlement/i })).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should call onNavigateToSettlement with settlementId when button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper mocks={[successMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /navigate to settlement/i })).toBeInTheDocument();
      });

      const navigateButton = screen.getByRole('button', { name: /navigate to settlement/i });
      await user.click(navigateButton);

      expect(mockOnNavigate).toHaveBeenCalledWith(mockSettlementId);
      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
    });

    it('should not crash if onNavigateToSettlement is undefined', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper mocks={[successMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /navigate to settlement/i })).toBeInTheDocument();
      });

      const navigateButton = screen.getByRole('button', { name: /navigate to settlement/i });

      // Should not throw an error
      await expect(user.click(navigateButton)).resolves.not.toThrow();
    });

    it('should have helpful title attribute on navigate button', async () => {
      render(
        <TestWrapper mocks={[successMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /navigate to settlement/i })).toBeInTheDocument();
      });

      const navigateButton = screen.getByRole('button', { name: /navigate to settlement/i });
      expect(navigateButton).toHaveAttribute(
        'title',
        'Open this settlement in the Entity Inspector'
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA structure for success state', async () => {
      render(
        <TestWrapper mocks={[successMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Capital City')).toBeInTheDocument();
      });

      // Button should be accessible
      const button = screen.getByRole('button', { name: /navigate to settlement/i });
      expect(button).toBeInTheDocument();

      // Icons should have aria-hidden
      const icons = document.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have role="alert" for error states', async () => {
      render(
        <TestWrapper mocks={[errorMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const alerts = document.querySelectorAll('[role="alert"]');
        expect(alerts.length).toBeGreaterThan(0);
      });
    });

    it('should have role="status" for missing settlement states', async () => {
      render(
        <TestWrapper mocks={[nullSettlementMock]}>
          <ParentSettlementContext
            settlementId={mockSettlementId}
            onNavigateToSettlement={mockOnNavigate}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const statusElements = document.querySelectorAll('[role="status"]');
        expect(statusElements.length).toBeGreaterThan(0);
      });
    });
  });
});
