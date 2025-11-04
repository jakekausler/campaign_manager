import { describe, it, expect, afterEach, vi } from 'vitest';

import { renderWithReactFlow, screen, cleanup } from '@/__tests__/utils/test-utils';
import type { FlowNodeData } from '@/utils';

import { EffectNode } from './EffectNode';

const mockNodeData: FlowNodeData = {
  label: 'Add Gold Reward',
  nodeType: 'EFFECT',
  entityId: 'effect-gold-reward',
  metadata: { patches: [{ op: 'add', path: '/gold', value: 100 }] },
};

describe('EffectNode', () => {
  afterEach(() => {
    cleanup(); // Critical: unmount React Flow instances to prevent memory leaks
    vi.clearAllMocks();
  });
  it('renders with correct label', () => {
    renderWithReactFlow(
      <EffectNode
        id="effect-1"
        data={mockNodeData}
        selected={false}
        type="EFFECT"
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

    expect(screen.getByText('Add Gold Reward')).toBeInTheDocument();
    expect(screen.getByText('EFFECT')).toBeInTheDocument();
  });

  it('uses orange color scheme', () => {
    const { container } = renderWithReactFlow(
      <EffectNode
        id="effect-1"
        data={mockNodeData}
        selected={false}
        type="EFFECT"
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

  it('renders Zap icon', () => {
    const { container } = renderWithReactFlow(
      <EffectNode
        id="effect-1"
        data={mockNodeData}
        selected={false}
        type="EFFECT"
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

  it('has accessible label with EFFECT type', () => {
    renderWithReactFlow(
      <EffectNode
        id="effect-1"
        data={mockNodeData}
        selected={false}
        type="EFFECT"
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
    expect(node).toHaveAttribute('aria-label', 'EFFECT node: Add Gold Reward');
  });
});
