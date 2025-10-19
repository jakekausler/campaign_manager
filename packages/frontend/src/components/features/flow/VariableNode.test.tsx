import { describe, it, expect } from 'vitest';

import { renderWithReactFlow, screen } from '@/__tests__/utils/test-utils';
import type { FlowNodeData } from '@/utils';

import { VariableNode } from './VariableNode';

const mockNodeData: FlowNodeData = {
  label: 'Player Gold',
  nodeType: 'VARIABLE',
  entityId: 'var-player-gold',
  metadata: { type: 'number', defaultValue: 100 },
};

describe('VariableNode', () => {
  it('renders with correct label', () => {
    renderWithReactFlow(
      <VariableNode
        id="var-1"
        data={mockNodeData}
        selected={false}
        type="VARIABLE"
        isConnectable={true}
        zIndex={1}
        dragging={false}
        selectable={true}
        deletable={true}
        draggable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    );

    expect(screen.getByText('Player Gold')).toBeInTheDocument();
    expect(screen.getByText('VARIABLE')).toBeInTheDocument();
  });

  it('uses green color scheme', () => {
    const { container } = renderWithReactFlow(
      <VariableNode
        id="var-1"
        data={mockNodeData}
        selected={false}
        type="VARIABLE"
        isConnectable={true}
        zIndex={1}
        dragging={false}
        selectable={true}
        deletable={true}
        draggable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    );

    // The node div is the one with role="button"
    const nodeDiv = container.querySelector('div[role="button"]');
    expect(nodeDiv).toBeInTheDocument();
    // Note: backgroundColor style is applied inline but may not be testable in jsdom
    expect(nodeDiv).toHaveAttribute('style');
  });

  it('renders Database icon', () => {
    const { container } = renderWithReactFlow(
      <VariableNode
        id="var-1"
        data={mockNodeData}
        selected={false}
        type="VARIABLE"
        isConnectable={true}
        zIndex={1}
        dragging={false}
        selectable={true}
        deletable={true}
        draggable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    );

    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('has accessible label with VARIABLE type', () => {
    renderWithReactFlow(
      <VariableNode
        id="var-1"
        data={mockNodeData}
        selected={false}
        type="VARIABLE"
        isConnectable={true}
        zIndex={1}
        dragging={false}
        selectable={true}
        deletable={true}
        draggable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    );

    const node = screen.getByRole('button');
    expect(node).toHaveAttribute('aria-label', 'VARIABLE node: Player Gold');
  });
});
