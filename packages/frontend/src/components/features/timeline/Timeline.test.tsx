import { render, screen } from '@testing-library/react';
import type { TimelineItem } from 'vis-timeline/types';
import { describe, it, expect, vi } from 'vitest';

import { Timeline } from './Timeline';

// Mock vis-timeline component
vi.mock('react-vis-timeline', () => ({
  default: ({
    initialItems,
    initialGroups,
  }: {
    initialItems?: TimelineItem[];
    initialGroups?: unknown[];
  }) => (
    <div data-testid="mock-timeline">
      <div data-testid="timeline-items-count">{initialItems?.length || 0}</div>
      <div data-testid="timeline-groups-count">{initialGroups?.length || 0}</div>
    </div>
  ),
}));

describe('Timeline', () => {
  describe('Rendering', () => {
    it('should render with empty dataset', () => {
      render(<Timeline items={[]} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toBeInTheDocument();

      const itemsCount = screen.getByTestId('timeline-items-count');
      expect(itemsCount).toHaveTextContent('0');
    });

    it('should render with mock items', () => {
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event 1',
          start: new Date('2024-01-01'),
          type: 'box',
        },
        {
          id: '2',
          content: 'Event 2',
          start: new Date('2024-01-15'),
          type: 'box',
        },
        {
          id: '3',
          content: 'Encounter 1',
          start: new Date('2024-02-01'),
          type: 'point',
        },
      ];

      render(<Timeline items={mockItems} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toBeInTheDocument();

      const itemsCount = screen.getByTestId('timeline-items-count');
      expect(itemsCount).toHaveTextContent('3');
    });

    it('should render with groups for lane organization', () => {
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event 1',
          start: new Date('2024-01-01'),
          type: 'box',
          group: 'events',
        },
      ];

      const mockGroups = [
        { id: 'events', content: 'Events' },
        { id: 'encounters', content: 'Encounters' },
      ];

      render(<Timeline items={mockItems} groups={mockGroups} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toBeInTheDocument();

      const groupsCount = screen.getByTestId('timeline-groups-count');
      expect(groupsCount).toHaveTextContent('2');
    });

    it('should apply custom className', () => {
      const { container } = render(<Timeline items={[]} className="custom-timeline-class" />);

      const timelineContainer = container.querySelector('.timeline-container');
      expect(timelineContainer).toHaveClass('custom-timeline-class');
    });
  });

  describe('Props', () => {
    it('should accept optional onItemMove handler', () => {
      const mockOnItemMove = vi.fn();
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event 1',
          start: new Date('2024-01-01'),
          type: 'box',
        },
      ];

      render(<Timeline items={mockItems} onItemMove={mockOnItemMove} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toBeInTheDocument();
    });

    it('should accept optional onSelect handler', () => {
      const mockOnSelect = vi.fn();
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event 1',
          start: new Date('2024-01-01'),
          type: 'box',
        },
      ];

      render(<Timeline items={mockItems} onSelect={mockOnSelect} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toBeInTheDocument();
    });

    it('should accept custom options', () => {
      const customOptions = {
        height: '800px',
        zoomMin: 1000 * 60 * 60, // 1 hour
      };

      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event 1',
          start: new Date('2024-01-01'),
          type: 'box',
        },
      ];

      render(<Timeline items={mockItems} options={customOptions} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toBeInTheDocument();
    });
  });

  describe('Timeline Items', () => {
    it('should handle items with different types (box, point, range)', () => {
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Box Item',
          start: new Date('2024-01-01'),
          type: 'box',
        },
        {
          id: '2',
          content: 'Point Item',
          start: new Date('2024-01-15'),
          type: 'point',
        },
        {
          id: '3',
          content: 'Range Item',
          start: new Date('2024-02-01'),
          end: new Date('2024-02-10'),
          type: 'range',
        },
      ];

      render(<Timeline items={mockItems} />);

      const itemsCount = screen.getByTestId('timeline-items-count');
      expect(itemsCount).toHaveTextContent('3');
    });

    it('should handle items with custom styling', () => {
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Styled Event',
          start: new Date('2024-01-01'),
          type: 'box',
          className: 'custom-item-class',
          style: 'background-color: #ff0000;',
        },
      ];

      render(<Timeline items={mockItems} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toBeInTheDocument();
    });

    it('should handle items with group assignment', () => {
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event in Group 1',
          start: new Date('2024-01-01'),
          type: 'box',
          group: 'group1',
        },
        {
          id: '2',
          content: 'Event in Group 2',
          start: new Date('2024-01-15'),
          type: 'box',
          group: 'group2',
        },
      ];

      const mockGroups = [
        { id: 'group1', content: 'Group 1' },
        { id: 'group2', content: 'Group 2' },
      ];

      render(<Timeline items={mockItems} groups={mockGroups} />);

      const itemsCount = screen.getByTestId('timeline-items-count');
      expect(itemsCount).toHaveTextContent('2');

      const groupsCount = screen.getByTestId('timeline-groups-count');
      expect(groupsCount).toHaveTextContent('2');
    });
  });
});
