import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';

import { LinksTab } from './LinksTab';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('LinksTab', () => {
  describe('Settlement Links', () => {
    describe('Loading State', () => {
      it('should display loading message while fetching settlement', () => {
        renderWithApollo(<LinksTab entityType="settlement" entityId="loading-settlement" />);

        expect(screen.getByText(/loading related entities/i)).toBeInTheDocument();
      });
    });

    describe('Error State', () => {
      it('should display error message when settlement query fails', async () => {
        renderWithApollo(<LinksTab entityType="settlement" entityId="invalid-settlement" />);

        await waitFor(() => {
          expect(screen.getByText(/error loading settlement/i)).toBeInTheDocument();
        });
      });
    });

    describe('Not Found State', () => {
      it('should display not found message when settlement does not exist', async () => {
        renderWithApollo(<LinksTab entityType="settlement" entityId="nonexistent-settlement" />);

        await waitFor(() => {
          expect(screen.getByText(/settlement not found/i)).toBeInTheDocument();
        });
      });
    });

    describe('Parent Entities Display', () => {
      it('should display kingdom link', async () => {
        renderWithApollo(<LinksTab entityType="settlement" entityId="settlement-1" />);

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to kingdom/i)).toBeInTheDocument();
        });

        // Check that kingdom ID is displayed
        expect(screen.getByText('kingdom-1')).toBeInTheDocument();
      });

      it('should display location link', async () => {
        renderWithApollo(<LinksTab entityType="settlement" entityId="settlement-1" />);

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to location/i)).toBeInTheDocument();
        });

        // Check that location ID is displayed
        expect(screen.getByText('location-1')).toBeInTheDocument();
      });

      it('should display campaign link', async () => {
        renderWithApollo(<LinksTab entityType="settlement" entityId="settlement-1" />);

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to campaign/i)).toBeInTheDocument();
        });

        // Check that campaign ID is displayed
        expect(screen.getByText('campaign-1')).toBeInTheDocument();
      });
    });

    describe('Child Entities Display (Structures)', () => {
      it('should display structures count', async () => {
        renderWithApollo(<LinksTab entityType="settlement" entityId="settlement-1" />);

        await waitFor(() => {
          expect(screen.getByText(/structures \(3\)/i)).toBeInTheDocument();
        });
      });

      it('should display structure names', async () => {
        renderWithApollo(<LinksTab entityType="settlement" entityId="settlement-1" />);

        await waitFor(() => {
          expect(screen.getByText('Main Barracks')).toBeInTheDocument();
        });

        expect(screen.getByText('Central Market')).toBeInTheDocument();
      });

      it('should display empty state when no structures exist', async () => {
        renderWithApollo(<LinksTab entityType="settlement" entityId="settlement-empty" />);

        await waitFor(() => {
          expect(screen.getByText(/no structures in this settlement/i)).toBeInTheDocument();
        });
      });

      it('should display error when structures query fails', async () => {
        renderWithApollo(
          <LinksTab entityType="settlement" entityId="settlement-error-structures" />
        );

        await waitFor(() => {
          expect(screen.getByText(/error loading structures/i)).toBeInTheDocument();
        });
      });
    });

    describe('Navigation Callbacks', () => {
      it('should call onNavigate when kingdom link is clicked', async () => {
        const handleNavigate = vi.fn();
        renderWithApollo(
          <LinksTab entityType="settlement" entityId="settlement-1" onNavigate={handleNavigate} />
        );

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to kingdom/i)).toBeInTheDocument();
        });

        const kingdomLink = screen.getByTitle(/navigate to kingdom/i);
        await userEvent.click(kingdomLink);

        expect(handleNavigate).toHaveBeenCalledWith({
          id: 'kingdom-1',
          name: 'Kingdom',
          type: 'kingdom',
        });
      });

      it('should call onNavigate when location link is clicked', async () => {
        const handleNavigate = vi.fn();
        renderWithApollo(
          <LinksTab entityType="settlement" entityId="settlement-1" onNavigate={handleNavigate} />
        );

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to location/i)).toBeInTheDocument();
        });

        const locationLink = screen.getByTitle(/navigate to location/i);
        await userEvent.click(locationLink);

        expect(handleNavigate).toHaveBeenCalledWith({
          id: 'location-1',
          name: 'Location',
          type: 'location',
        });
      });

      it('should call onNavigate when campaign link is clicked', async () => {
        const handleNavigate = vi.fn();
        renderWithApollo(
          <LinksTab entityType="settlement" entityId="settlement-1" onNavigate={handleNavigate} />
        );

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to campaign/i)).toBeInTheDocument();
        });

        const campaignLink = screen.getByTitle(/navigate to campaign/i);
        await userEvent.click(campaignLink);

        expect(handleNavigate).toHaveBeenCalledWith({
          id: 'campaign-1',
          name: 'Campaign',
          type: 'campaign',
        });
      });

      it('should call onNavigate when structure link is clicked', async () => {
        const handleNavigate = vi.fn();
        renderWithApollo(
          <LinksTab entityType="settlement" entityId="settlement-1" onNavigate={handleNavigate} />
        );

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to main barracks/i)).toBeInTheDocument();
        });

        const structureLink = screen.getByTitle(/navigate to main barracks/i);
        await userEvent.click(structureLink);

        expect(handleNavigate).toHaveBeenCalledWith({
          id: 'structure-1',
          name: 'Main Barracks',
          type: 'structure',
        });
      });

      it('should support keyboard navigation with Enter key', async () => {
        const handleNavigate = vi.fn();
        renderWithApollo(
          <LinksTab entityType="settlement" entityId="settlement-1" onNavigate={handleNavigate} />
        );

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to kingdom/i)).toBeInTheDocument();
        });

        const kingdomLink = screen.getByTitle(/navigate to kingdom/i);
        kingdomLink.focus();
        await userEvent.keyboard('{Enter}');

        expect(handleNavigate).toHaveBeenCalledWith({
          id: 'kingdom-1',
          name: 'Kingdom',
          type: 'kingdom',
        });
      });

      it('should support keyboard navigation with Space key', async () => {
        const handleNavigate = vi.fn();
        renderWithApollo(
          <LinksTab entityType="settlement" entityId="settlement-1" onNavigate={handleNavigate} />
        );

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to kingdom/i)).toBeInTheDocument();
        });

        const kingdomLink = screen.getByTitle(/navigate to kingdom/i);
        kingdomLink.focus();
        await userEvent.keyboard(' ');

        expect(handleNavigate).toHaveBeenCalledWith({
          id: 'kingdom-1',
          name: 'Kingdom',
          type: 'kingdom',
        });
      });
    });
  });

  describe('Structure Links', () => {
    describe('Loading State', () => {
      it('should display loading message while fetching structure', () => {
        renderWithApollo(<LinksTab entityType="structure" entityId="loading-structure" />);

        expect(screen.getByText(/loading related entities/i)).toBeInTheDocument();
      });
    });

    describe('Error State', () => {
      it('should display error message when structure query fails', async () => {
        renderWithApollo(<LinksTab entityType="structure" entityId="invalid-structure" />);

        await waitFor(() => {
          expect(screen.getByText(/error loading structure/i)).toBeInTheDocument();
        });
      });
    });

    describe('Not Found State', () => {
      it('should display not found message when structure does not exist', async () => {
        renderWithApollo(<LinksTab entityType="structure" entityId="nonexistent-structure" />);

        await waitFor(() => {
          expect(screen.getByText(/structure not found/i)).toBeInTheDocument();
        });
      });
    });

    describe('Parent Entities Display', () => {
      it('should display settlement link', async () => {
        renderWithApollo(<LinksTab entityType="structure" entityId="structure-1" />);

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to settlement/i)).toBeInTheDocument();
        });

        // Check that settlement ID is displayed
        expect(screen.getByText('settlement-1')).toBeInTheDocument();
      });
    });

    describe('Navigation Callbacks', () => {
      it('should call onNavigate when settlement link is clicked', async () => {
        const handleNavigate = vi.fn();
        renderWithApollo(
          <LinksTab entityType="structure" entityId="structure-1" onNavigate={handleNavigate} />
        );

        await waitFor(() => {
          expect(screen.getByTitle(/navigate to settlement/i)).toBeInTheDocument();
        });

        const settlementLink = screen.getByTitle(/navigate to settlement/i);
        await userEvent.click(settlementLink);

        expect(handleNavigate).toHaveBeenCalledWith({
          id: 'settlement-1',
          name: 'Settlement',
          type: 'settlement',
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role for clickable links', async () => {
      renderWithApollo(<LinksTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const links = screen.getAllByRole('button');
        expect(links.length).toBeGreaterThan(0);
      });
    });

    it('should have title attributes on links', async () => {
      renderWithApollo(<LinksTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        expect(screen.getByTitle(/navigate to kingdom/i)).toBeInTheDocument();
      });

      expect(screen.getByTitle(/navigate to location/i)).toBeInTheDocument();
      expect(screen.getByTitle(/navigate to campaign/i)).toBeInTheDocument();
    });

    it('should be keyboard navigable with tabIndex', async () => {
      renderWithApollo(<LinksTab entityType="settlement" entityId="settlement-1" />);

      await waitFor(() => {
        const kingdomLink = screen.getByTitle(/navigate to kingdom/i);
        expect(kingdomLink).toHaveAttribute('tabIndex', '0');
      });
    });
  });
});
