import type { MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { GET_KINGDOM_BY_ID } from '@/services/api/hooks/kingdoms';
import { GET_SETTLEMENTS_BY_KINGDOM } from '@/services/api/hooks/settlements';

import { KingdomContextPanel } from './KingdomContextPanel';

/**
 * Test suite for KingdomContextPanel component
 *
 * Covers:
 * - Loading state rendering
 * - Error state handling
 * - Missing kingdom display
 * - Kingdom name and level display
 * - Total settlements count (0, 1, multiple)
 * - "Navigate to Kingdom" button (placeholder for future)
 * - Settlement context display
 * - Plural/singular settlement wording
 */

// Helper to create kingdom Apollo mock
function createKingdomMock(kingdom: unknown, error?: Error): MockedResponse {
  return {
    request: {
      query: GET_KINGDOM_BY_ID,
      variables: { id: 'kingdom-1' },
    },
    result: error ? undefined : { data: { kingdom } },
    error,
  };
}

// Helper to create settlements Apollo mock
function createSettlementsMock(settlements: unknown[], error?: Error): MockedResponse {
  return {
    request: {
      query: GET_SETTLEMENTS_BY_KINGDOM,
      variables: { kingdomId: 'kingdom-1' },
    },
    result: error ? undefined : { data: { settlementsByKingdom: settlements } },
    error,
  };
}

// Helper to render component with mocks
function renderWithMocks(ui: React.ReactElement, mocks: MockedResponse[] = []) {
  const user = userEvent.setup();
  const result = render(<MockedProvider mocks={mocks}>{ui}</MockedProvider>);
  return { user, ...result };
}

describe('KingdomContextPanel', () => {
  describe('Loading State', () => {
    it('should display loading skeleton while fetching kingdom', () => {
      const kingdomMock = createKingdomMock(null);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      // Check for skeleton loaders
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show kingdom context heading during loading', () => {
      const kingdomMock = createKingdomMock(null);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      expect(screen.getByText('Kingdom Context')).toBeInTheDocument();
    });

    it('should show all field labels during loading', () => {
      const kingdomMock = createKingdomMock(null);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      expect(screen.getByText('Kingdom Name')).toBeInTheDocument();
      expect(screen.getByText('Kingdom Level')).toBeInTheDocument();
      expect(screen.getByText('Total Settlements')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when kingdom fetch fails', async () => {
      const error = new Error('Failed to fetch kingdom');
      const kingdomMock = createKingdomMock(null, error);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/Failed to load kingdom/i)).toBeInTheDocument();
    });

    it('should display specific error message from server', async () => {
      const error = new Error('Kingdom not found');
      const kingdomMock = createKingdomMock(null, error);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(screen.getByText(/Kingdom not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Missing Kingdom State', () => {
    it('should display fallback message when kingdom is null', async () => {
      const kingdomMock = createKingdomMock(null);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(
          screen.getByText('No kingdom data available for this settlement.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Kingdom Data Display', () => {
    const mockKingdom = {
      id: 'kingdom-1',
      campaignId: 'campaign-1',
      name: 'The Great Empire',
      level: 3,
      variables: {},
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
      archivedAt: null,
    };

    it('should display kingdom name', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(screen.getByText('The Great Empire')).toBeInTheDocument();
      });
    });

    it('should display kingdom level', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(screen.getByText('Level 3')).toBeInTheDocument();
      });
    });

    it('should display level for different kingdom levels', async () => {
      const kingdomLevel5 = { ...mockKingdom, level: 5 };
      const kingdomMock = createKingdomMock(kingdomLevel5);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(screen.getByText('Level 5')).toBeInTheDocument();
      });
    });
  });

  describe('Settlements Count', () => {
    const mockKingdom = {
      id: 'kingdom-1',
      campaignId: 'campaign-1',
      name: 'The Great Empire',
      level: 3,
      variables: {},
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
      archivedAt: null,
    };

    it('should display "0 settlements" when kingdom has no settlements', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(screen.getByText('0 settlements')).toBeInTheDocument();
      });
    });

    it('should display "1 settlement" (singular) when kingdom has one settlement', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([
        {
          id: 'settlement-1',
          name: 'Capital City',
          level: 1,
          x: 0,
          y: 0,
          z: 0,
          campaignId: 'campaign-1',
          kingdomId: 'kingdom-1',
          ownerId: 'user-1',
          isArchived: false,
          archivedAt: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(screen.getByText('1 settlement')).toBeInTheDocument();
      });
    });

    it('should display "X settlements" (plural) when kingdom has multiple settlements', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([
        {
          id: 'settlement-1',
          name: 'Capital City',
          level: 1,
          x: 0,
          y: 0,
          z: 0,
          campaignId: 'campaign-1',
          kingdomId: 'kingdom-1',
          ownerId: 'user-1',
          isArchived: false,
          archivedAt: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'settlement-2',
          name: 'Border Town',
          level: 1,
          x: 10,
          y: 10,
          z: 0,
          campaignId: 'campaign-1',
          kingdomId: 'kingdom-1',
          ownerId: 'user-1',
          isArchived: false,
          archivedAt: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'settlement-3',
          name: 'Harbor Village',
          level: 1,
          x: 20,
          y: 20,
          z: 0,
          campaignId: 'campaign-1',
          kingdomId: 'kingdom-1',
          ownerId: 'user-1',
          isArchived: false,
          archivedAt: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(screen.getByText('3 settlements')).toBeInTheDocument();
      });
    });
  });

  describe('Navigate to Kingdom Button', () => {
    const mockKingdom = {
      id: 'kingdom-1',
      campaignId: 'campaign-1',
      name: 'The Great Empire',
      level: 3,
      variables: {},
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
      archivedAt: null,
    };

    it('should render "Navigate to Kingdom" button', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Navigate to Kingdom/i });
        expect(button).toBeInTheDocument();
      });
    });

    it('should log message when "Navigate to Kingdom" is clicked (placeholder)', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([]);

      // Spy on console.info
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const { user } = renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Navigate to Kingdom/i })).toBeInTheDocument();
      });

      const button = screen.getByRole('button', { name: /Navigate to Kingdom/i });
      await user.click(button);

      // Verify console.info was called
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        'Kingdom detail view not yet implemented. Kingdom ID:',
        'kingdom-1'
      );

      consoleInfoSpy.mockRestore();
    });

    it('should display helpful title attribute on button', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Navigate to Kingdom/i });
        expect(button).toHaveAttribute('title', 'View Kingdom details (coming soon)');
      });
    });
  });

  describe('Settlement Context', () => {
    const mockKingdom = {
      id: 'kingdom-1',
      campaignId: 'campaign-1',
      name: 'The Great Empire',
      level: 3,
      variables: {},
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
      archivedAt: null,
    };

    it('should display settlement context when settlementName is provided', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" settlementName="Capital City" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(screen.getByText('Capital City')).toBeInTheDocument();
        expect(screen.getByText('belongs to this kingdom')).toBeInTheDocument();
      });
    });

    it('should not display settlement context when settlementName is not provided', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        expect(screen.getByText('The Great Empire')).toBeInTheDocument();
      });

      expect(screen.queryByText(/belongs to this kingdom/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    const mockKingdom = {
      id: 'kingdom-1',
      campaignId: 'campaign-1',
      name: 'The Great Empire',
      level: 3,
      variables: {},
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      deletedAt: null,
      archivedAt: null,
    };

    it('should use role="alert" for error messages', async () => {
      const error = new Error('Network error');
      const kingdomMock = createKingdomMock(null, error);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/Failed to load kingdom/i);
      });
    });

    it('should have proper button accessibility', async () => {
      const kingdomMock = createKingdomMock(mockKingdom);
      const settlementsMock = createSettlementsMock([]);

      renderWithMocks(<KingdomContextPanel kingdomId="kingdom-1" />, [
        kingdomMock,
        settlementsMock,
      ]);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Navigate to Kingdom/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('title');
      });
    });
  });
});
