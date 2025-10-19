import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Node } from '@xyflow/react';
import { describe, it, expect, vi } from 'vitest';

import type { FlowNodeData } from '@/utils';

import { SelectionPanel } from './SelectionPanel';

/**
 * Test suite for SelectionPanel component
 *
 * Tests the selection information panel that displays selected node details
 * and dependency counts.
 * Part of TICKET-021 Stage 8: Selection and Highlighting
 */

// Helper to create a test node
function createTestNode(
  id: string,
  label: string,
  nodeType: 'VARIABLE' | 'CONDITION' | 'EFFECT' | 'ENTITY' = 'VARIABLE'
): Node<FlowNodeData> {
  return {
    id,
    type: nodeType.toLowerCase(),
    data: {
      label,
      nodeType,
      entityId: `entity-${id}`,
    },
    position: { x: 0, y: 0 },
  };
}

describe('SelectionPanel', () => {
  describe('rendering', () => {
    it('should not render when no nodes are selected', () => {
      const { container } = render(
        <SelectionPanel
          selectedNodes={[]}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when nodes are selected', () => {
      const nodes = [createTestNode('1', 'Test Node')];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      expect(screen.getByText('Selection')).toBeInTheDocument();
    });

    it('should display count for multiple selected nodes', () => {
      const nodes = [createTestNode('1', 'Node 1'), createTestNode('2', 'Node 2')];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      expect(screen.getByText('Selection (2)')).toBeInTheDocument();
    });

    it('should not display count for single selected node', () => {
      const nodes = [createTestNode('1', 'Test Node')];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      expect(screen.getByText('Selection')).toBeInTheDocument();
      expect(screen.queryByText('Selection (1)')).not.toBeInTheDocument();
    });
  });

  describe('selected node display', () => {
    it('should display selected node label and type', () => {
      const nodes = [createTestNode('1', 'My Variable', 'VARIABLE')];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      expect(screen.getByText('My Variable')).toBeInTheDocument();
      expect(screen.getByText('VARIABLE')).toBeInTheDocument();
    });

    it('should display all selected nodes', () => {
      const nodes = [
        createTestNode('1', 'Variable A', 'VARIABLE'),
        createTestNode('2', 'Condition B', 'CONDITION'),
        createTestNode('3', 'Effect C', 'EFFECT'),
      ];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      expect(screen.getByText('Variable A')).toBeInTheDocument();
      expect(screen.getByText('Condition B')).toBeInTheDocument();
      expect(screen.getByText('Effect C')).toBeInTheDocument();
    });

    it('should truncate long node labels', () => {
      const nodes = [
        createTestNode('1', 'Very Long Node Label That Should Be Truncated', 'VARIABLE'),
      ];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      const labelElement = screen.getByText('Very Long Node Label That Should Be Truncated');
      expect(labelElement).toHaveClass('truncate');
    });
  });

  describe('dependency counts', () => {
    it('should display upstream dependency count', () => {
      const nodes = [createTestNode('1', 'Test Node')];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={5}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      expect(screen.getByText('Upstream dependencies:')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display downstream dependent count', () => {
      const nodes = [createTestNode('1', 'Test Node')];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={3}
          onClearSelection={vi.fn()}
        />
      );

      expect(screen.getByText('Downstream dependents:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display zero counts correctly', () => {
      const nodes = [createTestNode('1', 'Test Node')];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      // Should display two "0" values (one for upstream, one for downstream)
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements).toHaveLength(2);
    });
  });

  describe('legend', () => {
    it('should display highlight legend', () => {
      const nodes = [createTestNode('1', 'Test Node')];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      expect(screen.getByText('Highlight Legend:')).toBeInTheDocument();
      expect(screen.getByText('Selected')).toBeInTheDocument();
      expect(screen.getByText('Upstream (dependencies)')).toBeInTheDocument();
      expect(screen.getByText('Downstream (dependents)')).toBeInTheDocument();
    });
  });

  describe('clear selection', () => {
    it('should call onClearSelection when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onClearSelection = vi.fn();
      const nodes = [createTestNode('1', 'Test Node')];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={onClearSelection}
        />
      );

      const clearButton = screen.getByLabelText('Clear selection');
      await user.click(clearButton);

      expect(onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('should have proper accessibility attributes on clear button', () => {
      const nodes = [createTestNode('1', 'Test Node')];

      render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      const clearButton = screen.getByLabelText('Clear selection');
      expect(clearButton).toHaveAttribute('title', 'Clear selection (Esc)');
    });
  });

  describe('styling', () => {
    it('should have correct positioning classes', () => {
      const nodes = [createTestNode('1', 'Test Node')];

      const { container } = render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveClass('absolute', 'bottom-4', 'left-4', 'z-10');
    });

    it('should have card styling', () => {
      const nodes = [createTestNode('1', 'Test Node')];

      const { container } = render(
        <SelectionPanel
          selectedNodes={nodes}
          upstreamCount={0}
          downstreamCount={0}
          onClearSelection={vi.fn()}
        />
      );

      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveClass('bg-card', 'border', 'rounded-lg', 'shadow-lg');
    });
  });
});
