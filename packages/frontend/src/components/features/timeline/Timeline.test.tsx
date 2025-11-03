import { render, screen } from '@testing-library/react';
import type { TimelineItem, TimelineGroup, TimelineOptions } from 'vis-timeline/types';
import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';

import { Timeline } from './Timeline';

// Type definitions for mock objects
type MockHTMLElement = {
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
};

type EventHandler = (...args: unknown[]) => void;

interface MockDataItem {
  id: string | number;
  [key: string]: unknown;
}

// Mock vis-timeline and vis-data libraries
vi.mock('vis-timeline/standalone', () => {
  class MockTimeline {
    container: MockHTMLElement;
    items: MockDataItem[];
    groups: TimelineGroup[];
    options: Partial<TimelineOptions>;
    customTimes: Map<string, Date>;
    eventHandlers: Map<string, EventHandler>;
    setItems: Mock;
    setGroups: Mock;
    setOptions: Mock;
    addCustomTime: Mock;
    setCustomTime: Mock;
    removeCustomTime: Mock;
    on: Mock;
    zoomIn: Mock;
    zoomOut: Mock;
    fit: Mock;
    moveTo: Mock;
    destroy: Mock;
    setSelection: Mock;
    getSelection: Mock;

    constructor(
      container: MockHTMLElement,
      items: MockDataItem[],
      groups: TimelineGroup[],
      options: Partial<TimelineOptions>
    ) {
      this.container = container;
      this.items = items;
      this.groups = groups;
      this.options = options;
      this.customTimes = new Map();
      this.eventHandlers = new Map();

      // Mock methods
      this.setItems = vi.fn((newItems: MockDataItem[]) => {
        this.items = newItems;
      });
      this.setGroups = vi.fn((newGroups: TimelineGroup[]) => {
        this.groups = newGroups;
      });
      this.setOptions = vi.fn((newOptions: Partial<TimelineOptions>) => {
        this.options = { ...this.options, ...newOptions };
      });
      this.addCustomTime = vi.fn((time: Date, id: string) => {
        this.customTimes.set(id, time);
        if (container?.setAttribute) {
          container.setAttribute(`data-custom-time-${id}`, time.toISOString());
        }
      });
      this.setCustomTime = vi.fn((time: Date, id: string) => {
        this.customTimes.set(id, time);
        if (container?.setAttribute) {
          container.setAttribute(`data-custom-time-${id}`, time.toISOString());
        }
      });
      this.removeCustomTime = vi.fn((id: string) => {
        this.customTimes.delete(id);
        if (container?.removeAttribute) {
          container.removeAttribute(`data-custom-time-${id}`);
        }
      });
      this.on = vi.fn((event: string, handler: EventHandler) => {
        this.eventHandlers.set(event, handler);
      });
      this.zoomIn = vi.fn();
      this.zoomOut = vi.fn();
      this.fit = vi.fn();
      this.moveTo = vi.fn();
      this.destroy = vi.fn();
      this.setSelection = vi.fn();
      this.getSelection = vi.fn(() => []);

      // Add data attributes for testing
      if (container?.setAttribute) {
        container.setAttribute('data-testid', 'mock-timeline');
        container.setAttribute('data-items-count', items?.length?.toString() || '0');
        container.setAttribute('data-groups-count', groups?.length?.toString() || '0');
      }
    }
  }

  return { Timeline: MockTimeline };
});

vi.mock('vis-data', () => {
  class MockDataSet<T extends MockDataItem = MockDataItem> {
    data: T[];
    length: number;
    add: Mock;
    clear: Mock;
    update: Mock;
    get: Mock;

    constructor(data: T[] | T = []) {
      this.data = Array.isArray(data) ? [...data] : [];
      this.length = this.data.length;

      this.add = vi.fn((items: T | T[]) => {
        const itemsArray = Array.isArray(items) ? items : [items];
        this.data.push(...itemsArray);
        this.length = this.data.length;
      });
      this.clear = vi.fn(() => {
        this.data = [];
        this.length = 0;
      });
      this.update = vi.fn((item: T) => {
        const index = this.data.findIndex((d) => d.id === item.id);
        if (index !== -1) {
          this.data[index] = item;
        }
      });
      this.get = vi.fn((id: string | number) => {
        return this.data.find((d) => d.id === id);
      });
    }
  }

  return { DataSet: MockDataSet };
});

describe('Timeline', () => {
  describe('Rendering', () => {
    it('should render with empty dataset', () => {
      render(<Timeline items={[]} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toBeInTheDocument();
      expect(timeline).toHaveAttribute('data-items-count', '0');
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
      expect(timeline).toHaveAttribute('data-items-count', '3');
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
      expect(timeline).toHaveAttribute('data-groups-count', '2');
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

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toHaveAttribute('data-items-count', '3');
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

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toHaveAttribute('data-items-count', '2');
      expect(timeline).toHaveAttribute('data-groups-count', '2');
    });
  });

  describe('Current World Time Marker', () => {
    it('should not render custom time marker when currentTime is null', () => {
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event 1',
          start: new Date('2024-01-01'),
          type: 'box',
        },
      ];

      render(<Timeline items={mockItems} currentTime={null} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).not.toHaveAttribute('data-custom-time-current-world-time');
    });

    it('should not render custom time marker when currentTime is undefined', () => {
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event 1',
          start: new Date('2024-01-01'),
          type: 'box',
        },
      ];

      render(<Timeline items={mockItems} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).not.toHaveAttribute('data-custom-time-current-world-time');
    });

    it('should render custom time marker when currentTime is provided', () => {
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event 1',
          start: new Date('2024-01-01'),
          type: 'box',
        },
      ];
      const currentTime = new Date('2024-01-15T12:00:00Z');

      render(<Timeline items={mockItems} currentTime={currentTime} />);

      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toHaveAttribute(
        'data-custom-time-current-world-time',
        currentTime.toISOString()
      );
    });

    it('should update custom time marker when currentTime changes', () => {
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event 1',
          start: new Date('2024-01-01'),
          type: 'box',
        },
      ];
      const initialTime = new Date('2024-01-15T12:00:00Z');
      const updatedTime = new Date('2024-02-01T12:00:00Z');

      const { rerender } = render(<Timeline items={mockItems} currentTime={initialTime} />);

      let timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toHaveAttribute(
        'data-custom-time-current-world-time',
        initialTime.toISOString()
      );

      rerender(<Timeline items={mockItems} currentTime={updatedTime} />);

      timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toHaveAttribute(
        'data-custom-time-current-world-time',
        updatedTime.toISOString()
      );
    });

    it('should remove custom time marker when currentTime changes from defined to null', () => {
      const mockItems: TimelineItem[] = [
        {
          id: '1',
          content: 'Event 1',
          start: new Date('2024-01-01'),
          type: 'box',
        },
      ];
      const initialTime = new Date('2024-01-15T12:00:00Z');

      const { rerender } = render(<Timeline items={mockItems} currentTime={initialTime} />);

      let timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toHaveAttribute(
        'data-custom-time-current-world-time',
        initialTime.toISOString()
      );

      rerender(<Timeline items={mockItems} currentTime={null} />);

      timeline = screen.getByTestId('mock-timeline');
      expect(timeline).not.toHaveAttribute('data-custom-time-current-world-time');
    });
  });
});
