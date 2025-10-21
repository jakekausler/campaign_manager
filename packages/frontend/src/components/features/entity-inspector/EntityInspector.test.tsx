import { ApolloProvider } from '@apollo/client/react';
import { screen, waitFor, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  mockEncounters,
  mockEvents,
  mockSettlements,
  mockStructures,
} from '@/__tests__/mocks/data';
import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { EntityInspector } from './EntityInspector';

/**
 * Tests for EntityInspector component
 *
 * Coverage:
 * - Component renders with open/close state
 * - Fetches and displays settlement data
 * - Fetches and displays structure data
 * - Shows loading skeletons during fetch
 * - Shows error state on GraphQL error
 * - Shows not found state when entity doesn't exist
 * - Tabs are navigable
 */

describe('EntityInspector', () => {
  const mockOnClose = vi.fn();

  const renderWithApollo = (ui: React.ReactElement) => {
    const client = createTestApolloClient();
    return render(<ApolloProvider client={client}>{ui}</ApolloProvider>);
  };

  describe('Component Rendering', () => {
    it('should not render content when isOpen is false', () => {
      renderWithApollo(
        <EntityInspector
          entityType="settlement"
          entityId="settlement-1"
          isOpen={false}
          onClose={mockOnClose}
        />
      );
      // When sheet is closed, content should not be visible
      expect(screen.queryByText('Settlement Inspector')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="settlement"
          entityId="settlement-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Should show settlement inspector title
      await waitFor(() => {
        expect(screen.getByText('Settlement Inspector')).toBeInTheDocument();
      });
    });
  });

  describe('Settlement Data Loading', () => {
    it('should show loading skeleton while fetching settlement', () => {
      renderWithApollo(
        <EntityInspector
          entityType="settlement"
          entityId="settlement-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Should show skeleton elements (animate-pulse class from Skeleton component)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display settlement data after loading', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="settlement"
          entityId="settlement-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for settlement name to appear (appears in both header and Overview tab)
      await waitFor(() => {
        const nameElements = screen.getAllByText(new RegExp(mockSettlements[0].name));
        expect(nameElements.length).toBeGreaterThanOrEqual(1);
      });

      // Should show basic entity info in Overview tab
      await waitFor(() => {
        expect(screen.getByText(/ID:/)).toBeInTheDocument();
        expect(screen.getByText(/Name:/)).toBeInTheDocument();
        expect(screen.getByText(/Created:/)).toBeInTheDocument();
        expect(screen.getByText(/Updated:/)).toBeInTheDocument();
      });
    });
  });

  describe('Structure Data Loading', () => {
    it('should show loading skeleton while fetching structure', () => {
      renderWithApollo(
        <EntityInspector
          entityType="structure"
          entityId="structure-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Should show skeleton elements
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display structure data after loading', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="structure"
          entityId="structure-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for structure name to appear (appears in both header and Overview tab)
      await waitFor(() => {
        const nameElements = screen.getAllByText(new RegExp(mockStructures[0].name));
        expect(nameElements.length).toBeGreaterThanOrEqual(1);
      });

      // Should show Structure Inspector title
      expect(screen.getByText('Structure Inspector')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error state for settlement fetch failure', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="settlement"
          entityId="invalid-settlement"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for error message to appear (MSW handler returns error for invalid IDs)
      await waitFor(
        () => {
          expect(screen.getByText(/Error Loading Entity/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Should show retry button
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should show error state for structure fetch failure', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="structure"
          entityId="invalid-structure"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for error message to appear
      await waitFor(
        () => {
          expect(screen.getByText(/Error Loading Entity/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Tab Navigation', () => {
    it('should render all tabs', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="settlement"
          entityId="settlement-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for data to load (name appears in both header and Overview tab)
      await waitFor(() => {
        const nameElements = screen.getAllByText(new RegExp(mockSettlements[0].name));
        expect(nameElements.length).toBeGreaterThanOrEqual(1);
      });

      // Check all tab triggers are present
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /links/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /conditions/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /effects/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /versions/i })).toBeInTheDocument();
    });

    it('should show Overview tab content by default', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="settlement"
          entityId="settlement-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for data to load (name appears in both header and Overview tab)
      await waitFor(() => {
        const nameElements = screen.getAllByText(new RegExp(mockSettlements[0].name));
        expect(nameElements.length).toBeGreaterThanOrEqual(1);
      });

      // Overview tab should be selected by default (has data-state="active")
      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      expect(overviewTab).toHaveAttribute('data-state', 'active');
    });
  });

  describe('Not Found State', () => {
    it('should show not found message when settlement does not exist', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="settlement"
          entityId="nonexistent-settlement"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // MSW handler returns null for nonexistent entities
      await waitFor(
        () => {
          expect(screen.getByText(/Settlement not found/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should show not found message when structure does not exist', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="structure"
          entityId="nonexistent-structure"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // MSW handler returns null for nonexistent entities
      await waitFor(
        () => {
          expect(screen.getByText(/Structure not found/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Event Data Loading', () => {
    it('should show loading skeleton while fetching event', () => {
      renderWithApollo(
        <EntityInspector
          entityType="event"
          entityId="event-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Should show skeleton elements
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display event data after loading', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="event"
          entityId="event-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for event name to appear (appears in both header and Overview tab)
      await waitFor(() => {
        const nameElements = screen.getAllByText(new RegExp(mockEvents[0].name));
        expect(nameElements.length).toBeGreaterThanOrEqual(1);
      });

      // Should show Event Inspector title
      expect(screen.getByText('Event Inspector')).toBeInTheDocument();
    });

    it('should show error state for event fetch failure', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="event"
          entityId="invalid-event"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for error message to appear
      await waitFor(
        () => {
          expect(screen.getByText(/Error Loading Entity/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should show not found message when event does not exist', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="event"
          entityId="nonexistent-event"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // MSW handler returns null for nonexistent entities
      await waitFor(
        () => {
          expect(screen.getByText(/Event not found/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Encounter Data Loading', () => {
    it('should show loading skeleton while fetching encounter', () => {
      renderWithApollo(
        <EntityInspector
          entityType="encounter"
          entityId="encounter-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Should show skeleton elements
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display encounter data after loading', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="encounter"
          entityId="encounter-1"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for encounter name to appear (appears in both header and Overview tab)
      await waitFor(() => {
        const nameElements = screen.getAllByText(new RegExp(mockEncounters[0].name));
        expect(nameElements.length).toBeGreaterThanOrEqual(1);
      });

      // Should show Encounter Inspector title
      expect(screen.getByText('Encounter Inspector')).toBeInTheDocument();
    });

    it('should show error state for encounter fetch failure', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="encounter"
          entityId="invalid-encounter"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for error message to appear
      await waitFor(
        () => {
          expect(screen.getByText(/Error Loading Entity/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should show not found message when encounter does not exist', async () => {
      renderWithApollo(
        <EntityInspector
          entityType="encounter"
          entityId="nonexistent-encounter"
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // MSW handler returns null for nonexistent entities
      await waitFor(
        () => {
          expect(screen.getByText(/Encounter not found/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
