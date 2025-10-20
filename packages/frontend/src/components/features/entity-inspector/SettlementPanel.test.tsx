import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { SettlementPanel } from './SettlementPanel';
import type { SettlementData } from './SettlementPanel';

describe('SettlementPanel', () => {
  let writeTextSpy: MockInstance<[data: string], Promise<void>>;

  beforeEach(() => {
    // Spy on the clipboard API provided by happy-dom
    writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  });

  afterEach(() => {
    writeTextSpy.mockRestore();
  });

  const mockSettlement: SettlementData = {
    id: 'settlement-1',
    name: 'Ironhold',
    kingdomId: 'kingdom-1',
    level: 3,
    x: 100,
    y: 200,
    z: 0,
    campaignId: 'campaign-1',
    ownerId: 'owner-1',
    isArchived: false,
    archivedAt: null,
    variables: {
      prosperity: 75,
      morale: 80,
      has_walls: true,
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  describe('Settlement Attributes Section', () => {
    it('should render settlement attributes section header', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Settlement Attributes')).toBeInTheDocument();
    });

    it('should display kingdom ID', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Kingdom ID')).toBeInTheDocument();
      expect(screen.getByText('kingdom-1')).toBeInTheDocument();
    });

    it('should display campaign ID', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Campaign ID')).toBeInTheDocument();
      expect(screen.getByText('campaign-1')).toBeInTheDocument();
    });

    it('should display level', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Level')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display owner ID', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Owner ID')).toBeInTheDocument();
      expect(screen.getByText('owner-1')).toBeInTheDocument();
    });

    it('should display archived status', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Is Archived')).toBeInTheDocument();
      expect(screen.getByText('false')).toBeInTheDocument();
    });
  });

  describe('Typed Variables Section', () => {
    it('should render typed variables section header', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Typed Variables')).toBeInTheDocument();
    });

    it('should display number variables', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Prosperity')).toBeInTheDocument();
      expect(screen.getByText('75')).toBeInTheDocument();
      expect(screen.getByText('Morale')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('should display boolean variables', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Has Walls')).toBeInTheDocument();
      expect(screen.getByText('true')).toBeInTheDocument();
    });

    it('should convert snake_case to Title Case', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Has Walls')).toBeInTheDocument();
    });

    it('should display empty state when no variables exist', () => {
      const settlementNoVars: SettlementData = {
        ...mockSettlement,
        variables: {},
      };
      render(<SettlementPanel settlement={settlementNoVars} />);
      expect(
        screen.getByText('No typed variables available for this settlement')
      ).toBeInTheDocument();
    });

    it('should display empty state when variables is undefined', () => {
      const settlementNoVars: SettlementData = {
        ...mockSettlement,
        variables: undefined,
      };
      render(<SettlementPanel settlement={settlementNoVars} />);
      expect(
        screen.getByText('No typed variables available for this settlement')
      ).toBeInTheDocument();
    });

    it('should format object variables as JSON', () => {
      const settlementWithObject: SettlementData = {
        ...mockSettlement,
        variables: {
          metadata: {
            founded: '1402',
            ruler: 'King Aldric',
          },
        },
      };
      render(<SettlementPanel settlement={settlementWithObject} />);
      expect(screen.getByText('Metadata')).toBeInTheDocument();
      const jsonText = screen.getByText(/"founded": "1402"/);
      expect(jsonText).toBeInTheDocument();
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy field value to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      render(<SettlementPanel settlement={mockSettlement} />);

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      await user.click(copyButtons[0]); // Click first copy button (Kingdom ID)

      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledWith('kingdom-1');
      });
    });

    it('should show checkmark after successful copy', async () => {
      const user = userEvent.setup();
      render(<SettlementPanel settlement={mockSettlement} />);

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      await user.click(copyButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('✓')).toBeInTheDocument();
      });
    });

    it('should reset checkmark after 2 seconds', async () => {
      const user = userEvent.setup();
      vi.useFakeTimers();
      render(<SettlementPanel settlement={mockSettlement} />);

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      await user.click(copyButtons[0]);

      expect(screen.getByText('✓')).toBeInTheDocument();

      // Fast-forward 2 seconds
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.queryByText('✓')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should handle clipboard errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      writeTextSpy.mockRejectedValueOnce(new Error('Clipboard error'));

      const user = userEvent.setup();
      render(<SettlementPanel settlement={mockSettlement} />);

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      await user.click(copyButtons[0]);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to copy to clipboard:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Value Formatting', () => {
    it('should format null values as "N/A"', () => {
      const settlementWithNull: SettlementData = {
        ...mockSettlement,
        variables: {
          empty_field: null,
        },
      };
      render(<SettlementPanel settlement={settlementWithNull} />);
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('should format undefined values as "N/A"', () => {
      const settlementWithUndefined: SettlementData = {
        ...mockSettlement,
        variables: {
          missing_field: undefined,
        },
      };
      render(<SettlementPanel settlement={settlementWithUndefined} />);
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('should format boolean false correctly', () => {
      const settlementWithFalse: SettlementData = {
        ...mockSettlement,
        variables: {
          is_active: false,
        },
      };
      render(<SettlementPanel settlement={settlementWithFalse} />);
      // Use getAllByText since "false" might appear in aria attributes
      const falseElements = screen.getAllByText('false');
      expect(falseElements.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all fields', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      expect(screen.getByText('Kingdom ID')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Campaign ID')).toHaveClass('text-xs', 'font-semibold');
      expect(screen.getByText('Level')).toHaveClass('text-xs', 'font-semibold');
    });

    it('should have title attribute on copy buttons', () => {
      render(<SettlementPanel settlement={mockSettlement} />);
      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      expect(copyButtons.length).toBeGreaterThan(0);
    });
  });
});
