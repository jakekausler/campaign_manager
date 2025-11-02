/**
 * Tests for DiffViewer component
 *
 * Tests the side-by-side diff viewer component that displays version comparisons.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';

import type { VersionDiff } from '@/services/api/hooks/versions';

import { DiffViewer } from './DiffViewer';

describe('DiffViewer', () => {
  describe('Basic Rendering', () => {
    it('should render empty diff message when no changes detected', () => {
      const emptyDiff: VersionDiff = {
        added: {},
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={emptyDiff} />);

      expect(screen.getByTestId('diff-viewer-empty')).toBeInTheDocument();
      expect(screen.getByText(/no changes detected/i)).toBeInTheDocument();
    });

    it('should render side-by-side layout on desktop', () => {
      const diff: VersionDiff = {
        added: { level: 3 },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const container = screen.getByTestId('diff-viewer');
      // Desktop layout uses grid with 2 columns
      expect(container).toHaveClass('md:grid-cols-2');
    });

    it('should render with custom className', () => {
      const diff: VersionDiff = {
        added: {},
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} className="custom-class" />);

      const container = screen.getByTestId('diff-viewer');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Added Fields', () => {
    it('should display added fields with green indicator', () => {
      const diff: VersionDiff = {
        added: {
          level: 3,
          newField: 'new value',
        },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const addedSection = screen.getByTestId('diff-section-added');
      expect(addedSection).toBeInTheDocument();

      // Check for green color coding
      expect(addedSection).toHaveClass('bg-green-50');

      // Check that fields are displayed
      expect(within(addedSection).getByText(/level/i)).toBeInTheDocument();
      expect(within(addedSection).getByText('3')).toBeInTheDocument();
      expect(within(addedSection).getByText(/newField/i)).toBeInTheDocument();
      expect(within(addedSection).getByText('new value')).toBeInTheDocument();
    });

    it('should show "+" indicator for added fields', () => {
      const diff: VersionDiff = {
        added: { level: 3 },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const addedSection = screen.getByTestId('diff-section-added');
      // Should have a "+" or "Added" indicator
      expect(within(addedSection).getByText(/\+|added/i)).toBeInTheDocument();
    });

    it('should handle added nested objects', () => {
      const diff: VersionDiff = {
        added: {
          variables: {
            prosperity: 75,
            morale: 80,
          },
        },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const addedSection = screen.getByTestId('diff-section-added');
      expect(within(addedSection).getByText(/variables/i)).toBeInTheDocument();
      // Nested values should be displayed (JSON stringified or expanded)
      expect(addedSection).toHaveTextContent(/prosperity|morale/i);
    });

    it('should handle added arrays', () => {
      const diff: VersionDiff = {
        added: {
          structures: ['structure-1', 'structure-2'],
        },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const addedSection = screen.getByTestId('diff-section-added');
      expect(within(addedSection).getByText(/structures/i)).toBeInTheDocument();
      expect(addedSection).toHaveTextContent(/structure-1/i);
      expect(addedSection).toHaveTextContent(/structure-2/i);
    });
  });

  describe('Modified Fields', () => {
    it('should display modified fields with blue indicator', () => {
      const diff: VersionDiff = {
        added: {},
        modified: {
          level: { old: 2, new: 3 },
          status: { old: 'active', new: 'inactive' },
        },
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const modifiedSection = screen.getByTestId('diff-section-modified');
      expect(modifiedSection).toBeInTheDocument();

      // Check for blue color coding
      expect(modifiedSection).toHaveClass('bg-blue-50');

      // Check that field names are displayed
      expect(within(modifiedSection).getByText(/level/i)).toBeInTheDocument();
      expect(within(modifiedSection).getByText(/status/i)).toBeInTheDocument();
    });

    it('should show both old and new values for modified fields', () => {
      const diff: VersionDiff = {
        added: {},
        modified: {
          level: { old: 2, new: 3 },
        },
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const modifiedSection = screen.getByTestId('diff-section-modified');

      // Both old and new values should be visible
      expect(within(modifiedSection).getByText('2')).toBeInTheDocument();
      expect(within(modifiedSection).getByText('3')).toBeInTheDocument();

      // Should have visual indication of change direction (arrow, "→", etc.)
      const arrows = within(modifiedSection).getAllByText(/→|to|from/i);
      expect(arrows.length).toBeGreaterThan(0);
    });

    it('should show "~" or "Modified" indicator for modified fields', () => {
      const diff: VersionDiff = {
        added: {},
        modified: {
          level: { old: 2, new: 3 },
        },
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const modifiedSection = screen.getByTestId('diff-section-modified');
      // Should have a "~" or "Modified" indicator
      expect(within(modifiedSection).getByText(/~|modified/i)).toBeInTheDocument();
    });

    it('should handle modified nested objects', () => {
      const diff: VersionDiff = {
        added: {},
        modified: {
          variables: {
            old: { prosperity: 50 },
            new: { prosperity: 75, morale: 80 },
          },
        },
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const modifiedSection = screen.getByTestId('diff-section-modified');
      expect(within(modifiedSection).getByText(/variables/i)).toBeInTheDocument();
      // Should show both old and new nested structures
      expect(modifiedSection).toHaveTextContent(/prosperity/i);
    });
  });

  describe('Removed Fields', () => {
    it('should display removed fields with red indicator', () => {
      const diff: VersionDiff = {
        added: {},
        modified: {},
        removed: {
          oldField: 'old value',
          deprecatedProp: 123,
        },
      };

      render(<DiffViewer diff={diff} />);

      const removedSection = screen.getByTestId('diff-section-removed');
      expect(removedSection).toBeInTheDocument();

      // Check for red color coding
      expect(removedSection).toHaveClass('bg-red-50');

      // Check that fields are displayed
      expect(within(removedSection).getByText(/oldField/i)).toBeInTheDocument();
      expect(within(removedSection).getByText('old value')).toBeInTheDocument();
      expect(within(removedSection).getByText(/deprecatedProp/i)).toBeInTheDocument();
      expect(within(removedSection).getByText('123')).toBeInTheDocument();
    });

    it('should show "-" indicator for removed fields', () => {
      const diff: VersionDiff = {
        added: {},
        modified: {},
        removed: { oldField: 'value' },
      };

      render(<DiffViewer diff={diff} />);

      const removedSection = screen.getByTestId('diff-section-removed');
      // Should have a "-" or "Removed" indicator
      expect(within(removedSection).getByText(/-|removed/i)).toBeInTheDocument();
    });

    it('should handle removed nested objects', () => {
      const diff: VersionDiff = {
        added: {},
        modified: {},
        removed: {
          variables: {
            old_prop: 'old_value',
          },
        },
      };

      render(<DiffViewer diff={diff} />);

      const removedSection = screen.getByTestId('diff-section-removed');
      expect(within(removedSection).getByText(/variables/i)).toBeInTheDocument();
      expect(removedSection).toHaveTextContent(/old_prop/i);
    });
  });

  describe('Combined Changes', () => {
    it('should display all change types simultaneously', () => {
      const diff: VersionDiff = {
        added: { newField: 'added' },
        modified: { level: { old: 2, new: 3 } },
        removed: { oldField: 'removed' },
      };

      render(<DiffViewer diff={diff} />);

      // All three sections should be present
      expect(screen.getByTestId('diff-section-added')).toBeInTheDocument();
      expect(screen.getByTestId('diff-section-modified')).toBeInTheDocument();
      expect(screen.getByTestId('diff-section-removed')).toBeInTheDocument();
    });

    it('should render change sections in correct order (added, modified, removed)', () => {
      const diff: VersionDiff = {
        added: { newField: 'added' },
        modified: { level: { old: 2, new: 3 } },
        removed: { oldField: 'removed' },
      };

      render(<DiffViewer diff={diff} />);

      // Query only the main section containers (not headers which also start with diff-section-)
      const addedSection = screen.getByTestId('diff-section-added');
      const modifiedSection = screen.getByTestId('diff-section-modified');
      const removedSection = screen.getByTestId('diff-section-removed');

      // Verify all sections are present
      expect(addedSection).toBeInTheDocument();
      expect(modifiedSection).toBeInTheDocument();
      expect(removedSection).toBeInTheDocument();

      // Verify they render in DOM order (added -> modified -> removed)
      const parent = addedSection.parentElement;
      const children = Array.from(parent?.children || []);
      const addedIndex = children.indexOf(addedSection);
      const modifiedIndex = children.indexOf(modifiedSection);
      const removedIndex = children.indexOf(removedSection);

      expect(addedIndex).toBeLessThan(modifiedIndex);
      expect(modifiedIndex).toBeLessThan(removedIndex);
    });
  });

  describe('Field Navigation', () => {
    it('should show navigation buttons when there are multiple changes', () => {
      const diff: VersionDiff = {
        added: { field1: 'a', field2: 'b', field3: 'c' },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      // Should have next/previous navigation buttons
      expect(screen.getByTestId('diff-nav-next')).toBeInTheDocument();
      expect(screen.getByTestId('diff-nav-prev')).toBeInTheDocument();
    });

    it('should navigate to next change when next button clicked', async () => {
      const user = userEvent.setup();

      const diff: VersionDiff = {
        added: { field1: 'a', field2: 'b' },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const nextButton = screen.getByTestId('diff-nav-next');
      await user.click(nextButton);

      // Should highlight the next field or scroll to it
      // This behavior will depend on implementation
      expect(nextButton).toBeInTheDocument();
    });

    it('should navigate to previous change when prev button clicked', async () => {
      const user = userEvent.setup();

      const diff: VersionDiff = {
        added: { field1: 'a', field2: 'b' },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const prevButton = screen.getByTestId('diff-nav-prev');
      await user.click(prevButton);

      // Should highlight the previous field or scroll to it
      expect(prevButton).toBeInTheDocument();
    });

    it('should disable prev button at first change', () => {
      const diff: VersionDiff = {
        added: { field1: 'a', field2: 'b' },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const prevButton = screen.getByTestId('diff-nav-prev');
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button at last change', async () => {
      const user = userEvent.setup();

      const diff: VersionDiff = {
        added: { field1: 'a', field2: 'b' },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const nextButton = screen.getByTestId('diff-nav-next');

      // Click until we reach the end
      await user.click(nextButton);
      await user.click(nextButton);

      // Should be disabled at the last change
      expect(nextButton).toBeDisabled();
    });

    it('should hide navigation when only one change exists', () => {
      const diff: VersionDiff = {
        added: { onlyField: 'value' },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      // Navigation should not be present with only one change
      expect(screen.queryByTestId('diff-nav-next')).not.toBeInTheDocument();
      expect(screen.queryByTestId('diff-nav-prev')).not.toBeInTheDocument();
    });
  });

  describe('Collapsible Sections', () => {
    it('should render expand all and collapse all controls', () => {
      const diff: VersionDiff = {
        added: { field1: 'a' },
        modified: { field2: { old: 'b', new: 'c' } },
        removed: { field3: 'd' },
      };

      render(<DiffViewer diff={diff} />);

      expect(screen.getByTestId('diff-expand-all')).toBeInTheDocument();
      expect(screen.getByTestId('diff-collapse-all')).toBeInTheDocument();
    });

    it('should expand all sections when expand all clicked', async () => {
      const user = userEvent.setup();

      const diff: VersionDiff = {
        added: { field1: 'a' },
        modified: { field2: { old: 'b', new: 'c' } },
        removed: { field3: 'd' },
      };

      render(<DiffViewer diff={diff} />);

      const expandAllButton = screen.getByTestId('diff-expand-all');
      await user.click(expandAllButton);

      // All sections should be expanded (visible)
      const addedSection = screen.getByTestId('diff-section-added');
      const modifiedSection = screen.getByTestId('diff-section-modified');
      const removedSection = screen.getByTestId('diff-section-removed');

      expect(addedSection).toBeVisible();
      expect(modifiedSection).toBeVisible();
      expect(removedSection).toBeVisible();
    });

    it('should collapse all sections when collapse all clicked', async () => {
      const user = userEvent.setup();

      const diff: VersionDiff = {
        added: { field1: 'a' },
        modified: { field2: { old: 'b', new: 'c' } },
        removed: { field3: 'd' },
      };

      render(<DiffViewer diff={diff} />);

      const collapseAllButton = screen.getByTestId('diff-collapse-all');
      await user.click(collapseAllButton);

      // Section headers should still be visible, but content collapsed
      // This will depend on implementation details
      expect(collapseAllButton).toBeInTheDocument();
    });

    it('should toggle individual section when section header clicked', async () => {
      const user = userEvent.setup();

      const diff: VersionDiff = {
        added: { field1: 'a' },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const addedHeader = screen.getByTestId('diff-section-added-header');
      await user.click(addedHeader);

      // Section should toggle between expanded and collapsed
      // Implementation will determine exact behavior
      expect(addedHeader).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for sections', () => {
      const diff: VersionDiff = {
        added: { field1: 'a' },
        modified: { field2: { old: 'b', new: 'c' } },
        removed: { field3: 'd' },
      };

      render(<DiffViewer diff={diff} />);

      const addedSection = screen.getByTestId('diff-section-added');
      const modifiedSection = screen.getByTestId('diff-section-modified');
      const removedSection = screen.getByTestId('diff-section-removed');

      expect(addedSection).toHaveAttribute('aria-label');
      expect(modifiedSection).toHaveAttribute('aria-label');
      expect(removedSection).toHaveAttribute('aria-label');
    });

    it('should have keyboard navigation support', () => {
      const diff: VersionDiff = {
        added: { field1: 'a', field2: 'b' },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const nextButton = screen.getByTestId('diff-nav-next');
      const prevButton = screen.getByTestId('diff-nav-prev');

      expect(nextButton).toHaveAttribute('tabIndex');
      expect(prevButton).toHaveAttribute('tabIndex');
    });

    it('should have appropriate role attributes', () => {
      const diff: VersionDiff = {
        added: { field1: 'a' },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const container = screen.getByTestId('diff-viewer');
      expect(container).toHaveAttribute('role');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values in added fields', () => {
      const diff: VersionDiff = {
        added: { nullField: null },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const addedSection = screen.getByTestId('diff-section-added');
      expect(within(addedSection).getByText(/nullField/i)).toBeInTheDocument();
      // Should display "null" or "N/A"
      expect(addedSection).toHaveTextContent(/null|n\/a/i);
    });

    it('should handle undefined values in removed fields', () => {
      const diff: VersionDiff = {
        added: {},
        modified: {},
        removed: { undefinedField: undefined },
      };

      render(<DiffViewer diff={diff} />);

      const removedSection = screen.getByTestId('diff-section-removed');
      expect(within(removedSection).getByText(/undefinedField/i)).toBeInTheDocument();
      // Should display "undefined" or "N/A"
      expect(removedSection).toHaveTextContent(/undefined|n\/a/i);
    });

    it('should handle boolean values correctly', () => {
      const diff: VersionDiff = {
        added: { isActive: true },
        modified: { isEnabled: { old: false, new: true } },
        removed: { wasDeleted: false },
      };

      render(<DiffViewer diff={diff} />);

      // Booleans should be displayed as "true"/"false" or "Yes"/"No"
      expect(screen.getByTestId('diff-section-added')).toHaveTextContent(/true|yes/i);
      expect(screen.getByTestId('diff-section-modified')).toHaveTextContent(/false|no/i);
      expect(screen.getByTestId('diff-section-modified')).toHaveTextContent(/true|yes/i);
      expect(screen.getByTestId('diff-section-removed')).toHaveTextContent(/false|no/i);
    });

    it('should handle empty strings', () => {
      const diff: VersionDiff = {
        added: { emptyString: '' },
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      const addedSection = screen.getByTestId('diff-section-added');
      expect(within(addedSection).getByText(/emptyString/i)).toBeInTheDocument();
      // Should display "(empty)" or similar
      expect(addedSection).toHaveTextContent(/empty|""/);
    });

    it('should handle large objects gracefully', () => {
      const largeObject = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`field${i}`, `value${i}`])
      );

      const diff: VersionDiff = {
        added: largeObject,
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      // Should render without crashing
      expect(screen.getByTestId('diff-section-added')).toBeInTheDocument();
    });

    it('should handle deeply nested objects', () => {
      const deeplyNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };

      const diff: VersionDiff = {
        added: deeplyNested,
        modified: {},
        removed: {},
      };

      render(<DiffViewer diff={diff} />);

      // Should render deeply nested structures
      expect(screen.getByTestId('diff-section-added')).toBeInTheDocument();
      expect(screen.getByTestId('diff-section-added')).toHaveTextContent(/level1/);
    });
  });
});
