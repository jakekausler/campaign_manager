import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { EntityType } from '@/stores';
import * as stores from '@/stores';

import { SelectionInfo } from './SelectionInfo';

// Mock the selection store
vi.mock('@/stores', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof stores;
  return {
    ...actual,
    useSelectionStore: vi.fn(),
  };
});

describe('SelectionInfo', () => {
  const mockClearSelection = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when no entities are selected', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      const { container } = render(<SelectionInfo />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when one entity is selected', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      expect(screen.getByText('1 Entity Selected')).toBeInTheDocument();
    });

    it('should render when multiple entities are selected', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
          {
            id: 'structure-1',
            type: EntityType.STRUCTURE,
            name: 'Blacksmith',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      expect(screen.getByText('2 Entities Selected')).toBeInTheDocument();
    });
  });

  describe('Entity List', () => {
    it('should display settlement with correct badge', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      expect(screen.getByText('SETTLEMENT')).toBeInTheDocument();
      expect(screen.getByText('Waterdeep')).toBeInTheDocument();
    });

    it('should display structure with correct badge', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'structure-1',
            type: EntityType.STRUCTURE,
            name: 'Blacksmith',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      expect(screen.getByText('STRUCTURE')).toBeInTheDocument();
      expect(screen.getByText('Blacksmith')).toBeInTheDocument();
    });

    it('should display event with correct badge', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'event-1',
            type: EntityType.EVENT,
            name: 'Festival of Swords',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      expect(screen.getByText('EVENT')).toBeInTheDocument();
      expect(screen.getByText('Festival of Swords')).toBeInTheDocument();
    });

    it('should display encounter with correct badge', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'encounter-1',
            type: EntityType.ENCOUNTER,
            name: 'Goblin Ambush',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      expect(screen.getByText('ENCOUNTER')).toBeInTheDocument();
      expect(screen.getByText('Goblin Ambush')).toBeInTheDocument();
    });

    it('should display entity ID when name is missing', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-123',
            type: EntityType.SETTLEMENT,
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      expect(screen.getByText('settlement-123')).toBeInTheDocument();
    });

    it('should display multiple entities in list', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
          {
            id: 'structure-1',
            type: EntityType.STRUCTURE,
            name: 'Blacksmith',
          },
          {
            id: 'event-1',
            type: EntityType.EVENT,
            name: 'Festival',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      expect(screen.getByText('Waterdeep')).toBeInTheDocument();
      expect(screen.getByText('Blacksmith')).toBeInTheDocument();
      expect(screen.getByText('Festival')).toBeInTheDocument();
    });
  });

  describe('Clear Selection', () => {
    it('should call clearSelection when X button is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);

      const clearButton = screen.getByLabelText('Clear selection');
      await user.click(clearButton);

      expect(mockClearSelection).toHaveBeenCalledOnce();
    });
  });

  describe('Accessibility', () => {
    it('should have role="status"', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });

    it('should have aria-live="polite"', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('should have descriptive aria-label for single entity', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', '1 entity selected');
    });

    it('should have descriptive aria-label for multiple entities', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
          {
            id: 'structure-1',
            type: EntityType.STRUCTURE,
            name: 'Blacksmith',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', '2 entities selected');
    });

    it('should have clear button with aria-label', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      const clearButton = screen.getByLabelText('Clear selection');
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('Keyboard Hint', () => {
    it('should display Esc keyboard hint', () => {
      vi.mocked(stores.useSelectionStore).mockReturnValue({
        selectedEntities: [
          {
            id: 'settlement-1',
            type: EntityType.SETTLEMENT,
            name: 'Waterdeep',
          },
        ],
        clearSelection: mockClearSelection,
        selectEntity: vi.fn(),
        addToSelection: vi.fn(),
        removeFromSelection: vi.fn(),
        toggleSelection: vi.fn(),
      });

      render(<SelectionInfo />);
      expect(screen.getByText(/Press.*to clear selection/)).toBeInTheDocument();
      expect(screen.getByText('Esc')).toBeInTheDocument();
    });
  });
});
