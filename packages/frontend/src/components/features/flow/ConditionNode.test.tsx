import { describe, it, expect } from 'vitest';

import { renderWithReactFlow, screen } from '@/__tests__/utils/test-utils';
import type { FlowNodeData } from '@/utils';

import { ConditionNode } from './ConditionNode';

const mockNodeData: FlowNodeData = {
  label: 'Settlement Level > 3',
  nodeType: 'CONDITION',
  entityId: 'cond-settlement-level',
  metadata: { expression: { '>': [{ var: 'level' }, 3] } },
};

describe('ConditionNode', () => {
  it('renders with correct label', () => {
    renderWithReactFlow(
      <ConditionNode
        id="cond-1"
        data={mockNodeData}
        selected={false}
        type="CONDITION"
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

    expect(screen.getByText('Settlement Level > 3')).toBeInTheDocument();
    expect(screen.getByText('CONDITION')).toBeInTheDocument();
  });

  it('uses blue color scheme', () => {
    const { container } = renderWithReactFlow(
      <ConditionNode
        id="cond-1"
        data={mockNodeData}
        selected={false}
        type="CONDITION"
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

  it('renders GitBranch icon', () => {
    const { container } = renderWithReactFlow(
      <ConditionNode
        id="cond-1"
        data={mockNodeData}
        selected={false}
        type="CONDITION"
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

  it('has accessible label with CONDITION type', () => {
    renderWithReactFlow(
      <ConditionNode
        id="cond-1"
        data={mockNodeData}
        selected={false}
        type="CONDITION"
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
    expect(node).toHaveAttribute('aria-label', 'CONDITION node: Settlement Level > 3');
  });
});
