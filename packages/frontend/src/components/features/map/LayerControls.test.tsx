import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { LayerControls } from './LayerControls';
import type { LayerVisibility } from './types';

describe('LayerControls', () => {
  const defaultVisibility: LayerVisibility = {
    'location-point': true,
    'location-region': true,
    settlement: true,
    structure: true,
  };

  const mockOnToggle = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the component with title', () => {
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      expect(screen.getByTestId('layer-controls')).toBeInTheDocument();
      expect(screen.getByText('Map Layers')).toBeInTheDocument();
    });

    it('should render all four layer toggles', () => {
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      expect(screen.getByTestId('layer-toggle-location-point')).toBeInTheDocument();
      expect(screen.getByTestId('layer-toggle-location-region')).toBeInTheDocument();
      expect(screen.getByTestId('layer-toggle-settlement')).toBeInTheDocument();
      expect(screen.getByTestId('layer-toggle-structure')).toBeInTheDocument();
    });

    it('should render correct labels for each layer type', () => {
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      expect(screen.getByText('Location Points')).toBeInTheDocument();
      expect(screen.getByText('Location Regions')).toBeInTheDocument();
      expect(screen.getByText('Settlements')).toBeInTheDocument();
      expect(screen.getByText('Structures')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <LayerControls
          layerVisibility={defaultVisibility}
          onToggle={mockOnToggle}
          className="custom-class"
        />
      );

      const controls = screen.getByTestId('layer-controls');
      expect(controls.className).toContain('custom-class');
    });
  });

  describe('Checkbox State', () => {
    it('should show all checkboxes as checked when all layers are visible', () => {
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      const checkboxes = [
        screen.getByTestId('layer-checkbox-location-point'),
        screen.getByTestId('layer-checkbox-location-region'),
        screen.getByTestId('layer-checkbox-settlement'),
        screen.getByTestId('layer-checkbox-structure'),
      ] as HTMLInputElement[];

      checkboxes.forEach((checkbox) => {
        expect(checkbox.checked).toBe(true);
      });
    });

    it('should show checkboxes as unchecked when layers are hidden', () => {
      const hiddenVisibility: LayerVisibility = {
        'location-point': false,
        'location-region': false,
        settlement: false,
        structure: false,
      };

      render(<LayerControls layerVisibility={hiddenVisibility} onToggle={mockOnToggle} />);

      const checkboxes = [
        screen.getByTestId('layer-checkbox-location-point'),
        screen.getByTestId('layer-checkbox-location-region'),
        screen.getByTestId('layer-checkbox-settlement'),
        screen.getByTestId('layer-checkbox-structure'),
      ] as HTMLInputElement[];

      checkboxes.forEach((checkbox) => {
        expect(checkbox.checked).toBe(false);
      });
    });

    it('should reflect mixed visibility state correctly', () => {
      const mixedVisibility: LayerVisibility = {
        'location-point': true,
        'location-region': false,
        settlement: true,
        structure: false,
      };

      render(<LayerControls layerVisibility={mixedVisibility} onToggle={mockOnToggle} />);

      expect(
        (screen.getByTestId('layer-checkbox-location-point') as HTMLInputElement).checked
      ).toBe(true);
      expect(
        (screen.getByTestId('layer-checkbox-location-region') as HTMLInputElement).checked
      ).toBe(false);
      expect((screen.getByTestId('layer-checkbox-settlement') as HTMLInputElement).checked).toBe(
        true
      );
      expect((screen.getByTestId('layer-checkbox-structure') as HTMLInputElement).checked).toBe(
        false
      );
    });
  });

  describe('Interaction', () => {
    it('should call onToggle with correct entity type when location-point checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      const checkbox = screen.getByTestId('layer-checkbox-location-point');
      await user.click(checkbox);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
      expect(mockOnToggle).toHaveBeenCalledWith('location-point');
    });

    it('should call onToggle with correct entity type when location-region checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      const checkbox = screen.getByTestId('layer-checkbox-location-region');
      await user.click(checkbox);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
      expect(mockOnToggle).toHaveBeenCalledWith('location-region');
    });

    it('should call onToggle with correct entity type when settlement checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      const checkbox = screen.getByTestId('layer-checkbox-settlement');
      await user.click(checkbox);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
      expect(mockOnToggle).toHaveBeenCalledWith('settlement');
    });

    it('should call onToggle with correct entity type when structure checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      const checkbox = screen.getByTestId('layer-checkbox-structure');
      await user.click(checkbox);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
      expect(mockOnToggle).toHaveBeenCalledWith('structure');
    });

    it('should call onToggle when clicking on the label', async () => {
      const user = userEvent.setup();
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      const label = screen.getByTestId('layer-toggle-settlement');
      await user.click(label);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
      expect(mockOnToggle).toHaveBeenCalledWith('settlement');
    });

    it('should handle multiple toggle clicks', async () => {
      const user = userEvent.setup();
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      const locationPointCheckbox = screen.getByTestId('layer-checkbox-location-point');
      const settlementCheckbox = screen.getByTestId('layer-checkbox-settlement');

      await user.click(locationPointCheckbox);
      await user.click(settlementCheckbox);
      await user.click(locationPointCheckbox);

      expect(mockOnToggle).toHaveBeenCalledTimes(3);
      expect(mockOnToggle).toHaveBeenNthCalledWith(1, 'location-point');
      expect(mockOnToggle).toHaveBeenNthCalledWith(2, 'settlement');
      expect(mockOnToggle).toHaveBeenNthCalledWith(3, 'location-point');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on checkboxes', () => {
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      expect(screen.getByLabelText('Toggle Location Points')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle Location Regions')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle Settlements')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle Structures')).toBeInTheDocument();
    });

    it('should allow keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      const checkbox = screen.getByTestId('layer-checkbox-location-point');

      // Tab to focus
      await user.tab();
      expect(checkbox).toHaveFocus();

      // Space to toggle
      await user.keyboard(' ');
      expect(mockOnToggle).toHaveBeenCalledWith('location-point');
    });
  });

  describe('Visual Indicators', () => {
    it('should render color indicators for each layer type', () => {
      render(<LayerControls layerVisibility={defaultVisibility} onToggle={mockOnToggle} />);

      const controls = screen.getByTestId('layer-controls');

      // Check for colored circles (should have bg-* classes)
      const colorIndicators = controls.querySelectorAll('.rounded-full');
      expect(colorIndicators).toHaveLength(4);

      // Verify colors exist (blue, green, amber)
      const colorClasses = Array.from(colorIndicators).map((el) => el.className);
      expect(colorClasses.some((c) => c.includes('bg-blue-500'))).toBe(true);
      expect(colorClasses.some((c) => c.includes('bg-green-500'))).toBe(true);
      expect(colorClasses.some((c) => c.includes('bg-amber-500'))).toBe(true);
    });
  });
});
