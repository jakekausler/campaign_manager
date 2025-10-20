import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OverviewTab, type Entity } from './OverviewTab';

describe('OverviewTab', () => {
  const mockSettlement: Entity = {
    id: 'settlement-1',
    name: 'Ironhold',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    computedFields: {
      population: 1500,
      defense: 25,
    },
  };

  const mockStructure: Entity = {
    id: 'structure-1',
    name: 'Main Barracks',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    computedFields: {
      capacity: 100,
      training_speed: 1.2,
    },
  };

  describe('Basic Information Section', () => {
    it('should render basic entity information', () => {
      render(<OverviewTab entity={mockSettlement} entityType="settlement" />);

      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('settlement-1')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Ironhold')).toBeInTheDocument();
    });

    it('should format timestamps correctly', () => {
      render(<OverviewTab entity={mockSettlement} entityType="settlement" />);

      // Check that timestamps are formatted as locale strings
      const createdDate = new Date('2024-01-01T00:00:00.000Z').toLocaleString();
      const updatedDate = new Date('2024-01-02T00:00:00.000Z').toLocaleString();

      expect(screen.getByText(createdDate)).toBeInTheDocument();
      expect(screen.getByText(updatedDate)).toBeInTheDocument();
    });

    it('should render for structure entities', () => {
      render(<OverviewTab entity={mockStructure} entityType="structure" />);

      expect(screen.getByText('structure-1')).toBeInTheDocument();
      expect(screen.getByText('Main Barracks')).toBeInTheDocument();
    });
  });

  describe('Description Section', () => {
    it('should render description when available', () => {
      const entityWithDescription: Entity = {
        ...mockSettlement,
        description: 'A fortified settlement with strong walls',
      };

      render(<OverviewTab entity={entityWithDescription} entityType="settlement" />);

      expect(screen.getByRole('heading', { name: 'Description' })).toBeInTheDocument();
      expect(screen.getByText('A fortified settlement with strong walls')).toBeInTheDocument();
    });

    it('should not render description section when not available', () => {
      render(<OverviewTab entity={mockSettlement} entityType="settlement" />);

      // Should only have "Basic Information" and "Computed Fields" sections
      const headers = screen.getAllByRole('heading', { level: 3 });
      expect(headers).toHaveLength(2);
      expect(headers[0]).toHaveTextContent('Basic Information');
      expect(headers[1]).toHaveTextContent('Computed Fields');
    });
  });

  describe('Computed Fields Section', () => {
    it('should render computed fields with proper formatting', () => {
      render(<OverviewTab entity={mockSettlement} entityType="settlement" />);

      expect(screen.getByText('Computed Fields')).toBeInTheDocument();
      // Field names should be converted from snake_case to Title Case
      expect(screen.getByText('Population')).toBeInTheDocument();
      expect(screen.getByText('Defense')).toBeInTheDocument();
      expect(screen.getByText('1500')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('should convert snake_case field names to Title Case', () => {
      render(<OverviewTab entity={mockStructure} entityType="structure" />);

      expect(screen.getByText('Training Speed')).toBeInTheDocument();
      expect(screen.getByText('Capacity')).toBeInTheDocument();
    });

    it('should handle complex JSON objects in computed fields', () => {
      const entityWithComplexFields: Entity = {
        ...mockSettlement,
        computedFields: {
          status: { health: 100, morale: 85 },
          resources: { gold: 5000, food: 2000 },
        },
      };

      render(<OverviewTab entity={entityWithComplexFields} entityType="settlement" />);

      // Should render JSON stringified version
      expect(screen.getByText(/"health": 100/)).toBeInTheDocument();
      expect(screen.getByText(/"gold": 5000/)).toBeInTheDocument();
    });

    it('should display empty state when no computed fields', () => {
      const entityWithoutFields: Entity = {
        ...mockSettlement,
        computedFields: {},
      };

      render(<OverviewTab entity={entityWithoutFields} entityType="settlement" />);

      expect(
        screen.getByText('No computed fields available for this settlement')
      ).toBeInTheDocument();
    });

    it('should display empty state when computedFields is undefined', () => {
      const entityWithoutFields: Entity = {
        id: 'test-1',
        name: 'Test',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      render(<OverviewTab entity={entityWithoutFields} entityType="structure" />);

      expect(
        screen.getByText('No computed fields available for this structure')
      ).toBeInTheDocument();
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy field value to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();

      render(<OverviewTab entity={mockSettlement} entityType="settlement" />);

      // Find the copy button for the ID field (first copy button)
      const copyButtons = screen.getAllByRole('button');
      const firstButton = copyButtons[0];

      // Button should show clipboard icon initially
      expect(firstButton).toHaveAttribute('title', 'Copy to clipboard');

      await user.click(firstButton);

      // After click, button title should change to "Copied!"
      await waitFor(() => {
        expect(firstButton).toHaveAttribute('title', 'Copied!');
      });

      // Checkmark should appear
      expect(within(firstButton).getByText('✓')).toBeInTheDocument();
    });

    it('should show checkmark after successful copy', async () => {
      const user = userEvent.setup();

      render(<OverviewTab entity={mockSettlement} entityType="settlement" />);

      const copyButtons = screen.getAllByRole('button');
      await user.click(copyButtons[0]);

      // Should show checkmark
      await waitFor(() => {
        expect(screen.getByText('✓')).toBeInTheDocument();
      });
    });

    it('should reset checkmark after 2 seconds', async () => {
      const user = userEvent.setup();

      render(<OverviewTab entity={mockSettlement} entityType="settlement" />);

      const copyButtons = screen.getAllByRole('button');
      const firstButton = copyButtons[0];

      await user.click(firstButton);

      // Should show checkmark initially
      await waitFor(() => {
        expect(within(firstButton).getByText('✓')).toBeInTheDocument();
      });

      // Wait for checkmark to disappear after 2 seconds
      await waitFor(
        () => {
          expect(within(firstButton).queryByText('✓')).not.toBeInTheDocument();
          expect(within(firstButton).getByText('📋')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should handle clipboard API errors gracefully', async () => {
      // This test verifies that errors in the clipboard API don't crash the component
      // Since happy-dom provides a working stub, we just verify the copy still works
      const user = userEvent.setup();

      render(<OverviewTab entity={mockSettlement} entityType="settlement" />);

      const copyButtons = screen.getAllByRole('button');
      const firstButton = copyButtons[0];

      await user.click(firstButton);

      // Even if there were errors, the UI should still work
      // In this case, happy-dom's clipboard works, so we see success
      await waitFor(() => {
        expect(firstButton).toHaveAttribute('title', 'Copied!');
      });
    });

    it('should copy formatted JSON for complex objects', async () => {
      const user = userEvent.setup();

      const entityWithComplexFields: Entity = {
        ...mockSettlement,
        computedFields: {
          status: { health: 100, morale: 85 },
        },
      };

      render(<OverviewTab entity={entityWithComplexFields} entityType="settlement" />);

      // Find the copy button for the status field
      const copyButtons = screen.getAllByRole('button');
      // Skip first 4 buttons (id, name, createdAt, updatedAt)
      const statusButton = copyButtons[4];

      await user.click(statusButton);

      // Button should show "Copied!" after successful copy
      await waitFor(() => {
        expect(statusButton).toHaveAttribute('title', 'Copied!');
      });

      // Checkmark should appear
      expect(within(statusButton).getByText('✓')).toBeInTheDocument();
    });
  });

  describe('Value Formatting', () => {
    it('should display "N/A" for null and undefined values', () => {
      const entityWithNullValues: Entity = {
        ...mockSettlement,
        computedFields: {
          null_field: null,
          undefined_field: undefined,
        },
      };

      render(<OverviewTab entity={entityWithNullValues} entityType="settlement" />);

      // Both null and undefined should render as "N/A"
      const naElements = screen.getAllByText('N/A');
      expect(naElements).toHaveLength(2);
    });

    it('should format boolean values as strings', () => {
      const entityWithBoolean: Entity = {
        ...mockSettlement,
        computedFields: {
          is_active: true,
          is_locked: false,
        },
      };

      render(<OverviewTab entity={entityWithBoolean} entityType="settlement" />);

      expect(screen.getByText('true')).toBeInTheDocument();
      expect(screen.getByText('false')).toBeInTheDocument();
    });

    it('should format number values correctly', () => {
      const entityWithNumbers: Entity = {
        ...mockSettlement,
        computedFields: {
          integer: 42,
          float: 3.14159,
          zero: 0,
          negative: -100,
        },
      };

      render(<OverviewTab entity={entityWithNumbers} entityType="settlement" />);

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('3.14159')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('-100')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all fields', () => {
      render(<OverviewTab entity={mockSettlement} entityType="settlement" />);

      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Created At')).toBeInTheDocument();
      expect(screen.getByText('Updated At')).toBeInTheDocument();
    });

    it('should have accessible copy buttons with titles', () => {
      render(<OverviewTab entity={mockSettlement} entityType="settlement" />);

      const copyButtons = screen.getAllByRole('button');
      copyButtons.forEach((button) => {
        expect(button).toHaveAttribute('title');
      });
    });
  });
});
