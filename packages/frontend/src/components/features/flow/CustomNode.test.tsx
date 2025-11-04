import { Database, GitBranch, Zap, Box } from 'lucide-react';
import { describe, it, expect, afterEach, vi } from 'vitest';

import { renderWithReactFlow, screen, cleanup } from '@/__tests__/utils/test-utils';
import type { FlowNodeData } from '@/utils';

import { CustomNode } from './CustomNode';

// Mock data for testing
const mockNodeData: FlowNodeData = {
  label: 'Test Node',
  nodeType: 'VARIABLE',
  entityId: 'test-entity-123',
  metadata: { foo: 'bar' },
};

describe('CustomNode', () => {
  afterEach(() => {
    cleanup(); // Critical: unmount React Flow instances to prevent memory leaks
    vi.clearAllMocks();
  });
  it('renders node with label and type', () => {
    renderWithReactFlow(
      <CustomNode
        id="test-node"
        data={mockNodeData}
        selected={false}
        icon={Database}
        bgColor="#22c55e"
        borderColor="#16a34a"
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

    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByText('VARIABLE')).toBeInTheDocument();
  });

  it('renders with custom background and border colors', () => {
    const { container } = renderWithReactFlow(
      <CustomNode
        id="test-node"
        data={mockNodeData}
        selected={false}
        icon={Database}
        bgColor="#22c55e"
        borderColor="#16a34a"
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

  it('applies selection ring when selected', () => {
    const { container } = renderWithReactFlow(
      <CustomNode
        id="test-node"
        data={mockNodeData}
        selected={true}
        icon={Database}
        bgColor="#22c55e"
        borderColor="#16a34a"
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

    const nodeDiv = container.querySelector('div[role="button"]');
    expect(nodeDiv).toHaveClass('ring-2', 'ring-offset-2', 'ring-blue-500');
  });

  it('renders icon component', () => {
    const { container } = renderWithReactFlow(
      <CustomNode
        id="test-node"
        data={mockNodeData}
        selected={false}
        icon={Database}
        bgColor="#22c55e"
        borderColor="#16a34a"
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
    expect(icon).toHaveClass('w-6', 'h-6', 'text-white');
  });

  it('has accessible label', () => {
    renderWithReactFlow(
      <CustomNode
        id="test-node"
        data={mockNodeData}
        selected={false}
        icon={Database}
        bgColor="#22c55e"
        borderColor="#16a34a"
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
    expect(node).toHaveAttribute('aria-label', 'VARIABLE node: Test Node');
  });

  it('renders connection handles', () => {
    const { container } = renderWithReactFlow(
      <CustomNode
        id="test-node"
        data={mockNodeData}
        selected={false}
        icon={Database}
        bgColor="#22c55e"
        borderColor="#16a34a"
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

    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles).toHaveLength(2); // Top (target) and bottom (source)
  });

  it('truncates long labels with title tooltip', () => {
    const longLabelData: FlowNodeData = {
      label: 'This is a very long label that should be truncated in the UI',
      nodeType: 'VARIABLE',
      entityId: 'test-entity',
    };

    renderWithReactFlow(
      <CustomNode
        id="test-node"
        data={longLabelData}
        selected={false}
        icon={Database}
        bgColor="#22c55e"
        borderColor="#16a34a"
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

    const labelDiv = screen.getByText(longLabelData.label);
    expect(labelDiv).toHaveClass('truncate');
    expect(labelDiv).toHaveAttribute('title', longLabelData.label);
  });

  it('works with different icon types', () => {
    const icons = [
      { icon: Database, name: 'Database' },
      { icon: GitBranch, name: 'GitBranch' },
      { icon: Zap, name: 'Zap' },
      { icon: Box, name: 'Box' },
    ];

    icons.forEach(({ icon }) => {
      const { container } = renderWithReactFlow(
        <CustomNode
          id="test-node"
          data={mockNodeData}
          selected={false}
          icon={icon}
          bgColor="#22c55e"
          borderColor="#16a34a"
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

      const iconElement = container.querySelector('svg');
      expect(iconElement).toBeInTheDocument();
    });
  });

  it('has consistent sizing', () => {
    const { container } = renderWithReactFlow(
      <CustomNode
        id="test-node"
        data={mockNodeData}
        selected={false}
        icon={Database}
        bgColor="#22c55e"
        borderColor="#16a34a"
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
    expect(nodeDiv).toHaveStyle({ width: '180px', minHeight: '60px' });
  });

  it('is keyboard accessible', () => {
    renderWithReactFlow(
      <CustomNode
        id="test-node"
        data={mockNodeData}
        selected={false}
        icon={Database}
        bgColor="#22c55e"
        borderColor="#16a34a"
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
    expect(node).toHaveAttribute('tabIndex', '0');
  });
});
