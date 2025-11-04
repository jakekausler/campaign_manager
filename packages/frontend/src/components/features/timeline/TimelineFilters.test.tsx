import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { DEFAULT_FILTERS, type TimelineFilters as FilterConfig } from '@/utils/timeline-filters';

import { TimelineFilters } from './TimelineFilters';

/**
 * Integration tests for TimelineFilters component
 *
 * Tests UI interactions, filter state management, and callback invocation.
 *
 * Part of TICKET-022 Stage 11 implementation.
 */

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks();
});

describe('TimelineFilters', () => {
  describe('rendering', () => {
    it('should render all event type checkboxes', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      expect(screen.getByLabelText('Story')).toBeInTheDocument();
      expect(screen.getByLabelText('Kingdom')).toBeInTheDocument();
      expect(screen.getByLabelText('Party')).toBeInTheDocument();
      expect(screen.getByLabelText('World')).toBeInTheDocument();
    });

    it('should render all status filter checkboxes', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      expect(screen.getByLabelText('All')).toBeInTheDocument();
      expect(screen.getByLabelText('Completed')).toBeInTheDocument();
      expect(screen.getByLabelText('Scheduled')).toBeInTheDocument();
      expect(screen.getByLabelText('Overdue')).toBeInTheDocument();
      expect(screen.getByLabelText('Resolved (Encounters)')).toBeInTheDocument();
      expect(screen.getByLabelText('Unresolved (Encounters)')).toBeInTheDocument();
    });

    it('should render all grouping strategy radio buttons', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      expect(screen.getByLabelText('No Grouping')).toBeInTheDocument();
      expect(screen.getByLabelText('By Type')).toBeInTheDocument();
      expect(screen.getByLabelText('By Location')).toBeInTheDocument();
    });

    it('should check all event types by default', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      expect(screen.getByLabelText('Story')).toBeChecked();
      expect(screen.getByLabelText('Kingdom')).toBeChecked();
      expect(screen.getByLabelText('Party')).toBeChecked();
      expect(screen.getByLabelText('World')).toBeChecked();
    });

    it('should check "All" status filter by default', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      expect(screen.getByLabelText('All')).toBeChecked();
    });

    it('should select "No Grouping" by default', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      expect(screen.getByLabelText('No Grouping')).toBeChecked();
    });

    it('should apply custom className', () => {
      const onChange = vi.fn();
      const { container } = render(
        <TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('event type filtering', () => {
    it('should toggle event type when checkbox is clicked', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Story'));

      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_FILTERS,
        eventTypes: ['kingdom', 'party', 'world'],
      });
    });

    it('should add event type when unchecked checkbox is clicked', () => {
      const filters: FilterConfig = {
        eventTypes: ['kingdom'],
        statusFilters: ['all'],
        groupBy: 'none',
      };
      const onChange = vi.fn();
      render(<TimelineFilters filters={filters} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Story'));

      expect(onChange).toHaveBeenCalledWith({
        ...filters,
        eventTypes: ['kingdom', 'story'],
      });
    });

    it('should not allow deselecting all event types', () => {
      const filters: FilterConfig = {
        eventTypes: ['story'],
        statusFilters: ['all'],
        groupBy: 'none',
      };
      const onChange = vi.fn();
      render(<TimelineFilters filters={filters} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Story'));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should reflect current event type selection', () => {
      const filters: FilterConfig = {
        eventTypes: ['story', 'kingdom'],
        statusFilters: ['all'],
        groupBy: 'none',
      };
      const onChange = vi.fn();
      render(<TimelineFilters filters={filters} onChange={onChange} />);

      expect(screen.getByLabelText('Story')).toBeChecked();
      expect(screen.getByLabelText('Kingdom')).toBeChecked();
      expect(screen.getByLabelText('Party')).not.toBeChecked();
      expect(screen.getByLabelText('World')).not.toBeChecked();
    });
  });

  describe('status filtering', () => {
    it('should select "All" and deselect others when "All" is clicked', () => {
      const filters: FilterConfig = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['completed', 'scheduled'],
        groupBy: 'none',
      };
      const onChange = vi.fn();
      render(<TimelineFilters filters={filters} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('All'));

      expect(onChange).toHaveBeenCalledWith({
        ...filters,
        statusFilters: ['all'],
      });
    });

    it('should not allow deselecting "All" when it is the only filter', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('All'));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should disable "All" checkbox when it is selected', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      expect(screen.getByLabelText('All')).toBeDisabled();
    });

    it('should toggle specific status filter when clicked', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Completed'));

      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_FILTERS,
        statusFilters: ['completed'],
      });
    });

    it('should add specific status filter without removing others', () => {
      const filters: FilterConfig = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['completed'],
        groupBy: 'none',
      };
      const onChange = vi.fn();
      render(<TimelineFilters filters={filters} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Overdue'));

      expect(onChange).toHaveBeenCalledWith({
        ...filters,
        statusFilters: ['completed', 'overdue'],
      });
    });

    it('should remove specific status filter when deselected', () => {
      const filters: FilterConfig = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['completed', 'overdue'],
        groupBy: 'none',
      };
      const onChange = vi.fn();
      render(<TimelineFilters filters={filters} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Completed'));

      expect(onChange).toHaveBeenCalledWith({
        ...filters,
        statusFilters: ['overdue'],
      });
    });

    it('should default to "All" when last specific status is deselected', () => {
      const filters: FilterConfig = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['completed'],
        groupBy: 'none',
      };
      const onChange = vi.fn();
      render(<TimelineFilters filters={filters} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Completed'));

      expect(onChange).toHaveBeenCalledWith({
        ...filters,
        statusFilters: ['all'],
      });
    });

    it('should reflect current status filter selection', () => {
      const filters: FilterConfig = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['completed', 'overdue'],
        groupBy: 'none',
      };
      const onChange = vi.fn();
      render(<TimelineFilters filters={filters} onChange={onChange} />);

      expect(screen.getByLabelText('All')).not.toBeChecked();
      expect(screen.getByLabelText('Completed')).toBeChecked();
      expect(screen.getByLabelText('Scheduled')).not.toBeChecked();
      expect(screen.getByLabelText('Overdue')).toBeChecked();
      expect(screen.getByLabelText('Resolved (Encounters)')).not.toBeChecked();
      expect(screen.getByLabelText('Unresolved (Encounters)')).not.toBeChecked();
    });
  });

  describe('lane grouping', () => {
    it('should change grouping strategy when radio button is clicked', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('By Type'));

      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_FILTERS,
        groupBy: 'type',
      });
    });

    it('should select "By Location" when clicked', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('By Location'));

      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_FILTERS,
        groupBy: 'location',
      });
    });

    it('should reflect current grouping strategy', () => {
      const filters: FilterConfig = {
        eventTypes: ['story', 'kingdom', 'party', 'world'],
        statusFilters: ['all'],
        groupBy: 'type',
      };
      const onChange = vi.fn();
      render(<TimelineFilters filters={filters} onChange={onChange} />);

      expect(screen.getByLabelText('No Grouping')).not.toBeChecked();
      expect(screen.getByLabelText('By Type')).toBeChecked();
      expect(screen.getByLabelText('By Location')).not.toBeChecked();
    });
  });

  describe('accessibility', () => {
    it('should have proper label associations for checkboxes', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      const storyCheckbox = screen.getByLabelText('Story') as HTMLInputElement;
      expect(storyCheckbox.type).toBe('checkbox');

      const allCheckbox = screen.getByLabelText('All') as HTMLInputElement;
      expect(allCheckbox.type).toBe('checkbox');
    });

    it('should have proper label associations for radio buttons', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      const noGroupingRadio = screen.getByLabelText('No Grouping') as HTMLInputElement;
      expect(noGroupingRadio.type).toBe('radio');
      expect(noGroupingRadio.name).toBe('groupStrategy');
    });

    it('should have section headings', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      expect(screen.getByText('Event Types')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Lane Grouping')).toBeInTheDocument();
    });
  });

  describe('interaction combinations', () => {
    it('should handle multiple event type changes', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Story'));
      fireEvent.click(screen.getByLabelText('Kingdom'));

      expect(onChange).toHaveBeenCalledTimes(2);
      // First click removes 'story'
      expect(onChange).toHaveBeenNthCalledWith(1, {
        ...DEFAULT_FILTERS,
        eventTypes: ['kingdom', 'party', 'world'],
      });
      // Second click removes 'kingdom' from ORIGINAL state (controlled component)
      // Result is ['story', 'party', 'world'] because props weren't updated between clicks
      expect(onChange).toHaveBeenNthCalledWith(2, {
        ...DEFAULT_FILTERS,
        eventTypes: ['story', 'party', 'world'],
      });
    });

    it('should handle multiple status filter changes', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Completed'));
      fireEvent.click(screen.getByLabelText('Overdue'));

      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('should handle grouping strategy changes', () => {
      const onChange = vi.fn();
      render(<TimelineFilters filters={DEFAULT_FILTERS} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('By Type'));
      fireEvent.click(screen.getByLabelText('By Location'));

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith({
        ...DEFAULT_FILTERS,
        groupBy: 'location',
      });
    });
  });
});
